import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

/**
 * attendanceService - the welfare check-in sheet (handoff/16-welfare-record.md
 * §2), step 1 of that spec's own build order. Backs `drive_attendance` and
 * welfare_projects' new scheduling/lead columns - see
 * scripts/welfare_check_in_2026_08_31.sql for the schema + the two product
 * decisions confirmed with the user before writing it (same-lead-does-both
 * authorization, welfare_projects-as-drive modeling).
 *
 * `expected`/`no_show` exist in the schema's status CHECK constraint (they're
 * part of the spec's stated roster vocabulary) but this v1 UI never writes
 * them: there is no pre-existing signup/RSVP system anywhere in this schema
 * to source a pre-seeded "who's expected" list from, so the sheet is
 * add-as-you-go instead - search a real AQ member and tap to mark them
 * `here` directly, or `+ add someone` for an unregistered walk-up. Those two
 * states are left in place for a future signup-system pass to use, not
 * removed from the type/schema.
 *
 * Mirrors the throw-on-error / `{success, data}` shape every other
 * services/*.ts file uses - components own their own toast feedback.
 */

export type AttendanceStatus = 'expected' | 'here' | 'left' | 'no_show' | 'walk_up'

export interface AttendanceRow {
  id: number
  welfareProjectId: number
  memberId: number | null
  walkupName: string | null
  status: AttendanceStatus
  checkedInAt: string | null
  checkedOutAt: string | null
  consentSigned: boolean
  updatedAt: string
  // Joined for display only - present when memberId is set.
  memberName?: string
  memberAvatarUrl?: string | null
}

export interface DriveInfo {
  id: number
  header: string
  location: string | null
  workshopDate: string | null
  scheduledEnd: string | null
  driveLeadMemberId: number | null
  attendanceCompletedAt: string | null
  // Present only from getDrive() (joined in below) - listDrives already
  // returned this separately before ProjectManager needed the same lookup
  // for a single drive, so getDrive picked up the same join rather than
  // ProjectModal doing a second round-trip to name the assigned lead.
  leadName?: string
}

const mapAttendance = (row: any): AttendanceRow => ({
  id: row.id,
  welfareProjectId: row.welfare_project_id,
  memberId: row.member_id,
  walkupName: row.walkup_name,
  status: row.status,
  checkedInAt: row.checked_in_at,
  checkedOutAt: row.checked_out_at,
  consentSigned: row.consent_signed,
  updatedAt: row.updated_at,
  memberName: row.member?.full_name,
  memberAvatarUrl: row.member?.avatar_url ?? null,
})

const mapDrive = (row: any): DriveInfo => ({
  id: row.id,
  header: row.header,
  location: row.location,
  workshopDate: row.workshop_date,
  scheduledEnd: row.scheduled_end,
  driveLeadMemberId: row.drive_lead_member_id,
  attendanceCompletedAt: row.attendance_completed_at,
})

