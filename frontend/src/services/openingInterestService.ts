import { supabaseCommunity } from '../lib/supabaseCommunity'
import { logSupabaseError } from '../lib/errorTracking'

/**
 * "Remind me when I am in." A member whose sign-up is still waiting for approval cannot apply to a role or ask to
 * join a team, so they register interest instead (table opening_interests, scripts/opening_interests_2026_11_02.sql).
 * The database trigger flips their interests to `ready` the moment they are approved and writes one notification;
 * the feed chip (components/InterestChip.tsx) reads the ready ones.
 *
 * Service contract as everywhere: these THROW on error and the caller owns the toast.
 */
export type InterestState = 'waiting' | 'ready' | 'applied' | 'dismissed'

export interface Interest {
  id: string
  state: InterestState
  openingId: string | null
  teamId: number | null
  message: string | null
  customAnswers: Record<string, unknown>
  fromApplication: boolean
  createdAt: string
  /** Joined for display. Null when the role or team is gone. */
  openingTitle: string | null
  openingStatus: string | null
  teamName: string | null
  teamUuid: string | null
}

const COLS = 'id,state,opening_id,team_id,message,custom_answers,from_application,created_at,job_openings(title,status,team_name,deleted_at),teams(uuid,name)'

function toInterest(r: any): Interest {
  const opening = r.job_openings && !r.job_openings.deleted_at ? r.job_openings : null
  return {
    id: r.id,
    state: r.state,
    openingId: r.opening_id ?? null,
    teamId: r.team_id ?? null,
    message: r.message ?? null,
    customAnswers: r.custom_answers ?? {},
    fromApplication: !!r.from_application,
    createdAt: r.created_at,
    openingTitle: opening?.title ?? null,
    openingStatus: opening?.status ?? null,
    teamName: r.teams?.name ?? opening?.team_name ?? null,
    teamUuid: r.teams?.uuid ?? null,
  }
}

export const openingInterestService = {
  /** Register interest in a role (openingId) or a team (teamUuid). Saving twice is not an error. */
  async register(memberId: number, target: { openingId: string } | { teamUuid: string }, extra?: { message?: string; customAnswers?: Record<string, unknown> }): Promise<void> {
    let row: Record<string, unknown> = { member_id: memberId, state: 'waiting', message: extra?.message?.trim() || null, custom_answers: extra?.customAnswers ?? {} }
    if ('openingId' in target) {
      row = { ...row, opening_id: target.openingId }
    } else {
      const { data: team, error: tErr } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', target.teamUuid).single()
      if (tErr || !team) throw logSupabaseError('openingInterestService.register(team)', tErr ?? { message: 'team not found' } as any)
      row = { ...row, team_id: team.team_id }
    }
    const { error } = await (supabaseCommunity as any).from('opening_interests').insert(row)
    // 23505: already registered. That is the state the member wanted, so it is a success.
    if (error && error.code !== '23505') throw logSupabaseError('openingInterestService.register', error)
  },

  /** The member's own interest for one role or team, whatever its state, or null. */
  async getMine(memberId: number, target: { openingId: string } | { teamUuid: string }): Promise<Interest | null> {
    let q = (supabaseCommunity as any).from('opening_interests').select(COLS).eq('member_id', memberId)
    if ('openingId' in target) {
      q = q.eq('opening_id', target.openingId)
    } else {
      const { data: team } = await supabaseCommunity.from('teams').select('team_id').eq('uuid', target.teamUuid).single()
      if (!team) return null
      q = q.eq('team_id', team.team_id)
    }
    const { data, error } = await q.maybeSingle()
    if (error) throw logSupabaseError('openingInterestService.getMine', error)
    return data ? toInterest(data) : null
  },

  /** Interests that became ready on approval and are still worth asking about (the role is still open). */
  async listReady(memberId: number): Promise<Interest[]> {
    const { data, error } = await (supabaseCommunity as any)
      .from('opening_interests').select(COLS)
      .eq('member_id', memberId).eq('state', 'ready')
      .order('created_at', { ascending: true })
    if (error) throw logSupabaseError('openingInterestService.listReady', error)
    return ((data || []) as any[]).map(toInterest)
      .filter(i => (i.openingId ? i.openingTitle && i.openingStatus === 'open' : !!i.teamName))
  },

  async setState(id: string, state: 'applied' | 'dismissed' | 'waiting'): Promise<void> {
    const { error } = await (supabaseCommunity as any).from('opening_interests').update({ state }).eq('id', id)
    if (error) throw logSupabaseError('openingInterestService.setState', error)
  },

  /** After a real application or join request goes in, close the matching interest. Never throws: it is bookkeeping. */
  async markApplied(memberId: number, target: { openingId: string } | { teamId: number }): Promise<void> {
    try {
      let q = (supabaseCommunity as any).from('opening_interests').update({ state: 'applied' }).eq('member_id', memberId).in('state', ['ready', 'waiting'])
      q = 'openingId' in target ? q.eq('opening_id', target.openingId) : q.eq('team_id', target.teamId)
      await q
    } catch { /* bookkeeping only */ }
  },
}

export default openingInterestService
