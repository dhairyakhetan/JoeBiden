# 06 · Command Desk — shell, landing, and the table primitive

**Files touched:** `frontend/src/director/DirectorDashboard.tsx` + `.css`, `frontend/src/director/DirectorLanding.tsx`, `frontend/src/styles/routes/director.css`, `frontend/src/director/adminKit.tsx`
**Prerequisite:** `00-global-tokens-and-primitives.md` landed and verified.

## Global invariants (restated — do not skip)

1. **No new colours.** Every hex below already exists in `src/styles/tokens.css`.
2. **No new fonts, no new weights.** NeutralFace · Eina01 · JetBrains Mono · Instrument Serif.
3. **No copy changes.** Every user-facing string stays byte-identical, lowercase and trailing periods included.
4. **No route changes.**
5. **No Supabase changes.** No query, `select()` list, filter, RLS policy, service signature or return shape.
6. **No new dependencies.**
7. **Hit targets >= 44x44** on phone; the desk's documented desktop floor is 40px and stays. Text contrast >= 4.5:1, or >= 3:1 for type >= 24px. `:focus-visible` stays `3px solid var(--grape)` at `outline-offset: 2px`.
8. **`prefers-reduced-motion` coverage must not regress.**
9. **Do not touch `src/paradox/**`.**

## The concentric rule (restated — this is the spine of the whole redesign)

    outer radius  32px   with 10px padding  ->  inner radius  22px    (32 - 10)
    inner radius  22px   with  8px padding  ->  tight radius  14px    (22 -  8)

Tokens: `--r-outer: 32px` · `--r-inner: 22px` · `--r-tight: 14px` · `--pad-card: 10px` ·
`--pad-inner: 8px` · `--r-pill: 999px`.

**A radius that is not 999, 32, 22 or 14 is a bug.** In this file that applies especially to:
table container 32 -> header row 22 -> body row 22 -> cell chip 14; rail 32 -> group well 22 ->
nav item 14; modal 32 -> section 22 -> field 22.


**Design source:** `AquaTerra Feed.dc.html` — `4a` (landing, desktop), `4b` (landing, phone),
`4c` (the table primitive, desktop + phone).

