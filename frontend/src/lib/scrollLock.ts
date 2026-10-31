/**
 * One reference-counted scroll lock for the whole app.
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * Five components each implemented their own lock, and all five did the same
 * naive thing:
 *
 *     const prev = document.body.style.overflow
 *     document.body.style.overflow = 'hidden'
 *     return () => { document.body.style.overflow = prev }
 *
 * (hooks/useDialog.ts, components/Confirm.tsx, components/PostFocusModal.tsx,
 * components/Sheet.tsx, and AQNav.tsx on documentElement.)
 *
 * That is correct for exactly one lock at a time and WRONG the moment two
 * overlap, which this app does routinely - FeedPostCard alone mounts a share
 * modal, a focus modal and a comment sheet as siblings, any desk dialog can
 * raise a confirm from inside itself, and the nav drawer can be open behind
 * either. When a second lock opens, its `prev` captures the FIRST lock's
 * `'hidden'`. Whichever order they then close in, one of them writes
 * `overflow: hidden` back onto the body and nobody ever clears it:
 *
 *     dialog opens      prev = ''        body = hidden
 *       confirm opens   prev = 'hidden'  body = hidden
 *     dialog closes     body = ''                       <- outer released first
 *       confirm closes  body = 'hidden'                 <- STUCK. No overlay
 *                                                          is open, and the
 *                                                          page cannot scroll.
 *
 * There is no visible overlay at that point, so it does not read as "a modal
 * is stuck" - it reads as "the site is broken, I can't scroll", with no way to
 * recover short of a reload.
 *
 * HOW THIS FIXES IT
 *
 * One counter, one saved value. The FIRST acquire records what the page
 * actually had and applies the lock; every later acquire only increments.
 * Release decrements, and only the LAST release restores - so the order locks
 * happen to unmount in stops mattering.
 *
 * `release` is idempotent per token: a component that somehow releases twice
 * (a double cleanup, a remount race) cannot drive the counter negative and
 * free the lock out from under a dialog that is still open. That is why
 * `acquire` hands back a token function rather than exposing a bare
 * decrement.
 *
 * Both `html` and `body` are locked. `body.style.overflow` alone does not
 * reliably stop the page on iOS Safari - AQNav.tsx had already discovered
 * that and locked `documentElement` instead, which is precisely how the app
 * ended up with two DIFFERENT lock targets that could not see each other.
 */

let depth = 0
let savedBody = ''
let savedHtml = ''

/**
 * Lock scrolling. Returns the matching release - call it exactly once, and
 * calling it more than once is a safe no-op.
 *
 *   useEffect(() => { if (!open) return; return acquireScrollLock() }, [open])
 */
export function acquireScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {}

  if (depth === 0) {
    savedBody = document.body.style.overflow
    savedHtml = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }
  depth++

  let released = false
  return function release() {
    if (released) return
    released = true
    depth = Math.max(0, depth - 1)
    if (depth === 0) {
      document.body.style.overflow = savedBody
      document.documentElement.style.overflow = savedHtml
    }
  }
}

/** How many locks are currently held. Exported for tests and for the
 *  "is an overlay open" checks that already read body.style.overflow. */
export function scrollLockDepth(): number {
  return depth
}

/**
 * Force everything unlocked. NOT for normal use - normal use is the token.
 * This exists as the recovery hatch for the failure this module replaces: if a
 * lock is ever orphaned by a crash mid-render, a route change can call this
 * rather than leaving a member on a page they cannot scroll.
 */
export function resetScrollLock(): void {
  if (typeof document === 'undefined') return
  depth = 0
  document.body.style.overflow = savedBody
  document.documentElement.style.overflow = savedHtml
  savedBody = ''
  savedHtml = ''
}

export default acquireScrollLock
