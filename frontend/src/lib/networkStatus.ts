// changelog/11-system-states.md §11.5 — the connection signal behind the
// offline banner.
//
// "`navigator.onLine` plus a failed-request signal. `onLine` alone lies on
// captive portals." That is the whole reason this file exists rather than a
// one-line `useState(navigator.onLine)` in the banner: on a hotel/school wifi
// that has associated but not authenticated, `onLine` is `true` and every
// request still fails. So two independent inputs decide the state:
//
//   1. `navigator.onLine === false`   — definitive, believe it immediately.
//   2. repeated request failures      — suspicion, and only suspicion.
//
// Input 2 is deliberately conservative. ONE failed image on an otherwise fine
// connection is a dead URL, not an outage, and telling a member they are
// offline when they are not is worse than saying nothing. So it takes
// FAILURES_TO_SUSPECT failures inside FAILURE_WINDOW_MS, and any single
// success clears it instantly.
//
// This is NOT an offline queue. §11.5: "do not build an offline queue - a real
// queue is a service change." Nothing here retries, buffers or replays a
// write; it only answers "is the connection currently working."

const FAILURES_TO_SUSPECT = 2
const FAILURE_WINDOW_MS = 8000
/** How often to re-probe while suspected, so the banner clears by itself. */
const PROBE_INTERVAL_MS = 15000

export interface NetworkStatus {
  /** True when the browser says it is offline, or when repeated requests have
   *  failed (a captive portal, a dead uplink, a blocked host). */
  offline: boolean
  /** Which of the two inputs is responsible - useful for a copy split later;
   *  the banner currently says one sentence for both. */
  reason: 'none' | 'browser' | 'requests'
}

let failures: number[] = []
let suspected = false
let probeTimer: ReturnType<typeof setInterval> | null = null

const listeners = new Set<(s: NetworkStatus) => void>()

function browserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export function getNetworkStatus(): NetworkStatus {
  if (browserOffline()) return { offline: true, reason: 'browser' }
  if (suspected) return { offline: true, reason: 'requests' }
  return { offline: false, reason: 'none' }
}

function emit() {
  const s = getNetworkStatus()
  listeners.forEach(fn => fn(s))
}

// While suspected, ask the origin for a small static asset we know exists. A
// success means the connection came back and nobody has made a request since -
// without this the banner would sit there until the member happened to trigger
// another fetch. `cache: 'no-store'` so a cached 200 cannot answer for us.
function startProbing() {
  if (probeTimer || typeof window === 'undefined') return
  probeTimer = setInterval(async () => {
    if (browserOffline()) return
    try {
      const res = await fetch(`/logo.png?aq-probe=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) reportNetworkSuccess()
    } catch { /* still down - leave the banner up */ }
  }, PROBE_INTERVAL_MS)
}

function stopProbing() {
  if (probeTimer) { clearInterval(probeTimer); probeTimer = null }
}

/** Call from any failed request/asset load. Cheap and idempotent-safe. */
export function reportNetworkFailure() {
  const now = Date.now()
  failures = failures.filter(t => now - t < FAILURE_WINDOW_MS)
  failures.push(now)
  if (!suspected && failures.length >= FAILURES_TO_SUSPECT) {
    suspected = true
    startProbing()
    emit()
  }
}

/** Call from any request that came back. One success ends the suspicion. */
export function reportNetworkSuccess() {
  failures = []
  if (suspected) {
    suspected = false
    stopProbing()
    emit()
  }
}

export function subscribeNetworkStatus(fn: (s: NetworkStatus) => void): () => void {
  listeners.add(fn)
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('online', onBrowserOnline)
    window.addEventListener('offline', emit)
  }
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('online', onBrowserOnline)
      window.removeEventListener('offline', emit)
      stopProbing()
    }
  }
}

function onBrowserOnline() {
  // The browser regaining its uplink is not proof the portal let us through,
  // so this clears the definitive input but leaves any request-level suspicion
  // to the probe above to disprove.
  emit()
}

/** Test seam - resets the module's state between cases. */
export function __resetNetworkStatus() {
  failures = []
  suspected = false
  stopProbing()
}
