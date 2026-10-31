/**
 * TerraThon data access.
 *
 * Follows this repo's service-layer contract: every function here THROWS on
 * error and never toasts. The calling component wraps it in try/catch and owns
 * the user-facing feedback (CLAUDE.md, "Service layer contract").
 *
 * TerraThon reuses the community Supabase project and its anon key. There is no
 * second client and no new env var. The generated `database.types.ts` predates
 * these tables, so the client is cast once here rather than sprinkling `as any`
 * through the UI.
 */
import { supabaseCommunity } from '../../lib/supabaseCommunity'
import type {
  PublicEvent,
  Registration,
  RosterMember,
  RegisterPayload,
  RegisterResult,
  CheckInResult,
  SportSlug,
} from './types'

import { cleanVenue } from './format'

const db = supabaseCommunity as any

/** Small clean-ups for known data slips (a clock time typed into the venue field). */
const tidyEvent = (e: PublicEvent): PublicEvent => ({ ...e, venue: cleanVenue(e.venue) })

/** Public sport config. Readable by anon through the SECURITY DEFINER view. */
export async function listPublicEvents(): Promise<PublicEvent[]> {
  const { data, error } = await db
    .from('terrathon_public_events')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return ((data ?? []) as PublicEvent[]).map(tidyEvent)
}

export async function getPublicEvent(slug: SportSlug): Promise<PublicEvent | null> {
  const { data, error } = await db
    .from('terrathon_public_events')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  return data ? tidyEvent(data as PublicEvent) : null
}

/**
 * The single public write path. Everything is revalidated server-side inside a
 * SECURITY DEFINER function that locks the sport's events row, so two teams can
 * never both take the last slot after a broadcast.
 *
 * Resolves with `{ok:false, code}` for an expected rejection (duplicate, closed,
 * bad phone). It only throws on a transport failure, which is what the caller
 * should surface as "couldn't reach the server, your details are saved".
 */
export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  const { data, error } = await db.rpc('terrathon_register', { payload })
  if (error) throw error
  return data as RegisterResult
}

/** Database clock, so a phone with a wrong clock still counts down correctly. */
export async function serverNow(): Promise<Date> {
  const { data, error } = await db.rpc('terrathon_server_now')
  if (error) throw error
  return new Date(data as string)
}

export async function checkIn(token: string, day: string): Promise<CheckInResult> {
  const { data, error } = await db.rpc('terrathon_check_in', { p_token: token, p_day: day })
  if (error) throw error
  return data as CheckInResult
}

// ── Admin ───────────────────────────────────────────────────────────────────

export interface AdminRow extends Registration {
  event_slug: SportSlug
  event_name: string
  roster: string[]
  last_checkin: string | null
}

/**
 * The merged admin feed, newest first. RLS restricts this to leaders; a member
 * with no leader role gets an empty array rather than an error, which is why
 * the dashboard checks the role itself before rendering (see the empty-state
 * note in AdminDashboard).
 */
export async function listRegistrations(): Promise<AdminRow[]> {
  const { data, error } = await db
    .from('terrathon_registrations')
    .select('*, terrathon_events!inner(slug, display_name), terrathon_roster(full_name), terrathon_checkins(scanned_at)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    ...r,
    event_slug: r.terrathon_events?.slug,
    event_name: r.terrathon_events?.display_name,
    roster: (r.terrathon_roster ?? []).map((x: any) => x.full_name),
    last_checkin:
      (r.terrathon_checkins ?? [])
        .map((c: any) => c.scanned_at)
        .sort()
        .pop() ?? null,
  })) as AdminRow[]
}

export async function setPaid(
  id: string,
  paid: boolean,
  extra?: { amount_paid_inr?: number | null; utr?: string | null },
): Promise<void> {
  // paid_at, paid_by, ticket_token and status are all stamped by the database
  // trigger, deliberately: it runs under the leader's own session so auth.uid()
  // resolves and paid_by records who really ticked it.
  const { error } = await db
    .from('terrathon_registrations')
    .update({ paid, ...(extra ?? {}) })
    .eq('id', id)
  if (error) throw error
}

