import { useCallback, useEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from 'framer-motion'
import { acquireScrollLock } from '../lib/scrollLock'
import '../styles/components/sheet.css'

/* ─────────────────────────────────────────────────────────────────────────
   The two-detent ink bottom sheet — redesign 08.3, built once for two callers
   (08.3's mobile search filters here; 17.1's collapsed HoD-desk nav reuses
   this same component later - README.md "One sheet component, two callers").

   TWO DETENTS, no third:
     peek  108px tall, docked at the bottom, part of the page (no aria-modal).
           Carries a compact always-visible summary - the whole reason peek
           exists rather than a plain "filters" button is so that summary is
           readable without opening anything.
     full  top pinned at 96px from the viewport top, role="dialog"
           aria-modal="true", focus trapped and returned on collapse.

   The sheet never fully closes - a backdrop tap or Escape returns it to
   peek, never unmounts it. The caller decides whether to render <Sheet> at
   all (e.g. only once there is something to summarise).

   Operable with zero drag: the grabber is a real <button> with
   aria-expanded, and clicking the peek bar itself also toggles detent. The
   drag (pointer events, velocity-snap, no library per invariant 6) is an
   enhancement on top of that, never the only path.
   ───────────────────────────────────────────────────────────────────────── */

export type SheetDetent = 'peek' | 'full'

const PEEK_HEIGHT = 108
const FULL_TOP = 96
/** px/ms - a flick faster than this snaps in its direction regardless of
 *  how far the sheet actually travelled before release. */
const FLICK_VELOCITY = 0.45

export interface SheetProps {
  detent: SheetDetent
  onDetentChange: (next: SheetDetent) => void
  /** Always-present compact content - e.g. "3 results" + the active-filter
   *  mono line. Visible at both detents (it is what peek exists to show). */
  peek: ReactNode
  /** The expanded body. Only really visible/operable at `full` - clipped by
   *  the 108px peek height otherwise, so it needs no separate hide logic. */
  children: ReactNode
  /** Sticky control under the body at `full` (e.g. "Show 3 results"). */
  footer?: ReactNode
  /** Accessible name for the dialog at `full`. */
  ariaLabel: string
  /** Refocused on collapse. Defaults to the sheet's own grabber. */
  returnFocusRef?: React.RefObject<HTMLElement | null>
  className?: string
}

export default function Sheet({
  detent,
  onDetentChange,
  peek,
  children,
  footer,
  ariaLabel,
  returnFocusRef,
  className,
}: SheetProps) {
  const reduced = useReducedMotion()
  const sheetRef = useRef<HTMLDivElement>(null)
  const grabberRef = useRef<HTMLButtonElement>(null)
  const prevDetent = useRef<SheetDetent>(detent)
  const drag = useRef<{
    active: boolean
    startY: number
    startTop: number
    lastY: number
    lastT: number
    velocity: number
  } | null>(null)

  const full = detent === 'full'

  const collapse = useCallback(() => onDetentChange('peek'), [onDetentChange])
  const expand = useCallback(() => onDetentChange('full'), [onDetentChange])

  // Escape -> peek, only while full (at peek the sheet is part of the page,
  // not a dismissible layer). Body scroll-lock mirrors Confirm.tsx's dialog.
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') collapse() }
    document.addEventListener('keydown', onKey)
    const releaseScroll = acquireScrollLock()
    return () => {
      document.removeEventListener('keydown', onKey)
      releaseScroll()
    }
  }, [full, collapse])

  // Trap Tab inside the sheet while it is a dialog. Same hand-rolled
  // approach as Confirm.tsx (no focus-trap dependency).
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const root = sheetRef.current
      if (!root) return
      const els = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (els.length === 0) return
      const first = els[0], last = els[els.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [full])

  // Focus moves into the sheet on open, and back to the trigger on collapse.
  useEffect(() => {
    const was = prevDetent.current
    if (was !== detent) {
      if (full) {
        const t = setTimeout(() => {
          const root = sheetRef.current
          const target = root?.querySelector<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
          )
          target?.focus()
        }, 30)
        prevDetent.current = detent
        return () => clearTimeout(t)
      }
      // Collapsing: return focus to the caller's trigger, or the grabber.
      ;(returnFocusRef?.current ?? grabberRef.current)?.focus()
    }
    prevDetent.current = detent
    // returnFocusRef is a ref - intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detent, full])

  // ── Drag: pointer events, no library. Live-tracks the finger while
  //    dragging (transition suppressed via [data-dragging]), then snaps to
  //    whichever detent is nearer OR whichever direction the flick's
  //    velocity implies, whichever fires first. ──────────────────────────
  const applyLiveTop = (top: number) => {
    const root = sheetRef.current
    if (!root) return
    const viewportH = window.innerHeight
    const clamped = Math.min(Math.max(top, FULL_TOP), viewportH - PEEK_HEIGHT)
    root.style.top = `${clamped}px`
    root.style.height = `${viewportH - clamped}px`
  }
  const clearLiveStyle = () => {
    const root = sheetRef.current
    if (!root) return
    root.style.top = ''
    root.style.height = ''
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (reduced) return // reduced motion: click-only, no live drag-follow.
    const root = sheetRef.current
    if (!root) return
    const top = root.getBoundingClientRect().top
    drag.current = { active: true, startY: e.clientY, startTop: top, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 }
    root.setAttribute('data-dragging', 'true')
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d?.active) return
    const dy = e.clientY - d.startY
    applyLiveTop(d.startTop + dy)
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.velocity = (e.clientY - d.lastY) / dt
    d.lastY = e.clientY
    d.lastT = e.timeStamp
  }
  const onPointerUp = () => {
    const d = drag.current
    const root = sheetRef.current
    if (!d?.active || !root) return
    d.active = false
    root.removeAttribute('data-dragging')
    const viewportH = window.innerHeight
    const currentTop = root.getBoundingClientRect().top
    clearLiveStyle()
    let next: SheetDetent
    if (d.velocity > FLICK_VELOCITY) next = 'peek'        // flicked down fast
    else if (d.velocity < -FLICK_VELOCITY) next = 'full'  // flicked up fast
    else {
      const peekTop = viewportH - PEEK_HEIGHT
      next = Math.abs(currentTop - FULL_TOP) < Math.abs(currentTop - peekTop) ? 'full' : 'peek'
    }
    if (next !== detent) onDetentChange(next)
  }

  // 100dvh, not 100vh. The drag maths below measures against
  // `window.innerHeight`, which on iOS Safari is the VISIBLE viewport (URL bar
  // collapsed out) while `100vh` is the LARGE viewport - so the two disagreed
  // by the height of the browser chrome, and the sheet was laid out taller than
  // the space it actually had. Its last row, and at peek most of its content,
  // sat below the fold with no way to reach it. `dvh` is what innerHeight
  // reports, so the units now agree and the drag maths needs no change.
  const style: CSSProperties = full
    ? { top: FULL_TOP, height: `calc(100dvh - ${FULL_TOP}px)` }
    : { top: `calc(100dvh - ${PEEK_HEIGHT}px)`, height: PEEK_HEIGHT }

  /*
   * PORTALLED TO document.body, and this is load-bearing rather than tidy.
   *
   * The sheet positions itself `fixed`. A `fixed` element inside a TRANSFORMED
   * ancestor stops resolving against the viewport and resolves against that
   * ancestor instead - and the sheet's own page-behind effect
   * (`useSheetPageStyle`, at the bottom of this file) applies
   * `transform: scale(0.93) translateY(-14px)` to exactly the element the
   * caller wraps around it. SearchPage renders `<Sheet>` inside
   * `.aqs-scale-wrap`, which carries that transform, so on a phone the filter
   * sheet was laid out against a scaled-down box: offset, undersized, and
   * shifted further the moment the detent changed.
   *
   * Portalling here rather than at the call site fixes every caller at once,
   * including any added later, and is safe for the desk caller (which is not
   * currently inside a transform) because the sheet is `fixed` either way.
   */
  return createPortal(
    <>
      {full && (
        // Backdrop only exists at full - a tap returns to peek, never
        // dismisses the sheet outright (peek is the resting state).
        <div className="aq-sheet-backdrop" onClick={collapse} aria-hidden="true" />
      )}
      <div
        ref={sheetRef}
        className={'aq-sheet' + (reduced ? ' aq-sheet--reduced' : '') + (className ? ` ${className}` : '')}
        style={style}
        data-detent={detent}
        role={full ? 'dialog' : undefined}
        aria-modal={full ? true : undefined}
        aria-label={full ? ariaLabel : undefined}
      >
        <button
          ref={grabberRef}
          type="button"
          className="aq-sheet-grabber-hit"
          aria-expanded={full}
          aria-label={full ? `Collapse ${ariaLabel.toLowerCase()}` : `Expand ${ariaLabel.toLowerCase()}`}
          title={full ? `Collapse ${ariaLabel.toLowerCase()}` : `Expand ${ariaLabel.toLowerCase()}`}
          onClick={() => onDetentChange(full ? 'peek' : 'full')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="aq-sheet-grabber" aria-hidden="true" />
        </button>

        {/* A second, larger no-drag way to expand: tapping the summary
            itself (not just the small grabber) opens the sheet. Mouse/touch
            only - the grabber button above is the keyboard/AT path, with a
            real accessible name; this div stays out of the tab order so it
            doesn't add a second, confusingly-labelled stop for the same
            action. Inert at full - collapsing is the backdrop/Escape/
            grabber's job only, so this never fights those. */}
        <div className="aq-sheet-peek" onClick={full ? undefined : expand}>
          {peek}
        </div>

        <div className="aq-sheet-body">{children}</div>

        {footer && <div className="aq-sheet-footer">{footer}</div>}
      </div>
    </>,
    document.body,
  )
}

/**
 * The "page behind the sheet" half of the mechanic (README.md's overlap
 * rule doesn't apply here - this IS the reserved effect the design calls
 * for). Apply the returned style to whatever the sheet sits on top of.
 * `active` is false whenever no sheet is currently shown, so the page sits
 * at rest with no transform.
 */
export function useSheetPageStyle(detent: SheetDetent, active: boolean): CSSProperties {
  const reduced = useReducedMotion()
  const base: CSSProperties = { transformOrigin: 'top center' }
  if (!active || reduced) return base
  const transition = 'transform 320ms var(--ease-out), opacity 320ms var(--ease-out), border-radius 320ms var(--ease-out)'
  if (detent === 'full') {
    return { ...base, transform: 'scale(0.86) translateY(-26px)', borderRadius: 32, opacity: 0.5, transition }
  }
  return { ...base, transform: 'scale(0.93) translateY(-14px)', borderRadius: 32, opacity: 1, transition }
}
