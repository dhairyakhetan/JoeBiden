import { unstable_HistoryRouter as HistoryRouter, Routes, Route, Navigate, useLocation, useNavigate, useNavigationType, useParams } from 'react-router-dom'
import { useEffect, useState, Suspense, createElement } from 'react'
import { createAnimatedHistory } from './terranotes/lib/animatedHistory'
import { isTnPath } from './terranotes/lib/base'
import { lazyWithRetry as lazy } from './lib/lazyWithRetry'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { CapabilityProvider } from './auth/CapabilityContext'
import DeskCapabilityGate from './director/DeskCapabilityGate'
import ToastProvider from './components/Toast'
import ConfirmProvider from './components/Confirm'
import ErrorBoundary from './components/ErrorBoundary'
import FirstRunController from './components/FirstRunController'
import Companion from './components/Companion'
import BugShortcut from './bugs/BugShortcut'
import SingleTabGate from './components/SingleTabGate'
import { startAmbientPause } from './lib/pauseAmbient'

// Where each history entry was scrolled to when it was left, so Back/Forward can put it back once a lazy route has
// grown tall enough to hold that position (the browser's own restoration runs against the still-empty page).
const scrollByKey = new Map<string, number>()

function AmbientPause() {
  useEffect(() => startAmbientPause(), [])
  return null
}

function ScrollToTop() {
  const { pathname, search, key } = useLocation()
  const navigationType = useNavigationType()
  useEffect(() => {
    if (isTnPath(pathname)) return // TerraNotes keeps its own scroll positions (terranotes/lib/scrollMemory.js) and its own address changes arrive as REPLACE
    let frame = 0
    const stop = () => { cancelAnimationFrame(frame) }
    if (navigationType === 'POP') {
      const want = scrollByKey.get(key)
      if (want) {
        // The page under a lazy route is short for the first frames: retry for ~1.2s until it can reach the saved spot, and
        // give up the moment the reader scrolls on their own.
        const t0 = performance.now()
        const cancel = () => { stop(); removeEventListener('wheel', cancel); removeEventListener('touchstart', cancel); removeEventListener('keydown', cancel) }
        addEventListener('wheel', cancel, { passive: true }); addEventListener('touchstart', cancel, { passive: true }); addEventListener('keydown', cancel)
        const tryRestore = () => {
          window.scrollTo({ top: want, left: 0, behavior: 'instant' })
          if (Math.abs(window.scrollY - want) > 2 && performance.now() - t0 < 1200) frame = requestAnimationFrame(tryRestore)
          else cancel()
        }
        tryRestore()
        return cancel
      }
      return // nothing remembered: leave the browser's own restoration alone
    }
    // A real forward navigation (PUSH) or an in-place swap (REPLACE) starts at the top.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    // A keyboard or screen-reader user follows the page change: land on <main> (tabIndex -1, no outline) instead of staying
    // on the link that is no longer there. preventScroll: the scroll above already decided where the page sits.
    if (navigationType === 'PUSH') requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
  }, [pathname, search, key, navigationType])
  // remember where this entry was left, keyed by its history entry
  useEffect(() => {
    const save = () => { scrollByKey.set(key, window.scrollY) }
    addEventListener('scroll', save, { passive: true })
    return () => removeEventListener('scroll', save) // (no final save: by now the new route may already have shortened the page)
  }, [key])
  return null
}

/**
 * Cmd+K / Ctrl+K global shortcut to jump to /search.
 * Rendered as a sibling of <Routes> inside <BrowserRouter> so
 * `useNavigate` resolves to the right router context.
 *
 * Ignores the shortcut when the user is mid-typing in an editable
 * field (input / textarea / contentEditable) - they probably mean
 * to insert the literal character, not jump pages.
 */
const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a']

