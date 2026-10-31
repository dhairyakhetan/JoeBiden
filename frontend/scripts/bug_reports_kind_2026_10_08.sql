-- Bug reports: a "kind" (bug or feature) so /bugs can carry feature requests too.
--
-- WHY: members and leaders started using /bugs to ask for features (owner, 2026-10-07). The nightly
-- routine reads this table for work, so it needs to tell the two apart: a bug is fixed, a feature is
-- planned and shipped in slices (docs/SHEET_TRIAGE_ROUTINE.md, sections 7 and 8.6).
--
-- STATUS: APPLIED LIVE 2026-10-08 (project hzowuwffjqtgszecngpe) with the statements below, in
-- this order, one call each. Nothing here is destructive; no drop, no delete, no widened grant.
--
-- ROLLOUT ORDER matters: the column has a default, so the code live before this change (which
-- never sends `kind`) keeps working. The new frontend sends it, which needs the INSERT grant.
--
-- VERIFIED (rolled-back DO blocks, raise exception 'SIM: ...'):
--   * as an active member: kind 'feature' files, approved_for_fix = false (waits for a leader);
--     kind 'junk' is refused by the check; no kind at all defaults to 'bug'.
--   * as an active HoD: kind 'feature' files, approved_for_fix = true.
--   * as the routine (no login): changing kind on an existing report is refused with
--     "the report itself cannot be edited, only its status".
--   * has_column_privilege: authenticated INSERT yes, authenticated UPDATE no, anon INSERT no.
-- NOT EXERCISED: nothing skipped.

alter table public.bug_reports
  add column kind text not null default 'bug'
  constraint bug_reports_kind_check check (kind in ('bug', 'feature'));

-- New columns start with ZERO privileges on this table (column-by-column grants), so this is
-- needed or every member's filing would fail. Deliberately INSERT only: the kind of a report is
-- fixed when it is filed.
grant insert (kind) on public.bug_reports to authenticated;

-- One-time classification of the two existing reports that were really feature requests.
update public.bug_reports set kind = 'feature'
 where id in ('2b96628f-6255-44af-b04b-2258ae4347a5', 'e0ca05db-f43c-4ff4-95b1-dffc1bc3f0a9');

-- Make kind immutable for everyone, including the routine, by extending the existing update
-- trigger from its LIVE definition (so nothing else in it can drift). Idempotent.
do $$
declare src text;
begin
  select pg_get_functiondef('private.bug_reports_before_update()'::regprocedure) into src;
  if src like '%new.kind is distinct from old.kind%' then
    return;
  end if;
  src := replace(src, 'or new.capture_method is distinct from old.capture_method',
                 E'or new.capture_method is distinct from old.capture_method\n     or new.kind is distinct from old.kind');
  if src not like '%new.kind is distinct from old.kind%' then
    raise exception 'pattern not found, nothing changed';
  end if;
  execute src;
end $$;
