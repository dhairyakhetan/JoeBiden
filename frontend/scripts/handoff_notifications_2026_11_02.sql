-- ──────────────────────────────────────────────────────────────────────────
-- Handoffs that changed something for a member but never told them (overnight
-- "everything connects" audit, 2 Nov 2026).
--
-- STATUS: APPLIED 3 Nov 2026 via the Supabase connector (migration name handoff_notifications), after the owner
-- confirmed the prompt. Each trigger was exercised inside a rolled-back block: a task assignee, a bug reporter, a new
-- drive lead and a checked-in attendee each got exactly one notification with the right title and link, a walk-in
-- with no account got none, and nothing persisted.
--
-- Why triggers and not client calls: public.create_notification() only lets a leader send
-- 'system' and only a members.role='lead' send several other types, and that role no longer
-- exists (team_members.role is constrained to 'member'). A plain member assigning a task, or a
-- leader-less flow such as a bug fix, therefore failed silently. These triggers run as the table
-- owner, so the person is told whoever caused the change.
--
--   1. task_people INSERT        -> 'task_assigned' to the added person (not silent, not self)
--   2. bug_report_events INSERT  -> 'bug_update' to the reporter on solved / needs_info /
--                                   closed_no_change / declined
--   3. welfare_projects drive lead set     -> 'drive_role' to the new lead, link to the check-in sheet
--   4. welfare_projects attendance completed -> 'drive_done' to each member who checked in
--   5. team_leader_ids(team_id): HoDs/directors scoped to the team or its parents (HR if none),
--      so join requests and applications reach a person again. Applied separately as
--      migration team_leader_ids.
--
-- No existing rows are touched. Live checks after applying:
--   select tgname from pg_trigger where tgname like 'trg_notify_%';   -- 4 rows
-- Rollback: drop trigger trg_notify_* on each table, drop the four functions.
-- ──────────────────────────────────────────────────────────────────────────

-- 1. a task assigned to you
create or replace function public.notify_task_assigned() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare t_title text;
begin
  if new.silent is true or new.member_id is not distinct from new.added_by then return new; end if;
  select title into t_title from public.tasks where task_id = new.task_id;
  insert into public.notifications (member_id, type, title, subtitle, link)
  values (new.member_id, 'task_assigned',
          'You were added to a task as ' || coalesce(new.role, 'a participant'),
          coalesce(left(t_title, 140), 'Open your tasks to see it'),
          '/tasks');
  return new;
end $$;
revoke all on function public.notify_task_assigned() from public, anon, authenticated;
drop trigger if exists trg_notify_task_assigned on public.task_people;
create trigger trg_notify_task_assigned after insert on public.task_people
  for each row execute function public.notify_task_assigned();

-- 2. an answer to a bug or feature report
create or replace function public.notify_bug_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record; head text; sub text;
begin
  if new.kind not in ('solved', 'needs_info', 'closed_no_change', 'declined') then return new; end if;
  select reporter_member_id, kind as rkind, left(description, 90) as d into r
    from public.bug_reports where id = new.bug_id;
  if r.reporter_member_id is null or r.reporter_member_id is not distinct from new.actor_member_id then return new; end if;
  if new.kind = 'solved' then
    head := 'Your ' || case when r.rkind = 'feature' then 'request' else 'report' end || ' was marked done';
    sub := '"' || r.d || '". Take a look and tell us if it worked.';
  elsif new.kind = 'needs_info' then
    head := 'We have a question about your report';
    sub := '"' || r.d || '"';
  elsif new.kind = 'closed_no_change' then
    head := 'We looked at your report: nothing to change';
    sub := '"' || r.d || '". Open it to see why.';
  else
    head := 'Your report was not taken up';
    sub := '"' || r.d || '"';
  end if;
  insert into public.notifications (member_id, type, title, subtitle, link)
  values (r.reporter_member_id, 'bug_update', head, sub, '/bugs');
  return new;
end $$;
revoke all on function public.notify_bug_update() from public, anon, authenticated;
drop trigger if exists trg_notify_bug_update on public.bug_report_events;
create trigger trg_notify_bug_update after insert on public.bug_report_events
  for each row execute function public.notify_bug_update();

-- 3. you were made the lead of a drive
create or replace function public.notify_drive_lead() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.drive_lead_member_id is not null and new.drive_lead_member_id is distinct from old.drive_lead_member_id then
    insert into public.notifications (member_id, type, title, subtitle, link)
    values (new.drive_lead_member_id, 'drive_role',
            'You''re running ' || coalesce(new.header, 'a drive'),
            'Open the check-in sheet on the day to record who turns up.',
            '/drive/' || new.id::text || '/check-in');
  end if;
  return new;
end $$;
revoke all on function public.notify_drive_lead() from public, anon, authenticated;
drop trigger if exists trg_notify_drive_lead on public.welfare_projects;
create trigger trg_notify_drive_lead after update of drive_lead_member_id on public.welfare_projects
  for each row execute function public.notify_drive_lead();

-- 4. a drive was completed: tell everyone who checked in that their hours are recorded
create or replace function public.notify_drive_done() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.attendance_completed_at is null and new.attendance_completed_at is not null then
    insert into public.notifications (member_id, type, title, subtitle, link)
    select distinct a.member_id, 'drive_done',
           'Thanks for showing up at ' || coalesce(new.header, 'the drive'),
           'Your hours are recorded. You can ask for your certificate from your profile.',
           '/profile/me'
      from public.drive_attendance a
     where a.welfare_project_id = new.id and a.member_id is not null and a.checked_in_at is not null;
  end if;
  return new;
end $$;
revoke all on function public.notify_drive_done() from public, anon, authenticated;
drop trigger if exists trg_notify_drive_done on public.welfare_projects;
create trigger trg_notify_drive_done after update of attendance_completed_at on public.welfare_projects
  for each row execute function public.notify_drive_done();
