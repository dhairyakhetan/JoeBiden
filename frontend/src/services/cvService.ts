import { supabaseCommunity } from '../lib/supabaseCommunity'
import certificateService, { HoursSummary } from './certificateService'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

/**
 * cvService — assembles the AquaTerra record a member can turn into a CV
 * (FR9, user 2026-09-05: "geneate CV button").
 *
 * Composition only. Every field below already exists somewhere in the app;
 * nothing here derives, estimates or rounds up a figure that the member has
 * not actually earned. The three hard rules this file exists to enforce:
 *
 *   1. ONLY approved achievements. `external_achievements` also holds pending
 *      and rejected rows, and PublicProfilePage was already caught rendering
 *      unapproved ones. The `.eq('status', 'approved')` filter below is not
 *      optional and must never be relaxed to "own rows too" — a CV is an
 *      outward-facing document, so it carries only what HoDs have signed off.
 *   2. Empty means ABSENT, never a placeholder. A member with no teams gets a
 *      CV with no teams section, not a section reading "—". The renderer owns
 *      that; this service simply returns empty arrays and lets it happen.
 *   3. Hours come from certificateService.getHoursSummary, the same derivation
 *      the hours card and the HR desk read, so a CV can never disagree with
 *      the certificate a member is holding. Its `undercounted` flag is carried
 *      through so the document can say the total is a floor.
 *
 * Throws on error like every other services/*.ts file; the component catches
 * and toasts.
 *
 * No migration for the original three rules above: `team_members`, `teams`,
 * `external_achievements` and `drive_attendance` all exist live and all four
 * SELECT policies already admit `member_id = get_current_member_id()`
 * (verified against the live database, 2026-09-05).
 *
 * Education is the one exception to "composition only": `member_education`
 * (scripts/member_education_2026_09_05.sql, applied and verified live the
 * same day) is a NEW table that exists for no other reason than this
 * feature, so unlike teams/achievements/hours above, this file also owns its
 * writes (addEducation/updateEducation/deleteEducation) - the member's own
 * schooling/college history, editable only by them (RLS: own rows only for
 * insert/update/delete; own rows or director/super_admin for select). No
 * approval workflow - this is self-reported profile data (bio/class_grade
 * tier), not a claimed accomplishment (external_achievements tier).
 */

export interface CvTeam {
  name: string
  category: string | null
  /** The member's role ON that team ('member' | 'lead'), from team_members.role. */
  roleInTeam: string | null
  joinedAt: string | null
}

export interface CvAchievement {
  title: string
  description: string | null
  type: string | null
  date: string | null
  endDate: string | null
}

export interface CvEducation {
  id: number
  institution: string
  /** "class/grade or degree" - e.g. "Class 12", "B.Tech Computer Science". */
  credential: string | null
  /** Years attended, not dates - nobody enrols/graduates on a specific day. */
  startYear: number | null
  /** Absent means "ongoing". */
  endYear: number | null
  /** Marks/CGPA/grade - the member's own choice to share. */
  grade: string | null
}

export interface CvEducationInput {
  institution: string
  credential?: string | null
  startYear?: number | null
  endYear?: number | null
  grade?: string | null
}

export interface CvRecord {
  teams: CvTeam[]
  /** Approved rows only. Never contains a pending or rejected achievement. */
  achievements: CvAchievement[]
  /** Most recent first (highest start_year), like achievements. */
  education: CvEducation[]
  hours: HoursSummary
}

const mapEducation = (row: any): CvEducation => ({
  id: row.id,
  institution: row.institution,
  credential: row.credential ?? null,
  startYear: row.start_year ?? null,
  endYear: row.end_year ?? null,
  grade: row.grade ?? null,
})

