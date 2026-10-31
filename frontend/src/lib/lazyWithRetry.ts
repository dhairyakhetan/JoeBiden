import { lazy, ComponentType } from 'react'

/**
 * Drop-in replacement for React.lazy that survives a failed dynamic import.
 *
 * The #1 cause of "the page just sits on a spinner and never loads" in a
 * deployed SPA: a new build changes every code-split chunk's content-hashed
 * filename, so a tab that was open across a deploy requests an OLD chunk URL
 * that no longer exists → the import() rejects → <Suspense> hangs forever.
 * (A transient network blip on the chunk fetch does the same.)
 *
 * Strategy:
 *  1. Try the import.
 *  2. On failure, wait briefly and retry once (covers a one-off network hiccup).
 *  3. If it still fails, force a single full reload so the browser fetches the
 *     fresh chunk manifest. A sessionStorage timestamp guards against reload
 *     loops when the failure is genuine (e.g. truly offline) - at most one
 *     auto-reload per 10s, after which we surface the error to the ErrorBoundary.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      return await factory()
    } catch {
      await new Promise((r) => setTimeout(r, 350))
      try {
        return await factory()
      } catch (err2) {
        try {
          const KEY = 'aq_chunk_reload_ts'
          const last = Number(sessionStorage.getItem(KEY) || '0')
          const now = Date.now()
          if (now - last > 10000) {
            sessionStorage.setItem(KEY, String(now))
            window.location.reload()
            // The reload takes over; never resolve so no error flashes first.
            return new Promise<{ default: T }>(() => {})
          }
        } catch {
          /* sessionStorage unavailable - fall through to surface the error */
        }
        throw err2
      }
    }
  })
}
