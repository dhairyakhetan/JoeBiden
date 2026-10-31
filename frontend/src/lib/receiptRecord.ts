/**
 * The first sign-in receipt — the pure layer. Section 12 of the redesign
 * changelog, design reference AQ Receipt.dc.html (R1, R2).
 *
 * The receipt is a PROVENANCE DOCUMENT. Its whole point is that every row
 * names where its value came from, so this file turns one `members` row into
 * an ordered list of rows, each carrying its own source string. The component
 * renders that list and does not know how to invent a value.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE RULE THIS FILE EXISTS TO ENFORCE: never render a figure with no source.
 *
 * `1,247` is on the canvas twice, as "member no 1247" and as "keep this.
 * you're number 1,247." It was invented, and `github.md` records it spreading
 * to seven places as a fake member count. The canonical public headcount is
 * displayCount(ORG_FACTS.membersTotal) (lib/orgFacts.ts), and a member number is not a count.
 *
 * So: a row whose value cannot be sourced renders `null`, and the component
 * renders the dashed live marker for it. There is no default, no placeholder
 * and no sample. `buildReceiptRows` never returns a string it was not given.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THE REFERRED-BY ROW DOES NOT NAME THE REFERRER.
 *
 * There is no opt-in-to-be-named column on `members`, and `lib/referrals.ts`
 * constraint 1 forbids exposing the referrer to the person being referred.
 * The canvas prints "referred by  Aarushi Jain"; this prints "on a member's
 * invite", which is the same fact minus the disclosure. The row is omitted
 * entirely when `referred_by` is null, rather than printed as "nobody".
 */

/** The subset of a `members` row the receipt reads. */
export interface ReceiptSource {
  full_name: string | null
  email: string | null
  class_grade: string | null
  phone: string | null
  status: string | null
  created_at: string | null
  member_no: number | null
  referred_by: number | null
  /** The primary `team_members` team name, when the member has one. */
  deskName?: string | null
}

export interface ReceiptRow {
  /** The mono label printed in the left column. Lowercase, as on the canvas. */
  key: string
  /**
   * The printed value, or null when it could not be sourced. Null renders the
   * dashed live marker, never a placeholder.
   */
  value: string | null
  /**
   * Where the value came from, in the database's own words. Rendered as the
   * row's title attribute and listed in the changelog's provenance table.
   * This is the field that makes the receipt a provenance document.
   */
  source: string
  /** Set on the two rows the canvas emphasises: the number and the name. */
  strong?: boolean
}

/** "03 Sep 2026, 09:41", the canvas format. Locale-stable, no em dash. */
export function formatReceiptTimestamp(iso: string | null): string | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const d = new Date(t)
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${date}, ${time}`
}

/**
 * The member number, printed. Returned as a plain decimal string with no
 * thousands separator: it is an identifier, not a quantity, and a comma is
 * what made `1,247` read as a headcount in the first place.
 */
export function formatMemberNo(n: number | null): string | null {
  return typeof n === 'number' && Number.isFinite(n) ? String(n) : null
}

/**
 * The slip's reference line, printed under the rows where the canvas draws a
 * barcode. `AQ-<member no>` and nothing else: the canvas's `AQ-1247-WLF`
 * appended a desk code that no column produces. Returns null with no member
 * number, so the line is omitted rather than printed as `AQ-`.
 */
export function receiptReference(memberNo: number | null): string | null {
  const n = formatMemberNo(memberNo)
  return n ? `AQ-${n}` : null
}

/**
 * The handwritten line at the foot of the slip. The canvas reads "keep this.
 * you're number 1,247." Without a real member number there is no line, rather
 * than a line with an invented number in it.
 */
export function receiptSignoff(memberNo: number | null): string | null {
  const n = formatMemberNo(memberNo)
  return n ? `keep this. you're number ${n}.` : null
}

/** Status, printed as the canvas prints it: one word, upper case. */
export function formatStatus(status: string | null): string | null {
  if (!status) return null
  return status.replace(/_/g, ' ').toUpperCase()
}

/**
 * The stamp beside the status. `pending_approval` gets the canvas's "with hr";
 * everything else gets its own word. Never invents a state.
 */
export function receiptStamp(status: string | null): string | null {
  switch (status) {
    case 'pending_approval': return 'with hr'
    case 'active': return 'approved'
    case 'rejected': return 'not this round'
    case 'suspended': return 'on hold'
    default: return null
  }
}

/**
 * The ordered rows, with provenance. Rows whose value is null still render,
 * carrying the dashed live marker, EXCEPT the two that are meaningless when
 * absent: `desk` (a new member has no team yet) and `referred by` (most
 * members were not referred). Printing "referred by: none" on every receipt
 * would turn a fact into a small accusation.
 */
export function buildReceiptRows(src: ReceiptSource): ReceiptRow[] {
  const rows: ReceiptRow[] = [
    { key: 'name',  value: src.full_name || null,  source: 'members.full_name, written by /register', strong: true },
    { key: 'email', value: src.email || null,      source: 'the Google identity that signed in' },
    { key: 'class', value: src.class_grade || null, source: 'members.class_grade, written by /register' },
    { key: 'phone', value: src.phone || null,      source: 'members.phone, written by /register' },
  ]

  if (src.deskName) {
    rows.push({ key: 'desk', value: src.deskName, source: 'the primary team_members row' })
  }

  rows.push({
    key: 'joined',
    value: formatReceiptTimestamp(src.created_at),
    source: 'members.created_at, the row timestamp',
  })

  if (src.referred_by !== null && src.referred_by !== undefined) {
    rows.push({
      key: 'referred by',
      // Deliberately not the referrer's name. See the header note.
      value: "on a member's invite",
      source: 'members.referred_by, the referring member is not named',
    })
  }

  rows.push({
    key: 'member no',
    value: formatMemberNo(src.member_no),
    source: 'members.member_no, the sequence, assigned in join order',
    strong: true,
  })

  return rows
}

/**
 * The once-only guard. Persisted, not session scoped: the spec is "fires once,
 * on the first authenticated render after a member row is created. Never on
 * subsequent sign-ins", and a sessionStorage flag reprints the receipt every
 * time the tab is replaced.
 *
 * Keyed per member uuid, so two people sharing a browser each get their own
 * one showing, and one person clearing site data gets it once more rather
 * than never again on a new device.
 *
 * Every access is wrapped: a private window throws on localStorage, and the
 * correct behaviour there is to skip the receipt, not to crash the first
 * screen a new member ever sees.
 */
const RECEIPT_FLAG = 'aq_receipt_printed_v1'

function readFlags(): string[] {
  try {
    const raw = typeof window === 'undefined' ? null : localStorage.getItem(RECEIPT_FLAG)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}

export function hasPrintedReceipt(memberUuid: string): boolean {
  return readFlags().includes(memberUuid)
}

export function markReceiptPrinted(memberUuid: string): void {
  try {
    if (typeof window === 'undefined') return
    const flags = readFlags()
    if (flags.includes(memberUuid)) return
    // Capped: this is a shared-device list, not a history. Ten is well past
    // any real shared browser and stops the key growing without bound.
    localStorage.setItem(RECEIPT_FLAG, JSON.stringify([...flags, memberUuid].slice(-10)))
  } catch { /* private mode: the receipt simply does not persist its flag */ }
}
