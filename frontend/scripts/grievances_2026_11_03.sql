-- ──────────────────────────────────────────────────────────────────────────
-- Grievance form and HR desk (handoff C-32 and C-33, owner approved the design and the conflict rule, 3 Nov 2026).
--
-- STATUS: APPLY via the Supabase connector (migration name grievances).
--
-- Who can do what (enforced by row level security, not by the screens):
--   submit   signed-in ACTIVE members only, as themselves, at most 5 a day
--   read     HR and Super Admin only. is_super_admin() is exactly that (role in super_admin, hr); is_director() would also let
--            HoDs and Directors in, so it is deliberately NOT used anywhere here.
--   update   HR and Super Admin only: status, assignment, resolution note. No delete for anyone.
--   the person it is about never sees it: if the submission names a member (picked, or typed exactly as a member's name), that
--            member is excluded from reading it, whoever they are. Only the other HR and Super Admin see it.
--   the submitter sees only the STATUS of their own submissions, through my_grievances() (no description, no notes).
-- Nothing here emails, logs or exports a grievance's text. Descriptions are plain text; the screens escape on render.
--
-- Live checks after applying (all expected; run as each role with set local role authenticated + a jwt sub):
--   member / HoD / Director: select count(*) from grievances -> 0, from grievance_notes -> 0
--   HR (not named): sees the row; HR who is named: 0
--   submitter: my_grievances() returns their rows with status only
-- Rollback: drop table grievance_notes, grievance_audit, grievances cascade; drop function my_grievances().
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.grievances (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  submitter_id     integer not null references public.members(member_id) on delete restrict,
  category         text not null check (category in ('harassment', 'discrimination', 'safety', 'misconduct_member', 'misconduct_leader', 'other')),
  description      text not null check (char_length(description) between 10 and 4000),
  about_text       text check (about_text is null or char_length(about_text) <= 200),
  about_member_id  integer references public.members(member_id) on delete set null,
  incident_date    date check (incident_date is null or incident_date <= current_date),
  status           text not null default 'new' check (status in ('new', 'in_review', 'resolved', 'closed')),
  assigned_to      integer references public.members(member_id) on delete set null,
  resolution_note  text check (resolution_note is null or char_length(resolution_note) <= 4000),
  resolved_at      timestamptz
);
create index if not exists grievances_status_created on public.grievances (status, created_at desc);
create index if not exists grievances_submitter on public.grievances (submitter_id, created_at desc);

create table if not exists public.grievance_notes (
  id            bigserial primary key,
  grievance_id  uuid not null references public.grievances(id) on delete cascade,
  author_id     integer not null references public.members(member_id) on delete restrict,
  note          text not null check (char_length(note) between 1 and 4000),
  created_at    timestamptz not null default now()
);
create index if not exists grievance_notes_g on public.grievance_notes (grievance_id, created_at);

create table if not exists public.grievance_audit (
  id            bigserial primary key,
  grievance_id  uuid not null references public.grievances(id) on delete cascade,
  actor_id      integer,
  action        text not null,
  from_status   text,
  to_status     text,
  at            timestamptz not null default now()
);
create index if not exists grievance_audit_g on public.grievance_audit (grievance_id, at);

alter table public.grievances enable row level security;
alter table public.grievance_notes enable row level security;
alter table public.grievance_audit enable row level security;
revoke all on public.grievances, public.grievance_notes, public.grievance_audit from anon, authenticated;
revoke all on sequence public.grievance_notes_id_seq, public.grievance_audit_id_seq from anon, authenticated;

grant insert (submitter_id, category, description, about_text, about_member_id, incident_date) on public.grievances to authenticated;
grant select on public.grievances to authenticated;
grant update (status, assigned_to, resolution_note, resolved_at, updated_at) on public.grievances to authenticated;
grant select, insert on public.grievance_notes to authenticated;
grant usage on sequence public.grievance_notes_id_seq to authenticated;
grant select on public.grievance_audit to authenticated;

-- submit: as yourself, new, and only an active member
create policy grievances_insert on public.grievances for insert to authenticated
  with check (
    submitter_id = public.get_current_member_id()
    and status = 'new'
    and exists (select 1 from public.members m where m.auth_uid = auth.uid() and m.status = 'active')
  );

-- read and update: HR and Super Admin, never the person it is about
create policy grievances_select on public.grievances for select to authenticated
  using (public.is_super_admin() and about_member_id is distinct from public.get_current_member_id());
create policy grievances_update on public.grievances for update to authenticated
  using (public.is_super_admin() and about_member_id is distinct from public.get_current_member_id())
  with check (public.is_super_admin() and about_member_id is distinct from public.get_current_member_id());

create policy grievance_notes_select on public.grievance_notes for select to authenticated
  using (public.is_super_admin() and exists (select 1 from public.grievances g where g.id = grievance_id));
create policy grievance_notes_insert on public.grievance_notes for insert to authenticated
  with check (public.is_super_admin() and author_id = public.get_current_member_id()
              and exists (select 1 from public.grievances g where g.id = grievance_id));

create policy grievance_audit_select on public.grievance_audit for select to authenticated
  using (public.is_super_admin() and exists (select 1 from public.grievances g where g.id = grievance_id));

-- on insert: at most 5 a day per member, and find the member it is about when the name was typed exactly
create or replace function public.grievances_before_insert() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_recent int; v_about int;
begin
  select count(*) into v_recent from public.grievances where submitter_id = new.submitter_id and created_at > now() - interval '24 hours';
  if v_recent >= 5 then
    raise exception 'grievance_rate_limited' using errcode = '54000';
  end if;
  if new.about_member_id is null and nullif(trim(new.about_text), '') is not null then
    select m.member_id into v_about from public.members m
     where lower(trim(m.full_name)) = lower(trim(new.about_text)) and m.status = 'active'
     order by (m.role in ('hr', 'super_admin')) desc, m.member_id limit 1;
    new.about_member_id := v_about;
  end if;
  return new;
end $$;
revoke all on function public.grievances_before_insert() from public, anon, authenticated;
create or replace trigger trg_grievances_before_insert before insert on public.grievances
  for each row execute function public.grievances_before_insert();

-- on update: stamp updated_at and resolved_at
create or replace function public.grievances_before_update() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.updated_at := now();
  if new.status in ('resolved', 'closed') and old.status not in ('resolved', 'closed') then
    new.resolved_at := now();
  elsif new.status in ('new', 'in_review') then
    new.resolved_at := null;
  end if;
  return new;
end $$;
revoke all on function public.grievances_before_update() from public, anon, authenticated;
create or replace trigger trg_grievances_before_update before update on public.grievances
  for each row execute function public.grievances_before_update();

-- audit: who changed what and when
create or replace function public.grievances_audit_change() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'INSERT' then
    insert into public.grievance_audit (grievance_id, actor_id, action, to_status) values (new.id, new.submitter_id, 'submitted', new.status);
  else
    if new.status is distinct from old.status then
      insert into public.grievance_audit (grievance_id, actor_id, action, from_status, to_status)
        values (new.id, public.get_current_member_id(), 'status_changed', old.status, new.status);
    end if;
    if new.assigned_to is distinct from old.assigned_to then
      insert into public.grievance_audit (grievance_id, actor_id, action) values (new.id, public.get_current_member_id(), 'assigned');
    end if;
    if new.resolution_note is distinct from old.resolution_note then
      insert into public.grievance_audit (grievance_id, actor_id, action) values (new.id, public.get_current_member_id(), 'resolution_note_edited');
    end if;
  end if;
  return new;
end $$;
revoke all on function public.grievances_audit_change() from public, anon, authenticated;
create or replace trigger trg_grievances_audit after insert or update on public.grievances
  for each row execute function public.grievances_audit_change();

-- the submitter's view of their own submissions: status only
create or replace function public.my_grievances()
returns table(id uuid, created_at timestamptz, category text, status text, resolved_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select g.id, g.created_at, g.category, g.status, g.resolved_at
    from public.grievances g
   where g.submitter_id = public.get_current_member_id()
   order by g.created_at desc;
$$;
revoke all on function public.my_grievances() from public, anon;
grant execute on function public.my_grievances() to authenticated;
