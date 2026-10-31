import { describe, it, expect } from 'vitest'
import { isRateLimited, retryAfterSeconds, rateLimitMessage, retryLabel } from './rateLimit'

describe('isRateLimited', () => {
  it('recognises an AuthApiError-shaped 429 (auth-js carries .status)', () => {
    expect(isRateLimited({ name: 'AuthApiError', status: 429, message: 'Request rate limit reached' })).toBe(true)
  })

  it('recognises the documented auth rate-limit codes', () => {
    expect(isRateLimited({ code: 'over_request_rate_limit' })).toBe(true)
    expect(isRateLimited({ code: 'over_email_send_rate_limit' })).toBe(true)
    expect(isRateLimited({ code: 'over_sms_send_rate_limit' })).toBe(true)
  })

  it('recognises the gateway body postgrest-js passes through as a bare message', () => {
    // A non-JSON 429 body becomes `error = { message: body }` with the status
    // dropped by the time a service re-throws it - the message is all we get.
    expect(isRateLimited({ message: 'Too Many Requests' })).toBe(true)
  })

  it('does NOT fire on an ordinary PostgrestError (the honest fall-through)', () => {
    expect(isRateLimited({ message: 'permission denied for table posts', code: '42501', details: '', hint: '' })).toBe(false)
    expect(isRateLimited({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' })).toBe(false)
  })

  it('does not confuse row limits or other 4xx with a rate limit', () => {
    expect(isRateLimited({ message: 'Requested range not satisfiable', status: 416 })).toBe(false)
    expect(isRateLimited({ message: 'too many rows returned' })).toBe(false)
    expect(isRateLimited({ message: 'limit must be a number' })).toBe(false)
  })

  it('is safe on non-objects', () => {
    expect(isRateLimited(null)).toBe(false)
    expect(isRateLimited(undefined)).toBe(false)
    expect(isRateLimited('429')).toBe(false)
  })
})

describe('retryAfterSeconds', () => {
  it('parses the wait Auth writes into its message', () => {
    expect(retryAfterSeconds({ message: 'For security purposes, you can only request this after 27 seconds.' })).toBe(27)
    expect(retryAfterSeconds({ message: 'try again in 5 seconds' })).toBe(5)
  })

  it('honours an explicit numeric retryAfter', () => {
    expect(retryAfterSeconds({ retryAfter: 12.2 })).toBe(13)
  })

  it('returns null when nothing states a time - the UI must not invent one', () => {
    expect(retryAfterSeconds({ message: 'Too Many Requests' })).toBeNull()
    expect(retryAfterSeconds({ retryAfter: 0 })).toBeNull()
    expect(retryAfterSeconds(null)).toBeNull()
  })
})

describe('copy', () => {
  it('names the wait when known and stays vague when not', () => {
    expect(rateLimitMessage(1)).toContain('1 second.')
    expect(rateLimitMessage(20)).toContain('20 seconds.')
    expect(rateLimitMessage(null)).toContain('give it a minute')
  })

  it('is lowercase and has no exclamation mark or emoji (ACCEPTANCE §F)', () => {
    for (const s of [rateLimitMessage(null), rateLimitMessage(9), retryLabel(null), retryLabel(3)]) {
      expect(s).toBe(s.toLowerCase())
      expect(s).not.toMatch(/[!]/)
      expect(s).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u)
    }
  })

  it('labels a running countdown, and a finished one as a plain retry', () => {
    expect(retryLabel(8)).toBe('try again in 8s')
    expect(retryLabel(0)).toBe('try again')
    expect(retryLabel(null)).toBe('try again')
  })
})
