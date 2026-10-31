# Design audit — fix tracking

Working list compiled from ALL 49 audit files (not just `INDEX.md`'s abbreviated top-11
scoreboard, which omits several real P0/P1s found in `00-shared-shell.md`,
`home-feed.md`, `team-detail.md`, `contact.md`, `volunteer-handbook.md`,
`collaborations.md`, `projects-list.md`, `blog-post.md`, `about.md`, `faq.md`, and
`teams-list.md`). Per `/goal read all md files and fix everything`: working P0 → P1 →
P2, code fixes only — a few items are real policy/business decisions, not code bugs,
and are marked as such rather than guessed at.

Status legend: ⬜ not started · 🔧 in progress · ✅ fixed & verified · ⚠️ flagged, not
a code fix (needs a human/org decision) · ⏭️ skipped (reason given)

## P0 — broken/blocking/harmful

| # | Finding | File(s) | Status |
|---|---|---|---|
| 1 | Quick Links "Crftd" card links to `/support` instead of `/crftd` | `QuickLinksPage.tsx` | ✅ |
| 2 | Crftd: priced "in-stock" products behind a permanently disabled "shop soon" button | `RootsPage.tsx` | ✅ now a real link to @ngo.aquaterra ("notify me ↗") instead of a dead disabled button |
| 3 | Home: two parallel `FeedPostCard` implementations, the unmaintained one shown on empty/error | `HomePage.tsx`, `feed/FeedPostCard.tsx` | ✅ local duplicate deleted, sample fallback now renders through the real shared card with safe no-op like/save state |
| 4 | Shared shell: "explore" quick-menu omits About, has no full list on mobile | `AQNav.tsx` | ✅ About was already present; mobile drawer expanded from 7 to 16 links for parity with the desktop mega menu |
| 5 | Shared shell: 3 hamburger-shaped buttons wired to identical state | `AQNav.tsx` | ✅ removed the confirmed-dead left hamburger (CSS always hid it); 2 real triggers remain, correctly mutually exclusive by breakpoint |

## P1 — real friction

