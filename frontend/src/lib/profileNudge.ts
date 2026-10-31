// "Complete your profile" nudge — the pure logic behind the in-feed card.
//
// Everything here is a pure function of (facts, state, now). No Supabase, no
// React, no clock reads: `services/profileNudgeService.ts` owns the I/O and
// `components/ProfileNudgeCard.tsx` owns the pixels. That split is what makes
// the two things most likely to be wrong — which items count as "done", and
// when the card is allowed back — directly unit-testable.
//
// WHY THE ORDER MATTERS (measured against the live DB, 2026-09-07, 1,317
// active members):
//     avatar_url  1,305 empty (99.1%)
//     bio         1,315 empty (99.8%)
//     phone       1,283 empty (97.4%)
//     school_id     285 empty
//     class_grade   191 empty
// Nearly every member starts at 0/5. A checklist that opens with the most
// expensive item (writing a bio) reads as a chore and gets dismissed. So the
// order below is cheapest-and-highest-impact first: the avatar is one tap
// from the camera roll and it changes every feed card, comment and directory
// tile the member appears on — all of which currently render a fallback
// initial. Bio is last because it is the only item that needs composing.

export type NudgeFieldKey = 'avatar' | 'class' | 'phone' | 'school' | 'bio'

/** How the card lets the member act on a row. */
export type NudgeAction = 'avatar' | 'phone' | 'link'

/** The subset of the member's own row the checklist reads. */
export interface NudgeProfileFacts {
  avatarUrl?: string | null
  classGrade?: string | null
  /** The member's own number. NEVER rendered — see `maskPhone`. */
  phone?: string | null
  /** A guardian's number. Absent as a column until the 2026-09-07 migration
   *  runs; `undefined` therefore means "unknown/unavailable", not "empty". */
  guardianPhone?: string | null
  schoolId?: number | null
  bio?: string | null
}

export interface NudgeItem {
  key: NudgeFieldKey
  /** Row label. Lowercase to match the app's voice. */
  label: string
  /** One short line saying why it is worth doing. */
  why: string
  done: boolean
  action: NudgeAction
  /** Only set when `action === 'link'`. */
  href?: string
}

export interface NudgeProgress {
  items: NudgeItem[]
  doneCount: number
  total: number
  /** 0–100, rounded. */
  percent: number
  /** The first not-yet-done item, or null when everything is done. */
  next: NudgeItem | null
  remaining: number
  isComplete: boolean
  /** Exactly one item left — the card switches to its "so close" voice. */
  isOneLeft: boolean
}

