-- ─────────────────────────────────────────────────────────────────────────
-- Extend client_error_logs.error_type with 'supabase_error' (2026-09-22)
-- ─────────────────────────────────────────────────────────────────────────
-- client_error_logs_2026_09_08.sql only ever caught crashes that bubbled to
-- `window` (React render errors, unhandled promise rejections). The
-- service-layer contract in this codebase is `if (error) throw error`, and
-- every caller wraps that in try/catch and toasts - so a failing Supabase
-- call was NEVER an unhandled rejection, and every Supabase-side failure in
-- the app's history up to this point was invisible to this table.
--
-- lib/errorTracking.ts now exports logSupabaseError(operation, error), called
-- at each service's throw site, tagged with this new error_type so it's
-- filterable from the crash noise. This migration only widens the CHECK
-- constraint; no new table, no RLS change, no privilege change.
--
-- Run this in the Supabase SQL editor (or via the MCP connector) against
-- whichever project actually backs this app - NOT applied automatically.
-- If client_error_logs_2026_09_08.sql itself was never run, run that first;
-- this ALTER will simply no-op safely on a table that doesn't exist yet
-- (guarded below) but the base table still needs its own migration applied.
-- ─────────────────────────────────────────────────────────────────────────

do $$
begin
  if to_regclass('public.client_error_logs') is not null then
    alter table public.client_error_logs drop constraint if exists client_error_logs_error_type_check;
    alter table public.client_error_logs add constraint client_error_logs_error_type_check
      check (error_type in ('render', 'unhandled_error', 'unhandled_rejection', 'supabase_error'));
  end if;
end $$;
