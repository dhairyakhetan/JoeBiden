import { describe, it, expect } from 'vitest'
import { deskGate, type GateMember } from './deskGate'

/**
 * The TerraThon desk gate.
 *
 * Worth pinning because the alternative is a real signed-in session for each
 * account shape, and two of these shapes (rejected, deleted) are ones nobody
 * would create on purpose to check a screen.
 */

// A leader who should get in. Every other case is this, spoiled one field at a
// time, so a test that changes behaviour names exactly which field did it.
const OK: GateMember = {
  status: 'active',
  role: 'hod',
  class_grade: '12',
  phone: '9830000000',
}

describe('deskGate', () => {
  it('lets an approved leader with a complete profile in', () => {
    expect(deskGate(OK, false)).toBe('allowed')
  })

  it('reports loading before anything else, including for a member that would be refused', () => {
    expect(deskGate(null, true)).toBe('loading')
    expect(deskGate({ ...OK, role: 'member' }, true)).toBe('loading')
  })

  it('asks a signed-out visitor to sign in', () => {
    expect(deskGate(null, false)).toBe('signed-out')
    expect(deskGate(undefined, false)).toBe('signed-out')
  })

  describe('every leader role opens it, and only leader roles', () => {
    for (const role of ['hod', 'director', 'super_admin', 'hr']) {
      it(`${role} is allowed`, () => {
        expect(deskGate({ ...OK, role }, false)).toBe('allowed')
      })
    }
    for (const role of ['member', 'lead', '', 'HOD', 'admin', null, undefined]) {
      it(`${JSON.stringify(role)} is refused`, () => {
        expect(deskGate({ ...OK, role }, false)).toBe('not-a-leader')
      })
    }
  })

  describe('order of refusals', () => {
    // This is the whole point of the file. A brand-new account fails three
    // checks at once, and the one reported has to be the one to act on first.
    const brandNew: GateMember = {
      status: 'pending_approval',
      role: 'member',
      class_grade: null,
      phone: null,
    }

    it('a brand-new account is told to finish its profile, not that it lacks a role', () => {
      expect(deskGate(brandNew, false)).toBe('incomplete-profile')
    })

    it('then, once the profile is filled, that it is waiting on approval', () => {
      expect(deskGate({ ...brandNew, class_grade: '12', phone: '9830000000' }, false))
        .toBe('pending-approval')
    })

    it('then, once approved, that it needs promoting', () => {
      expect(deskGate({ ...brandNew, class_grade: '12', phone: '9830000000', status: 'active' }, false))
        .toBe('not-a-leader')
    })
  })

  describe('an incomplete profile is caught whichever half is missing', () => {
    it('no phone', () => {
      expect(deskGate({ ...OK, phone: null }, false)).toBe('incomplete-profile')
    })
    it('no class', () => {
      expect(deskGate({ ...OK, class_grade: null }, false)).toBe('incomplete-profile')
    })
    it('a phone that is not a plausible number', () => {
      expect(deskGate({ ...OK, phone: '123' }, false)).toBe('incomplete-profile')
    })
  })

  describe('non-active statuses', () => {
    // These are the four that exist live. pending_approval gets its own screen
    // because it is the one a person is meant to pass through.
    it('pending_approval is its own state', () => {
      expect(deskGate({ ...OK, status: 'pending_approval' }, false)).toBe('pending-approval')
    })
    for (const status of ['rejected', 'deleted']) {
      it(`${status} is inactive`, () => {
        expect(deskGate({ ...OK, status }, false)).toBe('inactive')
      })
    }
    it('a status nobody has seen before is refused rather than let through', () => {
      expect(deskGate({ ...OK, status: 'something_new' }, false)).toBe('inactive')
      expect(deskGate({ ...OK, status: null }, false)).toBe('inactive')
    })
  })

  it('a leader role does not rescue an unapproved account', () => {
    // The desk is not reachable by setting a role alone: RLS would return rows
    // to this account, so the screen must not imply otherwise.
    expect(deskGate({ ...OK, status: 'pending_approval', role: 'super_admin' }, false))
      .toBe('pending-approval')
  })
})
