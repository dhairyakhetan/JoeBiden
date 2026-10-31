repo: kaxx4/vercelaq
branch: main
path: frontend/src

## Last sync

date: 2026-09-05T17:54:00Z

### Updated in this project

- Recreated and redesigned Home / Feed for phone and desktop, keeping every colour, typeface, string and route.
- New global chrome: segmented ink capsule bar with true masked concave joints, frosted, top and bottom.
- Home rails rebuilt as bento tiles — 22% hue tints with one full-saturation hero tile per card.
- Blind, page-wise implementation changelog written to `changelog/` (00 tokens, 01 home/feed, 02 chrome).
- All feed and rail glyphs traced to the real `I` icon set and `VerifiedTick` in `components/v6Shared.tsx`.
- Wrote the missing inverse contrast rule (ink ON a hue must be solid, never an alpha) into `changelog/00.4`, with measured ratios for all six accents.
- Found and fixed a shipped bug: `public/logo.png` is a 1332x225 wordmark used in square capsules, painting ~5px tall. Swapped to the square `stamp-white.png` / `stamp-ink.png` marks and wrote the fix into `changelog/02.4`.

- Command Desk redesigned: ink rail replaces topbar + strip + sidebar, triage-first landing, one table primitive that becomes cards below 760px.
- Wrote `changelog/06-hod-desk.md`, plus `UX-GAPS.md` (28 items, 13 of them shipped bugs) and `SOCIAL-ENGINE.md`.

- Composer redesigned around an ink dock (nine tools, one bar) with a minimal-open + "more" disclosure split; post detail is two-pane on desktop with a sticky media pane; comments became avatar-in-pill bubbles, inline on detail and a sheet on the feed.
- Wrote `changelog/03-post-detail-and-compose.md`.

- Profile redesigned: ink identity card for your own page, white for the public one, hours as the hero tile, achievements de-rotated with verification as a tinted pill. Wrote `changelog/04-profile.md`.
- Found `--rust` undefined for a third time (`.pf-status-declined`), and two rotation-on-data defects on achievement cards.

- Grounded every string instruction: read `HoursAndCertificateCard.tsx`, `CvCard.tsx`, `BreakModal.tsx` and `ProfilePage.tsx`'s break block, replaced invented mock copy with verbatim source strings, and added a binding "how to read a string instruction" rule to README invariant 3 plus an invented-copy list to all five page files.
- Found two more `--rust` uses in `BreakModal.tsx` (a required-field asterisk and a validation line, both invisible today) — five shipped instances of that undefined token in total.
- Confirmed from a source comment that there is **no hours threshold** in the codebase; removed the invented progress bar the mock had reintroduced.

- Second profile pass from the Delinix reference (turn 7): circular portrait, mixed-shape bento tiles, ink-bordered label pills sitting on tiles, photo-as-tile-content. Portrait is a flex sibling, never absolute over the name.

- Corrected the paper-on-ink contrast invariant: 0.50 alpha measures 4.78:1 and passes (an earlier draft wrongly said it failed; the real boundary is ~0.47). Replaced the three-token whitelist with a six-rung measured ladder and lifted the mock's two off-ladder values onto it.

- Members directory (turn 8): ink page, die-cut sticker cluster ringing the headline, cream cards, outlined role filters. Rebuilt after reading source — see below.
- Read `MembersPage.css`/`MembersPage.tsx` and `HomePage.tsx`: the public member card carries only **name, school, role**, the list filters by **role** (not team), and `drive_attendance` holds zero rows before 2026-08-31 so a drive count on a public card would read as "never volunteered". Removed teams/joined-date/drive-count from the cards and made every badge and pill a role filter.

- Fixed a contrast regression across the document: paper text on grape (3.78:1) and teal (3.32:1) failed AA. Swept 13 instances to ink and added "text on a saturated accent is always ink" as a measured table in README invariant 7.
- Rebuilt the directory cluster as a 3x3 grid with static badges, after absolute positioning against auto-height type collided three times.

