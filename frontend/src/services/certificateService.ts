import { supabaseCommunity } from '../lib/supabaseCommunity'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'
import { logAction } from '../lib/auditLog'
import notificationService from './notificationService'
import {
  applicationRpcArgs, certificateLink,
  type ApplicationInput, type CertResponse, type CertTypeInfo, type DeskDoc, type DraftSource, type OrgSubTeam, type OrgTeam, type TeamTag,
} from '../certificates/certificateLogic'

/**
 * certificateService - hours derivation, the certificate pipeline (a member
 * applies, tagged HoDs vouch, a draft is written, HR decides), and the desk.
 * Mirrors the throw-on-error / `{success, data}` shape every other
 * services/*.ts file uses - components own their own toast feedback.
 *
 * Every write goes through a SECURITY DEFINER function
 * (scripts/certificate_pipeline_2026_11_20.sql): the database, not this file,
 * decides who may do what. HR's decision is the one direct UPDATE, and a
 * database trigger stamps who decided and refuses an own-request decision.
 */

/** A document type key. The kinds on offer are rows in certificate_types, not a union here. */
export type DocType = string
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
  /** What the member said they worked, at least. Unverified: always a claim. */
  claimedMinHours: number | null
  /** The months the member says they were with AQ, as the first of each month ("YYYY-MM-DD"). A claim. */
  periodStart: string | null
  periodEnd: string | null
  /** Assigned by the database when HR issues. Printed on the document, checked at /verify. */
  verifyCode: string | null
  submissionId: string | null
  /** The database-derived figure from attendance. 0 means no attendance on record. */
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
  claimedMinHours: row.claimed_min_hours != null ? Number(row.claimed_min_hours) : null,
  periodStart: row.period_start ?? null,
  periodEnd: row.period_end ?? null,
  verifyCode: row.verify_code ?? null,
  submissionId: row.submission_id ?? null,
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

const mapType = (r: any): CertTypeInfo => ({
  key: r.key,
  label: r.label,
  blurb: r.blurb,
  kind: r.kind === 'certificate' ? 'certificate' : 'letter',
  layout: r.layout === 'landscape' ? 'landscape' : 'portrait',
  needsHod: !!r.needs_hod,
  structured: !!r.structured,
  routineDrafts: r.routine_drafts !== false,
  hasStandardWording: !!r.has_standard_wording,
  sampleImageUrl: r.sample_image_url ?? null,
  displayOrder: r.display_order ?? 0,
})

/** Thrown by decide() when the request is no longer pending (another tab or HR got there first). */
export class AlreadyDecidedError extends Error {
  readonly code = 'ALREADY_DECIDED'
  constructor() { super('Someone has already decided this request. The list has been refreshed.') }
}

const FALLBACK_NAME: Record<string, string> = {
  cert_recognition: 'certificate of recognition', cert_internship: 'certificate of internship', lor: 'letter of recommendation',
  letter_recognition: 'letter of recognition', letter_internship: 'letter of internship', letter_acceptance: 'letter of acceptance', letter_offer: 'offer letter',
}

/** Plain-language notice for the requester after a decision. `label` is the type's own label when the caller has it. */
export function decisionNotice(docType: DocType, status: 'issued' | 'declined', note?: string | null, label?: string | null) {
  const doc = (label || FALLBACK_NAME[docType] || 'certificate').toLowerCase()
  if (status === 'issued') {
    return { title: `Your ${doc} is ready`, subtitle: 'The team has approved your request. Open it from your certificates page to download it.', fullNote: note?.trim() || undefined }
  }
  return { title: `Your ${doc} request was declined`, subtitle: note?.trim() ? `Reason: ${note.trim()}` : 'Ask HR if you would like to know more.', fullNote: note?.trim() || undefined }
}

let typesCache: Promise<CertTypeInfo[]> | null = null

