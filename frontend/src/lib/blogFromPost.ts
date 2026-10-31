/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Item 4.2 · a blog is a post now, and this is the seam
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   The owner's call (TODO_ACTIVE.md, 2026-09-11): "migrate all 36 into `posts`,
   drop the table, and `/blog/:slug` MUST keep working" - those 36 URLs are
   canonical, prerendered and in the sitemap, so they are not ours to break.

   ── why an adapter instead of rewriting the two pages ─────────────────────
   `BlogListPage` and `BlogPostPage` are ~150 and ~250 lines of rendering, SEO
   tags, JSON-LD and a share sheet, all written against the `Blog` shape. None
   of that has anything to do with where the row is stored. Rewriting them to
   speak `posts` would mean re-deriving every field at every use site and would
   put the whole blog front-end in the blast radius of a storage change - for a
   migration whose entire promise is that nothing visible changes.

   So the storage moves and the SHAPE stays. One function, one place where the
   old field names meet the new columns, and the pages keep their contract.
   When someone later wants the blog page to use post-native names, that is a
   separate change with its own reason, not a side effect of this one.

   ── the mapping, and the two places it is not 1:1 ─────────────────────────
   `blogs.body`     -> `posts.article_body`, NOT `posts.body`. `posts.body` for
                       a blog is the ~630-char feed excerpt that
                       `blog_post_writeup` generates; the article is the long
                       text. Reading `body` here would render the excerpt as
                       the article, which is the one mistake that would look
                       almost right.
   `featured_image` -> the post's first image, because the 13 covers were moved
                       into `post_images` (migration
                       `posts_carry_the_blog_fields_additive`). That makes a
                       cover an ordinary post image - it goes through `sized()`
                       and the lightbox like every other one - and it is why
                       `post_feed_view` will not need a blog branch once the
                       table is gone.

   `featured_image_alt` has no source: all 36 rows had it empty in `blogs` too,
   so this returns null rather than inventing alt text. The pages already fall
   back to a generated string, and a wrong alt is worse than a missing one.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import type { Blog } from './supabase'

/** What a blog page needs from `posts`, including the cover via post_images. */
export const BLOG_FROM_POST_COLS =
  'post_id,uuid,slug,title,article_body,article,published_at,category,post_images(blob_url,display_order)'

/** The list view never renders article text - don't ship 33 essays to draw a
 *  grid of cards. Mirrors BlogListPage's existing note about the same thing. */
export const BLOG_LIST_FROM_POST_COLS =
  'post_id,uuid,slug,title,article,published_at,category,post_images(blob_url,display_order)'

interface ArticleMeta {
  byline?: string
  byline_instagram?: string
  byline_url?: string
  read_minutes?: number
}

interface PostRowForBlog {
  post_id: number
  slug: string | null
  title: string | null
  article_body?: string | null
  article: ArticleMeta | null
  published_at: string | null
  post_images?: { blob_url: string | null; display_order: number | null }[] | null
}

/** Lowest display_order wins, which is where the migrated cover was put (0). */
function coverOf(row: PostRowForBlog): string | null {
  const imgs = (row.post_images ?? []).filter(i => !!i.blob_url)
  if (!imgs.length) return null
  return [...imgs].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))[0].blob_url
}

export function blogFromPost(row: PostRowForBlog): Blog {
  const meta = row.article ?? {}
  return {
    id: row.post_id,
    slug: row.slug ?? '',
    headliner: row.title ?? '',
    featured_image: coverOf(row),
    // Never carried any value in `blogs` either - see the header.
    featured_image_alt: null,
    written_by: meta.byline ?? null,
    published_date: row.published_at,
    minutes_of_read: meta.read_minutes ?? null,
    body: row.article_body ?? null,
    author_url: meta.byline_url ?? null,
    author_instagram: meta.byline_instagram ?? null,
  }
}
