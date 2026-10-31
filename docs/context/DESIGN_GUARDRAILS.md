# Design guardrails and the complaint decoder

Built 2026-10-22 from the whole design history: the 3 Sept 2026 redesign brief (`REDESIGN_GUARDRAILS.md`), the
Sept 2026 rounded-minimalism handoff (`interface-redesign-with-rounded-minimalism/project/changelog/`: `README`,
`00`, `06`, `11`, `13`, `17`, `20`, `ACCEPTANCE`, `AUDIT`, `UX-GAPS`, `WORKFLOW`), `docs/plans/design-system-pass.md`,
`GUARDRAILS_2026_09_18.md`, `DECISIONS_2026_09_18.md`, `docs/context/DESIGN_RULES.md`, the 138 commits on `main`
since 18 Sep 2026, the live `bug_reports` table, and every correction the owner made in review.

**Authority, in order:** `frontend/src/styles/tokens.css` (read only; never edit) > `CLAUDE.md` > this file >
`DESIGN_RULES.md` > the older handoff docs. When two disagree, the one higher up wins, and the PR says so. The
handoff docs describe the Sept state; the owner has moved the site on since (see section 2), so read them for
reasons, not for current values.

This file does two jobs. Part A (sections 1 to 5) is the rule set a design change is tallied against. Part B
(sections 6 to 9) decodes what people mean when they say a page "looks bad", and how to read their screenshot.

---

# Part A. The guardrails

## 1. How to use it (every change that a person can see)

1. **Before building:** find the neighbouring surface that already solves the same problem (a card, a form, a
   list, a modal) and read its code and its CSS. Copy what it does. Read `tokens.css` for the values. Do not
   design from memory (`REDESIGN_GUARDRAILS` rule 5: two components were invented from memory and had to be redone).
2. **While building:** the table in section 3 is the checklist. Reuse the components in section 4.
3. **Before merging:** run `TALLY_BLOCK=1 bash docs/sheet-triage/design_tally.sh` (mechanical checks over your diff,
   new unstaged files included) and look at the screenshots yourself at 390 and 1440 (section 8). Exit 0 is "no FAIL",
   exit 1 is a breach, and **exit 2 means the check could not run** (the base ref is missing: `git fetch origin main`);
   that is never a pass. The script prints the `Guardrail tally:` block with the rows it can settle filled in; paste it
   into the PR body and replace every `TODO` with `ok`, `n/a (reason)` or `exception (reason)`. An unticked row is a
   blocker, not a note.
4. **When a rule and a report conflict:** the report is the newer instruction for taste and flow; the rule wins for
   access, data, accessibility and the hard limits in `SHEET_TRIAGE_ROUTINE.md` sections 3 and 6.

## 2. The design history in six lines (so you know what has been reversed)

| When | What the owner decided | What it means now |
|---|---|---|
| 3 Sep 2026 | "UX stays the same. UI completely changes." Dated to alive, rounded, modern, not AI slop. | Same fonts, colours, copy and flows; the look changes. Every flow, success state and error state must survive a restyle. |
| 9 Sep 2026 | Outline by layer depth: the frame has an edge, the contents inside it do not. | Separate inner things by fill and radius, not another border. |
| 18 Sep 2026 | Rounded minimalism handoff: hairline edges, 32/22/14 radii, soft lifts. | The desk and (since 19 Oct) the whole site. `--hod-border` is 1px, never 3px ink. |
| 19 Oct 2026 | "The one on the right is better, the left is the old design language." One cohesive language everywhere. | Hard 2px ink borders and hard offset shadows survive only on `.btn-primary` and `.sticker`. Anything else carrying them is a leftover to convert. |
| 20 Oct 2026 | The opportunities fan stays (the one deliberate tilt on a content card). Phone footer compacted. | Rotation is part of the sticker motif and the tilted tiles; do not add it elsewhere. |
| 21 to 22 Oct 2026 | Delight is visual only (no new tables, no rankings of people), with an off switch. Role flow: no intermediary, tap to apply, more info on the side. Open roles as bold colour tiles. | See section 6, rows marked "owner". |