const certificateServiceImpl = {
  /** Count of requests waiting for a decision. Kept for callers that only need the number. */
  async getPendingCount(): Promise<number> {
    const { count, error } = await (supabaseCommunity as any)
      .from('certificate_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
    if (error) throw logSupabaseError('certificateService.getPendingCount', error)
    return count ?? 0
  },

  /**
   * Badge numbers for the desk. `awaitingMyResponse` is the one a HoD acts on
   * (tagged, not yet answered); `pendingTotal` is HR's queue; `awaitingDraft`
   * is how many are waiting for the drafting routine.
   */
  async deskCounts(): Promise<{ pendingTotal: number; awaitingMyResponse: number; awaitingDraft: number }> {
    const { data, error } = await (supabaseCommunity as any).rpc('certificate_desk_counts')
    if (error) throw logSupabaseError('certificateService.deskCounts', error)
    const row = Array.isArray(data) ? data[0] : data
    return {
      pendingTotal: row?.pending_total ?? 0,
      awaitingMyResponse: row?.awaiting_my_response ?? 0,
      awaitingDraft: row?.awaiting_draft ?? 0,
    }
  },

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

  // ── What a member can ask for ─────────────────────────────────────────────

  /** The documents on offer, in display order. Cached for the page's life: the rows change by hand, rarely. */
  async listTypes(): Promise<CertTypeInfo[]> {
    if (!typesCache) {
      typesCache = (async () => {
        const { data, error } = await (supabaseCommunity as any)
          .from('certificate_types')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
        if (error) throw logSupabaseError('certificateService.listTypes', error)
        return (data || []).map(mapType)
      })()
      typesCache.catch(() => { typesCache = null })
    }
    return typesCache
  },

  /** Every team and sub-team, retired ones included: alumni ask for letters too. */
  async listOrg(): Promise<{ teams: OrgTeam[]; subTeams: OrgSubTeam[] }> {
    const sb = supabaseCommunity as any
    const [t, s] = await Promise.all([
      sb.from('teams').select('team_id, name, parent_team_id, is_active'),
      sb.from('sub_teams').select('sub_team_id, team_id, name, is_active'),
    ])
    if (t.error) throw logSupabaseError('certificateService.listOrg.teams', t.error)
    if (s.error) throw logSupabaseError('certificateService.listOrg.subTeams', s.error)
    return {
      teams: (t.data || []).map((r: any) => ({ teamId: r.team_id, name: r.name, parentTeamId: r.parent_team_id ?? null, isActive: r.is_active !== false })),
      subTeams: (s.data || []).map((r: any) => ({ subTeamId: r.sub_team_id, teamId: r.team_id, name: r.name, isActive: r.is_active !== false })),
    }
  },

  /** Active HoDs and Directors the member may tag, with the teams each sits on so the right one is easy to pick. */
  async hodOptions(): Promise<{ memberId: number; name: string; avatarUrl: string | null; role: string; teamNames: string[] }[]> {
    const { data, error } = await (supabaseCommunity as any).rpc('certificate_hod_options')
    if (error) throw logSupabaseError('certificateService.hodOptions', error)
    return (data || []).map((r: any) => ({
      memberId: r.member_id, name: r.full_name, avatarUrl: r.avatar_url ?? null, role: r.role, teamNames: r.team_names ?? [],
    }))
  },

  /**
   * The member's one way in. The database validates every field again and
   * stamps the verified-hours snapshot itself, so nothing typed here can mark a
   * request issued or set what attendance says.
   */
  async submit(input: ApplicationInput) {
    const { data, error } = await (supabaseCommunity as any).rpc('submit_certificate_requests', applicationRpcArgs(input))
    if (error) throw logSupabaseError('certificateService.submit', error)
    const rows = (data || []) as { request_id: number; request_doc_type: string }[]
    return { success: true, data: rows.map(r => ({ id: r.request_id, docType: r.request_doc_type })) }
  },

  /** Own requests, most recent first. */
  async getOwnRequests(memberId: number) {
    const [{ data, error }, types] = await Promise.all([
      (supabaseCommunity as any).from('certificate_requests').select('*').eq('member_id', memberId).order('requested_at', { ascending: false }),
      this.listTypes().catch(() => [] as CertTypeInfo[]),
    ])
    if (error) throw logSupabaseError('certificateService.getOwnRequests', error)
    const label = new Map(types.map(t => [t.key, t.label]))
    return { success: true, data: (data || []).map((r: any) => ({ ...mapRequest(r), typeLabel: label.get(r.doc_type) ?? r.doc_type })) as (CertificateRequest & { typeLabel: string })[] }
  },

  /**
   * One document and its text, for the view/download page. RLS decides: the
   * owner gets the text only after it is issued, a leader always, anyone else
   * gets null. A missing row and a refused row look the same on purpose.
   */
  async getOne(id: number) {
    const sb = supabaseCommunity as any
    const { data: row, error } = await sb.from('certificate_requests').select('*').eq('id', id).maybeSingle()
    if (error) throw logSupabaseError('certificateService.getOne', error)
    if (!row) return null
    const [draft, who, tags, types, org] = await Promise.all([
      sb.from('certificate_drafts').select('body, source').eq('request_id', id).maybeSingle(),
      sb.from('members').select('full_name').eq('member_id', row.member_id).maybeSingle(),
      sb.from('certificate_request_teams').select('team_id, sub_team_id').eq('request_id', id),
      this.listTypes(),
      this.listOrg(),
    ])
    const type = types.find(t => t.key === row.doc_type) ?? null
    return {
      request: { ...mapRequest(row), memberName: who.data?.full_name as string | undefined },
      draft: draft.data ? { body: draft.data.body as string, source: draft.data.source as DraftSource } : null,
      type,
      tags: (tags.data || []).map((t: any): TeamTag => ({ teamId: t.team_id, subTeamId: t.sub_team_id ?? null })),
      org,
    }
  },

  /**
   * Anyone, signed in or not, checks a code printed on a document. Returns only the holder's name, the document's name and the
   * issue date, and only for an issued document (scripts/certificate_verification_2026_11_20.sql). Null when the code is not real.
   */
  async verify(code: string): Promise<{ holderName: string; docLabel: string; issuedOn: string } | null> {
    const { data, error } = await (supabaseCommunity as any).rpc('verify_certificate', { p_code: code })
    if (error) throw logSupabaseError('certificateService.verify', error)
    const row = Array.isArray(data) ? data[0] : data
    return row ? { holderName: row.holder_name, docLabel: row.doc_label, issuedOn: row.issued_on } : null
  },

  // ── The desk ──────────────────────────────────────────────────────────────

  /**
   * Every document with everything the desk shows, assembled from flat reads
   * (one per table) rather than nested embeds, so each read is plain and the
   * join lives in one visible place. Newest 600; the desk says so when it hits
   * the cap. RLS scopes this to leaders, and hides HoD answers and notes from
   * the person they are about.
   */
  async listDesk(): Promise<{ docs: DeskDoc[]; capped: boolean }> {
    const sb = supabaseCommunity as any
    const CAP = 600
    const { data: reqs, error } = await sb.from('certificate_requests').select('*').order('requested_at', { ascending: false }).limit(CAP)
    if (error) throw logSupabaseError('certificateService.listDesk', error)
    const rows: any[] = reqs || []
    if (rows.length === 0) return { docs: [], capped: false }
    const ids = rows.map(r => r.id)

    const [hods, tags, notes, drafts, types] = await Promise.all([
      sb.from('certificate_request_hods').select('*').in('request_id', ids),
      sb.from('certificate_request_teams').select('request_id, team_id, sub_team_id').in('request_id', ids),
      sb.from('certificate_request_notes').select('*').in('request_id', ids).order('created_at', { ascending: true }),
      sb.from('certificate_drafts').select('*').in('request_id', ids),
      this.listTypes(),
    ])
    for (const [name, res] of [['hods', hods], ['tags', tags], ['notes', notes], ['drafts', drafts]] as const) {
      if (res.error) throw logSupabaseError(`certificateService.listDesk.${name}`, res.error)
    }

    const wanted = new Set<number>()
    rows.forEach(r => { wanted.add(r.member_id); if (r.decided_by != null) wanted.add(r.decided_by) })
    ;(hods.data || []).forEach((h: any) => wanted.add(h.hod_member_id))
    ;(notes.data || []).forEach((n: any) => wanted.add(n.author_id))
    ;(drafts.data || []).forEach((d: any) => { if (d.drafted_by != null) wanted.add(d.drafted_by) })
    const { data: people, error: pErr } = await sb.from('members').select('member_id, full_name').in('member_id', [...wanted])
    if (pErr) throw logSupabaseError('certificateService.listDesk.members', pErr)
    const name = new Map<number, string>((people || []).map((p: any) => [p.member_id, p.full_name]))
    const who = (id: number | null | undefined) => (id != null ? name.get(id) ?? 'a former member' : null)
    const label = new Map(types.map(t => [t.key, t.label]))

    const by = <T extends { request_id: number }>(list: T[] | null) => {
      const m = new Map<number, T[]>()
      for (const x of list || []) { const a = m.get(x.request_id) ?? []; a.push(x); m.set(x.request_id, a) }
      return m
    }
    const hodsBy = by(hods.data), tagsBy = by(tags.data), notesBy = by(notes.data)
    const draftBy = new Map<number, any>((drafts.data || []).map((d: any) => [d.request_id, d]))

    const docs = rows.map((r): DeskDoc => {
      const d = draftBy.get(r.id)
      return {
        id: r.id,
        memberId: r.member_id,
        memberName: who(r.member_id) ?? 'unknown member',
        typeKey: r.doc_type,
        typeLabel: label.get(r.doc_type) ?? r.doc_type,
        status: r.status,
        submissionId: r.submission_id ?? null,
        claimedMinHours: r.claimed_min_hours != null ? Number(r.claimed_min_hours) : null,
        periodStart: r.period_start ?? null,
        periodEnd: r.period_end ?? null,
        verifyCode: r.verify_code ?? null,
        verifiedHours: r.hours_at_request != null ? Number(r.hours_at_request) : null,
        highlights: r.member_note ?? null,
        requestedAt: r.requested_at,
        decidedBy: r.decided_by ?? null,
        decidedByName: who(r.decided_by),
        decidedAt: r.decided_at ?? null,
        decisionNote: r.decision_note ?? null,
        tags: (tagsBy.get(r.id) || []).map((t: any): TeamTag => ({ teamId: t.team_id, subTeamId: t.sub_team_id ?? null })),
        hods: (hodsBy.get(r.id) || []).map((h: any) => ({
          memberId: h.hod_member_id, name: who(h.hod_member_id) ?? 'a former member', response: (h.response ?? null) as CertResponse | null, respondedAt: h.responded_at ?? null,
        })),
        notes: (notesBy.get(r.id) || []).map((n: any) => ({ id: n.id, authorId: n.author_id, authorName: who(n.author_id) ?? 'a former member', body: n.body, createdAt: n.created_at })),
        draft: d ? { body: d.body, source: d.source, draftedBy: d.drafted_by ?? null, draftedByName: who(d.drafted_by), draftedAt: d.drafted_at } : null,
      }
    })
    return { docs, capped: rows.length >= CAP }
  },

  /** A tagged HoD says whether they can vouch. Can be changed while the request is pending. */
  async respond(requestId: number, response: CertResponse, note?: string) {
    const { error } = await (supabaseCommunity as any).rpc('certificate_respond', { p_request_id: requestId, p_response: response, p_note: note?.trim() || null })
    if (error) throw logSupabaseError('certificateService.respond', error)
    logAction('certificate_hod_response', 'certificate_request', requestId, { response })
    return { success: true }
  },

  /** Any leader (tagged or not) adds a note HR can read. Never shown to the member. */
  async addNote(requestId: number, body: string) {
    const { error } = await (supabaseCommunity as any).rpc('certificate_add_note', { p_request_id: requestId, p_body: body })
    if (error) throw logSupabaseError('certificateService.addNote', error)
    return { success: true }
  },

  /**
   * HR or a tagged HoD writes the text themselves, overriding the routine. This
   * is the route for an informal "I need it now": the request is still filed on
   * the site, the person skips the wait by pasting the text here.
   */
  async setDraft(requestId: number, body: string, source: Extract<DraftSource, 'manual' | 'standard'> = 'manual') {
    const { error } = await (supabaseCommunity as any).rpc('certificate_set_draft', { p_request_id: requestId, p_body: body, p_source: source })
    if (error) throw logSupabaseError('certificateService.setDraft', error)
    logAction('certificate_text_written', 'certificate_request', requestId, { source })
    return { success: true }
  },

  /**
   * Issue or decline. The database stamps who decided and when (the client no
   * longer sends them), refuses an issue with no text, and refuses a decision
   * on your own request.
   */
  async decide(id: number, status: 'issued' | 'declined', decisionNote?: string, typeLabel?: string) {
    const { data, error } = await (supabaseCommunity as any)
      .from('certificate_requests')
      .update({ status, decision_note: decisionNote?.trim() || null })
      .eq('id', id)
      // Only a still-pending request can be decided: a stale tab must not flip
      // an issued certificate to declined (or the reverse).
      .eq('status', 'pending')
      .select('*')
      .maybeSingle()
    if (error) throw logSupabaseError('certificateService.decide', error)
    if (!data) throw new AlreadyDecidedError()
    const mapped = mapRequest(data)
    logAction(status === 'issued' ? 'certificate_issued' : 'certificate_declined', 'certificate_request', id, { docType: mapped.docType })
    const notice = decisionNotice(mapped.docType, status, decisionNote, typeLabel)
    // Fire-and-forget by design: a failed notice must not undo the decision.
    void notificationService.create({ memberId: mapped.memberId, type: 'system', ...notice, link: status === 'issued' ? certificateLink(id) : '/certificates' })
    return { success: true, data: mapped }
  },
}

export const certificateService = withFunctionLogging('certificateService', certificateServiceImpl)

export default certificateService
