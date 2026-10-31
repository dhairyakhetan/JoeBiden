import { describe, expect, it } from 'vitest'
import {
  addMany, canEditTask, showsOnProfileByUuid, dateInputFromDue, dueFromDateInput, dueState, eventSentence, formatDue, groupByTab, normalizePeople, personOn, relationOf, showsOnProfile, sortTasks, tabOf, validateNewTask,
  type PersonInput, type Task, type TaskPerson,
} from './taskModel'

const person = (memberId: number, role: TaskPerson['role'], silent = false): TaskPerson => ({ memberId, uuid: `u${memberId}`, name: `Test Member ${memberId}`, role, silent })

const task = (over: Partial<Task> = {}): Task => ({
  taskId: 1, uuid: 't1', title: 'Synthetic task', description: '', kind: 'general', teamId: null, createdBy: 1,
  dueAt: null, firstDueAt: null, dueMoves: 0, status: 'open', completedAt: null,
  createdAt: '2026-10-19T10:00:00Z', updatedAt: '2026-10-19T10:00:00Z',
  people: [person(1, 'supervisor'), person(2, 'performer'), person(3, 'spectator'), person(4, 'spectator', true)],
  ...over,
})

describe('who can edit', () => {
  it('performers, supervisors and plain spectators can; silent spectators and outsiders cannot', () => {
    expect(canEditTask(task(), 1)).toBe(true)
    expect(canEditTask(task(), 2)).toBe(true)
    expect(canEditTask(task(), 3)).toBe(true)
    expect(canEditTask(task(), 4)).toBe(false)
    expect(canEditTask(task(), 99)).toBe(false)
    expect(canEditTask(task(), null)).toBe(false)
  })

  it('finds a person on the task', () => {
    expect(personOn(task(), 2)?.role).toBe('performer')
    expect(personOn(task(), 99)).toBeUndefined()
  })
})

describe('how the viewer relates to a task', () => {
  const team = task({ kind: 'team', teamId: 7, createdBy: 50 })
  it('names the strongest relation', () => {
    expect(relationOf(task(), 2)).toBe('performer')
    expect(relationOf(task(), 1)).toBe('supervisor')
    expect(relationOf(task(), 3)).toBe('spectator')
    expect(relationOf(task(), 4)).toBe('silent_spectator')
    expect(relationOf(team, 99)).toBe('team')
    expect(relationOf(team, 50)).toBe('creator')
  })

  it('puts each relation on its own tab, and done tasks on the done tab', () => {
    expect(tabOf(task(), 2)).toBe('doing')
    expect(tabOf(task(), 1)).toBe('supervising')
    expect(tabOf(task(), 3)).toBe('spectating')
    expect(tabOf(task(), 4)).toBe('spectating')
    expect(tabOf(team, 99)).toBe('team')
    expect(tabOf(team, 50)).toBe('supervising')
    expect(tabOf(task({ status: 'done' }), 2)).toBe('done')
  })
})

describe('profile', () => {
  it('shows performing and supervising, never only following', () => {
    expect(showsOnProfile(task(), 2)).toBe(true)
    expect(showsOnProfile(task(), 1)).toBe(true)
    expect(showsOnProfile(task(), 3)).toBe(false)
    expect(showsOnProfile(task(), 4)).toBe(false)
    expect(showsOnProfile(task(), 99)).toBe(false)
  })
})

describe('due dates', () => {
  const now = new Date('2026-10-19T12:00:00Z')
  it('has no state without a due date', () => { expect(dueState(task(), now)).toBe('none') })
  it('splits open work into on track, due soon and overdue', () => {
    expect(dueState(task({ dueAt: '2026-10-30T00:00:00Z' }), now)).toBe('upcoming')
    expect(dueState(task({ dueAt: '2026-10-20T12:00:00Z' }), now)).toBe('due_soon')
    expect(dueState(task({ dueAt: '2026-10-18T00:00:00Z' }), now)).toBe('overdue')
  })
  it('judges a finished task by when it was finished', () => {
    expect(dueState(task({ status: 'done', dueAt: '2026-10-20T00:00:00Z', completedAt: '2026-10-19T00:00:00Z' }), now)).toBe('done_on_time')
    expect(dueState(task({ status: 'done', dueAt: '2026-10-18T00:00:00Z', completedAt: '2026-10-19T00:00:00Z' }), now)).toBe('done_late')
  })
})

