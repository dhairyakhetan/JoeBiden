/**
 * AQ Core: the list of core members (bug tracker 081395e9).
 * Schema, rules and both database functions: scripts/core_members_2026_11_19.sql.
 *
 * Reads are public (the Core Team page, the badge). Only HR and super admin
 * may add or remove; the database refuses anyone else. Throws on error, like
 * every service here; the calling component owns the toast.
 */
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { getCachedMemberId } from '../lib/authCache'
import { logAction } from '../lib/auditLog'
import { logSupabaseError } from '../lib/errorTracking'

export interface CoreMember {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl?: string
  role: string
}

export type CoreImportResult = 'added' | 'already' | 'not_found' | 'ambiguous'
export interface CoreImportRow { email: string; result: CoreImportResult; fullName: string | null }

const sb = supabaseCommunity as any

const coreMemberService = {
  /** Everyone with the badge, by name. Photos are masked for hidden profiles when signed out. */
  async getCoreTeam(): Promise<CoreMember[]> {
    const { data, error } = await sb.rpc('public_core_team')
    if (error) throw logSupabaseError('coreMemberService.getCoreTeam', error)
    return ((data as any[]) ?? []).map(r => ({
      memberId: r.member_id,
      uuid: r.uuid,
      fullName: r.full_name,
      avatarUrl: r.avatar_url ?? undefined,
      role: r.role ?? 'member',
    }))
  },

  async add(memberId: number): Promise<void> {
    let addedBy: number | null = null
    try { addedBy = await getCachedMemberId() } catch { addedBy = null }
    const { error } = await sb.from('core_members').insert({ member_id: memberId, added_by: addedBy })
    // 23505: already core. The goal state holds, so it is not a failure.
    if (error && error.code !== '23505') throw logSupabaseError('coreMemberService.add', error)
    logAction('core_member_added', 'member', memberId)
  },

  async remove(memberId: number): Promise<void> {
    const { data, error } = await sb.from('core_members').delete().eq('member_id', memberId).select('member_id')
    if (error) throw logSupabaseError('coreMemberService.remove', error)
    if (!data || data.length === 0) throw new Error('Nothing was removed. You may not have permission, or they were not core.')
    logAction('core_member_removed', 'member', memberId)
  },

  /** The Google Sheet import: matches each email to an active member, case-insensitively. */
  async addByEmails(emails: string[]): Promise<CoreImportRow[]> {
    const { data, error } = await sb.rpc('core_add_by_emails', { p_emails: emails })
    if (error) throw logSupabaseError('coreMemberService.addByEmails', error)
    const rows = ((data as any[]) ?? []).map(r => ({ email: r.email, result: r.result, fullName: r.full_name ?? null }))
    const added = rows.filter(r => r.result === 'added').length
    if (added > 0) logAction('core_members_imported', 'member', undefined, { added, sent: emails.length })
    return rows
  },
}

export default coreMemberService
