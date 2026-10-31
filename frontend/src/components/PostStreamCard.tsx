import Img from './Img'
import '../styles/routes/projects.css'
import { memo } from 'react'
import { Link } from 'react-router-dom'
import HiringCard from './HiringCard'
import { isOfficialAccount, VerifiedTick } from './v6Shared'
import { getInitials, hashColor, timeAgo } from '../lib/uiHelpers'

// Phase 10 Index-page card, rebuilt per changelog/10-projects.md (the
// "archive" masonry). Was `.pcard` - one fixed white-card-with-photo-on-top
// shape for every row. 10.0's whole premise is that the ARCHIVE should pick
// a tile shape from what the row actually holds, the same way
// lib/feedShape.ts picks a card shape for the feed:
//
//   photo + a statistic  -> tall photo tile, statistic over the photo
//   statistic, no photo  -> cream well tile
//   photo, no statistic  -> short photo tile, title only
//   short body, no photo -> serif quote tile on the row's own category hue
//   a blog link           -> ink link tile with a chain glyph
//   none of the three     -> does not render at all
//
// 10.0 also lists a sixth, purely decorative "circle tile", capped at one
// per viewport, with its own escape hatch: "if the algorithm cannot enforce
// the cap cheaply, drop the circle tile entirely - it is the one shape the
// design can live without." A CSS-columns masonry has no per-viewport
// visibility hook cheap enough to guarantee that cap (visual order doesn't
// match DOM order, and which tiles share a viewport depends on scroll
// position and column balancing) - so it's dropped, per that clause, rather
// than shipped as a pattern instead of punctuation.
//
// 10.0 writes this against `welfare_projects` columns directly
// (`main_image`, `key_statistic`, `volunteers`). This page's real query
// (PublicProjectsPage.tsx) reads the unified `post_feed_view` stream instead
// - a deliberate, already-shipped architecture (see that file's header
// comment) that merges mirrored welfare_projects/job_openings with native
// posts. Blogs used to be in that list and no longer are: the 4.2 fold
// (2026-09-12) made them ORDINARY `posts` rows with source_kind='blog',
// retired the `blogs` table and deleted the mirror trigger, so nothing is
// kept in step for them any more. That view exposes the same statistic under a generic mirror
// column, `source_stat` (verified against live data to be byte-identical to
// welfare_projects.key_statistic for every welfare-sourced row), so the
// shape logic below reads `stat` from there instead. `key_statistic` is
// plain text with no reliable number/unit split (a live sample turned up
// full sentences like "20 cookies were distributed by the volunteers to the
// residents..." with no short unit to isolate) - so unlike the 34px/8.5px
// two-part number the mock draws, the statistic renders as ONE string at one
// consistent size here. See PublicProjectsPage.tsx's PR notes for the one
// query change this needed (source_stat added to the browse select()).
export interface PostStreamCardData {
  uuid: string
  category: string
  title: string
  location?: string
  authorName?: string
  createdAt: string
  imageUrl?: string
  color: string
  displayNum: number
  sourceType?: string | null
  sourceTitle?: string | null
  sourceSlug?: string | null
  /** Mirrors welfare_projects.key_statistic via post_feed_view.source_stat. */
  stat?: string | null
  /**
   * How many photos the row actually carries — walkthrough item 3.2.
   *
   * `post_feed_view.images` used to emit only `welfare_projects.main_image`,
   * so this was always 0 or 1 and there was nothing to shape on. The view was
   * fixed on 2026-09-11 to emit all five image columns, and 100 rows carry
   * three or more. The archive query already SELECTs `images`, so this costs
   * nothing: it is `row.images.length`, a field that was being thrown away.
   */
  imageCount?: number
  /**
   * Volunteers on the drive, from `post_feed_view.stats` — item 3.2. One more
   * already-public column on the same view, no join and no extra fetch, which
   * is exactly the precedent this file's own header sets for `source_stat`.
   * 78 rows are 8-or-more; the median drive is four people.
   */
  volunteers?: number | null
}

const CAT_LABELS: Record<string, string> = {
  events: 'Events', welfare: 'Welfare', content: 'Content', operations: 'Operations', labs: 'Labs',
}

