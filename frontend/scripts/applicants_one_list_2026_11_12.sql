-- Applicants: one list per opening (owner request, 12 Nov 2026).
--
-- STATUS: APPLIED 12 Nov 2026 via the Supabase connector as applicants_one_list_20261112_functions, then _type_fix (casts
-- varchar to text: the first version failed its rolled-back test, "structure of query does not match function result type"),
-- then _backfill (16 applications converted, 0 skipped). The file below carries the corrected function bodies.
-- Tested in rolled-back blocks: guest_apply_submit returns invalid, closed, not_member, linked, already and writes the row with
-- linked_by = 'phone' plus one notification to the member and the team's leaders; the approval trigger turns a waiting application
-- into a real one (interest -> applied, team and member notified); team_waiting_applicants gives HR 10, an HoD 10 and a plain
-- member 0 rows, and HR sees one fewer after the approval.
--
-- The rule, in the owner's words:
--   * A signed-out visitor applying for a role gives name and number only (no email).
--   * If the number belongs to ONE active AquaTerra account, the application is linked to that account
--     straight away and the team gets it. Nothing is asked of the visitor.
--   * If it does not, the visitor signs in; their form is kept; the application waits for HR.
--   * The team sees BOTH kinds in one list for the opening: cleared applicants they can act on, and
--     "waiting for HR" applicants they can see but cannot accept. When HR approves the account, the waiting
--     application moves to the team's list on its own.
--
-- What this adds:
--   1. job_applications.linked_by ('account' = signed in, 'phone' = linked by number, not signed in) and
--      typed_name (what the visitor typed, kept beside the account's own name).
--   2. guest_apply_submit(opening, name, phone, message, answers): anon + authenticated, rate limited with the
--      same attempts table as guest_apply_match. Links only when EXACTLY ONE active account has the number.
--      Returns invalid | limited | closed | not_member | already | linked. Tells the account owner and the team.
--      A match is not proof of identity, so the row is marked linked_by = 'phone' and the member is told.
--   3. opening_interests_on_member_active(): when HR approves an account, every waiting APPLICATION
--      (from_application, role still open) becomes a real job_applications row, the interest is marked applied,
--      the team and the member are told. Plain "remind me" interests still become 'ready' as before.
--   4. team_waiting_applicants(opening): SECURITY DEFINER list for HoDs, directors, team leads of that opening,
--      HR and super admin. Name, class, note and answers only: never a phone or an email.
--   5. Backfill: approved members whose application was parked as 'ready' are converted to real applications now.
--      Old rows are kept in applicant_one_list_backup_20261112.
--
-- No change to the members PII lockdown, and no table-level grants: everything goes through definer functions.
-- Rollback: drop the two new functions, restore opening_interests_on_member_active() from
-- scripts/opening_interests_2026_11_02.sql, drop the two columns, and set the interests listed in the backup table
-- back to state = 'ready' (the applications created by the backfill have linked_by = 'account' and ids in the backup's
-- converted_application_id column).

begin;

-- 1. columns -------------------------------------------------------------------------------------------------------
alter table public.job_applications
  add column if not exists linked_by text not null default 'account',
  add column if not exists typed_name text;

alter table public.job_applications
  drop constraint if exists job_applications_linked_by_check;
alter table public.job_applications
  add constraint job_applications_linked_by_check check (linked_by in ('account', 'phone'));

-- 2. signed-out apply, linked by number -----------------------------------------------------------------------------
create or replace function public.guest_apply_submit(
  p_opening_id uuid, p_name text, p_phone text, p_message text, p_answers jsonb
) returns table(outcome text, opening_title text)
language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  v_key   text := public.members_phone_key(p_phone);
  v_name  text := left(trim(coalesce(p_name, '')), 120);
  v_ans   jsonb := coalesce(p_answers, '{}'::jsonb);
  v_ip    text;
  v_ipb   text;
  v_phb   text;
  v_op    record;
  v_m     record;
  v_cnt   int;
  v_app   uuid;
  v_lead  int;
  v_title text;
begin
  if v_key is null or length(v_name) < 2 or jsonb_typeof(v_ans) <> 'object' or pg_column_size(v_ans) > 20000 then
    return query select 'invalid'::text, null::text; return;
  end if;

  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true)::json)->>'x-forwarded-for', ''), ',', 1);
  exception when others then v_ip := '';
  end;
  v_ipb := 'sub-ip:' || md5(coalesce(nullif(trim(v_ip), ''), 'unknown'));
  v_phb := 'sub-ph:' || md5(v_key);
  if (select count(*) from public.guest_match_attempts where bucket = v_ipb and at > now() - interval '10 minutes') >= 15
     or (select count(*) from public.guest_match_attempts where bucket = v_phb and at > now() - interval '1 hour') >= 4 then
    return query select 'limited'::text, null::text; return;
  end if;
  insert into public.guest_match_attempts (bucket) values (v_ipb), (v_phb);

  select jo.id, jo.title::text as title, jo.team_id, jo.status, jo.deleted_at into v_op
    from public.job_openings jo where jo.id = p_opening_id;
  if not found or v_op.deleted_at is not null or v_op.status <> 'open' then
    return query select 'closed'::text, null::text; return;
  end if;
  v_title := v_op.title;

  select count(*) into v_cnt from public.members m
   where public.members_phone_key(m.phone) = v_key and m.status = 'active' and m.deleted_at is null;
  if v_cnt <> 1 then
    return query select 'not_member'::text, v_title; return;
  end if;

  select m.member_id, m.full_name, m.email, m.phone into v_m from public.members m
   where public.members_phone_key(m.phone) = v_key and m.status = 'active' and m.deleted_at is null;

  if exists (select 1 from public.job_applications a where a.opening_id = p_opening_id and a.applicant_id = v_m.member_id) then
    return query select 'already'::text, v_title; return;
  end if;

  insert into public.job_applications
    (opening_id, applicant_id, applicant_name, applicant_email, applicant_phone, message, custom_answers, linked_by, typed_name)
  values
    (p_opening_id, v_m.member_id, v_m.full_name, v_m.email, v_m.phone, nullif(left(trim(coalesce(p_message, '')), 2000), ''), v_ans, 'phone', v_name)
  returning id into v_app;

  -- Linking by number is not proof it was them, so the owner of the account is told, and the team sees the mark.
  insert into public.notifications (member_id, type, title, subtitle, link)
  values (v_m.member_id, 'interest_ready', 'An application was sent in your name',
          'For ' || v_title || ', using your number. If this was not you, tell HR.', '/opportunities/' || p_opening_id::text);

  if v_op.team_id is not null then
    for v_lead in select * from public.team_leader_ids(v_op.team_id) loop
      if v_lead <> v_m.member_id then
        insert into public.notifications (member_id, type, title, subtitle, link)
        values (v_lead, 'team_join_request', v_m.full_name || ' applied for ' || v_title,
                'Linked by phone number, not signed in. Check before you accept.', '/director/hiring');
      end if;
    end loop;
  end if;

  return query select 'linked'::text, v_title;
