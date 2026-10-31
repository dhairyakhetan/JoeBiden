# Graphic generator variety + brand-correctness pass

**Date:** 2026-07-02
**Status:** Approved

## Context

AquaTerra has four canvas-based graphic generators, all sharing one `brandKit`
(palette, fonts, canvas primitives) exported from `posterGenerator.ts`:

| File | Purpose | Current templates | Brand-aligned? |
|---|---|---|---|
| `posterGenerator.ts` | Single-image poster from a feed post (Post 4:5 / Story 9:16) | 10 (5 typo + 5 photo) | Uses `brandKit` tokens, but **0/10 templates use `creamBg`** — every template is dark-field or accent-flood |
| `carouselGenerator.ts` | Multi-slide deck from a welfare project | Deck-slot system: `slideCover` (3 sub-looks), `slideText` (4), `slideStat` (2), `slidePhoto` (1), `slideClosing` (1, **always identical**) | Yes — `slideText`/`slideCover` correctly lead with cream |
| `blogGenerator.ts` | Blog-post share graphic (Post/Story format) | 6 (4 photo + 2 typo) | Imports `brandKit`, but its 2 no-photo templates (`bEditorial`, `bRansom`) default to dark/flood only — no cream branch |
| `StoryGenerator.ts` | IG/WhatsApp Story behind every post/opening "Share" button | 2 total, **1 fixed look per type** | **No** — duplicates an old, different palette; never imports `brandKit` |

The brand kit's own documented law (see the `creamBg` comment in
`posterGenerator.ts`): *cream paper is the lead surface for most slides; ink-dark
is the deliberate one-slide-per-deck exception, not the default.* Three of the
four generators violate this to varying degrees. Fixing that gap **is** the
branding fix the user asked for, and every fix adds a new, genuinely distinct
template — so the "add variety" and "make more on-brand" asks are the same
change.

User has confirmed: full scope (all four files), "go big" on variety (aim to
roughly double the effective template count per generator), include the
`pGalleryGrid` multi-image poster template (small data-contract addition), and
the phase order below.

## Non-goals

- No new UI/UX pattern. Every studio modal (`PosterStudioModal`,
  `CarouselStudioModal`, `BlogStudioModal`, `ShareModal`) keeps its existing
  "regenerate = reroll a random template from the pool" interaction. No
  template picker is being added.
- No change to carousel deck length (still capped at 5 slides: cover + up to 3
  middle + closing) — this phase adds variety *within* slots, not more slots.
- No change to the previously-decided scope-out of the brand kit's
  Arcade/Pixel and Circular Motif archetypes — still judged a thematic
  mismatch for a welfare NGO's photo content. Minimal/Premium and Serif
  Institutional *are* in scope this time (see blog Phase 2, poster Phase 3) —
  they fit blog/poster's more reflective content better than they fit a
  crowded project carousel.

## Architecture (unchanged, extended)

Every generator follows the same shape and this work doesn't change it:

```
template pool (array of functions) → seeded pick(r, POOL) → template(ctx) draws
```

New templates are just new functions added to the relevant pool array (and the
`Map<Function, string>` name lookup, where one exists). `StoryGenerator.ts` is
the one file gaining this shape — today it has no pool, no RNG-driven pick, and
no `brandKit` import; it hardcodes one function call per story type.

All new templates:
- Import shared primitives from `brandKit` (`creamBg`, `hardShadow`, `logo`,
  `fitHeadline`, `drawLines`, `star`, `rrect`, `chip`, `sticker`, `decorate`,
  `stripEmoji`, etc.) — no re-duplicating canvas logic.
- Follow the existing pill-logo law (`onLight` on cream, `surface:'photo'` pill
  on photos, cream pill everywhere else).
- Get emoji stripped from incoming text the same way existing templates do
  (`stripEmoji`, already centralized per-generator).
- Use `hardShadow` (not `shadowBlur`) for any drop-shadow, per brand law.

---

## Phase 1 — StoryGenerator.ts (rebuild)

**Problem being fixed:** `ShareModal`'s "regenerate" button is currently a dead
click — there is exactly one design per story type, so regenerating produces
byte-identical output. This is the single highest-frequency touchpoint (every
post/opening share) and the most visibly broken.

**Change:**
1. Migrate off the duplicated local palette (`MINT='#00E5A0'`, `PINK='#FF6BD6'`,
   etc.) onto `import { brandKit } from './posterGenerator'`, matching
   `blogGenerator.ts`/`carouselGenerator.ts`. `W=1080, H=1920` stays (Stories
   are a fixed format, unlike Post/Story-toggle poster/blog).
