/**
 * Hiring desks show every application, including ones from people whose own AquaTerra account is still waiting for
 * approval. Those rows carry a tag, and "accepted" stays switched off until the account is approved.
 *
 * History: from 2026-09-14 to 2026-11-01 these applications were HIDDEN from every hiring desk. HoDs were notified of
 * them and then could not find them, and 22 of 47 applications to open roles were invisible while 129 accounts sat in the
 * approval queue (bug 875f0da1 and a repeat report from a HoD). The owner chose to show them tagged instead
 * (2026-11-01). The one thing the old rule protected, accepting someone whose account is not yet cleared, is still
 * enforced: here in the UI and again in jobOpenings.updateApplicationStatus.
 *
 * SUPERSEDED 2026-11-02 for NEW applications: a member whose sign-up is pending can no longer apply at all (they register
 * interest and get a feed chip once approved, see lib/joinGate.ts and scripts/opening_interests_2026_11_02.sql). This tag
 * and the accept guard stay as a safety net: they still cover an application whose applicant is later un-approved, and the
 * one application a rejected member filed before the rule changed.
 */
export const AWAITING_APPROVAL_TAG = 'account awaiting approval'

export const ACCEPT_BLOCKED_MESSAGE =
  "this person's AquaTerra account has not been approved yet. approve the account first, then accept the application."

type WithApplicant = { applicant?: { status?: string | null } | null } | null | undefined

/** True when the applicant's own account is active. A missing account row counts as not approved. */
export function isApplicantApproved(row: WithApplicant): boolean {
  return row?.applicant?.status === 'active'
}