function GlobalShortcuts() {
  const navigate = useNavigate()
  // Easter egg: Konami code (↑↑↓↓←→←→ B A) pops a confetti burst, anywhere.
  const [egg, setEgg] = useState<{ x: number; y: number } | null>(null)

  // Easter egg: a friendly note for anyone who opens the dev console.
  useEffect(() => {
    try {
      console.log('%c★ AquaTerra', 'font:900 22px system-ui;color:#1B8A5A')
      console.log('%cbuilt by students, for the community. poking around? we’re always hiring → /opportunities', 'font:13px system-ui;color:#7E5BFF')
    } catch { /* no console */ }
  }, [])

  useEffect(() => {
    let idx = 0
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || (t && t.isContentEditable)

      // Cmd/Ctrl+K -> search (not while typing in a field).
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && !typing) {
        e.preventDefault()
        navigate('/search')
        return
      }

      // Konami sequence tracking (ignore while typing).
      if (typing) return
      const key = e.key.toLowerCase()
      if (key === KONAMI[idx]) {
        idx++
        if (idx === KONAMI.length) {
          idx = 0
          setEgg({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
        }
      } else {
        idx = key === KONAMI[0] ? 1 : 0
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [navigate])

  return egg
    ? (
      <Suspense fallback={null}>
        <ConfettiBurst x={egg.x} y={egg.y} onDone={() => setEgg(null)} />
      </Suspense>
    )
    : null
}

/**
 * The app's router. This is <BrowserRouter> with one difference: it is built on
 * the animated history from terranotes/lib/animatedHistory.js, which is the same
 * browser history <BrowserRouter> makes internally but animates page changes that
 * stay INSIDE /terranotes (card flights, crossfades). Every other change passes
 * straight through, so the rest of the app behaves as before.
 *
 * `useTransitions`: React Router wraps its state updates in startTransition by
 * default, which cannot be flushed inside a view transition (the animation needs
 * the new page rendered synchronously). So updates are unwrapped while a
 * TerraNotes page is showing, and left at the default everywhere else.
 */
function AppRouter({ children }: { children: React.ReactNode }) {
  const [history] = useState(() => createAnimatedHistory())
  const [inTn, setInTn] = useState(() => isTnPath(window.location.pathname))
  useEffect(() => history.onShown((p: string) => setInTn(isTnPath(p))), [history])
  return <HistoryRouter history={history} useTransitions={inTn ? false : undefined}>{children}</HistoryRouter>
}

/** /labs and /labs/:slug now live inside TerraNotes (the AQ Labs issue). Old links keep working. */
const LABS_SLUG: Record<string, string> = { careercompass: 'career-compass', 'cirqle-rentals': 'cirqle' }
function LabsRedirect() {
  const { slug } = useParams()
  const chapter = slug ? (LABS_SLUG[slug] ?? slug) : ''
  return <Navigate to={`/terranotes/articles/labs${chapter ? `/${chapter}` : ''}`} replace />
}

// Shown while a lazy route's chunk loads. Nothing for the first 150ms (a warm or prefetched route never flashes anything),
// then a quiet page-shaped skeleton rather than a lone spinner, so a slow connection sees a layout arrive, not a blank.
function RouteFallback() {
  const [late, setLate] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 150)
    return () => clearTimeout(t)
  }, [])
  if (!late) return <div style={{ minHeight: '60vh' }} aria-hidden />
  return (
    <div role="status" aria-live="polite" aria-label="Loading page" style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px', minHeight: '60vh' }}>
      <div className="skeleton" style={{ height: 14, width: 120, marginBottom: 18 }} />
      <div className="skeleton" style={{ height: 44, width: 'min(560px, 90%)', marginBottom: 14 }} />
      <div className="skeleton" style={{ height: 14, width: 'min(420px, 70%)', marginBottom: 36 }} />
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {[0, 1, 2].map(i => <div key={i} className="skeleton" style={{ height: 180, borderRadius: 'var(--r-inner, 22px)' }} />)}
      </div>
    </div>
  )
}

/**
 * Auth-aware gate for /register.
 *
 * The public still can't self-register - an UNauthenticated visitor (old
 * bookmark / stale link) is sent to /login (join = Google OAuth). But an
 * AUTHENTICATED user who needs to finish their profile (post-OAuth, missing
 * class/grade or join-reason) is sent here by LoginPage and ProtectedRoute;
 * they reach the real RegisterPage to complete their account.
 */
function RegisterGate() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <RouteFallback />
  return isAuthenticated ? <RegisterPage /> : <Navigate to="/login" replace />
}

// Eager - needed on first paint / every route
import ProtectedRoute from './auth/ProtectedRoute'
import { DESKS } from './director/deskAccess'
import type { NavKey } from './director/deskAccess'
import { DESK_LOADERS } from './director/deskModules'
import { ROUTE_LOADERS } from './lib/routeModules'
import HomeRoute from './auth/HomeRoute'
import PublicLayout from './components/PublicLayout'
import DashboardLayout from './components/DashboardLayout'

