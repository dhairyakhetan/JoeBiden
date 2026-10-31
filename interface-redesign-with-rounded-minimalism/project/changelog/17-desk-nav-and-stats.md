# 17 · Command Desk — navigation and the stats block

**Files touched:** `frontend/src/director/DirectorDashboard.tsx` + `.css`,
`frontend/src/director/DirectorLanding.tsx`, `frontend/src/styles/routes/director.css`,
`frontend/src/director/adminKit.tsx`.
**Design source:** `AquaTerra Feed.dc.html` — `14a` (desktop), `14b` (phone).
**Prerequisites:** `00`, `06`. **This file amends `06.3` and `06.4`; it does not replace `06`.**

## Global invariants

1–9 as in `changelog/README.md`. In particular: **no Supabase changes**, **no route changes**,
**no copy changes** except where quoted, **no new dependencies**.

## 17.0 · What this file changes, and what `06` keeps

`06-hod-desk.md` was written against a **17-desk** guess. The real count, read from the repo, is
**28 files** in `frontend/src/director/` — `ProjectManager` is five files and 98KB,
`VolunteerApplications` three and 71KB. So the nav has to carry **~20 destinations**, which a flat
list cannot do.

| `06` section | status |
|---|---|
| `06.0` bug fixes (`--rust`, `--r-card`, `--font-hand`, hand-added hexes) | **unchanged, still required** |
| `06.3` the ink rail | **superseded by 17.1** — three tiers instead of one column |
| `06.4` the triage landing | **kept.** 17.2 replaces only its **stats section** with the jigsaw |
| `06.5` the table primitive | **unchanged** |
| `06.6` approvals, bulk, undo | **unchanged** |
| `06.7` skeletons | **unchanged** |

**The landing stays the landing.** You chose triage-first, and the jigsaw is its stats block.

## 17.1 · Three-tier navigation (supersedes `06.3`)

    tier 1   68px   glyph rail        ink, always visible, 5 glyphs + avatar
    tier 2  230px   label column      ink, one group expanded, L-connector children
    tier 3   1fr    the desk itself   cream page, white cards

### Tier 1 — the glyph rail

```css
.ops-rail1 {
  width: 68px; flex: none;
  background: var(--ink);
  border-radius: var(--r-outer);
  padding: var(--pad-card);
  display: flex; flex-direction: column; gap: 6px; align-items: center;
}
.ops-glyph {
  width: 48px; height: 48px; flex: none;
  border: none; background: transparent;
  border-radius: var(--r-pill);
  display: grid; place-items: center; cursor: pointer;
  color: var(--nav-fg-mid);              /* 0.72 — 7.9:1 */
  position: relative;
}
.ops-glyph:hover        { background: var(--nav-well); color: var(--nav-fg); }
.ops-glyph[aria-current] { background: var(--paper); color: var(--ink); }
```

- **Five glyphs, one per group**, plus the brand mark at the top and the member avatar at the
  bottom. **Five is the cap** — a sixth group means regrouping, not a sixth glyph.
- **The count badge sits on the glyph**, top-right, `min-width: 19px; height: 19px`,
  `box-shadow: 0 0 0 2px var(--ink)` so it reads as applied to the rail:
  - **tomato** when something is overdue,
  - **lemon** when something is waiting but not overdue,
  - **a 9px welfare dot** when the group is merely non-empty,
  - **nothing** when it is empty. **Never a `0` badge** — an empty group is silent.
- **48px, not 44.** Justified: it sits in a 68px rail with 10px padding, so 48 is the maximum that
  fits, and it exceeds the 44px floor. Document it inline.
- **`aria-current="page"`** on the active glyph, and each glyph needs an `aria-label` —
  it is icon-only.
- **Use `stamp-white.png`**, not `logo.png`, for the mark (`02.4`).

### Tier 2 — the label column

- **SET** `width: 230px`, `background: var(--ink)`, `border-radius: var(--r-outer)`,
  `padding: var(--pad-card)`.
- **Header:** the desk name in display 900/16 with one welfare word, then the scope line in mono
  uppercase `9px` at `var(--nav-fg-faint)`. **KEEP the existing `acting as · …` construction and
  `getRoleLabel`** from `06.3`.
