# §63 — Architecture audit: what exists today

**Date:** 2026-09-03
**Scope:** `frontend/` only. `frontend/src/paradox/**` is excluded throughout (separate sub-app, own Supabase project, own Nav/Footer/AuthProvider/ToastProvider).
**Purpose:** map the existing product before an adaptive/personalisation layer is designed. No recommendations, no proposals.
**Method:** read of `CLAUDE.md`, `REDESIGN_GUARDRAILS.md`, `frontend/src/App.tsx`, `frontend/src/lib/database.types.ts`, the `services/*.ts` and `lib/*.ts` query layer, `components/`, `feed/`, `director/adminKit.tsx`, `scripts/generate-sitemap.mjs`, `scripts/prerender-meta.mjs`, `vercel.json`, `frontend/index.html`, `public/robots.txt`.

Anything not directly read is marked **[not verified in this pass]** with the file needed to close it.

---

## 1. Framework and routing

React 19 + TypeScript + Vite. `react-router-dom` `BrowserRouter`. No API server: the browser talks to Supabase directly (`@supabase/supabase-js`).

Every route component except four is lazy-loaded via `lazyWithRetry` (`frontend/src/lib/lazyWithRetry.ts`), which wraps `React.lazy` with a one-reload-per-10s recovery for failed dynamic imports.

**Eager (loaded on every route):** `auth/ProtectedRoute.tsx`, `auth/HomeRoute.tsx`, `components/PublicLayout.tsx`, `components/DashboardLayout.tsx`. Also eager but mounted outside `<Routes>`: `components/ConfettiBurst.tsx`, `components/FirstRunController.tsx`, `components/Mascot.tsx`, `components/BirthdayPopup.tsx`, `components/Toast.tsx`, `components/Confirm.tsx`, `components/ErrorBoundary.tsx`.

### Route table (`frontend/src/App.tsx`)

`P` = prerendered to static HTML by `scripts/prerender-meta.mjs`. `S` = listed in `sitemap.xml`.

#### Group A — `<PublicLayout>` (AQNav + AQFooter + MobileMenuBar + ContactNudge), no gate

| # | Path | Component | Load | Gate | P | S |
|---|---|---|---|---|---|---|
| 1 | `/` | `auth/HomeRoute.tsx` → `public/HomePage.tsx` | eager route, lazy page | public (branches on auth) | body-only¹ | ✔ |
| 2 | `/everything-we-do` | `EverythingWeDoRedirect` (inline) → `/projects` + hash | eager | public | — | — |
| 3 | `/projects` | `public/PublicProjectsPage.tsx` | lazy | public | ✔ | ✔ |
| 4 | `/projects/:slug` | `public/PublicProjectDetailPage.tsx` | lazy | public | ✔ per-record | ✔ |
| 5 | `/blog` | `public/BlogListPage.tsx` | lazy | public | ✔ | ✔ |
| 6 | `/blog/:slug` | `public/BlogPostPage.tsx` | lazy | public | ✔ per-record | ✔ |
| 7 | `/support` | `public/SupportPage.tsx` | lazy | public | ✔ | ✔ |
| 8 | `/equity-policy` | `public/EquityPolicyPage.tsx` | lazy | public | ✔ | ✔ |
| 9 | `/privacy-policy` | `public/PrivacyPolicyPage.tsx` | lazy | public | ✔ | ✔ |
| 10 | `/thank-you` | `public/ThankYouPage.tsx` | lazy | public | — | — |
| 11 | `/volunteer` | `public/VolunteerHandbookPage.tsx` | lazy | public | ✔ | ✔ |
| 12 | `/volunteer-handbook` | `<Navigate to="/volunteer">` | eager | public | — | — |
| 13 | `/volunteer-handbook/edit` | `<Navigate to="/volunteer">` | eager | public | — | — |
| 14 | `/links` | `public/QuickLinksPage.tsx` | lazy | public | ✔ | ✔ |
| 15 | `/recruitment` | `<Navigate to="/login">` | eager | public | — | — |
| 16 | `/volunteer/apply` | `<Navigate to="/login">` | eager | public | — | — |
| 17 | `/collaborations` | `public/CollaborationsPage.tsx` | lazy | public | ✔ | ✔ |
| 18 | `/contact` | `public/ContactPage.tsx` | lazy | public | ✔ | ✔ |
| 19 | `/faq` | `public/FAQPage.tsx` | lazy | public | ✔ | ✔ |
| 20 | `/about` | `public/AboutPage.tsx` | lazy | public | ✔ | ✔ |
| 21 | `/opportunities` | `public/OpportunitiesPage.tsx` | lazy | public | ✔ | ✔ |
| 22 | `/opportunities/:id` | `public/OpeningDetailPage.tsx` | lazy | public | ✘ by design | ✔ (open only) |
| 23 | `/schools` | `public/SchoolsPage.tsx` | lazy | public | ✔ | ✔ |
| 24 | `/classes` | `public/ClassesPage.tsx` | lazy | public | ✔ | ✔ |
| 25 | `/crftd` | `public/RootsPage.tsx` | lazy | public | ✔ | ✔ |
| 26 | `/roots` | `<Navigate to="/crftd">` | eager | public | — | — |
| 27 | `/members` | `public/MembersPage.tsx` | lazy | public | ✔ | ✔ |
| 28 | `/member/:uuid` | `profile/PublicProfilePage.tsx` | lazy | public | ✘ (privacy) | ✘ (privacy) |
| 29 | `/post/:uuid` | `feed/PostPage.tsx` | lazy | public | ✘ | ✘ |
| 30 | `/teams` | `teams/TeamsPage.tsx` | lazy | public | ✔ | ✔ |
| 31 | `/teams/:uuid` | `teams/TeamDetailPage.tsx` | lazy | public | ✔ per-record | ✔ |
| 32 | `/login` | `auth/LoginPage.tsx` | lazy | public | — | robots-Disallow |
| 33 | `/auth/callback` | `auth/AuthCallbackPage.tsx` | lazy | public | — | robots-Disallow |
| 34 | `/register` | `RegisterGate` (inline) → `auth/RegisterPage.tsx` | lazy page | **authenticated** (else → `/login`) | — | robots-Disallow |
| 35 | `/welcome` | `public/OnboardingPage.tsx` | lazy | public, unlisted | — | robots-Disallow |
| 36 | `/brand` | `public/BrandPage.tsx` | lazy | public, unlisted | — | robots-Disallow |
| 37 | `/dev/components` | `dev/ComponentGallery.tsx` | lazy | **`import.meta.env.DEV` only** | — | — |
| 38 | `/pending` | `auth/PendingApprovalPage.tsx` | lazy | public | — | — |
| 39 | `/rejected` | `auth/RejectedPage.tsx` | lazy | public | — | — |

¹ `/` is deliberately **not** head-rewritten (its `<head>` in `index.html` is hand-tuned and carries all three org JSON-LD blocks), but `dist/index.html` **is** given a prerendered `<body>`.

#### Group B — outside both layouts

| # | Path | Component | Load | Gate |
|---|---|---|---|---|
| 40 | `/feed` | `<Navigate to="/">` | eager | public |
| 41 | `/arcade/*` | `<Navigate to="/">` | eager | public |
| 42 | `/drive/:id/check-in` | `drives/DriveCheckIn.tsx` | lazy | `requireActive` + an in-component check that the member is the drive's assigned lead |
| 43 | `/drive/:id/wrap` | `drives/DriveWrap.tsx` | lazy | `requireActive` (+ in-component) |
| 44 | `/paradox/*` | `paradox/ParadoxRoot.tsx` | lazy | out of scope |
| 45 | `*` | `pages/NotFoundPage.tsx` inside `PublicLayout` | lazy | public |

#### Group C — `<ProtectedRoute requireActive><DashboardLayout/>`

| # | Path | Component | Load |
|---|---|---|---|
| 46 | `/notifications` | `feed/NotificationsPage.tsx` | lazy |
| 47 | `/saved` | `feed/SavedPostsPage.tsx` | lazy |
| 48 | `/my-posts` | `feed/MyPostsPage.tsx` | lazy |
| 49 | `/profile` | `<Navigate to="/profile/me">` | eager |
| 50 | `/profile/me` | `profile/ProfilePage.tsx` (`isOwn`) | lazy |
| 51 | `/profile/edit` | `profile/EditProfilePage.tsx` | lazy |
| 52 | `/profile/:uuid` | `profile/ProfilePage.tsx` | lazy |
| 53 | `/search` | `search/SearchPage.tsx` | lazy |
| 54 | `/settings` | `auth/SettingsPage.tsx` | lazy |
| 55 | `/calendar` | `calendar/CalendarPage.tsx` | lazy |
| 56 | `/yearbook` | `yearbook/YearbookPage.tsx` | lazy |

#### Group D — `<ProtectedRoute requireDirector><DashboardLayout/>` → `director/DirectorDashboard.tsx` (layout with `<Outlet/>`)

All 18 tab components are individually lazy-imported.

