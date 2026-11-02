/**
 * Who may APPLY to a team role or ASK to join a team.
 *
 * Owner rule, 2 Nov 2026: someone whose own AquaTerra sign-up is still waiting for approval cannot apply. They get
 * a pop-up that says so and can register INTEREST instead; when HR approves them they get a chip at the top of the
 * feed ("you wanted to join this, still want to?"). The database enforces the same rule (job_applications and
 * team_join_requests INSERT policies require an active member), so this file only decides what the screen says.
 *
 *   visitor   signed out. Keeps the old flow: fill the form, sign in with Google when you press send.
 *   active    an approved member. Applies as normal.
 *   pending   signed in, waiting for HR. Gets the "not part of AquaTerra yet" pop-up and can register interest.
 *   rejected  sign-up was not approved. Cannot apply and gets no reminder: they wait out the 30 days.
 *   blocked   suspended, deleted, archived or anything else. Cannot apply.
 */
export type JoinGate = 'visitor' | 'active' | 'pending' | 'rejected' | 'blocked'

export function joinGate(member?: { status?: string | null } | null): JoinGate {
  if (!member) return 'visitor'
  switch (member.status) {
    case 'active': return 'active'
    case 'pending_approval': return 'pending'
    case 'rejected': return 'rejected'
    default: return 'blocked'
  }
}

/** True when the form may be shown and submitted. A visitor is let through: they sign in on submit. */
export function canApplyNow(gate: JoinGate): boolean {
  return gate === 'visitor' || gate === 'active'
}

/** Only a member still waiting for approval can ask to be reminded. */
export function canRegisterInterest(gate: JoinGate): boolean {
  return gate === 'pending'
}

/** The sentence a refused insert becomes, if a stale tab ever gets past the screen. */
export const NOT_APPROVED_YET_MESSAGE = 'You can apply once your AquaTerra account is approved.'

/** Postgres 42501 = RLS refused the insert. For these two tables that now means "not an active member". */
export function isNotApprovedError(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && (error.code === '42501' || /row-level security/i.test(error.message || ''))
}
