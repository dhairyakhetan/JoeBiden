-- ────────────────────────────────────────────────────────────────────────────
-- Member education / schooling history — own-editable CV entries
--
-- STATUS: applied live 2026-09-05 to project hzowuwffjqtgszecngpe via the
--         Supabase MCP connector (migration name `member_education_2026_09_05`).
--         Verified afterwards against live information_schema/pg_policies —
--         see the verification block at the bottom of this file.
--
-- WHAT THIS IS
-- cv.ts / cvService.ts (FR9, "geneate CV button") composes a CV out of the
-- AquaTerra record but had ZERO fields for schooling: no school/college name,
-- no class/grade or degree, no years attended, no marks. This adds a place
-- for a member to record that themselves, editable only by them, rendered as
-- a new section in the generated CV.
--
-- WHY A NEW TABLE, NOT A COLUMN OR A JSON BLOB ON `members`
--   1. `members` is under a column-level PII lockdown (members_pii_lockdown_
--      2026_07_29.sql / stage2_revoke) — SELECT was re-granted column by
--      column, so a brand-new column on `members` inherits NO grant and is
--      silently unreadable by `authenticated`. member_of_the_month_2026_09_
--      05.sql hit exactly this and chose a separate table for the same
--      reason — that reasoning applies here unchanged.
--   2. "One member can have multiple entries: school, then college" (and
--      possibly more — transfers, postgrad) is a one-to-many relationship.
--      This codebase already has a direct precedent for "a member's own list
--      of dated CV-shaped entries with RLS-scoped CRUD" in
--      external_achievements (add_achievement_approval_workflow.sql) and
--      member_breaks (member_breaks_2026_08_29.sql) — a real table gets a
--      per-row id for free (the edit/delete UI needs one to address a single
--      entry), a real FK/cascade-delete tie to the member, and indexable/
--      orderable columns, none of which a jsonb blob gives you without hand-
--      rolled bookkeeping in every reader. teams.skills (teams_skills_and_
--      banner_2026_07.sql) is this codebase's one real "array on a row"
--      precedent, and it fits there only because skills are unordered short
--      tags with no per-item metadata (no dates, no id, nothing to edit
--      independently) — education entries are the opposite of that.
--
-- SHAPE
--   institution   text, required — school/college name.
--   credential    text, optional — "class/grade or degree" (e.g. "Class 12",
--                 "B.Tech Computer Science"). Free text, no enum: the same
--                 trust model as every other free-text profile field in this
--                 app (members_social_links_2026_08_29.sql's reasoning) — the
--                 client shape-checks, the DB just stores what it's given.
--   start_year /
--   end_year      integer, both optional — "years attended". Plain years,
--                 not date columns: nobody enrols or graduates on a specific
--                 day, and the existing formatCvRange()/formatCvMonth() in
--                 cv.ts are month-precision date-string parsers — the wrong
--                 tool here. This migration ships alongside a new
--                 formatCvYearRange() in cv.ts built for exactly this.
--                 end_year absent means "ongoing".
--   grade         text, optional — marks/CGPA/grade, the member's own choice
--                 to share (the ask is explicit: "if they want to share it").
--
-- RLS MODEL: "own row" for writes, same shape as member_breaks/
-- certificate_requests —
--   SELECT: own rows, or any director/super_admin — consistent with every
--           other member-owned CV-record table in this feature
--           (certificate_requests, external_achievements, member_breaks all
--           let leadership read a member's own record). Leaders get no write
--           path here — this is read-only for them, there is no HR desk for
--           schooling data.
--   INSERT/UPDATE/DELETE: own rows ONLY. No approval workflow (unlike
--           external_achievements) — schooling history is mundane self-
--           reported profile data, not a claimed accomplishment shown to the
--           public. It is never rendered anywhere outside the member's own
--           generated CV (profile/CvCard.tsx is used only on the member's
--           own ProfilePage, never on the public profile route) or their own
--           signed-in editing view.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.member_education (
  id           bigint generated always as identity primary key,
  member_id    integer not null references public.members(member_id) on delete cascade,
  institution  text not null,
  credential   text,
  start_year   integer,
  end_year     integer,
  grade        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint member_education_years_check
    check (start_year is null or end_year is null or end_year >= start_year)
);

comment on table public.member_education is
  'A member''s own schooling/education history (school, college, ...), self-reported and self-edited. Feeds cv.ts/cvService.ts CV generation (profile/CvCard.tsx) - own-editable, no approval workflow, matching the "mundane self-reported profile data" trust tier (bio, class_grade, instagram/linkedin), not the "claimed accomplishment" tier (external_achievements).';

comment on column public.member_education.credential is
  '"class/grade or degree" - e.g. "Class 12", "B.Tech Computer Science". Free text, no enum.';

comment on column public.member_education.grade is
  'Marks/CGPA/grade - the member''s own choice to share. Free text, no format validation.';

create index if not exists idx_member_education_member_id on public.member_education(member_id);

alter table public.member_education enable row level security;

-- Grants. Supabase's default privileges hand new public-schema tables to both
-- `anon` and `authenticated` — this table is signed-in-only (same revoke/
-- grant pair as member_of_the_month_2026_09_05.sql, for the same reason).
revoke all on public.member_education from anon, public;
grant select, insert, update, delete on public.member_education to authenticated;
-- TRUNCATE rides along in Supabase's default `authenticated` grant and RLS
-- does NOT gate it - take it (and the two other unused privileges) back.
revoke truncate, trigger, references on public.member_education from authenticated;

drop policy if exists "member_education_select" on public.member_education;
create policy "member_education_select"
  on public.member_education for select
  using (
    member_id = public.get_current_member_id()
    or public.is_director()
    or public.is_super_admin()
  );

drop policy if exists "member_education_insert_own" on public.member_education;
create policy "member_education_insert_own"
  on public.member_education for insert
  with check (member_id = public.get_current_member_id());

drop policy if exists "member_education_update_own" on public.member_education;
create policy "member_education_update_own"
  on public.member_education for update
  using (member_id = public.get_current_member_id())
  with check (member_id = public.get_current_member_id());

drop policy if exists "member_education_delete_own" on public.member_education;
create policy "member_education_delete_own"
  on public.member_education for delete
  using (member_id = public.get_current_member_id());

-- `updated_at` on every UPDATE - reusing the existing generic trigger
-- function (already live; used by sops/sop_templates/drive_attendance), not
-- a new one.
drop trigger if exists member_education_set_updated_at on public.member_education;
create trigger member_education_set_updated_at
  before update on public.member_education
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: table exists, RLS enabled
--   select relrowsecurity from pg_class where relname = 'member_education';
--
-- Expect: exactly 4 policies, none referencing a raw members.auth_uid/email/
-- phone subquery (would throw "permission denied for table members" in prod)
--   select policyname, cmd, qual, with_check from pg_policies
--    where tablename = 'member_education';
--
-- Expect: anon holds no grant; authenticated holds select/insert/update/
-- delete only (no truncate/trigger/references)
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name = 'member_education';
--
-- Expect: the updated_at trigger is present and enabled
--   select tgname, tgenabled from pg_trigger
--    where tgrelid = 'public.member_education'::regclass;
-- ============================================================================
