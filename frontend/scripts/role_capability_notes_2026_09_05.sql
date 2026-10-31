-- ────────────────────────────────────────────────────────────────────────────
-- role_capability_notes — "Roles & Permissions" reference page
--
-- STATUS: APPLIED to project hzowuwffjqtgszecngpe on 2026-09-05 via the
--         Supabase MCP connector (migration name
--         `role_capability_notes_2026_09_05`). Verified live afterwards by
--         re-querying pg_policies / information_schema (not just assumed from
--         this file) — see the exact result pasted at the bottom of this
--         comment block.
--
--   relrowsecurity = true
--   4 policies (re-queried from live pg_policies, verbatim):
--     role_capability_notes_delete_admin | DELETE | {authenticated} | is_super_admin() | —
--     role_capability_notes_insert_admin | INSERT | {authenticated} | —                | is_super_admin()
--     role_capability_notes_select       | SELECT | {authenticated} | true             | —
--     role_capability_notes_update_admin | UPDATE | {authenticated} | is_super_admin() | is_super_admin()
--   information_schema.role_table_grants for this table: `authenticated` holds
--     exactly DELETE/INSERT/SELECT/UPDATE (no TRUNCATE/TRIGGER/REFERENCES);
--     `anon` and `public` hold NO grant row at all (only postgres/service_role
--     show up otherwise, which is normal and outside RLS's concern).
--   30 seed rows present, grouped by role exactly as intended:
--     director 6 · hod 6 · hr 5 · lead 3 · member 5 · super_admin 5.
--
-- A .sql file in this repo is still not evidence it ran — the STATUS above is
-- only trustworthy because the verify queries at the bottom were actually
-- executed against the live database after applying, and their real output is
-- what is pasted above, not the expected output.
--
-- WHAT THIS IS
-- ────────────
-- A brand-new "Roles & Permissions" reference page (frontend/src/roles/RolesPage.tsx,
-- route /roles) shows, to any signed-in member, what each of the app's 6 roles
-- (member / lead / hod / director / hr / super_admin — the exact CHECK on
-- members.role) can actually do. This table holds ONLY the descriptive text
-- rendered on that page.
--
-- THIS IS NOT A PERMISSIONS ENGINE. Editing a row here changes what the page
-- SAYS a role can do; it has zero effect on what a role actually CAN do. Real
-- enforcement is, and remains, entirely in two places that this table never
-- touches:
--   1. frontend/src/lib/roles.ts — hasLeaderAccess() / isSuperAdmin() and the
--      LEADER_ROLES / ADMIN_ROLES tuples they read.
--   2. This database's row-level security policies (is_director(),
--      is_super_admin(), is_team_lead(team_id), is_assigned_to_category()) —
--      all pre-existing, none created or modified by this migration.
-- The seed content below was written by reading those two sources directly
-- (plus the live pg_policies for certificate_requests, the NAV_GROUPS table in
-- DirectorDashboard.tsx, and the per-route guards in App.tsx) — not invented.
--
-- WHY A NEW TABLE, NOT A CONSTANT IN THE FRONTEND BUNDLE
-- The whole point of the feature is that HR/Super Admin can correct or expand
-- the wording without a code deploy — e.g. the day another capability moves
-- between tiers (as certificates did on 2026-09-05), the description can be
-- fixed within the app in seconds instead of waiting on the next release.
--
-- RLS SHAPE
-- SELECT is open to any authenticated member — this is a transparency page,
-- not a leadership-only one, so `anon` still gets NO grant (a signed-out
-- visitor should not read internal role/permission wording) but every
-- signed-in member does. INSERT/UPDATE/DELETE are gated to is_super_admin(),
-- the DB twin of lib/roles.ts's isSuperAdmin() (true for 'hr' and
-- 'super_admin' only) — matching this feature's own requirement that editing
-- is "gated to isSuperAdmin(role) (hr + super_admin) both in the UI and in the
-- new table's RLS."
--
-- `updated_by` intentionally has no default and is set by the service layer on
-- every write (matching member_of_the_month.picked_by) — a null value just
-- means "seeded by this migration, never edited since."
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.role_capability_notes (
  id               bigint generated always as identity primary key,
  role             text not null
                     check (role in ('member','lead','hod','director','hr','super_admin')),
  capability_area  text not null check (char_length(capability_area) <= 120),
  description      text not null check (char_length(description) <= 2000),
  -- Render order within one role's card. Not a global rank — each role starts
  -- its own list at 1 — so the page can show "1. account approvals, 2. post
  -- moderation, ..." per role without an ORDER BY CASE in every query.
  display_order    integer not null default 0,
  updated_by       integer references public.members(member_id) on delete set null,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now(),

  -- One row per (role, capability_area) — an edit is an UPDATE against this
  -- natural key, not an ever-growing history of the same topic.
  constraint role_capability_notes_role_area_unique unique (role, capability_area)
);

