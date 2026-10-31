# 15 · Post cards

**Files touched:** `frontend/src/feed/cards/*` (the 30 card components + `registry.ts` +
`CardCatalogue.tsx`), `frontend/src/feed/FeedPostCard.tsx`, `frontend/src/styles/routes/feed.css`,
`frontend/src/styles/v6.css` (deletions).
**Design source:** `AquaTerra Feed.dc.html` — `13a` (the eight live shapes), `13b` (the blocked twelve).
**Prerequisites:** `00` (tokens), `13` (stickers), and **you must read `lib/feedShape.ts` before
touching anything in this file.**

## Global invariants (restated — do not skip)

1. **No new colours.** 2. **No new fonts or weights.** 3. **No copy changes.**
4. **No route changes.** 5. **No Supabase changes** — and this file is where that bites hardest.
6. **No new dependencies.** 7. **Hit targets >= 44x44.** 8. **`prefers-reduced-motion` coverage
must not regress.** 9. **Do not touch `src/paradox/**`.**

## 15.0 · THE RULE THAT GOVERNS THIS ENTIRE FILE

**`lib/feedShape.ts` is the authority on which card renders. This file only changes how each
card looks.**

Do not add a shape. Do not remove a shape. **Do not reorder the eight families or the rules
inside a family** — the file says both orders are load-bearing and says it twice. Do not touch
`chooseCardShape`, the caps, `newShapeSession`, `splitPostBody`, `isRealPostBody`,
`imageCountOf`, `CATEGORY_HAS_HUE` or `SHAPE_CATALOGUE`. Do not change `CardDisplay`.

`feedShape.test.ts` exists and must still pass, untouched, when you are done. **If a test needs
editing, you have changed behaviour and gone outside this file's scope.**

**The two guardrails the code already names, restated because a restyle is exactly when they get
broken:**

- **Rule 2 — a card gets a photo only for its own row.** `imageUrl` empty means the card gets no
  photo. **Never borrow an image from another row, a category default, or a placeholder asset to
  fill a layout.** A card with no photo must look deliberate, not broken. That is why C05 and C07
  are designed as text-first objects rather than photo cards with the photo missing.
- **Rule 4 — never substitute a zero.** `CardFigure.value === null` means the host could not
  resolve the figure, and the card renders **the dashed live marker**. A zero is a claim.

## 15.1 · The data reality — read this before you judge the designs

Counted from the live table, quoted from `feedShape.ts`:

| fact | consequence |
|---|---|
| **`posts` has no image columns at all** | C01, C02, C03, C04 are `data: 'none'`. **No post can render a photo today.** |
| **586 published rows; 576 from one org account** | The author cap (`AUTHOR_CAP = 4`) fires constantly. **C25 is the most-rendered card in the product.** |
| **No body exceeds 900 characters** | C06 long read is unreachable from `posts`; only `blogs` reaches it. |
| **`stats` is `[]` on all 586** | Any card printing a figure from `stats` prints the live marker. |
| **583 of 586 bodies are title / blank line / sentence** | `splitPostBody()` gives a real headline. **Never slice by character count.** |
| **`welfare_projects` has 2,031 rows with `main_image`** | **The feed's photography comes from drives, not posts.** |
| **486 of those carry photo + `key_statistic`** | C11 is the strongest photographic card available. |
| **Post 774 is live junk (`"xcv xv"`)** | `isRealPostBody()` filters at render time. **Keep it.** |

**So the honest conclusion, and it is a design conclusion:** this is a **text-led feed with
photographic drive records in it**, not a photo feed. Designing it as a photo feed produces empty
frames. `13a` designs the eight shapes that can actually be filled; `13b` records what the other
twelve need.

## 15.2 · Shared card chrome — applies to all 30

- **SET** every card shell: `background: var(--card)`, `border: var(--hair-2)`
  (`1px solid rgba(10,10,10,.08)`), `border-radius: var(--r-outer)` (32),
  `padding: var(--pad-card)` (10), `box-shadow: var(--lift-1)`.
- **DELETE** every `border: 2px solid var(--ink)` / `3px solid var(--ink)` and every
  `box-shadow: Npx Npx 0 var(--ink)` from card shells. The offset survives only on
  `.btn-primary` and stamped stickers (`00.6`).
- **SET** inner blocks (photo, well, quote panel) to `var(--r-inner)` (22); thumbnails and
  attachment tiles to `var(--r-tight)` (14). **32 − 10 = 22. 22 − 8 = 14.**
- **DELETE** any `outline` on card images — `outline` ignores `border-radius` and draws a square
  across the corners (`00.15`).
