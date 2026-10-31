# 13 · The sticker system

**Files touched:** `frontend/src/components/Sticker.tsx` (new), `frontend/src/styles/v6.css`
(the `.sticker` rules and the line ~1601 override), `frontend/src/lib/uiHelpers.ts`.
**Design source:** `AquaTerra Feed.dc.html` — `11a` (the sheet), `11b` (applied).
**Prerequisites:** `00`. **Everything else in this changelog depends on THIS file** — build it first.

> ## Boundary ruled 2026-09-06 — TWO sticker systems ship, deliberately
>
> There are two, and the owner ruled to **keep both with a boundary** rather than merge them:
>
> - **The CSS system** (`v6.css` `.sticker*` + `lib/uiHelpers.ts`'s hashed `stickerRotation`)
>   is the faithful build of THIS file - eight silhouettes, stamped/die-cut, sm/md/lg, rotation
>   hashed from the sticker's own text, and `--sticker-ground` honoured. **It is the default.**
>   Used in ~45 files. If you are adding a sticker, use this one.
> - **`components/Sticker.tsx` + `lib/stickerShapes.ts`** is a separate SVG system from "AQ
>   Stickers.dc.html", used in 8 files. It exists for its own shape vocabulary (`star4`,
>   `quatrefoil`, `gear12`, `gear16`) which has no CSS equivalent. Its rotation is a MANUAL
>   prop clamped to -11..+9, not hashed, and its keyline is a fixed module constant
>   (`KEYLINE_COLOR = '#FFFFFF'`) with no `ground` prop - so **§13.1's ground rule is
>   structurally unimplementable there.** That is the known cost of keeping it.
>
> **The boundary:** reach for `Sticker.tsx` only when you specifically need one of its shapes.
> Everything else uses the CSS system. Four files currently use both; that is allowed but is
> not a pattern to copy. Do not port shapes between them, and do not let a third appear.
>
> Known follow-up, not yet done: `Sticker.tsx` draws a white keyline regardless of what it sits
> on, so on a non-white ground it reads as a hole rather than a die-cut. Giving it a `ground`
> prop is the fix if its 8 call sites ever land on a dark surface.

## Global invariants

1–9 as in `changelog/README.md`.

## 13.0 · What exists today, and the bug

The codebase has **one** sticker: a lemon pill with a 2px ink border and a `2px 2px 0` offset.

**And it currently renders flat.** `v6.css` line ~1601:
```css
.sticker { box-shadow: none !important; border: none !important; }
```
**DELETE that rule.** It cancels the sticker's own motif, and `00.8` already records it. Grep for
why it was added before deleting — if something downstream depends on a flat sticker, that thing
wants a different variant, not a global override.

## 13.1 · THE ONE RULE

**If you can tap it, it is `stamped`. If you cannot, it is `die-cut`.**

```css
/* stamped — a control. Presses. */
.sticker--stamped {
  border: var(--bd-ink);              /* 2px solid var(--ink) */
  box-shadow: var(--sh);              /* 2px 2px 0 0 var(--ink) */
}
.sticker--stamped:hover  { transform: translate(-1px,-1px) rotate(var(--rot)); box-shadow: var(--sh-lg); }
.sticker--stamped:active { transform: scale(.96) rotate(var(--rot));            box-shadow: var(--sh-pressed); }

/* die-cut — decoration or a state readout. Inert. */
.sticker--diecut {
  border: none;
  box-shadow: 0 0 0 3px var(--sticker-ground);   /* the colour BEHIND it */
}
.sticker--diecut:hover { /* nothing. It is not clickable. */ }
```

**A die-cut sticker must have no hover state.** A hover on an inert object is a lie about
affordance, and it is the single easiest way to make this system feel wrong.

### The keyline colour is the ground, not the sticker

`--sticker-ground` must be **the colour of whatever the sticker lies on**:

| the sticker lies on | `--sticker-ground` |
|---|---|
| the cream page | `var(--bg)` #F4EFE0 |
| a white card | `var(--card)` #FFFFFF |
| an ink section | `var(--ink)` #0A0A0A |
| a photograph | `var(--paper)` #F4EFE0 — a photo has no single colour, so the keyline reads as a cut edge |

