/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION 10 step 7 · mounting the chooser on the live feed
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   `lib/feedShape.ts` has been able to pick a shape since it was written, and
   `feed/cards/**` has been able to render all thirty. Nothing ever handed the
   one to the other on a real row, so every post in the live feed rendered
   through the single `feed/FeedPostCard.tsx` regardless of its content. This
   file is the missing adapter: `Post` (services/api) in, `FeedItem` out.

   IT DECIDES NOTHING. Every discriminating field below is read straight off
   the row. Where the row has no answer the field is left UNSET rather than
   guessed, which is why `aspect` is absent (see below) - a shape that cannot
   fire on today's data must not be made to fire by inventing its input.

   ── what is deliberately absent, and why ──────────────────────────────────
   `aspect` (width / height of the single image) is required by rule 05.1 at
   >= 1.2 and there is NO width/height anywhere: not on `post_feed_view`, not
   on the `Post` type, not in `lib/imageUrl.ts`. Measuring it client-side
   would mean waiting for the image to decode before choosing a shape, i.e.
   reflowing the card after paint. So C01 does not fire. That is the data
   being honest, not the wiring being incomplete.

   `moment` / `ask` / `record` / `longRead` / `digest` / `terminal` are all
   families sourced from OTHER tables (members, job_openings,
   welfare_projects, blogs, aggregates). The home feed queries `posts`, and
   this task changes no query, so none of them is set here. `sourceType ===
   'job_opening'` is not turned into `ask: 'hiring'` for the same reason it
   never was: that row dispatches to `HiringCard`, a different component, and
   the dispatch belongs to the host (types.ts note 1).

   `belowFold` is AQRank's to set, and AQRank does not run on this feed (the
   order is plain recency - see feedShape.ts's own opening paragraph). Unset.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import type { Post } from '../services/api'
import type { CardShape, FeedItem } from '../lib/feedShape'
import { timeAgo, readMinutes } from '../lib/uiHelpers'

/** The first image on the row, normalised across the two shapes `Post.images`
    may carry: new posts ship a Supabase storage URL as `blobUrl`, legacy and
    sample rows a plain CDN URL as `url`. Same normalisation `FeedPostCard`
    already does at render time - not a new rule. */
export function firstImageUrl(post: Post): string | null {
  const first = post.images && post.images.length > 0 ? post.images[0] : null
  return (first?.blobUrl || first?.url) ?? null
}

/**
 * Every image on the row, same normalisation as `firstImageUrl`.
 *
 * Needed by C04, which renders a stack rather than a single photo. Added
 * 2026-09-11 when `post_feed_view` stopped collapsing a welfare drive's five
 * image columns down to `main_image` - before that this would always have
 * returned a one-item array.
 */
export function allImageUrls(post: Post): { url: string; alt: string }[] {
  if (!post.images || post.images.length === 0) return []
  const alt = `${post.authorName || 'AquaTerra'}'s ${post.category || ''} post photo · AquaTerra`.replace(/\s+/g, ' ')
  return post.images
    .map(i => (i?.blobUrl || i?.url) ?? null)
    .filter((u): u is string => !!u)
    .map(url => ({ url, alt }))
}