create index if not exists role_capability_notes_role_idx
  on public.role_capability_notes (role, display_order);

-- ── RLS, enabled in the SAME migration that creates the table ───────────────
alter table public.role_capability_notes enable row level security;

-- Supabase's default privileges hand new public-schema tables to both `anon`
-- and `authenticated` — the revoke is not ceremonial. Without it a signed-out
-- visitor holds SELECT and only RLS stands between them and this content.
revoke all on public.role_capability_notes from anon, public;
grant select, insert, update, delete on public.role_capability_notes to authenticated;
-- Supabase's default grant to `authenticated` also includes TRUNCATE, which
-- RLS does NOT gate. Take it (and the two other unused privileges) back —
-- same convention as member_of_the_month_2026_09_05.sql.
revoke truncate, trigger, references on public.role_capability_notes from authenticated;

drop policy if exists role_capability_notes_select on public.role_capability_notes;
drop policy if exists role_capability_notes_insert_admin on public.role_capability_notes;
drop policy if exists role_capability_notes_update_admin on public.role_capability_notes;
drop policy if exists role_capability_notes_delete_admin on public.role_capability_notes;

-- Transparency page: every signed-in member reads every row, regardless of
-- their own role — a member should be able to read what a Super Admin can do,
-- not just their own tier.
create policy role_capability_notes_select on public.role_capability_notes
  for select to authenticated
  using (true);

-- Writes are is_super_admin() only — the DB twin of lib/roles.ts's
-- isSuperAdmin(), true for 'hr' and 'super_admin' and nobody else.
create policy role_capability_notes_insert_admin on public.role_capability_notes
  for insert to authenticated
  with check (public.is_super_admin());

create policy role_capability_notes_update_admin on public.role_capability_notes
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

create policy role_capability_notes_delete_admin on public.role_capability_notes
  for delete to authenticated
  using (public.is_super_admin());

-- ── Seed content ─────────────────────────────────────────────────────────
-- Every description below is grounded in a real, checked gate — see the file
-- header. Dollar-quoted ($$...$$) throughout so none of the many apostrophes
-- in this prose need manual '' escaping.
insert into public.role_capability_notes (role, capability_area, description, display_order) values

-- ── member ──────────────────────────────────────────────────────────────
($$member$$, $$Feed & posts$$,
 $$Can create posts to the community feed, and like, comment, save and share any post. A member's own post always enters the Post Queue for a HoD/Director/HR review before it goes live — unlike lead/HoD/Director/HR/Super Admin posts, which publish immediately unless the profanity filter flags the text (which forces a review for every role, no exceptions).$$,
 1),
($$member$$, $$Achievements & CV$$,
 $$Can log an external achievement (competition, leadership, academic or personal project) — it goes live immediately with no review queue — and share an approved one to the feed as a post. Can generate a personal CV built only from their own approved achievements, team memberships and logged volunteering hours.$$,
 2),
($$member$$, $$Teams & drives$$,
 $$Can browse teams and apply to join one — the request goes to that team's lead (or a HoD/Director if the team has none) for approval — and can check in and out of a welfare drive they've been assigned to.$$,
 3),
($$member$$, $$Certificates$$,
 $$Can request a certificate, Letter of Recommendation or Letter of Volunteering against their own logged hours. Only HR or a Super Admin can issue or decline it — a member can ask, never approve.$$,
 4),
