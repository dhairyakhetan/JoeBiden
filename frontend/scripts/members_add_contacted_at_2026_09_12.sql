-- APPLIED LIVE 2026-09-12 via Supabase MCP (migration name: members_add_contacted_at)
--
-- "Contacted" tracking for the Approvals desk (owner request): HR wants to
-- mark that they reached out to confirm a pending applicant's membership
-- before actually approving/rejecting them, and split the queue into
-- pending (not yet contacted) / contacted (reached out, still undecided) /
-- all, alongside the existing rejected tab.
--
-- `contacted_at` is a plain nullable timestamp on `members`, set once and
-- never required to be cleared (once a row leaves 'pending_approval' via
-- approve/reject it drops out of `pending_member_approvals` entirely, so a
-- stale contacted_at on an already-decided member is moot). No RLS/trigger
-- change needed: `members_guard_privileged_cols()` only guards
-- role/status/is_active/approved_by/approved_at, and the existing
-- `members_update` policy (is_director() OR self OR is_team_lead_of_member())
-- already lets HR/super_admin (is_director() covers 'hr' too - see its own
-- definition) write it - this page is already gated super_admin/HR-only in
-- AccountApprovals.tsx.
--
-- Per the PII-lockdown lesson (CLAUDE.md: "a newly added column on members
-- starts with ZERO privileges") the column needs its own explicit grant -
-- verified live afterwards via:
--   select grantee, privilege_type from information_schema.column_privileges
--    where table_name='members' and column_name='contacted_at';
--
-- `pending_member_approvals` is a view with an explicit column list (not
-- `select *`), so it needed the same column added explicitly, appended at
-- the end (Postgres refuses to insert a view column in the middle without
-- an ALTER VIEW ... RENAME COLUMN dance).
alter table public.members add column if not exists contacted_at timestamptz null;

grant select (contacted_at) on public.members to authenticated;
grant update (contacted_at) on public.members to authenticated;

create or replace view public.pending_member_approvals as
 select member_id,
    uuid,
    email,
    full_name,
    avatar_url,
    class_grade,
    phone,
    join_reason,
    bio,
    created_at,
    contacted_at
   from members
  where status::text = 'pending_approval'::text and is_active = true and (is_director() or is_super_admin());
