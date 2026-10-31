/**
 * The capability registry — what the Roles & Permissions page actually toggles.
 * ────────────────────────────────────────────────────────────────────────────
 * This file is the canonical list of things a role can be allowed or refused,
 * and it is deliberately pure data + pure functions (no React, no CSS import)
 * so `capabilities.test.ts` can import it under vitest's node environment, the
 * same way `deskAccess.ts` is testable.
 *
 * ── THE ONE RULE ───────────────────────────────────────────────────────────
 * A toggle can only ever NARROW access, never widen it.
 *
 *     effectiveCan(role, cap) = ceilingAllows(role, cap) && matrixEnabled(role, cap)
 *
 * `ceiling` is the set of roles the DATABASE will actually serve, mirroring the
 * RLS policy behind that capability (is_director / is_super_admin /
 * is_team_lead). The matrix cannot exceed it, so the page never offers a tick
 * box that would silently do nothing: a cell above a role's ceiling renders as
 * LOCKED, with `lockReason()` explaining which policy is refusing.
 *
 * This is the difference between an engine and a decoration. Ticking "member
 * can reach the approvals desk" would be a lie — `members`' own RLS would still
 * refuse the read — so the page does not offer that tick at all.
 *
 * ── ABSENT ROW MEANS ENABLED ───────────────────────────────────────────────
 * `matrixEnabled` returns true when the matrix holds no row for (cap, role).
 * So an empty `role_capabilities` table reproduces exactly today's behaviour,
 * and the table only ever accumulates real, deliberate restrictions.
 *
 * ── ONLY SHIP WHAT IS ENFORCED ─────────────────────────────────────────────
 * Every entry below is wired to something real, and `enforcement` says where:
 *
 *   'route'  the desk's nav entry AND its route guard both consult it, so
 *            unticking removes the tab and 404s the URL. Not just a hidden link.
 *   'action' a specific control inside a desk consults it, so unticking removes
 *            the button and the code path behind it refuses.
 *
 * A capability with nowhere to enforce it does not belong in this list. The
 * page this replaced was rejected precisely for showing controls that changed
 * nothing, and adding an unwired key here would recreate that.
 */
import { DESKS } from '../director/deskAccess'
import { LEADER_ROLES, ADMIN_ROLES, isSuperAdmin } from './roles'

/**
 * Capabilities that the TOP TIER can never have unticked, `hr` included.
 * ────────────────────────────────────────────────────────────────────────────
 * `super_admin` is unrestrictable across the board (below, and in the database
 * via `role_capabilities_super_admin_never_restricted`). `hr` is deliberately
 * NOT: lib/roles.ts makes it equal in POWER to super_admin, but the whole point
 * of this matrix is that an operator can narrow a role, and narrowing `hr` is a
 * legitimate thing to want.
 *
 * With one exception, which is this set. `desk.roles` is the matrix's own desk.
 * Untick it for `hr` in an org whose only top-tier account is `hr` - which is
 * the normal shape here, since `hr` exists so HR staff do not have to read as
 * super admins - and the page that could tick it back on is now unreachable by
 * everyone. There is no in-app way out of that, only a hand-written SQL delete.
 *
 * So: narrow exactly the self-lockout, and nothing else. Every other capability
 * stays restrictable for `hr` exactly as before. Audit 2026-09-17 rated the
 * lockout P1; the tempting broad fix (`isSuperAdmin(role) => return true`) would
 * have silently voided every hr restriction an operator had already set.
 *
 * NOTE: the database constraint still only names `super_admin`. The matching
 * migration is scripts/role_capabilities_hr_never_locked_out_2026_09_17.sql and
 * is NOT YET APPLIED, so this rule is app-side only until it runs. That is a
 * real gap, not a design: see the file header.
 */
export const TOP_TIER_NEVER_RESTRICTABLE = new Set<string>(['desk.roles'])

/** True when `role` is top-tier AND `capKey` is one it must never lose. */
const isSelfLockout = (capKey: string, role?: string | null) =>
  isSuperAdmin(role) && TOP_TIER_NEVER_RESTRICTABLE.has(capKey)

