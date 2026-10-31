import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cachedMemberIdFor, MEMBER_CACHE_KEY, MEMBER_CACHE_MAX_AGE_MS } from './cachedIdentity'
import { readSnapshot, writeSnapshot, clearSnapshots, SNAPSHOT_MAX_AGE_MS, MAX_BYTES, MAX_ENTRIES } from './homeSnapshot'
import { readFeedSnapshot, writeFeedSnapshot, looksLikeFeedPage, FEED_SCHEMA } from './feedSnapshot'

/** An in-memory Storage with the behaviours the real one has that matter here: iteration by index, and a quota that can throw. */
class MemStorage {
  private m = new Map<string, string>()
  quota = Infinity
  throwOnGet = false
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { if (this.throwOnGet) throw new Error('blocked'); return this.m.has(k) ? this.m.get(k)! : null }
  setItem(k: string, v: string) {
    if ([...this.m.values()].join('').length + v.length > this.quota) throw new DOMException('quota', 'QuotaExceededError')
    this.m.set(k, v)
  }
  removeItem(k: string) { this.m.delete(k) }
  clear() { this.m.clear() }
}

let store: MemStorage
beforeEach(() => { store = new MemStorage(); vi.stubGlobal('localStorage', store) })
afterEach(() => { vi.unstubAllGlobals() })

const UID = '11111111-1111-4111-8111-111111111111'
const put = (member: Record<string, unknown>, cachedAt = Date.now()) =>
  store.setItem(MEMBER_CACHE_KEY, JSON.stringify({ member, cachedAt }))

describe('cachedMemberIdFor: the member id a service can read instead of asking the server', () => {
  it('returns the id when the cached row belongs to this session user', () => {
    put({ auth_uid: UID, member_id: 4242 })
    expect(cachedMemberIdFor(UID)).toBe(4242)
  })

  it('REFUSES another account on a shared browser (the cache must never lend one member id to another)', () => {
    put({ auth_uid: UID, member_id: 4242 })
    expect(cachedMemberIdFor('22222222-2222-4222-8222-222222222222')).toBeNull()
  })

  it('returns null with no cache, an empty uid, or no session uid', () => {
    expect(cachedMemberIdFor(UID)).toBeNull()
    put({ auth_uid: UID, member_id: 4242 })
    expect(cachedMemberIdFor('')).toBeNull()
  })

  it('ignores an entry older than the 24h AuthContext itself allows, and one stamped in the future', () => {
    const now = 1_800_000_000_000
    put({ auth_uid: UID, member_id: 7 }, now - MEMBER_CACHE_MAX_AGE_MS - 1)
    expect(cachedMemberIdFor(UID, now)).toBeNull()
    put({ auth_uid: UID, member_id: 7 }, now - MEMBER_CACHE_MAX_AGE_MS + 1000)
    expect(cachedMemberIdFor(UID, now)).toBe(7)
    put({ auth_uid: UID, member_id: 7 }, now + 10 * 60_000)
    expect(cachedMemberIdFor(UID, now)).toBeNull()
  })

  it.each([
    ['a string id', { auth_uid: UID, member_id: '4242' }],
    ['a float', { auth_uid: UID, member_id: 4.5 }],
    ['zero', { auth_uid: UID, member_id: 0 }],
    ['a negative', { auth_uid: UID, member_id: -3 }],
    ['null', { auth_uid: UID, member_id: null }],
    ['no member_id', { auth_uid: UID }],
    ['NaN', { auth_uid: UID, member_id: Number.NaN }],
  ])('refuses %s', (_n, member) => {
    put(member)
    expect(cachedMemberIdFor(UID)).toBeNull()
  })

  it.each(['not json', '{', 'null', '[]', '{"member":null,"cachedAt":1}', '{"cachedAt":"x","member":{}}', '""'])('survives corrupt storage %j', raw => {
    store.setItem(MEMBER_CACHE_KEY, raw)
    expect(cachedMemberIdFor(UID)).toBeNull()
  })

  it('never throws when storage itself is blocked', () => {
    put({ auth_uid: UID, member_id: 1 })
    store.throwOnGet = true
    expect(cachedMemberIdFor(UID)).toBeNull()
  })
})

