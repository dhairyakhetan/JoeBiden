import './AuthShell.css'
import type { ReactNode } from 'react'
import ErrorState from './ErrorState'

// Shared primitives for the auth spine (login / register / pending /
// rejected / auth-callback) - previously each page hand-rolled its own
// spinner markup and error-slot styling with divergent inline styles for
// the same three things. Extracted here so a visual tweak to any of them
// (spinner colour, error shake animation) only needs to happen once.
//
// `AuthShell` itself owns the two-column split (desktop feature panel +
// mobile top strip + form column) used by Login and Register - the two
// screens that actually share that layout. Pending/Rejected/Callback have
// deliberately different layouts (a masonry feed preview, a celebration
// card, a bare spinner) that predate this extraction and would visually
// regress if forced into the two-column split, so those three consume only
// the shared `AuthSpinner` / `AuthFullScreenSpinner` primitives below, not
// the `<AuthShell>` split layout itself. See HANDOFF.md "Phase 2" for the
// full note on this deliberate scope limit.

export function AuthSpinner({ small = false }: { small?: boolean }) {
  return (
    <div
      aria-label="Loading"
      className={small ? 'authshell-spinner authshell-spinner-sm' : 'authshell-spinner'}
    />
  )
}

export function AuthFullScreenSpinner() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', background: 'var(--bg)' }}>
      <AuthSpinner />
    </div>
  )
}

interface AuthShellProps {
  /** Desktop-only left panel - typically <AuthFeaturePanel mode="..." />. */
  left: ReactNode
  /** Mobile-only compact strip shown above the form on small screens.
      Omit (e.g. Register) to just hide the left panel on mobile instead. */
  mobileTop?: ReactNode
  /** Extra content shown only on mobile, above the form (e.g. Register's logo). */
  mobileExtra?: ReactNode
  /** Eyebrow sticker + heading + subhead, rendered above the error slot. */
  header: ReactNode
  /** Current error message, if any - rendered as the shared shake-in banner. */
  error?: string | null
  /** Re-run the action that failed. changelog/11-system-states.md §11.4 and
   *  ACCEPTANCE.md §B: an error state has a retry, not just a message - a
   *  dismiss × removes the sentence and leaves the member exactly where they
   *  were stuck. Wired through `ErrorState` so the auth spine shares the one
   *  error primitive instead of a second hand-rolled treatment. */
  onRetryError?: () => void
  retryErrorLabel?: string
  /** Form / CTA content. */
  children: ReactNode
  /** Footer link row, rendered below children. */
  footer?: ReactNode
  rootClassName?: string
}

export default function AuthShell({
  left, mobileTop, mobileExtra, header, error, onRetryError, retryErrorLabel, children, footer, rootClassName,
}: AuthShellProps) {
  return (
    <div className={`authshell-root route-enter${rootClassName ? ` ${rootClassName}` : ''}`}>

      {/* ── LEFT PANEL - desktop only ── */}
      <div className="authshell-left" aria-hidden="true">{left}</div>

      {/* ── TOP STRIP - mobile only, if provided ── */}
      {mobileTop && (
        <div className="authshell-mobile-strip" aria-hidden="true">{mobileTop}</div>
      )}

      {/* ── RIGHT PANEL - form ── */}
      <div className="authshell-right">
        {mobileExtra}
        {header}

        {/* §11.4: the tinted well + `--danger` glyph + retry, via the one
            shared primitive. The old markup here was a 2px DASHED tomato box
            (00.12 / 11.3 forbid dashed) at .08 tint whose only control was a
            dismiss ×. `.authshell-error-slot` keeps the shake and the spacing
            the slot always had; the treatment itself is now ErrorState's. */}
        {error && (
          <div className="authshell-error-slot">
            <ErrorState message={error} onRetry={onRetryError} retryLabel={retryErrorLabel ?? 'try again'} />
          </div>
        )}

        {children}

        {footer}
      </div>

    </div>
  )
}