/**
 * The shapes the live feed is allowed to render, and the ONLY place that list
 * exists. Anything else falls back to `FeedPostCard` unchanged.
 *
 * This is the task's third constraint applied literally: a shape that cannot
 * carry a behaviour must not be selected for a row that needs it. Concretely,
 * and each one measured against `FeedPostCard`'s enumerated behaviour:
 *
 *   C03 / C05 / C07  IN. With `extras` (types.ts) plus this pass's additions
 *                    to parts.tsx they carry every one: the eager LCP image on
 *                    seed 0, the like / bookmark / comment / share row with
 *                    aria-pressed and the pop, the photo -> lightbox signal,
 *                    the author -> self-vs-public routing signal, the body ->
 *                    focus-modal signal, and the six host blocks.
 *   C25              IN, but only for rows that lose nothing by collapsing -
 *                    see `isGroupable`.
 *   C08 pinned       OUT. `CardPinned` renders no engagement footer at all
 *                    ("chrome is not liked", 15.3), so a pinned post routed
 *                    through it would silently lose like, bookmark, comment
 *                    and share. Pinned rows keep the live card, which also
 *                    keeps the pinned block's two bracketing headings and its
 *                    exactly-once guarantee untouched.
 *   C04              IN as of 2026-09-11. It was listed here as "unreachable,
 *                    0 rows with 2+ images", which was true of what reached
 *                    the app and false of the data: `post_feed_view` emitted
 *                    only `main_image` for a welfare drive and dropped
 *                    image_1..image_4. 100 projects carry three or more
 *                    photos. The view now emits them, so rule 05.2 fires.
 *                    CardCollection was brought up to the contract in the same
 *                    change (it now takes `extras` and wires onOpen /
 *                    onOpenAuthor); without that it would have been exactly
 *                    the silent capability loss this list exists to prevent.
 *   C06              IN as of 2026-09-11. 36 blog rows reach this feed through
 *                    `post_feed_view`, and a blog genuinely is a long read (34
 *                    of them are over 600 characters). It was OUT because
 *                    CardLongRead rendered no engagement row at all, so a blog
 *                    routed through it would have silently lost like, bookmark,
 *                    comment and share. The card now carries `extras` and a
 *                    MetaRow, on the owner's decision (ACCEPTANCE.md §E), so
 *                    the reason for excluding it is gone.
 *   C11              IN as of 2026-09-11, for ONE narrow case: a welfare drive
 *                    that carries figures but NO photo. Those rows have nothing
 *                    for a photo card to show, so family 05 sends them to C07 /
 *                    C05, which drop the figures entirely - the drive's only
 *                    real content. C11 leads with the figure, which is what
 *                    those rows actually are. Same contract fix as C06.
 *
 *                    Deliberately NOT every welfare row. Family 03 is evaluated
 *                    BEFORE family 05, so setting `record` on all 548 would
 *                    take every drive away from C03/C04 and collapse the feed
 *                    into a single shape again - the opposite of the point.
 *   C02              IN as of 2026-09-11. The prose here CLAIMED it was in from
 *                    the morning of that day, and the set below did not list
 *                    it - so every row the chooser sent to C02 fell straight
 *                    through to the legacy `FeedPostCard` layout and the design
 *                    never once appeared on the feed. That gap, not the
 *                    chooser, is why the live feed showed only three or four
 *                    distinct card designs. The card was correctly excluded
 *                    while it dropped `extras`; it takes them now, so it is in
 *                    for real this time.
 *   C01              IN as of 2026-09-11, as a HOST shape only. The chooser
 *                    still cannot reach it: rule 05.1 needs an image aspect
 *                    ratio and nothing stores width/height, so firing it from
 *                    content would mean measuring after decode and reflowing
 *                    the card after paint. `feedCompose.varyRuns` selects it
 *                    instead, at most once per page, when a photo post would
 *                    otherwise repeat a design already on screen. The 4/3
 *                    container crops rather than breaks, so aspect was only
 *                    ever load-bearing for the PICK, not the render.
 *   everything else  OUT. Those families are not sourced by this query.
 */
export const SHAPED_SHAPES: ReadonlySet<CardShape> = new Set<CardShape>(['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C11', 'C25'])

/**
 * Would collapsing this row into a C25 group throw away something the reader
 * can only get from a card? `CardCompact` renders a name, a verb and a time.
 * Anything richer than that is lost, so anything richer than that does not
 * group - it stays its own card and `composeFeed`'s `emitSolo` re-shapes it
 * to whatever its content actually is.
 *
 * This gates the HOST's choice, not the chooser's: `lib/feedShape.ts` is
 * untouched and rule 05.7 still fires exactly as written.
 */
export function isGroupable(post: Post): boolean {
  const p = post as Post & { documents?: unknown[]; stats?: unknown[] }
  if (post.pinned) return false
  if (post.sourceType) return false
  if (firstImageUrl(post)) return false
  if (p.stats && p.stats.length > 0) return false
  if (p.documents && p.documents.length > 0) return false
  if (post.taggedMembers && post.taggedMembers.length > 0) return false
  if (post.linkUrl) return false
  return true
}

/**
 * The adapter. `display` is what the card prints; the fields above it are what
 * the chooser reads.
 *
 * `display.title` is left UNSET on purpose. Every family-05 card calls
 * `splitPostBody(d.title ? ... : d.body)`, so leaving the title off routes the
 * whole body through the frozen `splitPostBody` helper, which splits on the
 * author's own blank line (583 of 586 bodies have one). Setting a title here
 * would mean re-deriving a headline with a second, different rule.
 */
