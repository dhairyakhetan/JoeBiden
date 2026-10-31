/**
 * Referrals — the pure layer. Section 15 of the redesign changelog,
 * design reference AQ Referrals.dc.html (R1 to R4).
 *
 * Everything in this file is a pure function: link minting, expiry maths,
 * funnel-state derivation, badge tiers, note validation and the referrer
 * health verdict. Nothing here touches Supabase — that is
 * `services/referralService.ts`, which throws and lets the component own the
 * toast, per the service-layer contract in CLAUDE.md.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FOUR CONSTRAINTS, enforced here rather than left to the caller. Three of
 * them are shaped by the live RLS policies, which were read from the database
 * on 2026-09-04 rather than assumed:
 *
 *   1. NEVER expose the referrer to the person being referred.
 *      There is no opt-in-to-be-named column on `members`. The canvas copy
 *      names the referrer on the invitee's sign-in screen ("Kushal invited
 *      you into Media, Design", "kushal's note"). That is NOT transcribed.
 *      `lib/authCopy.ts` already made the same call for the same reason, and
 *      its `referral.ref` rule ("someone thinks you should be here") is the
 *      copy the invitee actually gets.
 *
 *      This is also what the database enforces: `referrals` SELECT is
 *      `referrer_id = current_member_id() OR is_director()`, so the invitee
 *      cannot read the row at all. The link therefore carries only opaque
 *      ids, never a name and never the note.
 *
 *   2. A MEMBER CANNOT MOVE THEIR OWN REFERRAL TO ACCEPTED.
 *      `referrals` UPDATE is `is_director()` on both USING and WITH CHECK.
 *      A member gets INSERT (where `referrer_id` is themselves), SELECT and
 *      DELETE on their own rows, and nothing else. So the referrer-facing
 *      funnel state is DERIVED (see `deriveReferralState`) from facts the
 *      referrer can actually read — the row's own `status`, its `expires_at`,
 *      and whether `referral_clicks` has a row — and never from a write the
 *      member is about to attempt. The UI must not offer a control that
 *      implies self-acceptance; `REFERRAL_STATE_COPY` carries no verb for
 *      `accepted` for exactly that reason.
 *
 *   3. CLICK COUNTS ARE NOT PUBLIC.
 *      `referral_clicks` INSERT is granted to `anon` AND `authenticated`
 *      (whoever opens the link may not be signed in), but SELECT is only the
 *      referrer of that specific referral, or a leader. So a click figure may
 *      be rendered on the referrer's own tracker and the HoD desk, and
 *      nowhere else. There is no public click counter and must never be one.
 *
 *   4. NEVER RENDER A COUNT THAT READS AS PRESSURE.
 *      Same rule as `authCopy.ts` constraint 2. The referrer's own tier
 *      progress is fine, it is their own record. "N people are waiting",
 *      "only N spots left", or a countdown on the invitee's screen is not.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIGURES. Nothing in this file invents one. `1,247` entered this project as
 * a fabricated member number on the sign-in receipt and spread to seven
 * places as a fake member count; the canonical public headcount is
 * displayCount(ORG_FACTS.membersTotal) (lib/orgFacts.ts) and
 * a member number is not a count. Any figure this module cannot source
 * returns `null`, and the UI renders a dashed live marker instead.
 */

/** How long an unscoped invite is good for. Section 15: 30 days. */
export const REFERRAL_TTL_DAYS = 30

/** A role-scoped invite is shorter, because the role itself may close. */
export const ROLE_REFERRAL_TTL_DAYS = 7

/** The note is a recommendation, not an essay. Canvas R1: "optional · 140 max". */
export const REFERRAL_NOTE_MAX = 140

/** Badge tiers, section 15: 1, 5 and 10 members brought in. */
export const REFERRAL_TIERS = [1, 5, 10] as const

/**
 * The five statuses the `referrals.status` check constraint allows. Only a
 * leader can write anything but the `open` default, per constraint 2.
 */
