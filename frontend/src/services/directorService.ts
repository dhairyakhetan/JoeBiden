import { LEADER_ROLES } from '../lib/roles'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import { withRetry } from '../lib/asyncUtils'
import { sanitizeFilterTerm } from '../lib/pgrestEscape'
import { notificationService } from './notificationService'
import { logAction } from '../lib/auditLog'
import { logSupabaseError } from '../lib/errorTracking'
import { Post, PaginatedResponse } from './api'
import { POST_FEED_COLS } from './profileService'
import { CATEGORY_SLUGS } from '../lib/categories'
import { applyPostScope } from '../lib/postScope'
import { withFunctionLogging } from '../lib/functionLog'
import { toDuplicatePhoneRow, type DuplicatePhoneRow } from '../lib/duplicatePhones'
import {
  DashboardStats,
  PendingMember,
  RejectedMember,
  DirectoryMember,
  EligibleMember,
  CategoryAssignments,
  ScopeAssignments,
  ScopeTeam,
  AlreadyDecidedError,
  roleChangeMessage,
} from './directorServiceTypes'
import { buildSearchOrFilter, normalizeGrade, mergeGrades } from '../director/accountApprovalsQuery'
import { keysetOrFilter, trimPage, type KeysetCursor } from './keysetCursor'

export * from './directorServiceTypes'

/** Server-side search / class / contacted filters for the pending_member_approvals view. */
function applyPendingFilters(
  q: any,
  f: { search?: string; classGrade?: string | null; contacted?: 'any' | 'not_contacted' | 'contacted' },
) {
  const or = buildSearchOrFilter(f.search ?? '')
  if (or) q = q.or(or)
  const grade = normalizeGrade(f.classGrade)
  if (grade) q = q.eq('class_grade', grade)
  if (f.contacted === 'not_contacted') q = q.is('contacted_at', null)
  else if (f.contacted === 'contacted') q = q.not('contacted_at', 'is', null)
  return q
}

/** Current status of a member, or null when unreadable. Used only to explain a zero-row decision. */
async function readMemberStatus(memberId: number): Promise<string | null> {
  const { data } = await (supabaseCommunity as any)
    .from('member_directory_view')
    .select('status')
    .eq('member_id', memberId)
    .maybeSingle()
  return data?.status ?? null
}

/** Why a status-guarded member update touched nothing: decided already, or not allowed. */
async function explainMemberNoop(memberId: number, expected: string, what: string): Promise<Error> {
  const status = await readMemberStatus(memberId)
  if (status && status !== expected) {
    return new AlreadyDecidedError(`This ${what} was already dealt with (it is now "${status}"). Refresh the list.`)
  }
  return new Error(`The database refused that change. You may not have permission to decide this ${what}.`)
}

/** Why a status-guarded post update touched nothing. */
async function explainPostNoop(postId: number): Promise<Error> {
  const { data } = await supabaseCommunity
    .from('posts')
    .select('status, deleted_at')
    .eq('post_id', postId)
    .maybeSingle()
  const row = data as { status?: string; deleted_at?: string | null } | null
  if (row && (row.deleted_at || row.status !== 'pending_review')) {
    return new AlreadyDecidedError(
      row.deleted_at ? 'This post was removed in the meantime.' : `This post was already dealt with (it is now "${row.status}"). Refresh the queue.`,
    )
  }
  return new Error('The database refused that change. You may not have permission to moderate this post.')
}

/** Team name for a notification line; falls back to a generic word, never throws. */
async function readTeamName(teamId: number): Promise<string> {
  try {
    const { data } = await supabaseCommunity.from('teams').select('name').eq('team_id', teamId).maybeSingle()
    return (data as any)?.name || 'a team'
  } catch {
    return 'a team'
  }
}

/** Remove a demoted member's category and team scopes, surfacing a failure instead of ignoring it. */
async function clearLeaderScopes(memberId: number, where: string): Promise<void> {
  const [cats, scopes] = await Promise.all([
    supabaseCommunity.from('director_categories').delete().eq('member_id', memberId),
    supabaseCommunity.from('director_scopes').delete().eq('member_id', memberId),
  ])
  if (cats.error) throw logSupabaseError(where, cats.error)
  if (scopes.error) throw logSupabaseError(where, scopes.error)
}

/** Tell a member their role changed. Fire-and-forget; create() never throws. */
function notifyRoleChange(memberId: number, role: string): void {
  const msg = roleChangeMessage(role)
  notificationService.create({ memberId, type: 'system', title: msg.title, subtitle: msg.subtitle, link: msg.link })
}

