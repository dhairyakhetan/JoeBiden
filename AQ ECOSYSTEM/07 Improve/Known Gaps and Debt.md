---
tags: [improve, debt, security]
verified: 2026-08-10
---

# Known Gaps and Debt

Everything found by reading the live code and live schema on **2026-08-10**.
Each item says *what*, *why it matters*, and *where the evidence is*. Nothing here
is speculative — where something needs confirming, it says so.

Ordered by severity. **Live** = observed happening; **latent** = the hole is real
but measurement shows it has not been exercised. That distinction comes from
[[Simulation Log 2026-08-10]], which also **corrected two items on this list**.

---

## 🔴 Security

### S0 · ✅ FIXED 2026-08-10 · The PII column lockdown was not applied — 1314 emails readable by any signed-in user
*Root cause: `authenticated` held **table-level** SELECT, which nullifies any
column-level grant. Fixed by revoking the table grant and granting back every
column except the four. Verified: the query now returns `permission denied`, and
`/`, `/members`, `/login` all still render. See [[Fix Log 2026-08-10]].*
`authenticated` still holds `SELECT` on `members.email`, `phone`, `auth_uid`,
`google_id`, despite `scripts/members_pii_lockdown_2026_07_29.sql`. With the
"Anyone can view active members" policy, one query returns **1314 student emails
and 37 phone numbers** — to any account, including an unapproved
`pending_approval` one. `anon` is correctly locked down, so the migration landed
partially or was later undone.

**Fix:**
```sql
REVOKE SELECT (email, phone, auth_uid, google_id) ON public.members FROM authenticated;
```
`get_own_member()` already exists, so nothing breaks. Subjects are students, many
minors — treat as urgent. → [[Simulation Log 2026-08-10]] SIM-1 · [[members]]

### S1 · LATENT · `job_applications` INSERT lets anyone apply as anyone
*Measured: 0 email mismatches across 5 applications — the hole is real but has not
been exercised. Fix it anyway.*
`CHECK (auth.role() = 'authenticated')`. `applicant_id`, `applicant_name`,
`applicant_email` and `applicant_phone` are all client-supplied; nothing ties the
row to the caller. A `pending_approval` account can apply, and can apply **as
another member**. Only `UNIQUE (opening_id, applicant_id)` accidentally limits it.

**Fix:** `WITH CHECK (applicant_id = get_current_member_id())`. One line.
→ [[job_openings]] · [[Flow - Hiring and Applications]]

### S2 · Public intake tables have no rate limiting
`volunteer_applications`, `contact_submissions`, `collaboration_submissions` and
`legacy_volunteer_applications` all allow `anon` INSERT with `CHECK (true)`. No
captcha, honeypot, or per-IP throttle. 495 legitimate rows means it has not been
abused *yet*; the only recourse after abuse would be manual deletion.

**Fix:** an Edge Function in front, a `created_at`-windowed constraint, or
Turnstile. Also revoke the still-open `anon` INSERT on the retired
`legacy_volunteer_applications`. → [[Intake Tables]]

### S3 · Four storage buckets have no size cap and no MIME allow-list
`post-images`, `avatars`, `project-images` are public with no limits;
`post-documents` is capped but unrestricted by type. Any authenticated user can
upload a 200 MB file, or an `.svg` (script-capable, served from a public URL), or
an `.html`.

**Fix:** set caps and MIME lists in the Supabase dashboard — **no code change**.
Deliberately exclude `image/svg+xml`. The Paradox photobooth buckets are already
configured correctly; copy them. → [[Storage Buckets]]

### S4 · Category scoping is not enforced in the database
`posts` SELECT/UPDATE is `is_director()` with **no** category clause. A
category-scoped HoD can read and approve *any* pending post via the API;
`PostModeration` only filters the rendered list.

**Decide:** is scoping a boundary or a UI convenience? If a boundary, add a
category clause for non-super-admins. → [[Category Scoping]] · [[Permission Matrix]]

