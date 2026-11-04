-- Welfare Team becomes Welfare Projects (section E.3, owner decision 3 Nov 2026).
-- STATUS: APPLIED 3 Nov 2026 (migration rename_welfare_team_to_welfare_projects). teams row 8 renamed; the 2 open roles that carried
-- the old name as free text (job_openings.team_name) moved with it. Collabs Team stays inactive: it is a card only on the site.
update public.teams set name = 'Welfare Projects' where team_id = 8 and name = 'Welfare Team';
update public.job_openings set team_name = 'Welfare Projects' where team_name = 'Welfare Team';
