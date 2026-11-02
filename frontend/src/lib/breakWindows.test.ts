import { describe, it, expect } from 'vitest'
import { splitBreaks, shortDate, daysBetween, onNowLine, upcomingLine, todayISO, type BreakRow } from './breakWindows'

const row = (id: number, memberId: number, start: string, end: string): BreakRow => ({
  id, memberId, start, end, reason: 'boards', note: null,
})

describe('splitBreaks', () => {
  const today = '2026-11-10'
  it('puts ranges that contain today on break now, soonest return first', () => {
    const { onNow } = splitBreaks([row(1, 1, '2026-11-01', '2026-11-30'), row(2, 2, '2026-11-05', '2026-11-12')], today)
    expect(onNow.map(r => r.memberId)).toEqual([2, 1])
  })
  it('counts the first and last day as on break', () => {
    expect(splitBreaks([row(1, 1, '2026-11-10', '2026-11-20')], today).onNow).toHaveLength(1)
    expect(splitBreaks([row(1, 1, '2026-11-01', '2026-11-10')], today).onNow).toHaveLength(1)
  })
  it('puts future ranges in upcoming, soonest first, and drops finished ones', () => {
    const { onNow, upcoming } = splitBreaks(
      [row(1, 1, '2026-12-03', '2026-12-12'), row(2, 2, '2026-11-11', '2026-11-15'), row(3, 3, '2026-10-01', '2026-11-09')],
      today,
    )
    expect(onNow).toHaveLength(0)
    expect(upcoming.map(r => r.memberId)).toEqual([2, 1])
  })
  it('shows a member in both sections when one break is running and another is booked', () => {
    const { onNow, upcoming } = splitBreaks([row(1, 7, '2026-11-01', '2026-11-12'), row(2, 7, '2026-12-01', '2026-12-05')], today)
    expect(onNow.map(r => r.id)).toEqual([1])
    expect(upcoming.map(r => r.id)).toEqual([2])
  })
  it('keeps one row per member per section: latest end now, earliest start upcoming', () => {
    const now = splitBreaks([row(1, 7, '2026-11-01', '2026-11-12'), row(2, 7, '2026-11-05', '2026-11-20')], today)
    expect(now.onNow.map(r => r.id)).toEqual([2])
    const up = splitBreaks([row(1, 7, '2026-12-09', '2026-12-12'), row(2, 7, '2026-12-01', '2026-12-05')], today)
    expect(up.upcoming.map(r => r.id)).toEqual([2])
  })
  it('ignores rows with no dates', () => {
    expect(splitBreaks([row(1, 1, '', '')], today)).toEqual({ onNow: [], upcoming: [] })
  })
})

describe('dates and copy', () => {
  it('formats a short date', () => {
    expect(shortDate('2026-11-14')).toBe('14 nov')
    expect(shortDate('2026-01-03')).toBe('3 jan')
    expect(shortDate('nope')).toBe('nope')
  })
  it('counts whole days across a month boundary', () => {
    expect(daysBetween('2026-11-28', '2026-12-02')).toBe(4)
    expect(daysBetween('2026-11-10', '2026-11-10')).toBe(0)
  })
  it('says when someone is back', () => {
    expect(onNowLine({ end: '2026-11-16' }, '2026-11-10')).toBe('until 16 nov, back in 6 days')
    expect(onNowLine({ end: '2026-11-11' }, '2026-11-10')).toBe('until 11 nov, back in 1 day')
    expect(onNowLine({ end: '2026-11-10' }, '2026-11-10')).toBe('until 10 nov, back tomorrow')
  })
  it('says when a break starts and ends', () => {
    expect(upcomingLine({ start: '2026-12-03', end: '2026-12-12' }, '2026-11-21')).toBe('starts 3 dec (in 12 days), back 12 dec')
    expect(upcomingLine({ start: '2026-11-11', end: '2026-11-15' }, '2026-11-10')).toBe('starts 11 nov (tomorrow), back 15 nov')
  })
  it('formats today in local time', () => {
    expect(todayISO(new Date(2026, 10, 2))).toBe('2026-11-02')
  })
})