- Everything-directory (turn 9) in the same ink + die-cut language, built on `DirectoryPage.tsx`'s own seven sections with their verbatim notes, tables and routes.

- Onboarding (turn 10): five full-bleed slides, one hue each (welfare → lemon → sky → ink → pink), built on `OnboardingPage.tsx`'s existing PROJECT sticker array and the About marquee facts.

- Built the sticker system (turn 11) as foundation piece 1: 8 silhouettes, 2 keyline modes, hash-stable rotations. Fixed a real defect where `clip-path` silhouettes could not carry a ring at all (clip-path clips box-shadow/border/outline alike) — now a nested clipped pair.
- Read `lib/feedShape.ts`, `MembersPage`, `BirthdayPopup`, `breakService`, `SettingsPage`, `calendarService`, `profileService` and the real 28-file director tree. **Found an existing authoritative 30-shape card system with 8 families, 7 caps and unit tests** — the card redesign must work inside it, not beside it. Also found `posts` has no image columns, so every photo-led feed card is unreachable from a post row today.
- Wrote `DESIGN.md` — the standing guardrails brief for designing any unspecified surface.

- Read `WhatsAppTemplates.tsx` (the HR copy-script desk, quoting `handoff/20-sops-and-todos.md` §4.5) and `docs/PERFORMANCE_AUDIT_2026_07_31.md`. Found the repo's own doc set (`docs/BRAND_VOICE.md` 29KB, four audits, `handoff/*`) and subordinated `DESIGN.md` to it — BRAND_VOICE now outranks my writing-style section.
- Turned the "go big" motion answer into a measured budget: framer-motion is already 44.4 KB gz in the preload list the audit wants it out of, so ambition moves below the fold (footer, lazy-gated) and the home load animation is CSS-only or not at all.

- Read `docs/VISUAL_AUDIT_MOBILE_2026_07.md`. Derived the rule that explains four of its five worst defects — an accent hue is a fill, never text on cream (lemon-on-cream is 1.36:1) — and added the `*-ink` partner list. Found seven public routes I had never inventoried (`/links`, `/faq`, `/support`, `/volunteer`, `/roots`, `/schools`, `/classes`) and three global chrome elements (Paradox banner on all 22 routes at 3.16:1, the contact nudge that overlaps card text, WelcomeOverlay).

- Designed the footer (turn 12) and wrote `changelog/14-footer.md`: three parallax planes gated behind one IntersectionObserver and one shared rAF loop, activity marquee reusing the comment bubble, and the `v6.css` 530–766 move into a lazy `footer.css` that the performance audit already planned. Includes the Paradox banner contrast fix — one property, 22 routes, the highest-reach fix in the redesign.

- Designed the card set (turn 13) **inside** the existing 30-shape chooser and wrote `changelog/15-post-cards.md`: 8 shapes that the live database can actually fill, plus the 12 blocked ones recorded with what each needs. Established that the feed is text-led with photographic drive records in it — `posts` has no image column, while `welfare_projects` has 2,031 rows with photos.
- Promoted C25 compact rows from fallback to primary treatment: it fires on 576 of 586 posts.

- Designed the Command Desk nav and stats block (turn 14) and wrote `changelog/17-desk-nav-and-stats.md`: three tiers carrying ~20 destinations in five groups, and the jigsaw built from a 26px ground-coloured circle rather than clip-path. Maps each of the eight problems to the section that answers it.

- Four decisions approved and applied across the changelog: bulk copy approval, `.aq-contact-nudge` retired, `break_reason` never public (dates only), `profile_notes` schema with soft delete, and the desk's five group names locked as the product's top-level IA.

- Read `docs/BRAND_VOICE.md` (29KB voice bible) and rebuilt About as a seven-position manifesto (turn 15) + `changelog/09-about.md`. Every position is paired with a fact from the canonical sheet, per the bible's own "Real Person Test".
- **Six stats are blocked** as NEEDS HUMAN CONFIRMATION and are absent from the design: drives (450+/512+/534+, and the live marquee shows a fourth value 550+), stray dogs, clothes kg, Paradox 3.0's year, the LinkedIn slug, and "500+ campaigns". The drives figure renders as a visible confirm-me slot.

