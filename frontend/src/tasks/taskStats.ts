/**
 * Numbers about tasks (slice 4): how much is open, how much finished on time, how often a date moved.
 * Pure functions over the tasks the viewer can already see, so they add no data access: a member sees their own
 * record, a team page sees that team's tasks, and a private task never reaches anyone it was not already visible to.
 * (An organisation-wide view for HR and super admin that counts private tasks without showing them needs a database
 * function and is not built; see docs/plans/task-tracker.md.)
 */
import { dueState, type Task } from './taskModel'

const DAY_MS = 24 * 60 * 60 * 1000

export interface TaskStats {
  /** Not finished: open, in progress or blocked. */
  open: number
  blocked: number
  done: number
  overdue: number
  dueSoon: number
  /** Finished tasks that had a due date, split by whether they made it. */
  onTime: number
  late: number
  /** Tasks whose due date was moved at least once. */
  moved: number
  /** onTime / (onTime + late), or null when nothing with a due date has finished yet. */
  onTimeRate: number | null
  /** Mean days past the due date over the late ones, or null when none were late. */
  avgDaysLate: number | null
}

export function statsFor(tasks: Task[], now: Date = new Date()): TaskStats {
  let open = 0, blocked = 0, done = 0, overdue = 0, dueSoon = 0, onTime = 0, late = 0, moved = 0, lateDays = 0
  for (const t of tasks) {
    if (t.dueMoves > 0) moved++
    if (t.status === 'done') done++
    else {
      open++
      if (t.status === 'blocked') blocked++
    }
    const state = dueState(t, now)
    if (state === 'overdue') overdue++
    else if (state === 'due_soon') dueSoon++
    else if (state === 'done_on_time') onTime++
    else if (state === 'done_late') {
      late++
      const finished = t.completedAt ? Date.parse(t.completedAt) : now.getTime()
      lateDays += Math.max(0, (finished - Date.parse(t.dueAt as string)) / DAY_MS)
    }
  }
  const judged = onTime + late
  return {
    open, blocked, done, overdue, dueSoon, onTime, late, moved,
    onTimeRate: judged === 0 ? null : onTime / judged,
    avgDaysLate: late === 0 ? null : lateDays / late,
  }
}

export interface PersonStats extends TaskStats {
  memberId: number
  uuid: string
  name: string
}

/** One row per person who performs at least one of the tasks, counting only the tasks they perform. */
export function perPerformer(tasks: Task[], now: Date = new Date()): PersonStats[] {
  const byPerson = new Map<number, { uuid: string; name: string; tasks: Task[] }>()
  for (const t of tasks) {
    for (const p of t.people) {
      if (p.role !== 'performer') continue
      const entry = byPerson.get(p.memberId) ?? { uuid: p.uuid, name: p.name, tasks: [] }
      entry.tasks.push(t)
      byPerson.set(p.memberId, entry)
    }
  }
  return [...byPerson.entries()]
    .map(([memberId, e]) => ({ memberId, uuid: e.uuid, name: e.name, ...statsFor(e.tasks, now) }))
    .sort((a, b) => b.open - a.open || a.name.localeCompare(b.name))
}

/** One row of the `task_totals` RPC: counts per team per month, never a title. A task with no team has teamId null. */
export interface TotalsRow {
  teamId: number | null
  teamName: string | null
  month: string
  created: number
  completed: number
  completedOnTime: number
  openOverdue: number
}

export interface TeamTotals {
  teamId: number | null
  name: string
  created: number
  completed: number
  completedOnTime: number
  openOverdue: number
  /** Finished on time over finished; null until something is finished. A task with no due date counts as on time. */
  onTimeRate: number | null
}

/** Sums the monthly rows into one line per team, worst overdue first so the place that needs a look is on top. */
export function rollupTotals(rows: TotalsRow[]): TeamTotals[] {
  const byTeam = new Map<string, TeamTotals>()
  for (const r of rows) {
    const key = String(r.teamId)
    const t = byTeam.get(key) ?? { teamId: r.teamId, name: r.teamName ?? 'no team', created: 0, completed: 0, completedOnTime: 0, openOverdue: 0, onTimeRate: null }
    t.created += r.created
    t.completed += r.completed
    t.completedOnTime += r.completedOnTime
    t.openOverdue += r.openOverdue
    byTeam.set(key, t)
  }
  return [...byTeam.values()]
    .map(t => ({ ...t, onTimeRate: t.completed > 0 ? t.completedOnTime / t.completed : null }))
    .sort((a, b) => b.openOverdue - a.openOverdue || b.created - a.created || a.name.localeCompare(b.name))
}

/** "86%" or "-" when there is nothing to judge yet. */
export function formatRate(rate: number | null): string {
  return rate === null ? '-' : `${Math.round(rate * 100)}%`
}
