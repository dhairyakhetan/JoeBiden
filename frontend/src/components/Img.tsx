import React, { useState } from 'react'
import { sized, type ImgContext } from '../lib/imageUrl'

// Single image-element wrapper used across the (non-paradox) app - always runs `src`
// through `sized()` so remote images are never shipped at full resolution for
// a thumbnail-sized slot (see lib/imageUrl.ts), and always sets `loading` /
// `decoding` so every image is lazy by default. Pass `eager` only for the
// single LCP image on a route (a hero/above-fold cover).
// `alt` is REQUIRED, deliberately. It used to default to '', which silently
// marked every image in the app decorative - a live audit found 20 of 21 images
// on the homepage announcing as decoration, including post photos and project
// covers (WCAG 1.1.1). Making it required forces the decision at each call site;
// pass alt="" explicitly when the image really is decorative and the surrounding
// text already carries its meaning.
type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> & {
  src: string | null | undefined
  alt: string
  ctx?: ImgContext
  eager?: boolean
}

export default function Img({ src, ctx = 'card', eager = false, alt, onError, ...rest }: Props) {
  // changelog/11-system-states.md §11.5: "ADD a failed-image state: the
  // var(--bg-2) block stays, with a small mono `couldn't load` and a retry on
  // tap. onError on the img. Do not leave a broken-image glyph." Verification
  // #8: "every image has an onError state."
  //
  // This is the single wrapper for every non-paradox <img> in the app, so it
  // is the one place this can be added once rather than 200 times. A repo-wide
  // grep for `onError` on an <img> returned exactly one file before this.
  //
  // `attempt` is both the retry counter and the cache-buster: a browser that
  // has cached a failed response will serve the same failure back unless the
  // URL changes, so retry appends `?aq-retry=N`. It is only ever added on a
  // retry, so the first (and overwhelmingly common) load is byte-identical to
  // what `sized()` produced and nothing about the CDN contract changes.
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Whether this image sits inside a <button>, <a>/<Link> or <label>.
  //
  // The failed state used to render a <button> unconditionally, which is
  // invalid HTML in exactly those places: interactive content cannot nest.
  // An AST census of the tree found 35 of 115 <Img> call sites affected -
  // 19 inside <Link>, 15 inside <button>, 1 inside <label> - so this is
  // roughly a third of the app, not a corner case. React reports it as
  // "In HTML, <button> cannot be a descendant of <button>", and browsers
  // recover by splitting the nesting, which breaks keyboard order and the
  // accessibility tree.
  //
  // Measured on the <img> itself at the moment it errors, rather than
  // guessed from a Context or re-checked after a paint: the element is in
  // the DOM when onError fires, so closest() is exact and costs no extra
  // render pass. Nothing renders a placeholder before this is known.
  const [nested, setNested] = useState(false)

  const base = sized(src, ctx)

  // A new src is a new image - clear a previous failure rather than showing
  // the placeholder for a URL that was never tried. React's documented
  // "adjust state when a prop changes" pattern rather than an effect: this
  // component renders for every image in the app, and an effect here would
  // cost a second render pass on each one. `attempt` deliberately does not
  // change `base`, so a retry cannot re-trigger this.
  const [prevBase, setPrevBase] = useState(base)
  if (prevBase !== base) {
    setPrevBase(base)
    setFailed(false)
    setAttempt(0)
  }

  if (failed) {
    const { className, style } = rest

    // stopPropagation/preventDefault are load-bearing, found in live testing:
    // most failed images sit inside a card that is itself a <Link>, so a bare
    // onClick retried AND navigated away - the retry was unreachable. The
    // placeholder's tap means "try this image again", never "open the card".
    const retry = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setAttempt(n => n + 1)
      setFailed(false)
    }

    // Identical box either way, so which element we render never moves layout.
    // Inherits whatever box the call site sized the image into, so the
    // placeholder occupies exactly the slot the photo would have.
    const box: React.CSSProperties = {
      ...style,
      display: 'grid',
      placeItems: 'center',
      background: 'var(--bg-2)',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      color: 'var(--ink-3)',
      fontFamily: 'var(--mono)',
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: '0.06em',
      lineHeight: 1.2,
      textAlign: 'center',
      overflow: 'hidden',
    }

    // ── Inside a button/link/label: a <span>, never a <button> ──────────────
    // A click handler on a non-interactive element is normally a mistake. It
    // is the right call here, because the two alternatives are both worse:
    // nesting a real <button> is invalid HTML, and adding role="button" plus
    // tabIndex would put a second interactive control inside the first, which
    // is the same accessibility problem one layer along.
    //
    // Keyboard and screen-reader users are not stranded: the PARENT is already
    // a focusable control and still does its own job. What they lose is the
    // retry, which is a progressive enhancement over "a photo did not load",
    // and the changelog specifies it as "a retry on tap" (11.5). Pointer and
    // touch keep it.
    //
    // The aria matters more than it looks. The visible words "couldn't load"
    // used to become part of the PARENT's accessible name, so a project card
    // announced as "Smile Notes Campaign couldn't load". Standing in for the
    // image with its own alt text is what the <img> would have contributed.
    if (nested) {
      return (
        <span
          className={className}
          onClick={retry}
          style={box}
          {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
        >
          couldn&rsquo;t load
        </span>
      )
    }

    // ── Everywhere else: a real button, fully operable ─────────────────────
    return (
      <button type="button" className={className} onClick={retry} style={box}>
        couldn&rsquo;t load
      </button>
    )
  }

  return (
    <img
      src={attempt > 0 ? `${base}${base.includes('?') ? '&' : '?'}aq-retry=${attempt}` : base}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding={eager ? 'sync' : 'async'}
      // An eager image is by definition the one the page is judged on, so tell
      // the browser to fetch it ahead of the other images competing for the
      // connection. Placed before {...rest} so a call site can still override.
      fetchPriority={eager ? 'high' : undefined}
      {...rest}
      onError={e => {
        // An empty/absent src is a missing value, not a network failure - it
        // must not paint a "couldn't load, tap to retry" box over a slot that
        // was never given a URL.
        //
        // Found live: this used to also call reportNetworkFailure() here, on
        // the theory that a broken <img> load is evidence of a connectivity
        // problem. It isn't - a single dead/deleted avatar URL (an orphaned
        // storage object, a since-removed photo) is routine and has nothing
        // to do with the network, but a grid of many avatars (Member
        // Directory) only needs TWO of them to be stale for the false
        // "you're offline" banner to appear on a perfectly fine connection -
        // exactly the report this line used to cause. Image load failures
        // are too noisy/correlated to double as a connectivity signal; the
        // offline banner now relies on navigator.onLine alone until there is
        // a real fetch-based failure signal to feed it.
        if (base) {
          // Decide the placeholder's ELEMENT before rendering one. `closest`
          // starts at the <img>, which is never a match, so this is purely an
          // ancestor walk. <label> is in the list because a <button> inside a
          // label is labelable content that steals the label's own click.
          setNested(!!e.currentTarget.closest('a, button, label, [role="button"], [role="link"]'))
          setFailed(true)
        }
        onError?.(e)
      }}
    />
  )
}