- **The expanded group** sits in a `var(--nav-well)` container at radius 22 with `padding: 6px`:
  - **the parent** is a `var(--paper)` pill, `min-height: 42px`, ink text at `800 12.5px`, with a
    mono total on the right and a **collapse minus** in a 26px `rgba(10,10,10,.08)` disc.
  - **the children** are indented 16px with a **1px vertical connector** at `var(--nav-rule)`
    running from the top to 20px above the last child, and a **9px horizontal stub** at each
    child's vertical centre. That is the L-connector from your reference, and it is two
    absolutely-positioned 1px spans — no SVG, no border tricks.
  - **the active child** is a `var(--paper)` pill at `min-height: 40px`; inactive children are
    transparent with `var(--nav-fg-strong)` (0.82, 10.1:1) text.
  - each child carries either a **count badge** (tomato/lemon, ink text) or a **7px dot** at
    `rgba(244,239,224,.28)` when it is empty. **Non-text, so the low alpha is legal.**
- **Collapsed groups** are transparent rows, `min-height: 42px`, label at `700 12.5px` in
  `var(--nav-fg-strong)`, a **zero-padded two-digit count** in mono
  (`String(n).padStart(2,'0')`) at `var(--nav-fg-faint)`, and a chevron.
- **A hairline `var(--nav-rule)` separator** before the last group (org setup), because
  configuration is a different kind of thing from work.
- **Footer:** the `last opened` well from `06.3.3`, unchanged.
- **Only one group is expanded at a time.** Expanding another collapses the current one. The
  expanded group is the one containing the current route — **derived, not stored**.

### The four groups

Map all ~20 desks into these. **The grouping is a proposal — check it against the real route
list before building, and report any desk that does not fit.**

| group | desks |
|---|---|
| **the queue** | accounts · posts · certificates |
| **people** | member directory · roles · member of the month · teams |
| **the work** | drives · projects · applications · hiring responses · form responses · enquiries |
| **publishing** | blog drafts · content · yearbook · notice board · WhatsApp scripts |
| **org setup** | categories · SOPs · collaborations · equity |

**Five groups, and the rail's cap is five glyphs — so this is exactly at capacity. The names are
APPROVED (2026-09-05) and are now the product's top-level information architecture:**
`the queue` · `people` · `the work` · `publishing` · `org setup`.
**A sixth group is not available.** A new desk joins an existing group or replaces one.
**`superOnly` and `canApproveMembers` still filter the list** — a scoped HoD sees fewer, and the
counts must be scoped too (`06.4.1`).

### Mobile (tier collapse)

- Below **1024px** tiers 1 and 2 **collapse into one sheet** behind a single button in the header
  showing the total destination count (`14b` shows `20`).
- The sheet is the ink bottom sheet from `20` (search), reused: grabber, peek disabled, full
  height only. **One sheet component, two callers.**
- **KEEP `overscroll-behavior-x: contain`** on any horizontal scroller inside it (`06`).

## 17.2 · The jigsaw stats block (replaces `06.4`'s stat grid only)

### The notch — how it is actually built

**Two blocks interlock by a 26px circle in the page's background colour, centred on their shared
edge.** No `clip-path`, no mask, no SVG.

```css
.ops-block { position: relative; overflow: hidden; padding: 16px; min-height: 132px; }
.ops-block::after {                     /* the notch */
  content: ''; position: absolute;
  width: 26px; height: 26px; border-radius: var(--r-pill);
  background: var(--card);              /* the colour BEHIND the block, not the block */
  right: -13px; top: 50%; transform: translateY(-50%);
}
```

- **The notch's colour is whatever sits behind the block.** Inside a white card it is
  `var(--card)`; on the cream page it is `var(--bg)`. **Getting this wrong is the one way this
  effect looks broken** — the circle must disappear into the ground.
- **The radius rule for a notched block:** **6px on every notched side, 22px on every free side.**
  So a three-across row reads `22px 6px 6px 22px` / `6px` / `6px 22px 22px 6px`.
  **6px is the third documented exception to the radius scale** (with the 6px mention mark and the
  18px checkbox) and it exists because a notched edge is not a corner.
- **Blocks sit in a grid with `gap: 6px`**, and the notch is 26px wide with 13px each side — so it
  spans the gap and bites 10px into each neighbour. Do not change the gap without recomputing.

### The blocks

Row 1: `1.35fr 1fr 1fr` — **accounts waiting** (tomato) · **posts in queue** (lemon) ·
**enquiries** (ink).
Row 2: `1fr 1fr 1.35fr` — **applications** (sky) · **certificates** (grape) · **next drive**
(photo).

