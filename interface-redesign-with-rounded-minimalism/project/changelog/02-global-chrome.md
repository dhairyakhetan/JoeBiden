# 02 · Global chrome — top nav, bottom nav, footer

**Files touched:** `frontend/src/components/AQNav.tsx`, `frontend/src/components/AQNav.css`,
`frontend/src/components/MobileMenuBar.tsx`, `frontend/src/styles/routes/nav-mobile.css`,
`frontend/src/components/AQFooter.tsx`, `frontend/src/components/AQFooter.css`,
`frontend/src/styles/footer.css`, `frontend/src/styles/tokens.css` (the `--lg-*` glass block only)
**Prerequisite:** `00-global-tokens-and-primitives.md` landed and verified.

> ## ⚠ SUPERSEDED 2026-09-06 — sections 02.1 through 02.6 are RETIRED. Do not build them.
>
> The segmented ink chrome this file specifies (`--nav-ink` and the nav-structural token block,
> `.nav-seg`, the `mask-composite` joint, the `.nav-seg--post` welfare capsule, `.nav-rule`
> dividers, `--btm-nav-reserve` as specced) **was never built, and will not be.** Verified live:
> `.nav-seg`, `.nav-joint` and `.nav-rule` are absent from the DOM and every `--nav-*`
> structural token resolves to an empty string.
>
> This was not an oversight. `AQNav.css:5-44` records it as a reasoned decision: the live nav
> comes from a different design source ("AQ Chrome Poster") and was deliberately tuned away
> from `backdrop-filter` for performance. The handoff and the code described two different
> products; the project owner ruled on 2026-09-06 to **keep the live flat-white nav and retire
> this spec**, rather than reintroduce six blurred layers on the most-rendered surface in the
> app.
>
> **Still live and still binding from this file:** 02.7 (the footer, incl. deleting the footer
> marquee) and 02.8 (focus-ring offset inside the chrome). The accessibility and hit-target
> requirements were applied to the nav that actually ships - links and logo are now 40px, the
> label face is `--eina`, and the `--lg-*` glass block is deleted.
>
> Do not reopen this without a new decision from the owner.

**This is the highest-risk file in the set.** The nav renders on every route, so a mistake here is
visible everywhere. Do it on its own branch and screenshot five routes before merging: `/`,
`/teams`, `/opportunities`, `/profile/:uuid`, `/director`.

## Global invariants (restated — do not skip)

1. **No new colours.** Every hex below already exists in `src/styles/tokens.css`.
2. **No new fonts, no new weights.**
3. **No copy changes.** Every nav label, drawer label and footer string stays byte-identical.
4. **No route changes.** No link's `to` changes. No link is added or removed.
5. **No Supabase changes.**
6. **No new dependencies.**
7. **Hit targets >= 44x44** — nav icon buttons and bottom-nav tabs are called out by the audit as
   P0. Text contrast >= 4.5:1 (>= 3:1 at >= 24px). `:focus-visible` stays `3px solid var(--grape)`,
   `outline-offset: 2px` — **except inside the nav and bottom nav, where offset is `-2px`** so the
   ring stays inside the frosted capsule instead of bleeding onto the page.
8. **`prefers-reduced-motion` coverage must not regress.**
9. **Do not touch `src/paradox/**`** — `paradox/components/Nav.tsx` is a separate nav for a separate
   app. Leave it alone.

## The concentric rule (restated)

    outer radius  32px   with 10px padding  ->  inner radius  22px    (32 - 10)
    inner radius  22px   with  8px padding  ->  tight radius  14px    (22 -  8)

For the chrome specifically, the rule takes its pill form:

    bar height 56px, outer radius 999px (a true capsule)
    inner capsule height 40px, radius 999px  -> 8px of bar padding top and bottom
    notch radius 20px carved from a 56px bar -> a 16px waist  (56 - 2x20)

**A radius that is not 999, 32, 22 or 14 is a bug.**

---

## 02.1 · The design, stated once

**Design source:** `AquaTerra Feed.dc.html` — option `3a`. (`2a` is superseded: it used gaps
between segments rather than true carved joints. Ignore `2a`.)

