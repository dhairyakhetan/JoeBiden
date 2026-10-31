-- Restrict notifications INSERT to service_role only.
--
-- ✅ APPLIED live 2026-07-31 (via Supabase MCP) — kept for the record.
--
-- Client-side notification creation goes through the SECURITY DEFINER
-- create_notification() RPC, so no authenticated/anon client ever needs a
-- direct INSERT policy on public.notifications. The previous
-- notifications_service_insert policy was looser than necessary; this
-- replaces it with a service_role-only check (auth.role() wrapped in a
-- scalar subquery so it's evaluated once per statement, not per row).

drop policy if exists notifications_service_insert on public.notifications;

create policy notifications_service_insert on public.notifications
  for insert
  with check ((select auth.role()) = 'service_role');
