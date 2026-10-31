import { supabaseCommunity } from '../lib/supabaseCommunity'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

// Long-form (blog) writes.
//
// ── ITEM 4.2: THERE IS NO `blogs` TABLE ANY MORE ────────────────────────────
// A blog is a post. Everything here writes `posts`, where a long-form row is
// `source_kind = 'blog'` and carries `slug`, `title`, `article_body` and the
// `article` jsonb (byline / byline_instagram / byline_url / read_minutes). Its
// cover is an ordinary `post_images` row at display_order 0.
//
// `posts.body` is NOT written here. For a long-form post it is the ~630-char
// FEED EXCERPT, and it is derived in the database by the
// `posts_fill_article_excerpt` trigger calling `blog_post_writeup()` - the same
// function that produced it when blogs were mirrored. Computing it in
// TypeScript instead would be a second implementation of one derivation, and
// two implementations of one fact is exactly how `blogs` and `posts` came to
// disagree about publication state and put fourteen unpublished essays on the
// public homepage.
//
// ── the publication model, which is the whole point of the migration ────────
// One row, one status, no second opinion:
//   pending_review  a draft. In the Post Queue. A leader decides.
//   scheduled       has a future `scheduled_for`. NOT in the queue, invisible
//                   to the public by RLS, published by the pg_cron job
//                   `publish_due_scheduled_posts` when the date arrives.
//   published       live.
// A member may only ever INSERT `pending_review` - enforced by RLS since
// members_cannot_self_publish_2026_09_11.sql, not by this file.
//
// Like the rest of services/*, these THROW on error; the calling component owns
// the toast (CLAUDE.md's service-layer contract).

// `lib/database.types.ts` WAS regenerated against the live schema on
// 2026-09-12, so slug/title/article/article_body/source_kind/published_at are
// all typed now. This narrow cast survives only because the queries below embed
// `post_images(...)`, and PostgREST embeds are not expressible in the generated
// row types - the same reason every other embedding call site in this codebase
// casts. It is no longer papering over stale types.
const db = supabaseCommunity as unknown as {
  from: (t: string) => any
}

/** Long-form posts only. Every query here is scoped by it. */
const KIND = 'blog'

/** URL-safe slug from a headline, de-duplicated against existing rows. */
export async function makeSlug(headliner: string): Promise<string> {
  const base = (headliner || 'untitled')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'untitled'

  // One round-trip: fetch anything already sharing the stem instead of probing
  // slug-2, slug-3, … one request at a time.
  //
  // NOTE this deliberately does NOT filter by source_kind or status. `slug` is
  // unique across the whole table (posts_slug_key), so a draft's slug can
  // collide with a published post's; scoping this query would hand back a slug
  // that then fails on insert.
  const { data, error } = await db
    .from('posts')
    .select('slug')
    .like('slug', `${base}%`)
  if (error) throw logSupabaseError('blogService.makeSlug', error)

  const taken = new Set(((data || []) as { slug: string | null }[]).map(r => r.slug))
  if (!taken.has(base)) return base
  for (let n = 2; n < 500; n++) {
    if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
  }
  // Pathological fallback - a timestamp is ugly but always unique.
  return `${base}-${Date.now()}`
}

export interface NewBlog {
  headliner: string
  body: string
  writtenBy: string
  authorInstagram?: string | null
  featuredImage?: string | null
  featuredImageAlt?: string | null
  category?: string
  /** Leaders only. Omit/null => draft, which is what members always send. */
  publishedDate?: string | null
}

/** ~200 wpm, floored at 1 - matches how the imported rows were computed. */
// Moved to lib/uiHelpers.ts (a pure helper, wanted by the feed too). Imported
// AND re-exported: `export { x } from '...'` alone would not create a local
// binding, and this module calls it itself below.
import { readMinutes } from '../lib/uiHelpers'
export { readMinutes }

/**
 * Decide the row's publication state from the date the caller asked for.
 * Kept in one place because the three-way choice is the thing that used to be
 * spread across a trigger, a cron function and a client, and disagreed.
 */
function publicationFor(publishAt: string | null | undefined) {
  if (!publishAt) return { status: 'pending_review', scheduled_for: null, published_at: null }
  const when = new Date(publishAt)
  if (Number.isNaN(when.getTime())) {
    return { status: 'pending_review', scheduled_for: null, published_at: null }
  }
  if (when.getTime() > Date.now()) {
    return { status: 'scheduled', scheduled_for: when.toISOString(), published_at: when.toISOString() }
  }
  return { status: 'published', scheduled_for: null, published_at: when.toISOString() }
}

const blogServiceImpl = {
  async create(input: NewBlog) {
    const slug = await makeSlug(input.headliner)

    const row = {
      slug,
      title: input.headliner.trim(),
      article_body: input.body,
      source_kind: KIND,
      // author_id is intentionally NOT sent. The column defaults to
      // current_member_id(), so Postgres fills it from the verified session —
      // the frontend's Member type never exposes the numeric id anyway, and a
      // server-derived value cannot be spoofed into someone else's name.
      article: {
        byline: input.writtenBy || null,
        byline_instagram: input.authorInstagram || null,
        read_minutes: readMinutes(input.body),
      },
      category: input.category || 'content',
      // A member's request for a publish date is not authority to have one:
      // RLS rejects any INSERT from a non-leader that is not `pending_review`,
      // so `publicationFor` is the leader path and the fallback is the member
      // path. The database is what decides which one the caller gets.
      ...publicationFor(input.publishedDate),
    }

    // .select() so an RLS refusal surfaces as 0 rows instead of a silent
    // success - the swallowed-write failure mode this codebase has hit before.
    const { data, error } = await db
      .from('posts')
      .insert(row)
      .select('post_id,slug')

    if (error) throw logSupabaseError('blogService.create', error)
    if (!data || data.length === 0) {
      throw new Error("Couldn't save this blog - you may not have permission.")
    }

    const created = data[0] as { post_id: number; slug: string }

    // The cover is a post image now, so it is a second write. Deliberately NOT
    // fatal: the post exists and is recoverable from the desk, and throwing
    // here would tell the author their writing was lost when it was not.
    if (input.featuredImage) {
      try {
        await setDraftCover(created.post_id, input.featuredImage)
      } catch {
        // Surfaced by the desk as a draft with no cover, which is a state it
        // already renders and already knows how to fix.
      }
    }

    return { id: created.post_id, slug: created.slug }
  },
}

