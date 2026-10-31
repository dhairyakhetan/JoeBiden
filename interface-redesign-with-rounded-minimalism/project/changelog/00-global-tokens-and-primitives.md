# 00 · Global tokens and primitives

**Design source:** none, and deliberately — this file defines the tokens and primitives that
*every* turn in `AquaTerra Feed.dc.html` is drawn from. There is no single turn to compare it
against; instead, **every other file's design source depends on this one being correct first.**

**Files touched:** `frontend/src/styles/tokens.css`, `frontend/src/styles/v6.css`, `frontend/src/index.css`
**Nothing else.** Do not open a page or component file while working this document.
**Verify before moving on:** run the app, load `/`, and confirm nothing crashes and the page still
paints. It will look half-migrated — that is expected and correct. `01` finishes it.

## Global invariants (restated)

1. No new colours. Every hex here already exists in `tokens.css`.
2. No new fonts, no new weights.
3. No copy changes.
4. No route changes.
5. No Supabase changes.
6. No new dependencies.
7. Hit targets >= 44x44. Text contrast >= 4.5:1 (>= 3:1 at >= 24px). `:focus-visible` stays `3px solid var(--grape)`, `outline-offset: 2px`.
8. `prefers-reduced-motion` coverage must not regress.
9. Do not touch `src/paradox/**`.

---

## 00.1 · Radius scale

**File:** `frontend/src/styles/tokens.css`

The scale is one number and two subtractions. Card padding is **10px**, so anything sitting directly
inside a card is `32 - 10 = 22`. Inner padding is **8px**, so anything inside that is `22 - 8 = 14`.
Do not introduce a fourth structural value.

Find the line `:root { --r-outer: 20px; --r-inner: 14px; --r-tight: 10px; }`

- **SET** `--r-outer`: `20px` -> `32px`
- **SET** `--r-inner`: `14px` -> `22px`
- **SET** `--r-tight`: `10px` -> `14px`
- **ADD** to the same rule: `--r-photo: 22px;` (an alias of `--r-inner`; `feed.css` already
  references `var(--r-photo)` and it is currently defined nowhere, so it resolves to nothing today
  — this is a live bug being fixed, not a new token)
- **ADD** to the same rule: `--pad-card: 10px; --pad-inner: 8px;` (the two paddings the subtractions
  depend on, so a future change to one cannot silently break the concentricity)

Find the block containing `--r-sm: 6px; --r: 14px; --r-lg: 22px; --r-pill: 999px;`

- **SET** `--r-sm`: `6px` -> `14px` (collapses onto `--r-tight`)
- **SET** `--r`: `14px` -> `22px` (collapses onto `--r-inner`)
- **SET** `--r-lg`: `22px` -> `32px` (collapses onto `--r-outer`)
- **KEEP** `--r-pill: 999px`

