/* ─────────────────────────────────────────────────────────────────────────
   Sticker geometry — redesign section 11, step 1.

   Generators, fixed paths and the per-shape measured safe area. Pure, no DOM,
   no React, so `vitest` (node environment) covers it directly. The component
   that renders this is `components/Sticker.tsx`.

   THE ONE RULE THAT KEEPS BREAKING: each shape carries its OWN measured text
   inset. A shared inset is a bug. Deep-notch shapes (star4, quatrefoil, gear)
   host a centred axis-aligned mark only, never a word, and marks render at
   40% of the sticker with ZERO container padding — nesting a percentage width
   inside an already-inset box compounds the inset (star4 went to 6% that way).

   Colours: hue names only, resolved to `var(--…)` tokens for render and to
   hexes for the contrast branch. Nothing here adds a colour.
   ───────────────────────────────────────────────────────────────────────── */

/* ── hues ─────────────────────────────────────────────────────────────── */

export type StickerHue =
  | 'welfare'
  | 'events'
  | 'labs'
  | 'ops'
  | 'content'
  | 'pink'
  | 'lemon'
  | 'tomato'
  | 'sky'
  | 'grape'
  | 'teal'
  | 'rust'
  | 'ink'
  | 'paper'

/** What gets painted. Always a token reference, never a literal. */
export const HUE_VAR: Record<StickerHue, string> = {
  welfare: 'var(--welfare)',
  events: 'var(--events)',
  labs: 'var(--labs)',
  ops: 'var(--ops)',
  content: 'var(--content)',
  pink: 'var(--pink)',
  lemon: 'var(--lemon)',
  tomato: 'var(--tomato)',
  sky: 'var(--sky)',
  grape: 'var(--grape)',
  teal: 'var(--teal)',
  rust: 'var(--rust)',
  ink: 'var(--ink)',
  paper: 'var(--paper)',
}

/** The same values as hexes, read from `styles/tokens.css`, for contrast maths only. */
export const HUE_HEX: Record<StickerHue, string> = {
  welfare: '#1B8A5A',
  events: '#3DA9FC',
  labs: '#FFC700',
  ops: '#12909C',
  content: '#7E5BFF',
  pink: '#FF4D8C',
  lemon: '#FFC700',
  tomato: '#FF4D2E',
  sky: '#3DA9FC',
  grape: '#7E5BFF',
  teal: '#12909C',
  rust: '#C4231A',
  ink: '#0A0A0A',
  paper: '#F4EFE0',
}

export const INK_HEX = '#0A0A0A'
export const PAPER_HEX = '#F4EFE0'

function channel(v: number): number {
  const s = v / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

/** WCAG relative luminance of a `#RRGGBB` string. */
export function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two `#RRGGBB` strings. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * The contrast branch, in the component and never patched per instance.
 * Ink sits on a sticker unless ink fails AA on that fill and paper does
 * better, which is exactly the `#C4185C` / rust case that has been broken and
 * re-fixed five times on this project.
 */
export function stickerTextHex(hue: StickerHue): string {
  const fill = HUE_HEX[hue]
  const ink = contrastRatio(INK_HEX, fill)
  const paper = contrastRatio(PAPER_HEX, fill)
  if (ink >= 4.5) return INK_HEX
  return paper > ink ? PAPER_HEX : INK_HEX
}

/* ── generators ───────────────────────────────────────────────────────── */

const C = 50 // viewBox centre, all square shapes are 0 0 100 100

function pt(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180
  return [C + r * Math.cos(a), C + r * Math.sin(a)]
}

function fmt(n: number): string {
  return n.toFixed(2)
}

/**
 * A star burst of `n` points alternating between `r1` (tip) and `r2` (valley).
 * The first tip sits at 12 o'clock, matching every burst in AQ Stickers.dc.html.
 */
export function burst(n: number, r1 = 46, r2 = 32): string {
  const step = 180 / n
  const parts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const [x, y] = pt(-90 + i * step, i % 2 === 0 ? r1 : r2)
    parts.push(`${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`)
  }
  return `${parts.join('')}Z`
}

/**
 * A scalloped rosette: `n` outward arcs on a circle of radius `R`. The arc
 * radius is derived from the chord, not guessed, so petals meet cleanly at
 * any `n` (the 0.9525 factor is measured off the design pack's four rosettes).
 */
export function rosette(n: number, R = 44): string {
  const step = 360 / n
  const arcR = 0.9525 * R * Math.sin(Math.PI / n)
  const [sx, sy] = pt(-90, R)
  const parts = [`M${fmt(sx)} ${fmt(sy)}`]
  for (let i = 1; i <= n; i++) {
    const [x, y] = pt(-90 + i * step, R)
    parts.push(`A${fmt(arcR)} ${fmt(arcR)} 0 0 1 ${fmt(x)} ${fmt(y)}`)
  }
  return `${parts.join('')}Z`
}

