import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import { withFunctionLogging } from '../lib/functionLog'

// ─────────────────────────────────────────────────────────────────────────────
// notificationService - real notifications via public.notifications.
// Schema: notifications(id uuid, member_id int, type text, title text,
//                       subtitle text?, full_note text?, link text?,
//                       is_read bool, created_at timestamptz)
// RLS: a member can read/update only their own rows; insert is allowed for any
//      authenticated user (so service code can write notifications targeted at
//      another member when they like / comment / tag / follow).
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType =
  | 'like'
  | 'comment'
  | 'tag'
  | 'follow'
  /** A member you follow published a new post. Fired from feedService.
   *  createPost, fan-out to that author's followers - not in create_
   *  notification()'s leader-only allow-list (same unrestricted branch as
   *  like/comment/follow/tag), since the sender is reporting their OWN new
   *  post, not impersonating a leader. */
  | 'new_post'
  | 'post_approved'
  | 'post_rejected'
  | 'team_invite'
  | 'team_join_request'
  | 'team_join_accepted'
  | 'system'
  /** changelog/16-profile-wall.md §16.4. Not in create_notification()'s
   *  leader-only allow-list, so any authenticated member can fire one (the
   *  RPC's default, unrestricted branch) - batched server-side to one row
   *  per recipient per hour regardless of how many notes arrive. */
  | 'wall_note'
  /** A member set their own break (breakService.setBreak) and this tells
   *  HR/super_admin about it. Not in create_notification()'s restricted-type
   *  list either, for the same reason wall_note isn't - the sender is
   *  reporting their OWN action, not impersonating a leader, so it falls
   *  into the RPC's default unrestricted branch. */
  | 'break_set'

export interface NotificationRow {
  id: string
  memberId: number
  type: NotificationType
  title: string
  subtitle?: string | null
  fullNote?: string | null
  link?: string | null
  isRead: boolean
  createdAt: string
}

interface CreateNotificationInput {
  memberId: number          // recipient
  type: NotificationType
  title: string
  subtitle?: string
  fullNote?: string
  link?: string
}

const mapRow = (r: any): NotificationRow => ({
  id: r.id,
  memberId: r.member_id,
  type: r.type as NotificationType,
  title: r.title,
  subtitle: r.subtitle ?? null,
  fullNote: r.full_note ?? null,
  link: r.link ?? null,
  isRead: r.is_read,
  createdAt: r.created_at,
})

// Shared unread-count cache - see getUnreadCount below for why.
const UNREAD_TTL_MS = 15_000
let _unreadValue: number | null = null
let _unreadAt = 0
let _unreadInFlight: Promise<number> | null = null

/**
 * Drop the cached unread count. Called by every write that changes it, and on
 * sign-out, so the next reader refetches rather than trusting a stale badge.
 */
export function invalidateUnreadCount(): void {
  _unreadValue = null
  _unreadAt = 0
}

supabaseCommunity.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') invalidateUnreadCount()
})

