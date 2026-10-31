import { useEffect, useState, lazy } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { ROUTE_LOADERS } from '../lib/routeModules'
import { isRegistrationComplete } from '../lib/profileNudge'

// Lazy: HomePage pulls in the entire feed surface (FeedPostCard, feed/profile/saved
// services, jobOpenings, sample-post fallback data). Loading it eagerly here dragged
// that whole tree into the entry chunk of every route, including /login and
// /director/*. App.tsx already wraps the route tree in a Suspense boundary, so no
// new fallback UI is needed - HomeRoute's own isLoading spinner below covers the
// auth-resolution wait, and RouteFallback covers the (usually instant, cached) chunk
// fetch for these three.
//
// Uses the SHARED `home` loader from lib/routeModules.ts, not its own inline
// `() => import(...)` - AQNav/AQFooter's hover prefetch for `/` calls that same
// loader, and the module registry only dedupes an identical resolved specifier.
const HomePage = lazy(ROUTE_LOADERS.home)
const HomeIntro = lazy(() => import('../components/HomeIntro'))
const HiStrip = lazy(() => import('../components/HiStrip'))

/**
 * The kids-saying-hi ribbon runs at the top of the home page on a visitor's
 * FIRST visit only. After that it stops taking up the fold and lives in the
 * footer instead (where it appears on every page, always). Same localStorage
 * gate style as HomeIntro — read once at init so there's no first-paint flash,
 * and marked as seen in an effect rather than during render.
 */
const HI_KEY = 'aq_hi_strip_v1'

// First-run modals (ApprovedWelcomeModal / OpeningPickerModal / WelcomeOverlay)
// are now owned by <FirstRunController>, mounted once in App.tsx - it decides
// precedence itself, so HomeRoute no longer needs to mount them or mirror
// any of their flags.
const HomeRoute = () => {
  const { member, isLoading, isAuthenticated } = useAuth()

  const [showHeaderHi] = useState(() => {
    try { return localStorage.getItem(HI_KEY) !== '1' } catch { return false }
  })
  useEffect(() => {
    if (!showHeaderHi) return
    try { localStorage.setItem(HI_KEY, '1') } catch { /* private mode — just shows again */ }
  }, [showHeaderHi])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg)' }}>
        <div style={{ width: 32, height: 32, border: '2px solid var(--line-2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (isAuthenticated && member) {
    switch (member.status) {
      case 'active':
        // `/` doesn't go through <ProtectedRoute>, so it's the one place an
        // already-active member landing directly here (reopened tab,
        // bookmark, PWA relaunch - not via /auth/callback) could otherwise
        // skip the compulsory phone step entirely. Same check as
        // ProtectedRoute/AuthCallbackPage/RegisterPage - see isRegistrationComplete.
        if (!isRegistrationComplete(member)) {
          return <Navigate to="/register" replace />
        }
        return (
          <>
            <HomeIntro />
            <HomePage />
          </>
        )
      case 'pending_approval':
        return <Navigate to="/pending" replace />
      case 'rejected':
      case 'suspended':
      case 'deleted':
        return <Navigate to="/rejected" replace />
    }
  }

  // Section 27's once-per-visitor promo auto-show was disabled 2026-09-08 per
  // direct instruction ("don't show this" to first-time guests) - /join
  // itself is untouched and still fully reachable (nav, /login's "become a
  // part" link, etc.), only the automatic redirect-on-first-visit is gone.
  // shouldAutoShowJoinPromo() is kept in JoinPromoPage.tsx, unused for now,
  // in case this gets re-armed later.

  return (
    <>
      <HomeIntro />
      {showHeaderHi && (
        <div className="container hi-strip-header-slot">
          <HiStrip />
        </div>
      )}
      <HomePage />
    </>
  )
}

export default HomeRoute