describe('ordering and grouping', () => {
  it('sorts soonest due first, no due date last', () => {
    const a = task({ taskId: 1, dueAt: '2026-10-25T00:00:00Z' })
    const b = task({ taskId: 2, dueAt: '2026-10-21T00:00:00Z' })
    const c = task({ taskId: 3, dueAt: null })
    expect(sortTasks([a, c, b]).map(t => t.taskId)).toEqual([2, 1, 3])
  })

  it('groups a mix into the right tabs for one viewer', () => {
    const mine = task({ taskId: 1 })
    const following = task({ taskId: 2, people: [person(9, 'performer'), person(2, 'spectator')] })
    const finished = task({ taskId: 3, status: 'done', completedAt: '2026-10-19T09:00:00Z' })
    const g = groupByTab([mine, following, finished], 2)
    expect(g.doing.map(t => t.taskId)).toEqual([1])
    expect(g.spectating.map(t => t.taskId)).toEqual([2])
    expect(g.done.map(t => t.taskId)).toEqual([3])
    expect(g.supervising).toEqual([])
  })
})

describe('people on a new task', () => {
  const creator = { memberId: 1, uuid: 'u1', name: 'Test Member 1' }
  const pi = (memberId: number, role: PersonInput['role'], silent = false): PersonInput => ({ memberId, uuid: `u${memberId}`, name: `Test Member ${memberId}`, role, silent })

  it('adds the creator as supervisor when they picked no role for themselves', () => {
    const out = normalizePeople([pi(2, 'performer')], creator)
    expect(out.find(p => p.memberId === 1)).toMatchObject({ role: 'supervisor', silent: false })
  })

  it('keeps the creator\'s own choice', () => {
    const out = normalizePeople([pi(1, 'performer'), pi(2, 'performer')], creator)
    expect(out.find(p => p.memberId === 1)?.role).toBe('performer')
    expect(out).toHaveLength(2)
  })

  it('keeps one row per person, the last choice, and silences only spectators', () => {
    const out = normalizePeople([pi(2, 'spectator', true), pi(2, 'performer', true), pi(3, 'spectator', true)], creator)
    expect(out.find(p => p.memberId === 2)).toMatchObject({ role: 'performer', silent: false })
    expect(out.find(p => p.memberId === 3)).toMatchObject({ role: 'spectator', silent: true })
  })
})

describe('validating a new task', () => {
  const ok = { title: 'Collect the permission slips', description: '', kind: 'general' as const, teamId: null, dueAt: null,
    people: [{ memberId: 2, uuid: 'u2', name: 'Test Member 2', role: 'performer' as const, silent: false }] }

  it('accepts a complete task', () => { expect(validateNewTask(ok)).toBeNull() })
  it('needs a real title', () => { expect(validateNewTask({ ...ok, title: ' a ' })).toContain('title') })
  it('needs a team for a team task and none for a general one', () => {
    expect(validateNewTask({ ...ok, kind: 'team' })).toContain('team')
    expect(validateNewTask({ ...ok, kind: 'general', teamId: 3 })).toContain('not tied')
    expect(validateNewTask({ ...ok, kind: 'team', teamId: 3 })).toBeNull()
  })
  it('needs someone to do it', () => {
    expect(validateNewTask({ ...ok, people: [] })).toContain('at least one person')
  })
})

