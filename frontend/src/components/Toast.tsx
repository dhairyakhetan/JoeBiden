import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
// NOT framer-motion's useReducedMotion, deliberately. This provider is mounted
// at the app root on every route, so importing framer-motion here put the whole
// 127KB vendor-motion chunk on the eager critical path for a single boolean.
// Same reasoning Confirm.tsx already records in its own header.
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
// Section 01 step 24. The glyphs were the text characters "*", "x" and "i" set
// in NeutralFace; the icon ground rule is heroicons 24/outline only.
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  CloudArrowDownIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

/** `offline` is new in the redesign (step 24): a connectivity toast that is
 *  deliberately quiet, carries no action, and uses the paper-dark surface
 *  rather than a saturated hue, because losing connection is a state, not an
 *  error the member did something to cause. */
type ToastType = 'success' | 'error' | 'info' | 'offline'

interface ToastAction {
  label: string
  onClick: () => void
}

interface Toast {
  id: string
  type: ToastType
  message: string
  detail?: string
  action?: ToastAction
  /** ms before this toast auto-dismisses. Defaults to the standard 4000ms;
   * an action toast (e.g. undo) wants a longer, caller-controlled window. */
  duration?: number
}

interface ToastCtx {
  toast: (message: string, opts?: { type?: ToastType; detail?: string; action?: ToastAction; duration?: number }) => void
  success: (message: string, detail?: string) => void
  error: (message: string, detail?: string) => void
  info: (message: string, detail?: string) => void
  /** Connectivity notice. Carries no action by design (step 26): there is
   *  nothing for the member to retry until the network returns. */
  offline: (message: string, detail?: string) => void
  /** Toast with an inline action button (e.g. "Undo") - used by
   * useUndoableAction (adminKit.tsx) so a mutation can be reversed within a
   * grace window instead of firing immediately. */
  action: (message: string, action: ToastAction, opts?: { detail?: string; duration?: number }) => string
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastCtx>({
  toast: () => {},
  success: () => {},
  error: () => {},
  info: () => {},
  offline: () => {},
  action: () => '',
  dismiss: () => {},
})

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircleIcon,
  error:   ExclamationCircleIcon,
  info:    InformationCircleIcon,
  offline: CloudArrowDownIcon,
}

/** The accent carries the icon chip and the 4px left edge. It is NOT the toast
 *  surface: --welfare under ink measures 4.35:1, and the message sets at 13px,
 *  so filling the card with the hue would put body copy under the AA floor.
 *  White surface + hue accent keeps the variant readable at every size.
 *  error moved --tomato -> --rust: --tomato is 3.31:1 and was the only
 *  remaining failing hue in this component. */
const COLORS: Record<ToastType, string> = {
  success: 'var(--welfare)',
  error:   'var(--rust)',
  info:    'var(--sky)',
  offline: 'var(--paper-dark)',
}

/** One number for the slide, so the CSS transition, the click-to-close unmount
 *  and the auto-dismiss unmount can't drift apart. They previously ran at
 *  280ms / 300ms / 400ms, which left the toast invisible-but-mounted (still
 *  holding its slot in the stack) for up to 120ms after it had finished
 *  animating away. */
