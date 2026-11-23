import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  guestIdentityProblem, guestCopy, submitGuestApply,
  stashGuestApply, readGuestApply, clearGuestApply, markGuestApplied, readGuestApplied, guestPrefill,
  type GuestDraft,
} from './guestApply'

const rpc = vi.fn()
vi.mock('./supabaseCommunity', () => ({ supabaseCommunity: { rpc: (...a: unknown[]) => rpc(...a) } }))

// Plain Node has no sessionStorage: a tiny in-memory stand-in.
function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

const draft: GuestDraft = { openingId: 'abc-123', title: 'Design Lead', name: 'Asha Rao', phone: '98765 43210', message: 'hi', answers: { q1: 'x' } }

describe('guestIdentityProblem', () => {
  const ok = { name: 'Asha Rao', phone: '+91 98765 43210' }
  it('accepts a good identity', () => { expect(guestIdentityProblem(ok)).toBeNull() })
  it('asks for a name, then a real mobile, and never for an email', () => {
    expect(guestIdentityProblem({ ...ok, name: ' ' })).toMatch(/name/)
    expect(guestIdentityProblem({ ...ok, phone: '98765432101' })).toMatch(/mobile/)
    expect(guestIdentityProblem(ok)).toBeNull()
  })
})

describe('guestCopy', () => {
  it('a number that is not an account says so, and that HR confirms first then the team', () => {
    const c = guestCopy('not_member', 'Design Lead')
    expect(c.heading).toMatch(/not part of AquaTerra/)
    expect(c.body).toMatch(/HR confirms/)
    expect(c.body).toMatch(/goes to the team/)
  })
  it('any other reason is plain sign-in to send', () => {
    for (const o of ['error', 'limited', 'signin'] as const) expect(guestCopy(o, 'X').button).toMatch(/Google/)
  })
})

describe('submitGuestApply', () => {
  const send = { openingId: 'abc-123', name: ' Asha Rao ', phone: '98765 43210', message: ' hi ', answers: { q1: 'x' } }
  beforeEach(() => { rpc.mockReset() })
  it('sends the trimmed name and note, and no email', async () => {
    rpc.mockResolvedValue({ data: [{ outcome: 'linked', opening_title: 'Design Lead' }], error: null })
    const r = await submitGuestApply(send)
    expect(r).toEqual({ outcome: 'linked', title: 'Design Lead' })
    expect(rpc).toHaveBeenCalledWith('guest_apply_submit', { p_opening_id: 'abc-123', p_name: 'Asha Rao', p_phone: '98765 43210', p_message: 'hi', p_answers: { q1: 'x' } })
  })
  it('passes every known outcome through', async () => {
    for (const o of ['linked', 'already', 'closed', 'not_member', 'invalid', 'limited']) {
      rpc.mockResolvedValue({ data: [{ outcome: o, opening_title: null }], error: null })
      expect((await submitGuestApply(send)).outcome).toBe(o)
    }
  })
  it('fails open to error on a database error, so nobody is stuck', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } })
    expect((await submitGuestApply(send)).outcome).toBe('error')
  })
  it('fails open to error on an answer it does not know', async () => {
    rpc.mockResolvedValue({ data: [{ outcome: 'surprise' }], error: null })
    expect((await submitGuestApply(send)).outcome).toBe('error')
  })
  it('fails open to error when the call itself throws', async () => {
    rpc.mockImplementation(() => { throw new Error('offline') })
    expect((await submitGuestApply(send)).outcome).toBe('error')
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