end;
$fn$;

revoke all on function public.guest_apply_submit(uuid, text, text, text, jsonb) from public;
grant execute on function public.guest_apply_submit(uuid, text, text, text, jsonb) to anon, authenticated;

-- 3. HR approves the account -> the waiting application goes to the team ---------------------------------------------
create or replace function public.opening_interests_on_member_active()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $fn$
declare
  n int; sent int := 0; first_title text; first_link text; r record; v_lead int;
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    -- a. real applications that were waiting for HR become applications the team can act on
    for r in
      with ins as (
        insert into public.job_applications
          (opening_id, applicant_id, applicant_name, applicant_email, applicant_phone, message, custom_answers, linked_by)
        select i.opening_id, new.member_id, new.full_name, new.email, new.phone, i.message, i.custom_answers, 'account'
          from public.opening_interests i
          join public.job_openings jo on jo.id = i.opening_id
         where i.member_id = new.member_id and i.state = 'waiting' and i.from_application
           and i.opening_id is not null and jo.deleted_at is null and jo.status = 'open'
        on conflict (opening_id, applicant_id) do nothing
        returning opening_id
      )
      select ins.opening_id, jo.title, jo.team_id from ins join public.job_openings jo on jo.id = ins.opening_id
    loop
      sent := sent + 1;
      if first_title is null then first_title := r.title; end if;
      if r.team_id is not null then
        for v_lead in select * from public.team_leader_ids(r.team_id) loop
          if v_lead <> new.member_id then
            insert into public.notifications (member_id, type, title, subtitle, link)
            values (v_lead, 'team_join_request', new.full_name || ' applied for ' || r.title,
                    'HR has approved them. The application is ready for you.', '/director/hiring');
          end if;
        end loop;
      end if;
    end loop;

    update public.opening_interests i set state = 'applied'
     where i.member_id = new.member_id and i.state = 'waiting' and i.from_application and i.opening_id is not null
       and exists (select 1 from public.job_applications a where a.applicant_id = new.member_id and a.opening_id = i.opening_id);

    if sent > 0 then
      insert into public.notifications (member_id, type, title, subtitle, link)
      values (new.member_id, 'interest_ready', 'You are in. Your application is with the team',
              case when sent > 1 then sent::text || ' applications went to their teams' else coalesce(first_title, 'The team will reach out') end,
              '/opportunities');
    end if;

    -- b. everything else they were interested in keeps the old "still want to?" step
    update public.opening_interests set state = 'ready', ready_at = now()
     where member_id = new.member_id and state = 'waiting';
    get diagnostics n = row_count;
    if n > 0 then
      select coalesce(jo.title, t.name),
             case when i.opening_id is not null then '/opportunities/' || i.opening_id::text else '/teams/' || t.uuid::text end
        into first_title, first_link
        from public.opening_interests i
        left join public.job_openings jo on jo.id = i.opening_id
        left join public.teams t on t.team_id = i.team_id
       where i.member_id = new.member_id and i.state = 'ready'
       order by i.created_at limit 1;
      insert into public.notifications (member_id, type, title, subtitle, link)
      values (new.member_id, 'interest_ready', 'You are in. Still want to join?',
              case when n > 1 then n::text || ' things you were interested in are waiting for you'
                   else coalesce(first_title, 'Something you were interested in is waiting for you') end,
              first_link);
    end if;
  end if;
  return new;
