import { describe, expect, it } from 'vitest'
import { starShadows } from './stars'

describe('starShadows', () => {
  it('is deterministic for a seed', () => {
    expect(starShadows(40, 7, '#fff')).toBe(starShadows(40, 7, '#fff'))
  })
  it('differs between seeds', () => {
    expect(starShadows(40, 7, '#fff')).not.toBe(starShadows(40, 8, '#fff'))
  })
  it('paints exactly `count` stars, all inside the viewport', () => {
    const parts = starShadows(25, 3, '#c9a24b').split(', ')
    expect(parts).toHaveLength(25)
    for (const p of parts) {
      const m = /^(\d+\.\d+)vw (\d+\.\d+)vh #c9a24b$/.exec(p)
      expect(m).not.toBeNull()
      expect(Number(m![1])).toBeGreaterThanOrEqual(0)
      expect(Number(m![1])).toBeLessThanOrEqual(100)
      expect(Number(m![2])).toBeGreaterThanOrEqual(0)
      expect(Number(m![2])).toBeLessThanOrEqual(100)
    }
  })
})