const cvServiceImpl = {
  async getRecord(memberId: number): Promise<CvRecord> {
    const [teams, achievements, education, hours] = await Promise.all([
      this.getTeams(memberId),
      this.getApprovedAchievements(memberId),
      this.getEducation(memberId),
      certificateService.getHoursSummary(memberId),
    ])
    return { teams, achievements, education, hours }
  },

  /**
   * Current team memberships. Mirrors teamService.getTeamsForMember's filters
   * (`team_members.is_active` and `teams.is_active`) but additionally selects
   * the member's own role and join date, which the CV needs and the teams list
   * on the profile page does not.
   */
  async getTeams(memberId: number): Promise<CvTeam[]> {
    const { data, error } = await (supabaseCommunity as any)
      .from('team_members')
      .select('role, joined_at, teams!inner(name, category, is_active)')
      .eq('member_id', memberId)
      .eq('is_active', true)
      .eq('teams.is_active', true)
      .order('joined_at', { ascending: true })
    if (error) throw logSupabaseError('cvService.getTeams', error)

    return (data || [])
      .filter((row: any) => row.teams?.name)
      .map((row: any) => ({
        name: row.teams.name,
        category: row.teams.category ?? null,
        roleInTeam: row.role ?? null,
        joinedAt: row.joined_at ?? null,
      }))
  },

  /** Approved achievements only — see rule 1 in the file header. */
  async getApprovedAchievements(memberId: number): Promise<CvAchievement[]> {
    const { data, error } = await (supabaseCommunity as any)
      .from('external_achievements')
      .select('title, description, achievement_type, achievement_date, achievement_end_date')
      .eq('member_id', memberId)
      .eq('status', 'approved')
      .order('achievement_date', { ascending: false })
    if (error) throw logSupabaseError('cvService.getApprovedAchievements', error)

    return (data || [])
      .filter((row: any) => row.title)
      .map((row: any) => ({
        title: row.title,
        description: row.description ?? null,
        type: row.achievement_type ?? null,
        date: row.achievement_date ?? null,
        endDate: row.achievement_end_date ?? null,
      }))
  },

  /**
   * The member's own schooling/education history
   * (scripts/member_education_2026_09_05.sql). Highest start_year first (id
   * descending as a tiebreaker for entries with no year at all), so the most
   * recent schooling reads first - same "newest first" convention as
   * getApprovedAchievements above.
   */
  async getEducation(memberId: number): Promise<CvEducation[]> {
    const { data, error } = await (supabaseCommunity as any)
      .from('member_education')
      .select('id, institution, credential, start_year, end_year, grade')
      .eq('member_id', memberId)
      .order('start_year', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
    if (error) throw logSupabaseError('cvService.getEducation', error)

    return (data || [])
      .filter((row: any) => row.institution)
      .map(mapEducation)
  },

  /**
   * Add one education entry. RLS pins `member_id = get_current_member_id()`
   * at the database level (member_education_2026_09_05.sql); `memberId` is
   * still passed explicitly to attribute the insert, matching every other
   * write in this codebase (e.g. achievementService.createAchievement).
   * Blank optional fields are normalized to null rather than stored as ''.
   */
  async addEducation(memberId: number, input: CvEducationInput): Promise<CvEducation> {
    const { data, error } = await (supabaseCommunity as any)
      .from('member_education')
      .insert({
        member_id: memberId,
        institution: input.institution.trim(),
        credential: input.credential?.trim() || null,
        start_year: input.startYear ?? null,
        end_year: input.endYear ?? null,
        grade: input.grade?.trim() || null,
      })
      .select('id, institution, credential, start_year, end_year, grade')
      .single()
    if (error) throw logSupabaseError('cvService.addEducation', error)
    return mapEducation(data)
  },

  /** Edit one of the member's own education entries. RLS blocks editing anyone else's row; `.single()` surfaces that as a thrown error (0 rows back) rather than a silent no-op. */
  async updateEducation(id: number, input: CvEducationInput): Promise<CvEducation> {
    const { data, error } = await (supabaseCommunity as any)
      .from('member_education')
      .update({
        institution: input.institution.trim(),
        credential: input.credential?.trim() || null,
        start_year: input.startYear ?? null,
        end_year: input.endYear ?? null,
        grade: input.grade?.trim() || null,
      })
      .eq('id', id)
      .select('id, institution, credential, start_year, end_year, grade')
      .single()
    if (error) throw logSupabaseError('cvService.updateEducation', error)
    return mapEducation(data)
  },

  /**
   * Zero-row guard: an RLS-blocked DELETE returns no error and zero rows, so
   * without this a blocked delete would silently report success - the exact
   * gotcha achievementService.deleteAchievement and lib/jobOpenings.ts were
   * already written to guard against.
   */
  async deleteEducation(id: number): Promise<void> {
    const { data, error } = await (supabaseCommunity as any)
      .from('member_education')
      .delete()
      .eq('id', id)
      .select('id')
    if (error) throw logSupabaseError('cvService.deleteEducation', error)
    if (!data || data.length === 0) throw new Error("Couldn't delete this entry: you may not have permission.")
  },
}

export const cvService = withFunctionLogging('cvService', cvServiceImpl)

export default cvService