end $fn$;

-- 4. what a team sees of the people HR has not cleared yet -----------------------------------------------------------
create or replace function public.team_waiting_applicants(p_opening_id uuid default null)
returns table(
  interest_id uuid, member_id int, opening_id uuid, opening_title text, team_name text,
  full_name text, class_grade text, message text, custom_answers jsonb, applied_at timestamptz, can_approve boolean
)
language sql stable security definer set search_path = public, pg_temp
as $fn$
  select i.id, i.member_id, i.opening_id, jo.title::text, jo.team_name::text,
         m.full_name::text, m.class_grade::text, i.message, i.custom_answers, i.created_at, public.is_super_admin()
    from public.opening_interests i
    join public.job_openings jo on jo.id = i.opening_id
    join public.members m on m.member_id = i.member_id
   where i.state = 'waiting' and i.from_application and jo.deleted_at is null
     and m.status = 'pending_approval' and m.deleted_at is null
     and (p_opening_id is null or i.opening_id = p_opening_id)
     and (public.is_super_admin() or public.is_director() or public.is_team_lead(jo.team_id))
   order by i.created_at desc
$fn$;

revoke all on function public.team_waiting_applicants(uuid) from public;
grant execute on function public.team_waiting_applicants(uuid) to authenticated;

-- 5. backfill: approved members whose application was parked as 'ready' -------------------------------------------
create table if not exists public.applicant_one_list_backup_20261112 (
  interest_id uuid primary key, member_id int, opening_id uuid, state text, message text, custom_answers jsonb,
  created_at timestamptz, converted_application_id uuid, backed_up_at timestamptz not null default now()
);
alter table public.applicant_one_list_backup_20261112 enable row level security;  -- no policy: service role only

insert into public.applicant_one_list_backup_20261112 (interest_id, member_id, opening_id, state, message, custom_answers, created_at)
select i.id, i.member_id, i.opening_id, i.state, i.message, i.custom_answers, i.created_at
  from public.opening_interests i
  join public.members m on m.member_id = i.member_id and m.status = 'active' and m.deleted_at is null
  join public.job_openings jo on jo.id = i.opening_id and jo.deleted_at is null and jo.status = 'open'
 where i.state = 'ready' and i.from_application and i.opening_id is not null
on conflict (interest_id) do nothing;

do $bf$
declare r record; v_app uuid; v_lead int;
begin
  for r in
    select b.interest_id, i.member_id, i.opening_id, i.message, i.custom_answers,
           m.full_name, m.email, m.phone, jo.title, jo.team_id
      from public.applicant_one_list_backup_20261112 b
      join public.opening_interests i on i.id = b.interest_id and i.state = 'ready'
      join public.members m on m.member_id = i.member_id
      join public.job_openings jo on jo.id = i.opening_id
     where b.converted_application_id is null
  loop
    insert into public.job_applications (opening_id, applicant_id, applicant_name, applicant_email, applicant_phone, message, custom_answers, linked_by)
    values (r.opening_id, r.member_id, r.full_name, r.email, r.phone, r.message, r.custom_answers, 'account')
    on conflict (opening_id, applicant_id) do nothing
    returning id into v_app;

    if v_app is null then
      select a.id into v_app from public.job_applications a where a.opening_id = r.opening_id and a.applicant_id = r.member_id;
    else
      if r.team_id is not null then
        for v_lead in select * from public.team_leader_ids(r.team_id) loop
          if v_lead <> r.member_id then
            insert into public.notifications (member_id, type, title, subtitle, link)
            values (v_lead, 'team_join_request', r.full_name || ' applied for ' || r.title,
                    'HR had approved them. The application is ready for you.', '/director/hiring');
          end if;
        end loop;
      end if;
      insert into public.notifications (member_id, type, title, subtitle, link)
      values (r.member_id, 'interest_ready', 'Your application is with the team', r.title, '/opportunities');
    end if;

    update public.opening_interests set state = 'applied' where id = r.interest_id;
    update public.applicant_one_list_backup_20261112 set converted_application_id = v_app where interest_id = r.interest_id;
    v_app := null;
  end loop;
end $bf$;

commit;