- **SET** the author row: 32–38px avatar, name `700 13–14px var(--eina)`, `VerifiedTick` when
  `isOfficialAccount`, mono meta at `9.5–10.5px` in `var(--ink-3)`.
- **KEEP** `hashColor` / `getInitials` / `timeAgo` from `lib/uiHelpers`. **Do not hand-roll any of
  the three** — `03.5.3` already deletes four local duplicates.
- **KEEP** the `member?.uuid === post.authorUuid` self-vs-public profile branch.
- **KEEP** `eager` on the first card's image and `loading="lazy"` on the rest. The feed has no
  hero, so card 0's photo is the LCP element.
- **KEEP** `FeedPostCard`'s `memo`.
- **KEEP** `useFeedCardBatch` for saved-state and linked openings. **Never let a card self-fetch**
  — the performance audit flags that N+1 at `PostPage:938`, `TeamDetailPage:1307` and
  `SearchPage:259`.

### The engagement footer, standardised

`border-top: var(--hair)`, 44px bare-glyph buttons, tabular-nums counts.
Like glyph `var(--tomato)` filled with the count in `var(--tomato-ink)` (#C6300F, 6.7:1 on cream).
**Never `var(--tomato)` as the count's text colour** — accent-as-text on cream fails
(`DESIGN.md` §2). Comment and save glyphs are `var(--ink-2)` strokes.
**KEEP the optimistic like/save pattern and the toast-after-write ordering** — `FeedPostCard`
documents that as a deliberate fix.
**ADD `aria-live="polite"`** to the like and save count announcements (gap 28).

## 15.3 · C08 · pinned notice — `00-chrome`, live

A pin outranks everything in the sort, so **it must read as chrome, not as a post.**

- **SET** the shell to **`background: var(--ink)`** — the one inverted card in the feed. Radius 32.
- **SET** a header row: a lemon pin glyph + mono uppercase label in `var(--nav-fg-faint)` (5.6:1).
- **SET** the body into a `var(--nav-well)` inset at radius 22: title
  `900 19px var(--display)` in `var(--nav-fg)`, body `400 13.5px var(--eina)` in
  `var(--nav-fg-dim)` (0.78, 9.4:1).
- **SET** the action to a full-width lemon pill, **ink text** (15.1:1), `min-height: 44px`.
- **KEEP** the 3-pin cap and whatever strings the notice board writes.
- **No engagement footer.** Chrome is not liked.

## 15.4 · C15 · birthday — `01-moments`, live

"A one-day card. Loud, then gone, **and it never shows an age.**"

- **SET** the shell to `background: var(--pink)` full-bleed at radius 32, with one bleeding
  `rgba(10,10,10,.09)` circle top-right for depth.
- **SET** a 60px ink avatar disc centred, then `happy birthday, {first name}.` at
  `900 26px var(--display)` in **ink** (pink is 6.4:1 with ink; paper on pink fails).
- **SET** two actions: a full ink pill (primary) and a `rgba(10,10,10,.1)` pill (secondary),
  both radius 22, `min-height: 46px`.
- **NEVER render an age, a birth year, or a date.** `birthday_public` is an **opt-in** and an age
  is not what was opted into — `family01Moments.tsx` states this in a comment. **This is the one
  rule on this card that is not aesthetic.**
- **KEEP** the moments cap: seen once, suppressed for the rest of that day, and a suppressed
  moment **falls through to the next family** rather than blocking.
- **The private acknowledgement on your own profile is a different surface** (`04.7`) and fires
  **regardless of the toggle**. Do not merge the two.
- **The 🎂 in `BIRTHDAY_BODY_RE` comes from the database template** (`create_birthday_notice()`).
  It is the one legal emoji in the product. **Do not remove it and do not add siblings.**
- **Secondary action label:** the catalogue's `CardCatalogue.tsx` C15 entry carries
  `ctaLabel: 'Wish her'` and `secondaryLabel: 'See wall'`. **`Wish her` is gendered** — read the
  live string before shipping; if it is really gendered that is a copy bug worth raising, but
  **fixing it is a copy change and needs approval.**

## 15.5 · C14 · new member welcome — `01-moments`, live

"The one card that exists to be replied to. **It asks for a greeting, not a like.**"

- **SET** a welfare-filled block at radius 22 inside the white shell: 52px ink avatar, name at
  `900 18px var(--display)`, mono meta in `rgba(10,10,10,.7)`.
- **SET the primary action to an inline comment composer**, not a button: the cream
  `var(--r-pill)` capsule from `03.5.2` with a 34px avatar and a 38px ink send button.
  **This is the design consequence of the catalogue's own sentence.**
- **KEEP `font-size: 16px` on that input** (iOS zoom).
- **KEEP** the profanity gate on submit.
- **No like button.** The catalogue says it asks for a greeting; a like is the way out of greeting.

## 15.6 · C16 · member on a break — `01-moments`, live

"Stops people wondering why someone went quiet. **Calm, with nothing to action.**"

- **The state flag overhangs the card and the name sits BELOW it, with `padding-top: 30px`.**
  Measured in review, 26px left the name's ink clearing the flag by **2px** — correct, but with no
  margin. A longer name, a wrapped line or a font-metric shift makes them touch. **30px is the
  floor; do not reduce it to tighten the card.**
- **SET** a `rgba(126,91,255,.16)` grape-tinted well at radius 22 inside the white shell — the
  quietest treatment in the family. Moon glyph in `var(--grape-ink)`.
- **SET** the sentence from `break_end` using the **exact formatter in `ProfilePage.tsx:383`**:
  `new Date(break_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })`.
  **KEEP the `'T00:00:00'`** — without it the date shifts a day under timezone parsing.
- **DO NOT RENDER `break_reason` ON THIS CARD. Decided 2026-09-05.**
  The card's stated purpose — "stops people wondering why someone went quiet" — is fully served by
  the date. `BREAK_REASONS` may include illness alongside exams, and this card is public to
  everyone who shares a team, on a product used by minors. **Publishing a health fact to satisfy a
  layout is not a trade we make.**
  The reason stays visible to the member on their own profile and to their team lead in the desk.
  **If the current card renders it, removing it is part of this file's work.**
- **No actions at all.** "Nothing to action" is the specification. No like, no comment, no CTA.
- Fires only when **you share a team** with that member. That is the chooser's business, not this
  file's — do not add a check.

## 15.7 · C09 · drive upcoming — `03-records`, live · **your reference A**

The full-bleed photo card, and the only one that can be filled at scale (2,031 rows).

- **SET** the shell to `position: relative; border-radius: 32px; overflow: hidden`, photo
  absolutely filling it, `min-height: 300px`.
- **SET the scrim to a two-stop gradient**, not a flat tint:
  `linear-gradient(to top, rgba(10,10,10,.88) 0%, rgba(10,10,10,.5) 42%, rgba(10,10,10,.1) 100%)`.
  **Paper on the .88 stop measures 14.2:1.** The mobile audit flags "text over busy image" as a
  live risk on `/projects` — a flat tint is what makes that risk real, because a light photo
  defeats it. **Do not replace the gradient with an opacity or a `filter`.**
- **SET** a stamped category sticker top-left, rotated −2.5°, per `13`.
- **SET** the date line in mono uppercase `9.5px` **at full paper opacity** — not an alpha rung,
  because it sits over a photograph where the composite is unpredictable.
- **SET** the title `900 28px var(--display)`, uppercase, `letter-spacing: -.035em`,
  `text-wrap: balance`.
- **SET** the footer to a **cream well at radius 22** carrying the volunteer count and the CTA.
  Pulling those onto paper is what guarantees their contrast regardless of the photo.
- **`filled`/`needed` are `CardFigure`s.** If either is null, **render the dashed live marker, not
  a zero** (rule 4). `feedShape.ts` notes `welfare_projects.volunteers` is **prose, not a
  filled/needed pair** — so expect the marker and design for it.
- **KEEP** `main_image` through `sized()`. **Note it does not rewrite Supabase storage URLs** —
  see `DESIGN.md` §4 rule 1.

## 15.8 · C11 · project delivered — `03-records`, live

"A finished project **stops asking for anything.** The number goes big and the bar disappears."

- **SET** photo at radius 22 (`aspect-ratio: 16/10`), then `key_statistic` at
  **`900 52px var(--display)`**, `line-height: .84`, `letter-spacing: -.05em`, `tabular-nums`,
  with a mono uppercase unit label beneath.
- **NO progress bar.** Deleting it is the point of the shape.
- **SET** a `var(--paper)` `delivered` pill top-right on the photo.
- **KEEP** the title as `700 17px var(--eina)` — the statistic is the headline here, not the name.
- Footer: mono completion date + a quiet cream `Read it →` pill. **No like button** — a delivered
  record is not asking for approval.

## 15.9 · C05 · pull quote — `05-posts`, live · **your reference C**

"Short text has nothing to fill a photo card with, and **at quote scale it becomes deliberate.**"

This is the index-card reference, and the nesting is exactly your image:

    tinted hue backing (32)  →  white card (22)  →  lined ground  →  seal breaking the corner
                                                                  →  author pill overhanging the base

- **SET** the outer shell to a **saturated hue fill** (category-derived via
  `uiHelpers.CAT_COLORS`), radius 32, `padding: 10px`.
- **SET** the inner card `background: var(--card)`, radius 22, and give it the lined ground:
  `repeating-linear-gradient(to bottom, transparent 0 30px, rgba(10,10,10,.07) 30px 31px)`
  with `background-position: 0 14px` so the first rule sits under the first line, not through it.
- **SET** the quote `400 20px/1.55 'Instrument Serif'` **italic**, `max-width: 78%` so the seal
  has room, `text-wrap: pretty`.
  **This is the one place the serif carries a whole paragraph.** Everywhere else it is one word.
- **SET** an arc-set seal (`13`) at ~80px, rotated 9°, breaking the top-right corner.
  **The seal's text must not be invented per-card** — use one fixed label.
- **SET** the author as an avatar pill **overhanging the inner card's bottom edge**
  (`margin-top: -16px`, `width: fit-content`, small drop shadow).
- **Body comes from `splitPostBody().title`** when there is no blank line — for the 3 single-line
  rows, the whole body *is* the quote.

## 15.10 · C07 · text post — `05-posts`, live · **the workhorse**

Every imageless post that is not overridden to C25 lands here. On this dataset that is most of
the feed.

- **SET** a **4px `var(--r-pill)` category rule** down the left inside the shell, inset 8px top
  and bottom. **This replaces the photo as the card's colour signal** — it is why a text card in
  this feed still scans by colour.
- **SET** the title from `splitPostBody().title` at `700 18px/1.28 var(--eina)`,
  `letter-spacing: -.02em`, `text-wrap: pretty`.
- **SET** the body from `.rest` at `400 15px/1.66 var(--eina)` in `var(--ink-2)`.
- **KEEP `FeedPostCard`'s `headline`/`rest` word-boundary split** (`LIMIT = 120`, sentence-boundary
  search, the `> 40` guards). It exists to stop mid-word cuts across two type styles.
  **Do not replace it with `-webkit-line-clamp`** — a clamp cannot split across two styles.
