import { referralService } from '../services/referralService'
import { REFERRAL_TTL_DAYS } from '../lib/referrals'

/**
 * The invite a visitor arrived with, carried from `/login?ref=…` to the moment
 * the claim can actually be made. Section 15, the mounting half.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS AT ALL: THE CLAIM CANNOT FIRE WHEN THE LINK IS CLICKED.
 *
 * `public.claim_member_referral(uuid)` opens with
 *
 *     me integer := public.current_member_id();
 *     if me is null then raise exception 'not an active member'; end if;
 *
 * and `current_member_id()` is
 *
 *     select member_id from public.members
 *      where auth_uid = auth.uid() and status = 'active'
 *
 * (both read live from `pg_proc` on 2026-09-05, not taken from a .sql file).
 * So the function REFUSES, loudly, for every member who is not yet approved —
 * which is every single person following an invite link, at every step of the
 * funnel they can reach on their own:
 *
 *     /login?ref=…  → signed out, no member row at all
 *     /register     → status 'pending_approval'
 *     /pending      → status 'pending_approval'
 *
 * The claim becomes possible only when an HoD approves them, which is minutes
 * later at best and days later normally. The `ref` therefore has to outlive the
 * full-page Google OAuth redirect AND the wait, so it goes in localStorage, not
 * sessionStorage, and the claim is attempted at the first render where the
 * member is active.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * A BLOCKED CLAIM IS NOT AN ERROR.
 *
 * The RPC returns FALSE for all four of its rules: already claimed, no such
 * referral, expired, self-referral. A stale or reused invite link is an
 * ordinary thing to click, so false is a silent no-op and never a toast, never
 * an error page. All four are permanent, so a false also clears the stored id
 * rather than retrying it on every page load forever.
 *
 * A THROW is different and is kept: it is either the 'not an active member'
 * refusal above (expected, retry after approval) or the network. Either way the
 * id stays stored and the next attempt picks it up.
 */

/** localStorage, not sessionStorage: this has to survive days, see above. */
const REF_KEY = 'aq_referral_ref'

/**
 * Twice the longest link life (`REFERRAL_TTL_DAYS`), which leaves room for a
 * slow approval and still stops a never-approved browser carrying an id
 * forever. A link that outlives its own expiry would be refused by the RPC
 * anyway; this only avoids asking.
 */
const REF_KEEP_DAYS = REFERRAL_TTL_DAYS * 2

const DAY = 86_400_000

/** Postgres will reject anything else, so do not store it in the first place. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Stored = { id: string; at: number }

export function isReferralId(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID.test(value)
}

/**
 * Remember the invite this visitor arrived on. Called from `/login`, which is
 * the only screen the link points at.
 *
 * LAST LINK FOLLOWED WINS, deliberately. Someone who clicked one member's link
 * weeks ago, ignored it, and then signed up off a second member's link today
 * should credit the second: the first is a link they did not act on, and
 * keeping it would credit the wrong person with the sign-up that actually
 * happened. Overwriting also refreshes the timestamp, so the keep-window below
 * measures from the last real intent rather than the first.
 *
 * This does not race the RPC's own "claim once" rule, which is about a member
 * who ALREADY has a `referred_by` and is enforced server side either way.
 */
export function rememberReferral(referralId: string | null | undefined): void {
  if (!isReferralId(referralId)) return
  try {
    if (typeof window === 'undefined') return
    const row: Stored = { id: referralId, at: Date.now() }
    localStorage.setItem(REF_KEY, JSON.stringify(row))
  } catch { /* private mode: the invite simply is not carried across the redirect */ }
}

/** The stored id, or null. Clears and returns null once it is too old. */
export function storedReferral(now: number = Date.now()): string | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(REF_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Stored>
    if (!isReferralId(parsed?.id) || typeof parsed.at !== 'number') { forgetReferral(); return null }
    if (now - parsed.at > REF_KEEP_DAYS * DAY) { forgetReferral(); return null }
    return parsed.id
  } catch { return null }
}

export function forgetReferral(): void {
  try {
    if (typeof window === 'undefined') return
    localStorage.removeItem(REF_KEY)
  } catch { /* private mode */ }
}

export type ClaimOutcome =
  /** Nothing was stored. No call was made. */
  | 'none'
  /** `members.referred_by` now points at the referrer. */
  | 'claimed'
  /** A rule refused it: already claimed, expired, self, or no such referral. */
  | 'blocked'
  /** The RPC threw — normally 'not an active member'. The id is kept. */
  | 'deferred'

/**
 * Attempt the stored claim. Safe to call on any surface, as often as you like:
 * it is a no-op with no network call when nothing is stored, and the RPC itself
 * is idempotent (a member who already has a referrer gets `false`).
 *
 * Non-throwing, on the same reasoning as `notificationService.create()`: this
 * is attribution running underneath a screen the member came to for something
 * else, and a failed attribution must never interrupt it. The caller decides
 * whether 'claimed' is worth saying out loud; nothing here toasts, per the
 * service-layer contract in CLAUDE.md.
 */
export async function claimStoredReferral(): Promise<ClaimOutcome> {
  const id = storedReferral()
  if (!id) return 'none'
  try {
    const landed = await referralService.claimReferral(id)
    // Both branches are final. The four false-reasons are all permanent, so
    // retrying one on every page load would be a call that can never succeed.
    forgetReferral()
    return landed ? 'claimed' : 'blocked'
  } catch {
    // Kept, not cleared: the usual cause is that the member is still waiting on
    // an HoD, which is exactly the case this whole file exists to survive.
    return 'deferred'
  }
}
