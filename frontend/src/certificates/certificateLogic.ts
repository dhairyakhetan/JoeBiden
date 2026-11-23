/**
 * Certificate pipeline rules, as pure functions (no React, no Supabase), so they
 * can be tested under vitest's node environment like deskAccess.ts.
 *
 * Everything here has a twin in the database (scripts/certificate_pipeline_2026_11_20.sql).
 * The database is the boundary; these functions exist so the form refuses what
 * the database would refuse BEFORE the member has typed a paragraph, and so the
 * desk shows each person the controls the database will actually let them use.
 */
import { hasLeaderAccess, isSuperAdmin } from '../lib/roles'

// ── Vocabulary ──────────────────────────────────────────────────────────────

export type CertResponse = 'approve' | 'disapprove' | 'clueless'
export type CertStatus = 'pending' | 'issued' | 'declined'
export type DraftSource = 'claude' | 'manual' | 'standard'

export interface CertTypeInfo {
  key: string
  label: string
  blurb: string
  /** certificate: landscape, fixed wording. letter: portrait, written text. */
  kind: 'certificate' | 'letter'
  layout: 'landscape' | 'portrait'
  needsHod: boolean
  /** Fixed wording filled from the request: a standard draft is saved at submit, nobody writes it. */
  structured: boolean
  /** The drafting routine writes this one. False for types a person writes. */
  routineDrafts: boolean
  hasStandardWording: boolean
  sampleImageUrl: string | null
  displayOrder: number
}

export interface OrgTeam { teamId: number; name: string; parentTeamId: number | null; isActive: boolean }
export interface OrgSubTeam { subTeamId: number; teamId: number; name: string; isActive: boolean }
/** One tagged place: a team (or child team) when subTeamId is null, otherwise that sub-team. */
export interface TeamTag { teamId: number; subTeamId: number | null }

export const LIMITS = {
  /** The organisation's first year; the database refuses an earlier start. */
  firstYear: 2021,
  minHours: 1,
  maxHours: 2000,
  maxTeams: 16,
  maxHods: 10,
  maxHighlights: 1000,
  maxNote: 1000,
  maxDraft: 4000,
} as const

// ── The team tree the member picks from ─────────────────────────────────────

export interface TeamNode {
  teamId: number
  name: string
  isActive: boolean
  subTeams: { subTeamId: number; name: string; isActive: boolean }[]
  children: TeamNode[]
}

/**
 * Top-level teams, each with its child teams (Marketing > Social Media) and each
 * team's sub-teams (Social Media > LinkedIn Team).
 *
 * Inactive teams and sub-teams are KEPT: someone who worked on Dog Feeding two
 * years ago is exactly who asks for a letter. The one thing dropped is a
 * duplicate: the live table holds two "Reels Team" rows under Social Media, one
 * retired, and showing both reads as a bug. A retired sub-team is hidden only
 * when an active one with the same name sits in the same team.
 */
export function buildTeamTree(teams: readonly OrgTeam[], subTeams: readonly OrgSubTeam[]): TeamNode[] {
  const subsByTeam = new Map<number, OrgSubTeam[]>()
  for (const s of subTeams) {
    const list = subsByTeam.get(s.teamId) ?? []
    list.push(s)
    subsByTeam.set(s.teamId, list)
  }
  const nodeOf = (t: OrgTeam): TeamNode => {
    const raw = subsByTeam.get(t.teamId) ?? []
    const activeNames = new Set(raw.filter(s => s.isActive).map(s => s.name.trim().toLowerCase()))
    const subs = raw
      .filter(s => s.isActive || !activeNames.has(s.name.trim().toLowerCase()))
      .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name))
      .map(s => ({ subTeamId: s.subTeamId, name: s.name, isActive: s.isActive }))
    return { teamId: t.teamId, name: t.name, isActive: t.isActive, subTeams: subs, children: [] }
  }
  const nodes = new Map(teams.map(t => [t.teamId, nodeOf(t)]))
  const roots: TeamNode[] = []
  for (const t of teams) {
    const node = nodes.get(t.teamId)!
    const parent = t.parentTeamId != null ? nodes.get(t.parentTeamId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const order = (a: TeamNode, b: TeamNode) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)
  roots.sort(order)
  for (const n of nodes.values()) n.children.sort(order)
  return roots
}

