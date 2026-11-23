-- AQ Core: a list of core members, a badge on profiles and lists, and a public Core Team page.
-- Bug tracker 081395e9 (14 Nov 2026). Owner chose a public page (19 Nov 2026).
--
-- Its own table, not a column on `members`: `members` has column-by-column grants and a new
-- column starts with zero privileges (CLAUDE.md, "Verify the live schema"). This table holds
-- only member ids, which `anon` can already read on `members`, so it is readable by everyone.
-- Only HR and super admin (is_super_admin() covers both) may add or remove.
--
-- public_core_team(): name, photo and role for the Core Team page, masked exactly like
-- public_member_cards(): a hidden profile shows its photo only to a signed-in viewer.
--
-- core_add_by_emails(): the Google Sheet import. Emails are closed columns, so the match runs
-- server side. It returns only the emails the caller sent with what happened to each, never
-- another member's email. Matching is case-insensitive; one member is added at most once.
--
-- Applied live 19 Nov 2026 via the Supabase connector.

create table if not exists public.core_members (
  member_id integer primary key references public.members(member_id) on delete cascade,
  added_by  integer references public.members(member_id) on delete set null,
  added_at  timestamptz not null default now()
);

alter table public.core_members enable row level security;

drop policy if exists core_members_read on public.core_members;
create policy core_members_read on public.core_members for select to anon, authenticated using (true);
drop policy if exists core_members_insert on public.core_members;
create policy core_members_insert on public.core_members for insert to authenticated with check (is_super_admin());
drop policy if exists core_members_delete on public.core_members;
create policy core_members_delete on public.core_members for delete to authenticated using (is_super_admin());

revoke all on public.core_members from anon, authenticated;
grant select on public.core_members to anon, authenticated;
grant insert (member_id, added_by), delete on public.core_members to authenticated;

create or replace function public.public_core_team()
returns table(member_id integer, uuid uuid, full_name text, avatar_url text, role text)
language sql stable security definer set search_path = public, pg_temp
as $$
  select m.member_id, m.uuid, m.full_name,
         case when m.public_profile or auth.uid() is not null then m.avatar_url else null end,
         m.role
    from public.core_members c
    join public.members m on m.member_id = c.member_id
   where m.status = 'active' and m.deleted_at is null
   order by m.full_name
   limit 500;
$$;
revoke all on function public.public_core_team() from public;
grant execute on function public.public_core_team() to anon, authenticated;

create or replace function public.core_add_by_emails(p_emails text[])
returns table(email text, result text, full_name text)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_me integer;
  e text;
  v_ids integer[];
  v_name text;
begin
  if not is_super_admin() then
    raise exception 'only HR or super admin can change the core list' using errcode = '42501';
  end if;
  if coalesce(array_length(p_emails, 1), 0) > 1000 then
    raise exception 'at most 1000 emails at a time';
  end if;
  select m.member_id into v_me from public.members m where m.auth_uid = auth.uid();

  foreach e in array (select coalesce(array_agg(distinct lower(trim(x))), '{}') from unnest(p_emails) x where trim(x) <> '') loop
    select array_agg(m.member_id), min(m.full_name) into v_ids, v_name
      from public.members m
     where lower(m.email) = e and m.status = 'active' and m.deleted_at is null;
    if v_ids is null then
      email := e; result := 'not_found'; full_name := null; return next;
    elsif array_length(v_ids, 1) > 1 then
      email := e; result := 'ambiguous'; full_name := null; return next;
    elsif exists (select 1 from public.core_members c where c.member_id = v_ids[1]) then
      email := e; result := 'already'; full_name := v_name; return next;
    else
      insert into public.core_members (member_id, added_by) values (v_ids[1], v_me);
      email := e; result := 'added'; full_name := v_name; return next;
    end if;
  end loop;
end;
$$;
revoke all on function public.core_add_by_emails(text[]) from public;
revoke execute on function public.core_add_by_emails(text[]) from anon;
grant execute on function public.core_add_by_emails(text[]) to authenticated;
