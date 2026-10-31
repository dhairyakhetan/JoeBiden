/* Family 05 · posts: C01 hero, C02 colour block, C03 standard, C04 collection,
   C05 quote, C07 text.
   Free-form member posts. THE ONLY FAMILY WHERE SHAPE FOLLOWS CONTENT SHAPE,
   which is why it is the only one with a tie-break. The tie-break lives in
   lib/feedShape.chooseCardShape; these components render, they never choose. */

import { AuthorPill, BadgeDot, CardPhoto, CardShell, CreamCTA, MetaRow, PhotoStack, Seal, hueOrInk } from './parts'
import { splitPostBody } from '../../lib/feedShape'
// The headline guard. splitPostBody() alone trusts the author's first blank
// line completely, so a post whose opening paragraph IS the paragraph renders
// as a headline: one live row put 416 characters into `.aqc-title` at weight
// 900, seventeen lines tall on a phone. Measured across all 584 published
// bodies, 577 first blocks are 60 characters or fewer and none sit between 91
// and 200, so HEADLINE_LIMIT (120) separates every real headline from that one
// runaway with room to spare. Infinity keeps the remainder whole: CardStandard
// and CardStack print `rest` with no clamp, so the 300-char snippet cap that
// suits `.feed-card` would silently drop the end of a real post here.
import { derivePostHeadline } from '../postHeadline'
import { layoutVariant } from './layoutVariant'
import type { CardProps } from './types'

/** C01 · full-bleed hero. One post per session earns the loudest shape, so the
    type sits on the photo and the image carries it.

    UNBLOCKED 2026-09-11 (second pass). The chooser still cannot pick this -
    rule 05.1 wants an image ASPECT RATIO and nothing in the corpus stores
    width/height, which is a real limit, not an oversight. What changed is that
    the shape no longer has to come from the chooser: `feedCompose.varyRuns`
    rotates a repeated photo post onto it as a HOST decision, and the host has
    the one fact rule 05.1 was using aspect to approximate - whether this card
    has already spent the loudest shape on the page. The 4/3 container plus
    `object-fit: cover` means a portrait source crops rather than breaking the
    layout, so aspect was never load-bearing for the RENDER, only for the pick.

    Contract fix in the same pass, for the same reason C04 and C06 got one: a
    shape the host may select for a live row must carry the live row's
    behaviour or it silently drops it. So it takes `extras`, splits its own body
    (the live feed leaves `title` unset on purpose - feedItemFromPost.ts), and
    wires onOpen / onOpenAuthor / onOpenImage like the rest of family 05. */
