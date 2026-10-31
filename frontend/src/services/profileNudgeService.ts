import { supabaseCommunity } from '../lib/supabaseCommunity'
import {
  EMPTY_NUDGE_STATE,
  normalizePhone,
  type NudgeProfileFacts,
  type NudgeState,
} from '../lib/profileNudge'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

/**
 * I/O for the in-feed "complete your profile" nudge.
 *
 * A NEW file on purpose: no existing service signature or return shape is
 * touched by this feature. Throws on error, like every other service here —
 * ProfileNudgeCard.tsx catches and owns the toasts (see CLAUDE.md's service
 * layer contract; no toast may live in this file).
 *
 * ── The PII constraint, verified live 2026-09-07 ────────────────────────────
 * `members.email` and `members.phone` are locked down at the COLUMN level.
 * Verified against the live database, not against a migration file:
 *
 *   grantee=authenticated  SELECT : every column EXCEPT email, phone
 *   grantee=authenticated  UPDATE : every column EXCEPT email  (phone IS here)
 *   table-level SELECT/UPDATE for anon + authenticated: none at all
 *
 * So a signed-in member may WRITE their own phone (RLS "Users can update own
 * member row" gates it to their own row) but may not SELECT it — not even
 * their own. Reading it back is only possible through `get_own_member()`, the
 * SECURITY DEFINER RPC, which is `select * from members where auth_uid =
 * auth.uid()` and therefore returns every column, including any column added
 * later, to the owner of the row and to nobody else.
 *
 * This file NEVER widens that. It selects no PII column by name, adds no
 * grant, and reads phone/guardian_phone through that RPC only.
 *
 * Because table-level grants are empty, a newly added column starts with NO
 * privileges for `authenticated` — closed by default. That is why the
 * companion migration (`scripts/member_guardian_phone_2026_09_07.sql`) has to
 * grant UPDATE on `guardian_phone` explicitly, and deliberately does not
 * grant SELECT: an exact mirror of `phone`.
 */

/** Everything the card needs, in one round trip. */
export interface NudgeContext {
  memberId: number
  facts: NudgeProfileFacts
  state: NudgeState
  /**
   * VERIFIED LIVE 2026-09-10: member_guardian_phone_2026_09_07.sql IS applied.
   * `members.guardian_phone` exists with REFERENCES + UPDATE for `authenticated`
   * and deliberately NO SELECT - the same shape as `phone`, so it is writable
   * but only readable through the SECURITY DEFINER get_own_member(). The flag
   * stays as a runtime guard (a fresh database may not have it yet), but the
   * comment above used to say the migration was outstanding, which was false
   * and had already caused it to be queued for a re-run.
   */
  hasGuardianColumn: boolean
  /**
   * Also VERIFIED LIVE 2026-09-10: the nudge-state columns exist as
   * `profile_nudge_dismiss_count` and `profile_nudge_snoozed_until`, both with
   * SELECT + UPDATE for `authenticated` (i.e. they escaped this table's
   * new-column-has-no-grants trap correctly).
   */
  hasStateColumns: boolean
}

const LS_PREFIX = 'aq_profile_nudge_v1_'

/**
 * Per-device fallback for the snooze, used only while the migration is
 * unapplied. It does NOT survive a device change — the DB columns are what
 * make that work — but it stops the card nagging on this device in the
 * meantime, which is strictly better than nothing.
 */
function readLocalState(memberUuid: string): NudgeState {
  try {
    const raw = localStorage.getItem(LS_PREFIX + memberUuid)
    if (!raw) return EMPTY_NUDGE_STATE
    const parsed = JSON.parse(raw)
    if (typeof parsed?.dismissCount !== 'number') return EMPTY_NUDGE_STATE
    return {
      dismissCount: parsed.dismissCount,
      snoozedUntil: typeof parsed.snoozedUntil === 'string' ? parsed.snoozedUntil : null,
    }
  } catch {
    return EMPTY_NUDGE_STATE
  }
}

function writeLocalState(memberUuid: string, state: NudgeState) {
  try {
    localStorage.setItem(LS_PREFIX + memberUuid, JSON.stringify(state))
  } catch {
    /* private mode / quota — best-effort, same posture as the member cache */
  }
}

