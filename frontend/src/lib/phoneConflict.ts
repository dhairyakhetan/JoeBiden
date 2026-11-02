import { supabaseCommunity } from './supabaseCommunity'
import { normalizePhone } from './profileNudge'

/**
 * One phone number = one account (owner decision, 2026-11-01).
 *
 * The database half is `scripts/members_phone_one_account_2026_11_01.sql`
 * (APPLIED): a `members_phone_unique` trigger that raises 23505
 * `phone_already_registered` when a phone is SET OR CHANGED to one another live
 * account has, and the `check_phone_available` RPC that tells a signed-in
 * caller whether a number is taken and, if so, the MASKED registered email.
 *
 * This module is the app half. The trigger is the real guard. The RPC is a
 * courtesy so the member hears about it on the phone step instead of at submit,
 * and it FAILS OPEN: if the RPC errors or is missing, the write goes ahead and
 * the trigger decides.
 */

/** AQ's public WhatsApp, the same number Companion and QuickLinksPage use. */
export const HR_WHATSAPP_DISPLAY = '97486 79979'
export const HR_WHATSAPP_URL = 'https://wa.me/919748679979'

export const PHONE_CONFLICT_HEADLINE =
  'this phone number is already registered with AquaTerra through a different email ID.'
export const PHONE_CONFLICT_ACTION = 'please log in through the registered email ID.'
export const PHONE_CONFLICT_HELP =
  `or, if you're unable to access the registered email id, contact the HR Team (${HR_WHATSAPP_DISPLAY}) to get your registered email id updated.`

/** True for the trigger's `phone_already_registered` 23505. */
export function isPhoneConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { code?: unknown; message?: unknown }
  return e.code === '23505' && typeof e.message === 'string' && e.message.includes('phone_already_registered')
}

/** The registered email, masked server-side, as a sentence. Empty when unknown. */
export function registeredEmailLine(maskedEmail: string | null | undefined): string {
  return maskedEmail ? `registered email: ${maskedEmail}` : ''
}

/** The whole message as plain text, for toasts and inline errors that take a string. */
export function phoneConflictText(maskedEmail: string | null | undefined): string {
  return [
    PHONE_CONFLICT_HEADLINE,
    registeredEmailLine(maskedEmail),
    PHONE_CONFLICT_ACTION,
    PHONE_CONFLICT_HELP,
  ].filter(Boolean).join(' ')
}

/**
 * Thrown by services when the trigger refuses a phone. Carries the masked
 * email so the component can show the same panel registration shows. Its
 * `message` is the full plain-text version, so any caller that only prints
 * `err.message` still says the right thing.
 */
export class PhoneConflictError extends Error {
  readonly maskedEmail: string | null
  constructor(maskedEmail: string | null) {
    super(phoneConflictText(maskedEmail))
    this.name = 'PhoneConflictError'
    this.maskedEmail = maskedEmail
  }
}

export interface PhoneAvailability {
  taken: boolean
  maskedEmail: string | null
}

/**
 * Ask the server whether `raw` belongs to another live account. Never throws:
 * any failure (RPC missing, network, no session) reads as "not taken" and the
 * trigger stays the backstop.
 */
export async function checkPhoneAvailable(raw: string): Promise<PhoneAvailability> {
  try {
    const { data, error } = await supabaseCommunity.rpc(
      'check_phone_available' as never,
      { p_phone: normalizePhone(raw) } as never,
    )
    if (error) return { taken: false, maskedEmail: null }
    const row = (Array.isArray(data) ? data[0] : data) as
      | { taken?: unknown; masked_email?: unknown }
      | null
      | undefined
    if (!row || row.taken !== true) return { taken: false, maskedEmail: null }
    return {
      taken: true,
      maskedEmail: typeof row.masked_email === 'string' && row.masked_email ? row.masked_email : null,
    }
  } catch {
    return { taken: false, maskedEmail: null }
  }
}

/**
 * Turn a trigger refusal into a PhoneConflictError with the masked email
 * looked up. Returns null when `err` is not a phone conflict, so a service can
 * write `throw (await asPhoneConflict(error, phone)) ?? logSupabaseError(...)`.
 */
export async function asPhoneConflict(err: unknown, rawPhone: string): Promise<PhoneConflictError | null> {
  if (!isPhoneConflict(err)) return null
  const { maskedEmail } = await checkPhoneAvailable(rawPhone)
  return new PhoneConflictError(maskedEmail)
}
