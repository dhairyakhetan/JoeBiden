import { ExclamationCircleIcon } from '@heroicons/react/24/outline'

interface ErrorStateProps {
  /** Short, plain-voice statement of what happened. Never pass a raw error
   *  message, a stack trace or a Postgres error string here (11.4) - log
   *  that with console.error at the call site and write a real sentence for
   *  this prop instead. */
  message: string
  /** Optional second line - how to fix / what to try. */
  hint?: string
  /** When provided, renders a retry button. Wire this to actually re-run the
   *  fetch (e.g. the same loader function) - never `window.location.reload()`
   *  (11.4). */
  onRetry?: () => void
  retryLabel?: string
  className?: string
  /** Compact inline banner (list-level) vs. the full centered block. */
  variant?: 'banner' | 'block'
}

/**
 * Shared fetch-error state - a tinted danger well with a retry, per
 * changelog/11-system-states.md §11.4: "never a dashed border" (00.12 keeps
 * dashed for exactly two "provisional, not real" cases and this isn't one of
 * them), a `--danger` glyph, `--r-inner` radius, and ink text ON the tint
 * (`--danger` as text on cream itself fails 4.5:1; the same hue as a light
 * tint ground with plain ink text passes). Distinct from the app-level
 * `ErrorBoundary` (which catches render crashes, not "the data didn't
 * load"), and distinct from `director/adminKit.tsx`'s `AdminErrorState` -
 * that is the HoD desk's own flat-language equivalent, reused as-is there by
 * design (CLAUDE.md: the desk and the public front-end are two design
 * languages on purpose). This is the public/member-facing one.
 */
export default function ErrorState({ message, hint, onRetry, retryLabel = 'try again', className = '', variant = 'banner' }: ErrorStateProps) {
  const block = variant === 'block'
  return (
    <div
      role="alert"
      className={className}
      style={{
        borderRadius: 'var(--r-inner)',
        background: 'color-mix(in srgb, var(--tomato) 16%, var(--card))',
        padding: block ? 'clamp(28px,6vw,52px) var(--page-px, 24px)' : '16px 18px',
        textAlign: block ? 'center' : 'left',
        display: 'flex',
        flexDirection: block ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: block ? 'center' : 'space-between',
        gap: 14,
      }}
    >
      <ExclamationCircleIcon
        width={block ? 32 : 20}
        height={block ? 32 : 20}
        strokeWidth={1.8}
        aria-hidden="true"
        style={{ color: 'var(--danger)', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: block ? 20 : 15, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
          {message}
        </div>
        {hint && (
          <p style={{ margin: '4px 0 0', fontFamily: 'var(--eina)', fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            {hint}
          </p>
        )}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            flexShrink: 0,
            minHeight: 44,
            padding: '0 18px',
            borderRadius: 999,
            border: 'var(--hair-3)',
            background: 'var(--card)',
            color: 'var(--ink)',
            fontFamily: 'var(--display)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            boxShadow: 'var(--lift-1)',
            marginTop: block ? 18 : 0,
          }}
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
