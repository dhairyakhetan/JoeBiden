-- ──────────────────────────────────────────────────────────────────────────
-- Pending members cannot apply to a team. They register INTEREST instead, and get
-- a chip at the top of their feed once HR approves them (owner, 2 Nov 2026).
--
-- STATUS: APPLY via the Supabase connector (migration name opening_interests).
--
-- What it does
--   1. public.opening_interests: "remind me when I am in". One row per member per
--      opening (a role) or per team. state: waiting -> ready (set by the trigger the
--      moment the member becomes active) -> applied | dismissed.
--   2. job_applications and team_join_requests: INSERT now also requires the
--      applicant to be an ACTIVE member. Before this, any signed-in account could
--      apply, including pending and rejected ones (the PRD allowed pending
--      applicants on purpose from 1 Nov; that rule is reversed here).
--   3. Trigger on members: when status becomes active, that member's waiting
--      interests become ready and ONE notification is written.
--   4. One-off conversion: existing applications and join requests from members who are
--      still pending_approval become interests (state waiting). The original row is kept
--      verbatim in opening_interests.origin before it is removed, so nothing is lost.
--      A rejected member's single application is left untouched.
--
-- Rejected accounts get no interest row: they wait out the 30 days, as before.
--
-- Live checks after applying (all expected):
--   select count(*) from job_applications a join members m on m.member_id=a.applicant_id
--    where m.status='pending_approval';                                  -- 0
--   select count(*) from opening_interests where from_application;       -- 32 (31 + 1)
--   select polname from pg_policy where polrelid='public.job_applications'::regclass; -- includes the active check
--
-- Rollback of the rules (data conversion is not reversed; origin holds the rows):
--   drop policy job_applications_auth_insert on public.job_applications; create policy
--   job_applications_auth_insert on public.job_applications for insert
--   with check (applicant_id = get_current_member_id());   (same for team_join_requests)
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.opening_interests (
  id               uuid primary key default gen_random_uuid(),
  member_id        integer not null references public.members(member_id) on delete cascade,
  opening_id       uuid references public.job_openings(id) on delete cascade,
  team_id          integer references public.teams(team_id) on delete cascade,
  message          text,
  custom_answers   jsonb not null default '{}'::jsonb,
  state            text not null default 'waiting'
                   check (state in ('waiting', 'ready', 'applied', 'dismissed')),
  from_application boolean not null default false,
  origin           jsonb,
  created_at       timestamptz not null default now(),
  ready_at         timestamptz,
  constraint opening_interests_one_target check (num_nonnulls(opening_id, team_id) = 1)
);
create unique index if not exists opening_interests_member_opening
  on public.opening_interests (member_id, opening_id) where opening_id is not null;
create unique index if not exists opening_interests_member_team
  on public.opening_interests (member_id, team_id) where team_id is not null;
create index if not exists opening_interests_member_state
  on public.opening_interests (member_id, state);

alter table public.opening_interests enable row level security;
revoke all on public.opening_interests from anon;
grant select, insert, update, delete on public.opening_interests to authenticated;

drop policy if exists opening_interests_select on public.opening_interests;
create policy opening_interests_select on public.opening_interests for select to authenticated
  using (member_id = get_current_member_id() or is_director() or is_super_admin());

-- Only a member who is still waiting for approval can register interest, and only for themselves.
drop policy if exists opening_interests_insert on public.opening_interests;
create policy opening_interests_insert on public.opening_interests for insert to authenticated
  with check (
    member_id = get_current_member_id()
    and state = 'waiting'
    and exists (select 1 from public.members m where m.member_id = opening_interests.member_id and m.status = 'pending_approval')
  );

-- A member may move their own interest between waiting, applied and dismissed. 'ready' is the trigger's.
drop policy if exists opening_interests_update on public.opening_interests;
create policy opening_interests_update on public.opening_interests for update to authenticated
  using (member_id = get_current_member_id())
  with check (member_id = get_current_member_id() and state in ('waiting', 'applied', 'dismissed'));

drop policy if exists opening_interests_delete on public.opening_interests;
create policy opening_interests_delete on public.opening_interests for delete to authenticated
  using (member_id = get_current_member_id());

-- ── Apply and join: active members only ────────────────────────────────────
drop policy if exists job_applications_auth_insert on public.job_applications;
create policy job_applications_auth_insert on public.job_applications for insert
  with check (
    applicant_id = get_current_member_id()
    and exists (select 1 from public.members m where m.member_id = job_applications.applicant_id and m.status = 'active')
  );

drop policy if exists "Members can insert their own join requests" on public.team_join_requests;
create policy "Members can insert their own join requests" on public.team_join_requests for insert
  with check (
    member_id = get_current_member_id()
    and exists (select 1 from public.members m where m.member_id = team_join_requests.member_id and m.status = 'active')
  );

-- ── On approval: interests become ready, one notification ──────────────────
create or replace function public.opening_interests_on_member_active()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  n int;
  first_title text;
  first_link text;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    update public.opening_interests
       set state = 'ready', ready_at = now()
     where member_id = new.member_id and state = 'waiting';
    get diagnostics n = row_count;
    if n > 0 then
      select coalesce(jo.title, t.name),
             case when i.opening_id is not null then '/opportunities/' || i.opening_id::text
                  else '/teams/' || t.uuid::text end
        into first_title, first_link
        from public.opening_interests i
        left join public.job_openings jo on jo.id = i.opening_id
        left join public.teams t on t.team_id = i.team_id
       where i.member_id = new.member_id and i.state = 'ready'
       order by i.created_at limit 1;
      insert into public.notifications (member_id, type, title, subtitle, link)
      values (
        new.member_id, 'interest_ready',
        'You are in. Still want to join?',
        case when n > 1 then n::text || ' things you were interested in are waiting for you'
             else coalesce(first_title, 'Something you were interested in is waiting for you') end,
        first_link
      );
    end if;
  end if;
  return new;
end $$;
revoke all on function public.opening_interests_on_member_active() from public, anon, authenticated;

drop trigger if exists trg_opening_interests_on_member_active on public.members;
create trigger trg_opening_interests_on_member_active
  after update of status on public.members
  for each row execute function public.opening_interests_on_member_active();

-- ── One-off conversion of what pending members already filed ───────────────
insert into public.opening_interests (member_id, opening_id, message, custom_answers, state, from_application, origin, created_at)
select a.applicant_id, a.opening_id, a.message, a.custom_answers, 'waiting', true, to_jsonb(a), a.created_at
  from public.job_applications a
  join public.members m on m.member_id = a.applicant_id
 where m.status = 'pending_approval'
on conflict do nothing;

delete from public.job_applications a
 using public.members m
 where m.member_id = a.applicant_id and m.status = 'pending_approval'
   and exists (select 1 from public.opening_interests i where i.member_id = a.applicant_id and i.opening_id = a.opening_id);

insert into public.opening_interests (member_id, team_id, message, state, from_application, origin, created_at)
select r.member_id, r.team_id, r.message, 'waiting', true, to_jsonb(r), r.created_at
  from public.team_join_requests r
  join public.members m on m.member_id = r.member_id
 where m.status = 'pending_approval' and r.status = 'pending'
on conflict do nothing;

delete from public.team_join_requests r
 using public.members m
 where m.member_id = r.member_id and m.status = 'pending_approval' and r.status = 'pending'
   and exists (select 1 from public.opening_interests i where i.member_id = r.member_id and i.team_id = r.team_id);