- Fixed the footer CTA overlap (third instance of one defect class): plane 0 now owns a reserved grid track on desktop and its own row on phone, with the die-cuts as static children. Wrote it up as a named overlap rule in README so it cannot recur in the eight surfaces still to design.

- Designed teams + openings (turn 16) and wrote `changelog/05-teams-and-openings.md`. The headline's UI objects are `inline-flex` in the text flow so they push words apart rather than overlapping them, and the openings fan uses `transform-origin: bottom center` with the overlap confined to texture panels.
- Recorded the codebase's own rule that "five category keys cannot serve eight teams" — a department's hue is a property of the department, and three of the eight are student businesses rather than volunteer teams, which the current page does not distinguish.

- Designed search (turn 17) and wrote `changelog/08-search-saved-notifications.md`: the browse-by-disc surface is the *default* state rather than an empty state, result cards carry a `kind → context` lockup and a `<mark>`ed match line, and the phone filter sheet has two detents with the page scaling behind it.
- Flagged the N+1 at `SearchPage:259` to be batched before any restyle, and specified that the "why it matched" line is omitted unless the query returns a match field.
- Noted that `.aq-sheet` is shared with the desk's collapsed nav (`17.1`) — one component, two callers.

- Designed contact + auth (turn 18) and wrote `changelog/07-auth-and-contact.md`. It defines `.aq-field` — the underline-only input and **the error state `00.10` left unwired** — which becomes the product's only input style, with validation logic lifted from `CollaborationsPage.tsx`.
- Auth's "unique every visit" is **twelve enumerated compositions picked by seed**, with the index displayed, rather than independent random choices — so it varies, never looks broken, and bugs stay reproducible. Eyes are desktop-only: asking for motion permission on a login page before the user has an account was rejected.
- Added `--danger-lift: #FF6B4D`, the one new colour in the redesign, because `--danger` measures 4.1:1 on ink and fails AA.

- Designed the projects archive + drive detail (turn 19) and wrote `changelog/10-projects.md`. Extended `feedShape.ts`'s shape-by-data principle to the archive: six tile shapes chosen by what each `welfare_projects` row actually holds, so a row with no photo is a designed state rather than a broken tile.
- The drive detail's final band is ink and states the shortfall rather than the achievement — that is what earns the CTA beneath it. The segmented bar is discrete counts, never `role="progressbar"`.

- Designed the Profile Wall (turn 20) and wrote `changelog/16-profile-wall.md` — the only new feature in the redesign, with the full `profile_notes` schema, RLS policies, and soft delete.
- Two decisions worth recording: `wall_enabled = false` **hides and never deletes** (an off-switch that destroys things is one nobody will use), and the off-switch lives **on the wall's empty state** so a member meets it before they need it. The composer states "everyone can see this" before submit, since the wall is public to visitors.
- The pinboard scatter is manufactured from tint, size, label side and an id-hashed rotation inside a CSS-columns flow rather than absolute positioning — the overlap defect class has already cost three fix rounds.

- Designed the guided demo system (turn 21) + `changelog/19-guided-demos.md`, and wrote `13-sticker-system.md` and `18-mascots-and-motion.md`. **All 21 turns designed; every inspiration reference is now mapped to a built surface.**
- The demo's architectural crux: a prospective member is not logged in, so the sandbox must **fabricate a session**, not just fake data. That is also the safety story — no token means no possible write. Flagged one unknown that could double the job: whether `services/` can be shadowed or imports the Supabase client at module scope.

- Completed the handoff: wrote `11-system-states.md`, `12-secondary-pages.md`, `20-admin-desks.md`, the 20-desk wireframe reference (turn 22), and `START-HERE.md` as the entry document. **21 build files + 4 reference documents + 22 design turns.**
- `11` fixes the product's biggest systemic gap: `00.10` ships an `[aria-invalid]` style wired to nothing, so every form currently reports errors as a toast or not at all. `CollaborationsPage.tsx` is the only correct implementation and is now the model.

