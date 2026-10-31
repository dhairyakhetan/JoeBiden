# DESIGN.md — the guardrails

**Read this before designing any AquaTerra surface.** It is the standing brief: the rules that
hold whether or not anyone gave you a reference for the page you are building. If you are asked
"design the X page" and X is not in `changelog/`, this file is your instruction set.

Order of authority when two things disagree:

1. **The code.** A string, a column, a guard in `frontend/src/` beats every document here.
2. **The repo's own docs**, which predate this redesign and outrank it on their own subjects:
   - `docs/BRAND_VOICE.md` (29KB) — **the authority on all copy and tone. It supersedes §12
     of this file.** Read it before writing a single user-facing sentence.
   - `docs/VISUAL_AUDIT_MOBILE_2026_07.md` — known mobile defects. Check before "fixing" one.
   - `docs/PERFORMANCE_AUDIT_2026_07_31.md` — the budget any new motion has to live inside.
   - `docs/CODEBASE_AUDIT_2026_07_31.md` · `docs/SEO_AUDIT_2026_07.md`
   - `handoff/*` — the operational specs. `handoff/20-sops-and-todos.md` §4.5 is quoted verbatim
     inside `WhatsAppTemplates.tsx`, so this set is live and load-bearing.
   - `docs/archive/` (19 files) and `docs/superpowers/` (2) — unread; check before contradicting.
3. **This file** — the visual and structural rules.
3. `changelog/README.md` — the invariants and the cross-file coordination.
5. `changelog/NN-*.md` — the per-page instructions.
6. `changelog/MASTER-PLAN.md` — scope and sequence.
7. The design document (`AquaTerra Feed.dc.html`) — appearance only. **It is illustrative.**

**If this file and `docs/BRAND_VOICE.md` disagree about words, BRAND_VOICE wins.** If they
disagree about pixels, this file wins.

---

## 0 · The five things that are never negotiable

