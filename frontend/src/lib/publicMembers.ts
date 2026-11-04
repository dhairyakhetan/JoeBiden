import { supabaseCommunity } from './supabaseCommunity'

/**
 * Masked member cards (name, photo, role) by uuid, for places that used to embed `members(avatar_url, ...)` in a public query.
 *
 * Why this exists: a member can hide their profile from signed-out visitors (docs/plans/profile-visibility-toggle.md). The photo
 * column is being closed to the anonymous role on the members table, so a public query can no longer embed it. This reads the
 * database function public_member_cards(), which returns the photo as null for a hidden profile when the caller is signed out and
 * the real photo for everyone else. Names are never masked. Use it for anything a signed-out visitor can reach.
 */
export interface MemberCard { uuid: string; memberId: number; fullName: string; avatarUrl?: string; role: string }

export async function fetchMemberCards(uuids: string[]): Promise<Map<string, MemberCard>> {
  const out = new Map<string, MemberCard>()
  const ids = Array.from(new Set(uuids.filter(Boolean)))
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await (supabaseCommunity as any).rpc('public_member_cards', { p_uuids: ids.slice(i, i + 200) })
    if (error) throw error
    for (const r of (data as any[]) ?? []) {
      out.set(r.uuid, { uuid: r.uuid, memberId: r.member_id, fullName: r.full_name, avatarUrl: r.avatar_url ?? undefined, role: r.role })
    }
  }
  return out
}
