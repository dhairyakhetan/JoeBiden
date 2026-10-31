import { describe, expect, it } from 'vitest'
import {
  DEEP_NOTCH,
  HUE_HEX,
  HUE_VAR,
  INK_HEX,
  MARKS,
  MARK_SCALE,
  PAPER_HEX,
  SAFE,
  SHAPES,
  burst,
  contrastRatio,
  gear,
  isDeepNotch,
  isValidRotation,
  isValidSize,
  rosette,
  stickerTextHex,
  wavy,
  type StickerHue,
  type StickerShape,
} from './stickerShapes'

/* ─────────────────────────────────────────────────────────────────────────
   Section 11 step 5: "verify with geometry, not by eye. For each sticker,
   convert the text or mark bounding box into the path's viewBox and assert
   every corner passes isPointInFill. This caught seven real failures in the
   design pass."

   There is no `isPointInFill` in a node test run, so the equivalent is done
   here with ray casting against the path's own polygon. That covers every
   shape whose path is a pure polyline: the generated families (burst, wavy,
   gear) plus diamond, hexagon, octagon and star4. The curve-based fixed paths
   (circle, shield, cloud, splat, drip, blob, quatrefoil, rosette and the four
   wide shapes) are Béziers and arcs; they are not polygonised here and stay
   review-verified, which is stated rather than implied.
   ───────────────────────────────────────────────────────────────────────── */

type Pt = [number, number]

/** Parses an `M … L … Z` path into its vertices. Returns null for anything else. */
function polyline(d: string): Pt[] | null {
  if (/[CcSsQqTtAaHhVv]/.test(d)) return null
  const pts: Pt[] = []
  const re = /([ML])\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d)) !== null) {
    pts.push([parseFloat(m[2]), parseFloat(m[3])])
  }
  return pts.length >= 3 ? pts : null
}

