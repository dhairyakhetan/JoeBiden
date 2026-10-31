-- Bug reports: document attachments (PDF, text, Word and Excel without macros) on a report.
--
-- WHY: the owner asked (report e0ca05db, decision 2026-10-07, build approved 2026-10-09) so a feature
-- request can carry a brief, not only screenshots. The owner chose the SAFE version: a NEW private bucket
-- (the screenshots bucket and its image-only rule stay untouched), a new column, strict path checks, and
-- files that are only ever downloaded through short-lived private links, never rendered in the page.
--
-- RULES:
--   * bucket `bug-attachments`: private, 10 MB per file, mime types pdf, text/plain, docx, xlsx only.
--     Legacy .doc and .xls and every macro-enabled type (.docm, .xlsm) are refused: they can carry macros.
--   * `bug_reports.attachments text[]`, at most 8, fixed at filing like the other report fields.
--   * a path must be exactly <the filer's uuid>/<uuid>-<safe name>.<pdf|txt|docx|xlsx> (trigger), so a
--     report cannot point at someone else's file, and no odd characters get into a stored path.
--   * who reads: the filer and any leader (storage policy). Nobody else, and anon nothing.
--   * the routine has no storage tool, so it cannot read an attachment: it works from the description and
--     asks for the brief's key points in words if it needs them.
--
-- STATUS: APPLIED LIVE 2026-10-09 (project hzowuwffjqtgszecngpe), one statement per call, in this order.
-- Nothing is destructive. VERIFIED in rolled-back blocks: see the list at the bottom.

-- 1. the column (default empty, capped at 8).
alter table public.bug_reports
  add column attachments text[] not null default '{}'
  constraint bug_reports_attachments_cap check (cardinality(attachments) <= 8);

-- 2. insert guard: validates screenshot and attachment paths (from the live definition).
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
    foreach p in array new.screenshots loop
      if p not like m.uuid::text || '/%' or p like '%..%' then
        raise exception 'screenshot path not allowed';
      end if;
    end loop;
    -- an attachment path must be exactly <your uuid>/<uuid>-<safe name>.<pdf|txt|docx|xlsx>
    foreach p in array new.attachments loop
      if p !~ ('^' || m.uuid::text || '/[0-9a-f-]{36}-[a-z0-9._-]{1,80}$')
         or p like '%..%'
         or p !~* '\.(pdf|txt|docx|xlsx)$' then
        raise exception 'attachment path not allowed';
      end if;
    end loop;
  end if;
  new.taken_up := false; new.taken_up_at := null;
  new.solved := false;   new.solved_at := null;
  new.verified := false; new.verified_at := null; new.verified_by := null;
  new.declined_reason := null; new.needs_info_note := null;
  new.fix_pr_url := null; new.resolution_note := null;
  -- A signed-in client always gets now(). Only a session with no login at all (the database
  -- owner, used to import the old sheet rows) may keep a date it supplied.
  new.created_at := case when auth.uid() is null then coalesce(new.created_at, now()) else now() end;
  new.updated_at := now();
  return new;
end $$;

-- 3. update guard: attachments are fixed once filed, like screenshots (from the live definition
--    set by bug_reports_edit_description_2026_10_09.sql).
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

-- 4. the new column privilege (column by column, INSERT only: attachments cannot be changed afterwards).
grant insert (attachments) on public.bug_reports to authenticated;

-- 5. the bucket: private, 10 MB, safe types only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bug-attachments', 'bug-attachments', false, 10485760,
        array['application/pdf', 'text/plain',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

-- 6. who may upload and read (same shape as the screenshots bucket).
create policy "members upload bug attachments to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'bug-attachments'
              and (storage.foldername(name))[1] = (public.current_member_uuid())::text);

create policy "owner or leader reads bug attachments"
  on storage.objects for select to authenticated
  using (bucket_id = 'bug-attachments'
         and ((storage.foldername(name))[1] = (public.current_member_uuid())::text or public.is_director()));

-- SIMULATIONS (rolled-back DO blocks, results recorded 2026-10-09): see the PR description.