| # | Path | Component | Extra gate |
|---|---|---|---|
| 57 | `/director` (index) | `director/DirectorLanding.tsx` | — |
| 58 | `/director/approvals` | `director/AccountApprovals.tsx` | — |
| 59 | `/director/posts` | `director/PostModeration.tsx` | — |
| 60 | `/director/achievements` | `director/AchievementReviews.tsx` | — |
| 61 | `/director/blogs` | `director/BlogDrafts.tsx` | — |
| 62 | `/director/members` | `director/MemberDirectory.tsx` | — |
| 63 | `/director/categories` | `director/CategoryManagement.tsx` | — |
| 64 | `/director/teams` | `director/TeamManagement.tsx` | — |
| 65 | `/director/sops` | `director/SopManagement.tsx` | — |
| 66 | `/director/drives` | `director/DriveManagement.tsx` | — |
| 67 | `/director/hiring` | `director/HiringResponses.tsx` | — |
| 68 | `/director/enquiries` | `director/FormResponses.tsx` | — |
| 69 | `/director/certificates` | `director/CertificateRequests.tsx` | — |
| 70 | `/director/yearbook` | `director/YearbookManagement.tsx` | — |
| 71 | `/director/content` | `director/ContentManager.tsx` | **`requireSuperAdmin`** |
| 72 | `/director/projects` | `director/ProjectManager.tsx` | **`requireSuperAdmin`** |
| 73 | `/director/directors` | `director/DirectorManagement.tsx` | **`requireSuperAdmin`** |
| 74 | `/director/volunteers` | `director/VolunteerApplications.tsx` | **`requireSuperAdmin`** |

**Count: 74 `<Route>` path entries.** Of those: 8 are pure `<Navigate>` redirects, 1 is DEV-only, 1 delegates to the excluded Paradox sub-app, 1 is the catch-all 404. **63 real destinations.**

### Gate mechanics (`frontend/src/auth/ProtectedRoute.tsx`)

Checks run in this order and every one is a redirect, not a message:

```
!isAuthenticated || !member        → /login  (state.from preserved)
!member.class_grade                → /register
member.status === 'suspended'      → /rejected
requireActive: pending_approval    → /pending
requireActive: rejected            → /rejected
requireActive: status !== 'active' → /login
requireDirector && !hasLeaderAccess(role) → /
requireSuperAdmin && role !== 'super_admin' → /director
```

`requireSuperAdmin` is enforced twice on purpose — per-route above, and as a `superOnly` flag in `DirectorDashboard.tsx`'s `NAV_GROUPS` (line ~196: `if (item.superOnly && !isSuperAdmin) return false`). CLAUDE.md records that having only one of the two was a real, shipped privilege-escalation bug.

### Prerendering and the SPA rewrite

`frontend/package.json` build chain:
```
verify-routing.mjs → generate-sitemap.mjs → tsc -b → vite build → verify-sitemap.mjs → prerender-meta.mjs
```

`vercel.json` sets `cleanUrls: true` and the SPA catch-all `{ "source": "/(.*)", "destination": "/" }` — destination `/`, never `/index.html` (CLAUDE.md documents the 308-redirect failure mode this avoids). CSP is set in `vercel.json` headers and explicitly allows `https://*.clarity.ms` for script and connect.

---

## 2. Current information architecture

Four navigation surfaces, all rendered by the two layouts. Breakpoint reality: `.aq-bottom-bar`, `.aq-hamburger-btn` and `.aq-menu-btn` all switch at **760px** in `styles/v6.css` (guardrails §2 records this as the one deliberate exception to the three-tier 600/1024 system).

**One real inconsistency found:** the CSS breakpoint is `760px`, but `AQNav.tsx`'s `openFull()` branches on `window.innerWidth < 768`. Between 761 and 767px the desktop `MENU` button is visible and pressing "full menu" opens the *mobile drawer*, not the mega menu.

### a. Top bar — `components/AQNav.tsx` (727 lines)

Rendered by both `PublicLayout` and `DashboardLayout`, except on `/director/*` where `DashboardLayout` suppresses it (the desk has its own ops-topbar).

- **Logo** → `/`. Five clicks within 2s fires a confetti burst.
- **Centre pill (`navLinks`)** — `home` `/`, `projects` `/projects`, `teams` `/teams`. Plus `HoD Desk` → `/director`, only when `hasLeaderAccess(member?.role)`. **Desktop only** (`.aq-nav-tabs` hidden ≤760px).
- **Right actions** — search icon → `/search` (both); when authenticated: bell → `/notifications` with a live unread count (realtime `postgres_changes` subscription on `notifications` filtered to `member_id`), and an avatar menu (`Profile`, `My posts`, `Settings`, `Alerts` for directors, `Log out`). The avatar menu is **desktop only**. When unauthenticated: a single CTA → `/login`, labelled `Apply →` or `Log in →` depending on `localStorage.aq_visited`.
- **`MENU` button** — desktop only (`.aq-menu-btn { display:none }` ≤760px). **Hamburger** — mobile only. Both toggle the same `showDrop` state.

### b. Step 1 — the explore dropdown (`showDrop`), **both phone and desktop**

7 links: `home` `/`, `projects` `/projects`, `teams` `/teams`, `blog` `/blog`, `members` `/members`, `openings` `/opportunities`, `about` `/about`. Plus `hod desk` (leaders only), a `full menu ⤢` button, and a `/login` CTA when logged out.

### c. Step 2a — the mega menu (`showMega`), **desktop only**

Two columns.
- *explore* (6): `/`, `/projects`, `/teams`, `/blog`, `/members`, `/about`.
- *get involved* (8–9): `/profile/me` **or** `/login` (auth-dependent), `/opportunities`, `/brand`, `/crftd`, `https://shikshaq.in` (external, new tab), `/collaborations`, `/volunteer`, `/equity-policy`, and `/director` appended for leaders.
- Side panel: auth-dependent CTA card — `"{firstName}'s feed."` → `/` for members, `"join the chaos."` → `/login` for guests. Then Instagram, and `/faq`, `/support`, `/links`.

### d. Step 2b — the mobile drawer (`showMobileMenu`), **phone only**

`mobileSheetLinks` — 16 public destinations: `/projects`, `/teams`, `/members`, `/blog`, `/opportunities`, `/crftd`, `/volunteer`, `/collaborations`, `/schools`, `/classes`, `/about`, `/faq`, `/support`, `/contact`, `/links`, `/equity-policy`. Prepended when applicable: `hod desk`, `My posts`. Footer CTA: `notifications` (auth) or `/login` (guest). A code comment records that this list was once a shorter subset, which left 8 pages unreachable on phone.

### e. The dock — `components/MobileMenuBar.tsx`, **phone only (≤760px)**

Hidden entirely on `/login`, `/register`, `/pending`, `/rejected`, `/volunteer`, and on `/director/*` (the desk substitutes its own nav strip).

- Guest (`PUBLIC_ITEMS`, 5): `/` feed, `/projects`, `/teams`, `/blog`, `/about`.
- Member (`AUTH_ITEMS`, 4): `/` feed, `/everything-we-do` "explore", `/notifications` alerts, `/teams`.
- Leader: the alerts slot is **replaced** by `/director` "desk" — a director loses the dock's notifications entry.
- Plus `CreateLauncher variant="fab"` when authenticated.

Note: the dock's "explore" tab points at `/everything-we-do`, which is a redirect to `/projects`.

### f. Footer — `components/AQFooter.tsx`, **both**

`HiStrip` ribbon at the top edge, then 4 columns, 19 links, sequentially numbered:
- *explore*: `/projects`, `/teams`, `/members`
- *read & connect*: `/blog`, `/links`, `/search`, `/` , `/contact`
- *organisation*: `/about`, `/faq`, `/equity-policy`, `/privacy-policy`, `/collaborations`, `/brand`, `/paradox`
- *be a part*: `/profile/me` **or** `/login` (auth-dependent), `/opportunities`, `/volunteer`, `/support`

Then a brand CTA block (auth-dependent: "back to it → open the feed" vs "join the chaos → get involved"), `ParadoxBanner`, and a `Marquee`.

### g. Reachability summary

| Destination | Phone | Desktop |
|---|---|---|
| `/`, `/projects`, `/teams` | dock + drawer + footer | nav pill + dropdown + mega + footer |
| `/blog`, `/members`, `/about`, `/opportunities` | dropdown + drawer + footer (`/about` also dock for guests) | dropdown + mega + footer |
| `/crftd`, `/volunteer`, `/collaborations`, `/schools`, `/classes`, `/faq`, `/support`, `/contact`, `/links`, `/equity-policy` | **drawer + footer only** | mega and/or footer |
| `/privacy-policy` | footer only | footer only |
| `/brand` | footer only | mega + footer |
| `/search` | nav icon + footer | nav icon + footer + Cmd/Ctrl+K |
| `/my-posts` | drawer (auth) | avatar menu |
| `/settings` | **not in any phone nav** — avatar menu is desktop-only | avatar menu |
| `/saved`, `/calendar`, `/yearbook` | **[not verified in this pass]** — no entry point found in AQNav, MobileMenuBar or AQFooter; entry points would be inside `profile/ProfilePage.tsx` / `public/HomePage.tsx` left rail |
| `/notifications` | dock (non-leaders) + drawer CTA | bell icon |
| `/director` | dock (leaders) + drawer | nav pill + dropdown + mega + avatar menu |
| `/welcome`, `/thank-you`, `/dev/components` | direct URL only | direct URL only |

---

## 3. Data model as the frontend actually uses it

Two clients in scope. `lib/supabaseCommunity.ts` exports `supabaseCommunity`; `lib/supabase.ts` is now literally `export const supabase = supabaseCommunity as any` (an alias kept for its importers and shared types). Both hit the same project.

### 3.1 Tables actually read or written (excluding paradox)

Counted from `.from('…')` call sites across `frontend/src` (paradox excluded):

