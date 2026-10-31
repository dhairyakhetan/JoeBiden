/** Formatting helpers. Pure functions, unit-tested in __tests__/format.test.ts. */

export function rupees(n: number | null | undefined): string {
  if (n == null) return '-'
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

/** Normalises whatever a captain typed into the +91XXXXXXXXXX the server stores. */
export function normalisePhone(raw: string): string | null {
  let d = (raw || '').replace(/[^0-9]/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  if (!/^[6-9][0-9]{9}$/.test(d)) return null
  return `+91${d}`
}

/**
 * Make a pasted Indian mobile number usable instead of rejecting it.
 *
 * The field sits beside a +91 chip, so the numbers people paste carry one:
 * "+91 98305 54654", "091-98305-54654", "98305 54654". All of them are the
 * same ten digits wearing different clothes, and the form used to take the
 * raw string, which meant a paste either failed validation or, worse, got
 * silently cut to eleven characters of nonsense by maxLength.
 *
 * Strip everything that is not a digit, drop a leading country or trunk code,
 * then keep at most ten. It never rejects: a partial number stays partial so
 * somebody mid-type is not fighting the field, and the real check still runs
 * on submit and again in the database.
 */
export function tidyPhone(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.length > 10 && d.startsWith('91')) d = d.slice(2)   // +91 98305 54654
  if (d.length > 10 && d.startsWith('0')) d = d.slice(1)    // 098305 54654
  return d.slice(0, 10)
}

export function prettyPhone(stored: string): string {
  const d = stored.replace(/[^0-9]/g, '').slice(-10)
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : stored
}

/** `wa.me` wants a bare country-code-prefixed number with no plus or spaces. */
export function waNumber(stored: string): string {
  return stored.replace(/[^0-9]/g, '').slice(-10).padStart(12, '91')
}

const IST_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata',
}
const IST_DATETIME: Intl.DateTimeFormatOptions = {
  day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  hour12: true, timeZone: 'Asia/Kolkata',
}

export function istDate(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Intl.DateTimeFormat('en-IN', IST_DATE).format(new Date(iso))
}

export function istDateTime(iso: string | null | undefined): string {
  if (!iso) return '-'
  return new Intl.DateTimeFormat('en-IN', IST_DATETIME).format(new Date(iso))
}

/** "Fri 2 Oct" for a single day, "Sat 3 + Sun 4 Oct" across two. */
export function dayRange(first: string | null, last: string | null): string {
  if (!first) return 'Date TBA'
  if (!last || last === first) return istDate(first)
  return `${istDate(first)} + ${istDate(last)}`
}

/**
 * How many days an event runs, for one event.
 *
 * `+` and not `to` on purpose: an event with two days listed runs on BOTH of
 * them, and "Sat, 3 Oct to Sun, 4 Oct" reads like a range you pick from.
 * For a span across several events, which is a range, use daySpan().
 */
/**
 * The whole festival's span, first day to last.
 *
 * This is NOT dayRange. The schedule hero was passing the festival's first and
 * last day to dayRange and rendering "Fri, 2 Oct + Sun, 4 Oct", which names the
 * two ends of a THREE day weekend and reads as though nothing happens on the
 * Saturday, the busiest day of the three.
 */
export function daySpan(first: string | null, last: string | null): string {
  if (!first) return 'Dates TBA'
  if (!last || last === first) return istDate(first)
  return `${istDate(first)} to ${istDate(last)}`
}

/**
 * How many people make up an entry, in the site's own words.
 *
 * This existed three times with two different answers. SportCard and the sport
 * header both said "7 + 1", while the register form said "7-8 a side", which
 * is the phrasing the organisers asked to drop: it reads as a squad of seven
 * OR eight rather than seven players and one substitute, and on pickleball,
 * where min and max are both 2, it rendered the plainly silly "2-2 a side".
 */
export function squadLabel(e: { team_size_min: number; team_size_max: number }): string {
  if (e.team_size_max === 1) return 'Solo'
  if (e.team_size_min === e.team_size_max) return `${e.team_size_max} players`
  return `${e.team_size_min} + ${e.team_size_max - e.team_size_min}`
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  // Clamp a negative delta (the timestamp is "in the future" relative to
  // `now`) to zero before branching. Callers on this desk feed an
  // uncorrected device clock, and without this a laptop running merely a
  // few minutes behind reports a genuinely old registration as "just now"
  // no matter how large the gap actually is, since `secs < 45` is also true
  // for any negative number.
  const secs = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000))
  if (secs < 45) return 'just now'
  if (secs < 5400) return `${Math.round(secs / 60)} min ago`
  if (secs < 86400) return `${Math.round(secs / 3600)} h ago`
  return `${Math.round(secs / 86400)} d ago`
}

/**
 * The label shown everywhere a status appears. Derived, never read straight off
 * `registrations.status`, because "Hold expired" is a fact of the clock that
 * nothing writes down: the database has no process that flips a row when a hold
 * lapses. Computing it here keeps the admin table, the export and the ticket
 * page from disagreeing with each other.
 */
export function statusLabel(r: {
  status: string
  paid: boolean
  utr: string | null
  hold_expires_at: string | null
}, now: Date = new Date()): string {
  if (r.status === 'cancelled') return 'Cancelled'
  if (r.status === 'waitlist') return 'Waitlist'
  if (r.paid) return 'Confirmed'
  if (r.hold_expires_at && new Date(r.hold_expires_at) < now) return 'Hold expired'
  if (r.utr) return 'Payment claimed'
  return 'Pending payment'
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}


/**
 * A venue that is really a clock time ("11:11") is a data slip, not a place: the events table had exactly that for
 * pickleball. Treat it as no venue so every page says "to be confirmed" instead of printing a time as an address.
 */
export function cleanVenue(v: string | null | undefined): string | null {
  const t = (v ?? '').trim()
  if (!t || /^\d{1,2}\s*[:.]\s*\d{2}(\s*[ap]m)?$/i.test(t)) return null
  return t
}

const DAY_PREFIX = /^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+(.+)$/i

/**
 * The part of a match window that applies to one day. A window is either one range for every day ("12pm to 7pm") or
 * comma-separated ranges each led by a weekday ("Sat 10am to 4pm, Sun 10am to 2pm"). Anything that does not follow
 * that shape is returned whole rather than guessed at.
 */
export function windowForDay(window: string | null | undefined, iso: string): string | null {
  if (!window) return null
  const parts = window.split(/[,;]/).map((x) => x.trim()).filter(Boolean)
  const tagged = parts.map((x) => { const m = DAY_PREFIX.exec(x); return m ? { day: m[1].toLowerCase(), text: m[2] } : null })
  if (!tagged.length || tagged.some((t) => !t)) return window
  const wd = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(`${iso}T00:00:00Z`)).toLowerCase()
  return tagged.find((t) => t && t.day === wd)?.text ?? window
}

/** Minutes after midnight for "9:45 am" / "11.30am" / "12pm", or null. Used to order a day's rows. */
export function clockMinutes(t: string | null | undefined): number | null {
  const m = /(\d{1,2})(?:\s*[:.]\s*(\d{2}))?\s*(am|pm)/i.exec(t ?? '')
  if (!m) return null
  let h = Number(m[1]) % 12
  if (m[3].toLowerCase() === 'pm') h += 12
  return h * 60 + Number(m[2] ?? 0)
}
