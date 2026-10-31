# 10 · Projects — directory and drive detail

**Files touched:** `frontend/src/public/ProjectsPage.tsx`, the drive/project detail route,
`frontend/src/public/DirectoryPage.tsx` (rail pattern), their CSS.
**Design source:** `AquaTerra Feed.dc.html` — `19a` (directory, desktop), `19b` (drive detail, phone).
**Prerequisites:** `00`, `13` (stickers), `15` (the shape-by-data principle), `17.2` (notch geometry).

## Global invariants

1–9 as in `changelog/README.md`, plus the **overlap rule** and the **contrast ladder**.

## 10.0 · The data, and why the tiles vary

`welfare_projects` is the largest content table in the product:

- **2,031 rows carry `main_image`** — this is where the photography lives, not `posts` (`15.1`)
- **486 rows carry both `main_image` and `key_statistic`** — the strongest tiles available
- `volunteers` is **prose, not a filled/needed pair** (`feedShape.ts` notes this)

**So the tile shape is chosen by what the row actually holds**, exactly as `feedShape.ts` chooses a
card shape. **This is not decoration — it is the same principle applied to the archive:**

| the row has | tile |
|---|---|
| photo **+** statistic | **tall photo tile** — statistic at display scale over the photo |
| statistic, no photo | **cream well tile** — the number in a radius-22 well inside a white card |
| photo, no statistic | **short photo tile** — title only |
| short body, no photo | **serif quote tile** on a saturated hue |
| a blog link | **ink link tile** with a chain glyph |
| *(one per viewport, max)* | **circle tile** — the only decorative shape |

**The circle tile is capped at one per viewport.** More than one and it reads as a pattern rather
than punctuation. **If the algorithm cannot enforce the cap cheaply, drop the circle tile
entirely** — it is the one shape the design can live without.

## 10.1 · The directory

### Masonry

- **Use CSS `columns`, not a JS masonry library** (invariant 6):
  `columns: 3; column-gap: 12px` with `break-inside: avoid; margin-bottom: 12px` on each tile.
  **2 columns below 900px, 1 below 620px.**
- **CSS columns fill top-to-bottom then left-to-right**, so visual order does not match DOM order.
  **This is acceptable here** because the grid is a browsable archive, not a ranked list — but
  **it must not be used for anything where order carries meaning** (the feed, search results).
- **`loading="lazy"` on every tile image except the first three.** At 2,031 rows this matters more
  than anywhere else in the product.
- **Every photo tile uses the two-stop scrim from `15.7`**:
  `linear-gradient(to top, rgba(10,10,10,.88), rgba(10,10,10,.42) 44%, rgba(10,10,10,.06))`.
  **The mobile audit flags "text over busy image" as a live risk on this exact route.** A flat tint
  is what makes that risk real — a light photo defeats it. **Never replace the gradient with an
  `opacity` or a `filter`.**
- **Paper on the .88 stop measures 14.2:1.** Verify against the lightest photo in the set.

### The sticky rail

- **SET** `position: sticky; top: 14px` on a white card (32/10), `width: 236px`.
- Rows are `min-height: 44px`, radius 22, with a **6px category dot** and a mono tabular count.
  The active row is ink-filled with paper text.
- **The counts must come from one query, not one per category.** If a grouped count is not
  available, **render the rail without counts** rather than firing six queries — the same rule as
  `08.2`'s hue discs.
- **The "with a statistic" shortcut (486)** is the most useful filter in the archive and does not
  exist today. It is one `WHERE key_statistic IS NOT NULL`.
- **Below 900px the rail becomes a horizontal pill scroller** above the grid, with
  `overscroll-behavior-x: contain`.

### Scroll-revealed search

The interaction you asked for.

- **The search bar is not in the header.** It appears when the grid's top passes the viewport top.
- **`IntersectionObserver` on a sentinel above the grid** — never a scroll listener.
  `position: sticky; top: 14px`, frosted, translating in from `-100%` with opacity.
