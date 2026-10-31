-- Bug reports: a table members file into, a change log, and a private screenshot bucket.
-- Owner request 2026-10-05. Replaces the Google Sheet "AQ WEBSITE TASKS" as the way bugs
-- reach the nightly routine (docs/SHEET_TRIAGE_ROUTINE.md section 7). Owner decisions:
--   * any active member can file; only HoD/director/hr/super_admin see everyone's reports;
--   * the routine fixes automatically ONLY reports filed by a leader or approved by one.
--
-- THE TRUST RULE LIVES HERE, NOT IN THE ROUTINE'S PROMPT. A member's description is free text
-- that an auto-merging agent would read, so the database decides who is trusted:
--   * `approved_for_fix` is set by a trigger from the filer's real role (never from the client),
--     and only a leader can change it afterwards;
--   * the INSERT grant is column-by-column, so a client cannot even send approved_for_fix,
--     reporter_*, taken_up/solved/verified, timestamps or notes;
--   * the routine (no JWT, so auth.uid() is null) cannot set `verified` or `approved_for_fix`
--     and cannot edit anything but taken_up, solved, fix_pr_url, resolution_note,
--     needs_info_note and declined_reason. A human ticks VERIFIED, as before.
--
-- Defaults to know: on this project a NEW public table gets arwdDxtm for anon AND
-- authenticated from default privileges, so RLS would be the only gate. This file revokes
-- that and grants column-by-column, the lesson of the `members` incidents in CLAUDE.md.
-- Trigger functions live in schema `private`, which the API does not expose, so they are not
-- callable over /rest/v1/rpc and add nothing to the security advisor.
--
-- STATUS: APPLIED LIVE 2026-10-05 via execute_sql in two statements (tables, grants and
-- policies; then triggers and bucket). Verified in rolled-back simulations: a member files with
-- approved_for_fix=false, cannot send that column, cannot update, cannot see another member's
-- report; the 11th report in an hour is refused; a foreign screenshot path is refused; a HoD's
-- own report is auto-approved and a HoD can approve, solve and verify (verify needs solved);
-- the routine can solve but not verify, approve, decline or change severity (declining was added
-- 2026-10-05, applied live with create or replace); description is immutable;
-- bucket: own folder only, a HoD reads any, anon reads nothing. Security advisor counts
-- unchanged afterwards. Written without any DROP, so the tool did not hold it.

create schema if not exists private;

-- ── table ──────────────────────────────────────────────────────────────────────────────
create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- who (all set by trigger from the session; the client cannot supply them)
  reporter_member_id integer references public.members(member_id) on delete set null,
  reporter_uuid uuid,
  reporter_name text,
  reporter_role text,

  -- where (client-supplied context, treated as data)
  page_url text not null check (char_length(page_url) between 1 and 500),
  page_path text not null check (char_length(page_path) between 1 and 300),
  viewport_w integer check (viewport_w between 1 and 10000),
  viewport_h integer check (viewport_h between 1 and 10000),
  user_agent text check (char_length(user_agent) <= 400),
  capture_method text check (capture_method in ('shortcut', 'form')),

  -- what
  severity text not null default 'med' check (severity in ('high', 'med', 'low')),
  description text not null check (char_length(btrim(description)) between 10 and 4000),
  screenshots text[] not null default '{}' check (cardinality(screenshots) <= 4),

  -- trust, set by trigger / leaders only
  approved_for_fix boolean not null default false,
  approved_by integer references public.members(member_id) on delete set null,

  -- the sheet's three checkboxes; the *_at/*_by columns are filled by trigger
  taken_up boolean not null default false,
  taken_up_at timestamptz,
  solved boolean not null default false,
  solved_at timestamptz,
  verified boolean not null default false,
  verified_at timestamptz,
  verified_by integer references public.members(member_id) on delete set null,

  declined_reason text check (char_length(declined_reason) <= 500),
  needs_info_note text check (char_length(needs_info_note) <= 500),
  fix_pr_url text check (char_length(fix_pr_url) <= 300),
  resolution_note text check (char_length(resolution_note) <= 1000)
);

create index if not exists bug_reports_created_idx on public.bug_reports (created_at desc);
create index if not exists bug_reports_reporter_idx on public.bug_reports (reporter_member_id, created_at desc);
create index if not exists bug_reports_open_idx on public.bug_reports (created_at)
  where taken_up = false and declined_reason is null;

create table if not exists public.bug_report_events (
  id bigint generated always as identity primary key,
  bug_id uuid not null references public.bug_reports(id) on delete cascade,
  at timestamptz not null default now(),
  actor_member_id integer references public.members(member_id) on delete set null,
  actor_label text not null,                 -- member name at the time, or 'routine'
  kind text not null,
  note text check (char_length(note) <= 1000)
);
create index if not exists bug_report_events_bug_idx on public.bug_report_events (bug_id, at);

-- ── privileges: revoke the wide defaults, grant by column ────────────────────────────────
revoke all on public.bug_reports from anon, authenticated;
revoke all on public.bug_report_events from anon, authenticated;

grant select on public.bug_reports to authenticated;
grant insert (page_url, page_path, viewport_w, viewport_h, user_agent, capture_method,
              severity, description, screenshots)
  on public.bug_reports to authenticated;
