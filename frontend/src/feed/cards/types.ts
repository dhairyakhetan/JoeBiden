import type { ReactNode } from 'react'
import type { FeedItem } from '../../lib/feedShape'

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   The host contract
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   `CardProps` used to be `{ item, onLike, onComment, onSave, onShare, liked,
   saved, onGreet }`. That is enough for a catalogue specimen and NOT enough to
   replace `feed/FeedPostCard.tsx`: swapping these components into the live
   feed on the old props would have silently dropped the job-opening branch,
   the welfare source rail, stats, attachments, tagged members, the lightbox,
   the share sheet, edit/delete, the comment composer, and three ACCEPTANCE §C
   protected behaviours. A dropped capability that still compiles is exactly
   the failure this file now exists to prevent.

   So the props below are a deliberate SUPERSET of FeedPostCard's public
   behaviour, enumerated from the component itself. Everything is optional, so
   all 30 existing cards and the catalogue (which passes none of it) compile
   unchanged.

   ── the division of labour, unchanged ─────────────────────────────────────
   A CARD NEVER FETCHES. Every field here is resolved by the host and handed
   down, the same rule `useFeedCardBatch` exists to enforce (15.2, ACCEPTANCE
   §C). There is no field on this interface that a card could satisfy by
   calling Supabase, and that is on purpose.

   ── what still cannot be expressed here, stated rather than hidden ────────
   1. `sourceType === 'job_opening'` renders `HiringCard`, a DIFFERENT
      component, not a variant of a card. That is a dispatch decision, and the
      dispatcher (`FeedCard.tsx`) is where it belongs - `hiring` below carries
      the data, but the branch itself is the host's.
   2. `PostFocusModal`, `ShareModal` and `ImageLightbox` are always-mounted
      siblings of the card, not children of it (ACCEPTANCE §C pins
      PostFocusModal's always-mounted `isOpen` pattern). The props here are
      the OPEN signals; the host owns the mounting. A card that mounted its
      own modal would break that pattern once per card in the list.
   3. The profanity gate (`checkText` / `BLOCK_MESSAGE`) fires on submit inside
      the host's handler, not in the card. `onGreet`/`onComment` hand the text
      up; the gate stays in one place.
   4. Per-row category hue inside a C25 group needs a field on
      `CardDisplay.rows`, which lives in `lib/feedShape.ts` and is frozen.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** A stat pill, as `post_feed_view.stats` already ships them. */
export interface CardStat { value: string; label: string }

/** A document attached to the post. The card shows a count; the focus modal
    owns the list and the download links. */
export interface CardAttachment { id: string; name: string; href?: string }

/** A tagged member, resolved by the host to a name and a profile route. */
export interface CardTaggedMember { id: string; name: string; href: string; avatar?: string | null }

/** The welfare-project rail: a mirrored project's own write-up. Whether the
    stat was already promoted into `stats` is the host's dedupe call, because
    only the host can see both. */
export interface CardSource {
  type: 'welfare_project' | 'job_opening' | 'blog' | 'other'
  title?: string | null
  summary?: string | null
  stat?: string | null
  href?: string | null
}

/** An external link preview. `href` must already be through `safeExternalHref`
    - a card never sanitises a URL it was handed. */
export interface CardLink { href: string; title: string; host: string }

/** The linked job opening, batched by `useFeedCardBatch`. `null` = resolved and
    there is none; `undefined` = the host did not resolve it. The two are not
    the same and the closed-role notice depends on the difference. */
export interface CardOpeningRef { status: string; commitment?: string | null; deadline?: string | null }

/** Which controls are mid-write. Per-control, so one action does not disable
    its siblings (ACCEPTANCE §B). */
export interface CardBusy {
  like?: boolean
  save?: boolean
  comment?: boolean
  greet?: boolean
}

export interface CardProps {
  item: FeedItem

  // ── position ──────────────────────────────────────────────────────────────
  /**
   * Index in the list. `seed === 0` is the feed's LCP element, so its photo
   * loads `eager` and every other card's is `lazy` (ACCEPTANCE §C). A card
   * cannot know this about itself.
   */
  seed?: number
  /**
   * Whether THIS list is allowed to claim the eager LCP slot at all.
   *
   * `seed === 0` means "first in this list", not "first on the page". A post
   * page's "more from this author" rail, /saved, a profile's post grid and a
   * team's About tab each mint their own seed 0, and all of them are below the
   * fold - so each was requesting a photo with `fetchpriority="high"` and
   * `decoding="sync"`, competing with the real LCP image for bandwidth.
   *
   * Only a host that knows its first card is the page's LCP element sets this
   * (HomePage does). Absent, the card still renders the photo - just lazily.
   */
  allowEager?: boolean
  /**
   * Off-screen, from the host's IntersectionObserver. Drives the
   * `aq-animations-paused` class - one observer in the list, not one per card.
   */
  visible?: boolean

  // ── engagement ────────────────────────────────────────────────────────────
  onLike?: () => void
  onComment?: () => void
  onSave?: () => void
  onShare?: () => void
  liked?: boolean
  saved?: boolean
  /**
   * Live counts. Optimistic flips live in the host so the toast can fire AFTER
   * the write resolves, which is the documented bookmark ordering fix
   * (ACCEPTANCE §C) and cannot be preserved if a card owns the state.
   */
  likeCount?: number
  commentCount?: number
  busy?: CardBusy
  /** The bookmark's 400ms pop, owned by the host so the animation and the
      toast-after-write stay on one clock. */
  savePop?: boolean

  // ── opening things ────────────────────────────────────────────────────────
  /** The card body / title was activated. The host opens `PostFocusModal`. */
  onOpen?: () => void
  /** A photo was activated. The host opens the always-mounted `ImageLightbox`. */
  onOpenImage?: (src: string) => void
  /** The author identity was activated. The host owns the
      `member?.uuid === authorUuid` self-vs-public profile branch. */
  onOpenAuthor?: () => void
  /** The attachment chip was activated (it opens the focus modal). */
  onOpenAttachments?: () => void

  // ── authoring ─────────────────────────────────────────────────────────────
  /** Present only when the viewer may edit / delete this row. Absence is the
      permission answer; a card never asks who the viewer is. */
  onEdit?: () => void
  onDelete?: () => void

  /**
   * C14 only (15.5): the new-member-welcome card's primary action is an
   * inline composer, not a button ("it asks for a greeting, not a like"), so
   * it needs the typed text at submit time rather than a no-arg signal. The
   * profanity gate runs in the host's handler, on submit.
   */
  onGreet?: (text: string) => void

  // ── content the host resolved ─────────────────────────────────────────────
  stats?: CardStat[]
  attachments?: CardAttachment[]
  tagged?: CardTaggedMember[]
  source?: CardSource
  link?: CardLink
  /** Batched by the host. `null` means "resolved, none". */
  opening?: CardOpeningRef | null
  /** Job-opening data for the dispatcher's `HiringCard` branch (note 1 above). */
  hiring?: { title: string; category?: string | null; meta?: string; href: string }

  /**
   * ── the escape hatch the live wiring needed (2026-09-07) ──────────────────
   * `FeedPostCard` renders six blocks between the body and the meta row that
   * have no shape-level equivalent and no business becoming one: the
   * closed-role notice, the welfare `sourceSummary`/`sourceStat` rail (with
   * its dedupe, which only the host can compute), the `stats` pills, the
   * `linkUrl` CTA and the documents chip. Every one of them is host-resolved
   * and already styled by `styles/routes/feed.css`.
   *
   * Rebuilding them as six more optional `CardProps` fields would have meant
   * six new renderers per shape and six new chances to drop one silently -
   * exactly the regression `types.ts` exists to prevent. So the host composes
   * them once, as it already does, and hands the node down. A shape that
   * accepts `extras` renders it verbatim, immediately before its meta row; a
   * shape that does not accept it must not be chosen for a row that has any
   * (see `feed/feedItemFromPost.ts`, `SHAPED_SHAPES`).
   *
   * This is NOT a general slot for arbitrary card content. Nothing but the
   * host's own enumerated blocks goes through it.
   */
  extras?: ReactNode
}
