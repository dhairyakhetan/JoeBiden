/**
 * A snapshot of what the home screen last showed, kept across closing and reopening the app.
 *
 * Why this exists next to `swrCache.ts`: that cache is sessionStorage on purpose (per tab, gone when the tab closes), which is exactly
 * wrong for the moment it matters most. Opening the app fresh, on a phone, on a poor connection, is the cold start: the feed has to
 * be fetched over the network and the member stares at a skeleton. A snapshot written the last time they used the app can paint
 * instantly while the real fetch runs behind it, and the real answer replaces it the moment it lands.
 *
 * What makes it safe to keep on a device:
 *  - Opt in, per call site. `swrCache` is shared with screens that hold respondent data; nothing there can reach this file by accident.
 *  - Keyed by scope, the member's uuid or `anon`, so one account can never be shown another's snapshot on a shared browser.
 *  - Short-lived. Past `maxAgeMs` it is ignored (and removed), so a post taken down or edited cannot linger for days.
 *  - Never trusted as an answer. Callers always revalidate; a snapshot only fills the wait.
 *  - Wiped on sign-out (`clearSnapshots`), and its member-scoped half wiped on a boot with no session at all.
 *  - Bounded. An entry over `MAX_BYTES` is not written, and only the newest `MAX_ENTRIES` are kept.
 *  - Best-effort. Private mode, quota and corrupt JSON all degrade to "no snapshot", never an error.
 *
 * Bump the `schema` string in a caller's key whenever the shape it stores changes, so an old snapshot is never read as the new shape.
 */

const PREFIX = 'aq_snap_v1:'
/** Long enough to cover "closed it this morning, opened it tonight"; short enough that a removed post does not outlive the day. */
export const SNAPSHOT_MAX_AGE_MS = 6 * 60 * 60 * 1000
export const MAX_BYTES = 400_000
export const MAX_ENTRIES = 12

interface Stored<T> { v: 1; savedAt: number; value: T }

const fullKey = (scope: string, name: string) => `${PREFIX}${scope}|${name}`

/** Every snapshot key currently in storage. */
function snapshotKeys(): string[] {
  const out: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && k.startsWith(PREFIX)) out.push(k)
  }
  return out
}

export function readSnapshot<T>(scope: string, name: string, maxAgeMs: number = SNAPSHOT_MAX_AGE_MS, now: number = Date.now()): T | null {
  try {
    const key = fullKey(scope, name)
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const s = JSON.parse(raw) as Stored<T> | null
    const ok = !!s && s.v === 1 && typeof s.savedAt === 'number' && s.value !== undefined && s.value !== null
    // A future timestamp means a clock that moved; treat it as untrustworthy rather than immortal.
    if (!ok || s!.savedAt > now + 60_000 || now - s!.savedAt > maxAgeMs) {
      localStorage.removeItem(key)
      return null
    }
    return s!.value
  } catch {
    return null
  }
}

export function writeSnapshot<T>(scope: string, name: string, value: T, now: number = Date.now()): void {
  try {
    const json = JSON.stringify({ v: 1, savedAt: now, value } satisfies Stored<T>)
    if (json.length > MAX_BYTES) return
    localStorage.setItem(fullKey(scope, name), json)
    prune()
  } catch {
    /* private mode / quota: a snapshot is a nicety, never a failure */
  }
}

/** Keep the newest MAX_ENTRIES; the category filter alone can mint several keys per member. */
function prune(): void {
  try {
    const keys = snapshotKeys()
    if (keys.length <= MAX_ENTRIES) return
    const aged = keys.map(k => {
      let at = 0
      try { at = (JSON.parse(localStorage.getItem(k) || '{}') as { savedAt?: number }).savedAt ?? 0 } catch { /* unreadable: oldest */ }
      return { k, at }
    }).sort((a, b) => a.at - b.at)
    for (const { k } of aged.slice(0, keys.length - MAX_ENTRIES)) localStorage.removeItem(k)
  } catch { /* best effort */ }
}

/**
 * Remove snapshots. With no argument, every one (sign-out). With `keepScope`, everything EXCEPT that scope: a boot with no session
 * keeps the public `anon` snapshot and drops any member's.
 */
export function clearSnapshots(keepScope?: string): void {
  try {
    for (const k of snapshotKeys()) {
      if (keepScope !== undefined && k.startsWith(`${PREFIX}${keepScope}|`)) continue
      localStorage.removeItem(k)
    }
  } catch { /* best effort */ }
}
