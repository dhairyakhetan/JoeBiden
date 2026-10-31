import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Suspense, useEffect } from 'react'
import { lazyWithRetry as lazy } from '../lib/lazyWithRetry'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Nav } from './components/Nav'
import { Footer } from './components/Footer'
import { AuthProvider } from './lib/auth'
import { ToastProvider } from './components/ui/Toast'

// Tailwind + the Paradox theme, split out of the eagerly-imported
// src/index.css so only /paradox pays for them (see tailwind.css header).
// Must come before paradox.css so that sheet keeps the last word.
import './tailwind.css'
import './paradox.css'

// ── Route-level code splitting (Paradox OS, Phase 1 — performance) ──────────
// Previously every page — including the ~7k-line Admin console and the
// matter-js physics — was statically imported here, so the single ParadoxRoot
// chunk (~400 kB) shipped the ENTIRE fest app on first paint of any /paradox
// route. Each page is now its own lazily-fetched chunk; the entry shell is
// just nav/footer/routing, and heavy libs (zxing/jsbarcode/matter-js) ride
// along only with the page that actually uses them. Pages are named exports,
// hence the `.then(m => ({ default: ... }))` shim.
const HomePage        = lazy(() => import('./pages/Home').then(m => ({ default: m.HomePage })))
const EventsPage      = lazy(() => import('./pages/Events').then(m => ({ default: m.EventsPage })))
const EventDetailPage = lazy(() => import('./pages/EventDetail').then(m => ({ default: m.EventDetailPage })))
const SchedulePage    = lazy(() => import('./pages/Schedule').then(m => ({ default: m.SchedulePage })))
const HowToUsePage    = lazy(() => import('./pages/HowToUse').then(m => ({ default: m.HowToUsePage })))
const TicketPage      = lazy(() => import('./pages/Ticket').then(m => ({ default: m.TicketPage })))
const UpdatesPage     = lazy(() => import('./pages/Updates').then(m => ({ default: m.UpdatesPage })))
const SponsorPage     = lazy(() => import('./pages/Sponsor').then(m => ({ default: m.SponsorPage })))
const AfterPartyPage  = lazy(() => import('./pages/AfterParty').then(m => ({ default: m.AfterPartyPage })))
const TeamPage        = lazy(() => import('./pages/Team').then(m => ({ default: m.TeamPage })))
const ScoresPage      = lazy(() => import('./pages/Scores').then(m => ({ default: m.ScoresPage })))
const StoryPage       = lazy(() => import('./pages/Story').then(m => ({ default: m.StoryPage })))
const ContactPage     = lazy(() => import('./pages/Contact').then(m => ({ default: m.ContactPage })))
const VolunteerPage   = lazy(() => import('./pages/Volunteer').then(m => ({ default: m.VolunteerPage })))
const BlogPage        = lazy(() => import('./pages/Blog').then(m => ({ default: m.BlogPage })))
const BlogDetailPage  = lazy(() => import('./pages/BlogDetail').then(m => ({ default: m.BlogDetailPage })))
const AdminLoginPage  = lazy(() => import('./pages/AdminLogin').then(m => ({ default: m.AdminLoginPage })))
const AdminPage       = lazy(() => import('./pages/Admin').then(m => ({ default: m.AdminPage })))
const NotFoundPage    = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFoundPage })))

// Lightweight in-route loader shown while a page chunk fetches. Uses the
// global `spin` keyframe (declared in index.css @theme) and Paradox tokens.
function ParadoxRouteFallback() {
  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Loading">
      <div
        style={{
          width: 30, height: 30, borderRadius: '50%',
          border: '3px solid rgba(24,24,24,0.14)', borderTopColor: 'var(--c1)',
          animation: 'spin 0.7s linear infinite',
        }}
      />
    </div>
  )
}

