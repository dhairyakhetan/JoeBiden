/* Family 00 · chrome: C08 pinned, C23 offline queued, C24 skeleton.
   Not posts at all. States of the surface, so they resolve before any content
   rule and never enter scoring. */

import { CloudArrowUpIcon, MapPinIcon } from '@heroicons/react/24/outline'
import { CardShell } from './parts'
import type { CardProps } from './types'

/** C08 · pinned notice. A pin outranks everything in the sort, so it must read
    as chrome rather than as a post. Ink ground is what does that (15.3). */
export function CardPinned({ item }: CardProps) {
  const d = item.display
  return (
    <CardShell tone="ink" label="Pinned notice">
      <span className="aqc-kicker">
        <MapPinIcon width={12} height={12} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 5, color: 'var(--lemon-ink)' }} />
        {d.kicker ?? 'pinned to notice board'}
      </span>
      {/* The nav-well token 15.3 names does not exist - tokens.css's own
          comment (00.2's ADD block) explicitly declines to add the
          segmented-bar "well" tokens, --nav-well included, as unused
          scaffolding. Reusing the same paper-on-ink 0.07 fill the roundup and
          countdown wells already use (cards.css) rather than inventing a new
          alpha for a token that was never added. See the PR report. */}
      <div style={{ borderRadius: 'var(--r-inner)', background: 'rgba(244,239,224,.07)', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 className="aqc-title" style={{ color: 'var(--nav-fg)' }}>{d.title}</h3>
        {d.body ? <p className="aqc-body" style={{ color: 'var(--nav-fg-dim)' }}>{d.body}</p> : null}
      </div>
      {/* 15.3 asks for ONE full-width action, not the primary/secondary pair
          most other shapes carry - a pin is a single announcement with a
          single way out. */}
      {d.ctaLabel ? (
        <a
          className="aqc-btn aqc-btn-primary"
          style={{ background: 'var(--lemon)', color: 'var(--ink)', width: '100%' }}
          href={d.ctaHref ?? d.href}
        >
          {d.ctaLabel}
        </a>
      ) : null}
      {/* No engagement footer (15.3): chrome is not liked. */}
    </CardShell>
  )
}

/** C23 · offline queued. A failure needs to look like a state, not an error
    (15.14): a lemon-tinted well, a mono "queued" label, the body as written,
    and a single Retry pill. The shape is ready; nothing in the app queues a
    post offline yet - restyled, not wired (15.14 is explicit that wiring an
    offline queue is a service change, out of this file's scope). */
export function CardOffline({ item }: CardProps) {
  const d = item.display
  return (
    <CardShell label="Post waiting to send">
      <div className="aqc-tint aqc-tint-lemon">
        <div className="aqc-row">
          <CloudArrowUpIcon width={16} height={16} strokeWidth={1.8} />
          <span className="aqc-kicker">{d.kicker ?? 'queued'}</span>
        </div>
        <p className="aqc-body" style={{ color: 'var(--ink)' }}>{d.body ?? 'Your post goes up as soon as you are back online.'}</p>
        <button type="button" className="aqc-btn aqc-btn-primary" style={{ alignSelf: 'flex-start' }}>
          {d.ctaLabel ?? 'Retry'}
        </button>
      </div>
    </CardShell>
  )
}

/** C24 · loading skeleton. The same geometry as a real card, so nothing
    reflows when the content arrives (15.13). On this dataset the shape that
    actually arrives is C07 or C25, never a photo card - so this mirrors C07's
    geometry (author row, category rule, title + body lines) instead of the
    aspect-ratio 4/3 photo block the previous skeleton drew. */
export function CardSkeleton(_props: CardProps) {
  return (
    <CardShell label="Loading">
      <div className="aqc-row" style={{ gap: 9 }}>
        <div className="aqc-skel aqc-skel--avatar" style={{ width: 34, height: 34 }} aria-hidden="true" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="aqc-skel" style={{ height: 11, width: 96 }} aria-hidden="true" />
          <div className="aqc-skel" style={{ height: 9, width: 60 }} aria-hidden="true" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="aqc-skel" style={{ width: 4, alignSelf: 'stretch', borderRadius: 999 }} aria-hidden="true" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="aqc-skel" style={{ height: 16, width: '70%' }} aria-hidden="true" />
          <div className="aqc-skel" style={{ height: 12, width: '95%' }} aria-hidden="true" />
          <div className="aqc-skel" style={{ height: 12, width: '80%' }} aria-hidden="true" />
        </div>
      </div>
      <div className="aqc-skel" style={{ height: 16, width: 140, marginTop: 2 }} aria-hidden="true" />
      <span className="sr-only">Loading the feed</span>
    </CardShell>
  )
}
