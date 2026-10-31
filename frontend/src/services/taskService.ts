/**
 * Task tracker (owner, 2026-10-19). Tables `tasks`, `task_people`, `task_comments`, `task_events`.
 * Schema, row-level security and triggers: scripts/tasks_slice1_2026_10_19.sql.
 *
 * Service contract (CLAUDE.md): this THROWS on error. The component owns the toast.
 *
 * What the database decides, so this file does not try to:
 *   - who can see a task (the people on it, its creator, and the team for a team task) and who can edit it;
 *   - completed_at, first_due_at, due_moves and updated_at (set by trigger; the grants leave them out);
 *   - the change log (written by trigger).
 * Row-level security hides a row it will not let you change rather than raising, so every write below asks for the
 * changed row back and throws when none comes back: a refused edit must never look like a saved one.
 */
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { logSupabaseError } from '../lib/errorTracking'
import type { TotalsRow } from '../tasks/taskStats'
import {
  normalizePeople,
  type NewTaskInput, type PersonInput, type Task, type TaskComment, type TaskEvent, type TaskPerson, type TaskRole, type TaskStatus,
} from '../tasks/taskModel'

// The generated Database types predate these tables, same escape hatch bugReportService uses.
const db = supabaseCommunity as any

const TASKS_CAP = 300

const TASK_SELECT = `
  task_id, uuid, title, description, kind, team_id, created_by, due_at, first_due_at, due_moves, status, completed_at, created_at, updated_at,
  team:teams(name, uuid),
  people:task_people(member_id, role, silent, member:members!task_people_member_id_fkey(uuid, full_name, avatar_url))
`

function mapPerson(p: any): TaskPerson {
  return {
    memberId: p.member_id,
    uuid: p.member?.uuid ?? '',
    name: p.member?.full_name ?? 'a member',
    avatarUrl: p.member?.avatar_url ?? undefined,
    role: p.role as TaskRole,
    silent: !!p.silent,
  }
}

function mapTask(row: any): Task {
  return {
    taskId: row.task_id,
    uuid: row.uuid,
    title: row.title,
    description: row.description ?? '',
    kind: row.kind,
    teamId: row.team_id ?? null,
    teamName: row.team?.name ?? undefined,
    teamUuid: row.team?.uuid ?? undefined,
    createdBy: row.created_by,
    dueAt: row.due_at ?? null,
    firstDueAt: row.first_due_at ?? null,
    dueMoves: row.due_moves ?? 0,
    status: row.status as TaskStatus,
    completedAt: row.completed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    people: ((row.people ?? []) as any[]).map(mapPerson),
  }
}

export interface TaskPatch {
  title?: string
  description?: string
  /** ISO timestamp, or null to clear the due date. */
  due_at?: string | null
  status?: TaskStatus
}