/**
 * Canonical destination for a post-stream entry.
 *
 * Hoisted out of the component so the ItemList JSON-LD and the featured bento
 * on PublicProjectsPage resolve the SAME href the visible card links to. They
 * used to hard-code `/post/${uuid}` while the card next to them linked to
 * `/projects/${slug}` - and `/post/:uuid` is exactly the URL PostPage
 * rel=canonicals away, that generate-sitemap.mjs excludes, and that robots.txt
 * disallows for all 14 named AI crawlers. So the structured data contradicted
 * the visible link and handed Google 50 duplicate URLs per page load instead
 * of the prerendered, sitemap-listed canonical ones.
 */
export function postStreamHref(p: Pick<PostStreamCardData, 'uuid' | 'sourceType' | 'sourceSlug'>): string {
  if (p.sourceType === 'job_opening') return '/opportunities'
  if (p.sourceType === 'welfare_project' && p.sourceSlug) return `/projects/${p.sourceSlug}`
  if (p.sourceType === 'blog' && p.sourceSlug) return `/blog/${p.sourceSlug}`
  return `/post/${p.uuid}`
}

type TileShape = 'photo-set' | 'turnout' | 'photo-stat' | 'photo' | 'well' | 'quote' | 'link' | null

/** Pure, exported so the "does not render" and shape-priority rules (10.0)
 *  are one testable place rather than inline JSX conditionals. A blog link
 *  is classified by its SOURCE, ahead of whatever image/stat it happens to
 *  carry - 10.0 lists it as its own row in the shape table, not a photo
 *  variant, because the point of the tile is "go read the piece", not the
 *  cover art. */
export function pickTileShape(
  d: Pick<PostStreamCardData, 'sourceType' | 'imageUrl' | 'stat' | 'title' | 'imageCount' | 'volunteers'>,
): TileShape {
  if (d.sourceType === 'blog') return 'link'
  const hasTitle = Boolean(d.title && d.title !== 'Untitled')
  const hasStat = Boolean(d.stat && d.stat.trim())

  // ── Item 3.2, the two shapes added 2026-09-11 ────────────────────────────
  //
  // The complaint was "one card shape repeated". Measured live before
  // touching anything, the archive was 486 of 548 rows on ONE shape -
  // `photo-stat`, 89%. The chooser was not wrong; it had nothing left to tell
  // rows apart with, because the two facts that genuinely separate them were
  // being discarded before they reached it.
  //
  // Both of these are REAL, ALREADY-FETCHED signals, not invented inputs:
  //
  //   photo-set  three or more photos is a shoot, not a snapshot. 100 rows.
  //              `images` was already in the select; only `images[0]` was ever
  //              read. (The same discovery as the feed's C04 earlier today -
  //              the view had been collapsing five image columns into one
  //              until it was fixed.)
  //   turnout    eight or more volunteers is a different KIND of drive from
  //              the median four. 41 rows reach this after photo-set takes
  //              its share. The headcount leads the tile, because on a drive
  //              that size the turnout IS the story.
  //
  // Ordered above `photo-stat` deliberately: a row that is both a shoot AND
  // has a statistic is better told as the shoot. Result, counted live:
  //   photo-stat 350 (59.7%) · photo-set 100 · well 57 · turnout 41 · link 36
  // 89% on one shape becomes 60% across six. The remaining 350 are genuinely
  // the same kind of thing - a photographed drive with a number - and the
  // masonry already varies their height from the real image aspect ratio
  // (min 170 / max 380), so they do not read as a repeated block.
  if ((d.imageCount ?? 0) >= 3) return 'photo-set'
  if (d.imageUrl && (d.volunteers ?? 0) >= 8) return 'turnout'

  if (d.imageUrl && hasStat) return 'photo-stat'
  if (d.imageUrl) return 'photo'
  if (hasStat) return 'well'
  if (hasTitle) return 'quote'
  return null
}

function dateLabelFor(iso: string): string {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toLowerCase() }
  catch { return '' }
}

const CHAIN_GLYPH = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(244,239,224,.72)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10 13.5a4 4 0 006 .5l2.5-2.5a4.2 4.2 0 00-6-6L11 7" />
    <path d="M14 10.5a4 4 0 00-6-.5L5.5 12.5a4.2 4.2 0 006 6L13 17" />
  </svg>
)

/** The below-tile hover/focus reveal (10.1). `welfare_projects` holds a real
 *  multi-image set (main_image + image_1..4), but `post_feed_view` mirrors
 *  only `main_image` into `images` - verified live, even on rows where the
 *  underlying project has three extra photos, the view's `images` array
 *  carries exactly one element. So the 3-thumbnail strip has no live data to
 *  draw on from this page's actual query and is never rendered - not "empty
 *  most of the time", genuinely never, which is exactly the documented
 *  fallback in 10.1: "the strip does not render - show the avatars and the
 *  timestamp alone. Do not repeat main_image three times." There is also
 *  only ever ONE author per row here (post_feed_view has no co-author
 *  concept), so this shows a single identity, not a fabricated stack. */