The brief changed from "UX stays" to "UX may change" when a report asks for a flow change. A report that says the
flow is too long, or that a step is in the way, is an instruction to change the flow, not a style request.

## 3. The checklist (each row is tallied in the PR)

Each row says how to check it. "grep" means `design_tally.sh` covers it; "look" means you must see it.

| # | Guardrail | Check |
|---|---|---|
| G1 | **Radii** only 999, 32 (`--r-outer`), 22 (`--r-inner`), 14 (`--r-tight`). Documented exceptions: the 6px mention mark, the 18px checkbox with a 6px corner, the 6px notched edges on the landing's jigsaw blocks. | grep |
| G2 | **Edges** are hairlines: `--hair` inside a card, `--hair-2` a card's own edge, `--hair-3` an input. No `2px solid var(--ink)`. | grep |
| G3 | **Hard offset shadow** only on `.btn-primary` and `.sticker`. Depth elsewhere is `--lift-1` at rest, `--lift-3` on hover, `--lift-4` for modals. | grep |
| G4 | **Colour only from tokens.** No new hex (3, 4, 6 or 8 digits), no `rgb()` or `hsl()` literal, no new font, no new colour name. `#F4EFE0` is paper; do not "fix" it to `#DED6C2`. Category hue is a **fill with ink text** (`background-color: var(--welfare)` is the rule, not a breach), never a hue as `color:` on cream (use the `-ink` partner). `--rust` and `--font-hand` do not exist. | grep (the accent linter is also in `npm run lint`) |
| G5 | **Contrast.** Ink on `#C4185C` is 3.42:1 (use paper, 5.03:1). Paper on grape (3.78), welfare (3.78) or teal (3.32) fails, and so does paper on every other light fill; ink passes on all of them (grape and welfare are the tightest at 4.55). Alpha ink as text on an accent fill fails (no headroom). Mono labels on saturated fills use solid `--ink`. Ratios re-measured 2026-10-22 from `tokens.css`; re-measure after any token change. | grep, then look |
| G6 | **Type.** (The script warns on a literal `font-family` and on `tabular-nums`, and fails `text-transform: lowercase`.) `--display` headlines and numbers; `--eina` sentences; `--mono` uppercase labels only; `--code` for glyphs that are the content (emails, slugs, digit columns, user text, `<select>` values); `--serif` one word, never a sentence. NeutralFace is caps-only and has no tabular figures and is wider than the old mono: after any font change compare `scrollWidth` with `clientWidth`. | look, measure |
| G7 | **Overlap.** Nothing absolutely positioned may enter the box of a heading, name or figure. Decoration gets its own track, column or row, or is `pointer-events: none` and under 8% alpha. A transformed ancestor re-parents `position: fixed`: portal any overlay (`components/Portal.tsx`). A transformed button also becomes the containing block of its stretched `::after`. | look, measure |
| G8 | **Tap targets** at least 44 by 44 on phone. Fixed-height pills set `white-space: nowrap` in the shared rule, and the row must be able to shrink (`min-width: 0`). | measure |
| G9 | **Gutters and spacing.** Blocks under `<main>` sit on `.container` (`--frame-max`, `--page-px`). No hand-rolled page padding or max-width. Sibling groups use flex or grid with `gap`, never margin-per-child. Three different gutters on one page is a defect the owner has named. | grep (max-width only), look, measure |
| G10 | **States.** Loading is a skeleton shaped like the content (never the word "loading"); empty has an action; error has a retry that re-runs the loader; offline; not found is specific; permission denied mirrors the route guard. A restyle that loses a state is a regression. | look |
| G11 | **Every mutation:** pending state, success toast, error toast (`useToast`), confirm before destructive (`useConfirm`). The toast fires after the write resolves. Services throw; the component toasts. | read |
| G12 | **Affordance.** If it is tappable it looks tappable. The primary tap on a card does the primary thing; secondary things are visible separate links ("more info"). A control that is sometimes a link and sometimes not, but looks the same both ways, is a bug. | look |
| G13 | **Flow length.** Count the taps from the page where the visitor is to the goal. Remove every intermediary (a page that only forwards, a login wall before the form, a confirm that confirms nothing). Sign-in belongs at the moment of commitment, with the typed work kept. Never remove a step that protects data or access. | count |
| G14 | **Cross-exploration.** No dead end: every surface offers at least one sideways exit into a related one. Marketing pushes are contextual (a relevant open role, drive, project), never a global banner. | look |
| G15 | **Images.** Every `<img>` goes through `sized(url, ctx)` or `Img`, with truthful `alt`. A photo belongs to the row it sits in; no photo means none. | grep |
| G16 | **Motion.** Press is `tapScale` 0.96. Lifts are `translateY(-2px)` (up to -6px on large tiles), never diagonal. Honour `prefers-reduced-motion` and the "fun effects" switch (`lib/delight.ts`). The HoD desk is motion-light. Celebrations are visual only: no new tables, no ranking of people. | grep (scale below 0.96, rotate), look |
| G17 | **Copy.** No em dashes anywhere user facing (toasts, empty states, `aria-label`s, placeholders, CSS `content`, JSON data). An en dash warns: write the range as words. No emoji as interface chrome (emoji inside frozen human copy stays). Never trim frozen copy to fit; make the component fit the copy. Counts and years come from `lib/orgFigures` and `ORG_FACTS`, never typed. **Never render a number with no source**: a zero is a claim. | grep, look |
| G18 | **Access and data.** A restyle never changes a query, a table, a column, an RLS policy or who can see what. Route gating (`ProtectedRoute`) and the desk's `superOnly` change together or not at all. | read |
| G19 | **Three systems stay separate.** `paradox/*`, `terranotes/*` and `live/*` (AquaTerra.live, its own `--lv-*` palette; owner decision 2026-10-22) have their own look and are excluded from the tally. Do not unify them. | read |
| G20 | **Do not clean up** the list in section 5. | read |
| G21 | **Cohesion test.** Put the new surface beside its two nearest neighbours at 390 and 1440. It must read as the same family (radius, edge, depth, type, motion), or the neighbour is the leftover and gets its own report. | look |
| G22 | **Bundle.** The eager budget is 683.6 KB, which is 700,000 bytes (`EAGER_BUDGET` in `frontend/scripts/check-bundle-budget.mjs` is the source of truth; `npm run budget`, part of `npm run build`). A change that needs more says so in the PR; the owner allowed up to about 25 KB. | build |

