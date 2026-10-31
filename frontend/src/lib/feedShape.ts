/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION 10 · the feed card chooser
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   SHAPE ONLY. This file answers "which of the 30 card shapes does this row
   render as". It never answers "in what order do the rows come" - that is
   AQRank (docs/AQRANK-SPEC.md) and docs/FEED-ALGORITHM.md section 1, which is
   plain recency. A card never computes its own score, and the ranker never
   picks a shape.

   Eight families, evaluated in order. THE FIRST FAMILY THAT MATCHES WINS, and
   within a family THE FIRST MATCHING RULE WINS. Family 07 always matches, so
   nothing falls through. Both orders are load-bearing: do not reorder either
   for readability.

     00 chrome     C08 pinned, C23 offline queued, C24 skeleton
     01 moments    C15 birthday, C14 welcome, C16 break
     02 asks       C30 volunteer gap, C26 poll, C27 countdown, C18 referral,
                   C19 hiring
     03 records    C13 certificate, C12 achievement, C10 project active,
                   C11 project delivered, C09 drive, C20 class, C21 drop
     04 editorial  C06 long read
     05 posts      C01 hero, C02 colour block, C03 standard, C04 collection,
                   C05 quote, C07 text  (plus the tie-break below)
     06 digest     C22 roundup, C28 milestone, C17 spotlight
     07 fallback   C25 compact rows, C29 caught up

   ON THE CARD IDs. Two upstream documents number the shapes differently.
   `AQ Feed Cards.dc.html` (the rendered catalogue, 30 shapes) and
   CHANGELOG-REDESIGN section 10 agree on C01..C30 as used here.
   docs/FEED-ALGORITHM.md section 2 uses its own shorthand in the family-05
   table ("C09 quote", "C11 long read", "C05 standard"); those refer to the
   SAME three shapes this file calls C05 pull quote, C06 long read and C07
   text post. The canvas numbering wins because it is the one 30 rendered
   cards actually carry. Section 10's family-03 row also reads "C11 project
   active, C11b project delivered", which is a typo for the canvas's C10 / C11
   pair. Corrected here, recorded in CHANGELOG_SEC10_34.md.

   Pure. No fetching, no DOM, no React. The only side effect is reading and
   writing the session cap object it is handed, which is what the caps require.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** The 30 shapes, in catalogue order. */
export type CardShape =
  | 'C01' | 'C02' | 'C03' | 'C04' | 'C05' | 'C06' | 'C07' | 'C08' | 'C09' | 'C10'
  | 'C11' | 'C12' | 'C13' | 'C14' | 'C15' | 'C16' | 'C17' | 'C18' | 'C19' | 'C20'
  | 'C21' | 'C22' | 'C23' | 'C24' | 'C25' | 'C26' | 'C27' | 'C28' | 'C29' | 'C30'

/** The eight families, in evaluation order. */
export type CardFamily =
  | '00-chrome' | '01-moments' | '02-asks' | '03-records'
  | '04-editorial' | '05-posts' | '06-digest' | '07-fallback'

export const FAMILY_ORDER: readonly CardFamily[] = [
  '00-chrome', '01-moments', '02-asks', '03-records',
  '04-editorial', '05-posts', '06-digest', '07-fallback',
] as const

// ── The row, as the chooser sees it ──────────────────────────────────────────
// The caller maps its own source row (a `Post` from services/api, a
// welfare_projects row, a Labs row, a members row) onto this. The chooser only
// ever reads the discriminating fields; `display` is carried through untouched
// for the component to render.

export type ChromeState = 'pinned' | 'queued' | 'skeleton'
export type MomentKind = 'birthday' | 'welcome' | 'break'
export type AskKind = 'volunteer_gap' | 'poll' | 'countdown' | 'referral' | 'hiring'
export type RecordKind =
  | 'certificate' | 'achievement' | 'project_active' | 'project_delivered'
  | 'drive' | 'class' | 'drop'
export type DigestKind = 'roundup' | 'milestone' | 'spotlight'

/**
 * A figure the card wants to print. `value: null` means the host could not
 * resolve it, and the component renders the dashed live marker instead.
 * Never substitute a zero: a zero is a claim (guardrail rule 4).
 */
export interface CardFigure {
  value: string | null
  label: string
}