| Table / view | `.from()` sites | Notes |
|---|---|---|
| `members` | 40 | the hub of the whole graph |
| `welfare_projects` | 24 | projects **and** drives — same table |
| `teams` | 21 | |
| `posts` | 21 | write path |
| `job_openings` | 18 | |
| `team_members` | 17 | |
| `post_feed_view` (view) | 17 | the read path for posts |
| `external_achievements` | 10 | |
| `likes` | 9 | |
| `blogs` | 9 | |
| `schools` | 8 | table is **empty** live (comment in `public/SchoolsPage.tsx`) |
| `member_directory_view` (view) | 7 | |
| `job_applications` | 7 | |
| `follows` | 7 | |
| `yearbook_entries` | 6 | **not present in `database.types.ts`** |
| `volunteer_applications` | 6 | |
| `team_join_requests` | 6 | |
| `sops` | 6 | |
| `drive_attendance` | 6 | |
| `director_categories` | 6 | |
| `avatars` | 6 | storage bucket, not a table |
| `saved_posts` | 5 | |
| `notifications` | 5 | |
| `sop_templates` | 4 | |
| `points_ledger` | 4 | |
| `certificate_requests` | 4 | |
| `post_tags` | 3 | |
| `post_documents` | 3 | |
| `contact_submissions` | 3 | |
| `comments` | 3 | |
| `collaboration_submissions` | 3 | |
| `post_images` | 2 | |
| `member_breaks` | 2 | |
| `post_categories` | 1 | |
| `pending_member_approvals` (view) | 1 | |
| `rejected_member_approvals` (view) | 1 | |

RPCs referenced: `get_own_member`, `ensure_member`, `create_notification`, `complete_drive_attendance`, `update_drive_post_stats`, `create_birthday_notice`, `claim_member_preauth`, `approve_post_category`, `blog_post_writeup`, `get_team_member_contacts`.

**Two staleness findings, both material:**
1. `yearbook_entries` is queried by `services/yearbookService.ts` (`.select('*, members(full_name, avatar_url, uuid)')`, columns `id, member_id, edition_year, status, use_own_avatar, photo_url, quote, invited_at, submitted_at`) but **does not appear in `database.types.ts` at all**.
2. `job_openings.team_id` is used by `lib/jobOpenings.ts:459-475` with an explicit comment *"a real FK as of 2026-09-02"*, but `database.types.ts` only lists `team_name: string | null`. The types file has not been regenerated since that migration.

Per CLAUDE.md's own rule, treat `database.types.ts` as a lagging artefact, not schema truth.

### 3.2 The real foreign keys (from the `Relationships` blocks in `lib/database.types.ts`)

Views (`member_directory_view`, `pending_member_approvals`, `pending_post_reviews`, `rejected_member_approvals`) omitted; `post_feed_view` retained where the FK is really against `posts`.

**Content → content (the graph an experience engine would traverse):**

| From | Column | To | Meaning |
|---|---|---|---|
| `posts` | `team_id` | `teams.team_id` | a post can belong to a team |
| `welfare_projects` | `linked_post_id` | `posts.uuid` | a project is mirrored as a feed post |
| `blogs` | `linked_post_id` | `posts.uuid` | a blog is mirrored as a feed post |
| `job_openings` | `linked_post_id` | `posts.uuid` | an opening is mirrored as a feed post |
| `job_applications` | `opening_id` | `job_openings.id` | |
| `drive_attendance` | `welfare_project_id` | `welfare_projects.id` | attendance belongs to a drive |
| `points_ledger` | `related_drive_id` | `welfare_projects.id` | points earned at a drive |
| `post_images` / `post_documents` / `post_tags` / `post_categories` / `post_approvals` / `comments` / `likes` / `saved_posts` | `post_id` | `posts.post_id` | post satellites |
| `team_join_requests` | `team_id` | `teams.team_id` | |
| `team_members` | `team_id` | `teams.team_id` | |
| `member_preauth` | `intended_team_id` | `teams.team_id` | |
| **`job_openings`** | **`team_id`** | **`teams.team_id`** | **live since 2026-09-02, missing from `database.types.ts`** |

**Content → person:**

`posts.author_id`, `posts.reviewed_by`, `blogs.author_id`, `comments.author_id`, `welfare_projects.drive_lead_member_id`, `job_applications.applicant_id`, `external_achievements.member_id` + `.reviewed_by`, `sops.led_by_member_id`, `teams.created_by`, `team_members.member_id`, `team_join_requests.member_id` + `.reviewed_by`, `drive_attendance.member_id` + `.updated_by`, `points_ledger.member_id` + `.created_by`, `post_tags.tagged_member_id`, `saved_posts.member_id`, `likes.member_id`, `follows.follower_id` + `.followee_id`, `notifications.member_id`, `director_categories.member_id` + `.assigned_by`, `certificate_requests.member_id` + `.decided_by`, `member_breaks.member_id`, `sop_templates.updated_by`, `community_audit_logs.member_id`, `member_preauth.claimed_by_member_id`, `members.approved_by` — all → `members.member_id`.

**Person → institution:** `members.school_id` → `schools.school_id`. This is the **only** FK into `schools`, and the table is empty live.

### 3.3 Foreign keys that do NOT exist

These are the graph edges the product visually implies but the database does not enforce:

- **`welfare_projects` → `teams`** — none. A project has no owning team column at all.
- **`blogs` → `teams`** — none.
- **`welfare_projects` → `schools`** — none. `location` is free text.
- **`welfare_projects` → `welfare_projects`** — no series/parent/related link.
- **`posts` → `posts`** — no reply/quote/thread edge; `comments` is a flat table with no `parent_comment_id`.
- **`blogs` → `welfare_projects`** — none. A blog about a drive has no link to the drive.
- **`teams` → `teams`** — no department/parent hierarchy. The 8 departments live only in `lib/departments.ts` as a hardcoded TS array.
- **classes** — there is no `classes` table. `/classes` (`public/ClassesPage.tsx`) is a single `members.select('class_grade')` aggregation over a free-text column.
- **"drives"** — there is no `drives` table. A drive *is* a `welfare_projects` row with `workshop_date` / `drive_lead_member_id` / `attendance_completed_at` set.
- **"Labs projects"** — there is no Labs table or content type. `labs` is one of the 5 values in `CATEGORY_SLUGS` (`lib/categories.ts`), and `/crftd` (`public/RootsPage.tsx`) is entirely hardcoded arrays (`DROPS`, `CALENDAR`, `COST_BREAKDOWN`, `LOOKBOOK_TILES`) with no database read whatsoever.
- **tags/themes** — `post_tags` is `(post_id, tag_id, tagged_member_id)`; it is a **person-tagging** table, not a topic-tagging one. There is no `tags` table in `database.types.ts`.

### 3.4 The category vocabulary and its five colour sources

