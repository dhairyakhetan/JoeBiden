import type { GlyphName } from '../components/GlyphIcon'

/**
 * Badges are DERIVED, never stored: each one is a threshold on a count the profile already loads (docs/plans/delight-pass.md,
 * "visual only"). Nothing is written anywhere, nobody is ranked, and a badge cannot be given or taken away by anyone.
 */
export interface BadgeInputs { posts: number; likes: number; drives: number; hours: number; teams: number; achievements: number }

export type BadgeMetric = keyof BadgeInputs

export interface BadgeDef { id: string; name: string; blurb: string; glyph: GlyphName; metric: BadgeMetric; target: number; unit: string }

export const BADGES: BadgeDef[] = [
  { id: 'first-post', name: 'first words', blurb: 'posted for the first time', glyph: 'pen', metric: 'posts', target: 1, unit: 'post' },
  { id: 'storyteller', name: 'storyteller', blurb: 'ten posts and counting', glyph: 'thread', metric: 'posts', target: 10, unit: 'posts' },
  { id: 'loved', name: 'well loved', blurb: 'twenty-five likes earned', glyph: 'sparkle', metric: 'likes', target: 25, unit: 'likes' },
  { id: 'first-drive', name: 'boots on the ground', blurb: 'showed up to a drive', glyph: 'shoe', metric: 'drives', target: 1, unit: 'drive' },
  { id: 'regular', name: 'regular', blurb: 'five drives attended', glyph: 'calendar', metric: 'drives', target: 5, unit: 'drives' },
  { id: 'long-haul', name: 'long haul', blurb: 'twenty hours of volunteering', glyph: 'cap', metric: 'hours', target: 20, unit: 'hours' },
  { id: 'team-player', name: 'team player', blurb: 'on two teams at once', glyph: 'collab', metric: 'teams', target: 2, unit: 'teams' },
  { id: 'collector', name: 'collector', blurb: 'three achievements on the CV', glyph: 'certificate', metric: 'achievements', target: 3, unit: 'achievements' },
]

export interface BadgeState { def: BadgeDef; value: number; earned: boolean; progress: number }

const clean = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0)

export function badgeStates(inputs: BadgeInputs, defs: BadgeDef[] = BADGES): BadgeState[] {
  return defs.map(def => {
    const value = clean(inputs[def.metric])
    return { def, value, earned: value >= def.target, progress: Math.min(1, value / def.target) }
  })
}

export type LevelName = 'new here' | 'sprout' | 'sapling' | 'young tree' | 'banyan'

/** A level is just how many badges are earned, named for how a tree grows. */
export function levelFor(earned: number, total: number = BADGES.length): { name: LevelName; step: number; of: number } {
  const share = total > 0 ? earned / total : 0
  const name: LevelName = earned <= 0 ? 'new here' : share < 0.35 ? 'sprout' : share < 0.6 ? 'sapling' : share < 1 ? 'young tree' : 'banyan'
  const order: LevelName[] = ['new here', 'sprout', 'sapling', 'young tree', 'banyan']
  return { name, step: order.indexOf(name), of: order.length - 1 }
}

/** Earned badges this device has not shown the member yet: the ones that get the unlock flip. */
export function unseenEarned(earnedIds: string[], seenIds: string[]): string[] {
  const seen = new Set(seenIds)
  return earnedIds.filter(id => !seen.has(id))
}

/** The one badge closest to being earned, for the "next up" line. Ties go to the earlier badge. */
export function nextUp(states: BadgeState[]): BadgeState | null {
  const open = states.filter(s => !s.earned)
  if (!open.length) return null
  return open.reduce((best, s) => (s.progress > best.progress ? s : best))
}
