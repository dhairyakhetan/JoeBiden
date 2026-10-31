/**
 * When Paradox actually happens — one source of truth.
 *
 * The sub-app's footer already knew the event had finished ("JUN 1–6, 2026 ·
 * WRAPPED", "thank you, kolkata") while its own pages went on promising things
 * in the future tense: the winners page said winners "will be announced after each
 * event" and /scores said scores were "updated live" and would "appear here
 * during the event" — two months after the last day. A visitor reading a page
 * that contradicts its own footer stops believing either half.
 *
 * The dates were retyped as display strings in a dozen places, so nothing
 * could tell whether the event was over. Derive it instead.
 */

/** Last day of Paradox 2026, end of day IST (UTC+05:30). */
export const EVENT_END = new Date('2026-06-06T18:30:00Z')

/** First day, for the "not started yet" half of the year. */
export const EVENT_START = new Date('2026-06-01T00:00:00+05:30')

/** Human display string. Keep every surface reading from this one. */
export const EVENT_DATES = 'Jun 1–6, 2026'

/** Evaluated per render rather than at module load, so a long-lived tab
 *  (the control room is left open for days) can't get stuck on a stale answer. */
export const eventIsOver = () => Date.now() > EVENT_END.getTime()

/** True once the event has finished. */
export const EVENT_IS_OVER = eventIsOver()
