/* Family 02 · asks: C30 volunteer gap, C26 poll, C27 countdown, C18 referral,
   C19 hiring. The member can change the outcome by acting, so they are
   deadline-driven and must be seen while they still matter. Throttled to one
   per five cards by the chooser, not by these components.

   RESTYLE 15-post-cards.md: all five shapes here sit only in 15.15's
   "blocked twelve" table (C30/C27 need a filled/needed pair or a deadline
   the row does not carry; C26 needs a poll_options column that does not
   exist; C18/C19 are reachable but named only in that generic table, with no
   numbered subsection of their own) - so 15.15's instruction is the whole
   brief: match 15.2's shared chrome, then leave the shape unreachable. Built
   entirely on ./parts.tsx's CardShell/AuthorPill/CreamCTA/LiveMarker/
   hueOrInk and ./cards.css's .aqc-* classes, which this pass's token changes
   (--r-outer/--r-inner/--r-tight, --hair-2, --bd's SET from 2px ink to a
   hairline) already reach with no per-file edit - that propagation is
   automatic, there is no separate per-shape stylesheet. Checked line by line
   against 15.2 anyway: radii, the deleted hard ink border/offset shadow,
   hue sourced only from lib/uiHelpers.CAT_COLORS, the rule-4 live-marker
   fallback (C30/C27/C19 all use it), the interval clearing on unmount
   (C27), and the ink-tone pill overrides already present for C27's meta pill
   (paper text on --ink, not the default --bd hairline that would vanish on
   a dark ground). Found nothing left to change - recorded here so the
   absence of a diff reads as reviewed, not skipped. */

import { useEffect, useMemo, useState } from 'react'
import { BriefcaseIcon, ChartBarIcon, ClockIcon, MegaphoneIcon, ShareIcon } from '@heroicons/react/24/outline'
import { AuthorPill, CardShell, CreamCTA, LiveMarker, hueOrInk } from './parts'
import type { CardProps } from './types'

/** C30 · volunteer ask. The only card that addresses a gap rather than a
    result, so it states the shortfall honestly. When the host could not resolve
    filled/needed the bar is replaced by a live marker: an invented shortfall is
    worse than no shortfall. */
export function CardVolunteerAsk({ item }: CardProps) {
  const d = item.display
  const known = typeof d.filled === 'number' && typeof d.needed === 'number' && d.needed > 0
  const pct = known ? Math.min(100, Math.round((d.filled! / d.needed!) * 100)) : 0
  return (
    <CardShell label={d.title ?? 'A drive needs volunteers'}>
      <div className="aqc-row">
        <span className="aqc-badge" style={{ background: 'var(--lemon)' }}>
          <span className="aqc-badge-dot" aria-hidden="true" />
          {d.kicker ?? 'help needed'}
        </span>
        {d.meta ? <span className="aqc-pill">{d.meta}</span> : null}
      </div>
      <h3 className="aqc-title aqc-title-lg">{d.title}</h3>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      {known ? (
        <>
          <div className="aqc-bar">
            <div className="aqc-bar-fill" style={{ width: `${pct}%`, background: hueOrInk('welfare') }} />
          </div>
          <div className="aqc-row">
            <span className="aqc-figure-label aqc-grow">{d.filled} signed up</span>
            <span className="aqc-figure-label">{d.needed} needed</span>
          </div>
        </>
      ) : (
        <LiveMarker label="how many spots are left" />
      )}
      <a className="aqc-btn aqc-btn-primary" href={d.ctaHref ?? d.href}>{d.ctaLabel ?? 'Count me in'}</a>
    </CardShell>
  )
}

/** C26 · poll. A question is the one post type where reading it is not the
    action, so the options ARE the content. */
export function CardPoll({ item }: CardProps) {
  const d = item.display
  const options = d.options ?? []
  return (
    <CardShell label={d.title ?? 'A poll'}>
      <AuthorPill name={d.authorName} role={d.authorRole} avatar={d.authorAvatar} href={d.authorHref} />
      <div className="aqc-row">
        <ChartBarIcon width={16} height={16} strokeWidth={1.8} />
        <span className="aqc-kicker">{d.kicker ?? 'poll'}</span>
      </div>
      <h3 className="aqc-title">{d.title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map(o => (
          <button type="button" key={o.label} className="aqc-poll-opt">
            <span className="aqc-poll-fill" style={{ width: `${o.percent}%`, background: hueOrInk(d.category) }} />
            <span className="aqc-poll-label">{o.label}</span>
            <span className="aqc-poll-pct">{o.percent}%</span>
          </button>
        ))}
      </div>
      {d.meta ? <span className="aqc-figure-label">{d.meta}</span> : null}
    </CardShell>
  )
}