**Scope.** This file redesigns the **shell**, the **landing** and the **shared table/queue
primitive**. It does **not** restyle the seventeen individual desks one by one — they inherit from
`adminKit` and `director.css`, which is the whole point of doing those three first. Per-desk work
(ProjectManager's own CSS, VolunteerApplications' own CSS, ContentManager's card grid) is
**explicitly out of scope** and gets its own files later.

**Order within this file:** 06.1 tokens -> 06.2 shell -> 06.3 rail -> 06.4 landing -> 06.5 toolbar
-> 06.6 table -> 06.7 states. Verify `/director` renders after each.

---

## 06.0 · Five live bugs to fix first

Found while reading `director.css`. All five ship today.

1. **`.admin .stamp-rejected { background: var(--rust); color: var(--paper); }`** — **`--rust` is
   defined nowhere in `tokens.css`.** So a rejected stamp has **no background** and renders paper
   text on the near-white card: effectively invisible. Same undefined token as the feed error banner
   (`00.4`). **SET** `var(--rust)` -> `var(--danger)` here and in `.admin .adm-error-icon`.
   **Grep `--rust` across `src/**` and replace every occurrence.**
2. **`.admin .ledger-empty { border-radius: var(--r-card, 26px); }`** — **`--r-card` is defined
   nowhere.** Every rule using it silently falls back to the `26px` literal, which is not on any
   scale. It appears on `.ledger-empty`, `.adm-bulkbar` and `.cm-card`. **SET** all three to
   `var(--r-outer)`.
3. **`.admin .adm-search:focus-within { box-shadow: 0 0 0 3px rgba(0,229,160,0.14); }`** —
   `rgb(0,229,160)` is a **mint that exists in no token**. It is the same hand-added mint found in
   the notice-board modal (`01.7`). **SET** to `0 0 0 3px color-mix(in srgb, var(--welfare) 16%, transparent)`.
4. **`.admin .adm-badge-success { color: #0b7d57 }` / `-warn { color: #8a6d00 }` / `-danger { color: #c0341f }` / `-info { color: #1769a8 }`**
   — four hex literals that duplicate `--welfare-ink`, `--lemon-ink`, `--danger` and `--sky-ink`.
   **SET** each to its token. `--hod-danger: #c0341f` is the same literal a third time — **SET**
   `--hod-danger: var(--danger)`.
5. **`.admin .stamp` uses `--font-hand, 'Caveat', cursive` in `.ledger-empty-note`** — Caveat is a
   **fifth typeface**, not among the four self-hosted families, and `--font-hand` is undefined, so
   it falls through to whatever `cursive` maps to on the device. That is uncontrolled and violates
   invariant 2. **SET** `.ledger-empty-note` `font-family` -> `var(--display)` and its
   `font-style: italic` -> **DELETE** (NeutralFace has no italic). See 06.7 for the full empty-state
   rewrite.

## 06.1 · Desk tokens

**File:** `frontend/src/styles/routes/director.css`, the `.admin { … }` block.

The desk stops declaring a competing elevation system and reads the global one.

- **SET** `--hod-border-w`: `3px` -> `1px`
- **SET** `--hod-border`: `var(--ink)` -> `rgba(10,10,10,0.12)` (i.e. the `--hair-2` colour)
- **SET** `--hod-shadow`: `4px 4px 0 0 var(--ink)` -> `var(--lift-1)`
- **SET** `--hod-shadow-sm`: `var(--hod-shadow)` -> `var(--lift-1)`
- **SET** `--hod-shadow-md`: `var(--hod-shadow)` -> `var(--lift-3)` (the bulk bar and sheets, which
  genuinely float above content, get a deeper lift than a card)
- **SET** `--hod-radius`: `20px` -> `var(--r-outer)` (32px)
- **SET** `--hod-radius-sm`: `12px` -> `var(--r-inner)` (22px)
- **ADD** `--hod-radius-xs: var(--r-tight);` (14px, for chips inside rows)
- **SET** `--hod-danger`: `#c0341f` -> `var(--danger)`
- **KEEP** `--hod-bg: var(--bg)`, `--hod-surface-1: #FFFFFF`, `--hod-surface-2: var(--bg-2)`,
  `--hod-ink`, `--hod-ink-2`, `--hod-ink-3`
- **SET** `--hod-surface-1`: `#FFFFFF` -> `var(--card)` (raw hex -> token; same value)
- **ADD** `--rail-w: 252px;` and `--rail-w-tablet: 216px;`

**DELETE** the rule `.admin .card > .panel-h:first-child { border-radius: calc(var(--hod-radius) - var(--hod-border-w)) … }`.
With a 1px border the subtraction is meaningless, and the concentric rule now derives the inner
radius from **padding**, not from border width. The header's radius becomes `var(--r-inner)` flat.

## 06.2 · Shell

**Files:** `DirectorDashboard.tsx`, `DirectorDashboard.css`

The desk becomes a **cream page holding an ink rail card and a content column**, both floating with
a 14px page inset. Today it is a topbar plus a horizontal scrolling strip plus a sidebar — three nav
mechanisms for one job.

- **SET** `.ops-shell`: `display: flex; gap: 0; padding: 14px; background: var(--bg); min-height: 100dvh;`
- **DELETE the `.ops-topbar` element and all its CSS.** Everything it carries moves:
  - brand (`command desk`) -> the rail's head. **KEEP the string and the `<Link to="/">`.**
  - `.ops-scope-chip` (`acting as · …`) -> the rail's head sub-line **and** the landing eyebrow.
    **KEEP the `scopeLabel` construction verbatim**, including `getRoleLabel` and the
    `.toLowerCase()` on the super-admin branch.
  - `.ops-dot`, `.ops-topbar-role`, `.ops-topbar-op` -> the rail's head. **KEEP the role-label
    ternary** (`'hr' ? 'HR' : isSuperAdmin ? 'SUPER ADMIN' : 'HOD'`) and `member?.full_name || 'operator'`.
  - `.ops-topbar-actions` (Home / Search / Notifications / Profile) -> the rail's foot as a
    four-up row of 44px pills. **KEEP all four `<Link>`s, all four `to` paths, all four
    `aria-label`s and `title`s, and all four inline SVGs.**
  **This is a deletion of chrome, not of function.** Every control survives; count them before and
  after and the number must match.
- **DELETE the `.ops-navstrip` element, its `.ops-navstrip-track`, all their CSS, and the
  `navHidden` scroll-hide effect** (the whole `useEffect` with `window.addEventListener('scroll')`,
  its `requestAnimationFrame` guard and the `navHidden` state). On phone the rail becomes a drawer
  (06.3), so a second sticky strip that hides itself on scroll is a third nav for the same job.
  **DELETE** the `activeTabRef` and the `scrollIntoView` effect with it — there is no horizontal
  strip left to centre. **Note:** the project bans `scrollIntoView` anyway.
- **SET** `.ops-body`: `display: contents` -> **DELETE the wrapper element** and make the rail and
  `.ops-main` direct children of `.ops-shell`.
- **SET** `.ops-main`: `flex: 1; min-width: 0; padding: 0 0 0 14px; display: flex; flex-direction: column; gap: 14px;`
  **KEEP** the existing rule that zeroes `.adm-layout`'s horizontal padding inside `.ops-main` —
  its comment documents a real double-gutter bug that cost 56px at 360px wide.
- **KEEP** `.director-tab-panel` and the `<Suspense fallback={<div className="ops-loading mono">loading…</div>}>`.
  **KEEP the string `loading…`.**
- **KEEP** `<Outlet context={ctx} />` and the `DirectorContext` shape **exactly**. Every desk reads
  it; changing it is a Supabase-adjacent change.
- **KEEP** the entire data effect: `Promise.all([getDashboardStats(), getMyCategories()])`, the
  `scopedPendingPosts` follow-up call and its `!isSuperAdmin && cats.length > 0` gate. **The
  scoped-count logic is a real bug fix** — its comment explains that an unscoped badge showed a
  category-restricted HoD a global count and then a smaller list. Do not simplify it.
- **KEEP** `visibleGroups` and both filters (`superOnly && !isSuperAdmin`, `key === 'approvals' && !canApproveMembers`).
  **These mirror route guards.** A desk shown here that the guard refuses is a live defect.
- **KEEP** `NAV_GROUPS`, all seventeen entries, their order, their `label`s, their `path`s, their
  `superOnly` flags and every explanatory comment. **KEEP the `icon` glyph strings** (`◧ ▤ ▥ ◍ ★ ▦ ◫ ◔ ☐ ◐ ◑ ◒ ◓ ▧ ▨ ◆ ◇`).
  They are geometric Unicode, they render in the mono face, and they are the only per-desk mark
  available without drawing seventeen icons.
- **KEEP** `GROUP_HUES` exactly: `queue: lemon`, `people: welfare`, `intake: events`, `admin: teal`.
  Its comment correctly explains why these are group hues and not `CAT_COLORS`.

## 06.3 · The rail

**Design:** `4a` left column. **File:** `DirectorDashboard.tsx` + `DirectorDashboard.css`

```css
.ops-rail {
  width: var(--rail-w);
  flex: none;
  align-self: stretch;
  background: var(--ink);
  border-radius: var(--r-outer);
  padding: var(--pad-card);
  display: flex;
  flex-direction: column;
  gap: var(--pad-inner);
  position: sticky;
  top: 14px;
  max-height: calc(100dvh - 28px);
  overflow-y: auto;
}
.ops-rail-head { display: flex; align-items: center; gap: 11px; padding: 10px var(--pad-inner) 14px; }
.ops-rail-brand {
  font-family: var(--display); font-size: 15px; font-weight: 900;
  letter-spacing: -0.03em; line-height: 1; color: var(--paper); text-decoration: none;
}
.ops-rail-brand em, .ops-brand-accent { color: var(--welfare); font-style: normal; }
.ops-rail-scope { font-family: var(--mono); font-size: 9px; color: rgba(244,239,224,0.50); margin-top: 4px; }
```

- **SET** the logo in the rail head: use **`/stamp-white.png`** at 32px, **not `/logo.png`** and
  **not with an inversion filter** — see `02.4`, same bug, same fix.
- **KEEP** the brand markup `command <span className="ops-brand-accent">desk</span>` and its
  `aria-label="Back to AquaTerra"`.

### 06.3.1 · Group behaviour — the hierarchy fix

**Only the group containing something that needs the operator is expanded. Everything else
collapses to a header row with a count.** This is the direct answer to "17 tabs, no hierarchy".

- **ADD** state: `const [openGroups, setOpenGroups] = useState<string[]>([])`
- **Default open set** = every group whose visible items have a **non-zero count** in `counts`,
  or `['queue']` when all counts are zero. Derive it in a `useMemo` from `counts` and
  `visibleGroups`; **do not hard-code `['queue']` unconditionally**.
- **Persist** the operator's manual expand/collapse to `localStorage` under the key
  `aq_desk_rail_groups_v1`. **Never read or write any other key**, and merge rather than
  overwrite. If the stored value does not parse, fall back to the derived default silently.
- Expanded group renders as a **well**: `background: rgba(244,239,224,0.07); border-radius: var(--r-inner); padding: var(--pad-inner);`
  with a mono uppercase group label at `8.5px/800` in `var(--nav-fg-faint)` and its items inside.
  **`--nav-fg-faint` is `rgba(244,239,224,0.55)` and measures 5.60:1 on ink — it is the floor for
  text on ink.** The values that fail are **0.45 (4.05:1)** and **0.38 (3.20:1)**; those two are
  legal only for non-text. Use a named rung from the ladder in `README.md` invariant 7 and in
  `02.2`; do not invent an alpha between rungs.
- Collapsed group renders as a **single row**: a 7px `GROUP_HUES` dot, the mono uppercase label,
  a right-aligned summary, and a chevron. `min-height: 44px; border-radius: var(--r-inner); background: transparent; border: none;`
- **Collapsed summary text**, in priority order:
  - if the group has a non-zero count: `{n} new` in `var(--lemon)` at `800`
  - else: the two-digit item count `{String(items.length).padStart(2,'0')}` in `var(--nav-fg-faint)`
  **Never render `clear` for a group** — the desk only has real counts for `approvals` and `posts`,
  so "clear" on a group containing fifteen uncounted desks is a claim you cannot support. The
  landing's per-desk list already handles this correctly and its comment says why; match it.
- **ADD** `aria-expanded` and `aria-controls` on the group button, and give the well an `id`.

### 06.3.2 · Nav items

```css
.ops-rail-item {
  display: flex; align-items: center; gap: 9px;
  min-height: 44px; padding: 0 12px;
  border-radius: var(--r-tight);          /* 14 inside the 22 well at 8px padding */
  text-decoration: none;
  font-family: var(--eina); font-weight: 600; font-size: 13.5px;
  color: rgba(244,239,224,0.82);          /* 9.4:1 on ink — passes AA */
}
.ops-rail-item:hover { background: rgba(244,239,224,0.07); }
.ops-rail-item.is-active { background: var(--lemon); color: var(--ink); font-weight: 800; }
.ops-rail-count {
  font-family: var(--mono); font-size: 11px; font-weight: 800;
  font-variant-numeric: tabular-nums; flex: none;
}
.ops-rail-item .ops-rail-count { color: var(--ink); background: var(--lemon); border-radius: var(--r-pill); padding: 2px 8px; }
.ops-rail-item.is-active .ops-rail-count { background: transparent; padding: 0; }
.ops-rail-clear { font-family: var(--mono); font-size: 10px; color: var(--nav-fg-faint); flex: none; }
```

- **The active item takes its group's hue**, not always lemon: **SET** `background: var(--cc)` and
  pass `style={{ ['--cc']: GROUP_HUES[g.label] }}` on the item. Ink text on all four hues
  (lemon, welfare, events, teal) clears AA at 13.5px/800 — **verify teal (#12909C) specifically and
  report the ratio**; if it fails, that one item uses `var(--paper)` text.
- **KEEP** `NavLink`, its `to={\`/director/${item.path}\`}` and the `isActive` class callback.
- **KEEP** `aria-current="page"` (NavLink supplies it).
- **DELETE** the `ref={el => …}` shared-ref assignment (the strip it fed is gone).
- **DELETE** the `variant: 'strip' | 'sidebar'` parameter from `navItem` and `navList` and the
  entire strip branch. One rendering, one class set.
- **DELETE** `.ops-navtab`, `.ops-navtab-label`, `.ops-navtab-count`, `.ops-sidebar`,
  `.ops-sidebar-item`, `.ops-sidebar-group`, `.ops-sidebar-grouplabel` from
  `DirectorDashboard.css` — replaced by `.ops-rail-*` above. **Grep each first.**

### 06.3.3 · Rail foot

- **ADD** a "last opened" well above the utility row:
  `background: rgba(244,239,224,0.07); border-radius: var(--r-inner); padding: 12px 14px;`
  with a mono uppercase label `last opened` in `var(--nav-fg-faint)` and a mono timestamp in
  `var(--nav-fg)`. **Not 0.45 alpha** — see 06.3.1.
  **The timestamp must be real.** Store `Date.now()` to `localStorage` key `aq_desk_last_seen_v1`
  on mount, and render the **previous** value. On the very first visit render nothing — do not
  render `just now`, which would be false. **If you cannot read the previous value before
  overwriting it, this block does not ship.** Log it as unresolved.
- **SET** the utility row: four 44px pills at `flex: 1`, `border-radius: var(--r-pill)`,
  `background: rgba(244,239,224,0.07)`, glyphs at `rgba(244,239,224,0.72)` (7.9:1, and a glyph is
  non-text so 3:1 would do — 0.72 matches the dock in `03.1`). The fourth is the
  operator avatar: `background: var(--welfare)`, ink initials at `800 12px`.
  **KEEP all four links and their labels** (see 06.2).
- **ADD** the unread dot to the notifications pill: 7px `var(--tomato)` with
  `box-shadow: 0 0 0 2px var(--ink)`. **Only when there are unread notifications** — read the
  count from `services/notificationService.ts`, which already exposes it. **If wiring that into
  the shell needs a new query, omit the dot.**

### 06.3.4 · Phone: the rail becomes a drawer

- Below **1024px**: `.ops-rail { display: none }`, and the shell renders an **ink segmented top
  bar** exactly as `4b` shows — logo capsule, masked joint, title capsule with a hamburger.
  **Reuse the joint mechanic from `02.3` verbatim**; do not write a second implementation. Bar
  height 52px, notch 18px, waist 16px.
- The hamburger opens the rail as a **left drawer**: same markup, `position: fixed`, full height,
  `border-radius: 0 32px 32px 0`, with a scrim at `rgba(10,10,10,0.45)`. **Reuse `adminKit`'s
  existing drawer/sheet mechanism if one exists — grep `BottomSheet` and `aq-drawer` first.**
- **ADD** a phone bottom bar per `4b`: desk / calendar / people / search, ink frosted, segmented,
  with the operator avatar as the trailing capsule. **Every destination must already be a route.**
  **If `/director` has no calendar route, use the four destinations it does have** — do not invent
  a fifth desk to fill a slot.
- **SET** the shell's bottom padding to `var(--btm-nav-reserve)` from `02.6`.

## 06.4 · The landing

**Design:** `4a` / `4b` main column. **File:** `DirectorLanding.tsx`

**The single most important change in this file: the DOM order inverts.** Today it is
scope -> title -> stat bento -> torn divider -> "what needs you today" -> desk list. It becomes
scope -> title -> **triage** -> stat strip -> desk list.

Reason: the stat bento is six tiles of which four are queue counts and two are totals, and it sits
above the one card that says what to actually do. An HoD checking the desk between classes reads
the top of the screen and leaves.

### 06.4.1 · Header

- **KEEP** the scope eyebrow `<div className="mono xs upper muted">{scopeLabel}</div>` and the
  string. **SET** its inline `style={{ fontWeight: 700, letterSpacing: '0.08em', marginBottom: 12 }}`
  -> a class `.ops-landing-scope` with the same three values.
- **KEEP** `<h1 className="ops-landing-title">the <i>desk</i>.</h1>` **exactly**, including the
  `<i>`. **SET** `.ops-landing-title`: `font-size` -> `52px`, `font-weight: 900`,
  `letter-spacing: -0.045em`, `line-height: 0.9`. **SET** its phone value -> `54px`.
  **KEEP** the Instrument Serif italic on `<i>` in `var(--welfare-ink)`.
  **`--welfare-ink`, not `--welfare`** — #1B8A5A on cream at display size passes 3:1 but the
  `.home-feed-title` twin already uses the `-ink` partner and they must match.
- **ADD** a "since you last opened" pill to the right of the title, on desktop only:
  a white 46px capsule with a mono uppercase label and a cream inset chip holding `+{n} new`.
  **`n` must be real** — it is the count of queue items created after `aq_desk_last_seen_v1`.
  **The stats service does not return created-after counts.** So either compute it from a field
  the queue queries already return, or **do not ship this pill.** Log as unresolved. On phone it
  becomes a mono line under the title instead of a pill.

### 06.4.2 · Triage — now the page's subject

**KEEP the entire `todo` array construction verbatim** — all four entries, both `show` gates, the
singular/plural `noun` ternaries, the `verb` strings and the `.filter(t => t.show)`. **KEEP the
comment** explaining that only non-zero queues appear. Every string in it is frozen:
`member sign-up` / `member sign-ups` / `waiting on approval` / `post` / `posts` /
`waiting in the review queue` / `enquiry` / `enquiries` / `nobody has replied to yet` /
`application` / `applications` / `waiting on a decision`.

What changes is only how they render.

```css
.ops-triage {
  background: var(--ink);
  border-radius: var(--r-outer);
  padding: var(--pad-card);
}
.ops-triage-head { display: flex; align-items: center; gap: 11px; padding: 12px 14px 14px; }
.ops-triage-title {
  flex: 1; font-family: var(--display); font-size: 19px; font-weight: 900;
  letter-spacing: -0.03em; color: var(--paper);
}
.ops-triage-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--pad-inner); }
.ops-triage-tile {
  display: flex; flex-direction: column; justify-content: space-between;
  min-height: 116px; padding: 14px;
  border-radius: var(--r-inner);
  text-decoration: none;
  background: color-mix(in srgb, var(--cc) 22%, transparent);
  color: var(--ink);
}
/* The first tile — the largest queue — is the hero: full saturation, both
   columns, one bleeding shape. Exactly one per card, as everywhere else. */
.ops-triage-tile.is-hero {
  grid-column: span 2;
  background: var(--cc);
  position: relative; overflow: hidden;
  padding: 15px;
}
.ops-triage-tile.is-hero::after {
  content: ""; position: absolute; right: -28px; top: -32px;
  width: 104px; height: 104px; border-radius: var(--r-pill);
  background: rgba(10,10,10,0.10); pointer-events: none;
}
.ops-triage-tile.is-hero > * { position: relative; }
.ops-triage-n {
  font-family: var(--display); font-weight: 900; line-height: 0.85;
  font-size: 34px; font-variant-numeric: tabular-nums;
}
.ops-triage-tile.is-hero .ops-triage-n { font-size: 46px; }
.ops-triage-label {
  font-family: var(--display); font-weight: 900; font-size: 12.5px;
  letter-spacing: -0.015em; line-height: 1.15;
}
.ops-triage-tile.is-hero .ops-triage-label { font-size: 15px; }
.ops-triage-age { font-family: var(--mono); font-size: 9px; font-weight: 800; color: rgba(10,10,10,0.62); }
```

- **The hero is the entry with the highest `count`**, not always the first. Sort a copy for display
  order; **do not mutate `todo`**.
- Tile hue: `--cc` = `var(--lemon)` for approvals and posts, `var(--events)` for enquiries and
  applications. **These are the hues the existing `stats_` array already assigns to those same four
  queues** — read them from there rather than writing a second map.
- **ADD** the `.ops-triage-age` line (`oldest is 4 days old`) to the hero only.
  **The stats service returns counts, not ages.** So: **do not ship this line** unless the approvals
  query already returns a created-at you can reach here. Log as unresolved. It is the single most
  useful thing on the card, so it is worth asking about.
- **KEEP** the total chip: `{todo.reduce((n, t) => n + t.count, 0)}` with `aria-live="polite"`.
  **SET** it to render as a **sticker**: lemon, ink text, 2px ink border, `2px 2px 0` offset,
  `rotate(-2.5deg)`. **ADD** the word `open` after the number on desktop; **KEEP number-only on
  phone.** (This adds the string `open` — it is the one string addition in this file. Skip it if
  you would rather not.)
- **KEEP** the `todo.length === 0` branch rendering `<EmptyLedger>` with its two strings:
  `nothing waiting ${scopeNote} - nice work` and `Approvals and the post queue are all clear.`
  **KEEP the `scopeNote` construction.** See 06.7 for `EmptyLedger`'s restyle.
- **DELETE** the `.qrow`-based rendering of `todo` (the `<Link className="qrow">` with its
  `--row-i`, `qmeta`, `qname`, `qsub` and the `review →` span). The tiles replace it.
  **This deletes the string `review →`.** It is redundant: the whole tile is the link.
- **DELETE** the `<div className="torn-divider" aria-hidden />` from the landing, and **DELETE the
  `.torn-divider` and `.torn-divider--v` rules from `director.css`** after grepping for other
  callers. Two 45° tiled gradients making a zigzag seam is decoration, it is the desk's equivalent
  of the `.deco` doodles removed in `00.13`, and it cannot follow a 32px corner.

### 06.4.3 · Stats — demoted to a strip

- **KEEP** the `stats_` array's `label` / `value` / `to` / `cc` for the **two totals only**:
  `approved members` and `published posts`, plus `open applications`. **The four queue counts
  move into the triage card** (06.4.2) and must not also render here — the same number twice on one
  screen is what makes the landing feel like a counter.
  **KEEP the comment** explaining "approved", not "onboarded".
- **SET** each surviving tile to a **white card with a cream inset**, per `4a`:
  ```css
  .ops-statrow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .ops-stat {
    background: var(--card); border: var(--hair-2); border-radius: var(--r-outer);
    padding: var(--pad-card); box-shadow: var(--lift-1);
    text-align: left; cursor: pointer;
  }
  .ops-stat-inner { background: var(--bg); border-radius: var(--r-inner); padding: 14px 16px; }
  .ops-stat-label { font-family: var(--mono); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3); }
  .ops-stat-value { display: block; font-family: var(--display); font-size: 32px; font-weight: 900; line-height: 1; margin-top: 9px; font-variant-numeric: tabular-nums; }
  ```
- **DELETE** `.ops-stat-index` and the `№ {String(i+1).padStart(2,'0')}` ledger index from every
  tile, plus `.ops-stat-top` and `.ops-stat-go` (the `→` glyph). A manifest line number on a
  three-tile strip numbers nothing; the arrow is redundant with the tile being a button.
  **This deletes the `№ 01` strings and the `→` glyph.**
- **DELETE** `.hod-statrow` and its four `!important` declarations, its `border-top: 4px solid var(--cc)`
  coloured top edge, and its `:hover`/`:active` translate rules. **Grep `hod-statrow` first** —
  the landing is its main caller.
- **DELETE** the `.is-ink` variant and the `isInk = i === stats_.length - 1` logic. With four tiles
  gone there is no "last tile" worth inking, and the triage card above is already the page's ink slab.
- **KEEP** `disabled={!s.to}` and `cursor: s.to ? 'pointer' : 'default'` — `published posts` has no
  destination for a non-super-admin and must not look clickable.

### 06.4.4 · Desk directory

**KEEP the entire `visibleGroups` derivation, the `deskCount` reduce and the `deskCounts` map
verbatim**, including the comment explaining that only two desks have real counts and every other
reads `clear`, never a zero.

- **KEEP** the strings `all {deskCount} desks` and `clear`, and the per-desk `/director/{item.path}`
  path line. **The path line is deliberate** — the source comment notes neither the strip nor the
  sidebar showed a desk's route.
- **SET** the container to one white card at `var(--r-outer)` with `var(--pad-card)`, and the rows
  to a **3-column grid** on desktop (`repeat(3, 1fr)`), 1 column on phone.
- **SET** `.ops-desk-row`:
  ```css
  .ops-desk-row {
    display: flex; align-items: center; gap: 11px;
    min-height: 56px; padding: 10px 13px;
    border-radius: var(--r-inner);
    background: var(--bg);
    text-decoration: none;
  }
  /* a desk with something waiting is tinted with its group hue */
  .ops-desk-row.has-count { background: color-mix(in srgb, var(--cc) 22%, transparent); }
  .ops-desk-row.has-count.is-lemon { background: color-mix(in srgb, var(--cc) 30%, transparent); }
  .ops-desk-glyph {
    width: 32px; height: 32px; border-radius: var(--r-tight);   /* 14 inside 22 */
    background: var(--card); display: grid; place-items: center; flex: none;
    font-family: var(--mono); font-size: 14px; color: var(--cc-ink);
  }
  .ops-desk-name { font-family: var(--eina); font-weight: 700; font-size: 13px; color: var(--ink); }
  .ops-desk-path { font-family: var(--mono); font-size: 9px; color: var(--ink-3); margin-top: 3px; }
  .ops-desk-count { font-family: var(--mono); font-size: 12px; font-weight: 800; color: var(--cc-ink); font-variant-numeric: tabular-nums; }
  .ops-desk-clear { font-family: var(--mono); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-3); }
  ```
- **Set `--cc-ink` per group** from the `*-ink` partners, exactly as `01.5` does:
  `queue -> --lemon-ink`, `people -> --welfare-ink`, `intake -> --sky-ink`, `admin -> --ops`
  (#12909C already clears AA). **The raw `GROUP_HUES` values fail 4.5:1 as glyph and numeral
  colour on a light ground** — lemon measures 1.61:1.
- **ADD** a `{n} need you` summary to the card header, computed from `deskCounts`. **Only counts
  desks with a real count** — with two counted desks the honest maximum is 2.
- **KEEP** the group headers (`.ops-desks-grouphead`, `.ops-desks-grouplabel`, `.ops-desks-grouprule`,
  `.ops-desks-groupcount` with its zero-padded count). **SET** `.ops-desks-grouprule` from whatever
  border it has -> `var(--hair)`.
- **DELETE** `.ops-desks-title`'s decorative treatment if it carries one; **KEEP the element and its
  string.**

## 06.5 · The toolbar

**File:** `director.css` + `adminKit.tsx` (`DataToolbar`, `FilterPill`)

**Design:** `4c` top. One toolbar for all seventeen desks.

- **SET** `.adm-search`: `height: 46px` (**KEEP**), `border-radius: var(--r-pill)` (**KEEP**),
  `border: 2px solid var(--ink)` -> `var(--hair-3)`, `background: var(--card)` (**KEEP**),
  `padding: 0 16px` (**KEEP**). **SET** `input` `font-size: 13px` -> `16px`.
  **16px is a fix, not taste** — iOS zooms the viewport on focus below it, and the desk's own phone
  block already forces `font-size: 16px !important` on `select` for exactly this reason.
- **SET** `.adm-search:focus-within`: `border-color: var(--ink)` (**KEEP**),
  `box-shadow: var(--hod-shadow)` -> `0 0 0 3px color-mix(in srgb, var(--welfare) 16%, transparent)`
  (this also removes the undefined-mint bug, 06.0 item 3).
- **SET** `.adm-pill`: `height: 38px` (was 34), `border: 2px solid var(--ink)` -> `var(--hair-2)`,
  `background: transparent` -> `var(--card)`, `padding: 0 14px`, `font-family: var(--eina)`
  (**KEEP**), `font-weight: 700` (**KEEP**), `font-size: 12px` -> `12.5px`.
  **KEEP** `white-space: nowrap` and **KEEP its comment** — it documents a real clipping bug.
- **DELETE** `.admin .adm-pill:hover { transform: translate(-1px,-1px) }` and
  `:active { transform: scale(0.96) }` -> **SET** `:hover { background: var(--bg-2) }`,
  **KEEP** `:active { transform: scale(0.96) }`.
- **KEEP** `.adm-pill.is-active { background: var(--ink); color: var(--paper); border-color: var(--ink); }`
  and its `font-weight: 800`.
- **ADD** a count to the active pill: `<span className="mono">{n}</span>` at `10px`, `opacity: 0.6`.
- **ADD** a hairline vertical divider between the status pills and any secondary control:
  `width: 1px; height: 22px; background: rgba(10,10,10,0.12);`
- **ADD** a **saved views** control — a `.adm-pill` with a list icon opening a menu of the
  operator's stored filter combinations. **Persist to `localStorage` under
  `aq_desk_views_v1`, keyed by desk path.** No server storage, no new table, no query change.
  **If that is not acceptable, omit the control entirely** rather than adding a table.
- **KEEP** `DataToolbar`'s `actionsInline` prop and the
  `.adm-toolbar-actions.adm-toolbar-actions-inline` rule. **KEEP its comment** — it documents a
  real bug where MemberDirectory's sort `<select>` got pinned 330px away from the results it controls.
- **KEEP** the phone toolbar behaviour: full-width search row 1, horizontally scrolling pills row 2,
  `overscroll-behavior-x: contain` (**this prevents a swipe-back that loses in-progress desk
  state** — its comment is correct), scrollbars hidden, negative-margin bleed to the page gutter.

## 06.6 · The table primitive

**Design:** `4c`. **File:** `adminKit.tsx` + `director.css`

This is the piece that fixes "tables unusable on mobile", "no bulk actions" and "approvals take too
many clicks". **One component, two layouts, no horizontal scroll at any width.**

### 06.6.1 · Container and rows

```css
.adm-table {
  background: var(--card);
  border: var(--hair-2);
  border-radius: var(--r-outer);            /* 32 */
  padding: var(--pad-card);                 /* 10 */
  box-shadow: var(--lift-1);
}
.adm-table-head,
.adm-table-row {
  display: grid;
  grid-template-columns: var(--cols);       /* set per desk */
  align-items: center;
  gap: 12px;
  padding: 11px 14px;
  border-radius: var(--r-inner);            /* 22 = 32 - 10 */
}
.adm-table-head {
  background: var(--bg);
  font-family: var(--mono); font-size: 9px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3);
}
.adm-table-row { border-top: var(--hair); }
.adm-table-row:first-of-type { border-top: none; margin-top: 4px; }
.adm-table-row:hover { background: var(--bg); }
.adm-table-row.is-selected { background: var(--bg); border-top-color: transparent; }
```

- `--cols` is passed per desk. For Approvals: `38px minmax(0,2.1fr) minmax(0,1.5fr) 96px 108px 150px`.
- **Every text cell needs `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`**
  or the grid will not shrink and the table will scroll horizontally — which is the one thing this
  primitive exists to prevent.
- **DELETE** the entire `.admin .qrow` ledger system and replace all callers with `.adm-table-row`:
  - **DELETE** `.admin .card { counter-reset: ledger-row }` and `.qrow { counter-increment: ledger-row }`
  - **DELETE** `.admin .qrow::before` — the `counter(ledger-row, decimal-leading-zero)` index.
    A row number that renumbers when you filter is worse than no row number.
  - **DELETE** `.qrow`'s `border-bottom: 1.5px dashed var(--line-2)` -> the `--hair` top border above
  - **DELETE** `.qrow`'s `border-left: 3px solid var(--cc)` — a coloured spine cannot follow a 22px
    corner; the status pill carries the hue now
  - **KEEP** `.qmeta`, `.qname`, `.qsub` as the identity-cell classes, renamed or aliased into
    `.adm-table-*`. **SET** `.qname` `font-family: var(--display)` -> `var(--eina)`,
    `font-size: 15px` -> `13.5px`, `font-weight: 800` -> `700`.
    **Eina, not NeutralFace** — NeutralFace is caps-only, so a member's name renders as shouting.
    `AQNav.css` and `01.8` both already document this.
- **DELETE** `@keyframes ledgerRowIn` and the `.qrow` stagger animation, plus its
  `prefers-reduced-motion` block. A 28ms-per-row stagger on a 200-row directory is 5.6 seconds of
  entrance. **KEEP** the same removal for `.adm-skel-row` and `.adm-skel-card`.
- **DELETE** the entire `.admin .stamp` system: `.stamp`, `.stamp::after`, `.stamp-pending`,
  `.stamp-approved`, `.stamp-rejected`, `@keyframes stampSettle` and its reduced-motion guard, and
  the `StatusStamp` component's rotation/double-ring rendering. Replace with a **status pill**:
  ```css
  .adm-status {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: var(--r-pill); padding: 5px 11px;
    background: color-mix(in srgb, var(--sc) 22%, transparent);
    justify-self: start;
  }
  .adm-status-dot { width: 6px; height: 6px; border-radius: var(--r-pill); background: var(--sc-ink); }
  .adm-status-label {
    font-family: var(--mono); font-size: 9px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.05em; color: var(--sc-ink);
  }
  .adm-status.is-pending  { --sc: var(--lemon);   --sc-ink: var(--lemon-ink);   background: color-mix(in srgb, var(--lemon) 30%, transparent); }
  .adm-status.is-approved { --sc: var(--welfare); --sc-ink: var(--welfare-ink); }
  .adm-status.is-rejected { --sc: var(--danger);  --sc-ink: var(--danger); }
  ```
  **KEEP the `STATUS_TONE` map, the `custom` tone and the `queued` relabel** — the vocabulary is
  right, only the rendering changes. **KEEP every status string.**
  **Why the stamp goes:** it rotates data (the design rule in the file's own comment says only
  chrome may rotate), it animates in on every render, its text colour is a `color-mix` toward black
  that the file itself had to patch for contrast five times, and it cannot sit in a grid cell
  without its rotation overflowing the row. A tinted pill with an `*-ink` label is the same
  information at a guaranteed ratio.
- **KEEP** `.adm-badge` and its five tones for use **outside** tables, but **SET** each
  `background`/`color` pair to the `22%`-tint + `*-ink` formula above, and **DELETE**
  `.admin .adm-badge-success { background: var(--welfare); color: #0A0A0A }` and its three
  siblings — a fully saturated badge in a dense list is louder than the row's own action.

### 06.6.2 · Selection and bulk actions

- **ADD** a leading 38px checkbox column to `.adm-table-head` and `.adm-table-row`.
  ```css
  .adm-check {
    width: 18px; height: 18px; border-radius: 6px;
    border: 1.5px solid rgba(10,10,10,0.30); background: var(--card);
    display: grid; place-items: center; cursor: pointer;
  }
  .adm-check.is-on { background: var(--ink); border-color: var(--ink); }
  ```
  **6px is the one radius off the scale, and it is deliberate:** an 18px box at 14px radius is a
  circle, and a circular checkbox reads as a radio. Document it in a comment.
  **The hit target is the whole cell (38px wide x the 44px row), not the 18px box.** Wrap it in a
  `<label>` filling the cell.
- **KEEP** `.adm-row-check`'s existing `accent-color: var(--ink)` behaviour if you keep native
  inputs. **A native `<input type="checkbox">` with `accent-color` is the safer choice** — it comes
  with keyboard, screen-reader and indeterminate support for free. Prefer it, and style with
  `appearance: none` only if the native rendering fights the design.
- **ADD** header select-all with a real **indeterminate** state when a subset is selected.
- **SET** `.adm-bulkbar` per `4c`: it becomes an **ink capsule**, not a bordered card.
  ```css
  .adm-bulkbar {
    position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 200;
    display: inline-flex; align-items: center; gap: 10px;
    padding: 8px 8px 8px 18px;
    background: var(--ink);
    border: none;
    border-radius: var(--r-pill);
    box-shadow: var(--lift-4);
    max-width: calc(100vw - 32px);
  }
  .adm-bulkbar-count { font-family: var(--mono); font-size: 11px; font-weight: 800; color: var(--paper); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .adm-bulkbar-divider { width: 1px; height: 20px; background: rgba(244,239,224,0.20); flex: none; }
  ```
  **SET** `bottom: 80px` -> `24px` on desktop; **KEEP** the phone rule that pins it full-width to
  the bottom edge with `env(safe-area-inset-bottom)`, but **SET** its `border-radius: 0` ->
  `32px 32px 0 0` and **KEEP** `border-left: none; border-right: none`.
- **DELETE** `.adm-bulkbar-chip` — the rotated lemon count sticker. The count is data; it reads as
  mono text on ink. **This removes a rotation from a number.**
- **SET** the primary bulk action to `background: var(--welfare)`, ink text, no border, no offset —
  it already sits on ink, where an ink offset is invisible.

### 06.6.3 · Row actions — the click-count fix

- **Approve and Reject render inline on every queue row, at every width.**
  ```css
  .adm-verdict-yes {
    min-height: 38px; padding: 0 13px;
    border-radius: var(--r-pill);
    background: var(--welfare); color: var(--ink);
    border: 2px solid var(--ink); box-shadow: 2px 2px 0 0 var(--ink);
    font-family: var(--eina); font-weight: 800; font-size: 12px; cursor: pointer;
  }
  .adm-verdict-no {
    width: 38px; height: 38px; border-radius: var(--r-pill);
    background: var(--card); border: 1px solid color-mix(in srgb, var(--danger) 40%, transparent);
    display: grid; place-items: center; cursor: pointer; color: var(--danger);
  }
  ```
  **These are the only hard-offset objects inside a table.** Approving is what the page is for.
  **38px, not 44, on desktop** — the desk's documented desktop floor is 40px and these sit inside a
  44px row; on phone (06.6.4) they become 46px. Note the discrepancy in a comment and pick 40px if
  you would rather match the existing floor exactly.
- **DELETE every confirm dialog on a reversible verdict.** Replace with an **optimistic write plus
  an undo toast**:
  ```css
  .adm-undo {
    display: inline-flex; align-items: center; gap: 12px;
    padding: 8px 8px 8px 16px;
    background: var(--card); border: var(--hair-2);
    border-radius: var(--r-pill); box-shadow: var(--lift-3);
  }
  ```
  with a 7px hue dot, the outcome sentence, and an `Undo` button on a cream pill.
  **Undo must call the existing inverse service function.** If a desk has no inverse (a hard delete,
  a certificate issue, an email send), **keep its confirm dialog** — those are not reversible and
  an undo affordance that cannot undo is a lie. **List which desks keep their dialog and report it.**
  **KEEP** `components/Confirm.tsx` — it is still needed for the irreversible cases.
- **KEEP** `AdminRow`'s per-row busy state and **KEEP its comment** — it documents the structural
  fix for "one action loading disables every row's buttons". **Do not reintroduce a shared
  `isBusy`.**
- **KEEP** `AdminRowActions` and the `⋯` -> `BottomSheet` collapse **for secondary actions only**
  (view profile, copy email, open evidence). **KEEP** the existing rule
  `.adm-rowacts.has-sheet > *:not(.adm-more) { display: none }` and **KEEP** the `.adm-verdicts`
  exception that holds verdicts out of the sheet. **That exception is the fix for "approvals take
  too many clicks" and it already exists** — it is being extended, not invented.
- **SET** `.adm-more`: `border: 3px solid var(--hod-border)` -> `var(--hair-2)`,
  `border-radius: var(--hod-radius-sm)` -> `var(--r-pill)`. **KEEP** `44x44`.

### 06.6.4 · Phone: rows become cards

Below **760px**, the same component renders a card list. **No horizontal scroll, no column
hiding, no `overflow-x: auto` anywhere in the desk.**

```css
@media (max-width: 760px) {
  .adm-table-head { display: none; }          /* except the select-all row, see below */
  .adm-table-row {
    display: block;
    background: var(--bg);
    border-radius: var(--r-inner);            /* 22 inside the 32 container */
    border-top: none;
    padding: 12px;
    margin-bottom: var(--pad-inner);
  }
  .adm-table-row:last-child { margin-bottom: 0; }
  /* the identity block stays a row: check + avatar + name/email */
  .adm-table-identity { display: flex; align-items: flex-start; gap: 11px; }
  /* every other cell becomes a labelled pill, and they wrap */
  .adm-cellpills { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; }
  .adm-cellpill {
    display: inline-flex; align-items: center; gap: 6px;
    background: var(--card); border-radius: var(--r-pill); padding: 6px 11px;
  }
  .adm-cellpill-label { font-family: var(--mono); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-3); }
  .adm-cellpill-value { font-family: var(--mono); font-size: 10.5px; font-weight: 700; color: var(--ink); }
  /* verdicts stay inline, full-width, 46px */
  .adm-verdicts { display: flex; gap: 7px; margin-top: 11px; }
  .adm-verdict-yes { flex: 1; min-height: 46px; font-size: 13.5px; }
  .adm-verdict-no { width: auto; min-height: 46px; padding: 0 18px; }
}
```

- **The column header's `<th>` text becomes the pill's label.** Pass one `label` per column so the
  phone layout is derived, not hand-written per desk. That is the whole reason this is one component.
- **ADD** a select-all row above the cards on phone: a 20px check, a mono `select all {n}` label,
  and the queue-age note on the right. **KEEP the `{n}` real.**
- **KEEP** the existing phone rules that already do the right thing:
  `.admin .adm-grid { grid-template-columns: 1fr !important }`, `.admin { overflow-x: hidden }`,
  the 44px floors on `.btn`/`.btn-sm`/`.iconbtn`/`.adm-pill`/`select`/`.input`/`.textarea`,
  `.adm-row-check { width: 24px; height: 24px }`, and `select { font-size: 16px !important }`.
  **KEEP their comments** — three of them document specific shipped bugs (the 38px cap below the
  WCAG floor, the 41px-wide icon button, the iOS zoom).
- **KEEP** the modal-to-fullscreen-sheet rules and the sticky head/footer. **SET** the sheet's
  `border: 3px solid var(--ink)` -> `none`, `border-radius: 18px` -> `var(--r-outer)`,
  `box-shadow: 5px 5px 0 0 var(--ink)` -> `var(--lift-4)`, and
  `.adm-sheet-head` `border-bottom: 2px dashed var(--line-2)` -> `var(--hair)`.
- **SET** `.adm-sheet-close`: **KEEP** `min-width: 44px; min-height: 44px`. **ADD**
  `border-radius: var(--r-pill)`.

## 06.7 · States

- **`EmptyLedger`** — **KEEP the component, its `message` and `sub` props and every string passed
  to it.** Restyle:
  - **SET** `.ledger-empty` `border: 3px dashed var(--hod-border)` -> `border: none; background: var(--bg);`
    **`00.12` allows dashed in exactly two places and an empty state is not one of them.**
  - **SET** `border-radius: var(--r-card, 26px)` -> `var(--r-inner)` (it sits inside a 32px card)
  - **SET** `.ledger-empty-note` `font-family: var(--font-hand, 'Caveat', cursive)` ->
    `var(--display)`, and **DELETE** `font-style: italic` and `transform: rotate(-1.5deg)`.
    **Caveat is a fifth typeface and `--font-hand` is undefined** (06.0 item 5).
  - **SET** `font-size: clamp(20px, 2.6vw, 24px)` -> `clamp(18px, 2.4vw, 22px)`, `font-weight: 900`,
    `letter-spacing: -0.03em`, `color: var(--ink)`
  - **KEEP** `.ledger-empty-doodle` **only if** it is a single simple arrow. If it is a
    hand-drawn squiggle, **DELETE the element and the rule** — it is the desk's version of the
    `.deco` doodles removed in `00.13`.
  - **KEEP** `.ledger-empty-sub` as mono 11.5px in `--ink-3`, and **KEEP** `.ledger-empty-action`
    (the clear-filters slot).
- **`AdminErrorState`** — **KEEP** the component, its message and its retry button.
  **SET** `.adm-error-icon` `color: var(--rust)` -> `var(--danger)` (06.0 item 1) and
  **DELETE** `font-size: 0` (it hides the glyph, which is presumably not intended — check whether
  an SVG replaced a text glyph and the `font-size: 0` is vestigial).
  **SET** `.adm-error-body` `background: var(--hod-surface-1)` -> `var(--bg)`, and **ADD**
  `border-radius: var(--r-inner)`.
  **KEEP** `.adm-error-retry { min-height: 44px }` and its danger border.
- **`AdminSkeleton`** — **KEEP** the component and its three variants (list / grid / card).
  **SET** every `border-radius: var(--hod-radius-sm)` -> `var(--r-inner)`,
  `.adm-skel-circle` -> `border-radius: var(--r-pill)`, and every
  `background: var(--line)` -> `var(--bg-2)` (`00.16`).
  **SET** the skeleton's shape to match the **new** row: on phone, a stack of 22px cards, not a
  row of columns. **KEEP its comment** — approximating real rhythm so nothing jumps is correct and
  it is the reason this component exists.
  **DELETE** the `--row-i` stagger (06.6.1).
- **KEEP** `.admin .btn:hover { transform: none !important }` and
  `.admin .chip:hover { transform: none !important }` — the desk deliberately flattens the public
  site's playful motion, and after `00.6` the public rules no longer add a transform anyway, so
  **you may DELETE both `!important`s**. Verify first.
- **DELETE** `.admin .panel-h b::before { content: '✦ '; }`. A four-pointed star prepended to
  every panel title is decoration in a data tool. **This removes a glyph, not a string.**
- **SET** `.admin .panel-h`: `border-bottom: 3px solid var(--hod-border)` -> `var(--hair)`,
  `background: var(--hod-surface-2)` -> `var(--bg)`, `padding: 14px 18px` -> `12px 14px`,
  `border-radius` -> `var(--r-inner)`.
- **DELETE** `.admin .adm-tape` and `.adm-tape::before` — the taped-photo avatar with its lemon
  tape strip and `rotate(-2.5deg)`. **Grep `adm-tape` and replace callers with a plain
  `var(--r-pill)` avatar** (or `var(--r-tight)` for a square variant, per the concentric rule).
  A rotated bordered photo with a simulated tape strip in a data row is the scrapbook language the
  redesign is removing, and its `::before` overflows the row's `overflow: hidden`.
- **SET** `.admin .iconbtn`: `border: 3px solid` -> `var(--hair-2)`,
  `border-radius: var(--hod-radius-sm)` -> `var(--r-pill)`, and **DELETE**
  `:hover { transform: translate(-1px,-1px) }`. **KEEP** `40x40` on desktop, the 44px phone floor,
  `:active { transform: scale(0.96) }`, and the `.ok` / `.no` variants.
- **SET** `.admin .card`: **DELETE** the `!important` on `border`, **DELETE**
  `overflow: visible`, **DELETE** `transform: none !important` and the
  `:hover { transform: translate(-1px,-1px) !important }`. **SET** `:hover { box-shadow: var(--lift-2) }`.
  Cards no longer move; their lift deepens (`00.5`).

## 06.8 · What this file deliberately does not do

- Does not restyle any individual desk's own CSS: `ProjectManager.css`, `ProjectModal.css`,
  `VolunteerApplications.css`, or `ContentManager`'s `.cm-*` card system. They inherit the token
  and primitive changes and will look **partly** migrated. That is expected. Each needs its own file.
- Does not change `DirectorContext`, `NAV_GROUPS`, `GROUP_HUES`, `directorService`, or any
  `superOnly` flag.
- Does not touch role logic, `lib/roles.ts`, or any route guard in `App.tsx`.
- Does not add a table, column, or RLS policy.
- Does not touch `src/paradox/**`.

## A note on strings in this file

Two forms of string instruction appear here, and the difference matters:

- **A quoted string** was read verbatim out of the source file named in that section. Type it exactly.
- **"KEEP whatever string ships today"** means it was **not** read. Open the file, use what is
  there, leave it byte-identical, and **do not retype it from this document.**

**Copy in the design mocks is illustrative unless a section quotes it.** The mocks needed plausible
sentences to lay out. Strings this file's mocks invented, which must **not** be built:

`hod · welfare, labs` · `last opened` · `yesterday · 6:12pm` · `+9 new` ·
`since you last opened` · `21 open` · `oldest is 4 days old` · `oldest 4d` · `2 need you` ·
`9 live` · `Export` · `saved views` · `select all 7` · `member` / `school` / `waiting` /
`status` / `decision` as column headers · `Approve` · `Reject` · `Approve all` ·
`Mohit Kumar approved` · `Undo` · `1 selected` · `by you · 6h` · `2 new` · `6 new` ·
every member name, email and school in the table.

**Sections 06.3.3, 06.4.1 and 06.4.2 already flag the data-dependent ones** (`last opened`,
the `+N new` count, the queue age) as unresolved — if the data is not there, the string does not
ship either.

The strings this file quotes and which you can trust are the ones read from
`DirectorDashboard.tsx` and `DirectorLanding.tsx`: `command desk`, the `acting as · …` scope
label and its `getRoleLabel` construction, `HR` / `SUPER ADMIN` / `HOD`, `operator`,
`What needs you today`, all twelve singular/plural `todo` fragments, `review →`,
`nothing waiting ${scopeNote} - nice work`, `Approvals and the post queue are all clear.`,
`all {deskCount} desks`, `clear`, `/director/{path}`, all seventeen desk labels, the four group
labels, `pending approvals` / `posts in queue` / `new enquiries` / `open applications` /
`approved members` / `published posts`, `loading…`, and `№ 01` (which 06.4.3 deletes).

**If an instruction quotes a string and the file disagrees, the file wins.** Report the mismatch;
do not reconcile it by editing either one. No section of this file authorises a copy change.

## Unresolved after this file

Report each rather than guessing:

1. **Queue age** (`oldest is 4 days old`) — does any queue query return a created-at reachable from
   the landing? Without it the triage hero's most useful line does not ship.
2. **"Since you last opened" count** — needs created-after counts the stats service does not return.
3. **`last opened` timestamp** — can the previous `localStorage` value be read before the new one
   is written on mount?
4. **Notification unread count in the rail** — reachable without a new query?
5. **Saved views** — `localStorage` acceptable, or omit the control?
6. **Which desks keep a confirm dialog** — list every action with no inverse service function.
7. **Contrast on ink — resolved, and an earlier draft of this file was wrong about it.**
   The ladder is six named rungs (see `README.md` invariant 7 and `02.2`): 1.00 / 0.82 / 0.78 /
   0.72 / 0.60 / 0.55. **The floor for text is 0.55 (5.60:1).**
   **0.50 measures 4.78:1 and PASSES** — an earlier draft claimed it failed. Do not sweep 0.50,
   0.60, 0.72 or 0.82 values; they are fine. The only failures to fix are **0.45** and **0.38**.
   If you find either on text in the desk after this pass, that is a bug.
8. **Teal active rail item** — report the measured ink-on-teal ratio at 13.5px/800.
8. **`.adm-error-icon { font-size: 0 }`** — vestigial, or hiding something on purpose?
10. **Phone bottom bar destinations** — the desk has no calendar route; confirm the four real ones.
10. **`--density`, `.ops-loading`, `.hod-card--raised`, `.adm-actpill`, `.adm-selectpill`** —
    grep each for callers and report which are dead.
