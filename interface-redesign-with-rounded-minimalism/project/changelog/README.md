# AquaTerra UI Redesign — Implementation Changelog

**Target repo:** `kaxx4/vercelaq` · branch `main` · working dir `frontend/`
**Design source:** `AquaTerra Feed.dc.html` in the design project (options `1a` phone, `1b` desktop, `1c` card diff)
**Nature of change:** UI only. UX, information architecture, copy, routes, Supabase queries and service layer are **unchanged**.

---

## How to use these files

Each numbered file is **self-contained**. It repeats every shared rule it depends on, so you never
need to hold two files in your head. If a rule appears in two files, the two statements are identical
by construction — if they ever disagree, `00-global-tokens-and-primitives.md` wins.

Each instruction is one of four kinds, and the verb is always literal:

| Verb | Meaning |
|---|---|
| **SET** | change an existing declaration's value. The old value is given so you can confirm you found the right one. |
| **DELETE** | remove the declaration, rule, element, prop or file entirely. Nothing replaces it. |
| **ADD** | introduce a declaration, rule or element that does not exist today. |
| **KEEP** | do not touch this. Listed explicitly because it looks like something the pass would have changed, and a previous handoff changed it by mistake. |

**Do not exercise design judgement.** If an instruction does not cover something you can see on the
screen, it is deliberate — leave it exactly as it is and note it at the bottom of the file under
"Unresolved". Do not extrapolate a rule to a surface it does not name.

**Do not touch `src/paradox/**`.** The Paradox event sub-app has its own theme
(`src/paradox/tailwind.css`, `src/paradox/paradox.css`) and is out of scope for every file here.

---

## Order of work

Work strictly top to bottom. `00` must land and be visually verified before `01` starts, because
`01` assumes the new tokens resolve.

| # | File | Scope | Status |
|---|---|---|---|
| 00 | `00-global-tokens-and-primitives.md` | `styles/tokens.css`, `styles/v6.css` primitives, `index.css` | **ready** |
| 01 | `01-home-feed.md` | `public/HomePage.tsx`, `feed/FeedPostCard.tsx`, `styles/routes/home.css`, `styles/routes/feed.css` | **ready** |
| 02 | `02-global-chrome.md` | `components/AQNav.tsx` + `.css`, `components/MobileMenuBar.tsx`, `styles/routes/nav-mobile.css`, `components/AQFooter.tsx` + `.css`, `styles/footer.css` | **ready** |
| 03 | `03-post-detail-and-compose.md` | `feed/PostPage.tsx` + `.css`, `feed/post/*`, `feed/CreatePostModal.tsx`, `components/PostFocusModal.tsx` | **ready** |
| 04 | `04-profile.md` | `profile/*` (10 files), `styles/routes/profile.css` | **ready** |
| 05 | `05-teams.md` | `teams/*`, `teams/detail/*` | not designed |
| 06 | `06-hod-desk.md` | `director/DirectorDashboard.tsx` + `.css`, `director/DirectorLanding.tsx`, `styles/routes/director.css`, `director/adminKit.tsx` | **ready** |
| 07 | `07-onboarding-and-auth.md` | `auth/*`, `public/OnboardingPage.tsx`, `public/JoinPromoPage.tsx` | not designed |
| 08 | `08-search-notifications-saved.md` | `search/SearchPage.tsx`, `feed/NotificationsPage.tsx`, `feed/SavedPostsPage.tsx`, `feed/MyPostsPage.tsx` | not designed |
| 09 | `09-marketing-pages.md` | `public/AboutPage.tsx`, `BlogListPage`, `BlogPostPage`, `MembersPage`, `RootsPage`, `SchoolsPage`, `ClassesPage`, `FAQPage`, `SupportPage`, `ContactPage`, `QuickLinksPage`, `CollaborationsPage`, `EquityPolicyPage`, `PrivacyPolicyPage` | not designed |
| 10 | `10-projects-and-opportunities.md` | `public/PublicProjectsPage.tsx`, `PublicProjectDetailPage`, `OpportunitiesPage`, `OpeningDetailPage`, `styles/routes/projects.css` | not designed |
| 22 | `22-social-engine.md` | The eight social surfaces. **22.1 (the post pending state) is a duty, not a feature — build it first** | **ready** |
| 21 | `21-org-facts.md` | Every public statistic computed from Supabase. **Buildable first, independently of the redesign** | **ready** |
| 11 | `11-system-states.md` | `components/EmptyState.tsx`, `ErrorState.tsx`, `Alert.tsx`, `Toast`, `Confirm.tsx`, `ErrorBoundary.tsx`, skeletons | not designed |
| 12 | `12-calendar-drives-yearbook.md` | `calendar/CalendarPage.tsx`, `drives/*`, `yearbook/YearbookPage.tsx` | not designed |

