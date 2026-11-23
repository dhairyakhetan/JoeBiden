/**
 * The only door to Microsoft Clarity from AQ's own code. Everything else calls these two helpers
 * instead of touching `window.clarity`.
 *
 * Clarity is on the page ONLY for visitors who are not signed in: index.html skips the tag when a Supabase
 * session is stored, and AuthContext calls clarity('stop') on a mid-session sign-in. Many members are
 * minors, which is why. So both helpers are plain no-ops whenever the tag is not there, and a signed-in
 * visitor's events simply go nowhere. That is intended; do not work around it.
 *
 * NO PERSONAL DATA, ever: no names, emails, phone numbers, member ids or auth ids, in an event name, a
 * prop or a tag. Low-cardinality context only (which method, which area, which edition).
 *
 * Neither helper ever throws: counting must never break the page.
 */

type Prop = string | number | boolean | null | undefined

function clarityFn(): ((...args: unknown[]) => void) | null {
  const c = typeof window === 'undefined' ? undefined : (window as unknown as { clarity?: unknown }).clarity
  return typeof c === 'function' ? (c as (...args: unknown[]) => void) : null
}

/** One named event. Each prop that is not null/undefined also goes out as a session tag (`key` = String(value)),
 *  so recordings can be filtered by it. */
export function clarityEvent(name: string, props?: Record<string, Prop>): void {
  try {
    const clarity = clarityFn()
    if (!clarity) return
    clarity('event', name)
    if (props) {
      for (const [key, value] of Object.entries(props)) {
        if (value !== null && value !== undefined) clarity('set', key, String(value))
      }
    }
  } catch { /* never let counting break the page */ }
}

/** A session tag, e.g. clarityTag('area', 'terranotes'). */
export function clarityTag(key: string, value: string): void {
  try {
    const clarity = clarityFn()
    if (!clarity) return
    clarity('set', key, value)
  } catch { /* never let counting break the page */ }
}