/** The five roles, lowest to highest. Matches lib/roles.ts's own hierarchy.
 *  'lead' (a per-team tier below hod) was retired 2026-09-15 - directors/HoDs
 *  are the only leadership tier now, team-scoped or otherwise. See
 *  scripts/retire_lead_role_2026_09_15.sql. */
export const CAPABILITY_ROLES = ['member', 'hod', 'director', 'hr', 'super_admin'] as const
export type CapabilityRole = (typeof CAPABILITY_ROLES)[number]

/** Where a capability is enforced. Surfaced in the UI so the page never overclaims. */
export type Enforcement = 'route' | 'action'

export type Capability = {
  /** Stable identifier stored in `role_capabilities.capability_key`. Never rename. */
  key: string
  label: string
  /** One line explaining what turning this off actually does. */
  hint: string
  /** Section heading on the matrix. */
  group: string
  /**
   * The roles the DATABASE will serve for this capability. The matrix may
   * restrict within this set and can never exceed it.
   */
  ceiling: readonly CapabilityRole[]
  enforcement: Enforcement
}

/** Desk privilege -> the roles RLS actually serves, mirroring deskAccess.canAccessDesk. */
const LEADER_CEILING = LEADER_ROLES as readonly CapabilityRole[]        // hod/director/hr/super_admin
const SUPER_CEILING = ADMIN_ROLES as readonly CapabilityRole[]          // hr/super_admin

/**
 * One capability per desk, generated from `DESKS` rather than hand-listed, so a
 * desk added to deskAccess.ts automatically becomes togglable and cannot be
 * forgotten here. The ceiling is the desk's own privilege, which is the same
 * value the route guard uses — the matrix therefore cannot disagree with the
 * guard about what is even possible.
 */
const DESK_CAPABILITIES: Capability[] = DESKS.map(desk => ({
  key: `desk.${desk.key}`,
  label: desk.label,
  hint: `Reach the ${desk.label} desk. Unticking hides the tab and blocks the URL.`,
  group: 'Desks',
  ceiling: desk.privilege === 'super' ? SUPER_CEILING : LEADER_CEILING,
  enforcement: 'route' as const,
}))

/**
 * Actions inside a desk. Each of these is wired to a real control; see the
 * `enforcement: 'action'` note in this file's header. Ceilings mirror the RLS
 * policy named in each hint.
 */
const ACTION_CAPABILITIES: Capability[] = [
  {
    key: 'action.approve_member',
    // Ceiling lowered 2026-09-12 (owner: general sign-up approvals are
    // HR/super_admin only now - a brand-new applicant isn't on any team
    // yet, so there's nothing for a team-scoped HoD to be scoped BY).
    // members_guard_privileged_cols() enforces this as a real boundary:
    // a director/hod/team-lead write attempting to move a row off
    // pending_approval is rejected server-side, not just hidden here.
    label: 'Approve or reject accounts',
    hint: 'Decide on new sign-ups. RLS ceiling: members_guard_privileged_cols() requires is_super_admin() for any pending_approval transition.',
    group: 'Actions',
    ceiling: SUPER_CEILING,
    enforcement: 'action',
  },
  {
    key: 'action.moderate_post',
    label: 'Approve or reject posts',
    hint: 'Clear the post queue. RLS ceiling: the posts UPDATE policy, is_director().',
    group: 'Actions',
    ceiling: LEADER_CEILING,
    enforcement: 'action',
  },
  {
    key: 'action.delete_post',
    label: 'Delete a published post',
    hint: 'Remove a post that is already live. RLS ceiling: the posts DELETE policy, is_director().',
    group: 'Actions',
    ceiling: LEADER_CEILING,
    enforcement: 'action',
  },
  {
    key: 'action.manage_team_roster',
    label: 'Add or remove team members',
    // is_team_lead() is still referenced by team_members' RLS policy but can
    // never evaluate true again (the 'lead' role it checks for was retired
    // 2026-09-15, see scripts/retire_lead_role_2026_09_15.sql) - the real
    // ceiling is directors/HoDs only now.
    hint: 'Change a team roster. RLS ceiling: team_members, is_director().',
    group: 'Actions',
    ceiling: LEADER_CEILING,
    enforcement: 'action',
  },
  {
    key: 'action.assign_role',
    label: 'Change someone’s role',
    hint: 'Promote or demote an account. RLS ceiling: members_guard_privileged_cols, super admin only.',
    group: 'Actions',
    ceiling: SUPER_CEILING,
    enforcement: 'action',
  },
  {
    key: 'action.reveal_contact',
    label: 'Reveal a member’s email or phone',
    // Ceiling lowered 2026-09-12 (owner: "HoDs should not have access to
    // phone numbers... only HR and superadmins" - and HR/super_admin are
    // meant to be identical in power, name difference only). Was
    // LEADER_CEILING, which let a plain director/hod have this ticked on;
    // now it's locked off for them at every tier, matching the
    // member_directory_view fix below rather than only hiding the button.
    hint: 'Unmask contact details, which is logged to contact_access_log. RLS ceiling: phone is only ever returned to hr/super_admin by member_directory_view - a director/hod cannot have this capability at all.',
    group: 'Actions',
    ceiling: SUPER_CEILING,
    enforcement: 'action',
  },
]

