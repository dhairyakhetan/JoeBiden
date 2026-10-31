# AquaTerra redesign — the complete map

Written 2026-09-05. This is the master plan: every surface, state, component, flow and
variation, plus where each piece of your inspiration lands. Nothing here is a build
instruction — the numbered files in `changelog/` are. This document exists so that nothing
gets forgotten and so we can agree an order.

**Legend**
- `DONE` designed and written into a changelog file
- `DESIGNED` in the design doc, changelog not yet written
- `MAPPED` inspiration assigned, not yet designed
- `TODO` needs designing, no inspiration given — I extend the language
- `NEW` a feature that does not exist yet
- `BLOCKED` needs a decision or an asset from you

---

# PART 1 — Where your inspiration lands

Eighteen references, mapped. Numbers are my working ids.

| # | Surface | Direction taken from your reference | Status |
|---|---|---|---|
| I-01 | **About AquaTerra**, content refreshed entirely | Manifesto of seven proof-paired positions on ink, between torn SVG seams; welfare quote band; accordion with a `writing-mode` spine; lemon CTA band. Written to `BRAND_VOICE.md` | **DESIGNED** turn 15 |
| I-02 | **Sticker pack**, site-wide system | 8 silhouettes × 7 hues × 3 sizes; two keyline modes (stamped = tappable, die-cut = decoration); arc-set seals; 6 geometric glyph marks; hash-stable rotations | **DESIGNED** turn 11 |
| I-03 | **Footer — recent activity** | Avatar-in-pill bubbles on staggered marquee rows, bleeding off both edges, alternating direction. Reuses the `.aq-comment` bubble from `03.5.1` | **DESIGNED** turn 12 |
| I-04 | **Footer — 3D parallax sticker wall** | Three depth planes; photo shards bleeding off all four edges at .4 opacity; draggable die-cuts with arc-set "drag me"; 5% ghost wordmark. Mouse ±14px desktop, gyro ±8px opt-in mobile | **DESIGNED** turn 12 |
| I-05 | **The dog** | Flat ink silhouette, white eyes, six poses (shaking, chasing, sniffing, running, jumping, surprised). Roams occasionally. CTA is a bone you swipe off the kernel and he follows you | MAPPED · BLOCKED |
| I-06 | **HoD Desk dashboard v2** | Jigsaw-notch blocks built from a 26px ground-coloured circle on the shared edge (no clip-path); 6px on notched sides, 22px on free ones; display-scale tabular figures; photo block closes the row | **DESIGNED** turn 14 |
| I-07 | **Search — mobile filter mechanic** | Two detents (108px peek / top-96px full); the page scales to .93 then .86 behind it; peek carries the live filter summary; grabber is a real button so it works without a drag | **DESIGNED** turn 17 |
| I-08 | **Project / drive expanded page** | Stacked hue bands reusing `17.2`'s notch geometry; the **last band is ink and states what is still missing**, which is what earns the CTA; segmented count bar, never a percentage fill | **DESIGNED** turn 19 |
| I-09 | **Profile Wall** | Pinboard built from **tint × size × label side × hashed rotation inside CSS columns** — the scatter without the overlap defect. Soft delete, and the off-switch on the empty state | **DESIGNED** turn 20 |
| I-10 | **Contact page**, no gradient | Ink form pane inside a white card; a named co-founder as the page's argument; underline fields with the live error state; chip group reusing `COLLAB_TYPES` | **DESIGNED** turn 18 |
| I-11 | **Auth**, unique every visit | Card-in-card; **twelve enumerated compositions** picked by seed with the index shown (not independent randomness); eyes on one rAF loop, desktop only, no gyro prompt before login; mascots from the existing `AQMascot` set | **DESIGNED** turn 18 |
| I-12 | **Post card variations** | Mapped onto the **existing** shapes: A → C09/C11 (drive-sourced, the only photo cards that can be filled) · B → C02 (blocked until `posts` has an image column) · C → C05 pull quote, built exactly as the reference nests it | **DESIGNED** turn 13 |
| I-13 | **HoD Desk navigation** | Three tiers: 68px glyph rail (5 groups, cap) → 230px label column with L-connector children → the desk. Collapses to one sheet below 1024px | **DESIGNED** turn 14 |
| I-14 | **Teams page header** | Three `inline-flex` lockups inside the `<h1>` — overlapping disc row, dashed SVG wire with dot terminals, a toggle in an ink pill — with per-object `vertical-align`, all `aria-hidden` | **DESIGNED** turn 16 |
| I-15 | **Hiring / openings cards** | Five-card flex fan, −26px margins, −7° to +9°, `transform-origin: bottom center`; overlap only covers texture panels; straightens on hover/focus; becomes a plain stack below 760px | **DESIGNED** turn 16 |
| I-16 | **Projects directory + all-posts** | Sticky rail; CSS-columns masonry with **six tile shapes chosen by what the row holds**; hover preview on `:focus-within` too; search revealed by IntersectionObserver with a keyboard route to it | **DESIGNED** turn 19 |
| I-17 | **Search information architecture** | Dotted-grid ink page; five 150px hue discs as the *default* state (only the selected one carries a count — a count each would cost a query each); result cards are full-hue with a `kind → context` lockup and a `<mark>`ed match line | **DESIGNED** turn 17 |
| I-18 | **Home load animation** | Chips, posts and profiles burst into the air and fall into place, settling into the feed's real layout; per-hue pills at varied rotations; staggered physics | MAPPED |

