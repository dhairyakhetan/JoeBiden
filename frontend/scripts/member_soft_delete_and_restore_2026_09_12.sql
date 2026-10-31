-- APPLIED LIVE 2026-09-12 via Supabase MCP apply_migration
-- (migration name: member_soft_delete_and_restore)
--
-- Owner: "superadmins can undo this, right? (if not, please make it so -
-- deleted data ek alag database mei stored rakh)" - re: the Member Directory
-- delete-account flow, which was a hard `DELETE FROM members`, cascading to
-- posts/comments/likes/session data with no way back, ever.
--
-- Chose soft-delete over "hard-delete + restore from a snapshot table":
-- nothing is actually removed, so there is nothing to lose to snapshot/
-- restore bugs, and "kept in a separate database" is satisfied in spirit -
-- the data never leaves the live tables at all, it's just marked and
-- hidden, exactly matching how 'archived' (a lighter, self-explanatory
-- status already on this table) already works for "they left AQ" - this is
-- the harder version of the same mechanism, distinct because it's an
-- ADMIN-INITIATED removal, not a self-reported departure, and it's meant
-- to read as more severe (excluded from every existing status filter,
-- kicked out of the app entirely, not just off the live public lists).
alter table public.members drop constraint members_status_check;
alter table public.members add constraint members_status_check
  check (status::text = any (array['pending_approval','active','rejected','suspended','archived','deleted']::text[]));

alter table public.members add column if not exists deleted_at timestamp with time zone;
alter table public.members add column if not exists deleted_by integer references public.members(member_id);
-- No explicit grant needed on these two columns for `authenticated` - only
-- the two SECURITY DEFINER RPCs below ever touch them, which bypass column
-- grants entirely.

create or replace function public.soft_delete_member(p_member_id integer)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_actor_id integer;
begin
  if not is_super_admin() then
    raise exception 'Only HR/super_admin can delete a member';
  end if;
  v_actor_id := get_current_member_id();
  if v_actor_id = p_member_id then
    raise exception 'You cannot delete your own account this way';
  end if;

  update public.members
  set status = 'deleted', deleted_at = now(), deleted_by = v_actor_id
  where member_id = p_member_id;

  insert into public.community_audit_logs (member_id, action, entity_type, entity_id)
  values (v_actor_id, 'member_soft_deleted', 'member', p_member_id);
end;
$$;

grant execute on function public.soft_delete_member(integer) to authenticated;

create or replace function public.restore_member(p_member_id integer)
returns void
language plpgsql
security definer
set search_path = 'public', 'pg_temp'
as $$
declare
  v_actor_id integer;
begin
  if not is_super_admin() then
    raise exception 'Only HR/super_admin can restore a member';
  end if;
  v_actor_id := get_current_member_id();

  update public.members
  set status = 'active', deleted_at = null, deleted_by = null
  where member_id = p_member_id and status = 'deleted';

  insert into public.community_audit_logs (member_id, action, entity_type, entity_id)
  values (v_actor_id, 'member_restored', 'member', p_member_id);
end;
$$;

grant execute on function public.restore_member(integer) to authenticated;

-- NOTE: this does NOT hide a deleted member's existing posts/comments/likes
-- from the live app - those rows are untouched, on purpose (nothing is
-- removed, so nothing can be lost). If "deleted" should also mean "their
-- content disappears from the feed while deleted", that is a separate,
-- deliberate decision not made here - flag it if that's actually wanted.

-- Verify:
-- select member_id, status, deleted_at, deleted_by from members where status='deleted';
