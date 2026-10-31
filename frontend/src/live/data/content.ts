/**
 * Everything the hub says about events, in one typed place. The plan moves this to the `live_*` tables (slice 2 of
 * docs/plans/aquaterra-live.md); until then a human edits it here. Nothing in this file may be a number or a name without a
 * source: an unknown is left out, and the page shows a designed empty state for the section instead.
 */
import { DISCO, NEXT_EVENT } from '../config'

export type EventStatus = 'upcoming' | 'past'

export interface LiveEvent {
  slug: string
  name: string
  edition?: string
  status: EventStatus
  /** Sort key and year, ISO date where known, otherwise just the year. */
  when: string
  dateLabel: string
  blurb: string
  venue?: string
  time?: string
  /** An on-site page that tells the rest of the story. */
  href?: string
  /** Photo ids (see photos.ts) that belong to this night. */
  photos?: string[]
  /** Lines that are true and sourced. Hidden when empty. */
  highlights?: string[]
  /** Sponsors, stalls and performers stay empty until the owner supplies them with permission. */
  sponsors?: string[]
  stalls?: string[]
  performers?: string[]
}

export const EVENTS: LiveEvent[] = [
  {
    slug: 'disco-diwali-2026',
    name: 'Disco Diwali',
    edition: 'The Masquerade Sangeet Edition',
    status: 'upcoming',
    when: NEXT_EVENT.date,
    dateLabel: NEXT_EVENT.dateLabel,
    venue: DISCO.venueName,
    time: DISCO.time,
    blurb: 'A masquerade sangeet night under the Diwali sky, with a mirror ball hung over it. Every ticket is for charity.',
    href: DISCO.base,
    photos: ['booth', 'drapes', 'friends', 'greenfloor'],
    highlights: ['Bring a mask. It is a masquerade.', 'Tickets on WhatsApp, paid by UPI, confirmed with a DD26 booking ID.'],
  },
  {
    slug: 'terrathon-2026',
    name: 'TerraThon',
    edition: 'Cricket, pickleball and FIFA',
    status: 'past',
    when: '2026-10-02',
    dateLabel: '2 to 4 October 2026',
    blurb: 'AquaTerra\'s student sports festival in Kolkata: cricket, pickleball and a solo FIFA league.',
    href: '/terrathon',
  },
  {
    slug: 'disco-diwali-2025',
    name: 'Disco Diwali',
    edition: 'Edition 2.0',
    status: 'past',
    when: '2025-10',
    dateLabel: 'October 2025',
    blurb: 'The second Disco Diwali, with a photo booth, masks and a silver-tinsel dance floor.',
    photos: ['booth'],
  },
  {
    slug: 'summer-aq-turns-five',
    name: 'The Summer AQ Turns Five',
    status: 'past',
    when: '2026-06',
    dateLabel: 'Summer 2026',
    blurb: 'AquaTerra\'s fifth anniversary party, with an ocean and mermaid theme. The club was founded on 11 June 2021.',
    photos: ['summer-banner', 'summer-dance', 'summer-lanterns', 'summer-stars'],
  },
  {
    slug: 'disco-diwali-2024',
    name: 'Disco Diwali',
    edition: 'Edition 1.0',
    status: 'past',
    when: '2024-10',
    dateLabel: 'October 2024',
    blurb: 'Where it started: the first Disco Diwali.',
  },
]

/** The helpers take a list so the same code serves the typed fallback and the rows an admin edits. */
export const findEvent = (list: LiveEvent[], slug: string | undefined): LiveEvent | undefined => list.find(e => e.slug === slug)
export const upcomingOf = (list: LiveEvent[]): LiveEvent[] => list.filter(e => e.status === 'upcoming')
export const pastOf = (list: LiveEvent[]): LiveEvent[] => list.filter(e => e.status === 'past').sort((a, b) => b.when.localeCompare(a.when))

export const eventBySlug = (slug: string | undefined): LiveEvent | undefined => findEvent(EVENTS, slug)
export const upcoming = (): LiveEvent[] => upcomingOf(EVENTS)
export const past = (): LiveEvent[] => pastOf(EVENTS)

/** What the money pays for. Programme NAMES only: the owner's rule is no rupee figures on this site. */
export interface LiveProgramme { name: string; line: string; photo?: string; photoAlt?: string }
export const PROGRAMMES: LiveProgramme[] = [
  { name: 'Pather Sathi', line: 'A Sunday school for children, taught by AquaTerra students.' },
  { name: 'Food distribution', line: 'Meals and drives run by the welfare team.', photo: 'food', photoAlt: 'An AquaTerra volunteer in an AquaTerra cap, smiling, on a food distribution drive.' },
  { name: 'Education in the Sundarbans', line: 'Learning support for children in the Sundarbans.', photo: 'edu', photoAlt: 'Children laughing together over craft work in a learning session in the Sundarbans.' },
  { name: 'Welfare workshops', line: 'Workshops AquaTerra runs with and for communities in Kolkata.' },
]
