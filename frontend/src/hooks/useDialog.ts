import { useEffect, useRef, type RefObject } from 'react'
import { acquireScrollLock } from '../lib/scrollLock'

/**
 * The four things every modal surface in this app owes a keyboard or
 * screen-reader user, in ONE implementation.
 *
 * Before this file there were three:
 *   • `components/Modal.tsx` — complete, but only three files import it.
 *   • `director/adminKit.tsx`'s `useModalA11y` — Escape + trap + focus restore
 *     for the five director dialogs, but no body scroll-lock.
 *   • a byte-identical hand-roll inside CreatePostModal.
 * …and roughly a dozen dialogs (OpportunitiesPage, TeamDetailPage, HomePage,
 * ShareModal, the achievement modals, AddMemberModal) with none of it at all:
 * Tab walked out onto the page behind the scrim, Escape did nothing, and the
 * body scrolled underneath on touch.
 *
 * Two entry points over the same core, because call sites differ:
 *   `useDialog(isOpen, onClose, opts)`  → returns the ref to put on the panel
 *   `useModalA11y(isOpen, ref, onClose, busy)` → takes a ref you already own
 *                                                (the director-desk signature)
 *
 * The four behaviours:
 *   1. Escape closes — unless the dialog is busy (`closeOnEscape: false` /
 *      `busy`), because dismissing mid-submit loses work and leaves the user
 *      unsure whether the write landed.
 *   2. Tab and Shift+Tab cycle within the panel instead of escaping behind it
 *      (WCAG 2.4.3). Focusables are re-queried on every keypress, so dialogs
 *      whose content changes — a step wizard, a revealed field — stay correct.
 *   3. Focus moves into the panel on open and returns to whatever held it when
 *      the dialog closes, so the keyboard isn't dumped at the top of the page.
 *   4. The body stops scrolling while open, and its *previous* overflow is
 *      restored rather than hard-reset — which matters when dialogs stack.
 */

export const MODAL_FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

function useDialogCore<T extends HTMLElement>(
  isOpen: boolean,
  panelRef: RefObject<T | null>,
  onClose: () => void,
  busy: boolean,
) {
  // Keep the latest callbacks without re-binding listeners every render —
  // call sites routinely pass inline arrows, and re-subscribing on each
  // keystroke would drop the trap mid-interaction.
  const onCloseRef = useRef(onClose)
  const busyRef = useRef(busy)
  useEffect(() => { onCloseRef.current = onClose; busyRef.current = busy })

  useEffect(() => {
    if (!isOpen) return

    const prevFocus = document.activeElement as HTMLElement | null
    // Reference-counted, shared with every other overlay in the app. A naive
    // save/restore here captured another open dialog's 'hidden' and put it
    // back on close - see lib/scrollLock.ts for the exact sequence.
    const releaseScroll = acquireScrollLock()

    const getEls = () => {
      const panel = panelRef.current
      return panel
        ? Array.from(panel.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE)).filter(el => el.offsetParent !== null)
        : []
    }

    // Prefer parking focus on the panel itself when it carries tabIndex={-1} —
    // that announces the dialog's label without dropping the user straight into
    // a text field. Panels that don't opt in fall back to their first control.
    // Deferred a frame so a portalled panel is in the document and laid out.
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (panel && panel.tabIndex === -1) panel.focus()
      else getEls()[0]?.focus()
    })

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!busyRef.current) { e.preventDefault(); e.stopPropagation(); onCloseRef.current() }
        return
      }
      if (e.key !== 'Tab') return

      const panel = panelRef.current
      const els = getEls()
      if (!panel) return
      if (els.length === 0) { e.preventDefault(); return }

      const first = els[0]
      const last = els[els.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (!active || !panel.contains(active)) { e.preventDefault(); first.focus(); return }
      if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      releaseScroll()
      prevFocus?.focus?.()
    }
  }, [isOpen, panelRef])
}

/** Ref-returning form, for dialogs that don't already own a panel ref. */
export default function useDialog(
  isOpen: boolean,
  onClose: () => void,
  options: { closeOnEscape?: boolean } = {},
): RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useDialogCore(isOpen, panelRef, onClose, options.closeOnEscape === false)
  return panelRef
}

/**
 * Ref-accepting form. This is the signature the director desk already calls
 * (`useModalA11y(isOpen, panelRef, onClose, busy)`) — kept identical so those
 * five call sites are unchanged, but now backed by the shared core, which means
 * they pick up the body scroll-lock they were missing.
 */
export function useModalA11y<T extends HTMLElement>(
  isOpen: boolean,
  panelRef: RefObject<T | null>,
  onClose: () => void,
  busy = false,
) {
  useDialogCore(isOpen, panelRef, onClose, busy)
}
