import { describe, it, expect } from 'vitest'
import { istDate, windowStart, summariseApplications, dayLabel } from './applicationsByDay'

const NOW = new Date('2026-11-15T10:00:00.000Z') // 3:30 pm IST, 15 Nov

describe('istDate', () => {
  it('uses the Kolkata calendar day, not UTC', () => {
    expect(istDate('2026-11-14T19:00:00.000Z')).toBe('2026-11-15') // 12:30 am IST on the 15th
    expect(istDate('2026-11-14T18:29:59.000Z')).toBe('2026-11-14') // 11:59 pm IST on the 14th
  })
})

describe('windowStart', () => {
  it('starts at midnight IST, days-1 days before today', () => {
    expect(windowStart(1, NOW)).toBe('2026-11-14T18:30:00.000Z')
    expect(windowStart(7, NOW)).toBe('2026-11-08T18:30:00.000Z')
  })
})

describe('summariseApplications', () => {
  const rows = [
    { created_at: '2026-11-15T04:00:00.000Z', status: 'pending_approval' },
    { created_at: '2026-11-15T05:00:00.000Z', status: 'active' },
    { created_at: '2026-11-14T19:30:00.000Z', status: 'rejected' },   // 15 Nov in IST
    { created_at: '2026-11-13T08:00:00.000Z', status: 'active' },
    { created_at: '2026-11-13T09:00:00.000Z', status: 'deleted' },
    { created_at: '2026-10-01T09:00:00.000Z', status: 'active' },     // outside the window
  ]
  const s = summariseApplications(rows, 7, NOW)

  it('fills every day in the window, newest first', () => {
    expect(s.days).toHaveLength(7)
    expect(s.days[0].date).toBe('2026-11-15')
    expect(s.days[6].date).toBe('2026-11-09')
    expect(s.days.find(d => d.date === '2026-11-14')!.total).toBe(0)
  })

  it('counts per day and by what happened to each application', () => {
    const d15 = s.days[0]
    expect(d15).toMatchObject({ total: 3, pending: 1, approved: 1, rejected: 1, other: 0 })
    expect(s.days.find(d => d.date === '2026-11-13')).toMatchObject({ total: 2, approved: 1, other: 1 })
  })

  it('totals only the window, and finds the busiest day', () => {
    expect(s.total).toBe(5)
    expect(s.busiest?.date).toBe('2026-11-15')
    expect(s.perDay).toBe(0.7)
  })

  it('has no busiest day when nothing came in', () => {
    expect(summariseApplications([], 14, NOW).busiest).toBeNull()
  })
})

describe('dayLabel', () => {
  it('reads like a calendar day', () => {
    expect(dayLabel('2026-11-15')).toBe('Sun 15 Nov')
  })
})