grant update (severity, approved_for_fix, taken_up, solved, verified, declined_reason,
              needs_info_note, fix_pr_url, resolution_note)
  on public.bug_reports to authenticated;
grant select on public.bug_report_events to authenticated;

-- ── row level security ────────────────────────────────────────────────────────────────────
alter table public.bug_reports enable row level security;
alter table public.bug_report_events enable row level security;

create policy "members read own bug reports, leaders read all"
  on public.bug_reports for select to authenticated
  using (reporter_member_id = public.current_member_id() or public.is_director());

create policy "active members file bug reports"
  on public.bug_reports for insert to authenticated
  with check (public.current_member_id() is not null);

create policy "leaders update bug reports"
  on public.bug_reports for update to authenticated
  using (public.is_director())
  with check (public.is_director());

create policy "read events of reports you can read"
  on public.bug_report_events for select to authenticated
  using (
    public.is_director()
    or exists (select 1 from public.bug_reports b
                where b.id = bug_id and b.reporter_member_id = public.current_member_id())
  );

-- ── triggers (schema private: not exposed over the API) ──────────────────────────────────
create or replace function private.bug_reports_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id integer := public.current_member_id();
  m record;
  p text;
begin
  if v_id is null and auth.uid() is not null then
    raise exception 'only active members can file a bug report';
  end if;
  if v_id is not null then
    select member_id, uuid, full_name, role into m from public.members where member_id = v_id;
    new.reporter_member_id := m.member_id;
    new.reporter_uuid := m.uuid;
    new.reporter_name := m.full_name;
    new.reporter_role := m.role;
    new.approved_for_fix := m.role in ('director', 'hod', 'hr', 'super_admin');
    new.approved_by := case when new.approved_for_fix then v_id end;
    if (select count(*) from public.bug_reports
         where reporter_member_id = v_id and created_at > now() - interval '1 hour') >= 10 then
      raise exception 'too many reports in the last hour, try again later';
    end if;
    -- a screenshot path must live in the filer's own folder: no pointing at someone else's file
    foreach p in array new.screenshots loop
      if p not like m.uuid::text || '/%' or p like '%..%' then
        raise exception 'screenshot path not allowed';
      end if;
    end loop;
  end if;
  new.taken_up := false; new.taken_up_at := null;
  new.solved := false;   new.solved_at := null;
  new.verified := false; new.verified_at := null; new.verified_by := null;
  new.declined_reason := null; new.needs_info_note := null;
  new.fix_pr_url := null; new.resolution_note := null;
  -- A signed-in client always gets now(). Only a session with no login at all (the database
  -- owner, used to import the old sheet rows) may keep a date it supplied. Added 2026-10-05 for
  -- the sheet import (bug_reports_import_sheet_2026_10_05.sql); applied live with create or replace.
  new.created_at := case when auth.uid() is null then coalesce(new.created_at, now()) else now() end;
  new.updated_at := now();
  return new;
end $$;

create or replace function private.bug_reports_before_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_id integer := public.current_member_id();
  is_routine boolean := auth.uid() is null;
begin
  if not is_routine and not public.is_director() then
    raise exception 'only leaders can update bug reports';
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
     or new.description is distinct from old.description
     or new.screenshots is distinct from old.screenshots then
    raise exception 'the report itself cannot be edited, only its status';
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
      new.verified := false;   -- reopening clears verification
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

create trigger bug_reports_before_insert before insert on public.bug_reports
  for each row execute function private.bug_reports_before_insert();
create trigger bug_reports_before_update before update on public.bug_reports
  for each row execute function private.bug_reports_before_update();
create trigger bug_reports_log after insert or update on public.bug_reports
  for each row execute function private.bug_reports_log();

-- ── screenshots: a PRIVATE bucket, one folder per member (the member's uuid) ─────────────
-- Private on purpose: a screenshot of a desk can show member names and phone numbers.
-- Read by signed URL. 5 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bug-screenshots', 'bug-screenshots', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "members upload bug screenshots to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bug-screenshots'
    and (storage.foldername(name))[1] = public.current_member_uuid()::text
  );

create policy "owner or leader reads bug screenshots"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'bug-screenshots'
    and ((storage.foldername(name))[1] = public.current_member_uuid()::text or public.is_director())
  );
-- No update or delete policy: a filed screenshot cannot be swapped or removed by its filer.

-- Links a leader will click. A client can write these columns through the API directly, so a
-- `javascript:` value is refused here (APPLIED LIVE 2026-10-05, checked in a rolled-back run:
-- a script page_url and a script page_path are refused, a normal report files), and the page
-- renders only vetted links as well (bugs/bugModel.ts safeHref / safePageUrl).
alter table public.bug_reports add constraint bug_reports_page_url_http check (page_url ~* '^https?://');
alter table public.bug_reports add constraint bug_reports_page_path_slash check (page_path like '/%');
alter table public.bug_reports add constraint bug_reports_fix_pr_url_https check (fix_pr_url is null or fix_pr_url ~* '^https://');

-- Verify after applying (each as its own query):
--  select relacl::text from pg_class where oid = 'public.bug_reports'::regclass;
--    expect authenticated=r/postgres plus column grants, NO anon entry, no arwdDxtm for authenticated
--  select * from pg_policies where tablename in ('bug_reports','bug_report_events');
--  select id, public from storage.buckets where id = 'bug-screenshots';   -- public = false
