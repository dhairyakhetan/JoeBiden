import { describe, it, expect } from 'vitest'
import { hasLeaderAccess, isSuperAdmin, getRoleLabel, getRoleClass, LEADER_ROLES, ADMIN_ROLES } from './roles'

describe('hasLeaderAccess', () => {
  it.each(LEADER_ROLES)('is true for %s', role => {
    expect(hasLeaderAccess(role)).toBe(true)
  })

  it('is false for member', () => {
    expect(hasLeaderAccess('member')).toBe(false)
  })

  it('is false for lead (team-scoped, not HoD-level)', () => {
    expect(hasLeaderAccess('lead')).toBe(false)
  })

  it('is false for undefined/null/empty', () => {
    expect(hasLeaderAccess(undefined)).toBe(false)
    expect(hasLeaderAccess(null)).toBe(false)
    expect(hasLeaderAccess('')).toBe(false)
  })

  it('is false for an unrecognized string', () => {
    expect(hasLeaderAccess('admin')).toBe(false)
  })

  it('is true for hr (equal in power to super_admin)', () => {
    expect(hasLeaderAccess('hr')).toBe(true)
  })

  it('includes hr in LEADER_ROLES', () => {
    expect(LEADER_ROLES).toContain('hr')
  })
})

describe('isSuperAdmin', () => {
  it.each(ADMIN_ROLES)('is true for %s', role => {
    expect(isSuperAdmin(role)).toBe(true)
  })

  it('is true for hr, which is equal in power to super_admin', () => {
    expect(isSuperAdmin('hr')).toBe(true)
  })

  it('is false for director/hod despite having leader access', () => {
    expect(isSuperAdmin('director')).toBe(false)
    expect(isSuperAdmin('hod')).toBe(false)
  })

  it('is false for lead/member/unrecognized', () => {
    expect(isSuperAdmin('lead')).toBe(false)
    expect(isSuperAdmin('member')).toBe(false)
    expect(isSuperAdmin('admin')).toBe(false)
  })

  it('is false for undefined/null', () => {
    expect(isSuperAdmin(undefined)).toBe(false)
    expect(isSuperAdmin(null)).toBe(false)
  })
})

describe('getRoleLabel', () => {
  it('maps each known role to its display label', () => {
    expect(getRoleLabel('super_admin')).toBe('Super Admin')
    expect(getRoleLabel('hod')).toBe('HoD')
    expect(getRoleLabel('director')).toBe('Director')
    expect(getRoleLabel('lead')).toBe('Team Lead')
    expect(getRoleLabel('hr')).toBe('HR')
  })

  it('falls back to Member for member/unknown/missing', () => {
    expect(getRoleLabel('member')).toBe('Member')
    expect(getRoleLabel('something-unrecognized')).toBe('Member')
    expect(getRoleLabel(undefined)).toBe('Member')
    expect(getRoleLabel(null)).toBe('Member')
  })
})

describe('getRoleClass', () => {
  it('groups hod/director/hr/super_admin under role-director', () => {
    expect(getRoleClass('hod')).toBe('role-director')
    expect(getRoleClass('director')).toBe('role-director')
    expect(getRoleClass('hr')).toBe('role-director')
    expect(getRoleClass('super_admin')).toBe('role-director')
  })

  it('gives lead its own class, distinct from the director group', () => {
    expect(getRoleClass('lead')).toBe('role-lead')
  })

  it('falls back to role-member for member/unknown/missing', () => {
    expect(getRoleClass('member')).toBe('role-member')
    expect(getRoleClass('something-unrecognized')).toBe('role-member')
    expect(getRoleClass(undefined)).toBe('role-member')
  })
})

// hr must behave exactly like super_admin at every helper. This is the whole
// point of the role (user decision, 2026-09-03) and the reason ProtectedRoute's
// requireSuperAdmin routes through isSuperAdmin() rather than a === comparison.
describe('hr parity with super_admin', () => {
  it('answers every helper identically to super_admin, except the label', () => {
    expect(hasLeaderAccess('hr')).toBe(hasLeaderAccess('super_admin'))
    expect(isSuperAdmin('hr')).toBe(isSuperAdmin('super_admin'))
    expect(getRoleClass('hr')).toBe(getRoleClass('super_admin'))
    expect(getRoleLabel('hr')).not.toBe(getRoleLabel('super_admin'))
  })
})