const directorServiceImpl = {
  async getCurrentMemberId() {
    // Shared in-memory cache w/ in-flight dedup - avoids a getSession + members
    // round-trip on every director action (each one is ~150ms to Tokyo).
    const id = await getCachedMemberId()
    if (id == null) throw new Error('Not authenticated')
    return id
  },

  async getDashboardStats() {
    // Independent COUNT(head) queries - fire them in parallel (one RTT) instead
    // of sequentially (N RTTs ≈ 150ms each on the India→Tokyo edge).
    //
    // Hiring and Enquiries used to have NO count here, which meant those two
    // desks carried no unread signal anywhere in the UI - a contact enquiry
    // could sit for a week with nothing indicating it existed. They are counted
    // now so DirectorLanding can surface them like every other queue.
    // withRetry - a stolen auth-token lock during session refresh (two tabs,
    // or a background refresh mid-navigation) otherwise surfaces this whole
    // Promise.all as a raw error instead of self-healing. See ContentManager's
    // fetchPosts for the same pattern and why.
    const [pending, posts, active, published, contact, collab, applications] = await withRetry(async () => Promise.all([
      supabaseCommunity.from('members').select('member_id', { count: 'exact', head: true }).eq('status', 'pending_approval'),
      // `source_kind is null` = a post a member actually wrote. A mirrored row
      // (a blog, a drive write-up, an opening) is owned by its own desk and is
      // not a submission anybody is waiting on a verdict for - see the note on
      // getPendingPosts below for what counting them cost.
      supabaseCommunity.from('posts').select('post_id', { count: 'exact', head: true }).eq('status', 'pending_review').is('deleted_at', null).is('source_kind', null),
      supabaseCommunity.from('members').select('member_id', { count: 'exact', head: true }).eq('status', 'active'),
      supabaseCommunity.from('posts').select('post_id', { count: 'exact', head: true }).eq('status', 'published').is('deleted_at', null),
      // REDESIGN 2026-09: the external_achievements pending count is GONE.
      // Achievements are approved on submit now and the review desk is deleted,
      // so this query counted a queue nobody could ever clear - a round trip on
      // every desk load to fetch a number that is structurally always 0.
      // Both intake inboxes are director-gated by RLS (is_director()), so a
      // non-super-admin director gets a real count here too.
      (supabaseCommunity as any).from('contact_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      (supabaseCommunity as any).from('collaboration_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      (supabaseCommunity as any).from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]))

    return {
      success: true,
      data: {
        pendingMemberApprovals: pending.count || 0,
        pendingPostReviews: posts.count || 0,
        pendingEnquiries: (contact.count || 0) + (collab.count || 0),
        pendingApplications: applications.count || 0,
        totalActiveMembers: active.count || 0,
        totalPublishedPosts: published.count || 0
      } as DashboardStats
    }
  },

  /**
   * `after` switches to keyset paging (rows strictly after that created_at/member_id).
   * Approving or rejecting removes a row server-side, so offset paging skipped
   * whatever slid into the gap; the cursor does not care how many rows left.
   * With `after` set there is no total (it would be the REMAINING count), so
   * totalItems is 0 and callers keep the total they already have.
   */
  async getPendingApprovals(params: {
    page?: number; limit?: number; after?: KeysetCursor | null
    /** Name or email, case-insensitive substring. Applied by the server so page two is searchable. */
    search?: string
    /** Exact class_grade match. */
    classGrade?: string | null
    /** Contacted split; omitted or 'any' = the whole queue. */
    contacted?: 'any' | 'not_contacted' | 'contacted'
  }) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit
    const after = params.after ?? null

    const { data: rawData, count, error } = await withRetry(async () => {
      let q: any = supabaseCommunity
        .from('pending_member_approvals')
        .select('*', after ? undefined : { count: 'exact' })
        .order('created_at', { ascending: true })
        .order('member_id', { ascending: true })
      q = applyPendingFilters(q, params)
      q = after
        ? q.or(keysetOrFilter('created_at', 'member_id', after)).limit(limit + 1)
        : q.range(offset, offset + limit - 1)
      return q
    })

    if (error) throw logSupabaseError('directorService.getPendingApprovals', error)
    const trimmed = after ? trimPage(rawData || [], limit) : { rows: rawData || [], hasMore: false }
    const data = trimmed.rows

    const mapped = (data || []).map((m: any) => ({
      memberId: m.member_id,
      uuid: m.uuid,
      email: m.email,
      fullName: m.full_name,
      avatarUrl: m.avatar_url,
      classGrade: m.class_grade,
      phone: m.phone,
      joinReason: m.join_reason,
      createdAt: m.created_at,
      contactedAt: m.contacted_at,
      previouslyRemoved: !!m.previously_removed
    }))

    const totalItems = count || 0
    const totalPages = Math.ceil(totalItems / limit)

    return {
      success: true,
      data: mapped,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: after ? trimmed.hasMore : page < totalPages,
        hasPrevPage: page > 1
      }
    } as PaginatedResponse<PendingMember>
  },

  /**
   * Exact not-contacted / contacted counts across the WHOLE pending queue,
   * not just the loaded page - two `head: true` count-only queries, no rows
   * transferred. AccountApprovals' pending/contacted tabs used to fall back
   * to `rows.length` (whatever had been paginated in so far), which is
   * exactly the "header undercounts the real queue" bug this file's own
   * `fetchMembers` comment already documents having fixed once for the
   * unfiltered total - this closes the same gap for the contacted split.
   */
  async getPendingContactedCounts(filters?: { search?: string; classGrade?: string | null }): Promise<{ notContacted: number; contacted: number }> {
    const [notContacted, contacted] = await withRetry(async () => Promise.all([
      applyPendingFilters(supabaseCommunity.from('pending_member_approvals').select('*', { count: 'exact', head: true }), filters ?? {}).is('contacted_at', null),
      applyPendingFilters(supabaseCommunity.from('pending_member_approvals').select('*', { count: 'exact', head: true }), filters ?? {}).not('contacted_at', 'is', null),
    ]))
    if (notContacted.error) throw logSupabaseError('directorService.getPendingContactedCounts', notContacted.error)
    if (contacted.error) throw logSupabaseError('directorService.getPendingContactedCounts', contacted.error)
    return { notContacted: notContacted.count || 0, contacted: contacted.count || 0 }
  },

  /**
   * Every class_grade present in the pending queue, sorted. Independent of the
   * active search or grade filter, so the grade pills never shrink to whatever
   * has been loaded or filtered. Rows are fetched grade-only (a few bytes each).
   */
  async getPendingGrades(): Promise<string[]> {
    const { data, error } = await withRetry(async () => (supabaseCommunity as any)
      .from('pending_member_approvals')
      .select('class_grade')
      .not('class_grade', 'is', null)
      .limit(5000))
    if (error) throw logSupabaseError('directorService.getPendingGrades', error)
    return mergeGrades([], (data || []).map((r: any) => r.class_grade as string | null))
  },

  /** Mark a pending applicant as contacted - HR/a director reached out to
   *  confirm their membership before deciding. Doesn't change `status`, so
   *  it's outside members_guard_privileged_cols()'s guarded-column set;
   *  the existing members_update RLS policy is the only gate. See
   *  scripts/members_add_contacted_at_2026_09_12.sql. */
  async markContacted(memberId: number) {
    const { error } = await supabaseCommunity
      .from('members')
      .update({ contacted_at: new Date().toISOString() })
      .eq('member_id', memberId)
    if (error) throw logSupabaseError('directorService.markContacted', error)
    logAction('member_marked_contacted', 'member', memberId)
  },

  /** Mirrors getPendingApprovals but reads the rejected queue - see
   * scripts/rejected_member_approvals_view_2026_08_27.sql. */
  async getRejectedApprovals(params: { page?: number; limit?: number }) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    const { data, count, error } = await withRetry(async () => (supabaseCommunity as any)
      .from('rejected_member_approvals')
      .select('*', { count: 'exact' })
      // Newest rejection first, member_id as the tiebreak so pages never repeat or skip.
      .order('updated_at', { ascending: false })
      .order('member_id', { ascending: false })
      .range(offset, offset + limit - 1))

    if (error) throw logSupabaseError('directorService.getRejectedApprovals', error)

    const mapped: RejectedMember[] = (data || []).map((m: any) => ({
      memberId: m.member_id,
      uuid: m.uuid,
      email: m.email,
      fullName: m.full_name,
      avatarUrl: m.avatar_url,
      classGrade: m.class_grade,
      phone: m.phone,
      joinReason: m.join_reason,
      rejectionNote: m.rejection_note,
      createdAt: m.created_at,
      rejectedAt: m.updated_at,
    }))

    const totalItems = count || 0
    const totalPages = Math.ceil(totalItems / limit)

    return {
      success: true,
      data: mapped,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    } as PaginatedResponse<RejectedMember>
  },

  /**
   * HR and super admin only: accounts that share a phone number, flat rows
   * ordered by number. The RPC raises 42501 for anyone else, so this throws
   * rather than returning an empty list. See
   * scripts/members_duplicate_phones_hr_2026_11_02.sql.
   */
  async getDuplicatePhoneRows(): Promise<DuplicatePhoneRow[]> {
    const { data, error } = await withRetry(async () =>
      (supabaseCommunity as any).rpc('get_duplicate_phone_groups'))
    if (error) throw logSupabaseError('directorService.getDuplicatePhoneRows', error)
    return (data || []).map(toDuplicatePhoneRow)
  },

  async approveMember(memberId: number) {
    const currentMemberId = await this.getCurrentMemberId()

    // No `.select()` on the update - the authenticated role no longer has
    // column-level SELECT on members.email, so the implicit `select(*)`
    // representation would fail. Fetch the row back through
    // member_directory_view instead (now director/super_admin-gated at the
    // view level, see scripts/members_pii_lockdown_2026_07_29.sql) - safe
    // here since only directors reach this action.
    // Only a still-pending row can be approved: a second click, or another
    // director's earlier decision, must not flip a rejected account to active
    // or send a second welcome. Explicit column list on the returned rows.
    const { data: changed, error } = await supabaseCommunity
      .from('members')
      .update({
        status: 'active',
        approved_by: currentMemberId,
        approved_at: new Date().toISOString()
      })
      .eq('member_id', memberId)
      .eq('status', 'pending_approval')
      .select('member_id')

    if (error) throw logSupabaseError('directorService.approveMember', error)
    if (!changed || changed.length === 0) throw await explainMemberNoop(memberId, 'pending_approval', 'application')
    logAction('member_approved', 'member', memberId)

    const { data } = await (supabaseCommunity as any)
      .from('member_directory_view')
      .select('member_id, uuid, email, full_name, class_grade, created_at')
      .eq('member_id', memberId)
      .single()

    // Welcome the newly-approved member. Fire-and-forget + non-throwing
    // (handled inside notificationService.create) - same pattern as
    // approvePost below. `system` is leader-gated in the RPC, which is fine:
    // only directors reach this action.
    notificationService.create({
      memberId,
      type: 'system',
      title: 'Welcome to AquaTerra - your account was approved',
      subtitle: 'You now have full access to the community.',
      link: '/feed',
    })

    return {
      success: true,
      message: 'Member approved successfully',
      data: {
        member: {
          memberId,
          uuid: data?.uuid,
          email: data?.email,
          fullName: data?.full_name,
          classGrade: data?.class_grade,
          createdAt: data?.created_at
        } as PendingMember
      }
    }
  },

  async rejectMember(memberId: number, rejectionNote: string) {
    // rejected members no longer satisfy member_directory_view's own gate
    // shape issue: the view has no status filter, so a rejected row is
    // still visible to directors there. Grab email up front regardless.
    const { data: before } = await (supabaseCommunity as any)
      .from('member_directory_view')
      .select('uuid, email, full_name, class_grade, created_at')
      .eq('member_id', memberId)
      .maybeSingle()

    const { data: changed, error } = await supabaseCommunity
      .from('members')
      .update({
        status: 'rejected',
        rejection_note: rejectionNote
      })
      .eq('member_id', memberId)
      .eq('status', 'pending_approval')
      .select('member_id')

    if (error) throw logSupabaseError('directorService.rejectMember', error)
    if (!changed || changed.length === 0) throw await explainMemberNoop(memberId, 'pending_approval', 'application')
    logAction('member_rejected', 'member', memberId, { note: rejectionNote })

    // Tell the applicant why - the note rides in full_note so the
    // notifications page can show the reason (mirrors rejectPost below).
    // Fire-and-forget + non-throwing inside notificationService.create.
    notificationService.create({
      memberId,
      type: 'system',
      title: 'Your membership application was not approved',
      subtitle: rejectionNote ? rejectionNote.slice(0, 140) : 'A director reviewed your application.',
      fullNote: rejectionNote || undefined,
    })

    return {
      success: true,
      message: 'Member rejected successfully',
      data: {
        member: {
          memberId,
          uuid: before?.uuid,
          email: before?.email,
          fullName: before?.full_name,
          classGrade: before?.class_grade,
          createdAt: before?.created_at
        } as PendingMember
      }
    }
  },

  async getPendingPosts(params: { page?: number; limit?: number; scopeTeamIds?: number[]; after?: KeysetCursor | null }) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    // scopeTeamIds, when passed, scopes the query server-side to a leader's
    // team jurisdiction, so a scoped leader's first page is never empty while
    // later pages hold real in-scope posts (false "all clear").
    const after0 = params.after ?? null
    let query = supabaseCommunity
      .from('post_feed_view')
      // The mapper below reads a strict subset of the shared POST_FEED_COLS
      // projection - consumers only ever see the mapped Post shape. `stats`
      // is appended locally rather than added to the shared constant, same
      // as feedService's POST_DETAIL_COLS/getTrending/getPosts do - the desk
      // queue is the one list view that needs a post's self-reported numbers,
      // other POST_FEED_COLS consumers don't.
      .select(POST_FEED_COLS + ', stats', after0 ? undefined : { count: 'exact' })
      .eq('status', 'pending_review')
      // THE MODERATION QUEUE IS MEMBER SUBMISSIONS ONLY (2026-09-11).
      //
      // Measured on the live database the day this was added: the queue held
      // fourteen items and ALL FOURTEEN were blog mirrors - not one real member
      // post. Every one of them was an essay scheduled for a date between three
      // and forty-five days out, and approving it here published it on the spot,
      // silently overriding the schedule its own desk had set. That is how the
      // fourteen scheduled essays ended up live on the public homepage.
      //
      // A mirror is a projection of a row another desk owns (Blog Drafts, Drive
      // Write-ups, Hiring). Nobody submitted it and nobody is waiting on a
      // verdict, so it does not belong in a verdict queue.
      .is('source_kind', null)
    // Teams-as-categories slice 4: a leader's queue is the posts tagged to their teams (and the
    // teams inside them) plus any pending post with no team tag. The five categories are no
    // longer read. No scope at all = unscoped, as before. See lib/postScope.ts.
    const scopeTeamIds = params.scopeTeamIds ?? []
    const scopedPostIds = scopeTeamIds.length === 0
      ? []
      : [...await this.getScopedPendingPostIds(scopeTeamIds), ...await this.getUntaggedPendingPostIds()]
    query = applyPostScope(query as any, [], scopeTeamIds, scopedPostIds) as typeof query
    // Keyset paging when `after` is given: approving/rejecting removes rows
    // server-side, so offset paging skipped the ones that slid up. Without a
    // cursor it is the first page and carries the exact total.
    const after = params.after ?? null
    const ordered = (query as any)
      .order('created_at', { ascending: true })
      .order('post_id', { ascending: true })
    const orderedQuery = after
      ? ordered.or(keysetOrFilter('created_at', 'post_id', after)).limit(limit + 1)
      : ordered.range(offset, offset + limit - 1)
    const { data: rawData, count, error } = await withRetry(async () => orderedQuery as Promise<{ data: any[] | null; count: number | null; error: any }>)

    if (error) throw logSupabaseError('directorService.getPendingPosts', error)
    const trimmed = after ? trimPage(rawData || [], limit) : { rows: rawData || [], hasMore: false }
    const data = trimmed.rows

    const mappedPosts = (data || []).map((post: any) => ({
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
      images: post.images ? (post.images as any[]).map((img: any) => ({
        blobUrl: img.url,
        displayOrder: img.order
      })) : [],
      taggedMembers: post.tagged_members ? (post.tagged_members as any[]).map((member: any) => ({
        memberId: member.id,
        uuid: member.uuid,
        fullName: member.name
      })) : [],
      stats: Array.isArray(post.stats) ? post.stats : []
    } as Post))

    const totalItems = count || 0
    const totalPages = Math.ceil(totalItems / limit)

    return {
      success: true,
      data: mappedPosts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: after ? trimmed.hasMore : page < totalPages,
        hasPrevPage: page > 1
      }
    } as PaginatedResponse<Post>
  },

  async approvePost(postId: number) {
    const currentMemberId = await this.getCurrentMemberId()

    // Guarded on status: a post another moderator already decided (or that was
    // removed) must not be flipped again, nor re-notify its author.
    const { data: approved, error } = await supabaseCommunity
      .from('posts')
      .update({
        status: 'published',
        reviewed_by: currentMemberId,
        reviewed_at: new Date().toISOString()
      })
      .eq('post_id', postId)
      .eq('status', 'pending_review')
      .select('post_id, uuid, author_id, body')
      .maybeSingle()

    if (error) throw logSupabaseError('directorService.approvePost', error)
    if (!approved) throw await explainPostNoop(postId)
    const data = approved
    logAction('post_approved', 'post', postId)

    // Tell the author their post is live. Non-blocking + self-skip handled
    // inside notificationService.create (a director approving their own
    // post won't notify themselves).
    notificationService.create({
      memberId: data.author_id,
      type: 'post_approved',
      title: 'Your post was approved',
      subtitle: "It's now live on the feed.",
      link: `/post/${data.uuid}`,
    })

    // Found 2026-09-08 (social-engine map): feedService.createPost skips the
    // tag notification for a pending_review post (RLS blocks a tagged
    // member's read until it's live, so the link would dead-end at creation
    // time) - but nothing ever sent it once the post actually went live,
    // silently dropping the notification for every non-leader's post. This
    // is that deferred fire, at the one point the post becomes readable.
    // Non-blocking, best-effort: a tag-notification failure must never make
    // an approval itself fail.
    ;(async () => {
      try {
        const [{ data: tags }, { data: author }] = await Promise.all([
          supabaseCommunity.from('post_tags').select('tagged_member_id').eq('post_id', postId),
          supabaseCommunity.from('members').select('full_name').eq('member_id', data.author_id).maybeSingle(),
        ])
        if (!tags?.length) return
        const authorName = (author as any)?.full_name || 'Someone'
        const subtitle = (data as any).body?.slice(0, 140) ?? ''
        await Promise.all(
          tags.map(t => notificationService.create({
            memberId: (t as any).tagged_member_id,
            type: 'tag',
            title: `${authorName} tagged you in a post`,
            subtitle,
            link: `/post/${data.uuid}`,
          }))
        )
      } catch (e) {
        console.warn('[directorService] deferred tag notification failed:', e)
      }
    })()

    return {
      success: true,
      message: 'Post approved successfully',
      data: { post: { postId: data.post_id } as Post }
    }
  },

  async rejectPost(postId: number, rejectionNote: string) {
    const currentMemberId = await this.getCurrentMemberId()

    const { data: rejected, error } = await supabaseCommunity
      .from('posts')
      .update({
        status: 'rejected',
        rejection_note: rejectionNote,
        reviewed_by: currentMemberId,
        reviewed_at: new Date().toISOString()
      })
      .eq('post_id', postId)
      .eq('status', 'pending_review')
      .select('post_id, uuid, author_id')
      .maybeSingle()

    if (error) throw logSupabaseError('directorService.rejectPost', error)
    if (!rejected) throw await explainPostNoop(postId)
    const data = rejected
    logAction('post_rejected', 'post', postId, { note: rejectionNote })

    // Tell the author why it was rejected - the note rides in full_note so
    // the notifications page can show the reason.
    notificationService.create({
      memberId: data.author_id,
      type: 'post_rejected',
      title: 'Your post needs changes',
      subtitle: rejectionNote ? rejectionNote.slice(0, 140) : 'A director sent it back.',
      fullNote: rejectionNote || undefined,
      // Without a link the notification row is inert (NotificationsPage only
      // sets cursor:pointer and navigates when n.link is set), so a rejected
      // author had no route to their post at all - the one notification that
      // most needs a next step was the one that didn't offer one.
      link: '/my-posts',
    })

    return {
      success: true,
      message: 'Post rejected successfully',
      data: { post: { postId: data.post_id } as Post }
    }
  },

  async getMemberDirectory(params: {
    page?: number
    limit?: number
    search?: string
    role?: 'all' | 'member' | 'hod' | 'hr' | 'director' | 'super_admin'
    sort?: 'role' | 'newest' | 'oldest' | 'name'
    /** REDESIGN 2026-09. Was hardcoded to 'active', which meant section 13's
     *  pending / on-a-break / removed filters had no rows to act on: the desk
     *  offered a filter that could only ever return nothing. Defaults to
     *  'active' so every existing caller is unchanged. */
    /** `archived` added 2026-09-11 (item 3.1) - people who have left. It is a
     *  separate value from `suspended`, which is a sanction, not a departure.
     *  `deleted` added 2026-09-12 - an admin-initiated soft-delete, browsable
     *  here so it can be restored (see deleteMember/restoreDeletedMember). */
    status?: 'active' | 'pending_approval' | 'rejected' | 'suspended' | 'archived' | 'deleted' | 'all'
  }) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    // Read from member_directory_view (security_invoker) so we can order by
    // role_rank - leadership first - which the base table can't express through
    // PostgREST. RLS still applies via the invoker view. Cast: this view is not
    // in the (intentionally stale) generated database.types, matching the
    // `as any` pattern used elsewhere for untyped relations.
    let query = (supabaseCommunity as any)
      .from('member_directory_view')
      .select('*', { count: 'exact' })

    // REDESIGN 2026-09: was a hardcoded `.eq('status','active')`.
    if ((params.status ?? 'active') !== 'all') {
      query = query.eq('status', params.status ?? 'active')
    }

    // Role filter - default 'all' returns every member at the chosen status.
    if (params.role && params.role !== 'all') query = query.eq('role', params.role)

    // Sort. Default 'role' = super_admin → director → hod → member, then newest
    // within each tier. `created_at`/`full_name` are NOT unique across ~1,100
    // seeded members (many share a timestamp or name prefix), so offset-based
    // pagination silently duplicated/skipped rows across pages ("load more"
    // showing repeats). Every branch ends on `member_id` - the one column
    // guaranteed unique - so ordering (and therefore pagination) is stable.
    const sort = params.sort || 'role'
    if (sort === 'role') {
      query = query.order('role_rank', { ascending: true }).order('created_at', { ascending: false }).order('member_id', { ascending: true })
    } else if (sort === 'newest') {
      query = query.order('created_at', { ascending: false }).order('member_id', { ascending: true })
    } else if (sort === 'oldest') {
      query = query.order('created_at', { ascending: true }).order('member_id', { ascending: true })
    } else if (sort === 'name') {
      query = query.order('full_name', { ascending: true }).order('member_id', { ascending: true })
    }

    if (params.search) {
      const term = sanitizeFilterTerm(params.search)
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
    }

    query = query.range(offset, offset + limit - 1)

    const finalQuery = query
    const { data, count, error } = await withRetry(async () => finalQuery)
    if (error) throw logSupabaseError('directorService.getMemberDirectory', error)

    const mapped = (data || []).map((m: any) => ({
      memberId: m.member_id,
      uuid: m.uuid,
      email: m.email,
      fullName: m.full_name,
      avatarUrl: m.avatar_url,
      classGrade: m.class_grade,
      // member_directory_view already grants director-level readers `email`
      // (used above); `phone` rides the same view/grant if present in the
      // row, undefined otherwise - never assume "no phone" from a missing
      // key, see DirectoryMember's own doc comment.
      phone: m.phone,
      // REDESIGN 2026-09: member_directory_view has carried `instagram` and
      // `linkedin` all along; this mapper simply never projected them, so the
      // desk could not offer either as a contact field even though the data
      // was already in the row it had fetched.
      instagram: m.instagram,
      linkedin: m.linkedin,
      // Item 5.1, and exactly the same defect the two lines above were fixed
      // for in the 2026-09 pass: the view carries `school_name`, the query is
      // a `select('*')` so it was already in the row, and this mapper dropped
      // it. 1,034 of 1,379 members have one.
      schoolName: m.school_name,
      role: m.role,
      status: m.status,
      createdAt: m.created_at,
      breakEnd: m.break_end,
    }))

    const totalItems = count || 0
    const totalPages = Math.ceil(totalItems / limit)

    return {
      success: true,
      data: mapped,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    } as PaginatedResponse<DirectoryMember>
  },

  async getCategoryAssignments() {
    // director_categories has two FKs into members:
    //   director_categories_member_id_fkey  (the HoD assigned to the category)
    //   director_categories_assigned_by_fkey (the admin who made the assignment)
    // We disambiguate the embed by the full FK-constraint name. The shorter
    // `!member_id` (column-name) form silently breaks when PostgREST's
    // schema cache flips between resolution strategies; constraint-name
    // hints are stable across cache reloads.
    const { data, error } = await withRetry(async () => supabaseCommunity
      .from('director_categories')
      .select(`
        category,
        assigned_at,
        members!director_categories_member_id_fkey (
          member_id,
          uuid,
          full_name,
          avatar_url
        )
      `))

    if (error) throw logSupabaseError('directorService.getCategoryAssignments', error)

    // email dropped from the embed above - the authenticated role no longer
    // has column-level SELECT on members.email, so the embedded join would
    // fail. Batch-fetch it from member_directory_view instead (director/
    // super_admin-gated at the view level - safe, this page is director-only).
    const memberIds = Array.from(new Set((data || []).map((row: any) => row.members?.member_id).filter(Boolean)))
    const emailById = new Map<number, string>()
    if (memberIds.length > 0) {
      const { data: emails } = await withRetry(async () => (supabaseCommunity as any)
        .from('member_directory_view')
        .select('member_id, email')
        .in('member_id', memberIds))
      ;(emails || []).forEach((e: any) => emailById.set(e.member_id, e.email))
    }

    const assignments: CategoryAssignments = CATEGORY_SLUGS.reduce((acc: CategoryAssignments, cat) => {
      acc[cat] = []
      return acc
    }, {} as CategoryAssignments)

    data?.forEach((row: any) => {
      if (assignments[row.category]) {
        assignments[row.category].push({
          memberId: row.members.member_id,
          uuid: row.members.uuid,
          fullName: row.members.full_name,
          avatarUrl: row.members.avatar_url,
          email: emailById.get(row.members.member_id) ?? '',
          assignedAt: row.assigned_at
        })
      }
    })

    return {
      success: true,
      data: {
        categories: [...CATEGORY_SLUGS],
        assignments
      }
    }
  },

  async getMyCategories() {
    const currentMemberId = await this.getCurrentMemberId()

    const { data, error } = await withRetry(async () => supabaseCommunity
      .from('director_categories')
      .select('category, assigned_at, assigned_by')
      .eq('member_id', currentMemberId))

    if (error) throw logSupabaseError('directorService.getMyCategories', error)

    return {
      success: true,
      data: {
        categories: (data || []).map(c => ({
          category: c.category,
          assignedAt: c.assigned_at,
          assignedBy: String(c.assigned_by)
        }))
      }
    }
  },

  /**
   * Team-based moderation scopes (teams-as-categories, slice 2). Sits beside
   * the five-category model, which is untouched until slice 4.
   *
   * Returns every active team (so the desk can offer it) and who holds each.
   * `director_scopes` RLS: a super admin or HR reads every row, anyone else
   * only their own, so for a plain HoD this shows just their own assignments.
   */
  async getScopeAssignments() {
    const [teamsRes, scopesRes] = await Promise.all([
      withRetry(async () => supabaseCommunity
        .from('teams')
        .select('team_id, name, parent_team_id')
        .eq('is_active', true)
        .order('name')),
      withRetry(async () => supabaseCommunity
        .from('director_scopes')
        .select(`
          team_id,
          assigned_at,
          members!director_scopes_member_id_fkey (
            member_id,
            uuid,
            full_name,
            avatar_url
          )
        `)),
    ])
    if (teamsRes.error) throw logSupabaseError('directorService.getScopeAssignments', teamsRes.error)
    if (scopesRes.error) throw logSupabaseError('directorService.getScopeAssignments', scopesRes.error)

    const teams: ScopeTeam[] = (teamsRes.data || []).map((t: any) => ({
      teamId: t.team_id,
      name: t.name,
      parentTeamId: t.parent_team_id ?? null,
    }))

    // Same email batch-fetch as getCategoryAssignments: members.email is not
    // readable by `authenticated`, member_directory_view is leader-gated.
    const rows = (scopesRes.data || []) as any[]
    const memberIds = Array.from(new Set(rows.map(r => r.members?.member_id).filter(Boolean)))
    const emailById = new Map<number, string>()
    if (memberIds.length > 0) {
      const { data: emails } = await withRetry(async () => (supabaseCommunity as any)
        .from('member_directory_view')
        .select('member_id, email')
        .in('member_id', memberIds))
      ;(emails || []).forEach((e: any) => emailById.set(e.member_id, e.email))
    }

    const assignments: ScopeAssignments = {}
    for (const t of teams) assignments[t.teamId] = []
    for (const row of rows) {
      if (!row.members || !assignments[row.team_id]) continue
      assignments[row.team_id].push({
        memberId: row.members.member_id,
        uuid: row.members.uuid,
        fullName: row.members.full_name,
        avatarUrl: row.members.avatar_url,
        email: emailById.get(row.members.member_id) ?? '',
        assignedAt: row.assigned_at,
      })
    }
    return { success: true, data: { teams, assignments } }
  },

  /**
   * The teams the signed-in leader moderates via `director_scopes` (own rows only, by RLS), with the
   * teams inside them: a scope on a parent department such as Marketing covers Social Media and
   * Digital Magazine, because the people who moderate a department moderate what its teams post.
   * `direct` marks the ones actually assigned (the names the desk shows). Empty means no team scope.
   */
  async getMyScopeTeams(): Promise<{ teamId: number; name: string; direct: boolean }[]> {
    const currentMemberId = await this.getCurrentMemberId()
    const { data, error } = await withRetry(async () => supabaseCommunity
      .from('director_scopes')
      .select('team_id, teams(name)')
      .eq('member_id', currentMemberId))
    if (error) throw logSupabaseError('directorService.getMyScopeTeams', error)
    const own = (data || []).map((r: any) => ({ teamId: r.team_id as number, name: String(r.teams?.name ?? ''), direct: true }))
    if (own.length === 0) return []
    const { data: kids, error: kidsErr } = await withRetry(async () => supabaseCommunity
      .from('teams')
      .select('team_id, name')
      .in('parent_team_id', own.map(o => o.teamId))
      .eq('is_active', true))
    if (kidsErr) throw logSupabaseError('directorService.getMyScopeTeams', kidsErr)
    const seen = new Set(own.map(o => o.teamId))
    const inside = (kids || []).filter(k => !seen.has(k.team_id)).map(k => ({ teamId: k.team_id, name: k.name, direct: false }))
    return [...own, ...inside]
  },

  /** Team ids only (own scope plus the teams inside it). See getMyScopeTeams. */
  async getMyScopes(): Promise<number[]> {
    return (await this.getMyScopeTeams()).map(t => t.teamId)
  },

  /**
   * Pending posts nobody tagged to a team. A scoped leader's queue includes them so that a post without
   * a tag is never invisible: every leader may triage it.
   */
  async getUntaggedPendingPostIds(): Promise<number[]> {
    const { data, error } = await withRetry(async () => (supabaseCommunity as any)
      .from('posts')
      .select('post_id, post_teams(post_id)')
      .eq('status', 'pending_review')
      .is('deleted_at', null)
      .is('post_teams', null))
    if (error) throw logSupabaseError('directorService.getUntaggedPendingPostIds', error)
    return ((data || []) as { post_id: number }[]).map(r => r.post_id)
  },

  /**
   * The ids of PENDING posts tagged (`post_teams`) to any of these teams: the
   * team half of a leader's queue scope (see lib/postScope.ts). Reads only
   * pending posts so the set stays small however long a team's history is.
   */
  async getScopedPendingPostIds(teamIds: number[]): Promise<number[]> {
    if (teamIds.length === 0) return []
    const { data, error } = await withRetry(async () => (supabaseCommunity as any)
      .from('post_teams')
      .select('post_id, posts!inner(status)')
      .in('team_id', teamIds)
      .eq('posts.status', 'pending_review'))
    if (error) throw logSupabaseError('directorService.getScopedPendingPostIds', error)
    return Array.from(new Set(((data || []) as { post_id: number }[]).map(r => r.post_id)))
  },

  async assignScope(memberId: number, teamId: number) {
    const currentMemberId = await this.getCurrentMemberId()
    const { error } = await supabaseCommunity
      .from('director_scopes')
      .insert({ member_id: memberId, team_id: teamId, assigned_by: currentMemberId })
    if (error) throw logSupabaseError('directorService.assignScope', error)
    logAction('scope_assigned', 'member', memberId, { teamId })
    // Tell the HoD what changed for their queue. Best effort, never blocks.
    const teamName = await readTeamName(teamId)
    notificationService.create({
      memberId,
      type: 'system',
      title: `You now moderate posts for ${teamName}`,
      subtitle: 'Posts tagged to that team will show up in your post queue.',
      link: '/director/posts',
    })
    return { success: true, message: 'Team assigned successfully' }
  },

  async unassignScope(memberId: number, teamId: number) {
    const { error } = await supabaseCommunity
      .from('director_scopes')
      .delete()
      .eq('member_id', memberId)
      .eq('team_id', teamId)
    if (error) throw logSupabaseError('directorService.unassignScope', error)
    logAction('scope_unassigned', 'member', memberId, { teamId })
    const teamName = await readTeamName(teamId)
    notificationService.create({
      memberId,
      type: 'system',
      title: `You no longer moderate posts for ${teamName}`,
      subtitle: 'Posts tagged to that team will stop showing up in your post queue.',
      link: '/director/posts',
    })
    return { success: true, message: 'Team assignment removed' }
  },

  async getAllDirectors() {
    // Disambiguate the embed by the full FK-constraint name - see the
    // comment in getCategoryAssignments above for why the column-name
    // form (`!member_id`) is brittle against schema-cache reloads.
    const { data, error } = await withRetry(async () => supabaseCommunity
      .from('members')
      .select(`
        member_id,
        uuid,
        full_name,
        avatar_url,
        created_at,
        role,
        director_categories!director_categories_member_id_fkey (
          category
        )
      `)
      // LEADER_ROLES, not a hand-written list. This is the HoDs desk roster:
      // with the list hardcoded, an `hr` member simply never appeared on it.
      .in('role', LEADER_ROLES as unknown as string[])
      .eq('status', 'active'))

    if (error) throw logSupabaseError('directorService.getAllDirectors', error)

    // email dropped from the select above (column-level SELECT on
    // members.email is no longer granted to authenticated) - batch-fetch via
    // member_directory_view, which is director/super_admin-gated at the view
    // level and this page is already director-only.
    const memberIds = (data || []).map((m: any) => m.member_id)
    const emailById = new Map<number, string>()
    if (memberIds.length > 0) {
      const { data: emails } = await withRetry(async () => (supabaseCommunity as any)
        .from('member_directory_view')
        .select('member_id, email')
        .in('member_id', memberIds))
      ;(emails || []).forEach((e: any) => emailById.set(e.member_id, e.email))
    }

    const directors = (data || []).map((m: any) => ({
      memberId: m.member_id,
      uuid: m.uuid,
      fullName: m.full_name,
      avatarUrl: m.avatar_url,
      email: emailById.get(m.member_id) ?? '',
      createdAt: m.created_at,
      // `isSuperAdmin: m.role === 'super_admin'` used to be emitted here and was
      // REMOVED 2026-09-17 (audit, security P3). It predated the `hr` role, so it
      // reported false for an account that is equal in power to super_admin. The
      // one consumer, DirectorManagement's self-lockout guard, had already been
      // rewritten to call isSuperAdmin(director.role) instead and left the flag
      // in place with a comment warning not to use it. A flag that is wrong for a
      // whole role and exists only to be avoided is a trap for the next reader,
      // so it is gone. Derive from `role` with lib/roles.ts helpers.
      role: m.role,
      categories: m.director_categories ? m.director_categories.map((c: any) => c.category) : []
    }))

    return {
      success: true,
      data: { directors }
    }
  },

  async assignCategory(memberId: number, category: string) {
    const currentMemberId = await this.getCurrentMemberId()

    const { error } = await supabaseCommunity
      .from('director_categories')
      .insert({
        member_id: memberId,
        category,
        assigned_by: currentMemberId
      })

    if (error) throw logSupabaseError('directorService.assignCategory', error)
    logAction('category_assigned', 'member', memberId, { category })

    return { success: true, message: 'Category assigned successfully' }
  },

  async unassignCategory(memberId: number, category: string) {
    const { error } = await supabaseCommunity
      .from('director_categories')
      .delete()
      .eq('member_id', memberId)
      .eq('category', category)

    if (error) throw logSupabaseError('directorService.unassignCategory', error)
    logAction('category_unassigned', 'member', memberId, { category })

    return { success: true, message: 'Category assignment removed' }
  },

  async approvePostCategory(postUuid: string, category: string) {
    const { data, error } = await supabaseCommunity.rpc('approve_post_category', {
      p_post_uuid: postUuid,
      p_category: category
    })

    if (error) throw logSupabaseError('directorService.approvePostCategory', error)
    const result = data as { success: boolean; error?: string; published?: boolean; categories_remaining?: string[] } | null
    if (!result?.success) throw new Error(result?.error || 'Approval failed')
    // approve_post_category is the only post-approval RPC that doesn't audit-log
    // itself server-side (approvePost/rejectPost above both call logAction after
    // their own update) - logged from here to match.
    logAction('post_category_approved', 'post', undefined, { postUuid, category, published: result.published })

    return {
      success: true,
      message: result.published ? 'Post fully approved and published' : 'Category approved',
      data: {
        categoryApproved: category,
        fullyApproved: result.published,
        categoriesRemaining: result.categories_remaining
      }
    }
  },

  async getEligibleMembers(params: { page?: number; limit?: number; search?: string }) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    // member_directory_view instead of the members base table - it's
    // director/super_admin-gated at the view level (this page is
    // director-only) and the authenticated role no longer has column-level
    // SELECT on members.email, which `select('*')` here needs.
    let query = (supabaseCommunity as any)
      .from('member_directory_view')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .eq('role', 'member')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (params.search) {
      // Match either full_name or email - placeholder says "name or email"
      const term = sanitizeFilterTerm(params.search)
      if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
    }

    const eligibleQuery = query
    const { data, count, error } = await withRetry(async () => eligibleQuery)
    if (error) throw logSupabaseError('directorService.getEligibleMembers', error)

    const mapped = (data || []).map((m: any) => ({
      memberId: m.member_id,
      uuid: m.uuid,
      email: m.email,
      fullName: m.full_name,
      avatarUrl: m.avatar_url,
      classGrade: m.class_grade,
      createdAt: m.created_at
    }))

    const totalItems = count || 0
    const totalPages = Math.ceil(totalItems / limit)

    return {
      success: true,
      data: mapped,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    } as PaginatedResponse<EligibleMember>
  },

  /**
   * Read the role back and prove it changed - item 5.7.
   * ──────────────────────────────────────────────────────────────────────────
   * `members_guard_privileged_cols` used to answer an unauthorised role change
   * with `new.role := old.role` - a SILENT REVERT. The UPDATE returned
   * ROW_COUNT 1, PostgREST returned the row, `error` was null, and these three
   * functions selected back only `member_id`, so the desk toasted "promoted to
   * HoD" over a database that had done nothing. Verified live before the fix:
   * as the one live hod, `update members set role='super_admin'` reported one
   * row affected and left the role as `member`.
   *
   * The guard now raises 42501 instead (migration
   * `members_guard_raises_instead_of_silently_reverting`), so `error` is set
   * and the toast is honest. This check is the second layer: it selects the
   * role back and compares. If any future trigger, policy or column grant ever
   * reintroduces a silent clamp, this turns it into a visible failure instead
   * of a lie. Cheap - the row is already being returned.
   */
  async promoteToDirector(memberId: number) {
    // Explicit column list on the returned representation - implicit
    // `select(*)` would try to return email/phone/auth_uid/google_id, which
    // authenticated no longer has column-level SELECT on.
    const { data, error } = await supabaseCommunity
      .from('members')
      .update({ role: 'hod' })
      .eq('member_id', memberId)
      .select('member_id, role')
      .single()

    if (error) throw logSupabaseError('directorService.promoteToDirector', error)
    if (data?.role !== 'hod') {
      throw new Error(
        `The database refused that promotion: the role is still "${data?.role ?? 'unknown'}". ` +
        'Only an HR or super admin account can change a role.',
      )
    }
    // The database trigger already records member_role_changed in the audit log.
    notifyRoleChange(memberId, 'hod')

    return {
      success: true,
      message: 'Member promoted to HoD successfully',
      data: { member: { memberId: data.member_id } as DirectoryMember }
    }
  },

  async demoteToMember(memberId: number) {
    // Role first, scopes after. If the role update is refused, the HoD must
    // keep their scope: clearing it first left them a HoD with NO scope, which
    // the queue reads as "unscoped" and shows them everything.
    // Explicit column list, and the role read back - see promoteToDirector.
    const { data, error } = await supabaseCommunity
      .from('members')
      .update({ role: 'member' })
      .eq('member_id', memberId)
      .select('member_id, role')
      .single()

    if (error) throw logSupabaseError('directorService.demoteToMember', error)
    if (data?.role !== 'member') {
      throw new Error(
        `The database refused that demotion: the role is still "${data?.role ?? 'unknown'}". ` +
        'Only an HR or super admin account can change a role.',
      )
    }
    await clearLeaderScopes(memberId, 'directorService.demoteToMember')
    notifyRoleChange(memberId, 'member')

    return {
      success: true,
      message: 'Director demoted successfully',
      data: { member: { memberId: data.member_id } as DirectoryMember }
    }
  },

  async changeRole(memberId: number, role: 'member' | 'hod' | 'director' | 'super_admin') {
    // Explicit column list, and the role read back - see promoteToDirector.
    const { data, error } = await supabaseCommunity
      .from('members')
      .update({ role })
      .eq('member_id', memberId)
      .select('member_id, role')
      .single()

    if (error) throw logSupabaseError('directorService.changeRole', error)
    if (data?.role !== role) {
      throw new Error(
        `The database refused that change: the role is still "${data?.role ?? 'unknown'}", not "${role}". ` +
        'Only an HR or super admin account can change a role.',
      )
    }
    // No app-side audit row: the members trigger already writes member_role_changed
    // (with old and new role), so logging it here as well doubled every entry.
    // Downgrading to plain member: clear scopes only AFTER the role change stuck.
    if (role === 'member') await clearLeaderScopes(memberId, 'directorService.changeRole')
    notifyRoleChange(memberId, role)

    return {
      success: true,
      message: `Role updated to ${role}`,
      data: { member: { memberId: data.member_id } as DirectoryMember }
    }
  },

  /**
   * Archive a member, or bring them back — walkthrough item 3.1, the owner's
   * answer to what the directory's "archive" should be: "a place for people
   * who have left".
   * ──────────────────────────────────────────────────────────────────────────
   * A status change, NOT a delete, and that is the whole point. `deleteMember`
   * below removes the row; this keeps the person, their posts, the drives they
   * ran and the notes on their wall exactly where they are, and only takes
   * them off the live lists. Every existing filter keys on 'active', so
   * archiving removes them from the public directory, from the desk's default
   * view and from member-of-the-month eligibility, with no other change.
   *
   * `archived` is deliberately not `suspended` - that value already existed
   * and holds zero rows, but it means a sanction. Graduating and being
   * disciplined must not look the same in a directory of minors.
   *
   * Reads the status back for the same reason the role writers do: the
   * `members_guard_privileged_cols` trigger gates `status` on
   * `is_director()`, and a refusal that presents as success is the failure
   * mode this codebase has already shipped once.
   */
  async setArchived(memberId: number, archived: boolean) {
    const next = archived ? 'archived' : 'active'
    // Guarded on the state we are leaving, so a double click or a second
    // director cannot re-apply the change (and re-notify the member).
    const guarded = supabaseCommunity
      .from('members')
      .update({ status: next })
      .eq('member_id', memberId)
    const { data, error } = await (archived ? guarded.neq('status', 'archived') : guarded.eq('status', 'archived'))
      .select('member_id, status')
      .maybeSingle()

    if (error) throw logSupabaseError('directorService.setArchived', error)
    if (!data) {
      const status = await readMemberStatus(memberId)
      if (status === next) throw new AlreadyDecidedError(archived ? 'This member is already archived.' : 'This member is already restored.')
      throw new Error('The database refused that change. Only a director, HoD, HR or super admin can archive a member.')
    }
    if (data?.status !== next) {
      throw new Error(
        `The database refused that change: the status is still "${data?.status ?? 'unknown'}". ` +
        'Only a director, HoD, HR or super admin can archive a member.',
      )
    }
    logAction(archived ? 'member_archived' : 'member_unarchived', 'member', memberId)
    notificationService.create({
      memberId,
      type: 'system',
      title: archived ? 'Your AquaTerra membership was archived' : 'Welcome back, your membership was restored',
      subtitle: archived
        ? 'You are no longer on the active member lists. Reach out to HR if this is a mistake.'
        : 'You are back on the active member lists.',
      link: archived ? undefined : '/feed',
    })
    return { success: true, message: archived ? 'Member archived' : 'Member restored' }
  },

  /**
   * Soft-delete, not a hard `DELETE FROM members` - owner request 2026-09-12
   * ("superadmins can undo this, right? ... deleted data ek alag database
   * mei stored rakh"). Routes through soft_delete_member() (SECURITY
   * DEFINER, is_super_admin()-gated), which flips status to 'deleted' and
   * stamps deleted_at/deleted_by - nothing is actually removed, so
   * `restoreMember` below can always undo it. See
   * scripts/member_soft_delete_and_restore_2026_09_12.sql.
   */
  async deleteMember(memberId: number) {
    // member_directory_view instead of members directly - see
    // getEligibleMembers above for why (director-gated view, column-level
    // SELECT on members.email no longer granted to authenticated).
    const { data: member } = await (supabaseCommunity as any)
      .from('member_directory_view')
      .select('member_id, email, full_name')
      .eq('member_id', memberId)
      .single()

    if (!member) throw new Error('Member not found')

    const { error } = await supabaseCommunity.rpc('soft_delete_member' as never, { p_member_id: memberId } as never)
    if (error) throw logSupabaseError('directorService.deleteMember', error)

    return {
      success: true,
      message: 'Member deleted successfully',
      data: {
        deletedMember: {
          memberId: member.member_id,
          email: member.email,
          fullName: member.full_name
        }
      }
    }
  },

  /** Undo deleteMember - super_admin/HR only, matching restore_member()'s own gate. */
  async restoreDeletedMember(memberId: number) {
    const { error } = await supabaseCommunity.rpc('restore_member' as never, { p_member_id: memberId } as never)
    if (error) throw logSupabaseError('directorService.restoreDeletedMember', error)
    return { success: true, message: 'Member restored' }
  },

  /** Distinct from restoreDeletedMember above: this sends a deleted member
   *  back through the applicant funnel (status -> pending_approval,
   *  class_grade cleared so /register replays) instead of straight back to
   *  'active' - built for the owner's demo account, which gets deleted and
   *  re-applied with repeatedly to show people the real apply flow. See
   *  restart_member_as_applicant_2026_09_14.sql. */
  async restartMemberAsApplicant(memberId: number) {
    const { error } = await supabaseCommunity.rpc('restart_member_as_applicant' as never, { p_member_id: memberId } as never)
    if (error) throw logSupabaseError('directorService.restartMemberAsApplicant', error)
    return { success: true, message: 'Member restarted as a new applicant' }
  },

  /**
   * Count of pending posts in a leader's team scope - used by the Post Queue
   * nav badge so it matches the queue the leader actually sees (same scoping
   * as getPendingPosts, via applyPostScope). Returns 0 when there is no team
   * scope; callers use the global dashboard count in that case.
   */
  async getScopedPendingPostsCount(scopeTeamIds: number[] = []) {
    if (scopeTeamIds.length === 0) return { success: true, data: 0 }
    const scopedPostIds = [...await this.getScopedPendingPostIds(scopeTeamIds), ...await this.getUntaggedPendingPostIds()]
    const { count, error } = await withRetry(async () => (applyPostScope(supabaseCommunity
      .from('post_feed_view')
      .select('post_id', { count: 'exact', head: true })
      .eq('status', 'pending_review') as any, [], scopeTeamIds, scopedPostIds) as any)
      // Member submissions only, matching getPendingPosts. NOTE this is
      // `source_kind` (stored on the post) and NOT the view's `source_type`,
      // which is derived from three RLS-filtered LEFT JOINs and therefore
      // answers a different question - it reads NULL for a reader who cannot
      // see the source row, so a mirror would slip back into this count for
      // anyone whose RLS hides the blog.
      .is('source_kind', null))

    if (error) throw logSupabaseError('directorService.getScopedPendingPostsCount', error)
    return { success: true, data: count || 0 }
  }
}

export const directorService = withFunctionLogging('directorService', directorServiceImpl)

export default directorService
