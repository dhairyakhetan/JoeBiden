-- ──────────────────────────────────────────────────────────────────────────
-- Community DB security hardening (hzowuwffjqtgszecngpe) — 2026-06.
-- APPLIED LIVE via Supabase migrations. Driven by the 32-agent full-site audit.
-- This file is the versioned record.
--
-- Closes three confirmed authorization holes (client uses only the anon key, so
-- RLS is the ONLY write gate):
--   C1 (CRITICAL) privilege escalation — any member could PATCH their own row's
--      role→'super_admin' / status→'active' (own-row UPDATE policy had no column
--      restriction; RLS WITH CHECK can't restrict columns).
--   C2 (CRITICAL) team authorization bypass — blanket auth.role()='authenticated'
--      write policies OR-ed alongside the granular self/lead/director policies, so
--      any signed-in member could manipulate any team / membership / join request.
--   H1 (HIGH) notification phishing — notifications INSERT only checked "is
--      authenticated", so a member could forge a notification to anyone with an
--      arbitrary title + external link (NotificationsPage navigates to link).
-- ──────────────────────────────────────────────────────────────────────────

-- C1 — guard privileged member columns with a BEFORE UPDATE trigger.
create or replace function public.members_guard_privileged_cols()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then return new; end if;          -- service role / direct SQL
  if is_director() or is_super_admin() then return new; end if;  -- authorized
  new.role        := old.role;
  new.status      := old.status;
  new.is_active   := old.is_active;
  new.approved_by := old.approved_by;
  new.approved_at := old.approved_at;
  return new;
end;
$$;
drop trigger if exists members_guard_privileged_cols on public.members;
create trigger members_guard_privileged_cols
  before update on public.members
  for each row execute function public.members_guard_privileged_cols();

-- C2 — drop blanket "authenticated" write policies (granular policies remain).
drop policy if exists "teams_auth_insert"   on public.teams;
drop policy if exists "teams_auth_update"   on public.teams;
drop policy if exists "team_members_write"  on public.team_members;
drop policy if exists "join_requests_write" on public.team_join_requests;
drop policy if exists "teams_read"          on public.teams;
drop policy if exists "team_members_read"   on public.team_members;
drop policy if exists "join_requests_read"  on public.team_join_requests;
-- keep team LEADs able to update their own team's members (was via the blanket).
drop policy if exists "Team leads can update their team members" on public.team_members;
create policy "Team leads can update their team members"
  on public.team_members for update
  using (
    is_director() or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id
        and tm.member_id = get_current_member_id()
        and (tm.role)::text = 'lead'
    )
  );

-- H1 — notification links must be app-internal (blocks external/phishing URLs).
-- NOT VALID: enforce on new writes without failing on any legacy row.
alter table public.notifications drop constraint if exists notifications_link_internal_only;
alter table public.notifications
  add constraint notifications_link_internal_only
  check (link is null or link like '/%') not valid;

-- ── REMAINING (tracked, not yet applied — need code changes / verification) ──
-- H2 (HIGH) PII: anon holds SELECT on members.email/phone and "Anyone can view
--   active members" exposes them. A blunt REVOKE breaks any anon select('*') on
--   members (e.g. PublicProfilePage) — must first switch public reads to explicit
--   non-PII columns (or a public-safe view), THEN:
--     REVOKE SELECT (email, phone) ON public.members FROM anon;
-- H1 full fix: move notification creation behind a SECURITY DEFINER RPC that
--   validates (actor, recipient, type) and REVOKE INSERT ON notifications FROM
--   authenticated, anon.
-- Storage: drop the broad SELECT policy 'post_documents bucket read' on
--   storage.objects so the public bucket can't be listed (object URLs still work).
-- Auth: enable leaked-password protection (Dashboard → Auth → Passwords).