### S5 · `welfare_projects` RLS is broader than its desk
The desk is `requireSuperAdmin`; RLS is `is_director() OR is_super_admin()`. Any
director can write 558 rows of the org's primary content record via the API.

**Fix:** tighten the policy to `is_super_admin()`, or open the desk to directors.
→ [[welfare_projects]] · [[Desk - Admin Only]]

### S6 · `post_tags` / `post_categories` SELECT is `USING (true)`
Tags on a **pending or scheduled** post are world-readable before the post is.
Anyone can enumerate who is tagged in an unapproved post. Low severity, real.
→ [[RLS Policy Matrix]]

---

## 🟠 Correctness

### ~~C1 · Client-written notifications fail silently~~ — WITHDRAWN, was wrong
`notificationService.create()` calls the `create_notification(...)`
`SECURITY DEFINER` RPC, not a direct INSERT. The `service_role`-only policy is
deliberate, and the RPC additionally restricts authority notification types to
leaders. Verified live: 23 `post_approved`, 8 `like`, 1 `follow`. This is the
schema's **best** authorisation design, not a bug.
→ [[Simulation Log 2026-08-10]] SIM-3

### C1b · LIVE · Unlike/relike floods the author with notifications
8 `like` notifications against 4 rows in `likes`. Unliking does not retract the
notification and nothing dedups on `(post, actor, type)`.
**Fix:** a partial unique index, or a 24-hour guard inside the RPC.
→ [[notifications]]

### C1c · LIVE · The only HoD in the org cannot see the Approvals tab
`canApproveMembers = isSuperAdmin || cats.includes('operations')`, and the single
`hod` has **no `director_categories` rows** — so the tab is hidden from them
entirely. All 20 assignments belong to super admins, for whom scoping is a no-op.
**Fix:** assign the HoD their categories, or reconsider whether `operations` should
gate approvals at all. → [[Simulation Log 2026-08-10]] SIM-8 · [[Category Scoping]]

### C1d · LIVE · Welfare projects have no image gate; 57 render as empty cards
A blog cannot enter the feed without a cover — enforced twice, explicitly to avoid
"an empty grey card in the feed." A welfare project has **no equivalent gate**, and
**57 live projects have no `main_image`**, producing exactly that card.
**Fix:** add `main_image IS NOT NULL` to the welfare mirror's publish condition, or
make it required in `ProjectModal`. → [[Simulation Log 2026-08-10]] SIM-7

### C1e · A rejected post is a dead end for its author
`posts` UPDATE is `(author = me AND status = 'pending_review') OR is_director()`. A
**rejected** post can no longer be edited or resubmitted by its author — only
deleted and retyped from scratch, losing attachments, tags and stats. The
`rejection_note` explains what to fix on a row they may not touch.
**Fix:** the [[external_achievements]] pattern — allow author edits while
`status IN ('pending_review','rejected')` and reset to `pending_review` on edit via
trigger. Zero live rejected posts, so this can be fixed risk-free today.
→ [[Simulation Log 2026-08-10]] SIM-9

### C2 · `is_assigned_to_category()` omits the `hod` role
It checks `role IN ('director','super_admin')`, while `is_director()` accepts
`hod`. So an HoD passes every generic gate but **cannot** insert a
`post_approvals` row. Given the stated rule that hod ≡ director, this is a bug.
→ [[Views and RPCs]]

### C3 · LATENT · Un-publishing a welfare project does not unpublish its post
*Measured: 0 projects currently in this state, and mirror integrity is perfect
across 558 projects / 36 blogs / 5 openings. Fix before someone un-publishes.*
`mirror_welfare_project_to_post()` only fires on draft→live. Flipping `is_draft`
back to true hides the project from `/projects` while its feed post and
`/post/:uuid` permalink **stay live**. A super admin reasonably believes it is
gone.

**Fix:** an `AFTER UPDATE` branch setting `posts.deleted_at` when `is_draft` flips
back. → [[Flow - Welfare Project Publishing]]

