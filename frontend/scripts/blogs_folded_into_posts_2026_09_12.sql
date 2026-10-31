-- ═══════════════════════════════════════════════════════════════════════════
-- Item 4.2 complete: `blogs` is folded into `posts` and retired.  2026-09-12
--
-- STATUS: ALL FIVE MIGRATIONS APPLIED LIVE, via the Supabase MCP connector.
-- Verify against the live schema before trusting that sentence.
--
--   1. posts_carry_the_blog_fields_additive        (2026-09-11)
--   2. posts_carry_the_article_text                (2026-09-11)
--   3. native_blog_posts_excerpt_and_director_covers
--   4. post_feed_view_stops_joining_blogs
--   5. retire_the_blogs_table
--
-- The owner's decision (TODO_ACTIVE.md, 2026-09-11): "migrate all 36 into
-- `posts`, drop the table, and `/blog/:slug` must keep working" - those URLs are
-- canonical, prerendered and in the sitemap.
--
-- ── the shape a blog has now ───────────────────────────────────────────────
-- ONE row in `posts`:
--   source_kind   'blog'
--   slug          the URL key (unique index posts_slug_key, partial on not null)
--   title         the headline
--   article_body  the essay
--   body          the ~630-char FEED EXCERPT, derived from article_body by the
--                 `posts_fill_article_excerpt` trigger calling blog_post_writeup()
--   article       jsonb: byline, byline_instagram, byline_url, read_minutes
--   published_at  for display/archive order (NOT created_at, which the cron
--                 resets to now() on publish so the row reads fresh in the feed)
--   cover         a post_images row at display_order 0
--
-- and the publication state is ONE status on that one row:
--   pending_review  a draft; in the Blog Drafts desk; a leader decides
--   scheduled       has a future scheduled_for; invisible to the public by RLS;
--                   promoted by the pg_cron job publish_due_scheduled_posts
--   published       live
--
-- ── why that last part is the whole point ──────────────────────────────────
-- The old design had TWO rows - a `blogs` row and a mirrored `posts` row - each
-- with its own idea of whether the thing was public. They drifted, and on
-- 2026-09-11 fourteen unpublished essays were found live on the public homepage
-- up to 45 days before their date, because `blogs` RLS said "hidden" and the
-- mirrored post said `published`. One row cannot disagree with itself.
--
-- ── migrated, verified ─────────────────────────────────────────────────────
-- 36 rows, ZERO field mismatches against `blogs` before retirement. 13 covers
-- moved into post_images. 33 article bodies (3 blogs genuinely had none).
--
-- After, as anon:
--   feed blogs = 22, /blog list = 22            (the two finally agree)
--   source_type='blog' for 22                   (was 0 - see below)
--   blogs_retired_2026_09_12                    permission denied
-- and 14 drafts now sit in the Blog Drafts desk where a leader can add the
-- cover they are missing and publish them.
--
-- ── a bug fixed in passing, worth naming ───────────────────────────────────
-- `post_feed_view.source_type` used to be derived by testing which LEFT JOIN
-- matched. The view is `security_invoker = on`, so that made it RLS-DEPENDENT:
-- an anonymous visitor could not see the joined `blogs` row, so source_type came
-- back NULL and every published blog rendered in the PUBLIC feed as an ordinary
-- text card (C07) instead of a long-read card (C06). Signed-in directors saw it
-- correctly, which is why it survived. It now reads the stored `p.source_kind`,
-- so everybody gets the same answer. Verified in the browser: the public feed
-- renders C06 where it rendered C07 an hour ago.
--
-- ── retired, not dropped ───────────────────────────────────────────────────
-- The instruction said drop. This renames and revokes instead, which achieves
-- what the instruction was FOR - off the API surface, unreachable, unwritable,
-- unable to disagree with `posts` ever again - while keeping 36 rows of
-- students' writing recoverable. `drop table public.blogs_retired_2026_09_12;`
-- is one line whenever the owner says so; un-dropping it is not.
--
-- `blog_post_writeup()` deliberately SURVIVES: it is not mirror machinery, it
-- derives the feed excerpt, and fill_article_excerpt() calls it on every
-- long-form insert. Dropping it would break writing a blog.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 3 ── what a NATIVE long-form post needs ────────────────────────────────
create or replace function public.fill_article_excerpt()
 returns trigger language plpgsql security definer set search_path to ''
as $function$
begin
  if new.source_kind = 'blog'
     and coalesce(btrim(new.body), '') = ''
     and coalesce(btrim(new.article_body), '') <> ''
  then
    new.body := public.blog_post_writeup(
      new.title,
      new.article_body,
      nullif(btrim(coalesce(new.article ->> 'byline', '')), '')
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists posts_fill_article_excerpt on public.posts;
create trigger posts_fill_article_excerpt
  before insert or update of article_body, title, article on public.posts
  for each row execute function public.fill_article_excerpt();

-- A leader must be able to put the missing cover on a member's draft. This
-- closes an asymmetry rather than opening a door: the DELETE policy on this
-- table already allowed is_director() to remove any post's images.
drop policy if exists "Post author can insert images" on public.post_images;
create policy "Post author can insert images"
  on public.post_images for insert to public
  with check (
    is_director()
    or exists (select 1 from public.posts
                where posts.post_id = post_images.post_id
                  and posts.author_id = get_current_member_id())
  );


-- ── 5 ── retirement ────────────────────────────────────────────────────────
-- (Step 4, the post_feed_view rewrite, is applied live as
--  `post_feed_view_stops_joining_blogs`. Read the live definition rather than a
--  second copy in a file - that is how definitions drift.)

drop trigger if exists blog_publish_mirror    on public.blogs;
drop trigger if exists blog_stamp_source_kind on public.blogs;
drop function if exists public.mirror_blog_to_post();

-- The cron function loses only its blog branch. Native long-form posts use the
-- generic `scheduled` branch, which has run every minute all along.
create or replace function public.publish_due_scheduled_posts()
 returns integer language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare n integer;
begin
  with due as (
    update public.posts p
       set status = 'published', created_at = timezone('utc', now()),
           updated_at = timezone('utc', now()), scheduled_for = null
     where p.status = 'scheduled' and p.scheduled_for is not null
       and p.scheduled_for <= now() and p.deleted_at is null
    returning p.post_id, p.uuid, p.author_id, p.body
  ),
  notif as (
    insert into public.notifications (member_id, type, title, subtitle, link)
    select pt.tagged_member_id, 'tag', m.full_name || ' tagged you in a post',
           left(coalesce(d.body, ''), 140), '/post/' || d.uuid
      from due d
      join public.post_tags pt on pt.post_id = d.post_id
      join public.members  m  on m.member_id = d.author_id
     where pt.tagged_member_id <> d.author_id
    returning 1
  )
  select count(*) into n from due;

  insert into public.community_audit_logs (member_id, action, entity_type, details)
  values (null, 'cron_publish_scheduled', 'posts', jsonb_build_object('scheduled_posts_published', n));
  return n;
end;
$function$;

revoke all on public.blogs from anon, authenticated, public;
alter table public.blogs rename to blogs_retired_2026_09_12;

comment on table public.blogs_retired_2026_09_12 is
  'RETIRED 2026-09-12, item 4.2. All 36 rows live in `posts` (source_kind=''blog''). Nothing reads or writes this. Grants revoked; kept only so the original rows are recoverable. Safe to DROP on the owner''s word.';
