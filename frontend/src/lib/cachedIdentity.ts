/**
 * The member row AuthContext already keeps in localStorage, read for the one thing a service needs from it: the numeric member id.
 *
 * `getFeed`, `getPost` and a long tail of services start with "who am I?" and used to answer it with a `get_own_member` round trip,
 * even though AuthContext had fetched the same row seconds earlier (and persisted it) on the very same page load. That request sat in
 * front of the feed query, so on a poor connection every cold start paid one full round trip to re-learn a number that never changes
 * for an account.
 *
 * Safe because it is only ever read, never trusted blind:
 *  - it must belong to THIS session's auth user (`auth_uid` equals the session's user id), so a shared browser or an account switch
 *    can never lend one member's id to another;
 *  - it must be a real integer and no older than the same 24 hours AuthContext itself allows;
 *  - a member id is a permanent key. It never changes for an auth user, so a cached one cannot be "stale" the way a role or a status
 *    can. (The row's role and status are NOT read here, and nothing in this file grants anything: every query this id is used in is
 *    still filtered by RLS on the server.)
 * Anything missing, malformed or mismatched returns null and the caller falls back to asking the server, exactly as before.
 */

/** The localStorage key AuthContext persists the member row under. One definition, imported by both. */
export const MEMBER_CACHE_KEY = 'aq_member_v1'
export const MEMBER_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function cachedMemberIdFor(authUid: string, now: number = Date.now()): number | null {
  if (!authUid) return null
  try {
    const raw = localStorage.getItem(MEMBER_CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as { member?: { auth_uid?: unknown; member_id?: unknown }; cachedAt?: unknown } | null
    if (!entry || typeof entry.cachedAt !== 'number' || !entry.member) return null
    if (now - entry.cachedAt > MEMBER_CACHE_MAX_AGE_MS || entry.cachedAt > now + 60_000) return null
    if (entry.member.auth_uid !== authUid) return null
    const id = entry.member.member_id
    return typeof id === 'number' && Number.isInteger(id) && id > 0 ? id : null
  } catch {
    return null
  }
}