/**
 * Roughly 200 words a minute, the usual reading-speed convention. Only used
 * for C06's "N min read" pill, never for a decision.
 *
 * FALLBACK ONLY. For a blog, `post.body` is the ~630-character feed excerpt the
 * posts_fill_article_excerpt trigger writes, not the article - so running this
 * over it returned 1 for all 36 live blog rows, including a 7,961-character
 * essay whose stored read time is 7. The real figure comes from
 * `post.sourceReadMinutes` (post_feed_view -> article->>'read_minutes').
 * This stays for a row that predates the stamp or has a malformed article.
 */
// readMinutes now lives in lib/uiHelpers.ts - see the import at the top.

export function feedItemFromPost(post: Post, profileHref: string): FeedItem {
  const image = firstImageUrl(post)
  const figures = (post.stats ?? [])
    .filter(f => f && f.label)
    .map(f => ({ value: f.value ?? null, label: f.label }))

  // A blog IS a long read - it is the one source in this feed written to be
  // sat down with. Read straight off `source_type`, not inferred from length.
  const isBlog = post.sourceType === 'blog'

  // A drive write-up with figures and NO photo: family 05 would send it to a
  // text or quote card, both of which drop the figures, and the figures are
  // the whole record. One narrow case, not every welfare row - see
  // SHAPED_SHAPES above for why that distinction matters.
  const isFigureOnlyDrive =
    post.sourceType === 'welfare_project' && !image && figures.length > 0

  // The excerpt the posts_fill_article_excerpt trigger writes begins with the
  // essay's own headline - true for all 36 live blog rows, with a newline after
  // it on 33 of them. C06 renders `title` in the large display face and then
  // `display.body` directly beneath, so every blog card in the feed printed its
  // headline twice in a row.
  //
  // Stripped here rather than in the card, so C07/C25 and anything else that
  // falls back to the plain `body` keeps the full excerpt.
  const rawBody = post.body || ''
  const title = post.sourceTitle || ''
  // `|| rawBody` was wrong here and put the bug straight back on three live
  // essays: "Welcome to Blogs!", "Pebbles and Peaks" and "Art of empathy
  // (noun)" have an excerpt that IS their title, so the slice returned '' and
  // the fallback restored the title - which C06 then printed under the
  // headline again. An empty result means "the excerpt was only the title",
  // and CardLongRead already guards with `{d.body ? ... : null}`, so no
  // paragraph is the right answer.
  //
  // The strip class is also narrow on purpose. It used to include `-`, which
  // ate a real leading dash: one essay's excerpt opens "- What if the next
  // time...", written that way by its author.
  const displayBody = isBlog && title && rawBody.startsWith(title)
    ? rawBody.slice(title.length).replace(/^[\s—:]+/, '')
    : rawBody

  return {
    id: post.uuid || String(post.postId),
    kind: 'post',
    authorId: post.authorId ?? null,
    pinned: !!post.pinned,
    featured: !!post.featured,
    category: post.category ?? null,
    body: post.body || '',
    imageCount: post.images ? post.images.length : 0,
    // aspect: absent by design - see the header.
    longRead: isBlog || undefined,
    record: isFigureOnlyDrive ? 'project_delivered' : undefined,
    display: {
      body: displayBody,
      imageUrl: image,
      // C04 renders a stack, so it needs them all. Every other shape reads
      // `imageUrl` and ignores this.
      imageUrls: allImageUrls(post),
      imageAlt: image
        ? `${post.authorName || 'AquaTerra'}'s ${post.category || ''} post photo · AquaTerra`.replace(/\s+/g, ' ')
        : undefined,
      authorName: post.authorName,
      authorRole: (post as Post & { authorSchool?: string }).authorSchool,
      authorAvatar: post.authorAvatar ?? null,
      authorHref: profileHref,
      timeLabel: timeAgo(post.createdAt),
      category: post.category ?? null,
      likeCount: post.likeCount ?? 0,
      commentCount: post.commentCount ?? 0,
      href: post.uuid ? `/post/${post.uuid}` : undefined,
      // Only the two shapes below read these. Every other card ignores them,
      // so setting them unconditionally costs nothing and keeps the adapter
      // free of per-shape branching.
      title: isBlog || isFigureOnlyDrive ? (post.sourceTitle ?? undefined) : undefined,
      kicker: isBlog ? 'blog' : isFigureOnlyDrive ? 'delivered' : undefined,
      meta: isBlog
        ? `${post.sourceReadMinutes ?? readMinutes(post.body || '')} min read`
        : undefined,
      figures: figures.length > 0 ? figures : undefined,
    },
  }
}