**Pairings I have assumed** (say if wrong):
- I-03 lives *inside* I-04 as a band — one footer, not two.
- I-07 is the mobile filter mechanic for I-17 — one search design.
- I-06 replaces the triage landing in turn 4; I-13 replaces the ink rail in `06.3`.
- I-12 supersedes the single feed card in `01.15` — the card becomes a set.

---

# PART 2 — Every surface

## 2A · Public / member site

| Ref | Route & file | Status | Notes |
|---|---|---|---|
| P-01 | `/` home + feed — `HomeRoute`, `HomePage.tsx` (51KB) | DONE `01` | Merged feed-first surface. Gets I-18 load animation, I-12 card set |
| P-02 | Global chrome — `AQNav`, `PublicLayout`, bottom nav, footer | DONE `02` | Footer to be replaced by I-04 + I-03 |
| P-03 | `/post/:uuid` — `PostPage`, `feed/post/*` | DONE `03` | Two-pane, sticky media, inline bubble comments |
| P-04 | Composer — `CreatePostModal` (74KB) | DONE `03` | Ink dock, minimal-open + "more" |
| P-05 | `/profile/me` — `ProfilePage`, `CvCard`, `HoursAndCertificateCard`, `AchievementsList`, `BreakModal` | DESIGNED `6a`/`7a` · `04` written | **Awaiting your pick.** Gains I-09 Wall |
| P-06 | `/member/:uuid` — `PublicProfilePage` | DESIGNED `6c` | Gains I-09 Wall (read + post) |
| P-07 | `/profile/edit` — `EditProfilePage` | TODO | Form pass; field-level errors (see 3B) |
| P-08 | `/members` — `MembersPage` | DESIGNED `8a`/`8b` | Name/school/role only, role filters |
| P-09 | `/classes` — `ClassesPage` | TODO | Cohort grid; client-grouped `class_grade` |
| P-10 | `/teams` — `TeamsPage` | MAPPED I-14 | Header with objects in the word gaps |
| P-11 | `/teams/:slug` — team detail | TODO | Belonging: drives, members, posts |
| P-12 | `/projects` — `ProjectsPage` | MAPPED I-16 | + all-posts masonry, scroll-triggered search |
| P-13 | Project / drive detail | MAPPED I-08 | Colour bands, segmented bar, CTA band |
| P-14 | `/opportunities` — `OpportunitiesPage` | MAPPED I-15 | Fanned card hand |
| P-15 | Apply flow — `ApplyPage` | TODO | Multi-step; needs success + error states |
| P-16 | `/about` — `AboutPage` | MAPPED I-01 | **Content rewritten entirely** |
| P-17 | `/search` — `SearchPage` | MAPPED I-17 + I-07 | Full IA rework |
| P-18 | `/saved` — `SavedPage` | TODO | Shares the list vocabulary |
| P-19 | `/notifications` — `NotificationsPage` | TODO | Depends on the notification plan in `SOCIAL-ENGINE.md` |
| P-20 | `/directory` — `DirectoryPage` | TODO | The "way in" hub page |
| P-21 | `/blog` — `BlogListPage` | TODO | Tag chips exist |
| P-22 | `/blog/:slug` — `BlogPostPage` | TODO | Long-form measure; poster studio gate |
| P-23 | `/labs` — `LabsPage` | TODO | 7 team submissions, no Supabase table |
| P-24 | `/collaborations` — `CollaborationsPage` | TODO | Has real field-level validation already — model for 3B |
| P-25 | `/contact` — `ContactPage` | MAPPED I-10 | Two-pane, no gradient |
| P-26 | `/join` — `JoinPromoPage` | TODO | Recruitment; hours-are-attendance wording |
| P-27 | `/brand` — `BrandPage` | TODO | Type specimen, palette, poster templates |
| P-28 | `/equity` — `EquityPolicyPage` | TODO | Verbatim HR document — copy is untouchable |
| P-29 | `/yearbook` — `YearbookPage` | TODO | |
| P-30 | `/calendar` — `CalendarPage` | TODO | |
| P-31 | `/drives` — `DrivesPage` | TODO | |
| P-32 | Login — `LoginPage` | MAPPED I-11 | Randomised art, eye tracking |
| P-33 | Signup — `SignupPage` | MAPPED I-11 | |
| P-34 | Onboarding — `OnboardingPage` | DESIGNED turn 10 | 5 slides, hue per slide |
| P-35 | Password reset / magic link | TODO | Often forgotten; needs all four states |
| P-36 | `/404` + route-guard rejections | TODO | See 3A |

