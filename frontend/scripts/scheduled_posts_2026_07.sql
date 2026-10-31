-- ============================================================================
-- STATUS: APPLIED 2026-07-24 via Supabase MCP (project hzowuwffjqtgszecngpe).
-- Migration name: scheduled_posts_2026_07 (+ pg_cron setup run separately).
--
-- FEATURE: Scheduled posts. Leaders (director/hod/super_admin — the roles that
-- already publish immediately) can schedule a normal feed post to auto-publish
-- at a future time. The post is inserted with status='scheduled' + scheduled_for;
-- the existing "Public can view published posts" RLS policy keeps it hidden from
-- the public feed until it publishes, while "Authors and directors can view
-- pending posts" lets the author (MyPosts) and directors still see it.
--
-- A pg_cron job runs the publisher every minute (this app has no backend server,
-- so auto-publishing must live in the database).
-- ============================================================================

alter table public.posts add column if not exists scheduled_for timestamptz;

-- Partial index so the every-minute publisher only scans scheduled rows.
create index if not exists idx_posts_scheduled
  on public.posts (scheduled_for) where status = 'scheduled';

-- SECURITY DEFINER publisher: flip due scheduled posts to published and reset
-- created_at to publish time so they appear fresh in the feed (not buried at
-- their schedule time). Returns how many it published.
create or replace function public.publish_due_scheduled_posts()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  n integer;
begin
  with due as (
    update public.posts
       set status        = 'published',
           created_at    = timezone('utc', now()),
           updated_at    = timezone('utc', now()),
           scheduled_for = null
     where status = 'scheduled'
       and scheduled_for is not null
       and scheduled_for <= now()
    returning post_id
  )
  select count(*) into n from due;
  return n;
end;
$$;

-- Only the scheduler (postgres/cron) runs this; clients never call it directly.
revoke execute on function public.publish_due_scheduled_posts() from public, anon, authenticated;

-- ── pg_cron setup (run as a separate step; not transactional with the above) ──
-- create extension if not exists pg_cron;
--
-- do $$
-- begin
--   if exists (select 1 from cron.job where jobname = 'publish-scheduled-posts') then
--     perform cron.unschedule('publish-scheduled-posts');
--   end if;
-- end $$;
-- select cron.schedule('publish-scheduled-posts', '* * * * *',
--                      'select public.publish_due_scheduled_posts();');
--
-- Verify: select jobid, jobname, schedule, active from cron.job
--         where jobname='publish-scheduled-posts';   -- active=true, '* * * * *'