## 4. Components to reuse (do not hand-roll)

`Toast`, `Confirm`, `Modal`, `Field`, `EmptyState`, `ErrorState`, `Img`, `Reveal`, `CountUp`, `SuccessCheck`,
`LiveRegion`, `OfflineBanner`, `ImageLightbox`, `Portal`, `QuickApply`, `RoleTile`, `ApplyModal`, `GatedButton`,
`.card` / `.hod-card`, `.panel-h`, `.qrow`, `.qtag`, `.iconbtn`, `.btn-primary`, `.sticker`, `.chip`, `lib/motion.ts`,
`lib/delight.ts` (`celebrate`). Inline `style` beats the cascade and every media query: put new rules in the
route's CSS file, not in a `style` prop, unless the neighbour already does.

## 5. Things that are right and must not be cleaned up

The feed card's `headline` / `rest` word-boundary split (`LIMIT = 120`); the desk's category-scoped pending count;
`overscroll-behavior-x: contain` on the desk filter scroller; `DataToolbar`'s `actionsInline`; `eager` on the first
feed card's image; the self-versus-public profile branch on the card head; `superOnly` and `canApproveMembers`
mirroring the route guards; `hasLeaderAccess` for approvals versus `isSuperAdmin` for certificates (these mirror
RLS); no search on DriveManagement or YearbookManagement; no filter pills on Achievements or Blog drafts; access
changes never get undo toasts; per-row busy state on the desk (one action does not freeze the page); the
`/brand` specimen sheet's negative insets; the home page's 24px phone block (the logged-out intro gate); the dev
harnesses under `/dev/*` (guarded on the import, not the route).

