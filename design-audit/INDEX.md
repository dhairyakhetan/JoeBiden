# AquaTerra Design Audit — Index

Full page-by-page audit of `vercelaq-main` (the live `frontend/src`), organized in `design-audit/`. Paradox (`/paradox/*`) is out of scope. ~60 pages/screens across 49 files. Every file uses the intent-driven affordance lens from `00-AUDIT-FRAMEWORK.md`: name the user's actual intent, then check whether the page's hierarchy, labels, and controls actually serve it.

## Folder map

- `00-AUDIT-FRAMEWORK.md` — the lens and severity legend
- `00-shared-shell.md` — nav, footer, layouts, Button/Card/Modal/EmptyState
- `01-public/` — 13 files: marketing & static pages (Home/Feed through Equity/Privacy Policy)
- `02-content/` — 6 files: Thank You, Blog, Projects, Post permalink
- `03-community/` — 5 files: Members, Profile, Teams, Opportunities
- `04-auth/` — 7 files: Login through Settings, incl. Auth Callback
- `05-member-app/` — 8 files: Notifications, Saved, My Posts, Profile(self)/Edit, Search, Calendar, Yearbook
- `06-hod-desk/` — 7 files covering all 14 director/HoD desks + the shell/landing
- `07-misc/` — 404, Brand reference, Drive check-in/wrap tools

## The headline finding: this codebase already holds itself to the standard this audit measures against

Almost every file in this pass documents its *own* past fix, in its own words, for exactly the kind of fault this audit looks for — a fabricated stat, a dead-looking affordance, a copy promise contradicted one screen later. That is unusual. Most of what follows is therefore not "here are bugs nobody noticed" — it's "here is where the same discipline slipped, once, in an otherwise very disciplined codebase," plus a short list of real, fresh findings.

## Recurring faults (cross-page patterns)

### 1. Two independent implementations of one feature, at risk of silent drift
The most repeated fault shape in the whole audit. Concrete instances:
- **Home** (`01-public/home-feed.md`): a local, ~600-line `FeedPostCard` duplicate lives inside `HomePage.tsx` alongside the shared `feed/FeedPostCard.tsx` — and the duplicate is the one shown on empty/error states, the least-exercised path.
- **Volunteer Handbook** (`04-auth/onboarding.md` — no, see `01-public/volunteer-handbook.md`): its own 8-question FAQ set duplicates `/faq`'s content in different wording, unlinked, for several of the same questions.
- **Blog Post** (`02-content/blog-post.md`): the careful paragraph-rendering/verse-detection logic is currently exercised by zero live posts (every post today has an empty body), so a regression there would ship silently.
- **Teams list** (`03-community/teams-list.md`): the honest "taking applications" fallback is what every real team card shows today; the richer "★ N strong" treatment is unexercised by current data.

**Pattern to fix going forward:** when a display component's real, most-visited state and its fallback/error state diverge into separate code, the fallback rots first.

### 2. A count or label implies more than the affordance can actually reach
- **Search** (`05-member-app/search.md`): filtering to one result type doesn't lift the render cap, so the chip's own count lies about reachability.
- **Projects directory** (`02-content/projects-list.md`): "see all drives" changes a filter without scrolling to it.
- **Home** (`01-public/home-feed.md`): department cards promise a specific destination, several just navigate to `/teams` generically.
- **Contrast, done right:** `ProjectManager` (`06-hod-desk/05-yearbook-content-projects.md`) caps a 558-row table at 60 visible rows but explicitly filters the *whole* list first and states both numbers ("showing 60 of 340 matched · 558 total") — the reference implementation for this exact problem.

### 3. Mismatched destination for a clearly-labeled control
- **Quick Links** (`01-public/quick-links.md`, **P0**): the "Crftd" ways-in card links to `/support`, not `/crftd`.
- **Projects directory** (`02-content/projects-list.md`): department chips mix in-page filters, cross-page navigation, and a login redirect behind visually identical controls.

