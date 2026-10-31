/**
 * Bug reports (2026-10-05). Table `bug_reports`, change log `bug_report_events`, private
 * bucket `bug-screenshots`. Schema, grants and triggers: scripts/bug_reports_2026_10_05.sql.
 *
 * Service contract (CLAUDE.md): this THROWS on error. The component owns the toast.
 *
 * What the database decides, so this file does not try to:
 *   - who the reporter is and their role (set by trigger from the session, never from here);
 *   - `approved_for_fix` (true only when a leader filed it, or a leader later approves it);
 *   - the *_at / *_by stamps on the three checkboxes;
 *   - who may see what (every active member reads every report; screenshots and documents stay private to the
 *     reporter and leaders);
 *   - the vote count, the lane lock and the reporter's confirmation (triggers, scripts/bug_tracker_v2_2026_10_22.sql).
 * A column this file does not send cannot be forged by it, and the INSERT grant is
 * column-by-column, so sending one by mistake fails loudly.
 */
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { logSupabaseError } from '../lib/errorTracking'
import { BUG_LIMITS, checkAttachment, safeAttachmentName, type BugKind, type BugReport, type BugReportEvent, type BugSeverity, type CaptureMethod, type RoutineRun } from '../bugs/bugModel'

export * from '../bugs/bugModel'

// The generated Database types predate these tables, so the typed client would reject the
// table names outright. Same `as any` escape hatch wallService and memberOfMonthService use;
// the row shapes are BugReport / BugReportEvent in bugs/bugModel.ts. Storage stays typed.
const db = supabaseCommunity as any

const BUGS_CAP = 300

export interface SubmitInput {
  description: string
  severity: BugSeverity
  kind: BugKind
  pageUrl: string
  pagePath: string
  files: File[]
  /** Documents (pdf, txt, docx, xlsx), uploaded to the private `bug-attachments` bucket. */
  attachments?: File[]
  captureMethod: CaptureMethod
}

