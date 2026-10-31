/**
 * Pure model for bug reports: types, limits and the small functions the page, the filters
 * and the routine's briefing all share. No Supabase import, so it is unit-tested directly
 * (bugModel.test.ts). The I/O lives in services/bugReportService.ts.
 */

export type BugSeverity = 'high' | 'med' | 'low'
/** What a report is. Fixed when it is filed (the database refuses to change it). */
export type BugKind = 'bug' | 'feature'
export type CaptureMethod = 'shortcut' | 'form'
/** What kind of work a report turned out to be. Set by the routine on first read, or by a leader. */
export type BugType = 'bug' | 'design' | 'feature' | 'content' | 'performance'
/** Where it sits on the roadmap. */
export type BugLane = 'today' | 'next' | 'later' | 'done'

export interface BugReport {
  id: string
  created_at: string
  updated_at: string
  reporter_member_id: number | null
  reporter_uuid: string | null
  reporter_name: string | null
  reporter_role: string | null
  page_url: string
  page_path: string
  viewport_w: number | null
  viewport_h: number | null
  user_agent: string | null
  capture_method: CaptureMethod | null
  severity: BugSeverity
  /** Absent on rows read before the column existed; treat as 'bug' via kindOf(). */
  kind?: BugKind
  description: string
  screenshots: string[]
  /** Document paths in the private `bug-attachments` bucket. Absent on rows read before the column existed. */
  attachments?: string[]
  approved_for_fix: boolean
  approved_by: number | null
  taken_up: boolean
  taken_up_at: string | null
  solved: boolean
  solved_at: string | null
  verified: boolean
  verified_at: string | null
  verified_by: number | null
  declined_reason: string | null
  /** The routine audited this and found nothing to change. Not a decline; a leader can reopen it. Absent on rows read before the column existed. */
  closed_no_change?: boolean
  needs_info_note: string | null
  /** Why a leader sent a fix back ("not fixed"). The routine reads it as data. Absent on rows read before the column existed. */
  rework_note?: string | null
  /** How many times a leader has sent this back. Set by the database. Absent on older rows; treat as 0. */
  rework_count?: number
  fix_pr_url: string | null
  resolution_note: string | null
  /** Backlog fields (bug_tracker_v2_2026_10_22.sql). All optional: rows read before the columns existed carry none. */
  report_type?: BugType | null
  area?: string | null
  lane?: BugLane
  lane_reason?: string | null
  lane_locked?: boolean
  /** Set by the routine when this is the same problem as another report; this one then shows under that one. */
  duplicate_of?: string | null
  /** One or two sentences: how the routine read the complaint. */
  routine_reading?: string | null
  /** Public paths of before and after pictures the routine committed under /bug-evidence/. */
  evidence?: { before?: string; after?: string } | null
  me_too_count?: number
  reporter_confirm?: 'fixed' | 'not_fixed' | null
  reporter_confirmed_at?: string | null
}

export interface BugReportEvent {
  id: number
  bug_id: string
  at: string
  actor_member_id: number | null
  actor_label: string
  kind: string
  note: string | null
}

/** Limits that mirror the database checks, so the form can say no before the server does. */
export const BUG_LIMITS = {
  descriptionMin: 10,
  descriptionMax: 4000,
  maxScreenshots: 4,
  maxScreenshotBytes: 5 * 1024 * 1024,
  maxAttachments: 8,
  maxAttachmentBytes: 10 * 1024 * 1024,
  /** `bug_reports.page_url` / `page_path` caps. */
  urlMax: 500,
  pathMax: 300,
} as const

export const KIND_LABEL: Record<BugKind, string> = { bug: 'bug', feature: 'feature request' }

/** The kind of a report, defaulting to 'bug' for any row that carries none. */
export function kindOf(b: Pick<BugReport, 'kind'>): BugKind {
  return b.kind === 'feature' ? 'feature' : 'bug'
}

/** Document types a report may carry. Mirrors the bucket's mime list and the insert trigger's extension
 *  check. Legacy .doc and .xls and every macro-enabled type are left out on purpose: they can carry macros. */
export const ATTACHMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export type AttachmentCheck = { ok: true; ext: string; mime: string } | { ok: false; reason: string }