---

# Part B. The complaint decoder

## 6. What the owner and the team have actually said, and what it turned out to mean

Real reports and reviews, from the table and from live review. Use them as the translation key.

| What was said | What it meant (found by measuring) | The rule it left |
|---|---|---|
| "this is still bad old design" (owner) | A page still used ticket-style cards, 2px ink edges, hard shadows beside new rounded ones. | G2, G3, G21: compare with the neighbour; convert the leftover. |
| "3 different gutters and paddings" (owner) | Hand-rolled wrappers (a 1100px, 20px-padded wrap beside the shared `.container`). | G9: put the page on the shared geometry. Measure insets at 390 and 1440. |
| "the hiring form is weird and glitchy" (owner, with screenshot) | A `position: fixed` overlay inside a transformed card was sized to that card. | G7: portal overlays to `body`. |
| "members of the month graphic looks horrible" | The poster's text and photo overlapped; hierarchy unclear. | G7, G6: one headline, one photo, one citation card, nothing overlapping. |
| "make the bug tracker table UI better and more self intuitive" (owner) | The same status was shown three ways (pill, three checkboxes, a column); disabled boxes needed explaining. | G12: show each fact once; one next-step button instead of three states. |
| "show openings, which teams have what, where" (owner) | The chart showed a count line, not which team is hiring for what. | G14: put the information where the decision is made (on the chart and the Teams page). |
| "openings look monotonous, some variance" (report) | Every role in a category was the same purple. | Colour from the team across the palette, pattern and tilt from the id. |
| "too long a process to get to the hiring form" (report); "apply should open the form straight away, not an intermediary" (owner) | Home to list to role page to back to the list, then login first. | G13: count taps; no intermediary; sign in at send. |
| "pressing the card opens the form, more info opens a page" (owner) | The whole card was a link to a page; the apply button was elsewhere. | G12: primary tap does the primary thing; a visible secondary link. |
| "rework this design to be more interesting" (owner, with screenshot) | Five cards in one colour, same layout, small type. | Data-driven colour, scale and a featured item (section 7, "boring"). |
| "the sticker has overflowing text that crops the home button" (report) | Text longer than the sticker box on a narrow width. | G7, G8: reserve space; test the longest real copy. |
| "images not loading, too long" / "profile taking too long" (reports) | Often nothing: images were already resized and lazy, queries about 50 ms. | Measure first (section 7, "slow"). Close as no change needed when the audit is clean. |
| "the bugs page doesn't feel interactive ... too technical ... should be clean, simple, neat, feel good" (owner, 2026-10-29) | A 4-column table with about 20 controls (stage, kind, type, lane chips, sort, group, area), internal words (lane, taken up, importance, wanted) and a stats panel for the routine. | G12, G13, G17: one status in plain words, three tabs, a card per report, the primary tap opens it, "me too" is a visible tile that responds, expert controls folded away. Page built 2026-10-29. |
| "all teams should be available as categories everywhere" (report) | A data model change, not a style. | Plan and slice (`SHEET_TRIAGE_ROUTINE.md` 8.6), additive first. |

## 7. Decoding vague words (what to measure, the usual cause, the default fix)

Never answer a vague report with a question first. Reproduce it at the reporter's `viewport_w` (and at 390 and
1440), measure, fix what is objectively wrong, and only then say what is left. Taste alone is not a defect: do
not redesign unless the report asks for a redesign.

