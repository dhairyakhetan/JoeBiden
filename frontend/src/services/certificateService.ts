import { supabaseCommunity } from '../lib/supabaseCommunity'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

/**
 * certificateService - hours derivation + certificate/LoR/LoV requests
 * (handoff/16-welfare-record.md §4, the HR desk in §4/§5). Mirrors the
 * throw-on-error / `{success, data}` shape every other services/*.ts file
 * uses - components own their own toast feedback.
 */

export type DocType = 'certificate' | 'lor' | 'lov'
export type RequestStatus = 'pending' | 'issued' | 'declined'

export interface HoursSummary {
  totalHours: number
  driveCount: number
  earliestDate: string | null
  latestDate: string | null
  /** True if any counted row had neither a real checkout nor a scheduled end to fall back to - the total is a floor, not exact. */
  undercounted: boolean
}

export interface CertificateRequest {
  id: number
  memberId: number
  docType: DocType
  status: RequestStatus
  memberNote: string | null
  hoursAtRequest: number | null
  driveCountAtRequest: number | null
  dateRangeStart: string | null
  dateRangeEnd: string | null
  requestedAt: string
  decidedBy: number | null
  decidedAt: string | null
  decisionNote: string | null
  memberName?: string
}

const mapRequest = (row: any): CertificateRequest => ({
  id: row.id,
  memberId: row.member_id,
  docType: row.doc_type,
  status: row.status,
  memberNote: row.member_note,
  hoursAtRequest: row.hours_at_request != null ? Number(row.hours_at_request) : null,
  driveCountAtRequest: row.drive_count_at_request,
  dateRangeStart: row.date_range_start,
  dateRangeEnd: row.date_range_end,
  requestedAt: row.requested_at,
  decidedBy: row.decided_by,
  decidedAt: row.decided_at,
  decisionNote: row.decision_note,
  memberName: row.member?.full_name,
})

const certificateServiceImpl = {
  /**
   * Hours are "derived, like the balance" (§4) - never stored. Sums
   * checkout-checkin across here/left rows, falling back to the drive's own
   * scheduled duration when a personal checkout is missing - same rule
   * DriveWrap.tsx uses per-drive, generalized here to one member across all
   * their drives. Requires the drive_attendance SELECT policy's
   * member_id=self branch (welfare_check_in_2026_08_31.sql).
   */
  async getHoursSummary(memberId: number): Promise<HoursSummary> {
    const { data, error } = await (supabaseCommunity as any)
      .from('drive_attendance')
      .select('checked_in_at, checked_out_at, status, drive:welfare_projects(id, header, workshop_date, scheduled_end)')
      .eq('member_id', memberId)
      .in('status', ['here', 'left'])
    if (error) throw logSupabaseError('certificateService.getHoursSummary', error)

    let totalMs = 0
    let undercounted = false
    const driveIds = new Set<number>()
    let earliest: string | null = null
    let latest: string | null = null

    for (const row of data || []) {
      const drive = row.drive
      if (drive?.id != null) driveIds.add(drive.id)
      const day = drive?.workshop_date ? drive.workshop_date.slice(0, 10) : null
      if (day && (!earliest || day < earliest)) earliest = day
      if (day && (!latest || day > latest)) latest = day

      const checkedIn = row.checked_in_at ? new Date(row.checked_in_at).getTime() : null
      const checkedOut = row.checked_out_at ? new Date(row.checked_out_at).getTime() : null
      if (checkedIn != null && checkedOut != null && checkedOut > checkedIn) {
        totalMs += checkedOut - checkedIn
        continue
      }
      const start = drive?.workshop_date ? new Date(drive.workshop_date).getTime() : null
      const end = drive?.scheduled_end ? new Date(drive.scheduled_end).getTime() : null
      if (start != null && end != null && end > start) totalMs += end - start
      else undercounted = true
    }

    return {
      totalHours: Math.round((totalMs / 3600000) * 10) / 10,
      driveCount: driveIds.size,
      earliestDate: earliest,
      latestDate: latest,
      undercounted,
    }
  },

  /**
   * Member-initiated request. The hours/drive-count/date-range snapshot is
   * stamped by the DATABASE, not by this call (handoff/16 §4 still holds; only
   * who computes it has changed).
   *
   * It used to be computed here and posted with the insert. There is no API
   * server in this app, so that payload is the requester's own code - verified
   * live that an ordinary member could insert
   * `{hours_at_request: 500, drive_count_at_request: 60, status: 'issued'}`
   * against themselves and have it stored, which the HR desk would then read
   * and sign a Letter of Volunteering from. A BEFORE INSERT trigger
   * (certificate_request_derive_snapshot) now recomputes all four columns from
   * drive_attendance and discards whatever arrives, and the INSERT policy
   * refuses any status but 'pending'.
   *
   * So this sends neither: `.select('*')` reads back what the database
   * actually stamped, which is the only number anyone should act on.
   */
  async requestDocument(memberId: number, docType: DocType, memberNote?: string) {
    const { data, error } = await (supabaseCommunity as any)
      .from('certificate_requests')
      .insert({
        member_id: memberId,
        doc_type: docType,
        member_note: memberNote?.trim() || null,
      })
      .select('*')
      .single()
    if (error) throw logSupabaseError('certificateService.requestDocument', error)
    return { success: true, data: mapRequest(data) }
  },

  /** Own requests, most recent first - for the profile's request history. */
  async getOwnRequests(memberId: number) {
    const { data, error } = await (supabaseCommunity as any)
      .from('certificate_requests')
      .select('*')
      .eq('member_id', memberId)
      .order('requested_at', { ascending: false })
    if (error) throw logSupabaseError('certificateService.getOwnRequests', error)
    return { success: true, data: (data || []).map(mapRequest) }
  },

  /** The HR desk queue (handoff/16 §4/§5) - every request, most recent first. RLS scopes this to director/super_admin automatically. */
  async listAll() {
    const { data, error } = await (supabaseCommunity as any)
      .from('certificate_requests')
      // certificate_requests has two FKs into members (member_id, decided_by),
      // so the embed must name the constraint explicitly - PostgREST can't
      // infer which relationship "members(...)" means and 400s with
      // "more than one relationship was found" otherwise.
      .select('*, member:members!certificate_requests_member_id_fkey(full_name)')
      .order('requested_at', { ascending: false })
    if (error) throw logSupabaseError('certificateService.listAll', error)
    return { success: true, data: (data || []).map(mapRequest) }
  },

  /** Issue or decline (handoff/16 §4: "exactly like every other desk in handoff/07"). */
  async decide(id: number, status: 'issued' | 'declined', decisionNote?: string, decidedBy?: number) {
    const { data, error } = await (supabaseCommunity as any)
      .from('certificate_requests')
      .update({ status, decision_note: decisionNote?.trim() || null, decided_by: decidedBy ?? null, decided_at: new Date().toISOString() })
      .eq('id', id)
      // certificate_requests has two FKs into members (member_id, decided_by),
      // so the embed must name the constraint explicitly - PostgREST can't
      // infer which relationship "members(...)" means and 400s with
      // "more than one relationship was found" otherwise.
      .select('*, member:members!certificate_requests_member_id_fkey(full_name)')
      .single()
    if (error) throw logSupabaseError('certificateService.decide', error)
    return { success: true, data: mapRequest(data) }
  },
}

export const certificateService = withFunctionLogging('certificateService', certificateServiceImpl)

export default certificateService