const attendanceServiceImpl = {
  async getCurrentMemberId() {
    const id = await getCachedMemberId()
    if (id == null) throw new Error('Not authenticated')
    return id
  },

  /** The drive's own record - title, schedule, who's the assigned lead, whether it's already been completed/paid out. */
  async getDrive(welfareProjectId: number) {
    const { data, error } = await (supabaseCommunity as any)
      .from('welfare_projects')
      .select('id, header, location, workshop_date, scheduled_end, drive_lead_member_id, attendance_completed_at, lead:members!welfare_projects_drive_lead_member_id_fkey(full_name)')
      .eq('id', welfareProjectId)
      .single()
    if (error) throw logSupabaseError('attendanceService.getDrive', error)
    return { success: true, data: { ...mapDrive(data), leadName: data.lead?.full_name as string | undefined } }
  },

  /** Full roster for one drive, most-recently-touched first. */
  async getRoster(welfareProjectId: number) {
    // drive_attendance has two FKs into members (member_id, updated_by), so
    // every embed below names the constraint explicitly - PostgREST can't
    // infer which relationship "members(...)" means and 400s with "more
    // than one relationship was found" otherwise.
    const { data, error } = await (supabaseCommunity as any)
      .from('drive_attendance')
      .select('*, member:members!drive_attendance_member_id_fkey(full_name, avatar_url)')
      .eq('welfare_project_id', welfareProjectId)
      .order('updated_at', { ascending: false })
    if (error) throw logSupabaseError('attendanceService.getRoster', error)
    return { success: true, data: (data || []).map(mapAttendance) }
  },

  /** Search AQ members to add to the roster - reuses the same member search every other desk search uses. */
  async searchMembers(query: string) {
    const { data, error } = await supabaseCommunity
      .from('members')
      .select('member_id, full_name, avatar_url')
      .ilike('full_name', `%${query}%`)
      .eq('status', 'active')
      .limit(15)
    if (error) throw logSupabaseError('attendanceService.searchMembers', error)
    return { success: true, data: (data || []) as { member_id: number; full_name: string; avatar_url: string | null }[] }
  },

  /**
   * One tap per person (handoff/16 §2 rule 1) - upsert this member's roster
   * row to `here`, stamping checked_in_at. `onConflict` targets the partial
   * unique index (welfare_project_id, member_id) so re-tapping the same
   * person (e.g. a queued offline retry landing twice) never duplicates a row.
   */
  /**
   * `checkedInAt` is the moment the lead TAPPED, not the moment this ran.
   *
   * The offline queue (lib/checkinQueue.ts) exists because the venue network
   * dies - it stores its own `checkedInAt` for exactly this reason - and the
   * flush handler passed only the ids, so every queued row was written with
   * the SYNC time. Thirty people checked in at 10:00 with no signal and synced
   * at 16:00 all got 16:00, and hours are derived from checked_in_at, so the
   * whole morning vanished from their volunteer record. Defaults to now for
   * the ordinary online tap, which is unchanged.
   */
  async checkIn(welfareProjectId: number, memberId: number, checkedInAt?: string) {
    const myId = await this.getCurrentMemberId()
    const { data, error } = await (supabaseCommunity as any)
      .from('drive_attendance')
      .upsert(
        {
          welfare_project_id: welfareProjectId,
          member_id: memberId,
          status: 'here',
          checked_in_at: checkedInAt || new Date().toISOString(),
          updated_by: myId,
        },
        { onConflict: 'welfare_project_id,member_id' }
      )
      .select('*, member:members!drive_attendance_member_id_fkey(full_name, avatar_url)')
      .single()
    if (error) throw logSupabaseError('attendanceService.checkIn', error)
    return { success: true, data: mapAttendance(data) }
  },

  /** Check-out is optional (handoff/16 §2 rule 3) - stamps checked_out_at and flips status to `left`. */
  async checkOut(rowId: number) {
    const myId = await this.getCurrentMemberId()
    const { data, error } = await (supabaseCommunity as any)
      .from('drive_attendance')
      .update({ status: 'left', checked_out_at: new Date().toISOString(), updated_by: myId })
      .eq('id', rowId)
      .select('*, member:members!drive_attendance_member_id_fkey(full_name, avatar_url)')
      .single()
    if (error) throw logSupabaseError('attendanceService.checkOut', error)
    return { success: true, data: mapAttendance(data) }
  },

  /** A walk-up is one tap too (handoff/16 §2 rule 5) - name only, no member row. */
  async addWalkup(welfareProjectId: number, name: string, checkedInAt?: string) {
    const myId = await this.getCurrentMemberId()
    const { data, error } = await (supabaseCommunity as any)
      .from('drive_attendance')
      .insert({
        welfare_project_id: welfareProjectId,
        walkup_name: name.trim(),
        status: 'walk_up',
        // Same as checkIn above: a queued walk-up carries the tap time.
        checked_in_at: checkedInAt || new Date().toISOString(),
        updated_by: myId,
      })
      .select('*, member:members!drive_attendance_member_id_fkey(full_name, avatar_url)')
      .single()
    if (error) throw logSupabaseError('attendanceService.addWalkup', error)
    return { success: true, data: mapAttendance(data) }
  },

  /** The consent tick (handoff/16 §2 rule 4) - "the only moment it is obtainable." */
  async setConsent(rowId: number, signed: boolean) {
    const myId = await this.getCurrentMemberId()
    const { data, error } = await (supabaseCommunity as any)
      .from('drive_attendance')
      .update({ consent_signed: signed, updated_by: myId })
      .eq('id', rowId)
      .select('*, member:members!drive_attendance_member_id_fkey(full_name, avatar_url)')
      .single()
    if (error) throw logSupabaseError('attendanceService.setConsent', error)
    return { success: true, data: mapAttendance(data) }
  },

  /**
   * Marks the drive complete and pays out points (handoff/16 §3: earned once,
   * on completion, not on check-in). SECURITY DEFINER RPC - see
   * scripts/welfare_check_in_2026_08_31.sql for the authorization rule
   * (assigned lead, director, or super admin only) and idempotency
   * (already-completed is a safe no-op, not an error).
   */
  /**
   * `/director/drives` desk (handoff/16 §2 Screens) - "which drives have
   * attendance, which are still on paper." Most recent first, capped at 100
   * since this is a triage list, not a full archive browser (see
   * `/projects` for the full welfare_projects catalog).
   */
  async listDrives() {
    const { data, error } = await (supabaseCommunity as any)
      .from('welfare_projects')
      .select('id, header, location, workshop_date, drive_lead_member_id, attendance_completed_at, lead:members!welfare_projects_drive_lead_member_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw logSupabaseError('attendanceService.listDrives', error)
    return {
      success: true,
      data: (data || []).map((row: any) => ({
        ...mapDrive(row),
        leadName: row.lead?.full_name as string | undefined,
      })),
    }
  },

  /** Assign (or clear, with `null`) who runs check-in for this drive. Gated by welfare_projects' own director/super_admin UPDATE RLS. */
  async assignLead(welfareProjectId: number, memberId: number | null) {
    const { error } = await (supabaseCommunity as any)
      .from('welfare_projects')
      .update({ drive_lead_member_id: memberId })
      .eq('id', welfareProjectId)
    if (error) throw logSupabaseError('attendanceService.assignLead', error)
    return { success: true }
  },

  async completeDrive(welfareProjectId: number) {
    const { data, error } = await supabaseCommunity
      .rpc('complete_drive_attendance' as never, { p_welfare_project_id: welfareProjectId } as never)
      .single()
    if (error) throw logSupabaseError('attendanceService.completeDrive', error)
    return { success: true, data: data as unknown as { attendees_paid: number; already_completed: boolean } }
  },

  /** The linked post's current stats (for pre-filling the drive-wrap form) - `null` if there's no linked post yet. */
  async getDriveLinkedPostStats(welfareProjectId: number) {
    const { data, error } = await (supabaseCommunity as any)
      .from('welfare_projects')
      .select('linked_post_id, post:posts!welfare_projects_linked_post_id_fkey(stats)')
      .eq('id', welfareProjectId)
      .single()
    if (error) throw logSupabaseError('attendanceService.getDriveLinkedPostStats', error)
    return { success: true, data: (data?.post?.stats as { value: string; label: string }[] | null) ?? null }
  },

  /**
   * Drive wrap (handoff/16 §2 Screens) - overwrites the linked post's stats
   * with real, roster-backed outcome numbers. SECURITY DEFINER RPC - see
   * scripts/welfare_drive_wrap_2026_08_31.sql for why a plain client update
   * can't do this (the mirrored post is authored by a system account, not
   * the lead).
   */
  async updateDriveStats(welfareProjectId: number, stats: { value: string; label: string }[]) {
    const { error } = await supabaseCommunity
      .rpc('update_drive_post_stats' as never, { p_welfare_project_id: welfareProjectId, p_stats: stats } as never)
    if (error) throw logSupabaseError('attendanceService.updateDriveStats', error)
    return { success: true }
  },
}

export const attendanceService = withFunctionLogging('attendanceService', attendanceServiceImpl)

export default attendanceService
