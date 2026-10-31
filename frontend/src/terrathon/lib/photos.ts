/**
 * Real photographs from AquaTerra's own sessions, one set per sport.
 *
 * These replace the illustrated StadiumScene on the sport heroes. The
 * illustration was drawn, and a drawing of a pitch is decoration; a captain
 * deciding whether to enter wants to see the actual court, the actual turf and
 * the actual room with the screens in it. Everything here was shot by AQ at
 * its own sessions, so there is nothing stock and nothing pretending.
 *
 * They are plain files under `public/terrathon/photos/`, not imports and not
 * Supabase-hosted, which has two consequences worth knowing:
 *
 *   1. They never enter the JS graph, so the section's bundle budget does not
 *      move. This is the same reason the banner's stickers live in public/.
 *   2. `sized()` from lib/imageUrl.ts does NOT apply. That helper rewrites a
 *      CDN resize parameter, and there is no CDN in front of these. The sizes
 *      below are therefore baked at build time instead: 1600x900 for a hero
 *      and 800x600 for a rail shot, cropped from 1080x1365 phone originals.
 *      The whole set is 852KB, down from 37MB of source PNG.
 *
 * Anything added here must be resized the same way before it lands in public/.
 * A 3MB phone original dropped straight in would be the single heaviest asset
 * in the section, which is the exact bug the repo has already had once.
 */
import type { SportSlug } from './types'

export interface SportPhotos {
  /** 1600x900. The page hero. Loaded eagerly, since it is above the fold. */
  hero: string
  /** 800x600 each. The proof rail. Lazy. */
  shots: string[]
  /** What the hero actually shows, for anyone who cannot see it. */
  heroAlt: string
  shotAlts: string[]
}

const BASE = '/terrathon/photos'

export const SPORT_PHOTOS: Record<SportSlug, SportPhotos> = {
  pickleball: {
    hero: `${BASE}/pickleball-hero.webp`,
    heroAlt: 'Two AquaTerra players at the net during a pickleball rally, paddles up and the ball in play.',
    shots: [`${BASE}/pickleball-1.webp`, `${BASE}/pickleball-2.webp`],
    shotAlts: [
      'A pickleball doubles point on an outdoor court.',
      'A player reaching for a forehand return mid-rally.',
    ],
  },
  cricket: {
    hero: `${BASE}/cricket-hero.webp`,
    heroAlt: 'A batter facing up on turf with the keeper behind the stumps and fielders set.',
    shots: [`${BASE}/cricket-1.webp`, `${BASE}/cricket-2.webp`],
    shotAlts: [
      'A batter taking guard in front of the stumps on the turf ground.',
      'A wider view of the turf ground mid over.',
    ],
  },
  fifa: {
    hero: `${BASE}/fifa-hero.webp`,
    heroAlt: 'Two players head to head on a screen during a FIFA match.',
    shots: [`${BASE}/fifa-1.webp`, `${BASE}/fifa-2.webp`],
    shotAlts: [
      'A player watching the pitch on screen during a one on one game.',
      'Hands on a controller mid match.',
    ],
  },
}