export function CardHero({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  const { headline: title, rest } = derivePostHeadline(d.title ? `${d.title}\n\n${d.body ?? ''}` : d.body, Infinity)
  return (
    <CardShell tone="plain" hero label={title || d.title || 'Featured post'} onActivate={wiring.onOpen}>
      <div style={{ position: 'relative', border: 'var(--hair-2)', borderRadius: 'var(--r-outer)', overflow: 'hidden', background: 'var(--ink)' }}>
        <CardPhoto url={d.imageUrl} alt={d.imageAlt ?? ''} ctx="cover" ratio="4 / 3" eager={!!wiring.allowEager && wiring.seed === 0} onActivate={wiring.onOpenImage} />
        <BadgeDot category={d.category} />
        {/* The scrim starts at 40% rather than 55% because the live bodies are
            two lines more often than the specimen's one, and a headline that
            begins above the gradient's own start sits on bare photo. */}
        <div style={{ position: 'absolute', inset: 'auto 0 0 0', padding: 16, background: 'linear-gradient(180deg, rgba(10,10,10,0) 0%, rgba(10,10,10,.55) 40%, rgba(10,10,10,.88) 100%)' }}>
          <h3 className="aqc-title aqc-title-lg" style={{ color: 'var(--paper)' }}>{title || d.title}</h3>
          {rest ? <p className="aqc-body aqc-clamp-2" style={{ color: 'var(--nav-fg-dim)', marginTop: 8 }}>{rest}</p> : null}
        </div>
      </div>
      {/* Direct children of the shell, not wrapped. The wrapper this replaces
          re-declared the shell's own `gap: 10` and added `marginTop: 10` on
          top of it; measured in the browser it also pushed the meta row 9px
          past the card's bottom edge, which is the exact class of overflow
          this file has been bitten by before. Same three children, same 10px
          rhythm, one fewer box. */}
      <AuthorPill name={d.authorName} role={d.authorRole} avatar={d.authorAvatar} href={d.authorHref} time={d.timeLabel} onActivate={wiring.onOpenAuthor} />
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C02 · photo + colour block. The reference split: photo up top, type on a
    solid category ground, scannable by colour alone. Mono labels on that
    ground are solid ink, which the shared `.aqc-badge` rule already enforces.

    UNBLOCKED 2026-09-11 (second pass). `feedItemFromPost.ts` already claimed
    this shape was "IN as of 2026-09-11" in prose, but `SHAPED_SHAPES` never
    actually listed it - so every row the chooser sent here fell through to the
    legacy `FeedPostCard` layout and the design simply never appeared on the
    feed. That was the real cause of "I only see 3-4 card designs": the shape
    was being CHOSEN and then thrown away at the dispatcher.

    It was correctly excluded, though, because it dropped `extras` - the six
    host blocks (welfare rail, stat pills, link CTA, documents chip). Fixed
    here rather than by widening the set around a broken card.

    `hueOrInk` falls back to the ink, and `.aqc-block` paints its type ink too,
    so an UNMAPPED category would render ink on ink. The chooser's rule 05.3
    guards that with "mapped category hue"; the host rotation in
    `feedCompose.varyRuns` carries the same guard for the same reason. */
export function CardColourBlock({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  const { headline: title, rest } = derivePostHeadline(d.title ? `${d.title}\n\n${d.body ?? ''}` : d.body, Infinity)
  return (
    <CardShell label={title || 'Post'} onActivate={wiring.onOpen}>
      <div style={{ position: 'relative' }}>
        <CardPhoto url={d.imageUrl} alt={d.imageAlt ?? ''} ctx="card" eager={!!wiring.allowEager && wiring.seed === 0} onActivate={wiring.onOpenImage} />
        <BadgeDot category={d.category} />
      </div>
      <div className="aqc-block" style={{ background: hueOrInk(d.category) }}>
        <h3 className="aqc-title">{title}</h3>
        {rest ? <p className="aqc-body" style={{ color: 'var(--ink)' }}>{rest}</p> : null}
        {d.ctaLabel ? <CreamCTA label={d.ctaLabel} href={d.ctaHref ?? d.href} /> : null}
      </div>
      <AuthorPill name={d.authorName} role={d.authorRole} avatar={d.authorAvatar} href={d.authorHref} time={d.timeLabel} onActivate={wiring.onOpenAuthor} />
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C03 · standard photo post. The workhorse. White ground, inset photo, quiet
    meta. Nothing competes with it. Blocked: needs imageCount >= 1 (15.15).

    THREE LAYOUTS, ONE SHAPE (2026-09-18). Measured across all 584 published
    posts, C03 and C02 are 69% of the feed and C02's two caps demote most of
    its share here as well - so this card IS the feed, and one layout for it
    reads as a wall. `varyRuns` cannot help: its ring for C03 is C02/C01/C04
    and a typical row fails `canRender` for all three.

    So the variety lives inside the shape rather than in the chooser. Which
    shape a post gets is already right; what was missing was variety within it.
    That also leaves lib/feedShape.ts untouched, which ACCEPTANCE §E requires.

    The variant is a pure function of the post's own uuid, so the same post is
    the same card for every viewer, on every device, tomorrow as well as today.
    See layoutVariant.ts for why that is a hash and not a counter.

    Variant 0 is the original card, byte-for-byte in structure. The common case
    is therefore unchanged and the risk is confined to the two new ones. */
export function CardStandard({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  const { headline: title, rest } = derivePostHeadline(d.title ? `${d.title}\n\n${d.body ?? ''}` : d.body, Infinity)
  /* Variants 1 and 2 keep exactly the posts they always had. Only the posts that used to get the plain card (variant 0)
     are re-drawn, by a second hash with its own salt, among the plain card and three newer layouts (2026-10-20):
       3 ROW   a compact thumbnail beside the words, at every width: the dense card that breaks up a run of big photos
       4 WIDE  a 16:9 banner crop, the cinematic one
       5 RAIL  the plain order with a category-hue rail down the words, the rounded-minimal accent
     Same post, same layout for everyone, as before: both draws are pure functions of the post's id. */
  const base = layoutVariant(item.id, 3)
  const v = base === 0 ? ([0, 3, 4, 5] as const)[layoutVariant(item.id, 4, 'standard-b')] : base

  {/* seed 0 is the feed's LCP element and the ONLY eager image in the list
      (ACCEPTANCE 1C). A card cannot know this about itself, so it reads the
      host's `seed` rather than deciding for itself. Hoisted so all three
      layouts share one definition of it. */}
  const photo = (
    <div style={{ position: 'relative' }}>
      <CardPhoto
        url={d.imageUrl}
        alt={d.imageAlt ?? ''}
        ctx="card"
        ratio={v === 1 || v === 3 ? '1 / 1' : v === 4 ? '16 / 9' : '4 / 3'}
        eager={!!wiring.allowEager && wiring.seed === 0}
        onActivate={wiring.onOpenImage}
      />
      <BadgeDot category={d.category} />
    </div>
  )

  /* Title+body get their own tight gap (8px) rather than leaning on .aqc's
     10px shell gap - that 10px is reserved for device boundaries
     (photo-to-title, body-to-meta-row), same fix as CardText below. */
  const words = (big?: boolean) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      <h3 className={big ? 'aqc-title aqc-title-lg' : 'aqc-title'}>{title}</h3>
      {rest ? <p className="aqc-body">{rest}</p> : null}
    </div>
  )

  return (
    <CardShell label={title || 'Post'} onActivate={wiring.onOpen}>
      <AuthorPill name={d.authorName} role={d.authorRole} avatar={d.authorAvatar} href={d.authorHref} time={d.timeLabel} onActivate={wiring.onOpenAuthor} />

      {v === 1 ? (
        /* SPLIT. Photo and words side by side above 640px, stacked below it -
           the square crop is what makes the two columns balance. The class
           carries the media query; an inline style could not, and this card is
           rendered at every width in the list. */
        <div className="aqc-split">
          {photo}
          {words()}
        </div>
      ) : v === 3 ? (
        /* ROW. A 112px square thumbnail and the words beside it at every width; the body clamps to three lines so the
           card stays a row and never turns back into a block. */
        <div className="aqc-thumb-row">
          {photo}
          {words()}
        </div>
      ) : v === 5 ? (
        /* RAIL. The plain order, with the words set against a hue rail. The hue is a fill, never text on cream. */
        <>
          {photo}
          <div className="aqc-rail" style={{ ['--rail' as string]: hueOrInk(d.category) }}>{words()}</div>
        </>
      ) : v === 2 ? (
        /* LEDE. The headline reads first, then the photo as a full-width band,
           then the body. Same three elements as variant 0 in a different ORDER,
           which is the cheapest way to change the rhythm of a scroll without
           changing what a card IS.

           Deliberately NOT `aqc-title-lg`. The first version of this scaled the
           headline up as well as moving it, which meant a third of the feed's
           photo cards quietly got a bigger heading than the rest - the owner
           spotted it immediately and it was the wrong call. Order alone is
           enough to make the variant read differently, and it leaves one
           heading size across the whole feed. If a card ever needs a louder
           headline that is C01's job, and C01 is budgeted to one per session. */
        <>
          <h3 className="aqc-title">{title}</h3>
          {photo}
          {rest ? <p className="aqc-body">{rest}</p> : null}
        </>
      ) : (
        <>
          {photo}
          {words()}
        </>
      )}

      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C04 · stacked collection. Three or more images is a shoot, and a shoot
    reads as a stack: it says "there is more inside" without spending three
    cards of height.

    UNBLOCKED 2026-09-11. This used to read "Blocked: needs imageCount >= 3,
    which nothing carries (15.15)", and that was true of what reached the app
    but not of the data: `welfare_projects` has five image columns and
    `post_feed_view` was emitting only `main_image`, so every drive arrived
    with exactly one photo. 100 projects carry three or more. The view now
    emits all of them.

    Brought up to the card contract at the same time - it takes `extras` and
    wires onOpen / onOpenAuthor like the rest of family 05, because a shape
    that cannot carry the feed's behaviour must not be selected for a row that
    needs it (feedItemFromPost.ts). Without that it would have silently
    dropped the six host blocks. */
export function CardCollection({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  const images = d.imageUrls ?? (d.imageUrl ? [{ url: d.imageUrl, alt: d.imageAlt ?? '' }] : [])
  // The live feed leaves `title` unset on purpose so the whole body routes
  // through splitPostBody (feedItemFromPost.ts), same as CardStandard.
  const { headline: title, rest } = derivePostHeadline(d.title ? `${d.title}

${d.body ?? ''}` : d.body, Infinity)
  return (
    <CardShell label={title || d.title || 'A photo collection'} onActivate={wiring.onOpen}>
      <AuthorPill name={d.authorName} role={d.authorRole} avatar={d.authorAvatar} href={d.authorHref} time={d.timeLabel} onActivate={wiring.onOpenAuthor} />
      {/* TWO READINGS OF THE SAME ALBUM (2026-09-18). 100 of the 584 published
          posts land here, and a tilted stack every single time is the same wall
          the standard card had. The stack says "there is more inside" by
          hiding; the mosaic says it by showing. Both are true of an album, so
          which one a post gets is stable from its uuid rather than chosen.

          The mosaic needs at least one photo for the strip under the lead, so
          three is the floor - which is also the floor the chooser uses to send
          a post here at all (rule 05.2, imageCount >= 3). Below that it falls
          back to the stack, which is what a one or two photo post should be
          anyway. The strip takes whatever is left, two or three. */}
      {layoutVariant(item.id, 2, 'album') === 1 && images.length >= 3 ? (
        <div className="aqc-mosaic">
          <CardPhoto
            url={images[0].url}
            alt={images[0].alt || d.imageAlt || ''}
            ctx="card"
            ratio="4 / 3"
            eager={!!wiring.allowEager && wiring.seed === 0}
            onActivate={wiring.onOpenImage}
          />
          {/* The strip's column count is known here - two or three - so it is
              handed to CSS rather than guessed at. `repeat(auto-fit, minmax(0,
              1fr))` looks equivalent and is not: a zero minimum lets auto-fit
              create as many tracks as it likes, and it generated 48 of them
              per card, 46 at 0px. Correct on screen, absurd underneath. */}
          <div
            className="aqc-mosaic-strip"
            style={{ ['--aqc-strip-n' as string]: Math.min(images.length - 1, 3) }}
          >
            {images.slice(1, 4).map((im, i) => (
              <CardPhoto
                key={im.url || i}
                url={im.url}
                alt={im.alt || ''}
                ctx="thumb"
                ratio="1 / 1"
                onActivate={wiring.onOpenImage}
              />
            ))}
          </div>
        </div>
      ) : (
        <PhotoStack images={images} alt={d.imageAlt ?? title ?? d.title} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 className="aqc-title">{title || d.title}</h3>
        {rest ? <p className="aqc-body">{rest}</p> : null}
      </div>
      {d.meta ? <span className="aqc-figure-label">{d.meta}</span> : null}
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C05 · pull quote - "reference C" (15.9). Short text has nothing to fill a
    photo card with, so at quote scale it becomes deliberate: this is the
    live shape the 3 single-line bodies (and every other short post) land on.

    The nesting is exactly the index-card reference:
      tinted hue backing (the shell itself) -> white card -> lined ground
      -> seal breaking the corner -> author pill overhanging the base.

    No BadgeDot here (unlike every other posts-family card): the outer shell
    IS the category signal now, at full saturation, so a same-hue dot on top
    of it would be invisible. */
export function CardQuote({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  // Deliberately NOT derivePostHeadline(), unlike every other card in this
  // file. This renders into `.aqc-quote-text`, a pull quote, not `.aqc-title`,
  // so an over-long first block is not the 900-weight headline defect the
  // guard exists for - and cutting a quote at 120 characters would drop the
  // end of it with nowhere to put the remainder, since this card has no body
  // slot. If a runaway body ever lands here it is the chooser picking the
  // wrong shape, which is a rule in chooseCardShape(), not a typography fix.
  const { title } = splitPostBody(d.title ? `${d.title}\n\n${d.body ?? ''}` : d.body)
  // Body comes from splitPostBody().title when there is no blank line - for
  // the 3 single-line rows, the whole body IS the quote (15.9, verbatim).
  const quote = title || d.body || ''
  return (
    <CardShell label="Post" className="aqc-quote-outer" style={{ background: hueOrInk(d.category) }} onActivate={wiring.onOpen}>
      <div className="aqc-quote-inner">
        <div className="aqc-seal-wrap">
          {/* One of the three fixed seal labels 13.6 names - never invented
              per card. STUDENT RUN fits a generic quote better than the other
              two (VERIFIED BY A HOD is achievement-specific; DRAG ME belongs
              to the footer wall). size=64, not the component's 80 default:
              at this card's scale the default overlapped the quote text
              above two lines (cards.css's .aqc-seal-wrap note) - smaller
              plus the narrower .aqc-quote-text column keeps the corner-break
              intact without it ever reaching a glyph. */}
          <Seal label="★ STUDENT RUN ★ SINCE 2021" size={64} />
        </div>
        <p className="aqc-quote-text">{quote}</p>
      </div>
      {/* Overhangs the inner card's bottom edge (margin-top: -16px) rather
          than sitting in normal flow below it - needs the shell's overflow
          to be visible, which cards.css now sets by default. */}
      <AuthorPill
        name={d.authorName}
        role={d.authorRole}
        avatar={d.authorAvatar}
        href={d.authorHref}
        time={d.timeLabel}
        className="aqc-author--overhang"
        onActivate={wiring.onOpenAuthor}
      />
      {extras}
      <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
    </CardShell>
  )
}

/** C07 · text post, medium - the workhorse (15.10). Plain paper, generous
    leading, ONE HUE RULE AT THE LEFT: this replaces the photo as the card's
    colour signal, which is why a text card in this feed still scans by
    colour. This is the shape every imageless post that the ranker does not
    override lands on - on this dataset, that is most of the feed. */
export function CardText({ item, extras, ...wiring }: CardProps) {
  const d = item.display
  const { headline: title, rest } = derivePostHeadline(d.title ? `${d.title}\n\n${d.body ?? ''}` : d.body, Infinity)

  // The pending/rejected banner ("the duty", 22.1): a member posts, it enters
  // the queue, and until now they were told nothing. CardDisplay
  // (lib/feedShape.ts - out of scope and byte-identical for this whole file)
  // has no dedicated status/rejection_note field to carry this, so it is read
  // off two fields the type already has: d.kicker as the state word,
  // d.meta as the rejection note. Whichever file builds this FeedItem from a
  // live `posts` row (out of this file's scope) is responsible for setting
  // d.kicker only on the author's own view of their own pending/rejected
  // post - this component just renders whatever it is handed. Flagged in the
  // PR report as an interpretation, not a guess made silently.
  const moderation = d.kicker === 'pending' || d.kicker === 'rejected' ? d.kicker : null

  return (
    <CardShell label={title || 'Post'} onActivate={wiring.onOpen}>
      <AuthorPill name={d.authorName} role={d.authorRole} avatar={d.authorAvatar} href={d.authorHref} time={d.timeLabel} onActivate={wiring.onOpenAuthor} />
      {moderation ? (
        <div className={`aqc-tint ${moderation === 'pending' ? 'aqc-tint-lemon' : 'aqc-tint-tomato'}`}>
          <span className="aqc-kicker" style={{ color: 'var(--ink)' }}>{moderation}</span>
          <h3 className="aqc-title">{title}</h3>
          {rest ? <p className="aqc-body" style={{ color: 'var(--ink)' }}>{rest}</p> : null}
          {moderation === 'rejected' && d.meta ? (
            <p className="aqc-body" style={{ color: 'var(--ink)', fontStyle: 'italic' }}>{d.meta}</p>
          ) : null}
        </div>
      ) : (
        // KEEP FeedPostCard's headline/rest word-boundary split logic. That is
        // derivePostHeadline(), NOT splitPostBody() - this comment used to say
        // the latter, and acting on it is what left this card unguarded.
        // FeedPostCard has always been splitPostBody PLUS the 120-character
        // limit; the word-boundary cut this comment asks for lives only in the
        // guard. Do not replace either with -webkit-line-clamp: a clamp cannot
        // split across the two type styles (title vs body).
        <div style={{ display: 'flex', gap: 12 }}>
          <span className="aqc-rule" style={{ background: hueOrInk(d.category) }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <h3 className="aqc-title">{title}</h3>
            {rest ? <p className="aqc-body">{rest}</p> : null}
          </div>
        </div>
      )}
      {moderation ? (
        // No like/comment count shown; Edit/Delete live in the footer instead.
        <div className="aqc-row">
          <a className="aqc-btn aqc-btn-primary" href={d.ctaHref ?? d.href}>{d.ctaLabel ?? 'Edit'}</a>
          {/* Delete has no callback on CardProps (this pass adds one new
              optional callback, onGreet, for C14's composer - a second one
              for an item this task explicitly framed as visual/component
              work felt like scope creep beyond that). Real onClick wiring is
              for whoever mounts this against a live, authenticated post. */}
          <button type="button" className="aqc-btn aqc-btn-quiet">{d.secondaryLabel ?? 'Delete'}</button>
        </div>
      ) : (
        <>
          {extras}
          <MetaRow likeCount={d.likeCount} commentCount={d.commentCount} {...wiring} />
        </>
      )}
    </CardShell>
  )
}