/**
 * A smooth wobble: radius oscillates sinusoidally between `base + amp` and
 * `base - amp` `n` times around. Sampled as a polyline, which is what the
 * design pack ships.
 */
export function wavy(n: number, base = 41, amp = 5, steps = 180): string {
  const parts: string[] = []
  for (let i = 0; i < steps; i++) {
    const deg = -90 + (i * 360) / steps
    const r = base + amp * Math.cos((n * (deg + 90) * Math.PI) / 180)
    const [x, y] = pt(deg, r)
    parts.push(`${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`)
  }
  return `${parts.join('')}Z`
}

/**
 * A cog: `n` square-ish teeth. Same sampling as `wavy` but with a hardened
 * (tanh-like) profile, so the teeth have flats instead of peaks.
 */
export function gear(n: number, base = 41, amp = 5, steps = 240): string {
  const parts: string[] = []
  for (let i = 0; i < steps; i++) {
    const deg = -90 + (i * 360) / steps
    const w = Math.cos((n * (deg + 90) * Math.PI) / 180)
    // square the wave off while keeping the corners rounded enough to stroke
    const squared = Math.tanh(w * 2.6) / Math.tanh(2.6)
    const [x, y] = pt(deg, base + amp * squared)
    parts.push(`${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`)
  }
  return `${parts.join('')}Z`
}

/* ── the pack ─────────────────────────────────────────────────────────── */

export type StickerShape =
  // square, 0 0 100 100
  | 'circle'
  | 'hexagon'
  | 'octagon'
  | 'diamond'
  | 'shield'
  | 'quatrefoil'
  | 'cloud'
  | 'splat'
  | 'drip'
  | 'blob'
  | 'star4'
  | 'burst10'
  | 'burst12'
  | 'burst14'
  | 'burst16'
  | 'burst18'
  | 'rosette10'
  | 'rosette12'
  | 'rosette14'
  | 'rosette16'
  | 'wavy8'
  | 'wavy12'
  | 'gear12'
  | 'gear16'
  // wide, 0 0 200 64
  | 'ticket'
  | 'ribbon'
  | 'flag'
  | 'chevron'

export interface ShapeDef {
  d: string
  /** viewBox width. */
  w: number
  /** viewBox height. */
  h: number
}

const SQ = (d: string): ShapeDef => ({ d, w: 100, h: 100 })
const WIDE = (d: string): ShapeDef => ({ d, w: 200, h: 64 })

export const SHAPES: Record<StickerShape, ShapeDef> = {
  circle: SQ('M50 6A44 44 0 1 1 49.99 6Z'),
  hexagon: SQ('M50.00 5.00L88.97 27.50L88.97 72.50L50.00 95.00L11.03 72.50L11.03 27.50Z'),
  octagon: SQ('M91.57 32.78L91.57 67.22L67.22 91.57L32.78 91.57L8.43 67.22L8.43 32.78L32.78 8.43L67.22 8.43Z'),
  diamond: SQ('M50 4L96 50L50 96L4 50Z'),
  shield: SQ('M50 5L88 17V50C88 72 71 88 50 95C29 88 12 72 12 50V17Z'),
  quatrefoil: SQ(
    'M50 8C58 8 64 14 64 22C64 25 63 28 62 30C64 29 67 28 70 28C78 28 84 34 84 42C84 50 78 56 70 56C67 56 64 55 62 54C63 56 64 59 64 62C64 70 58 76 50 76C42 76 36 70 36 62C36 59 37 56 38 54C36 55 33 56 30 56C22 56 16 50 16 42C16 34 22 28 30 28C33 28 36 29 38 30C37 28 36 25 36 22C36 14 42 8 50 8Z'
  ),
  cloud: SQ('M26 70C16 70 8 62 8 52C8 43 15 35 24 34C27 22 38 13 51 13C64 13 75 22 78 34C87 35 94 43 94 52C94 62 86 70 76 70Z'),
  splat: SQ('M32 14C44 6 58 8 68 16C78 24 74 34 82 40C90 46 96 56 90 68C84 80 70 82 60 88C50 94 36 92 26 82C16 72 20 60 14 52C8 44 12 26 32 14Z'),
  drip: SQ('M50 6C68 6 86 22 86 44C86 60 74 72 62 76C62 84 58 94 50 94C42 94 38 84 38 76C26 72 14 60 14 44C14 22 32 6 50 6Z'),
  blob: SQ('M28 12C42 4 62 4 74 14C88 25 96 40 92 58C88 76 72 92 52 94C32 96 14 86 7 68C0 50 8 26 28 12Z'),
  star4: SQ('M50 4L61 39L96 50L61 61L50 96L39 61L4 50L39 39Z'),
  burst10: SQ(burst(10, 46, 31)),
  burst12: SQ(burst(12, 46, 32)),
  burst14: SQ(burst(14, 46, 33)),
  burst16: SQ(burst(16, 46, 34)),
  burst18: SQ(burst(18, 46, 36)),
  rosette10: SQ(rosette(10)),
  rosette12: SQ(rosette(12)),
  rosette14: SQ(rosette(14)),
  rosette16: SQ(rosette(16)),
  wavy8: SQ(wavy(8)),
  wavy12: SQ(wavy(12)),
  gear12: SQ(gear(12)),
  gear16: SQ(gear(16)),
  ticket: WIDE(
    'M10 6H190C190 6 186 14 186 20C186 26 190 32 190 32C190 32 186 38 186 44C186 50 190 58 190 58H10C10 58 14 50 14 44C14 38 10 32 10 32C10 32 14 26 14 20C14 14 10 6 10 6Z'
  ),
  ribbon: WIDE('M4 8H196L178 32L196 56H4L22 32Z'),
  flag: WIDE('M6 8H194V56L100 44L6 56Z'),
  chevron: WIDE('M8 8H150L192 32L150 56H8L38 32Z'),
}