- Added the enforcement layer against the nine implementation risks: `AUDIT.md` (runnable grep script, 17 rules, incl. a git-level check that `feedShape.ts` is unmodified), `ACCEPTANCE.md` (per-PR checklist for the four risks a grep cannot see), and `21-org-facts.md`.
- **Stats are now computed, not confirmed.** A build-time script derives every public number from Supabase into a generated `lib/orgFacts.ts`, killing the four-value drives conflict permanently. Rounding is always DOWN. Three of the six blocked stats turn out to have no table behind them at all.
- Mascots resolved to **one idle pose each** — every behaviour is transform and timing on a single sprite, with a `scaleX(-1)` facing flip as the load-bearing detail.

- Designed the eight social-engine surfaces (turn 23) + `changelog/22-social-engine.md`, grouped by cost: four are free (the data already exists and never got a surface), one is a query change, three need a decision.
- **§22.1 is flagged as a duty rather than a feature and promoted into `START-HERE.md`:** a member posts, it enters the queue, and they are told nothing — a rejected post disappears silently with no path forward. Blocked on whether `posts` exposes a readable moderation status, which is now the highest-value schema question in the handoff.
- Notification rules that matter: likes are ONE daily digest never one-per-like, and an individual like/follow/profile-view is deliberately never notified — a list that cries wolf gets muted, and then the approval notification is muted with it.

- Fixed a real clipping defect in the "new this week" strip and recorded it as a new rule class: a 96px card with 10px horizontal padding occupies 116px under `content-box`, so three overflowed a 336px `overflow:hidden` row and the third was unreachable. Added `box-sizing: border-box`, made the row a snap scroller with `overscroll-behavior-x: contain`, and added three grep rules (17–19) to `AUDIT.md`.

- Wrote `TESTS.md` (five layers: the audit script, the checklist, 8 DOM probes, 15 flow tests, 7 data tests) and `WORKFLOW.md` (the per-file loop, nine build rules, the eight hard boundaries, definition of done per file and per project). Every probe in layer 3 exists because that defect class survived a screenshot review during this project.
- Bumped the break-flag padding from 26px to 30px: measured clearance was 2px of ink, which a longer name or a font-metric shift would erase.
- **Handoff complete: 23 build files + 9 reference documents + 23 design turns (~590k chars).** Final consistency sweep passed: no dangling cross-references, every build file carries an invariants block and an Unresolved section, and every appearance of a disputed statistic is guarded as a discussed conflict rather than stated as fact.

- Fixed a systemic contrast class and closed the hole that caused it: invariant 7 forbade lightening an accent *fill* and reducing text *weight*, but never reducing the text's *alpha*. `rgba(10,10,10,.7)` on welfare measures 3.28:1 — and `17.2` explicitly instructed that value, so 13 instances were specced failing. Swept 87 dark alphas to full-opacity ink, 4 paper-on-ink 0.45s to the 0.55 floor, and 4 translucent-dark pills to paper text; amended `17`, `07`, `19`, `22` and added AUDIT rule 5b.

## Screen map

