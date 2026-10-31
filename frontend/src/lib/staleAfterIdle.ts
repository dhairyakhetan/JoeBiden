import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * changelog/11-system-states.md §11.1 state 8 — "stale: a refresh affordance
 * after long idle", and §11's Unresolved item 4 ("is there any long-lived
 * surface where this matters, or is it theoretical?").
 *
 * It is not theoretical. The feed is a tab a member leaves open on a phone all
 * day: they come back after four hours to a list rendered from data fetched
 * before lunch, and every control on it - like, save, open, apply - acts on
 * that stale list.
 *
 * THE JUDGEMENT CALL, stated once here so nobody has to re-derive it:
 * **this prompts, it does not auto-refetch.** A silent refetch on return is
 * nicer in the happy case and wrong in every other one: it moves the page under
 * someone who came back to finish reading a specific post, it re-orders a feed
 * whose ranking is server-side, and it spends a request on every tab-focus for
 * students on mobile data. So the mechanism only ever raises a flag; the member
 * decides. The one thing it does automatically is stay quiet (see `enabled`).
 *
 * Explicitly NOT polling. There is no interval anywhere in this file. The only
 * inputs are `visibilitychange` and the wall clock read at the moment of
 * return, which is what §11.1 asks for and costs nothing while hidden.
 */

/** Half an hour of hidden tab before anything on screen counts as old. */
export const DEFAULT_STALE_MS = 30 * 60 * 1000

export interface StaleInput {
  /** When the tab went hidden, or null if it never did this session. */
  hiddenAt: number | null
  /** When the surface's data was last loaded. */
  loadedAt: number
  /** Now, at the moment of return. */
  now: number
  thresholdMs: number
}

/**
 * The whole decision, as a pure function so it is testable without a DOM or a
 * fake clock.
 *
 * Two independent inputs, and BOTH have to be old:
 *  - the tab was away for at least the threshold (a two-second alt-tab is not
 *    staleness), and
 *  - the data on screen is itself at least that old (returning to a surface
 *    that refetched two minutes before you hid the tab has nothing to say).
 *
 * The second condition is what stops the prompt firing on a surface that
 * happens to have re-fetched for its own reasons while hidden.
 */
export function shouldMarkStale({ hiddenAt, loadedAt, now, thresholdMs }: StaleInput): boolean {
  if (hiddenAt === null) return false
  const away = now - hiddenAt
  const age = now - loadedAt
  return away >= thresholdMs && age >= thresholdMs
}

export interface UseStaleAfterIdleOptions {
  /** Wall-clock idle before the prompt is offered. */
  thresholdMs?: number
  /**
   * Set false to suppress the prompt entirely for as long as it is false: a
   * dirty form, an open modal, an in-flight submit. §11's rule is that nothing
   * may pull content out from under a member mid-task, and the prompt itself is
   * content. A surface that goes un-enabled while stale simply stays quiet
   * until it is enabled again - the flag is not lost, it is not shown.
   */
  enabled?: boolean
}

export interface StaleAfterIdle {
  /** True when the surface should offer a refresh. */
  stale: boolean
  /** Call after a successful (re)load - resets the clock and clears the flag. */
  markFresh: () => void
  /** Member said "not now". Clears the flag without refetching. */
  dismiss: () => void
}

export function useStaleAfterIdle(options: UseStaleAfterIdleOptions = {}): StaleAfterIdle {
  const { thresholdMs = DEFAULT_STALE_MS, enabled = true } = options
  const [flagged, setFlagged] = useState(false)
  const loadedAt = useRef(Date.now())
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt.current = Date.now()
        return
      }
      const decided = shouldMarkStale({
        hiddenAt: hiddenAt.current,
        loadedAt: loadedAt.current,
        now: Date.now(),
        thresholdMs,
      })
      hiddenAt.current = null
      if (decided) setFlagged(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [thresholdMs])

  const markFresh = useCallback(() => {
    loadedAt.current = Date.now()
    hiddenAt.current = null
    setFlagged(false)
  }, [])

  const dismiss = useCallback(() => {
    // Reset the load clock too, otherwise the very next tab-return re-raises
    // the same prompt the member just dismissed.
    loadedAt.current = Date.now()
    setFlagged(false)
  }, [])

  return { stale: flagged && enabled, markFresh, dismiss }
}