### C4 · A blog with no `featured_image` is live and permanently invisible
Both the mirror trigger and cron pass 2 require it. The blog works at
`/blog/:slug` and never enters the feed, with no warning in the composer or the
drafts desk. Note `post_feed_view` *displays* `COALESCE(featured_image, cover)`,
but the gates check `featured_image` only — so `cover`-only blogs are stuck.

**Fix:** make the cover required in the composer. → [[blogs]] · [[Flow - Blog Authoring]]

### C5 · Mirrored posts never update after creation
All three triggers act once. Editing an opening's title, or a project's body text,
leaves a stale `posts.body`. Mitigated for projects and blogs because
`post_feed_view` re-reads the source columns live; **not** mitigated for
`posts.body`, which is what a body-text search would match.
→ [[Triggers and Cron]]

### C6 · `arcade_scores` INSERT policy compares mismatched uuids
`CHECK (member_uuid = auth.uid())`, but `member_uuid` FKs to `members(uuid)`,
which is not `auth.users.id`. The check can essentially never pass. Same confusion
in `trivia_admin_write`. Dormant (route redirects home) but broken.
→ [[RLS Policy Matrix]]

### C7 · Team-lead RLS checks ignore `is_active` / `left_at`
Every lead policy matches on `team_members.role = 'lead'` alone. A lead who has
left keeps lead powers until their row is **deleted** — a soft removal revokes
nothing.

**Fix:** add `AND tm.is_active` to every lead policy. → [[teams]]

### C8 · `approve_post_category` is overloaded with two different return types
`(uuid, varchar) → json` and `(uuid, text) → jsonb`. PostgREST resolves by
argument type, so the shape the client parses depends on resolution. Drop one.
→ [[Views and RPCs]]

### C9 · Post attachments are best-effort with no repair path
`post_images` / `post_documents` / `post_tags` inserts only `console.warn` on
failure. A post can publish with its images silently missing — no repair job, no
user-facing signal. → [[posts]]

### C10 · `/director/categories` shows a UI whose every action fails for non-super-admins
`director_categories` SELECT is any director; INSERT/DELETE is super-admin only.
The tab is not marked `superOnly`, so a plain director opens it and gets a
permission error on every change.

**Fix:** mark it `superOnly` (plus route guard), or render read-only.
→ [[Desk - People]]

---

## 🟡 Consistency and typing

### T1 · `lib/supabase.ts` is typed `any`, so all CMS queries are unchecked
Every `welfare_projects` and `blogs` query — `PublicProjectsPage`,
`PublicProjectDetailPage`, `BlogListPage`, `BlogPostPage`, `ProjectManager` and
friends — bypasses `tsc` entirely. A renamed column becomes `undefined` at
runtime. Given `npm run build` is the primary verification gate, this is a real
hole in it. → [[Supabase Clients]]

### T2 · Timestamp types are inconsistent
Older tables use `timestamp without time zone`; newer ones `timestamptz`. Writers
mix `CURRENT_TIMESTAMP` and `timezone('utc', now())`. Live drift with real
comparison risk. → [[Schema Overview]]

### T3 · Two identical functions: `get_current_member_id()` and `current_member_id()`
Policies use the first; `blogs.author_id`'s DEFAULT uses the second. Consolidating
is safe but touches a column default. → [[Views and RPCs]]

### T4 · Three policies hand-roll the role list instead of calling `is_director()`
`job_applications` (SELECT, UPDATE) and `volunteer_applications` (SELECT, UPDATE)
inline `role = ANY(ARRAY['director','hod','super_admin'])` — exactly the drift the
codebase forbids in TypeScript. → [[RLS Policy Matrix]]

### T5 · Stale comments that actively mislead
- `searchService.ts`: says welfare projects live in a separate Supabase project.
  **False** since consolidation.
- `CLAUDE.md`: "three separate Supabase projects" — it is two.
- `scripts/welfare_projects_allow_admin_write_2026_07.sql`: describes a
  `USING (true)` policy that is no longer live.
→ [[Architecture Overview]]

