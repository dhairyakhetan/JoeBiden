import { useEffect, useState } from 'react'

/* ─────────────────────────────────────────────────────────────────────────
   The burst-and-settle load animation — changelog/18-mascots-and-motion.md
   §18.2. First visit of a session only, then instant (session-scoped via
   `sessionStorage`, same try/catch convention as `ApprovedWelcomeModal`'s
   `APPROVED_WELCOME_FLAG_KEY`, read defensively in `FirstRunController.tsx` -
   never `localStorage`).

   IMPLEMENTATION NOTE - why this is a DOM query, not a wrapping component.
   The obvious shape for this ("wrap each of the first few cards in a
   <BurstItem>") was tried and reverted: `styles/routes/feed.css` already
   keys a separate, pre-existing entrance effect off
   `.home-feed-list .feed-card:nth-child(2..5)` - inserting a wrapper `<div>`
   around a card makes that `.feed-card` the FIRST child of the new wrapper
   instead of the Nth child of `.home-feed-list`, silently breaking that
   unrelated animation for every future page load, not just the first. Since
   this changelog's own guardrail is "don't touch the feed/rail region's
   structure" (a second agent owns that area today), this mounts as a single
   no-DOM-footprint component instead (`<FeedBurst />`, returns null) that
   finds the real, already-rendered `.feed-card` elements via
   `querySelector` and animates them in place - zero JSX changes to the
   card list itself, so the sibling/nth-child relationships never move.

   Deliberately built WITHOUT any requestAnimationFrame loop (see the 18.3
   note in `Companion.css` for the sibling reasoning): every card only ever
   animates from ONE scattered start transform to ONE settled end transform,
   which a plain CSS `transition` interpolates on the compositor thread for
   free. The two `requestAnimationFrame` calls below exist purely to
   sequence "paint the scattered start state, THEN flip to the transitioned
   end state" - not a stepping loop.

   Floor 2 ("nothing above the fold animates before its content is
   readable"): card index 0 never touches opacity, only transform - its text
   is at full opacity from frame one (18.2: "Do not fade text in").

   Floor 4 ("nothing blocks a tap for longer than 300ms"): a single
   capture-phase `pointerdown` listener, attached once for the whole page,
   jumps every tracked card to its end state synchronously via a direct
   style write - not a React state update, which would still have to
   round-trip a render before the DOM reflects it - before the click that
   follows the pointerdown ever dispatches. */

const FLAG_KEY = 'aq_burst_seen'
const STAGGER_MS = 40
const CAP_MS = 900
const SETTLE_MS = 420
const FADE_MS = 320

function readBurstSeen(): boolean {
  try { return sessionStorage.getItem(FLAG_KEY) === '1' } catch { return true /* private mode - don't risk a repeat burst */ }
}
function markBurstSeen() {
  try { sessionStorage.setItem(FLAG_KEY, '1') } catch { /* private mode - session-only feature, fine to no-op */ }
}

function scatterFor(index: number) {
  const rot = ((index % 5) - 2) * 3.2 // -6.4..6.4deg, small and varied
  const tx = (index % 2 === 0 ? -1 : 1) * (16 + (index % 3) * 8)
  const ty = -20 - (index % 4) * 7
  return { rot, tx, ty }
}