($$member$$, $$This page$$,
 $$Can read this Roles & Permissions page like every signed-in member, but has no edit access to any of the text on it.$$,
 5),

-- ── lead (team-scoped — see lib/roles.ts: NOT part of hasLeaderAccess) ────
($$lead$$, $$Team leadership (own team only)$$,
 $$Full control of whichever specific team(s) that team's own roster marks them as an active lead on: edit the team's info, banner and skills, add or remove its members, and approve or reject that team's join requests. This is checked per team (is_team_lead), not app-wide — leading one team grants no authority over any other.$$,
 1),
($$lead$$, $$Team post queue$$,
 $$Can approve or reject posts routed through their own team's queue; the app sends the author the approved/rejected notification on the lead's behalf.$$,
 2),
($$lead$$, $$Everything a member can do, plus the above$$,
 $$A lead's own posts still enter the Post Queue exactly like a plain member's — lead is deliberately not part of the app's hasLeaderAccess tier, so it does not get the HoD-level auto-publish, account-approval powers, or any moderation reach outside its own team.$$,
 3),

-- ── hod (identical power to director) ─────────────────────────────────────
($$hod$$, $$Two titles, one power level$$,
 $$hod and director are two real-world job titles mapped to the exact same website access level (see lib/roles.ts's own header comment). Every row below applies equally to the director role — there is no capability a director has that a HoD lacks, or the reverse.$$,
 1),
($$hod$$, $$Account approvals$$,
 $$Can open the pending-signup queue and approve or reject a new Google sign-in's membership application. This is not category-scoped — any HoD/Director can decide on any pending applicant.$$,
 2),
($$hod$$, $$Post moderation$$,
 $$Can review the feed's Post Queue and approve or reject pending posts. When assigned to one or more categories (events, welfare, content, operations, labs) on the Categories desk, the Post Queue and its badge count narrow to just those categories in the UI; a HoD/Director with no category assignment sees every pending post.$$,
 3),
($$hod$$, $$People, teams & job openings$$,
 $$Can browse the full Member Directory, create and edit teams, assign a team's lead, assign a welfare drive's lead, pick the Member of the Month (with an optional citation), and post, edit, pause, close or delete a job/volunteer opening on the Opportunities page.$$,
 4),
($$hod$$, $$Operational desks$$,
 $$Can run SOPs & Goals, review Hiring responses and general Enquiries, and run a Yearbook invite round — all open to any HoD/Director with no further gating.$$,
 5),
($$hod$$, $$What's out of reach$$,
 $$The Certificates desk's nav entry and route are Super-Admin/HR only, and the database's own policy for issuing or declining a request is Super-Admin/HR only too, so a HoD/Director cannot decide one either way, in the app or directly. (The database's read policy is broader than the UI: a HoD/Director account can still query certificate_requests directly, same as before — only the write and the in-app desk were narrowed, on 2026-09-05.) Content, Projects, Manage HoDs and Volunteer Applications are also Super-Admin/HR only.$$,
 6),

-- ── director (identical power to hod) ─────────────────────────────────────
($$director$$, $$Two titles, one power level$$,
 $$director and hod are two real-world job titles mapped to the exact same website access level (see lib/roles.ts's own header comment). Every row below applies equally to the hod role — there is no capability a director has that a HoD lacks, or the reverse.$$,
 1),
($$director$$, $$Account approvals$$,
 $$Can open the pending-signup queue and approve or reject a new Google sign-in's membership application. This is not category-scoped — any HoD/Director can decide on any pending applicant.$$,
 2),
($$director$$, $$Post moderation$$,
 $$Can review the feed's Post Queue and approve or reject pending posts. When assigned to one or more categories (events, welfare, content, operations, labs) on the Categories desk, the Post Queue and its badge count narrow to just those categories in the UI; a HoD/Director with no category assignment sees every pending post.$$,
 3),
($$director$$, $$People, teams & job openings$$,
 $$Can browse the full Member Directory, create and edit teams, assign a team's lead, assign a welfare drive's lead, pick the Member of the Month (with an optional citation), and post, edit, pause, close or delete a job/volunteer opening on the Opportunities page.$$,
 4),
($$director$$, $$Operational desks$$,
 $$Can run SOPs & Goals, review Hiring responses and general Enquiries, and run a Yearbook invite round — all open to any HoD/Director with no further gating.$$,
 5),
($$director$$, $$What's out of reach$$,
 $$The Certificates desk's nav entry and route are Super-Admin/HR only, and the database's own policy for issuing or declining a request is Super-Admin/HR only too, so a HoD/Director cannot decide one either way, in the app or directly. (The database's read policy is broader than the UI: a HoD/Director account can still query certificate_requests directly, same as before — only the write and the in-app desk were narrowed, on 2026-09-05.) Content, Projects, Manage HoDs and Volunteer Applications are also Super-Admin/HR only.$$,
 6),

-- ── hr (identical power to super_admin) ────────────────────────────────────
($$hr$$, $$Two titles, one power level$$,
 $$hr and super_admin are deliberately equal in power — both satisfy the database's is_super_admin() check, and the UI's isSuperAdmin() helper treats them identically everywhere. hr exists purely so HR staff are labelled "HR" instead of "Super Admin"; there is no capability either role has that the other lacks.$$,
 1),
($$hr$$, $$Everything a HoD/Director can do$$,
 $$Holds every HoD/Director capability listed above, and is never category-scoped — an hr account always sees every pending post and every category on the Post Queue, with no need for a Categories assignment.$$,
 2),
($$hr$$, $$Certificates, LoRs & LoVs$$,
 $$The only tier (with Super Admin) that can open the Certificates desk and issue or decline a member's certificate, Letter of Recommendation or Letter of Volunteering request — moved out of reach of plain HoDs/Directors on 2026-09-05.$$,
 3),
($$hr$$, $$Top-tier desks$$,
 $$Can manage site Content (welfare projects and blog drafts) and Projects, promote or demote a member or change their role outright and manage their category assignments on the Manage HoDs desk, and read the Volunteer Applications outreach tracker.$$,
 4),
($$hr$$, $$Editing this page$$,
 $$hr and Super Admin are the only two roles that can edit the descriptions on this Roles & Permissions page. Editing here only changes the text members see — it never changes what a role can actually do; real enforcement lives in lib/roles.ts on the front end and in row-level security policies in the database.$$,
 5),

-- ── super_admin (identical power to hr) ────────────────────────────────────
($$super_admin$$, $$Two titles, one power level$$,
 $$super_admin and hr are deliberately equal in power — see the hr role above for the full explanation. Nothing in this list is exclusive to Super Admin.$$,
 1),
($$super_admin$$, $$Everything a HoD/Director can do$$,
 $$Holds every HoD/Director capability listed above, and is never category-scoped — a Super Admin account always sees every pending post and every category on the Post Queue, with no need for a Categories assignment.$$,
 2),
($$super_admin$$, $$Certificates, LoRs & LoVs$$,
 $$The only tier (with hr) that can open the Certificates desk and issue or decline a member's certificate, Letter of Recommendation or Letter of Volunteering request — moved out of reach of plain HoDs/Directors on 2026-09-05.$$,
 3),
($$super_admin$$, $$Top-tier desks$$,
 $$Can manage site Content (welfare projects and blog drafts) and Projects, promote or demote a member or change their role outright and manage their category assignments on the Manage HoDs desk, and read the Volunteer Applications outreach tracker.$$,
 4),
($$super_admin$$, $$Editing this page$$,
 $$Super Admin and hr are the only two roles that can edit the descriptions on this Roles & Permissions page. Editing here only changes the text members see — it never changes what a role can actually do; real enforcement lives in lib/roles.ts on the front end and in row-level security policies in the database.$$,
 5)

on conflict (role, capability_area) do nothing;

-- ── Verification (run after applying — paste the real result into the STATUS
--    line at the top of this file, don't just assume it matches) ───────────
-- select relrowsecurity from pg_class where oid = 'public.role_capability_notes'::regclass;
-- select policyname, cmd, roles::text, qual, with_check
--   from pg_policies where tablename = 'role_capability_notes' order by cmd;
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'role_capability_notes';
-- select role, count(*) from public.role_capability_notes group by role order by role;