/**
 * Everything a card renders, in one flat bag. One bag rather than 30 prop
 * interfaces so the registry can stay `Record<CardShape, FC<CardProps>>`
 * without an `any` anywhere. Every field is optional; a card reads the four or
 * five it needs and ignores the rest.
 */
export interface CardDisplay {
  kicker?: string
  title?: string
  body?: string
  meta?: string
  /** Photo for this row, and only for this row. Empty means the card gets no
      photo (guardrail rule 2). Rendered through sized() by the component. */
  imageUrl?: string | null
  imageAlt?: string
  /** Extra photos for the stacked collection. Same rule applies to each. */
  imageUrls?: { url: string; alt: string }[]
  authorName?: string
  authorRole?: string
  authorAvatar?: string | null
  authorHref?: string
  timeLabel?: string
  /** Category slug, used to look up the hue in lib/uiHelpers.CAT_COLORS. */
  category?: string | null
  figures?: CardFigure[]
  ctaLabel?: string
  ctaHref?: string
  secondaryLabel?: string
  secondaryHref?: string
  href?: string
  likeCount?: number
  commentCount?: number
  /** C25 only: the compact rows this card collapses. */
  rows?: { id: string; name: string; verb: string; time: string; avatar?: string | null; href?: string }[]
  /** C26 only. */
  options?: { label: string; percent: number }[]
  /** C27 only: the deadline, ISO. The card formats it; it never invents one. */
  deadline?: string | null
  /** C09 / C30: filled and needed spots. */
  filled?: number
  needed?: number
}

export interface FeedItem {
  id: string
  /** Where the row came from. Only used for the fallback branch. */
  kind: 'post' | 'drive' | 'labs' | 'person' | 'system'
  // Family discriminators. The caller sets at most one, from the source table.
  chrome?: ChromeState
  moment?: MomentKind
  ask?: AskKind
  record?: RecordKind
  /** Family 04. Set when the source is `blogs` and the read time is over 3 min. */
  longRead?: boolean
  digest?: DigestKind
  /** Family 07 terminal state: the feed has nothing unseen. Replaces the list. */
  terminal?: boolean
  // Family 05 inputs.
  authorId?: number | null
  pinned?: boolean
  featured?: boolean
  category?: string | null
  body?: string
  imageCount?: number
  /** width / height of the single image. Rule 1 needs >= 1.2. */
  aspect?: number
  /** Set by AQRank. True when the row scored below the fold threshold. */
  belowFold?: boolean
  /** Stable key for the moments cap: one per member per day. */
  momentKey?: string
  display: CardDisplay
}

// ── The session ──────────────────────────────────────────────────────────────

/**
 * Mutable caps, one object per feed session. Created by `newShapeSession()`,
 * threaded through every `chooseCardShape` call in list order, and thrown away
 * on unmount. Deliberately plain data so a test can assert on it.
 */
export interface ShapeSession {
  /** How many rows have been shaped. Drives the ask throttle and the ink cap. */
  index: number
  /** Cap: one hero per session. */
  heroUsed: boolean
  /** Cap: no two colour blocks adjacent with the same hue. */
  lastBlockCategory: string | null
  /** Cap: at most one ink card every ten rows. -1 means "never yet". */
  lastInkIndex: number
  /** Cap: max one ask per five cards. -1 means "never yet". */
  lastAskIndex: number
  /** Cap: fourth and later card from one author collapses to C25. */
  authorCounts: Record<string, number>
  /** Cap: never two digests in one session. */
  digestUsed: boolean
  /** Cap: a moment seen once is suppressed for the rest of the day. */
  momentsSeen: string[]
}

export function newShapeSession(): ShapeSession {
  return {
    index: 0,
    heroUsed: false,
    lastBlockCategory: null,
    lastInkIndex: -1,
    lastAskIndex: -1,
    authorCounts: {},
    digestUsed: false,
    momentsSeen: [],
  }
}

/** What the chooser returns. `rule` is what the dev inspector prints. */
export interface ShapeDecision {
  shape: CardShape
  family: CardFamily
  /** One line, in the inspector's voice: which rule fired. */
  rule: string
}

// ── Display guards ───────────────────────────────────────────────────────────

