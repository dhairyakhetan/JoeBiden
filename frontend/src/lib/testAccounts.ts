// A single, narrowly-scoped exception, not a general mechanism: the org's
// own demo/test Google account gets soft-deleted and re-applied with
// on purpose (director/MemberDirectory.tsx's "restart as applicant" action)
// to show people the real apply flow, over and over. Every OTHER account's
// deleted/suspended/rejected status must keep blocking access exactly as
// before - this only ever widens access for the one email below, and only
// past the deleted/suspended/rejected wall, never past anything else (role
// checks, RLS, etc. are untouched).
//
// Deliberately a hardcoded literal, not a members column/flag: a flag on
// the row would need its own RLS/UI surface and could be set on a real
// member's account by mistake. A literal here can only ever apply to this
// one address, checked at exactly the two places that gate on account
// status (auth/ProtectedRoute.tsx, auth/AuthCallbackPage.tsx).
const UNBLOCKABLE_TEST_EMAILS = new Set(['aquaterra.techai@gmail.com'])

/**
 * KILL SWITCH (audit 2026-09-17, security P2).
 *
 * The finding: a hardcoded address that can never be blocked at the app layer
 * ships in the production bundle, so if that Google account is ever taken over
 * there is no in-app way to revoke it - the fix would need a code change,
 * review and deploy.
 *
 * Two things make that survivable, and both are worth writing down:
 *   1. The blast radius is one ordinary `member`. This only ever widens access
 *      past the deleted/suspended/rejected wall. Role checks and RLS are
 *      untouched, so the account gains nothing a normal member does not have.
 *   2. App-level revocation was never the only lever. Deleting the Supabase
 *      auth user, or unlinking the Google identity, cuts it off immediately and
 *      does not involve this file at all. That is the real incident response.
 *
 * This flag is the cheap middle option: set VITE_DISABLE_TEST_ACCOUNT_BYPASS=1
 * in the Vercel project and redeploy to turn the exception off wholesale,
 * without editing code. Absent or anything other than '1' keeps today's
 * behaviour, so nothing changes unless somebody deliberately sets it.
 */
const BYPASS_DISABLED = import.meta.env?.VITE_DISABLE_TEST_ACCOUNT_BYPASS === '1'

export function isUnblockableTestAccount(email: string | null | undefined): boolean {
  if (BYPASS_DISABLED) return false
  return !!email && UNBLOCKABLE_TEST_EMAILS.has(email.toLowerCase())
}
