import { hasLeaderAccess } from '../lib/roles'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId, resolveMemberIdFromUuid } from '../lib/authCache'
import { withRetry } from '../lib/asyncUtils'
import { notificationService } from './notificationService'
import { logAction } from '../lib/auditLog'
import { PaginatedResponse, Post } from './api'
import { POST_FEED_COLS } from './profileService'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'
import { groupChartRoster, type ChartRoster } from '../lib/chartRoster'

export interface Team {
  uuid: string
  name: string
  description: string
  category: string
  logoUrl?: string
  /** Wide hero image for the team page (see teams_skills_and_banner_2026_07.sql). */
  bannerUrl?: string
  /** Concrete skills a member builds on this team — rendered on the team page. */
  skills?: string[]
  memberCount: number
  projectCount?: number
  createdAt: string
  createdBy?: number
  createdByName?: string
  createdByUuid?: string
  /** The department this team sits inside (Marketing for Social Media), when it has one. */
  parentUuid?: string
}

export interface TeamDetails extends Team {
  members: TeamMember[]
  /**
   * This department's sub-departments.
   *
   * Added 2026-09-18. The About-page org chart could already drill from a
   * department into a sub-department, but the DEPARTMENT PAGE itself listed
   * none of them - so having followed the chart into /teams/:uuid you could not
   * see, or reach, the sub-teams underneath it without going back to /about.
   * Embedded in the existing getTeam() query rather than fetched separately, the
   * same shape getDepartmentTree() already uses.
   */
  subTeams: SubTeam[]
  /** The department this one sits inside (Marketing above Social Media), when it has one. */
  parent?: { uuid: string; name: string }
  /** Departments that sit inside this one. Empty for most. */
  childTeams: { uuid: string; name: string; memberCount: number }[]
}

/** A sub-department within a team — see sub_teams_hierarchy_2026_09_17.sql. */
export interface SubTeam {
  uuid: string
  slug: string
  name: string
  description?: string
  memberCount: number
}

/** A department (team) plus its sub-departments, for the About-page org chart. */
export interface DepartmentTreeTeam extends Team {
  /** teams.team_id: what an opening's team_id points at, so the chart can say which teams are hiring. */
  teamId?: number
  subTeams: SubTeam[]
  /** uuid of the parent department (teams.parent_team_id), absent for top-level ones. */
  parentUuid?: string
}

export interface TeamMember {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl?: string
  // Not fetched on public team reads (getTeam/getTeamMembers) — member email is
  // PII and anon has no SELECT on members.email. Set only by authenticated
  // management flows that legitimately have it.
  email?: string
  role: 'member' | 'lead'
  /**
   * The sub-team this membership sits in — walkthrough item 5.6, "audit the
   * team detail fields once rosters are real".
   *
   * It is real now and it was not before: the 2026-09-10 backfill from the
   * Cross Departmental sheet wrote 88 memberships with a sub-team across 11
   * distinct values — Welfare's 62 people span 8 of them, Social Media's 27
   * span Instagram / Blogs / LinkedIn. `team_members.sub_team` was never
   * selected, never typed and never rendered, so the team page showed 62
   * people as one undifferentiated list.
   */
  subTeam?: string | null
  /** Real sub-team entities this membership belongs to (team_member_sub_teams). */
  subTeams?: { uuid: string; slug: string; name: string }[]
  /** This member's org-wide role (member/hod/director/hr/super_admin) — see lib/roles.ts. */
  orgRole?: string
  joinedAt: string
}

export interface PendingTeamPost {
  postId: number
  uuid: string
  category: string
  body: string
  createdAt: string
  authorId: number
  authorUuid: string
  authorName: string
  authorAvatar?: string
  images: { blobUrl: string; displayOrder: number }[]
}

export interface JoinRequest {
  requestId?: number
  uuid: string
  teamId?: number
  memberId?: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  message?: string | null
  createdAt: string
  fullName?: string
  email?: string
  avatarUrl?: string
  memberUuid?: string
}

interface GetTeamsParams {
  page?: number
  limit?: number
  category?: string
  search?: string
  /**
   * Only departments that sit at the top of the tree (no parent), with each
   * parent's member count including the departments inside it. The /teams
   * page uses this so Social Media shows under Marketing, not beside it
   * (report 07b32d75). Every other caller still gets every team.
   */
  topLevelOnly?: boolean
}

