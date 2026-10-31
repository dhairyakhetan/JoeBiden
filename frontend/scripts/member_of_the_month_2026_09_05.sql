-- ────────────────────────────────────────────────────────────────────────────
-- FR11 · Member of the month
--
-- STATUS: APPLIED to project hzowuwffjqtgszecngpe on 2026-09-05 via the
--         Supabase MCP connector (migration name
--         `member_of_the_month_2026_09_05`). Verified live afterwards:
--         relrowsecurity = true, five policies present, anon holds no grant.
--
-- WHAT THIS IS
-- A leader picks ONE member per calendar month; that pick is shown to
-- signed-in members on the home rail. There is no points input and no
-- automatic selection - the pick is a human judgement, recorded here.
--
-- WHY A SEPARATE TABLE, NOT A COLUMN ON `members`
-- `members` is under a column-level PII lockdown: SELECT was re-granted
-- column by column, so a NEW column on `members` inherits NO grant and is
-- silently unreadable by the `authenticated` role (reads return an error, or
-- worse, the column is simply absent). A separate table joined by member_id
-- sidesteps that entirely, and it also gives us history for free - one row
-- per month rather than a flag that forgets last month's pick.
--
-- SENSITIVITY
-- This names a real student, many of whom are minors, on a surface other
-- people read. Two consequences are baked into the policies below:
--   1. `anon` gets NO grant at all. The display surface is signed-in only.
--   2. A pick for a FUTURE month is invisible to ordinary members until that
--      month begins - a leader can queue next month's pick without it
--      leaking early. Leaders see every row (they need to, to edit it).
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.member_of_the_month (
  id          bigint generated always as identity primary key,
  -- Always the FIRST of the month; the check constraint enforces it, so
  -- "one pick per month" is the unique index on this column and nothing else
  -- has to normalise dates at read time.
  period      date not null unique,
  member_id   integer not null references public.members(member_id) on delete cascade,
  -- The one-line reason. Optional: a leader may just want to name someone.
  citation    text,
  picked_by   integer references public.members(member_id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint member_of_the_month_period_is_first_of_month
    check (period = date_trunc('month', period)::date),
  -- Frozen at 280 so the rail card can render the whole citation. A longer
  -- string would have to be clipped on the display, and clipping frozen copy
  -- is a guardrail violation (rule 3) - reject it at the source instead.
  constraint member_of_the_month_citation_len
    check (citation is null or char_length(citation) <= 280)
);

create index if not exists member_of_the_month_member_id_idx
  on public.member_of_the_month (member_id);

-- ── RLS, enabled in the SAME migration that creates the table ───────────────
alter table public.member_of_the_month enable row level security;

-- Grants. Supabase's default privileges hand new public-schema tables to both
-- `anon` and `authenticated`, so the revoke is not ceremonial - without it a
-- signed-out visitor holds SELECT and only RLS stands between them and a
-- student's name.
revoke all on public.member_of_the_month from anon, public;
grant select, insert, update, delete on public.member_of_the_month to authenticated;
-- Supabase's default grant to `authenticated` also includes TRUNCATE, which
-- RLS does NOT gate. Take it (and the two other unused privileges) back.
revoke truncate, trigger, references on public.member_of_the_month from authenticated;

drop policy if exists mom_select_current on public.member_of_the_month;
drop policy if exists mom_select_leaders on public.member_of_the_month;
drop policy if exists mom_insert_leaders on public.member_of_the_month;
drop policy if exists mom_update_leaders on public.member_of_the_month;
drop policy if exists mom_delete_leaders on public.member_of_the_month;

-- Any signed-in account reads a pick whose month has already started.
-- Asia/Kolkata, not UTC: the org is in Kolkata, and on UTC the pick would
-- appear 5.5 hours late on the 1st.
create policy mom_select_current on public.member_of_the_month
  for select to authenticated
  using (period <= (date_trunc('month', (now() at time zone 'Asia/Kolkata'))::date));

-- Leaders additionally see queued future picks, which is the whole point of
-- being able to queue one.
create policy mom_select_leaders on public.member_of_the_month
  for select to authenticated
  using (public.is_director());

-- Writes are leaders only. is_director() is the DB twin of lib/roles.ts
-- `hasLeaderAccess` - director / hod / hr / super_admin, active only.
create policy mom_insert_leaders on public.member_of_the_month
  for insert to authenticated
  with check (public.is_director());

create policy mom_update_leaders on public.member_of_the_month
  for update to authenticated
  using (public.is_director())
  with check (public.is_director());

create policy mom_delete_leaders on public.member_of_the_month
  for delete to authenticated
  using (public.is_director());

-- ── Verification (run after applying) ──────────────────────────────────────
-- select relrowsecurity from pg_class where oid = 'public.member_of_the_month'::regclass;
-- select policyname, cmd, roles::text, qual, with_check
--   from pg_policies where tablename = 'member_of_the_month';
-- select grantee, privilege_type from information_schema.role_table_grants
--   where table_name = 'member_of_the_month';
