import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId, resolveMemberIdFromUuid } from '../lib/authCache'
import { attachDocuments } from '../lib/postDocuments'
import { withRetry } from '../lib/asyncUtils'
import { Post, PaginatedResponse } from './api'
import { resizeForUpload } from '../lib/resizeImage'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

// Exactly the columns the post mapper below reads - projecting these
// instead of `*` drops the unused view columns (pinned_title, team_*,
// updated_at) from the payload. No behavior change.
// `source_type` ADDED (redesign 08.4) so a saved post can be told apart from
// a saved drive/opening mirror (see api.ts's `Post.sourceType` comment and
// feedService.ts, which already selects this same column on its own wider
// projection). Existing consumers of this constant (getMemberPosts,
// getTaggedPosts below) ignore the extra field - PostgREST returning one more
// column changes no `.eq()`/`.order()`/`.range()` and breaks nothing that
// destructures a subset of it.
export const POST_FEED_COLS =
  // `source_title` and `source_read_minutes` are here because savedPostsService
// maps `source_type`, so a bookmarked essay reaches C06 on /saved - and
// without these two it rendered an EMPTY <h3> and fell back to the word
// count over the 630-char excerpt, i.e. "1 min read" for a 7-minute essay.
// Deliberately NOT `article_body`: that would ship the whole essay to every
// consumer of this projection. Search filters on it without selecting it.
'post_id, uuid, category, body, link_url, link_title, link_image, status, created_at, author_id, author_uuid, author_name, author_avatar, author_role, like_count, comment_count, images, tagged_members, source_type, source_title, source_read_minutes'

export interface MemberProfile {
  uuid: string
  email?: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  phone?: string
  joinReason?: string
  bio?: string
  role: 'member' | 'director'
  status: string
  createdAt?: string
  postCount?: number
  taggedCount?: number
  schoolId?: number
  schoolUuid?: string
  schoolName?: string
  classId?: number
  classUuid?: string
  className?: string
  /** Nullable date (YYYY-MM-DD). Year may be a placeholder — see the
   *  column's own DB comment (member_birthdays_2026_08_29.sql). */
  birthday?: string
  /** Defaults to false for every existing member — see the migration's
   *  design-choice note. Opt-in, not opt-out, for the existing base. */
  birthdayPublic?: boolean
}

export interface NewMemberCard {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl: string | null
  schoolName: string | null
}

export interface UpdateProfileData {
  fullName?: string
  email?: string
  avatarUrl?: string
  classGrade?: string
  phone?: string
  bio?: string
  schoolId?: number
  birthday?: string | null
  birthdayPublic?: boolean
}

