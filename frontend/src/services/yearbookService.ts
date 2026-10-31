import { supabaseCommunity } from '../lib/supabaseCommunity'
import { notificationService } from './notificationService'
import { getCachedMemberId } from '../lib/authCache'
import { resizeForUpload } from '../lib/resizeImage'
import { logSupabaseError } from '../lib/errorTracking'
import { withFunctionLogging } from '../lib/functionLog'

export interface YearbookEntry {
  id: number
  memberId: number
  editionYear: number
  status: 'invited' | 'submitted' | 'skipped'
  useOwnAvatar: boolean
  photoUrl?: string
  quote?: string
  invitedAt: string
  submittedAt?: string
  // Present on the director-facing list (joined), not on getMyEntry.
  memberName?: string
  memberAvatarUrl?: string
  memberUuid?: string
}

function mapRow(row: any): YearbookEntry {
  return {
    id: row.id,
    memberId: row.member_id,
    editionYear: row.edition_year,
    status: row.status,
    useOwnAvatar: row.use_own_avatar,
    photoUrl: row.photo_url ?? undefined,
    quote: row.quote ?? undefined,
    invitedAt: row.invited_at,
    submittedAt: row.submitted_at ?? undefined,
    memberName: row.members?.full_name ?? undefined,
    memberAvatarUrl: row.members?.avatar_url ?? undefined,
    memberUuid: row.members?.uuid ?? undefined,
  }
}

const yearbookServiceImpl = {
  /**
   * The HoD/HR desk's invite list for one edition, newest invite first.
   *
   * The embed names the FK explicitly (`members!yearbook_entries_member_id_fkey`)
   * rather than the bare `members(...)` PostgREST shorthand: `yearbook_entries`
   * carries TWO foreign keys into `members` (`member_id` - the entry's own
   * subject - and `invited_by`), so the bare form is ambiguous and PostgREST
   * rejects the whole query with "more than one relationship was found",
   * which is what every director/HR actually saw on this desk (confirmed
   * live, 2026-09-06: `information_schema` lists both
   * `yearbook_entries_member_id_fkey` and `yearbook_entries_invited_by_fkey`
   * on this table). Naming the constraint keeps the selected columns and
   * return shape identical - it only says which of the two relationships to
   * follow.
   */
  async listForEdition(editionYear: number): Promise<YearbookEntry[]> {
    const { data, error } = await (supabaseCommunity as any)
      .from('yearbook_entries')
      .select('*, members!yearbook_entries_member_id_fkey(full_name, avatar_url, uuid)')
      .eq('edition_year', editionYear)
      .order('invited_at', { ascending: false })
    if (error) throw logSupabaseError('yearbookService.listForEdition', error)
    return (data || []).map(mapRow)
  },

  /**
   * Invite a batch of members to one edition. Skips members already invited
   * this edition (the table's own unique constraint would reject a plain
   * bulk insert on the first duplicate and abort the whole batch - this
   * checks first so a re-run over a partially-invited list still succeeds
   * for the new names). Fires one notification per newly-invited member;
   * notificationService.create() is fire-and-forget by design, so a
   * notification failure never blocks the invite itself.
   */
  async inviteMembers(memberIds: number[], editionYear: number): Promise<{ invited: number; alreadyInvited: number }> {
    if (memberIds.length === 0) return { invited: 0, alreadyInvited: 0 }
    const inviterId = await getCachedMemberId()

    const { data: existing, error: existingErr } = await (supabaseCommunity as any)
      .from('yearbook_entries')
      .select('member_id')
      .eq('edition_year', editionYear)
      .in('member_id', memberIds)
    if (existingErr) throw logSupabaseError('yearbookService.inviteMembers', existingErr)
    const already = new Set((existing || []).map((r: any) => r.member_id))
    const toInvite = memberIds.filter(id => !already.has(id))
    if (toInvite.length === 0) return { invited: 0, alreadyInvited: memberIds.length }

    const { error } = await (supabaseCommunity as any)
      .from('yearbook_entries')
      .insert(toInvite.map(memberId => ({ member_id: memberId, edition_year: editionYear, invited_by: inviterId })))
    if (error) throw logSupabaseError('yearbookService.inviteMembers', error)

    await Promise.all(toInvite.map(memberId =>
      notificationService.create({
        memberId,
        type: 'system',
        title: `you're in the ${editionYear} yearbook`,
        subtitle: 'pick a photo and write a one-line quote - takes a minute.',
        link: '/yearbook',
      }).catch(() => {})
    ))

    return { invited: toInvite.length, alreadyInvited: already.size }
  },

  /** The current member's own entry for an edition, or null if never invited. */
  async getMyEntry(editionYear: number): Promise<YearbookEntry | null> {
    const memberId = await getCachedMemberId()
    if (!memberId) return null
    const { data, error } = await (supabaseCommunity as any)
      .from('yearbook_entries')
      .select('*')
      .eq('member_id', memberId)
      .eq('edition_year', editionYear)
      .maybeSingle()
    if (error) throw logSupabaseError('yearbookService.getMyEntry', error)
    return data ? mapRow(data) : null
  },

  /** Member-side submit/update - flips status to submitted and stamps submitted_at. */
  async submitEntry(editionYear: number, data: { useOwnAvatar: boolean; photoUrl?: string; quote: string }): Promise<void> {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')
    const { error } = await (supabaseCommunity as any)
      .from('yearbook_entries')
      .update({
        status: 'submitted',
        use_own_avatar: data.useOwnAvatar,
        photo_url: data.useOwnAvatar ? null : (data.photoUrl || null),
        quote: data.quote.trim(),
        submitted_at: new Date().toISOString(),
      })
      .eq('member_id', memberId)
      .eq('edition_year', editionYear)
    if (error) throw logSupabaseError('yearbookService.submitEntry', error)
  },

  /**
   * A dedicated yearbook photo, separate from the profile avatar (reuses the
   * same `avatars` storage bucket/RLS, just a `yearbook/` path prefix, so no
   * new bucket or storage policy is needed). Does NOT touch members.avatar_url
   * - this is only ever wired into `yearbook_entries.photo_url` by the caller.
   */
  async uploadPhoto(original: File): Promise<string> {
    // Yearbook photos are a portrait card in a grid - 1200 px long edge is
    // ample (lib/resizeImage.ts). Non-throwing; original on any failure.
    const file = await resizeForUpload(original, 'yearbook')
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')
    const fileExt = file.name.split('.').pop()
    const filePath = `yearbook/${memberId}-${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const { error } = await supabaseCommunity.storage
      .from('avatars')
      .upload(filePath, file, { cacheControl: '3600', upsert: false })
    if (error) throw logSupabaseError('yearbookService.uploadPhoto', error)
    const { data } = supabaseCommunity.storage.from('avatars').getPublicUrl(filePath)
    return data.publicUrl
  },

  /** Member declines - still counted, just excluded from the export list. */
  async skipEntry(editionYear: number): Promise<void> {
    const memberId = await getCachedMemberId()
    if (!memberId) throw new Error('Not authenticated')
    const { error } = await (supabaseCommunity as any)
      .from('yearbook_entries')
      .update({ status: 'skipped' })
      .eq('member_id', memberId)
      .eq('edition_year', editionYear)
    if (error) throw logSupabaseError('yearbookService.skipEntry', error)
  },
}

export const yearbookService = withFunctionLogging('yearbookService', yearbookServiceImpl)

export default yearbookService
