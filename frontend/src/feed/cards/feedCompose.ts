/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION 10 step 6 · the composition layer
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   `lib/feedShape.ts` answers ONE question per row: which shape. It is
   deliberately 1:1 - one row in, one decision out - and ACCEPTANCE §E forbids
   changing it. This file answers the question that only exists once you have
   the whole list: WHICH ROWS BECOME ONE CARD.

   Nothing in `feedShape.ts` is imported for mutation and nothing here is
   re-implemented from it. `chooseCardShape` is called exactly as `shapeFeed`
   calls it, in list order, against one session.

   ── why this file has to exist ────────────────────────────────────────────
   C25 collapses a run of low-signal rows into one card. `CardDisplay.rows` is
   already the field for that. But the chooser is per-row, so a naive host that
   maps one post to one card renders C25 once PER POST - and on the live feed
   (2 distinct authors, AUTHOR_CAP = 4) that means roughly seventeen identical
   cards per page, each headed "more from AquaTerra" with a count of 1. That is
   not the shape misfiring; it is the shape being handed the wrong unit. The
   grouping has to happen between the chooser and the renderer, and it did not
   exist anywhere.

   ── what a group MEANS here, and why ──────────────────────────────────────
   The group key is THE AUTHOR, and only ADJACENT rows group.

   By author, because that is the collapse's own cause: rule 05.7 fires on "the
   fourth and later card from one author", and `CardCompact` already titles
   itself "more from {name}". A group is the sentence the card is already
   writing. Grouping by category would produce a header the card cannot express
   (mixed authors, and `rows` carries no per-row category field), and grouping
   by day would mix authors and force the header to a neutral label, throwing
   away the one fact the collapse knows.

   Adjacent only, because a non-adjacent group silently REORDERS the feed -
   it would lift a later post up into an earlier card. Order is AQRank's, not
   shape's, and not this file's either (`feedShape.ts` header, first paragraph).
   Adjacency also means the composition never changes which rows are on the
   page, only how many cards they occupy.

   ── a group of one is never a group ───────────────────────────────────────
   A single-member run is emitted as a SINGLE CARD, re-shaped without rule
   05.7's override, so it renders as C03 / C05 / C07 - whatever its content
   actually is - rather than as a one-row list. This is the specific
   degeneracy that makes a naive wiring look broken, and it is the case
   `feedCompose.test.ts` pins hardest.

   ── honest limits, stated rather than papered over ────────────────────────
   - A row with no `display.href` is NOT groupable. ACCEPTANCE §E requires
     every C25 row to be openable and this file will not invent a URL, so such
     a row is emitted as its own card instead of being dropped or given a dead
     link.
   - `CardDisplay.rows` has no per-row category field, so a mixed-category
     group renders one dot colour. This file sets the group's category only
     when every member agrees, and `null` otherwise - an absent signal, never
     a wrong one. A per-row hue needs a field on `CardDisplay`, which lives in
     `feedShape.ts`.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import {
  chooseCardShape,
  newShapeSession,
  splitPostBody,
  type FeedItem,
  type ShapeDecision,
  type ShapeSession,
} from '../../lib/feedShape'
import { CAT_COLORS } from '../../lib/uiHelpers'

/**
 * A group stops at eight so one prolific author cannot swallow the page into a
 * single card. Eight is 4 visible + a "Show 4 more" pill, which is exactly the
 * cap `CardCompact` already renders (`ROW_CAP = 4`). A ninth adjacent row from
 * the same author simply starts the next group.
 */
export const GROUP_MAX = 8

/** One rendered card, after composition. `size > 1` means it collapsed rows. */
export interface ComposedCard {
  /** Stable React key. For a group, the first member's id plus the size. */
  key: string
  /** What the card renders. For a group, a synthesised item (see below). */
  item: FeedItem
  decision: ShapeDecision
  /** How many source rows this one card stands for. Never 0. */
  size: number
  /** The source rows, in feed order. Only set when `size > 1`. */
  members?: readonly FeedItem[]
}

