import { hasLeaderAccess, isSuperAdmin } from '../lib/roles'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import { attachDocuments, fetchDocumentRows, attachDocumentRows } from '../lib/postDocuments'
import { Post, PaginatedResponse } from './api'
import { notificationService } from './notificationService'
import { POST_FEED_COLS } from './profileService'
import { logAction } from '../lib/auditLog'
import { resizeForUpload } from '../lib/resizeImage'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

// getPost's mapper (mapPostFromDB) also reads the pin/source/stats/schedule
// columns that the shared POST_FEED_COLS projection deliberately drops for
// list views - append them for the single-post detail fetch.
const POST_DETAIL_COLS = POST_FEED_COLS +
  ', pinned, pinned_title, source_type, source_slug, source_title, source_author, source_read_minutes, source_location, source_summary, source_stat, source_date, featured, stats, scheduled_for'

export interface CreatePostData {
  category: string
  body: string
  linkUrl?: string
  linkTitle?: string
  linkImage?: string
  imageUrls?: string[]
  /**
   * PDF / PPTX attachments. Each entry carries the public storage URL
   * + original filename + mimetype + size so post_documents can
   * reconstruct the attachment metadata for the post card UI.
   */
  documentUrls?: Array<{ url: string; fileName: string; mimeType: string; size: number }>
  taggedMemberIds?: number[]
  /** Set by the profanity filter (flag tier) to force pending_review even for leaders. */
  forceReview?: boolean
  /** Up to 2 highlighted stat blocks. Trimmed to entries with both a value
      and a label - see posts_stat_blocks_2026_07.sql. */
  stats?: { value: string; label: string }[]
  /** ISO timestamp — leaders (director/hod/super_admin) only. When set to a
      future time, the post is inserted as status='scheduled' and auto-published
      by the pg_cron publish_due_scheduled_posts() job at that time. */
  scheduledFor?: string | null
  /**
   * Publish this post as the canonical AquaTerra org account
   * (members.email = 'official@ngoaquaterra.com') instead of the signed-in
   * member. super_admin/hr only — see CreatePostModal.tsx's canPostAsOrg and
   * scripts/post_as_org_account_2026_09.sql's create_post_as_org() RPC.
   * This flag being true is NOT itself the authorization: it only changes
   * WHICH write path createPost() takes (the RPC vs. the plain insert). The
   * RPC re-checks is_super_admin() server-side and resolves the org
   * account's id itself — a caller who isn't a super admin gets a thrown
   * Postgres exception here, not a silently-mis-authored post.
   */
  postAsOrgAccount?: boolean
}

const mapPostFromDB = (post: any, likedPostIds: number[]): Post => ({
  postId: post.post_id,
  uuid: post.uuid,
  category: post.category,
  body: post.body,
  linkUrl: post.link_url,
  linkTitle: post.link_title,
  linkImage: post.link_image,
  status: post.status,
  createdAt: post.created_at,
  authorId: post.author_id,
  authorUuid: post.author_uuid,
  authorName: post.author_name,
  authorAvatar: post.author_avatar,
  authorRole: post.author_role,
  likeCount: post.like_count,
  commentCount: post.comment_count,
  pinned: post.pinned ?? false,
  pinnedTitle: post.pinned_title ?? null,
  images: post.images ? (post.images as any[]).map((img: any) => ({
    blobUrl: img.url,
    displayOrder: img.order
  })) : [],
  taggedMembers: post.tagged_members ? (post.tagged_members as any[]).map((member: any) => ({
    memberId: member.id,
    uuid: member.uuid,
    fullName: member.name
  })) : [],
  isLiked: likedPostIds.includes(post.post_id),
  sourceType: post.source_type ?? null,
  sourceSlug: post.source_slug ?? null,
  sourceTitle: post.source_title ?? null,
  sourceAuthor: post.source_author ?? null,
  // The essay's real read time, stamped when it was written. NOT derivable
  // from `body`, which for a blog is the ~630-char feed excerpt.
  sourceReadMinutes: post.source_read_minutes ?? null,
  sourceLocation: post.source_location ?? null,
  // Welfare-project write-up fields. `sourceStat` is the project's own
  // key_statistic sentence — the SHORT numeric ones are already promoted into
  // `stats` by the view, so the card shows this as prose only when it is too
  // long to have become a sticker.
  sourceSummary: post.source_summary ?? null,
  sourceStat: post.source_stat ?? null,
  sourceDate: post.source_date ?? null,
  featured: post.featured ?? false,
  stats: Array.isArray(post.stats) ? post.stats : [],
  scheduledFor: post.scheduled_for ?? null,
} as Post)

// changelog/22-social-engine.md §22.5 - three feed tabs, one query change.
export type FeedTab = 'foryou' | 'latest' | 'myteams'

// `team_uuid` ADDED to the original list (redesign 22.5) - unused by
// mapPostFromDB (an extra key it doesn't read), needed only so the "for
// you" tab's client-side bucketing can tell a post's team apart without a
// second query.
//
// APPROVED EXCEPTION to the redesign handoff's "no Supabase changes - no
// query, select() list, filter, RLS policy, service signature or return
// shape" invariant. The project owner authorised THIS change explicitly on
// 2026-09-06 ("Yes - make pinning work"): ContentManager's pin/feature
// toggles wrote `pinned`/`featured` that this projection then dropped, so a
// super admin could pin a post and nothing changed for any reader.
// The licence is narrow and covers exactly: adding `pinned`, `pinned_title`
// and `featured` here, excluding pinned rows from the ranged stream below,
// and hoisting them onto page 1. No RLS change, no new table, no other
// query extended, no service return shape broken.
const FEED_COLS =
  'post_id,uuid,category,body,link_url,link_title,link_image,status,created_at,author_id,author_uuid,author_name,author_avatar,author_role,team_uuid,like_count,comment_count,images,tagged_members,source_type,source_slug,source_title,source_author,source_read_minutes,source_location,stats,source_summary,source_stat,source_date,pinned,pinned_title,featured'

/** The feed's base query: published posts, newest first, post_id as the
 *  deterministic tie-break (see getFeed's own comment on the 541-posts-one-
 *  timestamp bulk import). Every tab's row-fetch starts here and adds its
 *  own filter/range on top.
 *
 *  Pinned posts are EXCLUDED here, on every page and every tab. That is what
 *  makes the page-1 hoist below safe: a hoisted post is never also inside
 *  the ranged set, so it cannot reappear on page 2, and because the
 *  exclusion is uniform across pages the offset/limit maths stays exact
 *  (`count` counts the same filtered set the ranges walk). `.not(is true)`
 *  rather than `.eq(false)` so a NULL `pinned` still counts as unpinned. */
