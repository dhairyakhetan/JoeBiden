import { describe, expect, it } from 'vitest'
import { formatRate, perPerformer, rollupTotals, statsFor, type TotalsRow } from './taskStats'
import type { Task, TaskPerson } from './taskModel'

const now = new Date('2026-10-19T12:00:00Z')
const person = (memberId: number, role: TaskPerson['role']): TaskPerson => ({ memberId, uuid: `u${memberId}`, name: `Test Member ${memberId}`, role, silent: false })
const task = (over: Partial<Task> = {}): Task => ({
  taskId: 1, uuid: 't', title: 'Synthetic', description: '', kind: 'general', teamId: null, createdBy: 1,
  dueAt: null, firstDueAt: null, dueMoves: 0, status: 'open', completedAt: null,
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', people: [person(2, 'performer')], ...over,
})

describe('task stats', () => {
  it('counts open, blocked, done, overdue and due soon', () => {
    const s = statsFor([
      task({ status: 'open', dueAt: '2026-10-18T00:00:00Z' }),
      task({ status: 'blocked', dueAt: '2026-10-20T00:00:00Z' }),
      task({ status: 'in_progress' }),
      task({ status: 'done', completedAt: '2026-10-10T00:00:00Z' }),
    ], now)
    expect([s.open, s.blocked, s.done, s.overdue, s.dueSoon]).toEqual([3, 1, 1, 1, 1])
  })

  it('judges on-time against finished tasks that had a due date, and averages the lateness', () => {
    const s = statsFor([
      task({ status: 'done', dueAt: '2026-10-10T00:00:00Z', completedAt: '2026-10-09T00:00:00Z' }),
      task({ status: 'done', dueAt: '2026-10-10T00:00:00Z', completedAt: '2026-10-12T00:00:00Z' }),
      task({ status: 'done', dueAt: '2026-10-10T00:00:00Z', completedAt: '2026-10-14T00:00:00Z' }),
      task({ status: 'done', completedAt: '2026-10-14T00:00:00Z' }),
    ], now)
    expect([s.onTime, s.late]).toEqual([1, 2])
    expect(s.onTimeRate).toBeCloseTo(1 / 3)
    expect(s.avgDaysLate).toBeCloseTo(3)
  })

  it('has no rate until something with a due date finishes, and counts moved dates', () => {
    const s = statsFor([task({ dueMoves: 2 }), task()], now)
    expect(s.onTimeRate).toBeNull()
    expect(s.avgDaysLate).toBeNull()
    expect(s.moved).toBe(1)
    expect(formatRate(s.onTimeRate)).toBe('-')
    expect(formatRate(0.857)).toBe('86%')
  })

  it('counts a person only on the tasks they perform, busiest first', () => {
    const rows = perPerformer([
      task({ people: [person(2, 'performer'), person(9, 'supervisor')] }),
      task({ people: [person(2, 'performer'), person(3, 'performer')] }),
      task({ people: [person(3, 'performer'), person(2, 'spectator')], status: 'done', completedAt: '2026-10-10T00:00:00Z' }),
    ], now)
    expect(rows.map(r => [r.memberId, r.open, r.done])).toEqual([[2, 2, 0], [3, 1, 1]])
  })
})

describe('rollupTotals', () => {
  const row = (over: Partial<TotalsRow>): TotalsRow => ({
    teamId: 1, teamName: 'Synthetic Team', month: '2026-10-01', created: 0, completed: 0, completedOnTime: 0, openOverdue: 0, ...over,
  })

  it('sums months into one line per team and works out the on-time rate from finished tasks', () => {
    const out = rollupTotals([
      row({ month: '2026-10-01', created: 4, completed: 2, completedOnTime: 1 }),
      row({ month: '2026-09-01', created: 3, completed: 2, completedOnTime: 2 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ created: 7, completed: 4, completedOnTime: 3, onTimeRate: 0.75 })
  })

  it('has no rate until something is finished, and names the no-team line', () => {
    const out = rollupTotals([row({ teamId: null, teamName: null, created: 2 })])
    expect(out[0].name).toBe('no team')
    expect(out[0].onTimeRate).toBeNull()
  })

  it('puts the team with the most overdue first, then the busiest', () => {
    const out = rollupTotals([
      row({ teamId: 1, teamName: 'Quiet', created: 9 }),
      row({ teamId: 2, teamName: 'Behind', created: 2, openOverdue: 3 }),
      row({ teamId: 3, teamName: 'Busy', created: 5 }),
    ])
    expect(out.map(t => t.name)).toEqual(['Behind', 'Quiet', 'Busy'])
  })
})
