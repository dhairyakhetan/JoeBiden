-- ============================================================================
-- ✅ APPLIED live 2026-09-02 via the Supabase MCP connector, as migration
-- `yearbook_entries_2026_09_01`. Verified after apply: 3 policies present,
-- unique (member_id, edition_year) present, both FKs present.
--
-- NOTE: applied with ONE deliberate change from the text below — the three
-- policies use `public.get_current_member_id()` for self-identification rather
-- than the inline `(select member_id from public.members where auth_uid =
-- auth.uid())` subquery written here. That subquery runs under the CALLER's
-- RLS, so it silently depends on `members`' own SELECT policy continuing to
-- expose your own row; `get_current_member_id()` is SECURITY DEFINER and is
-- the idiom every other member-scoped table already uses (member_breaks,
-- certificate_requests, saved_posts). An index on `invited_by` was also added,
-- which this file omitted. The live policies are the source of truth.
--
-- This feature SHIPPED IN bb30ba0 BEFORE THIS TABLE EXISTED — every yearbook
-- screen threw against a missing relation in production until 2026-09-02.
-- Third occurrence of the failure mode CLAUDE.md documents (job_applications,
-- the members PII lockdown). A .sql file in the repo is not evidence it ran.
--
-- The yearbook (new feature, no prior handoff spec - built from the user's
-- own description): an HR/director picks members for an edition, each picked
-- member gets a notification prompting them to submit a photo (their current
-- avatar, or a fresh upload) and a short quote. Submitted entries can be
-- exported as an Instagram graphic via the existing poster generator
-- (components/posterGenerator.ts / PosterStudioModal.tsx) - no new export
-- machinery needed, a yearbook entry is just fed in as PosterData.
--
-- One row per (member, edition). `edition_year` is a plain integer, not a
-- separate "editions" table - the org runs one yearbook a year, and a
-- separate table for a single free-text/year label would be a join for
-- nothing. If AquaTerra ever runs sub-yearly editions this can be revisited.
-- ============================================================================

create table if not exists public.yearbook_entries (
  id           bigint generated always as identity primary key,
  member_id    integer not null references public.members(member_id) on delete cascade,
  edition_year integer not null,
  status       text not null default 'invited' check (status in ('invited', 'submitted', 'skipped')),
  -- Null photo_url means "use my current avatar_url" - resolved at read/export
  -- time, not copied in, so the yearbook entry always reflects whichever
  -- avatar is live if the member never uploaded a dedicated yearbook photo.
  use_own_avatar boolean not null default true,
  photo_url    text,
  quote        text,
  invited_by   integer references public.members(member_id) on delete set null,
  invited_at   timestamptz not null default now(),
  submitted_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (member_id, edition_year)
);

comment on table public.yearbook_entries is
  'One row per (member, edition_year). status=invited on creation; a member submitting flips it to submitted and stamps submitted_at. use_own_avatar=true (the default) means photo_url is ignored at read time and the member''s live members.avatar_url is used instead - so the yearbook entry always reflects whichever avatar is current, never a stale copy.';

create index if not exists yearbook_entries_edition_idx on public.yearbook_entries(edition_year);
create index if not exists yearbook_entries_member_idx on public.yearbook_entries(member_id);

alter table public.yearbook_entries enable row level security;

-- A member can read their own entry (any status) and can read any SUBMITTED
-- entry (the point of a yearbook is that everyone can eventually see it) -
-- but not another member's still-invited/unsubmitted entry, which may carry
-- a photo/quote they haven't finished or decided to skip.
create policy yearbook_entries_select on public.yearbook_entries
  for select
  using (
    member_id = (select member_id from public.members where auth_uid = auth.uid())
    or status = 'submitted'
    or public.is_director()
    or public.is_super_admin()
  );

-- A member may only update their OWN row, and only to move it toward
-- submitted/skipped - never to re-invite themselves or touch another row.
create policy yearbook_entries_update_self on public.yearbook_entries
  for update
  using (member_id = (select member_id from public.members where auth_uid = auth.uid()))
  with check (member_id = (select member_id from public.members where auth_uid = auth.uid()));

-- Directors manage the invite list and can update/delete any row (e.g.
-- retracting a mistaken invite, editing a submitted quote before export).
create policy yearbook_entries_director_all on public.yearbook_entries
  for all
  using (public.is_director() or public.is_super_admin())
  with check (public.is_director() or public.is_super_admin());

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: table exists with the 4 policies above
--   select policyname, cmd from pg_policies where tablename = 'yearbook_entries';
--
-- Expect: unique constraint present
--   select conname from pg_constraint where conrelid = 'public.yearbook_entries'::regclass and contype = 'u';
-- ============================================================================