/**
 * MEASURED safe areas, as `[inset %, y-shift %]`. A shared inset is a bug:
 * these are per shape and were measured, not derived. The square values come
 * straight from the section 11 spec table; the wide four are measured off the
 * same pack (their notch is horizontal, so the inset is asymmetric in effect
 * but expressed the same way).
 */
export const SAFE: Record<StickerShape, [number, number]> = {
  circle: [16, 0],
  hexagon: [19, 0],
  octagon: [18, 0],
  diamond: [27, 0],
  shield: [23, 0],
  quatrefoil: [32, 0],
  cloud: [24, -5],
  splat: [22, 0],
  drip: [21, 0],
  blob: [20, 0],
  star4: [36, 0],
  burst10: [24, 0],
  burst12: [24, 0],
  burst14: [23, 0],
  burst16: [22, 0],
  burst18: [21, 0],
  rosette10: [21, 0],
  rosette12: [21, 0],
  rosette14: [21, 0],
  rosette16: [21, 0],
  wavy8: [19, 0],
  wavy12: [19, 0],
  gear12: [27, 0],
  gear16: [27, 0],
  ticket: [9, 0],
  ribbon: [13, 0],
  flag: [6, -4],
  chevron: [15, 0],
}

/**
 * Deep-notch shapes. Their arms point up, right, down and left, so a plus or
 * radial mark lands on material while a diagonal glyph overhangs a valley.
 * These host a centred axis-aligned MARK only, never a word.
 */
export const DEEP_NOTCH: readonly StickerShape[] = ['star4', 'quatrefoil', 'gear12', 'gear16'] as const

export function isDeepNotch(shape: StickerShape): boolean {
  return DEEP_NOTCH.includes(shape)
}

/** Marks render at 40% of the sticker, on a container with ZERO padding. */
export const MARK_SCALE = 0.4

/** Centred, axis-aligned marks. Stroked paths in a 0 0 100 100 box. */
export type StickerMark = 'plus' | 'cross' | 'ring' | 'globe' | 'arch' | 'heart' | 'smile'

export interface MarkDef {
  d: string
  strokeWidth: number
  filled?: boolean
}

export const MARKS: Record<StickerMark, MarkDef> = {
  plus: { d: 'M50 26v48M26 50h48', strokeWidth: 12 },
  cross: { d: 'M50 18V82M22 34L78 66M22 66L78 34', strokeWidth: 10 },
  ring: { d: 'M50 15A35 35 0 1 1 49.99 15', strokeWidth: 12 },
  globe: { d: 'M20 50h60M50 20a44 44 0 0 1 0 60M50 20a44 44 0 0 0 0 60', strokeWidth: 6 },
  arch: { d: 'M17 52A33 33 0 0 1 83 52', strokeWidth: 12 },
  smile: { d: 'M34 60a18 18 0 0 0 32 0', strokeWidth: 10 },
  heart: {
    d: 'M50 22a18 18 0 0 1 18 18c0 14-18 34-18 34S32 54 32 40a18 18 0 0 1 18-18Z',
    strokeWidth: 0,
    filled: true,
  },
}

/* ── rationing ────────────────────────────────────────────────────────── */

/** Rotation is set per placement, never 0, never past 12, never randomised. */
export const ROTATION_MIN = -11
export const ROTATION_MAX = 9

export function isValidRotation(deg: number): boolean {
  return Number.isFinite(deg) && deg !== 0 && deg >= ROTATION_MIN && deg <= ROTATION_MAX
}

/** 88 to 160px desktop, 72 to 132px phone. Never larger than the headline beside it. */
export const SIZE_MIN = 72
export const SIZE_MAX = 160

export function isValidSize(px: number): boolean {
  return Number.isFinite(px) && px >= SIZE_MIN && px <= SIZE_MAX
}

/** At most three per viewport, at most one per card. */
export const MAX_PER_VIEWPORT = 3

/** The die-cut edge. One number, one place. */
export const KEYLINE_WIDTH = 11
export const KEYLINE_COLOR = '#FFFFFF'
export const STICKER_SHADOW = 'drop-shadow(2px 4px 5px rgba(0,0,0,.35))'
