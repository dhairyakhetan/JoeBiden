import { describe, expect, it } from 'vitest'
import { arcPose, EDGE_ON } from './arc'

describe('arcPose', () => {
  it('stands the centre card edge-on, in the middle', () => {
    const c = arcPose(0)
    expect(Math.abs(c.rot)).toBe(EDGE_ON)
    expect(c.x).toBe(0)
  })
  it('opens cards out toward the edges until they face the viewer', () => {
    expect(Math.abs(arcPose(1).rot)).toBeGreaterThan(Math.abs(arcPose(3).rot))
    expect(arcPose(3).rot).toBeGreaterThan(arcPose(5).rot)
    expect(arcPose(7).rot).toBe(0)
    expect(Math.abs(arcPose(1).rot)).toBeLessThan(EDGE_ON)
  })
  it('mirrors left and right', () => {
    for (const o of [0.5, 1, 2.5, 4, 6.5]) {
      const r = arcPose(o)
      const l = arcPose(-o)
      expect(l.x).toBeCloseTo(-r.x)
      expect(l.rot).toBeCloseTo(-r.rot)
      expect(l.z).toBeCloseTo(r.z)
      expect(l.order).toBe(r.order)
    }
  })
  it('puts outer cards in front and moves them out monotonically', () => {
    let prev = arcPose(0)
    for (let o = 1; o <= 7; o++) {
      const p = arcPose(o)
      expect(p.x).toBeGreaterThan(prev.x)
      expect(p.order).toBeGreaterThan(prev.order)
      expect(p.scale).toBeGreaterThanOrEqual(prev.scale)
      prev = p
    }
  })
  it('is continuous, so a drifting arc never jumps', () => {
    for (let o = -7; o < 7; o += 0.25) {
      const a = arcPose(o)
      const b = arcPose(o + 0.01)
      expect(Math.abs(a.x - b.x)).toBeLessThan(3)
      // compare the visible sliver, not the sign: +86 and -86 are the same edge-on card seen from either side
      if (Math.abs(o) > 0.05) expect(Math.abs(Math.abs(a.rot) - Math.abs(b.rot))).toBeLessThan(3)
    }
  })
})
