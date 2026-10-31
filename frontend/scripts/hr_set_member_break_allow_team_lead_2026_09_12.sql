-- APPLIED LIVE 2026-09-12 via Supabase MCP (migration name: hr_set_member_break_allow_team_lead)
--
-- Follow-up to log_action_and_hr_set_member_break_2026_09_12.sql, part of the
-- same role-model redesign as team_scoped_hod_powers_2026_09_12.sql: HoD is
-- team-scoped, so a team lead should be able to put THEIR OWN team's members
-- on a break the same way they can already change that member's status
-- (members_guard_privileged_cols already authorizes is_team_lead_of_member()
-- for exactly this kind of change). hr_set_member_break() previously checked
-- is_super_admin() only - this widens it to also accept
-- is_team_lead_of_member(p_member_id), reusing the function
-- team_scoped_hod_powers_2026_09_12.sql already created, with no other
-- change to the RPC's body.
create or replace function public.hr_set_member_break(
  p_member_id integer,
  p_start date,
  p_end date,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_actor_id integer;
begin
  if not (is_super_admin() or is_team_lead_of_member(p_member_id)) then
    raise exception 'Only HR/super_admin or that member''s team lead can set a break';
  end if;
  v_actor_id := get_current_member_id();

  update public.members
  set break_start = p_start, break_end = p_end, break_reason = p_reason
  where member_id = p_member_id;

  insert into public.member_breaks (member_id, "start", "end", reason, note)
  values (p_member_id, p_start, p_end, p_reason, p_note);

  insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details)
  values (v_actor_id, 'hr_set_member_break', 'member', p_member_id,
    jsonb_build_object('start', p_start, 'end', p_end, 'reason', p_reason));
end;
$$;
