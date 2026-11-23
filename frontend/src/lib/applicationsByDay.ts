/**
 * Applications per day, for the Approvals desk's "applications by day" window.
 *
 * An application is a members row: a first Google sign-in creates it as pending_approval (see CLAUDE.md, "Signup
 * funnel"), so created_at is the day someone applied. Days are Kolkata days, not UTC: a sign-up at 1 am IST belongs to
 * that IST date, which is the day the applicant and the HoD both think of.
 *
 * Pure, so it is tested without a database.
 */
export interface ApplicationRow { created_at: string; status: string | null }

export interface DayCount {
  /** YYYY-MM-DD in Asia/Kolkata */
  date: string
  total: number
  pending: number
  approved: number
  rejected: number
  other: number
}

export interface ApplicationsSummary {
  days: DayCount[]
  total: number
  pending: number
  approved: number
  rejected: number
  other: number
  busiest: DayCount | null
  /** Average per day over the whole window, one decimal. */
  perDay: number
}

const IST_OFFSET_MS = 330 * 60 * 1000

/** The Kolkata calendar date of an instant, as YYYY-MM-DD. */
export function istDate(iso: string | Date): string {
  const t = (typeof iso === 'string' ? new Date(iso) : iso).getTime()
  return new Date(t + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** The first instant (UTC ISO) of the Kolkata day `daysBack` days before `now`'s Kolkata day. */
export function windowStart(daysBack: number, now: Date = new Date()): string {
  const today = istDate(now)
  const startOfTodayUtc = new Date(`${today}T00:00:00.000Z`).getTime() - IST_OFFSET_MS
  return new Date(startOfTodayUtc - (daysBack - 1) * 86_400_000).toISOString()
}

function bucket(status: string | null): 'pending' | 'approved' | 'rejected' | 'other' {
  if (status === 'pending_approval') return 'pending'
  if (status === 'active') return 'approved'
  if (status === 'rejected') return 'rejected'
  return 'other'
}

/**
 * Count rows per Kolkata day over the last `days` days ending today, newest day first, with empty days filled in
 * as zero so a quiet day shows as a quiet day rather than vanishing.
 */
export function summariseApplications(rows: ApplicationRow[], days: number, now: Date = new Date()): ApplicationsSummary {
  const byDate = new Map<string, DayCount>()
  const today = istDate(now)
  const todayMs = new Date(`${today}T00:00:00.000Z`).getTime()
  for (let i = 0; i < days; i++) {
    const date = new Date(todayMs - i * 86_400_000).toISOString().slice(0, 10)
    byDate.set(date, { date, total: 0, pending: 0, approved: 0, rejected: 0, other: 0 })
  }
  for (const r of rows) {
    if (!r.created_at) continue
    const d = byDate.get(istDate(r.created_at))
    if (!d) continue
    d.total++
    d[bucket(r.status)]++
  }
  const list = [...byDate.values()]
  const sum = (k: keyof Omit<DayCount, 'date'>) => list.reduce((s, d) => s + d[k], 0)
  const total = sum('total')
  const busiest = list.reduce<DayCount | null>((best, d) => (d.total > 0 && (!best || d.total > best.total) ? d : best), null)
  return {
    days: list,
    total,
    pending: sum('pending'),
    approved: sum('approved'),
    rejected: sum('rejected'),
    other: sum('other'),
    busiest,
    perDay: days > 0 ? Math.round((total / days) * 10) / 10 : 0,
  }
}

/** "Sun 15 Nov" */
export function dayLabel(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
}
