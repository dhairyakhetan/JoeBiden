-- Teams-as-categories slice 4, additive (owner, 2026-10-18: "do it all on your own").
--
-- Status: APPLIED LIVE 2026-10-18. Inserted 54 `director_scopes` rows: one for every active team of the
-- category each leader held in `director_categories` (24 assignments, 11 leaders). Read back: every
-- leader and every category assignment has a team equivalent (0 without).
--
-- The five categories are RETIRED IN CODE, not removed: the moderation queue, the desk badge, the home
-- tile and the desk labels now read `director_scopes` only. `director_categories` and its check
-- constraint stay in the database, unread. Removing the table is a destructive step the tool holds for
-- a human (8.9: prefer clutter to a step nobody is there to confirm), and nothing needs it gone.
--
-- Idempotent: safe to run again.
insert into public.director_scopes (member_id, team_id, assigned_by)
select dc.member_id, t.team_id, dc.assigned_by
  from public.director_categories dc
  join public.teams t on t.category = dc.category and t.is_active
on conflict (member_id, team_id) do nothing;