export type ReferralStatus = 'open' | 'clicked' | 'applied' | 'accepted' | 'expired'

/** What the referrer's tracker shows for one invite. Derived, never written. */
export type ReferralState = 'sent' | 'opened' | 'applied' | 'accepted' | 'expired'

export interface Referral {
  id: string
  referrerId: number
  /** `job_openings.opening_id`, the integer key. Null for an open invite. */
  openingId: number | null
  note: string | null
  status: ReferralStatus
  expiresAt: string | null
  createdAt: string
  /** From `referral_clicks`, readable by the referrer and by a leader only. */
  clicks: number
}

/**
 * The four steps of the tracker, in order. `accepted` deliberately has no
 * imperative label: a member cannot cause it, and a UI that reads like they
 * can is the failure constraint 2 exists to prevent.
 */
export const REFERRAL_STATE_COPY: Record<ReferralState, { label: string; hint: string }> = {
  sent:     { label: 'sent',     hint: 'the link is live, nobody has opened it yet' },
  opened:   { label: 'opened',   hint: 'someone opened the link' },
  applied:  { label: 'applied',  hint: 'an application came in through it' },
  accepted: { label: 'approved', hint: 'an HoD approved them. Only an HoD can set this' },
  expired:  { label: 'expired',  hint: 'the link is past its date. Issue a new one' },
}

/** Ordered, so a tracker can render the four steps and mark how far it got. */
export const REFERRAL_STEPS: ReferralState[] = ['sent', 'opened', 'applied', 'accepted']

/** Milliseconds in a day. */
const DAY = 86_400_000

/**
 * When a new referral should expire. Role-scoped invites get 7 days, open
 * ones 30. Returns an ISO string, which is what the column takes.
 */
export function referralExpiry(roleScoped: boolean, now: number = Date.now()): string {
  const days = roleScoped ? ROLE_REFERRAL_TTL_DAYS : REFERRAL_TTL_DAYS
  return new Date(now + days * DAY).toISOString()
}

/** True once `expiresAt` has passed. A null expiry never expires. */
export function isExpired(expiresAt: string | null, now: number = Date.now()): boolean {
  if (!expiresAt) return false
  const t = Date.parse(expiresAt)
  return Number.isFinite(t) && t <= now
}

/**
 * Whole days left before the link dies, floored at 0. Returns null when there
 * is no expiry, so the caller renders nothing rather than "0 days left".
 */
export function daysLeft(expiresAt: string | null, now: number = Date.now()): number | null {
  if (!expiresAt) return null
  const t = Date.parse(expiresAt)
  if (!Number.isFinite(t)) return null
  return Math.max(0, Math.ceil((t - now) / DAY))
}

/**
 * The tracker's state for one invite, DERIVED from what the referrer can read.
 *
 * Precedence, most-progressed first: a leader's `accepted` or `applied` on the
 * row wins, because those are the only two a leader writes and they are the
 * truth. Otherwise an expired link reads expired. Otherwise a click makes it
 * opened. Otherwise it is simply sent.
 *
 * Note the order of `expired` and `opened`: an expired link that WAS opened
 * still reads expired, because "opened" would invite the referrer to keep
 * waiting on a link that can no longer be used.
 */
export function deriveReferralState(r: Pick<Referral, 'status' | 'expiresAt' | 'clicks'>, now: number = Date.now()): ReferralState {
  if (r.status === 'accepted') return 'accepted'
  if (r.status === 'applied') return 'applied'
  if (r.status === 'expired' || isExpired(r.expiresAt, now)) return 'expired'
  if (r.clicks > 0 || r.status === 'clicked') return 'opened'
  return 'sent'
}