Find the orphan-token block near the end of the file (comment: "legacy radii retained only for
ported tail classes").

- **SET** `--r-xs`: `6px` -> `14px`
- **SET** `--r-xl`: `28px` -> `32px`

## 00.2 · Elevation — the hard offset becomes rare

**File:** `frontend/src/styles/tokens.css`

Today every raised surface carries `Npx Npx 0 0 var(--ink)`. After this pass exactly **two**
component classes do: `.btn-primary` and `.sticker`. Everything else is a hairline plus a soft lift.

Find the "Canonical elevation" block.

- **KEEP** `--sh-sm`, `--sh`, `--sh-lg`, `--sh-xl`, `--sh-pressed` — their **definitions** stay
  (`.btn-primary` and `.sticker` still consume them). Their **call sites** are removed one by one
  in the sections below and in `01`. Do not delete the tokens.
- **SET** `--sh`: `3px 3px 0 0 var(--ink)` -> `2px 2px 0 0 var(--ink)`
- **SET** `--sh-lg`: `4px 4px 0 0 var(--ink)` -> `3px 3px 0 0 var(--ink)`
- **SET** `--sh-xl`: `5.5px 5.5px 0 0 var(--ink)` -> `4px 4px 0 0 var(--ink)`
- **KEEP** `--sh-sm: 1.5px 1.5px 0 0 var(--ink)`
- **KEEP** `--sh-pressed: 1px 1px 0 0 var(--ink)`
- **ADD** after `--sh-soft`:
  ```css
  /* Hairlines — the new default edge. Ink at low alpha, never a colour. */
  --hair:      1px solid rgba(10,10,10,0.08);   /* dividers inside a card */
  --hair-2:    1px solid rgba(10,10,10,0.12);   /* a card's own outer edge */
  --hair-3:    1px solid rgba(10,10,10,0.18);   /* an input's edge, and the only hairline that may darken on focus */
  /* Lifts — depth from stacking, never from outline. */
  --lift-1: 0 1px 2px rgba(10,10,10,0.04), 0 2px 8px -2px rgba(10,10,10,0.06);
  --lift-2: 0 1px 2px rgba(10,10,10,0.04), 0 3px 12px -4px rgba(10,10,10,0.08);
  --lift-3: 0 2px 4px rgba(10,10,10,0.05), 0 12px 32px -12px rgba(10,10,10,0.14);
  --lift-4: 0 4px 8px rgba(10,10,10,0.06), 0 24px 56px -20px rgba(10,10,10,0.18);
  ```
- **SET** `--bd`: `2px solid var(--ink)` -> `1px solid rgba(10,10,10,0.12)`
  This one declaration re-skins most of the app, because `--bd` is consumed in dozens of places.
  Expect a large visual delta from this single line. That is intended.
- **SET** `--bd-hero`: `3px solid var(--ink)` -> `2px solid var(--ink)`
  `--bd-hero` survives as the ink border, but only `.btn-primary` and `.sticker` may use it.
- **ADD** `--bd-ink: 2px solid var(--ink);` as an explicit name for the two surfaces that keep ink.

**SET** the shadow bridges further down the same file (these are the soft-blur bridges the audit
called a competing system; they now point at the new lifts instead of at their own blur values):

- **SET** `--shadow-sm`: `0 2px 10px rgba(0,0,0,0.06)` -> `var(--lift-1)`
- **SET** `--shadow`: `0 6px 28px rgba(0,0,0,0.10)` -> `var(--lift-2)`
- **SET** `--shadow-lg`: `0 18px 56px rgba(0,0,0,0.14)` -> `var(--lift-3)`
- **SET** `--s1`: `0 0 0 1.5px var(--line)` -> `0 0 0 1px rgba(10,10,10,0.08)`
- **SET** `--s2`: `0 0 0 1.5px var(--line), 0 4px 16px rgba(0,0,0,0.07)` -> `0 0 0 1px rgba(10,10,10,0.08), var(--lift-2)`
- **SET** `--s3`: `0 0 0 1.5px var(--line-2), 0 8px 32px rgba(0,0,0,0.10)` -> `0 0 0 1px rgba(10,10,10,0.12), var(--lift-3)`

## 00.3 · Border-weight variable

**File:** `frontend/src/styles/tokens.css`

- **SET** `--border-w`: `2px` -> `1px`

## 00.4 · Colour — nothing changes, and here is the list so you can confirm that

**File:** `frontend/src/styles/tokens.css`

- **KEEP** every hex in `:root`, byte for byte: `--bg #F4EFE0`, `--bg-2 #EDE6D0`,
  `--bg-3 #E2D9BD`, `--card #FFFFFF`, `--ink #0A0A0A`, `--ink-2 #2A2A28`, `--ink-3 #5A5A55`,
  `--c-events #3DA9FC`, `--c-welfare #1B8A5A`, `--c-labs #FFC700`, `--c-ops #12909C`,
  `--c-content #7E5BFF`, `--pink #FF4D8C`, `--lemon #FFC700`, `--tomato #FF4D2E`,
  `--grape #7E5BFF`, `--sky #3DA9FC`, `--teal #12909C`, `--danger #C4231A`, `--accent #1B8A5A`,
  and all six `*-ink` text-safe partners.
- **KEEP** `--line: rgba(0,0,0,0.18)` and `--line-2: rgba(0,0,0,0.32)`. They are still consumed by
  input borders and by rules `00` does not reach. The new hairlines are additive; `--line` is not
  redefined, because redefining it would silently move every remaining call site at once.
- **ADD** nothing to the palette.

### The inverse contrast rule — ink ON a hue

`tokens.css` documents one direction only: each hue's ratio **as glyph colour on a light ground**,
with a `*-ink` partner for when it fails. The other direction has no written rule and it is where
this redesign puts most of its colour, so state it here:

> **Text on a saturated fill is solid `var(--ink)` (#0A0A0A). Never an alpha of it.**

This is not new — `styles/routes/home.css` already says it verbatim: *"Mono label on a saturated
hue: solid ink, never an alpha."* It is restated as a global because the alpha version is the
natural thing to reach for when a 9px mono label looks heavy, and it fails every time:

| label colour | on | ratio | verdict |
|---|---|---|---|
| `rgba(10,10,10,0.62)` | `--welfare #1B8A5A` | 2.89 | **fails** |
| `rgba(10,10,10,0.66)` | `--welfare` | 3.08 | **fails** |
| `rgba(10,10,10,0.66)` | `--tomato #FF4D2E` | 3.75 | **fails** |
| `#0A0A0A` | `--welfare` | 4.55 | passes |
| `#0A0A0A` | `--tomato` | 5.99 | passes |
| `#0A0A0A` | `--lemon #FFC700` | 16.1 | passes |
| `#0A0A0A` | `--sky #3DA9FC` | 8.5 | passes |
| `#0A0A0A` | `--ops #12909C` | 6.6 | passes |
| `#0A0A0A` | `--grape #7E5BFF` | 5.1 | passes |

**Solid ink passes on all six hues.** There is no case where the alpha is needed. To make a label
recede on a hue fill, reduce its **size or weight**, not its opacity.

**Corollary — white on a hue.** `--grape` is the only hue that takes white text, and only at
>=19px bold / >=24px (4.35:1, so it relies on the large-text 3:1 allowance). `--ops` at 3.82:1
does not take white at any small size. **Practical rule: avatar initials, badge counts and chip
labels are ALWAYS `#0A0A0A`, whatever hue `hashColor` returns.** Do not decide it per hue — it is
a function, and hard-coding white for "dark-looking" hues is how grape and ops both ended up
failing.

**On a 22–30% tint** (not a full fill) the ground is close to cream, so a `*-ink` partner is
correct there and solid `--ink` is also fine. One measured exception: `--grape` at 22% gives
`--grape-ink` only 4.37:1 — a near miss. **Grape's tint step is 30%, not 22%**, the same exception
`--labs` already needs for the opposite reason (lemon is lighter than the paper).

**FIX — a live bug in the same family.** `public/HomePage.tsx` line ~1129 and `styles/routes/home.css`
both reference `var(--rust)`. `--rust` is **not defined anywhere in `tokens.css`**, so the feed
error banner currently renders with `color` and `border-color` resolving to the inherited value —
the error state has no red. Do not add a `--rust` token; the palette already has the accessible red.

- **SET** in `public/HomePage.tsx`, inside the `feedError` block: `var(--rust)` -> `var(--danger)`
  in all three places it appears (`background` colour-mix, `border` colour-mix, `color`).
- **SET** anywhere else `--rust` appears in `src/**` (grep it): -> `var(--danger)`.

## 00.5 · Primitive: `.card`

**File:** `frontend/src/styles/v6.css`, rule `.card {` (around line 503)

- **SET** `border`: `2px solid var(--ink)` -> `var(--hair-2)`
- **SET** `border-radius`: current value -> `var(--r-outer)`
- **SET** `box-shadow`: whatever hard offset is present -> `var(--lift-1)`
- **SET** `padding`: current value -> `var(--pad-card)` (10px)
- **KEEP** `background: var(--card)`
- **DELETE** the rule at line ~1230, `.card { border-radius: calc(var(--r) * var(--radius-scale)); }`.
  `--radius-scale` is `1` and never changes, so this rule only exists to fight the base rule's
  radius. It is the reason cards currently render at 14px rather than the 20px the base rule asks for.
- **ADD** a hover state if one does not exist:
  ```css
  .card { transition: box-shadow 0.18s var(--ease-out), transform 0.18s var(--ease-out); }
  .card:hover { box-shadow: var(--lift-2); }
  ```
- **DELETE** any `.card:hover { transform: translate(-2px,-2px) }` or `translate(-3px,-3px)` you find.
  Cards no longer move on hover; only their lift deepens. This removes the "everything jumps"
  quality the offset shadow required.

## 00.6 · Primitive: `.btn` and `.btn-primary`

**File:** `frontend/src/styles/v6.css`, rule `.btn {` (around line 435)

`.btn` (the default, secondary button) loses the motif. `.btn-primary` keeps it.

- **SET** `.btn` `border`: `2px solid var(--ink)` -> `var(--hair-2)`
- **SET** `.btn` `box-shadow`: whatever offset is present -> `none`
- **KEEP** `.btn` `border-radius: 999px`, `padding: 10px 17px`, `font-weight: 700`, `font-size: 13px`
- **KEEP** `.btn` `background: var(--card)`
- **SET** `.btn:hover`: `transform: translate(-2px,-2px); box-shadow: 3px 3px 0 var(--ink)` ->
  `background: var(--bg-2)` with **no transform and no shadow**
- **SET** `.btn:active`: keep `transform: scale(0.96)`; **DELETE** any `box-shadow` on it
- **KEEP** `.btn:disabled { opacity: 0.45 }`
- **KEEP** `.btn-primary` exactly as it is: `background: var(--accent)`, `color: #0A0A0A`,
  `border: var(--bd-ink)` (i.e. 2px solid ink), `box-shadow: var(--sh)` (now 2px 2px 0).
  This is one of the two surfaces that keeps the motif. **Do not flatten it.**
- **SET** `.btn-primary:hover`: -> `transform: translate(-1px,-1px); box-shadow: var(--sh-lg)`
  (3px 3px 0). The lift is halved from today's -3px so it reads as a press affordance rather than a jump.
- **SET** `.btn-primary:active`: -> `transform: scale(0.96); box-shadow: var(--sh-pressed)`
- **ADD** `.btn-ghost { border: none; background: transparent; box-shadow: none; }` if it is not
  already declared that way, and **DELETE** any border or shadow currently on `.btn-ghost`.
  Ghost buttons are the feed action row and must be bare glyphs.
- **DELETE** the rule at line ~1583, `.btn { border-radius: 999px; }` — redundant with the base rule.
- **KEEP** the rule at line ~1887 (`transition-property` on `.btn`) and line ~1948 (`cursor: pointer`).

## 00.7 · Primitive: `.chip`

**File:** `frontend/src/styles/v6.css`, rule `.chip {` (around line 475)

Chips stop being outlined mono capsules and become hairline pills with a hue dot.

- **SET** `border`: `2px solid var(--ink)` -> `var(--hair-2)`
- **SET** `font-family`: `var(--mono)` -> `var(--eina)`
- **SET** `font-size`: `11px` -> `12.5px`
- **SET** `font-weight`: `700` -> `700` (unchanged; listed so you confirm it)
- **DELETE** `text-transform: uppercase`
- **DELETE** `letter-spacing` (the caps tracking has nothing to track now)
- **SET** `padding`: `6px 12px` -> `0 14px`
- **ADD** `min-height: 38px; display: inline-flex; align-items: center; gap: 7px;`
- **KEEP** `border-radius: 999px`
- **SET** `background`: current -> `var(--card)`
- **SET** `.chip.on` / `.chip-active`: `background: var(--accent)` -> `background: var(--ink); color: var(--bg); border-color: var(--ink);`
  The active chip is ink, not green. Green now means "welfare", and an active "events" chip rendering
  green was a category-colour collision.
- **ADD** `.chip-dot { width: 7px; height: 7px; border-radius: 999px; flex-shrink: 0; }` — the hue
  marker. Chips that represent a category render a `<span class="chip-dot">` with the hue as
  `background` instead of filling the whole chip with the hue.
- **SET** `.chip.cat`: `background: var(--cc)` -> `background: var(--bg); color: var(--ink); border-color: transparent;`
  and the hue moves onto the `.chip-dot` inside it. **This is the single biggest visual change in
  this document.** Saturated category fills were doing the work of both "this is a filter" and
  "this is a category", and at five hues across every card the feed read as a swatch sheet.
- **DELETE** the rule at line ~1584, `.chip { border-radius: 999px; }` — redundant.
- **KEEP** the rule at line ~1271, `.chip { transition: transform 0.16s var(--ease-pop); }`

## 00.8 · Primitive: `.sticker`

**File:** `frontend/src/styles/v6.css`, rule `.sticker {` (around line 532)

The sticker is the one playful device that survives. It keeps ink, keeps the offset, keeps the tilt.

- **KEEP** `font-family: var(--display)`, `font-weight: 800`, `background: var(--lemon)`, `color: #0A0A0A`, `border-radius: 999px`
- **SET** `font-size`: `10.5px` -> `10.5px` (unchanged; confirm)
- **SET** `padding`: `6px 12px` -> `6px 12px` (unchanged; confirm)
- **SET** `transform: rotate(-3deg)` -> `transform: rotate(-2.5deg)`
- **ADD** `border: var(--bd-ink);` (2px solid ink) and `box-shadow: var(--sh);` (2px 2px 0 ink)
  if not present. The sticker is now the **only** non-button element in the product carrying the motif,
  so it must carry it unmistakably.
- **DELETE** the `wob` animation from `.sticker`. Find `animation: wob ...` and remove it. Then
  find `@keyframes wob` in `v6.css` and **DELETE the keyframes block too** if no other selector
  uses it (grep `wob` first). Also remove `wob` from any `prefers-reduced-motion` block that
  disables it — the disable rule becomes dead once the animation is gone.
- **DELETE** the rule at line ~1601, `.sticker { box-shadow: none !important; border: none !important; }`.
  This rule currently **cancels the sticker's own border and shadow**, which is why stickers render
  as flat lemon pills today rather than as the die-cuts the design intends. It is the reason the
  motif looks absent on the one surface that is supposed to have it.

## 00.9 · Primitive: `.avatar`

**File:** `frontend/src/styles/v6.css`, rule `.avatar {` (around line 634)

- **DELETE** `box-shadow: 0 0 0 2px var(--ink)` (the ink ring). Avatars sit on white; a 2px ink ring
  around every 34px circle in a feed is what makes the list read as a contact sheet.
- **ADD** nothing in its place for avatars on a plain card.
- **ADD** a separate opt-in class for stacked avatars, where a ring is load-bearing (it separates
  overlapping circles):
  ```css
  .avatar-stacked { box-shadow: 0 0 0 2px var(--card); }
  .avatar-stacked + .avatar-stacked { margin-left: -8px; }
  ```
- **KEEP** `border-radius: 50%`, `font-family: var(--display)`, `font-weight: 800`
- **SET** the base size: `40px x 40px` -> `34px x 34px`, and `font-size: 13px` -> `12px`.
  Every call site that passes an explicit `width`/`height` inline (there are many) is unaffected
  and is handled per page.
- **KEEP** the rule at line ~1585, `.avatar { border-radius: 50%; }` and line ~1283 (transition).
- **KEEP** `.pav` (the 92x92 profile avatar) **as is** for now — its 3px ink + 4px white ring is a
  deliberate portrait treatment and belongs to `04-profile.md`, which is not designed yet.

## 00.10 · Primitive: `.input`, `.textarea`, `.sel`

**File:** `frontend/src/styles/v6.css`

- **SET** `border`: `2px solid var(--ink)` -> `var(--hair-3)`
- **SET** `border-radius`: `12px` -> `var(--r-inner)` (22px)
- **SET** `background`: `var(--bg)` -> `var(--bg)` (unchanged — cream inset inside a white card is
  layer L2 of the stack; confirm it is not `var(--card)`)
- **KEEP** `padding: 11px 14px`, `font-family: var(--eina)`
- **SET** `font-size`: `15px` -> `16px`. **This is a fix, not a taste change.** iOS Safari zooms the
  viewport on focus for any input under 16px, and several call sites already hard-code 16px inline
  with a comment saying so. Setting the primitive to 16px lets those inline overrides be deleted.
- **SET** the focus state: `box-shadow: 3px 3px 0 var(--accent)` -> `border-color: var(--ink); box-shadow: 0 0 0 3px rgba(27,138,90,0.16);`
  A hard offset on a focused text field pushed the field's baseline visually off-centre.
- **ADD** `min-height: 46px;`
- **ADD** an error state, because there isn't one:
  ```css
  .input[aria-invalid="true"], .textarea[aria-invalid="true"], .sel[aria-invalid="true"] {
    border-color: var(--danger);
    box-shadow: 0 0 0 3px var(--danger-tint);
  }
  ```
  Do **not** wire this up in any form yet — that is per-page work. Ship the class only.

## 00.11 · Primitive: `.tab`

**File:** `frontend/src/styles/v6.css`, rule `.tab {` (around line 894)

- **SET** `border`: `2px solid var(--ink)` -> `none`
- **SET** `background`: current -> `transparent`
- **KEEP** `border-radius: 999px`, `font-family: var(--display)`, `font-weight: 700`, `font-size: 13px`
- **ADD** `min-height: 44px; padding: 0 15px; display: inline-flex; align-items: center;`
- **KEEP** `.tab.on { background: var(--ink); color: var(--bg); }`
- **ADD** `.tab:hover:not(.on) { background: var(--bg-2); }`

## 00.12 · Dashed dividers become hairlines

**Files:** `frontend/src/styles/v6.css`, `frontend/src/index.css`, and every route sheet named in `01`

Grep `src/styles` and `src/**` for `dashed`. For every occurrence used as a **divider or a card
border**:

- **SET** `2px dashed var(--line)` -> `var(--hair)`
- **SET** `1px dashed var(--line)` -> `var(--hair)`
- **SET** `2px dashed var(--line-2)` -> `var(--hair-2)`

**KEEP dashed** in exactly two situations, both of which mean "provisional, not yet real":
1. The sample-preview notice on the feed (`HomePage.tsx`, `usingSamplePreview` block) — dashed
   welfare green. Dashed here says "these posts are not real", which is the one thing the dash
   communicates honestly.
2. Any "no data yet" / dashed-live-marker affordance in the greeting block's tiles.

## 00.13 · Motion — what dies

**File:** `frontend/src/styles/v6.css` (keyframes live here), plus `index.css`

Grep for each keyframe name. For each: delete the `animation:` declaration at every call site,
then delete the `@keyframes` block, then delete the matching line from every
`@media (prefers-reduced-motion: reduce)` block.

- **DELETE** `@keyframes wob` and all call sites. (see 00.8)
- **DELETE** `@keyframes marquee` and all call sites, **and delete the marquee element markup**
  wherever it renders. It is a decorative infinite scroller and the single largest continuous
  repaint on the marketing pages. Note: `--marquee-speed` in `tokens.css` becomes dead — **DELETE**
  that token too.
- **DELETE** `@keyframes twinkle` and all call sites.
- **DELETE** `@keyframes drift` and all call sites.
- **DELETE** `@keyframes pulsedot` and all call sites.
- **DELETE** `@keyframes pop` and `@keyframes wiggle` **only if** grep shows no remaining call
  sites in `src/**` outside `src/paradox/**`. Paradox has its own copies in
  `src/paradox/tailwind.css` — leave those alone.
- **KEEP** `@keyframes spin` (loading spinners are real feedback).
- **KEEP** `@keyframes aqLiveDot` in `styles/routes/home.css` (it marks live data, which is
  information, not decoration) and **KEEP** its reduced-motion disable.
- **KEEP** `@keyframes hodPulse` (it marks unread desk rows).
- **KEEP** `@keyframes bookmarkPop`, `commentSheetIn`, `aqDropIn`, `aqDrawerIn`, `modalIn`,
  `feedCardIn`, `aq-fade-in`, `aq-slide-up`, `aq-pulse` — all are state transitions or
  entrances tied to a user action.

**DELETE the decorative doodle system entirely.** Grep for `className="deco`. Every occurrence
(`deco star`, `deco ring`, and any other `deco` variant) is a hand-placed absolutely-positioned
ornament. **Delete the elements** from the JSX and **delete the `.deco`, `.deco.star`, `.deco.ring`
rules** from `v6.css`. There are occurrences on the home feed header and the guest rail card at
minimum; grep for all of them. Reason: they are the clearest single tell of the aesthetic the
redesign is moving away from, they carry no meaning, and they are positioned with magic pixel offsets
that break at every breakpoint.

**KEEP the mascots.** `components/AQMascot.tsx` and every `<Mascot character=... />` call site stay
exactly as they are. They are brand characters with per-surface semantics documented in the code;
they are not decoration.

## 00.14 · Card tilt dies

**File:** `frontend/src/styles/routes/feed.css`

- **DELETE** the rules `.feed-card.ftilt-a { rotate: -0.5deg; }` and `.feed-card.ftilt-b { rotate: 0.45deg; }`
- **DELETE** `.feed-card.ftilt-a:hover, .feed-card.ftilt-b:hover { rotate: 0deg; }`
- **DELETE** the `@media (prefers-reduced-motion: reduce)` line that zeroes them
- **DELETE** the `ftilt-a` / `ftilt-b` class assignment wherever it is applied in `src/**` (grep `ftilt`)

## 00.15 · Global image outline

**File:** `frontend/src/index.css`

- **DELETE** the rule `img:not(.no-outline) { outline: 1px solid rgba(0,0,0,0.1); outline-offset: -1px; }`
  Photos now sit inside a `var(--r-inner)` clipped container with `overflow: hidden`. An `outline`
  does **not** follow `border-radius`, so this rule draws a square 1px box across the rounded
  corners of every photo in the product. It is a visible defect at 32/22 radii and was merely
  subtle at 14px.
- **DELETE** the matching rules in `styles/routes/feed.css`:
  `.feed-card-media img { outline: 1px solid rgba(255,255,255,0.1); outline-offset: -1px; }` and
  `[data-theme="light"] .feed-card-media img { outline-color: rgba(0,0,0,0.1); }`
- **KEEP** the `.no-outline` class definition if anything else references it; grep first, and delete
  it if nothing does.

## 00.16 · Skeletons

**File:** `frontend/src/index.css`

- **SET** `.skeleton` `border-radius`: `var(--r-sm)` -> `var(--r-inner)` (22px)
- **SET** `.skeleton` `background`: `var(--surface-2)` -> `var(--bg-2)`
  A skeleton on cream should be the next cream up, not a black alpha wash, which reads grey-blue.
- **KEEP** `animation: aq-pulse 2s ease-in-out infinite`

## 00.17 · Focus ring

**File:** `frontend/src/styles/v6.css`

- **KEEP** `:focus-visible { outline: 3px solid var(--grape); outline-offset: 2px; }`
- **ADD** it if grep shows it is missing. The audit lists it as P0 and unverified.
- **ADD** `border-radius: inherit` is **not** applicable to outlines; instead **ADD**
  `:focus-visible { border-radius: inherit; }` only where an element has no radius of its own.
  If in doubt, skip this sub-item — the ring being square on a rounded element is acceptable and
  visible, which is the point.

## 00.18 · Spacing

**File:** `frontend/src/styles/tokens.css`

- **KEEP** `--sp-1` through `--sp-10` exactly as they are. The file's own comment documents that
  only 8 call sites exist, all in a DEV-only gallery. Do not attempt the spacing migration in this
  pass; a blind find-replace across 225 call sites is how this codebase got its current spacing spread.
- **KEEP** `--sp-section`, `--sp-block`, `--gap-section`, `--gap-content`, `--gap-tight`.
- **ADD** `--poster-gutter: 12px;` **only if** grep shows it is undefined. `styles/routes/home.css`
  references `var(--poster-gutter)` in three places (the feed list gap on both mobile and desktop)
  and it is defined nowhere in `tokens.css` — so the feed list currently has **no gap at all** on
  mobile, which is why cards touch. This is a live bug. `12px` is the designed value.

## 00.19 · What this file deliberately does not do

- Does not touch `.admin` scope or any `--hod-*` token. The HoD desk keeps its current flat
  language until `06-hod-desk.md` is designed. Confirm after this pass that `/director/*` still
  renders — the `.admin` scope re-tokens `.card`/`.btn`/`.input`, so it inherits the radius and
  hairline changes but not the elevation ones. A radius change there is acceptable and intended.
- Does not touch `--lg-*` (liquid glass). The nav's glass treatment is correct and is the one
  documented blur exception. `02-global-chrome.md` handles the nav.
- Does not change any `z-index`.
- Does not delete `--line` / `--line-2`.
- Does not touch `src/paradox/**`.

## Unresolved after this file

- `v6.css` is 127KB and contains rules `00` does not enumerate. Any surface that looks
  half-migrated after this pass and is **not** named in `01` is expected to look that way. Log
  what you see; do not fix it.
- `--density` in `tokens.css` is defined as `1` and appears unused. Left alone pending a grep
  you should run and report.
