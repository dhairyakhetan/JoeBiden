// changelog/11-system-states.md §11.1 state 7 — "rate limited: plain sentence
// + when to retry", and §11's own Unresolved item 3: "does Supabase surface a
// 429 the UI can read?"
//
// THE EMPIRICAL ANSWER, because it shapes everything below and is not what you
// would hope:
//
//   * PostgREST (every `services/*.ts` read and write). `PostgrestBuilder`
//     returns `{ data, error, status, statusText }` and puts the HTTP status
//     in a SIBLING field of `error` - `PostgrestError` itself carries only
//     `message` / `details` / `hint` / `code` (see
//     node_modules/@supabase/postgrest-js/src/PostgrestError.ts). Every service
//     in this codebase does `if (error) throw error`, so by the time a
//     component's catch block sees it, **the 429 is already gone**. Changing
//     that would mean changing service return shapes, which the redesign
//     forbids outright. On a non-JSON gateway body (Cloudflare/envoy sit in
//     front of the project - confirmed live by `server: cloudflare` +
//     `x-envoy-attempt-count` response headers) postgrest-js falls back to
//     `error = { message: body }`, so the ONLY surviving trace of a REST 429 is
//     the words in that message.
//   * Auth (`@supabase/auth-js`). `AuthApiError` DOES carry `status` and
//     `code` (see auth-js/src/lib/errors.ts), and the platform documents
//     `over_request_rate_limit` / `over_email_send_rate_limit` /
//     `over_sms_send_rate_limit` as real error codes. So on the auth path a
//     429 is genuinely readable.
//   * `Retry-After`. Not reachable in either case: supabase-js never surfaces
//     response headers to callers. The only "when to retry" that ever reaches
//     us is the sentence Auth sometimes writes into the message ("you can only
//     request this after 27 seconds"), which `retryAfterSeconds` parses. When
//     there is none, the UI must say "in a minute", not invent a number.
//
// So this module is deliberately the SMALLEST honest thing: a predicate that
// recognises a rate limit where one is actually recognisable, and falls
// through to the ordinary error state everywhere else. It never guesses.

/** Auth error codes the platform documents as rate limits. */
const RATE_LIMIT_CODES = new Set([
  'over_request_rate_limit',
  'over_email_send_rate_limit',
  'over_sms_send_rate_limit',
])

// Deliberately narrow. "limit" alone would match a PostgREST range error and
// "too many" alone would match "too many rows"; both phrases have to be the
// rate-limit ones. A false positive here tells a member to wait for a problem
// that waiting will not fix, which is worse than the generic error state.
const RATE_LIMIT_TEXT = /(too many requests|rate limit(ed)?|429 too many)/i

/**
 * True when this error is recognisably a rate limit. Anything unrecognised is
 * false, and its caller falls through to the ordinary "couldn't load" state -
 * see the header comment for why that is the honest default rather than a
 * failing.
 */
export function isRateLimited(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { status?: unknown; code?: unknown; message?: unknown }
  if (e.status === 429) return true
  if (typeof e.code === 'string' && RATE_LIMIT_CODES.has(e.code)) return true
  if (typeof e.message === 'string' && RATE_LIMIT_TEXT.test(e.message)) return true
  return false
}

/**
 * The wait, in whole seconds, when the error actually states one - Auth writes
 * it into the message ("For security purposes, you can only request this after
 * 27 seconds"), and a `retryAfter` field is honoured if some future caller has
 * one. `null` means "we genuinely don't know", and the copy must then avoid
 * naming a time.
 *
 * The `Retry-After` HEADER is not readable through supabase-js at all, so this
 * is not a header parser and should not be mistaken for one.
 */
export function retryAfterSeconds(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null
  const e = err as { retryAfter?: unknown; message?: unknown }
  if (typeof e.retryAfter === 'number' && Number.isFinite(e.retryAfter) && e.retryAfter > 0) {
    return Math.ceil(e.retryAfter)
  }
  if (typeof e.message === 'string') {
    const m = e.message.match(/after (\d+) second/i) || e.message.match(/in (\d+) second/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (Number.isFinite(n) && n > 0) return n
    }
  }
  return null
}

/**
 * The sentence. docs/BRAND_VOICE.md: lowercase-leaning, plain, specific, no
 * exclamation marks, no emoji. It says the condition is temporary because that
 * is the entire difference between this and the generic error state - a member
 * who thinks the app is broken leaves; a member who knows to wait waits.
 */
export function rateLimitMessage(seconds: number | null): string {
  if (seconds && seconds > 0) {
    return `too many requests, too fast. try again in ${seconds} second${seconds === 1 ? '' : 's'}.`
  }
  return 'too many requests, too fast. give it a minute and try again.'
}

/**
 * Countdown label for a retry control while the wait is still running.
 * `null` seconds (or a finished countdown) means the button is just "try
 * again" - never a fake timer.
 */
export function retryLabel(remaining: number | null): string {
  if (remaining && remaining > 0) return `try again in ${remaining}s`
  return 'try again'
}
