import type { CvRecord } from '../services/cvService'

/**
 * cv.ts — the pure half of FR9 ("geneate CV button", user 2026-09-05).
 *
 * `cvService` fetches; this file decides what the document says. It is pure so
 * the one rule that actually matters here is testable: **a CV states only what
 * the member's AquaTerra record contains.** Concretely, and enforced by
 * `cv.test.ts`:
 *
 *   • An absent value produces NO line. Not "—", not "N/A", not a zero.
 *   • A section with no entries is dropped entirely, not rendered empty.
 *   • Zero drives produces no hours line at all. A rendered "0 hours" is a
 *     claim about the member (guardrails §1 rule 4), and the wrong one.
 *   • `undercounted` hours are printed with a "+" and an explicit note that
 *     the figure is a floor, because the derivation falls back to a drive's
 *     scheduled duration when a personal checkout is missing.
 *
 * Nothing in this file reaches the network, reads a token, or formats for
 * print — `CvSheet` owns the markup and `styles/routes/profile.css` owns the
 * @media print rules.
 */

export interface CvIdentity {
  fullName: string
  /** Display label from lib/roles.getRoleLabel — never a raw role string. */
  roleLabel: string | null
  classGrade?: string | null
  email?: string | null
  phone?: string | null
  bio?: string | null
  instagram?: string | null
  linkedin?: string | null
  /** members.created_at — the start of tenure. */
  joinedAt?: string | null
}

/** A label/value pair in the contact block. Only ever built for present values. */
export interface CvLine { label: string; value: string }

/** One item in a listed section (a team, an achievement, a record line). */
export interface CvEntry {
  title: string
  /** Secondary line: dates, category, role on the team. Omitted when unknown. */
  meta?: string
  /** Free text. Omitted when the source field is empty. */
  body?: string
}

export interface CvSection {
  key: string
  heading: string
  entries: CvEntry[]
}

