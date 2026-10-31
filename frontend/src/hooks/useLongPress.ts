import { useRef, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from 'react'

/** Pointer moving past this before release cancels the press - same feel and
 *  the same value as Companion.tsx's BONE_MOVE_THRESHOLD_PX, so a long-press
 *  and a drag-to-scroll don't fight each other. */
const MOVE_THRESHOLD_PX = 6
const DEFAULT_DELAY_MS = 500

/**
 * A long-press (or right-click, its desktop equivalent) on an element.
 * `onLongPress` receives the triggering event's client coordinates, for
 * positioning a menu at the press point rather than the element's corner.
 */
export function useLongPress(onLongPress: (x: number, y: number) => void, delayMs = DEFAULT_DELAY_MS) {
  const timerRef = useRef<number | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)

  const clear = () => {
    if (timerRef.current != null) { window.clearTimeout(timerRef.current); timerRef.current = null }
    startRef.current = null
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    startRef.current = { x: e.clientX, y: e.clientY }
    const x = e.clientX, y = e.clientY
    timerRef.current = window.setTimeout(() => { clear(); onLongPress(x, y) }, delayMs)
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!startRef.current) return
    const d = Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y)
    if (d > MOVE_THRESHOLD_PX) clear()
  }
  const onPointerUp = () => clear()
  const onPointerCancel = () => clear()
  const onContextMenu = (e: ReactMouseEvent) => {
    e.preventDefault()
    clear()
    onLongPress(e.clientX, e.clientY)
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu }
}
