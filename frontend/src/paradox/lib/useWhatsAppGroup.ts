// @ts-nocheck
/**
 * The Paradox WhatsApp group invite used to live here (a hard-coded fallback plus an admin-set
 * value in paradox_site_settings). The link carried attendees' payment confirmations and was public,
 * so it was removed on 3 Nov 2026 (P-09). Paradox has ended. Every call site renders its WhatsApp
 * button only when this returns a link, so returning '' hides them all.
 *
 * To bring a group link back, share it only after sign-in or ticket purchase, not on a public page.
 */
export const WHATSAPP_GROUP_FALLBACK = ''

export function useWhatsAppGroup(): string {
  return ''
}