## 2B · Command Desk — the real file list, read from the repo

28 files in `frontend/src/director/`. My earlier "17 desks" was a guess; this is counted.

| Ref | File | Size | Status |
|---|---|---|---|
| D-00 | `DirectorDashboard.tsx` + `.css` — the shell | 17KB | MAPPED I-13 |
| D-01 | `DirectorLanding.tsx` — triage | 11KB | DONE `06` · I-06 stats section |
| D-02 | `AccountApprovals.tsx` | 24KB | DONE `06` |
| D-03 | `PostModeration.tsx` | 25KB | TODO |
| D-04 | `MemberDirectory.tsx` | **37KB** | TODO — largest desk file |
| D-05 | `CertificateRequests.tsx` | 9KB | TODO |
| D-06 | `DriveManagement.tsx` | 9KB | TODO |
| D-07 | `FormResponses.tsx` | 20KB | TODO |
| D-08 | `VolunteerApplications.tsx` + `Parts.tsx` + `.css` | 71KB | TODO — three files |
| D-09 | `HiringResponses.tsx` | 16KB | TODO |
| D-10 | `MemberOfMonth.tsx` | 20KB | TODO — and surface it publicly |
| D-11 | `DirectorManagement.tsx` — roles | 13KB | TODO — `superOnly` |
| D-12 | `TeamManagement.tsx` | 19KB | TODO |
| D-13 | `BlogDrafts.tsx` | 12KB | TODO |
| D-14 | `YearbookManagement.tsx` | 13KB | TODO |
| D-15 | `CategoryManagement.tsx` | 13KB | TODO |
| D-16 | `ContentManager.tsx` | **34KB** | TODO |
| D-17 | `SopManagement.tsx` | **34KB** | TODO — owns `isRealTask` |
| D-18 | `ProjectManager.tsx` + `Shared.tsx` + `Modal.tsx` + 2 CSS | **98KB** | TODO — five files |
| D-19 | `WhatsAppTemplates.tsx` | 9KB | TODO — **this is the "send a message" surface** |
| D-20 | `adminKit.tsx` — the shared primitives | 29KB | DONE `06` |

**`WhatsAppTemplates.tsx` read.** It is the **HR desk's copy-to-clipboard script browser**, and
`handoff/20-sops-and-todos.md` §4.5 is quoted verbatim in its header: *"a copy-to-clipboard
template list on the HR desk, because that is how they are used. One tap, `copied` inline, name
substituted."* So the messaging model is **not** in-app messaging — a lead copies a script and
sends it in WhatsApp themselves.

Mechanics worth preserving exactly:
- `{{name}}` in a body is substituted from a **local-only** recipient field, never persisted, and
  the substituted name appears in each collapsed preview so a lead can confirm it landed.
- Copy is the row's **filled primary action** — a note records that it used to be buried behind
  a `⋯` sheet, which was wrong because copying is the entire point of the desk.
- `copied ✓` swaps back after **1600ms**.
- **A blocked clipboard opens the row it failed on**, because the toast tells you to select the
  text manually and that instruction is only true if the text is visible. Keep this.
- It renders as a **section inside a parent desk**, so it deliberately has no `AdminLayout` or
  `AdminTabHeader`. Do not add them.
- Strings to keep byte-identical: `recipient name`, `(optional - fills in any {{name}} in the
  text below)`, `substituted in every template below, at copy time. never saved.`,
  `e.g. Priyasha`, `⧉ copy`, `copied ✓`, `✓ save`, `saving...`, `cancel`, `edit`, `delete`,
  `no templates yet`, `add rows to sop_templates to seed the recruitment scripts here.`,
  `nothing here yet - check back soon.`, `delete this template?`, `"{label}" will be permanently
  removed.`, `delete it`, `template updated`, `template deleted`, `couldn't copy that.`,
  `your browser blocked clipboard access - select and copy the text manually.`,
  `couldn't save that.`, `couldn't delete that.`, `try again.`
  (note the curly apostrophe `’` in the three `couldn’t` strings — it is not an ASCII quote)

## 2G · The repo already has a doc set — and it outranks my changelog

Found, not previously known:

| Doc | Size | Bearing on this work |
|---|---|---|
| `docs/BRAND_VOICE.md` | 29KB | **The authority on all copy and tone.** Supersedes `DESIGN.md` §12 |
| `docs/VISUAL_AUDIT_MOBILE_2026_07.md` | 12KB | Known mobile defects — check before "fixing" one |
| `docs/PERFORMANCE_AUDIT_2026_07_31.md` | 10KB | The budget the new motion must live inside |
| `docs/SEO_AUDIT_2026_07.md` | 31KB | Bears on the OG/prerender question in `SOCIAL-ENGINE.md` |
| `docs/CODEBASE_AUDIT_2026_07_31.md` | 9KB | |
| `docs/archive/` | 19 files | Unread |
| `docs/superpowers/` | 2 files | Unread |
| `handoff/*` | ? | Operational specs, quoted verbatim in component headers — live |