const profileServiceImpl = {
  async getCurrentMember() {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    // get_own_member() (SECURITY DEFINER RPC) instead of `select('*')` on
    // members directly - email/phone/auth_uid/google_id are locked down at
    // the column level for the `authenticated` role (see
    // scripts/members_pii_lockdown_2026_07_29.sql), so a plain select would
    // fail. The RPC doesn't carry the schools embed, so fetch that
    // separately when present - schools isn't PII, no lockdown there.
    const { data: member, error } = await supabaseCommunity
      .rpc('get_own_member' as never)
      .single()

    if (error || !member) throw new Error('Member profile not found')
    const m = member as any

    let schools: any = null
    if (m.school_id) {
      const { data: schoolRow } = await supabaseCommunity
        .from('schools')
        .select('school_id, uuid, name, short_name, logo_url')
        .eq('school_id', m.school_id)
        .maybeSingle()
      schools = schoolRow
    }

    return { ...m, schools } as any
  },

  async getOwnProfile() {
    const member = await this.getCurrentMember()
    const school = member.schools as any

    const profile: MemberProfile = {
      uuid: member.uuid,
      email: member.email,
      fullName: member.full_name,
      avatarUrl: member.avatar_url ?? undefined,
      classGrade: member.class_grade ?? undefined,
      phone: member.phone ?? undefined,
      joinReason: member.join_reason ?? undefined,
      bio: member.bio ?? undefined,
      role: (member.role === 'super_admin' ? 'director' : member.role) as 'member' | 'director',
      status: member.status ?? 'active',
      createdAt: member.created_at ?? undefined,
      schoolId: member.school_id ?? undefined,
      schoolUuid: school?.uuid ?? undefined,
      schoolName: school?.name ?? undefined,
      postCount: 0,
      taggedCount: 0,
      birthday: member.birthday ?? undefined,
      birthdayPublic: member.birthday_public ?? false
    }

    return { success: true, data: { member: profile } }
  },

  async updateProfile(data: UpdateProfileData) {
    const member = await this.getCurrentMember()

    const updateData: any = {}
    if (data.fullName !== undefined) updateData.full_name = data.fullName
    // email is DELIBERATELY not writable here. It is the identity link to the
    // Google OAuth account, and it was a privilege-escalation vector:
    // claim_member_preauth() (SECURITY DEFINER, callable by any signed-in
    // member) matched member_preauth on members.email and, on a "hod"/"manager"
    // preauth row, inserted a team_members row with role='lead'. Since a member
    // could UPDATE their own email, they could point it at a known leadership
    // pre-auth address and self-assign as lead of a team they were never
    // invited to - bypassing the director-only RLS on team_members, which the
    // RPC's SECURITY DEFINER context sidesteps. The RPC now reads the verified
    // JWT email instead, and the column grant is revoked; this is the third
    // layer. EditProfilePage already stopped sending it (the field is locked,
    // matching Register's "locked to Google" copy) - this stops the service
    // accepting it at all.
    if (data.avatarUrl !== undefined) updateData.avatar_url = data.avatarUrl
    if (data.classGrade !== undefined) updateData.class_grade = data.classGrade
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.bio !== undefined) updateData.bio = data.bio
    if (data.schoolId !== undefined) updateData.school_id = data.schoolId || null
    if (data.birthday !== undefined) updateData.birthday = data.birthday || null
    if (data.birthdayPublic !== undefined) updateData.birthday_public = data.birthdayPublic

    // No `.select()` chained: PostgREST's update-representation would try to
    // return email/phone in the response, which the authenticated role no
    // longer has SELECT on at the column level. Update, then re-read the
    // fresh row through the same safe RPC path getCurrentMember() uses.
    const { error } = await supabaseCommunity
      .from('members')
      .update(updateData)
      .eq('member_id', member.member_id)

    if (error) throw logSupabaseError('profileService.updateProfile', error)
    const u = await this.getCurrentMember()
    const school = u.schools as any

    const profile: MemberProfile = {
      uuid: u.uuid,
      email: u.email,
      fullName: u.full_name,
      avatarUrl: u.avatar_url ?? undefined,
      classGrade: u.class_grade ?? undefined,
      phone: u.phone ?? undefined,
      joinReason: u.join_reason ?? undefined,
      bio: u.bio ?? undefined,
      role: (u.role === 'super_admin' ? 'director' : u.role) as 'member' | 'director',
      status: u.status ?? 'active',
      createdAt: u.created_at ?? undefined,
      schoolId: u.school_id ?? undefined,
      schoolUuid: school?.uuid ?? undefined,
      schoolName: school?.name ?? undefined,
      postCount: 0,
      taggedCount: 0,
      birthday: u.birthday ?? undefined,
      birthdayPublic: u.birthday_public ?? false
    }

    return { success: true, message: 'Profile updated successfully', data: { member: profile } }
  },

  async getPublicProfile(uuid: string) {
    // Public route (/member/:uuid) — reachable logged-out. Project only the
    // non-PII columns this mapper actually reads; never `*` (which pulls
    // email/phone over the anon key). This keeps the read working after
    // `REVOKE SELECT (email, phone) ON members FROM anon`.
    //
    // `class_grade` is revoked from `anon` as well (2026-09-19), so it may only
    // be NAMED when there is a session. PostgREST rejects the WHOLE query, not
    // just the offending column, when the caller cannot read one of them — so
    // naming it unconditionally would 403 the entire public profile rather than
    // blanking one field. One call backs two routes: `/profile/:uuid` (signed
    // in) renders the class line, `/member/:uuid` (public) never did.
    //
    // `bio` stays readable by anon deliberately. It is written to be read, it
    // is profanity-filtered on save, it carries no contact detail, and the
    // public profile both displays it and builds its meta description from it.
    const signedIn = (await getCachedMemberId()) != null
    const cols =
      'uuid, full_name, avatar_url, bio, role, status, created_at, school_id'
      + (signedIn ? ', class_grade' : '')
      + ', schools (school_id, uuid, name, short_name, logo_url)'

    const { data: member, error } = await supabaseCommunity
      .from('members')
      .select(cols)
      .eq('uuid', uuid)
      .single()

    if (error) throw logSupabaseError('profileService.getPublicProfile', error)
    const m = member as any
    const school = m.schools as any

    const profile: MemberProfile = {
      uuid: m.uuid,
      fullName: m.full_name,
      avatarUrl: m.avatar_url ?? undefined,
      classGrade: m.class_grade ?? undefined,
      bio: m.bio ?? undefined,
      role: (m.role === 'super_admin' ? 'director' : m.role) as 'member' | 'director',
      status: m.status ?? 'active',
      createdAt: m.created_at ?? undefined,
      schoolId: m.school_id ?? undefined,
      schoolUuid: school?.uuid ?? undefined,
      schoolName: school?.name ?? undefined,
      postCount: 0,
      taggedCount: 0
    }

    return { success: true, data: { profile } }
  },

  // Real lifetime like total across a member's published posts. The profile
  // hero previously summed likeCount over only the first loaded page of posts,
  // undercounting any member with more than one page.
  async getLifetimeLikes(uuid: string): Promise<number> {
    // Deduped + cached across the whole page load - see lib/authCache.
    const memberId = await resolveMemberIdFromUuid(uuid)
    if (!memberId) return 0
    const { data } = await supabaseCommunity
      .from('post_feed_view')
      .select('like_count')
      .eq('author_id', memberId)
      .eq('status', 'published')
    return (data || []).reduce((sum: number, r: any) => sum + (r.like_count || 0), 0)
  },

  /**
   * changelog/22-social-engine.md §22.3, "new this week" - free, because
   * approvals already stamp `members.approved_at`. Active members approved
   * in the last 7 days, newest-approved first, capped at `limit`. `schools`
   * is a plain FK embed (not PII-locked, unlike email/phone - see
   * getCurrentMember's own note above), same pattern getPublicProfile already
   * uses. Throws per this file's contract; the home page's page-local loader
   * (mirroring its loadNoticesFromDB/loadMemberOfMonth) is what catches this
   * for a purely decorative rail strip.
   */
  async getNewThisWeek(limit = 6): Promise<NewMemberCard[]> {
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const { data, error } = await supabaseCommunity
      .from('members')
      .select('member_id, uuid, full_name, avatar_url, approved_at, schools (name, short_name)')
      .eq('status', 'active')
      .gte('approved_at', since)
      .order('approved_at', { ascending: false })
      .limit(limit)
    if (error) throw logSupabaseError('profileService.getNewThisWeek', error)
    return (data || []).map((m: any) => ({
      memberId: m.member_id,
      uuid: m.uuid,
      fullName: m.full_name,
      avatarUrl: m.avatar_url ?? null,
      schoolName: m.schools?.short_name || m.schools?.name || null,
    }))
  },

  async getMemberPosts(uuid: string, params: { page?: number; limit?: number }) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    // ONE round trip, not two (audit 2026-09-17, efficiency P3). This used to
    // resolve the uuid to a member_id against `members` first, then filter the
    // view by author_id - two serial calls, and the first one is the only
    // reason this function touched `members` at all. post_feed_view already
    // carries `author_uuid` (it is in POST_FEED_COLS above), so the view can be
    // filtered directly and the resolve disappears.
    //
    // Behaviour note: an unknown uuid now yields an empty page instead of
    // throwing "Member not found". Every caller loads the profile itself
    // separately and handles the missing-member case there (see
    // PublicProfilePage and ProfilePage), so a throw here only ever produced a
    // second, redundant error for a case already handled.
    const { data, count, error } = await supabaseCommunity
      .from('post_feed_view')
      .select(POST_FEED_COLS, { count: 'exact' })
      .eq('author_uuid', uuid)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw logSupabaseError('profileService.getMemberPosts', error)

    const posts = (data || []).map((post: any) => ({
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
      likeCount: post.like_count || 0,
      commentCount: post.comment_count || 0,
      images: post.images ? (post.images as any[]).map((img: any) => ({
        blobUrl: img.url,
        displayOrder: img.order
      })) : [],
      taggedMembers: post.tagged_members ? (post.tagged_members as any[]).map((m: any) => ({
        memberId: m.id,
        uuid: m.uuid,
        fullName: m.name
      })) : []
    }))

    await attachDocuments(posts)
    const totalItems = count || 0
    const totalPages = Math.ceil(totalItems / limit)

    return {
      success: true,
      data: posts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    } as PaginatedResponse<Post>
  },

  async getTaggedPosts(uuid: string, params: { page?: number; limit?: number }) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    const memberId = await resolveMemberIdFromUuid(uuid)
    if (!memberId) throw new Error('Member not found')

    const { data: tags } = await withRetry(async () => supabaseCommunity
      .from('post_tags')
      .select('post_id')
      .eq('tagged_member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(200))
    const postIds = tags?.map(t => t.post_id) || []

    if (postIds.length === 0) {
      return {
        success: true,
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
          hasNextPage: false,
          hasPrevPage: false
        }
      } as PaginatedResponse<Post>
    }

    const { data, count, error } = await withRetry(async () => supabaseCommunity
      .from('post_feed_view')
      .select(POST_FEED_COLS, { count: 'exact' })
      .in('post_id', postIds)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1))

    if (error) throw logSupabaseError('profileService.getTaggedPosts', error)

    const posts = (data || []).map((post: any) => ({
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
      likeCount: post.like_count || 0,
      commentCount: post.comment_count || 0,
      images: post.images ? (post.images as any[]).map((img: any) => ({
        blobUrl: img.url,
        displayOrder: img.order
      })) : [],
      taggedMembers: post.tagged_members ? (post.tagged_members as any[]).map((m: any) => ({
        memberId: m.id,
        uuid: m.uuid,
        fullName: m.name
      })) : []
    }))

    await attachDocuments(posts)
    const totalItems = count || 0
    const totalPages = Math.ceil(totalItems / limit)

    return {
      success: true,
      data: posts,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    } as PaginatedResponse<Post>
  },

  async uploadAvatar(original: File) {
    // Avatars render at 40 px nearly everywhere; cap the stored original at
    // 512 px long edge (lib/resizeImage.ts). Non-throwing: falls back to the
    // original file if the browser can't resize it.
    const file = await resizeForUpload(original, 'avatar')
    const member = await this.getCurrentMember()
    const previousUrl: string | null = member.avatar_url ?? null
    const fileExt = file.name.split('.').pop()
    const fileName = `${member.uuid}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `avatars/${fileName}`

    const { error: uploadError } = await supabaseCommunity.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', upsert: false })

    if (uploadError) throw logSupabaseError('profileService.uploadAvatar', uploadError)

    const { data: publicUrlData } = supabaseCommunity.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const newUrl = publicUrlData.publicUrl

    // Persist immediately to members.avatar_url so the DB is always in sync -
    // even if the user navigates away before clicking "save".
    const { error: updateError } = await supabaseCommunity
      .from('members')
      .update({ avatar_url: newUrl })
      .eq('member_id', member.member_id)

    if (updateError) {
      // Roll back the upload to avoid orphan blobs in storage. Log to
      // console if the rollback itself fails - orphan file at
      // `filePath` will need manual cleanup but doesn't block the user.
      await supabaseCommunity.storage.from('avatars').remove([filePath])
        .catch((err) => console.warn('[profileService] rollback delete failed for', filePath, err))
      throw logSupabaseError('profileService.uploadAvatar', updateError)
    }

    // Best-effort cleanup of the previous blob (skipped if it's not in our bucket
    // or if the storage delete is denied by RLS - never blocks the happy path).
    if (previousUrl) {
      const marker = '/storage/v1/object/public/avatars/'
      const idx = previousUrl.indexOf(marker)
      if (idx >= 0) {
        const oldPath = previousUrl.slice(idx + marker.length)
        // Log failures so accumulating orphan blobs are debuggable, but
        // never block the happy path - the user already has a new avatar.
        supabaseCommunity.storage.from('avatars').remove([oldPath])
          .catch((err) => console.warn('[profileService] old avatar cleanup failed for', oldPath, err))
      }
    }

    return { success: true, data: { url: newUrl } }
  },

  /**
   * Birthday notice-board post - SECURITY DEFINER RPC, safe to call on every
   * profile visit. It resolves the caller's own row server-side and is a
   * real no-op (created: false) unless it's genuinely their birthday today
   * (IST), they're opted into the public notice, and nothing was posted yet
   * this year - see scripts/birthday_notice_board_2026_08_31.sql for the
   * full reasoning. `as never` cast: the RPC predates the generated types.
   */
  async createBirthdayNotice() {
    const { data, error } = await supabaseCommunity
      .rpc('create_birthday_notice' as never)
      .maybeSingle()
    if (error) throw logSupabaseError('profileService.createBirthdayNotice', error)
    return data as { post_uuid: string; created: boolean } | null
  },
}

export const profileService = withFunctionLogging('profileService', profileServiceImpl)

export default profileService
