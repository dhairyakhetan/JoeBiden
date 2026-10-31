import { hasLeaderAccess } from '../../lib/roles'
import { isRegistrationComplete } from '../../lib/profileNudge'

/**
 * Who may open the TerraThon desk, as a pure function.
 *
 * This lived inline in AdminGate as a chain of early returns, which made it
 * the one security-shaped decision in the section that could not be exercised
 * without a real signed-in session for each of five different account shapes.
 * Pulled out here it is ordinary to test, and the order of the checks, which
 * is the part most likely to be quietly wrong, is pinned by those tests.
 *
 * ORDER MATTERS, and not for cosmetic reasons. A brand-new account is created
 * by ensure_member() as pending_approval with role 'member' and no phone, so
 * it fails three checks at once. Whichever one is reported is the one the
 * person setting the desk up will act on, so they are ordered by what has to
 * happen first: finish the profile, then get approved, then get promoted.
 *
 * NONE OF THIS IS THE SECURITY BOUNDARY. There is no API server; the browser
 * talks to PostgREST directly and every terrathon_* table is gated by RLS on
 * `is_director() or is_super_admin()`. A member row without a leader role gets
 * zero rows back whatever this function returns. This decides which screen to
 * show, not what the database will hand over.
 */
export type DeskGate =
  | 'loading'
  | 'signed-out'
  | 'incomplete-profile'
  | 'pending-approval'
  | 'inactive'
  | 'not-a-leader'
  | 'allowed'

export interface GateMember {
  status?: string | null
  role?: string | null
  class_grade: string | null
  phone: string | null
}

export function deskGate(member: GateMember | null | undefined, loading: boolean): DeskGate {
  if (loading) return 'loading'
  if (!member) return 'signed-out'
  // The compulsory-phone step, honoured here as at every other entrance.
  if (!isRegistrationComplete(member)) return 'incomplete-profile'
  if (member.status === 'pending_approval') return 'pending-approval'
  if (member.status !== 'active') return 'inactive'
  if (!hasLeaderAccess(member.role)) return 'not-a-leader'
  return 'allowed'
}
