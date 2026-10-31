-- ============================================================================
-- team_members -> community_audit_logs, by trigger — 2026-09-11
-- STATUS: **APPLIED** to the community project (hzowuwffjqtgszecngpe) via the
--         Supabase MCP connector as migration `log_team_membership_changes`.
--         Verify live before trusting this header; paper trails in this repo
--         have drifted before.
-- ============================================================================
--
-- WHY
--
-- Walkthrough item 7.1: "accepting a job applicant auto-adds them to the team,
-- and logs it." The roster half already shipped - lib/jobOpenings.ts upserts a
-- `team_members` row on accept, awaited, duplicate-safe. The LOGGING half did
-- not exist anywhere, and could not have:
--
--     select policyname, cmd from pg_policies where tablename='community_audit_logs';
--     -- "Super admin can view audit logs" | SELECT
--
-- One policy. A SELECT. RLS is on. There is no INSERT policy, so no browser
-- client can write an audit row at all, which is why grepping the frontend for
-- `community_audit_logs` returns only generated types.
--
-- WHY A TRIGGER RATHER THAN A SERVICE CALL
--
--   1. There is no client write path to add one to, and opening one (an INSERT
--      policy on an audit table) would let any signed-in member forge rows.
--   2. `team_members` is written from at least four places: hiring acceptance,
--      the team's Members tab, bulk add, and join-request approval. A trigger
--      cannot be the one path somebody forgets to instrument.
--   3. An audit log should record what HAPPENED. A trigger only fires on a row
--      that actually committed; a service call fires on what the app intended.
--
-- WHAT IS AND IS NOT LOGGED
--
-- Logged: INSERT (TEAM_MEMBER_ADDED), is_active flipping either way
-- (TEAM_MEMBER_REMOVED / _RESTORED - this schema soft-deletes), role changes
-- (_ROLE_CHANGED: "who made me a lead" is exactly what an audit log is for),
-- sub_team changes (_SUBTEAM_CHANGED), and hard DELETE (_DELETED).
-- Not logged: anything else, e.g. a touched timestamp. That is noise.
--
-- `member_id` on the log row is the ACTOR, not the person added. It is NULL
-- when the write has no JWT behind it (SQL editor, service-role job). That is
-- deliberate: we genuinely do not know who that was, and recording nobody is
-- more honest than recording the subject as though they added themselves.
-- `details.self_serve` marks the case where actor and subject really are the
-- same person.
--
-- The action names follow the existing uppercase TEAM_* convention already in
-- the table (TEAM_CREATED, TEAM_MEMBERS_BULK_ADDED), not the lowercase
-- member_approved / post_deleted convention. The table has both; these are
-- team actions.

create or replace function public.log_team_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  actor integer;
begin
  begin
    actor := public.get_current_member_id();
  exception when others then
    actor := null;
  end;

  if tg_op = 'INSERT' then
    insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details)
    values (actor, 'TEAM_MEMBER_ADDED', 'team_members', new.team_id,
            jsonb_build_object(
              'member_id', new.member_id,
              'team_role', new.role,
              'sub_team', new.sub_team,
              'is_active', new.is_active,
              'self_serve', actor is not null and actor = new.member_id));
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.is_active is distinct from old.is_active then
      insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details)
      values (actor,
              case when new.is_active then 'TEAM_MEMBER_RESTORED' else 'TEAM_MEMBER_REMOVED' end,
              'team_members', new.team_id,
              jsonb_build_object('member_id', new.member_id, 'team_role', new.role));
    elsif new.role is distinct from old.role then
      insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details)
      values (actor, 'TEAM_MEMBER_ROLE_CHANGED', 'team_members', new.team_id,
              jsonb_build_object('member_id', new.member_id, 'from', old.role, 'to', new.role));
    elsif new.sub_team is distinct from old.sub_team then
      insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details)
      values (actor, 'TEAM_MEMBER_SUBTEAM_CHANGED', 'team_members', new.team_id,
              jsonb_build_object('member_id', new.member_id, 'from', old.sub_team, 'to', new.sub_team));
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.community_audit_logs (member_id, action, entity_type, entity_id, details)
    values (actor, 'TEAM_MEMBER_DELETED', 'team_members', old.team_id,
            jsonb_build_object('member_id', old.member_id, 'team_role', old.role));
    return old;
  end if;

  return null;
end $$;

revoke all on function public.log_team_membership_change() from public, anon, authenticated;

drop trigger if exists team_membership_audit_log on public.team_members;
create trigger team_membership_audit_log
  after insert or update or delete on public.team_members
  for each row execute function public.log_team_membership_change();

-- ── VERIFIED LIVE, inside rolled-back transactions ──────────────────────────
--
-- 1. Every transition, no JWT (SQL editor). Five writes, four log rows:
--      TEAM_MEMBER_ADDED            team=9 actor=null {"team_role":"member",...}
--      TEAM_MEMBER_ROLE_CHANGED     team=9 actor=null {"from":"member","to":"lead"}
--      TEAM_MEMBER_SUBTEAM_CHANGED  team=9 actor=null {"from":null,"to":"Instagram"}
--      TEAM_MEMBER_REMOVED          team=9 actor=null {"team_role":"lead"}
--    The fifth write (`update ... set joined_at = now()`) logged NOTHING, which
--    is the point of the `is distinct from` ladder.
--
-- 2. The actor, under a real session. Simulated with
--    `set_config('request.jwt.claims', json_build_object('sub', <auth_uid>)...)`
--    for super_admin member 29, adding member 468:
--      TEAM_MEMBER_ADDED actor=29 {"member_id":468,...,"self_serve":false}
--    Actor 29, subject 468, self_serve correctly false. Not the other way round.
--
-- ── TO REVERT ───────────────────────────────────────────────────────────────
--   drop trigger if exists team_membership_audit_log on public.team_members;
--   drop function if exists public.log_team_membership_change();
-- Nothing in the app reads these rows yet, so reverting costs only the history.
-- ============================================================================