### 4. Inconsistent confirmation friction across near-identical destructive actions
Three sibling moderation queues (`06-hod-desk/01-approvals-posts-achievements.md`) reject applicants/posts/achievements — same shape, same stakes (notify + remove from queue) — with three different rules: one requires a note *and* a hold-to-confirm, one requires a note with a plain click, one requires nothing at all.

### 5. The role vocabulary gap (public directory vs. real data)
`/members`' role filter (`03-community/members.md`) offers `member/hod/director`, omitting `lead` and `super_admin` — and per this project's own architecture notes, the "director" role has zero live members while 15 real people hold `super_admin`, unreachable through any public filter. Confirmed independently from the admin side in `06-hod-desk/02-blog-members-categories.md`, where the internal tooling correctly lists all five real roles.

### 6. A few standalone, concrete items worth fixing directly
- **Equity Policy** (`01-public/equity-privacy-policy.md`, **P1**, safety not just design): five HR team members' personal phone numbers are published on an unauthenticated, crawlable page.
- **Edit Profile** (`05-member-app/edit-profile.md`, **P1**): the email field is a normal editable input, directly contradicting Register's stated "locked to your Google account" policy.
- **Crftd** (`01-public/crftd.md`, **P0**): "in-stock" products with real prices sit behind a permanently disabled "shop soon" button.
- **SOPs & Goals** (`06-hod-desk/03-teams-sops-drives.md`, **P1**): urgency labels invert the near-universal P1-is-highest convention with no on-screen correction.
- **Support** (`01-public/support.md`, **P1**): the page's single most important fact ("we don't take donations") is the last thing on it, after four cards that could easily be read as donation options.

## Recurring strengths (worth protecting, and propagating to the few gaps above)

- **Anti-fabrication as a house style.** `DirectorLanding`, `CertificateRequests`, `ProfilePage`, `TeamsPage`, `SopManagement`, and `PendingApprovalPage` all separately implement the same principle in their own words: never show a number, badge, or document that isn't real, and say plainly when data is genuinely absent rather than approximating it.
- **`.select('id')` + zero-row check** to catch a silently RLS-blocked write, instead of trusting "no error" as "it worked" — repeated across `FormResponses`, `ProjectManager`, `MemberDirectory`, and others independently.
- **Optimistic UI with toast-after-resolution, not before** — several feed/profile interactions specifically avoid the "green success toast immediately followed by a red failure toast" contradiction.
- **Per-row/per-item busy state, never a desk-wide lock** — `CategoryManagement`, `DirectorManagement`, `HiringResponses`, and others explicitly guard against one action freezing an unrelated row.
- **Centralized shared facts** (`lib/orgFacts.ts`) after a real, documented history of copy drift (founding year, approval time) — now sourced once everywhere it's quoted.
- **The "what happens when I press this" instinct** — Login, Register, Teams, and Opportunities all explicitly diagnose and fix a bounce caused by an unstated consequence, not a hard-to-find button.

## Scoreboard (P0 / P1 findings only, for a quick fix pass)

1. Quick Links — Crftd card links to `/support` instead of `/crftd` (P0)
2. Crftd — disabled "shop soon" on priced, "in-stock" products (P0)
3. Home — two parallel `FeedPostCard` implementations (P0)
4. Equity Policy — personal phone numbers published publicly (P1, safety)
5. Edit Profile — email field contradicts Register's "locked" policy (P1)
6. Search — type filter doesn't lift the result cap (P1)
7. SOPs & Goals — inverted urgency convention, uncorrected on-screen (P1)
8. Moderation queues — inconsistent reject-friction across 3 desks (P1)
9. Members directory (public) — role filter omits `lead`/`super_admin` (P1)
10. Support — donation clarification buried at the page bottom (P1)
11. Onboarding — the most energetic, on-brand page in the app has no discoverable entry point (P1)

## Next: fix-recommendations pass

Per direction given: weight function fixes and "energy/boldness" polish equally; keep the scrapbook/sticker motifs, executed tighter and bolder rather than removed; organize the next document both per-page and as a thematic summary up top.