**`DESIGN.md`'s authority order is updated to put these above it.** I have not read them; the
performance audit in particular bears directly on the "go big" motion decision, and I would read
it before building the parallax footer for real.

## 2C-bis · Seven more routes, found in the mobile audit

None of these were in my inventory. All are live public routes.

| Ref | Route | Note |
|---|---|---|
| P-37 | `/links` — `QuickLinksPage` | **Worst contrast on the site.** `QuickLinksPage.css:31` sets `color: var(--dc)` with no floor: 10px labels at 1.25:1 |
| P-38 | `/faq` | Clean today |
| P-39 | `/support` | Donation note; **no empty state** |
| P-40 | `/volunteer` — the handbook | Tomato stickers at white-on-accent 3.31:1 |
| P-41 | `/roots` | Green label 3.48:1; serif on grape 3.74:1 |
| P-42 | `/schools` | Clean today |
| P-43 | `/classes` | **Hero word "class of" at 1.36:1** — a headline that reads as a smudge |

## 2C-ter · Three global chrome elements I had missed

| Ref | Element | Note |
|---|---|---|
| G-01 | **Paradox banner** — `.px-banner__sticker` / `.px-banner__cta` | Sits in the footer band on **all 22 public routes** at **3.16:1**. `src/paradox/**` is out of scope but **this banner is public chrome** and belongs in `02` |
| G-02 | **`.aq-contact-nudge`** — fixed, z-60, ~60×48, bottom-right | **Overlaps card body text** on `/teams/:uuid`, `/about` and `/projects`. Dismissible, so recoverable — but it is a floating element competing with the parallax footer and the roaming mascots. **Three floating things is too many; one has to go.** |
| G-03 | **`WelcomeOverlay`** — first-run, fixed inset:0, z-1000 | Correct in every respect except a **32px ×**. Blocks scroll, dual-dismiss, honours reduced-motion |

**G-02 needs your decision.** The nudge, the dog and the footer all want the bottom-right corner.

## 2D · Surfaces I had missed entirely (found by reading, not by being told)

| Ref | Surface | Where | Status |
|---|---|---|---|
| X-01 | **Birthday popup** — realtime, app-wide | `components/BirthdayPopup.tsx`, mounted in `App.tsx` | TODO |
| X-02 | **Birthday card in the feed** (C15) | `feed/cards/family01Moments.tsx` | TODO |
| X-03 | **Private birthday acknowledgement** on your own profile | `ProfilePage.tsx:409` | TODO |
| X-04 | **Birthday opt-in toggle** | `auth/SettingsPage.tsx` | TODO |
| X-05 | **Birthday layer on the calendar** | `calendar/CalendarPage.tsx` | TODO |
| X-06 | **Settings page** — I had not listed it at all | `auth/SettingsPage.tsx` | TODO |
| X-07 | **Welcome card** (C14) — the one card meant to be replied to | `family01Moments.tsx` | TODO |
| X-08 | **Break card** (C16) — a teammate went quiet | `family01Moments.tsx` | TODO |
| X-09 | **Break modal** — start/extend/end, with `BREAK_REASONS` | `profile/BreakModal.tsx`, `services/breakService.ts` | Partly `04.6` |
| X-10 | **Break layer on the calendar** | `CalendarPage.tsx` | TODO |
| X-11 | **The 30-card catalogue** | `lib/feedShape.ts`, `feed/cards/*`, `AQ Feed Cards.dc.html` | **See below** |
| X-12 | **Greeting recipes G01–G33** | `lib/gridRecipes.ts` | Partly `01` |
| X-13 | **HR contact block** — real names and phone numbers | `public/EquityPolicyPage.tsx` (`HR_TEAM`) | TODO |
| X-14 | **Referrals** — `referrals` + `referral_clicks` are live tables | C18 | TODO |
| X-15 | **Offline post queue** (C23) — shape ready, nothing queues yet | `feedShape.ts` | TODO |

## 2E · THE BIG ONE — there is already a formal card system

`frontend/src/lib/feedShape.ts` (32KB) is an authoritative, tested, 30-shape card system with
eight families, a documented evaluation order, seven named caps, and a per-shape catalogue
carrying each shape's predicate **and its measured data state**. `feedShape.test.ts` tests it.
`AQ Feed Cards.dc.html` renders all 30.

**This changes the card work fundamentally.** Your I-12 "post card variations" are not a new set
to invent — they are **C01, C02 and C03 that already exist by name**, and my job is to restyle
them within the existing chooser, not to run a parallel system.

**Four data facts from that file that break things I had already designed:**

1. **`posts` has no image columns at all.** C01 hero, C02 colour block, C03 standard and C04
   collection are all `data: 'none'` — **unreachable from a post row today.** Every photo-led
   feed card I have drawn, including turn 1, is designing something the database cannot fill.
2. **576 of 586 posts come from the org account**, so the author cap fires constantly and
   **C25 compact rows is the common case.** It must be designed as a first-class citizen.
