-- bug_reports send-back: a leader's "not fixed" reopens a report AND hands it back to the routine
-- (owner, 2026-10-19).
--
-- Why: the routine marks a report solved, then a leader checks the live site and ticks verified. If the fix
-- did not work, un-ticking solved reopened the report, but it kept `taken_up = true`, and the routine only
-- claims reports that are not taken up. So a rejected fix was never reworked. Two layers now: the routine
-- says "solved", a leader says "verified" or "not fixed", and "not fixed" puts it back in the routine's queue.
--
-- Additive only: two columns, one column grant, and `create or replace` of the two trigger functions. No DROP.
--
--   rework_note   text   the leader's reason for sending it back. The routine reads it as DATA (what went
--                        wrong), never as instructions. Leaders only; the routine and members are refused.
--   rework_count  int    how many times it has been sent back. Set by the trigger, never by a client (no grant).
--
-- Behaviour change (the whole of it): when a LEADER takes solved from true to false, the trigger also clears
-- taken_up (and its time), adds 1 to rework_count, and the change log records `reopened` with the note.
-- When the ROUTINE un-solves (its own revert of a failed fix), taken_up stays set, as before.
--
-- STATUS: APPLIED LIVE 2026-10-19 (as one migration, bug_reports_send_back_2026_10_19). Verified in rolled-back
-- simulations on an existing report (insert and update only, no delete): a leader's send-back leaves
-- taken_up false, solved false, rework_count 1, logs one `reopened` event carrying the note and no `untaken`;
-- the routine can claim and re-solve it; the routine is refused when it tries to set rework_note; the routine's
-- own un-solve keeps taken_up and the count; a plain member's update matches zero rows (row-level policy) and
-- the note stays empty.

alter table public.bug_reports add column if not exists rework_note text;
alter table public.bug_reports add column if not exists rework_count integer not null default 0;

grant update (rework_note) on public.bug_reports to authenticated;

-- Live definitions as of 2026-10-18 plus the changes marked `-- NEW`.

create or replace function private.bug_reports_before_update() returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_id integer := public.current_member_id();
  is_routine boolean := auth.uid() is null;
  is_leader boolean := auth.uid() is not null and public.is_director();
  editing boolean := new.description is distinct from old.description;
begin
  if not is_routine and not is_leader then
    -- a reporter may change the description of their own report and nothing else
    if v_id is null or old.reporter_member_id is distinct from v_id then
      raise exception 'only leaders can update bug reports';
    end if;
    if new.severity is distinct from old.severity
       or new.approved_for_fix is distinct from old.approved_for_fix
       or new.approved_by is distinct from old.approved_by
       or new.taken_up is distinct from old.taken_up
       or new.taken_up_at is distinct from old.taken_up_at
       or new.solved is distinct from old.solved
       or new.solved_at is distinct from old.solved_at
       or new.verified is distinct from old.verified
       or new.verified_at is distinct from old.verified_at
       or new.verified_by is distinct from old.verified_by
       or new.declined_reason is distinct from old.declined_reason
       or new.needs_info_note is distinct from old.needs_info_note
       or new.fix_pr_url is distinct from old.fix_pr_url
       or new.resolution_note is distinct from old.resolution_note
       or new.closed_no_change is distinct from old.closed_no_change
       or new.rework_note is distinct from old.rework_note                          -- NEW
       or new.rework_count is distinct from old.rework_count then                   -- NEW
      raise exception 'only leaders can change the status of a bug report';
    end if;
  end if;
  if editing then
    if is_routine then
      raise exception 'the routine cannot edit a report';
    end if;
    if old.taken_up or old.solved or old.declined_reason is not null then
      raise exception 'this report is already being worked on, so it can no longer be edited';
    end if;
    -- a member's edit takes the leader's approval away: what was approved is what gets built
    if not is_leader and old.approved_for_fix then
      new.approved_for_fix := false;
      new.approved_by := null;
    end if;
  end if;
  if new.reporter_member_id is distinct from old.reporter_member_id
     or new.reporter_uuid is distinct from old.reporter_uuid
     or new.reporter_name is distinct from old.reporter_name
     or new.reporter_role is distinct from old.reporter_role
     or new.created_at is distinct from old.created_at
     or new.page_url is distinct from old.page_url
     or new.page_path is distinct from old.page_path
     or new.viewport_w is distinct from old.viewport_w
     or new.viewport_h is distinct from old.viewport_h
     or new.user_agent is distinct from old.user_agent
     or new.capture_method is distinct from old.capture_method
     or new.kind is distinct from old.kind
     or new.screenshots is distinct from old.screenshots
     or new.attachments is distinct from old.attachments then
    raise exception 'the report itself cannot be edited, only its status and its description';
  end if;
  if is_routine and (new.verified is distinct from old.verified
                     or new.approved_for_fix is distinct from old.approved_for_fix
                     or new.severity is distinct from old.severity
                     or new.declined_reason is distinct from old.declined_reason
                     or new.rework_note is distinct from old.rework_note              -- NEW
                     or new.rework_count is distinct from old.rework_count) then      -- NEW
    raise exception 'the routine cannot set verified, approval, severity, a decline or a send-back note';
  end if;
  -- closing as "no change needed" is an audit result, so the report counts as taken up; a solved
  -- report cannot also be closed this way
  if new.closed_no_change is distinct from old.closed_no_change and new.closed_no_change then
    if new.solved then
      raise exception 'a solved report cannot also be closed as no change needed';
    end if;
    new.taken_up := true;
    new.taken_up_at := coalesce(new.taken_up_at, old.taken_up_at, now());
  end if;
  if new.approved_for_fix is distinct from old.approved_for_fix then
    new.approved_by := case when new.approved_for_fix then v_id end;
  end if;
  if new.taken_up is distinct from old.taken_up then
    new.taken_up_at := case when new.taken_up then coalesce(new.taken_up_at, now()) end;
  end if;
  if new.solved is distinct from old.solved then
    new.solved_at := case when new.solved then now() end;
    if new.solved then
      new.taken_up := true; new.taken_up_at := coalesce(new.taken_up_at, old.taken_up_at, now());
      new.closed_no_change := false;
    else
      new.verified := false;
      -- NEW: a leader's "not fixed" puts the report back in the routine's queue
      if not is_routine then
        new.taken_up := false;
        new.taken_up_at := null;
        new.rework_count := old.rework_count + 1;
      end if;
    end if;
  end if;
  if new.verified is distinct from old.verified then
    if new.verified and not new.solved then
      raise exception 'only a solved report can be verified';
    end if;
    new.verified_at := case when new.verified then now() end;
    new.verified_by := case when new.verified then v_id end;
  end if;
  new.updated_at := now();
  return new;
