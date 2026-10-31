import type { Celebration } from './delight'

export interface Particle {
  id: number
  /** Horizontal travel in px (negative is left). */
  dx: number
  /** How far it rises before gravity wins, in px. */
  up: number
  /** Total fall below the origin, in px. */
  fall: number
  rot: number
  delay: number
  size: number
  /** Index into the palette. */
  tone: number
}

export const PALETTE = ['var(--welfare)', 'var(--pink)', 'var(--lemon)', 'var(--sky)', 'var(--grape)', 'var(--tomato)'] as const

const COUNT: Record<Celebration, number> = { confetti: 38, hearts: 7, stars: 10 }

/** A tiny seeded generator so a burst is reproducible in tests; Math.random is only used to seed it in the renderer. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function particleCount(kind: Celebration): number {
  return COUNT[kind]
}

export function makeParticles(kind: Celebration, seed: number): Particle[] {
  const rand = mulberry32(seed)
  const n = COUNT[kind]
  return Array.from({ length: n }, (_, i) => {
    if (kind === 'hearts') {
      // Rise with a sway: dx is the sway amplitude, fall is unused.
      return { id: i, dx: (rand() - 0.5) * 70, up: 70 + rand() * 60, fall: 0, rot: (rand() - 0.5) * 40, delay: i * 0.05 + rand() * 0.05, size: 12 + rand() * 10, tone: i % 2 ? 1 : 5 }
    }
    if (kind === 'stars') {
      const angle = (i / n) * Math.PI * 2 + rand() * 0.3
      const dist = 40 + rand() * 40
      return { id: i, dx: Math.cos(angle) * dist, up: -Math.sin(angle) * dist, fall: 0, rot: (rand() - 0.5) * 120, delay: rand() * 0.08, size: 10 + rand() * 10, tone: 2 + (i % 3) }
    }
    // confetti: a fan upward, then gravity
    const spread = (rand() - 0.5) * 2
    return { id: i, dx: spread * 150, up: 70 + rand() * 90, fall: 120 + rand() * 120, rot: (rand() - 0.5) * 900, delay: rand() * 0.06, size: 6 + rand() * 6, tone: i % PALETTE.length }
  })
}

/** How long a burst lives, so the host can drop it. Matches the longest CSS animation plus the longest delay. */
export function burstLifetimeMs(kind: Celebration): number {
  return kind === 'confetti' ? 1700 : kind === 'hearts' ? 1700 : 1300
}