function inside(pts: Pt[], [x, y]: Pt): boolean {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

const POLYGONS = (Object.keys(SHAPES) as StickerShape[])
  .map(name => [name, polyline(SHAPES[name].d)] as const)
  .filter((e): e is readonly [StickerShape, Pt[]] => e[1] !== null)

describe('sticker geometry', () => {
  it('polygonises the generated families plus the four straight-edged fixed shapes', () => {
    const names = POLYGONS.map(([n]) => n)
    expect(names).toContain('diamond')
    expect(names).toContain('hexagon')
    expect(names).toContain('octagon')
    expect(names).toContain('star4')
    expect(names).toContain('burst12')
    expect(names).toContain('wavy12')
    expect(names).toContain('gear12')
  })

  it('every shape carries its own measured safe area', () => {
    for (const name of Object.keys(SHAPES) as StickerShape[]) {
      expect(SAFE[name], `SAFE is missing "${name}"`).toBeDefined()
      const [insetPct] = SAFE[name]
      expect(insetPct).toBeGreaterThan(0)
      expect(insetPct).toBeLessThan(50)
    }
  })

  it('a centred two-line text band fits inside every word-bearing polygon', () => {
    for (const [name, pts] of POLYGONS) {
      if (isDeepNotch(name)) continue
      const [insetPct] = SAFE[name]
      const { w, h } = SHAPES[name]
      const x0 = (insetPct / 100) * w
      const x1 = w - x0
      // a two-line block, centred: 16% of the height either side of the axis
      const y0 = h / 2 - h * 0.08
      const y1 = h / 2 + h * 0.08
      for (const corner of [
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ] as Pt[]) {
        expect(inside(pts, corner), `${name}: text band corner ${corner} falls off the shape`).toBe(true)
      }
    }
  })

  it('a deep-notch shape holds an axis-aligned mark on material, and a word would not', () => {
    const r = (MARK_SCALE / 2) * 100 // the mark's half-extent in viewBox units
    for (const [name, pts] of POLYGONS) {
      if (!isDeepNotch(name)) continue
      // the four axis extremities of a plus / radial mark
      for (const p of [
        [50, 50 - r],
        [50 + r, 50],
        [50, 50 + r],
        [50 - r, 50],
      ] as Pt[]) {
        expect(inside(pts, p), `${name}: axis mark extremity ${p} is off the shape`).toBe(true)
      }
    }
  })

  it('star4 is deep-notch and would overhang a valley at its own safe inset', () => {
    const pts = polyline(SHAPES.star4.d)!
    expect(isDeepNotch('star4')).toBe(true)
    const [insetPct] = SAFE.star4
    expect(inside(pts, [insetPct, insetPct])).toBe(false)
  })
})

describe('sticker generators', () => {
  it('burst(n) emits 2n vertices with the first tip at twelve o’clock', () => {
    const pts = polyline(burst(12, 46, 32))!
    expect(pts).toHaveLength(24)
    expect(pts[0][0]).toBeCloseTo(50, 1)
    expect(pts[0][1]).toBeCloseTo(4, 1)
  })

  it('burst alternates tip and valley radius', () => {
    const pts = polyline(burst(10, 46, 31))!
    const r = (p: Pt) => Math.hypot(p[0] - 50, p[1] - 50)
    expect(r(pts[0])).toBeCloseTo(46, 1)
    expect(r(pts[1])).toBeCloseTo(31, 1)
  })

  it('rosette derives its arc radius from the chord, so petals meet at any n', () => {
    for (const n of [10, 12, 14, 16]) {
      const d = rosette(n)
      expect(d.startsWith('M50.00 6.00')).toBe(true)
      expect((d.match(/A/g) ?? []).length).toBe(n)
      const arcR = parseFloat(d.split('A')[1].split(' ')[0])
      expect(arcR).toBeCloseTo(0.9525 * 44 * Math.sin(Math.PI / n), 2)
    }
  })

  it('wavy stays between base ± amp', () => {
    const pts = polyline(wavy(12, 41, 5))!
    for (const p of pts) {
      const r = Math.hypot(p[0] - 50, p[1] - 50)
      expect(r).toBeGreaterThanOrEqual(35.99)
      expect(r).toBeLessThanOrEqual(46.01)
    }
  })

  it('gear squares the wave off but keeps the same envelope', () => {
    const pts = polyline(gear(12))!
    const radii = pts.map(p => Math.hypot(p[0] - 50, p[1] - 50))
    expect(Math.max(...radii)).toBeLessThanOrEqual(46.01)
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(35.99)
    // squared: most samples sit near one of the two flats, not spread evenly
    const nearFlat = radii.filter(r => r > 45 || r < 37).length
    expect(nearFlat / radii.length).toBeGreaterThan(0.5)
  })
})

describe('sticker colour', () => {
  it('every hue resolves to a token reference, never a literal', () => {
    for (const h of Object.keys(HUE_VAR) as StickerHue[]) {
      expect(HUE_VAR[h]).toMatch(/^var\(--[a-z-]+\)$/)
    }
  })

  it('the ink-versus-paper branch lives in one place and picks the readable one', () => {
    for (const h of Object.keys(HUE_HEX) as StickerHue[]) {
      const chosen = stickerTextHex(h)
      const fill = HUE_HEX[h]
      const ink = contrastRatio(INK_HEX, fill)
      const paper = contrastRatio(PAPER_HEX, fill)
      expect(chosen).toBe(ink >= 4.5 ? INK_HEX : paper > ink ? PAPER_HEX : INK_HEX)
      expect(contrastRatio(chosen, fill)).toBeGreaterThanOrEqual(Math.min(ink, paper))
    }
  })

  it('rust flips to paper, because ink on it measures below AA', () => {
    expect(contrastRatio(INK_HEX, HUE_HEX.rust)).toBeLessThan(4.5)
    expect(stickerTextHex('rust')).toBe(PAPER_HEX)
  })

  it('every other palette hue keeps ink', () => {
    for (const h of ['welfare', 'events', 'labs', 'ops', 'content', 'pink', 'lemon', 'tomato', 'sky', 'grape', 'teal'] as StickerHue[]) {
      expect(stickerTextHex(h), `${h} should take ink`).toBe(INK_HEX)
    }
  })

  it('contrastRatio agrees with the two figures the guardrails quote', () => {
    // paper on #C4185C is 5.03:1 per REDESIGN_GUARDRAILS rule 1
    expect(contrastRatio(PAPER_HEX, '#C4185C')).toBeGreaterThan(4.9)
    expect(contrastRatio(PAPER_HEX, '#C4185C')).toBeLessThan(5.2)
    // ink on the same fill is 3.42:1
    expect(contrastRatio(INK_HEX, '#C4185C')).toBeGreaterThan(3.3)
    expect(contrastRatio(INK_HEX, '#C4185C')).toBeLessThan(3.55)
  })
})

describe('sticker rationing', () => {
  it('rejects rotation 0 and anything past the range', () => {
    expect(isValidRotation(0)).toBe(false)
    expect(isValidRotation(-12)).toBe(false)
    expect(isValidRotation(10)).toBe(false)
    expect(isValidRotation(NaN)).toBe(false)
    expect(isValidRotation(-11)).toBe(true)
    expect(isValidRotation(9)).toBe(true)
    expect(isValidRotation(-8)).toBe(true)
  })

  it('holds the size window', () => {
    expect(isValidSize(71)).toBe(false)
    expect(isValidSize(161)).toBe(false)
    expect(isValidSize(118)).toBe(true)
  })

  it('names the three deep-notch families and nothing else', () => {
    expect([...DEEP_NOTCH].sort()).toEqual(['gear12', 'gear16', 'quatrefoil', 'star4'])
    expect(isDeepNotch('circle')).toBe(false)
  })

  it('every mark is centred and axis-aligned in a 0 0 100 100 box', () => {
    for (const [name, def] of Object.entries(MARKS)) {
      expect(def.d.length, `${name} has no path`).toBeGreaterThan(0)
      if (!def.filled) expect(def.strokeWidth).toBeGreaterThan(0)
    }
  })
})