// Public Pages
const PublicProfilePage      = lazy(() => import('./profile/PublicProfilePage'))
// /login is the real, primary entry point (Google OAuth + email/password).
// /register stays auth-gated via <RegisterGate/> below - the public still
// can't self-register directly; only an authenticated user finishing their
// profile post-OAuth reaches it. The old /recruitment form is fully retired.
// Prefetchable public routes (routeModules.ts) use the SHARED loader from
// ROUTE_LOADERS instead of their own inline `() => import(...)` - the same
// discipline director/deskModules.ts's DESK_LOADERS already established, so
// that a hover-prefetch (AQNav/AQFooter) and this `lazy()` mount resolve to
// the literal same promise. Routes with no fixed nav `href` (param routes,
// auth-gated dashboard pages) or that are deliberately excluded from
// prefetching (paradox, demo) keep their own inline import - see
// routeModules.ts's header for why.
const LoginPage              = lazy(ROUTE_LOADERS.login)
// Post-OAuth redirect target (spinner-only) - owns the four-way post-auth
// routing decision so a returning OAuth user never flashes the login form.
const AuthCallbackPage       = lazy(() => import('./auth/AuthCallbackPage'))
const RegisterPage           = lazy(() => import('./auth/RegisterPage'))
const PendingApprovalPage    = lazy(() => import('./auth/PendingApprovalPage'))
const RejectedPage           = lazy(() => import('./auth/RejectedPage'))
// /everything-we-do was merged into /projects (departments intro + live
// stream on one page). This redirect keeps every old link - including the
// `#events` / `#welfare-projects` department anchors - landing on the same
// content, now at /projects.
function EverythingWeDoRedirect() {
  const { hash } = useLocation()
  return <Navigate to={`/projects${hash || ''}`} replace />
}
const PublicProjectsPage     = lazy(ROUTE_LOADERS.projects)
const PublicProjectDetailPage = lazy(() => import('./public/PublicProjectDetailPage'))
const BlogListPage           = lazy(ROUTE_LOADERS.blog)
const BlogPostPage           = lazy(() => import('./public/BlogPostPage'))
const SupportPage            = lazy(ROUTE_LOADERS.support)
// Terra Notes (the monthly digital magazine) and, inside it, AQ Labs. /labs redirects into it.
// (Previously: AQ Labs, the '26 cohort, redesign section 33; one component served the
// index and the seven project pages; the cohort is a checked-in constant, not
// a table, so this route adds no Supabase query.
const TerraNotesRoot         = lazy(ROUTE_LOADERS.terranotes)
const EquityPolicyPage       = lazy(ROUTE_LOADERS.equityPolicy)
const GamesHubPage           = lazy(() => import('./games/GamesHubPage'))
const GamePage               = lazy(() => import('./games/GamePage'))
// Redesign section 30, the AQ map. Lazy like every other public page: it is
// a wayfinding surface people reach deliberately, not part of the first load.
const DirectoryPage          = lazy(ROUTE_LOADERS.directory)
const PrivacyPolicyPage      = lazy(ROUTE_LOADERS.privacyPolicy)
// Open Books — the public FY ledger at /accounts. Deliberately public, no
// ProtectedRoute: see AccountsPage.tsx / the PRD for why.
const AccountsPage           = lazy(ROUTE_LOADERS.accounts)
const ThankYouPage           = lazy(() => import('./public/ThankYouPage'))
const VolunteerHandbookPage  = lazy(ROUTE_LOADERS.volunteer)
const QuickLinksPage         = lazy(ROUTE_LOADERS.links)
// The PRE-application promo at /join (redesign section 27). Public and
// indexable. Sells to a visitor who has never applied and
// ends in START YOUR APPLICATION; see JoinPromoPage's own header for why the
// two must not be merged.
const JoinPromoPage          = lazy(ROUTE_LOADERS.join)
const CollaborationsPage     = lazy(ROUTE_LOADERS.collaborations)
const ContactPage            = lazy(ROUTE_LOADERS.contact)
const AboutPage              = lazy(ROUTE_LOADERS.about)
const FAQPage                = lazy(ROUTE_LOADERS.faq)
const OpportunitiesPage      = lazy(ROUTE_LOADERS.opportunities)
const OpeningDetailPage      = lazy(() => import('./public/OpeningDetailPage'))
const SchoolsPage            = lazy(ROUTE_LOADERS.schools)
const ClassesPage            = lazy(ROUTE_LOADERS.classes)
const RootsPage               = lazy(ROUTE_LOADERS.crftd)
const SettingsPage           = lazy(() => import('./auth/SettingsPage'))
// Unlisted brand / design-system reference sheet (not in nav or sitemap).
const BrandPage              = lazy(ROUTE_LOADERS.brand)
// DEV-only surfaces. The comment here used to claim these were "tree-shaken out
// of production builds" because the ROUTES are guarded by import.meta.env.DEV.
// They were not: the guard was on the routes, the lazy() import() calls below
// were unconditional, and an unconditional dynamic import is a real edge in the
// module graph. Rollup duly emitted and deployed all five - AuthedSurfaces 17KB,
// CardCatalogue 17KB, ComponentGallery 8KB, ReencodeImages 4.5KB,
// VariationsGallery 4KB + 5.8KB CSS - roughly 57KB of chunks no production
// request can ever reach. Audit 2026-09-17, efficiency P3.
//
// The import() has to sit LEXICALLY inside a branch Vite can fold. Vite replaces
// import.meta.env.DEV with the literal `false` in a production build, so the
// whole `? :` arm becomes dead code and Rollup drops the edge with it.
//
// A helper that TAKES a loader (devLazy(() => import(...))) does NOT work, and
// was tried first: the arrow is still constructed at module scope, so as far as
// Rollup is concerned the import() is reachable and all five chunks are emitted
// exactly as before. The condition has to wrap the import() itself.
const DevOnlyPlaceholder = () => null