export async function setMessaged(id: string, memberId: number | null): Promise<void> {
  // One column does double duty: null means not messaged, a member id means
  // messaged and records who. wa_texted_at is stamped by the trigger.
  const { error } = await db
    .from('terrathon_registrations')
    .update({ wa_texted_by: memberId })
    .eq('id', id)
  if (error) throw error
}

export async function setNotes(id: string, notes: string): Promise<void> {
  const { error } = await db.from('terrathon_registrations').update({ notes }).eq('id', id)
  if (error) throw error
}

export async function setTicketSent(id: string): Promise<void> {
  const { error } = await db
    .from('terrathon_registrations')
    .update({ ticket_sent_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function setStatus(id: string, status: Registration['status']): Promise<void> {
  const { error } = await db.from('terrathon_registrations').update({ status }).eq('id', id)
  if (error) throw error
}

/**
 * Delete one registration for good, through the RPC rather than a DELETE.
 *
 * A plain PostgREST delete is permitted by RLS but fails on two of the three
 * children: terrathon_checkins and terrathon_audit_log are both NO ACTION, and
 * after a single "messaged" tick every row has audit entries. The function
 * handles the children in order inside one transaction, keeps the audit trail
 * by detaching it rather than deleting it, and writes a tombstone carrying the
 * whole row. See scripts/terrathon_delete_registration_2026_09_21.sql.
 *
 * It re-checks the leader role itself, because a SECURITY DEFINER function's
 * own statements do not go through RLS.
 */
export async function deleteRegistration(id: string): Promise<void> {
  const { data, error } = await db.rpc('terrathon_delete_registration', { p_id: id })
  if (error) throw error
  const res = data as { ok: boolean; code?: string } | null
  if (!res?.ok) {
    throw new Error(
      res?.code === 'FORBIDDEN' ? 'Your account is not a TerraThon leader.'
      : res?.code === 'NOT_FOUND' ? 'That registration is already gone.'
      : 'The database refused the delete.',
    )
  }
}

export async function getRoster(registrationId: string): Promise<RosterMember[]> {
  const { data, error } = await db
    .from('terrathon_roster')
    .select('*')
    .eq('registration_id', registrationId)
  if (error) throw error
  return (data ?? []) as RosterMember[]
}

/** Admin-side event rows, including cap and breakeven which the public never sees. */
export async function listAdminEvents(): Promise<any[]> {
  const { data, error } = await db
    .from('terrathon_events')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

/**
 * Open or close one sport's registrations. This flips `terrathon_events.status` between 'open' and 'closed' and nothing
 * else: a sport that is full or past its closing time stays unavailable either way (the public view still requires
 * spots left and a future closing time). RLS allows it for directors and super admins only.
 */
export async function setEventStatus(id: string, status: 'open' | 'closed'): Promise<void> {
  const { error } = await db.from('terrathon_events').update({ status }).eq('id', id).neq('status', 'cancelled')
  if (error) throw error
}

/**
 * Day sheet for the printable paper fallback and the scanner's day filter.
 *
 * Excludes cancelled rows even when `paid` is still true: `setStatus` allows
 * cancelling a paid registration (refund, disqualification, duplicate
 * cleanup) with no code path that also clears `paid`, so `paid` alone is not
 * proof of a valid admission. This mirrors `statusLabel` in format.ts, which
 * checks `cancelled` before `paid` for the same reason, and the online path's
 * own `terrathon_check_in` SQL function, which rejects `status = 'cancelled'`
 * server-side. This offline cache must agree, or a cancelled team gets waved
 * through whenever the gate phone has no signal.
 */
export async function listConfirmedForDay(slug: SportSlug): Promise<AdminRow[]> {
  const all = await listRegistrations()
  return all.filter((r) => r.event_slug === slug && r.paid && r.status !== 'cancelled')
}
