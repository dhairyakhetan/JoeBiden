# 14 · The footer

**Files touched:** `frontend/src/components/AQFooter.tsx` (or wherever the footer renders),
a **new** `frontend/src/styles/footer.css`, and `frontend/src/styles/v6.css` (deletions only).
**Design source:** `AquaTerra Feed.dc.html` — `12a` (desktop), `12b` (phone).
**Prerequisites:** `00` (tokens), `02` (chrome), `13` (the sticker system).

## Global invariants (restated — do not skip)

1. **No new colours.** Every hex below already exists in `tokens.css`.
2. **No new fonts, no new weights.**
3. **No copy changes** except where this file quotes a replacement.
4. **No route changes.**
5. **No Supabase changes** — but see 14.2, which needs one *existing* service used in a new place.
6. **No new dependencies.** The parallax is hand-rolled. **Do not add a motion library** — see 14.0.
7. **Hit targets >= 44x44.** Footer links are **33px tall today** and that is a defect the mobile
   audit already records; this file fixes it.
8. **`prefers-reduced-motion` removes every animation in this file.** Not reduces. Removes.
9. **Do not touch `src/paradox/**`** — but the **Paradox banner** currently renders in the footer
   band on all 22 public routes at **3.16:1**. See 14.8.

## The concentric rule

    outer 32  −  10 padding  =  inner 22        inner 22  −  8 padding  =  tight 14

In this file: photo shard 22 · die-cut pill 999 · die-cut squircle 22 · seal 999 · activity
bubble 999 · brand disc 999.

---

## 14.0 · Why this file is allowed to be the heaviest thing in the product

`docs/PERFORMANCE_AUDIT_2026_07_31.md` **P0-2** already assigns `v6.css` lines **530–766**
(footer + marquee + apply sticker, **9.8 KB**) to a new `footer.css` imported by `AQFooter`, and
annotates it *"below-fold; no FOUC risk"*.

So the mechanism this file needs **already exists in the audit's own plan**, and the cost profile
is uniquely favourable:

- the footer is below the fold on every route, so nothing here is in the critical path;
- its CSS becomes a lazy chunk, so it leaves the 36 KB gz critical CSS;
- the motion is CSS transforms driven by **one shared `rAF` loop**, so it adds no JS dependency.

**This is the only place in the redesign where ambitious motion is free.** Spend it here, not
above the fold. `docs/PERFORMANCE_AUDIT_2026_07_31.md` **P0-1** is about the opposite case.

**Three hard constraints that follow:**

1. **Everything is gated behind one `IntersectionObserver`.** No loop starts until the footer is
   within 200px of the viewport, and every loop stops when it leaves.
2. **One `rAF` loop for the whole footer.** The parallax planes, the marquee and the gyro reader
   share it. Three loops is three times the cost for no gain.
3. **`framer-motion` must not be imported here.** It is 44.4 KB gz and the audit's goal is to get
   it *out* of the modulepreload list. A footer that imports it re-pins it.

## 14.1 · Structure

    <footer>
      1  activity band      — the marquee, two rows, alternating direction
      2  parallax wall      — 3 planes + the CTA
      3  link row           — 4 columns desktop, 2 columns phone
      4  legal strip        — two mono lines
    </footer>

**One section, not two.** The activity band is **inside** the footer, above the wall. Do not ship
it as a separate section elsewhere on the page.

## 14.2 · The activity band

- **SET** the band: `padding: 26px 0 30px`, `border-bottom: 1px solid var(--nav-rule)`,
  `overflow: hidden`. A header row with a 7px `var(--welfare)` dot and a mono uppercase label.
- **The label is new copy: `happening now`.** Flag it for approval.
- **SET** two marquee rows, `gap: 10px`, the first translated **−40px** and the second **+90px**
  so the rows do not align into a grid. Row 1 scrolls left, row 2 scrolls right.
- **ADD** `animation: aq-marquee-l 48s linear infinite` / `aq-marquee-r`. Duplicate the row's
  children once and translate by `-50%` for a seamless loop. **48s is deliberately slow** — this
  is ambient texture, not a ticker.
- **ADD** `animation-play-state: paused` on `:hover` and on `:focus-within`. Focus-within matters:
  a keyboard user tabbing into a moving row cannot read it otherwise.