/** "Marketing > Social Media > LinkedIn Team". Falls back to what it can name. */
export function tagPath(tag: TeamTag, teams: readonly OrgTeam[], subTeams: readonly OrgSubTeam[]): string {
  const byId = new Map(teams.map(t => [t.teamId, t]))
  const parts: string[] = []
  let cur = byId.get(tag.teamId)
  const seen = new Set<number>()
  while (cur && !seen.has(cur.teamId)) {
    seen.add(cur.teamId)
    parts.unshift(cur.name)
    cur = cur.parentTeamId != null ? byId.get(cur.parentTeamId) : undefined
  }
  if (tag.subTeamId != null) {
    const s = subTeams.find(x => x.subTeamId === tag.subTeamId)
    if (s) parts.push(s.name)
  }
  return parts.join(' > ')
}

export const tagKey = (t: TeamTag) => `${t.teamId}:${t.subTeamId ?? ''}`

/** The short form for sentences: "LinkedIn Team in Social Media", or just "Human Resources". */
export function tagShort(tag: TeamTag, teams: readonly OrgTeam[], subTeams: readonly OrgSubTeam[]): string {
  const team = teams.find(t => t.teamId === tag.teamId)?.name ?? 'a team'
  if (tag.subTeamId == null) return team
  const sub = subTeams.find(s => s.subTeamId === tag.subTeamId)?.name
  return sub ? `${sub} in ${team}` : team
}

/** "a", "a and b", "a, b and c". */
export function joinList(items: readonly string[]): string {
  const xs = items.filter(Boolean)
  if (xs.length <= 1) return xs[0] ?? ''
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
}

// ── Months ──────────────────────────────────────────────────────────────────

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "2025-03" or "2025-03-01" to "March, 2025", the form the templates print. Empty for anything else. */
export function formatMonth(value: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(value ?? '')
  if (!m) return ''
  const idx = Number(m[2]) - 1
  return idx >= 0 && idx < 12 ? `${MONTHS[idx]}, ${m[1]}` : ''
}

/** The month a form field holds, as "YYYY-MM", for a given date. */
export const monthOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export const isMonth = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v)

/** "March, 2024 to July, 2026". */
export const periodLabel = (start: string | null | undefined, end: string | null | undefined) =>
  start && end ? `${formatMonth(start)} to ${formatMonth(end)}` : ''

// ── The application form ────────────────────────────────────────────────────

export interface ApplicationInput {
  docTypes: string[]
  hodIds: number[]
  teams: TeamTag[]
  minHours: number | null
  /** "YYYY-MM": the month they started and the month they finished (this month if still with AQ). */
  periodStart: string
  periodEnd: string
  highlights: string
}

export type ApplicationErrors = Partial<Record<'docTypes' | 'hods' | 'teams' | 'hours' | 'period' | 'highlights', string>>

/** Mirrors submit_certificate_requests(). Returns {} when the form may be sent. */
export function validateApplication(input: ApplicationInput, types: readonly CertTypeInfo[], now: Date = new Date()): ApplicationErrors {
  const errors: ApplicationErrors = {}
  const chosen = types.filter(t => input.docTypes.includes(t.key))
  if (chosen.length === 0) errors.docTypes = 'pick at least one document.'

  if (input.teams.length === 0) errors.teams = 'tag at least one team you were part of.'
  else if (input.teams.length > LIMITS.maxTeams) errors.teams = `tag at most ${LIMITS.maxTeams} teams.`

  const h = input.minHours
  if (h == null || !Number.isFinite(h)) errors.hours = 'enter the minimum hours you worked.'
  else if (h < LIMITS.minHours) errors.hours = `the minimum is ${LIMITS.minHours} hour.`
  else if (h > LIMITS.maxHours) errors.hours = `that is more than ${LIMITS.maxHours} hours. check the number.`

  if (!isMonth(input.periodStart) || !isMonth(input.periodEnd)) errors.period = 'pick the month you started and the month you finished.'
  else if (Number(input.periodStart.slice(0, 4)) < LIMITS.firstYear) errors.period = `AquaTerra started in ${LIMITS.firstYear}. pick a later start.`
  else if (input.periodStart > input.periodEnd) errors.period = 'the start month cannot be after the finish month.'
  else if (input.periodEnd > monthOf(now)) errors.period = 'the finish month cannot be in the future.'

  if (input.hodIds.length > LIMITS.maxHods) errors.hods = `tag at most ${LIMITS.maxHods} HoDs.`
  else if (input.hodIds.length === 0 && chosen.some(t => t.needsHod)) {
    const names = chosen.filter(t => t.needsHod).map(t => t.label.toLowerCase())
    errors.hods = `tag the HoD who has seen your work. ${joinList(names)} ${names.length === 1 ? 'needs' : 'need'} one.`
  }

  if (input.highlights.length > LIMITS.maxHighlights) errors.highlights = `keep it under ${LIMITS.maxHighlights} characters.`
  return errors
}