3. **No post body exceeds 900 characters**, so C06 long read only ever fires from `blogs`.
4. **`stats` is `[]` on all 586 rows.**

It also names two guardrails the code already enforces, now in `DESIGN.md` §5:
**rule 2** — a card gets a photo only for its own row; **rule 4** — never substitute a zero, a
null figure renders the dashed live marker.

**And it points at upstream documents I have not read:** `docs/AQRANK-SPEC.md`,
`docs/FEED-ALGORITHM.md`, `CHANGELOG-REDESIGN`, `CHANGELOG_SEC10_34.md`. There may already be a
guardrails document. **I need to read these before designing another card.**

## 2F · Command Desk (superseded by 2B)

| Ref | Desk | Status |
|---|---|---|
| D-00 | Shell + navigation | MAPPED I-13 (replaces `06.3`) |
| D-01 | Landing / triage | MAPPED I-06 (replaces `06.4`) |
| D-02 | Account approvals | DONE `06` — the table primitive |
| D-03 | Post moderation queue | TODO — inherits the primitive |
| D-04 | Member directory (admin) | TODO — `actionsInline` quirk documented |
| D-05 | Certificates | TODO — `isSuperAdmin` gate |
| D-06 | Drives + attendance | TODO — the "paper vs digital" honesty problem |
| D-07 | Enquiries | TODO — needs an "in progress" state (gap 21) |
| D-08 | Applications | TODO |
| D-09 | Member of the Month | TODO — and surface it publicly |
| D-10 | Notice board editor | TODO — hand-added `rgba(0,229,160)` to remove |
| D-11 | Roles & permissions | TODO — `superOnly` |
| D-12 | Teams admin | TODO |
| D-13 | Blog admin | TODO |
| D-14 | Yearbook admin | TODO |
| D-15 | Collaborations admin | TODO |
| D-16 | Equity / HR | TODO |
| D-17 | Hours ledger | TODO — `.ledger-empty-note` `--font-hand` bug |

## 2C · Excluded
`src/paradox/**` — untouched per invariant 9.

---

# PART 3 — Every state

## 3A · Page-level states, for every route above

1. **Loading** — skeleton that matches the shape that will arrive (`01.17`, `06.7`)
2. **Empty** — with an action, not just a sad line (gap 20)
3. **Error / fetch failed** — with retry
4. **Offline** — currently nothing anywhere (gap 27)
5. **Not found** — per resource type, not one generic page
6. **Permission denied** — mirrors the route guard, explains what role is needed
7. **Rate limited / too many requests**
8. **Stale data** — "refresh" affordance after a long idle
9. **Partial failure** — list loaded, one row failed

## 3B · Form states, for every form
`ApplyPage`, `CollaborationsPage`, `ContactPage`, `EditProfilePage`, `BreakModal`, composer,
notice-board editor, every desk editor.

1. Pristine · 2. Focused · 3. Filled · 4. **Field-level invalid** (`00.10` ships the style
wired to nothing — this is the biggest systemic gap) · 5. Form-level error summary ·
6. Submitting (button busy, form locked) · 7. Success · 8. Server rejection ·
9. Network failure with the draft preserved · 10. Unsaved-changes guard ·
11. Disabled / not-eligible · 12. Read-only

## 3C · Action states
Optimistic write → rollback on failure (the bookmark toast pattern in `01.15.8` is the model);
per-row busy (`AdminRow`); undo instead of confirm for reversible verdicts (`06.6.3`);
confirm retained for irreversible; toast success; toast failure with retry; **aria-live for
every optimistic change** (gap 28).

## 3D · Content states
Text with no image · image with no text · 1 image vs 2 vs 9 · very long name (24+ chars —
now a hard rule in `04`) · very long team list · no team · no school · zero drives ·
retired points · unverified achievement · pending moderation (gap 18) · member on a break ·
deleted author · official account · self vs public view.

---

# PART 4 — Every component

## 4A · Shipped in `00`
Buttons (primary/secondary/ghost/danger), inputs, chips, pills, cards, wells, status tones,
skeletons, avatars, avatar stacks, toasts, modals, sheets, tables, tabs, badges, dividers,
the sticker, focus rings, the six-rung paper-on-ink ladder, the concentric radius scale.