| They say | Measure | Usual cause | Default fix |
|---|---|---|---|
| "looks bad", "ugly", "horrible" | Compare with the two nearest neighbours (G21). Overflow, clipping, overlap, contrast, spacing against the scale. | The surface is a leftover from an older language, or has an overlap or a crowded hierarchy. | Convert to the current language; one clear hierarchy (one headline, one primary action). If it is a poster or graphic, rebuild it: it is a designed object, not a table. |
| "weird", "off", "glitchy", "janky" | Scroll and resize while watching for jumps; check transformed ancestors; layout shift; focus ring; the first frame of an animation. | Fixed overlay in a transformed ancestor (G7); a skeleton that does not match the content; a hover transform that moves the click target. | Portal it; match skeleton geometry; remove the transform from the thing being clicked. |
| "old", "outdated", "doesn't match", "inconsistent" | Grep the file for the old marks (`2px solid var(--ink)`, offset shadows, off-scale radii, hand-rolled gutters). | Leftover from before 19 Oct. | G1 to G3, G9: convert, one PR per theme. |
| "boring", "plain", "monotonous", "flat" | Count distinct treatments across a row of siblings. Is colour data-driven or one value? | Every item identical. | Vary by data (team, id): colour, pattern, size; feature the first; add one considered motion (G16). Do not add decoration that carries no information. |
| "cluttered", "too much", "busy" | Count competing primary actions and type sizes in the first viewport. | Several equal-weight things. | One primary action; demote others to text links; fold optional fields behind a toggle. |
| "too long", "too many steps", "annoying to get to X" | Count taps and screens from where the visitor starts (G13). | A forwarding page, a login wall, optional fields shown first. | Remove the intermediary; sign in at the end; fold optionals. Keep protective steps. |
| "can't find", "where is", "hidden" | Is there an entry point from the page they were on (G14)? Is the label the word they use? | The feature exists but is three taps deep or is named in internal words. | Add a contextual entry; rename in the visitor's words. |
| "doesn't work", "broken", "nothing happens" | Reproduce with the harness or a test; check console and the network mock. | Disabled control with no reason (use `GatedButton`), a silent failed write (check zero-row writes), a stale chunk. | Fix, and make the failure visible (G11). A failing test that now passes is the proof. |
| "cut off", "overlapping", "text going out" | `scrollWidth` versus `clientWidth`; `getBoundingClientRect` overlap at the reporter's width and at 320. | Caps font wider than the box; absolutely positioned decoration. | Let the box grow or the text wrap (`min-width: 0`, `overflow-wrap`); G7. |
| "too small", "can't tap", "hard to read" | Tap-target size; computed font-size; contrast ratio. | Under 44px, under 14px body, or alpha text. | G8, G5. |
| "slow", "takes forever", "laggy" | Time the query (`explain`), count requests, image sizes, bundle chunk, long tasks. Check `client_error_logs`. | N+1, no limit, unsized images, a heavy eager chunk. | `limit`, an additive index, `sized()`, lazy import. If the audit is clean, close as no change needed with the numbers. |
| "alignment", "not aligned", "uneven" | Left edges and baselines of siblings; gutters (G9). | Hand-rolled widths and margins. | Put on the shared grid. |
| "colours", "too bright", "clashing" | Contrast ratios; are hues used as text; is a hue repeated or colliding? | Hue as text, a new hex, two teams on one hue. | G4, G5; use the token and the `-ink` partner. |
| "confusing", "I don't get it", "what does this do" | Can a first-time visitor name the primary action in five seconds? Count competing labels and unexplained words (G12, G13, G17). | Internal vocabulary, two equal-weight actions, or a control whose result is not visible. | One primary action, the visitor's own words, a visible result (toast, state change). Do not add a tutorial. |
| "empty", "blank", "nothing shows", "no data" | Load the surface with no rows, a slow network and an error (G10). Is the empty state the final state by mistake? | A skeleton that never resolves, an RLS read that returns zero rows, a filter that hides everything. | Show the right state (skeleton, empty with an action, error with retry); if it is a permissions read, say so in the note rather than patching the UI. |
| "jumps", "flickers", "shifts", "moves when I scroll" | Layout shift on load (image without a size, late font, content above arriving late); a fixed element in a transformed ancestor (G7). | Unsized media, a skeleton of a different height, a sticky or fixed bar. | Reserve the space (`aspect-ratio`, `sized()`); match the skeleton; portal the overlay. |
| "on my phone", "small screen", "zoom", "tablet" | Open it at the reporter's `viewport_w`, at 320, and with browser zoom 200% (text must not clip or scroll sideways). | Fixed widths, a 2-column grid that never collapses, text in a box sized for another font. | `min-width: 0`, wrap, a one-column fallback under the breakpoint (G7, G8, G9). |
| "make it like X" with a reference image | Name what the reference does that ours does not: layout, scale of type, colour use, hierarchy, affordance. | The owner wants a feeling, not a copy. | Take the structure and the energy; keep our tokens, type and radii. Never copy a brand's marks. |
| "add a feature" with no detail | Which user flow does it touch (`USER_FLOWS.md`)? Who is the user? | A real missing step. | Smallest reversible reading; `Assumed:` in the PR; plan and slice if large. |

