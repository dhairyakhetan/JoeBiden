-- 2026-10-30. Report 875f0da1 (HoD desk: Hiring). HoDs were told about new applications but could not see them.
--
-- Cause: an opening with no team_id. The apply notification finds leaders by team NAME, but the Hiring desk and the
-- leader read rule on job_applications both go by team_id, so an opening without one is invisible to everyone but
-- HR and super admins. PR 119 made the app write team_id and backfilled most rows, but two open openings stayed
-- empty and nothing stopped a new one being saved that way.
--
-- APPLIED LIVE 2026-10-30 (all three steps), simulated first in a rolled-back DO block:
--   an open opening with an unknown team is refused; one named "Social Media" gets team_id 9; a paused opening with
--   no team is still allowed. Additive only: no drop, no grant, no policy change.
--
-- 1. Data: the two open openings with no team ("Podcast Research & Outreach", "Video Editor"; 7 applications between
--    them) now belong to Social Media (team 9, where their HoD creator is a member; Marketing, team 18, is its parent).
update public.job_openings set team_id = 9, team_name = 'Social Media'
 where id in ('68e7fcd2-cad1-49b2-9333-73f183e126e4', 'da280d03-8d44-4fe7-90df-a5e76ad68df9')
   and team_id is null and status = 'open';

-- 2. Guard: an opening cannot be open without a team. If it names exactly one active team, the id is filled in.
create or replace function private.job_opening_require_team() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id integer;
begin
  if new.status = 'open' and new.team_id is null then
    select t.team_id into v_id from public.teams t where t.is_active and t.name = new.team_name limit 1;
    if v_id is not null then new.team_id := v_id; end if;
  end if;
  if new.status = 'open' and new.team_id is null then
    raise exception 'an opening needs a team before it goes live, so the right leaders can see who applied';
  end if;
  return new;
end $$;

-- Named "_a_" so it runs before job_opening_publish_mirror (triggers fire in name order).
create trigger job_opening_a_require_team before insert or update on public.job_openings
  for each row execute function private.job_opening_require_team();

-- 3. Alarm: docs/sheet-triage/health_checks.sql H12 counts open openings with no team every morning (expect 0 and 0).