## 4B · New components this plan needs
| Ref | Component | From |
|---|---|---|
| C-01 | Die-cut sticker system — 7 silhouettes × 7 hues, arc-set type, glyph marks | I-02 |
| C-02 | Ink dock | `03.1` DONE |
| C-03 | Comment bubble (avatar inside the pill) | `03.5.1` DONE |
| C-04 | Activity marquee row | I-03 |
| C-05 | Parallax depth stage (mouse + gyro) | I-04 |
| C-06 | Draggable die-cut with peeling corner | I-04 |
| C-07 | Dog companion + bone CTA | I-05 |
| C-08 | Jigsaw-notch block | I-06 |
| C-09 | Ink bottom sheet with peek + full detents | I-07 |
| C-10 | Colour band row | I-08 |
| C-11 | Segmented percentage bar | I-08 |
| C-12 | Pinboard collage | I-09 |
| C-13 | Interest chip group | I-10 |
| C-14 | Underline-only field | I-10, I-11 |
| C-15 | Randomised art panel + eye tracker | I-11 |
| C-16 | Post card A / B / C | I-12 |
| C-17 | Three-tier nav tree with L-connectors | I-13 |
| C-18 | Inline object lockup (UI in a headline) | I-14 |
| C-19 | Fanned card hand | I-15 |
| C-20 | Masonry with mixed tile shapes | I-16 |
| C-21 | Hover preview card | I-16 |
| C-22 | Scroll-revealed search bar | I-16 |
| C-23 | Hue disc category picker | I-17 |
| C-24 | Match-highlight result card | I-17 |
| C-25 | Burst-and-settle stage | I-18 |
| C-26 | Torn-edge seam | I-01 |
| C-27 | Accordion with rotated spine label | I-01 |
| C-28 | Ghost display type layer | I-08, I-04 |
| C-29 | Arc-set type on a path | I-02, I-12 |
| C-30 | Dotted-grid ground | I-07, I-17 |

---

# PART 5 — Every flow

| Ref | Flow | Status |
|---|---|---|
| F-01 | Visitor → signup → approval wait → onboarding → first feed | Partly designed |
| F-02 | Login → 2FA/magic link → land | TODO |
| F-03 | Password reset | TODO |
| F-04 | Compose → moderation queue → approved/rejected → **member notified** | Gap 18 |
| F-05 | Comment → profanity gate → post → reply → report | Partly; report missing (gap 19) |
| F-06 | Browse openings → apply → track status | TODO |
| F-07 | Join a team → belong | TODO |
| F-08 | Sign up for a drive → attend → hours logged → certificate request | Partly |
| F-09 | Request certificate → HR decides → issued/declined | `04.5` DONE |
| F-10 | Generate CV → print/PDF | `04.5` DONE |
| F-11 | Take a break → return | `04.6` DONE |
| F-12 | Leave a wall note → recipient notified → moderate | NEW I-09 |
| F-13 | Search → filter → open result | I-17 |
| F-14 | Save → revisit saved | TODO |
| F-15 | HoD: land → see what needs me → act in bulk → undo | I-06 + `06` |
| F-16 | HoD: approve member → member notified | Gap 18 |
| F-17 | HoD: scoped moderation by category | `06` |
| F-18 | Share a post outward → OG card | Needs prerender decision |
| F-19 | Collaboration enquiry → HoD triage → reply | Needs "in progress" state |
| F-20 | Yearbook / Member of the Month publication | TODO |

---

# PART 6 — Variations to make it feel alive

Beyond the inspiration. All cheap, all reduced-motion-safe.

1. Per-category feed accent already exists — extend to the card's whole treatment (I-12)
2. Greeting recipe variety (7 exist; `pointsTile` must be deleted from 5 of them)
3. Time-of-day greeting shift
4. First-post, first-drive, first-team-lead sticker moments
5. New-member welcome strip
6. "Since your last visit" markers
7. Streaks of showing up, not posting
8. Empty-week backfill so the feed never looks dead
9. Hover/press micro-states on every die-cut (lift, settle, peel)
10. Page-transition continuity for the shared card → detail photo
11. Scroll-linked ghost type parallax
12. Cursor-adjacent sticker attraction on desktop
13. Pull-to-refresh with a sticker spinner
14. Optimistic like with a one-frame overshoot
15. Marquee pause on hover
16. Confetti replaced by a single sticker drop on real milestones
17. Sound: off by default, one optional click for the bone swipe
18. Seasonal palette rotation on the auth art only

---

# PART 7 — The blind changelog, remaining

Written: `README` · `00` · `01` · `02` · `03` · `04` · `06` · `UX-GAPS` · `SOCIAL-ENGINE`

To write: `05` teams · `07` auth + onboarding · `08` search/saved/notifications/directory ·
`09` marketing (about, contact, join, brand, blog, labs, equity, collaborations) ·
`10` projects + opportunities · `11` system states · `12` calendar/drives/yearbook/classes ·
`13` the sticker system · `14` the footer · `15` the dog · `16` profile wall ·
`17` desk navigation + dashboard v2 · `18` motion and load animation

Every file repeats the nine invariants, the concentric rule, the contrast ladder, the
string-discipline rule, and carries its own "A note on strings" + "Unresolved".

---

# PART 8 — Decisions taken (2026-09-05)

Locked. These override anything earlier in this document.

