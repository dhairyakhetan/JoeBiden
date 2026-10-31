-- ─────────────────────────────────────────────────────────────────────────
-- Client-side function-call tracking (2026-09-23)
-- ─────────────────────────────────────────────────────────────────────────
-- client_error_logs_2026_09_08.sql (+ logSupabaseError, 2026-09-22) tells us
-- when a Supabase call FAILED. It says nothing about the shape of normal
-- traffic - which functions actually get called, how often, how slow, and
-- how often they succeed vs. fail as a rate rather than a raw error dump.
-- That's the gap this table closes: one row per service-function call, not
-- just the failing ones, written by lib/functionLog.ts's withFunctionLogging()
-- wrapper around every services/*.ts default export.
--
-- Deliberately minimal columns - service + function name, outcome, timing,
-- who and where. NEVER arguments or return values: those can carry member
-- PII (names, phone numbers, post bodies) and this table has the same
-- broad "any signed-in account can write" shape as client_error_logs, so it
-- gets the same column discipline `members` learned the hard way (see
-- CLAUDE.md's PII lockdown history) - nothing here should ever need a
-- second lockdown migration because nothing here is PII in the first place.
--
-- Write-only from the client's point of view, same as client_error_logs:
-- anon AND authenticated can INSERT, NEITHER can SELECT - only a
-- director/super_admin can read this table.
--
-- Run this in the Supabase SQL editor (or via the MCP connector). Not yet
-- applied automatically by anything - CLAUDE.md's rule: a checked-in .sql
-- file is not evidence it has been run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.client_function_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- what ran
  service text not null,
  function text not null,
  success boolean not null,

  -- how it went
  duration_ms integer,

  -- where, for whom - same identity fields as client_error_logs, same reason
  pathname text,
  member_id integer references public.members(member_id) on delete set null,
  session_id text
);

create index if not exists client_function_logs_created_at_idx on public.client_function_logs (created_at desc);
create index if not exists client_function_logs_service_function_idx on public.client_function_logs (service, function);
create index if not exists client_function_logs_success_idx on public.client_function_logs (success) where success = false;
-- 2026-09-23: added after a live advisor check found the FK uncovered - see
-- client_function_logs_member_id_index_2026_09_23.sql for the migration
-- that adds this on a table that already exists live.
create index if not exists client_function_logs_member_id_idx on public.client_function_logs (member_id);

alter table public.client_function_logs enable row level security;

drop policy if exists "anyone can insert function logs" on public.client_function_logs;
create policy "anyone can insert function logs"
  on public.client_function_logs for insert
  to anon, authenticated
  with check (true);

drop policy if exists "leadership can read function logs" on public.client_function_logs;
create policy "leadership can read function logs"
  on public.client_function_logs for select
  to authenticated
  using (is_director() or is_super_admin());

-- No table-level grant is inherited by a new table (learned the hard way on
-- `members` columns - see CLAUDE.md). Grant explicitly; RLS still does the
-- real filtering above.
grant insert on public.client_function_logs to anon, authenticated;
grant select on public.client_function_logs to authenticated;

-- Only db-generated identity/timestamp columns are ever produced server-side;
-- every other column is client-supplied, so no sequence grant is needed
-- beyond what `generated always as identity` already handles internally.
