# AquaTerra redesign — guardrails

**Read this before writing a single line on the redesign.** It is the distilled,
non-negotiable layer. The long form is
`new aq website/mobile-first-responsive-redesign/project/github.md` (constraint
manifest) and `docs/CHANGELOG-REDESIGN.md` (34 sections, 468 steps).
Progress lives in `REDESIGN_EXECUTION_PLAN.md`.

`HANDOFF_PORT_PLAN.md` is **SUPERSEDED** (user decision, 2026-09-03). Its rule
"current visual system stays, only UX ports" no longer applies.

---

## 0. The standing design intent (user, 2026-09-03)

**The one-line brief, in the user's words:** *"UX stays the same. UI completely
changes."* Same fonts, same colours, same copy, same flows. What changes is how
it looks and feels: from dated to alive, fresher and cleaner, modern without
reading as AI slop, rounded, mobile-centric but never at the desktop's expense.
Sections may be re-cut; the underlying journey may not.

**Corollaries, all binding:**

- **Never break the Supabase wiring.** Not one query, `.from()`, column or RLS
  policy changes for visual reasons. See rule 8 below.
- **Every UX flow, affordance, success state and error state must survive the
  restyle.** A restyled screen that lost its error state is a regression, not a
  redesign. Audit the four before declaring a section done: happy path,
  affordance visibility, success feedback, failure feedback.
- **Consolidate.** Where the same thing is styled five ways, it becomes one
  shared rule. Where a value is hardcoded in twelve files, it becomes a token.
- **Write the changelog as you go.** `REDESIGN_CHANGELOG.md` records every
  change page-wise with an exact before → after, including removals. It is
  written for an implementer who will not exercise design judgment, so
  "increased the rounding" is not an entry; "`.aq-bottom-bar-pill`
  `border-radius` 22px → 999px" is.

Four things every surface must earn, not just the ones a section names:

1. **Design with intent.** Every element answers "why is this here, on this
   screen, at this size." If it cannot, delete it. A rule stated in prose must
   be true on the page — six defects on this project were prose asserting
   behaviour that shipped in one place only.
2. **Explicit affordances.** If something is tappable, it must look tappable.
   The recorded failures are exact: a row number that is a `wa.me` link only
   when a phone exists, with no visual difference; an expand control at the end
   of a run-on secondary line; a live combobox hidden in a data slot. Every
   desk section carries an "affordance ledger" appendix for this reason.
3. **Cross-exploration.** No screen is a dead end. Every surface offers a
   sideways move into a related surface (a project → its team → its members →
   their drives). The AQ map (section 30) is the systematic form of this; every
   other page owes at least one lateral exit.
4. **Contextual marketing pushes.** Public and member surfaces carry a
   contextually-placed invitation, not a global banner: the join CTA, an open
   role, a Labs project, a drive to sign up for. It must be relevant to what
   the reader is already looking at. The rejected `AQ Home B` console home is
   the counter-example: a permanent nudge and a quick-action row, both refused.

---

## 1. Never do these

| # | Rule | Why it exists |
|---|---|---|
| 1 | **Ink on `#C4185C` is 3.42:1.** Paper on it is 5.03:1. Every other palette hue clears 4.5:1 with ink at 9px. The branch belongs **in the component**, never patched per instance. | Broken and re-fixed five times |
| 2 | **A photo belongs to the row it sits in.** Empty `main_image` means no photo on that card. Truthful alt text does not fix wrong placement. | Broken three times |
| 3 | **Never trim frozen copy to fit.** A shortened string that still reads complete is worse than a clipped one. If it does not fit, the component is the wrong size. | — |
| 4 | **Never render a figure with no source.** Use a dashed `live` marker. A zero is a claim. | `1,247` was an invented member number that spread to seven places |
| 5 | **Read the component before restyling it.** | `AQNav.tsx` and `MobileMenuBar.tsx` were invented from memory twice |
| 6 | **Count before asserting a universal about a table.** | "Every post is welfare / by the org account / one body shape" was generalised from six sampled rows. All three false |
| 7 | **No em dashes in user-facing copy** — anywhere, including toasts, empty states, `aria-label`s, validation, placeholders. Exception: the 85 member-authored post bodies that end in an em-dash byline. | Project rule |
| 8 | **Do not change any Supabase query, table, column, RLS policy or `.from()` call** unless a step says so explicitly. | The redesign is UI |
| 9 | **A `.includes()` guard on a substring the replacement preserves is not an idempotency check.** | It duplicated a sticker |