- **It must be reachable without scrolling:** a **skip link or a header search icon** that focuses
  it. A control that only exists after a scroll gesture is unreachable by keyboard otherwise.
- **`prefers-reduced-motion`: it appears without the translate** — visibility still changes,
  because that is state, not decoration.
- **Placeholder states the corpus size** (`search 2,031 drives`) so the field explains its scope.
  **Read the count; never hard-code it.**

### Hover preview

- On `:hover` and `:focus-within`, a tile reveals a white radius-32 card below it: a **3-thumbnail
  strip** at radius 14, a contributor avatar stack, and `updated N days ago`.
- **`:focus-within` is not optional** — hover-only content is invisible to keyboard users.
- **Desktop only** (`@media (hover: hover) and (min-width: 900px)`). On touch, tapping opens the
  detail page, which is the better outcome anyway.
- **The thumbnails need extra images per row.** If `welfare_projects` holds only `main_image`,
  **the strip does not render** — show the avatars and the timestamp alone. **Do not repeat
  `main_image` three times.**

### Toolbar

- A section title, a total count pill, a **contributor avatar cluster** (`+N` overflow disc in ink),
  and a sort pill. All `min-height: 40px`.

## 10.2 · Drive detail — stacked bands

**Design:** `19b`. Mobile-first; on desktop the bands become a 2×2 grid beside the write-up.

- **SET** the hero: full-bleed photo at radius 32, the two-stop scrim, a 44px back button in
  `rgba(10,10,10,.7)` with `backdrop-filter`, a stamped category sticker, and the title in
  **display uppercase with a serif second line**.
- **The bands are the page's spine.** Each is one fact: a display-scale tabular figure, a mono
  uppercase label, and one line of context.
  **Reuse `17.2`'s notch geometry** — 22px on free edges, 6px where bands meet — so the desk and
  the public archive share one shape language.
- **Ink text on every hue band.** Lemon 15.1:1, sky 9.4:1, pink 6.4:1.
- **The last band is ink, and it states what is still missing.** This is the most important
  decision on the page: a page that only lists achievements has no reason for a CTA. The ink band
  says *40 desks for 60 children*, and that is what earns *"put my name down"* underneath it.
  **If the row has no shortfall data, the ink band does not render and the CTA becomes a general
  join link** — do not invent a deficit.
- **The segmented bar is discrete segments, not a percentage fill.** 40 of 60 desks is a count; a
  smooth bar implies precision the data does not have. `display: flex; gap: 3px` with
  `flex: 1` segments, filled in `var(--welfare)` and empty at `rgba(244,239,224,.18)`.
  **Never `role="progressbar"`** unless the value really is continuous.
- **The write-up** is a white card: author row, then the body at `400 16px/1.68` with
  `text-wrap: pretty`, then a photo pair at radius 22. **Unclamped.**
- **The CTA band** is welfare-filled at radius 32 with one bleeding circle, a display headline, one
  paragraph, and a full-width ink action at `min-height: 52px`.

### Desktop

`grid-template-columns: minmax(0,1fr) 380px` — write-up left, bands sticky right. **The bands
become a vertical stack in the right column**, keeping the notch geometry.

## 10.3 · What to delete

- **DELETE `.aq-contact-nudge`** from these routes — the mobile audit records it overlapping card
  body text on `/projects` specifically. `14` retires it globally.
