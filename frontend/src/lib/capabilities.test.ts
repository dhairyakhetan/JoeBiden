import { describe, it, expect } from 'vitest'
import {
  CAPABILITIES,
  CAPABILITY_BY_KEY,
  CAPABILITY_ROLES,
  ceilingAllows,
  effectiveCan,
  isCellTogglable,
  lockReason,
  matrixCellKey,
  matrixEnabled,
  type CapabilityMatrix,
  type CapabilityRole,
} from './capabilities'
import { DESKS, isDeskVisible, visibleDeskGroups, canAccessDesk } from '../director/deskAccess'

/**
 * The capability engine's invariants.
 *
 * The one this file exists for is the last group: CLAUDE.md records that "a
 * lower-privileged leader can reach a super-admin-only screen by typing the URL
 * directly" has already shipped here as a real bug, and a capability layer that
 * hid a nav item without also refusing the route would reintroduce exactly that
 * class. So nav visibility and route access are asserted to agree for every
 * desk, against every role, under every single-restriction matrix.
 */

const ROLES = CAPABILITY_ROLES
const canApprove = (role: CapabilityRole) => ['hod', 'director', 'hr', 'super_admin'].includes(role)

/** What App.tsx's DeskCapabilityGate does, expressed once. */
const routeAllows = (matrix: CapabilityMatrix, deskKey: string, role: CapabilityRole) =>
  canAccessDesk(DESKS.find(d => d.key === deskKey)!, role) &&
  effectiveCan(matrix, `desk.${deskKey}`, role)

