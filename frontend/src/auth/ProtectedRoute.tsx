import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { hasLeaderAccess, isSuperAdmin } from '../lib/roles'
import { requiredRoleLabel } from '../director/deskAccess'
import PermissionDenied from '../components/PermissionDenied'
import { setAuthIntent } from '../lib/authIntent'
import { isUnblockableTestAccount } from '../lib/testAccounts'
import { isRegistrationComplete } from '../lib/profileNudge'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireActive?: boolean
  requireDirector?: boolean
  requireSuperAdmin?: boolean
}

/**
 * Friendly labels for the small set of signed-in-only routes worth naming on
 * the auth-intent hero when a signed-out visitor hits one directly (a
 * bookmark, a shared link, a typed URL - the nav itself never links these to
 * a signed-out visitor). Deliberately a short, hand-picked list rather than a
 * generic "prettify the pathname" transform - a wrong or awkward guess reads
 * worse than saying nothing and falling back to the default hero.
 */
const RESUME_LABELS: Record<string, string> = {
  '/saved': 'your saved posts',
  '/notifications': 'your notifications',
  '/calendar': 'the calendar',
  '/my-posts': 'your posts',
  '/bugs': 'bug reports',
  '/yearbook': 'the yearbook',
  '/choose-team': 'picking your team',
  '/invite': 'inviting a teammate',
  '/settings': 'your settings',
  '/profile': 'your profile',
}
function resumeLabelFor(pathname: string): string | null {
  if (RESUME_LABELS[pathname]) return RESUME_LABELS[pathname]
  if (pathname.startsWith('/drive/')) return 'checking in on a drive'
  return null
}

const ProtectedRoute = ({
  children,
  requireActive = false,
  requireDirector = false,
  requireSuperAdmin = false
}: ProtectedRouteProps) => {
  const { member, isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', background: 'var(--bg)' }}>
        {/* `spin` keyframe already lives in the critical v6.css (global), so no inline <style> is needed here. */}
        <div style={{ width: 32, height: 32, border: '2px solid var(--line-2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  if (!isAuthenticated || !member) {
    // The auth-intent hero (lib/authIntent.ts) - set synchronously, in the
    // same tick as the redirect below, mirroring every other call site that
    // writes an intent right before navigating to /login. A signed-out
    // visitor hitting a staff route directly never reaches PermissionDenied
    // (that's for a signed-in member with the wrong role - see this file's
    // role-gate comments below), so this is the one place that moment is
    // ever recorded, and it deliberately carries no more detail than "staff
    // route" - never which desk, mirroring PermissionDenied's own disclosure
    // rule. A plain requireActive route gets the softer "resume" hero when
    // its pathname maps to a friendly label, and no intent at all otherwise -
    // an unmapped path falls straight through to the default hero rather
    // than guessing.
    if (requireDirector || requireSuperAdmin) {
      setAuthIntent({ kind: 'admin' })
    } else {
      const label = resumeLabelFor(location.pathname)
      if (label) setAuthIntent({ kind: 'resume', label })
    }
    // Send a session-less visitor to the real login route, preserving their
    // intended destination so post-login routing returns them there.
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Registration is complete once class_grade AND a plausible phone are both
  // set (the "what have you built" step was removed, so join_reason is no
  // longer collected or required). This also catches an already-active
  // member who slipped through before a phone number was required - they
  // get bounced back to /register on their next visit, not just new signups.
  if (!isRegistrationComplete(member)) {
    if (location.pathname !== '/register') {
      return <Navigate to="/register" replace />
    }
  }

  // Owner's own demo/test account (see lib/testAccounts.ts) never gets
  // walled off by status - they delete and re-apply with it on purpose to
  // show people the real funnel, and getting stuck behind /rejected mid-demo
  // defeats the point. Every other account's suspended/deleted/pending gate
  // below is completely unchanged.
  const bypassStatusGate = isUnblockableTestAccount(member.email)

  // Suspended/deleted members are always bounced - regardless of requireActive
  if (!bypassStatusGate && (member.status === 'suspended' || member.status === 'deleted')) {
    return <Navigate to="/rejected" replace />
  }

  // Check status for active requirement
  if (requireActive && !bypassStatusGate) {
    if (member.status === 'pending_approval') {
      return <Navigate to="/pending" replace />
    }
    if (member.status === 'rejected') {
      return <Navigate to="/rejected" replace />
    }
    if (member.status !== 'active') {
      return <Navigate to="/login" replace />
    }
  }

  // ── Role gates. §11.7: a SIGNED-IN member who lacks the role gets a page
  // that names the role needed, not a bare bounce ("never a login wall for an
  // already-logged-in member"). A session-less visitor never reaches here -
  // the !isAuthenticated branch above already sent them to /login - so the
  // desk's existence is never disclosed to someone who isn't signed in.
  //
  // Neither branch widens access: the predicates are unchanged
  // (hasLeaderAccess / isSuperAdmin, which mirror RLS), only the response to
  // failing them.
  if (requireDirector && !hasLeaderAccess(member.role)) {
    return <PermissionDenied requiredRole={requiredRoleLabel('leader')} />
  }

  // Check super admin role. Routed through isSuperAdmin() rather than a
  // `role !== 'super_admin'` comparison so the 'hr' role (equal in power by
  // decision, and equal in the DB's is_super_admin()) passes here exactly as it
  // passes DirectorDashboard's `superOnly` nav filter. A mismatch between these
  // two gates has shipped as a real privilege bug on this project before.
  if (requireSuperAdmin) {
    if (!isSuperAdmin(member.role)) {
      return <PermissionDenied requiredRole={requiredRoleLabel('super')} />
    }
  }

  return <>{children}</>
}

export default ProtectedRoute
