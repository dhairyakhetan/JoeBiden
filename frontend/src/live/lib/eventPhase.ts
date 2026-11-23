import { countdownTo, istStartOfDay } from './countdown'
import type { EventStatus, LiveEvent } from '../data/content'

/**
 * Where a one-day night stands, on the IST day boundary the countdown already uses:
 * - `upcoming` until midnight IST at the start of the day (the countdown runs),
 * - `today` for that whole day (the countdown's `done`, "It is on"; tickets still make sense at the door),
 * - `past` from midnight IST at the start of the next day.
 * So nothing needs editing the morning after: the pages swap the countdown and the ticket buttons for the past-tense block.
 */
export type EventPhase = 'upcoming' | 'today' | 'past'

const DAY_MS = 86_400_000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

export function eventPhase(isoDate: string, now: Date): EventPhase {
  if (!countdownTo(isoDate, now).done) return 'upcoming'
  return now.getTime() >= istStartOfDay(isoDate).getTime() + DAY_MS ? 'past' : 'today'
}

/**
 * The status a visitor should see. A row marked `upcoming` whose full ISO date has passed reads as `past`, so a forgotten status
 * flip never leaves a finished night under "Up next". Only a full YYYY-MM-DD can expire this way; a bare year or month cannot.
 * Never the other way: a `past` row stays past.
 */
export function effectiveStatus(ev: Pick<LiveEvent, 'status' | 'when'>, now: Date): EventStatus {
  if (ev.status === 'upcoming' && ISO_DAY.test(ev.when) && eventPhase(ev.when, now) === 'past') return 'past'
  return ev.status
}

/**
 * The same list with every status settled for `now`. Returns the same objects when nothing changed. A night that only reads as past
 * because its row was never flipped also loses its highlights: those were written as "good to know before you go" (bring a mask, how
 * to book) and would be wrong advice after the date. Flipping the row to `past` and rewriting them in the editor brings them back.
 */
export function settleStatuses(list: LiveEvent[], now: Date): LiveEvent[] {
  return list.map(ev => {
    const status = effectiveStatus(ev, now)
    return status === ev.status ? ev : { ...ev, status, highlights: undefined }
  })
}

/** Where the next night is announced. The main AquaTerra account, not the hub's own. */
export const ANNOUNCE_HANDLE = '@ngo.aquaterra'
export const ANNOUNCE_HREF = 'https://instagram.com/ngo.aquaterra'

/** The past-tense copy that replaces the countdown and the ticket buttons. No attendance, no money raised, no next date. */
export function pastLines(ev: { name: string; dateLabel: string }): { said: string; next: string } {
  return {
    said: `${ev.name} took place on ${ev.dateLabel} in Kolkata. Thank you to everyone who came; every ticket funded AquaTerra's welfare drives.`,
    next: `The next night will be announced on Instagram, ${ANNOUNCE_HANDLE}.`,
  }
}