export const blogService = withFunctionLogging('blogService', blogServiceImpl)

export default blogService

/** A blog awaiting a leader's decision (no publish date yet). */
export interface BlogDraft {
  id: number
  slug: string
  headliner: string
  body: string | null
  written_by: string | null
  featured_image: string | null
  minutes_of_read: number | null
  category: string
  created_at: string | null
}

interface DraftRow {
  post_id: number
  slug: string | null
  title: string | null
  article_body: string | null
  article: { byline?: string; read_minutes?: number } | null
  category: string | null
  created_at: string | null
  post_images?: { blob_url: string | null; display_order: number | null }[] | null
}

function draftFromPost(r: DraftRow): BlogDraft {
  const imgs = (r.post_images ?? []).filter(i => !!i.blob_url)
  const cover = imgs.length
    ? [...imgs].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))[0].blob_url
    : null
  return {
    id: r.post_id,
    slug: r.slug ?? '',
    headliner: r.title ?? '',
    body: r.article_body,
    written_by: r.article?.byline ?? null,
    featured_image: cover,
    minutes_of_read: r.article?.read_minutes ?? null,
    category: r.category ?? 'content',
    created_at: r.created_at,
  }
}

/**
 * Drafts = long-form posts still awaiting a decision.
 *
 * `status = 'pending_review'` replaces the old "published_date is null" test,
 * and it is a better question: a SCHEDULED blog is not a draft - it is decided,
 * and it is waiting on a clock rather than on a person. Listing it here is how
 * a leader used to publish it early by accident.
 *
 * Visible to leaders because the posts SELECT policy grants `is_director()` the
 * whole table; a member sees only their own.
 */
export async function listDrafts(): Promise<BlogDraft[]> {
  const { data, error } = await db
    .from('posts')
    .select('post_id,slug,title,article_body,article,category,created_at,post_images(blob_url,display_order)')
    .eq('source_kind', KIND)
    .eq('status', 'pending_review')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw logSupabaseError('blogService.listDrafts', error)
  return ((data || []) as DraftRow[]).map(draftFromPost)
}

/**
 * Publish (or schedule) a draft. This is the leader-only action - RLS lets
 * `is_director()` move a post to `published`/`scheduled` and lets nobody else.
 *
 * A future date produces `scheduled`, NOT `published`, which is the fix for the
 * fourteen essays that were live on the homepage weeks before their date: the
 * row stays invisible to the public until `publish_due_scheduled_posts` (pg_cron,
 * every minute) promotes it.
 *
 * The cover still matters beyond decoration - a published long-form post with no
 * image renders as a blank card in the feed - so the desk passes one in when it
 * has one, and it is written before the status changes.
 */
export async function publishDraft(
  id: number,
  opts: { featuredImage?: string | null; publishAt?: string | null } = {},
) {
  if (opts.featuredImage) {
    await setDraftCover(id, opts.featuredImage)
  }

  const patch = publicationFor(opts.publishAt ?? new Date().toISOString())

  const { data, error } = await db
    .from('posts')
    .update(patch)
    .eq('post_id', id)
    .select('post_id,slug')
  if (error) throw logSupabaseError('blogService.publishDraft', error)
  if (!data || data.length === 0) {
    throw new Error("Couldn't publish this blog - you may not have permission.")
  }
  return data[0] as { post_id: number; slug: string }
}

/**
 * Set/replace a draft's cover without publishing it.
 *
 * A cover is `post_images` at display_order 0, so replacing one means deleting
 * the old row rather than updating a column. `null` clears it.
 */
export async function setDraftCover(id: number, url: string | null) {
  const { error: delError } = await db
    .from('post_images')
    .delete()
    .eq('post_id', id)
    .eq('display_order', 0)
  if (delError) throw logSupabaseError('blogService.setDraftCover', delError)

  if (!url) return true

  const { data, error } = await db
    .from('post_images')
    .insert({
      post_id: id,
      blob_url: url,
      // NOT NULL on this table. It is the storage object name; for a CDN URL
      // with no storage object behind it the last path segment is the honest
      // answer, and is never empty because of the fallback.
      blob_name: url.split('?')[0].split('/').pop() || `cover-${id}`,
      display_order: 0,
    })
    .select('image_id')
  if (error) throw logSupabaseError('blogService.setDraftCover', error)
  if (!data || data.length === 0) throw new Error("Couldn't save the cover image.")
  return true
}

export async function deleteDraft(id: number) {
  // Soft delete, matching every other post deletion in this app - a hard delete
  // would take the row out from under `post_feed_view` and any notification
  // linking to it. post_images cascade only on a real delete, which is correct:
  // restoring a draft should restore its cover too.
  const { data, error } = await db
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('post_id', id)
    .select('post_id')
  if (error) throw logSupabaseError('blogService.deleteDraft', error)
  if (!data || data.length === 0) {
    throw new Error("Couldn't delete this draft - you may not have permission.")
  }
  return true
}