const teamServiceImpl = {
  async getCurrentMember() {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')

    const { data: member } = await supabaseCommunity
      .from('members')
      .select('member_id, role, full_name')
      .eq('member_id', memberId)
      .single()

    if (!member) throw new Error('Member profile not found')
    return member
  },

  async getTeams(params: GetTeamsParams = {}): Promise<PaginatedResponse<Team>> {
    const page = params.page || 1
    const limit = params.limit || 20
    const offset = (page - 1) * limit

    let query = supabaseCommunity
      .from('teams')
      .select(`
        *,
        creator:members!created_by(full_name, uuid),
        team_members(count)
      `, { count: 'exact' })
      .eq('is_active', true)
        // The embedded count needs its OWN is_active filter. Membership is a
        // SOFT remove (setMembership sets is_active=false so re-adding does not
        // collide with the unique constraint), so an unfiltered count includes
        // everyone ever removed - the team card said one number and the team
        // page, which DOES filter, said another. Same `embedded.column` syntax
        // this file already uses at getTeamMembers.
      .eq('team_members.is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (params.category) {
      query = query.eq('category', params.category)
    }
    if (params.search) {
      query = query.ilike('name', `%${params.search}%`)
    }
    if (params.topLevelOnly) {
      query = query.is('parent_team_id', null)
    }

    const finalQuery = query
    const { data, count, error } = await withRetry(async () => finalQuery)
    if (error) throw logSupabaseError('teamService.getTeams', error)

    // A parent department has no roster of its own, so its card would say
    // "0 members" over a tree of dozens. Add the departments inside it.
    // One extra plain read, and a failure leaves the plain counts.
    const insideCounts = new Map<number, number>()
    if (params.topLevelOnly) {
      const { data: kids } = await supabaseCommunity
        .from('teams')
        .select('parent_team_id, team_members(count)')
        .not('parent_team_id', 'is', null)
        .eq('is_active', true)
        .eq('team_members.is_active', true)
      for (const k of (kids || []) as any[]) {
        insideCounts.set(k.parent_team_id, (insideCounts.get(k.parent_team_id) || 0) + (k.team_members?.[0]?.count || 0))
      }
    }

    const uuidById = new Map<number, string>((data || []).map((t: any) => [t.team_id, t.uuid]))
    const mapped = (data || []).map((t: any) => ({
      uuid: t.uuid,
      teamId: typeof t.team_id === 'number' ? t.team_id : undefined,
      parentUuid: t.parent_team_id ? uuidById.get(t.parent_team_id) : undefined,
      name: t.name,
      description: t.description,
      category: t.category,
      logoUrl: t.logo_url,
      bannerUrl: (t as any).banner_url ?? undefined,
      skills: (t as any).skills ?? [],
      createdAt: t.created_at,
      createdBy: t.created_by,
      createdByName: t.creator?.full_name,
      createdByUuid: t.creator?.uuid,
      memberCount: (t.team_members?.[0]?.count || 0) + (insideCounts.get(t.team_id) || 0),
      projectCount: 0
    }))

    const totalItems = count || 0
    return {
      success: true,
      data: mapped,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPrevPage: page > 1
      }
    }
  },

  async getTeam(uuid: string): Promise<{ success: boolean; data: { team: TeamDetails } }> {
    const { data, error } = await supabaseCommunity
      .from('teams')
      .select(`
        *,
        creator:members!created_by(full_name, uuid),
        team_members(
          role,
          sub_team,
          is_active,
          joined_at,
          members(member_id, uuid, full_name, avatar_url, role)
        ),
        sub_teams(uuid, slug, name, description, display_order, is_active, team_member_sub_teams(count))
      `)
      .eq('uuid', uuid)
      // LATENT BUG, fixed 2026-09-11. This embed had NO is_active filter,
      // unlike getTeamMembers() right below it, so it returned soft-removed
      // memberships as current roster. It was invisible because every one of
      // the 123 live rows is active - and it would have become visible the
      // first time anyone used the Members desk's new team control (item
      // 4.4), which soft-deletes by design rather than hard-deleting. The
      // removed member would have stayed on the team page.
      .eq('team_members.is_active', true)
      .single()

    if (error) throw logSupabaseError('teamService.getTeam', error)

    const d = data as any

    // Hierarchy (teams.parent_team_id): one small read each way, kept out of the
    // main embed so a missing column can never take the whole team page down.
    const [parentRes, childRes] = await Promise.all([
      d.parent_team_id
        ? supabaseCommunity.from('teams').select('uuid, name').eq('team_id', d.parent_team_id).eq('is_active', true).maybeSingle()
        : Promise.resolve({ data: null }),
      supabaseCommunity
        .from('teams')
        .select('uuid, name, team_members(count)')
        .eq('parent_team_id', d.team_id)
        .eq('is_active', true)
        .eq('team_members.is_active', true)
        .order('name', { ascending: true }),
    ])

    const members: TeamMember[] = (d.team_members || [])
      // Belt and braces: an embedded filter is silently ignored if the
      // relationship name ever changes, and the cost of being wrong here is
      // showing someone as a member of a team they were taken off.
      .filter((tm: any) => tm.is_active !== false)
      .map((tm: any) => ({
        memberId: tm.members.member_id,
        uuid: tm.members.uuid,
        fullName: tm.members.full_name,
        avatarUrl: tm.members.avatar_url ?? undefined,
        role: tm.role as 'member' | 'lead',
        // The member's org-wide role (member/hod/director/hr/super_admin) —
        // distinct from `role` above, which is team_members.role, forced to
        // 'member' only since the 2026-09-15 lead-role retirement. This is
        // what actually says "this person is an HoD of this department".
        orgRole: tm.members.role ?? undefined,
        subTeam: tm.sub_team ?? null,   // item 5.6
        joinedAt: tm.joined_at,
      }))

    const team: TeamDetails = {
      uuid: d.uuid,
      name: d.name,
      description: d.description ?? '',
      category: d.category,
      logoUrl: d.logo_url ?? undefined,
      bannerUrl: (d as any).banner_url ?? undefined,
      skills: (d as any).skills ?? [],
      createdAt: d.created_at,
      createdBy: d.created_by ?? undefined,
      createdByName: d.creator?.full_name,
      createdByUuid: d.creator?.uuid,
      memberCount: members.length,
      projectCount: 0,
      members,
      parent: parentRes.data ? { uuid: (parentRes.data as any).uuid, name: (parentRes.data as any).name } : undefined,
      childTeams: ((childRes.data || []) as any[]).map(c => ({
        uuid: c.uuid,
        name: c.name,
        memberCount: c.team_members?.[0]?.count || 0,
      })),
      // Same mapping as getDepartmentTree() below: inactive ones dropped,
      // ordered by the display_order the desk controls, member count from the
      // embedded team_member_sub_teams aggregate.
      subTeams: (((d as any).sub_teams || []) as any[])
        .filter(st => st && st.is_active !== false)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map(st => ({
          uuid: st.uuid,
          slug: st.slug,
          name: st.name,
          description: st.description ?? undefined,
          memberCount: st.team_member_sub_teams?.[0]?.count || 0,
        })),
    }

    return { success: true, data: { team } }
  },

  async getTeamMembers(uuid: string): Promise<{ success: boolean; data: { members: TeamMember[] } }> {
    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', uuid).single()
    if (!team) throw new Error('Team not found')

    const { data, error } = await supabaseCommunity
      .from('team_members')
      .select(`
        role,
        sub_team,
        joined_at,
        members(member_id, uuid, full_name, avatar_url, role)
      `)
      .eq('team_id', team.team_id)
      .eq('is_active', true)

    if (error) throw logSupabaseError('teamService.getTeamMembers', error)

    const members: TeamMember[] = (data || []).map((tm: any) => ({
      memberId: (tm.members as any).member_id,
      uuid: (tm.members as any).uuid,
      fullName: (tm.members as any).full_name,
      avatarUrl: (tm.members as any).avatar_url ?? undefined,
      role: tm.role as 'member' | 'lead',
      orgRole: (tm.members as any).role ?? undefined,
      // Item 5.6 - one more column on a query that was already running.
      subTeam: tm.sub_team ?? null,
      joinedAt: tm.joined_at
    }))

    return { success: true, data: { members } }
  },

  /**
   * All 8 departments with their sub-departments nested, for the About-page
   * org chart. One query (embedded sub_teams + its own embedded member
   * count) rather than 8 separate getSubTeams calls.
   */
  async getDepartmentTree(): Promise<DepartmentTreeTeam[]> {
    const { data, error } = await supabaseCommunity
      .from('teams')
      .select(`
        uuid, name, description, category, logo_url, banner_url, skills, created_at, created_by, is_active,
        team_id, parent_team_id,
        team_members(count),
        sub_teams(uuid, slug, name, description, display_order, is_active, team_member_sub_teams(count))
      `)
      .eq('is_active', true)
      .eq('team_members.is_active', true)
      .order('name', { ascending: true })

    if (error) throw logSupabaseError('teamService.getDepartmentTree', error)

    const uuidById = new Map<number, string>((data || []).map((t: any) => [t.team_id, t.uuid]))
    return (data || []).map((t: any) => ({
      uuid: t.uuid,
      parentUuid: t.parent_team_id ? uuidById.get(t.parent_team_id) : undefined,
      name: t.name,
      description: t.description,
      category: t.category,
      logoUrl: t.logo_url,
      bannerUrl: t.banner_url ?? undefined,
      skills: t.skills ?? [],
      createdAt: t.created_at,
      createdBy: t.created_by,
      memberCount: t.team_members?.[0]?.count || 0,
      projectCount: 0,
      subTeams: (t.sub_teams || [])
        .filter((st: any) => st.is_active !== false)
        .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((st: any) => ({
          uuid: st.uuid,
          slug: st.slug,
          name: st.name,
          description: st.description ?? undefined,
          memberCount: st.team_member_sub_teams?.[0]?.count || 0,
        })),
    }))
  },

  /**
   * The people level of the About-page org chart (report 717b4b00), for signed-in members only: the
   * caller decides that, and the members columns read here (uuid, full_name, avatar_url) are the ones
   * the team pages already show. One read for every department, grouped by lib/chartRoster.
   */
  async getChartRoster(): Promise<ChartRoster> {
    const { data, error } = await supabaseCommunity
      .from('teams')
      .select(`
        uuid,
        sub_teams(sub_team_id, uuid, is_active),
        team_members(is_active, members(uuid, full_name, avatar_url), team_member_sub_teams(sub_team_id))
      `)
      .eq('is_active', true)
      .eq('team_members.is_active', true)

    if (error) throw logSupabaseError('teamService.getChartRoster', error)
    return groupChartRoster((data || []) as any[])
  },

  /** Sub-departments for one team, in display order. */
  async getSubTeams(teamUuid: string): Promise<SubTeam[]> {
    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', teamUuid).single()
    if (!team) throw new Error('Team not found')

    const { data, error } = await supabaseCommunity
      .from('sub_teams')
      .select('uuid, slug, name, description, team_member_sub_teams(count)')
      .eq('team_id', team.team_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    if (error) throw logSupabaseError('teamService.getSubTeams', error)

    return (data || []).map((st: any) => ({
      uuid: st.uuid,
      slug: st.slug,
      name: st.name,
      description: st.description ?? undefined,
      memberCount: st.team_member_sub_teams?.[0]?.count || 0,
    }))
  },

  /** One sub-department by its parent team + slug (the `?sub=` route param on /teams/:uuid). */
  async getSubTeam(teamUuid: string, slug: string): Promise<SubTeam | null> {
    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', teamUuid).single()
    if (!team) return null

    const { data, error } = await supabaseCommunity
      .from('sub_teams')
      .select('uuid, slug, name, description, team_member_sub_teams(count)')
      .eq('team_id', team.team_id)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle()

    if (error) throw logSupabaseError('teamService.getSubTeam', error)
    if (!data) return null

    return {
      uuid: data.uuid,
      slug: data.slug,
      name: data.name,
      description: data.description ?? undefined,
      memberCount: (data as any).team_member_sub_teams?.[0]?.count || 0,
    }
  },

  /** Members of one sub-department, via the team_member_sub_teams join table. */
  async getSubTeamMembers(subTeamUuid: string): Promise<TeamMember[]> {
    const { data, error } = await supabaseCommunity
      .from('team_member_sub_teams')
      .select(`
        sub_teams!inner(uuid),
        team_members!inner(
          role, sub_team, joined_at, is_active,
          members(member_id, uuid, full_name, avatar_url, role)
        )
      `)
      .eq('sub_teams.uuid', subTeamUuid)
      .eq('team_members.is_active', true)

    if (error) throw logSupabaseError('teamService.getSubTeamMembers', error)

    return (data || []).map((row: any) => {
      const tm = row.team_members
      return {
        memberId: tm.members.member_id,
        uuid: tm.members.uuid,
        fullName: tm.members.full_name,
        avatarUrl: tm.members.avatar_url ?? undefined,
        role: tm.role as 'member' | 'lead',
        orgRole: tm.members.role ?? undefined,
        subTeam: tm.sub_team ?? null,
        joinedAt: tm.joined_at,
      }
    })
  },

  /**
   * Roster previews for MANY teams in ONE query — the stacked-avatar row on
   * /teams needs a few faces per card, and the alternative is eight calls to
   * getTeamMembers (TeamsPage's own standing rule from 05's Unresolved Q4:
   * "batch it or drop it, do not add eight queries").
   *
   * Additive and read-only: no existing signature or return shape changes.
   * Same client (`supabaseCommunity`) and same select shape getTeamMembers
   * already uses. Both tables are anon-readable live (`team_members` SELECT
   * `USING (true)`, `members` SELECT `USING (status = 'active')`, verified
   * 2026-09-07), so this works for a signed-out visitor on the public page;
   * `members.email`/`phone` are deliberately not selected.
   *
   * Leads sort first so the faces shown are the ones a visitor would want.
   * `perTeam` caps what is RETURNED, not what is fetched — PostgREST cannot
   * limit per group; the whole active roster across the eight live teams is
   * 95 rows of four small columns, so one round trip is the cheap option.
   */
  async getRosterPreviews(
    teamUuids: string[],
    perTeam = 4
  ): Promise<Record<string, { uuid: string; fullName: string; avatarUrl?: string; role: 'member' | 'lead' }[]>> {
    const out: Record<string, { uuid: string; fullName: string; avatarUrl?: string; role: 'member' | 'lead' }[]> = {}
    if (!teamUuids.length) return out

    const { data, error } = await supabaseCommunity
      .from('team_members')
      .select(`
        role,
        teams!inner(uuid),
        members!inner(uuid, full_name, avatar_url, status)
      `)
      .in('teams.uuid', teamUuids)
      .eq('is_active', true)
      .eq('members.status', 'active')

    if (error) throw logSupabaseError('teamService.getRosterPreviews', error)

    for (const row of (data || []) as any[]) {
      const key = row.teams?.uuid
      const m = row.members
      if (!key || !m) continue
      ;(out[key] ||= []).push({
        uuid: m.uuid,
        fullName: m.full_name || '',
        avatarUrl: m.avatar_url ?? undefined,
        role: row.role === 'lead' ? 'lead' : 'member',
      })
    }
    for (const key of Object.keys(out)) {
      out[key] = out[key]
        .sort((a, b) => (a.role === b.role ? 0 : a.role === 'lead' ? -1 : 1))
        .slice(0, perTeam)
    }
    return out
  },

  async getMyTeams(params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<Team>> {
    const member = await this.getCurrentMember()
    const page = params.page || 1
    const limit = params.limit || 50
    const offset = (page - 1) * limit

    const { data: memberships, count, error } = await supabaseCommunity
      .from('team_members')
      .select(`
        teams!inner (
          uuid, name, description, category, logo_url, banner_url, skills, created_at, created_by, is_active,
          team_members(count)
        )
      `, { count: 'exact' })
      .eq('member_id', member.member_id)
      .eq('is_active', true)
      .eq('teams.is_active', true)
      // The nested roster count, same soft-remove reason as getTeams above.
      .eq('teams.team_members.is_active', true)
      .range(offset, offset + limit - 1)

    if (error) throw logSupabaseError('teamService.getMyTeams', error)

    const teams = (memberships || []).map((m: any) => {
      const t = m.teams
      return {
        uuid: t.uuid,
        name: t.name,
        description: t.description,
        category: t.category,
        logoUrl: t.logo_url,
      bannerUrl: (t as any).banner_url ?? undefined,
      skills: (t as any).skills ?? [],
        createdAt: t.created_at,
        createdBy: t.created_by,
        memberCount: t.team_members?.[0]?.count || 0,
        projectCount: 0
      } as Team
    })

    const totalItems = count || 0
    return {
      success: true,
      data: teams,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPrevPage: page > 1
      }
    }
  },

  /**
   * The integer `team_id`s this member is scoped to, for the HoD desk - item
   * 6.1, "an HoD of Social Media sees only Social Media's openings".
   * ──────────────────────────────────────────────────────────────────────────
   * TWO SOURCES, unioned, because the org expresses "which part of AQ is
   * yours" in two different places and neither alone covers everybody:
   *
   *   1. `team_members.role = 'lead'` - the direct answer. Live today: Events,
   *      Welfare, Social Media, Crftd and HR each have at least one lead.
   *   2. `teams.category IN (their director_categories)` - the mechanism the
   *      Post Queue already scopes by, so a director assigned to `content`
   *      keeps the same reach on both desks rather than the two desks
   *      disagreeing about what their scope is.
   *
   * Note that (2) is deliberately coarser than (1): `content` covers BOTH
   * Social Media and Crftd, because a category is not a team. If that ever
   * matters, the fix is to give those directors a lead row rather than to
   * make this function cleverer.
   *
   * AN EMPTY ARRAY MEANS UNSCOPED, not "sees nothing" - the same fail-open
   * rule as PostModeration's `scopedCategories` and as the capability matrix's
   * absent-row-means-enabled. A leader who leads no team and has no category
   * assignment keeps exactly the reach they had before this existed. Narrowing
   * someone to zero by accident of missing data is a worse failure than
   * showing them too much, and RLS is the real boundary either way.
   */
  async getMyDeskTeamIds(categories: string[] = []): Promise<number[]> {
    const member = await this.getCurrentMember()

    const ledQuery = supabaseCommunity
      .from('team_members')
      .select('team_id, teams!inner(is_active)')
      .eq('member_id', member.member_id)
      .eq('is_active', true)
      .eq('role', 'lead')
      .eq('teams.is_active', true)

    const catQuery = categories.length > 0
      ? supabaseCommunity
          .from('teams')
          .select('team_id')
          .in('category', categories)
          .eq('is_active', true)
      : null

    const [ledRes, catRes] = await Promise.all([ledQuery, catQuery])
    if (ledRes.error) throw logSupabaseError('teamService.getMyDeskTeamIds', ledRes.error)
    if (catRes?.error) throw logSupabaseError('teamService.getMyDeskTeamIds', catRes.error)

    const ids = new Set<number>()
    for (const r of (ledRes.data || []) as any[]) if (typeof r.team_id === 'number') ids.add(r.team_id)
    for (const r of ((catRes?.data || []) as any[])) if (typeof r.team_id === 'number') ids.add(r.team_id)
    return Array.from(ids)
  },

  /**
   * Every active team as {teamId, name, category} - item 4.4's picker.
   *
   * `getTeams()` above returns the rich, paginated Team shape and does NOT map
   * `team_id` (only `uuid`), which is the key `team_members` is written by. A
   * second call rather than widening that one: this is eight rows, three
   * columns, no counts and no creator join, and the Members desk renders it
   * once per open.
   */
  async getTeamOptions(): Promise<{ teamId: number; name: string; category: string }[]> {
    const { data, error } = await supabaseCommunity
      .from('teams')
      .select('team_id, name, category')
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (error) throw logSupabaseError('teamService.getTeamOptions', error)
    return ((data || []) as any[]).map(t => ({ teamId: t.team_id, name: t.name, category: t.category }))
  },

  /** The `team_id`s a member is actively on. The write-side twin of getTeamsForMember. */
  async getTeamIdsForMemberId(memberId: number): Promise<number[]> {
    const { data, error } = await supabaseCommunity
      .from('team_members')
      .select('team_id, teams!inner(is_active)')
      .eq('member_id', memberId)
      .eq('is_active', true)
      .eq('teams.is_active', true)
    if (error) throw logSupabaseError('teamService.getTeamIdsForMemberId', error)
    return ((data || []) as any[]).map(r => r.team_id as number)
  },

  /**
   * Put a member on a team, or take them off it, from the MEMBERS side.
   * ──────────────────────────────────────────────────────────────────────────
   * Item 4.4: "assign teams to people from the Members desk". The Teams side
   * of that already existed (AddMemberModal -> addMembersBulk); this is the
   * other direction, one member against all eight teams.
   *
   * Not `addMember`/`removeMember`, which are the team-roster pair, for two
   * reasons that both bite here:
   *
   *   · `addMember` does a plain INSERT. `team_members` is UNIQUE(team_id,
   *     member_id) and `getTeamsForMember` only returns rows with
   *     `is_active = true`, so a member who was REMOVED from a team looks
   *     unassigned to this desk while their row still exists - and adding them
   *     back would fail on the unique constraint with a raw Postgres error.
   *     This upserts, so re-adding someone works and is what the toggle
   *     appears to promise.
   *   · `removeMember` hard-DELETEs. From the Members desk, "not on this team"
   *     should be reversible and should leave the history intact, so this
   *     sets `is_active = false` instead - the soft delete the rest of the
   *     schema already uses.
   *
   * Both directions are audited: `team_membership_audit_log` (2026-09-11)
   * writes TEAM_MEMBER_ADDED / _REMOVED / _RESTORED with the acting leader.
   *
   * The zero-row guard is the same one `removeMember` carries: PostgREST
   * returns no error and no rows when RLS refuses a write, so without it the
   * UI would tick the box and the database would ignore it.
   */
  async setMembership(teamId: number, memberId: number, onTeam: boolean): Promise<void> {
    if (onTeam) {
      // Restore-then-insert, NOT an upsert carrying `role`.
      //
      // This was a single upsert of { role: 'member', is_active: true }. The
      // off-branch below is a SOFT remove that deliberately leaves `role`
      // intact, and getTeamIdsForMemberId filters is_active, so a soft-removed
      // team lead reads back as simply unchecked. Re-ticking that box ran the
      // upsert's ON CONFLICT DO UPDATE and overwrote role='lead' with 'member'.
      // The caller (director/MemberTeamsDialog) is a grid of team checkboxes
      // that never shows a role, the toast said "added to <team>", and nothing
      // anywhere said a lead had just been demoted. Eleven rows in
      // team_members currently hold role='lead'.
      const { data: restored, error: restoreErr } = await supabaseCommunity
        .from('team_members')
        .update({ is_active: true })
        .eq('team_id', teamId)
        .eq('member_id', memberId)
        .select('member_id')
      if (restoreErr) throw logSupabaseError('teamService.setMembership', restoreErr)
      if (restored && restored.length > 0) return

      // No existing row to restore, so this really is a first-time add and
      // 'member' is the right starting role.
      const { data, error } = await supabaseCommunity
        .from('team_members')
        .insert({ team_id: teamId, member_id: memberId, role: 'member', is_active: true })
        .select('member_id')
      // A duplicate key here means the row DOES exist and the update above was
      // refused by RLS rather than finding nothing - PostgREST reports an RLS
      // refusal as zero rows, not as an error, so the two cases are only
      // distinguishable at this point. Say the true reason.
      if (error?.code === '23505') throw new Error("Couldn't add them to that team: you may not have permission.")
      if (error) throw logSupabaseError('teamService.setMembership', error)
      if (!data || data.length === 0) throw new Error("Couldn't add them to that team: you may not have permission.")
      return
    }

    const { data, error } = await supabaseCommunity
      .from('team_members')
      .update({ is_active: false })
      .eq('team_id', teamId)
      .eq('member_id', memberId)
      .select('member_id')
    if (error) throw logSupabaseError('teamService.setMembership', error)
    if (!data || data.length === 0) throw new Error("Couldn't take them off that team: you may not have permission.")
  },

  /** Teams a given member (by uuid) belongs to - used on profile pages. */
  async getTeamsForMember(memberUuid: string): Promise<{ success: boolean; data: { teams: Team[] } }> {
    const memberId = await resolveMemberIdFromUuid(memberUuid)
    if (!memberId) return { success: true, data: { teams: [] } }

    const { data: memberships, error } = await supabaseCommunity
      .from('team_members')
      .select(`
        teams!inner (
          uuid, name, description, category, logo_url, banner_url, skills, created_at, created_by, is_active,
          team_members(count)
        )
      `)
      .eq('member_id', memberId)
      .eq('is_active', true)
      .eq('teams.is_active', true)
      .eq('teams.team_members.is_active', true)

    if (error) throw logSupabaseError('teamService.getTeamsForMember', error)

    const teams = (memberships || []).map((m: any) => {
      const t = m.teams
      return {
        uuid: t.uuid,
        name: t.name,
        description: t.description,
        category: t.category,
        logoUrl: t.logo_url,
      bannerUrl: (t as any).banner_url ?? undefined,
      skills: (t as any).skills ?? [],
        createdAt: t.created_at,
        createdBy: t.created_by,
        memberCount: t.team_members?.[0]?.count || 0,
        projectCount: 0
      } as Team
    })

    return { success: true, data: { teams } }
  },

  async createTeam(data: {
    name: string
    description?: string
    category: string
    logoUrl?: string
    memberIds?: { memberId: number; role?: string }[]
  }): Promise<{ success: boolean; data: { team: Team }; message: string }> {
    const member = await this.getCurrentMember()

    const { data: team, error } = await supabaseCommunity
      .from('teams')
      .insert({
        name: data.name,
        description: data.description,
        category: data.category,
        logo_url: data.logoUrl,
        created_by: member.member_id
      })
      .select()
      .single()

    if (error) throw logSupabaseError('teamService.createTeam', error)

    if (data.memberIds && data.memberIds.length > 0) {
      const inserts = data.memberIds.map(m => ({
        team_id: team.team_id,
        member_id: m.memberId,
        role: m.role || 'member'
      }))
      // Don't report the team + roster as created if the roster insert failed —
      // the returned memberCount would lie about a roster the DB never got.
      const { error: rosterErr } = await supabaseCommunity.from('team_members').insert(inserts)
      if (rosterErr) throw logSupabaseError('teamService.createTeam', rosterErr)
    }

    logAction('team_created', 'team', team.team_id, { name: data.name, category: data.category })

    const mapped: Team = {
      uuid: team.uuid,
      name: team.name,
      description: team.description ?? '',
      category: team.category,
      logoUrl: team.logo_url ?? undefined,
      createdAt: team.created_at ?? new Date().toISOString(),
      createdBy: team.created_by ?? undefined,
      memberCount: data.memberIds?.length || 0,
      projectCount: 0
    }

    return { success: true, message: 'Team created', data: { team: mapped } }
  },

  async updateTeam(uuid: string, data: {
    name?: string
    description?: string
    category?: string
    logoUrl?: string
    // The team picture shown on /teams and the team page. `null` clears it.
    bannerUrl?: string | null
    isActive?: boolean
  }): Promise<{ success: boolean; data: { team: Team }; message: string }> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.category !== undefined) updateData.category = data.category
    if (data.logoUrl !== undefined) updateData.logo_url = data.logoUrl
    if (data.bannerUrl !== undefined) updateData.banner_url = data.bannerUrl
    if (data.isActive !== undefined) updateData.is_active = data.isActive

    const { data: team, error } = await supabaseCommunity
      .from('teams')
      .update(updateData)
      .eq('uuid', uuid)
      .select()
      .single()

    if (error) throw logSupabaseError('teamService.updateTeam', error)
    logAction('team_updated', 'team', team.team_id, { changedFields: Object.keys(updateData) })

    return {
      success: true,
      message: 'Team updated',
      data: {
        team: {
          uuid: team.uuid,
          name: team.name,
          description: team.description ?? '',
          category: team.category,
          logoUrl: team.logo_url ?? undefined,
          createdAt: team.created_at ?? new Date().toISOString(),
          memberCount: 0
        }
      }
    }
  },

  async deleteTeam(uuid: string): Promise<{ success: boolean; message: string }> {
    // Read the row back before deleting - once it's gone there is nothing
    // left to name in the log entry (team_id would resolve to nothing).
    const { data: team } = await supabaseCommunity.from('teams').select('team_id, name').eq('uuid', uuid).single()
    const { error } = await supabaseCommunity.from('teams').delete().eq('uuid', uuid)
    if (error) throw logSupabaseError('teamService.deleteTeam', error)
    logAction('team_deleted', 'team', team?.team_id, { name: team?.name })
    return { success: true, message: 'Team deleted' }
  },

  async addMember(uuid: string, memberId: number, role?: string): Promise<{ success: boolean; data: { membership: TeamMember }; message: string }> {
    const { data: team } = await supabaseCommunity.from('teams').select('team_id, name').eq('uuid', uuid).single()
    if (!team) throw new Error('Team not found')

    const { data, error } = await supabaseCommunity
      .from('team_members')
      .insert({
        team_id: team.team_id,
        member_id: memberId,
        role: role || 'member'
      })
      .select(`
        role,
        joined_at,
        members(member_id, uuid, full_name, avatar_url)
      `)
      .single()

    if (error) throw logSupabaseError('teamService.addMember', error)

    const dm = data as any
    const membership: TeamMember = {
      memberId: dm.members.member_id,
      uuid: dm.members.uuid,
      fullName: dm.members.full_name,
      avatarUrl: dm.members.avatar_url ?? undefined,
      email: dm.members.email,
      role: dm.role as 'member' | 'lead',
      joinedAt: dm.joined_at
    }

    // Tell the member they were added. Fire-and-forget (create never throws).
    // NOTE: `team_invite` is leader-gated in the create_notification RPC -
    // when a plain team lead (role 'lead') adds a member, the RPC rejects it
    // and the notification is silently skipped.
    notificationService.create({
      memberId,
      type: 'team_invite',
      title: `You were added to ${team.name}`,
      subtitle: 'Check out the team page.',
      link: `/teams/${uuid}`,
    })
    logAction('team_member_added', 'team', team.team_id, { memberId, role: role || 'member' })

    return { success: true, message: 'Member added', data: { membership } }
  },

  async updateMemberRole(uuid: string, memberId: number, role: string): Promise<{ success: boolean; data: { membership: TeamMember }; message: string }> {
    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', uuid).single()
    if (!team) throw new Error('Team not found')

    const { data, error } = await supabaseCommunity
      .from('team_members')
      .update({ role })
      .eq('team_id', team.team_id)
      .eq('member_id', memberId)
      .select(`
        role,
        joined_at,
        members(member_id, uuid, full_name, avatar_url)
      `)
      .single()

    if (error) throw logSupabaseError('teamService.updateMemberRole', error)

    const du = data as any
    const membership: TeamMember = {
      memberId: du.members.member_id,
      uuid: du.members.uuid,
      fullName: du.members.full_name,
      avatarUrl: du.members.avatar_url ?? undefined,
      email: du.members.email,
      role: du.role as 'member' | 'lead',
      joinedAt: du.joined_at
    }
    logAction('team_member_role_changed', 'team', team.team_id, { memberId, role })

    return { success: true, message: 'Role updated', data: { membership } }
  },

  async removeMember(uuid: string, memberId: number): Promise<{ success: boolean; message: string }> {
    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', uuid).single()
    if (!team) throw new Error('Team not found')

    // .select() + zero-row guard: PostgREST returns no error and zero rows when
    // RLS blocks a DELETE, so without this the UI dropped the member from the
    // roster, showed "Member removed", and they reappeared on the next refresh.
    // Matches updateApplicationStatus() in lib/jobOpenings.ts.
    const { data, error } = await supabaseCommunity
      .from('team_members')
      .delete()
      .eq('team_id', team.team_id)
      .eq('member_id', memberId)
      .select('member_id')

    if (error) throw logSupabaseError('teamService.removeMember', error)
    if (!data || data.length === 0) throw new Error("Couldn't remove this member: you may not have permission.")
    logAction('team_member_removed', 'team', team.team_id, { memberId })

    return { success: true, message: 'Member removed' }
  },

  /**
   * Put members on a SUB-department (Design, Reels, ...) from that sub-department's own page.
   * ──────────────────────────────────────────────────────────────────────────
   * Reports 4b836867 and a89fd333: HoDs could not add anyone to a sub-department. The database
   * already allowed it (`team_member_sub_teams` writes are `is_director()`), but nothing in the app wrote
   * that table at all, so the sub-department page had no add control.
   *
   * A sub-department membership hangs off a `team_members` row, so each person must be on the PARENT
   * team first. This restores an inactive row (role left alone, never demoted: see setMembership), inserts
   * a missing one as 'member', then links them. Existing links are kept (ignoreDuplicates), so adding
   * someone twice is harmless. Every write is checked for zero rows, because PostgREST returns no error
   * when RLS refuses a write.
   */
  async addMembersToSubTeam(teamUuid: string, subTeamUuid: string, memberIds: number[]): Promise<{ added: number }> {
    if (memberIds.length === 0) return { added: 0 }
    const noPermission = "Couldn't add members to this sub-team: you may not have permission."

    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', teamUuid).single()
    if (!team) throw new Error('Team not found')
    const { data: sub } = await supabaseCommunity
      .from('sub_teams').select('sub_team_id').eq('uuid', subTeamUuid).eq('team_id', team.team_id).maybeSingle()
    if (!sub) throw new Error('Sub-team not found')

    const { data: existing, error: existingErr } = await supabaseCommunity
      .from('team_members').select('team_member_id, member_id, is_active')
      .eq('team_id', team.team_id).in('member_id', memberIds)
    if (existingErr) throw logSupabaseError('teamService.addMembersToSubTeam', existingErr)
    const rows = (existing || []) as any[]

    const inactive = rows.filter(r => !r.is_active).map(r => r.team_member_id as number)
    if (inactive.length > 0) {
      const { data: restored, error } = await supabaseCommunity
        .from('team_members').update({ is_active: true }).in('team_member_id', inactive).select('team_member_id')
      if (error) throw logSupabaseError('teamService.addMembersToSubTeam', error)
      if (!restored || restored.length < inactive.length) throw new Error(noPermission)
    }

    const have = new Set(rows.map(r => r.member_id as number))
    const missing = memberIds.filter(id => !have.has(id))
    if (missing.length > 0) {
      const { data: inserted, error } = await supabaseCommunity
        .from('team_members')
        .insert(missing.map(memberId => ({ team_id: team.team_id, member_id: memberId, role: 'member', is_active: true })))
        .select('team_member_id')
      if (error) throw logSupabaseError('teamService.addMembersToSubTeam', error)
      if (!inserted || inserted.length < missing.length) throw new Error(noPermission)
    }

    const { data: roster, error: rosterErr } = await supabaseCommunity
      .from('team_members').select('team_member_id')
      .eq('team_id', team.team_id).eq('is_active', true).in('member_id', memberIds)
    if (rosterErr) throw logSupabaseError('teamService.addMembersToSubTeam', rosterErr)
    const teamMemberIds = ((roster || []) as any[]).map(r => r.team_member_id as number)
    if (teamMemberIds.length < memberIds.length) throw new Error(noPermission)

    const { error: linkErr } = await supabaseCommunity
      .from('team_member_sub_teams')
      .upsert(
        teamMemberIds.map(id => ({ team_member_id: id, sub_team_id: sub.sub_team_id })),
        { onConflict: 'team_member_id,sub_team_id', ignoreDuplicates: true },
      )
    if (linkErr) throw logSupabaseError('teamService.addMembersToSubTeam', linkErr)

    const { data: landed, error: landedErr } = await supabaseCommunity
      .from('team_member_sub_teams').select('team_member_id')
      .eq('sub_team_id', sub.sub_team_id).in('team_member_id', teamMemberIds)
    if (landedErr) throw logSupabaseError('teamService.addMembersToSubTeam', landedErr)
    if ((landed || []).length < teamMemberIds.length) throw new Error(noPermission)

    logAction('team_member_added', 'team', team.team_id, { subTeamId: sub.sub_team_id, memberIds })
    return { added: teamMemberIds.length }
  },

  async addMembersBulk(uuid: string, members: { memberId: number; role: 'member' | 'lead' }[]): Promise<any> {
    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', uuid).single()
    if (!team) throw new Error('Team not found')

    const inserts = members.map(m => ({
      team_id: team.team_id,
      member_id: m.memberId,
      role: m.role,
      is_active: true,
    }))

    // Same zero-row guard as removeMember above. This one additionally reported
    // `failed: []` without ever checking what actually landed, so a fully
    // RLS-blocked insert claimed every member was added.
    //
    // upsert, not insert: setMembership's off-branch is a SOFT remove, and
    // getTeamIdsForMemberId filters is_active, so anyone taken off the team
    // from the Members desk still has a row and reads back as "not on the
    // team". A plain insert hit 23505 on that one person and Postgres rolled
    // back the WHOLE batch - five people picked, none added, and the modal
    // could only say "that didn't stick. try again," which it never would.
    // Here `role` IS written deliberately: this is the Add Members flow, where
    // the caller chose member-or-lead per person.
    const { data, error } = await supabaseCommunity
      .from('team_members')
      .upsert(inserts, { onConflict: 'team_id,member_id' })
      .select('member_id')
    if (error) throw logSupabaseError('teamService.addMembersBulk', error)
    if (!data || data.length === 0) throw new Error("Couldn't add members to this team: you may not have permission.")

    const addedIds = new Set(data.map((r: any) => r.member_id))
    const added = members.filter(m => addedIds.has(m.memberId))
    const failed = members.filter(m => !addedIds.has(m.memberId))

    return {
      success: true,
      message: failed.length ? `Added ${added.length} of ${members.length}` : 'Members added',
      data: { added, failed },
    }
  },

  async getPendingPosts(uuid: string, params: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<PendingTeamPost>> {
    const { data: team } = await supabaseCommunity.from('teams').select('team_id, uuid').eq('uuid', uuid).single()
    if (!team) throw new Error('Team not found')

    const page = params.page || 1
    const limit = params.limit || 20
    const offset = (page - 1) * limit

    const { data, count, error } = await supabaseCommunity
      .from('post_feed_view')
      // The PendingTeamPost mapper below reads a strict subset of the shared
      // POST_FEED_COLS projection; filtering on team_uuid doesn't require
      // selecting it.
      .select(POST_FEED_COLS, { count: 'exact' })
      .eq('team_uuid', team.uuid)
      .eq('status', 'pending_review')
      .range(offset, offset + limit - 1)

    if (error) throw logSupabaseError('teamService.getPendingPosts', error)

    const mapped = (data || []).map((post: any) => ({
      postId: post.post_id,
      uuid: post.uuid,
      category: post.category,
      body: post.body,
      createdAt: post.created_at,
      authorId: post.author_id,
      authorUuid: post.author_uuid,
      authorName: post.author_name,
      authorAvatar: post.author_avatar,
      images: post.images ? (post.images as any[]).map((img: any) => ({
        blobUrl: img.url,
        displayOrder: img.order
      })) : []
    }))

    const totalItems = count || 0
    return {
      success: true,
      data: mapped,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalItems / limit),
        totalItems,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalItems / limit),
        hasPrevPage: page > 1
      }
    }
  },

  // Published posts made through OR tagging this team - shown on the team's
  // About tab. A post can tag several teams (post_teams, 2026-10-03), and the
  // team's page lists every post that tags it, not only the ones filed under it.
  // Pass subTeamUuid to scope it to one sub-department's own tagged posts
  // instead of every post the parent team has ever put out (sub-teams are not
  // taggable yet, so that path stays on the view's own team/sub-team columns).
  async getTeamPosts(teamUuid: string, limit = 10, subTeamUuid?: string): Promise<Post[]> {
    // The newest tagged post ids for this team. post_id grows with creation, so
    // taking the newest ~10x the page size is enough to fill it after the
    // published-only filter, without sending hundreds of ids to PostgREST.
    let taggedIds: number[] = []
    if (!subTeamUuid) {
      const { data: tagRows, error: tagErr } = await (supabaseCommunity.from('post_teams' as any) as any)
        .select('post_id, teams!inner(uuid)')
        .eq('teams.uuid', teamUuid)
        .order('post_id', { ascending: false })
        .limit(Math.max(limit * 10, 50))
      // A failed tag read must not blank the team's own posts: fall back to them.
      if (!tagErr) taggedIds = (tagRows || []).map((r: any) => r.post_id)
    }
    const [{ data, error }, memberId] = await Promise.all([
      (() => {
        let q = supabaseCommunity
          .from('post_feed_view')
          .select('post_id,uuid,category,body,link_url,link_title,link_image,status,created_at,author_id,author_uuid,author_name,author_avatar,author_role,like_count,comment_count,images,tagged_members,team_name,team_uuid,sub_team_uuid,sub_team_name,pinned,pinned_title')
          .eq('status', 'published')
        q = taggedIds.length > 0
          ? q.or(`team_uuid.eq.${teamUuid},post_id.in.(${taggedIds.join(',')})`)
          : q.eq('team_uuid', teamUuid)
        if (subTeamUuid) q = q.eq('sub_team_uuid', subTeamUuid)
        return q.order('created_at', { ascending: false }).limit(limit)
      })(),
      getCachedMemberId(),
    ])
    if (error) throw logSupabaseError('teamService.getTeamPosts', error)

    const postIds = (data || []).map((p: any) => p.post_id)
    const { data: likeRows } = memberId && postIds.length
      ? await supabaseCommunity.from('likes').select('post_id').eq('member_id', memberId).in('post_id', postIds)
      : { data: [] as any[] }
    const likedPostIds: number[] = (likeRows || []).map((l: any) => l.post_id)

    return (data || []).map((p: any) => ({
      postId: p.post_id,
      uuid: p.uuid,
      category: p.category,
      body: p.body,
      linkUrl: p.link_url,
      linkTitle: p.link_title,
      linkImage: p.link_image,
      status: p.status,
      createdAt: p.created_at,
      authorId: p.author_id,
      authorUuid: p.author_uuid,
      authorName: p.author_name,
      authorAvatar: p.author_avatar,
      authorRole: p.author_role,
      likeCount: p.like_count || 0,
      commentCount: p.comment_count || 0,
      pinned: p.pinned ?? false,
      pinnedTitle: p.pinned_title ?? null,
      teamName: p.team_name ?? undefined,
      teamUuid: p.team_uuid ?? undefined,
      subTeamName: p.sub_team_name ?? undefined,
      subTeamUuid: p.sub_team_uuid ?? undefined,
      images: p.images ? (p.images as any[]).map((img: any) => ({ blobUrl: img.url, displayOrder: img.order })) : [],
      taggedMembers: p.tagged_members ? (p.tagged_members as any[]).map((m: any) => ({ memberId: m.id, uuid: m.uuid, fullName: m.name })) : [],
      isLiked: likedPostIds.includes(p.post_id),
    })) as Post[]
  },

  async approvePost(_teamUuid: string, postId: number): Promise<{ success: boolean; data: { post: any }; message: string }> {
    const member = await this.getCurrentMember()

    // `.select()` so an RLS-blocked (or otherwise no-op) write surfaces as a
    // real error - PostgREST returns no error + zero rows when a write
    // matches nothing, which otherwise reads as "approved" while the post's
    // status never actually changed.
    const { data, error } = await supabaseCommunity
      .from('posts')
      .update({
        status: 'published',
        reviewed_by: member.member_id,
        reviewed_at: new Date().toISOString()
      })
      .eq('post_id', postId)
      .select('post_id, uuid, author_id')

    if (error) throw logSupabaseError('teamService.approvePost', error)
    if (!data || data.length === 0) throw new Error("Couldn't approve this post - you may not have permission.")

    // Tell the author their post is live - same pattern as
    // directorService.approvePost. Fire-and-forget (create never throws) and
    // self-skip is handled inside notificationService.create.
    // NOTE: `post_approved` is leader-gated in the create_notification RPC -
    // if a plain team lead (role 'lead') approves, the RPC rejects it and the
    // notification is silently skipped.
    notificationService.create({
      memberId: data[0].author_id,
      type: 'post_approved',
      title: 'Your post was approved',
      subtitle: "It's now live on the feed.",
      link: `/post/${data[0].uuid}`,
    })

    return { success: true, message: 'Post approved', data: { post: { postId } } }
  },

  async rejectPost(_teamUuid: string, postId: number, rejectionNote: string): Promise<{ success: boolean; data: { post: any }; message: string }> {
    const member = await this.getCurrentMember()

    const { data, error } = await supabaseCommunity
      .from('posts')
      .update({
        status: 'rejected',
        rejection_note: rejectionNote,
        reviewed_by: member.member_id,
        reviewed_at: new Date().toISOString()
      })
      .eq('post_id', postId)
      .select('post_id, uuid, author_id')

    if (error) throw logSupabaseError('teamService.rejectPost', error)
    if (!data || data.length === 0) throw new Error("Couldn't reject this post - you may not have permission.")

    // Tell the author why it was rejected - same pattern as
    // directorService.rejectPost. Fire-and-forget; `post_rejected` is
    // leader-gated in the RPC, so a plain team lead's attempt is silently
    // skipped server-side (still worth attempting for hod/director leads).
    notificationService.create({
      memberId: data[0].author_id,
      type: 'post_rejected',
      title: 'Your post needs changes',
      subtitle: rejectionNote ? rejectionNote.slice(0, 140) : 'A team lead sent it back.',
      fullNote: rejectionNote || undefined,
    })

    return { success: true, message: 'Post rejected', data: { post: { postId } } }
  },

  async createTeamPost(teamUuid: string, data: {
    category: string
    body: string
    taggedMemberIds?: number[]
    imageUrls?: string[]
    /**
     * PDF / PPTX attachments - see CreatePostData docs in feedService.ts.
     * Persisted via post_documents (migration 013).
     */
    documentUrls?: Array<{ url: string; fileName: string; mimeType: string; size: number }>
    linkUrl?: string
    linkTitle?: string
    linkImage?: string
    /** Optional sub-department to tag this post to, within teamUuid. */
    subTeamUuid?: string
    /** Set by the profanity filter (flag tier) to force pending_review even for leaders. */
    forceReview?: boolean
  }): Promise<{ success: boolean; data: { post: any }; message: string }> {
    const member = await this.getCurrentMember()
    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', teamUuid).single()
    if (!team) throw new Error('Team not found')

    let subTeamId: number | undefined
    if (data.subTeamUuid) {
      const { data: subTeam } = await supabaseCommunity
        .from('sub_teams')
        .select('sub_team_id')
        .eq('uuid', data.subTeamUuid)
        .eq('team_id', team.team_id)
        .maybeSingle()
      subTeamId = subTeam?.sub_team_id
    }

    const { data: post, error } = await supabaseCommunity
      .from('posts')
      .insert({
        team_id: team.team_id,
        sub_team_id: subTeamId,
        author_id: member.member_id,
        category: data.category,
        body: data.body,
        link_url: data.linkUrl || undefined,
        link_title: data.linkTitle || undefined,
        link_image: data.linkImage || undefined,
        // hasLeaderAccess, not a hand-written list. Hardcoded, this decided
        // that an `hr` member's post needs review, which is the most damaging
        // of the four inline copies: it changes what gets written, not just
        // what is shown.
        status: data.forceReview ? 'pending_review' : (hasLeaderAccess(member.role) ? 'published' : 'pending_review')
      })
      .select()
      .single()

    if (error) throw logSupabaseError('teamService.createTeamPost', error)

    if (data.imageUrls && data.imageUrls.length > 0) {
      const imgs = data.imageUrls.map((url, i) => ({
        post_id: post.post_id,
        blob_url: url,
        blob_name: url.split('/').pop() || '',
        display_order: i
      }))
      const { error: imgErr } = await supabaseCommunity.from('post_images').insert(imgs)
      if (imgErr) console.warn('[teamService] post_images insert failed for post', post.post_id, imgErr)
    }

    if (data.documentUrls && data.documentUrls.length > 0) {
      const docs = data.documentUrls.map((doc, i) => ({
        post_id: post.post_id,
        blob_url: doc.url,
        blob_name: doc.url.split('/').pop() || `document_${i}`,
        file_name: doc.fileName,
        file_size: doc.size,
        mime_type: doc.mimeType,
        display_order: i,
      }))
      const { error: docErr } = await (supabaseCommunity.from('post_documents' as any) as any).insert(docs)
      if (docErr) console.warn('[teamService] post_documents insert failed for post', post.post_id, docErr)
    }

    if (data.taggedMemberIds && data.taggedMemberIds.length > 0) {
      const tags = data.taggedMemberIds.map(id => ({
        post_id: post.post_id,
        tagged_member_id: id
      }))
      const { error: tagErr } = await supabaseCommunity.from('post_tags').insert(tags)

      // Only fire "tagged you" notifications when the tag rows actually
      // persisted — otherwise members get a notification for a tag that
      // doesn't show on the post or in their tagged tab.
      if (tagErr) {
        console.warn('[teamService] post_tags insert failed for post', post.post_id, tagErr)
      } else {
        // Notify each tagged member - parity with feedService.createPost,
        // which the team-post path previously skipped. Non-blocking +
        // self-skip handled inside notificationService.create.
        const postLink = `/post/${post.uuid}`
        const subtitle = data.body?.slice(0, 140) ?? ''
        await Promise.all(
          data.taggedMemberIds.map(taggedId =>
            notificationService.create({
              memberId: taggedId,
              type: 'tag',
              title: `${(member as any).full_name} tagged you in a post`,
              subtitle,
              link: postLink,
            })
          )
        )
      }
    }

    return { success: true, message: 'Post submitted', data: { post } }
  },

  async createJoinRequest(uuid: string, message?: string): Promise<{ success: boolean; data: { request: any }; message: string }> {
    const member = await this.getCurrentMember()
    const { data: team } = await supabaseCommunity.from('teams').select('team_id, name').eq('uuid', uuid).single()
    if (!team) throw new Error('Team not found')

    const { data: request, error } = await supabaseCommunity
      .from('team_join_requests')
      .insert({
        team_id: team.team_id,
        member_id: member.member_id,
        message
      })
      .select()
      .single()

    if (error) throw logSupabaseError('teamService.createJoinRequest', error)

    // Tell the team's leads someone wants in. Fire-and-forget - a failed
    // notification must never block the request itself, so the lead lookup
    // is wrapped too. `team_join_request` is a social type the RPC allows
    // for any member.
    ;(async () => {
      try {
        const { data: leads } = await supabaseCommunity
          .from('team_members')
          .select('member_id')
          .eq('team_id', team.team_id)
          .eq('role', 'lead')
          .eq('is_active', true)
        await Promise.all((leads || []).map(l =>
          notificationService.create({
            memberId: l.member_id,
            type: 'team_join_request',
            title: `${(member as any).full_name || 'A member'} requested to join ${team.name}`,
            subtitle: message ? message.slice(0, 140) : undefined,
            link: `/teams/${uuid}`,
          })
        ))
      } catch (e: any) {
        console.warn('[teamService] join-request notification failed:', e?.message)
      }
    })()

    return { success: true, message: 'Request sent', data: { request } }
  },

  async getJoinRequests(uuid: string): Promise<{ success: boolean; data: { requests: JoinRequest[]; total: number } }> {
    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', uuid).single()
    if (!team) throw new Error('Team not found')

    // email dropped from the embed below - the authenticated role no longer
    // has column-level SELECT on members.email, so the embedded join would
    // fail. get_team_member_contacts() (SECURITY DEFINER RPC) fills it back
    // in, gated to directors OR the requesting team's own leads - see
    // scripts/members_pii_lockdown_2026_07_29.sql.
    // `members!team_join_requests_member_id_fkey` - team_join_requests has
    // TWO foreign keys into members (member_id, the requester; reviewed_by,
    // whoever actioned it), so an unqualified `members(...)` embed is
    // ambiguous and PostgREST refuses it outright ("more than one
    // relationship was found for 'team_join_requests' and 'members'").
    // Found live 2026-09-08 - this was the actual cause behind "Failed to
    // load applications", not just the dead error-catch that was hiding it.
    const { data, error } = await supabaseCommunity
      .from('team_join_requests')
      .select(`
        *,
        members!team_join_requests_member_id_fkey(full_name, avatar_url, uuid)
      `)
      .eq('team_id', team.team_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    if (error) throw logSupabaseError('teamService.getJoinRequests', error)

    const memberIds = (data || []).map((r: any) => r.member_id).filter(Boolean)
    const emailById = new Map<number, string>()
    if (memberIds.length > 0) {
      const { data: contacts } = await supabaseCommunity.rpc('get_team_member_contacts' as never, {
        p_member_ids: memberIds,
        p_team_id: team.team_id
      } as never)
      ;((contacts as unknown as any[]) || []).forEach((c: any) => emailById.set(c.member_id, c.email))
    }

    const requests: JoinRequest[] = (data || []).map((r: any) => ({
      requestId: r.request_id,
      uuid: r.uuid,
      teamId: r.team_id,
      memberId: r.member_id,
      status: r.status,
      message: r.message,
      createdAt: r.created_at,
      fullName: r.members?.full_name,
      email: emailById.get(r.member_id),
      avatarUrl: r.members?.avatar_url,
      memberUuid: r.members?.uuid
    }))

    return { success: true, data: { requests, total: requests.length } }
  },

  async getMyJoinRequest(uuid: string): Promise<{ success: boolean; data: { request: JoinRequest | null } }> {
    const member = await this.getCurrentMember()
    const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', uuid).single()
    if (!team) throw new Error('Team not found')

    const { data, error } = await supabaseCommunity
      .from('team_join_requests')
      .select('request_id, uuid, team_id, member_id, status, message, created_at')
      .eq('team_id', team.team_id)
      .eq('member_id', member.member_id)
      .eq('status', 'pending')
      .maybeSingle()

    if (error) throw logSupabaseError('teamService.getMyJoinRequest', error)

    if (!data) return { success: true, data: { request: null } }

    const request: JoinRequest = {
      requestId: data.request_id,
      uuid: data.uuid,
      teamId: data.team_id,
      memberId: data.member_id,
      status: data.status as JoinRequest['status'],
      message: data.message,
      createdAt: data.created_at ?? new Date().toISOString()
    }

    return { success: true, data: { request } }
  },

  async approveJoinRequest(_uuid: string, requestUuid: string): Promise<{ success: boolean; data: { request: any }; message: string }> {
    const member = await this.getCurrentMember()

    const { data: req, error: reqErr } = await supabaseCommunity
      .from('team_join_requests')
      .update({ status: 'approved', reviewed_by: member.member_id, reviewed_at: new Date().toISOString() })
      .eq('uuid', requestUuid)
      .select()
      .single()

    if (reqErr) throw logSupabaseError('teamService.approveJoinRequest', reqErr)

    // The request row is now consumed (no longer pending), so a silently-failed
    // membership insert would leave the person approved-but-not-a-member with no
    // way to retry. Check the write; on a UNIQUE(team_id,member_id) conflict —
    // a returning member who left before — reactivate the existing row instead.
    const { error: insErr } = await supabaseCommunity.from('team_members').insert({
      team_id: req.team_id,
      member_id: req.member_id,
      role: 'member',
      is_active: true,
    })
    if (insErr) {
      if (insErr.code === '23505') {
        const { error: reactivateErr } = await supabaseCommunity
          .from('team_members')
          .update({ role: 'member', is_active: true })
          .eq('team_id', req.team_id)
          .eq('member_id', req.member_id)
        if (reactivateErr) throw logSupabaseError('teamService.approveJoinRequest', reactivateErr)
      } else {
        throw insErr
      }
    }

    // Tell the requester they're in. Fire-and-forget - the team-name lookup
    // is wrapped so it can never block the approval.
    // NOTE: `team_join_accepted` is leader-gated in the create_notification
    // RPC - when a plain team lead (role 'lead') approves, the RPC rejects it
    // and the notification is silently skipped.
    ;(async () => {
      try {
        const { data: team } = await supabaseCommunity
          .from('teams').select('uuid, name').eq('team_id', req.team_id).single()
        await notificationService.create({
          memberId: req.member_id,
          type: 'team_join_accepted',
          title: team ? `You're in - welcome to ${team.name}` : 'Your join request was accepted',
          subtitle: 'Your request to join was approved.',
          link: team ? `/teams/${team.uuid}` : undefined,
        })
      } catch (e: any) {
        console.warn('[teamService] join-accepted notification failed:', e?.message)
      }
    })()
    logAction('team_join_request_approved', 'team', req.team_id, { memberId: req.member_id })

    return { success: true, message: 'Approved', data: { request: req } }
  },

  async rejectJoinRequest(_uuid: string, requestUuid: string): Promise<{ success: boolean; data: { request: any }; message: string }> {
    const member = await this.getCurrentMember()

    const { data: req, error } = await supabaseCommunity
      .from('team_join_requests')
      .update({ status: 'rejected', reviewed_by: member.member_id, reviewed_at: new Date().toISOString() })
      .eq('uuid', requestUuid)
      .select()
      .single()

    if (error) throw logSupabaseError('teamService.rejectJoinRequest', error)

    // Tell the requester the request was declined. There's no dedicated
    // "rejected" NotificationType and `system` is leader-gated, so reuse
    // `team_join_request` (the RPC allows it for any member) with explicit
    // copy. Fire-and-forget - never blocks the rejection.
    ;(async () => {
      try {
        const { data: team } = await supabaseCommunity
          .from('teams').select('uuid, name').eq('team_id', req.team_id).single()
        await notificationService.create({
          memberId: req.member_id,
          type: 'team_join_request',
          title: team ? `Your request to join ${team.name} was declined` : 'Your join request was declined',
          subtitle: 'You can explore other teams or apply again later.',
          link: '/teams',
        })
      } catch (e: any) {
        console.warn('[teamService] join-rejected notification failed:', e?.message)
      }
    })()
    logAction('team_join_request_rejected', 'team', req.team_id, { memberId: req.member_id })

    return { success: true, message: 'Rejected', data: { request: req } }
  },

  async cancelJoinRequest(_uuid: string, requestUuid: string): Promise<{ success: boolean; message: string }> {
    // Zero-row guard, as above: without it a blocked update still toasted
    // "Cancelled" while the request stayed pending in the lead's queue.
    const { data, error } = await supabaseCommunity
      .from('team_join_requests')
      .update({ status: 'cancelled' })
      .eq('uuid', requestUuid)
      .select('uuid')

    if (error) throw logSupabaseError('teamService.cancelJoinRequest', error)
    if (!data || data.length === 0) throw new Error("Couldn't cancel this request: you may not have permission.")
    return { success: true, message: 'Cancelled' }
  },

  getCategories(): string[] {
    return ['events', 'welfare', 'content', 'operations', 'labs']
  },

  // 'lead' retired 2026-09-15 (owner decision: directors/HoDs are the only
  // leadership tier, team-scoped or otherwise - see
  // scripts/retire_lead_role_2026_09_15.sql). Kept returning an array, not a
  // single string, so callers built around "pick from getRoles()" (like
  // TeamDetailPage's change-role menu, which only renders when
  // availableRoles.length > 1) degrade correctly with no separate fix.
  getRoles(): string[] {
    return ['member']
  },

  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = { events: 'Events', welfare: 'Welfare', content: 'Content', operations: 'Operations', labs: 'Labs' }
    return labels[category] || category
  },

  getRoleLabel(role: string): string {
    const labels: Record<string, string> = { member: 'Member', lead: 'Team Lead' }
    return labels[role] || role
  },

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      events: 'bg-purple-100 text-purple-800',
      welfare: 'bg-rose-100 text-rose-800',
      content: 'bg-cyan-100 text-cyan-800',
      operations: 'bg-amber-100 text-amber-800',
      labs: 'bg-emerald-100 text-emerald-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  },

  getRoleColor(role: string): string {
    const colors: Record<string, string> = {
      member: 'bg-gray-100 text-gray-700',
      lead: 'bg-blue-100 text-blue-800'
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }
}

export const teamService = withFunctionLogging('teamService', teamServiceImpl)

export default teamService