function burstElement(el: HTMLElement, index: number, onJump: (cb: () => void) => () => void): () => void {
  const { rot, tx, ty } = scatterFor(index)
  const delay = Math.min(index * STAGGER_MS, Math.max(0, CAP_MS - SETTLE_MS))
  const noFade = index === 0 // floor 2: the first card's text never fades
  let settled = false

  const settle = (instant: boolean) => {
    if (settled) return
    settled = true
    el.style.transition = instant
      ? 'none'
      : `transform ${SETTLE_MS}ms ${delay}ms cubic-bezier(0.2, 0.8, 0.2, 1)` +
        (noFade ? '' : `, opacity ${FADE_MS}ms ${delay}ms ease`)
    el.style.transform = ''
    if (!noFade) el.style.opacity = ''
    el.style.willChange = ''
  }

  // This element also carries feed.css's own unconditional `feedCardIn`
  // mount fade (+ an nth-child stagger delay) - a smaller, separate effect
  // that plays on every load. For exactly this first-session pass, the
  // richer burst supersedes it on this element (an inline `animation`
  // always wins over the un-`!important` stylesheet rule); every later
  // load never reaches this function at all, so `feedCardIn` plays
  // completely undisturbed as it always has.
  el.style.animation = 'none'
  el.style.transition = 'none'
  el.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(0.96)`
  if (!noFade) el.style.opacity = '0'
  el.style.willChange = 'transform, opacity'

  // Paint the scattered start state first, then flip to the settled
  // transform on the NEXT frame so the transition actually runs.
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(() => settle(false))
  })
  let raf2 = 0

  const unsubscribe = onJump(() => settle(true))

  return () => {
    cancelAnimationFrame(raf1)
    if (raf2) cancelAnimationFrame(raf2)
    unsubscribe()
  }
}

// ── the shared "jump to end state" signal ───────────────────────────────
// "Implement as a pointerdown listener that jumps every element to its end
// state" (18.2) - every tracked card, not just the one under the finger, so
// a tap on the first card's like button while lower cards are still
// scattering also stops those from being a distraction. `{ once: true }` so
// the listener removes itself the moment it has done its one job.
const jumpSubscribers = new Set<() => void>()
let hasJumped = false
let listenerArmed = false

function armGlobalJumpListener() {
  if (listenerArmed || typeof window === 'undefined') return
  listenerArmed = true
  window.addEventListener(
    'pointerdown',
    () => {
      hasJumped = true
      jumpSubscribers.forEach(cb => cb())
    },
    { passive: true, capture: true, once: true }
  )
}

function onBurstJump(cb: () => void): () => void {
  armGlobalJumpListener()
  jumpSubscribers.add(cb)
  if (hasJumped) cb()
  return () => { jumpSubscribers.delete(cb) }
}

export interface FeedBurstProps {
  /** CSS selector for the scroll container holding the cards. */
  containerSelector: string
  /** CSS selector matching one rendered card (skeletons excluded below). */
  cardSelector: string
  /** How many cards, from the top, take part in the burst. */
  count?: number
}

/**
 * Mounts once, renders nothing, and - on first visit of the session only -
 * finds the first `count` real (non-skeleton) cards already sitting in the
 * DOM and plays the scatter -> settle entrance on them in place. See the
 * header comment above for why this is a DOM query rather than a wrapping
 * component.
 */
export function FeedBurst({ containerSelector, cardSelector, count = 3 }: FeedBurstProps) {
  // Read-only at init (idempotent under a double-invoked render, matching
  // ApprovedWelcomeModal.tsx's own pattern) - the flag is CLAIMED (written)
  // once, separately, in the effect below, so a double-invoke can only
  // double-write the same '1' rather than have a throwaway first pass claim
  // the flag and a second, kept pass see it already gone and skip for real.
  const [skip] = useState(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true
    return readBurstSeen()
  })

  useEffect(() => {
    if (skip) return
    // Set BEFORE the animation starts, not after (18.2) - a member who
    // navigates away mid-animation must not see it again.
    markBurstSeen()

    const container = document.querySelector<HTMLElement>(containerSelector)
    if (!container) return

    let done = false
    const cleanups: (() => void)[] = []

    const tryBurst = () => {
      if (done) return
      const candidates = Array.from(container.querySelectorAll<HTMLElement>(cardSelector)).slice(0, count)
      if (candidates.length === 0) return
      // 18.2: "not the skeletons." The loading skeleton reuses the same
      // `.feed-card` class name on its placeholder divs, so real cards are
      // told apart by structure (a real card always renders a
      // `.feed-card-head`; a skeleton never does) rather than by waiting on
      // a network flag this component has no reason to know about.
      const real = candidates.filter(el => el.querySelector('.feed-card-head'))
      if (real.length === 0) return // still skeletons - keep watching
      done = true
      observer.disconnect()
      real.forEach((el, i) => cleanups.push(burstElement(el, i, onBurstJump)))
    }

    const observer = new MutationObserver(tryBurst)
    observer.observe(container, { childList: true })
    tryBurst() // cards may already be present (e.g. cached/sample-preview data)

    return () => {
      observer.disconnect()
      cleanups.forEach(fn => fn())
    }
    // `containerSelector`/`cardSelector`/`count` are static props from the
    // one call site (HomePage.tsx) and never change across this component's
    // life, so only `skip` needs to be a real dependency - this is a
    // one-shot "wait for real cards to exist, then run once" watcher, not
    // something that should re-arm on every HomePage re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip])

  return null
}