`lib/categories.ts`: `CATEGORY_SLUGS = ['events','welfare','content','operations','labs']`. This is the live value list for `posts.category`, `director_categories.category` and `sops.department_slug` (CHECK-constrained per the file's comment).

`lib/departments.ts` has **eight** entries with literal colour tokens, each mapping down to one of the five categories — `Crftd`, `AQ.Ventures` and `ShikshAQ` all map to `labs`; `Collabs` and `Human Resources` both map to `operations`. Guardrails §4 records the five colour sources that must never be merged: `lib/uiHelpers.CAT_COLORS`, `lib/jobOpenings.CAT_COLORS`, the `--c-*` custom properties, `OBJ_COLORS` in `lib/supabase.ts`, and `lib/departments.ts`.

---

## 4. Content object inventory

Columns below are from `lib/database.types.ts` unless flagged. "Missing" means: not present in any table the frontend reads.

### Project (`welfare_projects`, 38 columns)
`id, slug, header, category, objective, short_summary, long_writeup, key_statistic, location, workshop_date, scheduled_end, status, is_draft, featured, volunteers, main_image, main_image_alt, image_1..image_4 (+ _alt each), label_1..label_4, collab_name, collab_logo, collab_logo_alt, instagram_link, google_drive_link, linked_post_id, drive_lead_member_id, attendance_completed_at, created_at`

Missing for an experience engine: theme/topic tags; owning team FK; school FK; related-project links; audience; narrative weight or editorial priority beyond the single boolean `featured`; `updated_at` (there is none — freshness can only be read from `created_at` or `workshop_date`); media metadata beyond alt text (no dimensions, no dominant colour, no orientation); duration/effort; outcome/impact numbers as structured values (`key_statistic` is a free-text sentence).

### Post (`posts`, 21 columns; read via `post_feed_view`, 34)
Table: `post_id, uuid, author_id, body, category, status, featured, pinned, pinned_title, team_id, link_url, link_title, link_image, stats (Json), scheduled_for, reviewed_at, reviewed_by, rejection_note, created_at, updated_at, deleted_at`
View adds: `author_name, author_avatar, author_role, author_uuid, team_name, team_uuid, like_count, comment_count, images (Json), tagged_members (Json), source_type, source_slug, source_title, source_author, source_location, source_summary, source_stat, source_date`

Missing: topic tags; related-post links; reading time; explicit media metadata (the `images` Json shape is **[not verified in this pass]** — read `services/feedService.ts:40-62` `mapPostFromDB` and the `post_feed_view` definition); language; view count (only `like_count` / `comment_count` exist); audience.

### Blog (`blogs`, 18 columns)
`id, slug, headliner, body, content, category, cover, cover_alt, featured_image, featured_image_alt, author_id, written_by, author_url, author_instagram, minutes_of_read, published_date, linked_post_id, created_at`

`minutes_of_read` is the one editorial-weight field that exists anywhere in the schema. Missing: tags (the `/blog` UI shows a hardcoded chip row `['sundarbans','winterdrive','paradox','roots','labs','fieldnotes']` in `public/BlogListPage.tsx:209` that is **not** backed by any column); related posts; series; `updated_at`; excerpt/dek as a distinct field; team FK; project FK.

### Person / member (`members`, 29 columns)
`member_id, uuid, auth_uid, google_id, full_name, email, phone, avatar_url, bio, class_grade, school_id, role, status, is_active, join_reason, instagram, linkedin, birthday, birthday_public, break_start, break_end, break_reason, approved_at, approved_by, rejection_note, last_login, created_at, updated_at`

PII note: CLAUDE.md records `email`/`phone` as the subject of a column-grant lockdown whose application status must be checked live. `member_directory_view` exposes only `member_id, uuid, full_name, avatar_url, class_grade, role, role_rank, status, created_at, email`.

Missing: interests/skills (`teams.skills` exists, `members` has none); availability; location; contribution history as a queryable rollup (`points_ledger` and `drive_attendance` exist as raw ledgers); explicit consent flags for personalisation.

### Team (`teams`, 12 columns)
`team_id, uuid, name, description, category, skills (string[]), logo_url, banner_url, is_active, created_by, created_at, updated_at`
Roster via `team_members`: `team_member_id, team_id, member_id, role, is_active, joined_at, left_at`.

`skills` is a real `string[]` and is the **only array-typed taxonomy column on any content table**. Missing: parent department FK (the 8 departments are a hardcoded array); owned-projects link; lead FK (lead is a `team_members.role` value); recruiting-status flag.

### Event / drive — **no dedicated table**
A drive is a `welfare_projects` row. `attendanceService.ts` selects `id, header, location, workshop_date, scheduled_end, drive_lead_member_id, attendance_completed_at`. `calendarService.ts` selects `id, header, slug, workshop_date, is_draft` plus `members(uuid, full_name, birthday)`.
Attendance: `drive_attendance` = `id, welfare_project_id, member_id, walkup_name, status, consent_signed, checked_in_at, checked_out_at, updated_by, created_at, updated_at`.

Missing: start/end times (only dates); capacity; RSVP (distinct from post-hoc attendance); recurrence; geo coordinates; a real `event_type`.

### Opening (`job_openings`, 18 in types + live `team_id`)
`id (uuid), opening_id, title, description, category, commitment, skills (string[]), custom_questions (Json), deadline, status, closed_at, deleted_at, team_name, created_by_name, created_by_role, linked_post_id, created_at, updated_at` + **`team_id` (live, untyped)**
Applications: `job_applications` = `id, opening_id, applicant_id, applicant_name, applicant_email, applicant_phone, custom_answers (Json), message, status, created_at`.

Missing: seniority; time commitment as structured hours; location/remote; related-project link.

### Labs project — **does not exist as data**
`/crftd` is fully hardcoded in `public/RootsPage.tsx`. `labs` is a category value only. There is no Labs table, no Labs FK, no Labs read.

### Achievement (`external_achievements`, 15 columns)
`achievement_id, uuid, member_id, title, description, achievement_type, achievement_date, achievement_end_date, proof_url, status, review_note, reviewed_by, reviewed_at, created_at, updated_at`

### School (`schools`, 9 columns) — **table is empty live**
`school_id, uuid, name, short_name, logo_url, location, website, created_at, updated_at`. `public/SchoolsPage.tsx` carries an explicit comment that the table is empty and the page therefore tells the program's story rather than shipping placeholder data.

### Class — **not a table**
`public/ClassesPage.tsx` aggregates `members.class_grade`, a free-text column.

---

## 5. Component inventory

### 5.1 `components/v6Shared.tsx` — the shared brand primitives (all generic, zero data access)

| Export | Renders | Props |
|---|---|---|
| `isOfficialAccount(authorName?)` | helper, true when name is "aquaterra" | `authorName?: string \| null` |
| `VerifiedTick` | verified badge SVG | `{ size?: number }` |
| `Star` | 5-point star SVG | `{ size?, color?, stroke?, style?, className? }` |
| `Burst` | n-point starburst SVG | `{ size?, color?, stroke?, style?, points? }` |
| `I` | 24 inline icon factories (`heart(filled)`, `comment`, `share`, `search`, `plus`, `bell`, `back`, `close`, `check`, `more`, `star`, `fire`, `sparkles`, `bookmark`, `camera`, `link`, `flag`, `globe`, `rocket`, `pulse`, `gear`, `pen`, `bolt`, `wave`, `hash`) | `heart` takes `filled` |
| `Marquee` | infinite scrolling text strip | `{ items: string[]; color?: 'lemon'\|'pink'\|'mint'\|'tomato'; reverse?: boolean }` |
| `PostImage` | placeholder photo block + optional "NEW" sticker | `{ kind?, color?, stickerOk? }` |
| `LikeButton` | heart cross-fade + burst + rolling count | `{ liked: boolean; count: number; onToggle: () => void }` |

There is no exported `Sticker`, `Chip` or `Pill` component. "Sticker" and "chip" exist only as CSS classes (`.sticker`, `.sticker-mint`, `.chip`, `.chip-active`) applied inline. The one `FilterPill` in the codebase lives in `director/adminKit.tsx`.

### 5.2 `components/` — generic (pure props: no fetch, no `useAuth`, no router, no storage)

Composable by a rules engine as-is:

`Alert` · `AnimatedGradientBackground` · `AuthShell` (+`AuthSpinner`, `AuthFullScreenSpinner`) · `Avatar` · `Badge` · `BlogBlockEditor` · `Breadcrumbs` · `Button` · `Card` (+`Card.Header/Body/Footer`) · `ConfettiBurst` · `CountUp` · `CreateLauncher` · `DynamicIslandTOC` · `EmptyState` · `ErrorBoundary` · `ErrorState` · `Field` · `HiringCard` · `HowItWorks` · `ImageLightbox` · `Img` · `Input` · `Modal` (+`Modal.Footer`) · `OpeningQuestionBuilder` / `OpeningQuestionFields` / `useOpeningAnswers` / `OpeningAnswersDisplay` · `PostStreamCard` · `ProgressiveFluxLoader` · `RelatedTicker` · `Reveal` / `RevealGroup` · `Skeleton` · `SparklesText` · `Spinner` · `StatCountUp` · `SuccessCheck` · `Tabs` · `TemplatePicker` · `TextArea` · `Toggle` · `HoldToConfirmButton`

Three of these are already exactly the shape an experience engine wants:

- **`PostStreamCard`** — `memo`'d, and its `PostStreamCardData` (`uuid, category, title, location?, authorName?, createdAt, imageUrl?, color, displayNum, sourceType?, sourceTitle?, sourceSlug?`) is a content-agnostic descriptor. Also exports `postStreamHref()`.
- **`RelatedTicker`** — `{ items: RelatedTickerItem[]; ariaLabel? }`, item = `{ key, href, title, image?, alt?, tag, color? }`. Already generic over content kind. Currently used in exactly one place: `teams/detail/AboutTab.tsx`.
- **`HiringCard`** — `{ title, category?, meta?, href?, seed? }`.

`BlogStudioModal`, `CarouselStudioModal`, `PosterStudioModal`, `ShareModal` are props-driven but bound to their generator modules (`blogGenerator.ts`, `carouselGenerator.ts`, `posterGenerator.ts`, `StoryGenerator.ts`).

### 5.3 `components/` — hardwired

| File | Why |
|---|---|
| `AQNav.tsx` | `useAuth`, router, `notificationService`, direct `supabaseCommunity` realtime channel, `localStorage`, own link arrays |
| `AQFooter.tsx` | `useAuth`, hardcoded 19-link array |
| `MobileMenuBar.tsx` | `useAuth`, router, `localStorage`, own `AUTH_ITEMS`/`PUBLIC_ITEMS` |
| `PublicLayout.tsx`, `DashboardLayout.tsx` | router `Outlet`, lazy page-specific modals |
| `WelcomeOverlay.tsx` | **fetches `.from('welfare_projects')` itself**, `useAuth`, `localStorage` |
| `OpeningsStrip.tsx` | `useAuth` + service fetch |
| `PostFocusModal.tsx` | `useAuth`, router, service calls inside |
| `OpeningPickerModal.tsx` | `useAuth`, router, `localStorage` + `sessionStorage` |
| `ApprovedWelcomeModal.tsx` | `useAuth`, `sessionStorage` |
| `FirstRunController.tsx` | `useAuth`, `sessionStorage` |
| `BirthdayPopup.tsx` | `useAuth`, router, parses notification rows itself |
| `Mascot.tsx` | `useLocation`, own `HIDDEN_PREFIXES` / `ACCESSORY_BY_PREFIX` |
| `ContactNudge.tsx` | `useLocation`, own `HIDDEN_ON` list |
| `HomeIntro.tsx` | own `PHASES` copy, `localStorage` |
| `HiStrip.tsx` | hardcoded `/hi/hi-reel.mp4` asset |
| `AuthFeaturePanel.tsx` | owns its `LOGIN_LINES`/`REGISTER_LINES` copy, reads `localStorage` |
| `ParadoxBanner.tsx` | hardcoded copy/link |
| `Toast.tsx`, `Confirm.tsx` | app-level providers (generic, but infrastructure) |

### 5.4 `feed/`

| File | Export | Renders | Props | Class |
|---|---|---|---|---|
| `feed/CategoryFilter.tsx` | `categories`, `getCategoryInfo(value)` | **no component** — a static 6-entry value/label/emoji table | `Category { value; label; emoji }` | generic data module |
| `feed/CreatePostModal.tsx` (1382 lines) | `CreatePostModal` | full composer | `{ isOpen; onClose; onPostCreated }` | hardwired — direct `.from()` writes |
| `feed/FeedPostCard.tsx` (701 lines) | `memo(FeedPostCard)` | the main feed card | `{ post: Post; seed?; onLikeToggle?; savedInitial?; linkedOpening? }` | hardwired — **self-fetches when `savedInitial`/`linkedOpening` are absent** |
| `feed/MyPostsPage.tsx`, `NotificationsPage.tsx`, `PostPage.tsx`, `SavedPostsPage.tsx` | pages | — | none | hardwired pages |

`FeedPostCard` is the closest thing to a universal content card, and it is *nearly* injectable: `savedInitial` and `linkedOpening` exist precisely so a batching parent (`hooks/useFeedCardBatch.ts`) can supply them instead of the card self-fetching.

### 5.5 `feed/post/` — all presentational, all fed by `PostPage`

No fetching, no auth hooks, no storage in any of them. `member` and `isAuthenticated` are passed **as props**, not read from context — which makes this whole layer engine-composable.

| File | Props |
|---|---|
| `PostHeader.tsx` | `post, accent, displayTitle, chipMeta, member, onBack` |
| `PostBody.tsx` | `post, accent, highlightMeta, displayBody, projectWriteup, hasImages` |
| `PostActionBar.tsx` | 24 props — every permission and busy flag injected (`canEditPost`, `canManagePost`, `isSuperAdmin`, `isPinned`, …) |
| `PostComments.tsx` | `accent, comments, commentsLoading, commentCount, commentInput, setCommentInput, isSubmittingComment, onAddComment, onDeleteComment, commentsHasMore, onLoadMore, isAuthenticated, member` |
| `PostRelated.tsx` | `post, accent, relLoading, relByAuthor, relByCategory, relSavedSet, relOpenings` |
| `postParsing.ts` | `PostMeta`, `parsePost(raw)`, `META_ICON` — parsing helpers, no UI |

`PostRelated` is the only existing related-content renderer on a content page, and its two rails (`relByAuthor`, `relByCategory`) are supplied by the page, not computed inside.

### 5.6 `director/adminKit.tsx` — the shared admin card/chip layer (~600 lines)

All generic. Touches no database (its only `.from(` occurrences are `Array.from`); its only coupling is `useToast` inside `useUndoableAction`.

`AdminLayout` · `AdminTabHeader {label?, title, subtitle?, count?, actions?}` · `DataToolbar {search?, onSearch?, searchPlaceholder?, children?, actions?, actionsInline?}` · `StatusBadge {children, tone?: BadgeTone, dot?}` · `EmptyState` · `StatusStamp {label, tone?: StampTone, color?}` · `EmptyLedger {message, sub?}` · **`FilterPill {active?, onClick, children}`** · `BulkActionBar {count, onClear, children?, busy?}` · `AdminSkeleton {rows?, variant?}` · **`AdminRow {busy?, selected?, onSelect?, stamp?, primary, secondary?, meta?, actions?, expanded?, onToggleExpand?}`** · `BottomSheet {open, onClose, title, children}` · `AdminRowActions {sheetTitle, children}` · `AdminErrorState {message, onRetry}` · hooks `useRowSelection<T>`, `useUndoableAction<T>`, `useIsPhone()` · re-exports `useModalA11y`, `MODAL_FOCUSABLE`.

`AdminRow` is the desk's composable row primitive and is fully data-driven.

---

## 6. What is already adaptive

### 6.1 Role and status

`lib/roles.ts`:
```ts
export const LEADER_ROLES = ['director', 'hod', 'super_admin'] as const
export function hasLeaderAccess(role?: string | null): boolean
export function isSuperAdmin(role?: string | null): boolean   // role === 'super_admin'
```
Plus `getRoleLabel()` and `getRoleClass()`.

Role-driven rendering found:
- `AQNav.tsx:153` — HoD Desk pill + pulse dot.
- `MobileMenuBar.tsx:88-95` — a leader's dock `alerts` slot is **replaced** by `desk`.
- `public/HomePage.tsx:1016` — `<RightRail isDirector={isAuthenticated && hasLeaderAccess(member?.role)} />`.
- `AQNav` mega menu — `get involved` list gains `HOD Desk`; item 07 is `/profile/me` or `/login`.
- `services/feedService.ts` `createPost` — `const isLeader = ['director','hod','super_admin'].includes(memberRow.role ?? '')`: leaders auto-publish and may schedule; a profanity `forceReview` always overrides.

Status-driven: `auth/HomeRoute.tsx` switches on `member.status` (`active` → `HomeIntro` + `HomePage`; `pending_approval` → `/pending`; `rejected`/`suspended` → `/rejected`). `public/HomePage.tsx:659` — `const isActive = isAuthenticated && member?.status === 'active'` selects `fetchPosts` vs `fetchPublicPosts`.

### 6.2 `director_categories` scoping

Read in exactly one place — `services/directorService.ts:552`, `select('category, assigned_at, assigned_by').eq('member_id', currentMemberId)` — surfaced through `DirectorDashboard.tsx:209`'s `DirectorContext` (`{ stats, canApproveMembers, isSuperAdmin, myCategories, scopedPendingPosts }`).

It restricts:
- **The post moderation queue** — `director/PostModeration.tsx:49` `const scopedCategories = useMemo(() => (!isSuperAdmin ? myCategories : []), …)` → `getPendingPosts({ page, limit: 20, categories: scopedCategories })` (server-side filter plus a client-side defensive re-filter).
- **The Post Queue tab badge** — `counts.posts = (scopedPendingPosts ?? stats?.pendingPostReviews) || undefined`.
- **The scope label copy** in `DirectorDashboard.tsx:204-207`, `DirectorLanding.tsx:49-57`, `AccountApprovals.tsx:258-259`.
- **`SopManagement.tsx:368`** — initial department filter defaults to `myCategories[0]` for non-super-admins.
- Explicitly **not** scoped: account approvals (`canApproveMembers = hasLeaderAccess(member?.role)`, with a comment saying so).

### 6.3 Feed sorting and filtering — no personalisation exists

`services/feedService.ts` `getFeed`:
```
.eq('status','published')
.order('created_at', { ascending: false })
.order('post_id', { ascending: false })
.range(offset, offset + limit - 1)
+ optional .eq('category', params.category)
```
Strictly reverse-chronological and identical for every user. The `post_id` secondary key exists because 541 rows share one bulk-import `created_at`.

The only per-user data mixed into the feed is like state: `from('likes').select('post_id').eq('member_id', memberId).in('post_id', postIds)` → `isLiked`.

`getTrending({ limit=6, days=7 })` orders by `like_count` over a 7-day window — global, not personalised. `getCategoryPulse` / `getCategoryCounts` are tallies for the filter chips.

**Dead branch:** `public/HomePage.tsx:642` holds a `sort` state and line 822 implements `if (sort === 'trending') displayed.sort((a,b) => (b.likeCount||0) - (a.likeCount||0))`, but the effect at 661-667 unconditionally calls `setSort('latest')` despite a comment promising "trending for guests, latest for members", and the only UI control is a single `latest` chip. `sort` is never passed to `getFeed`.

`feed/CategoryFilter.tsx` is a static 6-chip array. Category filter state is seeded from `?category=` (`HomePage.tsx:641`; also `TeamsPage.tsx:148-151`).

### 6.4 Sample / preview fallbacks

- `public/HomePage.tsx:737-741` — on an **empty successful** guest fetch only (never on error): `setPosts(applySampleLikes(SAMPLE_POSTS).map(sampleToPost)); setUsingSamplePreview(true); setHasMore(false)`. `usingSamplePreview` then disables infinite scroll, the load-more sentinel, and the saved/opening batch lookups (`useFeedCardBatch(usingSamplePreview ? [] : displayed)`), and shows a "sample preview" banner at line 909.
- `auth/PendingApprovalPage.tsx:228` — pending members see `SAMPLE_POSTS`.
- `teams/TeamsPage.tsx:167` — `result.success && result.data.length > 0 ? result.data : SAMPLE_TEAMS`, plus `.catch(() => setTeams(SAMPLE_TEAMS))`.
- `lib/devPreview.ts` — `?dev=super_admin|hod|director|lead|member` fakes an authenticated member row client-side. Hard-gated on `import.meta.env.DEV`; dead code in production.

### 6.5 First-run orchestration

`components/FirstRunController.tsx` (mounted once in `App.tsx`) enforces strict precedence — at most one of three fires:
```ts
if (isLoading) return null
if (approvedShowing) return <ApprovedWelcomeModal … />
if (isAuthenticated && member?.status === 'active') return <OpeningPickerModal />
if (!isAuthenticated) return <WelcomeOverlay />
return null
```

- **`WelcomeOverlay`** — skipped when authenticated, when seen, or on `['/login','/register','/welcome','/pending','/rejected','/brand','/auth/callback']` and any `/paradox*`. Fetches up to 24 real `welfare_projects.main_image` rows and **shuffles them with `Math.random()`**, so repeat viewers see different photos.
- **`OpeningPickerModal`** — requires `member.status === 'active'`; filters `o.status === 'open' && (!o.deadline || new Date(o.deadline) > now)`, sorts by nearest deadline (nulls last), `.slice(0, 6)`. Per-card badge: `soon` when `0 <= dLeft <= 14`; `dLeft === 0 ? 'closes today' : '{n}d left'`. Marks itself seen even when the fetch fails or returns zero rows.
- **`ApprovedWelcomeModal`** — greets by first name.
- **`HomeIntro`** — `return !seen && !reduced`.
- **`HiStrip`** — placement varies by `aq_hi_strip_v1`; the component itself branches on `prefers-reduced-motion` to serve `/hi/hi-reel.jpg` stills instead of the mp4, and pauses via `IntersectionObserver` + `document.hidden`.
- **`Mascot`** — `HIDDEN_PREFIXES = ['/director','/settings','/drive/']`; a random colour per session; `ACCESSORY_BY_PREFIX` currently has one entry (`['/projects','📖']`); despawns whenever `document.body.style.overflow === 'hidden'`.
- **`BirthdayPopup`** — realtime, not stored: requires `status === 'published'`, a body matching `/^🎂 It's (.+?)'s birthday today!/`, unseen `uuid`, `row.author_id !== member?.member_id`, and no open modal. Auto-dismisses after 6000ms. Its header comment states the `create_birthday_notice()` migration is **not yet applied**, so it is live but dormant.

### 6.6 Other per-user surfaces

- `profile/ProfilePage.tsx:362` — own-birthday private card, `isOwn && currentMember && isBirthdayToday(currentMember.birthday)`, plus a membership-duration line that renders only when the real `created_at` math yields ≥ 1 month.
- `profile/ProfilePage.tsx:~330-353` — break banner (`back on {break_end}`) vs a "going on a break?" button.
- `calendar/CalendarPage.tsx:148-151` — birthdays indexed by `"month-day"`; the viewer's own birthday always shows regardless of `birthday_public`.
- `AQNav.tsx:619` — mega-menu heading `{member?.full_name?.split(' ')[0] || 'you'}'s feed.`
- Route-based hiding: `ContactNudge.tsx:17`, `MobileMenuBar.tsx:113`.
- Random-but-not-personalised: `lib/emptyJokes.ts` (rotating empty-state copy, pools for `saved`/`search`/`notifications`), `HiringCard.tsx:35`, `ConfettiBurst`, and the `seed ?? Math.floor(Math.random()*0xffffffff)` in the poster/blog/carousel generators.

**Time-based:** birthday checks, the 14-day opening deadline window, the 7-day trending window, cache TTLs, and server-side scheduled-post publishing (pg_cron). **Geo-based:** none — no `navigator.geolocation`, no IP lookup, no locale branching. **A/B testing:** none — no experiment framework, no bucketing, no feature flags.

### 6.7 Every browser-storage key

**localStorage**

| Key | Files | Shape | Effect |
|---|---|---|---|
| `aq_visited` | `components/AQNav.tsx:146` read (lazy init), `:149` write | `'1'` | Nav CTA reads `Log in →` instead of `Apply →` |
| `aq_visited_before` | `auth/LoginPage.tsx:38` read, `:41` write | `'1'` | `AuthFeaturePanel` heading `welcome.` vs `welcome back.`; also sent as the `firstVisit` analytics property |
| `aq_hi_strip_v1` | `auth/HomeRoute.tsx:23,33,37` | `'1'` | `HiStrip` renders above the home feed on the first visit only. Its catch branch returns `false`, so a private-mode visitor never sees it |
| `aq_hod_visited` | `AQNav.tsx:153` read, `:309`/`:675` write; `MobileMenuBar.tsx:85` read, `:107` write | `'1'` (truthiness-checked) | `showHodPulse = isDirector && !hodVisited && !path.startsWith('/director')`. Read during render, not in a lazy initialiser — unlike its siblings |
| `aq_member_v1` | `auth/AuthContext.tsx:44` | `{ member, cachedAt }` | 24h SWR identity cache; discarded unless a `sb-*-auth-token` key exists. Seeds `useState` synchronously so role/name paint on frame 1 |
| `aq_welcome_v1` | `components/WelcomeOverlay.tsx` (`SEEN_KEY`) | `'1'` | First-visit envelope overlay, once ever |
| `aq_home_intro_v1` | `components/HomeIntro.tsx` (`KEY`) | `'1'` | Once-per-visitor intro sweep on `/` |
| `aq_opening_picker_seen_<memberUuid>` | `components/OpeningPickerModal.tsx` (`seenKey`) | `'1'` | Per-member first-login opening picker |
| `aq_recently_viewed` | `lib/recentlyViewed.ts:21` | `RecentItem[]` (`{kind:'post'\|'profile'\|'team'\|'project', id, title, subtitle?, image?, href, ts}`), deduped, `CAP = 12` | **Write-only.** `pushRecent` is called from `feed/PostPage.tsx:156`, `profile/PublicProfilePage.tsx:116`, `public/PublicProjectDetailPage.tsx:117`, `teams/TeamDetailPage.tsx:316`. `getRecent()` is imported by nothing; `clearRecent()` is never called |
| `aq_projects_cache_v3` | `lib/projectsCache.ts:8` | — | **No writer.** `PublicProjectsPage.tsx` contains zero `localStorage` calls. Only `bustProjectsCache()` (removal) survives |
| `aq_dev_preview_role` | `lib/devPreview.ts:20` | one of 5 role strings | DEV-only fake auth; dead code in prod |
| `aq-sample-likes` | `data/samplePosts.ts:193` | `Record<uuid, {liked, count}>` | Persists likes on the fake sample posts |
| `sb-<ref>-auth-token` (+ `.0`/`.1`) | written by supabase-js; **scanned** in `AuthContext.tsx:60-63` | session JSON | Presence check only |
| `aq-theme` | `frontend/index.html` inline script | — | Legacy key, only ever **removed**; the app is pinned to `data-theme="light"` |

**sessionStorage**

| Key | Files | Shape | Effect |
|---|---|---|---|
| `aq_just_approved` | `auth/PendingApprovalPage.tsx:203` write; `components/ApprovedWelcomeModal.tsx` (`FLAG_KEY`) read/remove; `FirstRunController.tsx:30` peek | `'1'` | One-shot "you're in" modal on pending→active |
| `aq_oauth_from` | `auth/LoginPage.tsx:70-71`, `auth/AuthCallbackPage.tsx:21,36,55` | pathname | Preserves the destination across the OAuth full-page redirect |
| `aq_chunk_reload_ts` | `lib/lazyWithRetry.ts:32` | epoch-ms | At most one auto-reload per 10s after a failed dynamic import |
| `aq_teams_cache` | `teams/TeamsPage.tsx:122,129,169` | `{ data, ts }`, TTL 1 week | **Within TTL the fetch is skipped entirely** |
| `aq_bloglist_v1` | `public/BlogListPage.tsx:134,151` | `Blog[]` (no body) | SWR paint, no TTL |
| `aq_form_collabs_v1`, `aq_form_contacts_v1` | `director/FormResponses.tsx:84-85` | row arrays | Desk SWR caches, rewritten after each mutation |
| `aq_feed_v1_<memberUuid\|anon>_<category\|all>` and `…_guest` | `public/HomePage.tsx:672` and 678/694/715/734 | `{ data, total, hasMore }` | Per-member, per-category page-1 feed cache. **The only storage key namespaced by user identity** |

`lib/swrCache.ts` is the generic `getCached`/`setCached` wrapper over sessionStorage for the last four groups.

**Adjacent:** `lib/checkinQueue.ts` uses IndexedDB — database `aq_community`, store `checkin_queue`, `keyPath: 'key'` = `` `${welfareProjectId}:${memberId ?? walkupName}` `` — an offline-first write queue for `drives/DriveCheckIn.tsx`. `lib/authCache.ts` is in-memory only (`_cachedAuthUid`, `_cachedMemberId`, `_pendingFetch`), backed by the `get_own_member()` SECURITY DEFINER RPC and used by 13 services; cleared on `SIGNED_OUT`.

There are **no** draft-persistence keys (the compose modal does not save drafts), no dismissal keys beyond the first-run flags, and no A/B bucket keys.

---

## 7. SEO surface

### Sitemap — `frontend/scripts/generate-sitemap.mjs`

Writes `frontend/public/sitemap.xml`. Static routes are a curated list of 18 (`/`, `/projects`, `/blog`, `/about`, `/teams`, `/members`, `/opportunities`, `/collaborations`, `/crftd`, `/schools`, `/classes`, `/faq`, `/support`, `/contact`, `/volunteer`, `/links`, `/equity-policy`, `/privacy-policy`) plus 6 Paradox statics. Dynamic entries are pulled live and read-only: `welfare_projects` → `/projects/:slug`, `blogs` → `/blog/:slug`, `teams` → `/teams/:uuid`, `job_openings` (status = open) → `/opportunities/:id`, and Paradox tables when its env vars are set.

Deliberately excluded, with reasons in the file header: all auth routes, all member-only routes, all `/director/*`, dev-only routes, `/member/:uuid` (*"real students, many of them minors"*), and `/post/:uuid` (member-authored permalinks). `lastmod` is only ever emitted from a real row timestamp. Every network call is timeout-bounded and individually caught so a Supabase outage degrades to a static-only sitemap rather than failing the deploy; `scripts/verify-sitemap.mjs` (postbuild) is what turns a missing or stale sitemap into a loud failure.

### Prerender — `frontend/scripts/prerender-meta.mjs`

Reads `dist/index.html` and `src/lib/metaConfig.ts` (transpiled in memory via `esbuild.transform`, imported as a `data:` URL, so meta strings are never duplicated).

**17 static routes** get their own `dist/<name>.html`: `/about`, `/projects`, `/blog`, `/teams`, `/opportunities`, `/members`, `/contact`, `/faq`, `/support`, `/collaborations`, `/volunteer`, `/links`, `/schools`, `/classes`, `/crftd`, `/privacy-policy`, `/equity-policy`. A missing `metaConfig` entry or an unmatched `<head>` pattern **throws and fails the build**.

**Three dynamic families**, fail-soft (a DB hiccup logs SKIPPED and degrades to the SPA fallback rather than failing the deploy):
- `/blog/:slug` ← `blogs` where `slug is not null` → `slug, headliner, body, featured_image, featured_image_alt, written_by, published_date, created_at`
- `/projects/:slug` ← `welfare_projects` where `is_draft = false` → `slug, header, short_summary, long_writeup, main_image, main_image_alt, location`
- `/teams/:uuid` ← `teams` where `is_active = true` → `uuid, name, description, category, logo_url`

**Out of scope by design:** `/opportunities/:id`, `/member/:uuid`, `/post/:uuid`, all authed/desk/auth routes, and all of `/paradox`.

**This is not head-only.** `injectBody()` replaces `<div id="root"></div>` (and throws if that exact string is absent) with real semantic HTML:

```
<div data-prerender="body"><main><h1>…</h1><p>intro</p>[extra]</main>
<nav aria-label="AquaTerra"><ul><li><a href…>…</a></li>…</ul></nav></div>
```

- Static routes: `<h1>` is the title with the `| AquaTerra` suffix stripped, `<p>` is the meta description.
- Blog: `<h1>` = headliner, intro = `By {written_by} · {humanDate}` (`en-GB`), extra = `<article>` of `toParagraphs(body)`, markdown stripped, **capped at 2400 chars**.
- Project: intro = `AquaTerra welfare project · {location}` (or `· Kolkata`), extra = `toParagraphs(long_writeup || short_summary)`.
- Team: intro = `AquaTerra {category} department`, extra = `toParagraphs(description)`.
- A 15-link `SITE_LINKS` nav is emitted on **every** prerendered page (`/`, `/about`, `/projects`, `/teams`, `/blog`, `/members`, `/opportunities`, `/volunteer`, `/collaborations`, `/schools`, `/classes`, `/crftd`, `/support`, `/faq`, `/contact`); record pages prepend a link back to their index.

Safe because `src/main.tsx` uses `createRoot(...).render(...)`, **not** `hydrateRoot` — React discards `#root`'s contents. The script warns explicitly against switching.

Head replacements (nine, each asserted): `<title>`, `description`, `canonical`, `og:title`, `og:description`, `og:url`, `twitter:title`, `twitter:description`, plus conditional `og:type: article` (blog + project) and, when a record image exists, `og:image` / `og:image:secure_url` / `og:image:alt` / `twitter:image` / `twitter:image:alt` — with `og:image:type|width|height` **stripped** rather than left claiming a false 1200×630. Images run through a `sizedCover()` mirroring `lib/imageUrl.ts`.

### JSON-LD

- **Script-injected:** one `BreadcrumbList` per prerendered route (`data-prerender="breadcrumb"`), two items. That is all the script emits.
- **Inherited from `dist/index.html`** by every generated file: `Organization` (NGO, DARPAN `AAFTT2300ME20251`, founders, Kolkata address, `numberOfEmployees: 1200`, three zero-price `makesOffer` services), `WebSite` (with an in-file comment explaining why `SearchAction` was deliberately removed — `/search` is robots-Disallowed *and* `ProtectedRoute requireActive`), and `Dataset` "NGO AquaTerra Impact Metrics" with 7 `PropertyValue`s.
- **Runtime, per-route:** `src/hooks/useJsonLd.ts` injects/removes `<script data-jsonld-id>` blocks and never touches the static ones; the effect keys off the serialized payload. Called from 24 files. Exports `PUBLISHER_LD`, `abs()`, `breadcrumbLd()`, `itemListLd()`, `personLd()`. Runtime `<head>` rewriting is `src/hooks/useMeta.ts` (`CANONICAL_ORIGIN = 'https://www.ngoaquaterra.com'`, `DEFAULT_OG_IMAGE = /og-meadow.jpg`).

### `public/robots.txt`

`User-agent: *` → `Allow: /`, with `Disallow` for `/feed`, `/profile`, `/notifications`, `/saved`, `/my-posts`, `/settings`, `/search`, `/director`, `/login`, `/_login`, `/register`, `/auth`, `/pending`, `/rejected`, `/welcome`, `/brand`, plus Paradox's private paths.

`/member/` and `/post/` are **deliberately left crawlable for `*`**, with an inline rationale: `Disallow` prevents crawling but not indexing, so allowing the fetch is what lets each page's own stronger `noindex` (`profile/PublicProfilePage.tsx`) and `rel=canonical` (`feed/PostPage.tsx`) actually apply.

Then **14 named AI/LLM crawler groups**, each repeating the full private fence *plus* `Disallow: /member/` and `Disallow: /post/`, each ending `Allow: /`: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, Claude-Web, PerplexityBot, Perplexity-User, CCBot, Google-Extended, Applebot-Extended, Amazonbot, Meta-ExternalAgent, Bytespider. Closes with `Sitemap:` and `Host:`. `public/` also ships `llms.txt`.

### What is client-only today

Everything not in the 17 static + 3 dynamic prerendered families renders only after React boots:

`/` (head only — body **is** prerendered), `/opportunities/:id`, `/member/:uuid`, `/post/:uuid`, `/thank-you`, `/welcome`, `/brand`, all auth routes, all member-only routes, all `/director/*`, and the entire feed (`post_feed_view`) on every page that renders it.

Critically: on the prerendered pages, the static `<body>` carries only the `<h1>`, an intro line, one `<article>` of trimmed prose, and the 15-link nav. Every *list* — the projects stream, the blog index cards, the team roster, the members grid, the openings list — is client-only even on a prerendered route.

---

## 8. Analytics

**What exists:**

1. **Vercel Analytics** — `@vercel/analytics@^2.0.1`. `src/main.tsx:10,15`: `import { inject } from '@vercel/analytics'` … `inject()`. Automatic pageviews.
2. **Vercel Speed Insights** — `@vercel/speed-insights@^2.0.0`, `injectSpeedInsights()` at `src/main.tsx:11,16`.
3. **Microsoft Clarity** — inline tag in `frontend/index.html`, project id `v8xi8sv15p`, loading `https://www.clarity.ms/tag/v8xi8sv15p`. Session recording + heatmaps. Not referenced from any `src/` file; allowlisted in `vercel.json`'s CSP. `public/PrivacyPolicyPage.tsx:135` flags it as *"Under review"* and asks whether Clarity should run for minors at all.
4. **Custom events — exactly four**, all in `src/lib/funnel.ts`:
   - `track('signin_started', { method, firstVisit })` — `auth/LoginPage.tsx:63/92`, fired **before** `signInWithOAuth` because the redirect tears down the page
   - `track('signup_profile_started')` — `auth/RegisterPage.tsx`
   - `track('signup_profile_completed')` — `auth/RegisterPage.tsx`
   - `track('signup_awaiting_approval')` — `auth/PendingApprovalPage.tsx`

   The module forbids PII in terms: *"NO PERSONAL DATA … limited to low-cardinality context"*, noting the members are students, many of them minors.
5. **Facebook domain verification** meta tag in `index.html` — verification only, no Pixel.
6. `public/ThankYouPage.tsx` exists so form submissions get a measurable URL of their own.

**What does NOT exist** (grepped, zero hits): `gtag` / GA4, `googletagmanager`, `dataLayer`, Plausible, PostHog, Mixpanel, Segment, Amplitude, Meta Pixel (`fbq`), Hotjar, any `va(` call.

**There is no behavioural instrumentation outside the four join-funnel events.** No post-view, post-create, like, save, share, search, category-filter, project-view, team-view or opening-apply tracking of any kind. An adaptive layer has no existing event stream to learn from.

---

## WHAT IS STATIC (and should stay static)

| Surface | File | Why |
|---|---|---|
| The 8 departments and their literal colour tokens | `frontend/src/lib/departments.ts` | Guardrails §4: five separate colour sources exist deliberately and must never be merged; 8 departments do not map 1:1 onto 5 categories |
| The 5-value category vocabulary | `frontend/src/lib/categories.ts` | CHECK-constrained live on `posts.category`, `director_categories.category`, `sops.department_slug` |
| Crftd / Labs page content | `frontend/src/public/RootsPage.tsx` | `DROPS`, `CALENDAR`, `COST_BREAKDOWN`, `LOOKBOOK_TILES` are hardcoded; no DB read exists |
| Schools programme narrative | `frontend/src/public/SchoolsPage.tsx` | The `schools` table is empty; the page deliberately tells the story rather than shipping placeholder rows |
| Org facts and SLA copy | `frontend/src/lib/orgFacts.ts` | Guardrails §4: "must be imported, never retyped" |
| Per-route meta strings | `frontend/src/lib/metaConfig.ts` | Single source for `useMeta` **and** the prerender script; a missing entry fails the build |
| Organization / WebSite / Dataset JSON-LD | `frontend/index.html` | Inherited by every prerendered file; the `SearchAction` removal is a deliberate, documented decision |
| Robots policy incl. the 14 AI-crawler groups | `frontend/public/robots.txt` | Each rule carries a written rationale |
| The FAQ content | `frontend/src/lib/faqData.ts` | **[not verified in this pass]** — read the file to confirm it is a static array |

## WHAT COULD ADAPT (has the data and the seams to support it)

| Surface | File | The existing seam |
|---|---|---|
| Feed ordering | `frontend/src/services/feedService.ts` | `getFeed` already takes a `category` param and already joins per-member `likes`; `getTrending` already exists and is unused on `/` |
| The inert `sort` state | `frontend/src/public/HomePage.tsx:642,822` | A `trending` branch is already implemented and already dead — a ranking hook with no UI attached |
| Related content on a post | `frontend/src/feed/post/PostRelated.tsx` | Already takes `relByAuthor` and `relByCategory` as props; the page computes them, so the computation is swappable without touching the component |
| Any related/cross-exploration rail | `frontend/src/components/RelatedTicker.tsx` | Fully generic over `{href, title, image, tag, color}`; currently used in exactly one place (`teams/detail/AboutTab.tsx`) |
| Any content card in a stream | `frontend/src/components/PostStreamCard.tsx` | `PostStreamCardData` is already a content-agnostic descriptor with `displayNum` and `color` injected |
| The feed card's per-user state | `frontend/src/feed/FeedPostCard.tsx` + `frontend/src/hooks/useFeedCardBatch.ts` | `savedInitial` / `linkedOpening` exist precisely so a parent can inject batch-resolved per-user state |
| Recently-viewed re-entry | `frontend/src/lib/recentlyViewed.ts` | `pushRecent` is already wired into 4 detail pages; `getRecent()` exists and is read by nothing |
| Home right rail | `frontend/src/public/HomePage.tsx` (`RightRail`, line 475) | Already role-aware (`isDirector`) and already mixes pinned notices with live openings |
| Openings surfacing | `frontend/src/components/OpeningPickerModal.tsx`, `components/OpeningsStrip.tsx` | Deadline-window logic (`DEADLINE_SOON_DAYS = 14`) and per-member seen-flags already exist |
| Nav CTA and mega-menu side panel | `frontend/src/components/AQNav.tsx` | Already branches on `isReturningVisitor`, `isAuthenticated` and `isDirector` |
| Dock composition | `frontend/src/components/MobileMenuBar.tsx` | `AUTH_ITEMS` / `PUBLIC_ITEMS` are arrays already swapped by role |
| Desk queue scoping | `frontend/src/director/DirectorDashboard.tsx` (`DirectorContext`) | `myCategories` is already fanned out to 5 tabs through one context |
| Empty-state copy | `frontend/src/lib/emptyJokes.ts` | Already a per-surface pool with random selection |
| The whole admin row layer | `frontend/src/director/adminKit.tsx` | `AdminRow`, `FilterPill`, `DataToolbar`, `StatusBadge` are fully data-driven with no DB coupling |

## WHAT SHOULD NEVER ADAPT

| Surface | File | Why |
|---|---|---|
| Prerendered `<head>`: title, description, canonical, og:*, twitter:* | `frontend/scripts/prerender-meta.mjs`, `frontend/src/lib/metaConfig.ts` | These are baked at build time for non-JS consumers. A per-user variant is impossible to prerender and would desync the static HTML from the SPA |
| Prerendered `<body>` and its 15-link `SITE_LINKS` nav | `frontend/scripts/prerender-meta.mjs` | It is the only internal link graph a non-JS crawler sees. Moving any of it client-side reverts the documented "602 URLs, zero characters of text" regression |
| The `BreadcrumbList` and runtime JSON-LD | `frontend/scripts/prerender-meta.mjs`, `frontend/src/hooks/useJsonLd.ts` | Structured data that varies by viewer is a spam signal |
| Sitemap contents and its exclusions | `frontend/scripts/generate-sitemap.mjs` | `/member/:uuid` and `/post/:uuid` are excluded because the members are real students, many minors. Not a ranking trade-off |
| Robots directives | `frontend/public/robots.txt` | Same privacy reason, plus the `/member/`+`/post/` crawl-allow-so-noindex-applies logic breaks if either side changes alone |
| `noindex` on public profiles; `rel=canonical` on posts | `frontend/src/profile/PublicProfilePage.tsx`, `frontend/src/feed/PostPage.tsx` | The only thing keeping minors' profiles out of the index |
| Every `ProtectedRoute` gate and its `superOnly` mirror | `frontend/src/auth/ProtectedRoute.tsx`, `frontend/src/director/DirectorDashboard.tsx` | A shipped privilege-escalation bug already came from having only one of the two |
| Legal and policy pages | `frontend/src/public/EquityPolicyPage.tsx`, `PrivacyPolicyPage.tsx` | Legally fixed text; the privacy page also documents Clarity, which is under review for minors |
| Canonical public figures | Guardrails §4; `frontend/src/lib/orgFacts.ts` | Guardrails rule 4: "never render a figure with no source"; `1,247` was an invented number that spread to seven places |
| DARPAN registration, founding date, founder names | `frontend/index.html` JSON-LD | Factually fixed registry data |
| Skip-to-main link, `aria-current`, `role="navigation"`, tab `aria-label`s | `frontend/src/components/AQNav.tsx`, `MobileMenuBar.tsx` | Accessibility. Inactive dock tabs are icon-only, so the `aria-label` is the *only* accessible name |
| `prefers-reduced-motion` branches | `frontend/src/lib/motion.ts`, `components/HiStrip.tsx`, `HomeIntro.tsx`, `Mascot.tsx`, `components/PublicLayout.tsx` | Accessibility; already honoured throughout |
| Mobile drawer's full 16-link set | `frontend/src/components/AQNav.tsx` (`mobileSheetLinks`) | It is phone's **only** path to 10 of those pages. Any adaptive trimming re-creates the documented unreachable-pages bug |
| The `ensure_member()` → `/register` → `/pending` funnel | `frontend/src/auth/AuthContext.tsx`, `auth/HomeRoute.tsx` | The entire signup path; there is no `auth.signUp` anywhere |

## WHAT DATA IS MISSING for the graph to work

**Taxonomy**
1. No topic/theme tags on anything. `post_tags` is `(post_id, tag_id, tagged_member_id)` — a person-tagging table. No `tags` table exists in `database.types.ts`. The blog chip row in `public/BlogListPage.tsx:209` is a hardcoded 6-string array with nothing behind it.
2. No audience field on any content type. Nothing distinguishes prospective-volunteer content from active-member content from donor/partner content.
3. `teams.skills` (`string[]`) and `job_openings.skills` (`string[]`) are the only array taxonomies. `members` has no skills or interests column.

**Relationships (the missing edges)**
4. `welfare_projects` → `teams` — no FK. Which team ran a project is not recorded anywhere.
5. `welfare_projects` → `schools` — no FK. `location` is free text.
6. `blogs` → `welfare_projects` — no FK. A write-up cannot point at the drive it describes.
7. `blogs` → `teams` — no FK.
8. Content ↔ content of the same type — no `related_ids`, no series, no parent/child on projects, blogs or posts.
9. `teams` → `teams` — no department hierarchy. The 8 departments are a hardcoded TS array (`lib/departments.ts`) with no table.
10. No `classes` table — `/classes` aggregates free-text `members.class_grade`.
11. `schools` exists with a real FK from `members.school_id` but **is empty live** — the edge is defined and unpopulated.

**Editorial signal**
12. No narrative weight beyond `welfare_projects.featured` / `posts.featured` / `posts.pinned` (booleans) and `blogs.minutes_of_read`. Nothing ordinal, nothing per-audience.
13. `welfare_projects` has **no `updated_at`**. Freshness can only be inferred from `created_at` or `workshop_date`.
14. `welfare_projects.key_statistic` is a free-text sentence, not a structured `{value, unit, label}`, so impact numbers can be displayed but not compared, aggregated or ranked.
15. No excerpt/dek field distinct from body on `posts` (only `blogs` has `short`-ish fields via `content`; `welfare_projects` has `short_summary`).

**Media**
16. No media metadata anywhere beyond `*_alt` strings: no width/height, no orientation, no dominant colour, no focal point. `lib/imageUrl.ts`'s `sized()` compensates at render time by guessing from a `context` enum, which is a rendering workaround, not data.
17. `post_images` carries `blob_url, blob_name, file_size, display_order` — file size but not dimensions.

**Behaviour**
18. **No event stream at all.** Four join-funnel events (`lib/funnel.ts`) and nothing else. No views, no dwell, no clicks, no search terms, no filter selections. An engine has nothing historical to learn from.
19. The only per-user signals that exist are `likes`, `saved_posts`, `follows`, `team_members`, `drive_attendance`, `points_ledger` — all explicit actions, none implicit.
20. `aq_recently_viewed` is the one implicit signal being collected, it is device-local, capped at 12, and **nothing reads it**.
21. No consent flag for personalisation. Given the member base (students, many minors) and that `PrivacyPolicyPage.tsx` already lists Clarity as "under review", there is no existing field to gate an adaptive layer on.

**Schema hygiene blocking any of the above**
22. `frontend/src/lib/database.types.ts` is stale in at least two confirmed places — `yearbook_entries` is entirely absent, and `job_openings.team_id` (live since 2026-09-02) is missing. It must be regenerated before it can be trusted as the graph's source of truth.

---

## Gaps in this audit

- **`/saved`, `/calendar`, `/yearbook` entry points** — not found in `AQNav.tsx`, `MobileMenuBar.tsx` or `AQFooter.tsx`. Read `frontend/src/profile/ProfilePage.tsx` and the `LeftRail` / `RightRail` sections of `frontend/src/public/HomePage.tsx` to confirm whether they are reachable at all.
- **The `post_feed_view` `images` and `tagged_members` Json shapes** — inferred from `mapPostFromDB` field names only. Read `frontend/src/services/feedService.ts:40-62` and the live view definition to confirm.
- **`frontend/src/lib/faqData.ts`** — assumed static; not opened.
- **Live schema** — everything in §3 comes from `lib/database.types.ts` and call sites, not from the database. CLAUDE.md's standing rule applies: verify column grants and policies live before trusting any schema-level guarantee. Two staleness cases are already confirmed above.
- **`director/*` tab internals** — only `DirectorDashboard.tsx`'s `NAV_GROUPS`, `PostModeration.tsx`'s scoping and `SopManagement.tsx`'s default filter were read. The other 15 desks were not opened.
