/**
 * Pure model for the task tracker (owner, 2026-10-19; plan in docs/plans/task-tracker.md): types, the small
 * rules the page, the form and the tests share, and the wording of the change log. No Supabase import, so it is
 * unit-tested directly (taskModel.test.ts). The I/O lives in services/taskService.ts.
 *
 * The database decides who may see and edit what (scripts/tasks_slice1_2026_10_19.sql, row-level security). The
 * functions here mirror those rules so the screen can hide a button the database would refuse; they never replace them.
 */

export type TaskKind = 'team' | 'general'
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done'
export type TaskRole = 'performer' | 'supervisor' | 'spectator'

export interface TaskPerson {
  memberId: number
  uuid: string
  name: string
  avatarUrl?: string
  role: TaskRole
  /** A silent spectator sees everything and changes nothing. Only spectators can be silent. */
  silent: boolean
}

export interface Task {
  taskId: number
  uuid: string
  title: string
  description: string
  kind: TaskKind
  teamId: number | null
  teamName?: string
  teamUuid?: string
  createdBy: number
  dueAt: string | null
  /** The first due date ever set. A moved date still counts as a delay against this one. */
  firstDueAt: string | null
  dueMoves: number
  status: TaskStatus
  completedAt: string | null
  createdAt: string
  updatedAt: string
  people: TaskPerson[]
}

export interface TaskComment {
  id: number
  taskId: number
  memberId: number
  name: string
  avatarUrl?: string
  body: string
  createdAt: string
}

export interface TaskEvent {
  id: number
  at: string
  actor: string
  kind: string
  note: string | null
}

export const TASK_LIMITS = { titleMin: 3, titleMax: 200, descriptionMax: 4000, commentMax: 2000 } as const

export const STATUS_LABEL: Record<TaskStatus, string> = {
  open: 'open',
  in_progress: 'in progress',
  blocked: 'blocked',
  done: 'done',
}

export const STATUSES: TaskStatus[] = ['open', 'in_progress', 'blocked', 'done']

export const ROLE_LABEL: Record<TaskRole, string> = {
  performer: 'doing it',
  supervisor: 'supervising',
  spectator: 'spectating',
}

/** One line each, shown under the role picker so nobody has to guess what a role means. */
export const ROLE_HINT: Record<TaskRole, string> = {
  performer: 'does the task. This is who it is assigned to.',
  supervisor: 'receives the result. Usually whoever assigned it.',
  spectator: 'not assigned, but can follow every action and add input.',
}

export const ROLES: TaskRole[] = ['performer', 'supervisor', 'spectator']

/** The person's row on this task, if they are on it. */
export function personOn(task: Pick<Task, 'people'>, memberId: number | null | undefined): TaskPerson | undefined {
  if (memberId == null) return undefined
  return task.people.find(p => p.memberId === memberId)
}

/** Mirrors the database: performers, supervisors and spectators who are not silent can edit and comment. */
export function canEditTask(task: Pick<Task, 'people'>, memberId: number | null | undefined): boolean {
  const p = personOn(task, memberId)
  return !!p && (p.role !== 'spectator' || !p.silent)
}

export type Relation = 'performer' | 'supervisor' | 'spectator' | 'silent_spectator' | 'team' | 'creator'

/** How the viewer relates to a task, strongest first. 'team' means they can see it only because it is their team's. */
export function relationOf(task: Pick<Task, 'people' | 'createdBy' | 'kind'>, memberId: number | null | undefined): Relation {
  const p = personOn(task, memberId)
  if (p) return p.role === 'spectator' ? (p.silent ? 'silent_spectator' : 'spectator') : p.role
  if (memberId != null && task.createdBy === memberId) return 'creator'
  return 'team'
}

export type DueState = 'none' | 'upcoming' | 'due_soon' | 'overdue' | 'done_on_time' | 'done_late'

const SOON_MS = 48 * 60 * 60 * 1000

