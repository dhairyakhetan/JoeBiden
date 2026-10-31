import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import { referralExpiry, normalizeNote, type Referral, type ReferralStatus } from '../lib/referrals'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

/**
 * Referrals — the Supabase layer. Section 15.
 *
 * Per the service-layer contract in CLAUDE.md every function here THROWS on
 * error and never calls a toast. The calling component wraps it in try/catch
 * and owns the pending state, the success confirmation and the error.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE RLS SPLIT, read live on 2026-09-04 (`select ... from pg_policies`), and
 * the shape of every function below follows from it:
 *
 *   referrals        SELECT  referrer_id = current_member_id() OR is_director()
 *                    INSERT  WITH CHECK referrer_id = current_member_id()
 *                    UPDATE  is_director()   ← USING **and** WITH CHECK
 *                    DELETE  referrer_id = current_member_id() OR is_director()
 *
 *   referral_clicks  INSERT  anon AND authenticated, WITH CHECK true
 *                    SELECT  is_director() OR the referrer of that referral
 *                    (no UPDATE, no DELETE: a click log the actor can edit is
 *                     not a log)
 *
 * Consequences, all of them deliberate in the API below:
 *
 *   • There is no `setStatus` a member can reach. `markApplied` and
 *     `markAccepted` are leader-only and say so in their names and their doc
 *     comments. A member calling one gets a zero-row result, not an error,
 *     which is why both use `.select()` and a zero-row check (the PostgREST
 *     silent-denial rule in CLAUDE.md).
 *
 *   • `recordClick` is callable while signed out, which is the whole point:
 *     whoever follows an invite link usually has no session yet.
 *
 *   • `listMine` returns click COUNTS, which only the referrer and a leader
 *     can read. Nothing public ever renders one.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CLAIMING A REFERRAL goes through an RPC, not a column write.
 *
 * Attaching a new member to their referrer means setting `members.referred_by`,
 * and `authenticated` deliberately has NO UPDATE grant on that column. A bare
 * `GRANT UPDATE(referred_by)` would let any member set any referrer, at any
 * time, with no expiry check and no self-referral check, leaving the browser as
 * the only thing enforcing the rules.
 *
 * `public.claim_member_referral(uuid)` is the SECURITY DEFINER function that
 * owns those three rules (claim once, not expired, not yourself). It was added
 * 2026-09-04 and is safe to mount.
 */

const SELECT = 'id, referrer_id, opening_id, note, status, expires_at, created_at'

async function currentMemberId(): Promise<number> {
  const memberId = await getCachedMemberId()
  if (!memberId) throw new Error('Not authenticated')
  return memberId
}

function mapRow(row: Record<string, unknown>, clicks: number): Referral {
  return {
    id: String(row.id),
    referrerId: Number(row.referrer_id),
    openingId: typeof row.opening_id === 'number' ? row.opening_id : null,
    note: (row.note as string) ?? null,
    status: (row.status as ReferralStatus) ?? 'open',
    expiresAt: (row.expires_at as string) ?? null,
    createdAt: String(row.created_at),
    clicks,
  }
}

/**
 * Click counts for a set of referrals, in ONE query grouped client side,
 * rather than one count per row. Returns an empty map when the caller is not
 * allowed to read clicks, so a tracker still renders with no click figure
 * instead of failing whole.
 */
async function clickCounts(referralIds: string[]): Promise<Record<string, number>> {
  if (!referralIds.length) return {}
  const { data, error } = await supabaseCommunity
    .from('referral_clicks')
    .select('referral_id')
    .in('referral_id', referralIds)
  if (error) return {}
  const out: Record<string, number> = {}
  for (const row of data ?? []) {
    const id = String((row as { referral_id: string }).referral_id)
    out[id] = (out[id] ?? 0) + 1
  }
  return out
}