- Full engagement footer per 15.2.

## 15.11 · C25 · compact rows — `07-fallback`, live · **the most-rendered card**

"Low-signal posts still deserve to exist. At row scale ten fit where one card did."

**This fires on 576 of 586 posts and has been treated as a consolation prize. It is the feed's
primary reading experience and must be designed like it.**

- **SET** the shell as a normal white card (32/10), **not** a bare list.
- **ADD a real header**: a mono uppercase label naming what collapsed
  (e.g. the author), and the row count in mono tabular-nums on the right.
- **SET each row**: `min-height: 44px`, `border-radius: var(--r-inner)`, `padding: 9px 8px`,
  `display: flex; gap: 11px`, a **5px category dot**, the title at `600 13.5px var(--eina)`
  single-line with `text-overflow: ellipsis`, and a mono age on the right.
- **SET `:hover` / `:focus-visible` to `background: var(--bg)`** — the rows are links and must
  say so.
- **ADD a `Show N more` cream pill** when the group exceeds 4 rows. **Not infinite** — the group
  is a group.
- **`rows` is a real field on `CardDisplay`** (`{ id, name, verb, time, avatar?, href? }`).
  Use `verb` as given; **do not template a new sentence.**
- **Every row needs `href`.** A collapsed row that cannot be opened is worse than a card.

