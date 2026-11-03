import { describe, it, expect } from 'vitest'
import { plausible } from './liveFacts'

describe('plausible', () => {
  it('believes a count near or above the built figure', () => {
    expect(plausible(1424, 1400)).toBe(true)
    expect(plausible(1500, 1424)).toBe(true)
    expect(plausible(1140, 1424)).toBe(true) // exactly 80%
  })
  it('refuses an undercount, a missing count and a non-number', () => {
    expect(plausible(900, 1424)).toBe(false)
    expect(plausible(null, 1424)).toBe(false)
    expect(plausible(undefined, 1424)).toBe(false)
    expect(plausible(NaN, 1424)).toBe(false)
  })
})
