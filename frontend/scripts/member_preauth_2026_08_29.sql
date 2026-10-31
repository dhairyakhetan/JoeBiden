-- ============================================================================
-- ✅ APPLIED live 2026-08-30 (via Supabase MCP). Verified: 4 policies, all
-- director/super_admin-only, zero plain-authenticated grants;
-- claim_member_preauth() is SECURITY DEFINER, executable by authenticated
-- only. NOTE: frontend wiring (calling this from the signup flow) is still
-- a follow-up — the table/function are live but nothing calls them yet.
--
-- Member pre-authorization.
-- Per the Aug 2026 redesign handoff, member surfaces spec.
--
-- WHY: HR/leadership import a list of people who are already known to be
-- joining (with an intended team + role decided in advance, e.g. from an
-- offline recruitment drive), BEFORE those people ever sign in with Google.
-- member_preauth is that waiting list: a row keyed by email, matched against
-- a real members row once that person actually authenticates for the first
-- time.
--
-- WHERE THIS FITS the existing signup funnel (see community_auth_member_
-- bootstrap_2026_06.sql — do not re-read that file as needing changes, it
-- is unmodified by this migration): first Google sign-in -> AuthContext.
-- fetchMember finds no members row -> calls ensure_member() (SECURITY
-- DEFINER) -> members row created as pending_approval -> /register ->
-- /pending -> director approves via directorService.approveMember. This
-- migration adds a NEW, separate SECURITY DEFINER function,
-- claim_member_preauth(), rather than editing ensure_member() itself —
-- ensure_member() only knows how to create a bare pending row from
-- auth.users metadata, and folding preauth-matching into it would couple
-- two independently-useful pieces of logic. claim_member_preauth() is meant
-- to be called by the frontend as a second step right after ensure_member()
-- succeeds (e.g. from AuthContext or the /register flow) — wiring that call
-- in is a follow-up FRONTEND change, out of scope for this DB-only
-- migration. Until that wiring lands, this table/function are inert:
-- created, but nothing calls claim_member_preauth() yet.
--
-- RLS: this table holds no PII beyond an email address, and per spec is NOT
-- exposed to plain `authenticated` SELECT at all — a signed-in member has no
-- business browsing the pre-authorization waiting list, including their own
-- entry (they'll find out they're preauthorized when claim_member_preauth()
-- silently applies it). The only two access paths are:
--   1. directors/HR: full SELECT/INSERT/UPDATE/DELETE, for managing imports
--      and intended team/role assignments, gated the standard way with
--      is_director()/is_super_admin() — no raw members subquery.
--   2. the signup flow: via claim_member_preauth(), a SECURITY DEFINER
--      function that runs as the function owner and so is NOT subject to
--      this table's RLS at all. It resolves the CALLER's own member row via
--      auth.uid() internally (exactly like ensure_member() does) — it does
--      NOT take a member_id parameter from the client, specifically so one
--      signed-in member can never pass someone else's member_id and claim
--      their preauth slot.
-- ============================================================================

create table if not exists public.member_preauth (
  id                     integer generated always as identity primary key,
  email                  text not null unique,
  intended_team_id       integer references public.teams(team_id) on delete set null,
  intended_position      text,
  import_batch           text,
  claimed_at             timestamptz,
  claimed_by_member_id   integer references public.members(member_id) on delete set null,
  created_at             timestamptz not null default now(),
  constraint member_preauth_email_lowercase check (email = lower(email))
);

comment on table public.member_preauth is
  'Waiting list matched against members by email on first sign-in. Not exposed to plain `authenticated` SELECT — read/written by directors/HR directly, or by the signup flow exclusively through claim_member_preauth() (SECURITY DEFINER, resolves the caller''s own member row internally, never client-supplied).';

comment on column public.member_preauth.email is
  'Normalised/lowercased match key — enforced by the email = lower(email) check constraint. Insert already-lowercased values.';