## 15.12 · C29 · nothing new — `07-fallback`, live, terminal

"An empty feed is **an answer, not a failure**." It **replaces the list**, never appends.

- **SET** a cream well at radius 22 inside a white shell: a 52px welfare tick disc, a
  `900 20px var(--display)` line, and one `400 13.5px` sentence in `var(--ink-3)`, centred,
  `max-width: 250px`.
- **DELETE any dashed border** (`00.12`).
- **KEEP whatever strings ship today.** The mock's `that's everything.` and
  `You're caught up. An empty feed is an answer, not a failure.` are **invented** — the second is
  a paraphrase of a source *comment*, not a user-facing string. **Do not ship either without
  approval.**

## 15.13 · C24 · loading skeleton — `00-chrome`, live

"The same geometry as a real card, **so nothing reflows when the content arrives.**"

- **The skeleton must match the shape that will actually arrive.** On this dataset that is
  **C07 and C25**, not a photo card. A photo-shaped skeleton resolving into a text card is the
  reflow this shape exists to prevent — and `01.17` already flags the current skeleton as
  avatar-first when the card is not.
- **SET** `background: var(--bg-2)` blocks at the real radii. `prefers-reduced-motion` removes the
  shimmer and leaves the blocks static.

## 15.14 · C23 · offline queued — `00-chrome`, **partial**

