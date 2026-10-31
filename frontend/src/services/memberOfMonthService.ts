import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import { hasLeaderAccess, isSuperAdmin } from '../lib/roles'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'
import { latestPeriodPerTeam } from './momPicks'

// ─────────────────────────────────────────────────────────────────────────────
// memberOfMonthService — FR11, "member of the month," rebuilt for per-team
// picks (frontend/scripts/member_of_the_month_team_scoping_2026_09_05.sql).
//
// Table: public.member_of_the_month
//   period date · team_id → teams · UNIQUE(period, team_id, member_id) — a team
//   may honour SEVERAL members in a month (owner decision 2026-10-03, was one
//   per team: frontend/scripts/mom_multiple_per_team_2026_10_03.sql), but never
//   the same member twice. Nothing else in the schema or RLS assumed one.
//   member_id → members · citation text? · photo_url text? (the winner's own
//   upload) · photo_uploaded_at · picked_by → members · created_at · updated_at
//
// Table: public.member_of_the_month_periods — "is this month open for HOD
// picking yet." period date primary key · is_open bool · opened_at/by ·
// closed_at/by.
//
// RLS does the real gating, not this file:
//   · super_admin/hr (is_super_admin()) can write a pick for ANY team, at any
//     time (they don't need the month "opened" — they're the ones who open
//     it for everyone else).
//   · a hod/director can write ONLY for a team they hold an active
//     team_members row for (any role in that row — see the migration's
//     TEAM-SCOPING DECISION for why), and only once HR/super_admin has opened
//     that month.
//   · every write also requires the picked member to actually be on that
//     team (mom_target_on_team) — a data-integrity rule, not an
//     authorization one, enforced for every picker including super_admin/hr.
//   · `anon` holds no grant at all on either table.
//   · photo_url/photo_uploaded_at can ONLY be set via the submit_mom_photo()
//     RPC (see submitPhoto below) — not a raw UPDATE, because the winner is
//     very often a plain member with no other write grant on this table.
//
// Contract, matching every other service in this folder: THESE THROW. No
// toasts in here — the calling component catches and reports.
// ─────────────────────────────────────────────────────────────────────────────

export interface MemberOfMonthPick {
  id: number
  /** ISO date, always the first of the month, e.g. "2026-09-01". */
  period: string
  teamId: number
  teamUuid: string
  teamName: string
  teamCategory: string
  memberId: number
  memberUuid: string
  memberName: string
  memberAvatarUrl: string | null
  citation: string | null
  pickedById: number | null
  pickedByName: string | null
  /** Set once the winner has uploaded their own photo — null until then. */
  photoUrl: string | null
  photoUploadedAt: string | null
  createdAt: string
}

/** A member as offered in the desk's picker. No email, no phone — see below. */
export interface PickCandidate {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl: string | null
  classGrade: string | null
}

/** A team the current signed-in leader is allowed to pick a winner for. */
export interface PickableTeam {
  teamId: number
  uuid: string
  name: string
  category: string
}

export interface PeriodState {
  period: string
  isOpen: boolean
  openedAt: string | null
}

// Three FKs are involved (member_id, picked_by both -> members; team_id ->
// teams), so the two `members` embeds MUST name their constraint — PostgREST
// cannot resolve a bare `members(...)` embed when two FKs point at the same
// table. `teams` has only one FK from this table, so it embeds unambiguously.
const PICK_COLS = `
  id, period, citation, created_at, member_id, picked_by, team_id, photo_url, photo_uploaded_at,
  member:members!member_of_the_month_member_id_fkey(member_id, uuid, full_name, avatar_url),
  picker:members!member_of_the_month_picked_by_fkey(member_id, full_name),
  team:teams(team_id, uuid, name, category)
`

// `lib/database.types.ts` is a checked-in generated file and does not yet
// know about member_of_the_month / member_of_the_month_periods, so the typed
// client would reject the table names outright. Same `as any` escape hatch
// directorService already uses for `member_directory_view`; regenerating the
// whole types file is a separate, much larger change than this feature.
const db = supabaseCommunity as any

const mapPick = (r: any): MemberOfMonthPick => ({
  id: r.id,
  period: r.period,
  teamId: r.team_id,
  teamUuid: r.team?.uuid ?? '',
  teamName: r.team?.name ?? 'a team',
  teamCategory: r.team?.category ?? '',
  memberId: r.member_id,
  memberUuid: r.member?.uuid ?? '',
  memberName: r.member?.full_name ?? 'a member',
  memberAvatarUrl: r.member?.avatar_url ?? null,
  citation: r.citation ?? null,
  pickedById: r.picked_by ?? null,
  pickedByName: r.picker?.full_name ?? null,
  photoUrl: r.photo_url ?? null,
  photoUploadedAt: r.photo_uploaded_at ?? null,
  createdAt: r.created_at,
})