export function dueState(task: Pick<Task, 'dueAt' | 'status' | 'completedAt'>, now: Date = new Date()): DueState {
  if (!task.dueAt) return 'none'
  const due = Date.parse(task.dueAt)
  if (task.status === 'done') {
    const done = task.completedAt ? Date.parse(task.completedAt) : now.getTime()
    return done <= due ? 'done_on_time' : 'done_late'
  }
  const left = due - now.getTime()
  if (left < 0) return 'overdue'
  return left <= SOON_MS ? 'due_soon' : 'upcoming'
}

export const DUE_LABEL: Record<DueState, string> = {
  none: 'no due date',
  upcoming: 'on track',
  due_soon: 'due soon',
  overdue: 'overdue',
  done_on_time: 'done on time',
  done_late: 'done late',
}

export type TaskTab = 'doing' | 'supervising' | 'spectating' | 'team' | 'done'

export const TABS: TaskTab[] = ['doing', 'supervising', 'spectating', 'team', 'done']

export const TAB_LABEL: Record<TaskTab, string> = {
  doing: 'to do',
  supervising: 'I supervise',
  spectating: 'I follow',
  team: 'my teams',
  done: 'done',
}

/** Which tab a task belongs on for this viewer. A done task is only ever on the done tab. */
export function tabOf(task: Pick<Task, 'people' | 'createdBy' | 'kind' | 'status'>, memberId: number | null | undefined): TaskTab {
  if (task.status === 'done') return 'done'
  const rel = relationOf(task, memberId)
  if (rel === 'performer') return 'doing'
  if (rel === 'supervisor') return 'supervising'
  if (rel === 'spectator' || rel === 'silent_spectator') return 'spectating'
  // the creator who is not on the task, or a team member who can see a team task
  return rel === 'creator' ? 'supervising' : 'team'
}

/** Soonest due first, tasks without a due date last, then newest first. */
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.dueAt && b.dueAt) return Date.parse(a.dueAt) - Date.parse(b.dueAt)
    if (a.dueAt) return -1
    if (b.dueAt) return 1
    return Date.parse(b.createdAt) - Date.parse(a.createdAt)
  })
}

export function groupByTab(tasks: Task[], memberId: number | null | undefined): Record<TaskTab, Task[]> {
  const out: Record<TaskTab, Task[]> = { doing: [], supervising: [], spectating: [], team: [], done: [] }
  for (const t of tasks) out[tabOf(t, memberId)].push(t)
  for (const tab of TABS) {
    out[tab] = tab === 'done'
      ? [...out[tab]].sort((a, b) => Date.parse(b.completedAt ?? b.updatedAt) - Date.parse(a.completedAt ?? a.updatedAt))
      : sortTasks(out[tab])
  }
  return out
}

/** The profile (slice 3) shows only what a person performs or supervises, never what they only follow. */
export function showsOnProfile(task: Pick<Task, 'people'>, memberId: number): boolean {
  const p = personOn(task, memberId)
  return !!p && p.role !== 'spectator'
}

/** Same rule as showsOnProfile, for a profile page that knows the member by uuid rather than by id. */
export function showsOnProfileByUuid(task: Pick<Task, 'people'>, uuid: string): boolean {
  return task.people.some(p => p.uuid === uuid && p.role !== 'spectator')
}

export interface PersonInput {
  memberId: number
  uuid: string
  name: string
  avatarUrl?: string
  role: TaskRole
  silent: boolean
}

/**
 * One row per person (the last choice wins), silent only for spectators, and the creator added as supervisor when
 * they did not pick a role for themselves: they usually assigned the task, and otherwise could not edit what they
 * just made (owner assumption recorded in docs/plans/task-tracker.md).
 */
export function normalizePeople(people: PersonInput[], creator: { memberId: number; uuid: string; name: string; avatarUrl?: string }): PersonInput[] {
  const byId = new Map<number, PersonInput>()
  for (const p of people) byId.set(p.memberId, { ...p, silent: p.role === 'spectator' ? p.silent : false })
  if (!byId.has(creator.memberId)) byId.set(creator.memberId, { ...creator, role: 'supervisor', silent: false })
  return [...byId.values()]
}

/**
 * Adds many people at once (a whole team) with one role. Anyone already on the list keeps the role they have, so a
 * bulk add never overrides a choice somebody made on purpose; `skipIds` (the creator, so the supervisor rule still
 * applies) are left out.
 */