const notificationServiceImpl = {
  /** List notifications for the current member, newest first. */
  async list(params: { limit?: number; offset?: number; unreadOnly?: boolean } = {}) {
    const memberId = await getCachedMemberId()
    if (!memberId) return { items: [] as NotificationRow[], totalUnread: 0 }

    const limit = params.limit ?? 50
    const offset = params.offset ?? 0

    let query = supabaseCommunity
      .from('notifications')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (params.unreadOnly) query = query.eq('is_read', false)

    // Run the list and the unread count in parallel - they were previously
    // two sequential awaits (each a full round trip to a cross-region
    // project, per FormResponses.tsx's own measured ~450-500ms/query note),
    // which is exactly why this page could feel slow to open for no reason:
    // the count query doesn't depend on the list query's result at all.
    const [{ data, error }, { count: unreadCount }] = await Promise.all([
      query,
      supabaseCommunity
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', memberId)
        .eq('is_read', false),
    ])
    if (error) throw error

    return {
      items: (data ?? []).map(mapRow),
      totalUnread: unreadCount ?? 0,
    }
  },

  /**
   * Unread badge count for the nav bar, deduped.
   *
   * THREE components ask for this - AQNav, MobileMenuBar, and the desk's rail -
   * and all three re-asked on every client-side route change, so a single
   * navigation in the signed-in app fired two byte-identical count queries
   * (three on /director). The results were independent state too, so the phone
   * bar and the nav bar could briefly disagree.
   *
   * An in-flight promise collapses concurrent callers onto one request, and a
   * short TTL collapses the rapid-fire repeats a route change produces. The
   * window is deliberately small: this is a badge, and any write that changes
   * it calls invalidateUnreadCount() below, so a stale number cannot outlive
   * the action that changed it.
   */
  async getUnreadCount(): Promise<number> {
    const now = Date.now()
    if (_unreadValue !== null && now - _unreadAt < UNREAD_TTL_MS) return _unreadValue
    if (_unreadInFlight) return _unreadInFlight

    _unreadInFlight = (async () => {
      try {
        const memberId = await getCachedMemberId()
        if (!memberId) return 0
        const { count } = await supabaseCommunity
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('member_id', memberId)
          .eq('is_read', false)
        _unreadValue = count ?? 0
        _unreadAt = Date.now()
        return _unreadValue
      } finally {
        _unreadInFlight = null
      }
    })()
    return _unreadInFlight
  },

  /** Mark a single notification as read. */
  async markRead(id: string) {
    const { error } = await supabaseCommunity
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
    if (error) throw error
    invalidateUnreadCount()
  },

  /**
   * Mark a set of notifications read in ONE request.
   *
   * The rolled-up rows on NotificationsPage stand for every underlying
   * notification in the digest, and tapping one used to fire a separate PATCH
   * per row - a few dozen concurrent writes for a single tap on a post that
   * collected a few dozen likes, with a rollback that restored all of them if
   * any one failed.
   */
  async markManyRead(ids: string[]) {
    if (ids.length === 0) return
    const { error } = await supabaseCommunity
      .from('notifications')
      .update({ is_read: true })
      .in('id', ids)
    if (error) throw error
    invalidateUnreadCount()
  },

  /** Mark all of the current member's notifications as read. */
  async markAllRead() {
    const memberId = await getCachedMemberId()
    if (!memberId) return
    const { error } = await supabaseCommunity
      .from('notifications')
      .update({ is_read: true })
      .eq('member_id', memberId)
      .eq('is_read', false)
    if (error) throw error
    invalidateUnreadCount()
  },

  /**
   * changelog/22-social-engine.md §22.2's likes digest, made real rather than
   * assumed. `create_notification()` (security_hardening_2026_07.sql) already
   * de-dupes 'like'/'follow'/'tag' inserts: a second 'like' for the same
   * (member_id, link) within a rolling 24h returns without inserting a row.
   * So "128 likes must not be 128 rows" is already true at the storage layer
   * - but the RPC only skips the insert, it never updates the row that IS
   * there, so that one row's title stays frozen at whichever name happened to
   * like the post first ("Priya liked your post") even once 127 more people
   * have. This replaces that frozen title with the post's REAL, current like
   * count for display - one batched query against `post_feed_view` (already
   * carries `like_count` + `category`), keyed by the post uuids the loaded
   * 'like' rows link to. Never a per-row fetch - see SOCIAL-ENGINE.md's
   * comments section on the N+1 this codebase already fixed once.
   *
   * Rows with a real count of 0 or 1 are left exactly as they were written
   * ("{name} liked your post" already says everything there is to say for a
   * single like) - only a row backing a post with >1 like switches to the
   * aggregate "{n} people liked / your {category} post" phrasing.
   */
  async withLikeDigests(rows: NotificationRow[]): Promise<NotificationRow[]> {
    const uuidOf = (link?: string | null) => {
      const m = link ? /^\/post\/([0-9a-f-]{36})$/i.exec(link) : null
      return m ? m[1] : null
    }
    const uuids = Array.from(new Set(
      rows.filter(r => r.type === 'like').map(r => uuidOf(r.link)).filter((u): u is string => !!u)
    ))
    if (uuids.length === 0) return rows
    const { data, error } = await supabaseCommunity
      .from('post_feed_view')
      .select('uuid, category, like_count')
      .in('uuid', uuids)
    // The digest is decoration on top of an already-correct row - a failed
    // enrichment must never blank or break the notifications list over it.
    if (error || !data) return rows
    const byUuid = new Map(data.map((p: any) => [p.uuid, p]))
    return rows.map(r => {
      if (r.type !== 'like') return r
      const post = byUuid.get(uuidOf(r.link) ?? '')
      const n = post ? Number((post as any).like_count) || 0 : 0
      if (!post || n <= 1) return r
      return { ...r, title: `${n} people liked`, subtitle: `your ${(post as any).category} post` }
    })
  },

  /** Service-side helper to create a notification. Called from feed/follow code.
   *
   * Routed through the `create_notification` SECURITY DEFINER RPC rather than a
   * direct INSERT: the old policy let any authenticated user forge a
   * notification to anyone (arbitrary title/type), so a member could plant a
   * fake "post_approved"/"system" alert. The RPC (security_hardening_2026_07.sql
   * M4) allows the social types (like/comment/follow/tag/team_join_request) for
   * any member but restricts the authority types (post_approved/post_rejected/
   * team_invite/team_join_accepted/system) to leaders, and re-checks the
   * internal-link rule server-side. Direct INSERT is revoked once this ships. */
  async create(input: CreateNotificationInput) {
    // Skip self-notifications (no point notifying yourself about your own action).
    const me = await getCachedMemberId()
    if (me && me === input.memberId) return

    // Cast: `create_notification` isn't in the generated RPC types yet (the fn
    // is created by security_hardening_2026_07.sql). Regenerate database.types.ts
    // after applying that migration to drop this cast.
    const { error } = await (supabaseCommunity as any).rpc('create_notification', {
      p_member_id: input.memberId,
      p_type: input.type,
      p_title: input.title,
      p_subtitle: input.subtitle ?? null,
      p_full_note: input.fullNote ?? null,
      p_link: input.link ?? null,
    })
    // Notifications are non-critical - never throw out of a write path.
    if (error) console.warn('[notification] create failed:', error.message)
  },
}

export const notificationService = withFunctionLogging('notificationService', notificationServiceImpl)

export default notificationService