| Decision | Answer |
|---|---|
| **Build order** | **Foundation first** — sticker system, then the footer, then the post-card set; everything else inherits them |
| **Profile identity** | **`7a`** — circular portrait breaking the grid, mixed-shape photo bento, labels on tiles. `6a` is retired; `04-profile.md` to be rewritten around `7a` |
| **Footer** | **One section** — the activity marquee (I-03) is a band inside the parallax wall (I-04) |
| **Desk landing** | **Triage stays** as the landing; the jigsaw blocks (I-06) become its stats section. `06.4` is amended, not replaced |
| **Companion** | **All three existing mascots roam**, each on different surfaces. No new character, no new art |
| **Motion** | **Go big**, with four floors — **and a measured budget** (below). The audit changed where the ambition goes, not how much |
| **About voice** | **A manifesto** — a numbered set of positions the org holds |
| **Wall policy** | Anyone may post · public to visitors · images allowed · profanity gate · recipient and author may delete · per-profile off-switch · **no further gate** |

## The four motion floors — invariant on every animated thing

1. `prefers-reduced-motion: reduce` **kills everything ambient.** Not "reduces" — removes.
   Entry animations jump to their settled state; loops do not start; parallax and gyro are inert.
2. **Nothing above the fold animates before its content is readable.** Text paints first, motion
   second. The burst-and-settle (I-18) may not delay the feed's first legible frame.
3. **Ambient motion pauses when the tab is hidden** — `visibilitychange`, and
   `IntersectionObserver` for anything scrolled out of view.
4. **Nothing blocks a tap for longer than 300ms.** Every animation is interruptible; a tap during
   an entry animation completes it instantly and acts.

## The motion decision, revised against measurement

I read `docs/PERFORMANCE_AUDIT_2026_07_31.md` after you said "go big". It does not overturn the
decision, but it **relocates** it, and one item needs your eyes:

- The app ships **~251 KB gz of eager JS** per route, and **framer-motion is 44.4 KB gz of it,
  in the modulepreload list.** Getting it *out* is on the audit's list. So more framer-motion on
  the critical path is the wrong kind of "alive".
- **The footer is the perfect place to be ambitious.** Below-fold, and the audit already plans to
  split its CSS into a lazy `footer.css` with "no FOUC risk" noted. Gated behind
  `IntersectionObserver`, the parallax wall costs nothing until scrolled to. **I-04 proceeds at
  full ambition.**
- **The home load animation (I-18) is the risky one.** It lands above the fold on `/`, which is
  the audit's **P0-1** finding (`HomeRoute` eagerly imports the 1,604-line `HomePage`). So I-18
  ships as **pure CSS** with no library, or it does not ship. A burst-and-settle in CSS is
  achievable but simpler than the reference — fewer objects, no physics. **Flagging that as a
  reduction in scope rather than pretending otherwise.**
- **Unrelated to motion, but bigger than all of it:** user-uploaded images ship at **original
  size** — `sized()` doesn't rewrite Supabase storage URLs and the upload has no byte cap, so 20
  image posts can be **50–100 MB**. Every image-led design I have drawn makes this worse. The
  composer should downscale to ~1600px WebP client-side. **That is a bigger user-facing win than
  anything in this redesign**, and it belongs in the handoff.

## On the Wall's openness — recorded, not re-litigated

You chose no gate beyond the profanity filter, recipient delete and the off-switch. Building it
that way. Two things I am putting in writing because the audience includes minors:

- **The image is the exposure.** `checkText` cannot inspect an image, so an uploaded picture on a
  publicly-visible wall has nothing between it and the world. If you ever want one gate, make it
  images-from-strangers, not text.
- **The off-switch must be discoverable before it is needed**, not buried in settings. I will put
  it on the Wall's own empty state, so a member meets it the first time they see the feature.

I will not add a gate you did not ask for. This is here so the decision is visible in the handoff.

# PART 8b — Round-two decisions (2026-09-05, approved)

| # | Decision | Resolution |
|---|---|---|
| **Copy** | All invented strings | **APPROVED IN BULK.** Every string marked "invented, needs approval" in files `01`–`17` is cleared to ship. I flag only ones I am genuinely unsure about from here. |
| **Process** | Design-doc turns | **Skipped for secondary surfaces.** Changelog written straight from the reference for admin desks and minor public pages. Design turns reserved for: desk, teams, search, About, contact, auth, projects, the wall, load animation. |
| **G-02** | The bottom-right corner | **`.aq-contact-nudge` is RETIRED.** It is a measured defect (overlaps card text on `/teams/:uuid`, `/about`, `/projects`) and the footer CTA plus a real contact page make it redundant. The corner belongs to the roaming mascot. |
| **C16** | `break_reason` in public | **Dates only, never the reason.** "on a break until September 30" satisfies the card's purpose without publishing a health fact about a minor. The reason stays visible to the member and their team lead. |
| **Wall** | Schema | **Approved as proposed:** `profile_notes` = `id`, `recipient_uuid`, `author_uuid`, `body` (text, 280 cap), `image_url` (nullable), `created_at`, `deleted_at` (**soft delete**), plus `wall_enabled` boolean on `members`. Soft delete is load-bearing: a hard delete means an abusive note vanishes before anyone can act on it. |
| **Desk IA** | Five group names | **Approved: the queue · people · the work · publishing · org setup.** Exactly at the rail's five-glyph cap. `org setup` stays separate from `publishing` — category management and blog drafts are different jobs. |

