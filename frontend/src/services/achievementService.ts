import { supabaseCommunity } from '../lib/supabaseCommunity'
import { resolveMemberIdFromUuid } from '../lib/authCache'
import { getCachedMemberId } from '../lib/authCache'
import { Achievement, PaginatedResponse } from './api'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

const mapAchievementFromDB = (data: any): Achievement => ({
  achievementId: data.achievement_id,
  uuid: data.uuid,
  memberId: data.member_id,
  title: data.title,
  description: data.description,
  achievementType: data.achievement_type,
  achievementDate: data.achievement_date,
  achievementEndDate: data.achievement_end_date,
  proofUrl: data.proof_url,
  createdAt: data.created_at,
  updatedAt: data.updated_at,
  status: data.status ?? 'approved',
  reviewedBy: data.reviewed_by,
  reviewedAt: data.reviewed_at,
  reviewNote: data.review_note,
})

const achievementServiceImpl = {
  async getCurrentMemberId() {
    // Reuse the shared cached member-id (in-flight dedup) instead of a fresh
    // getSession + members round-trip on every achievement call.
    const id = await getCachedMemberId()
    if (id == null) throw new Error('Not authenticated')
    return id
  },

  async getMyAchievements(params: { page?: number; limit?: number; type?: string } = {}) {
    const currentMemberId = await this.getCurrentMemberId()
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    let query = supabaseCommunity
      .from('external_achievements')
      .select('*', { count: 'exact' })
      .eq('member_id', currentMemberId)
      .order('achievement_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (params.type) {
      query = query.eq('achievement_type', params.type)
    }

    const { data, count, error } = await query
    if (error) throw logSupabaseError('achievementService.getMyAchievements', error)

    const mapped = (data || []).map(mapAchievementFromDB)
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
    } as PaginatedResponse<Achievement>
  },

  /**
   * `status` is optional and narrows BOTH the rows and the exact count.
   *
   * RLS already hides non-approved rows from an ordinary visitor, so for them
   * the unfiltered count is approved-only anyway - but a DIRECTOR viewing
   * someone else's profile passes the `is_director()` branch and would
   * otherwise see a public stat that includes that member's pending and
   * rejected submissions. Callers rendering the PUBLIC tally pass
   * status:'approved' so the number means the same thing to everyone.
   */
  async getMemberAchievements(memberUuid: string, params: { page?: number; limit?: number; type?: string; status?: string } = {}) {
    const page = params.page || 1
    const limit = params.limit || 10
    const offset = (page - 1) * limit

    // Shared, deduped resolver - see lib/authCache.
    const memberId = await resolveMemberIdFromUuid(memberUuid)
    if (!memberId) throw new Error('Member not found')

    let query = supabaseCommunity
      .from('external_achievements')
      .select('*', { count: 'exact' })
      .eq('member_id', memberId)
      .order('achievement_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (params.type) {
      query = query.eq('achievement_type', params.type)
    }
    if (params.status) {
      query = query.eq('status', params.status)
    }

    const { data, count, error } = await query
    if (error) throw logSupabaseError('achievementService.getMemberAchievements', error)

    const mapped = (data || []).map(mapAchievementFromDB)
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
    } as PaginatedResponse<Achievement>
  },

  async createAchievement(data: {
    title: string
    description?: string
    achievementType: string
    achievementDate: string
    achievementEndDate?: string | null
    proofUrl?: string
  }) {
    const currentMemberId = await this.getCurrentMemberId()

    const { data: inserted, error } = await supabaseCommunity
      .from('external_achievements')
      .insert({
        member_id: currentMemberId,
        title: data.title,
        description: data.description,
        achievement_type: data.achievementType,
        achievement_date: data.achievementDate,
        achievement_end_date: data.achievementEndDate,
        proof_url: data.proofUrl,
        // Achievements go live on submit (user decision, 2026-09-03). The
        // director-side review desk is gone, so nothing would ever move a row
        // out of the column default 'pending' - the insert writes the approved
        // status itself. No schema change: `status` is an existing column and
        // 'approved' is an existing value it already held.
        status: 'approved'
      })
      .select()
      .single()

    if (error) throw logSupabaseError('achievementService.createAchievement', error)

    return {
      success: true,
      message: 'Achievement created successfully',
      data: { achievement: mapAchievementFromDB(inserted) }
    }
  },

  async updateAchievement(uuid: string, data: {
    title?: string
    description?: string
    achievementType?: string
    achievementDate?: string
    achievementEndDate?: string | null
    proofUrl?: string
  }) {
    const updateData: any = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    if (data.achievementType !== undefined) updateData.achievement_type = data.achievementType
    if (data.achievementDate !== undefined) updateData.achievement_date = data.achievementDate
    if (data.achievementEndDate !== undefined) updateData.achievement_end_date = data.achievementEndDate
    if (data.proofUrl !== undefined) updateData.proof_url = data.proofUrl

    const { data: updated, error } = await supabaseCommunity
      .from('external_achievements')
      .update(updateData)
      .eq('uuid', uuid)
      .select()
      .single()

    if (error) throw logSupabaseError('achievementService.updateAchievement', error)

    return {
      success: true,
      message: 'Achievement updated successfully',
      data: { achievement: mapAchievementFromDB(updated) }
    }
  },

  async deleteAchievement(uuid: string) {
    // .select() + zero-row guard: an RLS-blocked DELETE returns no error and
    // zero rows, so this used to report "deleted successfully" for an
    // achievement that was still there. Matches the guard in lib/jobOpenings.ts.
    const { data, error } = await supabaseCommunity
      .from('external_achievements')
      .delete()
      .eq('uuid', uuid)
      .select('uuid')

    if (error) throw logSupabaseError('achievementService.deleteAchievement', error)
    if (!data || data.length === 0) throw new Error("Couldn't delete this achievement: you may not have permission.")

    return {
      success: true,
      message: 'Achievement deleted successfully'
    }
  },

  // ── Share an approved achievement as a feed post ────────────────────────
  // Builds the post body from the achievement title + description, posts
  // it via the existing feedService.createPost path, and attaches the
  // proof image if one was uploaded. Returns the new post's uuid so the
  // caller can navigate or toast a link to it.
  async shareAsPost(uuid: string, options: { category?: string } = {}) {
    // Lazy-import so this service doesn't drag feedService into the
    // initial bundle unless a user actually clicks Share.
    const { default: feedService } = await import('./feedService')

    // Re-fetch the achievement first so we never share stale local state.
    const { data: row, error: fetchErr } = await supabaseCommunity
      .from('external_achievements')
      .select('*')
      .eq('uuid', uuid)
      .single()
    if (fetchErr) throw logSupabaseError('achievementService.shareAsPost', fetchErr)
    if (row.status !== 'approved') {
      throw new Error('Only approved achievements can be shared to the feed')
    }

    const ach = mapAchievementFromDB(row)
    const bodyLines = [
      `🏆 ${ach.title}`,
      ach.description ? '' : null,
      ach.description ?? null,
    ].filter((l): l is string => l !== null)

    // Map achievement_type → post category for visual continuity.
    const categoryByType: Record<string, string> = {
      leadership: 'operations',
      academic: 'content',
      competition: 'events',
      personal_project: 'labs',
      other: 'content',
    }
    const category = options.category || categoryByType[ach.achievementType] || 'content'

    const result = await feedService.createPost({
      body: bodyLines.join('\n'),
      category,
      // If the achievement had a proof image, pass it as the post's image
      // so the feed card has the visual context.
      imageUrls: ach.proofUrl ? [ach.proofUrl] : undefined,
    })

    return result
  },
}

export const achievementService = withFunctionLogging('achievementService', achievementServiceImpl)

export default achievementService
