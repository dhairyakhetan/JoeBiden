/* Family 04 · editorial: C06 long read.
   The only family whose card SUPPRESSES ENGAGEMENT COUNTS ABOVE THE FOLD. A
   blog is not a status: it gets a rule, a read time, and no like count until
   the reader has had the chance to read it.

   RESTYLE 15-post-cards.md: C06 is 15.15's blocked shape reachable only from
   `blogs`, never `posts` - no numbered subsection of its own, so 15.15's
   generic instruction applies: match 15.2's shared chrome, then leave it
   unreachable. Built entirely on ./parts.tsx's CardPhoto/AuthorPill/
   CardShell/hueOrInk and ./cards.css's .aqc-* classes, which already carry
   this pass's token changes (--r-outer/--r-inner/--r-tight, --hair-2, the
   deleted hard ink border and offset shadow) with no per-file edit needed -
   that propagation is automatic, there is no separate per-shape stylesheet.
   Checked line by line against 15.2 (radii, image outline via CardPhoto,
   hue sourced only from lib/uiHelpers.CAT_COLORS, no `eager` hardcoded here
   since C06 - unlike C01's hero - is not guaranteed to land at position 0)
   and found nothing left to change. */

import { BookOpenIcon } from '@heroicons/react/24/outline'
import { AuthorPill, CardPhoto, CardShell, MetaRow, hueOrInk } from './parts'
import type { CardProps } from './types'

/**
 * C06 · long read, blog.
 *
 * NOTHING IN THE POSTS TABLE REACHES THIS SHAPE. Measured across all 586
 * published, undeleted rows: none exceeds 900 characters, so no post produces a
 * read time over 3 minutes. It is reachable only from the `blogs` table, which
 * the feed does not currently mix in. The component ships anyway, with its
 * predicate written down, so adding it later is a data question. See
 * CHANGELOG_SEC10_34.md.
 */
export function CardLongRead({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  return (
    <CardShell label={d.title ?? 'A long read'}>
      <div className="aqc-row">
        <span className="aqc-badge" style={{ background: hueOrInk(d.category ?? 'content') }}>
          <span className="aqc-badge-dot" aria-hidden="true" />
          {d.kicker ?? 'blog'}
        </span>
        <span className="aqc-pill">
          <BookOpenIcon width={12} height={12} strokeWidth={1.8} style={{ marginRight: 5 }} />
          {d.meta ?? 'read time'}
        </span>
      </div>
      <CardPhoto url={d.imageUrl} alt={d.imageAlt ?? ''} ctx="cover" ratio="16 / 9" />
      {/* A rule in the category hue, then the headline. The rule is what makes
          a blog read as editorial rather than as a photo post. */}
      <div style={{ display: 'flex', gap: 12 }}>
        <span className="aqc-rule" style={{ background: hueOrInk(d.category ?? 'content') }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {/* Guarded: a projection that maps `sourceType` but not
              `sourceTitle` routes a row here with no title, and an empty
              <h3> is a heading that announces nothing to a screen reader
              while leaving a gap in the layout. Rather than render one,
              this card shows the body alone - which /saved did for a while,
              and is how it was found. */}
          {d.title ? <h3 className="aqc-title aqc-title-lg">{d.title}</h3> : null}
          {d.body ? <p className="aqc-body">{d.body}</p> : null}
        </div>
      </div>
      <AuthorPill name={d.authorName} role={d.authorRole} avatar={d.authorAvatar} href={d.authorHref} time={d.timeLabel} onActivate={wiring.onOpenAuthor} />
      {/* This card used to end here, with the note "No meta row here,
          deliberately. This is the one card that hides its counts above the
          fold; the post page shows them."

          That was right while C06 was unreachable. Now that real blog rows
          route through it, hiding the row would mean a blog silently loses
          like, bookmark, comment and share - the exact capability loss the
          card contract (types.ts) forbids, and the reason C06 sat outside
          SHAPED_SHAPES in the first place. The owner authorised the change on
          2026-09-11; ACCEPTANCE.md §E records it.

          The editorial restraint is kept where it belongs: the counts still do
          not appear beside the headline, they sit in the footer with the
          actions, below the author. */}
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}
