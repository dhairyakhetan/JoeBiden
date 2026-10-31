# 04 · Profile — your own, and the public one

**Files touched:** `frontend/src/profile/ProfilePage.tsx`, `PublicProfilePage.tsx`,
`AchievementsList.tsx`, `AddAchievementModal.tsx`, `EditAchievementModal.tsx`, `BreakModal.tsx`,
`CvCard.tsx`, `HoursAndCertificateCard.tsx`, `EditProfilePage.tsx` + `.css`,
`frontend/src/styles/routes/profile.css`
**Prerequisite:** `00-global-tokens-and-primitives.md` landed and verified.

## Global invariants (restated — do not skip)

1. **No new colours.** Every hex below already exists in `src/styles/tokens.css`.
2. **No new fonts, no new weights.** NeutralFace · Eina01 · JetBrains Mono · Instrument Serif.
3. **No copy changes.** Every user-facing string stays byte-identical, lowercase and trailing periods included.
4. **No route changes.**
5. **No Supabase changes.** No query, `select()` list, filter, RLS policy, service signature or return shape.
6. **No new dependencies.**
7. **Hit targets >= 44x44.** Text contrast >= 4.5:1, or >= 3:1 for type >= 24px.
   **On `--ink` grounds the only legal text colours are `--nav-fg` (15.6:1), `--nav-fg-dim`
   (0.78, 9.4:1) and `--nav-fg-faint` (0.55, 5.60:1).** Alphas at or below 0.50 fail and are legal
   only for non-text. On cream the muted floor is `--ink-3` (4.6:1), never a raw alpha of ink.
   `:focus-visible` stays `3px solid var(--grape)` at `outline-offset: 2px`.
8. **`prefers-reduced-motion` coverage must not regress.**
9. **Do not touch `src/paradox/**`.**

## The concentric rule (restated)

    outer radius  32px   with 10px padding  ->  inner radius  22px    (32 - 10)
    inner radius  22px   with  8px padding  ->  tight radius  14px    (22 -  8)

Here: identity card 32 -> portrait 22 -> chip 14 · identity card 32 -> stat tile 22 ·
tab bar 999 -> capsule 999 · achievement card 32 -> cover 22 -> stamp 999 ·
side card 32 -> tinted well 22 -> progress track 999.

**A radius that is not 999, 32, 22 or 14 is a bug.**

**Design source:** `AquaTerra Feed.dc.html` — `6a` (own, desktop), `6b` (own, phone, on a break),
`6c` (public).

---

## 04.0 · Two live bugs to fix first

