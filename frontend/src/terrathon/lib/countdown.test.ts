import { describe, it, expect } from 'vitest'
import { splitDuration, resolveCountdown, spokenRemaining } from './countdown'
import type { PublicEvent } from './types'

function ev(p: Partial<PublicEvent>): PublicEvent {
  return {
    slug: 'cricket', display_name: 'Cricket', status: 'open', fee_inr: 2400,
    team_size_min: 7, team_size_max: 8, roster_min_at_signup: 0,
    prize_pool_inr: 9000, prize_split: null, venue: null, venue_map_url: null,
    day_first: '2026-10-03', day_last: '2026-10-04', report_time: null,
    match_window: null, rules_md: null, closes_at: '2026-10-02T18:29:00.000Z',
    sort_order: 2, filling_fast: false, accepting: true,
    ...p,
  }
}

describe('splitDuration', () => {
  it('splits into days, hours, minutes, seconds', () => {
    expect(splitDuration((((3 * 24 + 14) * 60 + 22) * 60 + 9) * 1000))
      .toEqual({ days: 3, hours: 14, minutes: 22, seconds: 9 })
  })
  it('floors at zero rather than counting backwards past the deadline', () => {
    expect(splitDuration(-50000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})

describe('resolveCountdown', () => {
  const pickle = ev({ slug: 'pickleball', display_name: 'Pickleball', day_first: '2026-10-02', day_last: '2026-10-02', closes_at: '2026-10-01T18:29:00.000Z', sort_order: 1 })
  const cricket = ev({})
  const fifa = ev({ slug: 'fifa', display_name: 'FIFA', day_first: '2026-10-03', day_last: '2026-10-03', closes_at: '2026-10-03T04:00:00.000Z', sort_order: 3 })
  const all = [pickle, cricket, fifa]

  it('counts to 9am IST on the first event day', () => {
    const r = resolveCountdown(all, new Date('2026-09-19T12:00:00.000Z'))
    expect(r.mode).toBe('kickoff')
    expect(r.label).toBe('TerraThon kicks off in')
    // Day 1 is Pickleball on 2 Oct. 9am IST is 03:30 UTC the same morning.
    expect(r.target?.toISOString()).toBe('2026-10-02T03:30:00.000Z')
  })

  it('ignores the sign-up deadlines entirely', () => {
    // The board used to count to the last close and only then to kickoff, so
    // a still-open sport changed what it pointed at. It no longer does.
    const open = all.map((e) => ({ ...e, closes_at: '2026-12-31T00:00:00.000Z' }))
    const closed = all.map((e) => ({ ...e, closes_at: '2026-09-18T00:00:00.000Z' }))
    const a = resolveCountdown(open, new Date('2026-09-19T12:00:00.000Z'))
    const b = resolveCountdown(closed, new Date('2026-09-19T12:00:00.000Z'))
    expect(a.target?.toISOString()).toBe(b.target?.toISOString())
    expect(a.mode).toBe('kickoff')
  })

  it('is still counting at 8am on the day and live by 10', () => {
    const before = resolveCountdown(all, new Date('2026-10-02T02:30:00.000Z')) // 8am IST
    const after = resolveCountdown(all, new Date('2026-10-02T04:30:00.000Z'))  // 10am IST
    expect(before.mode).toBe('kickoff')
    expect(after.mode).toBe('live')
  })

  it('mode C names what is actually running today', () => {
    const closed = all.map((e) => ({ ...e, closes_at: '2026-09-18T00:00:00.000Z' }))
    // 3 Oct 2026, mid-morning IST: Cricket day 1 and FIFA both run.
    const r = resolveCountdown(closed, new Date('2026-10-03T05:00:00.000Z'))
    expect(r.mode).toBe('live')
    expect(r.target).toBeNull()
    expect(r.label).toContain('Cricket')
    expect(r.label).toContain('FIFA')
  })

  it('mode C still fires on the second day of a two-day sport', () => {
    const closed = all.map((e) => ({ ...e, closes_at: '2026-09-18T00:00:00.000Z' }))
    const r = resolveCountdown(closed, new Date('2026-10-04T06:00:00.000Z'))
    expect(r.mode).toBe('live')
    expect(r.label).toContain('Cricket')
    expect(r.label).not.toContain('FIFA')
  })

  it('mode D after the last day ends', () => {
    const closed = all.map((e) => ({ ...e, closes_at: '2026-09-18T00:00:00.000Z' }))
    const r = resolveCountdown(closed, new Date('2026-10-06T12:00:00.000Z'))
    expect(r.mode).toBe('over')
    expect(r.target).toBeNull()
  })

  it('ignores a cancelled sport when picking the first day', () => {
    const mixed = [
      { ...pickle, status: 'cancelled' as const },
      { ...cricket },
    ]
    const r = resolveCountdown(mixed, new Date('2026-09-19T12:00:00.000Z'))
    // Pickleball is cancelled, so cricket's 3 Oct is the first day: 9am IST.
    expect(r.target?.toISOString()).toBe('2026-10-03T03:30:00.000Z')
  })

  it('does not fall over when nothing has dates yet', () => {
    const r = resolveCountdown([ev({ day_first: null, day_last: null, closes_at: null })], new Date())
    expect(r.mode).toBe('over')
  })
})

describe('spokenRemaining', () => {
  it('drops precision it does not need, so a screen reader is not read a clock', () => {
    expect(spokenRemaining({ days: 3, hours: 4, minutes: 5, seconds: 6 }, 'Closes in'))
      .toBe('Closes in 3 days and 4 hours')
    expect(spokenRemaining({ days: 0, hours: 4, minutes: 5, seconds: 6 }, 'Closes in'))
      .toBe('Closes in 4 hours and 5 minutes')
    expect(spokenRemaining({ days: 0, hours: 0, minutes: 5, seconds: 6 }, 'Closes in'))
      .toBe('Closes in 5 minutes')
  })
})
