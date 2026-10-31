import { track } from '@vercel/analytics'

/**
 * Join-funnel instrumentation.
 *
 * The funnel is: land on /login → press the Google button → fill name/class on
 * /register → wait on /pending → a director approves → active member. Every
 * step of that already existed; none of it was measured, so questions like
 * "did the login copy rewrite actually help?" or "where do people drop?" could
 * only be answered by guessing.
 *
 * Four events, one per real transition. Deliberately few: an event you never
 * look at is worse than no event, because it makes the ones that matter harder
 * to find. Names are past-tense facts about what the person did.
 *
 * NO PERSONAL DATA. Vercel Analytics events are not the place for names,
 * emails, phone numbers or member ids — the properties here are limited to
 * low-cardinality context (which method, which entry point). This matters more
 * than usual for AquaTerra: the members are students, many of them minors.
 */

type Method = 'google' | 'password'

/** Pressed a sign-in control. Fires BEFORE the OAuth redirect, since the
 *  redirect tears down the page and anything fired after it may never send. */
export function trackSignInStarted(method: Method, opts?: { firstVisit?: boolean }) {
  track('signin_started', { method, firstVisit: opts?.firstVisit ?? false })
}

/** Reached /register — i.e. Google succeeded, ensure_member() created the row,
 *  and this is a genuinely new account being asked to complete its profile.
 *  The gap between signin_started and this one is the OAuth drop-off. */
export function trackProfileStarted() {
  track('signup_profile_started')
}

/** Submitted name/class/phone successfully. The gap between profile_started
 *  and this is how much friction the /register form itself adds. */
export function trackProfileCompleted() {
  track('signup_profile_completed')
}

/** Landed on /pending — the account exists and is waiting on a director.
 *  The gap between this and active membership is HR's approval latency, which
 *  is the one part of the funnel the product can't fix with copy. */
export function trackAwaitingApproval() {
  track('signup_awaiting_approval')
}
