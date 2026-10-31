import { useEffect, useState } from 'react'
import { EVENTS, PROGRAMMES, type LiveEvent, type LiveProgramme } from '../data/content'
import { fetchPublishedEvents, fetchPublishedProgrammes } from './contentApi'
import { rowToEvent, rowToProgramme } from './content'

interface Snapshot { events: LiveEvent[]; programmes: LiveProgramme[]; source: 'static' | 'db'; ready: boolean }

const STATIC: Snapshot = { events: EVENTS, programmes: PROGRAMMES, source: 'static', ready: false }
let cache: { at: number; snap: Snapshot } | null = null
let inflight: Promise<Snapshot> | null = null
const TTL = 5 * 60_000

/**
 * What the public pages show. It starts from the typed content (instant first paint, no flash) and swaps to the editable tables as
 * soon as they answer. If the tables are empty, unreachable or the migration has not run, the typed content stays: a database hiccup
 * never blanks a page. `ready` goes true once the fetch has settled, so a page for a night an admin just added can wait for it
 * instead of flashing "not found".
 */
async function load(): Promise<Snapshot> {
  try {
    const [ev, pr] = await Promise.all([fetchPublishedEvents(), fetchPublishedProgrammes()])
    return {
      events: ev.length > 0 ? ev.map(rowToEvent) : EVENTS,
      programmes: pr.length > 0 ? pr.map(rowToProgramme) : PROGRAMMES,
      source: ev.length > 0 || pr.length > 0 ? 'db' : 'static',
      ready: true,
    }
  } catch {
    return { ...STATIC, ready: true }
  }
}

export function useLiveContent(): Snapshot {
  const [snap, setSnap] = useState<Snapshot>(() => (cache && Date.now() - cache.at < TTL ? cache.snap : STATIC))
  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL) return
    let alive = true
    inflight ??= load().finally(() => { inflight = null })
    void inflight.then(s => { cache = { at: Date.now(), snap: s }; if (alive) setSnap(s) })
    return () => { alive = false }
  }, [])
  return snap
}

/** For the admin: a save should show on the public site immediately, not after the cache expires. */
export const forgetContentCache = (): void => { cache = null }
