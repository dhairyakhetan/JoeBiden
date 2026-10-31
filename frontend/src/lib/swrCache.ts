// Stale-while-revalidate sessionStorage cache for read-heavy public lists.
// On a distant DB region every read is a ~150ms round-trip; caching the last
// result lets repeat navigation / back-button paint INSTANTLY while the page
// revalidates in the background. sessionStorage (not local) so it's per-tab and
// auto-clears when the tab closes - never serves stale data across sessions.
export function getCached<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function setCached<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(data))
  } catch {
    /* quota / private mode - caching is best-effort, never throws */
  }
}
