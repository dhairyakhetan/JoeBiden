/**
 * Pure helpers for the leader view of breaks (director/BreaksOverview.tsx).
 *
 * A break is a calendar-day range, `start` to `end` inclusive, stored as `date`
 * strings (YYYY-MM-DD). "On break now" means today is inside the range;
 * "upcoming" means the range has not started yet. Dates compare as strings
 * because ISO dates sort lexically, which also keeps the day boundary free of
 * timezone surprises (the same reason breakService.isCurrentlyOnBreak compares
 * whole days).
 */

export interface BreakRow {
  id: number
  memberId: number
  start: string
  end: string
  reason: string
  note: string | null
}

export interface BreakWithMember extends BreakRow {
  fullName: string
  avatarUrl: string | null
}

/** Today as YYYY-MM-DD in the viewer's own calendar (Kolkata for nearly everyone). */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Split rows into "on break now" (soonest return first) and "upcoming"
 * (soonest start first). Finished breaks are dropped. One member with several
 * overlapping rows appears once per section, using the row that matters most:
 * the latest end while on break, the earliest start while upcoming. A member
 * who is on break now AND has a later one booked appears in both, which is the
 * point of showing upcoming separately.
 */
export function splitBreaks<T extends BreakRow>(rows: T[], today: string): { onNow: T[]; upcoming: T[] } {
  const onNowBy = new Map<number, T>()
  const upcomingBy = new Map<number, T>()
  for (const r of rows) {
    if (!r.start || !r.end || r.end < today) continue
    if (r.start <= today) {
      const cur = onNowBy.get(r.memberId)
      if (!cur || r.end > cur.end) onNowBy.set(r.memberId, r)
    } else {
      const cur = upcomingBy.get(r.memberId)
      if (!cur || r.start < cur.start) upcomingBy.set(r.memberId, r)
    }
  }
  const onNow = [...onNowBy.values()].sort((a, b) => a.end.localeCompare(b.end) || a.start.localeCompare(b.start))
  const upcoming = [...upcomingBy.values()].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))
  return { onNow, upcoming }
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** "14 nov" from "2026-11-14". Falls back to the input if it is not a date. */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return iso
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1] ?? ''}`.trim()
}

function dayNumber(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return NaN
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000)
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from)
}

/** "back on 14 nov (in 6 days)" for someone on break now. */
export function onNowLine(b: Pick<BreakRow, 'end'>, today: string): string {
  const left = daysBetween(today, b.end)
  const when = left <= 0 ? 'back tomorrow' : left === 1 ? 'back in 1 day' : `back in ${left} days`
  return `until ${shortDate(b.end)}, ${when}`
}

/** "starts 3 dec (in 12 days), back 12 dec" for a break that has not begun. */
export function upcomingLine(b: Pick<BreakRow, 'start' | 'end'>, today: string): string {
  const to = daysBetween(today, b.start)
  const when = to === 1 ? 'tomorrow' : `in ${to} days`
  return `starts ${shortDate(b.start)} (${when}), back ${shortDate(b.end)}`
}