The chrome inverts from cream to **ink**. It is a **segmented capsule bar**: two or three ink
capsules separated by narrow joint elements that have concave bites carved out of their top and
bottom edges, so the whole thing reads as one continuous bar with a pinched waist at each joint.
All of it is frosted, so content scrolls visibly underneath.

**Why ink.** Today the nav is `--lg-bg` (cream at 62% over a cream page), which means the one
element present on every screen has almost no figure-ground separation from the page. Ink gives the
chrome a permanent identity, matches the reference exactly, and lets the three colour moments
(compose = welfare, active tab = the filter hue, unread = tomato) actually read as signals.

Colour appears on the chrome in **exactly three** places. Nowhere else.

| Element | Fill | Note |
|---|---|---|
| Compose segment / compose button | `var(--welfare)`, ink glyph | the one primary action |
| Active bottom-nav capsule | the current category filter's hue, ink glyph + label | `var(--welfare)` when unfiltered |
| Unread dot | `var(--tomato)` | 8px, with a 2px ink ring so it reads on the frost |

## 02.2 · Glass tokens

**File:** `frontend/src/styles/tokens.css`, the `--lg-*` block.

- **SET** `--lg-bg`: `color-mix(in srgb, var(--bg) 62%, transparent)` -> `rgba(10,10,10,0.85)`
- **SET** `--lg-bg-hover`: `color-mix(in srgb, var(--bg) 82%, transparent)` -> `rgba(10,10,10,0.92)`
- **SET** `--lg-blur`: `blur(16px) saturate(1.85)` -> `blur(20px) saturate(1.6)`
- **SET** `--lg-shadow`:
  ```css
  --lg-shadow:
    inset 0 1px 0 rgba(255,255,255,0.16),
    0 4px 18px -8px rgba(10,10,10,0.28);
  ```
  The inset highlight flips from `rgba(255,255,255,0.85)` to `0.16` — a bright white bevel reads as
  a highlight on a light surface and as a blown-out edge on a dark one.
- **SET** `--lg-shadow-hover`:
  ```css
  --lg-shadow-hover:
    inset 0 1px 0 rgba(255,255,255,0.22),
    0 8px 24px -10px rgba(10,10,10,0.34);
  ```
- **ADD** the chrome's own tokens to the same block:
  ```css
  --nav-ink:        rgba(10,10,10,0.85);      /* the frosted fill */
  /* ── The paper-on-ink ladder. Six rungs, each measured against #F4EFE0
     composited over #0A0A0A. Use a rung; never invent an alpha between them. ── */
  --nav-fg:         var(--paper);             /* 1.00 · 15.6:1 · primary label, active glyph   */
  --nav-fg-strong:  rgba(244,239,224,0.82);   /* 0.82 · 10.1:1 · nav link + rail item labels    */
  --nav-fg-dim:     rgba(244,239,224,0.78);   /*  0.78 ·  9.4:1 · inactive label                */
  --nav-fg-mid:     rgba(244,239,224,0.72);   /*  0.72 ·  7.9:1 · icon glyphs, dock buttons     */
  --nav-fg-soft:    rgba(244,239,224,0.60);   /*  0.60 ·  6.5:1 · secondary meta                */
  --nav-fg-faint:   rgba(244,239,224,0.55);   /*  0.55 ·  5.6:1 · THE FLOOR for text on ink     */
  /* Icon glyphs are non-text (WCAG 1.4.11, 3:1) so a lower rung would be legal,
     but they use --nav-fg-mid so a glyph and its label never disagree. A chevron
     or other affordance marker takes --nav-fg-faint, not lower. */
  /* Non-text only. These are grounds and rules, never a text colour. */
  --nav-hit:        rgba(244,239,224,0.10);   /* icon-button ground inside the bar */
  --nav-well:       rgba(244,239,224,0.07);   /* a recessed well on ink (rail groups, stat tiles) */
  --nav-rule:       rgba(244,239,224,0.20);   /* the 1px vertical group divider */
  --nav-h-bar:      56px;                     /* desktop + phone top */
  --nav-h-bar-btm:  58px;                     /* phone bottom, taller for the labelled capsule */
  --nav-h-inner:    40px;                     /* inner capsule. (56 - 40) / 2 = 8px padding */
  --nav-notch:      20px;                     /* the carved bite radius */
  --nav-joint-w:    16px;                     /* the joint element's width */
  ```
  **Do not invent values for these at call sites.** The notch radius and the bar height are
  arithmetically linked (`waist = bar - 2 x notch`); hard-coding either one breaks the other silently.

