import type { ComponentType } from 'react'

/**
 * The mini games. One entry per game; the hub (/games), each game's page (/games/:slug) and the "mini games" column of
 * the full menu all read this list, so adding a game is one entry here plus its component file.
 *
 *   {
 *     slug: 'river-run',                       // the URL: /games/river-run
 *     title: 'River Run',
 *     blurb: 'One line for the hub card and the menu.',
 *     hue: 'var(--sky)',                       // the card and menu-pill accent (an existing --token)
 *     load: () => import('./river-run/RiverRun'),   // a string-literal import(), so Rollup cuts its own chunk
 *   }
 *
 * The component takes no props. It draws inside the page's container, sized to its parent, and owns its own keyboard and
 * touch handling. Games must honour prefers-reduced-motion and never write to the database without the mutation
 * conventions in CLAUDE.md (toast on success and failure, pending state).
 */
export interface MiniGame {
  slug: string
  title: string
  blurb: string
  hue: string
  load: () => Promise<{ default: ComponentType }>
}

export const GAMES: MiniGame[] = [
  {
    slug: 'drive-sorter',
    title: 'Drive Sorter',
    blurb: 'Twelve things, three bins: dry, wet and e-waste. Build a streak.',
    hue: 'var(--welfare)',
    load: () => import('./sorter/DriveSorter'),
  },
  {
    slug: 'streak-tap',
    title: 'Streak Tap',
    blurb: 'Tap the moment the pad turns green. Five rounds, your average.',
    hue: 'var(--sky)',
    load: () => import('./reaction/StreakTap'),
  },
  {
    slug: 'sticker-match',
    title: 'Sticker Match',
    blurb: 'Sixteen stickers, eight pairs. Find them in as few moves as you can.',
    hue: 'var(--grape)',
    load: () => import('./match/StickerMatch'),
  },
]

export const gameBySlug = (slug: string | undefined) => GAMES.find(g => g.slug === slug)
