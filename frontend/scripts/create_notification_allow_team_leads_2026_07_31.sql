-- ✅ APPLIED live 2026-07-31 (via Supabase MCP) — kept for the record.
--
-- Team-desk moderation/membership actions (approve/reject post, add member, accept join
-- request) are performed by team leads (members.role = 'lead'), but create_notification's
-- type gate only allowed directors/super_admins, so lead-sent notifications were silently
-- dropped (create() is fire-and-forget, so nothing surfaced). Allow active leads to send
-- the four team/moderation types; 'system' stays director/super_admin-only.
create or replace function public.create_notification(
  p_member_id integer, p_type text, p_title text,
  p_subtitle text default null, p_full_note text default null, p_link text default null)
returns void language plpgsql security definer
set search_path to 'public','pg_temp' as $$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to create a notification';
  end if;
  if p_type = 'system' and not (is_director() or is_super_admin()) then
    raise exception 'not authorized to create a % notification', p_type;
  end if;
  if p_type in ('post_approved','post_rejected','team_invite','team_join_accepted')
     and not (is_director() or is_super_admin()
              or exists (select 1 from public.members
                         where uuid = auth.uid()
                           and role::text = 'lead'
                           and status::text = 'active')) then
    raise exception 'not authorized to create a % notification', p_type;
  end if;
  if p_link is not null and (p_link not like '/%' or p_link like '//%') then
    raise exception 'notification link must be an app-internal path';
  end if;
  insert into public.notifications (member_id, type, title, subtitle, full_note, link)
  values (p_member_id, p_type, p_title, p_subtitle, p_full_note, p_link);
end;
$$;