/** Empty, whitespace-only and null all count as missing. */
function filled(v: string | null | undefined): boolean {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * The five checklist rows, in fixed display order.
 *
 * `phone` is satisfied by EITHER the member's own number or a guardian's.
 * That is the whole reason a phone field is acceptable on a platform whose
 * members are 14–19: a member who does not want to hand over their own
 * mobile has an equally-weighted alternative, and the checklist treats the
 * two as equally complete. It never prefers one over the other.
 */
export function computeCompleteness(facts: NudgeProfileFacts): NudgeProgress {
  const items: NudgeItem[] = [
    {
      key: 'avatar',
      label: 'add a photo',
      why: 'it shows on every post, comment and team list.',
      done: filled(facts.avatarUrl),
      action: 'avatar',
    },
    {
      key: 'class',
      label: 'your class',
      why: 'so drives and events get planned around school hours.',
      done: filled(facts.classGrade),
      action: 'link',
      href: '/profile/edit',
    },
    {
      key: 'phone',
      label: 'a WhatsApp number',
      why: 'yours or a guardian’s — it’s how AquaTerra reaches you.',
      done: filled(facts.phone) || filled(facts.guardianPhone),
      action: 'phone',
    },
    {
      key: 'school',
      label: 'your school',
      why: 'it puts you on your school’s member list.',
      done: facts.schoolId != null,
      action: 'link',
      href: '/profile/edit',
    },
    {
      key: 'bio',
      label: 'a line about you',
      why: 'one sentence is plenty.',
      done: filled(facts.bio),
      action: 'link',
      href: '/profile/edit',
    },
  ]

  const total = items.length
  const doneCount = items.filter(i => i.done).length
  const remaining = total - doneCount
  return {
    items,
    doneCount,
    total,
    percent: Math.round((doneCount / total) * 100),
    next: items.find(i => !i.done) ?? null,
    remaining,
    isComplete: remaining === 0,
    isOneLeft: remaining === 1,
  }
}

// ── Dismissal state machine ────────────────────────────────────────────────
//
// The owner's rule: snooze ~2 weeks -> it comes back ONCE -> a second
// dismissal retires it for good. Encoded as a count plus a deadline so it can
// live in two additive `members` columns and survive a device change (the
// service falls back to localStorage until that migration is applied).
//
//   dismissCount 0  ->  showing
//   dismissCount 1  ->  hidden until `snoozedUntil`, then showing again
//   dismissCount 2+ ->  retired, permanently. Never computed back to visible.

export const NUDGE_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000
export const NUDGE_MAX_DISMISSALS = 2

export interface NudgeState {
  dismissCount: number
  /** ISO timestamp, or null when not snoozed / already retired. */
  snoozedUntil: string | null
}

export const EMPTY_NUDGE_STATE: NudgeState = { dismissCount: 0, snoozedUntil: null }

export type NudgeVisibility = 'show' | 'snoozed' | 'retired'

export function nudgeVisibility(state: NudgeState, nowMs: number): NudgeVisibility {
  if (state.dismissCount >= NUDGE_MAX_DISMISSALS) return 'retired'
  if (state.snoozedUntil) {
    const until = Date.parse(state.snoozedUntil)
    // An unparseable timestamp must not wedge the card off-screen forever;
    // treat it as "no snooze recorded" rather than as an infinite one.
    if (Number.isFinite(until) && until > nowMs) return 'snoozed'
  }
  return 'show'
}

/** The state after the member taps "not now". */
export function dismissNudge(state: NudgeState, nowMs: number): NudgeState {
  const dismissCount = Math.min(state.dismissCount + 1, NUDGE_MAX_DISMISSALS)
  return {
    dismissCount,
    snoozedUntil:
      dismissCount >= NUDGE_MAX_DISMISSALS
        ? null
        : new Date(nowMs + NUDGE_SNOOZE_MS).toISOString(),
  }
}

/**
 * The state after the checklist is finished. Retiring on completion (rather
 * than relying on `isComplete` alone) means the card cannot reappear if a
 * member later clears their bio — it has done its job and asked its last time.
 */
export function retireNudge(): NudgeState {
  return { dismissCount: NUDGE_MAX_DISMISSALS, snoozedUntil: null }
}

/** Whole days until the snooze lifts, floored at 0. For copy only. */
export function daysUntilReturn(state: NudgeState, nowMs: number): number {
  if (!state.snoozedUntil) return 0
  const until = Date.parse(state.snoozedUntil)
  if (!Number.isFinite(until)) return 0
  return Math.max(0, Math.ceil((until - nowMs) / 86400000))
}

// ── Phone helpers ──────────────────────────────────────────────────────────

/**
 * Last-4 mask, e.g. "••••••1234". The ONLY form in which any number is
 * allowed to reach the screen in this feature, and only ever as the signed-in
 * member's confirmation of what they themselves just saved. A guardian's
 * number is never echoed back at all.
 */
export function maskPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (digits.length < 4) return '•'.repeat(4)
  return '•'.repeat(Math.max(digits.length - 4, 2)) + digits.slice(-4)
}

/** Strips formatting for storage; keeps a leading +. */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim()
  const plus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return plus ? `+${digits}` : digits
}

/**
 * Deliberately permissive: Indian mobiles are 10 digits, but members do give
 * numbers with a +91 / 0 prefix and a guardian may be abroad. Reject only what
 * is obviously not a phone number rather than bouncing a real one.
 */
export function isPlausiblePhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15
}

/**
 * The one "is this member's mandatory profile step done" check, shared by
 * every route-level gate (ProtectedRoute, AuthCallbackPage, RegisterPage
 * itself) so they can never drift apart the way this codebase's route/tab
 * privilege gates already have once. class_grade alone used to mean "done" -
 * a phone number is now required too, for a brand-new signup and for an
 * already-active member who slipped through before this rule existed alike.
 */
export function isRegistrationComplete(member: { class_grade: string | null; phone: string | null } | null | undefined): boolean {
  return !!member?.class_grade && isPlausiblePhone(member.phone ?? '')
}