end $function$;

-- private.bug_reports_log(): the live version of 2026-10-18 with two changes, both marked `-- NEW`:
-- a send-back is logged as `reopened` with the leader's note (it used to carry the old fix link), and the
-- `untaken` event is not logged on top of it, since the send-back already says so.
create or replace function private.bug_reports_log() returns trigger
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare
  v_id integer := public.current_member_id();
  who text;
begin
  select case when auth.uid() is null then 'routine'
              else coalesce((select full_name from public.members where member_id = v_id), 'unknown') end
    into who;
  if tg_op = 'INSERT' then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, 'filed',
            case when new.approved_for_fix then 'filed by a leader, approved for fixing'
                 else 'filed by a member, waiting for a leader to approve it for fixing' end);
    return new;
  end if;
  if new.description is distinct from old.description then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, 'edited', 'previous text: ' || left(old.description, 900));
  end if;
  if new.approved_for_fix is distinct from old.approved_for_fix then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind)
    values (new.id, v_id, who, case when new.approved_for_fix then 'approved_for_fix' else 'approval_removed' end);
  end if;
  if new.severity is distinct from old.severity then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, 'severity_changed', old.severity || ' to ' || new.severity);
  end if;
  if new.taken_up is distinct from old.taken_up and not (old.solved and not new.solved) then   -- NEW condition
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind)
    values (new.id, v_id, who, case when new.taken_up then 'taken_up' else 'untaken' end);
  end if;
  if new.solved is distinct from old.solved then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, case when new.solved then 'solved' else 'reopened' end,
            case when new.solved then new.fix_pr_url else new.rework_note end);               -- NEW note
  end if;
  if new.closed_no_change is distinct from old.closed_no_change then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, case when new.closed_no_change then 'closed_no_change' else 'reopened' end, new.resolution_note);
  end if;
  if new.verified is distinct from old.verified then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind)
    values (new.id, v_id, who, case when new.verified then 'verified' else 'unverified' end);
  end if;
  if new.declined_reason is distinct from old.declined_reason and new.declined_reason is not null then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, 'declined', new.declined_reason);
  end if;
  if new.needs_info_note is distinct from old.needs_info_note and new.needs_info_note is not null then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, 'needs_info', new.needs_info_note);
  end if;
  if new.fix_pr_url is distinct from old.fix_pr_url and new.fix_pr_url is not null then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, 'fix_linked', new.fix_pr_url);
  end if;
  return new;
end $function$;
