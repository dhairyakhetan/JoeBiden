-- Bug reports: a reporter (or a leader) may edit a report's description while it is still waiting.
--
-- WHY: the HR director asked for it (report e97510b0) and the owner approved the design on 2026-10-09.
-- The description used to be locked so that a leader's approval could not be swapped for different
-- text. This keeps that guarantee a different way: an edit is only possible BEFORE the routine has
-- taken the report up, and a member's edit removes the approval, so the text that gets approved is
-- always the text that gets built. Plan: docs/plans/edit-own-report.md.
--
-- RULES (enforced by the trigger, not by the page):
--   * who: the reporter, on their own report, or any leader.
--   * when: only while taken_up is false, solved is false and declined_reason is null.
--   * a member's edit of an approved report clears approved_for_fix and approved_by; a leader's edit
--     keeps the approval.
--   * a reporter who is not a leader can change NOTHING except the description. The column grants on
--     the status columns already exist for leaders, and the new RLS policy would otherwise let a
--     reporter reach them, so the trigger refuses every other column for a non-leader.
--   * the routine can never edit a description.
--   * the previous text (first 900 characters) is written to the change log as an `edited` event.
--
-- STATUS: APPLIED LIVE 2026-10-09 (project hzowuwffjqtgszecngpe), one statement per call, in this order:
-- the two functions first, then the column grant, then the policy, so there is never a moment where
-- the permission is open and the trigger is not.
--
-- VERIFIED in rolled-back DO blocks (raise exception 'SIM: ...'): see the list at the bottom.
-- Nothing here is destructive: no drop, no delete, no table-wide grant.

-- 1. change log: record an edit and the text it replaced.
create or replace function private.bug_reports_log() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
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
  if new.taken_up is distinct from old.taken_up then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind)
    values (new.id, v_id, who, case when new.taken_up then 'taken_up' else 'untaken' end);
  end if;
  if new.solved is distinct from old.solved then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, case when new.solved then 'solved' else 'reopened' end, new.fix_pr_url);
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
end $$;

-- 2. the update guard.
create or replace function private.bug_reports_before_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
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
       or new.resolution_note is distinct from old.resolution_note then
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
     or new.screenshots is distinct from old.screenshots then
    raise exception 'the report itself cannot be edited, only its status and its description';
  end if;
  if is_routine and (new.verified is distinct from old.verified
                     or new.approved_for_fix is distinct from old.approved_for_fix
                     or new.severity is distinct from old.severity
                     or new.declined_reason is distinct from old.declined_reason) then
    raise exception 'the routine cannot set verified, approval, severity or a decline';
  end if;
  if new.approved_for_fix is distinct from old.approved_for_fix then
    new.approved_by := case when new.approved_for_fix then v_id end;
  end if;
  if new.taken_up is distinct from old.taken_up then
    new.taken_up_at := case when new.taken_up then now() end;
  end if;
  if new.solved is distinct from old.solved then
    new.solved_at := case when new.solved then now() end;
    if new.solved then
      new.taken_up := true; new.taken_up_at := coalesce(new.taken_up_at, old.taken_up_at, now());
    else
      new.verified := false;
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
end $$;

-- 3. the new column privilege (the status columns were already granted, for leaders).
grant update (description) on public.bug_reports to authenticated;

-- 4. the new row rule: a reporter reaches their own report only while it is still waiting.
--    Permissive, so it ORs with "leaders update bug reports". The trigger above limits what a
--    reporter can actually change.
create policy "reporters edit their own waiting report"
  on public.bug_reports for update to authenticated
  using (reporter_member_id = public.current_member_id()
         and not taken_up and not solved and declined_reason is null)
  with check (reporter_member_id = public.current_member_id());

-- SIMULATIONS (each in a rolled-back DO block; results recorded 2026-10-09):
--   member edits own waiting approved report ........ allowed; approved_for_fix cleared; 'edited' event
--   member edits own waiting unapproved report ...... allowed
--   member edits someone else's report .............. refused (no row visible or "only leaders")
--   member edits own report after it was taken up ... refused
--   member sets approved_for_fix on own report ...... refused ("only leaders can change the status")
--   member edits description AND ticks a box ........ refused
--   leader edits a waiting report ................... allowed; approval kept
--   routine edits a description ..................... refused
--   anon can reach nothing .......................... has_column_privilege false