2. Add a seeded RNG pick (`mulberry32`, same pattern as the other three
   generators) so `generateStory` produces a new look each call.
3. Build two template pools:

**Post-share pool** (5 templates, up from 1):
- `sImageFull` — full-bleed post photo (today's look, refined onto shared
  scrim/logo/pill helpers). Falls back to a dark field if no photo.
- `sCreamCard` *(new)* — cream paper background, a bordered white card
  (hard-shadowed) holding the excerpt + category chip + author line. Fills the
  cream-lead-surface gap directly.
- `sInkQuote` *(new)* — dark ink field, giant Instrument-Serif quote mark,
  statement set beneath it (mirrors carousel's quote-style `slideText` roll,
  adapted to story proportions).
- `sPolaroidStory` *(new)* — tilted, taped photo near the top on cream paper,
  excerpt below.
- `sAccentFlood` *(new)* — bright accent flood, ink type, giant star
  watermark, category label.

**Opening/recruiting pool** (4 templates, up from 1):
- `oHeroDark` — today's dark hero-with-skill-chips-and-CTA layout, refined
  onto shared helpers.
- `oCreamBoard` *(new)* — cream "job board": bordered role card, outlined
  skill pills, ink CTA button.
- `oAccentBanner` *(new)* — accent-flood top banner ("WE'RE HIRING" giant
  type) over a cream lower panel with role, skills, CTA.
- `oPoster` *(new)* — bold cutout/ransom-style role title (reuses the
  word-box mechanic from poster's `tRansom`/carousel's ransom `slideText`
  roll), maximum-attention option.

**Data:** `StoryData` interface is unchanged (already carries everything these
templates need — `title`/`body`/`authorName`/`category` for post-share;
`openingTitle`/`description`/`skills`/`teamName` for opening).

**Error handling:** same CORS-safe image load pattern as the other three
generators (`loadImage` resolves `null` on failure/timeout, template falls
back to its no-photo branch) — currently `StoryGenerator.ts` has no such
guard at all; this phase adds it.

---

## Phase 2 — blogGenerator.ts (fix + expand)

