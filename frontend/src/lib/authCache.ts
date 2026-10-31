import { supabaseCommunity } from './supabaseCommunity'
import { cachedMemberIdFor } from './cachedIdentity'

let _cachedAuthUid: string | null = null
let _cachedMemberId: number | null = null
let _pendingFetch: Promise<number | null> | null = null

export async function getCachedMemberId(): Promise<number | null> {
  const { data: { session } } = await supabaseCommunity.auth.getSession()
  if (!session?.user) { clearAuthCache(); return null }

  // Cache hit
  if (_cachedAuthUid === session.user.id && _cachedMemberId !== null) {
    return _cachedMemberId
  }

  // AuthContext already fetched this member's row and persisted it: a member id never changes for an auth user, so read it back
  // instead of spending a network round trip (which sat in front of the feed query on every cold start). Only trusted when the
  // cached row belongs to THIS session's user; anything else falls through to the server exactly as before.
  const local = cachedMemberIdFor(session.user.id)
  if (local !== null) {
    _cachedAuthUid = session.user.id
    _cachedMemberId = local
    return local
  }

  // If a fetch is already in-flight, await it instead of firing a duplicate query
  if (_pendingFetch) return _pendingFetch

  _pendingFetch = (async () => {
    try {
      // get_own_member() (SECURITY DEFINER RPC), not a raw `.eq('auth_uid', ...)`
      // filter - `authenticated` lost SELECT on members.auth_uid in
      // scripts/members_pii_lockdown_stage2_revoke.sql, so filtering on that
      // column directly throws "permission denied for table members" for
      // every caller. This silently broke every director mutation that goes
      // through getCurrentMemberId() (approve/reject on every desk) since the
      // failure was swallowed here and surfaced downstream as "Not authenticated".
      const { data: member } = await supabaseCommunity
        .rpc('get_own_member' as never)
        .maybeSingle()
      _cachedAuthUid = session.user.id
      _cachedMemberId = (member as any)?.member_id ?? null
    } catch {
      _cachedMemberId = null
    } finally {
      _pendingFetch = null
    }
    return _cachedMemberId
  })()

  return _pendingFetch
}

export function clearAuthCache() {
  _cachedAuthUid = null
  _cachedMemberId = null
  _pendingFetch = null
}

// ─────────────────────────────────────────────────────────────────────────────
// uuid -> member_id, deduped.
//
// A `members` row's uuid->member_id mapping never changes, and half the service
// layer needs it before it can run its real query. Opening someone else's
// profile fired SEVEN byte-identical `select member_id from members where
// uuid = ?` requests for the same row - profileService (three call sites),
// achievementService, followService, teamService and PublicProfilePage's own
// inline lookup - each a serialising round trip in front of its dependent
// query, before anything rendered.
//
// Two guards, same shape as getCachedMemberId above: a resolved-value cache
// keyed by uuid, and an in-flight map so N concurrent callers for the same uuid
// share ONE request rather than racing. Cleared on sign-out with the rest.
// ─────────────────────────────────────────────────────────────────────────────
const _uuidToMemberId = new Map<string, number>()
const _uuidInFlight = new Map<string, Promise<number | null>>()

export async function resolveMemberIdFromUuid(uuid: string): Promise<number | null> {
  if (!uuid) return null
  const hit = _uuidToMemberId.get(uuid)
  if (hit !== undefined) return hit

  const inFlight = _uuidInFlight.get(uuid)
  if (inFlight) return inFlight

  const p = (async () => {
    try {
      const { data, error } = await supabaseCommunity
        .from('members')
        .select('member_id')
        .eq('uuid', uuid)
        .maybeSingle()
      if (error || !data) return null
      const id = (data as any).member_id as number
      // Only a HIT is cached. A miss may be a row this viewer cannot read yet
      // (RLS, a pending account), and caching that would make it permanent for
      // the rest of the session.
      _uuidToMemberId.set(uuid, id)
      return id
    } catch {
      return null
    } finally {
      _uuidInFlight.delete(uuid)
    }
  })()

  _uuidInFlight.set(uuid, p)
  return p
}

supabaseCommunity.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    clearAuthCache()
    _uuidToMemberId.clear()
    _uuidInFlight.clear()
  }
})
