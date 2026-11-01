/**
 * Disco Diwali desk: types and pure logic.
 *
 * A port of the After Party desk in paradox/pages/Admin.tsx, kept free of React
 * and Supabase so the parts that can quietly go wrong (which phase is live, what
 * a message says, what lands in the CSV) can be tested without a session.
 *
 * Schema: scripts/disco_diwali_registrations_2026_10_01.sql
 */

export interface DiscoReg {
  id: string
  /** Short ID the door reads, e.g. "DD26-K3X7". Permanent once issued. */
  dd_id: string
  name: string
  phone: string
  school: string | null
  /** Instagram handle without the @, lowercase. Optional; absent on a database that has not run the instagram migration. */
  instagram?: string | null
  /** Whether they have been added to the account's Instagram Close Friends list. A to-do the desk ticks off. */
  ig_close_friend?: boolean
  /** The name on the ticket was changed after booking. Defaults to false; absent on a database that has not run the name_changed migration. */
  name_changed?: boolean
  /** Date of birth as yyyy-mm-dd. Optional personal data; some guests are minors. */
  dob?: string | null
  /** The `key` of a DiscoPhase. Free-form so an admin can add phases. */
  phase: string
  amount: number | null
  paid: boolean
  attended: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DiscoPhase {
  /** [a-z0-9_]+, matching the DB constraint. */
  key: string
  label: string
  amount: number
  /** yyyy-mm-dd (IST). null means "open from the start". */
  opensAt: string | null
  /** Sold out or shut by hand. Overrides the date. */
  closedManually: boolean
}

export const DD_SETTINGS_PHASES = 'dd_phases'
export const DD_SETTINGS_THANKYOU = 'dd_thankyou_msg'
export const DD_SETTINGS_THANKYOU_MULTI = 'dd_thankyou_multi'

export const DD_ID_PREFIX = 'DD26'

/** One phase to start: the TerraThon Special at Rs 550, open from the start. Add more in "Edit phases". */
export const DD_PHASES_DEFAULT: DiscoPhase[] = [
  { key: 'terrathon_special', label: 'TerraThon Special', amount: 550, opensAt: null, closedManually: false },
]

/** Date is 10 Nov; the venue is still TBD, so the message says so. Edit in the desk once it is known. */
export const DD_THANKYOU_DEFAULT =
`Hi {name}! 🎉 Your Disco Diwali ticket is confirmed.

★ Booking ID: {id}
★ Phase: {phase} · ₹{amount}
★ Date: 10th Nov
★ Venue: TBD, we'll message you as soon as it's confirmed

Show this ID at the door.

See you there!
— Team AQ`

export const DD_THANKYOU_MULTI_DEFAULT =
`Hi {names}! 🎉 Your {count} Disco Diwali bookings are confirmed.

★ Booking IDs:
{tickets}

★ Total: ₹{total}
★ Date: 10th Nov
★ Venue: TBD, we'll message you as soon as it's confirmed

Show your IDs at the door.

See you there!
— Team AQ`

/**
 * Turn whatever was typed or pasted into a bare Instagram handle: "@riya.das", "Riya.Das", "instagram.com/riya.das/",
 * "https://www.instagram.com/riya.das?igsh=abc". Empty input is fine and means "none". Anything that is not a legal handle
 * (letters, digits, dots, underscores, 1 to 30 characters, no leading, trailing or doubled dot) comes back as an error and
 * never as a guess.
 */
export function normaliseInstagram(raw: string | null | undefined): { handle: string | null; error: string | null } {
  let s = (raw ?? '').trim()
  if (!s) return { handle: null, error: null }
  s = s.replace(/^https?:\/\//i, '').replace(/^(www\.|m\.)?instagram\.com\//i, '')
  s = s.split(/[/?#]/)[0].replace(/^@+/, '').trim().toLowerCase()
  if (!s) return { handle: null, error: 'That is not an Instagram handle.' }
  if (!/^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/.test(s)) {
    return { handle: null, error: 'Use letters, numbers, dots and underscores only (max 30).' }
  }
  return { handle: s, error: null }
}

/**
 * The "date of birth" box is a NOTE, not a date (owner, 2026-10-25: "it is like a note so keep it to that"). Whatever the person at the
 * door types is stored and shown back as typed: "14 May 2008", "class 8", "~2012", "ask mum". Nothing parses it, formats it or calls it
 * invalid. Only two things are done to it: surrounding spaces are trimmed, and an empty box means "nothing" (null), so the database
 * never holds an empty string. The cap matches the database CHECK (1 to 80 characters).
 */
export const DOB_NOTE_MAX = 80
export function cleanDobNote(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim()
  return s ? s.slice(0, DOB_NOTE_MAX) : null
}

/** People who gave an Instagram handle and are not yet in Close Friends: the checklist the desk works down. */
export const closeFriendsToAdd = (regs: DiscoReg[]): DiscoReg[] => regs.filter((r) => !!r.instagram && !r.ig_close_friend)

export const instagramUrl = (handle: string): string => `https://instagram.com/${handle}`

/** True when the notes mention cash: the door has to collect or verify these. */
export const hasCashNote = (notes: string | null | undefined): boolean =>
  !!notes && /cash/i.test(notes)

/** Today in IST as yyyy-mm-dd. Phases open on an IST calendar day, not the admin's local one. */
export function istDateKey(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

/** Sanitise whatever is stored. Skips rows without a usable key; falls back to the default if none survive. */
export function parsePhases(raw: unknown): DiscoPhase[] {
  if (!Array.isArray(raw)) return DD_PHASES_DEFAULT
  const out: DiscoPhase[] = []
  const seen = new Set<string>()
  for (const r of raw as any[]) {
    if (!r || typeof r !== 'object') continue
    const key = typeof r.key === 'string' && /^[a-z0-9_]+$/.test(r.key) ? r.key : null
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push({
      key,
      label: typeof r.label === 'string' && r.label.trim() ? r.label : key,
      amount: Number.isFinite(r.amount) && r.amount >= 0 ? Number(r.amount) : 0,
      opensAt: typeof r.opensAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.opensAt) ? r.opensAt : null,
      closedManually: typeof r.closedManually === 'boolean' ? r.closedManually : false,
    })
  }
  return out.length > 0 ? out : DD_PHASES_DEFAULT
}

/**
 * The phase that is selling right now: the LAST one, in list order, that is not
 * closed and has opened (null opensAt counts as already open). null when every
 * phase is closed or still upcoming.
 */
export function computeLivePhase(phases: DiscoPhase[], now: Date = new Date()): DiscoPhase | null {
  const today = istDateKey(now)
  for (let i = phases.length - 1; i >= 0; i--) {
    const p = phases[i]
    if (p.closedManually) continue
    if (p.opensAt === null || p.opensAt <= today) return p
  }
  return null
}

/** Next unused `phase_N` key. */
export function nextPhaseKey(phases: DiscoPhase[]): { key: string; n: number } {
  const used = new Set(phases.map((p) => p.key))
  const nums = phases
    .map((p) => /^phase_(\d+)$/.exec(p.key))
    .map((m) => (m ? parseInt(m[1], 10) : 0))
    .filter((n) => n > 0)
  let n = (nums.length > 0 ? Math.max(...nums) : phases.length) + 1
  while (used.has(`phase_${n}`)) n += 1
  return { key: `phase_${n}`, n }
}

// No 0/1/I/O/L: they look alike read off a phone screen under club lighting.
const ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

/** `DD26-` plus 4 characters. Uses crypto, so two admins adding at once do not share a seed. */
export function generateDdId(): string {
  const buf = new Uint32Array(4)
  crypto.getRandomValues(buf)
  let s = ''
  for (const n of buf) s += ID_ALPHABET[n % ID_ALPHABET.length]
  return `${DD_ID_PREFIX}-${s}`
}

const phaseLabel = (phases: DiscoPhase[], key: string) =>
  phases.find((p) => p.key === key)?.label ?? key

/** "A", "A & B", "A, B & C". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

/**
 * Fill a template. One row uses the single template, two or more use the
 * consolidated one. Replacement is a single pass over the placeholders, so a
 * guest called "{total}" cannot have their name expanded into something else.
 */
export function composeThankYou(
  regs: DiscoReg[],
  phases: DiscoPhase[],
  single: string,
  multi: string,
): string {
  if (regs.length === 0) return ''
  const fill = (tpl: string, vars: Record<string, string>) =>
    tpl.replace(/\{(\w+)\}/g, (whole, k: string) => (k in vars ? vars[k] : whole))

  if (regs.length === 1) {
    const r = regs[0]
    return fill(single, {
      name: r.name,
      id: r.dd_id,
      phase: phaseLabel(phases, r.phase),
      amount: String(r.amount ?? ''),
    })
  }
  const total = regs.reduce((s, r) => s + (r.amount ?? 0), 0)
  return fill(multi, {
    names: joinNames(regs.map((r) => r.name)),
    tickets: regs
      .map((r) => `• ${r.name} — ${r.dd_id} (${phaseLabel(phases, r.phase)}, ₹${r.amount ?? '?'})`)
      .join('\n'),
    total: total.toLocaleString('en-IN'),
    count: String(regs.length),
  })
}

export type DiscoSort = 'recent' | 'name' | 'unchecked' | 'checked' | 'unpaid'
export type DiscoFilter = 'all' | 'unchecked' | 'checked' | 'unpaid' | 'cash' | 'closefriends'

/** Search, filter and sort. Drives both the table and the door view so they never disagree. */
export function viewRegs(regs: DiscoReg[], search: string, filter: DiscoFilter, sort: DiscoSort): DiscoReg[] {
  const q = search.trim().toLowerCase()
  const list = regs.filter((r) => {
    if (q && !`${r.name} ${r.phone} ${r.school ?? ''} ${r.instagram ?? ''} ${r.dd_id}`.toLowerCase().includes(q)) return false
    if (filter === 'unchecked' && r.attended) return false
    if (filter === 'checked' && !r.attended) return false
    if (filter === 'unpaid' && r.paid) return false
    if (filter === 'cash' && !hasCashNote(r.notes)) return false
    if (filter === 'closefriends' && !(r.instagram && !r.ig_close_friend)) return false
    return true
  })
  const byName = (a: DiscoReg, b: DiscoReg) => a.name.localeCompare(b.name)
  const byRecent = (a: DiscoReg, b: DiscoReg) => Date.parse(b.created_at) - Date.parse(a.created_at)
  const out = [...list]
  switch (sort) {
    case 'name': return out.sort(byName)
    case 'unchecked': return out.sort((a, b) => Number(a.attended) - Number(b.attended) || byName(a, b))
    case 'checked': return out.sort((a, b) => Number(b.attended) - Number(a.attended) || byName(a, b))
    case 'unpaid': return out.sort((a, b) => Number(a.paid) - Number(b.paid) || byName(a, b))
    default: return out.sort(byRecent)
  }
}

/** Checked-in and total per phase key, in first-seen order. */
export function phaseCounts(regs: DiscoReg[]): Map<string, { checked: number; total: number }> {
  const m = new Map<string, { checked: number; total: number }>()
  for (const r of regs) {
    const c = m.get(r.phase) ?? { checked: 0, total: 0 }
    c.total += 1
    if (r.attended) c.checked += 1
    m.set(r.phase, c)
  }
  return m
}

/**
 * One CSV cell. Quotes everything and doubles embedded quotes. A cell that
 * starts with = + - @ (or tab / CR) is prefixed with an apostrophe: names and
 * notes here are typed by hand from WhatsApp, and Excel runs a leading "=" as a
 * formula when the file is opened.
 */
export function csvCell(v: string | number | boolean | null | undefined): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

export function buildCsv(regs: DiscoReg[], phases: DiscoPhase[]): string {
  const headers = ['#', 'ID', 'Name', 'Phone', 'Instagram', 'Close friends', 'DOB', 'School', 'Phase', 'Amount', 'Paid', 'Attended', 'Added by', 'Added at', 'Notes']
  const lines = regs.map((r, i) =>
    [
      i + 1, r.dd_id, r.name, r.phone, r.instagram ?? '', r.instagram ? (r.ig_close_friend ? 'yes' : 'no') : '', r.dob ?? '', r.school, phaseLabel(phases, r.phase), r.amount,
      r.paid ? 'yes' : 'no', r.attended ? 'yes' : 'no', r.created_by, r.created_at, r.notes,
    ].map(csvCell).join(','),
  )
  return [headers.map(csvCell).join(','), ...lines].join('\n')
}

/** The last ten digits of a phone, whatever it was typed or stored as. Used to compare numbers. */
export const phoneKey = (raw: string | null | undefined): string => (raw ?? '').replace(/\D/g, '').slice(-10)

/** Every registration on the same number. A buyer logging several tickets is normal, so this informs and never blocks. */
export function findByPhone(regs: DiscoReg[], raw: string): DiscoReg[] {
  const k = phoneKey(raw)
  return k.length === 10 ? regs.filter((r) => phoneKey(r.phone) === k) : []
}

/**
 * Pull a name and a mobile number out of whatever was copied from WhatsApp or a
 * contact card: "Riya Das 98300 11111", "Riya Das: +91 98300-11111",
 * "98300 11111 Riya". Takes the first line that has a number in it. Returns the
 * ten digits (no +91) and the leftover text as the name; either can come back
 * empty, so the caller fills in only what was found.
 */
export function parseEntry(text: string): { name: string; phone: string; instagram?: string } | null {
  // An @handle anywhere in the paste is lifted out first, so it never ends up inside the name.
  let instagram: string | undefined
  text = text.replace(/(^|\s)@([A-Za-z0-9._]{1,30})(?=\s|$)/, (_m, pre: string, h: string) => {
    const n = normaliseInstagram(h)
    if (n.handle) instagram = n.handle
    return pre
  })
  const withIg = <T extends object>(o: T): T & { instagram?: string } => (instagram ? { ...o, instagram } : o)
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/(?:\+?\s*91[\s-]*|\b0)?[6-9](?:[\s-]*\d){9}/)
    if (!m) continue
    let d = m[0].replace(/\D/g, '')
    if (d.length > 10 && d.startsWith('91')) d = d.slice(2)
    if (d.length > 10 && d.startsWith('0')) d = d.slice(1)
    d = d.slice(-10)
    const name = (line.slice(0, m.index) + ' ' + line.slice((m.index ?? 0) + m[0].length))
      .replace(/[:;,|\-–—()[\]]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return withIg({ name, phone: d })
  }
  const only = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean)
  return only ? withIg({ name: only.replace(/\s+/g, ' ').slice(0, 120), phone: '' }) : (instagram ? { name: '', phone: '', instagram } : null)
}
