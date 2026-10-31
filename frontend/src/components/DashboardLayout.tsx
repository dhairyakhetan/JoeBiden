import { useState, Suspense, lazy } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import AQNav from './AQNav'
import MobileMenuBar from './MobileMenuBar'
// Lazy: compose modal + its framer-motion load only on first open.
const CreatePostModal = lazy(() => import('../feed/CreatePostModal'))
const AddAchievementModal = lazy(() => import('../profile/AddAchievementModal'))
// Lazy for the same reason PublicLayout keeps it lazy - see AQFooter.tsx's
// own header comment. This layout never rendered it at all (2026-09-12):
// every non-director route here (search/profile/notifications/saved/
// settings) was missing the site footer entirely, not by any documented
// decision the way auth routes and demo flows are - just never wired up.
const AQFooter = lazy(() => import('./AQFooter'))

const DashboardLayout = () => {
  const [showCompose, setShowCompose] = useState(false)
  const [composeMounted, setComposeMounted] = useState(false)
  const openCompose = () => { setComposeMounted(true); setShowCompose(true) }

  const [showAchievement, setShowAchievement] = useState(false)
  const [achievementMounted, setAchievementMounted] = useState(false)
  const openAchievement = () => { setAchievementMounted(true); setShowAchievement(true) }

  // DashboardLayout is the shared Outlet ancestor for both the HoD desk
  // (/director and its 8 sub-routes) and unrelated member pages
  // (notifications/saved/profile/search/settings). Only the director
  // routes get the .admin scope (flat --hod-* tokens) - DirectorDashboard
  // itself already applies .admin on its own root div for the index route,
  // but the 8 sibling routes (approvals/posts/members/categories/directors/
  // content/teams/volunteers) render directly under this layout with no
  // .admin ancestor, so visiting one by direct URL/bookmark previously fell
  // back to full neubrutalist brand styling instead of the intended calm
  // admin language. Gating on the path here covers all of them at once.
  const isDirectorRoute = useLocation().pathname.startsWith('/director')

  return (
    // 100dvh follows the iOS dynamic viewport (URL bar collapse) - 100vh
    // would leave a gap when Safari's chrome shrinks. Falls back to 100vh
    // on browsers that don't support dvh via the @supports check.
    <div className={isDirectorRoute ? 'admin' : undefined} style={{ background: 'var(--bg)', minHeight: '100dvh' }}>
      {/* The HoD desk (DirectorDashboard) has its own sticky ops-topbar +
          nav strip/sidebar with equivalent wayfinding (home link, search,
          notifications, profile) - rendering the public AQNav on top of it
          stacked two navigation bars on every admin page. Skip both the
          public nav and its top-padding reservation for director routes. */}
      {!isDirectorRoute && <AQNav onCompose={openCompose} onAchievement={openAchievement} />}

      {/* Main content. Reserves space for the floating MobileMenuBar pill
          (~84px tall on mobile) so the final row of content + footer don't
          hide behind it. Bar is only rendered <640px so the spacer is
          conditional via CSS media query in v6.css (.aq-bottom-bar-spacer). */}
      <main id="main-content" tabIndex={-1} style={{ outline: 'none', paddingTop: isDirectorRoute ? 0 : 'var(--nav-h, 70px)' }}>
        <Outlet />
      </main>

      {/* The HoD desk stays footer-free (calm-admin language, its own
          ops-topbar already carries wayfinding); every other page under
          this layout gets the same site footer PublicLayout renders. The
          spacer belongs AFTER the footer, not inside <main> before it -
          it reserves room for the floating MobileMenuBar pill below
          whatever is the actual last row on screen, matching
          PublicLayout.tsx's own placement. Putting it inside <main> left
          the pill covering the footer's last row on mobile. */}
      {!isDirectorRoute && (
        <Suspense fallback={null}>
          <AQFooter />
        </Suspense>
      )}
      {!isDirectorRoute && <div className="aq-bottom-bar-spacer" aria-hidden="true" />}

      {/* Animated bottom tab bar - mobile only; the desk's own ops-navstrip
          replaces it for director routes. */}
      {!isDirectorRoute && <MobileMenuBar onCompose={openCompose} onAchievement={openAchievement} />}

      {/* Compose modal - lazy, mounted on first open */}
      {composeMounted && (
        <Suspense fallback={null}>
          <CreatePostModal
            isOpen={showCompose}
            onClose={() => setShowCompose(false)}
            onPostCreated={() => setShowCompose(false)}
          />
        </Suspense>
      )}

      {/* Achievement modal - lazy, mounted on first open */}
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

export default DashboardLayout