describe('feedSnapshot: the home feed page, and only ever a shape the current code can render', () => {
  const post = (i: number) => ({ postId: 1000 - i, uuid: `u-${i}`, body: 'x' })
  const page = { data: [post(0), post(1)], total: 60, hasMore: true }

  it('round-trips a member feed page and keeps members apart', () => {
    writeFeedSnapshot('m1', '', 'latest', page)
    expect(readFeedSnapshot('m1', '', 'latest')).toEqual(page)
    expect(readFeedSnapshot('m2', '', 'latest')).toBeNull()
    expect(readFeedSnapshot(undefined, '', 'latest')).toBeNull() // the anon feed is a different scope
  })

  it('keys by category and tab, so a filtered feed never shows the unfiltered one', () => {
    writeFeedSnapshot('m1', '', 'latest', page)
    expect(readFeedSnapshot('m1', 'events', 'latest')).toBeNull()
    expect(readFeedSnapshot('m1', '', 'foryou')).toBeNull()
  })

  it('treats undefined, null and empty uuids as the anon scope', () => {
    writeFeedSnapshot(undefined, 'guest', 'latest', page)
    expect(readFeedSnapshot(null, 'guest', 'latest')).toEqual(page)
    expect(readFeedSnapshot('', 'guest', 'latest')).toEqual(page)
  })

  it.each([
    ['null', null],
    ['a string', 'x'],
    ['no data', { total: 5 }],
    ['empty data', { data: [], total: 0 }],
    ['data not an array', { data: {}, total: 1 }],
    ['no total', { data: [post(0)] }],
    ['a string total', { data: [post(0)], total: '1' }],
    ['a post with no uuid', { data: [{ postId: 1 }], total: 1 }],
    ['a post with a string postId (an older shape)', { data: [{ postId: '1', uuid: 'a' }], total: 1 }],
    ['a null post', { data: [post(0), null], total: 2 }],
    ['one bad post among good ones', { data: [post(0), { postId: 2 }, post(2)], total: 3 }],
  ])('refuses to read or write %s', (_n, bad) => {
    expect(looksLikeFeedPage(bad)).toBe(false)
    writeFeedSnapshot('m1', '', 'latest', bad as never)
    expect(readFeedSnapshot('m1', '', 'latest')).toBeNull()
    expect(store.length).toBe(0) // nothing was persisted at all
  })

  it('does not return a stored page from a build with a different shape (planted directly in storage)', () => {
    store.setItem('aq_snap_v1:m1|feed_v2:all:latest', JSON.stringify({ v: 1, savedAt: Date.now(), value: { data: [{ id: 9, title: 'old shape' }], total: 1 } }))
    expect(readFeedSnapshot('m1', '', 'latest')).toBeNull()
  })

  it('a page written under a different schema tag is invisible (bumping FEED_SCHEMA retires old snapshots)', () => {
    store.setItem(`aq_snap_v1:m1|feed_v1:all:latest`, JSON.stringify({ v: 1, savedAt: Date.now(), value: page }))
    expect(FEED_SCHEMA).toBe('feed_v2')
    expect(readFeedSnapshot('m1', '', 'latest')).toBeNull()
  })
})

