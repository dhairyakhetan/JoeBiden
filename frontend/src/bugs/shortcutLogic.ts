/**
 * The pure parts of the invisible bug-report shortcut, kept apart from the DOM so they can be
 * unit-tested (shortcutLogic.test.ts). BugShortcut.tsx wires them to real events.
 *
 *   desktop: Alt + Shift + B
 *   touch:   press and hold with two fingers for 700ms without moving them
 */

export const HOLD_MS = 700
/** A finger may drift this far (px) and still count as holding still. */
export const HOLD_SLOP = 14

/** Alt+Shift+B, matched on the physical key (`code`) because Option+Shift+B types a different
 *  character on a Mac. Ctrl or Cmd held means something else, so it is not ours. */
export function isBugChord(e: { altKey: boolean; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; code: string; repeat?: boolean }): boolean {
  return e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyB' && !e.repeat
}

export interface Pt { x: number; y: number }

/** True when any finger has moved further than the slop from where it started. */
export function movedTooFar(start: Pt[], now: Pt[], slop: number = HOLD_SLOP): boolean {
  if (start.length !== now.length) return true
  return start.some((s, i) => Math.hypot(now[i].x - s.x, now[i].y - s.y) > slop)
}

/** Where the shortcut must stay quiet: the sign-in flow and the places that ARE the form. */
export function shortcutAllowed(pathname: string, active: boolean): boolean {
  if (!active) return false
  return !/^\/(login|register|pending|rejected|welcome|auth)(\/|$)/.test(pathname)
}

/**
 * How to render the page the member is looking at. The library redraws the document from its
 * own content, so the canvas is the document from the top down to the bottom of the viewport,
 * and the part above the scroll position is cropped away. Big canvases fail on phones, so the
 * pixel ratio is lowered until the area fits `maxPixels`.
 */
export function captureBox(opts: {
  innerWidth: number; innerHeight: number; scrollY: number; dpr: number; maxPixels?: number
}): { ratio: number; renderHeight: number; cropTop: number; cropHeight: number } {
  const maxPixels = opts.maxPixels ?? 14_000_000
  const renderHeight = Math.max(1, Math.round(opts.scrollY + opts.innerHeight))
  let ratio = Math.min(2, Math.max(1, opts.dpr || 1))
  while (ratio > 0.25 && opts.innerWidth * ratio * renderHeight * ratio > maxPixels) ratio = Math.round((ratio - 0.25) * 100) / 100
  return { ratio, renderHeight, cropTop: Math.round(opts.scrollY), cropHeight: Math.round(opts.innerHeight) }
}
