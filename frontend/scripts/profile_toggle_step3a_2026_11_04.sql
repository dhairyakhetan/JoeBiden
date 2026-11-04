-- Profile visibility toggle, step 3a (docs/plans/profile-visibility-toggle.md). Owner chose "finish it carefully", 3 Nov 2026.
--
-- STATUS: see the line at the bottom of this block once applied.
--
-- Three masked readers for signed-out callers. Each is SECURITY DEFINER, read-only, and returns avatar_url, bio, class_grade and the
-- school as NULL when the member's profile is hidden (members.public_profile = false) AND the caller is signed out (auth.uid() is
-- null). A signed-in caller always gets the real values. Name, uuid, role and status are never masked: teams and projects keep
-- listing the member. Only ACTIVE members are returned. No email, phone, birthday or contact detail is returned, ever.
--
--   public_member_cards(uuid[])      name, photo and role for a list of members (used instead of embedding members(...) for anon)
--   get_public_member(uuid)          the public profile page: name, photo, bio, class, school, joined date
--   public_members_page(q, role, limit, offset)  the /members directory page, with the total count
--
-- Nothing here loosens a members grant. The anonymous column revoke (step 4) comes only after every anon read has moved here.
-- Rollback: drop function public.public_member_cards(uuid[]), public.get_public_member(uuid), public.public_members_page(text,text,int,int);

create or replace function public.public_member_cards(p_uuids uuid[])
returns table(member_id int, uuid uuid, full_name text, avatar_url text, role text)
language sql stable security definer set search_path = public, pg_temp as $$
  select m.member_id, m.uuid, m.full_name,
         case when m.public_profile or auth.uid() is not null then m.avatar_url else null end,
         m.role
    from public.members m
   where m.uuid = any(p_uuids) and m.status = 'active' and m.deleted_at is null
   limit 500;
$$;
revoke all on function public.public_member_cards(uuid[]) from public;
grant execute on function public.public_member_cards(uuid[]) to anon, authenticated;

create or replace function public.get_public_member(p_uuid uuid)
returns table(uuid uuid, full_name text, avatar_url text, bio text, class_grade text, role text, status text, created_at timestamptz,
              school_id int, school_uuid uuid, school_name text, school_short_name text, school_logo_url text, profile_hidden boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with v as (select (m.public_profile or auth.uid() is not null) as show, m.* from public.members m
              where m.uuid = p_uuid and m.deleted_at is null and m.status = 'active')
  select v.uuid, v.full_name,
         case when v.show then v.avatar_url end, case when v.show then v.bio end, case when v.show then v.class_grade end,
         v.role, v.status, v.created_at,
         case when v.show then v.school_id end, case when v.show then s.uuid end, case when v.show then s.name end,
         case when v.show then s.short_name end, case when v.show then s.logo_url end,
         not v.show
    from v left join public.schools s on s.school_id = v.school_id;
$$;
revoke all on function public.get_public_member(uuid) from public;
grant execute on function public.get_public_member(uuid) to anon, authenticated;

create or replace function public.public_members_page(p_q text, p_role text, p_limit int, p_offset int)
returns table(member_id int, uuid uuid, full_name text, avatar_url text, role text, created_at timestamptz, school_name text, total bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with f as (
    select m.*, (m.public_profile or auth.uid() is not null) as show
      from public.members m
     where m.status = 'active' and m.deleted_at is null
       and (nullif(trim(p_q), '') is null or m.full_name ilike '%' || replace(replace(trim(p_q), '%', ''), '_', '') || '%')
       and (p_role is null or p_role = 'all' or m.role = p_role)
  )
  select f.member_id, f.uuid, f.full_name, case when f.show then f.avatar_url end, f.role, f.created_at,
         case when f.show then s.name end, count(*) over ()
    from f left join public.schools s on s.school_id = f.school_id
   order by f.created_at desc, f.member_id asc
   limit least(coalesce(p_limit, 24), 100) offset greatest(coalesce(p_offset, 0), 0);
$$;
revoke all on function public.public_members_page(text, text, int, int) from public;
grant execute on function public.public_members_page(text, text, int, int) to anon, authenticated;

-- STATUS: APPLIED 4 Nov 2026 (migration profile_toggle_step3a_masked_readers_20261104). Rolled-back test with one profile hidden:
-- signed out: get_public_member returns the row with photo, bio, class and school all empty and profile_hidden true; public_member_cards
-- and public_members_page return no photo or school; signed in: the same calls return the real photo, bio and school.
--
-- Step 3b, also applied 4 Nov 2026 (migrations profile_toggle_step3b_school_members_20261104 and ..._hide_20261104):
-- public_school_members(school_uuid, limit, offset) for the school pages. A hidden profile is left out of its school's list for a
-- signed-out visitor, because listing it there would reveal the school.
-- The front end moved to these in the same change: profile page, /members, team pages (team, roster, sub-team, previews), school
-- member lists, comment authors, Member of the Month lists. Step 4 (the anonymous column revoke) is NOT done.