/**
 * Same display-side guard `director/SopManagement.isRealTask` already uses: do
 * not render obviously-placeholder content as if it were real. Post 774 is
 * live published junk (`body: "xcv xv"`), so the feed has a real instance of
 * this today. This filters at RENDER time and touches no query.
 */
export function isRealPostBody(body: string | null | undefined): boolean {
  const t = (body || '').trim().toLowerCase()
  if (t.length === 0) return false
  if (['n/a', 'na', 'tbd', '-', 'placeholder', 'test'].includes(t)) return false
  // Junk with no vowel and no sentence in it: "xcv xv", "asdf", "qwer qwer".
  const letters = t.replace(/[^a-z]/g, '')
  if (letters.length > 0 && letters.length < 24 && !/[aeiou]/.test(letters)) return false
  return true
}

/** Number of images actually attached to the row. Never inferred from a link. */
export function imageCountOf(item: Pick<FeedItem, 'imageCount'>): number {
  const n = item.imageCount ?? 0
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * 583 of 586 published bodies are title / blank line / sentence; 3 are a single
 * line. Splitting on the blank line gives the card a real headline instead of a
 * character slice. When there is no blank line the whole body IS the title,
 * which is the title-only fallback those 3 rows need.
 */
export function splitPostBody(body: string | null | undefined): { title: string; rest: string } {
  const b = (body || '').trim()
  const brk = b.indexOf('\n\n')
  if (brk === -1) {
    const nl = b.indexOf('\n')
    if (nl === -1) return { title: b, rest: '' }
    return { title: b.slice(0, nl).trim(), rest: b.slice(nl + 1).trim() }
  }
  return { title: b.slice(0, brk).trim(), rest: b.slice(brk + 2).trim() }
}

// ── The chooser ──────────────────────────────────────────────────────────────

const ASK_EVERY = 5
const INK_EVERY = 10
const AUTHOR_CAP = 4

/**
 * Pick the shape. Mutates `session` to record the caps it consumed, which is
 * the one deliberate side effect (section 10 step 3).
 *
 * The family walk and the family-05 tie-break are written out longhand and in
 * order. A table-driven version reads better and hides exactly the thing that
 * matters, which is the order.
 */
export function chooseCardShape(item: FeedItem, session: ShapeSession): ShapeDecision {
  const index = session.index
  session.index += 1

  // ── 00 chrome ──────────────────────────────────────────────────────────────
  // Not posts at all. States of the surface, so they resolve before any content
  // rule and never enter scoring.
  if (item.chrome === 'pinned' || item.pinned) {
    return { shape: 'C08', family: '00-chrome', rule: '00.1 pinned = true' }
  }
  if (item.chrome === 'queued') {
    return { shape: 'C23', family: '00-chrome', rule: '00.2 send queued offline' }
  }
  if (item.chrome === 'skeleton') {
    return { shape: 'C24', family: '00-chrome', rule: '00.3 first paint, no data yet' }
  }

  // ── 01 moments ─────────────────────────────────────────────────────────────
  // Time-boxed and self-expiring, so they outrank content: tomorrow they are
  // gone. A moment seen once is suppressed for that member for the rest of the
  // day, and a suppressed moment does NOT match the family, it falls through.
  if (item.moment) {
    const key = item.momentKey || `${item.moment}:${item.id}`
    if (!session.momentsSeen.includes(key)) {
      session.momentsSeen.push(key)
      if (item.moment === 'birthday') {
        return { shape: 'C15', family: '01-moments', rule: '01.1 birthday today, opted in' }
      }
      if (item.moment === 'welcome') {
        return { shape: 'C14', family: '01-moments', rule: '01.2 approved under 48h ago' }
      }
      return { shape: 'C16', family: '01-moments', rule: '01.3 teammate break active' }
    }
    // else: suppressed by the moments cap, fall through to the next family.
  }

  // ── 02 asks ────────────────────────────────────────────────────────────────
  // The member can change the outcome by acting. Throttled to one ask per five
  // cards so a deadline-heavy week does not read as nagging.
  if (item.ask) {
    const throttled = session.lastAskIndex >= 0 && index - session.lastAskIndex < ASK_EVERY
    if (!throttled) {
      session.lastAskIndex = index
      switch (item.ask) {
        case 'volunteer_gap':
          return { shape: 'C30', family: '02-asks', rule: '02.1 drive under 48h and under half full' }
        case 'poll':
          return { shape: 'C26', family: '02-asks', rule: '02.2 poll open' }
        case 'countdown':
          return { shape: 'C27', family: '02-asks', rule: '02.3 event under 72h and you have a place' }
        case 'referral':
          return { shape: 'C18', family: '02-asks', rule: '02.4 open role on your desk, no invite in 30 days' }
        default:
          return { shape: 'C19', family: '02-asks', rule: '02.5 job opening, status open' }
      }
    }
    // else: throttled, fall through.
  }

  // ── 03 records ─────────────────────────────────────────────────────────────
  // Durable facts with their own tables. Shape comes from the record type,
  // never from body length.
  if (item.record) {
    switch (item.record) {
      case 'certificate':
        return { shape: 'C13', family: '03-records', rule: '03.1 certificate issued' }
      case 'achievement':
        return { shape: 'C12', family: '03-records', rule: '03.2 achievement verified' }
      case 'project_active':
        return { shape: 'C10', family: '03-records', rule: '03.3 project active' }
      case 'project_delivered':
        return { shape: 'C11', family: '03-records', rule: '03.4 project complete' }
      case 'drive':
        return { shape: 'C09', family: '03-records', rule: '03.5 drive, date in the future' }
      case 'class':
        return { shape: 'C20', family: '03-records', rule: '03.6 class, upcoming session' }
      default:
        return { shape: 'C21', family: '03-records', rule: '03.7 crftd drop, status live' }
    }
  }

  // ── 04 editorial ───────────────────────────────────────────────────────────
  // The only family that suppresses engagement counts above the fold.
  if (item.longRead) {
    return { shape: 'C06', family: '04-editorial', rule: '04.1 source blogs, read time over 3 min' }
  }

  // ── 05 posts ───────────────────────────────────────────────────────────────
  // The only family where shape follows content shape, so it needs the
  // tie-break. Rules are numbered exactly as section 10 numbers them.
  if (item.kind === 'post') {
    const authorKey = item.authorId == null ? '' : String(item.authorId)
    if (authorKey) {
      session.authorCounts[authorKey] = (session.authorCounts[authorKey] || 0) + 1
    }
    const fromThisAuthor = authorKey ? session.authorCounts[authorKey] : 0
    const images = imageCountOf(item)
    const len = (item.body || '').length
    const hue = item.category ? CATEGORY_HAS_HUE.includes(item.category) : false

    // Rule 7 is not a content rule and it overrides everything above it. It
    // applies when the row scored below the fold threshold, or on the fourth
    // and later card from one author in a session. On a feed where 576 of 586
    // posts come from the org account, this is the common case, not the
    // exception. Evaluated FIRST in code and LAST in the table because
    // "overrides anything above it" and "is checked before them" are the same
    // statement written two ways.
    if (item.belowFold) {
      return { shape: 'C25', family: '05-posts', rule: '05.7 ranker override, below the fold threshold' }
    }
    if (fromThisAuthor >= AUTHOR_CAP) {
      return { shape: 'C25', family: '05-posts', rule: `05.7 ranker override, card ${fromThisAuthor} from this author` }
    }

    // 1. Hero. Requires EXACTLY one image. That single clause is what stops it
    //    colliding with the collection card at rule 2.
    if (item.featured && images === 1 && (item.aspect ?? 0) >= 1.2 && len < 240 && !session.heroUsed) {
      session.heroUsed = true
      return { shape: 'C01', family: '05-posts', rule: '05.1 featured, one landscape image, body under 240' }
    }
    // 2. Three or more images is a shoot, and a shoot reads as a stack.
    //    Checked before the single-photo rules so it cannot be swallowed.
    if (images >= 3) {
      return { shape: 'C04', family: '05-posts', rule: '05.2 imageCount >= 3' }
    }
    // 3. Photo plus colour block. Needs a hue to sit on, so it only fires for
    //    the five mapped categories. Two caps can demote it to C03: the ink
    //    spacing cap and the same-hue adjacency cap.
    // BAND RETUNED 2026-09-11, on the owner's decision, recorded in
    // ACCEPTANCE.md §E. It was `len >= 240`, and that window is EMPTY on this
    // corpus: measured across all 586 feed rows, 6 bodies are under 60, 225 at
    // 60-119, 311 at 120-179, 10 at 180-239, ZERO at 240-600, 34 over 600. The
    // threshold did not make the colour block rare, it made it impossible, and
    // the catalogue recorded the shape as unpopulatable as a result.
    //
    // 120 is the new floor because that is where this corpus actually lives
    // (311 rows) and it is still enough copy to fill a solid ground - under it
    // the type floats in the block. The ceiling is unchanged.
    //
    // This does NOT flood the feed: rule 3 keeps both of its caps, so a colour
    // block still needs a ten-row gap since the last one AND a different hue
    // from the one before it. Eligibility went from 0 rows to 321; the caps
    // decide how many of those actually render.
    if (images >= 1 && hue && len >= 120 && len <= 600) {
      const tooSoon = session.lastInkIndex >= 0 && index - session.lastInkIndex < INK_EVERY
      const sameHue = session.lastBlockCategory === item.category
      if (!tooSoon && !sameHue) {
        session.lastInkIndex = index
        session.lastBlockCategory = item.category ?? null
        return { shape: 'C02', family: '05-posts', rule: '05.3 image, mapped hue, body 120 to 600' }
      }
      return {
        shape: 'C03',
        family: '05-posts',
        rule: sameHue ? '05.3 demoted, same hue as the last colour block' : '05.3 demoted, ink cap, one every ten rows',
      }
    }
    // 4. The catch-all for anything with a picture. Deliberately last among
    //    the image rules.
    if (images >= 1) {
      return { shape: 'C03', family: '05-posts', rule: '05.4 imageCount >= 1' }
    }
    // 5. Short and imageless. Any longer and the quote scale stops working.
    if (images === 0 && len < 180) {
      return { shape: 'C05', family: '05-posts', rule: '05.5 no image, body under 180' }
    }
    // 6. The final content rule. Everything reaches a shape.
    return { shape: 'C07', family: '05-posts', rule: '05.6 no image, the text post' }
  }

  // ── 06 digest ──────────────────────────────────────────────────────────────
  // Injected at fixed slots, not sorted. Never two in one session.
  if (item.digest && !session.digestUsed) {
    session.digestUsed = true
    if (item.digest === 'roundup') {
      return { shape: 'C22', family: '06-digest', rule: '06.1 weekly roundup, slot 4' }
    }
    if (item.digest === 'milestone') {
      return { shape: 'C28', family: '06-digest', rule: '06.2 org counter crossed a round number' }
    }
    return { shape: 'C17', family: '06-digest', rule: '06.3 team spotlight, slot 9' }
  }

  // ── 07 fallback ────────────────────────────────────────────────────────────
  // Always matches. C29 is terminal and replaces the list rather than
  // appending to it.
  if (item.terminal) {
    return { shape: 'C29', family: '07-fallback', rule: '07.1 nothing unseen for this member' }
  }
  return { shape: 'C25', family: '07-fallback', rule: '07.2 nothing above qualified' }
}

/**
 * Shape a whole list in one pass, which is how a React caller should use this.
 *
 * `chooseCardShape` mutates the session, so calling it from inside a component's
 * render body means the caps consume themselves again on every re-render (and
 * twice per render under StrictMode). Resolving the list once, in a `useMemo`
 * keyed on the items, is the correct shape of the call. The dispatcher takes
 * the decision as a prop for exactly this reason.
 */
export function shapeFeed(items: readonly FeedItem[], session: ShapeSession = newShapeSession()): ShapeDecision[] {
  return items.map(item => chooseCardShape(item, session))
}

/**
 * The five categories `lib/uiHelpers.CAT_COLORS` maps. Kept as a list of keys
 * rather than importing the map so this file stays free of CSS var strings and
 * testable under node. `uiHelpers.CAT_COLORS` remains the single source for the
 * hues themselves; a card looks the hex up there and never hard-codes one.
 */
export const CATEGORY_HAS_HUE: readonly string[] = ['events', 'welfare', 'labs', 'operations', 'content'] as const

// ── The catalogue ────────────────────────────────────────────────────────────

/** Whether the live database can currently produce a row that reaches a shape. */
export type ShapeDataState = 'live' | 'partial' | 'none'

export interface ShapeEntry {
  id: CardShape
  name: string
  family: CardFamily
  /** The selection rule, as printed on the card in the design catalogue. */
  when: string
  /** Why the shape is the shape. */
  why: string
  data: ShapeDataState
  /** Counted, not sampled. See CHANGELOG_SEC10_34.md. */
  dataNote: string
}

/**
 * All 30, in catalogue order, each carrying its predicate and its measured data
 * state. A shape with nothing to render still lives here with its predicate
 * written down, so adding it later is a data question and not a design one.
 *
 * The counts behind `data` are from the real posts table: 586 published,
 * undeleted rows. welfare 523 / events 26 / content 37. Authors: org account
 * 1143 x576, member 477 x9, member 1150 x1. 583 bodies are title / blank line /
 * sentence, 3 are a single line. NONE exceeds 900 characters.
 *
 * CORRECTED 2026-09-06, remeasured live against post_feed_view (585 rows,
 * counted not sampled). Two claims that stood here were flatly false and had
 * propagated into four per-shape dataNotes:
 *   - "`stats` is [] on all 586" -- 543 of 585 carry a non-empty `stats`.
 *   - "There are no image columns on `posts` at all" -- there is an `images`
 *     json array, and 504 rows carry exactly one image. 0 carry two or more,
 *     81 carry none. This one mattered most: it told every reader that the
 *     feed could not show a photo, which is the opposite of true, and it sent
 *     C01/C02/C03/C04 to the wrong diagnosis.
 * Also measured: 0 bodies in the 240-600 window (541 under 180), 0 over 900,
 * and no width/height column anywhere -- see C01's note, which is the only
 * shape blocked by a missing field rather than missing rows.
 *
 * 2026-09-07: the owner authorised correcting the `data:` VALUES too, and C03
 * was changed 'none' -> 'live'. It was REVERTED within the hour, because
 * feedShape.test.ts:69 ("records the shapes the real table cannot populate")
 * asserts the exact sorted list of unpopulatable ids, and ACCEPTANCE.md
 * requires that test to pass UNMODIFIED. So the value and the test are one
 * decision, not two: C03's 'none' is demonstrably wrong (36 of 51 cards on the
 * real feed, 2026-09-07) and stays wrong until the owner unfreezes the test.
 * The dataNote below says so. Logic and the test file remain unchanged.
 */
export const SHAPE_CATALOGUE: readonly ShapeEntry[] = [
  { id: 'C01', name: 'full-bleed hero', family: '05-posts', when: 'featured, exactly one landscape image, body under 240', why: 'one post per session earns the loudest shape, and the type sits on the photo so the image carries it', data: 'none', dataNote: 'blocked by aspect >= 1.2, NOT by images. 504 rows carry exactly one image; what is missing is a width/height pair, which exists nowhere in post_feed_view, the Post type or imageUrl.ts. The only shape blocked by a missing FIELD rather than missing rows. (remeasured live 2026-09-06)' },
  { id: 'C02', name: 'photo + colour block', family: '05-posts', when: 'image present, mapped category hue, body 120 to 600', why: 'photo up top, type on a solid category ground, scannable by colour alone', data: 'live', dataNote: 'REACHABLE since 2026-09-11. The 240 floor made this impossible rather than rare: 0 of 586 rows fell in 240-600. Remeasured, the corpus sits at 6 under 60, 225 at 60-119, 311 at 120-179, 10 at 180-239, 34 over 600. The owner authorised moving the floor to 120 (ACCEPTANCE.md §E), which makes 321 rows eligible; rule 3 caps (ten-row gap, different hue) decide how many render.' },
  { id: 'C03', name: 'standard photo post', family: '05-posts', when: 'image present, no flags, any length', why: 'the workhorse. white ground, inset photo, quiet meta', data: 'live', dataNote: 'REACHABLE, and the single most reachable content shape: 504 of 585 rows carry exactly one image, and C03 measured at 36 of 51 cards on the real feed. The old note here ("posts has no image columns at all") was the exact opposite of true. This value read none until 2026-09-07 and was WRONG; correcting it needed feedShape.test.ts unfrozen too, because that test pins the exact set of unpopulatable ids. The owner made that call on 2026-09-07 and both were corrected together. (remeasured live 2026-09-06; feed sample 2026-09-07)' },
  { id: 'C04', name: 'stacked collection', family: '05-posts', when: 'three or more images, or a drive album', why: 'stacked and tilted reads as "there is more inside" without spending three cards of height', data: 'live', dataNote: 'REACHABLE since 2026-09-11. The 2026-09-06 count ("0 of 585 rows carry even TWO") was true of what reached the app and false of the database: post_feed_view emitted only welfare_projects.main_image and dropped image_1..image_4. 100 projects carry three or more photos. The view now emits all five columns, and 100 rows qualify. (frontend/scripts/post_feed_view_all_welfare_images_2026_09_11.sql)' },
  { id: 'C05', name: 'pull quote', family: '05-posts', when: 'no image, body under 180', why: 'short text has nothing to fill a photo card with, and at quote scale it becomes deliberate', data: 'live', dataNote: 'the 3 single-line bodies and every short post land here' },
  { id: 'C06', name: 'long read, blog', family: '04-editorial', when: 'source is blogs and read time over 3 min', why: 'a blog is not a status. it gets a rule and a read time; its counts sit in the footer rather than beside the headline', data: 'live', dataNote: 'REACHABLE since 2026-09-11. The old note ("no post body exceeds 900 characters... reachable only from the blogs table") measured the wrong thing: post_feed_view already JOINS blogs, so 36 blog rows are in this feed and 34 of them exceed 600 characters. What actually blocked it was the card, not the data - CardLongRead rendered no engagement row, so a blog routed through it would silently lose like/bookmark/comment/share, and it was excluded from SHAPED_SHAPES for exactly that reason. The owner authorised giving it `extras` and a MetaRow on 2026-09-11 (ACCEPTANCE.md §E).' },
  { id: 'C07', name: 'text post, medium', family: '05-posts', when: 'no image, body 180 to 600', why: 'plain paper, generous leading, one hue rule at the left. reads like a note, not a broken photo card', data: 'live', dataNote: 'the workhorse for this dataset. every imageless post that is not overridden to C25 lands here' },
  { id: 'C08', name: 'pinned notice', family: '00-chrome', when: 'pinned = true', why: 'a pin outranks everything in the sort, so it must read as chrome rather than a post', data: 'live', dataNote: 'posts.pinned is a real column and the notice board writes it, capped at 3' },
  { id: 'C09', name: 'drive, upcoming', family: '03-records', when: 'source is welfare_projects and the date is in the future', why: 'only the date and whether there is room matter, so both go at display scale', data: 'live', dataNote: '2,031 welfare_projects rows carry workshop_date, location and main_image' },
  { id: 'C10', name: 'project, in flight', family: '03-records', when: 'source is projects and status is active', why: 'a project is a commitment, not a moment. it shows a target, a bar and who is on it', data: 'partial', dataNote: 'welfare_projects has no target/progress pair, so the bar renders as a live marker until one exists' },
  { id: 'C11', name: 'project delivered', family: '03-records', when: 'source is projects, status complete', why: 'a finished project stops asking for anything. the number goes big and the bar disappears', data: 'live', dataNote: '486 of 2,031 drive rows carry both a photo and a key_statistic' },
  { id: 'C12', name: 'achievement verified', family: '03-records', when: 'source is external_achievements, verified', why: 'an achievement is somebody else vouching for you, so the seal is the content', data: 'live', dataNote: 'external_achievements is live and has a review desk behind it' },
  { id: 'C13', name: 'certificate issued', family: '03-records', when: 'source is certificate_requests, status issued', why: 'a certificate is a document. mono, ruled, perforated, so it reads as a record', data: 'partial', dataNote: 'certificate_requests exists; hours and drive counts are not columns on it, so both render as live markers' },
  { id: 'C14', name: 'new member welcome', family: '01-moments', when: 'member approved under 48h ago, first appearance', why: 'the one card that exists to be replied to. it asks for a greeting, not a like', data: 'live', dataNote: 'members.approved_at and status = active carry it' },
  { id: 'C15', name: 'birthday', family: '01-moments', when: 'today matches a birthday and birthday_public is true', why: 'a one-day card. loud, then gone, and it never shows an age', data: 'live', dataNote: 'members.birthday plus members.birthday_public, an opt-IN. null means private' },
  { id: 'C16', name: 'member on a break', family: '01-moments', when: 'a teammate has an active break and you share a team', why: 'stops people wondering why someone went quiet. calm, with nothing to action', data: 'live', dataNote: 'members.break_start / break_end / break_reason. one break at a time, not a history' },
  { id: 'C17', name: 'team spotlight', family: '06-digest', when: 'a team gained 5 or more members this week', why: 'recruitment momentum is worth showing, and avatars carry it better than a sentence', data: 'none', dataNote: 'needs a weekly per-team join aggregate. no endpoint fetches one, and section 34 adds none' },
  { id: 'C18', name: 'referral nudge', family: '02-asks', when: 'your team has an open role and you have invited nobody in 30 days', why: 'the ask is specific, addressed to you, and one tap', data: 'live', dataNote: 'referrals and referral_clicks are live tables, section 15' },
  { id: 'C19', name: 'job opening', family: '02-asks', when: 'source is job_openings, status open', why: 'a role is a decision with a deadline. applicant count and closing date do the persuading', data: 'live', dataNote: 'job_openings and job_applications are both live' },
  { id: 'C20', name: 'shikshaq class', family: '03-records', when: 'source is classes, upcoming session', why: 'a class has a teacher, a level and a room. three facts, laid out as a table', data: 'none', dataNote: 'there is no classes table in the schema. searchService returns a classes KEY, not a table' },
  { id: 'C21', name: 'crftd drop', family: '03-records', when: 'source is crftd products, status live', why: 'a product drop is commerce, so it looks like commerce', data: 'none', dataNote: 'there is no products table in the schema' },
  { id: 'C22', name: 'impact roundup', family: '06-digest', when: 'weekly digest, fires Sunday evening', why: 'a week is a summary, not a story. four numbers in a grid beats four separate cards', data: 'none', dataNote: 'needs a weekly aggregate endpoint. none exists, and the four figures would have to be invented' },
  { id: 'C23', name: 'offline queued', family: '00-chrome', when: 'the post failed to send and is waiting', why: 'a failure needs to look like a state, not an error', data: 'partial', dataNote: 'the shape is ready; nothing in the app queues a post offline yet' },
  { id: 'C24', name: 'loading skeleton', family: '00-chrome', when: 'the first paint before data lands', why: 'the same geometry as a real card, so nothing reflows when the content arrives', data: 'live', dataNote: 'every feed fetch has a pending state' },
  { id: 'C25', name: 'compact rows', family: '07-fallback', when: 'scored below the fold, or fourth and later from one author', why: 'low-signal posts still deserve to exist. at row scale ten fit where one card did', data: 'live', dataNote: '576 of 586 posts are from the org account, so rule 7 fires constantly. NOTE: one post per card renders this with a count of 1, which reads as broken - grouping adjacent same-author rows is done by feed/cards/feedCompose.ts, not here.' },
  { id: 'C26', name: 'poll', family: '02-asks', when: 'post has poll_options and the poll is open', why: 'a question is the one post type where reading it is not the action', data: 'none', dataNote: 'posts has no poll_options column' },
  { id: 'C27', name: 'countdown', family: '02-asks', when: 'an event is under 72h away and you have a place', why: 'under three days the date stops being information and becomes a countdown', data: 'partial', dataNote: 'welfare_projects carries workshop_date, but nothing records a confirmed place on an event' },
  { id: 'C28', name: 'milestone', family: '06-digest', when: 'an org counter crosses a round number', why: 'a milestone is a single number and the sentence that earns it', data: 'none', dataNote: 'no counter is watched for a crossing, and the only canonical figures are the AboutPage ones' },
  { id: 'C29', name: 'nothing new', family: '07-fallback', when: 'the feed has no unseen items for this member', why: 'an empty feed is an answer, not a failure', data: 'live', dataNote: 'terminal. replaces the list rather than appending to it' },
  { id: 'C30', name: 'volunteer ask', family: '02-asks', when: 'a drive is under 48h away and under half full', why: 'the only card that addresses a gap rather than a result', data: 'partial', dataNote: 'welfare_projects.volunteers exists as prose, not as a filled/needed pair, so the shortfall renders as a live marker' },
] as const

/** Sanity helper for the catalogue page and the tests. */
export function shapesInFamily(family: CardFamily): ShapeEntry[] {
  return SHAPE_CATALOGUE.filter(s => s.family === family)
}