const profileNudgeServiceImpl = {
  /**
   * One RPC call. `get_own_member()` returns `select *`, so feature-detection
   * is just "is the key present on the row?" — no extra probe query, and no
   * crash if the migration has not been run.
   */
  async getContext(): Promise<NudgeContext> {
    const { data, error } = await supabaseCommunity
      .rpc('get_own_member' as never)
      .single()
    if (error) throw logSupabaseError('profileNudgeService.getContext', error)
    if (!data) throw new Error('Member profile not found')
    const m = data as Record<string, unknown>

    const hasGuardianColumn = 'guardian_phone' in m
    const hasStateColumns =
      'profile_nudge_dismiss_count' in m && 'profile_nudge_snoozed_until' in m

    const uuid = String(m.uuid ?? '')
    const state: NudgeState = hasStateColumns
      ? {
          dismissCount: Number(m.profile_nudge_dismiss_count ?? 0) || 0,
          snoozedUntil: (m.profile_nudge_snoozed_until as string | null) ?? null,
        }
      : readLocalState(uuid)

    return {
      memberId: Number(m.member_id),
      hasGuardianColumn,
      hasStateColumns,
      state,
      facts: {
        avatarUrl: (m.avatar_url as string | null) ?? null,
        classGrade: (m.class_grade as string | null) ?? null,
        phone: (m.phone as string | null) ?? null,
        // undefined (not null) when the column is absent, so the checklist
        // can tell "no guardian number" apart from "cannot know".
        guardianPhone: hasGuardianColumn ? ((m.guardian_phone as string | null) ?? null) : undefined,
        schoolId: (m.school_id as number | null) ?? null,
        bio: (m.bio as string | null) ?? null,
      },
    }
  },

  /**
   * Persist the snooze/retire state. Writes to the members row when the
   * columns exist (so it follows the member to a new device), otherwise to
   * this device's localStorage.
   *
   * `memberUuid` is only used for the localStorage key; the DB write is
   * scoped by member_id under the member's own-row UPDATE policy.
   */
  async saveState(ctx: Pick<NudgeContext, 'memberId' | 'hasStateColumns'>, memberUuid: string, state: NudgeState) {
    if (!ctx.hasStateColumns) {
      writeLocalState(memberUuid, state)
      return
    }
    const { error } = await supabaseCommunity
      .from('members')
      .update({
        profile_nudge_dismiss_count: state.dismissCount,
        profile_nudge_snoozed_until: state.snoozedUntil,
      } as never)
      .eq('member_id', ctx.memberId)
    if (error) throw logSupabaseError('profileNudgeService.saveState', error)
    // Mirror locally too: if the member signs in on a device before the row
    // refreshes, the card still behaves.
    writeLocalState(memberUuid, state)
  },

  /**
   * Save a contact number.
   *
   * The two numbers are separate arguments writing to separate columns and
   * are never interchangeable: a guardian's number in `members.phone` would
   * be a safeguarding and data-integrity problem (every downstream consumer
   * of that column believes it is the member's own). Pass `null` to clear.
   *
   * No `.select()` is chained — PostgREST's update-representation would try
   * to return `phone`, which `authenticated` has no SELECT grant on, and the
   * whole write would fail. Same reason profileService.updateProfile omits it.
   */
  async saveContactNumbers(
    ctx: Pick<NudgeContext, 'memberId' | 'hasGuardianColumn'>,
    input: { ownPhone?: string | null; guardianPhone?: string | null },
  ) {
    const patch: Record<string, string | null> = {}
    if (input.ownPhone !== undefined) {
      patch.phone = input.ownPhone === null ? null : normalizePhone(input.ownPhone)
    }
    if (input.guardianPhone !== undefined) {
      if (!ctx.hasGuardianColumn) {
        // Fail loudly rather than silently dropping a number the member
        // believes they saved. The card catches this and surfaces it.
        throw new Error(
          'guardian numbers are not switched on yet — please tell a Director, and use your own number for now.',
        )
      }
      patch.guardian_phone =
        input.guardianPhone === null ? null : normalizePhone(input.guardianPhone)
    }
    if (Object.keys(patch).length === 0) return

    const { error } = await supabaseCommunity
      .from('members')
      .update(patch as never)
      .eq('member_id', ctx.memberId)
    if (error) throw logSupabaseError('profileNudgeService.saveContactNumbers', error)
  },
}

export const profileNudgeService = withFunctionLogging('profileNudgeService', profileNudgeServiceImpl)

export default profileNudgeService