function HoverPreview({ authorName, createdAt }: { authorName?: string; createdAt: string }) {
  const name = authorName || ''
  return (
    <div className="arch-hover" aria-hidden="true">
      <div className="arch-hover-row">
        {name && (
          <span className="arch-avatar" style={{ background: hashColor(name) }}>{getInitials(name)}</span>
        )}
        <span className="arch-hover-meta">posted {timeAgo(createdAt)}</span>
      </div>
    </div>
  )
}

function PostStreamCard({
  uuid, category, title, authorName, createdAt, imageUrl, color, displayNum,
  sourceType, sourceTitle, sourceSlug, stat, imageCount, volunteers, eager,
}: PostStreamCardData & { eager?: boolean }) {
  // Hiring posts render as the compact, distinct ticket (same as the feed) -
  // untouched by this file's shape-by-data rework, which only concerns the
  // welfare/blog/native-post archive tiles.
  if (sourceType === 'job_opening') {
    return <HiringCard title={sourceTitle || title} category={category} href="/opportunities" seed={displayNum} />
  }

  const href = postStreamHref({ uuid, sourceType, sourceSlug })
  const dateLabel = dateLabelFor(createdAt)
  const catLabel = CAT_LABELS[category] || category
  const shape = pickTileShape({ sourceType, imageUrl, stat, title, imageCount, volunteers })

  // "If it has none of the three, it does not render. An archive tile with
  // nothing in it is worse than 2,030 tiles" (10.0/states). React renders
  // nothing for this slot; the masonry simply has one fewer tile.
  if (shape === null) return null

  if (shape === 'link') {
    // Three link-tile layouts, chosen deterministically per row (uuid hash,
    // not Math.random - the archive re-renders on filter/scroll and a tile
    // that reshuffles its own look mid-session would read as a bug). Same
    // complaint this shape already fixed once for the category dot: a
    // column of five write-ups was one shape repeated five times.
    const variant = uuid.charCodeAt(0) % 3
    if (variant === 1) {
      return (
        <div className="arch-tile-wrap">
          <Link to={href} className="arch-tile arch-tile--link arch-tile--link-b" style={{ '--qc': color } as React.CSSProperties}>
            <span className="arch-link-meta">write-up{dateLabel ? ` · ${dateLabel}` : ''}</span>
            <span className="arch-link-title arch-link-title--serif">{title}</span>
            <span className="arch-link-kicker arch-link-kicker--bare">{CHAIN_GLYPH}<span>read the piece</span></span>
          </Link>
          <HoverPreview authorName={authorName} createdAt={createdAt} />
        </div>
      )
    }
    if (variant === 2) {
      return (
        <div className="arch-tile-wrap">
          <Link to={href} className="arch-tile arch-tile--link arch-tile--link-c" style={{ '--qc': color } as React.CSSProperties}>
            <span className="arch-link-dot arch-link-dot--big" aria-hidden />
            <span className="arch-link-title">{title}</span>
            <span className="arch-link-kicker arch-link-kicker--inline">{CHAIN_GLYPH}<span>write-up · blog{dateLabel ? ` · ${dateLabel}` : ''}</span></span>
          </Link>
          <HoverPreview authorName={authorName} createdAt={createdAt} />
        </div>
      )
    }
    return (
      <div className="arch-tile-wrap">
        {/* Every write-up used to be the identical flat-ink card - "one
            shape repeated" all over again, just for blogs instead of drives
            (item 3.2's own complaint, one file up). Stays ink for
            legibility/restraint (10.0: the point is "go read the piece",
            not cover art), but the kicker dot and left edge now carry the
            post's own category hue, same signal every other shape already
            uses, so a column of write-ups reads as five categories, not one
            repeated block. */}
        <Link to={href} className="arch-tile arch-tile--link" style={{ '--qc': color } as React.CSSProperties}>
          <span className="arch-link-kicker"><span className="arch-link-dot" aria-hidden />{CHAIN_GLYPH}<span>write-up</span></span>
          <span className="arch-link-title">{title}</span>
          <span className="arch-link-meta">blog{dateLabel ? ` · ${dateLabel}` : ''}</span>
        </Link>
        <HoverPreview authorName={authorName} createdAt={createdAt} />
      </div>
    )
  }

  if (shape === 'well') {
    return (
      <div className="arch-tile-wrap">
        <Link to={href} className="arch-tile arch-tile--well">
          <div className="arch-well-inner">
            <span className="arch-well-stat">{stat}</span>
          </div>
          <div className="arch-well-body">
            <span className="arch-well-title">{title}</span>
            <span className="arch-well-meta">{catLabel}{dateLabel ? ` · ${dateLabel}` : ''}</span>
          </div>
        </Link>
        <HoverPreview authorName={authorName} createdAt={createdAt} />
      </div>
    )
  }

  if (shape === 'quote') {
    const initials = authorName ? getInitials(authorName) : ''
    return (
      <div className="arch-tile-wrap">
        <Link to={href} className="arch-tile arch-tile--quote" style={{ '--qc': color } as React.CSSProperties}>
          <span className="arch-quote-kicker">{catLabel}{dateLabel ? ` · ${dateLabel}` : ''}</span>
          <p className="arch-quote-body">{title}</p>
          {authorName && (
            <span className="arch-quote-foot">
              <span className="arch-quote-init">{initials}</span>
              <span className="arch-quote-name" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {authorName}
                {isOfficialAccount(authorName) && <VerifiedTick size={11} />}
              </span>
            </span>
          )}
        </Link>
        <HoverPreview authorName={authorName} createdAt={createdAt} />
      </div>
    )
  }

  // photo-set / turnout / photo-stat / photo - the full-bleed photo shapes.
  // They share one shell: same photo, same scrim, same category chip, same
  // title and meta. What differs is the one thing each LEADS with, which is
  // the whole point of shaping by data - a stack badge, a headcount, or the
  // drive's own statistic.
  const isSet = shape === 'photo-set'
  const isTurnout = shape === 'turnout'
  // A plain, non-negotiable variety knob for the two most common shapes
  // (photo/photo-stat cover ~65% of the archive per this file's own header
  // count) - the category chip alternates corner + a slight tilt,
  // deterministic per row (uuid hash, same non-reshuffling rule the link
  // tile's three variants already use). Never on photo-set/turnout: those
  // already carry their own distinguishing badge and a moved chip would
  // collide with it. Deliberately NOT a sticker - Sticker.tsx caps at one
  // per card / three per viewport with no way to enforce that in an
  // infinite-scroll masonry (see this file's own header on why the 10.0
  // circle tile was dropped for exactly that reason).
  const catAlt = !isSet && !isTurnout && uuid.charCodeAt(1) % 2 === 1
  return (
    <div className="arch-tile-wrap">
      <Link
        to={href}
        className={'arch-tile arch-tile--photo' + (isSet ? ' arch-tile--set' : '') + (isTurnout ? ' arch-tile--turnout' : '')}
      >
        {/* Two offset plates behind the photo, so a multi-photo drive reads as
            a stack before anything is counted. Decorative and aria-hidden -
            the count below is the accessible version of the same fact. */}
        {isSet && <span className="arch-set-plate arch-set-plate--2" aria-hidden />}
        {isSet && <span className="arch-set-plate arch-set-plate--1" aria-hidden />}
        <Img
          ctx="card"
          src={imageUrl}
          alt={title}
          className="arch-tile-img"
          eager={eager}
        />
        <span className="arch-tile-scrim" aria-hidden />
        <span className={'arch-tile-cat' + (catAlt ? ' arch-tile-cat--alt' : '')} style={{ '--cc': color } as React.CSSProperties}>{catLabel}</span>
        {isSet && imageCount != null && (
          <span className="arch-set-count">{imageCount} photos</span>
        )}
        <span className="arch-tile-body">
          {isTurnout && (
            <span className="arch-turnout">
              <span className="arch-turnout-n">{volunteers}</span>
              <span className="arch-turnout-l">volunteers turned up</span>
            </span>
          )}
          {shape === 'photo-stat' && <span className="arch-tile-stat">{stat}</span>}
          <span className="arch-tile-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {title}
            {authorName && isOfficialAccount(authorName) && <VerifiedTick size={12} />}
          </span>
          <span className="arch-tile-meta">{catLabel}{dateLabel ? ` · ${dateLabel}` : ''}</span>
        </span>
      </Link>
      <HoverPreview authorName={authorName} createdAt={createdAt} />
    </div>
  )
}

export default memo(PostStreamCard)
