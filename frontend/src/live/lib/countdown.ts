import { splitDuration, type Parts } from '../../terrathon/lib/countdown'

export type { Parts }

/** IST is UTC+5:30 with no daylight saving, so a fixed offset is right all year. */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** Midnight at the start of `isoDate` (YYYY-MM-DD) in India. */
export function istStartOfDay(isoDate: string): Date {
  return new Date(new Date(`${isoDate}T00:00:00.000Z`).getTime() - IST_OFFSET_MS)
}

export interface Countdown { parts: Parts; done: boolean }

/** Time left to the start of `isoDate` in IST. `done` once it has begun. */
export function countdownTo(isoDate: string, now: Date): Countdown {
  const ms = istStartOfDay(isoDate).getTime() - now.getTime()
  return { parts: splitDuration(ms), done: ms <= 0 }
}

/** Whole days left, rounded up, so "1 day to go" shows until the day begins. */
export function daysToGo(isoDate: string, now: Date): number {
  const ms = istStartOfDay(isoDate).getTime() - now.getTime()
  return ms <= 0 ? 0 : Math.ceil(ms / 86_400_000)
}

export const pad2 = (n: number): string => String(n).padStart(2, '0')
