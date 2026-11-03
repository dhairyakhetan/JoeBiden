import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parseWishPath, stashWish, readWish, clearWish } from './pendingWish'

const ID = '68e7fcd2-cad1-49b2-9333-73f183e126e4'

// The suite runs in plain Node (vitest.config.ts), which has no sessionStorage: a tiny in-memory stand-in.
function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() }
}

describe('parseWishPath', () => {
  it('reads a role page, with or without the apply flag', () => {
    expect(parseWishPath(`/opportunities/${ID}`)).toEqual({ openingId: ID })
    expect(parseWishPath(`/opportunities/${ID}?apply=1`)).toEqual({ openingId: ID })
  })
  it('reads a team page, including a deep link into a tab', () => {
    expect(parseWishPath(`/teams/${ID}`)).toEqual({ teamUuid: ID })
    expect(parseWishPath(`/teams/${ID}?opening=x`)).toEqual({ teamUuid: ID })
  })
  it('a sub-team page counts as its team', () => {
    expect(parseWishPath(`/teams/${ID}/sub/design`)).toEqual({ teamUuid: ID })
  })
  it('ignores everything else', () => {
    for (const p of ['/', '/opportunities', '/opportunities/', '/profile/me', '/director/hiring', '', null, undefined, ]) {
      expect(parseWishPath(p as any)).toBeNull()
    }
  })
})

describe('stash and read', () => {
  beforeEach(() => { vi.stubGlobal('sessionStorage', memoryStorage()) })
  it('round-trips a role and clears', () => {
    stashWish(`/opportunities/${ID}?apply=1`)
    expect(readWish()).toEqual({ openingId: ID })
    clearWish()
    expect(readWish()).toBeNull()
  })
  it('does not stash a path that is not a role or team', () => {
    stashWish('/profile/me')
    expect(readWish()).toBeNull()
  })
  it('forgets a wish older than six hours', () => {
    sessionStorage.setItem('aq_pending_wish_v1', JSON.stringify({ target: { openingId: ID }, at: Date.now() - 7 * 3600 * 1000 }))
    expect(readWish()).toBeNull()
  })
  it('survives garbage in storage', () => {
    sessionStorage.setItem('aq_pending_wish_v1', '{not json')
    expect(readWish()).toBeNull()
  })
})