- **SET** each figure at `900 58px var(--display)` (row 1) / `38px` (row 2), `line-height: .82`,
  `letter-spacing: -.05em`, **`font-variant-numeric: tabular-nums`**.
- **SET** the label in mono uppercase `9px/800` at **full-opacity `var(--ink)`** on hue blocks and
  `var(--nav-fg-faint)` on the ink block.
  **NOT `rgba(10,10,10,.7)`.** An earlier draft of this file instructed that alpha; on welfare it
  measures **3.28:1** and fails. Welfare and grape are only 0.05 above the floor at full opacity,
  so **there is no alpha headroom on an accent fill at all** — see `README.md` invariant 7.
- **SET** the sub-line in mono `10px/700`, **also full-opacity ink** — and **it must say something
  a count cannot**:
  `oldest 4d · 2 from your school`, `welfare 5 · labs 2`, `none touched yet`.
  **If the sub-line's data is not available, omit the sub-line** rather than padding it.
- **Ink text on every hue** (`DESIGN.md` §2). Tomato 6.7:1, lemon 15.1:1, sky 9.4:1, grape 4.55:1.
  **Paper on the ink block only.**
- **The photo block is the only decorative one.** `linear-gradient(to right, rgba(10,10,10,.72),
  rgba(10,10,10,.15))` scrim, paper text bottom-left, **notch circle at `z-index: 2`** so the
  photo does not cover it.
- **Every figure is a count the landing already fetches** (`06.4.1`). **Do not add a query for a
  block.** If a figure is unavailable, **drop that block from the grid** and re-balance the
  fractions — do not render a zero, and do not render a marker in a display-scale figure where it
  would read as a broken number.
- **The `next drive` block is the exception:** `06.4` and `01` both record that **the app fetches
  no drive rows**. So **this block only renders if a drive is genuinely readable.** If not, row 2
  becomes `1fr 1fr` with the notch removed from the last free edge.

### Phone

- **Stacks vertically**, one block per row, and **the notch moves to the horizontal edges**:
  `left: 50%; transform: translateX(-50%)` at `top: -13px` / `bottom: -13px`.
- Radius becomes `22px 22px 6px 6px` (first) / `6px` (middle) / `6px 6px 22px 22px` (last).
- **The notch colour on phone is `var(--bg)`**, because the blocks sit on the cream page rather
  than inside a white card.
- Each block gains an **inline action pill** (`Review` / `Open`) at `min-height: 44px`, because on
  phone the block *is* the entry point — there is no table beside it.

## 17.3 · The landing header

- **KEEP** `What needs you today` and the whole `todo` fragment system from `06.4`, including all
  twelve singular/plural forms and `nothing waiting ${scopeNote} - nice work`.
- **SET** the meta line to mono `10.5px`: total waiting, oldest age, and
  **`+N since you last opened`** in `var(--welfare-ink)`.
  **The `+N` is still unresolved** (`06.4.2`) — it needs a persisted last-opened timestamp.
  **If there is none, omit the clause.** Do not fake it from `sessionStorage`.
- **ADD** an `Export` pill and an `Approve all N` primary. **`Approve all` must respect the
  current filter and scope**, and must go through the same confirm-or-undo path as `06.6.3`.
  **If bulk approve does not exist as a service call, do not add one** — render the button
  disabled with a title explaining, or omit it.

## 17.4 · What to delete

- **DELETE** the current topbar + horizontal tab strip + sidebar arrangement. Three navigation
  mechanisms for one hierarchy is the second of the eight problems.
- **DELETE** `.torn-divider` and `.adm-tape` (both `.admin`-scoped). **Grep for callers first** —
  `06` already warns they may have consumers in per-desk files.
- **DELETE** the `№ 01` numbering (`06.4.3`).
- **DELETE** the four hand-added hexes in the desk (`#c0341f`, `#0b7d57`, `#8a6d00`, `#1769a8`) —
  they duplicate existing `*-ink` tokens (`06.0`).
- **DELETE** `rgba(0,229,160,…)` from the desk's search focus ring (`06.0`).

## 17.5 · The eight problems, and where each is answered