- **DELETE any flat-tint overlay** on a photo tile in favour of the two-stop scrim.
- **DELETE hard ink borders and offset shadows** from tiles and cards (`00.6`).
- **DELETE `outline` on tile images** (`00.15`).
- **DELETE the `#FF7A1A`** hand-added hex if it appears on this route (`01.15.5` flags it in the
  feed's closed-opening notice).

## States

- **Loading:** **column-shaped skeletons at the real tile heights**, three columns, on
  `var(--bg-2)`. **Do not render a uniform grid of equal blocks** — it reflows into a masonry and
  reproduces the "page jumping" `06.7` documents.
- **Empty (filtered):** a cream radius-22 well **with the filter named and a clear-filter action**
  (gap 20). At 2,031 rows the only empty state is an over-filtered one, so the action is the point.
- **Error:** retry, per `00`.
- **A row with no photo** is the **cream well tile** — that is a designed state, not a fallback.
- **A row with no statistic and no body** renders as the short photo tile with title only.
  **If it has none of the three, it does not render.** An archive tile with nothing in it is worse
  than 2,030 tiles.
- **Offline / failed image:** a `var(--bg-2)` block at the tile's aspect with the title still
  visible. **The title must never live only on top of the image** for this reason — it is why the
  cream well tile exists.

## Verification

1. Tile shape is derived from the row's fields, not from an index or a random pick.
2. **Every photo tile uses the two-stop scrim.** Paper measures >= 4.5:1 on the darkest stop.
3. Circle tiles: **at most one per viewport.**
4. `columns` not a JS masonry lib; `break-inside: avoid` on every tile.
5. **Search bar reachable by keyboard without scrolling.**
6. `IntersectionObserver`, not a scroll listener.
7. Hover preview also fires on `:focus-within`; disabled below 900px.
8. Rail counts come from one query or are absent.
9. Bands: ink text on hue, notch geometry matches `17.2`, **no `role="progressbar"`** on the
   segmented bar.
10. Radii only 999 / 32 / 22 / 14 / 6 (notched edges).
11. Zero horizontal overflow at 375px and 360px.
12. `loading="lazy"` on all but the first three tiles.

## A note on strings

**Approved (bulk):** `the archive` · `2,031 written up` · `everything` · `the ones with numbers` ·
`with a statistic` · `Everything, newest first` · `search 2,031 drives` · `appears on scroll` ·
`children reached` · `saplings planted` · `cartons carried` · `volunteers` · `still short` ·
`40 in place` · `20 to go` · `two schools, one island` ·
`notebooks, geometry boxes, sheets` · `6am boat, back after dark` ·
`desks for 60 children — half the class still sits on the floor` · `wrote this up · dec 2025` ·
`trip nine is being planned.` ·
`Benches this time. Four people went last time; there is room for eight.` ·
`Put my name down` · `updated 4 days ago` · `write-up` · `hover state ↓` ·
`Fourteen of us, one platform, four hours. Nobody planned it past that.` ·
`Rabindra Sarobar, six seasons` · `Khidirpur books` · `15,000+ bananas, and counting` ·
`What eight Sundarbans trips taught us about logistics` · `sundarbans education drive`.

**Every project title, statistic and body in the mock is illustrative.** The real ones come from
`welfare_projects`. **The cleared facts** (3,500+ children, 4,000+ saplings, 15,000+ bananas,
8 trips, Dec 2025) are from `BRAND_VOICE.md` §3 and are safe.
**No blocked stat appears** — no project count anywhere on these screens, because
450+/512+/534+/550+ is unresolved (`09.0`). **The rail's `2,031` is a row count, not the drives
figure** — it is countable from the table and is not one of the four disputed values. **Label it
carefully:** `written up`, not `drives completed`.

## Unresolved after this file

1. **Does `welfare_projects` hold more than one image per row?** Decides whether the hover
   thumbnail strip and the detail photo pair can render.
2. **Is a grouped category count available in one query?** Decides whether the rail shows counts.
3. **Does any row carry shortfall data** (desks needed, target vs actual)? The ink band and the
   segmented bar both depend on it. `volunteers` being prose suggests probably not.
4. **`key_statistic` — is it a number + unit, or a formatted string?** The tall tile sets the
   number at 34px and the unit at 8.5px, which needs them separable.
5. **Is the detail route `/projects/:id` or nested under a category?** Affects the back button.
6. **Should `2,031` be shown at all**, given the drives-count conflict? A visitor may read it as
   the disputed figure. **My call: yes, labelled `written up`** — but say if you would rather it
   waited for the reconciliation.
