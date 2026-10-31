import { supabaseCommunity } from '../lib/supabaseCommunity'
import { School, SchoolDetails, SchoolMember, PaginatedResponse } from './api'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

interface GetSchoolsParams {
  page?: number
  limit?: number
  search?: string
}

interface GetSchoolMembersParams {
  page?: number
  limit?: number
}

const schoolServiceImpl = {
  async getSchools(params: GetSchoolsParams = {}): Promise<PaginatedResponse<School>> {
    const { page = 1, limit = 50, search = '' } = params
    const offset = (page - 1) * limit

    // `school_id` is what every consumer actually keys on - EditProfilePage
    // compares `s.schoolId.toString()` against the member's stored value - and
    // it was never selected, so every row arrived with schoolId undefined and
    // the school picker threw `Cannot read properties of undefined` for the
    // 1,034 members who already have a school set. TypeScript could not catch
    // it because the caller force-casts the result (`as unknown as School[]`).
    //
    // `.order('name')` because the picker is an alphabetical list a human
    // scans; without it the 212 rows came back in whatever order the planner
    // chose, and differently between calls.
    let query = supabaseCommunity
      .from('schools')
      .select('school_id, uuid, name, short_name, logo_url, location, website, created_at', { count: 'exact' })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const { data, count, error } = await query
    if (error) throw logSupabaseError('schoolService.getSchools', error)

    const schools: School[] = (data || []).map((s: any) => ({
      schoolId: s.school_id,
      uuid: s.uuid,
      name: s.name,
      shortName: s.short_name ?? undefined,
      logoUrl: s.logo_url ?? undefined,
      location: s.location ?? undefined,
      website: s.website ?? undefined,
      memberCount: 0,
      createdAt: s.created_at
    }))

    const totalItems = count || 0
    return {
      success: true,
      data: schools,
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

  async getSchool(uuid: string): Promise<{ success: boolean; data: { school: SchoolDetails } }> {
    const { data, error } = await supabaseCommunity
      .from('schools')
      .select('school_id, uuid, name, short_name, logo_url, location, website, created_at')
      .eq('uuid', uuid)
      .single()

    if (error) throw logSupabaseError('schoolService.getSchool', error)

    const d = data as any
    const schoolDetails: SchoolDetails = {
      schoolId: d.school_id,
      uuid: d.uuid,
      name: d.name,
      shortName: d.short_name ?? undefined,
      logoUrl: d.logo_url ?? undefined,
      location: d.location ?? undefined,
      website: d.website ?? undefined,
      createdAt: d.created_at,
      memberCount: 0,
      recentMembers: [],
      classes: []
    }

    return { success: true, data: { school: schoolDetails } }
  },

  async getSchoolMembers(uuid: string, params: GetSchoolMembersParams = {}): Promise<PaginatedResponse<SchoolMember>> {
    const { page = 1, limit = 20 } = params
    const offset = (page - 1) * limit

    // Resolve school by uuid
    const { data: school } = await supabaseCommunity
      .from('schools')
      .select('school_id')
      .eq('uuid', uuid)
      .maybeSingle()

    if (!school) {
      return {
        success: true, data: [],
        pagination: { currentPage: page, totalPages: 0, totalItems: 0, itemsPerPage: limit, hasNextPage: false, hasPrevPage: page > 1 },
      }
    }

    const { data, count, error } = await supabaseCommunity
      .from('members')
      .select('uuid, full_name, avatar_url, class_grade, role, bio, created_at', { count: 'exact' })
      .eq('school_id', school.school_id)
      .eq('status', 'active')
      // Same non-unique `created_at` as the public members list - narrower ties
      // here (at most 27 within one school) but the same class of bug, and a
      // tiebreaker costs nothing.
      .order('created_at', { ascending: false })
      .order('member_id', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) throw logSupabaseError('schoolService.getSchoolMembers', error)

    const members: SchoolMember[] = (data ?? []).map((m: any) => ({
      uuid: m.uuid,
      fullName: m.full_name,
      avatarUrl: m.avatar_url ?? undefined,
      classGrade: m.class_grade ?? undefined,
      role: m.role ?? 'member',
      bio: m.bio ?? undefined,
      createdAt: m.created_at ?? new Date().toISOString(),
    }))

    const totalItems = count ?? 0
    return {
      success: true,
      data: members,
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

  async searchSchools(query: string, limit = 10): Promise<{ success: boolean; data: { schools: Pick<School, 'uuid' | 'name' | 'shortName' | 'logoUrl'>[] } }> {
    const { data, error } = await supabaseCommunity
      .from('schools')
      .select('uuid, name, short_name, logo_url')
      .ilike('name', `%${query}%`)
      .limit(limit)

    if (error) throw logSupabaseError('schoolService.searchSchools', error)

    return {
      success: true,
      data: {
        schools: data.map((s: any) => ({
          uuid: s.uuid,
          name: s.name,
          shortName: s.short_name,
          logoUrl: s.logo_url
        }))
      }
    }
  },

  async createSchool(data: {
    name: string
    shortName?: string
    logoUrl?: string
    location?: string
    website?: string
  }): Promise<{ success: boolean; data: { school: School }; message: string }> {
    const { data: school, error } = await supabaseCommunity
      .from('schools')
      .insert({
        name: data.name,
        short_name: data.shortName,
        logo_url: data.logoUrl,
        location: data.location,
        website: data.website
      })
      .select()
      .single()

    if (error) throw logSupabaseError('schoolService.createSchool', error)

    return {
      success: true,
      message: 'School created',
      data: {
        school: {
          schoolId: school.school_id,
          uuid: school.uuid,
          name: school.name,
          shortName: school.short_name ?? undefined,
          logoUrl: school.logo_url ?? undefined,
          location: school.location ?? undefined,
          website: school.website ?? undefined,
          createdAt: school.created_at,
          memberCount: 0
        }
      }
    }
  },

  async updateSchool(uuid: string, data: {
    name?: string
    shortName?: string
    logoUrl?: string
    location?: string
    website?: string
  }): Promise<{ success: boolean; data: { school: School }; message: string }> {
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.shortName !== undefined) updateData.short_name = data.shortName
    if (data.logoUrl !== undefined) updateData.logo_url = data.logoUrl
    if (data.location !== undefined) updateData.location = data.location
    if (data.website !== undefined) updateData.website = data.website

    const { data: school, error } = await supabaseCommunity
      .from('schools')
      .update(updateData)
      .eq('uuid', uuid)
      .select()
      .single()

    if (error) throw logSupabaseError('schoolService.updateSchool', error)

    return {
      success: true,
      message: 'School updated',
      data: {
        school: {
          schoolId: school.school_id,
          uuid: school.uuid,
          name: school.name,
          shortName: school.short_name ?? undefined,
          logoUrl: school.logo_url ?? undefined,
          location: school.location ?? undefined,
          website: school.website ?? undefined,
          createdAt: school.created_at,
          memberCount: 0
        }
      }
    }
  }
}

export const schoolService = withFunctionLogging('schoolService', schoolServiceImpl)

export default schoolService