| Project screen | Built from |
|---|---|
| `AquaTerra Feed.dc.html` → `1a` phone feed | `frontend/src/public/HomePage.tsx`, `frontend/src/feed/FeedPostCard.tsx`, `frontend/src/styles/routes/feed.css`, `frontend/src/styles/routes/home.css` |
| `AquaTerra Feed.dc.html` → `1b` desktop feed | `frontend/src/public/HomePage.tsx` (LeftRail, RightRail, main), `frontend/src/auth/HomeRoute.tsx`, `frontend/src/styles/routes/home.css` |
| `AquaTerra Feed.dc.html` → `1c` card before/after | `frontend/src/feed/FeedPostCard.tsx`, `frontend/src/styles/routes/feed.css` |
| `AquaTerra Feed.dc.html` → `3a` chrome | `frontend/src/components/AQNav.tsx`, `frontend/src/components/AQNav.css`, `frontend/src/styles/tokens.css` (`--lg-*`) |
| `AquaTerra Feed.dc.html` → `3b` rails | `frontend/src/public/HomePage.tsx` (LeftRail, RightRail), `frontend/src/styles/routes/home.css` |
| Brand mark in every capsule | `frontend/public/stamp-white.png`, `frontend/public/stamp-ink.png` (square 256x256; `logo.png` is a wordmark and is the bug) |
| Icons across `1a` / `1b` / `1c` / `3a` / `3b` | `frontend/src/components/v6Shared.tsx` (the `I` set, `VerifiedTick`, `LikeButton`) |
| `AquaTerra Feed.dc.html` → `4a` desk landing, desktop | `frontend/src/director/DirectorDashboard.tsx`, `frontend/src/director/DirectorLanding.tsx`, `frontend/src/director/DirectorDashboard.css` |
| `AquaTerra Feed.dc.html` → `4b` desk landing, phone | same, plus `frontend/src/styles/routes/director.css` phone blocks |
| `AquaTerra Feed.dc.html` → `4c` queue table | `frontend/src/director/adminKit.tsx`, `frontend/src/director/AccountApprovals.tsx`, `frontend/src/styles/routes/director.css` |
| `changelog/06-hod-desk.md` | `frontend/src/director/DirectorDashboard.tsx` + `.css`, `DirectorLanding.tsx`, `adminKit.tsx`, `frontend/src/styles/routes/director.css` |
| `changelog/SOCIAL-ENGINE.md` | `frontend/src/feed/*`, `frontend/src/services/notificationService.ts`, `frontend/src/hooks/useFeedCardBatch.ts`, `frontend/src/lib/gridRecipes.ts`, `ARCHITECTURE.md` |
| `AquaTerra Feed.dc.html` → `5a` composer | `frontend/src/feed/CreatePostModal.tsx`, `frontend/src/lib/categories.ts` |
| `AquaTerra Feed.dc.html` → `5b` / `5c` post detail | `frontend/src/feed/PostPage.tsx`, `frontend/src/feed/post/*`, `frontend/src/components/PostFocusModal.tsx`, `frontend/src/feed/FeedPostCard.tsx` (comment sheet) |
| `changelog/03-post-detail-and-compose.md` | `frontend/src/feed/PostPage.tsx` + CSS, `feed/post/*`, `feed/CreatePostModal.tsx`, `components/PostFocusModal.tsx`, `lib/uiHelpers.ts` |
| `AquaTerra Feed.dc.html` → `6a` / `6b` own profile | `frontend/src/profile/ProfilePage.tsx`, `AchievementsList.tsx`, `HoursAndCertificateCard.tsx`, `CvCard.tsx`, `BreakModal.tsx`, `frontend/src/styles/routes/profile.css` |
| `AquaTerra Feed.dc.html` → `6c` public profile | `frontend/src/profile/PublicProfilePage.tsx` |
| `changelog/04-profile.md` | `frontend/src/profile/*` (10 files), `frontend/src/styles/routes/profile.css` |
| `AquaTerra Feed.dc.html` → `8a` / `8b` members directory | `frontend/src/public/MembersPage.tsx`, `frontend/src/public/MembersPage.css`, `frontend/src/public/DirectoryPage.tsx`, `frontend/src/lib/roles.ts` |
| `AquaTerra Feed.dc.html` → `9a` / `9b` everything directory | `frontend/src/public/DirectoryPage.tsx` (7 sections: posts, projects, blogs, teams, members, open roles, AQ Labs), `frontend/src/public/LabsPage.tsx`, `frontend/src/public/PublicProjectsPage.tsx` |
| `AquaTerra Feed.dc.html` → `10a` onboarding | `frontend/src/public/OnboardingPage.tsx` (PROJECT array with per-item `rot`), `frontend/src/public/AboutPage.tsx` (marquee facts), `frontend/src/public/JoinPromoPage.tsx` (hours-are-attendance wording), `frontend/src/lib/orgFacts.ts` |
| `AquaTerra Feed.dc.html` → `11a` / `11b` sticker system | `frontend/src/styles/v6.css` (`.sticker`), `frontend/src/styles/tokens.css` |
| `AquaTerra Feed.dc.html` → `12a` / `12b` footer | `frontend/src/components/AQFooter.tsx`, `frontend/src/styles/v6.css` L530–766, `.px-banner__*` |
| `changelog/14-footer.md` | `components/AQFooter.tsx`, new `styles/footer.css`, `styles/v6.css` (deletions), `services/notificationService.ts` |
| `AquaTerra Feed.dc.html` → `13a` / `13b` card set | `frontend/src/lib/feedShape.ts`, `frontend/src/feed/cards/*`, `frontend/src/feed/FeedPostCard.tsx`, `frontend/src/lib/uiHelpers.ts` |
| `changelog/15-post-cards.md` | `feed/cards/*` (30 components + registry + CardCatalogue), `feed/FeedPostCard.tsx`, `styles/routes/feed.css` |
| `AquaTerra Feed.dc.html` → `14a` / `14b` desk nav + jigsaw | `frontend/src/director/DirectorDashboard.tsx` + `.css`, `DirectorLanding.tsx`, `styles/routes/director.css`, `adminKit.tsx` |
| `changelog/17-desk-nav-and-stats.md` | `director/DirectorDashboard.tsx` + `.css`, `director/DirectorLanding.tsx`, `styles/routes/director.css`, `director/adminKit.tsx` |
| `AquaTerra Feed.dc.html` → `15a` About manifesto | `frontend/src/public/AboutPage.tsx`, `docs/BRAND_VOICE.md`, `frontend/src/lib/orgFacts.ts`, `frontend/src/lib/metaConfig.ts`, `frontend/index.html` |
| `changelog/09-about.md` | `public/AboutPage.tsx` + CSS, `lib/metaConfig.ts`, `lib/orgFacts.ts`, `index.html` JSON-LD |
| `AquaTerra Feed.dc.html` → `16a`–`16c` teams + openings | `frontend/src/public/TeamsPage.tsx`, `TeamDetailPage.tsx`, `OpportunitiesPage.tsx`, `DirectoryPage.tsx`, `JoinPromoPage.tsx` |
| `changelog/05-teams-and-openings.md` | `public/TeamsPage.tsx`, `TeamDetailPage.tsx`, `OpportunitiesPage.tsx`, `ApplyPage.tsx`, `lib/departments.ts` |
| `AquaTerra Feed.dc.html` → `17a` / `17b` search | `frontend/src/search/SearchPage.tsx`, `frontend/src/public/SavedPage.tsx`, `NotificationsPage.tsx`, `DirectoryPage.tsx` |
| `changelog/08-search-saved-notifications.md` | `search/SearchPage.tsx` + CSS, `public/SavedPage.tsx`, `public/NotificationsPage.tsx`, `public/MembersPage.tsx`, `public/DirectoryPage.tsx` |
| `AquaTerra Feed.dc.html` → `18a`–`18c` contact + auth | `frontend/src/auth/LoginPage.tsx`, `SignupPage.tsx`, `frontend/src/public/ContactPage.tsx`, `CollaborationsPage.tsx`, `frontend/src/components/AQMascot.tsx` |
| `changelog/07-auth-and-contact.md` | `auth/*`, `public/ContactPage.tsx`, `components/AQMascot.tsx`, `styles/tokens.css` (`--danger-lift`) |
| `AquaTerra Feed.dc.html` → `19a` / `19b` projects | `frontend/src/public/ProjectsPage.tsx`, the drive detail route, `frontend/src/public/DirectoryPage.tsx`, `frontend/src/lib/feedShape.ts` (principle) |
| `changelog/10-projects.md` | `public/ProjectsPage.tsx` + CSS, drive/project detail route, `public/DirectoryPage.tsx` |
| `AquaTerra Feed.dc.html` → `20a` / `20b` profile wall | **new:** `frontend/src/profile/Wall*`, `services/wallService.ts`, `profile_notes` table · **edited:** `ProfilePage.tsx`, `PublicProfilePage.tsx`, `lib/profanity.ts` (reuse) |
| `changelog/16-profile-wall.md` | new wall components + service + table; `ProfilePage.tsx`, `PublicProfilePage.tsx` |
| `AquaTerra Feed.dc.html` → `21a` / `21b` guided demos | **new:** `frontend/src/demo/*` · **reads:** `frontend/src/services/*`, `frontend/src/App.tsx`, auth context |
| `changelog/13-sticker-system.md` | `components/Sticker.tsx` (new), `styles/v6.css`, `lib/uiHelpers.ts` |
| `changelog/18-mascots-and-motion.md` | `components/AQMascot.tsx`, `components/Companion.tsx` (new), `feed/*`, `styles/v6.css` |
| `changelog/19-guided-demos.md` | `frontend/src/demo/*` (new), `App.tsx`, auth context, `lib/metaConfig.ts` |
| `changelog/11-system-states.md` | `components/EmptyState.tsx`, `ErrorBoundary`, `Confirm.tsx`, `Toast`, `director/adminKit.tsx`, every form |
| `changelog/12-secondary-pages.md` | `public/BlogListPage.tsx`, `BlogPostPage.tsx`, `LabsPage.tsx`, `ClassesPage.tsx`, `DirectoryPage.tsx`, `JoinPromoPage.tsx`, `BrandPage.tsx`, `EquityPolicyPage.tsx`, `EditProfilePage.tsx` |
| `changelog/20-admin-desks.md` + turn `22a` | `frontend/src/director/*` (the 20 desks) |
| `changelog/START-HERE.md` | the whole repo — entry document |
| `changelog/WORKFLOW.md` + `TESTS.md` | the whole repo — process and verification |
| `changelog/21-org-facts.md` | `frontend/src/lib/orgFacts.ts`, `scripts/compute-org-facts.mjs` (new), `frontend/index.html` JSON-LD, `lib/metaConfig.ts` |
| `changelog/AUDIT.md` + `ACCEPTANCE.md` | the whole repo — enforcement |
| `AquaTerra Feed.dc.html` → `23a` / `23b` social engine | `services/notificationService.ts`, `public/NotificationsPage.tsx`, `feed/*`, `lib/gridRecipes.ts`, `lib/metaConfig.ts`, `hooks/useMeta.ts` |
| `changelog/22-social-engine.md` | notification service + page, feed tabs, the pending state, comments, profile recognition, share cards |
| Design tokens throughout | `frontend/src/styles/tokens.css`, `frontend/src/styles/v6.css`, `frontend/src/index.css`, `frontend/DESIGN_SPEC.audit.md`, `design-reference/HANDOFF-SPEC.md` |
| `changelog/00-global-tokens-and-primitives.md` | `frontend/src/styles/tokens.css`, `frontend/src/styles/v6.css`, `frontend/src/index.css` |
| `changelog/01-home-feed.md` | `frontend/src/public/HomePage.tsx`, `frontend/src/feed/FeedPostCard.tsx`, `frontend/src/styles/routes/home.css`, `frontend/src/styles/routes/feed.css` |
| `changelog/02-global-chrome.md` | `frontend/src/components/AQNav.tsx` + `.css`, `frontend/src/components/MobileMenuBar.tsx`, `frontend/src/styles/routes/nav-mobile.css`, `frontend/src/components/AQFooter.tsx` + `.css`, `frontend/src/styles/footer.css` |

## Notes

- `src/paradox/**` is a separate event sub-app with its own theme and is explicitly out of scope.
- Fonts and photography copied into `assets/` from `frontend/public/fonts/` and `images/`.
- Architecture and design context read from `ARCHITECTURE.md`, `frontend/DESIGN_SPEC.audit.md`,
  `design-reference/HANDOFF-SPEC.md`, `design-reference/README.md`, `frontend/src/lib/categories.ts`.
