/**
 * A role card has no photo, so its panel is a flat fill. To stop a row of them reading as one card repeated,
 * each role gets a stable look from its id: a pattern and where the shape sits. Pure and seeded, so the same
 * role looks the same on every page and every visit. The category still decides the colour.
 */
export const OPENING_PATTERNS = ['disc', 'stripes', 'dots', 'grid', 'wedge'] as const
export type OpeningPattern = (typeof OPENING_PATTERNS)[number]

export interface OpeningLook {
  pattern: OpeningPattern
  /** shape anchor, percent of the panel */
  x: number
  y: number
  /** shape scale, 0.8 to 1.3 */
  size: number
}

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export function openingLook(id: string, category = ''): OpeningLook {
  const h = hash(`${id}:${category}`)
  return {
    pattern: OPENING_PATTERNS[h % OPENING_PATTERNS.length],
    x: 60 + ((h >>> 3) % 41) - 10,
    y: 55 + ((h >>> 9) % 41) - 10,
    size: 0.8 + ((h >>> 15) % 51) / 100,
  }
}

export function openingLookStyle(look: OpeningLook): Record<string, string> {
  return { '--ox': `${look.x}%`, '--oy': `${look.y}%`, '--os': String(look.size) }
}

/**
 * Roles in one category used to share one colour, so a row of them read as a single purple block. The tile colour now
 * follows the team (so a team's roles match) and cycles through the whole palette across teams.
 */
export const TILE_HUES = ['var(--grape)', 'var(--sky)', 'var(--lemon)', 'var(--tomato)', 'var(--welfare)', 'var(--teal)', 'var(--pink)'] as const

export function openingHue(teamName: string | null | undefined, category = ''): string {
  return TILE_HUES[hash(`${(teamName || category).toLowerCase()}`) % TILE_HUES.length]
}

/** A resting tilt of up to a degree either way, from the id, so a grid of tiles feels placed by hand. */
export function openingTilt(id: string): number {
  return ((hash(`tilt:${id}`) % 25) - 12) / 10
}
