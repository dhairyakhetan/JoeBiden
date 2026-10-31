/**
 * Turning whatever a camera or a volunteer produced into a ticket token.
 *
 * Kept out of the scanner component so it can be unit-tested without a DOM, a
 * camera or zxing. It is the one piece of gate logic where being wrong means
 * either turning away a paying team or admitting a forwarded screenshot.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Accepts the full URL the QR encodes, a bare token, or either with stray
 * whitespace. Anything else returns null rather than guessing: a partial match
 * that resolves to the wrong registration is worse than a rescan.
 */
export function tokenFromScan(text: string): string | null {
  const t = (text || '').trim()
  if (!t) return null
  const m = t.match(/\/t\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i)
  if (m) return m[1].toLowerCase()
  if (UUID.test(t)) return t.toLowerCase()
  return null
}

/** Looks like one of ours: TT26-CRK-004. Case-insensitive, trimmed. */
export function isRefCode(text: string): boolean {
  return /^TT26-[A-Z]{3}-\d{3,}$/i.test((text || '').trim())
}

/**
 * The gate runs on IST whatever the phone's timezone is set to. A volunteer
 * whose device is on the wrong zone must not check people into yesterday.
 */
export function istDayString(now: Date = new Date()): string {
  // getTime() is an absolute epoch value, already independent of the host
  // timezone, so shifting by IST's fixed +5:30 and then reading the result as
  // UTC gives the IST calendar day. Adding getTimezoneOffset() here would
  // double-count the host's own offset, which is the bug this replaced.
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10)
}
