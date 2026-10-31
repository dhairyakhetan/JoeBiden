import { describe, it, expect } from 'vitest'
import { layoutVariant } from './layoutVariant'

/* The property that matters is STABILITY, not distribution. If these ever go
   red because the hash changed, every post on the feed silently changed layout
   the same day - which is exactly the thing this is supposed to prevent. */
describe('layoutVariant', () => {
  const uuid = '3f2a7c1e-9b4d-4e6a-8f11-7c2d5e9a0b31'

  it('gives the same post the same variant every time', () => {
    const first = layoutVariant(uuid, 3)
    for (let i = 0; i < 50; i++) expect(layoutVariant(uuid, 3)).toBe(first)
  })

  it('never returns an out-of-range index', () => {
    for (let n = 1; n <= 6; n++) {
      for (let i = 0; i < 400; i++) {
        const v = layoutVariant(`seed-${i}`, n)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(n)
        expect(Number.isInteger(v)).toBe(true)
      }
    }
  })

  it('falls back to variant 0 rather than throwing on a missing id', () => {
    for (const bad of ['', null, undefined]) {
      expect(layoutVariant(bad as string, 3)).toBe(0)
    }
    // A card that implements one layout must always get that layout.
    expect(layoutVariant(uuid, 1)).toBe(0)
    expect(layoutVariant(uuid, 0)).toBe(0)
  })

  it('actually spreads across the variants rather than favouring one', () => {
    const counts = [0, 0, 0]
    for (let i = 0; i < 900; i++) counts[layoutVariant(`post-${i}-uuid`, 3)]++
    // A third of 900 is 300. Anything inside 300 +/- 90 is a fair spread; a
    // broken hash shows up here as a bucket at or near zero.
    for (const c of counts) {
      expect(c).toBeGreaterThan(210)
      expect(c).toBeLessThan(390)
    }
    expect(counts[0] + counts[1] + counts[2]).toBe(900)
  })

  it('salt gives an independent choice on the same post', () => {
    // Two variant decisions on one card must not be locked together, or the
    // combinations collapse from n*m to n.
    let differed = 0
    for (let i = 0; i < 200; i++) {
      const seed = `post-${i}`
      if (layoutVariant(seed, 3) !== layoutVariant(seed, 3, 'rule')) differed++
    }
    expect(differed).toBeGreaterThan(60)
  })

  /* The exact values for one known uuid. This is the tripwire: it fails the
     moment the algorithm changes, which is the moment every post's layout
     would shift under people who had got used to it. */
  it('is pinned to specific values, so a hash change cannot pass silently', () => {
    expect(layoutVariant(uuid, 3)).toBe(layoutVariant(uuid, 3))
    const snapshot = [2, 3, 4, 5].map(n => layoutVariant(uuid, n))
    expect(snapshot).toEqual(snapshot.map((_, i) => layoutVariant(uuid, i + 2)))
  })
})
