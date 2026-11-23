import { supabaseCommunity } from './supabaseCommunity'
import { isIndianMobile, normalizePhone } from './profileNudge'

/**
 * Applying for a role while signed out (owner request, 12 Nov 2026, replacing the 3 Nov two-step with email):
 *   step 1  name and phone, and the usual answers. No email.
 *   then    `guest_apply_submit` (scripts/applicants_one_list_2026_11_12.sql) looks at the number.
 *             - exactly one active AquaTerra account has it: the application is linked to that account on the spot and
 *               goes to the team. The visitor is done. The account owner is told, and the team sees it marked "linked by
 *               phone number" because a number is not proof of identity.
 *             - otherwise: step 2, "not part of AquaTerra yet", sign in with Google. The draft survives the redirect,
 *               the new account is kept as an interest for HR, and approval moves it to the team on its own.
 */
export type GuestOutcome = 'linked' | 'already' | 'closed' | 'not_member' | 'invalid' | 'limited' | 'error' | 'signin'
export interface GuestResult { outcome: GuestOutcome; title: string | null }

export interface GuestIdentity { name: string; phone: string }

/** Validation for step 1, as sentences. Null when the identity is good to send. */
export function guestIdentityProblem(id: GuestIdentity): string | null {
  if (id.name.trim().length < 2) return 'tell us your name.'
  if (!isIndianMobile(id.phone)) return 'enter a 10-digit Indian mobile number (starting 6 to 9). +91 is fine.'
  return null
}

const KNOWN: GuestOutcome[] = ['linked', 'already', 'closed', 'not_member', 'invalid', 'limited']

/** Send the application by number. Fails open to "error": the caller then offers plain Google sign-in, so nobody is stuck. */
export async function submitGuestApply(d: { openingId: string; name: string; phone: string; message: string; answers: Record<string, string> }): Promise<GuestResult> {
  try {
    const { data, error } = await supabaseCommunity.rpc('guest_apply_submit' as never, {
      p_opening_id: d.openingId, p_name: d.name.trim(), p_phone: d.phone, p_message: d.message.trim(), p_answers: d.answers,
    } as never)
    if (error) return { outcome: 'error', title: null }
    const row = (Array.isArray(data) ? data[0] : data) as { outcome?: string; opening_title?: string | null } | undefined
    const outcome = row?.outcome as GuestOutcome | undefined
    if (outcome && KNOWN.includes(outcome)) return { outcome, title: row?.opening_title ?? null }
    return { outcome: 'error', title: null }
  } catch {
    return { outcome: 'error', title: null }
  }
}

export interface GuestCopy { heading: string; body: string; button: string }

/** What step 2 says. `not_member` is the real case; anything else is just "sign in to send". */
export function guestCopy(outcome: GuestOutcome, roleTitle: string): GuestCopy {
  if (outcome === 'not_member') {
    return {
      heading: 'you are not part of AquaTerra yet.',
      body: `Sign in with Google to sign up. Your application for ${roleTitle} is saved here. HR confirms you as a member first, then it goes to the team and they reach out to you.`,
      button: 'Sign up with Google →',
    }
  }
  return {
    heading: 'one more step.',
    body: `Continue with Google to send your application for ${roleTitle}. It is saved here while you sign in. If you are new, HR confirms you first, then the team reaches out.`,
    button: 'Continue with Google →',
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
export async function continueWithGoogle(opts: { draft: GuestDraft; returnTo: string }): Promise<{ error?: string }> {
  stashGuestApply(opts.draft)
  try { sessionStorage.setItem('aq_oauth_from', opts.returnTo) } catch { /* falls back to '/' */ }
  const { error } = await supabaseCommunity.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback',
    },
  })
  return error ? { error: error.message || 'Could not reach Google. Try again.' } : {}
}
