import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  guestIdentityProblem, guestCopy, isEmailShape,
  stashGuestApply, readGuestApply, clearGuestApply, markGuestApplied, readGuestApplied, guestPrefill,
  type GuestDraft,
} from './guestApply'

vi.mock('./supabaseCommunity', () => ({ supabaseCommunity: {} }))

// Plain Node has no sessionStorage: a tiny in-memory stand-in.
function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

const draft: GuestDraft = { openingId: 'abc-123', title: 'Design Lead', name: 'Asha Rao', email: 'asha@example.com', phone: '98765 43210', message: 'hi', answers: { q1: 'x' } }

describe('guestIdentityProblem', () => {
  const ok = { name: 'Asha Rao', phone: '+91 98765 43210', email: 'asha@example.com' }
  it('accepts a good identity', () => { expect(guestIdentityProblem(ok)).toBeNull() })
  it('asks for a name, a real mobile and a real email, in that order', () => {
    expect(guestIdentityProblem({ ...ok, name: ' ' })).toMatch(/name/)
    expect(guestIdentityProblem({ ...ok, phone: '98765432101' })).toMatch(/mobile/)
    expect(guestIdentityProblem({ ...ok, email: 'asha@' })).toMatch(/email/)
  })
  it('email shape', () => { expect(isEmailShape('a@b.co')).toBe(true); expect(isEmailShape('a b@c.co')).toBe(false) })
})

describe('guestCopy', () => {
  it('a matching account is a sign-in, with the typed email as the hint', () => {
    const c = guestCopy({ outcome: 'email_match', maskedEmail: null }, 'Design Lead')
    expect(c.heading).toMatch(/found an account/)
    expect(c.useHint).toBe(true)
  })
  it('a number on another email shows the masked address and gives no hint', () => {
    const c = guestCopy({ outcome: 'phone_match', maskedEmail: 'as*****@gmail.com' }, 'Design Lead')
    expect(c.body).toContain('as*****@gmail.com')
    expect(c.useHint).toBe(false)
  })
  it('a new person is told HR confirms them first, then the team reaches out', () => {
    const c = guestCopy({ outcome: 'none', maskedEmail: null }, 'Design Lead')
    expect(c.body).toMatch(/HR confirms/)
    expect(c.body).toMatch(/team reaches out/)
  })
  it('an error or limit still gives plain sign-in', () => {
    expect(guestCopy({ outcome: 'error', maskedEmail: null }, 'X').button).toMatch(/Google/)
    expect(guestCopy({ outcome: 'limited', maskedEmail: null }, 'X').button).toMatch(/Google/)
  })
})

describe('draft across the redirect', () => {
  beforeEach(() => { vi.stubGlobal('sessionStorage', memoryStorage()) })
  it('round-trips and clears', () => {
    stashGuestApply(draft)
    expect(readGuestApply()).toEqual(draft)
    clearGuestApply()
    expect(readGuestApply()).toBeNull()
  })
  it('expires after six hours', () => {
    stashGuestApply(draft)
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now + 7 * 60 * 60 * 1000)
    expect(readGuestApply()).toBeNull()
    vi.restoreAllMocks()
  })
  it('prefill gives register the name and a normalised number', () => {
    stashGuestApply(draft)
    expect(guestPrefill()).toEqual({ name: 'Asha Rao', phone: '9876543210' })
  })
  it('the applied marker is read back by the waiting page', () => {
    markGuestApplied('Design Lead')
    expect(readGuestApplied()).toBe('Design Lead')
  })
})