"A failure needs to look like **a state, not an error**."

The shape is ready; **nothing in the app queues a post offline yet.** So:
- **Restyle it, do not wire it.** A lemon-tinted well at radius 22, a mono `queued` label, the
  body as written, and a single `Retry` pill.
- **Do not build an offline queue in this file.** That is a service change (invariant 5).

## 15.15 · The twelve blocked shapes

Design source `13b`. **Restyle each to match 15.2's chrome so it is ready, then leave it
unreachable.** Do not delete a shape and do not fabricate data to reach one.

| shapes | what they need |
|---|---|
| C01 C02 C03 C04 | **an image column on `posts`** — unlocks four shapes at once |
| C06 | reachable from `blogs` only |
| C10 C13 C27 C30 | the row exists, the figure does not → **dashed live marker, never a zero** |
| C17 C22 C28 | a weekly aggregate endpoint that does not exist |
| C20 C21 C26 | no `classes` table, no `products` table, no `poll_options` column |
| C23 | nothing queues offline yet |

**The single highest-value data change in the product is an image column on `posts`** — but note
it makes the 50–100 MB upload problem urgent, not theoretical (`DESIGN.md` §4 rule 1).

## 15.16 · `CardCatalogue.tsx`

It renders all 30 as a specimen page. **Update it in the same pass** — a catalogue that shows the
old cards is worse than none, because it is the thing a future designer will trust.
**Keep its per-card predicate and data-state labels**; they are the honesty mechanism.

## Verification

1. `feedShape.test.ts` passes **unmodified**.
2. `chooseCardShape` is byte-identical.
3. No card self-fetches; `useFeedCardBatch` still supplies saved-state and openings.
4. Radii are only 999 / 32 / 22 / 14.
5. No accent hue used as `color` on cream or white anywhere.
6. Paper over every photo scrim measures >= 4.5:1 at the darkest stop.
7. **Zero horizontal overflow at 375px and 360px.**
8. C15 renders no age. C16 renders no action. C14 renders no like.
9. Every C25 row has an `href` and a >= 44px hit area.
10. The skeleton's geometry matches C07/C25, not a photo card.

## A note on strings in this file

**Read from source and safe to type:** the `CardCatalogue` C15 entry's
`It is Maria birthday.` / `Wish her` / `See wall` (**and `Wish her` looks like a real copy bug —
raise it, do not silently fix it**), and every catalogue `when`/`why`/`dataNote` string.

**Invented by the mock and needing approval:**
`Applications for the winter cohort close on Sunday.` · `Nine roles across five teams. One form,
five minutes.` · `See the roles →` · `happy birthday, Mohit.` · `Wish him` · `His wall` ·
`say hello…` · `Khidirpur book drive` · `I'm in` · `volunteers` · `delivered` ·
`bananas distributed` · `Feeding drive, Sealdah station` · `Read it →` ·
`★ FROM THE FIELD ★` · `also from aquaterra` · `Show 2 more` · `that's everything.` ·
`You're caught up. An empty feed is an answer, not a failure.` · every row title in C25.

**Everything else: KEEP whatever ships today.** Open the card component, use its real strings.

## Unresolved after this file

1. **Is `Wish her` really in the live catalogue?** If so it is a gendered string on a card shown to
   everyone. **The bulk copy approval does NOT cover this** — a bulk approval of *my* invented
   strings cannot approve changing a string that already ships. Raise it; do not silently fix it.
2. **Does `welfare_projects` expose a filled/needed pair anywhere**, or is `volunteers` prose in
   every row? Decides whether C09's counter is a figure or a marker.
3. ~~Which `BREAK_REASONS` are safe publicly?~~ **RESOLVED: none. C16 shows the date only.**
4. **Does `CardCatalogue.tsx` render live rows or fixtures?** Decides whether restyling it is safe.
5. **C25's header label** — the mock says "also from aquaterra"; what should it say when the group
   collapsed for being *below the fold* rather than *same-author*? The chooser distinguishes the
   two (`05.7` has two rules); the card currently would not.
6. **`AQ Feed Cards.dc.html`** — the upstream 30-shape catalogue I have not opened. It may already
   answer several of these, and it should be read before this file is built.
