-- ============================================================================
-- ✅ APPLIED live 2026-08-31
--
-- Fix: member_directory_view's role_rank CASE has no branch for 'lead', so a
-- member with role='lead' falls into the ELSE bucket at rank 3 - identical to
-- a plain 'member' - even though CLAUDE.md's stated role model puts lead
-- strictly above member (member < lead < hod/director < super_admin).
-- "Leadership first" sorting (director/MemberDirectory.tsx, sortBy='role')
-- silently doesn't put leads near the top.
--
-- Found 2026-08-30 while fixing a related, already-shipped bug: MemberDirectory.
-- tsx's local AQRole TS type omitted 'lead' even though members_role_check
-- permits it (member/lead/director/hod/super_admin) - that frontend fix is
-- already applied (widened AQRole, added the Lead badge/option/filter). This
-- migration is the DB-side sibling: the view's own rank ordering.
--
-- Currently zero live rows have role='lead' or role='director' (verified
-- 2026-08-30 via `select role, count(*) from members group by role` -> only
-- member/hod/super_admin appear), so this has no visible effect today - it's
-- a latent gap, not an active bug. Safe, in-place `create or replace view`;
-- view column list/order is unchanged, only the CASE branches inside
-- role_rank change, so no dependent code needs updating.
-- ============================================================================

create or replace view public.member_directory_view
with (security_invoker = true) as
select
  member_id,
  uuid,
  email,
  full_name,
  avatar_url,
  class_grade,
  role,
  status,
  created_at,
  case role
    when 'super_admin' then 0
    when 'director'    then 1
    when 'hod'          then 2
    when 'lead'         then 3
    else 4
  end as role_rank
from public.members m
where is_director() or is_super_admin();

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: 5 CASE branches now present (super_admin/director/hod/lead/else)
--   select pg_get_viewdef('public.member_directory_view'::regclass, true);
--
-- Expect: still security_invoker (RLS applies as the caller, not the view owner)
--   select relkind, reloptions from pg_class where relname = 'member_directory_view';
-- ============================================================================
