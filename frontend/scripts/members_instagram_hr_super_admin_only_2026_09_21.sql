-- ============================================================================
-- Close members.instagram to everyone except hr/super_admin.
--
-- Applied live 2026-09-21 via the Supabase MCP connector (connected as
-- `postgres` this session). This file is the record, not the source of truth.
--
-- WHY
--
-- `members_social_links_2026_08_29.sql` added `instagram` and `linkedin` with
-- no column-level REVOKE, so they rode the table's default grant. Measured
-- 2026-09-21: `has_column_privilege('authenticated','members','instagram',
-- 'SELECT')` was TRUE, i.e. every signed-in account -- including a fresh
-- `pending_approval` row anyone can create in one click -- could read all 1,327
-- members' Instagram handles. phone/email/guardian_phone were already closed.
-- Owner's instruction: "kisi ko nai visible hona chahiye phone no. ya insta id
-- of members" -- only super admins.
--
-- This is the same shape as members_directory_phone_hr_super_admin_only_
-- 2026_09_12.sql, deliberately: instagram now sits in exactly the slot phone
-- already occupies, so there is one rule to reason about rather than two.
--
-- NOTE ON is_super_admin(): it matches role in ('super_admin','hr'), so "super
-- admin only" here means the hr+super_admin tier, matching the existing phone
-- gate and the SUPER_CEILING in lib/capabilities.ts.
--
-- THE COLUMN LIST IS LOAD-BEARING
--
-- `revoke select (instagram) ...`, never a bare `revoke select on members`.
-- A bare revoke removes the matching column privileges along with the table
-- one and would have stripped all 31 remaining column grants. See CLAUDE.md,
-- "REVOKE is a reset, not a narrowing", and memory members-grant-too-wide.
--
-- VERIFIED BY COUNT, NOT SPOT CHECK: readable/closed went 32/8 -> 31/9, so
-- exactly one column moved. `relacl` still shows authenticated=dDxtm (no
-- leading `r`), confirming no table-level SELECT was reintroduced.
--
-- NOT DONE, DELIBERATELY: `linkedin` is still readable by every authenticated
-- account (verified true 2026-09-21). The owner asked about Instagram and
-- phone specifically. LinkedIn is a public-by-nature professional profile, so
-- this is a judgement call left to them rather than assumed.
--
-- Own-row reads are unaffected: get_own_member() is SECURITY DEFINER and
-- returns every column, so a member's own profile and CV still show their
-- handle. Verified no other call site selects instagram off `members`.
-- ============================================================================

begin;

revoke select (instagram) on public.members from authenticated;
revoke select (instagram) on public.members from anon;

-- The directory view is SECURITY DEFINER (security_invoker = false), so it can
-- still read the revoked column and hands it out only to the right tier.
create or replace view public.member_directory_view as
 SELECT m.member_id, m.uuid, m.email, m.full_name, m.avatar_url, m.class_grade,
        CASE WHEN is_super_admin() THEN m.phone ELSE NULL::character varying END::character varying(20) AS phone,
        CASE WHEN is_super_admin() THEN m.instagram ELSE NULL::text END AS instagram,
    m.linkedin, s.name AS school_name, m.role, m.status, m.is_active, m.created_at,
        CASE m.role
            WHEN 'super_admin'::text THEN 0
            WHEN 'hr'::text THEN 0
            WHEN 'director'::text THEN 1
            WHEN 'hod'::text THEN 2
            WHEN 'lead'::text THEN 3
            ELSE 4
        END AS role_rank,
    m.break_end
   FROM members m
     LEFT JOIN schools s ON s.school_id = m.school_id
  WHERE is_director() OR is_super_admin();

-- create or replace view resets reloptions and re-applies the default ACL, so
-- both of these must be repeated here. See memory view-acl-inherits-default-grant.
alter view public.member_directory_view set (security_barrier = true);
revoke all on public.member_directory_view from public, anon, authenticated;
grant select on public.member_directory_view to authenticated;

commit;

-- Verification (expect 31 / 9, and false / false):
-- select count(*) filter (where has_column_privilege('authenticated','public.members',column_name,'SELECT')) as readable,
--        count(*) filter (where not has_column_privilege('authenticated','public.members',column_name,'SELECT')) as closed
--   from information_schema.columns where table_schema='public' and table_name='members';
-- select has_column_privilege('authenticated','public.members','instagram','SELECT'),
--        has_column_privilege('anon','public.members','instagram','SELECT');
