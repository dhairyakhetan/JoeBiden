import { describe, it, expect } from 'vitest'
import { firstOfMonthLabel } from './memberOfMonthService'

describe('firstOfMonthLabel', () => {
  it('names the day a queued pick goes out', () => {
    expect(firstOfMonthLabel('2026-12-01')).toBe('1 December')
    expect(firstOfMonthLabel('2027-01-01')).toBe('1 January')
  })
})