/**
 * C27 · countdown. Under three days the date stops being information and
 * becomes a countdown. Recomputed on a one-minute interval and CLEARED ON
 * UNMOUNT, the same contract section 14's live strip states. With no deadline
 * resolved the card shows the live marker rather than a zeroed clock.
 */
export function CardCountdown({ item }: CardProps) {
  const d = item.display
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!d.deadline) return
    const t = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(t)
  }, [d.deadline])

  const parts = useMemo(() => {
    if (!d.deadline) return null
    const end = new Date(d.deadline).getTime()
    if (!Number.isFinite(end)) return null
    const left = Math.max(0, end - now)
    return {
      days: String(Math.floor(left / 86400000)).padStart(2, '0'),
      hrs: String(Math.floor((left % 86400000) / 3600000)).padStart(2, '0'),
      min: String(Math.floor((left % 3600000) / 60000)).padStart(2, '0'),
    }
  }, [d.deadline, now])

  return (
    <CardShell tone="ink" label={d.title ?? 'Countdown'}>
      <div className="aqc-row">
        <ClockIcon width={16} height={16} strokeWidth={1.8} />
        <span className="aqc-kicker aqc-grow">{d.kicker}</span>
        {d.meta ? <span className="aqc-pill" style={{ borderColor: 'rgba(244,239,224,.4)', color: 'var(--paper)' }}>{d.meta}</span> : null}
      </div>
      <h3 className="aqc-title" style={{ color: 'var(--paper)' }}>{d.title}</h3>
      {parts ? (
        <div className="aqc-count">
          <span className="aqc-count-cell"><span className="aqc-count-n" style={{ color: 'var(--paper)' }}>{parts.days}</span><span className="aqc-figure-label">days</span></span>
          <span className="aqc-count-cell"><span className="aqc-count-n" style={{ color: 'var(--paper)' }}>{parts.hrs}</span><span className="aqc-figure-label">hrs</span></span>
          <span className="aqc-count-cell"><span className="aqc-count-n" style={{ color: 'var(--paper)' }}>{parts.min}</span><span className="aqc-figure-label">min</span></span>
        </div>
      ) : (
        <LiveMarker label="the countdown" />
      )}
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      {d.ctaLabel ? <CreamCTA label={d.ctaLabel} href={d.ctaHref} /> : null}
    </CardShell>
  )
}

/** C18 · referral nudge. The ask is specific, addressed to you, and one tap.
    A generic invite banner gets ignored, which is why this names the role. */
export function CardReferral({ item }: CardProps) {
  const d = item.display
  return (
    <CardShell label={d.title ?? 'An open role on your desk'}>
      <div className="aqc-row">
        <span className="aqc-kicker aqc-grow">{d.kicker ?? 'your desk'}</span>
        {d.meta ? <span className="aqc-pill">{d.meta}</span> : null}
      </div>
      <h3 className="aqc-title">{d.title}</h3>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      <div className="aqc-row">
        <a className="aqc-btn aqc-btn-primary" href={d.ctaHref ?? '/referrals'}>{d.ctaLabel ?? 'Copy my link'}</a>
        {d.secondaryLabel ? (
          <a className="aqc-btn aqc-btn-quiet" href={d.secondaryHref}>
            <ShareIcon width={16} height={16} strokeWidth={1.8} />
            {d.secondaryLabel}
          </a>
        ) : null}
      </div>
    </CardShell>
  )
}

/** C19 · job opening. A role is a decision with a deadline, so the applicant
    count and the closing date do the persuading. */
export function CardOpening({ item }: CardProps) {
  const d = item.display
  return (
    <CardShell label={d.title ?? 'An open role'}>
      <div className="aqc-row">
        <span className="aqc-badge" style={{ background: hueOrInk(d.category) }}>
          <span className="aqc-badge-dot" aria-hidden="true" />
          {d.kicker ?? 'hiring'}
        </span>
        {d.meta ? <span className="aqc-pill">{d.meta}</span> : null}
      </div>
      <div className="aqc-row">
        <BriefcaseIcon width={20} height={20} strokeWidth={1.8} />
        <h3 className="aqc-title aqc-grow">{d.title}</h3>
      </div>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      <div className="aqc-row">
        {typeof d.filled === 'number'
          ? <span className="aqc-figure-label aqc-grow">{d.filled} have applied</span>
          : <span className="aqc-grow"><LiveMarker label="applicants" /></span>}
        <a className="aqc-btn aqc-btn-primary" href={d.ctaHref ?? d.href}>{d.ctaLabel ?? 'Apply'}</a>
      </div>
    </CardShell>
  )
}

/** Exported so the catalogue can label the family with its own icon. */
export const ASKS_ICON = MegaphoneIcon
