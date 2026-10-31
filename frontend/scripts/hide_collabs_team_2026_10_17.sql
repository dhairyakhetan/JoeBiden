-- Hide the Collabs Team (owner answer, 2026-10-17, reports 4df9cc61 and 73bebe7e).
--
-- Status: APPLIED LIVE 2026-10-17. Data only, nothing deleted: the team row, its two memberships and
-- its post tags stay. Every team read in the app filters `is_active = true`, so the team drops out of
-- /teams, the About chart and the director Teams desk.
--
-- Undo: update public.teams set is_active = true where team_id = 10;
update public.teams set is_active = false where team_id = 10 and name = 'Collabs Team' and is_active;
