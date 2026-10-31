import { Link } from 'react-router-dom'
import EmptyState from './EmptyState'

interface PermissionDeniedProps {
  /** The role a viewer would need, in words - e.g. "HoD or Director". */
  requiredRole: string
  /**
   * Which kind of refusal this is. They are genuinely different situations and
   * telling a member the wrong one wastes their time:
   *
   *   'role'       their role does not cover this desk. Asking an HoD to change
   *                their role is the fix.
   *   'capability' their role DOES cover it, but a super admin has switched
   *                this desk off for the role on /director/roles. Changing
   *                their role is not the fix and would be the wrong thing to
   *                go and ask for; someone needs to switch it back on.
   *
   * Neither variant names the desk or shows anything from behind the gate -
   * see the disclosure rule below.
   */
  variant?: 'role' | 'capability'
}

/**
 * Permission denied - changelog/11-system-states.md §11.7.
 *
 * Rendered by ProtectedRoute *instead of* a bare redirect when a SIGNED-IN
 * member lands on a route their role does not cover (typically by typing or
 * following a direct URL - "the nav renders only permitted destinations", so
 * this is not reachable by clicking).
 *
 * The disclosure split is deliberate and was ruled on explicitly:
 *   - signed-in but under-privileged  → this page, naming the role needed;
 *   - signed out                      → ProtectedRoute still redirects to
 *     /login first and this component is never reached, so a visitor learns
 *     nothing about the desk's existence.
 * §11.7's "never a login wall for an already-logged-in member" is the first
 * half of that; the second half keeps the guarded surface unadvertised.
 *
 * It says only which role is required. It must NEVER enumerate the desks the
 * viewer cannot open, name the specific desk's contents, or show any count or
 * row from behind the gate - it renders before the guarded component mounts
 * and issues no query of its own.
 *
 * Built on the shared EmptyState well (§11.3) rather than a new surface, so
 * the radii, ground and type come from the existing scale.
 */
export default function PermissionDenied({ requiredRole, variant = 'role' }: PermissionDeniedProps) {
  const capability = variant === 'capability'
  return (
    <div role="alert">
      <EmptyState
        icon="🔒"
        title={capability ? 'switched off for your role' : 'not your desk'}
        hint={capability
          ? <>your role reaches this desk, but a super admin has turned it off for <strong style={{ color: 'var(--ink)' }}>{requiredRole}</strong>. ask them to switch it back on - changing your role won&rsquo;t help.</>
          : <>this page is for <strong style={{ color: 'var(--ink)' }}>{requiredRole}</strong> accounts. if that should be you, ask an HoD to update your role.</>}
        action={<Link to="/" className="btn">back to the feed</Link>}
        secondary={<Link to="/profile/me" className="btn btn-ghost">your profile</Link>}
      />
    </div>
  )
}