describe('homeSnapshot: what the home screen last showed, across closing the app', () => {
  const T0 = 1_800_000_000_000

  it('round-trips a value', () => {
    writeSnapshot('m1', 'feed', { data: [1, 2, 3] }, T0)
    expect(readSnapshot('m1', 'feed', SNAPSHOT_MAX_AGE_MS, T0 + 1000)).toEqual({ data: [1, 2, 3] })
  })

  it("is scoped: one member never reads another member's snapshot", () => {
    writeSnapshot('m1', 'feed', { who: 'm1' }, T0)
    expect(readSnapshot('m2', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toBeNull()
    expect(readSnapshot('anon', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toBeNull()
  })

  it('expires, and removes what it expired', () => {
    writeSnapshot('m1', 'feed', { x: 1 }, T0)
    expect(readSnapshot('m1', 'feed', SNAPSHOT_MAX_AGE_MS, T0 + SNAPSHOT_MAX_AGE_MS)).toEqual({ x: 1 })
    expect(readSnapshot('m1', 'feed', SNAPSHOT_MAX_AGE_MS, T0 + SNAPSHOT_MAX_AGE_MS + 1)).toBeNull()
    expect(store.length).toBe(0)
  })

  it('honours a shorter caller-supplied max age', () => {
    writeSnapshot('m1', 'feed', { x: 1 }, T0)
    expect(readSnapshot('m1', 'feed', 1000, T0 + 2000)).toBeNull()
  })

  it('does not trust a snapshot stamped in the future (a clock that moved)', () => {
    writeSnapshot('m1', 'feed', { x: 1 }, T0 + 3 * 3600_000)
    expect(readSnapshot('m1', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toBeNull()
  })

  it.each(['not json', '{', 'null', '[]', '{"v":2,"savedAt":1,"value":{}}', '{"v":1,"savedAt":"x","value":{}}', '{"v":1,"savedAt":1}', '{"v":1,"savedAt":1,"value":null}'])('ignores a corrupt or foreign entry %j', raw => {
    store.setItem('aq_snap_v1:m1|feed', raw)
    expect(readSnapshot('m1', 'feed', SNAPSHOT_MAX_AGE_MS, 5)).toBeNull()
  })

  it('refuses to store an entry over the size cap, and keeps the old one', () => {
    writeSnapshot('m1', 'feed', { x: 'small' }, T0)
    writeSnapshot('m1', 'feed', { x: 'y'.repeat(MAX_BYTES + 10) }, T0 + 1)
    expect(readSnapshot('m1', 'feed', SNAPSHOT_MAX_AGE_MS, T0 + 2)).toEqual({ x: 'small' })
  })

  it('keeps only the newest MAX_ENTRIES (a category filter mints a key per category)', () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i++) writeSnapshot('m1', `feed:${i}`, { i }, T0 + i)
    expect(store.length).toBe(MAX_ENTRIES)
    expect(readSnapshot('m1', 'feed:0', SNAPSHOT_MAX_AGE_MS, T0 + 100)).toBeNull() // the oldest went
    expect(readSnapshot('m1', `feed:${MAX_ENTRIES + 4}`, SNAPSHOT_MAX_AGE_MS, T0 + 100)).toEqual({ i: MAX_ENTRIES + 4 }) // the newest stayed
  })

  it('degrades silently on quota errors and blocked storage (never throws into the page)', () => {
    store.quota = 5
    expect(() => writeSnapshot('m1', 'feed', { x: 'too big for this quota' }, T0)).not.toThrow()
    expect(readSnapshot('m1', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toBeNull()
    store.throwOnGet = true
    expect(readSnapshot('m1', 'feed')).toBeNull()
    expect(() => clearSnapshots()).not.toThrow()
  })

  it('clearSnapshots() (sign-out) removes every snapshot and touches nothing else', () => {
    writeSnapshot('m1', 'feed', { a: 1 }, T0)
    writeSnapshot('anon', 'feed', { b: 1 }, T0)
    store.setItem(MEMBER_CACHE_KEY, 'keep-me')
    store.setItem('aq_intro_seen', '1')
    clearSnapshots()
    expect(readSnapshot('m1', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toBeNull()
    expect(readSnapshot('anon', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toBeNull()
    expect(store.getItem(MEMBER_CACHE_KEY)).toBe('keep-me')
    expect(store.getItem('aq_intro_seen')).toBe('1')
  })

  it('clearSnapshots(keepScope) drops members but keeps the public anon snapshot (a boot with no session)', () => {
    writeSnapshot('m1', 'feed', { a: 1 }, T0)
    writeSnapshot('m2', 'feed', { a: 2 }, T0)
    writeSnapshot('anon', 'feed', { b: 1 }, T0)
    clearSnapshots('anon')
    expect(readSnapshot('m1', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toBeNull()
    expect(readSnapshot('m2', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toBeNull()
    expect(readSnapshot('anon', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toEqual({ b: 1 })
  })

  it('does not confuse a scope that is a prefix of another (m1 vs m10)', () => {
    writeSnapshot('m10', 'feed', { a: 10 }, T0)
    clearSnapshots('m1')
    expect(readSnapshot('m10', 'feed', SNAPSHOT_MAX_AGE_MS, T0)).toBeNull() // m10 is NOT kept just because it starts with m1
  })
})