/** Decides whether a picked file can be attached. Pure, so it is tested. The extension decides (a
 *  browser can report a blank or wrong type for a document), and the bucket enforces its own rules. */
export function checkAttachment(file: { name: string; size: number }): AttachmentCheck {
  const ext = (file.name.split('.').pop() ?? '').toLowerCase()
  if (!Object.prototype.hasOwnProperty.call(ATTACHMENT_TYPES, ext) || !file.name.includes('.')) {
    return { ok: false, reason: 'only pdf, text, word (.docx) or excel (.xlsx) files can be attached.' }
  }
  if (file.size > BUG_LIMITS.maxAttachmentBytes) {
    return { ok: false, reason: 'that file is over 10 MB. attach a smaller one.' }
  }
  if (file.size === 0) return { ok: false, reason: 'that file is empty.' }
  return { ok: true, ext, mime: ATTACHMENT_TYPES[ext] }
}

/** The tail of a storage path: lowercase letters, digits, dot, dash, underscore, at most 80 characters
 *  including the extension, always ending in the extension. Matches the database's path check. */
export function safeAttachmentName(name: string, ext: string): string {
  const base = name.replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '')
  const room = 80 - (ext.length + 1)
  return `${(base || 'file').slice(0, room)}.${ext}`
}

/** The name to show for a stored attachment path (<uuid>/<uuid>-<name>). */
export function attachmentLabel(path: string): string {
  const tail = path.split('/').pop() ?? path
  return tail.replace(/^[0-9a-f-]{36}-/, '')
}

export const BUG_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Where a report is in its life, derived from the three checkboxes. One place, so the
 *  table, the filters and the routine's briefing cannot drift apart. */
export type BugStage = 'open' | 'taken_up' | 'solved' | 'verified' | 'no_change' | 'declined'

export function bugStage(b: Pick<BugReport, 'taken_up' | 'solved' | 'verified' | 'declined_reason'> & { closed_no_change?: boolean }): BugStage {
  if (b.declined_reason) return 'declined'
  if (b.verified) return 'verified'
  if (b.solved) return 'solved'
  if (b.closed_no_change) return 'no_change'
  if (b.taken_up) return 'taken_up'
  return 'open'
}

// ── the progress tracker ────────────────────────────────────────────────────
// A report moves one way along reported, taken up, solved, verified. The page shows that as a tracker with ONE next-step
// button for leaders, instead of three independent checkboxes whose greyed-out states needed explaining.

export type TrackKey = 'reported' | 'taken_up' | 'solved' | 'verified'
export const TRACK: { key: TrackKey; label: string }[] = [
  { key: 'reported', label: 'reported' },
  { key: 'taken_up', label: 'taken up' },
  { key: 'solved', label: 'solved' },
  { key: 'verified', label: 'verified' },
]

type Flags = Pick<BugReport, 'taken_up' | 'solved' | 'verified' | 'declined_reason'> & { closed_no_change?: boolean }

/** Declined, or checked and nothing to change: closed without a fix, so there is no tracker to show. */
export const isClosedOut = (b: Flags): boolean => !!b.declined_reason || (!!b.closed_no_change && !b.solved)

/** Where on the tracker this report is: 0 reported, 1 taken up, 2 solved, 3 verified. */
export function trackIndex(b: Flags): number {
  if (b.verified) return 3
  if (b.solved) return 2
  if (b.taken_up) return 1
  return 0
}

export type StepActionId = 'take' | 'solve' | 'verify' | 'untake' | 'unsolve' | 'unverify'
export interface StepAction { id: StepActionId; label: string }

/** The one forward step a leader can take now. Nothing once verified or closed out. A report nobody has taken up yet has
 *  no leader step: only the daily routine takes a report up (the database refuses a signed-in session), and a leader's
 *  tick would hide it from the routine's queue. */
export function nextStepAction(b: Flags): StepAction | null {
  if (isClosedOut(b) || b.verified) return null
  if (b.solved) return { id: 'verify', label: 'verify on the live site' }
  if (b.taken_up) return { id: 'solve', label: 'mark solved' }
  return null
}

