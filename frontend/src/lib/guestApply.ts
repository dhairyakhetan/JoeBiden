import { supabaseCommunity } from './supabaseCommunity'
import { isIndianMobile, normalizePhone } from './profileNudge'

/**
 * Applying for a role while signed out is ONE flow in two steps (owner request, 3 Nov 2026):
 *   step 1  name, phone, email, and the usual answers
 *   step 2  "sign in to send": Google, right there, with the draft kept across the redirect
 *
 * Between the two, `guest_apply_match` (scripts/guest_apply_match_2026_11_03.sql) says whether the number or the
 * email already belongs to an account, so step 2 can say "we found an account for you" instead of silently making
 * a second one. It never returns a name or a full email; the masked email comes back only when the number matches
 * and the typed email differs. A match never attaches the application to that account: whichever account signs in
 * is the one that applies (an active member continues the form; a new or waiting member has the application kept
 * as an interest, see AuthCallbackPage).
 */
export type GuestOutcome = 'none' | 'email_match' | 'phone_match' | 'invalid' | 'limited' | 'error'
export interface GuestMatch { outcome: GuestOutcome; maskedEmail: string | null }

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const isEmailShape = (v: string) => EMAIL_RE.test(v.trim())

export interface GuestIdentity { name: string; phone: string; email: string }

/** Validation for step 1, as sentences. Null when the identity is good to send. */
export function guestIdentityProblem(id: GuestIdentity): string | null {
  if (id.name.trim().length < 2) return 'tell us your name.'
  if (!isIndianMobile(id.phone)) return 'enter a 10-digit Indian mobile number (starting 6 to 9). +91 is fine.'
  if (!isEmailShape(id.email)) return 'that email does not look right yet.'
  return null
}

/** Ask the database. Fails open to "error": step 2 then just offers plain Google sign-in. */
export async function matchGuest(phone: string, email: string): Promise<GuestMatch> {
  try {
    const { data, error } = await supabaseCommunity.rpc('guest_apply_match' as never, { p_phone: phone, p_email: email.trim() } as never)
    if (error) return { outcome: 'error', maskedEmail: null }
    const row = (Array.isArray(data) ? data[0] : data) as { outcome?: string; masked_email?: string | null } | undefined
    const outcome = row?.outcome
    if (outcome === 'none' || outcome === 'email_match' || outcome === 'phone_match' || outcome === 'invalid' || outcome === 'limited') {
      return { outcome, maskedEmail: row?.masked_email ?? null }
    }
    return { outcome: 'error', maskedEmail: null }
  } catch {
    return { outcome: 'error', maskedEmail: null }
  }
}

export interface GuestCopy { heading: string; body: string; button: string; useHint: boolean }

/** What step 2 says. `useHint`: pass the typed email to Google as a hint (not when a different email is on file). */
export function guestCopy(m: GuestMatch, roleTitle: string): GuestCopy {
  if (m.outcome === 'email_match') {
    return {
      heading: 'we found an account for you.',
      body: `Sign in to continue. Your application for ${roleTitle} is saved here, and you carry on right where you left off.`,
      button: 'Sign in and continue →',
      useHint: true,
    }
  }
  if (m.outcome === 'phone_match') {
    return {
      heading: 'we found an account with this number.',
      body: m.maskedEmail
        ? `Try signing in with ${m.maskedEmail}. Your application is saved here, and you carry on right after.`
        : 'Try signing in with the email you used before. Your application is saved here, and you carry on right after.',
      button: 'Sign in with Google →',
      useHint: false,
    }
  }
  return {
    heading: 'one more step.',
    body: `Continue with Google to create your account. It takes a few seconds, and your application for ${roleTitle} is saved. First HR confirms you as part of AquaTerra, then the team reaches out to you.`,
    button: 'Continue with Google →',
    useHint: true,
  }
}

// ── the draft that survives the Google redirect ───────────────────────────────
const SLOT = 'aq_guest_apply_v1'
const APPLIED_SLOT = 'aq_guest_applied_v1'
const TTL_MS = 6 * 60 * 60 * 1000

export interface GuestDraft {
  openingId: string
  title: string
  name: string
  email: string
  phone: string
  message: string
  answers: Record<string, string>
}
interface Stored { draft: GuestDraft; at: number }

export function stashGuestApply(draft: GuestDraft): void {
  try { sessionStorage.setItem(SLOT, JSON.stringify({ draft, at: Date.now() } satisfies Stored)) } catch { /* storage blocked: step 2 still signs them in */ }
}

export function readGuestApply(): GuestDraft | null {
  try {
    const raw = sessionStorage.getItem(SLOT)
    if (!raw) return null
    const s = JSON.parse(raw) as Stored
    if (!s?.draft?.openingId || typeof s.at !== 'number' || Date.now() - s.at > TTL_MS) { sessionStorage.removeItem(SLOT); return null }
    return s.draft
  } catch { return null }
}

export function clearGuestApply(): void {
  try { sessionStorage.removeItem(SLOT) } catch { /* nothing to clear */ }
}

/** Set when a waiting member's application was kept as an interest, so /pending can say so. */
export function markGuestApplied(title: string): void {
  try { sessionStorage.setItem(APPLIED_SLOT, JSON.stringify({ title, at: Date.now() })) } catch { /* convenience only */ }
}

export function readGuestApplied(): string | null {
  try {
    const raw = sessionStorage.getItem(APPLIED_SLOT)
    if (!raw) return null
    const s = JSON.parse(raw) as { title?: string; at?: number }
    if (!s?.title || typeof s.at !== 'number' || Date.now() - s.at > TTL_MS) { sessionStorage.removeItem(APPLIED_SLOT); return null }
    return s.title
  } catch { return null }
}

/** Phone and name for /register to start from, when the visitor already gave them. */
export function guestPrefill(): { name: string; phone: string } | null {
  const d = readGuestApply()
  return d ? { name: d.name, phone: normalizePhone(d.phone) } : null
}

/** Step 2's button. Keeps the draft, then hands over to Google; returns only if Google could not be reached. */
export async function continueWithGoogle(opts: { draft: GuestDraft; returnTo: string; loginHint?: string }): Promise<{ error?: string }> {
  stashGuestApply(opts.draft)
  try { sessionStorage.setItem('aq_oauth_from', opts.returnTo) } catch { /* falls back to '/' */ }
  const { error } = await supabaseCommunity.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback',
      ...(opts.loginHint ? { queryParams: { login_hint: opts.loginHint } } : {}),
    },
  })
  return error ? { error: error.message || 'Could not reach Google. Try again.' } : {}
}