/**
 * Only rows the chooser sent to C25 by rule 05.7 are candidates. A C25 from
 * 07.2 ("nothing above qualified") is not a post and has no author to name, so
 * it never groups and never gets re-shaped.
 */
function isOverrideCompact(decision: ShapeDecision): boolean {
  return decision.shape === 'C25' && decision.rule.startsWith('05.7')
}

/**
 * The group key. `null` means "this row cannot be grouped with anything",
 * which is how a missing author or a missing href opts out.
 */
export function groupKeyOf(item: FeedItem): string | null {
  if (item.kind !== 'post') return null
  if (item.authorId == null) return null
  // ACCEPTANCE §E: every C25 row needs an href. A row that has none cannot be
  // a group member, because this file will not invent one.
  if (!item.display.href) return null
  return `author:${item.authorId}`
}

/**
 * Re-shape one demoted row as if rule 05.7 had not fired, so a group of one
 * renders as the card its content actually is.
 *
 * A FRESH session is correct here and the cleared discriminators are not
 * optional. `moment` / `ask` / `digest` were already matched-and-suppressed by
 * a cap during the real pass; a fresh session would restore them and un-cap a
 * moment that had deliberately been seen once already. Clearing them keeps the
 * fallback inside family 05, which is where a 05.7 override came from.
 */
function soloDecision(item: FeedItem): ShapeDecision {
  return chooseCardShape(
    { ...item, belowFold: false, moment: undefined, ask: undefined, digest: undefined },
    newShapeSession(),
  )
}

/** The row's one-line verb, from the body the author actually wrote. */
function verbOf(item: FeedItem): string {
  if (item.display.title) return item.display.title
  // splitPostBody, never a character slice (ACCEPTANCE §C).
  return splitPostBody(item.body).title
}

/** Build the single C25 item that stands for a run of rows. */
function groupItem(members: readonly FeedItem[]): FeedItem {
  const first = members[0]
  const cats = new Set(members.map(m => m.display.category ?? null))
  return {
    ...first,
    id: `group:${first.id}:${members.length}`,
    display: {
      // Only when every member agrees. An absent hue beats a wrong one.
      category: cats.size === 1 ? first.display.category ?? null : null,
      // kicker deliberately unset: CardCompact already writes its own header
      // from the rows ("more from {name}"), and inventing a string here would
      // be a copy change.
      rows: members.map(m => ({
        id: m.id,
        name: m.display.authorName ?? '',
        verb: verbOf(m),
        time: m.display.timeLabel ?? '',
        avatar: m.display.authorAvatar ?? null,
        // Non-null by construction: groupKeyOf() rejects a row without one.
        href: m.display.href,
      })),
    },
  }
}

/**
 * Shape a list, then collapse it. This is the call a feed host makes instead
 * of `shapeFeed`, and it is the only place grouping happens.
 *
 * `session` is threaded exactly as `shapeFeed` threads it, so the caps consume
 * themselves once per list and not once per re-render. Resolve it in a
 * `useMemo`, same as before.
 */
/**
 * Host policy, added 2026-09-07 when this layer was mounted for real.
 *
 * `groupKeyOf` answers "CAN these rows be one card". This answers "SHOULD
 * they", and only the host can, because only the host knows what the card
 * would have carried. Collapsing a row into C25 throws away its photo, its
 * like button, its bookmark, its comment sheet, its stat pills and its link
 * CTA - `CardCompact` renders a name, a verb and a time, and nothing else.
 * For a low-signal text row that is the point. For a row with a photo and a
 * live like count it is a silent capability loss, which the card contract
 * (`types.ts`) exists to forbid.
 *
 * Default is `() => true`, so every existing caller and every existing test
 * keeps the behaviour it had. `feed/feedItemFromPost.ts` supplies the live
 * feed's predicate.
 */
