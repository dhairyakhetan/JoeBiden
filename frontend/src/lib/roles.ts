/**
 * AquaTerra Role Utilities
 *
 * "Director" and "HoD" are two distinct real-world roles with identical website powers.
 * "super_admin" has all powers.
 * "hr" is a sixth role that is deliberately EQUAL IN POWER to super_admin (user
 * decision, 2026-09-03) - it exists so the HR staff read as HR in the UI rather
 * than as another super admin. The database already agrees: both `is_director()`
 * and `is_super_admin()` return true for it, so app gating and RLS match.
 * Never add special-case checks for each - always use these helpers.
 */

/** Roles that have HoD-level access (moderation, approvals, team management) */
export const LEADER_ROLES = ['director', 'hod', 'hr', 'super_admin'] as const
export type LeaderRole = (typeof LEADER_ROLES)[number]

/** Roles that hold the top tier of access (everything a super admin can do) */
export const ADMIN_ROLES = ['hr', 'super_admin'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

/** True if a member has HoD/Director/HR/SuperAdmin powers */
export function hasLeaderAccess(role?: string | null): boolean {
  return LEADER_ROLES.includes(role as LeaderRole)
}

/**
 * True for the top access tier: super_admin or hr.
 *
 * This is an access check, not an identity check. Anywhere the question is
 * literally "is this row the super_admin role" (a display label, a role
 * <option> value), compare to the string instead.
 */
export function isSuperAdmin(role?: string | null): boolean {
  return ADMIN_ROLES.includes(role as AdminRole)
}

/** Display label for a role */
export function getRoleLabel(role?: string | null): string {
  switch (role) {
    case 'super_admin': return 'Super Admin'
    case 'hr':          return 'HR'
    case 'hod':         return 'HoD'
    case 'director':    return 'Director'
    case 'lead':        return 'Team Lead'
    default:            return 'Member'
  }
}

/** CSS class suffix for role chips */
export function getRoleClass(role?: string | null): string {
  if (role === 'hod' || role === 'director' || role === 'hr' || role === 'super_admin') return 'role-director'
  if (role === 'lead') return 'role-lead'
  return 'role-member'
}