| # | Finding | File(s) | Status |
|---|---|---|---|
| 6 | Equity Policy: 5 HR members' personal phone numbers published publicly | `EquityPolicyPage.tsx` | ⏭️ user decision: leave as-is |
| 7 | Edit Profile: email field editable, contradicts Register's "locked to Google" copy | `EditProfilePage.tsx` | ✅ locked + removed from the write payload (was actually writing email drift silently) |
| 8 | Search: type filter doesn't lift the result render cap | `SearchPage.tsx` | ✅ caps lift to 20 (the service's real per-type limit) once a single type is active |
| 9 | SOPs & Goals: inverted P1/P3 urgency convention, no on-screen legend | `SopManagement.tsx` | ✅ flipped per user (P1 = hottest now) — ⚠️ **needs a one-time data relabel on existing live goal rows**, see the comment in the file; not run from here per the manual-migration convention |
| 10 | Moderation queues: inconsistent reject-friction across 3 desks | `AccountApprovals.tsx`, `PostModeration.tsx`, `AchievementReviews.tsx` | ✅ (background agent, verified complete despite a rate-limit "failed" status) required-note now consistent across all three |
| 11 | Members directory: role filter omits `lead`/`super_admin` | `MembersPage.tsx` | ✅ All/Members/Leads/HoDs/Leadership |
| 12 | Support: "we don't take donations" buried at page bottom | `SupportPage.tsx` | ✅ already resolved live — hero already states it |
| 13 | Onboarding (`/welcome`): no discoverable entry point anywhere | `LoginPage.tsx` (add link) | ✅ "take the tour →" added to Login's footer |
| 14 | Shared shell: `Modal` has no close button when `title` is empty (breaks `JoinRequestModal` post-submit) | `Modal.tsx` | ✅ close control always renders now |
| 15 | Shared shell: "Apply →" shown to returning members who just want to log in | `AQNav.tsx` | ✅ reuses the existing `aq_visited` flag, "Log in →" for returning visitors across all 3 CTA spots |
| 16 | Home: mandatory full-screen `HomeIntro` delays first-time visitors | `HomeIntro.tsx` | ✅ sweep cut 2600ms→1100ms, scroll never locked, whole overlay (not just the skip link) now dismisses on tap — 2026-09-09 |
| 17 | Home: join CTA "replies within a week" copy vs. real OAuth+approval flow | `HomePage.tsx`, `MembersPage.tsx` | ✅ content matched `APPROVAL_TIME` already; both call sites were hardcoded literals instead of importing the constant like every other instance — fixed to interpolate it, closing the drift risk — 2026-09-09 |
| 18 | Team Detail: About-tab activity ticker not actually date-interleaved | `TeamDetailPage.tsx` | ✅ real merge+sort by createdAt/workshop_date, done myself after agent hit rate limit with zero progress |
| 19 | Contact: `mailto:` fallback popup can be silently blocked (2 awaits before `window.open`) | `ContactPage.tsx` | ✅ toast copy no longer assumes the popup succeeded, leads with the "reopen the draft" button |
| 20 | Volunteer Handbook: duplicate hand-written FAQ vs `/faq` | `VolunteerHandbookPage.tsx`, `FAQPage.tsx` | ✅ new `lib/faqData.ts` is the single source; the genuinely-identical "fee" question merged, the approval question deliberately kept as two page-appropriate depths (both still pulling the one `APPROVAL_TIME` constant) so the handbook's extra detail wasn't dropped. Also added the missing `/opportunities` link on "Team inductions". |
| 21 | Collaborations: static partner wall vs. live collab-projects rail, two sources of truth | `CollaborationsPage.tsx` | ✅ wall now derived from the same live query as the projects rail, done myself after agent hit rate limit with zero progress |
| 22 | Projects directory: dept chip ticker mixes filter/nav/login destinations, no visual cue | `PublicProjectsPage.tsx` | ✅ each chip now carries the site's own marker (↗ external / → leaves this page / · filters in place) + an accurate title |
| 23 | Projects directory: "see all drives →" changes filter without scrolling to it | `PublicProjectsPage.tsx` | ✅ scrolls the stream into view (reduced-motion aware) |
| 24 | Blog Post: every post has an empty body, "read the story" undeliverable | `BlogPostPage.tsx` | ⚠️ content gap, not a code bug — fallback card already handles it honestly |
| 25 | About: 8 department cards all navigate to the same generic `/teams` | `AboutPage.tsx` | ✅ TeamsPage now reads `?category=`, About links each card to its real department filter |
| 26 | FAQ: 10 questions for 2 different intents, one flat unsectioned list | `FAQPage.tsx` | ✅ split into "thinking about joining" / "once you're in" clusters |
| 27 | Teams list: `SAMPLE_TEAMS` fallback ships fabricated member counts, contradicting the page's own "nothing invents a number" rule | `TeamsPage.tsx` | ✅ all sample counts zeroed, fallback now gets the same honest "taking applications" treatment |

## New items from fix-recommendations/ (found on disk, not in the original 27)
| # | Finding | File(s) | Status |
|---|---|---|---|
| 28 | Dead `CategoryFilter.tsx` component (documented AA contrast failure), only 2 data exports actually used | `feed/CategoryFilter.tsx` | ✅ removed, kept the 2 live exports |
| 29 | Permanent "NEW" badge on HoD Desk nav link, never clears (unlike the pulse dot beside it) | `AQNav.tsx` | ✅ removed |
| 30 | Public Profile: two stacked "join AquaTerra" CTAs for logged-out visitors | `PublicProfilePage.tsx` | ✅ hero CTA removed, banner (richer copy) kept |
| 31 | `ManagePopover` comment backwards re: `OpeningFormModal`'s brand-shell guidance | `OpportunitiesPage.tsx` | ✅ comment corrected + switched off the fragile `--hod-*` fallback pattern to plain brand tokens |

## Questions asked back to the user (2026-09-02)
- #6 (Equity Policy phone numbers): asked whether to keep, swap for a shared HR contact, or leave as-is.
- #9 (SOPs urgency convention): asked whether the inverted P1/P3 scale is deliberate (add a legend) or should be flipped to match convention.

## P2 — polish (only after P0/P1 are through)
Tracked per-file in `design-audit/`; will sweep these after the above if time/budget
allows. Not itemized here individually to keep this list actionable.

## Notes
- Every fix gets `tsc -b` + `npm run build` clean before moving on, per house convention.
- Items marked ⚠️ are flagged for the user/org, not silently worked around.