**KEEP** `--nav-h: 70px` and its `62px` phone variant. That token is the *layout reserve* the page
content offsets against, and it is deliberately larger than `--nav-h-bar` because the bar floats
inside a padded region. Do not conflate them.

## 02.3 · The joint — how to carve a concave corner

**This is the one genuinely tricky mechanic in the redesign. Read all of it before writing any.**

A joint is a **separate element** sitting between two capsules. It has the same frosted fill, the
same height as the bar, and two circles masked out of its top and bottom edges. Because
`mask-composite: intersect` keeps only what all layers agree on, the two circles subtract from the
rectangle, leaving a waisted shape whose concave arcs meet the convex ends of the capsules either
side of it.

```css
.nav-joint {
  width: var(--nav-joint-w);
  flex: none;
  align-self: stretch;
  background: var(--nav-ink);
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);

  /* Two circles bitten out of the top and bottom edges. The 0.5px feather
     between the transparent and opaque stops is what stops the arc aliasing
     into a stair-step; do not remove it and do not widen it. */
  --n: var(--nav-notch);
  mask-image:
    radial-gradient(circle var(--n) at 50% 0,    transparent var(--n), #000 calc(var(--n) + 0.5px)),
    radial-gradient(circle var(--n) at 50% 100%, transparent var(--n), #000 calc(var(--n) + 0.5px));
  mask-composite: intersect;
  -webkit-mask-image:
    radial-gradient(circle var(--n) at 50% 0,    transparent var(--n), #000 calc(var(--n) + 0.5px)),
    radial-gradient(circle var(--n) at 50% 100%, transparent var(--n), #000 calc(var(--n) + 0.5px));
  -webkit-mask-composite: source-in;
}
```

**Six things that will bite you:**

1. **`mask-composite` and `-webkit-mask-composite` take different keywords.** The standard value
   is `intersect`; the WebKit-prefixed property wants `source-in`. Ship both, in that order.
   Getting this wrong makes the joint a plain rectangle (masks unioning instead of intersecting).
2. **Support.** `mask-composite` needs Chrome 120+ / Safari 15.4+ / Firefox 53+. Below that the
   joint renders as a plain rectangle — the bar looks continuous with square shoulders instead of
   pinched. **That is an acceptable degradation.** Do **not** add a `@supports` fallback that hides
   the joint, which would leave a visible gap in the bar. If you add a `@supports` block at all, the
   fallback must be `mask-image: none` (plain rectangle).
3. **`backdrop-filter` on a masked element.** In some engines the blur is computed on the unmasked
   box and then clipped, which is what you want. If you see the blur bleeding past the arc, move the
   `backdrop-filter` to a `::before` that inherits the same mask rather than adding a second mask
   layer to the element.
4. **Do not put `overflow: hidden` on the flex row that holds the segments.** It clips the arcs.
5. **The joint must be `align-self: stretch`, not a fixed height.** If the bar's height ever changes
   (it does — 56 on top, 58 on the bottom bar) a hard-coded joint height desynchronises the waist.
6. **The joint is decorative.** It contains no text and no control. Give it `aria-hidden="true"`
   and make sure it is not focusable.

**Waist arithmetic, which must hold:**

| bar height | notch radius | waist | used on |
|---|---|---|---|
| 56px | 20px | 16px | desktop top |
| 52px | 18px | 16px | phone top |
| 58px | 21px | 16px | phone bottom |

The waist is held constant at 16px so the pinch reads the same on every bar. **When you change a bar
height, recompute the notch as `(height - 16) / 2`.** Write that as a comment next to each value.

## 02.4 · Desktop top nav

**Files:** `AQNav.tsx`, `AQNav.css`

Structure, left to right — five children of one flex row:

```
[ logo capsule 56x56 ]  [ joint ]  [ links capsule ]  ...spacer...  [ utility capsule ]  [ joint ]  [ Post capsule ]
```

