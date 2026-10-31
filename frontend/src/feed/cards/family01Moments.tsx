/* Family 01 · moments: C15 birthday, C14 welcome, C16 break.
   Time-boxed and self-expiring. One per day at most, and they outrank content
   because tomorrow they are gone. */

import { useState } from 'react'
import { ArrowUpIcon, CakeIcon, MoonIcon, UserPlusIcon } from '@heroicons/react/24/outline'
import Img from '../../components/Img'
import { Sticker } from '../../components/Sticker'
import { checkText, BLOCK_MESSAGE } from '../../lib/profanityFilter'
import { AuthorPill, CardShell } from './parts'
import type { CardProps } from './types'

/** C15 · birthday. A one-day card. Loud, then gone, and IT NEVER SHOWS AN AGE:
    members.birthday_public is an opt-IN and an age is not what was opted into
    (15.4). `d.title` is rendered exactly as given - this card never derives or
    prints a year, so there is nothing here that could leak one. */
export function CardBirthday({ item }: CardProps) {
  const d = item.display
  return (
    <CardShell tone="plain" hero label={d.title ?? 'A birthday today'}>
      <div className="aqc-bday-panel">
        <span className="aqc-bday-avatar" aria-hidden="true">
          {d.authorAvatar
            ? <Img src={d.authorAvatar} alt="" ctx="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <CakeIcon width={26} height={26} strokeWidth={1.8} />}
        </span>
        <p className="aqc-bday-line">{d.title}</p>
        <div className="aqc-row" style={{ justifyContent: 'center' }}>
          {/* Both pills are radius --r-inner at 46px tall, not the usual
              --r-pill/44px every other action in this family uses (15.4) -
              inline overrides on top of the shared .aqc-btn device rather than
              a one-off class. */}
          <a
            className="aqc-btn aqc-btn-primary"
            style={{ borderRadius: 'var(--r-inner)', minHeight: 46 }}
            href={d.ctaHref ?? d.href}
          >
            {d.ctaLabel ?? 'Wish them'}
          </a>
          {d.secondaryLabel ? (
            <a
              className="aqc-btn"
              style={{ borderRadius: 'var(--r-inner)', minHeight: 46, background: 'rgba(10,10,10,.1)', border: 'none', color: 'var(--ink)' }}
              href={d.secondaryHref}
            >
              {d.secondaryLabel}
            </a>
          ) : null}
        </div>
      </div>
      {/* No engagement footer - a one-day announcement is not liked or saved. */}
    </CardShell>
  )
}

/** C14 · new member welcome. The one card that exists to be replied to. It
    asks for a greeting, not a like (15.5), so its primary action is an inline
    composer rather than a button, and it carries no meta row. */
export function CardWelcome({ item, onGreet }: CardProps) {
  const d = item.display
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit() {
    const body = text.trim()
    if (!body || busy) return
    setErr(null)
    setBusy(true)
    try {
      // KEEP the profanity gate on submit (15.5) - same contract FeedPostCard
      // already applies to comments: both severity tiers hard-block, there is
      // no moderation queue for comments to fall back into.
      if ((await checkText(body)).severity !== 'clean') {
        setErr(BLOCK_MESSAGE)
        return
      }
      onGreet?.(body)
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CardShell label={d.title ?? 'A new member joined'}>
      <div className="aqc-welcome-panel">
        <span className="aqc-welcome-avatar" aria-hidden="true">
          {d.authorAvatar
            ? <Img src={d.authorAvatar} alt="" ctx="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <UserPlusIcon width={22} height={22} strokeWidth={1.8} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <p className="aqc-welcome-name">{d.title}</p>
          {/* Full-opacity ink, never an alpha of it, on the welfare fill
              (README.md invariant 7) - 15.5's literal text names
              rgba(10,10,10,.7), which measures 3.28:1 on welfare and fails.
              Corrected here; see the PR report. */}
          {d.meta ? <span className="aqc-welcome-meta">{d.meta}</span> : null}
        </div>
      </div>
      {d.body ? <p className="aqc-body">{d.body}</p> : null}
      {/* The cream capsule from 03.5.2, borrowed early: that file has not
          landed yet (03 is later in the build order than 15), so this is a
          self-contained composer built to the same look (--r-pill, cream)
          rather than importing a shared component that does not exist. */}
      <div className="aqc-greet">
        <span className="aqc-greet-avatar" aria-hidden="true">
          <UserPlusIcon width={16} height={16} strokeWidth={1.8} />
        </span>
        <input
          className="aqc-greet-input"
          value={text}
          onChange={e => setText(e.target.value.slice(0, 300))}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
          placeholder={d.ctaLabel ?? 'Say hi'}
          disabled={busy}
          aria-label="Write a greeting"
          // KEEP 16px - suppresses iOS Safari's focus-zoom (15.5).
        />
        <button
          type="button"
          className="aqc-greet-send"
          onClick={submit}
          disabled={busy || !text.trim()}
          aria-label="Send greeting"
          title="Send greeting"
        >
          <ArrowUpIcon width={16} height={16} strokeWidth={2.4} />
        </button>
      </div>
      {err ? <p className="aqc-greet-error" role="alert">{err}</p> : null}
      <AuthorPill name={d.authorName} role={d.authorRole} avatar={d.authorAvatar} href={d.authorHref} />
      {/* No like button (15.5): a like is the way out of greeting. */}
    </CardShell>
  )
}

/** C16 · member on a break. Stops people wondering why someone went quiet.
    Deliberately calm, with NOTHING to action: no CTA, no counts framed as
    debts, and - decided 2026-09-05 - no break_reason, ever, on this card
    (15.6). The reason stays visible on the member's own profile and to their
    team lead; publishing a health fact to satisfy a layout is not a trade
    made here. This component only ever reads d.title/d.body, so it has no way
    to render break_reason even if a caller passed it. */
export function CardBreak({ item }: CardProps) {
  const d = item.display
  return (
    <CardShell label={d.title ?? 'A teammate is on a break'}>
      {/* The state flag overhangs the card's top edge - stickers.css's own
          usage table cross-references this exact pattern to this section
          (15.6). Purely decorative (no word): inventing new copy for it was
          not asked for, so it signals "something is different here" by shape
          and colour alone, ahead of the well below explaining what. */}
      <Sticker shape="flag" hue="grape" rotate={-3} size={92} className="aqc-break-flag" />
      {/* 30px is the FLOOR, not a target - a longer name or a wrapped line
          still needs it to clear the flag (15.6, measured in review). */}
      <div className="aqc-break-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="aqc-tint aqc-tint-grape" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MoonIcon width={20} height={20} strokeWidth={1.8} style={{ color: 'var(--grape-ink)', flexShrink: 0 }} />
          <span style={{ fontWeight: 800, fontSize: 13.5 }}>
            {/* The exact formatter is ProfilePage.tsx:383's:
                new Date(break_end + 'T00:00:00').toLocaleDateString('en-US',
                { month: 'long', day: 'numeric' }) - KEEP the 'T00:00:00', or
                the date shifts a day under timezone parsing. This component
                only renders the already-formatted sentence it is handed
                (d.title); it has no raw break_end field to format itself
                (CardDisplay carries none), so whichever file builds this
                FeedItem from `members` is the one that must use this exact
                formatter. Flagged in the PR report. */}
            {d.title}
          </span>
        </div>
        {d.body ? <p className="aqc-body" style={{ marginTop: 0 }}>{d.body}</p> : null}
      </div>
      {/* No actions at all (15.6): no like, no comment, no CTA. */}
    </CardShell>
  )
}
