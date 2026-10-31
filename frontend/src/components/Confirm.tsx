import {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
} from 'react'
import { createPortal } from 'react-dom'
import { acquireScrollLock } from '../lib/scrollLock'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
// (No framer-motion: this provider is mounted at app root on every page, so
// importing motion here put the whole ~44KB-gz library on the critical path.
// The identical fade/scale/slide enter+exit is now done in CSS below.)

/**
 * Branded confirm() replacement.
 *
 * Usage:
 *   const confirm = useConfirm()
 *   if (await confirm({ title: 'Delete?', body: '...', danger: true })) {
 *     // user clicked confirm
 *   }
 *
 * Mirrors the useToast() pattern - context + Provider + hook + portal.
 * The modal stays mounted at app root and AnimatePresence drives the
 * enter/exit animations (so the dismiss animation actually plays
 * instead of the modal vanishing instantly).
 */

export interface ConfirmOptions {
  /** Lowercase, ends with a question mark. "delete this post?" not "Delete Post". */
  title: string
  /** Say what actually happens, including what can't be undone. */
  body?: string
  /** Defaults to "yeah, do it". Name the ACTION where you can — "delete it",
   *  "remove them" — so the button is readable without the title. */
  confirmLabel?: string
  /** Defaults to "nope". */
  cancelLabel?: string
  /** Renders the confirm button in tomato red instead of mint. */
  danger?: boolean
  /**
   * Two-step confirm, then hold-to-confirm. Applies to exactly three actions
   * in the app: account deletion, delete-a-team, reject-an-application -
   * never add this to a fourth call site without real justification ("a
   * desk where everything requires a hold is a desk where the hold stops
   * meaning anything"). Milliseconds to hold before the confirm fires; the
   * org's own number is 1200. Releasing early cancels with no side effect.
   * `prefers-reduced-motion` replaces the hold with a second tap instead
   * (arm, then confirm) rather than a timed press, since there's no motion
   * to sit through either way.
   */
  holdMs?: number
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)

// Internal state shape - `resolver` is how the Promise gets settled
// when the user clicks confirm/cancel.
interface PendingConfirm extends ConfirmOptions {
  id: string
  resolver: (v: boolean) => void
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  // Mirror of `pending.resolver` in a ref so `confirm()` (which is a
  // stable useCallback with no deps) can settle an in-flight confirm
  // before replacing it. Without this, a second confirm() call while
  // the first is still open would overwrite `pending` and the first
  // Promise would never settle - any `await confirm(...)` on it hangs
  // forever, leaving the calling button stuck in its busy state.
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    // A confirm is already open → resolve it false (treat as cancelled)
    // before this new one takes the slot.
    if (resolverRef.current) {
      resolverRef.current(false)
      resolverRef.current = null
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setPending({
        ...opts,
        id: Date.now().toString() + Math.random(),
        resolver: resolve,
      })
    })
  }, [])

  const settle = useCallback((result: boolean) => {
    // Resolve via the ref (always the live resolver) and clear it so a
    // double-settle (e.g. Enter + backdrop in the same frame) can't
    // resolve twice. Then unmount the modal.
    if (resolverRef.current) {
      resolverRef.current(result)
      resolverRef.current = null
      setPending(null)
    }
  }, [])

  // Escape = cancel. Body scroll-lock while open.
  // NOTE: no global "Enter = confirm" — that fired the primary (often
  // destructive) action regardless of which control was focused, defeating the
  // Cancel-autofocus safety. Enter now activates whatever button is focused
  // (native <button> behavior), so a reflexive Enter cancels.
  useEffect(() => {
    if (!pending) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false)
    }
    document.addEventListener('keydown', onKey)
    // Shared counted lock - a confirm is very often raised from INSIDE
    // another dialog, which is the exact case the old save/restore broke.
    const releaseScroll = acquireScrollLock()
    return () => {
      document.removeEventListener('keydown', onKey)
      releaseScroll()
    }
  }, [pending, settle])

  const value = useMemo(() => confirm, [confirm])

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <ConfirmModal pending={pending} onSettle={settle} />,
        document.body,
      )}
    </ConfirmContext.Provider>
  )
}