**Getting this wrong is the one way a die-cut looks broken.** An ink keyline on an ink ground is
invisible; a cream keyline on cream is invisible. **Both mistakes shipped in earlier drafts of this
design — verify every instance against its actual parent.**

## 13.2 · Eight silhouettes

All eight are CSS. **No assets, no SVG except the arc-set seal.**

| name | implementation |
|---|---|
| **circle** | `border-radius: var(--r-pill)`, equal width/height |
| **squircle** | `border-radius: var(--r-inner)` (22), equal width/height |
| **pill** | `border-radius: var(--r-pill)`, auto width |
| **starburst** | `clip-path: polygon(…)` — 22 points, alternating radius |
| **rosette** | `clip-path: polygon(…)` — 28 points, shallower alternation |
| **diamond** | `clip-path: polygon(50% 2%, 98% 50%, 50% 98%, 2% 50%)` |
| **oval** | `border-radius: 50%`, wider than tall |
| **bubble** | `border-radius: 22px 22px 22px 4px` — the 4px corner is the tail |

**`clip-path` and `box-shadow` do not compose** — a clip removes the shadow. So the three clipped
silhouettes (starburst, rosette, diamond) **cannot carry a die-cut keyline** and must either sit
on a ground where they read without one, or be nested inside a slightly larger clipped element in
the keyline colour. **The mock uses the former.** Note this inline; it is not obvious and someone
will try to add a keyline and find it silently missing.

## 13.3 · Three sizes

| size | font | padding |
|---|---|---|
| `sm` | 9px / 900 / `.05em` | `4px 10px` |
| `md` | 11px / 900 / `.04em` | `6px 13px` |
| `lg` | 15px / 900 / `.03em` | `9px 18px` |

All `var(--display)`, uppercase. **`sm` is below the 44px target floor and is therefore
die-cut-only** — a 9px stamped sticker is a control nobody can hit. **Stamped stickers are `md`
or `lg`, and `md` must sit in a >= 44px hit area even though the pill itself is ~30px.**

## 13.4 · Rotation — hashed, never random

```js
const ROTATIONS = [-6, -3, -2.5, -2, 1.5, 2, 3, 4, 6, 8];
export function stickerRotation(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return ROTATIONS[Math.abs(h) % ROTATIONS.length];
}
```

- **Ten fixed values, indexed by a hash of the sticker's own text.** The same sticker sits at the
  same angle on every render and after every reload.
- **`Math.random()` here is a bug, not a style choice.** A random rotation re-rolls on every React
  re-render, so the page twitches whenever anything above it changes state.
- **Under `prefers-reduced-motion` the rotations STAY.** They are composition, not motion. Only
  transitions are removed.
- **Never rotate a name, a number, or anything a user must read carefully.** Rotation is chrome.
- Expose the angle as a custom property (`--rot`) so `:hover` and `:active` transforms can
  preserve it — otherwise a hover un-rotates the sticker, which looks like a glitch.

## 13.5 · Ink text on every hue, without exception

```js
// Measured. Do not substitute paper on any of these.
lemon  #FFC700 → 15.1:1    sky   #3DA9FC → 9.4:1
tomato #FF4D2E →  6.7:1    pink  #FF4D8C → 6.4:1
teal   #12909C →  5.2:1    grape #7E5BFF → 4.55:1
welfare#1B8A5A →  4.55:1
```
Paper on grape is **3.78:1** and on teal **3.32:1** — both fail. **Grape and welfare sit 0.05
above the floor: do not lighten either fill and do not drop the weight below 700.**

**The one exception:** a sticker whose fill is `var(--paper)` or `var(--ink)` takes the opposite
as its text.

## 13.6 · The arc-set seal

The only part of the system that needs SVG, because CSS cannot set type on a path.

