import { describe, it, expect } from 'vitest'
import { openingLook, OPENING_PATTERNS, openingHue, openingTilt, TILE_HUES } from './openingLook'

describe('openingLook', () => {
  it('is stable for the same role', () => {
    expect(openingLook('abc', 'welfare')).toEqual(openingLook('abc', 'welfare'))
  })
  it('stays inside its bounds', () => {
    for (let i = 0; i < 400; i++) {
      const l = openingLook(`role-${i}`, 'events')
      expect(OPENING_PATTERNS).toContain(l.pattern)
      expect(l.x).toBeGreaterThanOrEqual(50); expect(l.x).toBeLessThanOrEqual(110)
      expect(l.y).toBeGreaterThanOrEqual(45); expect(l.y).toBeLessThanOrEqual(95)
      expect(l.size).toBeGreaterThanOrEqual(0.8); expect(l.size).toBeLessThanOrEqual(1.3)
    }
  })
  it('uses every pattern across a set of roles', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => openingLook(`r${i}`).pattern))
    expect(seen.size).toBe(OPENING_PATTERNS.length)
  })
  it('colours a team the same way every time and uses more than one hue across teams', () => {
    expect(openingHue('Social Media')).toBe(openingHue('social media'))
    const seen = new Set(['Content', 'Social Media', 'Events', 'Welfare', 'Labs', 'Finance', 'Design', 'Tech'].map(n => openingHue(n)))
    expect(seen.size).toBeGreaterThan(3)
    for (const h of seen) expect(TILE_HUES).toContain(h)
  })
  it('falls back to the category and keeps the tilt within a degree and a quarter', () => {
    expect(openingHue(null, 'labs')).toBe(openingHue('labs'))
    for (let i = 0; i < 200; i++) expect(Math.abs(openingTilt(`id-${i}`))).toBeLessThanOrEqual(1.2)
  })
})