function FEED_QUERY_BASE() {
  return supabaseCommunity
    .from('post_feed_view')
    .select(FEED_COLS, { count: 'exact' })
    .eq('status', 'published')
    .not('pinned', 'is', true)
    .order('created_at', { ascending: false })
    .order('post_id', { ascending: false })
}

/** The pinned block that rides above the chronological stream on page 1.
 *  A pin is an org-wide notice, so it hoists on every tab (my-teams
 *  included) rather than being filtered out by that tab's team predicate.
 *  Capped at 5, matching getPinnedPosts()'s own notice-board cap.
 *  Best-effort: a failure here degrades to a plain chronological feed. */
async function fetchPinnedRows(category?: string): Promise<any[]> {
  let q = supabaseCommunity
    .from('post_feed_view')
    .select(FEED_COLS)
    .eq('status', 'published')
    .eq('pinned', true)
    .order('created_at', { ascending: false })
    .order('post_id', { ascending: false })
    .limit(5)
  if (category) q = q.eq('category', category)
  const { data, error } = await q
  if (error) return []
  return data || []
}

/** Map + attach likes/documents for one page of raw post_feed_view rows -
 *  the shared tail every tab's query result runs through. Likes + documents
 *  both key off the same post ids and are independent of each other, so
 *  they run concurrently (was, before tabs existed: likes, then documents,
 *  a 3rd serial round trip). */
//
//  `pinnedRows` (page 1 only) are prepended to this page's rows. They are
//  deliberately NOT folded into `totalItems` for the paging maths: totalPages
//  / hasNextPage must stay derived from the *ranged* (pinned-excluded) count,
//  or an inflated total could invent a trailing page that returns no rows.
//  The reported `pagination.totalItems` still adds them back, so "584 posts"
//  remains the honest number rather than silently dropping the 2 pinned rows.
async function finishFeedPage(
  rows: any[] | null, totalItems: number, page: number, limit: number, memberId: number | null,
  pinnedRows: any[] = [],
): Promise<PaginatedResponse<Post>> {
  rows = [...pinnedRows, ...(rows || [])]
  const postIds = (rows || []).map((p: any) => p.post_id)
  const [likesRes, docRows] = await Promise.all([
    memberId && postIds.length
      ? supabaseCommunity.from('likes').select('post_id').eq('member_id', memberId).in('post_id', postIds)
      : Promise.resolve({ data: [] as any[] }),
    postIds.length ? fetchDocumentRows(postIds) : Promise.resolve([] as any[]),
  ])
  const likedPostIds: number[] = ((likesRes as any).data || []).map((l: any) => l.post_id)
  const mappedPosts = (rows || []).map((p: any) => mapPostFromDB(p, likedPostIds))
  attachDocumentRows(mappedPosts, docRows)
  const totalPages = Math.ceil(totalItems / limit)
  return {
    success: true,
    data: mappedPosts,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems: totalItems + pinnedRows.length,
      itemsPerPage: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  } as PaginatedResponse<Post>
}

/** This member's active team uuids. `post_feed_view` exposes `team_uuid`,
 *  not the numeric `team_id` team_members itself stores - both the "my
 *  teams" filter and the "for you" bucketing need uuids to match against it. */
async function getMyTeamUuids(memberId: number): Promise<string[]> {
  const { data, error } = await supabaseCommunity
    .from('team_members')
    .select('team:teams(uuid)')
    .eq('member_id', memberId)
    .eq('is_active', true)
  if (error || !data) return []
  const uuids = (data as any[]).map(r => r.team?.uuid).filter(Boolean)
  return Array.from(new Set(uuids)) as string[]
}

/** Team uuids this member FOLLOWS (public.team_follows), joined to their
 *  active-membership uuids above by the 'myteams' tab below. ADDED
 *  2026-09-14 (social-system IA audit): following a team previously did
 *  nothing to any feed - you had to actually join a team to see its posts
 *  in this tab, even though following a team is exactly the lightweight
 *  "show me their posts without joining" ask the follow button implies.
 *  Best-effort, same failure contract as getMyTeamUuids: a failed read
 *  degrades to "no followed teams", never a broken feed. */
async function getFollowedTeamUuids(memberId: number): Promise<string[]> {
  const { data, error } = await supabaseCommunity
    .from('team_follows' as any)
    .select('team:teams(uuid)')
    .eq('follower_id', memberId)
    .limit(500)
  if (error || !data) return []
  const uuids = (data as any[]).map(r => r.team?.uuid).filter(Boolean)
  return Array.from(new Set(uuids)) as string[]
}

/** Distinct author_ids behind this member's most recent 200 likes - "authors
 *  you have liked before" for the for-you bucket. Best-effort: a failure or
 *  an empty like history degrades to no personalization signal for this
 *  bucket, never a broken feed. */
async function getLikedAuthorIds(memberId: number): Promise<number[]> {
  const { data: likedPosts } = await supabaseCommunity
    .from('likes')
    .select('post_id')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (!likedPosts?.length) return []
  const { data: authored } = await supabaseCommunity
    .from('post_feed_view')
    .select('author_id')
    .in('post_id', likedPosts.map((l: any) => l.post_id))
  return Array.from(new Set((authored || []).map((a: any) => a.author_id).filter(Boolean))) as number[]
}

/** member_ids this member follows - the "for you" bucket's strongest signal,
 *  ranked above "authors you've liked before" (an inferred proxy) since a
 *  follow is an explicit "show me more of this person" request. Previously
 *  follows changed nothing about the feed at all (social-system IA audit,
 *  2026-09-14 finding) - the follow button did something to the notification
 *  the followee got, and nothing else. Best-effort, same failure contract as
 *  getLikedAuthorIds above. */
async function getFollowedAuthorIds(memberId: number): Promise<number[]> {
  const { data } = await supabaseCommunity
    .from('follows')
    .select('followee_id')
    .eq('follower_id', memberId)
    .limit(500)
  return Array.from(new Set((data || []).map((f: any) => f.followee_id).filter(Boolean))) as number[]
}

/** Fan out a 'new_post' notification to every follower of `authorId`. Capped
 *  at 500 followers (matching getFollowedAuthorIds' own cap on the read
 *  side) - past that this would need a batched/queued job, not a client-side
 *  fan-out, but no account here is anywhere near that scale. Best-effort:
 *  errors are swallowed (never surfaced to the post author, who has nothing
 *  to do about a notification delivery failure). */
async function notifyFollowersOfNewPost(authorId: number, authorName: string, postUuid: string): Promise<void> {
  try {
    const { data: followerRows } = await supabaseCommunity
      .from('follows')
      .select('follower_id')
      .eq('followee_id', authorId)
      .limit(500)
    const followerIds = (followerRows || []).map((f: any) => f.follower_id).filter(Boolean)
    if (followerIds.length === 0) return
    await Promise.all(followerIds.map((followerId: number) =>
      notificationService.create({
        memberId: followerId,
        type: 'new_post',
        title: `${authorName} published a new post`,
        link: `/post/${postUuid}`,
      })
    ))
  } catch (err) {
    console.error('[feedService] follower new-post fan-out failed:', err)
  }
}

