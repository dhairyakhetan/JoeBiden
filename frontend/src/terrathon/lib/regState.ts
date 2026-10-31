/**
 * Whether a sport is taking registrations, and if not, why. Mirrors the rule in the `terrathon_public_events` view
 * (scripts/terrathon_manual_close_only_2026_09_29.sql): accepting = status 'open', nothing else. A sport never closes on its
 * own: not at closes_at, not at the cap. Past the cap, new sign-ups are filed as waitlist. A spot is held by any registration
 * that is not cancelled / waitlist / hold_expired and is either paid, has a UTR, has no hold expiry, or has a hold that has
 * not expired yet. The admin desk shows the reason; the database stays the judge.
 */
export type RegKind = 'accepting' | 'waitlisting' | 'closed_by_admin' | 'cancelled'

export interface RegStateEvent { status: string; closes_at: string | null; cap: number | null }
export interface RegStateRow { status: string; paid: boolean; utr: string | null; hold_expires_at: string | null }

export function heldSpots(rows: RegStateRow[], nowMs: number): number {
  return rows.filter((r) => (
    !['cancelled', 'waitlist', 'hold_expired'].includes(r.status)
    && (r.paid || r.utr != null || r.hold_expires_at == null || Date.parse(r.hold_expires_at) > nowMs)
  )).length
}

export function registrationState(e: RegStateEvent, held: number, _nowMs?: number): { kind: RegKind; label: string; detail: string } {
  if (e.status === 'cancelled') return { kind: 'cancelled', label: 'Cancelled', detail: 'This sport is cancelled.' }
  if (e.status !== 'open') return { kind: 'closed_by_admin', label: 'Closed by admin', detail: 'Turn registrations back on with the switch.' }
  if (e.cap != null && held >= e.cap) return { kind: 'waitlisting', label: `Open, waitlisting (${held} of ${e.cap})`, detail: 'Every spot is held. New sign-ups are waitlisted. It stays open until you close it.' }
  return { kind: 'accepting', label: 'Accepting', detail: e.cap != null ? `${held} of ${e.cap} spots held.` : `${held} spots held.` }
}