export const CAPABILITIES: Capability[] = [...DESK_CAPABILITIES, ...ACTION_CAPABILITIES]

export const CAPABILITY_BY_KEY: Record<string, Capability> = Object.fromEntries(
  CAPABILITIES.map(c => [c.key, c]),
)

/** Matrix section order on the page. */
export const CAPABILITY_GROUPS = ['Desks', 'Actions'] as const

/** The matrix as the app holds it: only real restrictions, keyed `capKey::role`. */
export type CapabilityMatrix = Record<string, boolean>

export const matrixCellKey = (capKey: string, role: CapabilityRole) => `${capKey}::${role}`

/** True when the DATABASE would serve this capability to this role at all. */
export function ceilingAllows(capKey: string, role?: string | null): boolean {
  const cap = CAPABILITY_BY_KEY[capKey]
  if (!cap) return false
  return cap.ceiling.includes(role as CapabilityRole)
}

/**
 * The matrix's own answer, ignoring the ceiling. Absent means enabled — see the
 * header — so this is `false` only where somebody deliberately unticked a box.
 */
export function matrixEnabled(matrix: CapabilityMatrix, capKey: string, role?: string | null): boolean {
  if (!role) return false
  const v = matrix[matrixCellKey(capKey, role as CapabilityRole)]
  return v === undefined ? true : v
}

/**
 * THE function the app asks. Both halves must agree, which is what keeps a
 * toggle from ever widening access beyond what RLS will serve.
 *
 * super_admin is never restrictable: the database enforces that too, with
 * `role_capabilities_super_admin_never_restricted`, so a super admin cannot
 * untick their own way out of the page that would tick it back on.
 */
export function effectiveCan(
  matrix: CapabilityMatrix,
  capKey: string,
  role?: string | null,
): boolean {
  if (!ceilingAllows(capKey, role)) return false
  if (role === 'super_admin') return true
  if (isSelfLockout(capKey, role)) return true
  return matrixEnabled(matrix, capKey, role)
}

/** Why a cell is locked, for the matrix UI. `null` when it is freely togglable. */
export function lockReason(capKey: string, role: CapabilityRole): string | null {
  if (!ceilingAllows(capKey, role)) {
    const cap = CAPABILITY_BY_KEY[capKey]
    return cap
      ? `The database does not serve this to ${role}. Ticking it would change nothing.`
      : 'Unknown capability.'
  }
  if (role === 'super_admin') {
    return 'Super Admin is the top tier and is never restrictable, so this page can always be reached to undo a change.'
  }
  if (isSelfLockout(capKey, role)) {
    return 'HR is a top tier too, and this is the desk that undoes a change. Unticking it in an org with no Super Admin would lock this page away from everyone.'
  }
  return null
}

/** True when a cell can actually be toggled by the operator. */
export const isCellTogglable = (capKey: string, role: CapabilityRole) => lockReason(capKey, role) === null