export const isValid = (e: ApplicationErrors) => Object.keys(e).length === 0

/** The exact argument object submit_certificate_requests() takes. */
export function applicationRpcArgs(input: ApplicationInput) {
  return {
    p_doc_types: [...new Set(input.docTypes)],
    p_hod_ids: [...new Set(input.hodIds)],
    p_teams: input.teams.map(t => ({ team_id: t.teamId, sub_team_id: t.subTeamId })),
    p_min_hours: input.minHours,
    p_period_start: `${input.periodStart}-01`,
    p_period_end: `${input.periodEnd}-01`,
    p_highlights: input.highlights.trim() || null,
  }
}

/** Parse the hours box. Accepts "40", "40.5", " 40 "; refuses everything else. */
export function parseHours(raw: string): number | null {
  const s = raw.trim()
  if (!/^\d{1,4}(\.\d)?$/.test(s)) return null
  return Number(s)
}

export function formatHours(h: number | null | undefined): string {
  if (h == null) return '?'
  return Number.isInteger(h) ? String(h) : h.toFixed(1)
}

/** Database error code to a sentence a member can act on. Unknown errors keep a safe generic line. */
const ERROR_COPY: Record<string, string> = {
  certificate_not_signed_in: 'sign in again and retry.',
  certificate_members_only: 'only active members can ask for a certificate.',
  certificate_pick_a_type: 'pick at least one document.',
  certificate_too_many_types: 'that is too many documents at once.',
  certificate_unknown_type: 'one of those documents is no longer offered. reload the page.',
  certificate_bad_period: 'pick the month you started and the month you finished. the finish cannot be in the future.',
  certificate_bad_hours: 'enter the minimum hours you worked, from 1 to 2000.',
  certificate_highlights_too_long: 'keep the extra notes under 1000 characters.',
  certificate_too_many_hods: 'tag at most 10 HoDs.',
  certificate_bad_hod: 'one of the people you tagged is not an active HoD. reload and pick again.',
  certificate_pick_a_hod: 'tag the HoD who has seen your work.',
  certificate_pick_a_team: 'tag at least one team you were part of.',
  certificate_too_many_teams: 'tag at most 16 teams.',
  certificate_bad_team: 'one of those teams does not exist any more. reload and pick again.',
  certificate_already_pending: 'you already have one of these waiting. wait for it to be decided first.',
  certificate_already_decided: 'someone has already decided this one. the list has been refreshed.',
  certificate_not_found: 'that request no longer exists.',
  certificate_not_tagged: 'you were not tagged on this request, so you can add a note but not answer.',
  certificate_bad_response: 'pick approve, disapprove or not sure.',
  certificate_note_too_long: 'keep the note under 1000 characters.',
  certificate_leaders_only: 'only HoDs and HR can do that.',
  certificate_bad_note: 'write a note between 1 and 1000 characters.',
  certificate_own_request: 'you cannot act on your own request. another person has to.',
  certificate_not_allowed: 'only HR or a tagged HoD can write the text.',
  certificate_bad_text: 'the text must be between 1 and 4000 characters.',
  certificate_bad_source: 'that is not a valid text source.',
  certificate_needs_text: 'there is no text yet. paste it in, use the standard wording, or wait for the next draft.',
  certificate_field_locked: 'what was asked for cannot be changed after the fact.',
}

export function certificateErrorCode(err: unknown): string | null {
  const msg = typeof err === 'string' ? err : (err as { message?: string } | null)?.message ?? ''
  const m = /certificate_[a-z_]+/.exec(msg)
  return m ? m[0] : null
}

export function certificateErrorMessage(err: unknown, fallback = 'try again in a moment.'): string {
  const code = certificateErrorCode(err)
  return (code && ERROR_COPY[code]) || fallback
}

// ── Fixed wording (structured types) ───────────────────────────────────────

