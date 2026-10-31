-- ─────────────────────────────────────────────────────────────────────────
-- Client-side error tracking (2026-09-08)
-- ─────────────────────────────────────────────────────────────────────────
-- ErrorBoundary.tsx has always had a "console.error + future Sentry hook"
-- comment and nothing behind it - a production crash was invisible unless
-- the user screenshotted it themselves. This table is that hook, aimed at
-- Supabase instead of a third-party service since the app already talks to
-- Supabase directly from the browser.
--
-- Write-only from the client's point of view: anon AND authenticated can
-- INSERT (a crash can happen before login - the welcome overlay, /login
-- itself), but NEITHER can SELECT. A stack trace or URL can incidentally
-- carry another member's data (a uuid in a path, a name in an error message),
-- so only a director/super_admin may read this table. This mirrors the
-- column-privilege lesson already learned on `members`: a new table starts
-- with ZERO privileges and needs its own explicit grants - nothing here is
-- inherited from anywhere else.
--
-- Run this in the Supabase SQL editor (or via the MCP connector). Not yet
-- applied automatically by anything - CLAUDE.md's rule: a checked-in .sql
-- file is not evidence it has been run.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.client_error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- what broke
  -- 2026-09-22: added 'supabase_error' - see
  -- client_error_logs_add_supabase_type_2026_09_22.sql for the migration
  -- that widens this on a table that already exists live.
  error_type text not null check (error_type in ('render', 'unhandled_error', 'unhandled_rejection', 'supabase_error')),
  message text not null,
  stack text,
  component_stack text,

  -- where, for whom
  pathname text not null,
  href text not null,
  member_id integer references public.members(member_id) on delete set null,
  member_uuid uuid,
  role text,

  -- environment, for reproduction
  user_agent text,
  viewport_w integer,
  viewport_h integer,
  session_id text,

  -- anything else worth attaching, without a schema change per new field
  extra jsonb
);

create index if not exists client_error_logs_created_at_idx on public.client_error_logs (created_at desc);
create index if not exists client_error_logs_session_id_idx on public.client_error_logs (session_id);

alter table public.client_error_logs enable row level security;

drop policy if exists "anyone can insert error logs" on public.client_error_logs;
create policy "anyone can insert error logs"
  on public.client_error_logs for insert
  to anon, authenticated
  with check (true);

drop policy if exists "leadership can read error logs" on public.client_error_logs;
create policy "leadership can read error logs"
  on public.client_error_logs for select
  to authenticated
  using (is_director() or is_super_admin());

-- No table-level grant is inherited by a new table (learned the hard way on
-- `members` columns - see CLAUDE.md). Grant explicitly; RLS still does the
-- real filtering above.
grant insert on public.client_error_logs to anon, authenticated;
grant select on public.client_error_logs to authenticated;
