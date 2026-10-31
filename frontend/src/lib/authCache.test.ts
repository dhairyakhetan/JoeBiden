import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const getSession = vi.fn()
const maybeSingle = vi.fn()
const rpc = vi.fn(() => ({ maybeSingle }))
vi.mock('./supabaseCommunity', () => ({
  supabaseCommunity: {
    // authCache subscribes to sign-out at import time, so the mock needs the method.
    auth: { getSession: (...a: unknown[]) => getSession(...a), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    rpc: (...a: unknown[]) => (rpc as any)(...a),
  },
}))

import { getCachedMemberId, clearAuthCache } from './authCache'
import { MEMBER_CACHE_KEY } from './cachedIdentity'

class MemStorage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}

const UID = '11111111-1111-4111-8111-111111111111'
const OTHER = '99999999-9999-4999-8999-999999999999'
const session = (id: string | null) => getSession.mockResolvedValue({ data: { session: id ? { user: { id } } : null } })
const cacheFor = (auth_uid: string, member_id: number, cachedAt = Date.now()) =>
  localStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify({ member: { auth_uid, member_id }, cachedAt }))

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemStorage())
  getSession.mockReset(); maybeSingle.mockReset(); rpc.mockClear()
  clearAuthCache()
})
afterEach(() => { vi.unstubAllGlobals() })

describe("getCachedMemberId: skips the network ONLY when the cached row is provably this session user's", () => {
  it('returns the cached id with ZERO network calls (the whole point: one round trip off every cold feed load)', async () => {
    session(UID); cacheFor(UID, 4242)
    expect(await getCachedMemberId()).toBe(4242)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('asks the server when the cache belongs to a DIFFERENT account (shared browser, account switch)', async () => {
    session(UID); cacheFor(OTHER, 7)
    maybeSingle.mockResolvedValue({ data: { member_id: 4242 }, error: null })
    expect(await getCachedMemberId()).toBe(4242) // the server's answer, never the other account's 7
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('asks the server when there is no cache, as before', async () => {
    session(UID)
    maybeSingle.mockResolvedValue({ data: { member_id: 55 }, error: null })
    expect(await getCachedMemberId()).toBe(55)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('asks the server when the cache is expired or malformed', async () => {
    session(UID)
    maybeSingle.mockResolvedValue({ data: { member_id: 55 }, error: null })
    cacheFor(UID, 4242, Date.now() - 25 * 3600_000)
    expect(await getCachedMemberId()).toBe(55)
    clearAuthCache(); rpc.mockClear()
    localStorage.setItem(MEMBER_CACHE_KEY, '{broken')
    expect(await getCachedMemberId()).toBe(55)
    expect(rpc).toHaveBeenCalledTimes(1)
  })

  it('returns null and never reads the cache when there is no session at all', async () => {
    session(null); cacheFor(UID, 4242)
    expect(await getCachedMemberId()).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })

  it("does not hand a previous user's id to the next user after sign-in on the same tab", async () => {
    session(UID); cacheFor(UID, 4242)
    expect(await getCachedMemberId()).toBe(4242)
    // the next person signs in; AuthContext replaced the cache with their row
    session(OTHER); cacheFor(OTHER, 808)
    expect(await getCachedMemberId()).toBe(808)
  })

  it('still falls back to the server when the cached id is absent and the RPC errors (null, no throw)', async () => {
    session(UID)
    maybeSingle.mockRejectedValue(new Error('network'))
    expect(await getCachedMemberId()).toBeNull()
  })

  it('answers many concurrent callers from the cache without a single RPC (the startup burst)', async () => {
    session(UID); cacheFor(UID, 4242)
    const ids = await Promise.all(Array.from({ length: 20 }, () => getCachedMemberId()))
    expect(new Set(ids)).toEqual(new Set([4242]))
    expect(rpc).not.toHaveBeenCalled()
  })

  it('with no cache, 20 concurrent callers still share ONE RPC (the existing in-flight dedupe is preserved)', async () => {
    session(UID)
    let release!: (v: unknown) => void
    maybeSingle.mockReturnValue(new Promise(r => { release = r }))
    const all = Promise.all(Array.from({ length: 20 }, () => getCachedMemberId()))
    await new Promise(r => setTimeout(r, 0))
    release({ data: { member_id: 31 }, error: null })
    expect(new Set(await all)).toEqual(new Set([31]))
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