/**
 * The first of the current month in Asia/Kolkata, as `YYYY-MM-01`.
 *
 * Deliberately NOT `new Date().toISOString().slice(0, 7)`: that is UTC, so for
 * the first 5.5 hours of the 1st in Kolkata it still returns last month and the
 * new pick would appear late. The RLS policy uses the same timezone, so the
 * client's idea of "this month" and the database's agree.
 */
export function currentPeriod(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')?.value ?? '1970'
  const m = parts.find(p => p.type === 'month')?.value ?? '01'
  return `${y}-${m}-01`
}

/** "2026-09-01" -> "September 2026". Used on every surface, so it lives here. */
export function formatPeriod(period: string): string {
  const [y, m] = period.split('-')
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** Shift a `YYYY-MM-01` period by `months` (negative goes back). */
export function shiftPeriod(period: string, months: number): string {
  const [y, m] = period.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const ny = Math.floor(total / 12)
  const nm = total % 12
  return `${String(ny).padStart(4, '0')}-${String(nm + 1).padStart(2, '0')}-01`
}

export { latestPeriodPerTeam }

/** Build a downloadable CSV string from a list of picks — HR's export. */
export function buildMomCsv(rows: MemberOfMonthPick[]): string {
  const esc = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const header = ['Period', 'Team', 'Member', 'Citation', 'Picked by', 'Photo uploaded'].join(',')
  const lines = rows.map(r => [
    formatPeriod(r.period), r.teamName, r.memberName, r.citation ?? '',
    r.pickedByName ?? '', r.photoUrl ? 'yes' : 'no',
  ].map(esc).join(','))
  return [header, ...lines].join('\n')
}

/** Trigger a browser download of a CSV string — no library, matches
 *  posterGenerator's downloadPoster / ShareModal's QR download pattern. */
export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

const memberOfMonthServiceImpl = {
  async getCurrentMemberId() {
    const id = await getCachedMemberId()
    if (id == null) throw new Error('Not authenticated')
    return id
  },

  /**
   * Every pick from each team's most recent started month, for EACH team that
   * has ever had one. Mirrors the original single-pick getCurrent()'s own
   * fallback rule (show the latest started month even if it's not literally
   * this calendar month), repeated per team, and now keeps ALL of that
   * month's honorees rather than one. Teams with no pick yet are simply
   * absent, not padded with an empty placeholder.
   */
  async getCurrentForAllTeams(): Promise<MemberOfMonthPick[]> {
    const { data, error } = await db
      .from('member_of_the_month')
      .select(PICK_COLS)
      .lte('period', currentPeriod())
      .order('period', { ascending: false })
    if (error) throw logSupabaseError('memberOfMonthService.getCurrentForAllTeams', error)
    return latestPeriodPerTeam((data || []).map(mapPick))
  },

  /** Every pick a leader is allowed to see, newest month first (desk's "past
   *  picks" ledger — every team's history, not just the caller's own team).
   *  Default bumped from the original single-pick era's 24: a month can now
   *  hold up to one row per team (8 today), so 96 keeps roughly a year of
   *  full multi-team history on screen instead of ~3 months. The HR CSV
   *  export always pulls the full table regardless (see handleExportCsv in
   *  director/MemberOfMonth.tsx), so this default only affects the on-screen
   *  ledger. */
  async list(limit = 96): Promise<MemberOfMonthPick[]> {
    const { data, error } = await db
      .from('member_of_the_month')
      .select(PICK_COLS)
      .order('period', { ascending: false })
      .order('team_id', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(limit)
    if (error) throw logSupabaseError('memberOfMonthService.list', error)
    return (data || []).map(mapPick)
  },

  /**
   * Which teams the CURRENT signed-in leader may pick a winner for.
   * super_admin/hr get every active team; a hod/director gets only the
   * team(s) they hold an active team_members row for (see the migration's
   * TEAM-SCOPING DECISION). Anyone else gets an empty list.
   */
  async getPickableTeams(): Promise<PickableTeam[]> {
    const memberId = await getCachedMemberId()
    if (!memberId) return []
    const { data: me, error: meErr } = await supabaseCommunity
      .from('members')
      .select('member_id, role, status')
      .eq('member_id', memberId)
      .single()
    if (meErr || !me) return []
    if (me.status !== 'active' || !hasLeaderAccess(me.role)) return []

    if (isSuperAdmin(me.role)) {
      const { data, error } = await supabaseCommunity
        .from('teams')
        .select('team_id, uuid, name, category')
        .eq('is_active', true)
        .order('name', { ascending: true })
      if (error) throw logSupabaseError('memberOfMonthService.getPickableTeams', error)
      return (data || []).map((t: any) => ({ teamId: t.team_id, uuid: t.uuid, name: t.name, category: t.category }))
    }

    // hod/director — team_members membership is the stand-in for "their
    // team" (see the migration header for why: it's what the one live hod
    // actually has, where team_members.role='lead' would leave him with zero).
    const { data, error } = await db
      .from('team_members')
      .select('team:teams(team_id, uuid, name, category)')
      .eq('member_id', memberId)
      .eq('is_active', true)
    if (error) throw logSupabaseError('memberOfMonthService.getPickableTeams', error)
    const seen = new Set<number>()
    const teams: PickableTeam[] = []
    for (const row of (data || [])) {
      const t = row.team
      if (!t || seen.has(t.team_id)) continue
      seen.add(t.team_id)
      teams.push({ teamId: t.team_id, uuid: t.uuid, name: t.name, category: t.category })
    }
    return teams.sort((a, b) => a.name.localeCompare(b.name))
  },

  /** Is `period` open for HOD/director picking? super_admin/hr don't need to
   *  check this themselves (RLS never gates their write on it), but the desk
   *  still shows it to them since they're the ones who flip it. */
  async getPeriodState(period: string): Promise<PeriodState | null> {
    const { data, error } = await db
      .from('member_of_the_month_periods')
      .select('period, is_open, opened_at')
      .eq('period', period)
      .maybeSingle()
    if (error) throw logSupabaseError('memberOfMonthService.getPeriodState', error)
    if (!data) return null
    return { period: data.period, isOpen: data.is_open, openedAt: data.opened_at }
  },

  /** Open a month for HOD/director picking. super_admin/hr only (RLS). */
  async openPeriod(period: string, openedBy: number): Promise<void> {
    const { data, error } = await db
      .from('member_of_the_month_periods')
      .upsert({ period, is_open: true, opened_at: new Date().toISOString(), opened_by: openedBy }, { onConflict: 'period' })
      .select('period')
    if (error) throw logSupabaseError('memberOfMonthService.openPeriod', error)
    if (!data || data.length === 0) throw new Error('Could not open this month. You may not have permission.')
  },

  /** Close a month — HODs can no longer write new picks for it (they can
   *  still clear/undo an existing one; see the migration for why delete
   *  isn't gated the same way). super_admin/hr only (RLS). */
  async closePeriod(period: string, closedBy: number): Promise<void> {
    const { data, error } = await db
      .from('member_of_the_month_periods')
      .upsert({ period, is_open: false, closed_at: new Date().toISOString(), closed_by: closedBy }, { onConflict: 'period' })
      .select('period')
    if (error) throw logSupabaseError('memberOfMonthService.closePeriod', error)
    if (!data || data.length === 0) throw new Error('Could not close this month. You may not have permission.')
  },

  /**
   * Active members of ONE team a leader can pick from — team rosters are
   * small (tens of members, never thousands), so this pulls the whole active
   * roster once and filters client-side rather than fighting PostgREST's
   * embedded-resource filter syntax for a one-off search box.
   *
   * Explicit column list, and email/phone are NOT among them — `members` is
   * under a column-level PII lockdown and this desk has no use for either.
   */
  async searchCandidates(teamId: number, search: string, limit = 8): Promise<PickCandidate[]> {
    const term = search.trim()
    if (!term) return []

    // Reverted 2026-09-13 (scripts/mom_restore_on_team_check_2026_09_13.sql):
    // item 5.4 (2026-09-11) had widened this to every active member org-wide,
    // "including people outside the team" - the owner has now reversed that,
    // having found live that a HoD could pick someone off their own team's
    // roster for that team's Member of the Month (flagged "not on this team"
    // in the UI, but the write went through anyway). The database side is
    // reverted too: `mom_target_on_team` is back in `member_of_the_month`'s
    // WITH CHECK, so this query has to agree with the policy again rather
    // than offer a candidate the write would then reject.
    //
    // Team rosters here are small (tens of members, never thousands), so this
    // reads the team's active roster once and filters by name client-side -
    // the same shape this had before 5.4 ever widened it.
    //
    // Explicit column list, and email/phone are NOT among them - `members` is
    // under a column-level PII lockdown and this desk has no use for either.
    const { data, error } = await db
      .from('team_members')
      .select('members!inner(member_id, uuid, full_name, avatar_url, class_grade, status)')
      .eq('team_id', teamId)
      .eq('is_active', true)
    if (error) throw logSupabaseError('memberOfMonthService.searchCandidates', error)

    const needle = term.toLowerCase()
    return ((data || []) as any[])
      .map(r => r.members)
      .filter(m => m && m.status === 'active' && (m.full_name || '').toLowerCase().includes(needle))
      .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
      .slice(0, limit)
      .map(m => ({
        memberId: m.member_id,
        uuid: m.uuid,
        fullName: m.full_name,
        avatarUrl: m.avatar_url ?? null,
        classGrade: m.class_grade ?? null,
      }))
  },

  /**
   * Add a pick for one team/month. A team can hold several, so this ADDS; it
   * never replaces another member's pick. Saving the same member again just
   * updates their citation (upsert on period+team+member).
   *
   * `.select()` plus a zero-row check, not a bare error check: PostgREST
   * returns NO error and zero rows when a write is denied by RLS, so a
   * non-leader (or a leader picking outside their team, or picking a member
   * not on that team, or picking before the month is open) would otherwise
   * see a success toast for a write that never happened.
   */
  async setPick(input: { period: string; teamId: number; memberId: number; citation?: string | null; pickedBy: number }): Promise<MemberOfMonthPick> {
    const citation = (input.citation || '').trim()
    const { data, error } = await db
      .from('member_of_the_month')
      .upsert({
        period: input.period,
        team_id: input.teamId,
        member_id: input.memberId,
        citation: citation ? citation : null,
        picked_by: input.pickedBy,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'period,team_id,member_id' })
      .select(PICK_COLS)
    if (error) throw logSupabaseError('memberOfMonthService.setPick', error)
    const row = (data || [])[0]
    if (!row) throw new Error("The pick wasn't saved. You may not have permission for this team, the member may not be on its roster, or this month may not be open yet.")
    return mapPick(row)
  },

  /** Remove ONE pick by id (a team may hold several in a month, so team+month
   *  no longer identifies a single row). Same zero-row guard as setPick. */
  async clearPick(pickId: number): Promise<void> {
    const { data, error } = await db
      .from('member_of_the_month')
      .delete()
      .eq('id', pickId)
      .select('id')
    if (error) throw logSupabaseError('memberOfMonthService.clearPick', error)
    if (!data || data.length === 0) throw new Error('Nothing was removed. You may not have permission to clear this pick.')
  },

  // ── Winner-facing: the photo-upload step ──────────────────────────────────

  /**
   * The current member's own not-yet-claimed pick, if any — what the profile
   * card looks for to show the "upload your photo" prompt. RLS already
   * limits what a non-leader can read here to a pick whose month has
   * started, which is also exactly when they'd have been notified (a queued
   * future pick never notifies — see director/MemberOfMonth.tsx), so this
   * naturally can't surface a pick the member hasn't been told about yet.
   */
  async getMyUnclaimedPick(memberId: number): Promise<MemberOfMonthPick | null> {
    const { data, error } = await db
      .from('member_of_the_month')
      .select(PICK_COLS)
      .eq('member_id', memberId)
      .is('photo_url', null)
      .order('period', { ascending: false })
      .limit(1)
    if (error) throw logSupabaseError('memberOfMonthService.getMyUnclaimedPick', error)
    const row = (data || [])[0]
    return row ? mapPick(row) : null
  },

  /**
   * Submit the winner's own photo. Routed through the submit_mom_photo()
   * SECURITY DEFINER RPC, not a raw UPDATE — the winner is very often a
   * plain member with no other write grant on this table at all (see the
   * migration for why RLS alone can't express "the row's subject may touch
   * only these two columns"). The RPC returns the bare row; re-fetch through
   * the normal SELECT so the caller gets the same joined shape as everywhere
   * else in this file.
   */
  async submitPhoto(pickId: number, photoUrl: string): Promise<MemberOfMonthPick> {
    const { data, error } = await (supabaseCommunity as any)
      .rpc('submit_mom_photo', { p_pick_id: pickId, p_photo_url: photoUrl })
    if (error) throw logSupabaseError('memberOfMonthService.submitPhoto', error)
    const bare = Array.isArray(data) ? data[0] : data
    if (!bare) throw new Error('The photo was not saved.')
    const { data: full, error: fullErr } = await db
      .from('member_of_the_month')
      .select(PICK_COLS)
      .eq('id', bare.id)
      .single()
    if (fullErr) throw logSupabaseError('memberOfMonthService.submitPhoto', fullErr)
    return mapPick(full)
  },
}

export const memberOfMonthService = withFunctionLogging('memberOfMonthService', memberOfMonthServiceImpl)

export default memberOfMonthService
