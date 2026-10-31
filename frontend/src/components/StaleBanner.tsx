import { useEffect, useState } from 'react'
import { getNetworkStatus, subscribeNetworkStatus } from '../lib/networkStatus'

interface StaleBannerProps {
  /** Re-run the surface's own fetch. Never `window.location.reload()` (§11.4). */
  onRefresh: () => void
  /** "not now" - clears the prompt without spending a request. */
  onDismiss: () => void
  /** Set while the refetch is in flight, so the control can say so. */
  busy?: boolean
}

/**
 * changelog/11-system-states.md §11.1 state 8 — the refresh affordance after a
 * long idle. Paired with `lib/staleAfterIdle.ts`, which decides WHEN; this only
 * decides how it looks and asks.
 *
 * Shape follows `OfflineBanner` deliberately: same banner slot at the top of
 * the content column, same `role="status"` + polite live region (this is a
 * condition, not an error - §11.13 keeps `assertive` for genuine errors), same
 * `--r-inner` radius, same 8px dot as the mark. It differs in exactly two ways
 * that matter: it is grape-tinted rather than lemon (so the two are never
 * confused at a glance) and it carries controls, because unlike being offline
 * this is something the member can act on.
 *
 * COORDINATION WITH THE OFFLINE BANNER: the two must never shout at once, and
 * the resolution is not a z-order or a queue - it is that a stale prompt is
 * meaningless while offline. Refreshing cannot succeed with no connection, so
 * this component subscribes to the same `lib/networkStatus` signal the offline
 * banner uses and renders NOTHING while `offline` is true. The offline banner
 * wins outright, and when the connection comes back this one reappears (the
 * flag in the hook is untouched by any of it) with a refresh that can now
 * actually work.
 *
 * No animation: the banner appears at the top of a column the member is about
 * to read, and sliding it in pushes the content they came back for. A static
 * appearance is also the same in both motion preferences, so there is nothing
 * for `prefers-reduced-motion` to regress.
 */
export default function StaleBanner({ onRefresh, onDismiss, busy = false }: StaleBannerProps) {
  const [offline, setOffline] = useState(() => getNetworkStatus().offline)
  useEffect(() => subscribeNetworkStatus(s => setOffline(s.offline)), [])

  if (offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: 'color-mix(in srgb, var(--grape) 12%, var(--card))',
        color: 'var(--ink)',
        borderRadius: 'var(--r-inner)',
        padding: '12px 16px',
        marginBottom: 14,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        fontFamily: 'var(--eina)',
        fontSize: 13.5,
        lineHeight: 1.45,
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--grape)', flexShrink: 0 }}
      />
      <span style={{ flex: '1 1 180px', minWidth: 0 }}>
        this was loaded a while ago. there may be newer posts.
      </span>
      <span style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          style={{
            border: 'none',
            borderRadius: 999,
            padding: '7px 14px',
            minHeight: 34,
            background: 'var(--ink)',
            color: 'var(--card)',
            fontFamily: 'var(--eina)',
            fontWeight: 700,
            fontSize: 13,
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'refreshing' : 'refresh'}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            border: 'none',
            background: 'transparent',
            borderRadius: 999,
            padding: '7px 10px',
            minHeight: 34,
            color: 'var(--ink-2)',
            fontFamily: 'var(--eina)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          not now
        </button>
      </span>
    </div>
  )
}