# PART 8c — Guided demo flows (added 2026-09-05, scheduled LAST)

**Requested:** shareable links that run a guided walkthrough of flows a visitor cannot otherwise
see, so the product can be demonstrated without an account or a seeded database.

**Sequencing: this is designed AFTER every surface above.** A tour is a layer over finished
screens; building it against unfinished ones means rebuilding it.

## The flows worth a tour

| # | Flow | Why it needs one |
|---|---|---|
| T-01 | **Writing a post** | The composer is the product's core act and a visitor never reaches it |
| T-02 | **A HoD posting an opening** | Requires leadership role + a team; unreachable for almost everyone |
| T-03 | **A member applying to an opening** | The recruitment funnel, which is what the site is *for* |
| T-04 | **A HoD approving an account** | The desk's headline job, behind two role gates |
| T-05 | **Moderating a post** | Explains why a post does not appear instantly |
| T-06 | **Requesting a certificate** | The concrete payoff for volunteering |
| T-07 | **Leaving a wall note** | A brand-new feature nobody will discover unprompted |
| T-08 | **Signing up for a drive** | The one act that generates hours |
| T-09 | **The Command Desk tour** | 20 desks, five groups — needs an orientation pass |

## How it must work — the constraints that decide the design

1. **It writes nothing.** Every step is a **simulated** state over the real UI. No row is
   inserted, no service call fires, no storage object is created. **This is the single most
   important rule** — a tour that posts to `posts` pollutes a live production table.
2. **Trigger by URL, e.g. `/?tour=compose`.** No auth required, no role required. The tour
   **grants a fake role in memory only** so `hasLeaderAccess` returns true for the duration.
3. **It must be obvious it is a demo.** A persistent ink bar: what is being shown, step *n* of *m*,
   and an exit. A visitor who forgets they are in a tour and reports a bug is a failure.
4. **Exit restores reality.** Leaving clears the fake role and the simulated rows.
5. **Real UI, not screenshots.** The tour drives the actual components, so it cannot drift from
   the product the way a recorded walkthrough does.
6. **Keyboard and reduced-motion complete.** Arrow keys advance; `Esc` exits; the four motion
   floors apply — a tour that auto-advances with animation is unusable for some of the audience.
7. **Deep-linkable per step** (`?tour=compose&step=3`) so a specific moment can be shared.

## Open questions to settle when we get there

- Are the tours for **recruitment** (a visitor deciding to join) or **training** (a new HoD
  learning the desk)? They want different tones and lengths.
- Should a tour be **linear** (click Next) or **free** (act inside a sandbox with hints)?
- Does the demo data show **real anonymised content** or obviously-fake placeholders?
- Should `/tour` exist as a **menu page** listing all nine, or only ever be shared as direct links?

# PART 8c — Round-three decisions (2026-09-05, approved)

| Decision | Resolution |
|---|---|
| **Mascots** | All three roam: **nolen** on home/feed + onboarding, **tuk** on About + the wall's empty state, **bhoot** on auth + 404. All three as die-cuts on the footer wall. One on screen at a time. |
| **The bone** | **Full mechanic kept.** Swipe it and the mascot follows for the session. `sessionStorage`, never `localStorage`. Tap instead of drag below 760px. Absent entirely under reduced motion. |
| **Load animation** | **First visit of a session only.** `aq_burst_seen`, set *before* the animation runs. |
| **Demo audience** | **Prospective members.** |
| **Demo mechanic** | **Coach marks on the real UI** — spotlight the next control, the user clicks it. |
| **Demo data** | **Sandbox. Zero writes, nothing persists.** The absence of a token is the safety guarantee. |
| **Demo flows** | Eleven, incl. three HoD flows that borrow a role the visitor does not have — the ribbon must say so. |
| **Wall labels** | **`lib/categories.ts`'s five slugs, nothing added.** The mock's `#firstdrive`/`#welcome`/`#thankyou` are retired. |
| **Removed wall notes** | **HoDs can review them.** Needs a desk (child of post moderation), an RLS policy for `deleted_at is not null`, and a `deleted_by` column — recipient vs author is the whole signal. |

# PART 9 — What I still need from you

Nine open items. Six are in the form; three are here because they need prose.

**A · Art I cannot make.** I can't generate images. The dog (I-05) and the auth art (I-11)
depend on drawn assets. I'll build both mechanics with honest placeholders and you drop the
real art in — unless you have the files, in which case send them.

**B · The Profile Wall is a new table.** Notes need author, recipient, body, optional image,
created_at, and a moderation state. It also needs a policy: who can post, can the recipient
delete, does it go through the profanity gate, does it enter the HoD queue. I'll propose a
schema rather than assume one.

**C · Content for About.** Writing it as a manifesto from your brief — student-centric, making
change, doing what adults would not trust us with and doing it better, not hostile. **Every
factual claim will come from `lib/orgFacts.ts` or an existing page; every sentence I invent will
be marked for your approval** in `09`. You approve the copy before it ships.