export function addMany(
  list: PersonInput[],
  added: { memberId: number; uuid: string; name: string; avatarUrl?: string }[],
  role: TaskRole,
  silent: boolean,
  skipIds: number[] = [],
): PersonInput[] {
  const have = new Set(list.map(p => p.memberId))
  const skip = new Set(skipIds)
  const fresh = added
    .filter(m => !have.has(m.memberId) && !skip.has(m.memberId))
    .map(m => ({ ...m, role, silent: role === 'spectator' ? silent : false }))
  return [...list, ...fresh]
}

export interface NewTaskInput {
  title: string
  description: string
  kind: TaskKind
  teamId: number | null
  dueAt: string | null
  people: PersonInput[]
}

/** First problem found, or null. Mirrors the table's checks so the form can say no before the server does. */
export function validateNewTask(input: NewTaskInput): string | null {
  const title = input.title.trim()
  if (title.length < TASK_LIMITS.titleMin) return `give the task a title of at least ${TASK_LIMITS.titleMin} characters.`
  if (title.length > TASK_LIMITS.titleMax) return `keep the title under ${TASK_LIMITS.titleMax} characters.`
  if (input.description.length > TASK_LIMITS.descriptionMax) return `keep the description under ${TASK_LIMITS.descriptionMax} characters.`
  if (input.kind === 'team' && input.teamId == null) return 'pick the team this task belongs to.'
  if (input.kind === 'general' && input.teamId != null) return 'a general task is not tied to a team.'
  if (!input.people.some(p => p.role === 'performer')) return 'add at least one person who will do the task.'
  return null
}

/** A date input ("2026-10-25") as the end of that day in Kolkata, so a task due on the 25th is not late at noon. */
export function dueFromDateInput(date: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T23:59:00+05:30` : null
}

/** The Kolkata calendar date of a due timestamp, for a date input. */
export function dateInputFromDue(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(Date.parse(iso) + 5.5 * 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

/** "25 Oct", or "25 Oct 2027" when it is not this year. */
export function formatDue(iso: string | null, now: Date = new Date()): string {
  if (!iso) return ''
  const d = new Date(Date.parse(iso) + 5.5 * 60 * 60 * 1000)
  const sameYear = d.getUTCFullYear() === new Date(now.getTime() + 5.5 * 60 * 60 * 1000).getUTCFullYear()
  const day = d.getUTCDate()
  const month = d.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' })
  return sameYear ? `${day} ${month}` : `${day} ${month} ${d.getUTCFullYear()}`
}

/** The change log in plain sentences, matching how /bugs words its own. */
export function eventSentence(e: Pick<TaskEvent, 'kind' | 'actor' | 'note'>): string {
  const who = e.actor
  switch (e.kind) {
    case 'created': return `${who} created this task.`
    case 'status': return `${who} changed the status: ${e.note ?? ''}.`
    case 'due_moved': return `${who} moved the due date: ${e.note ?? ''}.`
    case 'edited': return `${who} edited the title or description.`
    case 'person_added': return `${who} added ${e.note ?? 'someone'}.`
    case 'person_removed': return `${who} removed ${e.note ?? 'someone'}.`
    case 'role_changed': return `${who} changed a role: ${e.note ?? ''}.`
    default: return `${who}: ${e.kind}${e.note ? ', ' + e.note : ''}`
  }
}

/** True when marking `task` done leaves nothing open in `openList`: the moment that earns the big celebration. */
export function finishesTheList(openList: Pick<Task, 'taskId' | 'status'>[], task: Pick<Task, 'taskId' | 'status'>): boolean {
  if (task.status === 'done') return false
  const stillOpen = openList.filter(t => t.status !== 'done' && t.taskId !== task.taskId)
  return openList.some(t => t.taskId === task.taskId) && stillOpen.length === 0
}

/** Share of a ring to fill, clamped to [0, 1]. An empty list is an empty ring, not a full one. */
export function ringFraction(done: number, total: number): number {
  if (!(total > 0) || !(done > 0)) return 0
  return Math.min(1, done / total)
}