export const taskService = {
  /** Row-level security decides what comes back: the tasks the member is on, made, or sees through their team. */
  async list(): Promise<Task[]> {
    const { data, error } = await db
      .from('tasks')
      .select(TASK_SELECT)
      .order('created_at', { ascending: false })
      .range(0, TASKS_CAP - 1)
    if (error) throw logSupabaseError('taskService.list', error)
    return ((data ?? []) as any[]).map(mapTask)
  },

  /**
   * Counts per team per month from the `task_totals` RPC (scripts/task_totals_2026_10_20.sql). HR and super admin get
   * every team; a HoD or director gets their own teams; anyone else gets an error. Counts only, never a title, so private
   * tasks are counted without being shown.
   */
  async totals(months = 6): Promise<TotalsRow[]> {
    const { data, error } = await db.rpc('task_totals', { p_months: months })
    if (error) throw logSupabaseError('taskService.totals', error)
    return ((data ?? []) as any[]).map(r => ({
      teamId: r.team_id ?? null,
      teamName: r.team_name ?? null,
      month: String(r.month),
      created: Number(r.created),
      completed: Number(r.completed),
      completedOnTime: Number(r.completed_on_time),
      openOverdue: Number(r.open_overdue),
    }))
  },

  /** The tasks of one team (by its uuid) that the viewer is allowed to see: the visible list, narrowed. */
  async listForTeam(teamUuid: string): Promise<Task[]> {
    return (await this.list()).filter(t => t.teamUuid === teamUuid)
  },

  /**
   * Makes the task, then its people in one statement. The creator is added as supervisor unless they picked a role
   * for themselves (normalizePeople). Returns the new task's uuid.
   */
  async create(
    input: NewTaskInput,
    creator: { memberId: number; uuid: string; name: string; avatarUrl?: string },
  ): Promise<string> {
    const { data, error } = await db
      .from('tasks')
      .insert({
        title: input.title.trim(),
        description: input.description.trim(),
        kind: input.kind,
        team_id: input.kind === 'team' ? input.teamId : null,
        created_by: creator.memberId,
        due_at: input.dueAt,
      })
      .select('task_id, uuid')
      .single()
    if (error) throw logSupabaseError('taskService.create', error)
    const created = data as { task_id: number; uuid: string }

    const people = normalizePeople(input.people, creator)
    const { error: peopleError } = await db
      .from('task_people')
      .insert(people.map(p => ({ task_id: created.task_id, member_id: p.memberId, role: p.role, silent: p.silent })))
    if (peopleError) throw logSupabaseError('taskService.create.people', peopleError)
    return created.uuid
  },

  /**
   * Teams a task can be made for: a leader may use any active team, anyone else only the teams they are on
   * (the database refuses a team task for a team the creator is not on).
   */
  async teamsFor(memberId: number, isLeader: boolean): Promise<{ teamId: number; name: string }[]> {
    if (isLeader) {
      const { data, error } = await db.from('teams').select('team_id, name').eq('is_active', true).order('name', { ascending: true })
      if (error) throw logSupabaseError('taskService.teamsFor', error)
      return ((data ?? []) as any[]).map(t => ({ teamId: t.team_id, name: t.name }))
    }
    const { data, error } = await db
      .from('team_members')
      .select('teams!inner(team_id, name, is_active)')
      .eq('member_id', memberId)
      .eq('is_active', true)
      .is('left_at', null)
    if (error) throw logSupabaseError('taskService.teamsFor', error)
    return ((data ?? []) as any[])
      .map(r => r.teams)
      .filter((t: any) => t && t.is_active)
      .map((t: any) => ({ teamId: t.team_id, name: t.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  async update(taskId: number, patch: TaskPatch): Promise<void> {
    const { data, error } = await db.from('tasks').update(patch).eq('task_id', taskId).select('task_id')
    if (error) throw logSupabaseError('taskService.update', error)
    if (!data || data.length === 0) throw new Error('you are not allowed to change this task')
  },

  /** Everyone currently on a team, for adding a whole team to a task. team_members is readable by anyone. */
  async teamMembers(teamId: number): Promise<{ memberId: number; uuid: string; name: string; avatarUrl?: string }[]> {
    const { data, error } = await db
      .from('team_members')
      .select('member:members!inner(member_id, uuid, full_name, avatar_url)')
      .eq('team_id', teamId)
      .eq('is_active', true)
      .is('left_at', null)
    if (error) throw logSupabaseError('taskService.teamMembers', error)
    return ((data ?? []) as any[])
      .map(r => r.member)
      .filter(Boolean)
      .map((m: any) => ({ memberId: m.member_id, uuid: m.uuid, name: m.full_name, avatarUrl: m.avatar_url ?? undefined }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },

  /** Several people in one statement. All or none: a refused row fails the whole add. */
  async addPeople(taskId: number, people: Pick<PersonInput, 'memberId' | 'role' | 'silent'>[]): Promise<void> {
    if (people.length === 0) return
    const { error } = await db
      .from('task_people')
      .insert(people.map(p => ({ task_id: taskId, member_id: p.memberId, role: p.role, silent: p.role === 'spectator' ? p.silent : false })))
    if (error) throw logSupabaseError('taskService.addPeople', error)
  },

  async addPerson(taskId: number, p: Pick<PersonInput, 'memberId' | 'role' | 'silent'>): Promise<void> {
    const { error } = await db
      .from('task_people')
      .insert({ task_id: taskId, member_id: p.memberId, role: p.role, silent: p.role === 'spectator' ? p.silent : false })
    if (error) throw logSupabaseError('taskService.addPerson', error)
  },

  async setPerson(taskId: number, memberId: number, patch: { role?: TaskRole; silent?: boolean }): Promise<void> {
    const next = { ...patch }
    if (next.role && next.role !== 'spectator') next.silent = false
    const { data, error } = await db
      .from('task_people')
      .update(next)
      .eq('task_id', taskId)
      .eq('member_id', memberId)
      .select('member_id')
    if (error) throw logSupabaseError('taskService.setPerson', error)
    if (!data || data.length === 0) throw new Error('you are not allowed to change this task')
  },

  async removePerson(taskId: number, memberId: number): Promise<void> {
    const { data, error } = await db
      .from('task_people')
      .delete()
      .eq('task_id', taskId)
      .eq('member_id', memberId)
      .select('member_id')
    if (error) throw logSupabaseError('taskService.removePerson', error)
    if (!data || data.length === 0) throw new Error('you are not allowed to change this task')
  },

  async comments(taskId: number): Promise<TaskComment[]> {
    const { data, error } = await db
      .from('task_comments')
      .select('comment_id, task_id, member_id, body, created_at, member:members(full_name, avatar_url)')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
    if (error) throw logSupabaseError('taskService.comments', error)
    return ((data ?? []) as any[]).map(c => ({
      id: c.comment_id,
      taskId: c.task_id,
      memberId: c.member_id,
      name: c.member?.full_name ?? 'a member',
      avatarUrl: c.member?.avatar_url ?? undefined,
      body: c.body,
      createdAt: c.created_at,
    }))
  },

  async addComment(taskId: number, memberId: number, body: string): Promise<void> {
    const { error } = await db.from('task_comments').insert({ task_id: taskId, member_id: memberId, body: body.trim() })
    if (error) throw logSupabaseError('taskService.addComment', error)
  },

  async events(taskId: number): Promise<TaskEvent[]> {
    const { data, error } = await db
      .from('task_events')
      .select('event_id, at, kind, note, actor:members(full_name)')
      .eq('task_id', taskId)
      .order('at', { ascending: true })
    if (error) throw logSupabaseError('taskService.events', error)
    return ((data ?? []) as any[]).map(e => ({
      id: e.event_id,
      at: e.at,
      actor: e.actor?.full_name ?? 'someone',
      kind: e.kind,
      note: e.note ?? null,
    }))
  },
}