**A file marked "not designed" has no design behind it yet. Do not begin it. Do not infer it from
`00`.** Those surfaces keep shipping their current UI until their file says "ready".

### Foundation files (built first, everything else inherits them)

| # | File | Covers | Status |
|---|---|---|---|
| 13 | `13-sticker-system.md` | 8 silhouettes, 2 keyline modes, arc-set seals, glyph marks, hash-stable rotation | design done (turn 11), file pending |
| 14 | `14-footer.md` | Parallax wall, activity band, link row, **the Paradox banner fix** | **ready** |
| 15 | `15-post-cards.md` | All 30 shapes restyled **inside `feedShape.ts`**; 8 live, 12 blocked and recorded | **ready** |
| 17 | `17-desk-nav-and-stats.md` | Three-tier desk nav (supersedes `06.3`) + the jigsaw stats block (replaces `06.4`'s stat grid) | **ready** |
| 05 | `05-teams-and-openings.md` | Teams grid + headline lockups, team detail, the fanned openings, apply flow | **ready** |
| 07 | `07-auth-and-contact.md` | The underline field + its error state (used by every form), contact, auth with the seeded art panel | **ready** |
| 08 | `08-search-saved-notifications.md` | Search IA + the two-detent ink sheet, saved, notifications, directory hub | **ready** |
| 13 | `13-sticker-system.md` | The 8×7×3 sticker system. **Build this first — everything else depends on it** | **ready** |
| 19 | `19-guided-demos.md` | Eleven coach-mark walkthroughs on the real UI, sandboxed. **Build last** | **ready** |
| 18 | `18-mascots-and-motion.md` | The three existing mascots as roaming companions, the bone mechanic, and the once-per-session burst | **ready** |
| 16 | `16-profile-wall.md` | **The one new feature.** `profile_notes` + `wall_enabled`, soft delete, the pinboard, and the off-switch on the empty state | **ready** |
| 10 | `10-projects.md` | Archive masonry with shape-by-data tiles, sticky rail, scroll-revealed search; drive detail as stacked bands | **ready** |
| 09 | `09-about.md` | About rebuilt as a manifesto, written to `docs/BRAND_VOICE.md`. **The one file that changes copy.** Six stats blocked | **ready** |

### Companion documents

Two documents sit alongside the numbered files. **Neither is a build instruction.**

- \`UX-GAPS.md\` — affordances, success and error states, and a list of things that are already
  right and must not be "cleaned up" by a redesign pass. Read the last section before you delete
  anything that looks redundant.
- \`SOCIAL-ENGINE.md\` — a plan for feed ranking, composer, comments, recognition, notifications,
  discovery and outward sharing, with the cost of each named (design only / query change / new
  table). Nothing in it is specced until the questions at its end are answered.

### The overlap rule — this defect class appeared three times, so it is now a rule

**Nothing absolutely positioned may enter the box of a heading, name, or figure.**

It happened three times in this project and the fix was the same every time:
- **`7a`** — a circular portrait absolutely positioned beside a name painted over its last
  characters. Fixed by making the portrait a **flex sibling that reserves its own width**.
- **`8a`** — cluster badges placed at fixed offsets around a headline collided with it (one badge
  100% hidden), because the headline is auto-height and reflowed. Fixed by making the badges
  **static grid children**.
- **`12a`/`12b`** — opaque footer stickers painted over the CTA headline on **all 22 public
  routes**. Fixed by giving plane 0 its own **grid track** on desktop and its own **row** on phone.

**Why raising the text's `z-index` is the wrong fix:** in one stacking context a positioned
element always paints above a non-positioned sibling regardless of DOM order, so a static heading
can never win — and lifting the heading above an *opaque* fill is equally unreadable. **The only
reliable fix is reserved space.**

**So, when you build any of these:** the profile portrait, the directory cluster, the footer wall,
the teams header lockups, the search category discs, the fanned hiring cards, the pinboard wall,
or the load animation — **decorative objects get their own track, column or row.** If a decorative
element must sit over type, it has to be `pointer-events: none` **and** under 8% alpha (the ghost
wordmark at 5% is the only compliant case in the whole design).

### Shape-by-data is now a product-wide principle, not a card trick

`feedShape.ts` chooses a **card** shape from what a row holds. `10.0` applies the same rule to the
**archive**: photo + statistic → tall photo tile; statistic alone → cream well tile; short body →
serif quote tile; a blog link → ink link tile.

**The consequence to hold onto: a row with no photo is a designed state, not a fallback.** That is
why the cream well tile exists, and it is why a title must never live only on top of an image — a
failed image would take the title with it.

### The underline field is the product's only input

`07.0` defines `.aq-field` — underline-only, 17px, mono uppercase label, `border-radius: 0`, and
**the error state that `00.10` deliberately left unwired.** It replaces boxed inputs on contact,
auth, apply, the composer's detail panel, edit-profile and every desk editor.

**Two things in it are not style choices:**
- **Validate on blur and submit, never on keystroke.**
- **`--danger-lift: #FF6B4D` is the one new colour in the entire redesign**, because `--danger`
  measures 4.1:1 on ink and fails. On cream, errors use `--tomato-ink`. Nothing else was added.

Lift the validation logic from `CollaborationsPage.tsx` — it is the only form in the product that
already does per-field errors correctly. Restyle its output; do not write a second pattern.

### One sheet component, two callers

`08.3` (search filters on phone) and `17.1` (the desk's collapsed navigation below 1024px) are the
**same `.aq-sheet` component**. Build it once, in a shared location, with the two-detent behaviour,
the grabber-as-button, the focus management and the reduced-motion path.

If you end up with two bottom sheets, one of them is wrong.

### Build order

`13` (stickers) **first** — nine surfaces depend on it. Then `00` tokens, `02` chrome, then any
page file. `19` (demos) **last**, because it demonstrates the redesigned UI and cannot be built
against the old one.

### Fixed width + padding = overflow. Always set `box-sizing`.

**Found in the "new this week" strip (`22.3`), and it is a whole class:**

A card declared `width: 96px` with `padding: 12px 10px` under the default `content-box` **actually
occupies 116px.** Three of them plus two 8px gaps came to 364px in a 336px row. Because the row was
`overflow-x: hidden`, the third card was **clipped and unreachable** — and its `Say hi` button was
the entire reason the section existed. At the specced cap of 6 cards, three would have been
invisible.

**The rule, both halves:**

1. **Any element with an explicit `width`/`height` AND padding or a border must declare
   `box-sizing: border-box`.** Do not compensate by reducing the width — the next person to change
   the padding reintroduces the bug.
2. **A horizontal strip of fixed-width children is `overflow-x: auto`, never `hidden`.**
   Add `scroll-snap-type: x proximity`, `scroll-snap-align: start` on children, and
   **`overscroll-behavior-x: contain`** — without the last one a swipe triggers back-navigation and
   loses in-progress state, which is why `06` already applies it to the desk's filter scroller.

**How to verify, because a clipped card at the right edge of a 390px frame is nearly invisible:**
compare `scrollWidth` to `clientWidth` in the DOM. **Do not eyeball a screenshot.**

**Do not "fix" a row whose overflow comes only from an absolutely-positioned decorative child** —
a bleeding circle clipped by `overflow: hidden` is the intended effect. Distinguish them by
measuring whether any *in-flow* child extends past the container's right edge.

### There is a brand voice bible, and it outranks your instincts

`docs/BRAND_VOICE.md` (29KB) is the org's source of truth for public copy: five personality
traits, a sounds-like/never-sounds-like table, four typographic registers mapped to voice jobs, a
canonical facts sheet with conflict verdicts, and a §7 list of internal material that must never
be published.

**Read it before writing any public-facing string.** Two rules from it bind every file here:

- **§3: never invent, round up, or "improve" a number.** Six stats are flagged
  **NEEDS HUMAN CONFIRMATION** and that flag is **blocking** — leave the stat out rather than
  guess. `09-about.md` §09.0 lists all six.
- **§1.2's hard don'ts:** `empower`, `noble mission`, `underserved`, `make a difference`,
  `synergy`, `holistic`, emoji spam, guilt framing, and any sentence that would fit any NGO on
  earth. **The bulk copy approval does not override these.**

### The card system is not ours

`01-home-feed.md` was written before I found `lib/feedShape.ts`. **`15-post-cards.md` supersedes
`01.15` on anything about card shape or which card renders.** `01` still governs the feed page's
layout, rails, filters and greeting; `15` governs the cards inside it.

**Where they conflict, `15` wins**, because `01.15` describes a photo-led card that the `posts`
table cannot fill.

### Cross-file coordination points

Two instructions depend on each other and will produce a defect if only one lands:

- **\`01.16\` keeps \`.feed-mobile-fab\`; \`02.6\` deletes it.** Compose moves into the bottom nav.
  If \`01\` ships without \`02\`, the phone has both a FAB and no bar compose button — fine. If \`02\`
  ships, the FAB must go. Do not leave both.
- **\`04.7\` reuses \`.feed-card-cat-float\` from \`01.15.3\`.** One floating category pill component,
  used by the feed card and the public profile's post grid. Do not fork it.
- **\`03.5.2\` and \`01.15.9\` both touch the comment renderer.** They must produce ONE \`.aq-comment\`
  bubble used by both the detail page (inline) and the feed card (sheet). If you end up with two
  comment components, one of them is wrong.
- **\`03.4\` puts a sticky reply bar on the phone detail route where \`02.6\` puts the bottom nav.**
  Only one may render. The reply bar wins on that route.
- **\`06\` deletes \`.torn-divider\` and \`.adm-tape\`; both are \`.admin\`-scoped** and may have callers
  in per-desk files this set does not cover. Grep before deleting, and report any caller you find in
  a file marked "not designed".
- **\`01.5\` / \`01.8\` / \`01.9\` / \`06.4\` all introduce \`is-hero\` and a \`::after\` bleeding circle.** The
  rule is **one hero per card**. If you find two \`is-hero\` elements inside one \`.rail-card\`, one of
  them is a bug.

---

## Global invariants for every file

These hold for the whole redesign and are restated at the top of every numbered file.

1. **No new colours.** Every hex used is already in `src/styles/tokens.css`. If a rule seems to
   need a colour that is not there, stop and ask — do not add one.
2. **No new fonts.** NeutralFace, Eina01, JetBrains Mono, Instrument Serif. No weights beyond
   those already self-hosted in `public/fonts/`.
3. **No copy changes.** Every user-facing string stays byte-identical, including lowercase and the
   trailing period on page titles.

   **How to read a string instruction in these files.** There are exactly two forms, and the
   difference matters:

   - **A quoted string** (`+ request a certificate`, `on a break until {date}`) was **read verbatim
     out of the source file named in that section.** You can type it exactly.
   - **"KEEP whatever string ships today"** means the string was **not** read. **Open the file, use
     what is there, and leave it byte-identical. Do not retype it from this document.**

   **Copy shown in the design mocks is illustrative unless a changelog section quotes it.** The
   mocks needed plausible sentences to lay out; several are invented. Each file lists the ones it
   invented under *"A note on strings"* so you can recognise them. If you find yourself renaming a
   real control to match a mock, stop — that is invariant 3 being broken, and the mock is wrong,
   not the product.

   **If an instruction quotes a string and the file disagrees, the file wins.** Report the
   mismatch; do not reconcile it by editing either one.

   **Bulk copy approval, 2026-09-05.** Every string these files mark as *"invented by the mock,
   needing approval"* is **approved and cleared to ship**. The per-file "A note on strings"
   sections stay as a record of which strings are new, but they are no longer a blocker.

   **The approval covers strings I invented. It does NOT authorise changing a string that already
   ships** — that is still invariant 3. Where a file flags an existing string as a suspected bug
   (e.g. the gendered `Wish her` in `15.4`), **raise it; do not fix it.**
4. **No route changes.** No path added, removed or renamed.
5. **No Supabase changes.** No table, column, RLS policy, query, filter, `select()` list, service
   function signature or return shape is touched. If a UI change appears to need a new field, stop
   and ask.
6. **No new dependencies.**
7. **Accessibility floors hold or improve.** Hit targets stay >= 44x44 (documented 38–42px
   exceptions are named at their call sites). Text contrast stays >= 4.5:1, or >= 3:1 for type
   >= 24px. `:focus-visible` stays `3px solid var(--grape)` at `outline-offset: 2px`.

   **Paper-on-ink text uses a six-rung ladder, all six measured.** Pick a rung; do not invent an
   alpha between them, and do not sweep existing values that already sit on a rung.

   | token | alpha | ratio on `--ink` | for |
   |---|---|---|---|
   | `--nav-fg` | 1.00 | 15.6:1 | primary label, active glyph |
   | `--nav-fg-strong` | 0.82 | 10.1:1 | nav link + rail item labels |
   | `--nav-fg-dim` | 0.78 | 9.4:1 | inactive label |
   | `--nav-fg-mid` | 0.72 | 7.9:1 | icon glyphs, dock buttons |
   | `--nav-fg-soft` | 0.60 | 6.5:1 | secondary meta |
   | `--nav-fg-faint` | 0.55 | 5.6:1 | **the floor for text on ink** |

   **For the record, because an earlier draft of this file got it wrong:** alpha 0.50 measures
   **4.78:1 and passes** 4.5:1; the true failure boundary is near **0.47**. So a 0.50 you find in
   the codebase is *not* an accessibility bug and does not need fixing — it is simply not a named
   rung, so **do not introduce new ones.** The values that genuinely fail and are corrected by
   these files are **0.45 (4.05:1)** and **0.38 (3.20:1)**.

   `rgba(244,239,224,0.20)` and below are **non-text only** — rules, wells, button grounds.

   On cream, the muted text floor is `--ink-3` (#5A5A55, 4.6:1) — never a raw alpha of ink.
   `rgba(10,10,10,0.35)` measures 2.30:1 and fails.

   **Text on a saturated accent fill is ALWAYS ink. No exceptions.** Measured, ink on each:

   | fill | ink on it | paper on it |
   |---|---|---|
   | `--lemon` #FFC700 | 15.1:1 | fails |
   | `--sky` #3DA9FC | 9.4:1 | fails |
   | `--tomato` #FF4D2E | 6.7:1 | fails |
   | `--pink` #FF4D8C | 6.4:1 | fails |
   | `--ops` / teal #12909C | **5.18:1** | **3.32:1 FAIL** |
   | `--grape` #7E5BFF | **4.55:1** | **3.78:1 FAIL** |
   | `--welfare` #1B8A5A | **4.55:1** | fails |

   Grape and teal are the palette's two darkest accents, so they are the only ones where the
   instinct to use paper text arises — **and both fail.** Ink passes on all seven.

   **Text on an accent fill is FULL-OPACITY `var(--ink)`. Never an alpha of it.**

   This is the third prohibition and it is the one that was missing. Welfare and grape sit at
   **4.55:1 — 0.05 above the floor** — so:
   - **do not lighten the fill**
   - **do not reduce the text weight below 700**
   - **do not reduce the text's alpha.** `rgba(10,10,10,0.7)` on welfare measures **3.28:1** and on
     pink **4.17:1**. Both fail. The first two prohibitions were written down; this one was not,
     and 13 instances were built failing as a direct result.

   **A translucent dark overlay counts as lightening the fill.** `rgba(10,10,10,0.1)` over welfare
   composites to `#197d52`, and ink on that measures **3.87:1**. Use paper text on such a pill, or
   a hairline border with no fill.

   **The same applies in reverse on ink.** The six-rung ladder above is exhaustive: **0.55 is the
   floor and 0.45 measures 4.06:1.** Placeholder text and field labels are **not exempt** — they
   are the text a user reads while typing.
   Paper text is legal on exactly one accent-derived colour: `--grape-ink` #6B44E8 (5.05:1) — and
   **ink on `--grape-ink` is 3.41:1 and fails**, so the two are not interchangeable. Hit targets stay >= 44x44 (the documented 40px feed-footer
   exception is called out where it applies). Text contrast stays >= 4.5:1, or >= 3:1 for type >= 24px.
   `:focus-visible` stays `3px solid var(--grape)` at `outline-offset: 2px`.
8. **`prefers-reduced-motion` coverage does not regress.** Any animation you delete, also delete
   from its reduced-motion block. Any animation you add, add to one.
9. **Delete dead CSS you are told to delete.** Several rules below are removals with no replacement.
   Leaving them in place is the main way past handoffs drifted.