```html
<svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true">
  <circle cx="52" cy="52" r="50" fill="var(--lemon)" stroke="var(--sticker-ground)" stroke-width="3"/>
  <path id="seal-arc-{id}" d="M52 92a40 40 0 010-80a40 40 0 010 80" fill="none"/>
  <text font-family="var(--mono)" font-size="9.5" font-weight="800" letter-spacing="2.2" fill="var(--ink)">
    <textPath href="#seal-arc-{id}" startOffset="4%">★ VERIFIED ★ BY A HOD ★</textPath>
  </text>
  <!-- centre glyph -->
</svg>
```

- **The `id` must be unique per instance.** Two seals on one page with the same path id and the
  second one's text will not render. **Suffix it with the React key or a counter.**
- **`aria-hidden` plus a visible label elsewhere**, or an `aria-label` on the wrapper if the seal
  *is* the label. Arc-set type reads as gibberish to a screen reader.
- **The seal's text is a fixed label from a small set** — never per-item generated. Three exist:
  `★ VERIFIED ★ BY A HOD ★`, `· DRAG ME · DRAG ME ·`, `★ STUDENT RUN ★ SINCE 2021`.

## 13.7 · Glyph marks

Six geometric marks on hue discs: asterisk, eight-point star, globe grid, pinwheel, sun, smiley.

- **Geometric only — no illustration.** Every one is a filled or stroked path that can be written
  by hand. **This constraint is why the system needs no assets**, and it is the difference between
  a sticker system and an illustration commission.
- **A glyph is non-text** (WCAG 1.4.11, 3:1) but uses ink on hue anyway so a glyph and its label
  never disagree.

## 13.8 · The component

```jsx
<Sticker
  variant="stamped"           // | "diecut"
  shape="pill"                // circle squircle pill starburst rosette diamond oval bubble
  size="md"                   // sm md lg  — sm is diecut-only
  hue="lemon"                 // any palette hue, or "paper" | "ink"
  ground="card"               // bg | card | ink | paper — sets --sticker-ground
  as="span"                   // "button" makes it stamped and focusable
>★ first drive</Sticker>
```

- **`as="button"` forces `variant="stamped"`.** A die-cut button is a contradiction; make the
  component refuse it rather than trusting the caller.
- **`size="sm"` forces `variant="diecut"`** for the hit-target reason in 13.3.
- Rotation is derived from `children` when it is a string. **If `children` is not a string, the
  caller must pass `rotationKey`** — otherwise the hash has nothing stable to read.

## 13.9 · Where stickers are used

**This list is the system's whole justification — it is one component doing nine jobs:**

| use | variant | file |
|---|---|---|
| milestone on a photo (`★ first drive`) | stamped | `15.7`, `04` |
| category filter chips | stamped | `01`, `10` |
| state flag overhanging a card | stamped | `08`, `15.6` |
| section marker with a count | die-cut | `01`, `10` |
| the directory hero cluster | stamped (they are filters) | `08` |
| About's hero facts | die-cut | `09` |
| the footer wall's draggables | stamped | `14` |
| wall note labels | die-cut | `16` |
| the seal on a pull-quote card | die-cut | `15.9` |

## Verification

1. **The `!important` flattening rule is gone** and stickers render their border and offset.
2. **Every die-cut's keyline matches the colour actually behind it.** Check at both breakpoints
   and inside every card variant.
3. **No die-cut has a hover state.** No stamped sticker lacks one.
4. Rotation is stable across re-renders — **force a parent state change and confirm nothing moves.**
5. `sm` is never stamped. `md`/`lg` stamped stickers sit in >= 44px hit areas.
6. Ink text on every hue; paper only on ink or paper fills.
7. Every seal has a unique path `id` and renders its text.
8. `prefers-reduced-motion`: transitions gone, rotations intact.
9. No new asset files. The system adds **zero** bytes of images.

## Unresolved

1. **Why does the `!important` flattening rule exist?** Grep its callers before deleting.
2. **Does `Post` carry a `sticker` field?** Still open from `01` and `15.4`. It blocks the
   milestone overlay and the composer's sticker well.
3. **The three clipped silhouettes cannot carry a keyline** (13.2). Accept, or nest a second
   clipped element to fake one?