1. **Same colours, same fonts.** No new hex, no new family, no new weight. The palette is
   `frontend/src/styles/tokens.css`; the faces are NeutralFace (display), Eina01 (body),
   JetBrains Mono (labels/figures), Instrument Serif (one italic word, sparingly), and
   **Caveat (handwriting) — everywhere EXCEPT the HoD desk.**

   > **AMENDED 2026-09-06 by the project owner.** This rule previously said four faces, but
   > Caveat was live in six places with a real `@font-face`, so it genuinely loads: the sign-in
   > receipt, the welcome overlay (x2), the contact page, onboarding (x2) and the sticker
   > system. `director/adminKit.tsx:186` had separately removed it from the desk as "a fifth,
   > uncontrolled typeface". Both could not be right. The ruling: **Caveat is a sanctioned
   > fifth face on member- and public-facing surfaces, and stays banned on the `director/*`
   > desk**, which is deliberately a different, quieter visual language (see CLAUDE.md's "two
   > design languages" note). Use it only where something is genuinely handwritten - a
   > signature, a note, a label on a physical-looking object - never for UI chrome, never for
   > body copy, and never on the desk. Do not add a sixth face.
2. **No copy changes.** Every user-facing string stays byte-identical unless a document quotes a
   replacement and says so. Lowercase stays lowercase. Trailing periods stay.
3. **No Supabase changes.** No query, `select()` list, filter, RLS policy, service signature or
   return shape. If a design needs data that does not exist, the design changes — not the schema.
4. **No new dependencies.** Everything is hand-rolled or already in `package.json`.
5. **`src/paradox/**` is out of scope.** Never touch it.

---

## 1 · The shape language

### Concentric radii — the spine of the whole system

    outer 32px  −  10px padding  =  inner 22px
    inner 22px  −   8px padding  =  tight 14px

Tokens: `--r-outer: 32px` · `--r-inner: 22px` · `--r-tight: 14px` · `--r-pill: 999px`
`--pad-card: 10px` · `--pad-inner: 8px`

**A radius that is not 999, 32, 22 or 14 is a bug**, with exactly two documented exceptions: the
6px inline mention mark and the desk's 18px checkbox. If you need a new one, you have nested
wrongly.

### Layered warm whites

- `--bg` cream `#F4EFE0` is the **ground**
- `--card` white `#FFFFFF` is the **layer** that floats on it
- cream returns **inside** a white card as a recessed well (stats, fields, rows)

So: cream page → white card → cream well → white chip. Depth comes from stacking, not shadow.
Shadows are `--lift-1` (`0 1px 2px rgba(10,10,10,.04)`) up to `--lift-4` for modals. Never a
coloured shadow.

### The hard offset is now rare

`box-shadow: 2px 2px 0 var(--ink)` with `border: 2px solid var(--ink)` survives on **primary
buttons and stamped stickers only**. Everywhere else it is replaced by a hairline
(`1px solid rgba(10,10,10,.08)`) plus `--lift-1`. Do not reintroduce it on cards, inputs,
panels or rows.

---

## 2 · Contrast — measured, not estimated

### Text on a saturated accent fill is ALWAYS ink

| fill | ink on it | paper on it |
|---|---|---|
| lemon `#FFC700` | 15.1:1 | fails |
| sky `#3DA9FC` | 9.4:1 | fails |
| tomato `#FF4D2E` | 6.7:1 | fails |
| pink `#FF4D8C` | 6.4:1 | fails |
| teal `#12909C` | **5.18:1** | **3.32:1 FAIL** |
| grape `#7E5BFF` | **4.55:1** | **3.78:1 FAIL** |
| welfare `#1B8A5A` | **4.55:1** | fails |

Grape and teal are the darkest accents, so they are the only ones where paper text feels right —
**and both fail.** Grape and welfare sit 0.05 above the floor: do not lighten either fill, and do
not drop below weight 700 on them.

Paper text is legal on exactly one accent-derived colour: `--grape-ink` `#6B44E8` (5.05:1).
**Ink on `--grape-ink` is 3.41:1 and fails** — they are not interchangeable.

### An accent hue is a FILL, never text on cream

This one rule explains four of the five worst defects in `docs/VISUAL_AUDIT_MOBILE_2026_07.md`.
Measured, accent **as text on the cream page**:

| accent as text on cream | ratio | verdict |
|---|---|---|
| lemon `#FFC700` | **1.36:1** | `/classes` hero word "class of" — a hero headline that reads as a smudge |
| lemon at 10px | **1.25:1** | `/links` department stat labels — worst on the site |
| sky `#3DA9FC` | **2.03–2.54:1** | `/links` stats, `/teams` "department" at 42px, "Events" |
| pink `#FF4D8C` | **2.51–2.73:1** | `/about` "years" 36px, "11 June 2021" 24px |
| teal `#12909C` | **3.06:1** | `/links` stats |
| welfare `#1B8A5A` | **3.48–4.32:1** | `/roots` label, the 9px active tab label |

**So: never set an accent as `color` on cream or white.** Put the accent behind ink text, or use
its `*-ink` partner (`--welfare-ink` `#146F47`, `--grape-ink` `#6B44E8`, `--sky-ink` `#0B6BB8`,
`--tomato-ink` `#C6300F`, `--lemon-ink` `#7E6000`) when a coloured word is genuinely wanted.
`QuickLinksPage.css:31` sets `color: var(--dc)` with no floor — that is the bug pattern.

**And white on a saturated accent fails too:** white on tomato `#FF4D2E` is **3.31:1** (the
handbook stickers and the 404 sticker), white-ish on the Paradox red `#FF4338` is **3.16:1**.
Ink on the fill, always (see the table above).

### Paper on ink — a six-rung ladder

| token | alpha | ratio |
|---|---|---|
| `--nav-fg` | 1.00 | 15.6:1 |
| `--nav-fg-strong` | 0.82 | 10.1:1 |
| `--nav-fg-dim` | 0.78 | 9.4:1 |
| `--nav-fg-mid` | 0.72 | 7.9:1 |
| `--nav-fg-soft` | 0.60 | 6.5:1 |
| `--nav-fg-faint` | 0.55 | **5.6:1 — the floor for text** |

Pick a rung. Do not invent an alpha between them. **0.50 measures 4.78:1 and passes** (the real
boundary is ~0.47) but is not a rung — do not introduce it, and do not "fix" one you find.
**0.45 (4.05:1) and 0.38 (3.20:1) fail** and are legal for non-text only.

On cream, the muted text floor is `--ink-3` `#5A5A55` (4.6:1). Never a raw alpha of ink —
`rgba(10,10,10,0.35)` is 2.30:1.

### Sizes and targets

Hit targets ≥ 44×44. Documented exceptions, each justified at its call site: 42px dock buttons,
40px desk row actions, 38px chips, 32px comment-foot actions inside a 44px row. Never below 32.
`:focus-visible` is `3px solid var(--grape)` at `outline-offset: 2px` — do not restyle it.
Body text ≥ 16px on any input (iOS zoom). Deck text ≥ 24px. Print ≥ 12pt.

---

## 3 · The sticker system

Eight silhouettes: circle, squircle, pill, starburst, rosette, diamond, oval, bubble.
Seven hues. Three sizes (9 / 11 / 15px text).

**Two keyline modes, and the choice is functional:**

- **Stamped** — `2px solid var(--ink)` + `2px 2px 0 var(--ink)`. For stickers you can **tap**.
  Presses on `:active`. Has hover.
- **Die-cut** — a 3px ring in the colour of the surface it lies on. For decoration and state
  readouts. **No hover, ever** — nothing about it is clickable.

**The ring is painted two different ways.** Five silhouettes are box-model shapes and take
`box-shadow: 0 0 0 3px {ground}`. Three are `clip-path` shapes (starburst, rosette, diamond) and
**cannot** — `clip-path` clips `box-shadow`, `border` and `outline` alike, so all three are cut
away and the ring silently does not render. Those three get it from a **nested pair sharing one
clip-path**: outer element in the ground colour at full size with `padding: 3px`, inner element
with the same `clip-path` in the hue.

**Rotations come from a fixed set** — −6, −3, −2.5, −2, 1.5, 2, 3, 4, 6, 8 — assigned by a
**stable hash of the sticker's own text**, never at random. Same sticker, same angle, every
render and every reload. Random rotation makes the page twitch on re-render.
Rotation survives `prefers-reduced-motion`: it is composition, not motion.
**Never rotate a person's name or a number.**

---

## 4 · Motion

Four floors, non-negotiable:

1. `prefers-reduced-motion: reduce` **removes** everything ambient. Not reduces. Entry
   animations jump to their settled state; loops never start; parallax and gyro are inert.
2. **Nothing above the fold animates before its content is readable.**
3. **Ambient motion pauses when the tab is hidden** (`visibilitychange`) and when scrolled out of
   view (`IntersectionObserver`).
4. **Nothing blocks a tap for more than 300ms.** Every animation is interruptible; a tap during
   an entry animation completes it instantly and acts.

Animations are built in `renderVals()` as `React.createElement`, never driven from template
`animation:` + `@keyframes`, so animation state survives re-render.

### The motion budget — measured, from `docs/PERFORMANCE_AUDIT_2026_07_31.md`

The app already ships **~251 KB gzipped of eager JS** on every route, and **`vendor-motion`
(framer-motion) is 44.4 KB gz of it, sitting in the modulepreload list.** The audit's stated goal
is to get it **out** of that list. So "make the site feel alive" cannot mean "add more
framer-motion to the critical path" — that reverses the single biggest performance fix on the
list.

**Where motion is cheap, and therefore allowed to be ambitious:**

- **Below the fold.** The footer is the ideal home for the heaviest work: it is below-fold, and
  the audit *already* earmarks `v6.css` lines 530–766 (footer + marquee + sticker, 9.8 KB) to
  move into a `footer.css` imported by `AQFooter`, explicitly noting "no FOUC risk". A parallax
  footer gated behind `IntersectionObserver` costs nothing until it is scrolled to.
- **CSS transforms and `@keyframes`**, which cost no JS at all.
- **One `requestAnimationFrame` loop, shared.** A parallax stage, a gyro reader and a marquee
  must not each own a loop. One loop, one `transform` write per frame, per element.

**Where it is expensive, and therefore rationed:**

- **Above the fold on `/`.** `HomeRoute` eagerly imports `HomePage` (1,604 lines) and is the
  audit's **P0-1**. The burst-and-settle load animation (I-18) lands exactly here, so it must be
  **pure CSS**, must not import a motion library, and must not delay the first legible frame
  (floor 2 above). If it cannot be done in CSS, it does not ship.
- **Anything that adds a new JS dependency.** Forbidden outright (§0.4).

**Three asset rules that matter more than any animation:**

1. **User-uploaded images ship at original size.** `lib/imageUrl.sized()` only rewrites Framer
   URLs; Supabase storage URLs pass through untouched, and `feedService.uploadImages` uploads the
   raw `File` with **no byte cap** (the composer caps count at 4, not size). A feed of 20 image
   posts can ship **50–100 MB** to paint 500px cards. **Any design that adds images makes this
   worse.** The composer redesign should downscale client-side (~1600px, WebP/JPEG q80).
2. **Fonts are not preloaded.** The three above-the-fold faces (~67 KB) are discovered only after
   36 KB gz of CSS parses, causing a late swap. Do not add a fourth face — and note the audit
   says explicitly: **do not preload Caveat or JetBrains.**
3. **`public/icon-512.png` is 464 KB.** Do not add uncompressed assets.

---

## 5 · The feed card system — READ THIS BEFORE TOUCHING A CARD

**There is already a formal 30-shape system. Do not invent a parallel one.**

`frontend/src/lib/feedShape.ts` owns it, `frontend/src/feed/cards/` renders it,
`frontend/src/lib/feedShape.test.ts` tests it, and `AQ Feed Cards.dc.html` is the rendered
catalogue of all 30.

Eight families, **evaluated in order, first match wins**:

    00 chrome     C08 pinned · C23 offline queued · C24 skeleton
    01 moments    C15 birthday · C14 welcome · C16 break
    02 asks       C30 volunteer gap · C26 poll · C27 countdown · C18 referral · C19 hiring
    03 records    C13 certificate · C12 achievement · C10 project active ·
                  C11 project delivered · C09 drive · C20 class · C21 drop
    04 editorial  C06 long read
    05 posts      C01 hero · C02 colour block · C03 standard · C04 collection ·
                  C05 quote · C07 text
    06 digest     C22 roundup · C28 milestone · C17 spotlight
    07 fallback   C25 compact rows · C29 caught up

**Both orders are load-bearing. Do not reorder either for readability.**

### The caps, and why they exist

| cap | rule |
|---|---|
| hero | one C01 per session |
| ink | at most one C02 every 10 rows |
| same hue | never two C02 adjacent with the same category |
| ask | at most one family-02 card every 5 cards |
| author | 4th and later card from one author collapses to C25 |
| digest | never two in one session |
| moments | a moment seen once is suppressed for the rest of that day |

A suppressed moment **falls through to the next family** — it does not block.

### Four data facts that must change how you design

Counted from the live table, not sampled:

1. **`posts` has no image columns at all.** So C01, C02, C03 and C04 — every photo card —
   are `data: 'none'` and **unreachable from a post row today.** If you design a photo-led feed
   card, you are designing something the database cannot fill. Say so out loud.
2. **576 of 586 posts come from the org account.** So the author cap fires constantly and
   **C25 compact rows is the common case, not the exception.** Design C25 as a first-class
   citizen, not a fallback.
3. **No post body exceeds 900 characters**, so C06 long read is unreachable from `posts` and
   only fires from `blogs`.
4. **`stats` is `[]` on all 586 rows.** Any card printing a figure from it prints nothing.

### The two guardrails the code already names

- **Rule 2 — a card gets a photo only for its own row.** `imageUrl` empty means no photo. Never
  borrow an image from elsewhere to fill a layout.
- **Rule 4 — never substitute a zero.** `CardFigure.value: null` means the host could not resolve
  it, and the card renders the **dashed live marker**. A zero is a claim.

### Body splitting

`splitPostBody()` splits on the first blank line: title / rest. 583 of 586 bodies are
title / blank / sentence. Do not slice by character count.

### Junk filtering

`isRealPostBody()` rejects empty, `n/a`, `tbd`, `-`, `placeholder`, `test`, and vowel-less junk
under 24 letters. Post 774 is live published junk (`"xcv xv"`). This filters at **render** time
and touches no query. Keep it.

---

## 6 · Data honesty — the rule that has caught me out most

**Never print a figure the database cannot produce.** Concretely, all verified in source:

- **There is no hours threshold.** `HoursAndCertificateCard` says so explicitly: no 50-hour
  target exists, and the old "37% toward 50" bar claimed a milestone that did not exist. **No
  progress bar, no "N more hours", anywhere.** If a threshold is ever wanted it becomes
  `CERTIFICATE_HOURS` in `lib/orgFacts.ts` and lives in exactly one place.
- **`drive_attendance` holds zero rows before 2026-08-31.** Digital check-in went live that day;
  everything before it was on paper. So `driveCount === 0` means *"no digital record exists"*,
  **not** *"has never volunteered"*. Never render it as the latter.
- **The public member card carries name, school and role — and nothing else.**
  `MembersPage.css` states it. No teams list, no joined date, no drive count.
- **The members list filters by role, not by team.**
- **The points system was retired 2026-09-04.** `lib/gridRecipes.pointsTile` still renders it in
  five of seven greeting recipes. **That is a lie on the most-visited surface — delete it.**
- **A birthday never shows an age.** `birthday_public` is an opt-**in**, off by default, and an
  age is not what was opted into. The private acknowledgement on your own profile fires
  regardless of the toggle; the toggle gates only the public notice.

When a figure is unavailable: render the **dashed live marker**, or omit the tile. Never a zero,
never a placeholder number, never "coming soon".

---

## 7 · States — every surface needs all of these

### Page level
loading (skeleton matching the shape that will arrive) · empty **with an action** · error
**with retry** · offline · not found (per resource type) · permission denied (naming the role
needed) · rate limited · stale · partial failure.

### Form level
pristine · focused · filled · **field-level invalid** · form-level summary · submitting (button
busy, form locked) · success · server rejection · network failure **with the draft preserved** ·
unsaved-changes guard · disabled/not-eligible · read-only.

`CollaborationsPage.tsx` is the model — it already does real per-field errors with
`aria-invalid` and `role="alert"`. Copy that pattern; do not invent another.

### Action level
Optimistic write → rollback on failure. **Fire the toast after the write, not before** —
`FeedPostCard` documents this as a deliberate fix. Per-row busy state so one action cannot
disable its siblings (`AdminRow`). Undo instead of confirm for reversible verdicts; keep
`Confirm.tsx` for the irreversible. `aria-live` on every optimistic change.

### Content level
no image · 1 vs 2 vs 9 images · **a 24-character name** · long team list · no team · no school ·
zero drives · unverified achievement · pending moderation · on a break · deleted author ·
official account · self vs public view.

**Test the long name.** `ProfilePage` carries `textWrap: balance`, `overflowWrap: break-word` and
`wordBreak: break-word` on the heading *specifically because* long names break the layout. And
**never absolutely position anything over that heading** — if an element must overlap, it
overlaps the card *below*, where nothing can be covered.

---

## 8 · Skeletons must match

A skeleton that reflows when data arrives reads as the page jumping. The desk's landing skeleton
admits this in its own comment. If the real card is photo-first, the skeleton is photo-first. If
comments are bubbles, the skeleton is bubble-shaped, not row-shaped.

---

## 9 · Accessibility floors

`aria-modal` + `role="dialog"` + a focus trap on every modal and full-screen sheet.
`aria-current="page"` on nav. A skip link targeting `#main-content`.
`role="group"` + `aria-labelledby` on chip groups (not one control).
Icon-only buttons carry `aria-label`. Every notification row deep-links to its thing.
`eager` on the first feed image (it is the LCP element — the feed has no hero).

---

## 10 · Things that look redundant and must not be "cleaned up"

A redesign pass is exactly when these get deleted by accident.

- The `headline`/`rest` word-boundary split in `FeedPostCard` (`LIMIT = 120`, sentence-boundary
  search, `> 40` guards) — fixes mid-word cuts across two type styles.
- The category-scoped pending count in `DirectorDashboard` — without it a scoped HoD sees a
  global badge over a smaller list.
- `overscroll-behavior-x: contain` on the desk's filter scroller — prevents a swipe-back that
  loses in-progress state.
- `actionsInline` on `DataToolbar` — stops MemberDirectory's sort control being pinned 330px
  from the results it controls.
- The `member?.uuid === post.authorUuid` self-vs-public branch on the card head.
- `superOnly` / `canApproveMembers` mirroring the route guards in both rail and landing.
- `hasLeaderAccess` for approvals vs `isSuperAdmin` for certificates — these mirror RLS
  policies, not UI preference.
- The `'T00:00:00'` suffix on every date parse — without it dates shift a day under timezone
  parsing.
- The profanity gate (`checkText`, `BLOCK_MESSAGE`) — real work on a product used by minors.
- **Zero horizontal overflow on all 22 public routes at both 375px and 360px**, zero broken
  images, zero console errors. That is a measured baseline — **do not regress it.** Anything
  full-bleed, rotated, or parallax must be re-measured at the **360px small-Android floor**.
- `aspect-ratio: 4/3` / fixed-height cover containers with `object-fit: cover`. The `<img>` tags
  lack `width`/`height` attributes but cause **no layout shift** because the space is reserved.
  Keep the containers.
- `WelcomeOverlay` blocks page scroll while open, is dismissible by backdrop **and** ×, and
  honours `prefers-reduced-motion`. Its × is 32px — that one **is** a defect to fix.
- `PostFocusModal` mounted always with `isOpen` driving `AnimatePresence` — conditional mounting
  kills the exit animation.
- `isRealPostBody` / `isRealTask` — render-time junk guards with live junk to catch.

---

## 11 · How to read a string instruction

Two forms, and the difference matters:

- **A quoted string** was read verbatim from the source file named in that section. Type it exactly.
- **"KEEP whatever string ships today"** means it was *not* read. Open the file, use what is
  there, leave it byte-identical, **and do not retype it from the document.**

**Copy in the design document is illustrative unless a changelog section quotes it.** The mocks
needed plausible sentences to lay out; many are invented, and each changelog file lists its own
invented strings under *"A note on strings"*.

**If an instruction quotes a string and the file disagrees, the file wins.** Report it; do not
reconcile by editing either one.

---

## 12 · Writing style — SUBORDINATE TO `docs/BRAND_VOICE.md`

**Read `docs/BRAND_VOICE.md` first.** It is 29KB of established voice guidance written before
this redesign and it is the authority. What follows is only a summary for quick reference, and
where it differs from that document, that document is right.

Clean, clear, matter-of-fact. Lowercase headings are the house style — follow the surrounding
page. No em-dash pile-ups, no "this, not that", no metadiscourse, no exclamation marks, no emoji
(the one exception is the 🎂 already in the birthday notice template, which is in the database).

The voice is a student organisation talking to students: direct, unimpressed by itself, specific
about what actually happened. Numbers earn their place; adjectives usually do not.

---

## 13 · If you are designing a page nobody specified

1. **Read the route's component and its CSS first.** Every string, every guard, every column.
2. **Find the nearest designed sibling** in `changelog/` and inherit its structure.
3. Apply §1 (shape), §2 (contrast), §3 (stickers), §4 (motion).
4. Build all of §7's states, not just the happy path.
4b. **Check the desk conventions if it is a desk screen.** `adminKit.tsx` (29KB) already exports
   `AdminRow`, `AdminRowActions`, `EmptyLedger`, `AdminSkeleton`, `AdminErrorState`,
   `AdminLayout`, `AdminTabHeader` and `DataToolbar`. Use them. A desk screen that renders as a
   **section inside a parent** (like `WhatsAppTemplates`) deliberately omits
   `AdminLayout`/`AdminTabHeader` because the parent owns that chrome — do not add them back.
5. **List what you could not verify** in an "Unresolved" section. An honest gap beats a guess.
6. Write the changelog file as you design — same numbering, same invariant restatement, same
   "A note on strings". A design without its changelog entry does not exist for the handoff.