function ConfirmModal({
  pending, onSettle,
}: { pending: PendingConfirm | null; onSettle: (v: boolean) => void }) {
  // Keep the dialog mounted through its exit animation: when `pending` clears,
  // we play the closing animation, then unmount after the duration (this is
  // what AnimatePresence used to do, now done by hand so we don't ship motion).
  const [shown, setShown] = useState<PendingConfirm | null>(pending)
  const [closing, setClosing] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Trap Tab within the dialog so focus can't wander to the page behind the scrim.
  useEffect(() => {
    if (!shown || closing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const els = dialogRef.current?.querySelectorAll<HTMLElement>('button')
      if (!els || els.length === 0) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [shown, closing])

  useEffect(() => {
    if (pending) { setShown(pending); setClosing(false) }
    else if (shown) {
      setClosing(true)
      const t = setTimeout(() => { setShown(null); setClosing(false) }, 180)
      return () => clearTimeout(t)
    }
  }, [pending]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus the cancel button on open - the safer default, and now Enter
  // activates the focused button (no global Enter=confirm), so a reflexive
  // Enter cancels rather than triggering a destructive confirm.
  useEffect(() => {
    if (shown && !closing) {
      const t = setTimeout(() => cancelRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [shown, closing])

  if (!shown) return null
  return (
    <>
      <div
        className={'aqc-overlay' + (closing ? ' aqc-closing' : '')}
        onClick={() => onSettle(false)}
        /* Step 27. `align-items` and `padding` moved to .aqc-overlay in
           v6.css: on phone and tablet the dialog is a bottom sheet, so it must
           sit at flex-end with no padding, and an inline style cannot carry a
           media query. Position, z-index, scrim and blur stay here. */
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          /* Scrim routed onto the shared tokens (tokens.css, added 2026-09-10),
             replacing a one-off rgba(0,0,0,.55) + blur(4px). */
          background: 'var(--scrim)',
          backdropFilter: 'var(--scrim-blur)',
          display: 'flex', justifyContent: 'center',
        }}
      >
        <div
          ref={dialogRef}
          className="aqc-dialog"
          onClick={(e) => e.stopPropagation()}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        /* Step 27. Radius, max-width, padding and the shadow move to
           .aqc-dialog in v6.css so the sheet/modal split can be expressed:
           `32px 32px 0 0` full-width at <=1024, a centred 480px card at
           >=1025. */
          style={{
            background: 'var(--card)',
            /* 2026-09-10: was `2px solid var(--ink)`. The 2px ink border survives
               only on .btn-primary and .sticker; on the app's most-used dialog it
               was the loudest surviving piece of the retired motif. */
            border: 'var(--hair-2)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}
        >
            {/* Grab handle, 44x5. Sheet-only: hidden at >=1025 where the
                dialog is a centred card and there is nothing to grab. It is
                decorative, so it is aria-hidden - the dialog is already
                dismissible by Escape and by the scrim. */}
            <span className="aqc-grab" aria-hidden="true" />
            <h3
              id="confirm-title"
              style={{
                fontFamily: 'var(--display)', fontWeight: 800,
                fontSize: 20, lineHeight: 1.15, letterSpacing: '-0.01em',
                margin: 0, color: 'var(--ink)', textWrap: 'balance',
              } as React.CSSProperties}
            >
              {shown.title}
            </h3>

            {shown.body && (
              <p
                style={{
                  fontFamily: 'var(--eina)', fontSize: 14,
                  lineHeight: 1.55, color: 'var(--ink-2)',
                  margin: 0, textWrap: 'pretty',
                } as React.CSSProperties}
              >
                {shown.body}
              </p>
            )}

            {/* Step 27: stacked full-width on phone and tablet with the
                destructive action FIRST (top), reverting to the right-aligned
                row at >=1025. The direction lives in .aqc-actions; DOM order is
                already confirm-then-cancel, so `column` puts the destructive
                action on top without reordering the markup. */}
            <div className="aqc-actions">
              {shown.holdMs ? (
                <HoldToConfirmButton
                  holdMs={shown.holdMs}
                  danger={shown.danger}
                  label={shown.confirmLabel ?? 'yeah, do it'}
                  onConfirm={() => onSettle(true)}
                />
              ) : (
                <button
                  onClick={() => onSettle(true)}
                  style={{
                    flex: '1 1 auto', minHeight: 44,
                    padding: '0 18px', borderRadius: 999,
                    background: shown.danger ? 'var(--danger)' : 'var(--welfare)',
                    color: shown.danger ? '#fff' : '#0A0A0A',
                    border: shown.danger
                      ? '2px solid var(--danger)'
                      : '2px solid var(--ink)',
                    /* 2026-09-10: was a hand-rolled 3px->5px ink offset ladder.
                       This IS a primary CTA, so a hard offset is legal - but the
                       one legal value is --shadow-cta, and it does not grow on
                       hover (the lift does). Matches .btn-primary and the Google
                       button on /login. */
                    boxShadow: 'var(--shadow-cta)',
                    fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14,
                    cursor: 'pointer',
                    transitionProperty: 'transform, box-shadow',
                    transitionDuration: '120ms',
                    transitionTimingFunction: 'var(--ease-out)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = ''
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = '' }}
                >
                  {shown.confirmLabel ?? 'yeah, do it'}
                </button>
              )}
              <button
                ref={cancelRef}
                onClick={() => onSettle(false)}
                style={{
                  flex: '0 0 auto', minHeight: 44,
                  padding: '0 18px', borderRadius: 999,
                  background: 'transparent', color: 'var(--ink-2)',
                  border: '1.5px solid var(--line-2)',
                  fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14,
                  cursor: 'pointer',
                  transitionProperty: 'background, border-color, color',
                  transitionDuration: '120ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ink)'
                  e.currentTarget.style.color = 'var(--ink)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--line-2)'
                  e.currentTarget.style.color = 'var(--ink-2)'
                }}
              >
                {shown.cancelLabel ?? 'nope'}
              </button>
            </div>
        </div>
      </div>
    </>
  )
}


/**
 * Hold-to-confirm button - also exported standalone for the one call site
 * that isn't a useConfirm() dialog (AccountApprovals.tsx's reject-application
 * form, which has its own note-taking modal rather than going through
 * confirm()). A press-and-hold fill over `holdMs`; release early and it
 * resets with no side effect. Reduced motion swaps the timed hold for a
 * second tap ("armed" state, tap again within 4s to confirm) - there's no
 * motion to sit through either way, so this is a second explicit action
 * rather than a literal typed-word confirm, which would need its own
 * text-input UI for one accessibility fallback path.
 */
export function HoldToConfirmButton({
  holdMs, danger, label, onConfirm,
}: { holdMs: number; danger?: boolean; label: string; onConfirm: () => void }) {
  const reduced = usePrefersReducedMotion()
  const [holding, setHolding] = useState(false)
  const [armed, setArmed] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const armedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (armedTimerRef.current) clearTimeout(armedTimerRef.current)
  }, [])

  // #fff on --tomato is 3.31:1 at 14px/800 - not large text. --danger is the
  // palette's only red that carries paper: 5.80:1.
  const fill = danger ? 'var(--danger)' : 'var(--welfare)'
  const border = danger ? '2px solid var(--danger)' : 'var(--hair-2)'

  if (reduced) {
    return (
      <button
        onClick={() => {
          if (armed) {
            if (armedTimerRef.current) clearTimeout(armedTimerRef.current)
            onConfirm()
            return
          }
          setArmed(true)
          armedTimerRef.current = setTimeout(() => setArmed(false), 4000)
        }}
        style={{
          flex: '1 1 auto', minHeight: 44, padding: '0 18px', borderRadius: 999,
          background: fill, color: danger ? '#fff' : '#0A0A0A', border,
          boxShadow: 'var(--shadow-cta)',
          fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14,
          cursor: 'pointer',
        }}
      >
        {armed ? 'tap again to confirm' : label}
      </button>
    )
  }

  const start = () => {
    if (holding) return
    setHolding(true)
    timerRef.current = setTimeout(() => { setHolding(false); onConfirm() }, holdMs)
  }
  const cancel = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    setHolding(false)
  }

  return (
    <button
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start() } }}
      onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') cancel() }}
      aria-label={holding ? `hold to ${label} - keep pressing` : label}
      style={{
        position: 'relative', overflow: 'hidden',
        flex: '1 1 auto', minHeight: 44, padding: '0 18px', borderRadius: 999,
        background: 'color-mix(in srgb, ' + fill + ' 35%, var(--card))',
        color: 'var(--ink)', border,
        boxShadow: 'var(--shadow-cta)',
        fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14,
        cursor: 'pointer', userSelect: 'none', WebkitTapHighlightColor: 'transparent',
        touchAction: 'none',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute', inset: 0, background: fill,
          transform: `scaleX(${holding ? 1 : 0})`,
          transformOrigin: 'left',
          transition: holding ? `transform ${holdMs}ms linear` : 'transform .15s var(--ease-out)',
        }}
      />
      <span style={{ position: 'relative', color: danger && holding ? '#fff' : undefined }}>
        {holding ? 'keep holding…' : label}
      </span>
    </button>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext)
}

export default ConfirmProvider