```css
.nav-bar {
  display: flex;
  align-items: stretch;
  height: var(--nav-h-bar);
  max-width: var(--frame-max);
  margin: 0 auto;
  padding: 0 var(--page-px);
  /* no overflow:hidden — see 02.3 note 4 */
}
.nav-seg {
  display: flex;
  align-items: center;
  flex: none;
  border-radius: var(--r-pill);
  background: var(--nav-ink);
  backdrop-filter: var(--lg-blur);
  -webkit-backdrop-filter: var(--lg-blur);
  box-shadow: var(--lg-shadow);
}
.nav-seg--logo    { width: var(--nav-h-bar); justify-content: center; }
.nav-seg--links   { gap: 2px; padding: 0 8px; }
.nav-seg--utility { gap: 8px; padding: 0 8px 0 18px; }
.nav-seg--post    { padding: 0 20px; background: var(--welfare); box-shadow: inset 0 1px 0 rgba(255,255,255,0.30); cursor: pointer; }
```

- **SET** the logo asset. **This is a bug fix, not a style change.** `public/logo.png` is
  **1332x225** — a 5.92:1 horizontal wordmark. Inside a square capsule with `object-fit: contain`
  it can only paint about **5px tall**, which is what ships today in every circular logo slot.
  `public/` already holds the square mark: **`stamp-white.png` (256x256, white on transparent)** and
  **`stamp-ink.png` (256x256, ink on transparent)**.
  - **SET** `src`: `/logo.png` -> `/stamp-white.png` for the ink nav capsule.
  - **DO NOT add `filter: brightness(0) invert(1)`.** `stamp-white.png` is already white; inverting
    it makes it black on ink. Any existing inversion filter on this element must be **DELETED**.
  - Use `/stamp-ink.png` wherever the mark sits on a light ground (the official-account avatar in
    `FeedPostCard.tsx` currently uses `/logo.png` at `width: 100%` inside a 38px circle and has the
    same 5px-smear bug — **SET it to `/stamp-ink.png`** and grep for every other `/logo.png` in
    `src/**` inside a square or circular container).
  - **KEEP `/logo.png` only where a wide wordmark is actually wanted.** `logo-wordmark.png` also
    exists, which suggests `logo.png` was meant to be the mark and is a mis-export — worth raising
    separately, but do not rename or replace the file.
  - **SET** its size to `34px` inside the 56px capsule (a square mark can carry more optical weight
    than a wordmark's cap-height could).
  - **DO NOT use `icon-192.png` / `icon-512.png` / `favicon.svg`** — those are full-bleed app icons
    with their own gradient background, so they fill the capsule with a second background instead of
    reading as a mark on it.
  - **KEEP** the `eager` / `loading` attribute it already has — the source notes it is an above-fold
    image and every other route already marks theirs eager.
  - **KEEP** the `alt`.
- **SET** each nav link: `min-height: 40px` (`= --nav-h-inner`), `padding: 0 15px`,
  `border-radius: var(--r-pill)`, `font-family: var(--eina)`, `font-weight: 600`, `font-size: 13.5px`,
  `color: var(--nav-fg-dim)`, `text-decoration: none`.
  **`var(--eina)`, not `var(--display)`.** `AQNav.css` already documents this: NeutralFace is
  caps-only, so `text-transform: lowercase` on it has nothing to transform.
- **SET** the current link: `background: var(--paper); color: var(--ink); font-weight: 700;`
  A cream capsule inside the ink capsule. **This is the concentric relationship at pill scale** —
  outer 999 at 8px padding, inner 999.
- **ADD** `aria-current="page"` to the current link if it is not already there. The audit lists
  "current-page aria" as missing.
- **ADD** the group dividers: `<span class="nav-rule" aria-hidden="true"></span>` with
  `width: 1px; height: 20px; background: var(--nav-rule); margin: 0 4px;`
  Place them so the five links group **2 / 2 / 1**: feed, projects | teams, openings | explore.
  **This is the one structural addition to the nav.** It is from the reference, and it gives five
  peer links a shape.
- **KEEP** all five link labels and all five `to` paths exactly as they are today. **If today's nav
  has a different number of links than five, keep the number it has** and place the dividers to
  make roughly even groups — do not add or remove a link to fit the design.
- **SET** the search affordance: **KEEP** whatever it is today (icon button or field). If it is a
  field, **SET** it to `height: 40px; border-radius: var(--r-pill); background: var(--nav-hit); border: none; color: var(--nav-fg);`
  with its placeholder at `var(--nav-fg-faint)`. If it is an icon button, **SET** it to 40x40,
  `border-radius: var(--r-pill)`, `background: transparent`, glyph `var(--nav-fg-dim)`.
- **SET** the notification button: 40x40, `border-radius: var(--r-pill)`,
  `background: var(--nav-hit)`, glyph `var(--nav-fg)`. **ADD** the unread dot as an 8px
  `var(--tomato)` circle at `top: 5px; right: 6px` with `box-shadow: 0 0 0 2px #1A1A18`.
  **`#1A1A18` is not in the palette** — use `box-shadow: 0 0 0 2px var(--ink-2)` instead
  (`#2A2A28`), which is in `tokens.css` and reads the same against the frosted fill.
- **SET** the avatar button: 40x40, `border-radius: var(--r-pill)`, `background: var(--welfare)`,
  `color: var(--ink)`, `font: 800 13px var(--eina)`. **DELETE** any ink ring
  (`box-shadow: 0 0 0 2px var(--ink)`) — it is invisible on an ink bar.
- **SET** the Post segment: it is a **whole capsule**, not a button inside one. `var(--welfare)`
  fill, ink glyph and ink label, `padding: 0 20px`, plus icon at 14px and label at
  `800 13.5px var(--eina)`. **KEEP the string `Post`.** **No hard offset here** — the segment's
  scale and its solid welfare fill are already the loudest thing on the bar; adding a 2px ink offset
  to a capsule that is 56px tall reads as a mistake, and `00.6` reserves the motif for
  `.btn-primary`-sized controls.
- **KEEP** the whole mega-menu / `.aq-drop` dropdown mechanism, all its links, its
  `aq-drop-scrim`, its `aqDropIn` animation and its reduced-motion disable. **Restyle only:**
  - **SET** `.aq-drop` `border: 3px solid var(--ink)` -> `var(--hair-2)`
  - **SET** `.aq-drop` `border-radius: 16px` -> `var(--r-outer)` (32px)
  - **SET** `.aq-drop` `box-shadow: var(--sh-lg)` -> `var(--lift-4)`
  - **SET** `.aq-drop` `padding: 12px` -> `var(--pad-card)` (10px)
  - **SET** `.aq-drop-link` / `.aq-drop-full` `border-radius: 10px` -> `var(--r-inner)` (22px)
  - **SET** `.aq-drop-link` `border: 2px solid transparent` -> `border: none`
  - **SET** `.aq-drop-link:hover` `background: var(--bg-2); border-color: var(--ink); transform: translate(-1px,-1px)`
    -> `background: var(--bg)` with **no border-color and no transform**
  - **KEEP** `.aq-drop-link.on { background: var(--ink); color: var(--bg); }`
  - **SET** `.aq-drop-full` `border: 2px dashed var(--line-2)` -> `background: var(--bg); border: none;`
    (`00.12`: dashed survives in exactly two places and this is not one of them)
  - **SET** `.aq-drop-labs` `border-radius: var(--r-sm)` -> `var(--r-inner)`, and **DELETE** its
    `:hover` `transform: translate(-1px,-1px)`. **KEEP** its ink fill, its `--paper` text and its
    `--lemon` arrow — it is deliberately a destination rather than a sixth peer link.
  - **SET** `.aq-drop-link` `min-height: 40px` -> `44px`
  - **KEEP** `--r-sm`-free: every radius in this file must be 999, 32, 22 or 14 after the pass.
- **KEEP** the mobile drawer (`.aq-drawer`) mechanism, all sixteen links and every label.
  **Restyle only:**
  - **SET** `.aq-draw-hd` `border-bottom: 3px solid var(--ink)` -> `var(--hair-2)`
  - **SET** `.aq-draw-x` `border-radius: 11px` -> `var(--r-pill)`, `border: 2px solid var(--ink)`
    -> `none`, `background: #fff` -> `var(--bg-2)`, and **DELETE** its `:active` `box-shadow: 3px 3px 0 var(--ink)`.
    **SET** its size `40x40` -> `44x44` (P0 hit target).
  - **SET** `.aq-draw-link` `border-bottom: 2px solid var(--line)` -> `var(--hair)`
  - **KEEP** `.aq-draw-link` `font-family: var(--eina); font-weight: 800; font-size: 20px; letter-spacing: -0.02em; text-transform: lowercase`
  - **KEEP** `.aq-draw-link.on { color: var(--accent-ink) }` — `--accent-ink` is `--welfare-ink`,
    which passes AA. Do not change it to `--accent`.
  - **KEEP** `.aq-draw-pulse` and `@keyframes hodPulse` — it marks a real unread state.
  - **KEEP** `.aq-draw-foot`'s `padding-bottom: max(20px, calc(env(safe-area-inset-bottom) + 12px))`.
- **ADD** a skip-to-content link if grep shows none. The audit lists it as missing. It must be the
  first focusable element in the document, `.sr-only` until focused, and target `#main-content`
  (which `PublicLayout` already renders).
- **ADD** `<nav>` landmark semantics if the bar is not already a `<nav>`.

## 02.5 · Phone top nav

Three segments: logo capsule, title capsule (flexible), avatar capsule.

- **SET** bar height to `52px`, notch to `18px` (`(52 - 16) / 2`), joint width `15px`.
- **SET** the logo capsule to `52x52`, logo `27px`, inverted.
- **SET** the title capsule: `flex: 1; min-width: 0; padding: 0 8px 0 16px;` containing
  (a) the route title at `800 14.5px var(--display)`, `letter-spacing: -0.025em`,
  `color: var(--nav-fg)`, with `flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;`
  and (b) a 38x38 search button on `var(--nav-hit)`.
  **The route title string must come from the existing per-route metadata** —
  `hooks/useMeta.ts` and `lib/metaConfig.ts` already hold a title per route. **Read it; do not
  hard-code `the feed`.** If `metaConfig`'s title is a full SEO sentence rather than a short label,
  render the site name instead (`aquaterra`) and log it as unresolved. Do not invent short labels.
- **SET** the avatar capsule to `52x52` with a `var(--welfare)` fill and ink initials at
  `800 14px var(--eina)`. It is the whole capsule, so it is also the third colour-free exception:
  welfare here is the *account*, not an action. **If that reads as ambiguous next to the compose
  button, make this capsule `var(--nav-hit)` with a welfare 38px circle inside it.** Pick one and
  use it on every route.
- **SET** the search button to `38x38`. **It sits inside a 52px capsule with 7px of padding, so
  38 is what the concentric maths gives** — do not force it to 44. The capsule itself is 52px tall
  and is the touch target for the title; the search glyph's own 38px clears WCAG 2.5.8 AA.
- **DELETE** the `@media (max-width: 767px)` `.aq-drop { top: calc(var(--nav-h) + 2px); left: 12px; right: 12px; }`
  repositioning **only if** the phone no longer opens `.aq-drop` at all. **KEEP** it otherwise, and
  **KEEP** `.aq-drop-full { display: none }` at that breakpoint — the source comment is right that
  it is a redundant second path to the drawer the hamburger already opens.

## 02.6 · Phone bottom nav

**Files:** `components/MobileMenuBar.tsx`, `styles/routes/nav-mobile.css`

Two segments: a tabs capsule (flexible) and a compose capsule (fixed).

```
[ tabs capsule: active-labelled-capsule + 3 icon buttons ]  [ joint ]  [ compose 58x58 ]
```

- **SET** bar height `58px`, notch `21px` (`(58 - 16) / 2`), joint width `16px`.
- **SET** the bar's positioning: `position: fixed; left: var(--page-px); right: var(--page-px);`
  and `bottom: max(12px, env(safe-area-inset-bottom));` **The safe-area inset is mandatory** — a
  fixed bar at a flat `bottom: 12px` sits under the iOS home indicator.
- **SET** the tabs capsule: `flex: 1; min-width: 0; display: flex; align-items: center; gap: 3px; padding: 0 8px;`
- **SET** the **active** tab: it is the only labelled one.
  ```css
  .btm-tab.is-active {
    display: inline-flex; align-items: center; gap: 7px;
    height: 42px; padding: 0 15px;
    border-radius: var(--r-pill);
    background: var(--filter-hue, var(--welfare));
    color: var(--ink);
    flex: none;
  }
  .btm-tab.is-active .btm-label { font: 800 13px var(--eina); }
  ```
  `--filter-hue` is set on the bar from the feed's current category filter. **When no filter is
  active it falls back to `var(--welfare)`.** On routes with no category concept it is also
  `var(--welfare)`. **Wire `--filter-hue` from state that already exists** — `HomePage.tsx` holds
  `filter`; if lifting it to the bar requires new plumbing beyond passing one prop, **use
  `var(--welfare)` everywhere and log it as unresolved.** Do not add a context provider for a colour.
- **SET** the **inactive** tabs: `flex: 1; height: 42px; border: none; border-radius: var(--r-pill); background: transparent; color: var(--nav-fg-dim); display: grid; place-items: center;`
  Icons at 19px, `stroke-width: 2.2`, `stroke-linecap/linejoin: round`.
  **`height: 42px` inside a 58px capsule with 8px padding.** The tab's flex width on a 390pt screen
  is ~78px, so the hit area is 78x42 — over 44 in one axis and well over the 24px WCAG 2.5.8 floor
  in both. **This is the same considered trade as the feed footer.** Document it in a comment.
- **ADD** the unread dot to the notifications tab: 8px `var(--tomato)`, `box-shadow: 0 0 0 2px var(--ink-2)`,
  positioned `top: 8px` and horizontally centred over the glyph. **Only render it when there are
  unread notifications** — `services/notificationService.ts` already exposes the count.
- **SET** the compose capsule: `58x58`, `border-radius: var(--r-pill)`, `background: var(--welfare)`,
  `border: 2px solid var(--ink)`, `box-shadow: 2px 2px 0 0 var(--ink)`, `box-sizing: border-box`,
  plus icon at 22px, `stroke-width: 3`.
  **This one DOES keep the hard offset.** It is the product's single most important action on a
  phone, it is a circle at button scale, and `00.6` reserves the motif for exactly this.
- **KEEP** every tab's `to` path and every `aria-label`. **KEEP** the number of tabs.
- **ADD** `aria-current="page"` to the active tab.
- **DELETE `.feed-mobile-fab`** from `styles/routes/feed.css` and its element from wherever it
  renders. **This is the coordination point flagged in `01.16`:** compose now lives in the bottom
  bar, and a floating FAB plus a bar compose button are two controls for one action, 64px apart.
  `01` was told to keep the FAB until this file landed. **This file lands it — delete the FAB.**
- **KEEP** `@keyframes hodPulse` if `MobileMenuBar` uses it. The source notes it now lives once in
  `v6.css` rather than being redefined per component — **keep that consolidation**.
- **SET** the page's bottom padding so the bar never covers the last card: the feed already has
  `padding: 0 0 80px` on `.home-shell` at 600px. **SET** it to
  `calc(58px + 12px + env(safe-area-inset-bottom) + 20px)` expressed as a token:
  **ADD** `--btm-nav-reserve: calc(var(--nav-h-bar-btm) + 32px + env(safe-area-inset-bottom));`
  to `tokens.css` and use it. Hard-coded `80px` is how a taller bar ends up covering content.

## 02.7 · Footer

**Files:** `components/AQFooter.tsx`, `components/AQFooter.css`, `styles/footer.css`

The footer is already dark in the current build (this is what your two screenshots show), so it now
agrees with the chrome rather than being the one dark thing on the site.

- **KEEP** every footer string, every link and every `to` path.
- **SET** the footer's outer card `border-radius` -> `var(--r-outer)` (32px) and its inner sections
  -> `var(--r-inner)` (22px), per the concentric rule.
- **SET** the footer's background to `var(--ink)` if it is a raw hex today. Grep `footer.css` and
  `AQFooter.css` for `#1`, `#2`, `#0` and `rgb(` and replace every raw dark hex with `var(--ink)`
  or `var(--ink-2)`.
- **FIX** `.aq-footer-link` contrast. `tokens.css` names this as a real, shipped bug ("the drift
  that produced the `.aq-footer-link` contrast bug"). **SET** its `color` to `var(--nav-fg-dim)`
  (`rgba(244,239,224,0.78)`), which measures 8.9:1 on `--ink`. **Measure it after the change and
  report the number.**
- **SET** the CTA button in the footer (the orange pill in your screenshot): it is a primary action,
  so **KEEP** its fill and **ADD** `border: 2px solid var(--ink); box-shadow: 2px 2px 0 0 var(--ink);`
  per `00.6`. **If its fill is a raw orange not in the palette, SET it to `var(--tomato)`** and
  verify ink-on-tomato (it passes; tomato is a fill hue).
- **KEEP** the HiStrip in the footer and its `aq_hi_strip_v1` localStorage gate exactly.
- **DELETE** any `marquee` element in the footer and its keyframes (`00.13`).
- **SET** every footer divider from `dashed` -> `1px solid rgba(244,239,224,0.14)`.
  **Do not use `--hair`** — that is ink-on-light. On a dark ground the hairline must be paper-on-dark.
  **ADD** `--hair-inv: 1px solid rgba(244,239,224,0.14);` to `tokens.css` for this.

## 02.8 · Focus rings inside the chrome

- **ADD** `.nav-bar :focus-visible, .btm-nav :focus-visible { outline-offset: -2px; }`
  **KEEP** the `3px solid var(--grape)` colour. Grape on ink measures 3.2:1, which is below 4.5 but
  focus indicators are governed by 1.4.11 Non-text Contrast (3:1 against adjacent colour), so it
  passes. **Verify it and report the number.** If it reads as too dim in practice, the fix is to
  keep grape and add a 1px paper outer ring, **not** to change the focus colour — it is global.

## 02.9 · What this file deliberately does not do

- Does not change any link, label, path, or the number of nav items.
- Does not touch the HoD desk's own nav or the `.admin` scope. `/director/*` renders the same
  `AQNav`, so it inherits the ink chrome — **that is intended and it is an improvement**, since the
  desk's flat language currently sits under cream chrome. `06-hod-desk.md` handles the desk itself.
- Does not touch `src/paradox/components/Nav.tsx`.
- Does not add a theme toggle. `index.html` hard-pins `data-theme="light"` and deletes any stored
  `aq-theme` on every load; the app has one theme. Ink chrome is not dark mode.

## A note on strings in this file

Two forms of string instruction appear here, and the difference matters:

- **A quoted string** was read verbatim out of the source file named in that section. Type it exactly.
- **"KEEP whatever string ships today"** means it was **not** read. Open the file, use what is
  there, leave it byte-identical, and **do not retype it from this document.**

**Copy in the design mocks is illustrative unless a section quotes it.** The mocks needed plausible
sentences to lay out. Strings this file's mocks invented, which must **not** be built:

`the feed` as a phone route title · `Post` as a segment label is real, but the **grouping** of the
five nav links 2 / 2 / 1 and the link labels shown in the mock (`feed` · `projects` · `teams` ·
`openings` · `explore`) are **illustrative** — 02.4 tells you to keep whatever links `AQNav.tsx`
actually has and re-place the dividers to suit. `desk` · `command desk` in the mock's phone bar
belong to the Command Desk, not the public chrome.

This file changes **no** copy. Every nav label, drawer label and footer string is
**KEEP whatever ships today**.

**If an instruction quotes a string and the file disagrees, the file wins.** Report the mismatch;
do not reconcile it by editing either one. No section of this file authorises a copy change.

## Unresolved after this file

Report each rather than guessing:

1. **`mask-composite` support floor** — confirm the project's browser targets. If Safari < 15.4 is
   in scope, the joints degrade to square shoulders on those devices. Acceptable, but say so.
2. **Phone route title** — does `lib/metaConfig.ts` expose a short per-route label, or only SEO
   titles? If only SEO titles, the phone top capsule shows `aquaterra` on every route.
3. **`--filter-hue`** — can the feed's active category reach the bottom bar via one prop? If not,
   the active capsule is always welfare.
4. **Avatar-vs-compose ambiguity on phone top** — two welfare capsules on one bar. Decide which
   treatment (whole capsule vs. circle inside a neutral capsule) and apply it everywhere.
5. **Nav link count** — this file assumes five. Confirm against `AQNav.tsx` and re-place the
   dividers if it is four or six.
6. **Footer link contrast** — report the measured ratio after the fix.
7. **Focus ring on ink** — report the measured ratio.