const referralServiceImpl = {
  /**
   * Mint an invite. The row's `referrer_id` is always the caller's own member
   * id, never a parameter, matching the INSERT policy's WITH CHECK exactly.
   *
   * `openingId` is `job_openings.opening_id`, the INTEGER key the referrals FK
   * points at, not the public uuid `/opportunities/:id` routes on. Use
   * `resolveOpeningId` to convert.
   */
  async create(opts: { note?: string; openingId?: number | null }): Promise<Referral> {
    const referrerId = await currentMemberId()
    const roleScoped = typeof opts.openingId === 'number'

    const { data, error } = await supabaseCommunity
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        opening_id: roleScoped ? opts.openingId! : null,
        note: opts.note ? normalizeNote(opts.note) : null,
        status: 'open',
        expires_at: referralExpiry(roleScoped),
      })
      .select(SELECT)
      .single()
    if (error) throw logSupabaseError('referralService.create', error)
    return mapRow(data as Record<string, unknown>, 0)
  },

  /** The caller's own invites, newest first, with their click counts. */
  async listMine(): Promise<Referral[]> {
    const referrerId = await currentMemberId()
    const { data, error } = await supabaseCommunity
      .from('referrals')
      .select(SELECT)
      .eq('referrer_id', referrerId)
      .order('created_at', { ascending: false })
    if (error) throw logSupabaseError('referralService.listMine', error)

    const rows = (data ?? []) as Record<string, unknown>[]
    const counts = await clickCounts(rows.map(r => String(r.id)))
    return rows.map(r => mapRow(r, counts[String(r.id)] ?? 0))
  },

  /**
   * Every referral, for the HoD desk. The SELECT policy already restricts this
   * to `is_director()`, so a member calling it simply gets their own rows back
   * rather than an error.
   */
  async listForDesk(limit = 60): Promise<Referral[]> {
    const { data, error } = await supabaseCommunity
      .from('referrals')
      .select(SELECT)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw logSupabaseError('referralService.listForDesk', error)

    const rows = (data ?? []) as Record<string, unknown>[]
    const counts = await clickCounts(rows.map(r => String(r.id)))
    return rows.map(r => mapRow(r, counts[String(r.id)] ?? 0))
  },

  /**
   * Withdraw an invite. DELETE is the member's own row or a leader's, which is
   * the only destructive thing a referrer can do to their own referral, and
   * the reason the tracker's destructive control says "withdraw" and not
   * "cancel their application".
   */
  async remove(referralId: string): Promise<void> {
    const { data, error } = await supabaseCommunity
      .from('referrals')
      .delete()
      .eq('id', referralId)
      .select('id')
    if (error) throw logSupabaseError('referralService.remove', error)
    // PostgREST returns no error and zero rows when a delete matches nothing,
    // which is what a denied policy looks like. Say so.
    if (!data || data.length === 0) throw new Error('That invite could not be withdrawn.')
  },

  /**
   * Log that someone opened the link. Runs SIGNED OUT: the INSERT policy is
   * granted to `anon` as well as `authenticated`, because the person following
   * an invite usually has no session.
   *
   * Deliberately swallows its own failure and returns a boolean instead of
   * throwing. This is the one non-throwing function in the file, on the same
   * reasoning as `notificationService.create()`: a click that could not be
   * logged must never stop the sign-in the visitor actually came for. An
   * unknown or malformed `ref` fails the foreign key and returns false.
   */
  async recordClick(referralId: string): Promise<boolean> {
    try {
      const { error } = await supabaseCommunity
        .from('referral_clicks')
        .insert({ referral_id: referralId })
      return !error
    } catch { return false }
  },

  /**
   * LEADER ONLY. Moves a referral along. `referrals` UPDATE is `is_director()`
   * on USING and WITH CHECK, so a member calling this matches zero rows.
   *
   * The zero-row check is not defensive noise: PostgREST returns success with
   * an empty body when a policy denies an update, which once looked identical
   * to a successful write on three other desks.
   */
  async setStatusAsLeader(referralId: string, status: ReferralStatus): Promise<void> {
    const { data, error } = await supabaseCommunity
      .from('referrals')
      .update({ status })
      .eq('id', referralId)
      .select('id')
    if (error) throw logSupabaseError('referralService.setStatusAsLeader', error)
    if (!data || data.length === 0) {
      throw new Error('Only an HoD can change a referral. Nothing was changed.')
    }
  },

  /**
   * The integer `job_openings.opening_id` behind a public opening uuid.
   * `lib/jobOpenings.ts` exposes only the uuid (`JobOpening.id`), because that
   * is what `/opportunities/:id` routes on, but `referrals.opening_id` is a FK
   * to the integer column on the same row.
   */
  async resolveOpeningId(openingUuid: string): Promise<number | null> {
    const { data, error } = await supabaseCommunity
      .from('job_openings')
      .select('opening_id')
      .eq('id', openingUuid)
      .maybeSingle()
    if (error) throw logSupabaseError('referralService.resolveOpeningId', error)
    return data?.opening_id ?? null
  },

  /**
   * How many members this referrer has brought in.
   *
   * Returns `null`, NOT 0, when the figure cannot be sourced. `authenticated`
   * has no SELECT grant on `members.referred_by`, so filtering on it throws
   * "permission denied for table members" today. The badge renders a dashed
   * live marker for a null and a real number the moment the grant lands. A
   * zero here would be a claim, and this project has shipped an invented
   * figure on this exact feature once already.
   */
  async broughtInCount(): Promise<number | null> {
    try {
      const referrerId = await currentMemberId()
      const { count, error } = await supabaseCommunity
        .from('members')
        .select('member_id', { count: 'exact', head: true })
        .eq('referred_by', referrerId)
        .eq('status', 'active')
      if (error) return null
      return count ?? null
    } catch { return null }
  },

  /**
   * WIRED. Attaches the signed-in member to their referrer by
   * writing `members.referred_by`.
   *
   * IMPORTANT, and the reason this is not called during sign-up: the RPC opens
   * with `current_member_id()`, which resolves only for `status = 'active'`, and
   * RAISES when it is null. So calling it while signed out at /login, or as a
   * `pending_approval` member at /register or /pending, throws every time. The
   * `ref` is therefore CARRIED (localStorage, so it survives the OAuth
   * full-page redirect and days of waiting on an HoD) and claimed at the first
   * render where the member is active. See referrals/claimStoredReferral.ts.
   *
   * Returns TRUE when the claim landed, FALSE when a rule blocked it: already
   * claimed, expired, self-referral, or no such referral. False is not an
   * error - a stale or reused invite link is an ordinary thing to click, and
   * it must be a no-op rather than an error page. The function throws only if
   * the RPC itself fails.
   */
  async claimReferral(referralId: string): Promise<boolean> {
    const { data, error } = await (supabaseCommunity as any)
      .rpc('claim_member_referral', { p_referral_id: referralId })
    if (error) throw logSupabaseError('referralService.claimReferral', error)
    return data === true
  },
}

export const referralService = withFunctionLogging('referralService', referralServiceImpl)

export default referralService
