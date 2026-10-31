# Supabase client audit — `supabase` (legacy) vs `supabaseCommunity`

**Background.** `frontend/src/lib/supabase.ts` hardcodes project `nurtpdbqfizmqtztmiwk` with `persistSession:false`. `frontend/src/lib/supabaseCommunity.ts` is env-driven against `hzowuwffjqtgszecngpe` and is the one `AuthContext` signs into. The two clients point at **different Supabase projects** — same code talking to two different databases.

**Reframing the risk model.** The user's brief described the risk as "RLS reads that need `auth.uid()`". I found **no** importer that does an `auth.uid()`-gated read — every paradox page that looks authenticated actually uses Paradox's own session table (`paradox_admin_sessions` + `paradox/lib/auth`), not Supabase auth. The real failure mode in this codebase is **wrong-project writes**: a form inserts into the legacy project, but the admin surface that needs to see those rows reads from the community project (this is the exact bug fixed by db7bb33 for volunteer applications). The categories below are graded against that risk.

Audit covers 35 importers of `../lib/supabase`. No code changes were made.

---

## A. MUST migrate to `supabaseCommunity` — wrong-project writes

These insert form submissions through the legacy client. If the admin surface that triages them already reads from the community DB (as `VolunteerApplications.tsx` now does), the rows land in `nurtpdbqfizmqtztmiwk` but nobody ever reads them — same failure mode as commit db7bb33.

- [frontend/src/paradox/pages/Volunteer.tsx](frontend/src/paradox/pages/Volunteer.tsx:194) — INSERT `paradox_volunteers`. **Risk: directly parallel to the RecruitmentPage fix — applications submitted here likely never reach the community-side admin.** Verify whether this page is still reachable; if so, mirror db7bb33.
- [frontend/src/paradox/pages/Register.tsx](frontend/src/paradox/pages/Register.tsx:367) — INSERT `paradox_registrations` (with fallback retry). **Risk: registrations only visible in legacy-DB admin tab; community-side admin sees none.**
- [frontend/src/paradox/pages/Sponsor.tsx](frontend/src/paradox/pages/Sponsor.tsx:387) — INSERT `paradox_inquiries`. **Risk: sponsor leads silently routed to legacy DB.**
- [frontend/src/paradox/pages/Contact.tsx](frontend/src/paradox/pages/Contact.tsx:226) — INSERT `paradox_inquiries` (paradox contact form, masquerades as `(contact form)` company). **Risk: same as Sponsor — wrong project.**
- [frontend/src/public/CollaborationsPage.tsx](frontend/src/public/CollaborationsPage.tsx:42) — INSERT `collaboration_submissions`. **Risk: unknown — depends on whether anyone reviews this table. If a community-side admin reviews leads, this is broken.** Also reads `welfare_projects` for a 6-card showcase (safe — see C).

---

## B. Likely fine but tech debt — public reads on legacy

These hit tables that almost certainly live on the legacy welfare/paradox project. They work today through anon-key public-read RLS. They will silently empty out if/when the relevant table is migrated to the community project, with no error (just empty arrays / null). Each is a candidate for explicit `supabaseWelfare` import (like `searchService.ts` already does) so the intent is loud.

**Welfare / blog (almost certainly stays on legacy):**
- [frontend/src/public/PublicProjectsPage.tsx](frontend/src/public/PublicProjectsPage.tsx:89) — `welfare_projects` listing + count. Already has a visible error UI mentioning the legacy project ID, so failures are surfaced.
- [frontend/src/public/PublicProjectDetailPage.tsx](frontend/src/public/PublicProjectDetailPage.tsx:62) — `welfare_projects` single + related.
- [frontend/src/public/BlogListPage.tsx](frontend/src/public/BlogListPage.tsx:60) — `blogs` listing.
- [frontend/src/public/BlogPostPage.tsx](frontend/src/public/BlogPostPage.tsx:13) — `blogs` single.

**Paradox public-facing reads (need a call: where do `paradox_*` tables actually live?):**
- [frontend/src/paradox/pages/Home.tsx](frontend/src/paradox/pages/Home.tsx:375) — `paradox_events` teaser.
- [frontend/src/paradox/pages/Events.tsx](frontend/src/paradox/pages/Events.tsx:63) — `paradox_events` listing (15-min sessionStorage cache).
- [frontend/src/paradox/pages/EventDetail.tsx](frontend/src/paradox/pages/EventDetail.tsx:65) — `paradox_events` + `paradox_scores`.
- [frontend/src/paradox/pages/Scores.tsx](frontend/src/paradox/pages/Scores.tsx:27) — `paradox_events` + `paradox_scores`.
- [frontend/src/paradox/pages/Winners.tsx](frontend/src/paradox/pages/Winners.tsx:158) — `paradox_winners`.
- [frontend/src/paradox/pages/Updates.tsx](frontend/src/paradox/pages/Updates.tsx:48) — `paradox_updates`.
- [frontend/src/paradox/pages/Blog.tsx](frontend/src/paradox/pages/Blog.tsx:40) — `paradox_blog_posts` listing.
- [frontend/src/paradox/pages/BlogDetail.tsx](frontend/src/paradox/pages/BlogDetail.tsx:80) — `paradox_blog_posts` single, plus an UPDATE on `views` counter (anon write — fine if RLS allows; will silently no-op otherwise).
- [frontend/src/paradox/pages/AfterParty.tsx](frontend/src/paradox/pages/AfterParty.tsx:283) — `paradox_site_settings` (afterparty_phases key).
- [frontend/src/paradox/components/Nav.tsx](frontend/src/paradox/components/Nav.tsx:280) — `paradox_site_settings` (site_phase key). **Critical for nav rendering: if this read fails the entire site phase falls back to `pre_event`, hiding/showing wrong nav items.**
- [frontend/src/paradox/pages/Story.tsx](frontend/src/paradox/pages/Story.tsx:33) — `paradox_events` (story generator dropdown).
- [frontend/src/paradox/pages/Ticket.tsx](frontend/src/paradox/pages/Ticket.tsx:23) — `paradox_registrations` by token, polled every 30s. Paired with Register.tsx — if you migrate Register's writes to community, you must migrate this read too or the ticket page will never find the row it just inserted.

