-- Adds a director-facing view of rejected membership applications, mirroring
-- pending_member_approvals (same security model: security_invoker=false so
-- it runs as the view owner, bypassing the authenticated role's column
-- grants on members.email/phone, with an explicit is_director()/
-- is_super_admin() gate baked into the view itself since the bypass alone
-- would otherwise let ANY authenticated caller read every row).
--
-- Account Approvals only ever showed the pending queue - there was no way
-- for a director to see who'd been rejected or why. This adds the read
-- path; rejecting still happens through directorService.rejectMember.
--
-- ✅ APPLIED live 2026-08-27 (via Supabase MCP).

create or replace view public.rejected_member_approvals
with (security_invoker = false)
as
select
  member_id,
  uuid,
  email,
  full_name,
  avatar_url,
  class_grade,
  phone,
  join_reason,
  rejection_note,
  created_at,
  updated_at
from public.members
where status = 'rejected'
  and (is_director() or is_super_admin())
order by updated_at desc;

revoke all on public.rejected_member_approvals from public, anon, authenticated;
grant select on public.rejected_member_approvals to authenticated;
