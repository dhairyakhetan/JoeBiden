import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { lazy, Suspense } from 'react'
import { APPROVED_WELCOME_FLAG_KEY } from '../lib/firstRunFlags'
// LAZY (audit 2026-09-17, efficiency P2). This controller is eager - App.tsx
// imports it directly - but both modals it can show are first-run-only.
// ApprovedWelcomeModal pulls framer-motion, ConfettiBurst and SuccessCheck,
// so importing it here put all of that on every page load.
const ApprovedWelcomeModal = lazy(() => import('./ApprovedWelcomeModal'))
const WelcomeOverlayLazy = lazy(() => import('./WelcomeOverlay'))
import { useLocation } from 'react-router-dom'

// Owns first-run modal PRECEDENCE across the whole app - mounted once in
// App.tsx (alongside GlobalShortcuts/ScrollToTop). Renders AT MOST ONE of:
//
//   1. ApprovedWelcomeModal - celebration for a just-approved member. Highest
//      priority: this is a one-shot moment tied to a specific transition
//      (pending -> active), not a recurring nudge.
//   2. WelcomeOverlay       - first-visit popup for a logged-out visitor.
//
// REMOVED 2026-09-14: the auto-redirect to /choose-team (a full-screen
// black-panel "pick from a team's openings" surface) that used to fire right
// after ApprovedWelcomeModal, for every just-active member who hadn't seen it.
// The openings-apply flow now happens BEFORE approval, on /pending itself
// (PendingApprovalPage's "open roles" section) - a member who wants to apply
// no longer has to wait for approval to see or act on openings, so forcing
// the same surface on them again right after approval was a redundant,
// unrequested full-screen interrupt. /choose-team the ROUTE still exists and
// is still reachable directly (nothing here deletes it), it's only the
// automatic redirect that's gone.
//
// This replaces the previous fragile coordination: HomeRoute kept its own
// read-only mirror of ApprovedWelcomeModal's sessionStorage flag purely to
// compute a `blocked` prop for TeamPickerModal. That mirror + prop are gone;
// precedence is now a single ordered if/else here.
export default function FirstRunController() {
  const { isAuthenticated, isLoading } = useAuth()
  const { pathname } = useLocation()

  // The dev harnesses under /dev/* exist to look AT a surface; a first-run
  // overlay on top of one hides the thing being reviewed. Dev-only routes, so
  // this cannot affect anything a member sees.
  const isDevHarness = import.meta.env.DEV && pathname.startsWith('/dev/')

  // TerraNotes opens with its own full-screen animation and is meant to be read
  // uninterrupted; a welcome dialog over it would hide both. It still shows on
  // every AquaTerra page the visitor reaches next.
  const isTerraNotes = pathname === '/terranotes' || pathname.startsWith('/terranotes/')

  // Read-only peek at ApprovedWelcomeModal's own flag - ApprovedWelcomeModal
  // clears the flag itself on mount; this just decides precedence for THIS
  // render tree, exactly like HomeRoute's old mirror did, minus the prop
  // threaded through an unrelated component.
  const [approvedShowing, setApprovedShowing] = useState(() => {
    try { return sessionStorage.getItem(APPROVED_WELCOME_FLAG_KEY) === '1' } catch { return false }
  })

  if (isLoading || isDevHarness || isTerraNotes) return null

  if (approvedShowing) {
    return <Suspense fallback={null}><ApprovedWelcomeModal onDismiss={() => setApprovedShowing(false)} /></Suspense>
  }

  if (!isAuthenticated) {
    return <Suspense fallback={null}><WelcomeOverlayLazy /></Suspense>
  }

  return null
}
