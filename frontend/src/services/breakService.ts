import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import { notificationService } from './notificationService'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

// Exam breaks — see scripts/member_breaks_2026_08_29.sql (applied live
// 2026-08-30). A break is NOT churn: nothing on the member's account is
// revoked. `members.break_start/break_end/break_reason` is a denormalized
// "current/most-recent break" summary for cheap display without a join;
// `member_breaks` is the full history. The app is responsible for keeping
// the two in sync — no DB trigger does it — so setBreak() writes both.
//
// Per CLAUDE.md's service-layer contract: these throw on error. Callers
// wrap in try/catch and show a toast (Feedback pattern) — this file never
// catches its own errors or calls a toast.

export type BreakReason = 'boards' | 'school exams' | 'college exams' | 'family' | 'other'

export const BREAK_REASONS: { value: BreakReason; label: string }[] = [
  { value: 'boards', label: 'boards' },
  { value: 'school exams', label: 'school exams' },
  { value: 'college exams', label: 'college exams' },
  { value: 'family', label: 'family' },
  { value: 'other', label: 'other' },
]

export interface MemberBreak {
  id: number
  memberId: number
  start: string
  end: string
  reason: BreakReason
  note: string | null
  createdAt: string
}

async function currentMemberId(): Promise<number> {
  const memberId = await getCachedMemberId()
  if (!memberId) throw new Error('Not authenticated')
  return memberId
}

/** Tell every active HR/super_admin a member just set their own break. Direct
 *  query rather than importing directorService (which pulls in the whole
 *  desk's dependency surface for a two-column lookup a plain member's own
 *  profile action has no business depending on). `role` is readable by any
 *  authenticated member - the PII lockdown only ever restricted email/phone. */
async function notifyHrOfBreak(memberId: number, data: { start: string; end: string; reason: BreakReason; note?: string }): Promise<void> {
  const [{ data: hrRows }, { data: self }] = await Promise.all([
    supabaseCommunity.from('members').select('member_id').in('role', ['hr', 'super_admin']).eq('status', 'active'),
    supabaseCommunity.from('members').select('full_name').eq('member_id', memberId).maybeSingle(),
  ])
  const name = (self as any)?.full_name || 'A member'
  for (const row of hrRows || []) {
    notificationService.create({
      memberId: (row as any).member_id,
      type: 'break_set',
      title: `${name} set a break`,
      subtitle: `${data.start} to ${data.end} - ${data.reason}${data.note ? ': ' + data.note : ''}`,
      link: '/director/members',
    })
  }
}

/** True when `breakEnd` (a `date` string) hasn't passed yet — computed
 *  client-side since there's no scheduled job to flip a status column. */
export function isCurrentlyOnBreak(breakEnd: string | null | undefined): boolean {
  if (!breakEnd) return false
  // Compare by calendar day, not instant — a break "back on" today still
  // counts as on-break for the whole of today.
  const end = new Date(breakEnd + 'T23:59:59')
  return end.getTime() >= Date.now()
}

const breakServiceImpl = {
  /** Member-initiated only — sets the current/most-recent break summary on
   *  the caller's own `members` row AND appends a row to `member_breaks`
   *  (the history). Both writes happen together. */
  async setBreak(data: { start: string; end: string; reason: BreakReason; note?: string }): Promise<void> {
    const memberId = await currentMemberId()

    const { error: memberErr } = await supabaseCommunity
      .from('members')
      .update({ break_start: data.start, break_end: data.end, break_reason: data.reason })
      .eq('member_id', memberId)
    if (memberErr) throw logSupabaseError('breakService.setBreak', memberErr)

    const { error: historyErr } = await supabaseCommunity
      .from('member_breaks')
      .insert({
        member_id: memberId,
        start: data.start,
        end: data.end,
        reason: data.reason,
        note: data.note?.trim() || null,
      })
    if (historyErr) throw logSupabaseError('breakService.setBreak', historyErr)

    // "your leads will see this" (BREAK_REASSURANCE) used to mean only
    // "visible if someone happens to open your profile" - no one was
    // actually told. Owner asked for a real message to HR, so this fires
    // one now. Best-effort: notificationService.create is fire-and-forget
    // and non-throwing by design, and a member's break must never fail to
    // save because HR's notification couldn't be looked up.
    notifyHrOfBreak(memberId, data).catch(() => {})
  },

  /**
   * HR/super_admin-initiated - sets someone ELSE's break. Routes through
   * hr_set_member_break() (SECURITY DEFINER) rather than a plain
   * insert/update: member_breaks_insert_own restricts INSERT to
   * `member_id = get_current_member_id()`, so a director/HR cannot write
   * another member's history row directly - only this RPC can.
   */
  async setMemberBreak(memberId: number, data: { start: string; end: string; reason: BreakReason; note?: string }): Promise<void> {
    const { error } = await supabaseCommunity.rpc('hr_set_member_break' as never, {
      p_member_id: memberId,
      p_start: data.start,
      p_end: data.end,
      p_reason: data.reason,
      p_note: data.note?.trim() || null,
    } as never)
    if (error) throw logSupabaseError('breakService.setMemberBreak', error)
    notificationService.create({
      memberId,
      type: 'system',
      title: 'HR set a break on your account',
      subtitle: `${data.start} to ${data.end}${data.note ? ' - ' + data.note : ''}`,
      link: '/profile/me',
    })
  },

  /** "come back early" — member-initiated only, clears the current-break
   *  summary. Never callable on behalf of another member (no memberId param;
   *  always the caller's own row, matching the RLS own-row UPDATE policy). */
  async endBreakEarly(): Promise<void> {
    const memberId = await currentMemberId()
    const { error } = await supabaseCommunity
      .from('members')
      .update({ break_start: null, break_end: null, break_reason: null })
      .eq('member_id', memberId)
    if (error) throw logSupabaseError('breakService.endBreakEarly', error)
  },

  /** The caller's own break history (member_breaks), most recent first. */
  async getMyBreakHistory(): Promise<MemberBreak[]> {
    const memberId = await currentMemberId()
    const { data, error } = await supabaseCommunity
      .from('member_breaks')
      .select('*')
      .eq('member_id', memberId)
      .order('start', { ascending: false })
    if (error) throw logSupabaseError('breakService.getMyBreakHistory', error)
    return (data || []).map((r: any) => ({
      id: r.id,
      memberId: r.member_id,
      start: r.start,
      end: r.end,
      reason: r.reason as BreakReason,
      note: r.note,
      createdAt: r.created_at,
    }))
  },
}

export const breakService = withFunctionLogging('breakService', breakServiceImpl)

export default breakService
