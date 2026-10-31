-- bug_reports.closed_no_change: a non-decline way to close a report after an audit (owner, 2026-10-18).
--
-- Why: the routine may never decline a report (declining is a leader's judgement), so a report whose
-- audit found nothing to change (a slow page that is not slow, a request the owner already settled)
-- stayed open for ever and needed a leader to decline it. This adds one boolean the routine may set
-- once it has audited a report and found nothing to change. It is NOT a decline: nobody is told the
-- report was wrong, the note says what was checked, and a leader can reopen it by clearing the flag.
--
-- Additive only: one new column, one column grant, and `create or replace` of the two trigger
-- functions with one added condition and one added event. No DROP, so the tool did not hold it.
--
-- What the database still refuses (unchanged): the routine setting verified, approval, severity or a
-- decline. New: a plain member cannot set this flag either (it is in the member block list below).
--
-- STATUS: see the line below.
-- APPLIED LIVE 2026-10-18 (column, grant, both functions). Verified in rolled-back simulations:
-- the routine can set it, a member cannot, the routine still cannot decline, a leader can clear it.

alter table public.bug_reports add column if not exists closed_no_change boolean not null default false;

grant update (closed_no_change) on public.bug_reports to authenticated;

-- The two functions below are the live definitions as applied; the changes against the previous
-- live versions are marked `-- NEW`.

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
       or new.closed_no_change is distinct from old.closed_no_change then          -- NEW
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
                     or new.declined_reason is distinct from old.declined_reason) then
    raise exception 'the routine cannot set verified, approval, severity or a decline';
  end if;
  -- NEW: closing as "no change needed" is an audit result, so the report counts as taken up; a solved
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
    new.taken_up_at := case when new.taken_up then coalesce(new.taken_up_at, now()) end;   -- NEW: keeps the time set above
  end if;
  if new.solved is distinct from old.solved then
    new.solved_at := case when new.solved then now() end;
    if new.solved then
      new.taken_up := true; new.taken_up_at := coalesce(new.taken_up_at, old.taken_up_at, now());
      new.closed_no_change := false;                                                -- NEW
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
end $function$;

-- private.bug_reports_log(): the same as the previous live version plus this block, placed after the
-- `solved` block:
--   if new.closed_no_change is distinct from old.closed_no_change then
--     insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
--     values (new.id, v_id, who, case when new.closed_no_change then 'closed_no_change' else 'reopened' end,
--             new.resolution_note);
--   end if;
-- (create or replace of the whole function was applied; see pg_get_functiondef for the full text.)
