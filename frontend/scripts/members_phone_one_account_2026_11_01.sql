-- ──────────────────────────────────────────────────────────────────────────
-- One phone number = one account (owner, 2026-11-01).
--
-- WHY: a first-time Google sign-in IS the signup, so someone who signed up with
-- one email, then cannot log in with another, simply makes a second account
-- (same name, same phone, different email). There was nothing stopping it.
--
-- WHAT THIS ADDS (everything is SECURITY DEFINER because `authenticated` has no
-- SELECT on members.phone / members.email, see CLAUDE.md "Verify the live
-- schema"; none of it adds a column grant, and none of it grants the table):
--   1) members_phone_key(text)     the match key: the LAST 10 DIGITS, so +91 98300
--                                  12345, 09830012345 and 9830012345 are one number.
--   2) mask_email(text)            jo*******h@gmail.com. Local part masked, domain kept.
--   3) check_phone_available(text) RPC the registration form and profile forms call on
--                                  the phone step. Returns (taken, masked_email) to any
--                                  signed-in caller (owner decision 2026-11-01: everyone
--                                  gets the masked hint, so they can tell which email to
--                                  use). Residual risk: a signed-in account can probe
--                                  numbers and read back MASKED emails.
--   4) members_phone_unique        BEFORE INSERT/UPDATE OF phone trigger. The real
--                                  guard: raises 23505 'phone_already_registered' when
--                                  a phone is SET OR CHANGED to one another live account
--                                  has. Takes an advisory lock per number so two
--                                  simultaneous signups cannot both pass.
--
-- WHY A TRIGGER AND NOT A UNIQUE INDEX: at the time of writing 13 groups of
-- existing members (mostly active/active pairs) already share a number by
-- last-10-digits. A unique index cannot be built over them, and removing them is a
-- decision for HR. The trigger fires only when a phone is set or changed, so those
-- members keep working and can still edit every other field.
-- A row counts as "taken" unless status is 'deleted' or 'rejected' (owner decision: a rejected
-- account frees its number) or deleted_at is set.
--
-- THE 13 EXISTING DUPLICATE GROUPS ARE NOT TOUCHED. List them for HR with:
--   select right(regexp_replace(phone,'\D','','g'),10) k, count(*)
--     from members where phone is not null and phone <> ''
--    group by 1 having count(*) > 1;
--
-- STATUS: APPLIED 2026-11-01 via the Supabase connector (migration name
-- members_phone_one_account). Verified live: 4 functions, 1 trigger, 1 index; check_phone_available
-- executable by authenticated, not anon; members column lockdown unchanged (31 readable); a
-- rolled-back test update to another member's number raised phone_already_registered.
-- Nothing in the app calls the RPC yet (Step B in docs/HANDOFF_2026_11_01.md).
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.members_phone_key(p text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case when length(regexp_replace(coalesce(p, ''), '\D', '', 'g')) >= 10
              then right(regexp_replace(p, '\D', '', 'g'), 10)
              else null end
$$;

create or replace function public.mask_email(p text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p is null or position('@' in p) < 2 then null
    else (
      with parts as (select split_part(p, '@', 1) l, substr(p, position('@' in p)) d)
      select case
        when length(l) <= 3 then left(l, 1) || '***' || d
        else left(l, 2) || repeat('*', greatest(length(l) - 3, 3)) || right(l, 1) || d
      end from parts
    )
  end
$$;

create index if not exists members_phone_key_idx
  on public.members (public.members_phone_key(phone))
  where phone is not null;

create or replace function public.check_phone_available(p_phone text)
returns table (taken boolean, masked_email text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_key   text := public.members_phone_key(p_phone);
  v_email text;
  v_found boolean := false;
begin
  if v_uid is null or v_key is null then
    return query select false, null::text;
    return;
  end if;

  select m.email into v_email
    from public.members m
   where public.members_phone_key(m.phone) = v_key
     and m.auth_uid is distinct from v_uid
     and coalesce(m.status, '') not in ('deleted', 'rejected')
     and m.deleted_at is null
   order by (m.status = 'active') desc, m.created_at
   limit 1;
  v_found := found;

  return query select v_found, case when v_found then public.mask_email(v_email) end;
end;
$$;

create or replace function public.members_phone_unique()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_key text := public.members_phone_key(new.phone);
begin
  if v_key is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.phone is not distinct from old.phone then
    return new; -- not changing the number: never block (13 legacy duplicate groups)
  end if;
  if coalesce(new.status, '') in ('deleted', 'rejected') or new.deleted_at is not null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('members_phone:' || v_key));

  if exists (
    select 1 from public.members m
     where public.members_phone_key(m.phone) = v_key
       and m.member_id is distinct from new.member_id
       and coalesce(m.status, '') not in ('deleted', 'rejected')
       and m.deleted_at is null
  ) then
    raise exception 'phone_already_registered' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists members_phone_unique on public.members;
create trigger members_phone_unique
  before insert or update of phone on public.members
  for each row execute function public.members_phone_unique();

revoke all on function public.check_phone_available(text) from public, anon;
grant execute on function public.check_phone_available(text) to authenticated;
revoke all on function public.members_phone_unique() from public, anon, authenticated;
