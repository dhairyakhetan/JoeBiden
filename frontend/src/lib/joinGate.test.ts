import { describe, it, expect } from 'vitest'
import { joinGate, canApplyNow, canRegisterInterest, isNotApprovedError } from './joinGate'

describe('joinGate', () => {
  it('signed out is a visitor', () => {
    expect(joinGate(null)).toBe('visitor')
    expect(joinGate(undefined)).toBe('visitor')
  })
  it('maps each member status', () => {
    expect(joinGate({ status: 'active' })).toBe('active')
    expect(joinGate({ status: 'pending_approval' })).toBe('pending')
    expect(joinGate({ status: 'rejected' })).toBe('rejected')
    for (const s of ['suspended', 'deleted', 'archived', '', null, undefined, 'something_new']) {
      expect(joinGate({ status: s as any })).toBe('blocked')
    }
  })
  it('only visitors and active members may submit the form', () => {
    expect(canApplyNow('visitor')).toBe(true)
    expect(canApplyNow('active')).toBe(true)
    expect(canApplyNow('pending')).toBe(false)
    expect(canApplyNow('rejected')).toBe(false)
    expect(canApplyNow('blocked')).toBe(false)
  })
  it('only a pending member may register interest', () => {
    expect(canRegisterInterest('pending')).toBe(true)
    for (const g of ['visitor', 'active', 'rejected', 'blocked'] as const) expect(canRegisterInterest(g)).toBe(false)
  })
  it('recognises an RLS refusal', () => {
    expect(isNotApprovedError({ code: '42501' })).toBe(true)
    expect(isNotApprovedError({ message: 'new row violates row-level security policy for table "job_applications"' })).toBe(true)
    expect(isNotApprovedError({ code: '23505' })).toBe(false)
    expect(isNotApprovedError(null)).toBe(false)
  })
})
