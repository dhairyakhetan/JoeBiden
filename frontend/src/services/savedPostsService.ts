import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import { attachDocuments } from '../lib/postDocuments'
import { Post } from './api'
import { POST_FEED_COLS } from './profileService'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

// ─────────────────────────────────────────────────────────────────────────────
// savedPostsService - real cross-device bookmarks via public.saved_posts.
// Schema: saved_posts(saved_id, member_id, post_id, created_at)
// UNIQUE (member_id, post_id). RLS: only the saver can read/insert/delete.
// ─────────────────────────────────────────────────────────────────────────────

const mapPost = (p: any, likedPostIds: number[]): Post => ({
  postId: p.post_id,
  uuid: p.uuid,
  category: p.category,
  body: p.body,
  linkUrl: p.link_url,
  linkTitle: p.link_title,
  linkImage: p.link_image,
  status: p.status,
  // redesign 08.4's kind filter (posts/drives/openings) reads this - a saved
  // welfare-project or job-opening mirror carries the matching source_type,
  // a native post carries null (see POST_FEED_COLS/api.ts).
  sourceType: p.source_type ?? null,
  // Both needed because sourceType above sends a saved essay to C06: without
  // the title the card rendered an EMPTY <h3>, and without the stored read
  // time it fell back to a word count over the 630-char excerpt - "1 min
  // read" for a 7-minute essay, the exact figure the migration corrected.
  sourceTitle: p.source_title ?? null,
  sourceReadMinutes: p.source_read_minutes ?? null,
  createdAt: p.created_at,
  authorId: p.author_id,
  authorUuid: p.author_uuid,
  authorName: p.author_name,
  authorAvatar: p.author_avatar,
  authorRole: p.author_role,
  likeCount: p.like_count ?? 0,
  commentCount: p.comment_count ?? 0,
  images: p.images ? (p.images as any[]).map((img: any) => ({
    blobUrl: img.url,
    displayOrder: img.order,
  })) : [],
  taggedMembers: p.tagged_members ? (p.tagged_members as any[]).map((m: any) => ({
    memberId: m.id,
    uuid: m.uuid,
    fullName: m.name,
  })) : [],
  isLiked: likedPostIds.includes(p.post_id),
})

const savedPostsServiceImpl = {
  /** Save (bookmark) a post for the current member. Idempotent. */
  async save(postId: number) {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    const { error } = await supabaseCommunity
      .from('saved_posts')
      .insert({ member_id: memberId, post_id: postId })

    if (error && (error as any).code !== '23505') throw error
    return { success: true }
  },

  /** Remove a bookmark. Idempotent. */
  async unsave(postId: number) {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    const { error } = await supabaseCommunity
      .from('saved_posts')
      .delete()
      .eq('member_id', memberId)
      .eq('post_id', postId)

    if (error) throw logSupabaseError('savedPostsService.unsave', error)
    return { success: true }
  },

  /** Toggle the bookmark and return the resulting state. */
  async toggle(postId: number): Promise<{ saved: boolean }> {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    const { data: existing } = await supabaseCommunity
      .from('saved_posts')
      .select('saved_id')
      .eq('member_id', memberId)
      .eq('post_id', postId)
      .maybeSingle()

    if (existing) {
      await this.unsave(postId)
      return { saved: false }
    }
    await this.save(postId)
    return { saved: true }
  },

  /** Set of post_ids that the current member has bookmarked (from a given candidate list). */
  async getSavedSet(postIds: number[]): Promise<Set<number>> {
    const memberId = await getCachedMemberId()
    if (!memberId || postIds.length === 0) return new Set()

    const { data, error } = await supabaseCommunity
      .from('saved_posts')
      .select('post_id')
      .eq('member_id', memberId)
      .in('post_id', postIds)

    if (error) return new Set()
    return new Set((data ?? []).map((r: any) => r.post_id as number))
  },

  /** Full paginated list of the current member's saved posts. */
  async getSavedPosts(params: { page?: number; limit?: number } = {}) {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    const page = params.page ?? 1
    const limit = params.limit ?? 20
    const offset = (page - 1) * limit

    // Pull saved rows in newest-first order, joining the published post via the feed view.
    const { data: rows, error, count } = await supabaseCommunity
      .from('saved_posts')
      .select('post_id, created_at', { count: 'exact' })
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw logSupabaseError('savedPostsService.getSavedPosts', error)

    const postIds = (rows ?? []).map(r => r.post_id as number)
    if (postIds.length === 0) {
      return {
        success: true,
        data: [] as Post[],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: count ?? 0,
          itemsPerPage: limit,
          hasNextPage: false,
          hasPrevPage: page > 1,
        },
      }
    }

    // Posts and the member's likes both key only on postIds - fetch them in
    // parallel (one RTT) rather than back-to-back (two RTTs to Tokyo).
    const [{ data: posts }, { data: likedRows }] = await Promise.all([
      // mapPost above reads exactly the shared POST_FEED_COLS projection.
      supabaseCommunity.from('post_feed_view').select(POST_FEED_COLS).in('post_id', postIds),
      supabaseCommunity.from('likes').select('post_id').eq('member_id', memberId).in('post_id', postIds),
    ])

    // Preserve saved-at order
    const order = new Map(postIds.map((id, i) => [id, i]))
    const orderedPosts = (posts ?? []).slice().sort((a: any, b: any) =>
      (order.get(a.post_id) ?? 0) - (order.get(b.post_id) ?? 0)
    )

    const likedPostIds = (likedRows ?? []).map((l: any) => l.post_id as number)

    const totalItems = count ?? 0
    const totalPages = Math.ceil(totalItems / limit)

    const mappedPosts = orderedPosts.map((p: any) => mapPost(p, likedPostIds))
    await attachDocuments(mappedPosts)
    return {
      success: true,
      data: mappedPosts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    }
  },
}

export const savedPostsService = withFunctionLogging('savedPostsService', savedPostsServiceImpl)

export default savedPostsService
