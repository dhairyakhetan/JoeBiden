-- ─────────────────────────────────────────────────────────────────────────
-- client_function_logs: add the missing member_id FK index (2026-09-23)
-- ─────────────────────────────────────────────────────────────────────────
-- Found by a live advisor check the day this table shipped: `member_id`
-- references public.members(member_id) but had no covering index, same
-- class of gap client_error_logs already has its own dated fix for
-- (client_error_logs_member_id_index_2026_09_08.sql). Applied live already;
-- this file is the checked-in record, per this repo's migration convention.
-- ─────────────────────────────────────────────────────────────────────────

create index if not exists client_function_logs_member_id_idx on public.client_function_logs (member_id);