### T6 · Duplicate/legacy columns
`blogs.body` vs `blogs.content`; `blogs.featured_image` vs `blogs.cover`;
`welfare_projects.status` (unused, `is_draft` is the real state);
`members.join_reason` (no longer collected). Confirm against live rows before
deleting. → [[blogs]]

---

## 🔵 Built but not shipped / not used

| # | Thing | Evidence |
|---|---|---|
| U1 | **Comments** — table, RLS, `updated_at` trigger, `comment_count` in the view, a notification type. **No UI.** Every card renders a permanent `0` | [[Engagement Tables]] |
| U2 | **`post_approvals`** multi-category approval — table, policy, RPC, client method. **0 rows**, and broken for HoDs (C2) | [[Engagement Tables]] |
| U3 | **`schools`** — full table, service, RLS, `members.school_id`, a `/schools` page. **0 rows** | [[Schema Overview]] |
| U4 | **Arcade** — 2 tables, 30 seeded trivia questions, broken policies (C6). Route redirects home | [[RLS Policy Matrix]] |
| U5 | **`team_invite`** notification type with no producer | [[notifications]] |
| U6 | **Team-lead powers** granted by RLS with no `/lead` surface | [[teams]] |
| U7 | **`/welcome`** — a finished 5-step onboarding tour that nothing links to | [[Flow - Public Visitor Journey]] |
| U8 | **The follow graph** does not filter the feed — decorative | [[Flow - Engagement and Notifications]] |

---

## ⚫ Operability

### O1 · The cron job has no observability
`publish_due_scheduled_posts()` returns `n + m` and the value is discarded. No log
table, no alert. A broken function means posts silently never publish until an
author complains. `community_audit_logs` would be the natural home.
→ [[Flow - Scheduled Publishing]]

### O2 · Two desks have no unread signal
Hiring and Enquiries produce no count in `getDashboardStats`, and
`DirectorLanding` honestly omits them rather than inventing a number. A contact
enquiry can sit for a week with nothing indicating it exists.
→ [[Desk - Intake]]

### O3 · `post_feed_view` uses per-row correlated subqueries
`like_count`, `comment_count`, `images`, `tagged_members` are all per-row
subqueries. Free at 586 posts and 4 likes; the first thing to watch if engagement
arrives. → [[post_feed_view]]

### O4 · A single hardcoded email is load-bearing
All three mirror triggers resolve their author from
`members WHERE email = 'official@ngoaquaterra.com'`. Rename, re-email or delete
that row and **every** project publish, blog publish and opening creation fails on
`posts.author_id NOT NULL`. Nothing in the app documents this.
→ [[Triggers and Cron]]

### O5 · `bustProjectsCache()` is a manual, unenforced obligation
Any new write path to `welfare_projects` must call it or a director sees stale data
for 30 minutes. → [[Caching Layers]]

### O6 · No orphan cleanup for storage
Deleting a post CASCADEs `post_images` rows; the objects stay. Public buckets keep
permanent URLs. Storage grows monotonically. Note the `protect_delete` triggers on
`storage.objects` — confirm intent before writing any cleanup.
→ [[Storage Buckets]]

### O7 · Test coverage is three pure-function files
`lib/roles.ts`, `lib/imageUrl.ts`, `lib/profanityFilter.ts`. Nothing covers RLS,
services, triggers, or the cron. Given RLS *is* the authorisation layer, an
RLS-policy test suite is the highest-leverage test to add.
→ [[Deployment and Vercel]]

### O8 · Intake forms have zero instrumentation
`lib/funnel.ts` covers the OAuth funnel only. Nobody knows the submit or abandon
rate on `/contact` or `/collaborations`. → [[Intake Tables]]

---

## ⚪ Deliberately deferred

- **Paradox debt** — a whole vendored product; its own boundaries, own project,
  own conventions. → [[Paradox Sub-App]]
- **The photobooth consumer** — recorded as open by design.
- **`welfare_projects` four hardcoded image slots** — the right shape is a child
  table; it is a 558-row migration plus five consumer rewrites. → [[Improvement Backlog]]

Next: [[Improvement Backlog]] — the same items, sequenced by value.