function PageWrap({ children, withFooter = true }: { children: React.ReactNode; withFooter?: boolean }) {
  // Respect prefers-reduced-motion — skip the y-slide and crossfade. The
  // `AnimatePresence` parent still works without exit motion. Users who set
  // this OS preference are usually motion-sensitive; route transitions are
  // the most disorienting place to ignore the signal.
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
      transition={{ duration: reduce ? 0.12 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
      style={{ position: 'relative', zIndex: 1 }}
    >
      {/* Per-route Suspense boundary so a page's chunk can stream in without
          tearing down the route-transition animation of its wrapper. */}
      <Suspense fallback={<ParadoxRouteFallback />}>
        {children}
      </Suspense>
      {withFooter && <Footer />}
    </motion.div>
  )
}

function ParadoxScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function ParadoxRoutes() {
  const location = useLocation()
  const isAdmin = location.pathname.startsWith('/paradox/admin')

  return (
    <>
      <ParadoxScrollToTop />
      {!isAdmin && <Nav />}
      <AnimatePresence mode="wait" initial={false}>
        <Routes location={location} key={location.pathname}>
          <Route index                       element={<PageWrap><HomePage /></PageWrap>} />
          <Route path="events"               element={<PageWrap><EventsPage /></PageWrap>} />
          <Route path="events/:slug"         element={<PageWrap><EventDetailPage /></PageWrap>} />
          <Route path="schedule"             element={<PageWrap><SchedulePage /></PageWrap>} />
          {/* Hidden onboarding page — intentionally not in NAV, footer,
              or sitemap. Reachable only by direct URL: /paradox/how.
              Use this to point friends/squad-mates at the full 5-step
              "how paradox works" flow without explaining it from
              scratch every time. */}
          <Route path="how"                  element={<PageWrap><HowToUsePage /></PageWrap>} />
          <Route path="register"             element={<Navigate to="/paradox" replace />} />
          <Route path="ticket/:token"        element={<PageWrap withFooter={false}><TicketPage /></PageWrap>} />
          <Route path="updates"              element={<PageWrap><UpdatesPage /></PageWrap>} />
          <Route path="sponsor"              element={<PageWrap><SponsorPage /></PageWrap>} />
          <Route path="afterparty"           element={<PageWrap><AfterPartyPage /></PageWrap>} />
          <Route path="team"                 element={<PageWrap><TeamPage /></PageWrap>} />
          <Route path="scores"               element={<PageWrap><ScoresPage /></PageWrap>} />
          <Route path="story"                element={<PageWrap><StoryPage /></PageWrap>} />
          <Route path="contact"              element={<PageWrap><ContactPage /></PageWrap>} />
          <Route path="volunteer"            element={<PageWrap><VolunteerPage /></PageWrap>} />
          <Route path="blog"                 element={<PageWrap><BlogPage /></PageWrap>} />
          <Route path="blog/:slug"           element={<PageWrap><BlogDetailPage /></PageWrap>} />
          <Route path="admin/login"          element={<PageWrap withFooter={false}><AdminLoginPage /></PageWrap>} />
          <Route path="admin"                element={<PageWrap withFooter={false}><AdminPage /></PageWrap>} />
          <Route path="*"                    element={<PageWrap withFooter={false}><NotFoundPage /></PageWrap>} />
        </Routes>
      </AnimatePresence>
    </>
  )
}

export default function ParadoxRoot() {
  // Swap favicon to Paradox red icon while on /paradox routes, restore on exit
  useEffect(() => {
    // The injected SVG link is REMOVED on exit, not pointed at another file.
    //
    // It used to be restored to '/favicon.svg', which does not exist - the
    // shell ships /favicon.png and the only SVG is /paradox/favicon.svg. Worse,
    // the SPA catch-all rewrite answers any unknown path with the homepage
    // HTML, so the browser was handed a document where it expected an icon.
    // The selector also cannot match index.html's PNG link, so this always
    // appends its own element: removing that element is what actually restores
    // the site icon.
    let injected: HTMLLinkElement | null =
      document.querySelector<HTMLLinkElement>('link[rel~="icon"][type="image/svg+xml"]')
    if (!injected) {
      injected = document.createElement('link')
      injected.rel = 'icon'
      injected.type = 'image/svg+xml'
      document.head.appendChild(injected)
    }
    injected.href = '/paradox/favicon.svg'
    // Paradox-only display faces (Boldonse / Bricolage Grotesque / Caveat) —
    // injected here on demand so the rest of the site never downloads them.
    // Left in <head> once loaded (harmless, and avoids re-fetch on re-entry).
    if (!document.getElementById('paradox-fonts')) {
      const f = document.createElement('link')
      f.id = 'paradox-fonts'
      f.rel = 'stylesheet'
      f.href = 'https://fonts.googleapis.com/css2?family=Boldonse&family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Caveat:wght@400..700&display=swap'
      document.head.appendChild(f)
    }
    return () => { injected?.remove() }
  }, [])

  return (
    <div className="paradox-root">
      <AuthProvider>
        <ToastProvider>
          <ParadoxRoutes />
        </ToastProvider>
      </AuthProvider>
    </div>
  )
}