| your problem | answered by |
|---|---|
| can't see what needs me on landing | `06.4` triage + **17.2** jigsaw |
| too many tabs, no hierarchy | **17.1** three tiers, five groups |
| tables unusable on mobile | `06.5` card fallback + **17.2** phone blocks |
| approvals take too many clicks | `06.6` inline verdicts + **17.3** approve-all |
| no bulk actions | `06.6.2` selection bar + **14b** sticky bulk bar |
| filters/search are weak | `06.5` toolbar, saved views |
| no sense of what changed | **17.3** `+N since you last opened` *(blocked on a timestamp)* |
| feels disconnected from the product | **17.1** same ink chrome, same 32/22/14, same stickers |

## States

- **Loading:** the rail and label column render immediately (they are static). **The jigsaw
  skeleton must be the same grid with the same fractions and the same notches** — `06.7` records
  that the current landing skeleton reflows from 4-up to 2-up and "read as the page jumping".
- **Empty (nothing waiting):** **KEEP `nothing waiting ${scopeNote} - nice work`** and
  `Approvals and the post queue are all clear.` **Replace the jigsaw with a single full-width
  welfare block** rather than six zeros.
- **Error:** `AdminErrorState` with `onRetry`, per `adminKit`. **Reuse it — do not write another.**
- **Partial failure:** if three of six counts resolve, **render three blocks**, not six with
  markers.
- **Permission denied:** the rail renders only permitted glyphs; a direct URL to a forbidden desk
  hits the existing route guard. **Mirror the guard, never widen it.**

## Verification

1. `aria-current="page"` on the active glyph and the active child; `aria-label` on every glyph.
2. Every notch circle matches the colour actually behind it, at both breakpoints.
3. Radii are only 999 / 32 / 22 / 14 / **6 (notched edges only)**.
4. Ink text on every hue block; paper only on ink.
5. No `0` badge anywhere; no zero in a display-scale figure.
6. Zero horizontal overflow at 375px **and 360px**.
7. Counts are scoped for a scoped HoD (`06.4.1`) — verify with a welfare-only HoD.
8. `Approve all` respects filter + scope, and is undoable or confirmed.

## A note on strings in this file

**Read from source, safe:** `command desk`, `What needs you today`, the twelve `todo` fragments,
`review →`, `nothing waiting ${scopeNote} - nice work`,
`Approvals and the post queue are all clear.`, `all {deskCount} desks`, `clear`, `loading…`,
the seventeen desk labels, `pending approvals` / `posts in queue` / `new enquiries` /
`open applications`, `HR` / `SUPER ADMIN` / `HOD`, `operator`.

**Invented by the mock, needing approval:** `the queue` · `hod · welfare, labs` ·
`people` · `the work` · `publishing` · `org setup` · `accounts` · `posts` · `certificates` ·
`last opened` · `yesterday · 6:12pm` · `accounts waiting` · `oldest 4d · 2 from your school` ·
`welfare 5 · labs 2` · `none touched yet` · `next drive` · `Topsia · Sat 9am` ·
`+9 since you last opened` · `Export` · `Approve all 9` · `oldest first` · `name or school` ·
`3 selected` · `Approve` · `Reject` · `Clear` · `Review` · `Open` · `Show 7 more` ·
`Mohit Kumar approved` · `Undo` · `waiting` · every column header · every member name and school.

**The five group names were the most consequential invented strings in this file and are now
APPROVED.** Everything else in the "invented" list above is cleared to ship under the blanket
copy approval of 2026-09-05.

## Unresolved after this file

1. **The group mapping.** My five groups are a proposal against a file list, not a route list.
   **Check every one of the ~20 desks lands in exactly one group**, and tell me about any that
   does not fit.
2. ~~Five groups, or fold `org setup` into `publishing`?~~ **RESOLVED: five stays.** Category
   management and blog drafts are different jobs and should not share a glyph.
3. **`+N since you last opened`** needs a persisted timestamp. Does one exist?
4. **Does a bulk-approve service call exist**, or is `Approve all` a loop over single calls?
   A loop of 9 writes with no transaction is a different UX (partial failure) and needs designing.
5. **`WhatsAppTemplates` renders as a section inside a parent desk**, not standalone. **Which
   parent?** It affects whether it is a tier-2 child or a tab inside one.
6. **`ProjectManager` is five files and 98KB** and `VolunteerApplications` three and 71KB.
   Are these one destination each, or do they have internal navigation that needs a tier?
7. **The photo in the `next drive` block** — which image, and does a readable drive row exist?
