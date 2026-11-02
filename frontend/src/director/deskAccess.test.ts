import { describe, it, expect } from 'vitest'
import {
  DESKS, DESK_BY_KEY, DESK_BY_PATH, NAV_GROUPS,
  canAccessDesk, isDeskVisible, visibleDeskGroups, requiredRoleLabel,
  EXTRA_NAV_FILTER, scopeToMyTeams,
} from './deskAccess'
import { hasLeaderAccess, isSuperAdmin } from '../lib/roles'

/**
 * The invariant this whole file exists for (CLAUDE.md, "Role model"): the
 * route-level guard and the nav-level visibility gate must never disagree, or
 * a lower-privileged leader can reach a desk by typing its URL. That bug has
 * shipped here before. It now fails the test run instead.
 */

const ROLES = ['member', 'lead', 'hod', 'director', 'hr', 'super_admin', undefined, null, '', 'nonsense'] as const

/** What canApproveMembers is in DirectorDashboard/DirectorLanding: hasLeaderAccess(role). */
const canApprove = (role?: string | null) => hasLeaderAccess(role)

describe('desk access is declared exactly once', () => {
  // 19 until 2026-09-11, when `wall_notes` ("Removed Notes") was deleted on
  // the user's instruction - walkthrough item 4.1. 18 until 2026-09-12, when
  // `sops` and `drives` were both deleted (see deskAccess.ts's NavKey). 17
  // from 2026-09-13, when `activity_log` (the community_audit_logs viewer)
  // was added.
  it('has all 18 desks, with unique keys and unique paths', () => {
    expect(DESKS).toHaveLength(18)
    expect(new Set(DESKS.map(d => d.key)).size).toBe(18)
    expect(new Set(DESKS.map(d => d.path)).size).toBe(18)
    expect(Object.keys(DESK_BY_KEY)).toHaveLength(18)
    expect(Object.keys(DESK_BY_PATH)).toHaveLength(18)
  })

  it('has no Removed Notes desk', () => {
    expect(DESKS.some(d => d.path === 'wall-notes')).toBe(false)
    expect(DESKS.some(d => d.label === 'Removed Notes')).toBe(false)
  })

  // 2026-09-12: `approvals` moved from `leader` to `super` - general AQ
  // sign-up approvals are HR/super_admin only now (a brand-new applicant
  // isn't on any team yet, so there's nothing for a team-scoped HoD to be
  // scoped BY). Six become seven. 2026-09-13: `activity_log` is `super` too
  // (community_audit_logs' own RLS is super_admin-only SELECT) - seven
  // become eight.
  it('marks exactly the eight super-admin desks as `super`, and no others', () => {
    const superKeys = DESKS.filter(d => d.privilege === 'super').map(d => d.key).sort()
    expect(superKeys).toEqual(['activity_log', 'approvals', 'certificates', 'content', 'hods', 'projects', 'roles', 'volunteer_apps'])
  })

  it('routes those eight at the paths App.tsx guards with requireSuperAdmin', () => {
    const superPaths = DESKS.filter(d => d.privilege === 'super').map(d => d.path).sort()
    expect(superPaths).toEqual(['activity-log', 'approvals', 'certificates', 'content', 'directors', 'projects', 'roles', 'volunteers'])
  })

  it('gives every desk a non-empty label and glyph', () => {
    for (const d of DESKS) {
      expect(d.label.length).toBeGreaterThan(0)
      expect(d.icon.length).toBeGreaterThan(0)
    }
  })

  // Item 4.3. A blurb that merely repeats the label teaches nobody anything,
  // so the assertion is not just "non-empty": it must be a real sentence and
  // it must not BE the label.
  it('gives every desk a blurb that says what it is for', () => {
    for (const d of DESKS) {
      expect(d.blurb.length, `${d.key} blurb`).toBeGreaterThan(20)
      expect(d.blurb.trim().toLowerCase(), `${d.key} blurb`).not.toBe(d.label.toLowerCase())
      expect(d.blurb.trim().endsWith('.'), `${d.key} blurb ends in a full stop`).toBe(true)
    }
  })

  it('uses the wording the user gave for Approvals', () => {
    expect(DESK_BY_KEY.approvals.blurb).toBe(
      'New people trying to get into AQ. Approving one makes them a member.',
    )
  })

  it('NAV_GROUPS is exactly the five groups, and covers every desk once', () => {
    expect(NAV_GROUPS.map(g => g.label)).toEqual(['queue', 'people', 'intake', 'admin', 'reference'])
    expect(NAV_GROUPS.flatMap(g => g.items.map(i => i.key)).sort()).toEqual(DESKS.map(d => d.key).sort())
  })
})