// LAZY, not eager (audit 2026-09-17, efficiency P2). Both of these statically
// imported framer-motion, and both sit in App.tsx's eager graph, which is what
// put the 127KB vendor-motion chunk on `modulepreload` for every route on the
// site - including logged-out public pages that never animate anything.
// Neither is on any critical path: ConfettiBurst renders only after the Konami
// sequence, BirthdayPopup only on a member's birthday. Each is wrapped in its
// own Suspense with a null fallback, so a slow chunk shows nothing rather than
// a spinner for something the visitor did not ask for.
const ConfettiBurst = lazy(() => import('./components/ConfettiBurst'))
// Tiny and eager on purpose: it only listens. The particles it renders are a separate chunk (components/CelebrationLayer).
import CelebrationHost from './components/CelebrationHost'
const BirthdayPopup = lazy(() => import('./components/BirthdayPopup'))

const ComponentGallery       = import.meta.env.DEV ? lazy(() => import('./dev/ComponentGallery')) : DevOnlyPlaceholder
const VariationsGallery      = import.meta.env.DEV ? lazy(() => import('./dev/VariationsGallery')) : DevOnlyPlaceholder
// DEV-only: all 30 feed card shapes as a specimen page, plus the chooser's
// family-05 tie-break and the composition layer, both driven by real calls.
const CardCatalogue          = import.meta.env.DEV ? lazy(() => import('./feed/cards/CardCatalogue')) : DevOnlyPlaceholder
// DEV-only: the signed-out preview harness for the authenticated surfaces
// (profile nudge, team picker, the ten greeting recipes, desk status chips,
// the composer's resubmit mode) against fixtures, with no session and no network.
const AuthedSurfaces         = import.meta.env.DEV ? lazy(() => import('./dev/AuthedSurfaces')) : DevOnlyPlaceholder
// The same idea one layer in: /dev/authed covers member surfaces, this covers
// the HoD desk and its three wide tables, which nobody without a director login
// has ever seen rendered at a phone width.
const DeskSurfaces           = import.meta.env.DEV ? lazy(() => import('./dev/DeskSurfaces')) : DevOnlyPlaceholder
// /dev/bugs: the /bugs page against an in-memory fake (dev/BugSurfaces.tsx). Same rule as the
// two above: the conditional is on the IMPORT, not just the route, or Rollup ships the chunk.
const BugSurfaces            = import.meta.env.DEV ? lazy(() => import('./dev/BugSurfaces')) : DevOnlyPlaceholder
const ReencodeImages         = import.meta.env.DEV ? lazy(() => import('./dev/ReencodeImages')) : DevOnlyPlaceholder
// The same again for TerraThon: every public and desk surface against fixtures
// with the network off, including states that are deliberately hard to reach
// for real (a full sport, a waitlisted signup, all five scanner results).
const TerraThonSurfaces      = import.meta.env.DEV ? lazy(() => import('./dev/TerraThonSurfaces')) : DevOnlyPlaceholder
const AdminSurfaces          = import.meta.env.DEV ? lazy(() => import('./dev/AdminSurfaces')) : DevOnlyPlaceholder
const PosterSheet             = import.meta.env.DEV ? lazy(() => import('./dev/PosterSheet')) : DevOnlyPlaceholder

// Protected Pages
const NotificationsPage      = lazy(() => import('./feed/NotificationsPage'))
const SavedPostsPage         = lazy(() => import('./feed/SavedPostsPage'))
const MyPostsPage            = lazy(() => import('./feed/MyPostsPage'))
const BugReportsPage         = lazy(() => import('./bugs/BugReportsPage'))
const TasksPage              = lazy(() => import('./tasks/TasksPage'))
const ProfilePage            = lazy(() => import('./profile/ProfilePage'))
const EditProfilePage        = lazy(() => import('./profile/EditProfilePage'))
const CalendarPage           = lazy(() => import('./calendar/CalendarPage'))
const YearbookPage           = lazy(() => import('./yearbook/YearbookPage'))
const InvitePage             = lazy(() => import('./referrals/InvitePage'))
const DriveCheckIn           = lazy(() => import('./drives/DriveCheckIn'))
const DriveWrap              = lazy(() => import('./drives/DriveWrap'))
const NotFoundPage           = lazy(() => import('./pages/NotFoundPage'))