const EXIT_MS = 280
/** Default auto-dismiss window. */
const DEFAULT_LIFE_MS = 4000

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  // `in` drives the entrance, `out` the exit. The toast mounts at
  // translateX(110%) and is moved to 0 on the next frame — without this it
  // simply appeared at rest and then slid out to the right on dismiss, so the
  // exit implied a direction the entrance never established. Enter and exit
  // now share one axis, which is also what makes a future swipe-to-dismiss
  // feel obvious rather than arbitrary.
  const [shown, setShown] = useState(false)
  const [out, setOut] = useState(false)
  const [paused, setPaused] = useState(false)
  // Reduced motion: drop the translate and collapse the exit window to 0, so the
  // toast does not hold a mounted-but-invisible slot in the stack for 280ms.
  const reduced = usePrefersReducedMotion()
  const EXIT = reduced ? 0 : EXIT_MS
  const accent = COLORS[toast.type]
  const Icon = ICONS[toast.type]

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Hovering or focusing the toast pauses its life; leaving resumes a fresh
  // window rather than trying to account for elapsed time — simpler, and the
  // cost (a toast you stopped looking at lingers a beat longer) is the right
  // side to err on for a dismiss timer.
  useEffect(() => {
    if (paused) return
    const life = toast.duration ?? DEFAULT_LIFE_MS
    // An error, or a toast carrying an action, is passed Infinity and must stay
    // until dismissed - there is nothing to time out on a message the member has
    // to read or respond to.
    if (!Number.isFinite(life)) return
    const dismiss = setTimeout(() => setOut(true), life)
    const remove  = setTimeout(() => onDismiss(toast.id), life + EXIT)
    return () => { clearTimeout(dismiss); clearTimeout(remove) }
  }, [toast.id, toast.duration, onDismiss, paused, EXIT])

  const close = () => { setOut(true); setTimeout(() => onDismiss(toast.id), EXIT) }

  return (
    <div
      /* No role="status" here: the .aq-toasts container is already the live
         region, and a nested one announces twice or not at all. */
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '12px 14px',
        background: 'var(--card)',
        // 2026-09-10: the radius was migrated here in an earlier pass but the
        // edge and shadow were missed, leaving this half-converted. A toast is
        // neither a .btn-primary nor a .sticker, so the 2px ink border and
        // --shadow-cta (the CTA/sticker offset, not an elevation) were both
        // wrong. It floats above everything, so it takes a real lift. The
        // coloured left rule is the documented accent device and stays.
        border: 'var(--hair-2)',
        borderLeft: `4px solid ${accent}`,
        borderRadius: 'var(--r-inner)',
        boxShadow: 'var(--lift-3)',
        maxWidth: '100%', minWidth: 0, width: '100%',
        // Step 25: slideUp. Was translateX(110%), an enter/exit on the
        // horizontal axis, which was correct while the stack was pinned to the
        // right edge. The container is now full-width above the dock on phone,
        // so a toast sliding in from the right would travel most of the screen
        // to arrive somewhere it did not come from. Enter and exit share the
        // vertical axis instead, matching where the toast actually sits.
        transform: reduced ? 'none' : (shown && !out ? 'translateY(0)' : 'translateY(16px)'),
        opacity: shown && !out ? 1 : 0,
        transition: reduced ? 'opacity 150ms var(--ease-out)' : `transform ${EXIT_MS}ms var(--ease-out), opacity ${EXIT_MS}ms var(--ease-out)`,
        cursor: 'pointer',
      }}
      onClick={close}
    >
      {/* Icon */}
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        background: accent, color: 'var(--ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>
        <Icon width={14} height={14} strokeWidth={2.5} aria-hidden="true" />
      </div>
      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 13, color: 'var(--ink)', lineHeight: 1.2 }}>
          {toast.message}
        </div>
        {toast.detail && (
          <div style={{ fontFamily: 'var(--eina)', fontSize: 11, color: 'var(--ink-3)', marginTop: 3, lineHeight: 1.4 }}>
            {toast.detail}
          </div>
        )}
      </div>
      {toast.action && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); toast.action!.onClick(); close() }}
          style={{
            flexShrink: 0, fontFamily: 'var(--mono)', fontWeight: 800, fontSize: 11,
            textTransform: 'uppercase', letterSpacing: '0.04em',
            color: 'var(--ink)', background: 'var(--bg-2)', border: '1.5px solid var(--ink)',
            // 8 -> --r-tight (DESIGN.md §1).
            borderRadius: 'var(--r-tight)', padding: '5px 10px', cursor: 'pointer',
            // Was ~26px tall, and it carries no .btn/.chip class so v6.css's 44px
            // block never reached it. Real 44px target, pulled back with the same
            // compensating negative margins the sibling dismiss button uses so
            // the toast does not get chunkier.
            minHeight: 44, display: 'inline-flex', alignItems: 'center',
            marginTop: -8, marginBottom: -9,
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); close() }}
        aria-label="Dismiss notification"
        style={{
          // Was a ~18px target (fontSize 14 + 2px padding) sitting INSIDE the
          // toast's own click-to-close surface: two overlapping hit areas, the
          // smaller one well under the 44px floor. The button is now a real
          // 44x44 target, pulled back with negative margins so the toast does
          // not get visually chunkier to accommodate it.
          flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--ink-3)', lineHeight: 0,
          width: 44, height: 44, margin: '-11px -12px -11px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <XMarkIcon width={14} height={14} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Queue depth 1: a second toast REPLACES the first, never stacks — a toast
  // the user has already scrolled past is noise, not a backlog to work through.
  const show = useCallback((message: string, opts?: { type?: ToastType; detail?: string; action?: ToastAction; duration?: number }) => {
    const id = Date.now().toString() + Math.random()
    setToasts([{ id, type: opts?.type || 'info', message, detail: opts?.detail, action: opts?.action, duration: opts?.duration }])
    return id
  }, [])

  const ctx = useMemo<ToastCtx>(() => ({
    toast: show,
    success: (msg, detail) => { show(msg, { type: 'success', detail }) },
    // Errors are this codebase's only failure feedback (CLAUDE.md), so they do
    // not time out. Same for anything carrying an action the member must take.
    error:   (msg, detail) => { show(msg, { type: 'error',   detail, duration: Infinity }) },
    info:    (msg, detail) => { show(msg, { type: 'info',    detail }) },
    offline: (msg, detail) => { show(msg, { type: 'offline', detail }) },
    action:  (msg, action, opts) => show(msg, { type: 'info', detail: opts?.detail, action, duration: opts?.duration ?? Infinity }),
    dismiss,
  }), [show, dismiss])

  // 11.13: "never assertive except for a genuine error" - so an error toast
  // is the one case that should interrupt rather than wait its turn. Safe to
  // key off toasts[0] alone: the queue is depth 1 (a second toast REPLACES
  // the first, see `show` above), so at most one toast is ever live here.
  const liveIsError = toasts[0]?.type === 'error'

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        /* Step 23: position. WAS an inline `bottom: max(80px, safe-area+80px);
           right: 16` at every breakpoint, anchored to the right edge. It is now
           .aq-toasts in v6.css, because the step gives two different positions
           and an inline style cannot carry a media query: full width above the
           dock on phone, a 380px column bottom-right at >=1025. */
        <div
          className="aq-toasts"
          role={liveIsError ? 'alert' : 'status'}
          aria-live={liveIsError ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          {toasts.map(t => (
            <div key={t.id} style={{ pointerEvents: 'auto' }}>
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

export default ToastProvider
