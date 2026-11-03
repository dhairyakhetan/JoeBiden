/**
 * Small, honest abuse guards for the two public forms (contact, collaboration), copied from the pattern on /live/contact
 * (handoff C-15, 3 Nov 2026): a honeypot field people never see, and a short cooldown so a double-click or a script in a
 * loop does not send twenty. The real limits are in the database (trigger limit_public_submission): this only makes the
 * well-behaved path quiet.
 */
export const FORM_COOLDOWN_MS = 30_000

/** A field that is off-screen and not focusable: a person never fills it, a bot filling every input does. */
export const TRAP_STYLE = { position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' } as const

const slot = (form: string) => `aq_form_sent_${form}`

/** True when this browser sent this form less than FORM_COOLDOWN_MS ago. Never throws (private mode: never blocks). */
export function sentRecently(form: string, now: number = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(slot(form)) || '0')
    return at > 0 && now - at < FORM_COOLDOWN_MS
  } catch { return false }
}

export function markSent(form: string, now: number = Date.now()): void {
  try { localStorage.setItem(slot(form), String(now)) } catch { /* convenience only */ }
}