/** The one step back, so a mis-click is undone from the same place. Nothing at the start or when closed out. */
export function backStepAction(b: Flags): StepAction | null {
  if (isClosedOut(b)) return null
  if (b.verified) return { id: 'unverify', label: 'undo verified' }
  if (b.solved) return { id: 'unsolve', label: 'send back' }
  if (b.taken_up) return { id: 'untake', label: 'undo taken up' }
  return null
}

/** The routine has marked this solved and no leader has checked it yet. Second layer of the two-layer check:
 *  solved is the routine's claim, verified is a leader's. */
export function awaitingCheck(b: Pick<BugReport, 'solved' | 'verified' | 'declined_reason'>): boolean {
  return b.solved && !b.verified && !b.declined_reason
}

/** How many times a leader has sent this back, 0 for rows that carry no count. */
export function reworkCount(b: Pick<BugReport, 'rework_count'>): number {
  return b.rework_count && b.rework_count > 0 ? b.rework_count : 0
}

/** Pill text for a report that has been sent back at least once, or null. */
export function reworkLabel(b: Pick<BugReport, 'rework_count'>): string | null {
  const n = reworkCount(b)
  if (n === 0) return null
  return n === 1 ? 'sent back once' : `sent back ${n} times`
}

/** Whether the viewer may edit this report's description right now. Mirrors the database rule
 *  (bug_reports_edit_description_2026_10_09.sql), which is what actually enforces it: the reporter
 *  or a leader, and only while nobody has started on the report. */
export function canEditDescription(
  b: Pick<BugReport, 'taken_up' | 'solved' | 'declined_reason' | 'reporter_member_id'>,
  viewer: { memberId?: number | null; isLeader: boolean },
): boolean {
  if (b.taken_up || b.solved || b.declined_reason) return false
  if (viewer.isLeader) return true
  return viewer.memberId != null && b.reporter_member_id === viewer.memberId
}

/** True when saving an edit would take away a leader's approval (a member editing an approved report). */
export function editClearsApproval(b: Pick<BugReport, 'approved_for_fix'>, viewer: { isLeader: boolean }): boolean {
  return b.approved_for_fix && !viewer.isLeader
}

export const STAGE_LABEL: Record<BugStage, string> = {
  open: 'open',
  taken_up: 'taken up',
  solved: 'solved',
  verified: 'verified',
  no_change: 'no change needed',
  declined: 'declined',
}

/** The same wording the change log uses, so a member reads a sentence, not an enum. */
export function eventSentence(e: Pick<BugReportEvent, 'kind' | 'actor_label' | 'note'>): string {
  const who = e.actor_label
  switch (e.kind) {
    case 'filed': return e.note ? `${who} filed this. ${e.note}.` : `${who} filed this.`
    case 'approved_for_fix': return `${who} approved this for automatic fixing.`
    case 'approval_removed': return `${who} removed the approval for automatic fixing.`
    case 'severity_changed': return `${who} changed severity: ${e.note ?? ''}.`
    case 'taken_up': return `${who} took this up.`
    case 'untaken': return `${who} un-ticked taken up.`
    case 'solved': return e.note ? `${who} marked this solved. Fix: ${e.note}` : `${who} marked this solved.`
    case 'reopened': return e.note ? `${who} reopened this and sent it back. ${e.note}` : `${who} reopened this.`
    case 'closed_no_change': return e.note ? `${who} checked this and found nothing to change. ${e.note}` : `${who} checked this and found nothing to change.`
    case 'verified': return `${who} verified the fix on the live site.`
    case 'unverified': return `${who} removed the verification.`
    case 'declined': return `${who} declined this: ${e.note ?? ''}`
    case 'needs_info': return `${who} needs more information: ${e.note ?? ''}`
    case 'edited': return e.note ? `${who} edited the description. ${e.note}` : `${who} edited the description.`
    case 'imported': return e.note ?? 'Imported from the old task sheet.'
    case 'fix_linked': return `${who} linked a fix: ${e.note ?? ''}`
    case 'lane': return `${who} moved this on the roadmap: ${e.note ?? ''}.`
    case 'duplicate': return `${who} linked this to another report: ${e.note ?? ''}.`
    case 'reporter_confirmed': return `${who} confirmed the fix works.`
    case 'reporter_not_fixed': return `${who} says it is not fixed.`
    default: return `${who}: ${e.kind}${e.note ? ', ' + e.note : ''}`
  }
}