## 8. Reading a screenshot

A screenshot is evidence of one moment on one device. Read it in this order and write down what you saw before
deciding anything.

1. **Where:** the page path and `viewport_w` / `viewport_h` on the report; the device from `user_agent` (a 390 or
   402 wide viewport is a phone, 1470 to 1536 a laptop). Open the same route at that width.
2. **What is circled, arrowed or highlighted:** that is the complaint. If nothing is marked, the subject is the
   most visually dominant broken-looking thing, or whatever the description names.
3. **Inventory:** list the elements in the picture (headline, cards, buttons, images) and for each note what is
   wrong in measurable terms: clipped, overlapping, uneven spacing, off-palette, low contrast, wrong size,
   misaligned, an empty or loading state shown as final.
4. **Look for the three screenshot-only defects:** a stale cache (the owner once reported a design that was
   already fixed: confirm on a hard refresh before building), a state the harness cannot show (loading, error,
   long copy), and a page that is behind a role (reproduce with `?dev=member|hod|director|super_admin`).
5. **Reproduce, then compare** with the neighbour (G21). If your render does not show the defect, say so and say
   what differed (width, state, data length). Try the reporter's width, 320, and with long real-looking copy.
6. **Write the finding as measurements** in `resolution_note` or `needs_info_note`: "title overflows by 14px at
   402", not "looks off".

How the routine gets the image: each report carries `screenshots` paths and a private `read_token`; the routine
downloads each through the `bug-shot` function (see `SHEET_TRIAGE_ROUTINE.md` section 7.4) and opens the file with
the Read tool. If the host is not reachable from the environment, do the page-facts audit above and say the
picture was not read. A screenshot may contain a person's face or name: never copy it into a commit, PR or
fixture, and never describe a person in a note.

## 9. When asked to design something new

1. Read the report as a job to be done: who, where they start, what they want to end up doing.
2. Find the nearest solved neighbour and the highest-energy surface of the same kind (the owner's taste runs to
   bold, full-colour, rounded, playful, intentional; it does not run to ornament, dense tables or timid greys).
3. Build one considered design, not three. Use data to create variety (team, id, count), not random decoration.
4. Make the primary action unmistakable and one tap away; fold the optional.
5. Check every state (G10), both widths, the long-copy case, reduced motion, and the tally (section 1).
6. Look at the screenshots yourself. A passing script is not a design review. Then ask: would the owner say "the
   one on the right is better"? If you would not, it is not done.

## Changing this file

Add a row to section 6 whenever an owner correction or a reopened report teaches something, with the date. The
routine proposes additions through a normal PR; it does not weaken a rule here to make a change pass.
