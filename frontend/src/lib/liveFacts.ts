import { useEffect, useSyncExternalStore } from 'react'
import { supabaseCommunity } from './supabaseCommunity'
import { ORG_FACTS } from './orgFacts'

/**
 * The headline figures that move on their own: active members and drives written up (owner, 3 Nov 2026:
 * "numbers should auto update").
 *
 * The build already refreshes ORG_FACTS from the database on every deploy (scripts/compute-org-facts.mjs). This adds the
 * second half: a page that is open shows the CURRENT count, with no redeploy. Two exact counts over tables the public site
 * already reads (the public key may count `members` through one readable column only, never `select *`).
 *
 * Safety, in the same spirit as the build: the build-time figure shows first and stays if a read fails; a count that comes
 * back implausibly low (a policy change hiding rows) is ignored rather than shown as an undercount; the result is cached
 * for an hour in sessionStorage so navigating between pages costs nothing.
 */
export interface LiveFacts { membersTotal: number; drivesWrittenUp: number }

const CACHE_SLOT = 'aq_live_facts_v1'
const TTL_MS = 60 * 60 * 1000

let facts: LiveFacts = { membersTotal: ORG_FACTS.membersTotal, drivesWrittenUp: ORG_FACTS.drivesWrittenUp }
let started = false
const listeners = new Set<() => void>()

function publish(next: LiveFacts) {
  if (next.membersTotal === facts.membersTotal && next.drivesWrittenUp === facts.drivesWrittenUp) return
  facts = next
  listeners.forEach(l => l())
}

/** A live count is only believed when it is at least 80% of the figure the build shipped. */
export function plausible(live: number | null | undefined, built: number): live is number {
  return typeof live === 'number' && Number.isFinite(live) && live >= built * 0.8
}

async function load() {
  try {
    const raw = sessionStorage.getItem(CACHE_SLOT)
    if (raw) {
      const c = JSON.parse(raw) as { at: number; membersTotal: number; drivesWrittenUp: number }
      if (Date.now() - c.at < TTL_MS && plausible(c.membersTotal, ORG_FACTS.membersTotal) && plausible(c.drivesWrittenUp, ORG_FACTS.drivesWrittenUp)) {
        publish({ membersTotal: c.membersTotal, drivesWrittenUp: c.drivesWrittenUp })
        return
      }
    }
  } catch { /* storage blocked or malformed: fetch */ }
  try {
    const [m, d] = await Promise.all([
      supabaseCommunity.from('members').select('member_id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseCommunity.from('welfare_projects').select('id', { count: 'exact', head: true }).eq('is_draft', false),
    ])
    const next: LiveFacts = {
      membersTotal: !m.error && plausible(m.count, ORG_FACTS.membersTotal) ? m.count : facts.membersTotal,
      drivesWrittenUp: !d.error && plausible(d.count, ORG_FACTS.drivesWrittenUp) ? d.count : facts.drivesWrittenUp,
    }
    publish(next)
    try { sessionStorage.setItem(CACHE_SLOT, JSON.stringify({ at: Date.now(), ...next })) } catch { /* convenience only */ }
  } catch { /* the build-time figure stays */ }
}

function start() {
  if (started || typeof window === 'undefined') return
  started = true
  void load()
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }
const snapshot = () => facts

/** The live figures; the build-time ones until the counts land (and if they never do). */
export function useLiveFacts(): LiveFacts {
  useEffect(() => { start() }, [])
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
