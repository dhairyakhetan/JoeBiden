import { useCallback, useRef, useState } from 'react'

/**
 * changelog/11-system-states.md §11.13 — the surface-level announcer.
 *
 * "`aria-live="polite"` on every optimistic count change, every filter result
 * count, every step advance." · "**One live region per surface**, not one per
 * control." · "Never `assertive` except for a genuine error."
 *
 * Before this, a grep across `feed/`, `profile/` and `services/` returned
 * exactly ONE `aria-live` in the whole cluster (a character counter). Liking a
 * post, saving a post and filtering a list all changed the screen and announced
 * nothing, so a screen-reader user got no confirmation that the tap did
 * anything at all.
 *
 * The shape is deliberately "one hook, one region": a surface calls
 * `useAnnouncer()` once, renders `{region}` once near the top of its own
 * subtree, and every control on that surface calls `announce(...)`. That is
 * §11.13's "one per surface" rule expressed as an API, so it is easier to
 * follow than to break — the alternative (each control owning its own
 * `aria-live` node) produces a page full of competing regions.
 *
 * Why `sr-only` and not `hidden`: `display: none` and the `hidden` attribute
 * take the node out of the accessibility tree entirely, and a live region that
 * is not in the tree announces nothing. The region must be rendered, present
 * and empty-then-filled, which is what `.sr-only` (already in the global CSS)
 * gives us.
 *
 * The re-announce nonce exists because a live region only fires on a CHANGE of
 * its text content. Unliking then re-liking a post produces the same sentence
 * twice, and without the nonce the second one is silent.
 */
export function useAnnouncer() {
  const [message, setMessage] = useState('')
  const nonce = useRef(0)

  const announce = useCallback((text: string) => {
    nonce.current += 1
    // A zero-width space, repeated, makes an identical repeated sentence a
    // textual change without changing what is read aloud.
    setMessage(text + '​'.repeat(nonce.current % 2))
  }, [])

  const region = <LiveRegion message={message} />

  return { announce, region }
}

/**
 * The region itself, for a surface that already has its own state for what to
 * announce and just needs somewhere to put it.
 */
export default function LiveRegion({ message }: { message: string }) {
  return (
    <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  )
}