/**
 * The sentence on a certificate. The database writes this same sentence when the request is filed
 * (submit_certificate_requests), and the desk's "use the standard wording" restores it, so the three must agree:
 * change one, change all. Null for a type that has no fixed wording.
 */
export function standardWording(args: {
  structured: boolean
  memberName: string
  minHours: number | null
  periodStart: string | null
  periodEnd: string | null
}): string | null {
  if (!args.structured) return null
  const hours = args.minHours != null ? formatHours(args.minHours) : null
  const start = formatMonth(args.periodStart), end = formatMonth(args.periodEnd)
  if (!hours || !start || !end) return null
  return `This is to certify that ${args.memberName || 'the above-named individual'} has been a valuable part of our organization and contributed over ${hours} hours to our welfare endeavours between ${start} and ${end}.`
}

// ── The desk: documents, cases and who may do what ──────────────────────────

export interface DeskHod { memberId: number; name: string; response: CertResponse | null; respondedAt: string | null }
export interface DeskNote { id: number; authorId: number; authorName: string; body: string; createdAt: string }
export interface DeskDraft { body: string; source: DraftSource; draftedBy: number | null; draftedByName: string | null; draftedAt: string }

export interface DeskDoc {
  id: number
  memberId: number
  memberName: string
  typeKey: string
  typeLabel: string
  status: CertStatus
  submissionId: string | null
  claimedMinHours: number | null
  /** The months the member says they were with AQ ("YYYY-MM-DD", first of the month). A claim, like the hours. */
  periodStart: string | null
  periodEnd: string | null
  /** The database-derived figure from attendance. 0 or null mean "no attendance on record", not "worked zero". */
  verifiedHours: number | null
  /** Assigned by the database when HR issues; printed on the document and checked at /verify. */
  verifyCode: string | null
  highlights: string | null
  requestedAt: string
  decidedBy: number | null
  decidedByName: string | null
  decidedAt: string | null
  decisionNote: string | null
  tags: TeamTag[]
  hods: DeskHod[]
  notes: DeskNote[]
  draft: DeskDraft | null
}

export interface CertCase {
  memberId: number
  memberName: string
  open: DeskDoc[]
  closed: DeskDoc[]
  oldestOpenAt: string | null
  latestDecidedAt: string | null
}

/**
 * Club every document of one member into a single case, however many rounds
 * they were asked for in. `open` is what is still waiting; `closed` is what was
 * decided before, shown as history so HR sees "already issued a letter in March".
 */
export function groupIntoCases(docs: readonly DeskDoc[]): CertCase[] {
  const byMember = new Map<number, CertCase>()
  for (const d of docs) {
    let c = byMember.get(d.memberId)
    if (!c) {
      c = { memberId: d.memberId, memberName: d.memberName, open: [], closed: [], oldestOpenAt: null, latestDecidedAt: null }
      byMember.set(d.memberId, c)
    }
    if (d.status === 'pending') {
      c.open.push(d)
      if (!c.oldestOpenAt || d.requestedAt < c.oldestOpenAt) c.oldestOpenAt = d.requestedAt
    } else {
      c.closed.push(d)
      if (d.decidedAt && (!c.latestDecidedAt || d.decidedAt > c.latestDecidedAt)) c.latestDecidedAt = d.decidedAt
    }
  }
  for (const c of byMember.values()) {
    c.open.sort((a, b) => a.requestedAt.localeCompare(b.requestedAt) || a.id - b.id)
    c.closed.sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? '') || b.id - a.id)
  }
  return [...byMember.values()]
}

/** Pending tab: people with something waiting, longest-waiting first (first come, first served). */
export function pendingCases(cases: readonly CertCase[]): CertCase[] {
  return cases.filter(c => c.open.length > 0).sort((a, b) => (a.oldestOpenAt ?? '').localeCompare(b.oldestOpenAt ?? ''))
}

/** Cleared tab: people with something decided, most recently decided first. */
export function clearedCases(cases: readonly CertCase[]): CertCase[] {
  return cases.filter(c => c.closed.length > 0).sort((a, b) => (b.latestDecidedAt ?? '').localeCompare(a.latestDecidedAt ?? ''))
}

export interface HodSummary { approve: number; disapprove: number; clueless: number; waiting: number; total: number }