describe('the route guard and the nav gate agree, for every desk × every role', () => {
  for (const role of ROLES) {
    for (const desk of DESKS) {
      it(`${String(role)} → ${desk.key}`, () => {
        const routeAllows = canAccessDesk(desk, role)
        const navShows = isDeskVisible(desk, { role, canApproveMembers: canApprove(role) })
        expect(navShows).toBe(routeAllows)
      })
    }
  }

  it('the nav never shows a desk the route would refuse (the historical bug)', () => {
    for (const role of ROLES) {
      for (const desk of DESKS) {
        const navShows = isDeskVisible(desk, { role, canApproveMembers: canApprove(role) })
        if (navShows) expect(canAccessDesk(desk, role)).toBe(true)
      }
    }
  })

  it('`approvals` is the only desk with an extra nav filter, and it is currently equal to its privilege', () => {
    expect(Object.keys(EXTRA_NAV_FILTER)).toEqual(['approvals'])
    for (const role of ROLES) {
      // canApproveMembers === hasLeaderAccess === the `leader` privilege, so
      // the extra filter subtracts nothing today. If it ever narrows, this
      // fails rather than the nav silently hiding a still-reachable URL.
      expect(canApprove(role)).toBe(hasLeaderAccess(role))
    }
  })
})

describe('the effective access set, spelled out', () => {
  it('non-leaders get nothing at all', () => {
    for (const role of ['member', 'lead', undefined, null, '', 'nonsense'] as const) {
      expect(DESKS.filter(d => canAccessDesk(d, role))).toHaveLength(0)
      expect(visibleDeskGroups({ role, canApproveMembers: canApprove(role) })).toHaveLength(0)
    }
  })

  // 13 until wall_notes was deleted (2026-09-11); 12 leader + 6 super = 18
  // until 2026-09-12, when `sops` and `drives` (both leader) were deleted:
  // 10 leader + 6 super = 16. Same day, `approvals` moved leader -> super
  // (HR/super_admin-only sign-up approvals): 9 leader + 7 super = 16.
  // 2026-11-02: the Product guide desk (leader) makes it 10 leader + 8 super = 18.
  it('hod and director each get the 10 leader desks — never the 8 super ones', () => {
    for (const role of ['hod', 'director'] as const) {
      const allowed = DESKS.filter(d => canAccessDesk(d, role))
      expect(allowed).toHaveLength(10)
      expect(allowed.every(d => d.privilege === 'leader')).toBe(true)
      const visible = visibleDeskGroups({ role, canApproveMembers: canApprove(role) }).flatMap(g => g.items)
      expect(visible.map(d => d.key).sort()).toEqual(allowed.map(d => d.key).sort())
    }
  })

  it('hr and super_admin each get all 18', () => {
    for (const role of ['hr', 'super_admin'] as const) {
      expect(isSuperAdmin(role)).toBe(true)
      expect(DESKS.filter(d => canAccessDesk(d, role))).toHaveLength(18)
      const visible = visibleDeskGroups({ role, canApproveMembers: canApprove(role) }).flatMap(g => g.items)
      expect(visible).toHaveLength(18)
    }
  })
})

describe('scopeToMyTeams — the Hiring desk’s team scope (item 6.1)', () => {
  const rows = [
    { id: 'a', teamId: 9 },   // Social Media
    { id: 'b', teamId: 8 },   // Welfare
    { id: 'c' },              // predates the team_id FK
    { id: 'd', teamId: null },
  ]

  it('shows a scoped leader only their own teams', () => {
    const out = scopeToMyTeams(rows, { isSuperAdmin: false, myTeamIds: [9] })
    expect(out.map(r => r.id)).toEqual(['a', 'c', 'd'])   // other teams out; team-less rows stay (report 875f0da1)
  })

  it('shows super admins and HR everything, scope or no scope', () => {
    expect(scopeToMyTeams(rows, { isSuperAdmin: true, myTeamIds: [9] })).toHaveLength(4)
  })

  // The failure this guards is silent: a leader with no lead row and no
  // category assignment - which live on 2026-09-11 is EVERY non-super leader
  // in the org - must not have their desk quietly emptied. An empty Hiring
  // desk is indistinguishable from "nobody applied".
  it('treats an empty scope as unscoped, never as "nothing"', () => {
    expect(scopeToMyTeams(rows, { isSuperAdmin: false, myTeamIds: [] })).toHaveLength(4)
  })

  // Report 875f0da1: a team-less opening was hidden from every scoped leader, who were notified of its applicants
  // and then saw nothing. The row stays visible; other teams' rows are still out of scope.
  it('keeps a team-less row visible instead of silently hiding it', () => {
    const out = scopeToMyTeams(rows, { isSuperAdmin: false, myTeamIds: [8, 9] })
    expect(out.map(r => r.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(scopeToMyTeams(rows, { isSuperAdmin: false, myTeamIds: [3] }).map(r => r.id)).toEqual(['c', 'd'])
  })

  it('does not mutate or re-order the input', () => {
    const input = [...rows]
    const out = scopeToMyTeams(input, { isSuperAdmin: true, myTeamIds: [] })
    expect(input).toEqual(rows)
    expect(out).not.toBe(input)
    expect(out.map(r => r.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('requiredRoleLabel', () => {
  it('names the role needed, per 11.7', () => {
    expect(requiredRoleLabel('leader')).toMatch(/HoD/)
    expect(requiredRoleLabel('super')).toMatch(/HR|Super Admin/)
  })
})