/**
 * The invite link.
 *
 *   /login?ref=<referral uuid>[&role=<opening uuid>]
 *
 * `lib/authCopy.ts` already reads `ref` and `role` off the query string and
 * picks the headline from them (`referral.role` beats `referral.ref`), so this
 * format is not a new convention — it is the one the auth funnel expects.
 *
 * `ref` carries the REFERRAL's uuid, not the referrer's member id. Two
 * reasons: a click can only be logged against a `referral_id`, and a member id
 * in a link is a durable identifier for a person that anyone could collect.
 *
 * `role` carries the opening's PUBLIC uuid (`job_openings.id`, what
 * `/opportunities/:id` routes on), not the integer `opening_id` the referrals
 * table stores. The two are different columns on the same row.
 *
 * `origin` is passed in rather than read from `window`, so the function stays
 * pure and testable.
 */
export function buildReferralLink(opts: { origin: string; referralId: string; openingUuid?: string | null }): string {
  const base = opts.origin.replace(/\/+$/, '')
  const params = new URLSearchParams({ ref: opts.referralId })
  if (opts.openingUuid) params.set('role', opts.openingUuid)
  return `${base}/login?${params.toString()}`
}

/**
 * The WhatsApp share target. The referrer's own note is NOT appended: they
 * are about to type their own message, and pre-filling it with the note they
 * already wrote for the sign-in screen makes them send it twice.
 *
 * No em dash, per the project copy rule.
 */
export function whatsappShareUrl(link: string): string {
  const text = `I think you'd be good at this. AquaTerra is a student run NGO in Kolkata, here's the sign up: ${link}`
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Trimmed note, or null. Empty and whitespace-only both become null. */
export function normalizeNote(raw: string): string | null {
  const t = raw.trim()
  return t.length ? t : null
}

/**
 * Validation for the note field. Returns an error string for the caller to
 * render, or null when it is fine. The note is optional, so an empty one is
 * always valid.
 */
export function validateNote(raw: string): string | null {
  if (raw.length > REFERRAL_NOTE_MAX) {
    return `That is ${raw.length - REFERRAL_NOTE_MAX} characters over. Keep it to ${REFERRAL_NOTE_MAX}.`
  }
  return null
}

/**
 * The badge tier for a number of members brought in: 0 below the first tier,
 * otherwise the index of the highest tier reached, 1-based.
 *
 * `brought` is `number | null`. Null means "the figure could not be sourced",
 * which is a real state here (see the grant note in CHANGELOG_SEC12_15.md),
 * and it returns null so the UI renders a dashed live marker instead of a
 * confident zero. A zero is a claim.
 */
export function badgeTier(brought: number | null): number | null {
  if (brought === null) return null
  let tier = 0
  for (const t of REFERRAL_TIERS) if (brought >= t) tier += 1
  return tier
}

/** How many more are needed for the next tier, or null when the top is reached. */
export function nextTierGap(brought: number | null): number | null {
  if (brought === null) return null
  for (const t of REFERRAL_TIERS) if (brought < t) return t - brought
  return null
}

/**
 * The abuse verdict, section 15: "a referrer is flagged automatically at 5
 * rejections or a hit rate under 25% over 8 invites."
 *
 * This is a leader-only reading — it needs counts across other people's
 * applications — so it is only ever called from the desk panel. Returned as a
 * verdict plus the reason, never as a bare boolean, because a flag with no
 * stated reason is not actionable.
 *
 * A flagged referrer's links keep working. Flagging only stops them being
 * surfaced as a suggestion.
 */
export type ReferrerVerdict = { flagged: boolean; reason: string | null }

export function referrerHealth(counts: { invited: number; approved: number; rejected: number }): ReferrerVerdict {
  if (counts.rejected >= 5) {
    return { flagged: true, reason: `${counts.rejected} of their invitees were turned down` }
  }
  if (counts.invited >= 8 && counts.approved / counts.invited < 0.25) {
    return { flagged: true, reason: `under a quarter of ${counts.invited} invites were approved` }
  }
  return { flagged: false, reason: null }
}

/**
 * Self-referral guard. The database already carries a check constraint on
 * `members.referred_by`, but a member should be told before the write, not by
 * a constraint violation.
 */
export function isSelfReferral(referrerId: number | null, inviteeId: number | null): boolean {
  return referrerId !== null && inviteeId !== null && referrerId === inviteeId
}
