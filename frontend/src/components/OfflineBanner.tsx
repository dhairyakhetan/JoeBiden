import { useEffect, useState } from 'react'
import { getNetworkStatus, subscribeNetworkStatus } from '../lib/networkStatus'

/**
 * changelog/11-system-states.md §11.5 — the app-level offline state, which did
 * not exist anywhere in the product.
 *
 * "ADD an offline banner at the top of the content column (**not a toast — a
 * toast expires and the condition does not**): lemon tint, ink text, one
 * sentence."
 *
 * That parenthesis is the whole design. `Toast.tsx` already has an `offline`
 * *type*, which is precisely the treatment this line forbids: a toast dismisses
 * itself after four seconds while the member is still offline, so the one state
 * that must persist is the one the app was announcing with the one primitive
 * that cannot persist. This is a banner: it is present for exactly as long as
 * the condition is, and it goes away by itself when the connection returns.
 *
 * Ink on lemon measures 15.1:1 (DESIGN.md §2), so the tint carries the text
 * with room to spare. `role="status"` + `aria-live="polite"`, not `alert`:
 * §11.13 reserves `assertive` for a genuine error, and losing the connection is
 * a condition, not something the member did.
 *
 * The signal is `navigator.onLine` PLUS a failed-request count - see
 * `lib/networkStatus.ts` for why `onLine` alone is not enough (captive
 * portals report `true` while every request fails).
 *
 * Deliberately NOT a queue. §11.5: "do not build an offline queue."
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(() => getNetworkStatus().offline)

  useEffect(() => subscribeNetworkStatus(s => setOffline(s.offline)), [])

  // The element is absent, not hidden, when online: an empty live region that
  // is always in the tree is a region screen readers have to keep polling, and
  // this one has nothing to say the rest of the time.
  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      // Entrance-only, same reasoning as `.route-enter` (PublicLayout.tsx's own
      // comment on why an exit animation was deliberately removed): CSS cannot
      // animate an unmount, and that is fine here too - the banner appearing
      // is the moment worth marking, going offline is not a surprise the
      // member needs cushioned.
      className="route-enter"
      style={{
        // Sits at the top of the content column, full width of it.
        background: 'color-mix(in srgb, var(--lemon) 34%, var(--card))',
        color: 'var(--ink)',
        borderRadius: 'var(--r-inner)',
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--eina)',
        fontSize: 13.5,
        lineHeight: 1.45,
      }}
    >
      {/* A dot, not a glyph font and not an icon import - §13.7's geometric
          mark. Colour is never the only signal; the sentence is. */}
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--ink)', flexShrink: 0 }}
      />
      <span>you&rsquo;re offline. we&rsquo;ll pick up where you left off when you&rsquo;re back.</span>
    </div>
  )
}
