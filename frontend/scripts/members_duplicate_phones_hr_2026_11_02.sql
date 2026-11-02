-- ──────────────────────────────────────────────────────────────────────────
-- HR view of accounts that share a phone number (owner, 2 Nov 2026).
--
-- WHY: the one-account-per-phone rule only fires when a number is set or changed,
-- so 13 groups of existing members who already share a number were left alone
-- (members_phone_one_account_2026_11_01.sql). HR needs the list to contact them.
--
-- WHAT THIS ADDS: one SECURITY DEFINER function, get_duplicate_phone_groups().
--   * Gated INSIDE the function on is_super_admin(), which is true for exactly the
--     'hr' and 'super_admin' roles (active accounts only). Anyone else gets an
--     exception, not an empty set, so a probe cannot tell "no duplicates" apart
--     from "not allowed".
--   * Returns UNMASKED phone and email (owner decision 2026-11-02: HR and super
--     admin only, unmasked phones). This is the same audience that already reads
--     those columns through pending_member_approvals.
--   * Same "live account" rule as the trigger: status not in (deleted, rejected)
--     and deleted_at is null. Match key is members_phone_key() (last 10 digits).
--   * EXECUTE is revoked from public/anon and granted to authenticated only.
--   * NO table or column grant on members. The PII lockdown in CLAUDE.md is
--     untouched (expect 31 readable / 9 closed columns afterwards).
--
-- STATUS: APPLIED 2026-11-02 via the Supabase connector (migration name
-- members_duplicate_phones_hr). Verified live: anon cannot execute, authenticated can,
-- and the members column lockdown is unchanged (31 readable / 9 closed).
-- ──────────────────────────────────────────────────────────────────────────

create or replace function public.get_duplicate_phone_groups()
returns table (
  phone_key   text,
  member_id   integer,
  full_name   text,
  email       text,
  phone       text,
  status      text,
  class_grade text,
  created_at  timestamp
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_super_admin() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  return query
  select public.members_phone_key(m.phone) as phone_key,
         m.member_id,
         m.full_name::text,
         m.email::text,
         m.phone::text,
         m.status::text,
         m.class_grade::text,
         m.created_at
    from public.members m
   where public.members_phone_key(m.phone) is not null
     and coalesce(m.status::text, '') not in ('deleted', 'rejected')
     and m.deleted_at is null
     and public.members_phone_key(m.phone) in (
           select public.members_phone_key(x.phone)
             from public.members x
            where public.members_phone_key(x.phone) is not null
              and coalesce(x.status::text, '') not in ('deleted', 'rejected')
              and x.deleted_at is null
            group by 1
           having count(*) > 1
         )
   order by phone_key, (m.status::text = 'active') desc, m.created_at;
end;
$$;

revoke all on function public.get_duplicate_phone_groups() from public, anon;
grant execute on function public.get_duplicate_phone_groups() to authenticated;
