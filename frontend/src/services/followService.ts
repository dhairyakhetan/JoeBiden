import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId, resolveMemberIdFromUuid } from '../lib/authCache'
import { notificationService } from './notificationService'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

// ─────────────────────────────────────────────────────────────────────────────
// followService - real follow graph backed by the public.follows table.
// Schema: follows(follow_id, follower_id, followee_id, created_at)
// UNIQUE (follower_id, followee_id), CHECK follower_id <> followee_id
// RLS: anyone can read; insert/delete restricted to the current member.
// ─────────────────────────────────────────────────────────────────────────────

export interface FollowerListItem {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl?: string
  role: string
  followedAt: string
}

// Was a private copy of this lookup. It is now the shared, deduped one in
// lib/authCache, so a profile page's several callers share one request.

const followServiceImpl = {
  /** Follow another member by their member_id. Idempotent (ignores duplicates). */
  async follow(followeeMemberId: number) {
    const followerId = await getCachedMemberId()
    if (!followerId) throw new Error('Not authenticated')
    if (followerId === followeeMemberId) throw new Error('Cannot follow yourself')

    const { error } = await supabaseCommunity
      .from('follows')
      .insert({ follower_id: followerId, followee_id: followeeMemberId })

    // 23505 = unique_violation - already following, treat as success silently.
    if (error && (error as any).code !== '23505') throw error

    // ── Notify the followee (only on a genuine new follow, not a re-tap) ──
    if (!error) {
      const [{ data: actor }, { data: target }] = await Promise.all([
        supabaseCommunity.from('members').select('full_name, uuid').eq('member_id', followerId).single(),
        supabaseCommunity.from('members').select('uuid').eq('member_id', followeeMemberId).single(),
      ])
      if (actor) {
        await notificationService.create({
          memberId: followeeMemberId,
          type: 'follow',
          title: `${(actor as any).full_name} started following you`,
          link: `/member/${(actor as any).uuid}`,
        })
      }
      void target // currently unused - left for future "you follow them too" logic
    }

    return { success: true }
  },

  /** Unfollow another member. Idempotent. */
  async unfollow(followeeMemberId: number) {
    const followerId = await getCachedMemberId()
    if (!followerId) throw new Error('Not authenticated')

    const { error } = await supabaseCommunity
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('followee_id', followeeMemberId)

    if (error) throw logSupabaseError('followService.unfollow', error)
    return { success: true }
  },

  /** Convenience: follow/unfollow by the target member's UUID. */
  async followByUuid(targetUuid: string) {
    const id = await resolveMemberIdFromUuid(targetUuid)
    if (!id) throw new Error('Member not found')
    return this.follow(id)
  },
  async unfollowByUuid(targetUuid: string) {
    const id = await resolveMemberIdFromUuid(targetUuid)
    if (!id) throw new Error('Member not found')
    return this.unfollow(id)
  },

  /** Whether the current member is following the target. */
  async isFollowing(targetUuid: string): Promise<boolean> {
    const me = await getCachedMemberId()
    if (!me) return false
    const targetId = await resolveMemberIdFromUuid(targetUuid)
    if (!targetId) return false

    const { data, error } = await supabaseCommunity
      .from('follows')
      .select('follow_id')
      .eq('follower_id', me)
      .eq('followee_id', targetId)
      .limit(1)
    if (error) return false
    return (data?.length ?? 0) > 0
  },

  /** Follower / following counts for a profile (by UUID). */
  async getCounts(targetUuid: string): Promise<{ followers: number; following: number }> {
    const targetId = await resolveMemberIdFromUuid(targetUuid)
    if (!targetId) return { followers: 0, following: 0 }

    const [{ count: followers }, { count: following }] = await Promise.all([
      supabaseCommunity
        .from('follows')
        .select('follow_id', { count: 'exact', head: true })
        .eq('followee_id', targetId),
      supabaseCommunity
        .from('follows')
        .select('follow_id', { count: 'exact', head: true })
        .eq('follower_id', targetId),
    ])
    return { followers: followers ?? 0, following: following ?? 0 }
  },

  /** List followers of a member. */
  async getFollowers(targetUuid: string, params: { limit?: number; offset?: number } = {}): Promise<FollowerListItem[]> {
    const targetId = await resolveMemberIdFromUuid(targetUuid)
    if (!targetId) return []

    const limit = params.limit ?? 50
    const offset = params.offset ?? 0

    const { data, error } = await supabaseCommunity
      .from('follows')
      .select('created_at, members!follower_id (member_id, uuid, full_name, avatar_url, role)')
      .eq('followee_id', targetId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw logSupabaseError('followService.getFollowers', error)
    return (data ?? []).map((row: any) => ({
      memberId: row.members.member_id,
      uuid: row.members.uuid,
      fullName: row.members.full_name,
      avatarUrl: row.members.avatar_url ?? undefined,
      role: row.members.role ?? 'member',
      followedAt: row.created_at,
    }))
  },

  /** List who a member is following. */
  async getFollowing(sourceUuid: string, params: { limit?: number; offset?: number } = {}): Promise<FollowerListItem[]> {
    const sourceId = await resolveMemberIdFromUuid(sourceUuid)
    if (!sourceId) return []

    const limit = params.limit ?? 50
    const offset = params.offset ?? 0

    const { data, error } = await supabaseCommunity
      .from('follows')
      .select('created_at, members!followee_id (member_id, uuid, full_name, avatar_url, role)')
      .eq('follower_id', sourceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw logSupabaseError('followService.getFollowing', error)
    return (data ?? []).map((row: any) => ({
      memberId: row.members.member_id,
      uuid: row.members.uuid,
      fullName: row.members.full_name,
      avatarUrl: row.members.avatar_url ?? undefined,
      role: row.members.role ?? 'member',
      followedAt: row.created_at,
    }))
  },
}

export const followService = withFunctionLogging('followService', followServiceImpl)

// ─────────────────────────────────────────────────────────────────────────────
// Follow a TEAM, not just a person (public.team_follows, added 2026-09-14 -
// social-system IA audit). Mirrors the person-follow functions above exactly:
// same idempotent-insert/delete shape, same RLS contract (anyone reads,
// writer restricted to their own row). See scripts/team_follows_table_
// 2026_09_14.sql for the schema/RLS.
// ─────────────────────────────────────────────────────────────────────────────

// TeamDetails (teamService.ts's `Team`) carries only a uuid, not the numeric
// team_id team_follows is keyed on - small in-memory cache so a page that
// calls several of the byUuid wrappers below for the same team doesn't
// re-resolve it every time (same pattern as authCache's member resolver).
const teamIdByUuid = new Map<string, number>()
async function resolveTeamIdFromUuid(uuid: string): Promise<number | null> {
  if (teamIdByUuid.has(uuid)) return teamIdByUuid.get(uuid)!
  const { data, error } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', uuid).maybeSingle()
  if (error || !data) return null
  teamIdByUuid.set(uuid, (data as any).team_id)
  return (data as any).team_id
}

const teamFollowServiceImpl = {
  /** Follow a team by its numeric team_id. Idempotent. */
  async followTeam(teamId: number) {
    const followerId = await getCachedMemberId()
    if (!followerId) throw new Error('Not authenticated')

    const { error } = await (supabaseCommunity.from('team_follows' as any) as any)
      .insert({ follower_id: followerId, team_id: teamId })

    // 23505 = unique_violation - already following, treat as success silently.
    if (error && (error as any).code !== '23505') throw error
    return { success: true }
  },

  /** Unfollow a team. Idempotent. */
  async unfollowTeam(teamId: number) {
    const followerId = await getCachedMemberId()
    if (!followerId) throw new Error('Not authenticated')

    const { error } = await (supabaseCommunity.from('team_follows' as any) as any)
      .delete()
      .eq('follower_id', followerId)
      .eq('team_id', teamId)

    if (error) throw logSupabaseError('teamFollowService.unfollowTeam', error)
    return { success: true }
  },

  /** Whether the current member follows this team. */
  async isFollowingTeam(teamId: number): Promise<boolean> {
    const me = await getCachedMemberId()
    if (!me) return false

    const { data, error } = await (supabaseCommunity.from('team_follows' as any) as any)
      .select('follow_id')
      .eq('follower_id', me)
      .eq('team_id', teamId)
      .limit(1)
    if (error) return false
    return (data?.length ?? 0) > 0
  },

  /** Follower count for a team - shown next to the follow toggle. */
  async getTeamFollowerCount(teamId: number): Promise<number> {
    const { count } = await (supabaseCommunity.from('team_follows' as any) as any)
      .select('follow_id', { count: 'exact', head: true })
      .eq('team_id', teamId)
    return count ?? 0
  },

  /** Every team_id the current member follows - feedService's 'myteams' tab
   *  uses this to include followed (not just joined) teams' posts, so
   *  following a team's posts no longer requires actually joining it. */
  async getFollowedTeamIds(): Promise<number[]> {
    const me = await getCachedMemberId()
    if (!me) return []
    const { data, error } = await (supabaseCommunity.from('team_follows' as any) as any)
      .select('team_id')
      .eq('follower_id', me)
      .limit(500)
    if (error) return []
    return Array.from(new Set((data || []).map((r: any) => r.team_id).filter(Boolean))) as number[]
  },

  // ── By-uuid convenience, for callers (TeamDetailPage) that only have the
  // team's uuid, not its numeric team_id ──
  async followTeamByUuid(teamUuid: string) {
    const id = await resolveTeamIdFromUuid(teamUuid)
    if (!id) throw new Error('Team not found')
    return this.followTeam(id)
  },
  async unfollowTeamByUuid(teamUuid: string) {
    const id = await resolveTeamIdFromUuid(teamUuid)
    if (!id) throw new Error('Team not found')
    return this.unfollowTeam(id)
  },
  async isFollowingTeamByUuid(teamUuid: string): Promise<boolean> {
    const id = await resolveTeamIdFromUuid(teamUuid)
    if (!id) return false
    return this.isFollowingTeam(id)
  },
}

export const teamFollowService = withFunctionLogging('teamFollowService', teamFollowServiceImpl)

export default followService