## 2. Layout and type mechanics

- **Fixed-height pills need `white-space: nowrap`.** Any pill with an explicit
  `height` and `border-radius: 999px` must set it. Put it in the shared
  `.chip` / `.pill` / `.sticker` / `FilterPill` rules, never per instance.
  1,566 pills across 25 design files were hardened in one pass.
- **`nowrap` removes give, so the row must shrink.** Flexible children get
  `flex: 1 1 auto; min-width: 0`; drop spacers; never leave a control
  `flex: 0 0 auto` at the end of an overflowing `nowrap` row. This shipped as an
  unreachable "Clear selection" button immediately after the pill hardening.
- **NeutralFace is caps-only.** No lowercase glyphs. Lowercase display type is
  Eina01 800 or Instrument Serif italic. Never `text-transform: lowercase` on it.
- **Mono labels on saturated fills use solid `var(--ink)`, never an alpha.**
  `rgba(10,10,10,.6)` on welfare green is 2.79:1.
- **Sibling groups use flex/grid with `gap`.** Never margin-per-child, never
  whitespace-as-spacing.
- **Tap targets ≥ 44×44 on phone.** Two documented exceptions, both from
  `director.css`: a desk row's inline action cluster may go below 44px at
  `>= 601px` (mouse-driven; `AdminRowActions` collapses it to one 44px button
  plus a sheet on phone), and non-interactive chrome has no minimum.
- **Photos are concentric.** Inset 8px inside a radius-26 card → photo radius 18.
  Tokens: `--r-card: 26px`, `--r-photo: 18px`.

## 3. The token layer (live state after section 01)

```
radius   --r-sm 20  --r-md 28  --r-lg 40  --r = --r-md  --r-pill 999
         --r-card 26  --r-photo 18        (was 6 / 14 / 22)
shadow   --shadow-cta 1.5px 1.5px 0 0 rgba(10,10,10,.5)
         primary CTAs, stickers, ONE hero card per screen.
outline  BY LAYER DEPTH (2026-09-09 ruling — resolves the 09-05 note that
         "2px ink border on everything" contradicted the verbal brief
         "outline for emphasis, not everywhere"; owner picked this of the
         three built at /dev/variations, dev-only route, kept for reference).
         The FRAME keeps --bd (2px ink) — a card as a whole, a table wrapper,
         a grouped-rows container. Content INSIDE that frame drops the
         outline — a category tag, a photo, an individual row — and
         separates by fill/radius alone against the frame's own paper.
         Frame vs. contents decides it, not the element type. The primary
         CTA keeps --bd regardless (it's already covered by the shadow rule
         above). NOT YET applied to the live site outside /dev/variations —
         every real card/table/chip-group still carries the old
         border-on-everything rule; re-skinning them to match is a separate,
         larger pass.
aliases  --rust = --danger #C4231A   (NOT --tomato: 3.31:1 fails AA)
         --paper-dark = --bg-3 #E2D9BD
```

**Do not add colours or fonts.** Everything comes from `styles/tokens.css`.
Fonts are NeutralFace, Eina01, JetBrains Mono, Instrument Serif, Caveat only.
Icons are `@heroicons/react/24/outline` only — 20px in nav and dock, 14px inline
in meta rows, `strokeWidth` 1.8 inactive / 2.5 active. If heroicons lacks it,
use a text arrow. `v6Shared` exports no hamburger; use `I.more`.

**Paper is `#F4EFE0`, the live value.** `docs/HANDOFF.md` says `#DED6C2`; that is
the design tool's canvas backdrop, not the product page. Counted across the 42
canvases: `#F4EFE0` 1,089 uses, `#DED6C2` 78. Do not "fix" the page to `#DED6C2`.

**Breakpoints: three tiers.** phone `<= 600`, tablet `601–1024`, desktop `>= 1025`.
Adopted per section as steps name files. One deliberate exception: the mobile
dock still switches at 760px, because moving it to 600 would leave tablets with
no bottom navigation and no step asks for that.