export interface ComposeOptions {
  groupable?: (item: FeedItem) => boolean
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Host policy 2 · the same content on different card designs
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   `chooseCardShape` is per-ROW and correct: it looks at one post and names the
   shape that post deserves. It has no idea what the rows above it got, and it
   must not - ACCEPTANCE §E freezes it precisely so its rules stay a statement
   about content rather than about sequence.

   But a per-row chooser has a structural consequence: identical content gets
   identical shapes, so a feed whose recent rows are all "welfare drive with a
   photo shoot" renders as one design repeated down the page. Measured on the
   live feed the day this was written: C04 x5, C03 x1, C07 x2, C06 x1 - four
   designs across nine cards, and one of them five times.

   THE POINT OF THE SHAPE LIBRARY IS THE OPPOSITE OF THAT. The same type of
   content is supposed to be able to appear on different card designs; that is
   what having thirty of them is FOR. So this layer does not merely "break a
   run" - it ROTATES, walking a row onto the next design its content can
   actually support.

   ── what may substitute for what, and why each is lossless ────────────────
   Every rotation below stays inside family 05, and every target renders
   `extras` + `MetaRow` and wires onOpen / onOpenAuthor / onOpenImage. That is
   the card contract (types.ts): a shape the host selects for a live row must
   carry the live row's behaviour, or the swap silently costs the reader a
   like button, a bookmark, a comment sheet or the welfare rail. C01 and C02
   were brought up to that contract in the same pass as this change, which is
   what made them legal targets at all.

     C04 stacked collection  →  C03 · C02 · C01
     C03 standard photo      →  C02 · C01 · C04
     C02 colour block        →  C03 · C01 · C04
     C01 hero                →  C03 · C02 · C04
     C07 text post           →  C05 (pull quote)
     C05 pull quote          →  C07
     C06 long read           →  C02 · C03 · C07

   C06 is the one rotation that gives something up, so it is stated rather
   than buried: a blog re-cast as C02/C03/C07 keeps its photo, its category
   hue, its author, `extras` and every engagement control, and LOSES the
   "N min read" pill and the BLOG badge. That is a label, not a capability -
   the contract in types.ts is about behaviour, and none is lost. It is worth
   the trade because the alternative was measured: the live feed rendered
   EIGHT identical C06 cards in a row once the 36 blog rows came into range,
   and eight of anything is not editorial restraint, it is a wall. The first
   blog in any window still renders as a full C06; only the repeats vary.

   ── what is deliberately NOT rotatable ────────────────────────────────────
   C25 (the collapsed group) has no ring. `composeFeed` branches on 05.7 C25
   decisions to build its groups, so rotating one would change what grouped.
   Every family outside 04/05 has no ring either: those shapes are chosen
   because the row IS a drive, a birthday, an opening. Their content has no
   second reading, so there is no second design to give it.

   ── the feasibility gates are not decoration ──────────────────────────────
   A rotation that ignores content produces worse monotony than it fixes, so
   each target states what it needs and is skipped when the row cannot feed it:

     C04  three or more images, or the stack is one photo in a fan
     C03  one image
     C02  one image AND a MAPPED category - `.aqc-block` paints ink type on
          `hueOrInk`, which falls back to the ink, so an unmapped category
          renders ink on ink. This is the same guard as rule 05.3's "mapped
          category hue", carried here for the same reason.
     C01  one image, a body short enough to sit in the scrim, and the page's
          ONE hero not yet spent. "One post per session earns the loudest
          shape" is C01's own rule; a rotation that ignored it would print
          four heroes in a row and be the monotony it was added to fix.
     C05  no image and a body under 280 - a pull quote is a short post shown
          at quote scale, not a long one squeezed into one.
     C07  no image.

   ── why a WINDOW rather than a run counter ────────────────────────────────
   The first version of this capped runs at two, and two-in-a-row-forever is
   still one design: it produced C04,C04,C03,C04,C04. The rule is now "not the
   same design within the last two cards", which is the distance at which a
   repeat actually reads as a repeat on screen. A cursor per source shape means
   successive rotations of one shape land on DIFFERENT alternates rather than
   all on the first one.

