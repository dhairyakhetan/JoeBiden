-- APPLIED LIVE 2026-09-07 (via the Supabase MCP connector). Verified after:
--   select to_regclass('public.member_teams');  -> null
--   select count(*) from team_members;          -> 95
--
-- Drop `member_teams`, the dead duplicate of `team_members`.
--
-- Created by the A1 migration and NEVER POPULATED: 0 rows, against
-- `team_members`' 95. It was not inert -- `receiptService.getPrimaryDeskName`
-- queried it at runtime, so the sign-in receipt's "desk" row came back blank
-- for every member who actually had a team. That call site now reads
-- `team_members` (same commit). Four provenance strings in `gridRecipes.ts`
-- and two comments also still cited it; all corrected.
--
-- `team_members` has no `is_primary` flag, so the repointed call defines
-- primary as the EARLIEST active membership. 73 of the 83 members with a team
-- have exactly one, so that rule only decides anything for 10 people.
--
-- Guarded: this refuses to run if the table ever gained a row, so a stale copy
-- of this migration cannot destroy real data.
do $$
declare n bigint;
begin
  if to_regclass('public.member_teams') is null then
    raise notice 'member_teams already absent -- nothing to do';
    return;
  end if;

  execute 'select count(*) from public.member_teams' into n;
  if n <> 0 then
    raise exception 'member_teams has % row(s) -- refusing to drop. It was empty when this migration was written; investigate before re-running.', n;
  end if;

  -- No FKs point into it and no view or function references it (verified
  -- against pg_constraint / pg_proc / pg_class before writing this), so the
  -- only dependents are its own two RLS policies, which go with the table.
  drop table public.member_teams;
  raise notice 'member_teams dropped (was empty)';
end $$;