export function summariseHods(hods: readonly Pick<DeskHod, 'response'>[]): HodSummary {
  const s: HodSummary = { approve: 0, disapprove: 0, clueless: 0, waiting: 0, total: hods.length }
  for (const h of hods) {
    if (h.response === 'approve') s.approve++
    else if (h.response === 'disapprove') s.disapprove++
    else if (h.response === 'clueless') s.clueless++
    else s.waiting++
  }
  return s
}

export const RESPONSE_LABEL: Record<CertResponse, string> = {
  approve: 'approves',
  disapprove: 'does not approve',
  clueless: 'not sure / not involved',
}

export interface Viewer { memberId: number | null | undefined; role: string | null | undefined }

export interface Powers {
  isOwn: boolean
  isTagged: boolean
  /** HR or super admin, and not their own request, and there is text to issue. */
  canDecide: boolean
  /** Why the decide buttons are off, so the desk can say it instead of greying out silently. */
  decideBlockedReason: string | null
  canRespond: boolean
  canNote: boolean
  canSetText: boolean
  canDownload: boolean
}

/** What this viewer may do to this document. The database enforces every one of these again. */
export function powersFor(viewer: Viewer, doc: DeskDoc): Powers {
  const leader = hasLeaderAccess(viewer.role)
  const hr = isSuperAdmin(viewer.role)
  const isOwn = viewer.memberId != null && viewer.memberId === doc.memberId
  const isTagged = viewer.memberId != null && doc.hods.some(h => h.memberId === viewer.memberId)
  const pending = doc.status === 'pending'

  let decideBlockedReason: string | null = null
  if (pending && hr) {
    if (isOwn) decideBlockedReason = 'this is your own request. another HR member has to decide it.'
    else if (!doc.draft) decideBlockedReason = 'there is no text yet. paste it in, use the standard wording, or wait for the next draft.'
  }

  return {
    isOwn,
    isTagged,
    canDecide: pending && hr && !isOwn && !!doc.draft,
    decideBlockedReason,
    canRespond: pending && isTagged && !isOwn,
    canNote: pending && leader && !isOwn,
    canSetText: pending && !isOwn && (hr || isTagged),
    canDownload: doc.status === 'issued' && leader && !!doc.draft,
  }
}

/** "claims at least 40 h" plus, only when there is attendance on record, "attendance shows 12 h". */
export function hoursLine(doc: Pick<DeskDoc, 'claimedMinHours' | 'verifiedHours'>): string {
  const claim = doc.claimedMinHours != null ? `claims at least ${formatHours(doc.claimedMinHours)} h` : 'no hours claimed'
  const verified = doc.verifiedHours && doc.verifiedHours > 0
    ? `attendance shows ${formatHours(doc.verifiedHours)} h`
    : 'no attendance on record'
  return `${claim} · ${verified}`
}

export const DRAFT_SOURCE_LABEL: Record<DraftSource, string> = {
  claude: 'drafted by Claude',
  manual: 'written by a person',
  standard: 'standard wording',
}

/** Where to send a member to see their document. */
export const certificateLink = (id: number) => `/certificates/${id}`

/** A filename a person can recognise in their downloads folder. */
export function certificateFilename(typeKey: string, memberName: string): string {
  const slug = (memberName || 'member').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'member'
  return `aquaterra-${typeKey}-${slug}.pdf`
}

// ── Dates the way the templates print them ──────────────────────────────────

/** Calendar parts of an instant in India's time zone, so a document issued at 11pm IST is not dated the next day in another zone. */
function istParts(iso: string | null | undefined): { day: number; month: number; year: number } {
  const d = iso ? new Date(iso) : new Date()
  const when = Number.isNaN(d.getTime()) ? new Date() : d
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(when)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  return { day: get('day'), month: get('month'), year: get('year') }
}

/** The pieces of "16th November, 2025", so a renderer can raise the "th" the way the printed certificates do. */
export function ordinalParts(iso: string | null | undefined): { day: string; suffix: string; rest: string } {
  const { day, month, year } = istParts(iso)
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th'
  return { day: String(day), suffix, rest: ` ${MONTHS[month - 1]}, ${year}` }
}

/** "16th November, 2025": the certificates' "Date of issuance". */
export function ordinalDate(iso: string | null | undefined): string {
  const { day, suffix, rest } = ordinalParts(iso)
  return `${day}${suffix}${rest}`
}

/** "01-11-2026": the letters' date, top right. */
export function letterDate(iso: string | null | undefined): string {
  const { day, month, year } = istParts(iso)
  return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`
}
