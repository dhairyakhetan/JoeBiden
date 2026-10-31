-- APPLIED LIVE 2026-09-14 via Supabase MCP (migration name:
-- restart_member_as_applicant)
--
-- Owner request: their own test/demo account gets soft-deleted between
-- demos so they can log back in and show people the real apply -> pending
-- -> approve funnel from scratch. restore_member() (existing) only ever
-- sets status back to 'active', which skips the funnel entirely.
--
-- Distinct from restore_member, not a change to it: a real deleted member
-- being reinstated should go straight back to 'active' (unchanged), never
-- be shoved back through onboarding. This RPC is for the explicit "start
-- over as a fresh applicant" case, super_admin-only same as restore_member,
-- audit-logged under its own action name. Clears class_grade too (not just
-- status) - ProtectedRoute redirects to /register whenever class_grade is
-- null, which is what actually replays the registration step.
create or replace function public.restart_member_as_applicant(p_member_id integer)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_actor_id integer;
begin
  if not is_super_admin() then
    raise exception 'Only HR/super_admin can restart a member as a new applicant';
  end if;
  v_actor_id := get_current_member_id();

  update public.members
  set status = 'pending_approval', deleted_at = null, deleted_by = null, class_grade = null
  where member_id = p_member_id and status = 'deleted';

  insert into public.community_audit_logs (member_id, action, entity_type, entity_id)
  values (v_actor_id, 'member_restarted_as_applicant', 'member', p_member_id);
end;
$function$;

grant execute on function public.restart_member_as_applicant(integer) to authenticated;