describe('due date inputs', () => {
  it('turns a date into the end of that day in Kolkata and back', () => {
    expect(dueFromDateInput('2026-10-25')).toBe('2026-10-25T23:59:00+05:30')
    expect(dateInputFromDue('2026-10-25T23:59:00+05:30')).toBe('2026-10-25')
    expect(dateInputFromDue('2026-10-25T18:29:00Z')).toBe('2026-10-25')
  })
  it('ignores a malformed date and an empty one', () => {
    expect(dueFromDateInput('25/10/2026')).toBeNull()
    expect(dueFromDateInput('')).toBeNull()
    expect(dateInputFromDue(null)).toBe('')
  })
  it('words a due date with the year only when it is another year', () => {
    const now = new Date('2026-10-19T12:00:00Z')
    expect(formatDue('2026-10-25T23:59:00+05:30', now)).toBe('25 Oct')
    expect(formatDue('2027-01-05T23:59:00+05:30', now)).toBe('5 Jan 2027')
    expect(formatDue(null, now)).toBe('')
  })
})

describe('the change log', () => {
  it('reads as sentences without em dashes', () => {
    expect(eventSentence({ kind: 'status', actor: 'Test Member 2', note: 'open to done' })).toBe('Test Member 2 changed the status: open to done.')
    for (const kind of ['created', 'status', 'due_moved', 'edited', 'person_added', 'person_removed', 'role_changed', 'other']) {
      expect(eventSentence({ kind, actor: 'A', note: 'n' })).not.toContain('—')
    }
  })
})

describe('adding a whole team', () => {
  const m = (id: number) => ({ memberId: id, uuid: `u${id}`, name: `Member ${id}` })
  it('adds everyone with one role, silent only for spectators', () => {
    const spectators = addMany([], [m(1), m(2)], 'spectator', true)
    expect(spectators.map(p => [p.memberId, p.role, p.silent])).toEqual([[1, 'spectator', true], [2, 'spectator', true]])
    expect(addMany([], [m(1)], 'performer', true)[0].silent).toBe(false)
  })
  it('never overrides someone who is already listed, and leaves out the skipped', () => {
    const start = [{ ...m(1), role: 'supervisor' as const, silent: false }]
    const out = addMany(start, [m(1), m(2), m(3)], 'spectator', false, [3])
    expect(out.map(p => [p.memberId, p.role])).toEqual([[1, 'supervisor'], [2, 'spectator']])
  })
})

describe('profile by uuid', () => {
  it('matches showsOnProfile: performers and supervisors yes, spectators no', () => {
    const t = task()
    expect(showsOnProfileByUuid(t, 'u1')).toBe(true)
    expect(showsOnProfileByUuid(t, 'u2')).toBe(true)
    expect(showsOnProfileByUuid(t, 'u3')).toBe(false)
    expect(showsOnProfileByUuid(t, 'nobody')).toBe(false)
  })
})

import { finishesTheList, ringFraction } from './taskModel'

describe('finishesTheList', () => {
  const t = (taskId: number, status: 'open' | 'done' | 'in_progress' = 'open') => ({ taskId, status })
  it('is true when the task is the last one open', () => expect(finishesTheList([t(1)], t(1))).toBe(true))
  it('is false while others are still open', () => expect(finishesTheList([t(1), t(2)], t(1))).toBe(false))
  it('ignores tasks that are already done', () => expect(finishesTheList([t(1), t(2, 'done')], t(1))).toBe(true))
  it('is false for re-opening a done task', () => expect(finishesTheList([t(1, 'done')], t(1, 'done'))).toBe(false))
  it('is false when the task is not in the list', () => expect(finishesTheList([t(2)], t(1))).toBe(false))
})

describe('ringFraction', () => {
  it('is empty for an empty list, not full', () => expect(ringFraction(0, 0)).toBe(0))
  it('is the share finished', () => expect(ringFraction(3, 4)).toBe(0.75))
  it('clamps to 1', () => expect(ringFraction(9, 4)).toBe(1))
  it('never goes negative or NaN', () => { expect(ringFraction(-2, 4)).toBe(0); expect(ringFraction(2, NaN)).toBe(0) })
})
