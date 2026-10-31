/**
 * Countdown maths. Pure, so it can be unit-tested without a clock or a DOM.
 * The React wiring lives in hooks.ts.
 */
import type { PublicEvent } from './types'

export type CountdownMode = 'kickoff' | 'live' | 'over'

export interface CountdownTarget {
  mode: CountdownMode
  label: string
  /** null in 'live' and 'over', where there is nothing to count down to. */
  target: Date | null
}

export interface Parts { days: number; hours: number; minutes: number; seconds: number }

export function splitDuration(ms: number): Parts {
  const t = Math.max(0, Math.floor(ms / 1000))
  return {
    days: Math.floor(t / 86400),
    hours: Math.floor((t % 86400) / 3600),
    minutes: Math.floor((t % 3600) / 60),
    seconds: t % 60,
  }
}

/** IST is UTC+5:30 with no DST, so a fixed offset is correct all year. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function istDayStart(isoDate: string): Date {
  // A `date` column comes back as YYYY-MM-DD with no zone. Midnight IST.
  return new Date(new Date(`${isoDate}T00:00:00.000Z`).getTime() - IST_OFFSET_MS)
}
function istDayEnd(isoDate: string): Date {
  return new Date(istDayStart(isoDate).getTime() + 24 * 60 * 60 * 1000)
}

/**
 * The hour the weekend actually starts, in IST.
 *
 * There is no kickoff column on terrathon_events, and the earliest report time
 * across the three sports is 9:45. Gates open before that, so the countdown
 * runs to 9am on the first event day. The DAY still comes from the data, so a
 * date change at the desk moves this without a deploy; only the hour is a
 * literal, and it lives here rather than being repeated at a call site.
 */
const KICKOFF_HOUR_IST = 9

function istKickoff(isoDate: string): Date {
  return new Date(istDayStart(isoDate).getTime() + KICKOFF_HOUR_IST * 60 * 60 * 1000)
}

/**
 * Picks which of the PRD's four countdown modes applies, from the event rows
 * alone, so the board switches itself with no deploy and no admin action.
 *
 *   A kickoff  before 9am IST on the first event day
 *   B live     during the event days
 *   C over     after the last day ends
 *
 * There used to be a fourth, `closing`, which counted to the last sign-up
 * deadline and took priority over kickoff. It was removed on 2026-09-21: one
 * board can only answer one question, and the question worth a flip clock on
 * the front page is when the weekend starts. The close times are still on the
 * sport pages and the schedule, where somebody deciding whether to enter is
 * already reading.
 */
export function resolveCountdown(events: PublicEvent[], now: Date): CountdownTarget {

  const days = events
    .filter((e) => e.day_first && e.status !== 'cancelled')
    .map((e) => ({ start: istDayStart(e.day_first as string), end: istDayEnd((e.day_last || e.day_first) as string), e }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  if (!days.length) return { mode: 'over', label: "That's a wrap. See you next year.", target: null }

  const first = days[0]
  const lastEnd = days.reduce((acc, d) => (d.end > acc ? d.end : acc), days[0].end)

  const kickoff = istKickoff(first.e.day_first as string)
  if (now < kickoff) {
    return { mode: 'kickoff', label: 'TerraThon kicks off in', target: kickoff }
  }
  if (now <= lastEnd) {
    const today = days.filter((d) => now >= d.start && now <= d.end).map((d) => d.e.display_name)
    return {
      mode: 'live',
      label: today.length ? `Live now: ${today.join(' and ')}` : 'Live now',
      target: null,
    }
  }
  return { mode: 'over', label: "That's a wrap. See you next year.", target: null }
}

/** Screen-reader sentence, refreshed once a minute rather than every tick. */
export function spokenRemaining(p: Parts, label: string): string {
  if (p.days > 0) return `${label} ${p.days} days and ${p.hours} hours`
  if (p.hours > 0) return `${label} ${p.hours} hours and ${p.minutes} minutes`
  return `${label} ${p.minutes} minutes`
}
