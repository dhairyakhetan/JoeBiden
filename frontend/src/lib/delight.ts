/**
 * The one switch for celebration effects (docs/plans/delight-pass.md).
 *
 * A surface that wants a moment calls `celebrate('confetti', element)` AFTER its write succeeded. This file decides whether
 * the effect runs: never under prefers-reduced-motion, never when the member turned "fun effects" off in Settings. No surface
 * may roll its own particles or check these conditions itself.
 *
 * The renderer (components/CelebrationLayer) is lazy and mounts through components/CelebrationHost, so a page that never
 * celebrates never downloads it. This module has no imports and stays in the eager bundle at under 1 KB.
 */
export type Celebration = 'confetti' | 'hearts' | 'stars'

export interface CelebrationDetail { kind: Celebration; x: number; y: number }

export const FX_KEY = 'aq_fx'
export const FX_EVENT = 'aq:celebrate'

/** Pure: may an effect run, given the reduced-motion preference and the stored choice. Absent means on. */
export function effectsAllowed(reducedMotion: boolean, stored: string | null): boolean {
  return !reducedMotion && stored !== 'off'
}

/** Pure: the centre of a rectangle, which is where a burst starts from an element. */
export function centerOf(r: { left: number; top: number; width: number; height: number }): { x: number; y: number } {
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export function effectsEnabled(): boolean {
  if (typeof window === 'undefined') return false
  const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  let stored: string | null = null
  try { stored = window.localStorage.getItem(FX_KEY) } catch { /* private window: treat as on */ }
  return effectsAllowed(reduced, stored)
}

export function setEffectsEnabled(on: boolean): void {
  try {
    if (on) window.localStorage.removeItem(FX_KEY)
    else window.localStorage.setItem(FX_KEY, 'off')
  } catch { /* nothing to persist to; the toggle still works for this page view */ }
}

/** Start an effect at an element's centre, at a point, or at the middle of the screen. */
export function celebrate(kind: Celebration, at?: Element | { x: number; y: number } | null): void {
  if (!effectsEnabled()) return
  let point: { x: number; y: number }
  if (at && 'getBoundingClientRect' in at) point = centerOf(at.getBoundingClientRect())
  else if (at) point = at
  else point = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  window.dispatchEvent(new CustomEvent<CelebrationDetail>(FX_EVENT, { detail: { kind, ...point } }))
}
