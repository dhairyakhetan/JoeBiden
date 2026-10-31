-- ═══════════════════════════════════════════════════════════════════════════
-- Scheduled blogs were public; mirrored posts were in the moderation queue.
-- 2026-09-11
--
-- STATUS: ALL FOUR MIGRATIONS BELOW ARE APPLIED LIVE (via the Supabase MCP
-- connector, this date). This file is the paper trail, not the pending work.
-- Verify against the live schema before trusting that sentence - this repo has
-- been burned twice by a checked-in .sql whose status comment had drifted
-- (CLAUDE.md, "Verify the live schema, not the .sql files").
--
--   1. scheduled_blogs_stop_leaking_into_the_public_feed
--   2. posts_source_kind_and_mirrors_leave_the_human_queue
--   3. stamp_source_kind_on_every_mirrored_post
--   4. post_feed_view_exposes_source_kind
--
-- ── WHAT WAS FOUND ─────────────────────────────────────────────────────────
-- Found while scoping item 4.2 (fold `blogs` into `posts`), not while looking
-- for it.
--
-- 14 of the 36 blogs carry a `published_date` in the future - 2026-09-14
-- through 2026-10-26. `blogs` RLS hides those from /blog correctly, so the
-- public blog index showed 22 and looked right.
--
-- But every blog is mirrored into `posts` by `mirror_blog_to_post`, and all 14
-- of those mirrored posts were `status = 'published'`. So the headline and the
-- opening ~630 characters of fourteen unpublished essays were live on the
-- public homepage feed, to anonymous visitors, up to 45 days early. Two of them
-- ("Chasing Happiness", "It's Just a Joke") were on the first screen of the
-- feed in a screenshot taken earlier the same day without anyone noticing.
--
-- Measured, before:
--   anon sees their posts = 14, anon sees them in post_feed_view = 14
-- after:
--   anon sees their posts = 0,  anon sees them in post_feed_view = 0
--   anon blog posts in feed = 22, anon /blog list = 22   <- these now AGREE
--
-- ── ROOT CAUSE, which is the part that mattered ────────────────────────────
-- Not a batch of bad rows. `mirror_blog_to_post` parked a not-yet-due blog in
-- `pending_review`, which is the SAME queue a member's post lands in, and both
-- `directorService.getPendingPosts` and the desk's badge count selected exactly
-- `status = 'pending_review'`. So a blog scheduled for next month appeared in
-- the human Post Queue as an ordinary pending post, with nothing anywhere
-- saying it was scheduled - and approving it published it immediately,
-- overriding the schedule its own desk had set.
--
-- Measured at the moment of the fix: the Post Queue held 14 items and ALL 14
-- were blog mirrors. There was not one real member post in it. The queue was
-- not a moderation queue at all; it was a loaded gun pointed at the editorial
-- calendar.
--
-- ── THE FIX ────────────────────────────────────────────────────────────────
-- (1) `posts` already had the right mechanism and blogs simply were not using
--     it: `status='scheduled'` + `scheduled_for`. That status is hidden from
--     anon by the existing select policy (`status='published' OR author_id=me
--     OR is_director()`), is NOT in the moderation queue, and is promoted by
--     `publish_due_scheduled_posts()`, which pg_cron has been running every
--     minute all along. The mirror now schedules instead of queueing.
--
--     The cover gate is preserved exactly: a future-dated blog with NO
--     featured_image still goes to `pending_review`, because the original
--     comment ("a live blog with no cover renders as an empty grey card in the
--     feed, so the image is part of the gate") still holds. All 14 of the
--     current backlog are coverless, so all 14 landed there - which is why (2)
--     is not optional.
--
-- (2) `posts.source_kind` - null for a post a member wrote, otherwise the desk
--     that owns the row it mirrors. The moderation queue now filters
--     `source_kind is null`, so a mirror cannot be approved out of band no
--     matter what status it is in.
--
--     This column is also the first brick of item 4.2: `post_feed_view`
--     currently re-derives "what kind of thing is this" by LEFT JOINing all
--     three source tables on every read, and that derivation cannot survive
--     `blogs` being dropped.
--
--     source_kind is NOT the view's existing `source_type`. The view is
--     `security_invoker=on`, so `source_type` is RLS-DEPENDENT - the same row
--     reads 'blog' for a director and NULL for an anonymous visitor, because
--     the anon reader cannot see the `blogs` row the CASE tests. That is right
--     for what source_type answers and useless for "is this a mirror", which
--     must read the same for everybody. Filtering the queue on source_type
--     would have let mirrors back in for any reader whose RLS hides the source.
--
-- (3) The other two mirrors (welfare projects, job openings) get their
--     source_kind from an AFTER trigger on the source table rather than from a
--     rewritten SECURITY DEFINER function. This bug came from two sources of
--     truth disagreeing; hand-copying two more working functions to add one
--     column was not the way to end that. The trigger also fires on UPDATE, so
--     a re-pointed mirror stays correctly labelled.
--
-- ── NOT DONE HERE ──────────────────────────────────────────────────────────
-- Item 4.2 itself. `blogs` still exists with all 36 rows, its desk, and its
-- `/blog/:slug` route reading it directly. What is done is the column that
-- migration needs and the bug that scoping it uncovered.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 ───────────────────────────────────────────────────────────────────────
update public.posts p
   set status = 'scheduled', scheduled_for = b.published_date, updated_at = timezone('utc', now())
  from public.blogs b
 where b.linked_post_id = p.uuid and p.deleted_at is null and p.status = 'published'
   and b.published_date is not null and b.published_date > now()
   and b.featured_image is not null;

update public.posts p
   set status = 'pending_review', scheduled_for = null, updated_at = timezone('utc', now())
  from public.blogs b
 where b.linked_post_id = p.uuid and p.deleted_at is null and p.status = 'published'
   and b.published_date is not null and b.published_date > now()
   and b.featured_image is null;


-- ── 2 ───────────────────────────────────────────────────────────────────────
alter table public.posts
  add column if not exists source_kind text
  check (source_kind in ('blog', 'welfare_project', 'job_opening'));

comment on column public.posts.source_kind is
  'null = a post a member actually wrote. Otherwise the desk that owns the row this post mirrors. Mirrors are excluded from the moderation queue.';

update public.posts p set source_kind = 'blog'
  from public.blogs b where b.linked_post_id = p.uuid and p.source_kind is distinct from 'blog';
update public.posts p set source_kind = 'welfare_project'
  from public.welfare_projects wp where wp.linked_post_id = p.uuid and p.source_kind is distinct from 'welfare_project';
update public.posts p set source_kind = 'job_opening'
  from public.job_openings jo where jo.linked_post_id = p.uuid and p.source_kind is distinct from 'job_opening';

create index if not exists posts_moderation_queue_idx
  on public.posts (status) where source_kind is null and deleted_at is null;

-- A new column starts with no privileges of its own on some tables in this
-- database; say it rather than assume it (CLAUDE.md, `team_nudge_seen_at`).
grant select (source_kind) on public.posts to anon, authenticated;
grant update (source_kind) on public.posts to authenticated;


-- ── 3 ── the mirror schedules instead of queueing, and labels what it makes ──
create or replace function public.mirror_blog_to_post()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
declare
  aq_member_id integer; new_post_uuid uuid; writeup text;
  post_status text; post_due timestamptz;
begin
  if new.linked_post_id is null then
    aq_member_id := new.author_id;
    if aq_member_id is null then
      select member_id into aq_member_id from public.members where email = 'official@ngoaquaterra.com';
    end if;
    writeup := public.blog_post_writeup(new.headliner, new.body, new.written_by);

    if new.published_date is not null and new.published_date <= now() and new.featured_image is not null then
      post_status := 'published'; post_due := null;
    elsif new.published_date is not null and new.published_date > now() and new.featured_image is not null then
      post_status := 'scheduled'; post_due := new.published_date;
    else
      post_status := 'pending_review'; post_due := null;
    end if;

    insert into public.posts (author_id, category, body, status, scheduled_for, source_kind)
    values (aq_member_id, new.category, writeup, post_status, post_due, 'blog')
    returning uuid into new_post_uuid;

    new.linked_post_id := new_post_uuid;
  end if;
  return new;
end;
$function$;


-- ── 4 ── the other two mirrors, stamped from their own table ────────────────
create or replace function public.stamp_post_source_kind()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  if new.linked_post_id is not null then
    update public.posts set source_kind = tg_argv[0]
     where uuid = new.linked_post_id and source_kind is distinct from tg_argv[0];
  end if;
  return new;
end;
$function$;

drop trigger if exists welfare_project_stamp_source_kind on public.welfare_projects;
create trigger welfare_project_stamp_source_kind
  after insert or update of linked_post_id on public.welfare_projects
  for each row execute function public.stamp_post_source_kind('welfare_project');

drop trigger if exists job_opening_stamp_source_kind on public.job_openings;
create trigger job_opening_stamp_source_kind
  after insert or update of linked_post_id on public.job_openings
  for each row execute function public.stamp_post_source_kind('job_opening');

drop trigger if exists blog_stamp_source_kind on public.blogs;
create trigger blog_stamp_source_kind
  after insert or update of linked_post_id on public.blogs
  for each row execute function public.stamp_post_source_kind('blog');


-- ── 5 ── post_feed_view gains p.source_kind, appended last ──────────────────
-- (Full definition applied live as migration `post_feed_view_exposes_source_kind`;
--  every pre-existing column keeps its name, type and ordinal position, so no
--  existing reader changes. Not repeated here - read the live definition with
--  `select definition from pg_views where viewname='post_feed_view'` rather
--  than trusting a second copy in a file, which is how definitions drift.)
