-- ============================================================================
-- terrathon_delete_registration(uuid)
--
-- Applied live 2026-09-21 via the Supabase MCP connector. This file is the
-- record, not the source of truth; verify against the live schema before
-- trusting it (CLAUDE.md, "Verify the live schema, not the .sql files").
--
-- WHY AN RPC AND NOT A PostgREST DELETE
--
-- `tt_reg_leader_all` is FOR ALL, so a leader can already issue a DELETE on
-- terrathon_registrations from the browser. It would fail for almost every row
-- that matters. Two of the three children are NO ACTION:
--
--   terrathon_roster      ON DELETE CASCADE     goes on its own
--   terrathon_checkins    ON DELETE NO ACTION   blocks any checked-in entry
--   terrathon_audit_log   ON DELETE NO ACTION   blocks anything the desk has
--                                               ever touched, which after a
--                                               single "messaged" tick is
--                                               every row in practice
--
-- So the desk needed one statement that handles the children in the right
-- order, inside one transaction, rather than three round trips from a browser
-- that can fail halfway and leave a half-deleted entry.
--
-- WHAT IT DOES WITH THE AUDIT TRAIL
--
-- It does NOT delete the audit rows. Deleting the history of a thing at the
-- same moment you delete the thing is how you end up unable to answer "who
-- removed this entry and what was in it". Instead it writes a final `deleted`
-- row carrying the whole registration as `before`, then DETACHES the older
-- rows by nulling their registration_id, which the column already allows. The
-- trail survives the row it describes.
--
-- SECURITY
--
-- SECURITY DEFINER, so it runs as the owner and can touch the audit log. That
-- makes the guard inside the function the only thing standing between any
-- signed-in account and someone else's entry, so it re-checks
-- is_director() OR is_super_admin() itself rather than trusting RLS, which
-- does not apply to a definer function's own statements.
--
-- And REVOKE FROM PUBLIC FIRST. Postgres grants EXECUTE on a new function to
-- PUBLIC by default and `anon` inherits it, so revoking from anon alone is a
-- no-op while the PUBLIC grant stands. This repo has already been bitten by
-- exactly that.
-- ============================================================================

create or replace function public.terrathon_delete_registration(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.terrathon_registrations;
  v_me   int;
begin
  if not (public.is_director() or public.is_super_admin()) then
    return jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  -- Lock the row so two desks cannot delete the same entry concurrently and
  -- both think they were the one that did it.
  select * into v_row
    from public.terrathon_registrations
   where id = p_id
   for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select member_id into v_me
    from public.members
   where auth_uid = auth.uid();

  -- The tombstone goes in BEFORE the delete, carrying the whole row, so the
  -- log can still answer what was removed.
  insert into public.terrathon_audit_log (registration_id, actor, action, before, after)
  values (null, v_me, 'registration_deleted', to_jsonb(v_row), null);

  -- Detach, do not destroy. registration_id is nullable precisely so history
  -- can outlive its subject.
  update public.terrathon_audit_log
     set registration_id = null
   where registration_id = p_id;

  delete from public.terrathon_checkins where registration_id = p_id;
  -- terrathon_roster cascades.
  delete from public.terrathon_registrations where id = p_id;

  return jsonb_build_object('ok', true, 'ref_code', v_row.ref_code);
end;
$$;

revoke execute on function public.terrathon_delete_registration(uuid) from public;
revoke execute on function public.terrathon_delete_registration(uuid) from anon;
grant  execute on function public.terrathon_delete_registration(uuid) to authenticated;