// Public Entity Pages
const PostPage               = lazy(() => import('./feed/PostPage'))
const TeamsPage              = lazy(ROUTE_LOADERS.teams)
const TeamDetailPage         = lazy(() => import('./teams/TeamDetailPage'))
const SubTeamDetailPage      = lazy(() => import('./teams/SubTeamDetailPage'))
const SearchPage             = lazy(() => import('./search/SearchPage'))
const MembersPage            = lazy(ROUTE_LOADERS.members)



// Director Pages
const ChooseTeamPage         = lazy(() => import('./onboarding/ChooseTeamPage'))
const DirectorDashboard      = lazy(() => import('./director/DirectorDashboard'))
const DirectorLanding        = lazy(() => import('./director/DirectorLanding'))
/**
 * The eighteen desk components are lazy-loaded from the SHARED loader map in
 * director/deskModules.ts rather than from eighteen `import()` calls written
 * out here.
 *
 * The per-tab split is unchanged - each entry is still its own literal
 * `import()` and still its own chunk. What changed is that the desk's NAV can
 * now call the very same loader on hover/focus (`prefetchDesk`), and because
 * the ES module registry caches by specifier, the prefetch and this `lazy()`
 * resolve to ONE promise. Warming a desk and mounting it cannot diverge,
 * because they are literally the same function.
 */
const DESK_LAZY = Object.fromEntries(
  (Object.keys(DESK_LOADERS) as NavKey[]).map(k => [k, lazy(DESK_LOADERS[k])]),
) as Record<NavKey, React.LazyExoticComponent<React.ComponentType<any>>>

/**
 * Desk key -> the component that renders it. The PATH and the REQUIRED
 * PRIVILEGE deliberately do NOT live here - they live in
 * director/deskAccess.ts, which the nav reads too. This map holds only the
 * one thing routing alone knows: which lazy component to mount.
 *
 * Typed as a total Record<NavKey, ReactElement>: adding a desk to deskAccess
 * without wiring a component fails `tsc -b`.
 */
const DESK_ELEMENTS: Record<NavKey, React.ReactElement> = {
  approvals:        createElement(DESK_LAZY.approvals),
  posts:            createElement(DESK_LAZY.posts),
  blogs:            createElement(DESK_LAZY.blogs),
  members:          createElement(DESK_LAZY.members),
  member_of_month:  createElement(DESK_LAZY.member_of_month),
  teams:            createElement(DESK_LAZY.teams),
  categories:       createElement(DESK_LAZY.categories),
  hiring:           createElement(DESK_LAZY.hiring),
  enquiries:        createElement(DESK_LAZY.enquiries),
  certificates:     createElement(DESK_LAZY.certificates),
  yearbook:         createElement(DESK_LAZY.yearbook),
  content:          createElement(DESK_LAZY.content),
  projects:         createElement(DESK_LAZY.projects),
  hods:             createElement(DESK_LAZY.hods),
  volunteer_apps:   createElement(DESK_LAZY.volunteer_apps),
  roles:            createElement(DESK_LAZY.roles),
  activity_log:     createElement(DESK_LAZY.activity_log),
  guide:            createElement(DESK_LAZY.guide),
}

// Paradox 2026 sub-app - lazy: biggest single chunk win (~200KB gzipped)
const ParadoxRoot            = lazy(() => import('./paradox/ParadoxRoot'))

// TerraThon 2026 sub-app - lazy for the same reason Paradox is. It brings its
// own Nav, Footer, scoped stylesheet and on-demand fonts, and splits again
// per route so a sport page never downloads the admin console or the scanner.
const TerraThonRoot          = lazy(() => import('./terrathon/TerraThonRoot'))
// AquaTerra.live, the events hub: a lazy sub-app with its own look, like Paradox and TerraThon (docs/plans/aquaterra-live.md).
const LiveRoot               = lazy(() => import('./live/LiveRoot'))

// Guided demos (changelog/19-guided-demos.md) - a sandboxed, zero-write
// walkthrough of the real UI for a prospective member who isn't logged in.
// Lazy for the same reason Paradox is: nothing about it belongs on the
// critical path of any other route, and DemoProvider's shadow (demo/runtime/)
// must never be reachable except by way of this one branch - see that
// file's own header for why "one route branch, one provider" is a safety
// property here, not just a code-organisation preference.
const DemoRoute               = lazy(() => import('./demo/DemoRoute'))

