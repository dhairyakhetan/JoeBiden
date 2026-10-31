-- APPLIED LIVE 2026-07-29.
--
-- Closes a gap that would have stranded 23 feed posts.
--
-- A blog scheduled for a future date gets its mirrored post created ONCE, at
-- insert time, as 'pending_review' (no cover yet, not live yet). When the
-- blog's published_date arrives the article appears on /blog — but nothing ever
-- revisits the post:
--   * mirror_blog_to_post() only fires when linked_post_id IS NULL, i.e. once;
--   * publish_due_scheduled_posts() only looked at posts whose OWN status is
--     'scheduled' with a scheduled_for date, and these are 'pending_review'
--     with scheduled_for NULL.
-- The article would go live while its card sat in the review queue forever.
--
-- The same cron pass now also publishes blog-mirrored posts whose blog has gone
-- live AND has a cover. The cover condition deliberately matches the trigger's
-- readiness rule — a card with no image renders blank — so a cover-less blog
-- stays queued for a human to finish rather than publishing an empty card.
--
-- VERIFIED in a rolled-back transaction against a real scheduled blog:
--   status BEFORE                            pending_review
--   cron published count                     1
--   status AFTER                             published
--   cover-less blogs still pending (correct) 22
CREATE OR REPLACE FUNCTION public.publish_due_scheduled_posts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  n integer;
  m integer;
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

  with due_blogs as (
    update public.posts p
       set status     = 'published',
           updated_at = timezone('utc', now())
      from public.blogs b
     where b.linked_post_id = p.uuid
       and p.status = 'pending_review'
       and p.deleted_at is null
       and b.published_date is not null
       and b.published_date <= now()
       and b.featured_image is not null
    returning p.post_id
  )
  select count(*) into m from due_blogs;

  return n + m;
end;
$function$;
