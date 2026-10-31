-- Bug tracker v2 (owner decisions 2026-10-22). Additive only: new columns, tables, policies, functions.
-- Nothing is dropped or rewritten. Read docs/SHEET_TRIAGE_ROUTINE.md section 7 for how the routine uses it.
--
-- What it adds
--   * every ACTIVE member can read all reports and their timelines (before: own reports, leaders all). The
--     screenshots and documents stay private to the reporter and leaders (storage policies are unchanged).
--   * "me too": public.bug_report_votes, one per member per report, with a trigger-kept count (me_too_count).
--   * a backlog: report_type, area, lane (today, next, later, done), lane_reason, lane_locked, duplicate_of,
--     routine_reading, evidence. The routine fills them; a leader may set type, area and lane, and a leader's
--     lane choice is locked so the routine does not move it back.
--   * "did this fix it": any reporter or me-too voter can confirm or send back a solved report through
--     public.bug_reporter_confirm(). A send-back works exactly like a leader's (clears taken_up, rework_count + 1).
--   * public.routine_runs: one row per daily run, for the "this morning" panel. Written only by the routine
--     (the database owner); read by active members.
--   * public.bug_report_secrets: a private read token per report so the routine can fetch screenshots through the
--     bug-shot edge function while the bucket stays private. No role except the owner can read it.

-- ── columns ─────────────────────────────────────────────────────────────────────────────────
alter table public.bug_reports
  add column if not exists report_type text check (report_type in ('bug', 'design', 'feature', 'content', 'performance')),
  add column if not exists area text check (char_length(area) <= 80),
  add column if not exists lane text not null default 'later' check (lane in ('today', 'next', 'later', 'done')),
  add column if not exists lane_reason text check (char_length(lane_reason) <= 300),
  add column if not exists lane_locked boolean not null default false,
  add column if not exists duplicate_of uuid references public.bug_reports(id) on delete set null,
  add column if not exists routine_reading text check (char_length(routine_reading) <= 600),
  add column if not exists evidence jsonb not null default '{}'::jsonb,
  add column if not exists me_too_count integer not null default 0,
  add column if not exists reporter_confirm text check (reporter_confirm in ('fixed', 'not_fixed')),
  add column if not exists reporter_confirmed_at timestamptz;

-- solved and closed reports are already done
update public.bug_reports set lane = 'done' where (solved or closed_no_change) and lane <> 'done';

create index if not exists bug_reports_lane_idx on public.bug_reports (lane, created_at);

-- ── me too ──────────────────────────────────────────────────────────────────────────────────
create table if not exists public.bug_report_votes (
  bug_id uuid not null references public.bug_reports(id) on delete cascade,
  member_id integer not null references public.members(member_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (bug_id, member_id)
);
revoke all on public.bug_report_votes from anon, authenticated;
grant select, insert, delete on public.bug_report_votes to authenticated;
alter table public.bug_report_votes enable row level security;

create policy "members read their own votes"
  on public.bug_report_votes for select to authenticated
  using (member_id = public.current_member_id());
create policy "active members vote once per report"
  on public.bug_report_votes for insert to authenticated
  with check (member_id = public.current_member_id());
create policy "members take back their own vote"
  on public.bug_report_votes for delete to authenticated
  using (member_id = public.current_member_id());

-- The count is kept by this trigger. It tells the update trigger (below) that only me_too_count may change, so a
-- member who is not the reporter can vote without being allowed to touch anything else.
create or replace function private.bug_votes_count() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform set_config('aq.bug_vote_count', '1', true);
  if tg_op = 'INSERT' then
    update public.bug_reports set me_too_count = me_too_count + 1 where id = new.bug_id;
  else
    update public.bug_reports set me_too_count = greatest(me_too_count - 1, 0) where id = old.bug_id;
  end if;
  perform set_config('aq.bug_vote_count', '', true);
  if tg_op = 'INSERT' then return new; end if;
  return old;
end $$;
create trigger bug_votes_count_trg after insert or delete on public.bug_report_votes
  for each row execute function private.bug_votes_count();

-- ── who may read ────────────────────────────────────────────────────────────────────────────
create policy "active members read every bug report"
  on public.bug_reports for select to authenticated
  using (public.current_member_id() is not null);
create policy "active members read every bug report timeline"
  on public.bug_report_events for select to authenticated
  using (public.current_member_id() is not null);

-- leaders may set type, area and lane (a lane choice by a leader is locked, see the trigger)
grant update (report_type, area, lane, lane_reason, lane_locked) on public.bug_reports to authenticated;

-- ── the routine's run log ───────────────────────────────────────────────────────────────────
create table if not exists public.routine_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  verdict text check (verdict in ('GREEN', 'ALERT', 'INCOMPLETE')),
  picked integer not null default 0,
  shipped integer not null default 0,
  skipped integer not null default 0,
  summary text check (char_length(summary) <= 1500),
  themes text check (char_length(themes) <= 1500)
);
revoke all on public.routine_runs from anon, authenticated;
grant select on public.routine_runs to authenticated;
alter table public.routine_runs enable row level security;
create policy "active members read the routine run log"
  on public.routine_runs for select to authenticated
  using (public.current_member_id() is not null);