**Problem being fixed:** `bEditorial`'s only choice is `flood ? accentBg :
darkBg` — no cream branch. `bRansom` is always `darkBg`, unconditionally. Every
blog post without a header image currently renders dark or bright, never on
brand-lead cream paper.

**Fix:**
- `bEditorial`: change the roll from 2-way (flood/dark) to 3-way
  (flood/dark/**cream**), matching the ratio already used elsewhere (roughly
  40% flood, 30% dark, 30% cream). On the cream branch, headline renders in
  ink, decoration uses the ink-on-light palette (`decorate(..., false)`,
  already supported).
- `bRansom`: add a cream background option (word-cutout chips render fine on
  cream — ink border stays, chip fill still rolls from `ACCENTS`/`WHITE`, just
  swap the base fill and make sure ink-colored chips get a contrasting fill
  instead of disappearing into the field).

**Expand** (2 new typographic, 1 new photo — 6 → 10 total):
- `bMinimalCream` *(new, typo)* — quiet editorial mood: small mono kicker,
  large Instrument-Serif italic title (not the black display font), a single
  thin ink rule, byline in mono beneath. This is the "Serif Institutional"
  archetype the brand kit names but nothing currently uses — fits a
  reflective blog essay better than the brutalist-bold templates.
- `bDuotone` *(new, photo)* — mirrors poster's `pDuotone`: header image
  crushed + accent-tinted via an overlay composite, bold headline over a
  bottom scrim. Gives blog posts with a header image a bolder alternative to
  the existing hero/split/card/taped options.
- `bFrame` *(new, photo)* — full-bleed header image inside a thick cream/ink
  double-border "gallery print" frame, title in a cream strip pinned to the
  bottom.

**CTA bar, kickers, bylines**: unchanged, reused as-is by all new templates
(no changes to `ctaBar`/`kicker`/`readTag`/scrim helpers).

---

## Phase 3 — posterGenerator.ts (expand)

**Problem being fixed:** all 10 existing templates are dark-field or
accent-flood. Zero use `creamBg`, despite it existing specifically to be "the
LEAD background for most slides" per its own doc comment.

**New cream-first templates** (4):
- `tCreamStatement` *(new, typo)* — cream paper, big ink headline dead
  center, thin ink rule, accent corner tab, light decoration scatter. The
  flagship "paper poster" — direct cream counterpart to `tInkQuote`.
- `tCreamCard` *(new, typo)* — cream background, a bordered
  hard-shadowed white card floats on it holding the quote + category tab
  (brings the carousel's well-established "card" silhouette to single
  posters).
- `pCreamFramed` *(new, photo)* — photo inside a bordered cream mat
  (gallery-print border), category chip + headline below the frame on the
  cream field.
- `pTornPaper` *(new, photo)* — photo masked with an irregular
  torn/ripped-edge path (procedural jagged clip, seeded so it's reproducible)
  on a cream background — adds genuine textural variety beyond the existing
  clean rectangular frames.

**More range** (2):
- `tSerifEditorial` *(new, typo)* — dark ink field, but pure quiet
  Instrument-Serif italic (no black-display shout) — a deliberately different
  mood from the existing bold/brutalist dark templates.
- `pGalleryGrid` *(new, photo)* — 2-3 photo mosaic when more than one image is
  available. **Requires a data-contract change**: `PosterData.imageUrl` is
  single-image only today. Add `images?: string[]` to `PosterData` (keep
  `imageUrl` for back-compat/single-image templates) and pass the full
  `post.images` array from the two call sites (`FeedPostCard.tsx:499`,
  `PostPage.tsx:725`). `pGalleryGrid` only enters the pool when `images.length
  > 1`; every other template keeps using `imageUrl`/first image exactly as
  today.

Result: 10 → 16 templates. `TEMPLATE_NAMES` map and `TYPO_TEMPLATES`/
`PHOTO_TEMPLATES` pool arrays gain the 6 new entries.

---

## Phase 4 — carouselGenerator.ts (expand weak slots)

**Problem being fixed:** `slideClosing` has exactly one composition — every
deck, regardless of seed, ends on the identical dark "this is what showing up
looks like" slide. `slideStat` never offers a cream option.

**Changes:**
- `slideStat`: add a 3rd roll branch — cream-minimal (big ink number
  directly on cream paper, thin ink rule, no box/card) alongside the existing
  dark-boxed-card and accent-flood branches. Roughly even 3-way split.
- `slideClosing`: add 2 alternates, rolled by seed like every other slot:
  an accent-flood closing (bright field, ink CTA pill, same copy) and a
  photo-backed closing (if the deck has a spare, unused photo — reuse
  whichever project image wasn't already used as cover/photo slide — dark
  scrim + CTA over it; falls back to the existing dark-field look if no spare
  photo exists).
- `slidePhoto`: add a polaroid-style alternate (tilted taped-photo-on-cream,
  matching the poster/carousel scrapbook language already used elsewhere in
  the deck) alongside the existing full-bleed-with-caption-chip layout.
- `slideCover`: add a 4th sub-look — duotone cover (photo pushed through an
  accent-tinted overlay, mirrors poster's `pDuotone`) alongside the existing
  taped/full-bleed/cream-typo options.

No change to `planDeck` (slide-count/ordering logic), `Plan` type, or the
5-slide cap — this phase is purely "more looks per existing slot."

---

## Testing / verification

Same approach used for the prior brand-kit-alignment pass (no automated visual
tests exist for these generators — they're canvas-pixel output):

1. `tsc --noEmit` clean after each phase.
2. Live-generate through each studio modal (`ShareModal`, `BlogStudioModal`,
   `PosterStudioModal`, `CarouselStudioModal`) in the preview browser, forcing
   several different seeds per new template so every new function actually
   gets exercised at least once (not just left dead in the pool).
3. Pixel-sample via `preview_eval` + offscreen canvas (the workaround already
   established this session, since `preview_screenshot` is unreliable in this
   environment) to spot-check: cream backgrounds render as exact `#F4EFE0`,
   logo pill color matches the 3-way law (no-pill on cream / ink pill on
   photo / cream pill elsewhere), no emoji leaks onto any generated PNG.
4. Confirm `pGalleryGrid`'s new `images` prop is optional and every existing
   call site still compiles/renders unchanged when only `imageUrl` is passed
   (back-compat check).
5. Spin up each generator with a seed loop (e.g. seeds 0-30) and log which
   template name got picked each time, to sanity-check the pool's weighting
   feels reasonably even before final commit (catches an accidentally
   near-zero-probability branch).

## Rollout

Four independent commits, in the phase order above (Story → Blog → Poster →
Carousel) — each phase is self-contained (touches one generator file, plus for
Phase 3's `pGalleryGrid` the two poster-studio call sites) and independently
shippable, matching how the prior brand-kit-alignment pass was actually
committed (`c3667bc`, `7b5a73c`, `c734b1a`). Build + verify after each phase
before moving to the next, not one giant combined commit.