export type StageFilter = 'all' | BugStage
export type KindFilter = 'all' | BugKind

/** Stage and kind filters plus a plain text search over description, reporter and page. */
export function filterBugs(
  bugs: BugReport[],
  opts: { stage: StageFilter; tab?: BugTab | 'all'; kind?: KindFilter; text?: string; needsApproval?: boolean; lane?: BugLane | 'all'; type?: BugType | 'all'; area?: string },
): BugReport[] {
  const q = (opts.text ?? '').trim().toLowerCase()
  return bugs.filter(b => {
    if (opts.stage !== 'all' && bugStage(b) !== opts.stage) return false
    if (opts.tab && opts.tab !== 'all' && tabOf(b) !== opts.tab) return false
    if (opts.lane && opts.lane !== 'all' && laneOf(b) !== opts.lane) return false
    if (opts.type && opts.type !== 'all' && typeOf(b) !== opts.type) return false
    if (opts.area && (b.area ?? '') !== opts.area) return false
    if (opts.kind && opts.kind !== 'all' && kindOf(b) !== opts.kind) return false
    if (opts.needsApproval && (b.approved_for_fix || b.declined_reason || b.solved || b.closed_no_change)) return false
    if (!q) return true
    return (
      b.description.toLowerCase().includes(q) ||
      (b.reporter_name ?? '').toLowerCase().includes(q) ||
      b.page_path.toLowerCase().includes(q) ||
      (b.area ?? '').toLowerCase().includes(q)
    )
  })
}

/** Counts per stage for the filter chips. `all` is the whole list. */
export function stageCounts(bugs: BugReport[]): Record<StageFilter, number> {
  const out: Record<StageFilter, number> = { all: bugs.length, open: 0, taken_up: 0, solved: 0, verified: 0, no_change: 0, declined: 0 }
  for (const b of bugs) out[bugStage(b)]++
  return out
}

/** Counts per kind for the kind chips. `all` is the whole list. */
export function kindCounts(bugs: BugReport[]): Record<KindFilter, number> {
  const out: Record<KindFilter, number> = { all: bugs.length, bug: 0, feature: 0 }
  for (const b of bugs) out[kindOf(b)]++
  return out
}

/** Longest edge after downscaling, or null when the image is already small enough. */
export function shrinkTarget(width: number, height: number, maxEdge: number): { w: number; h: number } | null {
  const longest = Math.max(width, height)
  if (longest <= maxEdge || width <= 0 || height <= 0) return null
  const k = maxEdge / longest
  return { w: Math.max(1, Math.round(width * k)), h: Math.max(1, Math.round(height * k)) }
}

/** The page a report is about. Same origin, or a bare path. Anything else (another site,
 *  a javascript: link, junk) becomes the home page, so the table never renders a link that
 *  leaves the site or runs script. */
export function safePageUrl(raw: string, origin: string): { url: string; path: string } {
  const home = { url: new URL('/', origin).href, path: '/' }
  try {
    const u = new URL((raw ?? '').trim(), origin)
    if (u.origin !== new URL(origin).origin) return home
    return { url: u.href, path: u.pathname + u.search }
  } catch {
    return home
  }
}

/** A link safe to put in an href: http or https only, else null. A report's page and
 *  fix links come from the database, which a client can write to directly, so a
 *  `javascript:` value must never reach an anchor a leader will click. */