-- ── private read token (never granted to any API role) ──────────────────────────────────────
create table if not exists public.bug_report_secrets (
  bug_id uuid primary key references public.bug_reports(id) on delete cascade,
  read_token text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
revoke all on public.bug_report_secrets from anon, authenticated;
alter table public.bug_report_secrets enable row level security;
insert into public.bug_report_secrets (bug_id) select id from public.bug_reports on conflict do nothing;

create or replace function private.bug_secret_row() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.bug_report_secrets (bug_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger bug_secret_row_trg after insert on public.bug_reports
  for each row execute function private.bug_secret_row();

-- ── the update trigger: same rules as before, plus the new columns ──────────────────────────
create or replace function private.bug_reports_before_update()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_id integer := public.current_member_id();
  is_routine boolean := auth.uid() is null;
  is_confirm boolean := coalesce(current_setting('aq.bug_reporter_confirm', true), '') = '1';
  is_leader boolean := (auth.uid() is not null and public.is_director()) or is_confirm;
  editing boolean := new.description is distinct from old.description;
  v_count integer := new.me_too_count;
begin
  if coalesce(current_setting('aq.bug_vote_count', true), '') = '1' then
    new := old;
    new.me_too_count := v_count;
    return new;
  end if;
  if not is_routine and not is_leader then
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
       or new.rework_note is distinct from old.rework_note
       or new.rework_count is distinct from old.rework_count
       or new.report_type is distinct from old.report_type
       or new.area is distinct from old.area
       or new.lane is distinct from old.lane
       or new.lane_reason is distinct from old.lane_reason
       or new.lane_locked is distinct from old.lane_locked
       or new.duplicate_of is distinct from old.duplicate_of
       or new.routine_reading is distinct from old.routine_reading
       or new.evidence is distinct from old.evidence
       or new.me_too_count is distinct from old.me_too_count
       or new.reporter_confirm is distinct from old.reporter_confirm
       or new.reporter_confirmed_at is distinct from old.reporter_confirmed_at then
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
                     or new.rework_note is distinct from old.rework_note
                     or new.rework_count is distinct from old.rework_count
                     or new.reporter_confirm is distinct from old.reporter_confirm
                     or new.reporter_confirmed_at is distinct from old.reporter_confirmed_at
                     or new.me_too_count is distinct from old.me_too_count) then
    raise exception 'the routine cannot set verified, approval, severity, a decline, a send-back note, a reporter confirmation or a vote count';
  end if;
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
      new.reporter_confirm := null; new.reporter_confirmed_at := null;
    else
      new.verified := false;
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
  -- the lane follows the status unless a leader fixed it. A leader's own lane choice is locked; the routine cannot
  -- move a locked lane (it keeps the leader's value and the change is ignored, not an error).
  if new.lane is distinct from old.lane and not is_routine and not is_confirm then
    new.lane_locked := true;
  end if;
  if is_routine and old.lane_locked and new.lane is distinct from old.lane and not (new.solved or new.closed_no_change) then
    new.lane := old.lane;
  end if;
  if (new.solved and not old.solved) or (new.closed_no_change and not old.closed_no_change) then
    new.lane := 'done';
  elsif old.solved and not new.solved and not new.closed_no_change and new.lane = 'done' then
    new.lane := 'today';
  end if;
  new.updated_at := now();
  return new;
end $function$;

-- ── the timeline logger: same events, plus lane, duplicate and reporter confirmation ────────
create or replace function private.bug_reports_log()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
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
                 else 'filed by a member' end);
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
  if new.taken_up is distinct from old.taken_up and not (old.solved and not new.solved) then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind)
    values (new.id, v_id, who, case when new.taken_up then 'taken_up' else 'untaken' end);
  end if;
  if new.solved is distinct from old.solved then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, case when new.solved then 'solved' else 'reopened' end,
            case when new.solved then new.fix_pr_url else new.rework_note end);
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
  if new.lane is distinct from old.lane and not (new.solved is distinct from old.solved) then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, 'lane', old.lane || ' to ' || new.lane || coalesce(': ' || new.lane_reason, ''));
  end if;
  if new.duplicate_of is distinct from old.duplicate_of and new.duplicate_of is not null then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind, note)
    values (new.id, v_id, who, 'duplicate', 'same as report ' || left(new.duplicate_of::text, 8));
  end if;
  if new.reporter_confirm is distinct from old.reporter_confirm and new.reporter_confirm is not null then
    insert into public.bug_report_events (bug_id, actor_member_id, actor_label, kind)
    values (new.id, v_id, who, case when new.reporter_confirm = 'fixed' then 'reporter_confirmed' else 'reporter_not_fixed' end);
  end if;
  return new;
end $function$;

-- ── "did this fix it?" for the people who asked ─────────────────────────────────────────────
create or replace function public.bug_reporter_confirm(p_bug uuid, p_fixed boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id integer := public.current_member_id();
  r public.bug_reports%rowtype;
begin
  if v_id is null then raise exception 'only active members can answer this'; end if;
  select * into r from public.bug_reports where id = p_bug;
  if not found then raise exception 'report not found'; end if;
  if not r.solved then raise exception 'this report is not marked solved yet'; end if;
  if r.reporter_member_id is distinct from v_id
     and not exists (select 1 from public.bug_report_votes where bug_id = p_bug and member_id = v_id) then
    raise exception 'only the person who reported this, or who said me too, can answer';
  end if;
  if p_fixed then
    update public.bug_reports set reporter_confirm = 'fixed', reporter_confirmed_at = now() where id = p_bug;
  else
    perform set_config('aq.bug_reporter_confirm', '1', true);
    update public.bug_reports
       set solved = false,
           rework_note = left(coalesce(nullif(btrim(p_note), ''), 'The reporter says it is not fixed.'), 500),
           reporter_confirm = 'not_fixed', reporter_confirmed_at = now()
     where id = p_bug;
    perform set_config('aq.bug_reporter_confirm', '', true);
  end if;
end $$;
revoke all on function public.bug_reporter_confirm(uuid, boolean, text) from public, anon;
grant execute on function public.bug_reporter_confirm(uuid, boolean, text) to authenticated;