const feedServiceImpl = {
  // Most-liked published posts from the last `days` days - one query, for the
  // "trending this week" rail. Falls back to an empty list on error so the rail
  // simply hides rather than breaking the page.
  async getTrending(params: { limit?: number; days?: number } = {}) {
    const limit = params.limit ?? 6
    const days = params.days ?? 7
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data, error } = await supabaseCommunity
      .from('post_feed_view')
      .select('post_id,uuid,category,body,link_url,link_title,link_image,status,created_at,author_id,author_uuid,author_name,author_avatar,author_role,like_count,comment_count,images,tagged_members,source_type,source_slug,source_title,source_author,source_read_minutes,source_location,stats,source_summary,source_stat,source_date')
      .eq('status', 'published')
      .gte('created_at', since)
      .order('like_count', { ascending: false })
      .limit(limit)
    if (error) return { success: false, data: [] as Post[] }
    return { success: true, data: (data || []).map((p: any) => mapPostFromDB(p, [])) }
  },

  // Category-only tally for the "trending this week" rail - the rail only
  // needs per-category post counts, so this pulls one tiny column instead of
  // 40 full feed rows (body, images, author…) like getTrending would.
  async getCategoryPulse(params: { days?: number; limit?: number } = {}) {
    const days = params.days ?? 7
    const since = new Date(Date.now() - days * 86400000).toISOString()
    const { data, error } = await supabaseCommunity
      .from('post_feed_view')
      .select('category')
      .eq('status', 'published')
      .gte('created_at', since)
      .limit(params.limit ?? 200)
    if (error) return { success: false, data: [] as { category: string | null }[] }
    return { success: true, data: (data || []) as { category: string | null }[] }
  },


  async getFeed(params: { page?: number; limit?: number; category?: string; tab?: FeedTab }) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit
    const tab: FeedTab = params.tab || 'latest'
    const memberId = await getCachedMemberId()

    // Page 1 carries the pinned block; pages 2+ never do (and FEED_QUERY_BASE
    // excludes pinned rows from every page), so a pinned post appears exactly
    // once in a full read of the feed.
    // STARTED, not awaited (audit 2026-09-17, efficiency P2). The pinned block
    // depends on nothing computed below - not the tab, not memberId, not the
    // team lists - so awaiting it here put a whole round trip in front of every
    // other query in the function, on the home page's critical path. Kicking it
    // off and awaiting it only where the rows are actually consumed lets it
    // overlap the team lookups and the main page query.
    const pinnedPromise: Promise<any[]> = page === 1
      ? fetchPinnedRows(params.category)
      : Promise.resolve([])

    // changelog/22-social-engine.md §22.5's "my teams" tab - a real
    // query-level filter, so it paginates exactly like 'latest' always has.
    // Empty-teams short-circuits before ever building the doomed `.in('team_
    // uuid', [])` query (PostgREST would 400 on an empty IN list).
    if (tab === 'myteams') {
      // "my teams" now means "teams I've joined OR teams I follow" - see
      // getFollowedTeamUuids above for why this widened 2026-09-14.
      const [joinedUuids, followedUuids] = memberId
        ? await Promise.all([getMyTeamUuids(memberId), getFollowedTeamUuids(memberId)])
        : [[] as string[], [] as string[]]
      const teamUuids = Array.from(new Set([...joinedUuids, ...followedUuids]))
      // A pin is an org-wide notice (see fetchPinnedRows above) and must
      // still hoist here even with zero teams - only the chronological
      // stream is empty, not the pinned block. Found 2026-09-08: this used
      // to be a bare emptyFeedPage(), silently dropping pins for exactly
      // the members with no teams yet.
      if (teamUuids.length === 0) return finishFeedPage([], 0, page, limit, memberId, await pinnedPromise)
      let query = FEED_QUERY_BASE().range(offset, offset + limit - 1).in('team_uuid', teamUuids)
      if (params.category) query = query.eq('category', params.category)
      const { data, error, count } = await query
      if (error) throw logSupabaseError('feedService.getFeed', error)
      return finishFeedPage(data, count || 0, page, limit, memberId, await pinnedPromise)
    }

    // §22.5's "for you" tab (the default): "your teams' posts, then authors
    // you follow, then authors you have liked before, then everything, each
    // bucket newest-first." ONE QUERY CHANGE, per the spec's own costing - a
    // slightly larger pool of the newest posts (still one call) is bucketed
    // and re-ordered client-side rather than standing up a ranking model or
    // a new RPC.
    //
    // The "authors you follow" bucket was ADDED 2026-09-14 (social-system IA
    // audit) between teams and liked-authors: a follow is an explicit "show
    // me more of them" signal, which previously changed nothing about this
    // feed at all - only the liked-authors proxy (an inferred signal) fed
    // ranking. A followed author who is also a liked author only counts
    // once, in the stronger (followed) bucket - see the per-row branch below.
    //
    // Deliberately page-1-only: re-deriving which posts have already been
    // "used" by an earlier page's bucketing, across pages, is exactly the
    // infinite-algorithmic-feed machinery the spec explicitly says NOT to
    // build here ("not meant to become an infinite algorithmic feed... the
    // load-more button stays as-is"). Page 2+ falls through to the same
    // plain chronological query 'latest' always ran - a post pulled forward
    // into page 1's re-ranked pool may, rarely, be skipped or repeated once
    // on page 2 as a result. Named, accepted tradeoff, not an oversight.
    if (tab === 'foryou' && page === 1) {
      const poolSize = Math.min(Math.max(limit * 3, 60), 100)
      let poolQuery = FEED_QUERY_BASE().range(0, poolSize - 1)
      if (params.category) poolQuery = poolQuery.eq('category', params.category)

      const [teamUuids, followedAuthorIds, likedAuthorIds, { data: pool, error, count }] = await Promise.all([
        memberId ? getMyTeamUuids(memberId) : Promise.resolve([] as string[]),
        memberId ? getFollowedAuthorIds(memberId) : Promise.resolve([] as number[]),
        memberId ? getLikedAuthorIds(memberId) : Promise.resolve([] as number[]),
        poolQuery,
      ])
      if (error) throw logSupabaseError('feedService.getFeed', error)

      const teamSet = new Set(teamUuids)
      const followedSet = new Set(followedAuthorIds)
      const likedSet = new Set(likedAuthorIds)
      const bucketTeams: any[] = []; const bucketFollowed: any[] = []; const bucketLiked: any[] = []; const bucketRest: any[] = []
      for (const row of (pool || [])) {
        if (row.team_uuid && teamSet.has(row.team_uuid)) bucketTeams.push(row)
        else if (row.author_id != null && followedSet.has(row.author_id)) bucketFollowed.push(row)
        else if (row.author_id != null && likedSet.has(row.author_id)) bucketLiked.push(row)
        else bucketRest.push(row)
      }
      const ranked = [...bucketTeams, ...bucketFollowed, ...bucketLiked, ...bucketRest].slice(0, limit)
      const result = await finishFeedPage(ranked, count || 0, page, limit, memberId, await pinnedPromise)

      // The backfill rule: "when the newest page returns fewer than 5 posts,
      // append the most-liked posts from the last 30 days under a divider."
      // One extra query, no ranking model - and only ever fired on this
      // tab's first page, matching 22.5's own framing of the rule as the fix
      // for a THIN "for you" page, not a general feed behaviour.
      if (result.data.length < 5) {
        const since = new Date(Date.now() - 30 * 86400000).toISOString()
        const already = new Set(result.data.map(p => p.postId))
        let backfillQuery = supabaseCommunity
          .from('post_feed_view')
          .select(FEED_COLS)
          .eq('status', 'published')
          // Same pinned exclusion FEED_QUERY_BASE applies - the backfill must
          // not re-introduce a post already hoisted to the top of this page.
          .not('pinned', 'is', true)
          .gte('created_at', since)
          .order('like_count', { ascending: false })
          .order('post_id', { ascending: false })
          .limit(10)
        if (params.category) backfillQuery = backfillQuery.eq('category', params.category)
        const { data: topLiked } = await backfillQuery
        const freshRows = (topLiked || []).filter((r: any) => !already.has(r.post_id))
        if (freshRows.length > 0) {
          const backfill = await finishFeedPage(freshRows, freshRows.length, page, limit, memberId)
          // Marks where the divider goes - HomePage.tsx renders one before
          // the first post carrying this flag. Not part of the `Post` type
          // (api.ts) since every other caller of getFeed has no use for it.
          backfill.data.forEach(p => { (p as any).isBackfill = true })
          return { ...result, data: [...result.data, ...backfill.data] }
        }
      }
      return result
    }

    // 'latest' (and 'foryou' page 2+): unchanged, exactly what shipped
    // before this tab existed.
    //
    // 541 posts share one identical created_at (a bulk welfare_projects
    // mirror-import timestamp) - ORDER BY created_at alone has no way to
    // break that tie, so Postgres is free to return a different relative
    // order/row-set for that tied block on every separate execution. Under
    // React 19 StrictMode's dev-only double-invoked mount effect, two
    // near-simultaneous calls to this exact query can each individually
    // come back clean but land different rows at the offset/limit boundary.
    // post_id (unique, stable) as a secondary key makes the ordering - and
    // therefore pagination - fully deterministic. Same pattern
    // PublicProjectsPage.tsx's own fetchPage already uses.
    let query = FEED_QUERY_BASE().range(offset, offset + limit - 1)
    if (params.category) query = query.eq('category', params.category)
    const { data: posts, error, count } = await query
    if (error) throw logSupabaseError('feedService.getFeed', error)
    return finishFeedPage(posts, count || 0, page, limit, memberId, await pinnedPromise)
  },

  async getPost(uuid: string) {
    const [{ data: post, error }, memberId] = await Promise.all([
      supabaseCommunity.from('post_feed_view').select(POST_DETAIL_COLS).eq('uuid', uuid).single(),
      getCachedMemberId(),
    ])
    if (error) throw logSupabaseError('feedService.getPost', error)

    let likedPostIds: number[] = []
    if (memberId && post) {
      // maybeSingle, not single - the common case is "viewer hasn't
      // liked this post", which .single() treats as an error (PGRST116)
      // and emits a 406 on every un-liked post view. maybeSingle returns
      // null cleanly.
      const { data: like } = await supabaseCommunity
        .from('likes')
        .select('post_id')
        .eq('member_id', memberId)
        .eq('post_id', (post as any).post_id)
        .maybeSingle()
      if (like) likedPostIds = [(like as any).post_id]
    }

    const mappedPost = mapPostFromDB(post as any, likedPostIds)
    await attachDocuments([mappedPost])
    return { success: true, data: { post: mappedPost } }
  },

  /**
   * Tag a post with one or more teams (post_teams, 2026-10-03). Works for every
   * way a post gets made, so it takes the post's uuid and is called after
   * creation. Idempotent: a team already on the post (including its primary
   * team, which a trigger mirrors in) is skipped rather than an error. RLS lets
   * only the post's author or a director write, and only as source 'author'.
   * Throws on failure; the caller decides how loudly to report a partial save.
   */
  async tagPostTeams(postUuid: string, teamIds: number[]): Promise<void> {
    const ids = [...new Set(teamIds)].filter(n => Number.isInteger(n) && n > 0)
    if (ids.length === 0) return
    const { data: post, error: postErr } = await supabaseCommunity
      .from('posts').select('post_id').eq('uuid', postUuid).maybeSingle()
    if (postErr) throw logSupabaseError('feedService.tagPostTeams', postErr)
    if (!post) throw new Error('Could not find the post to tag.')
    const { error } = await (supabaseCommunity.from('post_teams' as any) as any)
      .upsert(
        ids.map(team_id => ({ post_id: (post as any).post_id, team_id, source: 'author' })),
        { onConflict: 'post_id,team_id', ignoreDuplicates: true },
      )
    if (error) throw logSupabaseError('feedService.tagPostTeams', error)
  },

  async createPost(data: CreatePostData) {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    // Fetch role + name to determine auto-publish and to build notifications
    const { data: memberRow } = await supabaseCommunity
      .from('members')
      .select('member_id, role, full_name')
      .eq('member_id', memberId)
      .single()
    if (!memberRow) throw new Error('Member not found')

    // hasLeaderAccess, not a hand-written list: this one silently excluded
    // `hr` when that role was added.
    const isLeader = hasLeaderAccess(memberRow.role)

    // Leaders can schedule a post to auto-publish later; pg_cron flips it from
    // 'scheduled' → 'published' at scheduled_for.
    //
    // Two rules that must not be broken:
    //  1. forceReview ALWAYS wins. It's set when the obscenity filter flags the
    //     text, and the whole point is that even a leader's post is held for a
    //     human check — scheduling must not become a way to bypass moderation.
    //  2. Never silently downgrade a schedule request into an instant publish.
    //     Image/document uploads run before this call and can take minutes, so a
    //     time that was valid in the UI may have passed by now. Keeping it as
    //     'scheduled' means the cron publishes it within a minute, which matches
    //     what the author was told, instead of firing immediately.
    const requested = data.scheduledFor ? new Date(data.scheduledFor) : null
    const wantsSchedule = isLeader && requested !== null && !Number.isNaN(requested.getTime())
    const scheduledFor = (wantsSchedule && !data.forceReview) ? requested!.toISOString() : null
    const status = data.forceReview
      ? 'pending_review'
      : (scheduledFor ? 'scheduled' : (isLeader ? 'published' : 'pending_review'))

    // ── Post as the AquaTerra org account (super_admin only) ──────────────
    // A separate write path, not a parameter on the insert below: posts'
    // "Active members can insert posts" INSERT policy is
    //   WITH CHECK (author_id = get_current_member_id() AND ...active...)
    // - author_id can only ever be the caller's OWN member id via a direct
    // insert. post_images/post_documents' INSERT policies are stricter
    // still (no director/super-admin fallback at all), so even the
    // attachment inserts below would fail RLS if author_id were swapped
    // here. create_post_as_org() (scripts/post_as_org_account_2026_09.sql)
    // does the whole insert (post + images + documents + tags + category)
    // as a SECURITY DEFINER function instead.
    //
    // The isSuperAdmin() check here is defense-in-depth, not the real
    // boundary - the RPC re-checks is_super_admin() itself and resolves the
    // org account's member_id server-side from a fixed, hardcoded email
    // (never from a client-supplied id), so a forged flag from a
    // non-super-admin session throws inside the RPC rather than writing
    // anything under a spoofed author.
    if (data.postAsOrgAccount) {
      if (!isSuperAdmin(memberRow.role)) {
        throw new Error('Only a super admin can post as the AquaTerra org account')
      }

      const documentUrlsJson = (data.documentUrls ?? []).map(d => ({
        url: d.url, fileName: d.fileName, mimeType: d.mimeType, size: d.size,
      }))

      // Cast: create_post_as_org isn't in the generated RPC types yet (the
      // fn is created by scripts/post_as_org_account_2026_09.sql - see that
      // file for whether it has actually been applied live). If it hasn't
      // been applied, this throws a clear "function ... does not exist"
      // Postgres error, which the caller (CreatePostModal) surfaces as a
      // toast rather than silently no-op'ing.
      const { data: rpcRows, error: rpcError } = await (supabaseCommunity as any).rpc('create_post_as_org', {
        p_category: data.category,
        p_body: data.body,
        p_link_url: data.linkUrl ?? null,
        p_link_title: data.linkTitle ?? null,
        p_link_image: data.linkImage ?? null,
        p_stats: (data.stats ?? []).filter(s => s.value.trim() && s.label.trim()).slice(0, 2),
        p_status: status,
        p_scheduled_for: scheduledFor,
        p_image_urls: data.imageUrls?.length ? data.imageUrls : null,
        p_document_urls: documentUrlsJson.length ? documentUrlsJson : null,
        p_tagged_member_ids: data.taggedMemberIds?.length ? data.taggedMemberIds : null,
      })
      if (rpcError) throw logSupabaseError('feedService.createPost', rpcError)
      const created = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
      if (!created?.uuid) throw new Error('Post was not created')
      // create_post_as_org doesn't audit-log itself server-side - worth
      // tracking who used it, since the visible byline never names them.
      logAction('post_created_as_org', 'post', created.post_id, { status, category: data.category })

      // Same tag-notification guard as the normal path below - skip while
      // the post isn't visible yet (scheduled / pending_review).
      if (data.taggedMemberIds?.length && !scheduledFor && status !== 'pending_review') {
        const postLink = `/post/${created.uuid}`
        const subtitle = data.body?.slice(0, 140) ?? ''
        await Promise.all(
          data.taggedMemberIds.map(taggedId =>
            notificationService.create({
              memberId: taggedId,
              type: 'tag',
              // The visible author is AquaTerra here, not the signed-in
              // super_admin - the notification should say what the reader
              // will actually see on the post.
              title: 'AquaTerra tagged you in a post',
              subtitle,
              link: postLink,
            })
          )
        )
      }

      const result = await this.getPost(created.uuid)
      return { ...result, attachmentWarnings: [] as string[] }
    }

    // `stats` cast because the generated types predate posts_stat_blocks_2026_07.sql,
    // same as post_documents below (predates migration 013).
    const { data: post, error: postError } = await (supabaseCommunity.from('posts') as any)
      .insert({
        author_id: memberRow.member_id,
        category: data.category,
        body: data.body,
        link_url: data.linkUrl,
        link_title: data.linkTitle,
        link_image: data.linkImage,
        status,
        scheduled_for: scheduledFor,
        stats: (data.stats ?? []).filter(s => s.value.trim() && s.label.trim()).slice(0, 2),
      })
      .select()
      .single()

    if (postError) throw logSupabaseError('feedService.createPost', postError)

    // Insert images, documents, tags, and category in parallel. Each arm
    // resolves to a warning string on failure (or undefined on success/skip)
    // instead of only console.warn-ing, so a failed attachment insert can be
    // surfaced to the caller (see attachmentWarnings below) instead of
    // createPost() reporting plain success while an attachment silently
    // failed to save.
    const [imagesWarning, documentsWarning, tagsWarning, categoryWarning] = await Promise.all([
      data.imageUrls?.length
        ? supabaseCommunity.from('post_images').insert(
            data.imageUrls.map((url, index) => ({
              post_id: post.post_id,
              blob_url: url,
              blob_name: url.split('/').pop() || `image_${index}`,
              display_order: index
            }))
          ).then(({ error }) => {
            if (!error) return undefined
            console.warn('[feedService] post_images insert failed', post.post_id, error)
            return 'some photos failed to attach'
          })
        : Promise.resolve(undefined),

      // PDF / PPTX attachments - cast because types predate migration 013.
      data.documentUrls?.length
        ? (supabaseCommunity.from('post_documents' as any) as any).insert(
            data.documentUrls.map((doc: any, index: number) => ({
              post_id: post.post_id,
              blob_url: doc.url,
              blob_name: doc.url.split('/').pop() || `document_${index}`,
              file_name: doc.fileName,
              file_size: doc.size,
              mime_type: doc.mimeType,
              display_order: index,
            }))
          ).then(({ error }: any) => {
            if (!error) return undefined
            console.warn('[feedService] post_documents insert failed', post.post_id, error)
            return 'some files failed to attach'
          })
        : Promise.resolve(undefined),

      data.taggedMemberIds?.length
        ? supabaseCommunity.from('post_tags').insert(
            data.taggedMemberIds.map(id => ({
              post_id: post.post_id,
              tagged_member_id: id
            }))
          ).then(({ error }: any) => {
            if (!error) return undefined
            console.warn('[feedService] post_tags insert failed', post.post_id, error)
            return 'some tagged people failed to save'
          })
        : Promise.resolve(undefined),

      // post_categories has a CHECK constraint (events|welfare|content|operations|labs)
      // and a UNIQUE (post_id, category). Best-effort insert - never blocks
      // post creation if the category isn't in the denormalized allow-list
      // or the row already exists.
      supabaseCommunity.from('post_categories').insert({
        post_id: post.post_id,
        category: data.category
      }).then(({ error }) => {
        if (!error || error.code === '23505' || error.code === '23514') return undefined
        console.warn('[post_categories] insert failed:', error.message)
        return 'category tagging failed to save'
      }),
    ])

    // Any of the four best-effort inserts above may have failed without
    // throwing (these arms deliberately never throw, so one bad attachment
    // can't fail the whole post) - collect them instead of staying silent.
    const attachmentWarnings = [imagesWarning, documentsWarning, tagsWarning, categoryWarning]
      .filter((w): w is string => !!w)

    // ── Fire tag notifications (non-blocking, never throws) ──
    // Skip for scheduled AND pending_review posts — in both cases the post
    // isn't visible yet (RLS blocks a tagged member's read via post_feed_view
    // until it's published/approved), so a "tagged you" link would dead-end
    // into PostPage's not-found state. Found 2026-09-08: this used to only
    // guard on `scheduledFor`, so a non-leader's post (which defaults to
    // pending_review) fired the notification immediately - the one case this
    // guard exists for. The tag rows are still inserted either way, so the
    // tag shows on the post (and the member's tagged tab) once it goes live.
    if (data.taggedMemberIds?.length && !scheduledFor && status !== 'pending_review') {
      const postLink = `/post/${post.uuid}`
      const subtitle = data.body?.slice(0, 140) ?? ''
      await Promise.all(
        data.taggedMemberIds.map(taggedId =>
          notificationService.create({
            memberId: taggedId,
            type: 'tag',
            title: `${memberRow.full_name} tagged you in a post`,
            subtitle,
            link: postLink,
          })
        )
      )
    }

    // ── Notify followers of a genuinely new, immediately-visible post ──
    // Fire-and-forget, same contract as toggleLike's like notification below:
    // never block the create-post response on this fan-out. Skipped for
    // scheduled/pending_review posts for the same reason tag notifications
    // are - the post isn't visible yet, so a "new post" link would dead-end.
    // ADDED 2026-09-14 (social-system IA audit): following someone previously
    // changed nothing for the follower at all - not the feed (see
    // getFollowedAuthorIds above), not notifications either.
    if (status === 'published') {
      void notifyFollowersOfNewPost(memberRow.member_id, memberRow.full_name, post.uuid)
    }

    const result = await this.getPost(post.uuid)
    return { ...result, attachmentWarnings }
  },

  async toggleLike(uuid: string, knownPostId?: number, knownLikeCount?: number) {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    // Use caller-provided postId if available to skip a roundtrip
    let postId: number
    if (knownPostId) {
      postId = knownPostId
    } else {
      const { data: post } = await supabaseCommunity.from('posts').select('post_id').eq('uuid', uuid).single()
      if (!post) throw new Error('Post not found')
      postId = (post as any).post_id as number
    }

    // Check existing like and toggle in parallel-friendly sequence
    const { data: existingLike } = await supabaseCommunity
      .from('likes')
      .select('like_id')
      .eq('post_id', postId)
      .eq('member_id', memberId)
      .maybeSingle()

    // Every caller already renders a like count for this post before the user
    // clicks - use it instead of an extra exact-count round trip. Only fall
    // back to a real query if a caller genuinely doesn't have one.
    let totalBefore: number
    if (knownLikeCount != null) {
      totalBefore = knownLikeCount
    } else {
      const { count } = await supabaseCommunity
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId as number)
      totalBefore = count || 0
    }

    let liked = false
    if (existingLike) {
      const { error } = await supabaseCommunity.from('likes').delete().eq('like_id', (existingLike as any).like_id)
      if (error) throw logSupabaseError('feedService.toggleLike', error)
    } else {
      const { error } = await supabaseCommunity.from('likes').insert({ post_id: postId as number, member_id: memberId as number })
      if (error) throw logSupabaseError('feedService.toggleLike', error)
      liked = true
    }

    const likeCount = Math.max(0, (totalBefore || 0) + (liked ? 1 : -1))

    // ── Notify post author when liked (skip on unlike + skip self-likes via service) ──
    // Fire-and-forget: don't block the toggleLike response on the notification lookups/creation.
    if (liked) {
      void (async () => {
        try {
          const [{ data: actor }, { data: postRow }] = await Promise.all([
            supabaseCommunity.from('members').select('full_name').eq('member_id', memberId).single(),
            supabaseCommunity.from('posts').select('author_id, uuid, body').eq('post_id', postId).single(),
          ])
          if (postRow && actor) {
            await notificationService.create({
              memberId: (postRow as any).author_id,
              type: 'like',
              title: `${(actor as any).full_name} liked your post`,
              subtitle: ((postRow as any).body as string)?.slice(0, 140),
              link: `/post/${(postRow as any).uuid}`,
            })
          }
        } catch (err) {
          console.error('[toggleLike] notification failed:', err)
        }
      })()
    }

    return { success: true, data: { liked, likeCount } }
  },

  async getLikers(uuid: string, params: { page?: number; limit?: number } = {}) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    const { data: post } = await supabaseCommunity
      .from('posts')
      .select('post_id')
      .eq('uuid', uuid)
      .single()

    if (!post) throw new Error('Post not found')

    const { data: likes, error, count } = await supabaseCommunity
      .from('likes')
      .select(`
        created_at,
        members!member_id (
          member_id,
          uuid,
          full_name,
          avatar_url,
          class_grade,
          role
        )
      `, { count: 'exact' })
      .eq('post_id', post.post_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw logSupabaseError('feedService.getLikers', error)

    const mappedLikers = (likes || []).map((like: any) => ({
      memberId: like.members.member_id,
      uuid: like.members.uuid,
      fullName: like.members.full_name,
      avatarUrl: like.members.avatar_url,
      classGrade: like.members.class_grade,
      role: like.members.role,
      likedAt: like.created_at
    }))

    const totalItems = count || 0
    const totalPages = Math.ceil(totalItems / limit)

    return {
      success: true,
      data: mappedLikers,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }
  },

  async deletePost(uuid: string) {
    // Soft delete - migration 012 added posts.deleted_at and post_feed_view
    // (the read path for the feed/search/content-manager) already filters
    // deleted_at IS NULL. A hard `.delete()` no longer matches that model
    // and is blocked, so it silently deleted nothing. `.select()` so an
    // RLS-blocked (or otherwise no-op) write still surfaces as a real error.
    const { data, error } = await supabaseCommunity
      .from('posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('uuid', uuid)
      .select('post_id')

    if (error) throw logSupabaseError('feedService.deletePost', error)
    if (!data || data.length === 0) {
      throw new Error("Couldn't delete this post - you may not have permission.")
    }

    return { success: true, message: 'Post deleted successfully' }
  },

  /**
   * Edit a post in place.
   *
   * `status` was ADDED for "edit and resubmit" (feed/MyPostsPage.tsx →
   * CreatePostModal in edit mode) and is deliberately narrowed to the single
   * literal 'pending_review'. Both existing callers
   * (`director/ContentManager.tsx`, `feed/PostPage.tsx`) omit it and are
   * unaffected; the return shape is unchanged.
   *
   * 'pending_review' is the only value a member could set anyway. The live
   * policy "Authors can update pending posts" is
   *   USING (author_id = get_current_member_id()
   *          AND status = ANY (ARRAY['pending_review','rejected']))
   * with a NULL WITH CHECK, so Postgres applies USING to the NEW row too:
   * a member may move their own row between pending_review and rejected and
   * nowhere else. Widening this union would not widen access (RLS would reject
   * it) but it would make the intent unclear, so it stays a single literal.
   *
   * Resubmitting also clears the moderation verdict — a post carrying last
   * round's rejection note while sitting in the queue as "pending" is a lie to
   * both the member and the next moderator.
   */
  async updatePost(uuid: string, data: { body?: string; category?: string; status?: 'pending_review' }) {
    const { data: rows, error } = await supabaseCommunity
      .from('posts')
      .update({
        ...(data.body !== undefined ? { body: data.body } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.status !== undefined
          ? { status: data.status, rejection_note: null, reviewed_by: null, reviewed_at: null }
          : {}),
      })
      .eq('uuid', uuid)
      .select('post_id')

    if (error) throw logSupabaseError('feedService.updatePost', error)
    if (!rows || rows.length === 0) {
      throw new Error("Couldn't update this post - you may not have permission.")
    }

    return { success: true, message: 'Post updated successfully' }
  },

  async pinPost(uuid: string, pinned: boolean, pinnedTitle?: string) {
    const { data: rows, error } = await supabaseCommunity
      .from('posts')
      .update({
        pinned,
        pinned_title: pinned ? (pinnedTitle || null) : null,
      })
      .eq('uuid', uuid)
      .select('post_id')

    if (error) throw logSupabaseError('feedService.pinPost', error)
    if (!rows || rows.length === 0) {
      throw new Error("Couldn't update the notice board - you may not have permission.")
    }

    return { success: true, message: pinned ? 'Post pinned to notice board' : 'Post unpinned' }
  },

  /** Feature/unfeature a post on the Projects/Directory page's "featured drives"
      band. Distinct from pinPost (which drives the home notice ticker) - see
      posts_featured_flag_2026_07.sql. Requires that migration to have run. */
  async featurePost(uuid: string, featured: boolean) {
    const { data: rows, error } = await supabaseCommunity
      .from('posts')
      .update({ featured } as any)
      .eq('uuid', uuid)
      .select('post_id')

    if (error) throw logSupabaseError('feedService.featurePost', error)
    if (!rows || rows.length === 0) {
      throw new Error("Couldn't update the featured drives - you may not have permission.")
    }

    return { success: true, message: featured ? 'Featured on the Projects page' : 'Removed from featured' }
  },

  async getPinnedPosts() {
    const { data, error } = await supabaseCommunity
      .from('posts')
      .select(`
        post_id, uuid, body, category, status, created_at,
        pinned, pinned_title,
        members!posts_author_id_fkey (
          uuid, full_name, avatar_url
        )
      `)
      .eq('status', 'published')
      .eq('pinned', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) throw logSupabaseError('feedService.getPinnedPosts', error)

    const mapped = (data || []).map((p: any) => ({
      uuid: p.uuid,
      category: p.category || 'welfare',
      body: p.body || '',
      pinnedTitle: p.pinned_title || null,
      authorName: p.members?.full_name || 'AquaTerra',
      authorUuid: p.members?.uuid || '',
      authorAvatar: p.members?.avatar_url || null,
      createdAt: p.created_at,
    }))

    return { success: true, data: mapped }
  },

  async searchMembers(query: string) {
    const { data, error } = await supabaseCommunity
      .from('members')
      // class_grade (not email) is the disambiguator here — member email is PII
      // and must not ship to every member composing a post (see H3/audit).
      .select('member_id, uuid, full_name, avatar_url, class_grade, role')
      .eq('status', 'active')
      .ilike('full_name', `%${query}%`)
      .limit(10)

    if (error) throw logSupabaseError('feedService.searchMembers', error)

    const mappedMembers = data.map(m => ({
      memberId: m.member_id,
      uuid: m.uuid,
      fullName: m.full_name,
      avatarUrl: m.avatar_url ?? undefined,
      classGrade: (m as any).class_grade ?? undefined,
      role: m.role
    }))

    return { success: true, data: { members: mappedMembers } }
  },

  async getComments(postUuid: string, params: { page?: number; limit?: number; postId?: number } = {}) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    let postId: number
    if (params.postId) {
      postId = params.postId
    } else {
      const { data: post, error: postError } = await supabaseCommunity
        .from('posts').select('post_id').eq('uuid', postUuid).single()
      if (postError || !post) throw new Error('Post not found')
      postId = (post as any).post_id as number
    }

    const { data: comments, error, count } = await supabaseCommunity
      .from('comments')
      .select(`
        comment_id, uuid, body, created_at, parent_comment_id,
        author:members!author_id(member_id, uuid, full_name, avatar_url, role)
      `, { count: 'exact' })
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw logSupabaseError('feedService.getComments', error)

    // parentAuthorName is resolved from THIS page only - a reply to a
    // comment that loaded on an earlier page (before "load more" was
    // clicked) shows no name here, just falls back to a bare indent in the
    // UI. Good enough for a flat, oldest-first paginated thread: chasing the
    // true global parent would mean an extra query per reply.
    const byId = new Map((comments || []).map((c: any) => [c.comment_id, c]))
    return {
      success: true,
      data: (comments || []).map((c: any) => {
        const parent = c.parent_comment_id != null ? byId.get(c.parent_comment_id) : null
        return {
          commentId: c.comment_id,
          uuid: c.uuid,
          body: c.body,
          createdAt: c.created_at,
          authorId: c.author?.member_id,
          authorUuid: c.author?.uuid,
          authorName: c.author?.full_name || 'Member',
          authorAvatar: c.author?.avatar_url || null,
          authorRole: c.author?.role || 'member',
          parentCommentId: c.parent_comment_id ?? null,
          parentAuthorName: parent?.author?.full_name ?? null,
        }
      }),
      pagination: {
        currentPage: page,
        totalItems: count || 0,
        hasNextPage: (count || 0) > page * limit,
      }
    }
  },

  async addComment(postUuid: string, body: string, knownPostId?: number, parentCommentId?: number | null) {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    let postId: number
    if (knownPostId) {
      postId = knownPostId
    } else {
      const { data: postRow } = await supabaseCommunity.from('posts').select('post_id').eq('uuid', postUuid).single()
      if (!postRow) throw new Error('Post not found')
      postId = (postRow as any).post_id as number
    }

    const { data: comment, error } = await supabaseCommunity
      .from('comments')
      .insert({
        post_id: postId as number,
        author_id: memberId as number,
        body: body.trim(),
        parent_comment_id: parentCommentId ?? null,
      } as any)
      .select(`
        comment_id, uuid, body, created_at, parent_comment_id,
        author:members!author_id(member_id, uuid, full_name, avatar_url, role)
      `)
      .single()

    if (error) throw logSupabaseError('feedService.addComment', error)

    const authorName = (comment as any).author?.full_name || 'Someone'

    // ── Notify the post author about the new comment ──
    const { data: postRow } = await supabaseCommunity
      .from('posts')
      .select('author_id, uuid, body')
      .eq('post_id', postId)
      .single()
    if (postRow) {
      await notificationService.create({
        memberId: (postRow as any).author_id,
        type: 'comment',
        title: `${authorName} commented on your post`,
        subtitle: body.trim().slice(0, 140),
        link: `/post/${(postRow as any).uuid}`,
      })
    }

    // ── Also notify the PARENT COMMENT's author when this is a reply ──
    // ADDED 2026-09-14 (social-system IA audit): a reply previously notified
    // only the post's author (the block above), never the person actually
    // being replied to - so "@name, here's my answer" could sit unseen by
    // "name" forever unless they also happened to be the post's author.
    // Guarded against double-notifying the post author (already covered
    // above) and against notifying yourself (notificationService.create's
    // own self-skip also covers this, kept explicit here for clarity).
    if (parentCommentId != null && postRow) {
      const { data: parentRow } = await supabaseCommunity
        .from('comments')
        .select('author_id')
        .eq('comment_id', parentCommentId)
        .maybeSingle()
      const parentAuthorId = (parentRow as any)?.author_id
      if (parentAuthorId && parentAuthorId !== memberId && parentAuthorId !== (postRow as any).author_id) {
        await notificationService.create({
          memberId: parentAuthorId,
          type: 'comment',
          title: `${authorName} replied to your comment`,
          subtitle: body.trim().slice(0, 140),
          link: `/post/${(postRow as any).uuid}`,
        })
      }
    }

    return {
      success: true,
      data: {
        commentId: (comment as any).comment_id,
        uuid: (comment as any).uuid,
        body: (comment as any).body,
        createdAt: (comment as any).created_at,
        authorId: (comment as any).author?.member_id,
        authorUuid: (comment as any).author?.uuid,
        authorName: (comment as any).author?.full_name || 'Member',
        authorAvatar: (comment as any).author?.avatar_url || null,
        authorRole: (comment as any).author?.role || 'member',
        parentCommentId: (comment as any).parent_comment_id ?? null,
      }
    }
  },

  async deleteComment(commentUuid: string) {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    const { data: member } = await supabaseCommunity
      .from('members')
      .select('member_id, role')
      .eq('member_id', memberId)
      .single()
    if (!member) throw new Error('Member not found')

    const isLeader = hasLeaderAccess(member.role)

    // Leaders can delete any comment; members can only delete their own.
    // `.select()` to detect an RLS-blocked / no-match delete (no error +
    // zero rows) so the UI doesn't falsely report the comment removed.
    let query = supabaseCommunity.from('comments').delete().eq('uuid', commentUuid)
    if (!isLeader) {
      query = query.eq('author_id', member.member_id) as any
    }

    const { data, error } = await query.select('comment_id')
    if (error) throw logSupabaseError('feedService.deleteComment', error)
    if (!data || data.length === 0) {
      throw new Error("Couldn't delete this comment - you may not have permission.")
    }
    return { success: true }
  },

  async uploadImages(files: File[]) {
    const { data: { session } } = await supabaseCommunity.auth.getSession()
    if (!session?.user) throw new Error('Not authenticated')
    const userId = session.user.id

    const images = await Promise.all(files.map(async (original) => {
      // Downscale in the browser first (see lib/resizeImage.ts): Supabase
      // storage has no render-time transform on this project, so whatever we
      // upload here is exactly what every feed card ships. Never throws -
      // returns the original file if the resize can't be done.
      const file = await resizeForUpload(original, 'post')
      const ext = file.name.split('.').pop()
      const fileName = `${userId}/${crypto.randomUUID()}.${ext}`

      const { data, error } = await supabaseCommunity.storage
        .from('post-images')
        .upload(fileName, file)

      if (error) throw logSupabaseError('feedService.uploadImages', error)

      const { data: { publicUrl } } = supabaseCommunity.storage
        .from('post-images')
        .getPublicUrl(data.path)

      return { url: publicUrl, name: file.name, size: file.size }
    }))

    return { success: true, data: { images } }
  },

  /**
   * Upload PDF / PPTX attachments via Supabase Storage. Mirrors the
   * image-upload contract so CreatePostModal can use them interchangeably.
   *
   * Bucket: `post-documents`. The bucket needs to exist in Supabase with
   * appropriate RLS allowing authenticated INSERT + public SELECT. If it
   * doesn't exist yet, create it via the Supabase dashboard or apply:
   *
   *   INSERT INTO storage.buckets (id, name, public) VALUES
   *     ('post-documents', 'post-documents', true);
   *
   * The frontend mimetype filter on the file input restricts uploads to
   * PDF / PPTX before they ever hit the bucket; we still pass the original
   * filename + mimetype through so post_documents can store them for UI.
   */
  async uploadDocuments(files: File[]) {
    const { data: { session } } = await supabaseCommunity.auth.getSession()
    if (!session?.user) throw new Error('Not authenticated')
    const userId = session.user.id

    const documents = await Promise.all(files.map(async (file) => {
      const ext = file.name.split('.').pop()
      const fileName = `${userId}/${crypto.randomUUID()}.${ext}`

      const { data, error } = await supabaseCommunity.storage
        .from('post-documents')
        .upload(fileName, file, { contentType: file.type })

      if (error) throw logSupabaseError('feedService.uploadDocuments', error)

      const { data: { publicUrl } } = supabaseCommunity.storage
        .from('post-documents')
        .getPublicUrl(data.path)

      return {
        url: publicUrl,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      }
    }))

    return { success: true, data: { documents } }
  },
}

export const feedService = withFunctionLogging('feedService', feedServiceImpl)

export default feedService