- **Each item is the `.aq-comment` bubble from `03.5.1`, unchanged in geometry:**
  `display: inline-flex; gap: 9px; border-radius: 999px; padding: 6px 15px 6px 6px;` with a 30px
  avatar **inside** the pill's left end. On ink the ground becomes `var(--nav-well)`
  (`rgba(244,239,224,0.07)`) instead of cream. **Do not fork the component** — same class, a
  modifier for the ink ground.
- **SET** the text: `font: 400 13px var(--eina)` in `var(--nav-fg)`, with the member's first name
  at `font-weight: 700`. `white-space: nowrap`.
- **DATA.** Each item is *"{first name} {verb phrase}"*. The verbs must come from real rows:
  a new approved member, a new post, a team join, a comment, an application, an achievement.
  **There is no single "activity" table.** Options, in order of preference:
  1. **Reuse `notificationService`'s shape** if it already aggregates these events — read it first.
  2. Otherwise **derive from what the footer can already see cheaply**: recent approved members
     (`members.approved_at`) and recent posts (`post_feed_view`, using
     `profileService.POST_FEED_COLS`, **not `select('*')`** — the audit's P2 note).
  3. **If neither is available without a new query, ship the band with posts only.** A shorter
     honest band beats an invented one.
  **Whatever the source: one query, capped at ~12 rows, fired only when the observer fires.**
  Never per-item fetches — that is the N+1 the audit flags three times.
- **Empty state:** if fewer than 4 items resolve, **do not render the band at all.** Two lonely
  bubbles scrolling past look broken. Collapse to the wall.
- **`prefers-reduced-motion`:** rows do not scroll. Render the first 3 items of each row
  statically, wrapped, no animation, no duplicated children.

## 14.3 · The parallax wall

```css
.aq-wall { position: relative; min-height: 430px; overflow: hidden; }
@media (max-width: 760px) { .aq-wall { min-height: 340px; } }
```

Three planes, back to front:

**Plane −3 · photo shards.** Four `<img>` in 22px-radius boxes, rotated −7° / 6° / 4° / −5°,
each **bleeding off one edge** (negative `left`/`right`/`bottom`), at **`opacity: 0.4`**.
- **The 0.4 is load-bearing.** It makes the shards ink-tinted texture rather than photography, so
  plane-0 text clears 4.5:1 against the darkest point of any shard. **Do not raise it.**
  This is the same failure mode the mobile audit flags as "text-over-busy-image risk" on
  `/projects`, avoided rather than risked.
- Parallax factor **0.06** (moves least).
- `loading="lazy"` and `decoding="async"` on all four. `alt=""` — they are decorative.
- **Reuse existing repo photos.** Do not add assets; the audit already flags a 464 KB icon.

**Plane −2 · ghost wordmark.** `AQUATERRA` at 188px desktop / 78px phone, weight 900,
`letter-spacing: -0.06em`, `color: rgba(244,239,224,0.05)`, `line-height: 0.8`, bottom-anchored
and centred.
- **MUST carry `pointer-events: none` and `user-select: none`.** A 188px word that can be
  drag-selected is a bug, not a texture. Also `aria-hidden="true"`.
- Parallax factor **0.03**.

**Plane −1 · the die-cuts.** Four stickers from `13`: a lemon pill, a welfare squircle, a pink
starburst (nested-clip ring per `13`), and a sky arc-set seal reading `· DRAG ME · DRAG ME ·`.
- **All four are `stamped`, not die-cut**, per `13`'s rule: you can drag them, so they get the
  ink border and the 2px offset.
- Parallax factor **0.14** (moves most).
- `cursor: grab`, and `cursor: grabbing` while held.

**Plane 0 · the content.** `position: relative; z-index: 3`. Headline, lede, CTA. No parallax —
**the text never moves.** Moving type under a cursor is the single most common way this effect
becomes unreadable.

### The input layer

```
desktop  pointermove on the footer  →  ±14px, eased, factor per plane
phone    DeviceOrientation          →  ±8px, OPT-IN ONLY
```

- **Desktop:** normalise the pointer to −1..1 across the footer's box, lerp toward it at ~0.08 per
  frame so it glides rather than snaps, write one `transform: translate3d()` per plane.
- **Phone:** **±8px, half the desktop amount, and opt-in.** `DeviceOrientationEvent` requires a
  user gesture on iOS and requesting it unprompted is hostile. **Render the wall static, and only
  attach the listener if the user has already granted motion access for another reason.**
  **Do not add a permission prompt for a decorative effect.**
- **Dragging is desktop-only.** On a touch device a drag inside a scrolling page fights the
  scroll. On phone the stickers are static decoration.
- **Drag is `pointerdown`/`pointermove`/`pointerup` with `setPointerCapture`.** No library.
  A dragged sticker keeps its position for the session only — **do not persist it.**
- **`prefers-reduced-motion`:** no parallax, no drag, no listeners attached at all. The wall
  renders in its rest position, which is its designed composition.

## 14.4 · The CTA block

- **SET** the headline: `clamp(34px, 4.6vw, 52px)`, weight 900, `letter-spacing: -0.04em`,
  `line-height: 0.9`, `text-wrap: balance`, uppercase, with **one italic serif word** in
  `var(--welfare)` — the house device from `01` and `06`.
- **The headline and lede are new copy** (`come and do something real.` /
  `Free forever. No donations, no fees. Turn up to one drive and you are in.`).
  **Both need approval, and both must be checked against `docs/BRAND_VOICE.md` first.**
  The existing footer's strings are the safe default — if in doubt, keep them.
- **KEEP the string `Join the work →`** — it already exists in `JoinPromoPage`.
- **SET** the button: `.btn-primary` geometry, `min-height: 52px`, `padding: 0 26px`,
  `border-radius: 999px`, welfare fill, ink text, `2px solid var(--ink)` + `2px 2px 0`.
  **Ink on welfare is 4.55:1** — passes, with 0.05 to spare. Do not lighten the fill.

## 14.5 · The link row

- **SET** `display: grid; grid-template-columns: 1.4fr 1fr 1fr 1fr; gap: 24px` desktop;
  `1fr 1fr` with `gap: 20px` below 760px.
- **FIX (defect):** footer links are **33px tall** today — the mobile audit records it under
  "Touch targets < 44px". **SET each link `min-height: 24px` with `gap: 11px` in a flex column**,
  which yields a 35px effective row, and **add `padding: 6px 0`** to reach 44px of hit area
  without changing the visual rhythm. Verify with the accessibility inspector, not by eye.
- **SET** column headings to mono uppercase `9px/800` in `var(--nav-fg-faint)` (5.6:1).
- **SET** links to `font: 600 13px var(--eina)` in `var(--nav-fg-strong)` (0.82, **10.1:1**).
  **Not `--nav-fg-dim` or lower** — these are the primary navigation on this surface.
- **KEEP every existing link label and destination.** The four groups shown in the mock
  (`the work` / `the org` / `reach us`) are **illustrative groupings** — read the real footer and
  regroup its actual links; do not add or remove a destination.
- **ADD `a` and `a:hover` colours explicitly**, since the footer is the densest link cluster in
  the product: hover goes to `var(--nav-fg)` with `text-decoration: underline`,
  `text-underline-offset: 3px`.
- **Phone drops from 4 columns to 2, and nothing is hidden.** If the real footer has more links
  than fit, the columns get taller — **do not add an accordion.**

## 14.6 · The brand + legal strip

- **SET** a 34px `var(--paper)` disc holding **`stamp-ink.png`** at 22px, `object-fit: contain`.
  **Not `logo.png`** — that is a 1332×225 horizontal wordmark and renders ~5px tall in a circle
  (`02.4`, and the same bug this file must not repeat).
- **SET** two mono uppercase lines at `9px/700` in `var(--nav-fg-faint)`.
- **KEEP the existing legal strings** — `aquaterra · open access`, `· v7 ·`, `made with care`
  and whatever else ships. The mock's `open access · free forever` and
  `made with care in kolkata` are **recombinations of existing strings** and still need approval.

## 14.7 · What to delete

- **DELETE** the footer's hard offset shadows and 2/3px ink borders on **panels and rows**.
  The offset survives only on the CTA and the stickers (`00.6`).
- **DELETE** `.torn-divider` / tape / torn-edge decorations if the current footer uses them —
  the seam here is a hairline, and the torn edge belongs to About (`I-01`).
- **DELETE** any `outline` on footer images (`00.15`: `outline` does not follow
  `border-radius`, so it draws a square across every rounded corner).
- **MOVE, do not copy,** `v6.css` lines 530–766 into `footer.css`. Leaving them in `v6.css`
  defeats the entire point of 14.0. **Verify the bytes actually moved to the lazy chunk** —
  the audit's own per-move check (1) grep proves every class consumer imports the new sheet,
  (2) build and confirm the byte movement, (3) browser-check for one-frame FOUC,
  (4) confirm no nav/layout class was dragged out of critical CSS.

## 14.8 · The Paradox banner — a real defect in this band

`.px-banner__sticker` and `.px-banner__cta` ("See Highlights →") render **white-ish
`rgb(251,245,230)` on red `#FF4338` = 3.16:1**, failing AA for small text, **on all 22 public
routes** because they sit in the global footer band.

- **FIX:** `color: var(--ink)` on both. Ink on that red measures **>= 4.5:1**.
  **Do not change the red** — it is the Paradox brand colour and `src/paradox/**` is out of scope.
  **Only the text colour changes, and it changes in the public banner, not in the Paradox app.**
- **KEEP the string `See Highlights →`** and the banner's dismiss behaviour if it has one.
- **This is the highest-reach single fix in the entire redesign** — 22 routes, one property.

## 14.9 · States

- **Loading:** the footer renders immediately with the wall and links. **The activity band is the
  only async part** — while it loads, render nothing where it goes (no skeleton). A skeleton for
  ambient decoration is noise.
- **Activity fetch failed:** render the footer without the band. **No error message.** A footer is
  not the place to report a failed decorative query.
- **Fewer than 4 activity items:** omit the band (14.2).
- **Offline:** the wall and links are static markup and work offline. The band omits itself.
- **Reduced motion:** no marquee, no parallax, no drag, no listeners. Composition intact.
- **Print:** `@media print` hides the wall, the band and the stickers; keeps the link row as plain
  text and the legal strip. A printed page does not need a parallax footer.

## 14.10 · Verification checklist

1. **Re-measure horizontal overflow at 375px AND 360px.** The mobile audit's headline good-news
   finding is **zero overflow on all 22 routes at both widths**. This file introduces rotated,
   negatively-positioned, bleeding elements — the exact thing that breaks it.
   `document.documentElement.scrollWidth - clientWidth` must stay **0**.
2. Confirm `vendor-motion` did not re-enter the modulepreload list.
3. Confirm `footer.css` is a **lazy** chunk, not part of entry CSS.
4. Confirm one `rAF` loop, not three, and that it stops when the footer scrolls out.
5. Confirm every footer link's hit area is >= 44px.
6. Confirm plane-0 text measures >= 4.5:1 over the **darkest pixel** of every shard.
7. Confirm the ghost wordmark cannot be selected or tabbed to.
8. Confirm the Paradox banner text now passes on a route that is not the footer's own page.

## A note on strings in this file

**Quoted and safe** (they exist today): `Join the work →`, `See Highlights →`.

**Invented by the mock and needing approval before build** — check `docs/BRAND_VOICE.md` first:
`happening now` · `come and do something real.` ·
`Free forever. No donations, no fees. Turn up to one drive and you are in.` ·
`the work` · `the org` · `reach us` · `kolkata · since 2021` ·
`student run · darpan certified` · `open access · free forever` ·
`made with care in kolkata` · every activity sentence (`Aditi joined Welfare Projects` etc.,
which are **templates**, not strings) · every link label shown in the mock.

**Everything else is "KEEP whatever ships today"** — open `AQFooter`, use its real labels and
destinations, leave them byte-identical.

## Unresolved after this file

1. **Where does activity data come from?** Does `notificationService` already aggregate these
   events, or does the band need a derived query? (14.2 — blocks the band, not the footer.)
2. **The verb list.** Which events are worth showing, and what is each one's sentence template?
3. **Copy approval** for the eleven invented strings above.
4. **`G-02`: the `.aq-contact-nudge` bubble** is fixed at z-60 bottom-right and the mobile audit
   records it **overlapping card body text** on `/teams/:uuid`, `/about` and `/projects`. It now
   competes with the footer's CTA and the roaming mascots for the same corner.
   **Three floating things is too many.** My recommendation: **retire the nudge** — the footer's
   `Contact` link and a real contact CTA make it redundant, and it is the only one of the three
   that is currently a measured defect.
5. **Does the current footer use `logo.png` in a circular slot?** If so that is bug `02.4`
   recurring and this file fixes it.
6. **Are the four repo photos the right four?** They are reused from the feed; a footer showing
   the same photos as the page above it is weaker than four chosen for it.
