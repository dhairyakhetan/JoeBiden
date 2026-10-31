-- ============================================================================
-- role_capabilities — the permission toggle engine behind /director/roles
-- STATUS: **APPLIED** to the community project (hzowuwffjqtgszecngpe) on
--         2026-09-10 via the Supabase MCP connector, as migration
--         `role_capabilities_toggle_engine`. Verify live before trusting this
--         header; migration paper trails in this repo have drifted before.
-- ============================================================================
--
-- Replaces a page that only edited prose. `role_capability_notes` DESCRIBED
-- what a role could do; this table DECIDES it.
--
-- ── THE ONE RULE ────────────────────────────────────────────────────────────
-- A toggle can only ever NARROW access, never widen it:
--
--     effective(role, capability) = RLS_ceiling(role, capability)
--                                   AND matrix_enabled(role, capability)
--
-- RLS is the ceiling and remains the real boundary. The UI renders any cell
-- above a role's ceiling as LOCKED with the reason, rather than as a checkbox
-- that would silently do nothing — ticking "member can reach Approvals" would
-- be a lie, because the members policies would refuse the read regardless.
--
-- ── ABSENT ROW MEANS ENABLED ────────────────────────────────────────────────
-- A missing row reads as enabled, so an empty table reproduces exactly the
-- behaviour that existed before the engine shipped. Re-ticking a box DELETES
-- its row rather than storing `true`, so the table stays readable as a plain
-- list of deliberate restrictions and the whole engine reverts by emptying it.
--
-- ── THE LOCKOUT GUARD ───────────────────────────────────────────────────────
-- The CHECK constraint is the important line. Without it a super admin could
-- untick "super_admin -> Roles & Permissions" and permanently lose the only
-- screen able to tick it back on. super_admin is the top tier by definition and
-- is never restrictable — enforced by the database, not by remembering to
-- disable an input in React.

create table if not exists public.role_capabilities (
  capability_key text        not null,
  role           text        not null
                 check (role in ('member','lead','hod','director','hr','super_admin')),
  enabled        boolean     not null default true,
  updated_by     integer     references public.members(member_id) on delete set null,
  updated_at     timestamptz not null default now(),
  primary key (capability_key, role),
  constraint role_capabilities_super_admin_never_restricted
    check (not (role = 'super_admin' and enabled = false))
);

create index if not exists role_capabilities_role_idx on public.role_capabilities (role);
create index if not exists role_capabilities_updated_by_idx on public.role_capabilities (updated_by);

alter table public.role_capabilities enable row level security;

-- Every signed-in member reads the matrix: each needs to know which desks and
-- buttons to render for their own role. It holds no personal data.
drop policy if exists role_capabilities_select on public.role_capabilities;
create policy role_capabilities_select on public.role_capabilities
  for select to authenticated using (true);

-- Only the command desk writes. Split rather than FOR ALL, so this table does
-- not reintroduce the duplicate-permissive-policy problem fixed the same day.
drop policy if exists role_capabilities_insert on public.role_capabilities;
create policy role_capabilities_insert on public.role_capabilities
  for insert to authenticated with check (is_super_admin());

drop policy if exists role_capabilities_update on public.role_capabilities;
create policy role_capabilities_update on public.role_capabilities
  for update to authenticated using (is_super_admin()) with check (is_super_admin());

drop policy if exists role_capabilities_delete on public.role_capabilities;
create policy role_capabilities_delete on public.role_capabilities
  for delete to authenticated using (is_super_admin());

revoke all on public.role_capabilities from anon;

-- ── The database-side twin of the app's can() ──────────────────────────────
-- Lets an RLS policy consult the matrix directly, so a capability can be made
-- genuinely DB-enforced rather than app-enforced. Returns TRUE when no row
-- exists, matching the absent-row rule, so adding `and role_can('x')` to a
-- policy is a no-op until somebody unticks that box.
--
-- NOTE, so nobody assumes more than is true: as of this migration NO policy
-- calls this yet. The app-level engine (nav + route + action controls) is what
-- is live. This function exists so a specific capability can be promoted to a
-- hard database boundary without redesigning anything.
create or replace function public.role_can(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce(
    (select rc.enabled
       from public.role_capabilities rc
       join public.members m on m.auth_uid = (select auth.uid())
      where rc.capability_key = p_key
        and rc.role = m.role
      limit 1),
    true)
$$;

revoke all on function public.role_can(text) from anon;
grant execute on function public.role_can(text) to authenticated;

-- ── VERIFIED LIVE, by role simulation inside rolled-back transactions ───────
--   guard  restricting a non-super role         ALLOWED
--   guard  restricting super_admin              BLOCKED by the CHECK
--   guard  enabled=true row for super_admin     ALLOWED
--   fn     hod, no row                          role_can() = true
--   fn     hod, after disabling desk.posts      role_can() = false
--   fn     hod, an untouched capability         role_can() = true
--   fn     super_admin, same restriction        role_can() = true  (unaffected)
--   rls    hod writes a restriction             BLOCKED
--   rls    hod reads the matrix                 ALLOWED (needs it to gate own UI)
--   rls    super_admin writes a restriction     ALLOWED
--   rls    super_admin deletes it again         ALLOWED
--   rls    anon reads the matrix                BLOCKED
--
-- ── TO REVERT THE ENGINE TO STOCK PERMISSIONS ──────────────────────────────
--     delete from public.role_capabilities;
-- The app returns to exactly its pre-engine behaviour, because absent means
-- enabled. The UI's own "reset all to stock" button does the same thing.
-- ============================================================================