describe('capability registry', () => {
  it('gives every desk a capability, so a new desk cannot be forgotten', () => {
    for (const desk of DESKS) {
      expect(CAPABILITY_BY_KEY[`desk.${desk.key}`], `desk.${desk.key} missing`).toBeTruthy()
    }
  })

  it('uses unique keys', () => {
    const keys = CAPABILITIES.map(c => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('never lets a desk capability ceiling exceed the desk privilege gate', () => {
    // The matrix must not claim a role could hold a desk that the route guard
    // (which mirrors RLS) would refuse outright.
    for (const desk of DESKS) {
      for (const role of ROLES) {
        if (ceilingAllows(`desk.${desk.key}`, role)) {
          expect(canAccessDesk(desk, role), `${desk.key} / ${role}`).toBe(true)
        }
      }
    }
  })
})

describe('the narrowing rule', () => {
  const anyCap = 'desk.posts'

  it('an empty matrix reproduces the pre-engine permissions exactly', () => {
    const empty: CapabilityMatrix = {}
    for (const desk of DESKS) {
      for (const role of ROLES) {
        expect(effectiveCan(empty, `desk.${desk.key}`, role)).toBe(canAccessDesk(desk, role))
      }
    }
  })

  it('a tick can never widen past the ceiling', () => {
    // Explicitly enabled for a role the database will not serve.
    const matrix: CapabilityMatrix = { [matrixCellKey(anyCap, 'member')]: true }
    expect(ceilingAllows(anyCap, 'member')).toBe(false)
    expect(effectiveCan(matrix, anyCap, 'member')).toBe(false)
  })

  it('an untick genuinely removes access for a role that had it', () => {
    expect(effectiveCan({}, anyCap, 'hod')).toBe(true)
    const matrix: CapabilityMatrix = { [matrixCellKey(anyCap, 'hod')]: false }
    expect(effectiveCan(matrix, anyCap, 'hod')).toBe(false)
  })

  it('restricting one role leaves the others alone', () => {
    const matrix: CapabilityMatrix = { [matrixCellKey(anyCap, 'hod')]: false }
    expect(effectiveCan(matrix, anyCap, 'director')).toBe(true)
    expect(effectiveCan(matrix, anyCap, 'hr')).toBe(true)
  })

  it('absent means enabled, so the table only ever stores real restrictions', () => {
    expect(matrixEnabled({}, anyCap, 'hod')).toBe(true)
    expect(matrixEnabled({ [matrixCellKey(anyCap, 'hod')]: false }, anyCap, 'hod')).toBe(false)
  })

  it('never grants anything to a signed-out viewer', () => {
    for (const cap of CAPABILITIES) {
      expect(effectiveCan({}, cap.key, null)).toBe(false)
      expect(effectiveCan({}, cap.key, undefined)).toBe(false)
    }
  })

  it('refuses an unknown capability key rather than defaulting to allowed', () => {
    expect(effectiveCan({}, 'desk.does_not_exist', 'super_admin')).toBe(false)
  })
})

describe('super_admin can never lock itself out', () => {
  it('stays allowed even when the matrix says otherwise', () => {
    for (const cap of CAPABILITIES) {
      if (!ceilingAllows(cap.key, 'super_admin')) continue
      const matrix: CapabilityMatrix = { [matrixCellKey(cap.key, 'super_admin')]: false }
      expect(effectiveCan(matrix, cap.key, 'super_admin'), cap.key).toBe(true)
    }
  })

  it('offers no togglable cell in the super_admin column', () => {
    for (const cap of CAPABILITIES) {
      expect(isCellTogglable(cap.key, 'super_admin'), cap.key).toBe(false)
      expect(lockReason(cap.key, 'super_admin')).toBeTruthy()
    }
  })

  it('keeps the roles desk reachable, which is what undoes a mistake', () => {
    const matrix: CapabilityMatrix = { [matrixCellKey('desk.roles', 'super_admin')]: false }
    expect(effectiveCan(matrix, 'desk.roles', 'super_admin')).toBe(true)
  })
})

describe('hr cannot be locked out of the roles desk either', () => {
  // Audit 2026-09-17, P1. `hr` is equal in power to super_admin (lib/roles.ts)
  // and is usually the ONLY top-tier account, because it exists so HR staff do
  // not read as super admins. Unticking desk.roles for hr therefore removed the
  // only route back, with no in-app way to undo it.
  it('stays allowed for the roles desk even when the matrix says otherwise', () => {
    const matrix: CapabilityMatrix = { [matrixCellKey('desk.roles', 'hr')]: false }
    expect(effectiveCan(matrix, 'desk.roles', 'hr')).toBe(true)
  })

  it('locks that one cell in the hr column, with a reason', () => {
    expect(isCellTogglable('desk.roles', 'hr')).toBe(false)
    expect(lockReason('desk.roles', 'hr')).toBeTruthy()
  })

  // The narrow half. The tempting fix was `isSuperAdmin(role) => return true`,
  // which would have voided every hr restriction an operator had already set.
  it('leaves every OTHER capability restrictable for hr', () => {
    for (const cap of CAPABILITIES) {
      if (cap.key === 'desk.roles') continue
      if (!ceilingAllows(cap.key, 'hr')) continue
      const matrix: CapabilityMatrix = { [matrixCellKey(cap.key, 'hr')]: false }
      expect(effectiveCan(matrix, cap.key, 'hr'), cap.key).toBe(false)
      expect(isCellTogglable(cap.key, 'hr'), cap.key).toBe(true)
    }
  })

  it('does not extend the exemption to non-top-tier roles', () => {
    for (const role of ['hod', 'director'] as const) {
      if (!ceilingAllows('desk.roles', role)) continue
      const matrix: CapabilityMatrix = { [matrixCellKey('desk.roles', role)]: false }
      expect(effectiveCan(matrix, 'desk.roles', role), role).toBe(false)
    }
  })
})

describe('cells above the ceiling are locked, not merely unticked', () => {
  it('locks every cell the database would refuse, with a reason', () => {
    for (const cap of CAPABILITIES) {
      for (const role of ROLES) {
        if (ceilingAllows(cap.key, role)) continue
        expect(isCellTogglable(cap.key, role), `${cap.key}/${role}`).toBe(false)
        expect(lockReason(cap.key, role)).toBeTruthy()
      }
    }
  })
})

describe('the nav and the route agree under every restriction', () => {
  it('holds for every desk, every role, with that desk restricted', () => {
    for (const restrictedDesk of DESKS) {
      for (const restrictedRole of ROLES) {
        const matrix: CapabilityMatrix = {
          [matrixCellKey(`desk.${restrictedDesk.key}`, restrictedRole)]: false,
        }
        const can = (key: string) => effectiveCan(matrix, key, restrictedRole)

        for (const desk of DESKS) {
          const navShows = isDeskVisible(desk, {
            role: restrictedRole,
            canApproveMembers: canApprove(restrictedRole),
            can,
          })
          const routeOpens = routeAllows(matrix, desk.key, restrictedRole)

          // The nav must never advertise a desk the route would refuse. The
          // reverse is allowed: `approvals` carries an extra nav filter.
          if (navShows) {
            expect(routeOpens, `${desk.key} shown to ${restrictedRole} but route refuses`).toBe(true)
          }
        }
      }
    }
  })

  it('actually removes the restricted desk from the nav', () => {
    const matrix: CapabilityMatrix = { [matrixCellKey('desk.posts', 'hod')]: false }
    const can = (key: string) => effectiveCan(matrix, key, 'hod')
    const visible = visibleDeskGroups({ role: 'hod', canApproveMembers: true, can })
      .flatMap(g => g.items)
      .map(d => d.key)
    expect(visible).not.toContain('posts')
    // and leaves its neighbours in place ('approvals' moved to `super`
    // privilege 2026-09-12, so it's no longer one of hod's own desks -
    // 'members' is, and stays unrestricted here)
    expect(visible).toContain('members')
  })

  it('omitting `can` leaves the pre-engine nav exactly as it was', () => {
    for (const role of ROLES) {
      const before = visibleDeskGroups({ role, canApproveMembers: canApprove(role) })
      const after = visibleDeskGroups({ role, canApproveMembers: canApprove(role), can: () => true })
      expect(after.flatMap(g => g.items).map(d => d.key))
        .toEqual(before.flatMap(g => g.items).map(d => d.key))
    }
  })
})
