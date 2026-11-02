-- ──────────────────────────────────────────────────────────────────────────
-- HoD desk audit follow-ups, database half (owner answers, 2026-11-02).
--
-- STATUS: APPLIED 2026-11-02 via the Supabase connector (migration name
-- hod_desk_followups). Verified live with a rolled-back DO block: a pick saved for the
-- current month is stamped announced by the trigger; a pick for a future month stays
-- unannounced; one run of announce_member_of_month() produced exactly one notification,
-- one published post and one tag for a due pick and left the future one alone; a second run
-- announced 0; the cron job 'announce-member-of-month' exists (18:40 UTC = 00:10 IST);
-- log_action has the 5-argument form, anon cannot execute it, authenticated can, and the
-- 4-argument form is gone; community_audit_logs.entity_uuid exists; no past pick was left
-- unannounced by the back-fill.
--
-- 1) Member of the Month: a pick saved for a FUTURE month was never announced, because the
--    member notice and feed post happen only in the desk's save handler and only when the
--    month has already started. Now:
--      * member_of_the_month.announced_at records that a pick has been announced.
--      * Existing picks for this month or earlier are back-filled as announced (they were
--        announced at save time, or deliberately not); only queued future picks stay null.
--      * A BEFORE INSERT trigger stamps announced_at for a pick saved for the current or an
--        earlier month, because the desk announces those itself at once.
--      * announce_member_of_month() runs every day at 00:10 IST (pg_cron) and announces any
--        pick whose month has begun and has no announced_at: a 'system' notice to the member
--        and a published post under the AquaTerra org account, tagged to them, with the same
--        wording as the desk. One failing pick does not stop the others, and a pick is marked
--        announced only after its notice and post went in.
--
-- 2) can_pick_mom_for_team(): owner said "allow them" for a HoD who is on no team. Any ACTIVE
--    director or HoD may now pick for any team (the desk's original comment said exactly
--    this); HR and super admin as before. The insert and update policies still require the
--    nominee to be an active member of that team, and the period to be open unless the
--    picker is a super admin.
--
-- 3) community_audit_logs.entity_uuid: the id column is an integer, but job applications are
--    identified by uuid, so the audit row for an application pointed at the applicant
--    instead. A nullable uuid column holds the application id. log_action() gains an
--    optional p_entity_uuid; the old four-argument form is dropped so a call by name cannot
--    be ambiguous. All earlier hardening (active member, lowercase snake_case action,
--    4 KB details) is kept.
--
-- TO REVERSE: drop trigger mom_stamp_announced and function mom_stamp_announced(), unschedule
-- 'announce-member-of-month' and drop announce_member_of_month(), drop column announced_at,
-- restore can_pick_mom_for_team() from hod_desk_audit_fixes' earlier text (super admin OR an
-- active director/hod who is an active member of that team), and re-create the four-argument
-- log_action() from hod_desk_audit_fixes_2026_11_02.sql.
-- ──────────────────────────────────────────────────────────────────────────

-- 1) announce queued Member of the Month picks ---------------------------------
alter table public.member_of_the_month add column if not exists announced_at timestamptz;

update public.member_of_the_month
   set announced_at = coalesce(created_at, now())
 where announced_at is null
   and period <= (date_trunc('month', now() at time zone 'Asia/Kolkata'))::date;

create or replace function public.mom_stamp_announced()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.announced_at is null
     and new.period <= (date_trunc('month', now() at time zone 'Asia/Kolkata'))::date then
    new.announced_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists mom_stamp_announced on public.member_of_the_month;
create trigger mom_stamp_announced
  before insert on public.member_of_the_month
  for each row execute function public.mom_stamp_announced();

create or replace function public.announce_member_of_month()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r       record;
  v_org   integer;
  v_cat   text;
  v_body  text;
  v_post  integer;
  v_n     integer := 0;
  v_month date := (date_trunc('month', now() at time zone 'Asia/Kolkata'))::date;
begin
  select member_id into v_org from public.members where email = 'official@ngoaquaterra.com';

  for r in
    select p.id, p.period, p.member_id, p.citation,
           t.name as team_name, t.category as team_cat, m.full_name
      from public.member_of_the_month p
      join public.teams   t on t.team_id   = p.team_id
      join public.members m on m.member_id = p.member_id
     where p.announced_at is null
       and p.period <= v_month
       and m.status = 'active'
     order by p.period, p.id
       for update of p skip locked
  loop
    begin
      insert into public.notifications (member_id, type, title, subtitle, link)
      values (
        r.member_id, 'system',
        format('You’re %s’s member of the month for %s', r.team_name, to_char(r.period, 'FMMonth YYYY')),
        coalesce(nullif(r.citation, ''), 'Upload a photo from your profile to get your poster and post ready.'),
        '/profile/me'
      );

      if v_org is not null then
        v_cat  := case when r.team_cat in ('welfare', 'events', 'content', 'operations', 'labs') then r.team_cat else 'welfare' end;
        v_body := format('🏆 %s is %s’s member of the month for %s!', r.full_name, r.team_name, to_char(r.period, 'FMMonth YYYY'))
                  || case when nullif(r.citation, '') is not null then E'\n\n' || r.citation else '' end;

        insert into public.posts (author_id, category, body, status, stats)
        values (v_org, v_cat, v_body, 'published', '[]'::jsonb)
        returning post_id into v_post;

        insert into public.post_tags (post_id, tagged_member_id) values (v_post, r.member_id);
        insert into public.post_categories (post_id, category) values (v_post, v_cat) on conflict do nothing;
      end if;

      update public.member_of_the_month set announced_at = now() where id = r.id;
      v_n := v_n + 1;
    exception when others then
      raise warning 'announce_member_of_month: pick % failed: %', r.id, sqlerrm;
    end;
  end loop;

  return v_n;
end;
$$;

revoke all on function public.announce_member_of_month() from public, anon, authenticated;

select cron.schedule('announce-member-of-month', '40 18 * * *', 'select public.announce_member_of_month();');

-- 2) any active HoD or director may pick for any team -----------------------------
create or replace function public.can_pick_mom_for_team(p_team_id integer)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.is_super_admin()
    or exists (
      select 1
        from public.members m
       where m.auth_uid = auth.uid()
         and m.role in ('director', 'hod')
         and m.status = 'active'
    );
$$;

-- 3) audit rows can point at a uuid ------------------------------------------
alter table public.community_audit_logs add column if not exists entity_uuid uuid;

drop function if exists public.log_action(character varying, character varying, integer, jsonb);

create or replace function public.log_action(
  p_action      character varying,
  p_entity_type character varying default null,
  p_entity_id   integer default null,
  p_details     jsonb default null,
  p_entity_uuid uuid default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id integer;
begin
  select m.member_id into v_member_id
    from public.members m
   where m.auth_uid = auth.uid()
     and m.status = 'active'
     and m.deleted_at is null;

  if v_member_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_action is null or p_action !~ '^[a-z][a-z0-9_]{2,63}$' then
    raise exception 'invalid audit action';
  end if;
  if p_details is not null and pg_column_size(p_details) > 4096 then
    raise exception 'audit details too large';
  end if;

  insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details, entity_uuid)
  values (v_member_id, p_action, p_entity_type, p_entity_id, p_details, p_entity_uuid);
end;
$$;

revoke all on function public.log_action(character varying, character varying, integer, jsonb, uuid) from public, anon;
grant execute on function public.log_action(character varying, character varying, integer, jsonb, uuid) to authenticated;
