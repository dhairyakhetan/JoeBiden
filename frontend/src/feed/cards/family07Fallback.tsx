/* Family 07 · fallback: C25 compact rows, C29 caught up.
   What renders when nothing above qualifies. Family 07 always matches, so
   nothing falls through. C29 is TERMINAL and replaces the list rather than
   appending to it. */

import { useState } from 'react'
import { CheckIcon } from '@heroicons/react/24/outline'
import { CardShell, hueOrInk } from './parts'
import type { CardProps } from './types'

const ROW_CAP = 4

/**
 * C25 · compact rows - the most-rendered card in the product (15.11). Fires on
 * 576 of 586 posts (the author cap) and has been treated as a consolation
 * prize; it is the feed's primary reading experience and is designed like one
 * here: a real header, a category dot per row, and a "show more" pill rather
 * than a bare, capless list.
 *
 * It renders EITHER a bundle of rows (`display.rows`) or the single row the
 * chooser demoted, so the dispatcher can hand it one item without the caller
 * having to group first.
 */
export function CardCompact({ item }: CardProps) {
  const d = item.display
  const [expanded, setExpanded] = useState(false)
  const rows = d.rows ?? [{
    id: item.id,
    name: d.authorName ?? '',
    verb: d.title ?? d.body ?? '',
    time: d.timeLabel ?? '',
    avatar: d.authorAvatar,
    href: d.href,
  }]
  const hidden = !expanded && rows.length > ROW_CAP ? rows.length - ROW_CAP : 0
  const visible = hidden ? rows.slice(0, ROW_CAP) : rows

  // 15's Unresolved #5: the mock's header string ("also from aquaterra") was
  // invented and does not distinguish a same-author collapse from a
  // below-the-fold one, though the chooser does (05.7 has two rules). Rather
  // than guess which sentence is true for THIS group, d.kicker is an explicit
  // override the caller can set; short of that, this falls back to naming the
  // author when every row shares one (the common real case - rule 7 fires on
  // fourth-and-later from one author), or a neutral label otherwise. Still an
  // open question overall - see the PR report.
  const sameAuthor = rows.length > 0 && rows.every(r => r.name && r.name === rows[0].name)
  const headerLabel = d.kicker ?? (sameAuthor ? `more from ${rows[0].name}` : 'more activity')

  return (
    <CardShell className="aqc-compact" label={headerLabel}>
      <div className="aqc-compact-head">
        <span className="aqc-kicker aqc-grow">{headerLabel}</span>
        <span className="aqc-compact-count">{rows.length}</span>
      </div>
      {visible.map(r => {
        const inner = (
          <>
            <span className="aqc-compact-dot" aria-hidden="true" style={{ background: hueOrInk(d.category) }} />
            <span className="aqc-grow" style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {r.name ? <span className="aqc-compact-name">{r.name}</span> : null}
              <span className="aqc-compact-verb">{r.verb}</span>
            </span>
            {r.time ? <span className="aqc-compact-time">{r.time}</span> : null}
          </>
        )
        // Every row needs an href (15.11): a collapsed row that cannot be
        // opened is worse than a card. Rows without one (a caller gap, not
        // this component's to invent) degrade to plain text rather than a
        // dead link.
        return r.href
          ? <a key={r.id} className="aqc-compact-row" href={r.href}>{inner}</a>
          : <span key={r.id} className="aqc-compact-row">{inner}</span>
      })}
      {hidden > 0 ? (
        // Not infinite - the group is a group (15.11): capped at ROW_CAP
        // until the member explicitly asks for the rest.
        <button type="button" className="aqc-compact-more" onClick={() => setExpanded(true)}>
          Show {hidden} more
        </button>
      ) : null}
    </CardShell>
  )
}

/** C29 · nothing new. An empty feed is an ANSWER, not a failure (15.12): a
    cream well, a welfare tick disc, one sentence, centred. Terminal, so it
    replaces the list. */
export function CardCaughtUp({ item }: CardProps) {
  const d = item.display
  return (
    <CardShell label="You are all caught up">
      <div className="aqc-caughtup-well">
        <span className="aqc-caughtup-tick" aria-hidden="true">
          <CheckIcon width={26} height={26} strokeWidth={2.4} />
        </span>
        <h3 className="aqc-caughtup-line">{d.title ?? 'You are all caught up.'}</h3>
        {d.body ? <p className="aqc-caughtup-sentence">{d.body}</p> : null}
      </div>
      <a className="aqc-btn aqc-btn-primary" style={{ alignSelf: 'center' }} href={d.ctaHref ?? '/projects'}>
        {d.ctaLabel ?? 'See what is coming'}
      </a>
    </CardShell>
  )
}
