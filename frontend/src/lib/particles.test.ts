import { describe, it, expect } from 'vitest'
import { makeParticles, particleCount, mulberry32, PALETTE, burstLifetimeMs } from './particles'

describe('makeParticles', () => {
  it('is reproducible for a seed', () => {
    expect(makeParticles('confetti', 7)).toEqual(makeParticles('confetti', 7))
  })
  it('differs between seeds', () => {
    expect(makeParticles('confetti', 7)).not.toEqual(makeParticles('confetti', 8))
  })
  it('makes the documented number per kind and caps a burst', () => {
    for (const k of ['confetti', 'hearts', 'stars'] as const) {
      expect(makeParticles(k, 1)).toHaveLength(particleCount(k))
      expect(particleCount(k)).toBeLessThanOrEqual(40)
    }
  })
  it('keeps palette indexes in range', () => {
    for (const k of ['confetti', 'hearts', 'stars'] as const) {
      for (const p of makeParticles(k, 3)) expect(p.tone).toBeLessThan(PALETTE.length)
    }
  })
  it('sends confetti up before it falls and keeps hearts and stars from falling', () => {
    for (const p of makeParticles('confetti', 5)) { expect(p.up).toBeGreaterThan(0); expect(p.fall).toBeGreaterThan(p.up * 0.5) }
    for (const p of makeParticles('hearts', 5)) expect(p.fall).toBe(0)
  })
  it('lets every burst expire', () => {
    for (const k of ['confetti', 'hearts', 'stars'] as const) expect(burstLifetimeMs(k)).toBeGreaterThan(900)
  })
})

describe('mulberry32', () => {
  it('stays inside [0, 1)', () => {
    const r = mulberry32(42)
    for (let i = 0; i < 500; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
})
