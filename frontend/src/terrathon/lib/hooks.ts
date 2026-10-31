import { useEffect, useState, useCallback, useRef } from 'react'
import { serverNow, listPublicEvents } from './api'
import { resolveCountdown, splitDuration, type CountdownTarget, type Parts } from './countdown'
import type { PublicEvent } from './types'

/**
 * Offset between this device's clock and the database's, fetched once.
 *
 * A surprising number of the phones this lands on have a wrong system clock,
 * and a countdown that says "closed" on a page that is still open loses a
 * registration. Falls back to zero offset if the call fails: a slightly wrong
 * countdown beats a blank one.
 */
export function useServerOffset(): number {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    let alive = true
    const t0 = Date.now()
    serverNow()
      .then((srv) => {
        if (!alive) return
        const rtt = Date.now() - t0
        setOffset(srv.getTime() + rtt / 2 - Date.now())
      })
      .catch(() => { /* keep 0 */ })
    return () => { alive = false }
  }, [])
  return offset
}

/** Ticks once a second while the tab is visible; recomputes immediately on return. */
export function useCountdown(events: PublicEvent[], offset: number): {
  target: CountdownTarget
  parts: Parts
} {
  const [now, setNow] = useState(() => new Date(Date.now() + offset))

  useEffect(() => {
    let timer = 0
    const tick = () => {
      setNow(new Date(Date.now() + offset))
      timer = window.setTimeout(tick, 1000)
    }
    tick()

    // Stop the clock entirely while the tab is hidden, and resync on return.
    // Nobody is reading a countdown they cannot see, and a phone left on this
    // page in a background tab was still waking once a second to re-render.
    const onVis = () => {
      clearTimeout(timer)
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [offset])

  const target = resolveCountdown(events, now)
  const parts = splitDuration(target.target ? target.target.getTime() - now.getTime() : 0)
  return { target, parts }
}

export interface EventsState {
  events: PublicEvent[]
  loading: boolean
  /**
   * Set when the fetch itself failed, as distinct from "there are genuinely no
   * sports". The UI MUST branch on this: showing a cheerful empty state after a
   * failure is this codebase's single most repeated real bug.
   */
  error: string | null
  reload: () => void
}

export function usePublicEvents(): EventsState {
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Guards against a stale response clobbering a fresher one, the same way
  // useServerOffset guards its own `alive` flag above. `reload` is wired to
  // "Try again" buttons across the section, and a captain on bad wifi tends
  // to tap it more than once: without a request id, a slow first call can
  // still resolve (or reject) AFTER a fast second call already rendered good
  // data, throwing the page back to an error over data that is fine.
  const requestId = useRef(0)

  const load = useCallback(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    listPublicEvents()
      .then((rows) => { if (requestId.current === id) setEvents(rows) })
      .catch((e) => { if (requestId.current === id) setError(e?.message || 'Could not load the sports.') })
      .finally(() => { if (requestId.current === id) setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])
  return { events, loading, error, reload: load }
}

/**
 * Form state that survives the tab being killed.
 *
 * Captains routinely leave mid-form to fetch teammate names from WhatsApp, and
 * in-app browsers discard the tab when they do. Without this, they come back to
 * an empty form and most of them do not fill it again.
 */
export function useDraft<T extends object>(key: string, initial: T): [T, (patch: Partial<T>) => void, () => void] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw ? { ...initial, ...JSON.parse(raw) } : initial
    } catch {
      return initial
    }
  })
  const patch = useCallback((p: Partial<T>) => {
    setState((prev) => {
      const next = { ...prev, ...p }
      try { sessionStorage.setItem(key, JSON.stringify(next)) } catch { /* private mode */ }
      return next
    })
  }, [key])

  const clear = useCallback(() => {
    try { sessionStorage.removeItem(key) } catch { /* private mode */ }
  }, [key])

  return [state, patch, clear]
}

/** Pauses the floating-silhouette layer when the tab is hidden. */
export function useTabHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  useEffect(() => {
    const on = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return hidden
}
