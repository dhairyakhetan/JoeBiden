import { useState, Suspense, lazy } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AQNav from './AQNav'
import MobileMenuBar, { isBottomNavHidden } from './MobileMenuBar'
import OfflineBanner from './OfflineBanner'
import TerraThonBanner from './TerraThonBanner'
import { isAuthRoute } from '../lib/authRoutes'
import { isTnPath } from '../terranotes/lib/base'

// Lazy: the compose modal (and its framer-motion) only loads the first time a
// user actually opens it, keeping motion off the first-paint critical path.
const CreatePostModal = lazy(() => import('../feed/CreatePostModal'))
const AddAchievementModal = lazy(() => import('../profile/AddAchievementModal'))
// Lazy (14-footer.md §14.0/14.7): AQFooter is the ONLY consumer of
// AQFooter.css and styles/footer.css. Vite's CSS code-splitting follows the
// JS module graph, not file boundaries - a statically-imported AQFooter (as
// this was before) pulls both stylesheets into whatever chunk PublicLayout
// itself lands in, which is the main entry chunk since PublicLayout wraps
// nearly every route and is never lazy itself. Confirmed live: before this
// change, `aq-wall-headline`/`aq-activity-track` etc. shipped inside
// dist/assets/index-*.css (the render-blocking critical CSS on every
// route) - exactly the "defeats the entire point of 14.0" failure mode
// 14.7 warns about, despite the CSS already living in its own file. Making
// the component itself lazy is the same mechanism already proven by
// routes/projects.css and routes/director.css (docs/PERFORMANCE_AUDIT_2026_07_31.md
// P0-2's own words: "move each block into a stylesheet imported by the only
// component that renders those classes") and by the two modals above in
// this same file. fallback={null}: the footer is below the fold on every
// route (14.0), so there is nothing to skeleton while its tiny chunk loads.
const AQFooter = lazy(() => import('./AQFooter'))

const PublicLayout = () => {
  const location = useLocation()
  /**
   * An auth route owns its viewport: no nav, no footer, no bottom dock.
   *
   * Measured on /login before this: 76px of nav (carrying a "Log in →" button,
   * on the login page) + 830px of auth + 1266px of marketing footer = 2186px,
   * so the page was 58% footer. See lib/authRoutes.ts.
   *
   * The auth pages already ship their own "back to site" link and their own
   * legal line, so nothing is lost by taking the shared chrome away.
   */
  const authRoute = isAuthRoute(location.pathname)
  /**
   * TerraNotes (/terranotes/*) wears AQ's own nav and mobile dock like any public
   * page; only its OWN header controls are hidden (terranotes/styles/base.css keeps
   * that header's box as the spacer under AQ's fixed nav, which is why <main> takes
   * no nav padding here: the artboards below are positioned against that 64/80px
   * box). The AQ footer sits underneath. The one exception is a demo opened in its
   * own tab (.../demo), a full-window app with nothing of the site around it.
   */
  const tnRoute = isTnPath(location.pathname)
  const tnDemo = tnRoute && /\/demo\/?$/.test(location.pathname)
  const chromeless = authRoute || tnDemo
  // Exact match. '/' is the only home route, and a startsWith('/') test would
  // match every route in the app - which is the bug this replaced.
  const isHome = location.pathname === '/'
  const [showCompose, setShowCompose] = useState(false)
  // Once opened, stay mounted so the modal's own close animation still plays.
  const [composeMounted, setComposeMounted] = useState(false)
  const openCompose = () => { setComposeMounted(true); setShowCompose(true) }

  const [showAchievement, setShowAchievement] = useState(false)
  const [achievementMounted, setAchievementMounted] = useState(false)
  const openAchievement = () => { setAchievementMounted(true); setShowAchievement(true) }

  return (
    <div style={{ background: 'var(--bg)' }}>
      {!chromeless && <AQNav onCompose={openCompose} onAchievement={openAchievement} />}
      {/* No nav means no nav-height offset to reserve; leaving the padding on
          an auth route pushes the shell down by 70px against nothing. */}
      <main id="main-content" tabIndex={-1} style={{ outline: 'none', paddingTop: chromeless || tnRoute ? 0 : 'var(--nav-h, 70px)' }}>
        {/* 11.5: the offline state is a BANNER at the top of the content
            column, not a toast - "a toast expires and the condition does
            not". Mounted here so it covers every public route rather than
            the single page it was first wired to. It renders nothing while
            online, so it costs an empty node. */}
        <OfflineBanner />
        {/* TerraThon 2026 promo. Full-bleed, mobile and desktop, HOME PAGE
            ONLY (owner, 2026-09-21). It used to run on every non-auth route,
            which put an event advert above the HoD desk, the member
            directory, /dev/* and the policy pages - surfaces where it is
            noise, not a promo. Self-contained by design: it must not import
            from src/terrathon/*, or that lazy route group joins this eager
            chunk. Removes itself the day after the event. */}
        {isHome && <TerraThonBanner />}
        {/* EXIT-ONLY PAGE TRANSITION: REMOVED 2026-09-17 (audit, efficiency P2).
            Deliberate, and the one user-visible trade in that audit.

            This used to be an <AnimatePresence mode="wait"> wrapping a
            <motion.div key={location.pathname} exit={{ opacity: 0, y: -8 }}>
            with a 0.15s transition. Everything it did was the fade OUT: as the
            original comment recorded, "each page already fades/slides itself in
            via its own `.route-enter` class", and that CSS enter animation is
            untouched and still runs.

            An exit animation genuinely needs JS, because CSS cannot delay an
            unmount - so keeping it meant keeping framer-motion in this file.
            PublicLayout is the layout for EVERY public route, so that single
            import was the last thing pinning the 127KB vendor-motion chunk to
            `modulepreload` on every page load, logged-out visitors included.
            ConfettiBurst (a Konami easter egg), BirthdayPopup and Toast were
            already moved off the eager path; this was the remaining edge.

            150ms of fade-out on the page you are leaving is not worth 127KB on
            the page you are arriving at. Pages now leave instantly and arrive
            with their existing `.route-enter` animation. If it is ever wanted
            back, do it with a CSS view-transition rather than by re-importing
            framer-motion here. */}
        <Outlet />
      </main>
      {!authRoute && !tnDemo && (
        <Suspense fallback={null}>
          <AQFooter />
        </Suspense>
      )}
      {/* Reserves `--btm-nav-reserve` below the footer for the floating
          MobileMenuBar so the footer's last row isn't covered on mobile.
          Only takes height <760px via CSS — and only where the bar actually
          renders: `isBottomNavHidden` is MobileMenuBar's own predicate, so
          the reserve and the bar cannot diverge (02.6). Previously this was
          unconditional, leaving 84px of dead space on the five auth routes. */}
      {!chromeless && !isBottomNavHidden(location.pathname) && (
        <div className="aq-bottom-bar-spacer" aria-hidden="true" />
      )}
      {!chromeless && <MobileMenuBar onCompose={openCompose} onAchievement={openAchievement} />}
      {composeMounted && (
        <Suspense fallback={null}>
          <CreatePostModal
            isOpen={showCompose}
            onClose={() => setShowCompose(false)}
            onPostCreated={() => setShowCompose(false)}
          />
        </Suspense>
      )}
      {achievementMounted && (
        <Suspense fallback={null}>
          <AddAchievementModal
            isOpen={showAchievement}
            onClose={() => setShowAchievement(false)}
            onAchievementCreated={() => setShowAchievement(false)}
          />
        </Suspense>
      )}
    </div>
  )
}

export default PublicLayout
