-- ──────────────────────────────────────────────────────────────────────────
-- The activity log was flooded by the scheduled-publish job (handoff C-01, 3 Nov 2026).
--
-- STATUS: APPLIED 3 Nov 2026 via the Supabase connector (migration name cron_audit_noise). 92,493 rows backed up, 0 left.
--
-- Problem: public.publish_due_scheduled_posts() runs every minute and wrote an audit row
-- every time, including when it published nothing: 92,491 rows (1,440 a day), every one of
-- them scheduled_posts_published = 0. Real approvals and role changes were buried.
--
-- What it does
--   1. The function now writes an audit row ONLY when it published at least one post.
--   2. The existing zero-count rows are copied (whole rows) into
--      public.community_audit_logs_cron_backup_20261103 (RLS on, no policy, no grants:
--      readable only through the SQL editor / service role), then deleted from the log.
--      All 92,491 rows were zero-count; there is no non-zero row to protect.
--   3. No general retention rule is applied to real events (approvals, role changes, team
--      changes): that history is the audit trail and is kept.
--
-- Live checks after applying:
--   select count(*) from community_audit_logs where action='cron_publish_scheduled';         -- 0
--   select count(*) from community_audit_logs_cron_backup_20261103;                         -- 92491
-- A day later: no new cron_publish_scheduled rows unless a scheduled post actually went out.
--
-- Rollback (restores the rows and the old function body):
--   insert into community_audit_logs select * from community_audit_logs_cron_backup_20261103;
--   and re-create the function with the unconditional insert (see git history of this file).
-- ──────────────────────────────────────────────────────────────────────────

create table if not exists public.community_audit_logs_cron_backup_20261103 as
  select * from public.community_audit_logs
   where action = 'cron_publish_scheduled'
     and coalesce((details->>'scheduled_posts_published')::int, 0) = 0;
alter table public.community_audit_logs_cron_backup_20261103 enable row level security;
revoke all on public.community_audit_logs_cron_backup_20261103 from anon, authenticated;

create or replace function public.publish_due_scheduled_posts()
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  n integer;
begin
  with due as (
    update public.posts p
       set status        = 'published',
           created_at    = timezone('utc', now()),
           updated_at    = timezone('utc', now()),
           scheduled_for = null
     where p.status = 'scheduled'
       and p.scheduled_for is not null
       and p.scheduled_for <= now()
       and p.deleted_at is null
    returning p.post_id, p.uuid, p.author_id, p.body
  ),
  notif as (
    insert into public.notifications (member_id, type, title, subtitle, link)
    select pt.tagged_member_id,
           'tag',
           m.full_name || ' tagged you in a post',
           left(coalesce(d.body, ''), 140),
           '/post/' || d.uuid
      from due d
      join public.post_tags pt on pt.post_id = d.post_id
      join public.members  m  on m.member_id = d.author_id
     where pt.tagged_member_id <> d.author_id
    returning 1
  )
  select count(*) into n from due;

  -- Only a real publish is worth a row. A no-op minute used to write one every 60 seconds.
  if n > 0 then
    insert into public.community_audit_logs (member_id, action, entity_type, details)
    values (null, 'cron_publish_scheduled', 'posts', jsonb_build_object('scheduled_posts_published', n));
  end if;

  return n;
end;
$function$;

delete from public.community_audit_logs l
 using public.community_audit_logs_cron_backup_20261103 b
 where l.log_id = b.log_id;