1. **bug · `profile.css` line ~106: `.pf-status-declined { background: var(--rust); color: var(--paper); }`**
   **`--rust` is defined nowhere in `tokens.css`.** So a declined certificate request renders paper
   text on the card's own near-white background — invisible. **This is the third instance of the same
   undefined token** (the feed error banner in `00.4`, the desk's rejected stamp in `06.0`).
   **SET** `var(--rust)` -> `var(--danger)`. **Then grep `--rust` across `src/**` again and confirm
   zero remain.**
2. **bug · rotation on data.** `PublicProfilePage.tsx` line ~613 applies
   `transform: rotate(${i % 2 ? 1 : -1.2}deg)` to every achievement card, and
   `AchievementsList.tsx` line ~162 sets a `--card-rot` custom property for the same purpose.
   An achievement is a claim about what someone did, with a verification state attached; it is data.
   **DELETE both rotations** and the `--card-rot` property, plus any `:hover` rule that
   straightens them. **The design rule already exists in the desk's own CSS comment** — only chrome
   may rotate. The sticker is the one exception in the whole product.

## 04.1 · Identity card — your own profile

**Design:** `6a` top. **File:** `ProfilePage.tsx`

Your own profile's identity card is **ink**. That is deliberate and load-bearing: ink is reserved for
your own surfaces (this page, the Command Desk, the chrome), so `6c`'s white card immediately reads
as "someone else's account". **Do not make both ink.**

- **SET** the wrapper: `background: var(--ink); border-radius: var(--r-outer); padding: var(--pad-card); border: none;`
- **SET** the layout to three columns on desktop: a 196px portrait, a flexible name block, a 230px
  stat + action column. Below 860px it stacks to portrait+name on one row, then stats, then actions.
- **SET** the portrait: `width: 196px; border-radius: var(--r-inner); overflow: hidden;` filled with
  the avatar image, or the initials at `900 64px var(--display)` on `hashColor` when there is none.
- **KEEP `.pav` for nothing.** `00.9` deliberately left `.pav` (the 92x92 profile avatar with its
  3px ink border and 4px white ring) alone pending this file. **Now: DELETE `.pav` entirely** and
  replace its call sites with the 22px-radius portrait above. **Grep `pav` first** — if
  `EditProfilePage` or a modal uses it, convert those too.
- **The portrait is NEVER absolutely positioned over the name.** It is a flex/grid sibling that
  reserves its own width. This is a hard rule, not a preference: `ProfilePage.tsx:321` already
  carries `textWrap: 'balance'`, `overflowWrap: 'break-word'` and `wordBreak: 'break-word'` on
  this heading **specifically because long names break the layout**, and an absolutely-positioned
  portrait paints over whatever those properties let the name become. If any part of the identity
  card overlaps another, it must be the card **below** it — where nothing can be covered — not the
  heading beside it.
  **Verify with a 24-character name** (`Priyadarshini Chatterjee`) before you call this done. If it
  collides, the portrait is not a sibling.
- **KEEP the name `<h1 className="h-display">` and its `clamp(34px, 7vw, 84px)`.**
  **SET** `font-weight: 900`, `letter-spacing: -0.05em`, `line-height: 0.88`, `color: var(--paper)`.
  **KEEP** `text-wrap: balance`, `overflow-wrap: break-word`, `word-break: break-word` — those three
  are guarding against a long name breaking the layout and they are correct.
  **KEEP `.toUpperCase()` if it is applied** (NeutralFace has no lowercase glyphs). If it is not
  applied, **do not add it** — that would be a copy change.
- **SET** the eyebrow line (`member since` + `@uuid`) to mono `9.5px/800` uppercase in
  `var(--nav-fg-faint)`. **KEEP both strings and the `uuid?.slice(0, 8)`.**
- **SET** the team/school chips to `background: rgba(244,239,224,0.09); border-radius: var(--r-pill); padding: 7px 13px; font: 700 12px var(--eina); color: var(--paper);`
  with a 6px category-hue dot for teams and no dot for the school. **KEEP every label string.**
- **ADD** the hours hero tile in the third column: `background: var(--welfare)`,
  `border-radius: var(--r-inner)`, one bleeding circle at `rgba(10,10,10,0.10)`, a mono uppercase
  label, and the figure at `900 56px var(--display)` with `tabular-nums`.
- **CRITICAL — there is no hours threshold in this codebase, and you must not invent one.**
  `HoursAndCertificateCard.tsx` carries this comment verbatim:
  > *"There is no 50-hour threshold anywhere in this codebase, so the old 37%-toward-50 progress
  > bar claimed a milestone that does not exist; it is deleted, not restyled. If a threshold is
  > ever wanted, add CERTIFICATE_HOURS to lib/orgFacts.ts and import it so the number lives in
  > exactly one place."*
  So: **no "of 20", no "N more hours to go", no progress bar, anywhere on this page.**
  The tile renders `{summary.totalHours}h` — **with the `h` unit, which is how the source renders
  it** — and under it the mono sub-line the card already builds:
  `{driveCount} drive{s}` plus ` · {earliestDate} – {latestDate}` when both dates exist.
  **KEEP the `+` suffix** rendered when `summary.undercounted` is true, at
  `fontSize: 15, fontWeight: 400, fontFamily: var(--eina), color: var(--ink-3)` — it means the
  figure is a floor, and dropping it would overstate the number.
- **KEEP the card's two self-hiding guards:** `if (loading || !summary) return null` and
  `if (summary.driveCount === 0) return null`. **The hours hero therefore does not render for a
  member with no counted drives** — design the identity card's third column to collapse gracefully
  when it is absent, rather than showing `0h`.
- **KEEP** the `Edit profile` link/button and its string. **SET** it to a 44px `var(--paper)` pill
  with ink text.

## 04.2 · Stat bento

**Design:** `6a` second row.

- **SET** four white `var(--r-outer)` cards, each holding one `var(--r-inner)` tinted well:
  posts (welfare 22%), likes earned (tomato 22%), drives this term (events 22%),
  achievements (lemon **30%** — lemon at 22% over cream is nearly invisible because it is the one
  accent lighter than the paper; `01.5` documents the same exception).
- **SET** each well's label to mono `9px/800` uppercase in the hue's **`*-ink` partner**
  (`--welfare-ink`, `--tomato-ink`, `--sky-ink`, `--lemon-ink`) and the figure to
  `900 34px var(--display)` with `tabular-nums` in `var(--ink)`.
  **The raw hues fail 4.5:1 as label colour on a light ground** — lemon measures 1.61:1.
- **The third tile is `drives`, not `drives this term`.** `certificateService.getHoursSummary`
  returns `driveCount` — a lifetime count, with `earliestDate`/`latestDate` describing its span.
  There is no term-scoped count, so **`this term` would be a false claim.** The label is `drives`
  and nothing more.
  **That figure lives in `HoursAndCertificateCard`'s own state today.** If lifting it into the
  bento means a second `getHoursSummary` call, **do not** — either pass it down from one call, or
  drop the bento to three tiles and log it. Do not substitute a different metric to keep the grid
  square.
- **DELETE the retired points tile if it appears on this page.** `UX-GAPS.md` item 11:
  `lib/gridRecipes.pointsTile` still renders a metric retired 2026-09-04. **Grep `points` in
  `profile/` and remove any display of it.** If removing it needs a product decision, log it —
  but do not restyle it, because restyling a retired metric makes it look maintained.

## 04.3 · Tabs

- **SET** `.tabs.tabs--seg` on both profile pages to a **segmented ink capsule**, matching the
  reference and the nav:
  ```css
  .tabs--seg {
    display: inline-flex; align-items: center; gap: 2px;
    background: var(--ink);
    border-radius: var(--r-pill);
    padding: 6px;
  }
  .tabs--seg .tab {
    min-height: 40px; padding: 0 16px;
    border: none; background: transparent; cursor: pointer;
    border-radius: var(--r-pill);
    font-family: var(--eina); font-weight: 600; font-size: 13px;
    color: var(--nav-fg-dim);                 /* 9.4:1 on ink */
  }
  .tabs--seg .tab.on {
    background: var(--paper); color: var(--ink); font-weight: 800; padding: 0 18px;
  }
  .tabs--seg .tab .count {
    font-family: var(--mono); font-size: 10.5px; margin-left: 6px;
    opacity: 0.6; font-variant-numeric: tabular-nums;
  }
  .tabs--seg .tab.on .count { opacity: 0.55; }
  ```
  **KEEP** `white-space: nowrap` on `.tab .count` (`director.css` documents why).
- **KEEP every tab label and the tab order on both pages.** Do not merge or rename a tab.
- **ADD** `role="tablist"` / `role="tab"` / `aria-selected` if missing.
- **On phone**, the ink capsule becomes a horizontally scrolling row of individual pills (ink for
  active, white hairline for the rest) — a 4-tab ink capsule does not fit 390pt. See `6b`.
  **KEEP** `overscroll-behavior-x: contain` on that scroller.

## 04.4 · Achievements

**Design:** `6a` grid. **File:** `AchievementsList.tsx`

- **SET** the card: `background: var(--card); border: var(--hair-2); border-radius: var(--r-outer);
  padding: var(--pad-card); box-shadow: var(--lift-1);`
  **DELETE** `padding: 0`, `overflow: hidden`, `position: relative` and the `--card-rot` inline
  style from line ~162. **DELETE** the `card-hover` class's translate if it has one — `00.5` makes
  hover deepen the lift instead.
- **SET** the cover image: `border-radius: var(--r-inner); overflow: hidden; aspect-ratio: 16/9;`
  no border, no outline.
- **SET** the verification state to a **pill, not a stamp**:
  ```css
  .pf-verified, .pf-awaiting {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: var(--r-pill); padding: 5px 11px;
    font-family: var(--mono); font-size: 9px; font-weight: 800;
    text-transform: uppercase; letter-spacing: 0.05em;
  }
  .pf-verified { background: color-mix(in srgb, var(--welfare) 22%, transparent); color: var(--welfare-ink); }
  .pf-awaiting { background: color-mix(in srgb, var(--lemon) 30%, transparent);   color: var(--lemon-ink); }
  ```
  `.pf-verified` carries the rosette glyph; `.pf-awaiting` carries a 6px dot.
  **KEEP both strings exactly: `verified` and `awaiting verification`.**
  **DELETE** the old `.pf-stamp` and `.pf-awaiting` rules (profile.css ~170 and ~199) including any
  rotation, dashed inner ring or `stampSettle`-style animation.
- **SET** the title to `700 17px/1.28 var(--eina)`, `letter-spacing: -0.02em`, and the body to
  `400 13.5px/1.55` in `var(--ink-2)`. **ADD `text-wrap: pretty` to both.**
- **SET** the footer: `border-top: var(--hair)`, a text `Share to feed` button in
  `var(--welfare-ink)`, then 44px bare-glyph edit and delete buttons.
  **KEEP all three `aria-label`s: `Share achievement to feed`, `Edit achievement`, `Delete achievement`,
  and the `title="Share to feed"` on the share control** (`AchievementsList.tsx:237`).
  **The share control is icon-only today with that title.** If you render a text label, use
  `Share to feed` — the string already exists as the title, so it is not new copy.
- **On an unverified achievement**, leave the action row's left slot **empty**. The
  `awaiting verification` pill above already states the condition. The mock's
  `a HoD will confirm this` line is invented copy and **has been removed from the design** — do not
  build it. If you want it, it needs approval first (see Unresolved).
- **SET** the `Add an achievement` affordance to a full-width `var(--r-outer)` white card with a
  plus glyph, `min-height: 56px`. **KEEP its string and its `aria-label="Add achievement"`.**
- **SET** the empty state: **KEEP** whatever string `AchievementsList` renders at line ~114.
  **SET** its container from `padding: 48` -> a `var(--r-inner)` cream well inside a
  `var(--r-outer)` card, and **DELETE any dashed border** (`00.12`).

## 04.5 · Side cards

**Files:** `HoursAndCertificateCard.tsx`, `CvCard.tsx`, `BreakModal.tsx` trigger

- **SET** every `<div className="card" style={{ padding: 24 }}` on this page to
  `padding: var(--pad-card)` and let an inner `var(--r-inner)` well carry the visual padding.
  **This is the concentric rule; a 24px flat pad has no inner layer at all.**
- **SET** `.pf-label-row` / `.pf-label` to a header row: the label at
  `800 14px var(--display)`, `letter-spacing: -0.02em`, with the `.pf-label-aside` icon at 15px in
  `var(--ink-3)` on the right. **KEEP every label string** (`your CV`, `hours volunteered`, …).
- **SET** `.pf-figure` to `900 32px var(--display)` with `tabular-nums`.
- **ADD** the certificate progress well: `background: color-mix(in srgb, var(--lemon) 30%, transparent);
  border-radius: var(--r-inner);` a mono uppercase status line in `var(--lemon-ink)`, a 6px
  `var(--r-pill)` track at `rgba(10,10,10,0.12)` with a `var(--lemon-ink)` fill, and a mono
  `{n}/{target}` readout.
  **Both numbers must come from the component's existing data.** It already computes eligibility.
  **SET the well to `--welfare` 22% and the fill to `--welfare-ink` once eligible.**
- **The certificate control's real strings, read from the source. Use these exactly; do not retype
  them from memory and do not use the mock's wording.**
  `HoursAndCertificateCard.tsx` renders a single `.btn-primary` whose label is a ternary:
  - not requesting: `+ request a certificate`
  - a request is already pending: `request pending…` (and the button is `disabled`)
  Opening it swaps in a note input plus **four** buttons, from `DOC_BTN_LABEL` and a literal:
  `certificate` · `letter of volunteering` · `letter of recommendation` · `cancel`.
  The input's placeholder is `anything HR should know (optional)` with `maxLength={280}`.
  **KEEP all of it — the three document types are three different requests and collapsing them
  into one "Request certificate" button would remove two features.** The mock in `6a` shows a
  single button and is wrong about this; follow the source.
- **SET** the disabled state to `background: var(--bg); color: var(--ink-3); cursor: default;` —
  do not hide it. **KEEP the `disabled={hasPending}` logic.**
- **SET** `.pf-request-row` (the existing requests list, `requests.slice(0, 3)`) to a
  `var(--r-inner)` cream row: the document name at `800 12.5px var(--eina)` on the left, the status
  as a tinted pill on the right. **Reuse the same three tones as `06.6.1`.**
  **The real strings, read from `DOC_LABEL` and `STATUS_LABEL`:**
  - document names: `a certificate` · `a letter of recommendation` · `a letter of volunteering`
  - statuses: `pending` · `issued ✓` · `declined`
  **KEEP the `✓` inside the issued label.** It is part of the string, and the tinted pill's dot
  does not replace it.
- **KEEP the two toast strings** in `submitRequest`: the success pair
  `${DOC_LABEL[docType]} requested` / `HR usually decides ${CERTIFICATE_WAIT_TIME}.` (the wait time
  comes from `lib/orgFacts` — **read it, never hard-code it**), and the failure pair
  `couldn't submit that request.` / `try again.`
- **SET** `.pf-status-*`: **DELETE** the three solid-fill rules (`background: var(--lemon)` etc.) and
  replace with the 22%-tint + `*-ink` formula. **This also fixes 04.0 bug 1.**
- **The CV card has ONE button, not two. Its real strings, read from `CvCard.tsx`:**
  - the trigger: `generate my CV`, or `building…` while `building` is true. **`.btn-primary`,
    so it keeps the hard offset per `00.6`.** The mock's `Preview` + `PDF` pair is invented —
    ignore it.
  - the card's body copy, verbatim: *"Built from your AquaTerra record: how long you have been
    here, your teams, the hours you have logged and the achievements an HoD has approved. Nothing
    else."* **SET it to `400 13px/1.55 var(--eina)` in `var(--ink-2)` with `text-wrap: pretty`.
    Do not shorten it** — the last two words are the card's whole argument.
  - inside the modal, the footer actions are `print / save as PDF` (`.btn-primary`) and `close`
    (`.btn-ghost`); the header label and `aria-label` are both `Your CV`.
  - the empty note, verbatim: *"Your record is still empty, so this CV is only your name and
    contact details. Join a team, log a drive or add an achievement and generate it again."*
  - toasts: `couldn't build your CV.` / `try again.` and
    `CV sent to your printer.` / `choose "save as PDF" to keep a copy.`
- **KEEP the whole print pipeline untouched:** the `document.title` swap for the PDF filename, the
  `cv-printing` body class, the 120ms `setTimeout` before `window.print()`, the cleanup effect, and
  the `@media print` rules in `profile.css` that hide the app around the sheet.
  **Your restyle must not touch any rule inside a `@media print` block in `profile.css`.** If a
  radius or colour change would land inside one, skip it and log it.
- **KEEP** `buildCvSections` / `buildCvContact` / `present` from `lib/cv.ts` and the comment's rule:
  *nothing is invented* — the omit-when-empty logic is unit-tested there and this file renders only
  what it is handed.
- **SET** the CV modal: `border-radius: var(--r-outer)`, `border: none`, `box-shadow: var(--lift-4)`.
  **KEEP** `.cv-name` as `<h1>` and `.cv-heading` as `<h2>` — the CV is a document with its own
  heading order and that is correct. **KEEP `.cv-empty-note` and its string.**
- **SET** the break trigger to a `var(--r-inner)` cream row with a 38px white circle holding the
  `MoonIcon` in `var(--grape-ink)`, the label, and a chevron.
  **The real string, read from `ProfilePage.tsx:399`, is `going on a break?`** — a `.btn` today.
  The mock's `Take a break` / `pause without leaving` pair is invented; **do not ship it.**
  **There is no sub-line on this control** — leave the slot empty rather than writing one.
  **SET** `.pf-break-moon` colour to `var(--grape-ink)` — raw `--grape` is 4.33:1 and fails as a
  small glyph on cream.

## 04.6 · The break state

**Design:** `6b`. **File:** `ProfilePage.tsx` `.pf-break` block + `BreakModal.tsx`

- **SET** `.pf-break` to a **banner inside the ink identity card**, not a separate card:
  `background: rgba(126,91,255,0.28); border-radius: var(--r-inner); padding: 13px 14px;`
  with a 36px `rgba(244,239,224,0.12)` circle holding the moon glyph in `var(--paper)`, the status
  sentence at `700 13px` in `var(--paper)`, a mono sub-line in `var(--nav-fg-dim)`, and an `End`
  action as a 36px paper pill.
  **Grape at 28% on ink is the one tinted-on-ink case in the product.** Measured: paper on that
  ground is **12.81:1**, and the `rgba(244,239,224,0.66)` sub-line is **6.39:1**. Both pass — 28%
  is correct, do not raise it.
- **The banner's real sentence, read from `ProfilePage.tsx:383`:**
  `on a break until {date}`, where the date is
  `new Date(break_end + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })`
  — so it renders as `on a break until September 30`, full month name, no year.
  **KEEP that exact formatter, including the `'T00:00:00'` suffix** — it is there to stop the date
  shifting a day under timezone parsing, and dropping it is a real bug.
  **There is no second line on the banner.** The mock's `nobody will chase you` is invented.
- **KEEP** `.pf-break-avatar` and `.pf-break-moon` as elements; restyle only.
- **`BreakModal.tsx`: its field labels, read from source, are `back on` (with a required-field
  `*`) and `note to your team lead (optional)`.** **KEEP both**, plus the `aria-label="Close"`.
  **Both `var(--rust)` references in this file are the 04.0 bug** — the `*` and the validation line
  are invisible today. Fix them to `var(--danger)` as part of this section.
- **Every other string in `BreakModal` was not read.** **KEEP whatever ships today — do not retype
  any of it from this document.**
- **KEEP** `.pf-break-avatar` if it renders the member's photo; **SET** it to `var(--r-pill)` and
  **DELETE** any ink ring (`00.9`).
- **The break state must be visible on the public profile too** — a visitor should know why someone
  has gone quiet. **Check whether `PublicProfilePage` reads it. If it does not, that is a gap, not
  this file's to fix** — log it.

## 04.7 · Public profile

**Design:** `6c`. **File:** `PublicProfilePage.tsx`

- **SET** the identity card to **white**: `background: var(--card); border: var(--hair-2);
  border-radius: var(--r-outer); padding: var(--pad-card); box-shadow: var(--lift-1);`
  **Not ink.** See 04.1.
- **SET** the portrait to 132px at `var(--r-inner)` on `hashColor`.
- **KEEP** the name `<h1>` and its `clamp(40px, 7vw, 72px)`. **SET** `font-weight: 900`,
  `letter-spacing: -0.045em`, `line-height: 0.92`. **KEEP** `VerifiedTick` beside it at 19px.
- **SET** the meta line to mono `9.5px/700` uppercase in `var(--ink-3)`. **KEEP its construction
  verbatim** — the mock's `welfare projects · la martiniere · member since 2023` is illustrative
  filler, not read from source.
- **The `Team lead` chip shown in an earlier version of the mock was invented and has been
  removed.** Render only chips whose values the page already has.
- **SET** two hero stat tiles in the right column at 22% tint: `posts` (welfare) and `likes` (tomato).
  **Both labels must name figures `PublicProfilePage` already renders.** The mock originally said
  `drives led`; **no such figure exists** — `driveCount` is a count of drives attended, not led,
  and it is fetched only by the own-profile card. It has been corrected to `posts` in the design.
  **Use whatever two figures the page already has** and label them literally.
- **Hours are not proposed for the public profile.** **Do not add them.** If they are already
  exposed there, that is a privacy question for the user, not a design change — log it and change
  nothing.
- **SET** the post grid to 2-up `var(--r-outer)` cards with a 22px 4/3 cover, a floating category
  pill bottom-left (the same `.feed-card-cat-float` from `01.15.3` — **reuse it, do not fork it**),
  a title at `700 16px/1.28`, and a mono meta line.
- **KEEP** the three empty states at lines ~487, ~602, ~644 and their strings. **SET** each from
  `padding: 60, textAlign: center` to a `var(--r-inner)` cream well inside a `var(--r-outer)` card.
- **KEEP** the `card card-hover` behaviour on post cards but **DELETE** any translate on hover.

## 04.8 · Edit profile

**File:** `EditProfilePage.tsx` + `EditProfilePage.css`

- **SET** the page title `<h1 className="h-display">`: **KEEP** `clamp(36px, 6vw, 56px)` and the
  string. **SET** `font-weight: 900`, `letter-spacing: -0.045em`.
- **SET** both notice cards (lines ~166 and ~172): **DELETE** `borderLeft: '4px solid var(--tomato)'`
  and `borderLeft: '4px solid var(--welfare)'`. **A 4px left accent bar on a 32px-radius card
  cannot follow the corner** — it is the same defect as the feed card's category spine (`01.15.1`)
  and the "rounded container with left-border accent" trope. Replace with a tinted well:
  error -> `background: var(--danger-tint)` with the text in `var(--danger)`;
  success -> `color-mix(in srgb, var(--welfare) 22%, transparent)` with the text in `var(--welfare-ink)`.
  **KEEP `role="alert"` on the error and both strings.**
- **SET** every form card from `padding: 28` / `padding: 24` to `var(--pad-card)` with
  `var(--r-inner)` field wells inside, per the concentric rule.
- **SET** every input to the `00.10` primitive: `var(--hair-3)`, `var(--r-inner)`, `background: var(--bg)`,
  `font-size: 16px`, `min-height: 46px`. **DELETE any inline `fontSize: 16` overrides** — the
  primitive now supplies it.
- **SET** the avatar-change control to a 44px pill. **KEEP both `aria-label="Change avatar"`
  attributes** (the hidden file input and the visible button both carry one; that is correct).
- **ADD** field-level error rendering using the `[aria-invalid="true"]` style `00.10` ships.
  **This is the one form in this file where it is worth wiring up.** `UX-GAPS.md` item 22 notes no
  form in the product reports field errors today. **If the validation currently only produces a
  page-level message, keep that and log it** rather than inventing per-field messages.

## 04.9 · Modals

`AddAchievementModal`, `EditAchievementModal`, `BreakModal`, the CV modal.

- **SET** each panel: `border-radius: var(--r-outer)`, `border: none`, `box-shadow: var(--lift-4)`,
  `padding: var(--pad-card)`, with `var(--r-inner)` sections inside.
- **SET** each header's divider to `var(--hair)`.
- **SET** every close button to 44x44 at `var(--r-pill)` on `var(--bg)`. **KEEP the `✕` glyph and
  every `aria-label="Close"`.** **DELETE** the `className="btn btn-sm"` on them — a close × is not
  a button-shaped control, and `btn` gives it a hairline border it does not want.
- **On phone**, they become full-screen sheets with a sticky header and footer.
  **Reuse the rules `director.css` already has for this** (`06.6.4`) rather than writing new ones —
  grep `modal-back` and `modal-head`.
- **KEEP** every field, label, validation and string in all four.

## A note on strings in this file

Sections **04.0**, **04.1**, **04.4**, **04.5** and **04.6** quote strings **read verbatim from
source** (`HoursAndCertificateCard.tsx`, `CvCard.tsx`, `AchievementsList.tsx`,
`ProfilePage.tsx`'s break block, `BreakModal.tsx`'s labels, `profile.css`). Those you can trust
and type exactly.

**Everywhere else in this file, and everywhere in the `6a`/`6b`/`6c` mocks, treat copy as
illustrative.** Where an instruction says *"KEEP whatever string ships today"*, it means exactly
that: **read the string out of the file you are editing and leave it byte-identical. Do not retype
it from this document.** No section of this file authorises a copy change.

Strings the mock invented and which have now been **deleted from the design** — do not build them:
`Take a break` · `pause without leaving` · `nobody will chase you` · `2 more hours to go` ·
`18 of 20` · `Request certificate` · `Preview` · `PDF` ·
`Built from your verified achievements and hours.` · `a HoD will confirm this` · `Team lead` ·
`drives led` · `drives this term` · `End`.

## Unresolved after this file

1. **Hours threshold** — resolved: there is none, and none may be invented (04.1). If the user
   wants one, it is `CERTIFICATE_HOURS` in `lib/orgFacts.ts` and nowhere else.
2. **`driveCount` in the bento** — reachable from one `getHoursSummary` call, or drop the tile?
3. **Points on the profile** — does `pointsTile` or any points figure still render here?
   (`UX-GAPS.md` item 11.)
4. **Hours on the public profile** — currently exposed? Privacy question, not a design one.
5. **Break state on the public profile** — does `PublicProfilePage` read `break_end`?
6. **Grape 28% on ink** — resolved: 12.81:1 for paper, 6.39:1 for the 0.66 sub-line. Both pass.
7. **`.pav` call sites** — list every one before deleting the class.
8. **Unverified-achievement explainer** — cut from the design. Approve the copy if you want it back.
9. **Field-level validation** — does `EditProfilePage` produce per-field errors, or only page-level?
10. **`BreakModal`'s remaining copy** — not read; every string in it must be preserved as-is.
11. **`@media print` blocks in `profile.css`** — confirm no restyle instruction lands inside one.
