-- ─────────────────────────────────────────────────────────────────────────
-- create_notification(): let a team lead notify their own openings'
-- applicants (2026-09-08)
-- ─────────────────────────────────────────────────────────────────────────
-- Follows job_applications_team_lead_access_2026_09_08.sql, which let a
-- team-scoped lead read/update job_applications for their team's openings
-- (matching what TeamDetailPage.tsx's UI already grants). That fix alone
-- left one thing broken: jobOpenings.ts's post-decision notification call
-- (`type: 'system'`) still only authorized `is_director() OR
-- is_super_admin()` inside this function, so a team lead's accept/reject
-- would succeed but the applicant-facing notification would silently fail
-- (fire-and-forget, console.warn only - the primary action is unaffected,
-- but the applicant never hears back).
--
-- Deliberately NOT a blanket "any team lead may send system notifications"
-- widening - `type='system'` is generic and reused by unrelated director-
-- only call sites (PostModeration's "ask for more detail", AccountApprovals'
-- welcome notification). Those stay closed to team leads because they have
-- no UI path to reach them as a plain lead anyway. Scoped instead to
-- exactly the case this fix is for: the notification's target
-- (`p_member_id`) must actually be an applicant to one of the caller's own
-- team's openings.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.create_notification(
  p_member_id integer,
  p_type text,
  p_title text,
  p_subtitle text default null::text,
  p_full_note text default null::text,
  p_link text default null::text
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null then
    raise exception 'must be authenticated to create a notification';
  end if;

  if p_type = 'system' and not (
    public.is_director()
    or public.is_super_admin()
    or exists (
      select 1 from public.job_applications ja
      join public.job_openings jo on jo.id = ja.opening_id
      where ja.applicant_id = p_member_id
        and public.is_team_lead(jo.team_id)
    )
  ) then
    raise exception 'not authorized to create a % notification', p_type;
  end if;

  if p_type in ('post_approved','post_rejected','team_invite','team_join_accepted')
     and not (
       public.is_director()
       or public.is_super_admin()
       or exists (
         select 1 from public.members
         where auth_uid = auth.uid()
           and role::text = 'lead'
           and status::text = 'active'
       )
     ) then
    raise exception 'not authorized to create a % notification', p_type;
  end if;

  if p_link is not null and (p_link not like '/%' or p_link like '//%') then
    raise exception 'notification link must be an app-internal path';
  end if;

  if p_type in ('like','follow','tag') and exists (
    select 1 from public.notifications n
    where n.member_id = p_member_id
      and n.type = p_type
      and coalesce(n.link, '') = coalesce(p_link, '')
      and n.created_at > now() - interval '24 hours'
  ) then
    return;
  end if;

  if p_type = 'wall_note' and exists (
    select 1 from public.notifications n
    where n.member_id = p_member_id
      and n.type = 'wall_note'
      and n.created_at > now() - interval '1 hour'
  ) then
    return;
  end if;

  insert into public.notifications (member_id, type, title, subtitle, full_note, link)
  values (p_member_id, p_type, p_title, p_subtitle, p_full_note, p_link);
end;
$function$;
