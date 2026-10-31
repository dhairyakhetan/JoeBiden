-- Team tree, slice 1b: a department can sit inside another (Marketing above Social Media and Digital Magazine).
--
-- WHY: report 5ce843ba (the HR director's family tree) and the owner's decision of 2026-10-09: "Marketing is a
-- real parent department". Plan: docs/plans/teams-as-categories.md.
--
-- STATUS: APPLIED LIVE 2026-10-09 (project hzowuwffjqtgszecngpe). Additive only: one nullable column, one new
-- team, two parent links. Nothing dropped, nothing deleted, nobody moved. `teams` has table-level grants, so the
-- new column needed no grant of its own.
--
-- The app reads it in teamService.getDepartmentTree() (About chart) and getTeam() (team page "part of" and
-- "teams inside" blocks). Marketing has no members of its own; its count on the chart is its children's.

alter table public.teams
  add column if not exists parent_team_id integer references public.teams(team_id) on delete set null;

insert into public.teams (name, description, category)
select 'Marketing', 'The marketing department: Social Media and Digital Magazine sit inside it.', 'content'
 where not exists (select 1 from public.teams where name = 'Marketing');

update public.teams set parent_team_id = (select team_id from public.teams where name = 'Marketing')
 where name in ('Social Media', 'Digital Magazine');

-- UNDO (no delete): unlink and hide.
--   update public.teams set parent_team_id = null where name in ('Social Media', 'Digital Magazine');
--   update public.teams set is_active = false where name = 'Marketing';