export function safeHref(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

// ── plain words, for the page people actually read ────────────────────────────────────────────
// The page speaks to members, not to the routine: one short status, three tabs, a title instead of a paragraph.
// Everything here is derived from the same fields as bugStage(), so the two cannot disagree.

export type SayKey = 'waiting' | 'being_fixed' | 'question' | 'fixed' | 'checked' | 'no_change' | 'declined'
export type SayTone = 'lemon' | 'sky' | 'welfare' | 'plain'

/** One status a person can read in a glance, and the tone the card paints it in. */
export function friendlyStatus(b: Pick<BugReport, 'taken_up' | 'solved' | 'verified' | 'declined_reason' | 'needs_info_note'> & { closed_no_change?: boolean }): { key: SayKey; label: string; tone: SayTone } {
  if (b.declined_reason) return { key: 'declined', label: 'not going ahead', tone: 'plain' }
  if (b.verified) return { key: 'checked', label: 'fixed and checked', tone: 'welfare' }
  if (b.solved) return { key: 'fixed', label: 'fixed', tone: 'welfare' }
  if (b.closed_no_change) return { key: 'no_change', label: 'nothing to change', tone: 'plain' }
  if (b.taken_up && b.needs_info_note) return { key: 'question', label: 'we have a question', tone: 'sky' }
  if (b.taken_up) return { key: 'being_fixed', label: 'being fixed', tone: 'sky' }
  return { key: 'waiting', label: 'waiting its turn', tone: 'lemon' }
}

/** The three tabs on the page: still to do, done, and closed without a change. */
export type BugTab = 'open' | 'fixed' | 'closed'
export const TABS: { key: BugTab; label: string }[] = [
  { key: 'open', label: 'open' },
  { key: 'fixed', label: 'fixed' },
  { key: 'closed', label: 'closed' },
]

export function tabOf(b: Flags): BugTab {
  if (b.declined_reason) return 'closed'
  if (b.solved || b.verified) return 'fixed'
  if (b.closed_no_change) return 'closed'
  return 'open'
}

export function tabCounts(bugs: BugReport[]): Record<BugTab, number> {
  const out: Record<BugTab, number> = { open: 0, fixed: 0, closed: 0 }
  for (const b of bugs) out[tabOf(b)]++
  return out
}

/** What kind of thing it is, in the words people use. */
export const TYPE_PLAIN: Record<BugType, string> = {
  bug: 'bug', design: 'how it looks', feature: 'idea', content: 'wording', performance: 'slow',
}

/** The first sentence or line of a report, cut at a word near `max` characters, for the card's title. */
export function shortTitle(description: string, max = 90): string {
  const flat = (description ?? '').trim().replace(/\s+/g, ' ')
  if (!flat) return 'untitled report'
  const first = flat.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? flat
  if (first.length <= max) return first
  const cut = first.slice(0, max)
  const at = cut.lastIndexOf(' ')
  return (at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, '') + '...'
}

/** The page a report is about, as a name: "/" is home, "/teams/abc?x=1" is teams. */
export function pageName(path: string | null | undefined): string {
  const seg = (path ?? '').split(/[?#]/)[0].split('/').filter(Boolean)[0]
  return seg ? seg.replace(/[-_]+/g, ' ') : 'home'
}

/** The progress dots in plain words. Same four steps as TRACK. */
export const TRACK_PLAIN = ['sent', 'being fixed', 'fixed', 'checked'] as const

// ── the backlog: lanes, types, duplicates, demand ───────────────────────────────────────────

export const LANES: { key: BugLane; label: string; hint: string }[] = [
  { key: 'today', label: 'today', hint: 'being worked on now' },
  { key: 'next', label: 'next', hint: 'up after today' },
  { key: 'later', label: 'later', hint: 'wanted, not scheduled' },
  { key: 'done', label: 'done', hint: 'solved or checked' },
]

export const TYPE_LABEL: Record<BugType, string> = {
  bug: 'bug', design: 'design', feature: 'feature', content: 'content', performance: 'speed',
}

/** The lane of a report. Rows that carry none are done when closed and later otherwise. */
export function laneOf(b: Pick<BugReport, 'lane' | 'solved' | 'closed_no_change'>): BugLane {
  if (b.lane) return b.lane
  return b.solved || b.closed_no_change ? 'done' : 'later'
}

/** The type of a report. Rows the routine has not read yet fall back to the kind they were filed as. */
export function typeOf(b: Pick<BugReport, 'report_type' | 'kind'>): BugType {
  return b.report_type ?? (kindOf(b) === 'feature' ? 'feature' : 'bug')
}

export function laneCounts(bugs: BugReport[]): Record<BugLane, number> {
  const out: Record<BugLane, number> = { today: 0, next: 0, later: 0, done: 0 }
  for (const b of bugs) out[laneOf(b)]++
  return out
}

/** Reports the routine marked as the same problem as another one are folded under that one. A duplicate whose
 *  parent is not in the list (filtered out, or not visible) stays a row of its own, so nothing disappears. */
export function groupDuplicates(bugs: BugReport[]): { parents: BugReport[]; also: Record<string, BugReport[]> } {
  const ids = new Set(bugs.map(b => b.id))
  const also: Record<string, BugReport[]> = {}
  const parents: BugReport[] = []
  for (const b of bugs) {
    if (b.duplicate_of && b.duplicate_of !== b.id && ids.has(b.duplicate_of)) (also[b.duplicate_of] ??= []).push(b)
    else parents.push(b)
  }
  return { parents, also }
}

/** How many people want this: the reporter, each me-too, and the reporters of folded duplicates (and their me-toos). */
export function demand(b: BugReport, also: Record<string, BugReport[]> = {}): number {
  const dups = also[b.id] ?? []
  return 1 + (b.me_too_count ?? 0) + dups.reduce((n, d) => n + 1 + (d.me_too_count ?? 0), 0)
}

const SEV_RANK: Record<BugSeverity, number> = { high: 0, med: 1, low: 2 }

export type BugSort = 'newest' | 'wanted'

/** `newest` keeps the incoming order (the service returns newest first). `wanted` puts the most demanded first,
 *  then by importance, then oldest first (it has waited longest). Stable and pure. */
export function sortBugs(bugs: BugReport[], sort: BugSort, also: Record<string, BugReport[]> = {}): BugReport[] {
  if (sort === 'newest') return bugs
  return [...bugs].sort((a, b) =>
    demand(b, also) - demand(a, also)
    || SEV_RANK[a.severity] - SEV_RANK[b.severity]
    || a.created_at.localeCompare(b.created_at))
}

/** First name only, for members who are not leaders. */
export function firstName(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] || 'a member'
}

/** Whether to show "did this fix it?": the reporter or someone who said me too, once the routine has marked it
 *  solved and no leader has verified it yet. */
export function canConfirm(
  b: Pick<BugReport, 'solved' | 'verified' | 'reporter_member_id'>,
  viewer: { memberId?: number | null },
  voted: boolean,
): boolean {
  if (!b.solved || b.verified || viewer.memberId == null) return false
  return b.reporter_member_id === viewer.memberId || voted
}

/** Evidence pictures are files the routine committed under /bug-evidence/ in this repo's public folder. Anything
 *  else (another site, a traversal, junk) is dropped, so the page never renders an image it does not own. */
export function evidenceOf(b: Pick<BugReport, 'evidence'>): { before?: string; after?: string } {
  const ok = (v: unknown): string | undefined =>
    typeof v === 'string' && /^\/bug-evidence\/[a-z0-9._/-]+\.(webp|png|jpg)$/.test(v) && !v.includes('..') ? v : undefined
  const e = b.evidence ?? {}
  return { before: ok(e.before), after: ok(e.after) }
}

// ── the routine's run log ("this morning") ─────────────────────────────────────────────────

export interface RoutineRun {
  id: string
  started_at: string
  finished_at: string | null
  verdict: 'GREEN' | 'ALERT' | 'INCOMPLETE' | null
  picked: number
  shipped: number
  skipped: number
  summary: string | null
  themes: string | null
}

/** "just now", "6 hours ago", "yesterday", "3 days ago". */
export function ago(iso: string, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60000))
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} minutes ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`
  const days = Math.round(hrs / 24)
  return days === 1 ? 'yesterday' : `${days} days ago`
}

/** `fresh` within 36 hours of the last run (a daily run plus slack), `late` after that, `none` before the first run. */
export function routineState(run: Pick<RoutineRun, 'started_at'> | null, now: Date = new Date()): 'fresh' | 'late' | 'none' {
  if (!run) return 'none'
  return now.getTime() - new Date(run.started_at).getTime() > 36 * 3600_000 ? 'late' : 'fresh'
}
