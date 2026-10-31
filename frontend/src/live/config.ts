/**
 * AquaTerra.live: the events hub. Plan and owner decisions: docs/plans/aquaterra-live.md.
 *
 * Things a human edits without touching a component live here for now; once the content tables land (slice 2)
 * the banner, the dates and the copy come from the database and this file keeps only what the database has no
 * business holding.
 */
import { CONTACTS } from '../terrathon/config'

export const LIVE = {
  base: '/live',
  wordmark: 'AQUATERRA.LIVE',
  instagram: 'https://instagram.com/aquaterra.live',
  mainSite: '/',
  /** Kolkata, for the loader. */
  coordinates: '22.57° N · 88.36° E',
} as const

/** The one event the hub is promoting. Becomes a `live_events` row in slice 2. */
export const NEXT_EVENT = {
  name: 'Disco Diwali',
  edition: 'The Masquerade Sangeet Edition',
  /** The owner's date. The kickoff hour is not decided, so the countdown runs to the start of the day in IST. */
  date: '2026-11-10',
  dateLabel: '10 November 2026',
  /** The short forms the hero strip and the three-up facts use. */
  dateShort: '10 Nov 2026',
  venueShort: '60 Chowringhee',
  venue: '60, Chowringhee Banquets',
} as const

/** The label on every button that opens the WhatsApp booking chat. Say what it does; "Claim your mask" stays flavour for headlines. */
export const BOOK_LABEL = 'Book on WhatsApp'

/**
 * The Disco Diwali microsite. `time` and `venueName` stay empty until the team confirms them in public: the page shows a
 * dashed "to be announced" marker for an empty one and never guesses. Fill them here and the page follows.
 */
export const DISCO = {
  base: `${LIVE.base}/disco-diwali`,
  time: '4:30 PM onwards' as string | undefined,
  venueName: '60, Chowringhee Banquets' as string | undefined,
  /** The nights so far, from the design brain's fact bank (docs: aqdesignengine brain/DISCO_DIWALI.md section 1). */
  editions: [
    { year: '2024', name: 'Edition 1.0', now: false },
    { year: '2025', name: 'Edition 2.0', now: false },
    { year: '2026', name: 'Masquerade Sangeet', now: true },
  ],
} as const

/** The person who answers every public question. Derived from TerraThon's config so a changed number is changed once. */
export const ASK = CONTACTS[0]

/** Chapter kickers on the home page, in order. */
export const CHAPTERS = {
  who: '01 / Who are we?',
  cause: '02 / The cause',
  ask: '03 / Got questions?',
} as const
