-- APPLIED LIVE 2026-09-12 via Supabase MCP apply_migration
-- (migration name: log_action_rpc_and_hr_set_member_break)
--
-- Two pieces, both from the same conversation:
--
-- 1. log_action() - a generic, truthful audit-log writer. community_audit_logs
--    has RLS with a SELECT policy for super_admin only and NO insert policy at
--    all, so the frontend has never been able to write to it directly (the
--    historical rows in there - cron_publish_scheduled, hr_reconciliation_fill,
--    etc - came from cron jobs/backend processes with direct DB access, not
--    from any live client code path). Owner asked "if a HoD approves an
--    applicant/post, can we track it back to who did that" - answer found:
--    currently no, almost nothing in the live desk writes to this table.
--    This RPC is the fix: SECURITY DEFINER, stamps member_id from the
--    CALLER's own session (get_current_member_id()), never a client-supplied
--    value, so a log row can't be forged to name someone else. Callable by
--    any authenticated member - the caller identifies themselves truthfully
--    either way, and which actions actually call this is a frontend
--    decision (wired into approveMember/rejectMember/approvePost/rejectPost
--    in directorService.ts and updateApplicationStatus in lib/jobOpenings.ts).
--
-- 2. hr_set_member_break() - the HR-initiated half of the break system.
--    breakService.setBreak() (member's own) already writes members.break_*
--    AND inserts a member_breaks history row - but member_breaks_insert_own
--    restricts that insert to `member_id = get_current_member_id()`, so a
--    director/HR literally cannot record a break on someone else's behalf
--    without this. SECURITY DEFINER, checks is_super_admin() internally
--    (HR and super_admin are the same tier per lib/roles.ts), logs via
--    community_audit_logs so it's traceable to which HR/admin set it.
create or replace function public.log_action(
  p_action varchar,
  p_entity_type varchar default null,
  p_entity_id integer default null,
  p_details jsonb default null
)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_member_id integer;
begin
  v_member_id := get_current_member_id();
  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;
  insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details)
  values (v_member_id, p_action, p_entity_type, p_entity_id, p_details);
end;
$$;

grant execute on function public.log_action(varchar, varchar, integer, jsonb) to authenticated;

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
  if not is_super_admin() then
    raise exception 'Only HR/super_admin can set another member''s break';
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

grant execute on function public.hr_set_member_break(integer, date, date, text, text) to authenticated;

-- Verify:
-- select proname from pg_proc where proname in ('log_action','hr_set_member_break');