**Public ContactPage (separate from paradox/Contact.tsx):**
- [frontend/src/public/ContactPage.tsx](frontend/src/public/ContactPage.tsx:22) — INSERT `contact_submissions` with a graceful mailto fallback on error. Lower severity than group A because the fallback masks the failure for the user — but the submission is still lost on the DB side. Worth migrating if a community admin reviews these.

---

## C. Auth flows — none broken via Supabase auth

The brief flagged "auth flows (login/register) — probably already broken if they use `supabase`". I did not find any. The two systems are cleanly separate:

- **Community auth** (`AuthContext`) → `supabaseCommunity` → standard Supabase auth with persisted session. Used by the dashboard / community / volunteer-admin flows.
- **Paradox admin auth** → `paradox/lib/auth` + `paradox_admin_sessions` table, queried through the legacy `supabase` client. **This is a custom session table, not Supabase auth.** It does not depend on `auth.uid()` and is unaffected by which client is used, as long as the table itself is on legacy.

So [frontend/src/paradox/pages/Admin.tsx](frontend/src/paradox/pages/Admin.tsx:7) (44 calls touching `paradox_admin_sessions`, `paradox_admin_permissions`, `paradox_auth_users_view`, `paradox_audit_log`, plus all the paradox_* content tables it edits) is internally consistent on legacy — but it will diverge from any data the community surfaces start producing. If any group-A writes get migrated, the matching Admin.tsx read+write paths must move in lockstep, or admins will see/edit stale data.

---

## D. Constants-only imports — zero risk

These import only `DEPT_COLORS` (a hex-map constant). They do not instantiate or call the supabase client at all. Verified by grep — no `supabase.from|supabase.auth|supabaseCommunity` matches in any of these files. Tech debt only: the constant should probably live in a `lib/colors.ts` so importers don't pretend to depend on a database client.

- [frontend/src/teams/TeamDetailPage.tsx](frontend/src/teams/TeamDetailPage.tsx:9)
- [frontend/src/teams/TeamCard.tsx](frontend/src/teams/TeamCard.tsx:4)
- [frontend/src/feed/FeedPage.tsx](frontend/src/feed/FeedPage.tsx:9)
- [frontend/src/feed/PostCard.tsx](frontend/src/feed/PostCard.tsx:8)
- [frontend/src/feed/FeedPostCard.tsx](frontend/src/feed/FeedPostCard.tsx:10)
- [frontend/src/feed/CreatePostModal.tsx](frontend/src/feed/CreatePostModal.tsx:9)
- [frontend/src/public/HomePage.tsx](frontend/src/public/HomePage.tsx:13)
- [frontend/src/director/TeamManagement.tsx](frontend/src/director/TeamManagement.tsx:4)
- [frontend/src/director/CategoryManagement.tsx](frontend/src/director/CategoryManagement.tsx:4)
- [frontend/src/director/PostModeration.tsx](frontend/src/director/PostModeration.tsx:5)
- [frontend/src/components/NoticeBoard.tsx](frontend/src/components/NoticeBoard.tsx:4)

---

## E. Intentional dual-client usage — already correct

- [frontend/src/services/searchService.ts](frontend/src/services/searchService.ts:4) — explicitly imports the legacy client as `supabaseWelfare` and uses it only for `welfare_projects`. Every other query (`members`, `teams`, `schools`, `post_feed_view`) goes through `supabaseCommunity`. This is the pattern the rest of the codebase should converge on.

---

## Recommended next moves

1. **Confirm with the DB which `paradox_*` tables live on which project.** Everything in group B is "fine if the table is on legacy, broken if it's been moved." That ambiguity is the root cause; the audit can't resolve it without DB access.
2. **Migrate group A in this order** (writer + paired reader together to avoid orphan-row windows):
   - `Register.tsx` (writer) + `Ticket.tsx` (reader of the same row) + Admin.tsx's `paradox_registrations` tab — these three are coupled.
   - `Volunteer.tsx` — if still routed, mirror RecruitmentPage's db7bb33 fix.
   - `Sponsor.tsx` + paradox `Contact.tsx` — both write `paradox_inquiries`; migrate together with the Inquiries admin tab.
   - `CollaborationsPage.tsx` writer — confirm whether `collaboration_submissions` has any consumer at all first; may be dead.
3. **Rename the legacy module** from `lib/supabase.ts` to `lib/supabaseWelfare.ts` so every importer is forced to acknowledge which project it's hitting. The current generic name is what allowed the divergence to spread to 24 files. Move `DEPT_COLORS` / `OBJ_COLORS` / `normalizeObj` / `relativeDate` / interfaces out to a separate `lib/welfare.ts` first so constants-only importers don't have to depend on a DB client at all.