/** Trim to a real string, or null. Whitespace-only counts as absent. */
export function present(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "2024-07-19" or an ISO timestamp → "Jul 2024". Returns null for anything
 * unparseable so a bad row drops its date rather than printing "Invalid Date".
 * Parsed off the leading YYYY-MM rather than through Date so a plain date
 * string cannot shift a month across a timezone boundary.
 */
export function formatCvMonth(value?: string | null): string | null {
  const raw = present(value)
  if (!raw) return null
  const match = /^(\d{4})-(\d{2})/.exec(raw)
  if (!match) return null
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  if (monthIndex < 0 || monthIndex > 11) return null
  return `${MONTHS[monthIndex]} ${year}`
}

/**
 * A date range. One end alone is still useful ("from Jul 2024"), both ends
 * identical collapses to a single month, and neither end yields null.
 * En dash, not an em dash (guardrails §1 rule 7).
 */
export function formatCvRange(start?: string | null, end?: string | null): string | null {
  const from = formatCvMonth(start)
  const to = formatCvMonth(end)
  if (from && to) return from === to ? from : `${from} – ${to}`
  if (from) return `from ${from}`
  if (to) return `until ${to}`
  return null
}

/** A whole number, or null for anything else (including NaN, Infinity, non-numbers). */
function presentYear(value?: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * A year range for education entries ("years attended" - a school transcript
 * says "2018 – 2022", not a month). Same shape as formatCvRange: one end
 * alone is still useful, both ends identical collapses to a single year,
 * neither end yields null. En dash, not an em dash (guardrails §1 rule 7).
 * Plain years rather than dates because nobody enrols or graduates on a
 * specific day - formatCvMonth/formatCvRange are month-precision date-string
 * parsers and are the wrong tool for this field.
 */
export function formatCvYearRange(startYear?: number | null, endYear?: number | null): string | null {
  const from = presentYear(startYear)
  const to = presentYear(endYear)
  if (from != null && to != null) return from === to ? `${from}` : `${from} – ${to}`
  if (from != null) return `from ${from}`
  if (to != null) return `until ${to}`
  return null
}

/** 'personal_project' → 'personal project'. Types are stored snake_case. */
function humanizeType(type?: string | null): string | null {
  const raw = present(type)
  return raw ? raw.replace(/_/g, ' ') : null
}

/** Joins the parts of a meta line that actually exist. Returns undefined if none do. */
function metaLine(parts: (string | null | undefined)[]): string | undefined {
  const kept = parts.map(p => present(p)).filter((p): p is string => p !== null)
  return kept.length > 0 ? kept.join(' · ') : undefined
}

/**
 * The contact block. Every line is conditional; a member who has filled in
 * nothing but their name gets an empty array and no block at all.
 *
 * Email and phone are the member's OWN, read from their own auth session
 * (`get_own_member`), and the document never leaves their browser unless they
 * print it — this is the one surface where showing them is the point.
 */
export function buildCvContact(identity: CvIdentity): CvLine[] {
  const lines: CvLine[] = []
  const add = (label: string, value?: string | null) => {
    const v = present(value)
    if (v) lines.push({ label, value: v })
  }
  add('email', identity.email)
  add('phone', identity.phone)
  add('class', identity.classGrade)
  add('linkedin', identity.linkedin)
  add('instagram', identity.instagram)
  return lines
}

/**
 * The sections, in document order, with empty ones already removed.
 * Callers render exactly what they are handed and add nothing.
 */
export function buildCvSections(identity: CvIdentity, record: CvRecord): CvSection[] {
  const sections: CvSection[] = []

  // ── About ────────────────────────────────────────────────────────────
  const bio = present(identity.bio)
  if (bio) {
    sections.push({ key: 'about', heading: 'about', entries: [{ title: bio }] })
  }

  // ── Education ────────────────────────────────────────────────────────
  // cvService.getEducation already orders most-recent-first. A member with
  // no entries yet gets no section at all, same omit-when-empty rule as
  // everywhere else in this function.
  if (record.education.length > 0) {
    sections.push({
      key: 'education',
      heading: 'education',
      entries: record.education.map(edu => {
        const gradeNote = present(edu.grade)
        return {
          title: edu.institution,
          meta: metaLine([
            edu.credential,
            formatCvYearRange(edu.startYear, edu.endYear),
            gradeNote ? `Grade: ${gradeNote}` : null,
          ]),
        }
      }),
    })
  }

  // ── The AquaTerra record ─────────────────────────────────────────────
  const recordEntries: CvEntry[] = []

  const since = formatCvMonth(identity.joinedAt)
  const roleLabel = present(identity.roleLabel)
  if (since || roleLabel) {
    recordEntries.push({
      title: roleLabel ? `${roleLabel}, AquaTerra` : 'AquaTerra',
      meta: since ? `member since ${since}` : undefined,
    })
  }

  // Zero drives means no hours line. Printing "0 hours" would be a claim, and
  // a member who has volunteered but whose drives predate check-in tracking
  // would be actively misrepresented by it.
  const { hours } = record
  if (hours.driveCount > 0) {
    const total = `${hours.totalHours}${hours.undercounted ? '+' : ''} hours volunteered`
    const drives = `${hours.driveCount} drive${hours.driveCount === 1 ? '' : 's'}`
    recordEntries.push({
      title: total,
      meta: metaLine([drives, formatCvRange(hours.earliestDate, hours.latestDate)]),
      body: hours.undercounted
        ? 'Some drives were counted from their scheduled duration because no personal check-out was recorded, so this total is a floor.'
        : undefined,
    })
  }

  if (recordEntries.length > 0) {
    sections.push({ key: 'record', heading: 'volunteering with aquaterra', entries: recordEntries })
  }

  // ── Teams ────────────────────────────────────────────────────────────
  if (record.teams.length > 0) {
    sections.push({
      key: 'teams',
      heading: record.teams.length === 1 ? 'team' : 'teams',
      entries: record.teams.map(team => ({
        title: team.name,
        meta: metaLine([
          team.roleInTeam === 'lead' ? 'team lead' : null,
          team.category,
          formatCvMonth(team.joinedAt) ? `joined ${formatCvMonth(team.joinedAt)}` : null,
        ]),
      })),
    })
  }

  // ── Achievements ─────────────────────────────────────────────────────
  // cvService has already filtered to status='approved'. This function never
  // sees a pending or rejected row, and must never be handed one.
  if (record.achievements.length > 0) {
    sections.push({
      key: 'achievements',
      heading: 'achievements',
      entries: record.achievements.map(a => ({
        title: a.title,
        // A one-off achievement has no end date and is a point in time, so it
        // reads "Apr 2025" - `formatCvRange` would render "from Apr 2025",
        // which claims an ongoing thing the record does not say.
        meta: metaLine([
          humanizeType(a.type),
          present(a.endDate) ? formatCvRange(a.date, a.endDate) : formatCvMonth(a.date),
        ]),
        body: present(a.description) ?? undefined,
      })),
    })
  }

  return sections
}

/** "Ananya Sen" → "ananya-sen-aquaterra-cv". Used for the print document title. */
export function cvFileName(fullName?: string | null): string {
  const slug = (present(fullName) ?? 'member')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'member'}-aquaterra-cv`
}