/**
 * Mounts BirthdayPopup only for a signed-in member.
 *
 * BirthdayPopup's own first line is `if (!isAuthenticated) return`, so it was
 * always going to render nothing for a logged-out visitor. But it is lazy, and
 * MOUNTING it still fetched its chunk - and vendor-motion with it - on every
 * public page load. Gating the mount keeps 127KB of motion off the wire for the
 * visitors least likely to need it. Audit 2026-09-17, efficiency P2.
 *
 * A separate component because App() is what renders <AuthProvider>, so it
 * cannot call useAuth() itself.
 */
function BirthdayPopupGate() {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return null
  return <Suspense fallback={null}><BirthdayPopup /></Suspense>
}

function App() {
  return (
    <ErrorBoundary>
      {/* Outermost, before auth/toast/router even mount - a background tab
          never touches Supabase at all, which is what actually removes the
          lock contention (see lib/singleTabLock.ts) rather than papering
          over it with retries. */}
      <SingleTabGate>
      <ToastProvider>
        <ConfirmProvider>
        <AuthProvider>
        {/* Inside AuthProvider: the matrix is fetched per signed-in role, and
            a signed-out visitor skips the query entirely. See
            auth/CapabilityContext.tsx for why it fails OPEN onto the RLS
            ceilings rather than closed. */}
        <CapabilityProvider>
        <AppRouter>
        <ScrollToTop />
        <AmbientPause />
        <GlobalShortcuts />
        <CelebrationHost />
        {/* Invisible bug-report shortcut (Alt+Shift+B, or two-finger hold on a phone). Draws
            nothing until it fires; only an active member has a listener. See bugs/BugShortcut.tsx. */}
        <BugShortcut />
        <FirstRunController />
        <Companion />
        <BirthdayPopupGate />
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/everything-we-do" element={<EverythingWeDoRedirect />} />
              <Route path="/projects" element={<PublicProjectsPage />} />
              <Route path="/projects/:slug" element={<PublicProjectDetailPage />} />
              <Route path="/blog" element={<BlogListPage />} />
              <Route path="/blog/:slug" element={<BlogPostPage />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/labs" element={<LabsRedirect />} />
              <Route path="/labs/:slug" element={<LabsRedirect />} />
              {/* TerraNotes, AQ's monthly digital magazine (and, inside it, AQ Labs). It owns everything under /terranotes;
                  its own router, terranotes/TerraNotesRoot.jsx, matches the rest of the path. */}
              <Route path="/terranotes/*" element={<TerraNotesRoot />} />
              <Route path="/equity-policy" element={<EquityPolicyPage />} />
              <Route path="/games" element={<GamesHubPage />} />
              <Route path="/games/:slug" element={<GamePage />} />
              {/* THE AQ MAP, redesign section 30. Four entrances onto everything
                  AquaTerra does: by intent, by department, by kind, by year.

                  Fully wired into prerendering: `/directory` has a `directory`
                  entry in `lib/metaConfig.ts`, is listed in
                  `prerender-meta.mjs`'s ROUTES (which matches it against that
                  metaConfig entry by `path`), and has a `<url>` in
                  `scripts/generate-sitemap.mjs`'s STATIC_AQ. So a crawler gets
                  real per-route <head> content at build time, not just the
                  runtime `useMeta` swap this page also sets for visitors. */}
              <Route path="/directory" element={<DirectoryPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/thank-you" element={<ThankYouPage />} />
              <Route path="/volunteer" element={<VolunteerHandbookPage />} />
              <Route path="/volunteer-handbook" element={<Navigate to="/volunteer" replace />} />
              <Route path="/volunteer-handbook/edit" element={<Navigate to="/volunteer" replace />} />
              <Route path="/links" element={<QuickLinksPage />} />
              {/* Legacy intake paths. The self-registration funnel is
                  Google-OAuth-only now (a first-time Google sign-in IS the
                  signup), so every old intake URL redirects to /login rather
                  than rendering a retired form.

                  /recruitment was previously left to fall through to the 404 on
                  the reasoning that "the form is retired". That was wrong: the
                  URL is still the link in the org's Instagram bio, so every
                  prospective volunteer arriving from social was landing on
                  "LOST IN THE FIELD." — the single worst place to break, since
                  it's the top of the recruitment funnel. A retired page still
                  needs a redirect for as long as anyone is still handing the URL
                  out. Don't remove this one without checking the bio link first. */}
              <Route path="/recruitment" element={<Navigate to="/login" replace />} />
              <Route path="/volunteer/apply" element={<Navigate to="/login" replace />} />
              <Route path="/collaborations" element={<CollaborationsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/opportunities" element={<OpportunitiesPage />} />
              <Route path="/opportunities/:id" element={<OpeningDetailPage />} />
              <Route path="/schools" element={<SchoolsPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/crftd" element={<RootsPage />} />
              {/* ROOTS was renamed to Crftd. Keep the old path redirecting so
                  existing links, shared posts and indexed URLs don't 404. */}
              <Route path="/roots" element={<Navigate to="/crftd" replace />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/member/:uuid" element={<PublicProfilePage />} />
              <Route path="/post/:uuid" element={<PostPage />} />
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/:uuid" element={<TeamDetailPage />} />
              <Route path="/teams/:uuid/sub/:slug" element={<SubTeamDetailPage />} />
              {/* /login is the real, primary entry point - Google OAuth +
                  email/password. /register is auth-aware via <RegisterGate/>:
                  unauthenticated → /login (self-registration is still severed,
                  so send them to the real entry point), but an authenticated
                  user finishing their profile post-OAuth reaches the real
                  RegisterPage. */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route path="/register" element={<RegisterGate />} />
              {/* The pre-application promo. A real public route: it IS in the
                  sitemap and it carries its own useMeta entry. Deliberately
                  NOT an interstitial in front of /login - someone who tapped a
                  sign-in button has already decided. */}
              <Route path="/join" element={<JoinPromoPage />} />
              {/* Unlisted design-system / brand reference sheet - direct URL only. */}
              <Route path="/brand" element={<BrandPage />} />
              {/* DEV-only component library showcase (Phase 2). Not routed in prod. */}
              {import.meta.env.DEV && <Route path="/dev/admin" element={<AdminSurfaces />} />}
              {import.meta.env.DEV && <Route path="/dev/components" element={<ComponentGallery />} />}
              {import.meta.env.DEV && <Route path="/dev/variations" element={<VariationsGallery />} />}
              {import.meta.env.DEV && <Route path="/dev/cards" element={<CardCatalogue />} />}
              {import.meta.env.DEV && <Route path="/dev/authed" element={<AuthedSurfaces />} />}
              {import.meta.env.DEV && <Route path="/dev/desk" element={<DeskSurfaces />} />}
              {import.meta.env.DEV && <Route path="/dev/bugs" element={<BugSurfaces />} />}
              {import.meta.env.DEV && <Route path="/dev/reencode" element={<ReencodeImages />} />}
              {import.meta.env.DEV && <Route path="/dev/terrathon" element={<TerraThonSurfaces />} />}
              {import.meta.env.DEV && <Route path="/dev/posters" element={<PosterSheet />} />}
              <Route path="/pending" element={<PendingApprovalPage />} />
              <Route path="/rejected" element={<RejectedPage />} />
            </Route>

            {/* The old standalone feed page is retired - home (/) is the feed.
                Redirect any /feed link (old bookmarks, share links) to home. */}
            <Route path="/feed" element={<Navigate to="/" replace />} />

            {/* Protected Routes - Active Members */}
            {/* Post-approval team nudge. requireActive is the right gate: a
                pending_approval member is bounced to /pending by the existing
                guard, and this is a POST-approval surface. Entered by a
                redirect from FirstRunController, but a real route so it stays
                skippable and reachable again later. */}
            <Route path="/choose-team" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<ChooseTeamPage />} />
            </Route>
            <Route path="/notifications" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<NotificationsPage />} />
            </Route>

            <Route path="/saved" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<SavedPostsPage />} />
            </Route>

            <Route path="/my-posts" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<MyPostsPage />} />
            </Route>

            {/* /bugs: any active member files and follows their own reports; leaders see all
                (RLS decides, see scripts/bug_reports_2026_10_05.sql). requireActive, not
                requireDirector: the route is for members, the checkboxes are for leaders. */}
            <Route path="/bugs" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<BugReportsPage />} />
            </Route>

            {/* /tasks: any active member. Who sees and edits what is decided by row-level security
                (scripts/tasks_slice1_2026_10_19.sql); the page only arranges what comes back. */}
            <Route path="/tasks" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<TasksPage />} />
            </Route>

            <Route path="/profile" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/profile/me" replace />} />
              <Route path="me" element={<ProfilePage isOwn />} />
              <Route path="edit" element={<EditProfilePage />} />
              <Route path=":uuid" element={<ProfilePage />} />
            </Route>

            <Route path="/search" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<SearchPage />} />
            </Route>

            <Route path="/settings" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<SettingsPage />} />
            </Route>

            <Route path="/calendar" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<CalendarPage />} />
            </Route>

            <Route path="/yearbook" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<YearbookPage />} />
            </Route>

            {/* /invite - the referrer's surface, section 15. requireActive, not
                just requireAuth: `referrals` INSERT is WITH CHECK
                `referrer_id = current_member_id()`, and current_member_id()
                is defined as the member row WHERE status = 'active'. A
                pending member reaching this page could see the form and never
                complete the write. */}
            <Route path="/invite" element={<ProtectedRoute requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route index element={<InvitePage />} />
            </Route>

            {/* The welfare check-in sheet - deliberately NOT wrapped in
                DashboardLayout's desk chrome. "A lead, standing at a table"
                needs a standalone tool, not a dashboard tab; access beyond
                requireActive (is this member actually the drive's assigned
                lead?) is checked inside DriveCheckIn itself, since it
                depends on which drive :id names. */}
            <Route path="/drive/:id/check-in" element={<ProtectedRoute requireActive><DriveCheckIn /></ProtectedRoute>} />
            <Route path="/drive/:id/wrap" element={<ProtectedRoute requireActive><DriveWrap /></ProtectedRoute>} />

            {/* Arcade - hidden; redirect all sub-routes home */}
            <Route path="/arcade/*" element={<Navigate to="/" replace />} />

            {/* Director Routes - DirectorDashboard is now a pure layout (topbar +
                nav strip + <Outlet/>); every desk below is a real route so it
                deep-links and survives refresh instead of living in tab state. */}
            <Route path="/director" element={<ProtectedRoute requireDirector requireActive><DashboardLayout /></ProtectedRoute>}>
              <Route element={<DirectorDashboard />}>
                <Route index element={<DirectorLanding />} />
                {/* The 18 desks are GENERATED from `DESKS` in
                    director/deskAccess.ts - the single source of truth that
                    DirectorDashboard's rail and DirectorLanding's desk list
                    also read. A desk's required privilege is declared once,
                    there, so the route guard and the nav gate cannot drift
                    (CLAUDE.md: a lower-privileged leader reaching a
                    super-admin-only screen by typing the URL has shipped here
                    before). deskAccess.test.ts asserts they agree for every
                    desk against every role.

                    DESK_ELEMENTS is a total Record<NavKey, ...>, so adding a
                    desk to the map without giving it a component is a
                    TYPE ERROR rather than a silently missing route.

                    DeskCapabilityGate is the second, narrower layer: the
                    privilege guard above mirrors RLS and is what actually
                    protects the data, while the gate applies whatever the
                    super admin has switched off for this role on
                    /director/roles. It sits INSIDE the privilege guard and can
                    only ever narrow it, never widen (lib/capabilities.ts).
                    Wrapping the route - not just hiding the nav item - is the
                    point: hiding a link is not a gate, and reaching a desk by
                    typing its URL has shipped here as a real bug before. */}
                {DESKS.map(desk => (
                  <Route
                    key={desk.key}
                    path={desk.path}
                    element={
                      desk.privilege === 'super'
                        ? <ProtectedRoute requireSuperAdmin>
                            <DeskCapabilityGate deskKey={desk.key}>{DESK_ELEMENTS[desk.key]}</DeskCapabilityGate>
                          </ProtectedRoute>
                        : <DeskCapabilityGate deskKey={desk.key}>{DESK_ELEMENTS[desk.key]}</DeskCapabilityGate>
                    }
                  />
                ))}
              </Route>
            </Route>

            {/* Paradox 2026 sub-app - brings its own Nav, Footer, AuthProvider, ToastProvider */}
            <Route path="/paradox/*" element={<ParadoxRoot />} />

            {/* TerraThon 2026 sub-app - brings its own Nav, Footer and scoped
                stylesheet. Unlike Paradox it does NOT bring its own auth: the
                admin desk reuses this app's AuthContext and role model, so it
                must stay inside AuthProvider. */}
            <Route path="/terrathon/*" element={<TerraThonRoot />} />

            {/* AquaTerra.live events hub: brings its own nav, footer and scoped stylesheet. Inside AuthProvider because
                the admin side reuses the TerraThon desk gate. */}
            <Route path="/live/*" element={<LiveRoot />} />

            {/* Guided demos - the ONE route branch that may mount
                demo/DemoProvider. Deliberately its own top-level branch
                (not nested inside the public route group above) because
                DemoRoute sets up its own <PublicLayout>-wrapped nested
                routes for /demo and /demo/:flowId - see demo/DemoRoute.tsx. */}
            <Route path="/demo/*" element={<DemoRoute />} />

            {/* Catch all - 404 */}
            <Route path="*" element={<PublicLayout />}>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            </Routes>
          </Suspense>
        </AppRouter>
        </CapabilityProvider>
        </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
      </SingleTabGate>
    </ErrorBoundary>
  )
}

export default App