## 4. Data facts that are easy to get wrong

- **Departments are not categories.** `lib/departments.ts` has EIGHT entries,
  each with a **literal** colour token. `CAT_COLORS` has five keys, and five
  keys for eight departments collided three onto teal and two onto grape.
  Never derive a department colour from its category, and never derive a route
  from a department label: Crftd, AQ.Ventures and ShikshAQ are all `labs`;
  Collabs and Human Resources are both `operations`.
- **Five separate category-colour sources, all deliberate, never merge them:**
  `lib/uiHelpers.CAT_COLORS` (post moderation), `lib/jobOpenings.CAT_COLORS`
  (openings), the `--c-*` custom properties (CategoryManagement, PostModeration
  stamps), `OBJ_COLORS` in `lib/supabase.ts` (projects desk objectives, live),
  and `lib/departments.ts`. `DEPT_COLORS` in `lib/supabase.ts` is drifted and
  dead for categories.
- **Canonical public figures** (only these may be written into a design):
  1,200+ members, 550+ projects, 3,500+ kids, 15,000 bananas, 4,000+ saplings,
  Paradox 3.0 at ₹1L+ with 300 attendees, ₹0 donations, 8 departments,
  DARPAN `AAFTT2300ME20251`, launched 11 June 2021 with 16 students.
  Everything else is a dashed `live` marker sourced at render.
- **Build-time context, never copy:** 1,370 member rows (1,317 active, 49
  pending, 4 rejected), 586 published posts (welfare 523 / events 26 /
  content 37, three hues on the feed), 2,031 drive rows, 7 Labs projects,
  16 super_admin against 1 hod.
- **`members` row 1143 is the org account itself** (`AquaTerra`,
  `official@ngoaquaterra.com`, super_admin), not a volunteer. Never attribute
  hours, points or drive attendance to it.
- **SLA copy lives in `lib/orgFacts.ts` and must be imported, never retyped.**
- **Schema already has** `members.birthday` + `birthday_public` (an opt-**in**;
  null means private) and `break_start` / `break_end` / `break_reason` (so one
  break at a time, not a history). `members.member_no` does **not** exist.

## 5. The HoD desk is not a poster

`adminKit.tsx` states the rule: **chrome is brutalist, data is legible.**
Rotation, stamps, torn edges and hard shadows are chrome only; row content stays
flat and unrotated. The 17 desks take **only the radius pair and the sticker
keyline** from the poster system, and they land **last**.

Desk specifics that are load-bearing:
- **Access changes never get undo toasts** — a role change takes effect
  server-side immediately, so there is nothing to cancel. Three explicit
  confirms stay. PostModeration's approve *is* an undo toast and legitimately
  so: the call only fires when the window closes, making undo a cancel.
- **Per-row busy, not desk-wide**, on DirectorManagement, CategoryManagement,
  SopManagement, HiringResponses and FormResponses. Each froze the whole page
  once. Only the acting row dims.
- **Writes that can be silently denied need `.select()` plus a zero-row check**:
  ProjectManager (all four paths), FormResponses, TeamManagement's update.
  PostgREST returns no error and zero rows when a write matches nothing.
- **No search on DriveManagement or YearbookManagement, by design.** Do not add
  it for symmetry; `adminKit` must render a searchless toolbar.
- **Achievements and Blog drafts have no filter pills at all**, only search.
  Adding them hides work from the person clearing the queue.
- **Emoji rule:** emoji inside frozen human copy stays (the 🎉 in the WhatsApp
  invite a director pastes). Emoji used as interface chrome becomes a heroicon.

## 6. Verification gate

A section is not done until:
1. `cd frontend && npx tsc -b && npm run build` is clean.
2. `npm test` passes when a covered file is touched (`lib/roles.ts`,
   `lib/imageUrl.ts`, `lib/profanityFilter.ts`).
3. The section's screens are opened in the integrated browser against the local
   vite dev server and visually checked — not the build alone (user decision).
4. `REDESIGN_EXECUTION_PLAN.md` is updated.
5. Every prose claim the section makes is grep-verified true on the page.
