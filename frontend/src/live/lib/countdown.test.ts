import { describe, it, expect } from 'vitest'
import { istStartOfDay, countdownTo, daysToGo, pad2 } from './countdown'

describe('countdown to a day in India', () => {
  it('starts the day at midnight IST, which is 18:30 UTC the day before', () => {
    expect(istStartOfDay('2026-11-10').toISOString()).toBe('2026-11-09T18:30:00.000Z')
  })
  it('splits what is left into days, hours, minutes and seconds', () => {
    const c = countdownTo('2026-11-10', new Date('2026-11-08T18:29:30.000Z'))
    expect(c.done).toBe(false)
    expect(c.parts).toEqual({ days: 1, hours: 0, minutes: 0, seconds: 30 })
  })
  it('is done at the start of the day and after', () => {
    expect(countdownTo('2026-11-10', new Date('2026-11-09T18:30:00.000Z')).done).toBe(true)
    expect(countdownTo('2026-11-10', new Date('2026-12-01T00:00:00.000Z')).parts).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
  it('rounds whole days up and never goes negative', () => {
    expect(daysToGo('2026-11-10', new Date('2026-11-08T18:29:00.000Z'))).toBe(2)
    expect(daysToGo('2026-11-10', new Date('2026-11-09T18:29:00.000Z'))).toBe(1)
    expect(daysToGo('2026-11-10', new Date('2026-11-10T01:00:00.000Z'))).toBe(0)
  })
  it('pads to two digits', () => {
    expect(pad2(3)).toBe('03')
    expect(pad2(12)).toBe('12')
  })
})
