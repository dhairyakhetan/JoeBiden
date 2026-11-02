-- Digital Magazine gets a third sub-department, Blogs.
--
-- Source: bug report 11efcba6 (2026-10-29, team page 443c8f9a = Digital Magazine, team_id 17):
-- "Along with tech and design, add another sub department named Blogs".
--
-- STATUS: APPLIED LIVE 2026-11-01 (project hzowuwffjqtgszecngpe). Data only, additive, idempotent
-- (unique on (team_id, slug)). Nobody is assigned; HoDs assign people from the team page.
--
-- Not the same row as the old Social Media "Blogs" (team 9, hidden on 2026-10-19 by report 3a70c769, left
-- hidden): that one stays hidden, so Blogs does not appear under both parents.
--
-- UNDO (no delete): update public.sub_teams set is_active = false where team_id = 17 and slug = 'blogs';

insert into public.sub_teams (team_id, name, slug, display_order)
select 17, 'Blogs', 'blogs', 3
 where exists (select 1 from public.teams where team_id = 17 and name = 'Digital Magazine')
on conflict (team_id, slug) do nothing;
