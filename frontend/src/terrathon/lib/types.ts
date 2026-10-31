/**
 * TerraThon 2026: shared types.
 *
 * These mirror the live `terrathon_*` schema applied on 2026-09-19 (migrations
 * terrathon_r0_01..._04). Verify against the database, not against this file:
 * see CLAUDE.md, "Verify the live schema, not the .sql files".
 */

export type SportSlug = 'pickleball' | 'cricket' | 'fifa'

/**
 * A row of `terrathon_public_events`, the SECURITY DEFINER view anon reads.
 *
 * It deliberately carries NO slot count. `filling_fast` is a boolean computed
 * server-side at 70% of cap; `accepting` folds together open status, close time
 * and remaining capacity. Decided 2026-09-19: caps bind, but "3 of 24 taken" on
 * launch day reads as dead and suppresses the signups it needs.
 */
export interface PublicEvent {
  slug: SportSlug
  display_name: string
  status: 'open' | 'closed' | 'cancelled'
  fee_inr: number
  team_size_min: number
  team_size_max: number
  roster_min_at_signup: number
  prize_pool_inr: number | null
  prize_split: { winner?: number; runner_up?: number } | null
  venue: string | null
  venue_map_url: string | null
  day_first: string | null
  day_last: string | null
  report_time: string | null
  match_window: string | null
  rules_md: string | null
  closes_at: string | null
  sort_order: number
  filling_fast: boolean
  accepting: boolean
}

/** Admin-side row. Only leaders can read this; anon has no policy at all. */
export interface Registration {
  id: string
  ref_code: string
  event_id: string
  captain_name: string
  /** Replaced class_label at signup on 2026-09-19. */
  age: number | null
  class_label: string | null
  school: string | null
  phone: string
  email: string | null
  team_name: string | null
  status: 'pending_payment' | 'payment_claimed' | 'confirmed' | 'waitlist' | 'hold_expired' | 'cancelled'
  wa_texted_by: number | null
  wa_texted_at: string | null
  paid: boolean
  paid_at: string | null
  paid_by: number | null
  amount_paid_inr: number | null
  utr: string | null
  /** Set by submit_utr() when a participant self-reports a payment (R2). */
  utr_submitted_at: string | null
  hold_expires_at: string | null
  ticket_token: string | null
  ticket_sent_at: string | null
  notes: string | null
  source: 'web' | 'on_spot' | 'admin'
  created_at: string
  updated_at: string
}

export interface RosterMember {
  id: string
  registration_id: string
  full_name: string
  is_substitute: boolean
}

/**
 * What signup actually asks for, as of 2026-09-19: name, age, number, sport.
 *
 * Everything else is optional and mostly arrives later. The team list is NOT
 * collected here by design: one person signs up, AQ messages them, and the
 * roster comes back over WhatsApp. Asking a captain on a phone to name seven
 * players before they have asked any of them is how a signup gets abandoned.
 */
export interface RegisterPayload {
  sport: SportSlug
  client_request_id: string
  captain_name: string
  /** ISO yyyy-mm-dd. Must be on or after 2005-01-01; the RPC re-checks. */
  dob: string
  phone: string
  email?: string
  /** Optional now. Kept for the admin's manual-add drawer and walk-ins. */
  class_label?: string
  school?: string
  team_name?: string
  rules_consent: 'true' | 'false'
  updates_opt_in: 'true' | 'false'
  roster?: string[]
  source?: 'web' | 'on_spot' | 'admin'
  utm?: Record<string, string>
  /** Honeypot. Must stay empty; a bot that fills every field trips it. */
  website?: string
}

export type RegisterErrorCode =
  | 'BAD_REQUEST'
  | 'NO_SUCH_EVENT'
  | 'EVENT_CLOSED'
  | 'INVALID_NAME'
  | 'INVALID_DOB' | 'TOO_OLD'
  // Added 2026-09-21, when terrathon_register gained a floor to go with its
  // ceiling. Before that a date of birth inside the last five years passed
  // every check the function made and then tripped the table's
  // CHECK (age between 5 and 99) at the INSERT, raising an uncaught 23514 that
  // the browser could only report as "couldn't reach the server".
  | 'TOO_YOUNG'
  | 'INVALID_PHONE'
  | 'CONSENT_REQUIRED'
  | 'DUPLICATE'
  | 'TEAM_NAME_TAKEN'

export type RegisterResult =
  | {
      ok: true
      ref_code: string
      status: 'pending_payment' | 'waitlist'
      fee_inr?: number
      display_name?: string
      replayed?: boolean
    }
  | { ok: false; code: RegisterErrorCode }

export type CheckInResult =
  | { result: 'OK'; ref_code: string; display_name: string; team_name: string | null; captain_name: string; players: number }
  | { result: 'ALREADY_IN'; ref_code: string; scanned_at: string; scanned_by: string | null }
  | { result: 'NOT_CONFIRMED'; ref_code: string; display_name: string }
  | { result: 'WRONG_DAY'; ref_code: string; display_name: string; day_first: string; day_last: string }
  | { result: 'INVALID'; ref_code?: string }
  | { result: 'FORBIDDEN' }

/** Reference-code prefix per sport, matching `terrathon_events.ref_prefix`. */
export const REF_PREFIX: Record<SportSlug, string> = {
  cricket: 'CRK',
  pickleball: 'PKL',
  fifa: 'FIF',
}

export const SPORT_ORDER: SportSlug[] = ['pickleball', 'cricket', 'fifa']
