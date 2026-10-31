import { supabaseCommunity } from '../lib/supabaseCommunity'
import type { ReceiptSource } from '../lib/receiptRecord'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

/**
 * The first sign-in receipt's data. Section 12.
 *
 * Per the service-layer contract in CLAUDE.md this file THROWS on error and
 * never toasts. The component wraps the call and owns the feedback.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THE RPC AND NOT `.from('members').select()`.
 *
 * Checked live on 2026-09-04, not assumed. `members` has NO table-level SELECT
 * for `authenticated`; it has per-column grants, and the columns the receipt
 * needs most are missing from them:
 *
 *   select grantee, column_name, privilege_type
 *     from information_schema.column_privileges
 *    where table_name='members' and grantee='authenticated';
 *
 * `email`, `phone`, `member_no` and `referred_by` have REFERENCES only. No
 * SELECT. `member_no` and `referred_by` were added by the A1 migration on
 * 2026-09-04, AFTER the PII lockdown re-granted SELECT column by column, so
 * they inherited nothing. A `.select('member_no')` from the browser returns
 * "permission denied for table members" — the same failure mode that broke
 * every director mutation once already (see `lib/authCache.ts`).
 *
 * `get_own_member()` is the existing SECURITY DEFINER RPC that `authCache.ts`
 * and `AuthContext.tsx` already use for exactly this reason. It is
 * `select * from public.members where auth_uid = auth.uid()`, so it returns
 * every column including the four above, for the caller's own row only.
 * Using it means section 12 needs no new grant and no new SQL.
 */

/** The caller's own member row, everything the receipt prints. */
const receiptServiceImpl = {
  async getOwnRecord(): Promise<(ReceiptSource & { uuid: string; member_id: number }) | null> {
    const { data, error } = await supabaseCommunity
      .rpc('get_own_member' as never)
      .maybeSingle()
    if (error) throw logSupabaseError('receiptService.getOwnRecord', error)
    if (!data) return null

    const row = data as Record<string, unknown>
    return {
      uuid: String(row.uuid ?? ''),
      member_id: Number(row.member_id),
      full_name: (row.full_name as string) ?? null,
      email: (row.email as string) ?? null,
      class_grade: (row.class_grade as string) ?? null,
      phone: (row.phone as string) ?? null,
      status: (row.status as string) ?? null,
      created_at: (row.created_at as string) ?? null,
      member_no: typeof row.member_no === 'number' ? row.member_no : null,
      referred_by: typeof row.referred_by === 'number' ? row.referred_by : null,
    }
  },

  /**
   * The `desk` row: the member's PRIMARY team name, from `team_members`.
   *
   * Reads `team_members`, NOT `member_teams`. `member_teams` was created by the
   * A1 migration and never populated — it held 0 rows against `team_members`'
   * 95, so this row was silently blank for every member who actually had a
   * team. The dead table has been dropped; this is the live one.
   *
   * `team_members` has no `is_primary` flag, so primary is defined here as the
   * EARLIEST active membership. 73 of the 83 members with a team have exactly
   * one, so the rule only decides anything for 10 people, and "the desk you
   * joined first" is the honest reading of primary for them.
   *
   * Returns null rather than throwing when the read is not available, and the
   * receipt omits the row. This stays a soft failure: RLS may not admit a
   * pending member, which is the receipt's normal viewer on day one, and a
   * brand new member has no team either way. A missing desk row is the
   * expected case, not an error worth interrupting the receipt for.
   */
  async getPrimaryDeskName(memberId: number): Promise<string | null> {
    // Two plain selects rather than a PostgREST embed, so `teams(name)` does
    // not need the whole call cast to satisfy the generated types.
    const { data: links, error: linkErr } = await supabaseCommunity
      .from('team_members')
      .select('team_id, joined_at')
      .eq('member_id', memberId)
      .neq('is_active', false)
      .is('left_at', null)
      .order('joined_at', { ascending: true })
      .limit(1)
    const link = links?.[0]
    if (linkErr || !link) return null

    const { data: team, error: teamErr } = await supabaseCommunity
      .from('teams')
      .select('name')
      .eq('team_id', link.team_id)
      .maybeSingle()
    if (teamErr || !team) return null
    return team.name ?? null
  },
}

export const receiptService = withFunctionLogging('receiptService', receiptServiceImpl)

export default receiptService