comment on column public.member_preauth.intended_position is
  'Free text (e.g. Member/Manager/HOD) that becomes team_members.role on claim. Not constrained to an enum here since team_members.role itself is a free-text column with no check constraint in the live schema.';

create index if not exists idx_member_preauth_intended_team_id on public.member_preauth(intended_team_id);

alter table public.member_preauth enable row level security;

drop policy if exists "member_preauth_leaders_select" on public.member_preauth;
create policy "member_preauth_leaders_select"
  on public.member_preauth for select
  using (public.is_director() or public.is_super_admin());

drop policy if exists "member_preauth_leaders_insert" on public.member_preauth;
create policy "member_preauth_leaders_insert"
  on public.member_preauth for insert
  with check (public.is_director() or public.is_super_admin());

drop policy if exists "member_preauth_leaders_update" on public.member_preauth;
create policy "member_preauth_leaders_update"
  on public.member_preauth for update
  using (public.is_director() or public.is_super_admin())
  with check (public.is_director() or public.is_super_admin());

drop policy if exists "member_preauth_leaders_delete" on public.member_preauth;
create policy "member_preauth_leaders_delete"
  on public.member_preauth for delete
  using (public.is_director() or public.is_super_admin());

-- Deliberately no policy grants plain `authenticated` SELECT/INSERT/UPDATE —
-- with RLS enabled and no matching policy, those commands are refused for
-- everyone except the table owner/service role and SECURITY DEFINER
-- functions like the one below.

-- ── claim function: called by the signup flow, alongside ensure_member() ───
create or replace function public.claim_member_preauth()
returns table(intended_team_id integer, intended_position text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_member_id integer;
  v_email     text;
  v_row       public.member_preauth%rowtype;
begin
  select member_id, email into v_member_id, v_email
  from public.members
  where auth_uid = auth.uid();

  if v_member_id is null then
    return; -- no members row yet (ensure_member() should run first)
  end if;

  select * into v_row
  from public.member_preauth
  where email = lower(trim(v_email))
    and claimed_at is null
  limit 1;

  if v_row.id is null then
    return; -- no matching, unclaimed preauth row
  end if;

  update public.member_preauth
     set claimed_at = now(),
         claimed_by_member_id = v_member_id
   where id = v_row.id;

  intended_team_id := v_row.intended_team_id;
  intended_position := v_row.intended_position;
  return next;
end;
$$;

comment on function public.claim_member_preauth() is
  'SECURITY DEFINER. Matches the CALLING member''s own email (resolved via auth.uid(), never a parameter) against an unclaimed member_preauth row, marks it claimed, and returns the intended team/position for the caller to act on. Frontend wiring (calling this after ensure_member() in the signup flow, and using the result to seed team_members) is a follow-up outside this migration.';

revoke all on function public.claim_member_preauth() from public, anon;
grant execute on function public.claim_member_preauth() to authenticated;

-- ============================================================================
-- VERIFICATION — run after applying. Every line should report OK.
-- ============================================================================
-- Expect: table exists, RLS enabled
--   select relrowsecurity from pg_class where relname = 'member_preauth';
--
-- Expect: exactly 4 policies, all director/super_admin only, ZERO granting
-- plain authenticated SELECT
--   select policyname, cmd, qual, with_check from pg_policies
--    where tablename = 'member_preauth';
--
-- Expect: no grant to anon/authenticated beyond RLS (base table privileges)
--   select grantee, privilege_type from information_schema.table_privileges
--    where table_name = 'member_preauth';
--
-- Expect: claim_member_preauth is SECURITY DEFINER, executable by
-- authenticated only (not anon, not public)
--   select prosecdef from pg_proc where proname = 'claim_member_preauth';
--   select grantee, privilege_type from information_schema.routine_privileges
--    where routine_name = 'claim_member_preauth';
--
-- Expect: email uniqueness + lowercase constraint both present
--   select conname from pg_constraint
--    where conrelid = 'public.member_preauth'::regclass
--      and conname in ('member_preauth_email_key', 'member_preauth_email_lowercase');