   Idempotent by construction: after one pass no shape repeats inside the
   window, so a second pass finds nothing to change.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** How far back a design still counts as "just used". */
const RECENT_WINDOW = 2

/** C01's own rule, enforced by the host because only the host can see a page. */
const HERO_BUDGET = 1

/** Bodies longer than this have no business at quote scale. */
const QUOTE_MAX_BODY = 280

/** Bodies longer than this do not fit C01's scrim without clamping past sense. */
const HERO_MAX_BODY = 420

const ROTATION: Partial<Record<string, readonly string[]>> = {
  C01: ['C03', 'C02', 'C04'],
  C02: ['C03', 'C01', 'C04'],
  C03: ['C02', 'C01', 'C04'],
  C04: ['C03', 'C02', 'C01'],
  C05: ['C07'],
  C06: ['C02', 'C03', 'C07'],
  C07: ['C05'],
}

/** A substituted decision must name the family its NEW shape belongs to, not
 *  the family it came from - `ShapeDecision.family` is read by the catalogue
 *  and by the dev overlay, and a C06 rotated to C02 that still claimed
 *  '04-editorial' would mislabel itself everywhere it is inspected. */
const FAMILY_OF: Record<string, string> = {
  C01: '05-posts', C02: '05-posts', C03: '05-posts', C04: '05-posts',
  C05: '05-posts', C06: '04-editorial', C07: '05-posts',
}

/** How many photos this row can actually put on a card. */
function imageCountOf(item: FeedItem): number {
  const urls = item.display.imageUrls
  if (urls && urls.length) return urls.length
  return item.display.imageUrl ? 1 : 0
}

/** The five mapped categories, from `lib/uiHelpers.CAT_COLORS` - the same
 *  table `parts.hueFor` reads. Imported rather than restated so a sixth
 *  category cannot be added there and silently miss this gate. */
function hasMappedHue(item: FeedItem): boolean {
  const cat = item.display.category
  return !!cat && cat in CAT_COLORS
}

function canRender(shape: string, item: FeedItem, heroLeft: number): boolean {
  const images = imageCountOf(item)
  const bodyLength = (item.body ?? '').trim().length
  switch (shape) {
    case 'C01': return images >= 1 && heroLeft > 0 && bodyLength <= HERO_MAX_BODY
    case 'C02': return images >= 1 && hasMappedHue(item)
    case 'C03': return images >= 1
    case 'C04': return images >= 3
    case 'C05': return images === 0 && bodyLength > 0 && bodyLength <= QUOTE_MAX_BODY
    // Only a row that IS a long read may become one. `longRead` is set from
    // `source_type = 'blog'` (feedItemFromPost.ts), read off the source rather
    // than inferred from length, so this cannot dress a long post as a blog.
    case 'C06': return !!item.longRead
    case 'C07': return images === 0
    default: return false
  }
}

/**
 * Rotate repeated designs onto the next one the row can support.
 *
 * Exported because it is worth testing on its own and because a host that
 * composes its own list (rather than calling `composeFeed`) still needs it;
 * `composeFeed` applies it for you, to the COMPOSED cards, which is the list
 * that actually renders. Running it twice is a no-op.
 */
export function varyRuns(
  list: readonly ShapeDecision[],
  items?: readonly FeedItem[],
): ShapeDecision[] {
  let heroLeft = HERO_BUDGET
  /** Where each source shape's last rotation left off in its ring. */
  const cursor = new Map<string, number>()
  /** The last `RECENT_WINDOW` shapes actually emitted, newest last. */
  const recent: string[] = []

  const emit = (shape: string) => {
    recent.push(shape)
    if (recent.length > RECENT_WINDOW) recent.shift()
  }

  return list.map((d, i) => {
    const item = items?.[i]
    const ring = ROTATION[d.shape]

    // Not rotatable (C25 groups, every non-05 family), or no item to test
    // against: pass it through untouched. C25 in particular MUST pass through
    // - `composeFeed` reads 05.7 C25 decisions to build its groups.
    if (!ring || !item || !recent.includes(d.shape)) {
      emit(d.shape)
      if (d.shape === 'C01') heroLeft -= 1
      return d
    }

    const start = cursor.get(d.shape) ?? 0
    for (let k = 0; k < ring.length; k++) {
      const candidate = ring[(start + k) % ring.length]
      if (recent.includes(candidate)) continue
      if (!canRender(candidate, item, heroLeft)) continue
      cursor.set(d.shape, (start + k + 1) % ring.length)
      if (candidate === 'C01') heroLeft -= 1
      emit(candidate)
      return {
        shape: candidate,
        family: FAMILY_OF[candidate] ?? d.family,
        rule: `host: ${d.shape} used within ${RECENT_WINDOW}, varied to ${candidate}`,
      } as ShapeDecision
    }

    // Nothing the row can feed. Repeating beats rendering a design the content
    // cannot fill, so the original decision stands - said out loud rather than
    // hidden, because this is the case that leaves a visible repeat on screen.
    emit(d.shape)
    return d
  })
}

export function composeFeed(
  items: readonly FeedItem[],
  session: ShapeSession = newShapeSession(),
  options: ComposeOptions = {},
): ComposedCard[] {
  const groupable = options.groupable ?? (() => true)
  const decisions = items.map(item => chooseCardShape(item, session))

  const out: ComposedCard[] = []
  let i = 0

  const emitSolo = (item: FeedItem, decision: ShapeDecision) => {
    // A group of one is never a group: drop the 05.7 override and let the
    // content rules pick the real shape.
    const d = isOverrideCompact(decision) && groupKeyOf(item) !== null
      ? soloDecision(item)
      : decision
    out.push({ key: item.id, item, decision: d, size: 1 })
  }

  while (i < items.length) {
    const item = items[i]
    const decision = decisions[i]
    const key = isOverrideCompact(decision) && groupable(item) ? groupKeyOf(item) : null

    if (key === null) {
      emitSolo(item, decision)
      i += 1
      continue
    }

    // Take the maximal adjacent run sharing this key, capped at GROUP_MAX.
    let j = i + 1
    while (
      j < items.length &&
      j - i < GROUP_MAX &&
      isOverrideCompact(decisions[j]) &&
      groupable(items[j]) &&
      groupKeyOf(items[j]) === key
    ) {
      j += 1
    }

    const members = items.slice(i, j)
    if (members.length === 1) {
      emitSolo(item, decision)
    } else {
      out.push({
        key: `group:${item.id}:${members.length}`,
        item: groupItem(members),
        // The decision is carried through unchanged - the shape is still C25
        // and still by rule 05.7. Composition changes the unit, never the
        // shape.
        decision,
        size: members.length,
        members,
      })
    }
    i = j
  }

  /* Rotate LAST, over the composed cards, not the per-row decisions.
     ──────────────────────────────────────────────────────────────────────────
     This ordering is load-bearing twice over.

     Grouping reads 05.7 C25 decisions, so rotating first would risk changing a
     decision the grouper is about to branch on. And `emitSolo` RE-SHAPES a
     demoted row through `soloDecision`, so the shape a row ends up with is not
     always the shape the chooser first gave it - rotating before composition
     means rotating a list that is not the one the reader sees. (That mismatch
     was real: the pre-composition decisions and the composed cards disagreed
     on the live feed, and the rotation appeared to do nothing because it had
     been applied to the wrong list.) */
  const varied = varyRuns(out.map(c => c.decision), out.map(c => c.item))
  for (let k = 0; k < out.length; k++) out[k] = { ...out[k], decision: varied[k] }

  return out
}
