-- Member of the Month: allow several honorees per team per month.
-- Owner decision 2026-10-03 (sheet row "members of the month pick feature doesn't
-- allow to choose more than 1 member per team"). Was one per team per month.
--
-- WHAT CHANGES: "one per team" was enforced by ONE thing, a UNIQUE CONSTRAINT named
-- member_of_the_month_period_team_key on (period, team_id) (pg_constraint contype 'u';
-- it owns a same-named index). No trigger and no view depends on it, and every RLS
-- policy and submit_mom_photo() already work per row. So the whole migration is
-- swapping that constraint for a unique index that still refuses the SAME member
-- twice in a team-month.
--
-- CORRECTION 2026-10-05: this file first said the old rule was "a unique INDEX" and
-- step 2 was `drop index`. That was wrong. It is a constraint, so `drop index` fails
-- with 2BP01 ("constraint ... requires it"). The first look at the table ran several
-- queries in one call and the tool showed only the last result, hiding the
-- constraint list. Step 2 below is the corrected statement.
--
-- Applied in two steps so the old code and the new code both work the whole time:
--   Step 1 (DONE live 2026-10-03, before the deploy): create the new index. Harmless
--          to the old code, whose ON CONFLICT (period, team_id) still has its old rule.
--   Step 2 (DONE live 2026-10-05, by the owner in the Supabase SQL editor): drop the old
--          constraint, after the deploy was live. It is a destructive statement, which the
--          Supabase tool holds for a human confirmation, so a human ran it. Verified
--          afterwards: the constraint is gone, and in a rolled-back run as a HoD two
--          different members saved for one team and month while the same member twice
--          was refused.

-- Step 1
create unique index if not exists member_of_the_month_period_team_member_key
  on public.member_of_the_month (period, team_id, member_id);

-- Step 2 (only once code using ON CONFLICT (period, team_id, member_id) is live)
alter table public.member_of_the_month
  drop constraint member_of_the_month_period_team_key;

-- Verify: expect no constraint named member_of_the_month_period_team_key, and the one
-- unique index member_of_the_month_period_team_member_key on all three columns.
-- select conname from pg_constraint where conrelid = 'public.member_of_the_month'::regclass;
-- select indexname from pg_indexes where tablename = 'member_of_the_month';