function extensionFor(file: File): string {
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export const bugReportService = {
  /** RLS decides what comes back: every active member gets every report. */
  async list(): Promise<BugReport[]> {
    const { data, error } = await db
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, BUGS_CAP - 1)
    if (error) throw logSupabaseError('bugReportService.list', error)
    return (data ?? []) as BugReport[]
  },

  async events(bugIds: string[]): Promise<BugReportEvent[]> {
    if (bugIds.length === 0) return []
    const { data, error } = await db
      .from('bug_report_events')
      .select('*')
      .in('bug_id', bugIds)
      .order('at', { ascending: true })
    if (error) throw logSupabaseError('bugReportService.events', error)
    return (data ?? []) as BugReportEvent[]
  },

  /** Short-lived links: the bucket is private, because a screenshot of a desk can show
   *  member names and phone numbers. Returns path -> url; a path that fails is left out. */
  async signedUrls(paths: string[]): Promise<Record<string, string>> {
    if (paths.length === 0) return {}
    const { data, error } = await supabaseCommunity.storage
      .from('bug-screenshots')
      .createSignedUrls(paths, 60 * 60)
    if (error) throw logSupabaseError('bugReportService.signedUrls', error)
    const out: Record<string, string> = {}
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) out[row.path] = row.signedUrl
    }
    return out
  },

  /** Short-lived DOWNLOAD links for documents (the bucket is private). `download: true` makes the browser
   *  save the file instead of opening it, so a document is never rendered inside the site's origin. */
  async attachmentUrls(paths: string[]): Promise<Record<string, string>> {
    if (paths.length === 0) return {}
    const { data, error } = await supabaseCommunity.storage
      .from('bug-attachments')
      .createSignedUrls(paths, 60 * 60, { download: true })
    if (error) throw logSupabaseError('bugReportService.attachmentUrls', error)
    const out: Record<string, string> = {}
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) out[row.path] = row.signedUrl
    }
    return out
  },

  /**
   * Uploads the images first, then files the report. A failed upload fails the whole
   * submit before anything is filed. A failed INSERT after a good upload leaves a private,
   * folder-scoped orphan: the bucket has no delete policy on purpose (a filer cannot swap
   * or remove evidence), so there is nothing to roll back with. Capped at 4 files, 5 MB.
   */
  async submit(memberUuid: string, input: SubmitInput): Promise<string> {
    const paths: string[] = []
    for (const file of input.files.slice(0, BUG_LIMITS.maxScreenshots)) {
      const path = `${memberUuid}/${crypto.randomUUID()}.${extensionFor(file)}`
      const { error } = await supabaseCommunity.storage
        .from('bug-screenshots')
        .upload(path, file, { contentType: file.type, upsert: false })
      if (error) throw logSupabaseError('bugReportService.upload', error)
      paths.push(path)
    }
    const docPaths: string[] = []
    for (const file of (input.attachments ?? []).slice(0, BUG_LIMITS.maxAttachments)) {
      const chk = checkAttachment(file)
      if (!chk.ok) throw new Error(chk.reason)
      const path = `${memberUuid}/${crypto.randomUUID()}-${safeAttachmentName(file.name, chk.ext)}`
      const { error } = await supabaseCommunity.storage
        .from('bug-attachments')
        .upload(path, file, { contentType: chk.mime, upsert: false })
      if (error) throw logSupabaseError('bugReportService.uploadAttachment', error)
      docPaths.push(path)
    }
    const { data, error } = await db
      .from('bug_reports')
      .insert({
        page_url: input.pageUrl.slice(0, BUG_LIMITS.urlMax),
        page_path: input.pagePath.slice(0, BUG_LIMITS.pathMax),
        viewport_w: typeof window !== 'undefined' ? window.innerWidth : null,
        viewport_h: typeof window !== 'undefined' ? window.innerHeight : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 400) : null,
        capture_method: input.captureMethod,
        severity: input.severity,
        kind: input.kind,
        description: input.description.trim(),
        screenshots: paths,
        attachments: docPaths,
      })
      .select('id')
      .single()
    if (error) throw logSupabaseError('bugReportService.submit', error)
    return (data as { id: string }).id
  },

  /** Leaders may change any of these. A reporter may change `description` of their own report while it
   *  is still waiting, and nothing else (the database enforces both). */
  async update(
    id: string,
    patch: Partial<Pick<BugReport,
      'severity' | 'approved_for_fix' | 'taken_up' | 'solved' | 'verified' |
      'declined_reason' | 'needs_info_note' | 'fix_pr_url' | 'resolution_note' | 'closed_no_change' | 'description' | 'rework_note' |
      'report_type' | 'area' | 'lane' | 'lane_reason'>>,
  ): Promise<BugReport> {
    const { data, error } = await db
      .from('bug_reports')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw logSupabaseError('bugReportService.update', error)
    return data as BugReport
  },

  /** The reports this member has said "me too" to. RLS returns only their own votes. */
  async myVotes(): Promise<Set<string>> {
    const { data, error } = await db.from('bug_report_votes').select('bug_id')
    if (error) throw logSupabaseError('bugReportService.myVotes', error)
    return new Set(((data ?? []) as { bug_id: string }[]).map(r => r.bug_id))
  },

  async vote(bugId: string, memberId: number): Promise<void> {
    const { error } = await db.from('bug_report_votes').insert({ bug_id: bugId, member_id: memberId })
    if (error && error.code !== '23505') throw logSupabaseError('bugReportService.vote', error)
  },

  async unvote(bugId: string, memberId: number): Promise<void> {
    const { error } = await db.from('bug_report_votes').delete().eq('bug_id', bugId).eq('member_id', memberId)
    if (error) throw logSupabaseError('bugReportService.unvote', error)
  },

  /** "Did this fix it?" from the reporter or a me-too voter. `fixed = false` sends it back like a leader's send-back. */
  async confirm(bugId: string, fixed: boolean, note?: string): Promise<void> {
    const { error } = await db.rpc('bug_reporter_confirm', { p_bug: bugId, p_fixed: fixed, p_note: note ?? null })
    if (error) throw logSupabaseError('bugReportService.confirm', error)
  },

  /** The routine's most recent run, for the "this morning" panel. Null before the first run. */
  async latestRun(): Promise<RoutineRun | null> {
    const { data, error } = await db.from('routine_runs').select('*').order('started_at', { ascending: false }).limit(1)
    if (error) throw logSupabaseError('bugReportService.latestRun', error)
    return ((data ?? [])[0] as RoutineRun | undefined) ?? null
  },
}
