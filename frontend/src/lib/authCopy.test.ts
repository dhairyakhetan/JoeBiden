import { describe, it, expect } from 'vitest'
import { pickAuthCopy, readAuthFacts, type AuthFacts } from './authCopy'
import { ORG_FACTS, displayCount } from './orgFacts'

/**
 * These tests exist to stop the four constraints in authCopy.ts from being
 * quietly undone. Three of them are not style preferences: naming a member who
 * has not consented, and rendering a figure that exists nowhere in the
 * codebase, are the two failures this project has actually shipped before.
 */

const base = (over: Partial<AuthFacts> = {}): AuthFacts => ({
  visitedBefore: false,
  visitCount: 0,
  oauthFrom: null,
  referrerHost: null,
  ref: null,
  team: null,
  role: null,
  utmSource: null,
  status: null,
  pendingDays: null,
  rejectedDays: null,
  qIndex: null,
  breakEndsOn: null,
  failure: null,
  ...over,
})

describe('pickAuthCopy', () => {
  it('falls back to the cold opener when nothing is known', () => {
    expect(pickAuthCopy(base()).rule).toBe('cold')
  })

  it('always returns all three strings, whatever the facts', () => {
    const c = pickAuthCopy(base())
    expect(c.headline.length).toBeGreaterThan(0)
    expect(c.subline.length).toBeGreaterThan(0)
    expect(c.primaryLabel.length).toBeGreaterThan(0)
  })

  it('is first-match-wins: a specific rule beats a general one', () => {
    // Suspended AND a returning visitor AND from Instagram. Status is highest.
    const c = pickAuthCopy(base({
      status: 'suspended', visitedBefore: true, utmSource: 'instagram',
    }))
    expect(c.rule).toBe('status.suspended')
  })

  it('is deterministic: the same facts give the same copy', () => {
    const f = base({ utmSource: 'linkedin' })
    expect(pickAuthCopy(f)).toEqual(pickAuthCopy(f))
  })

  it('opens the re-apply window only after 30 days', () => {
    expect(pickAuthCopy(base({ status: 'rejected', rejectedDays: 29 })).rule)
      .toBe('status.rejected.inside_30')
    expect(pickAuthCopy(base({ status: 'rejected', rejectedDays: 30 })).rule)
      .toBe('status.rejected.window_open')
  })

  it('swaps the primary label where the rule says so', () => {
    expect(pickAuthCopy(base({ status: 'suspended' })).primaryLabel).toBe('talk to us →')
    expect(pickAuthCopy(base()).primaryLabel).toBe('Sign up / sign in with Google')
  })

  // ── constraint 4 ────────────────────────────────────────────────────────
  it('a failure replaces the subline ONLY and leaves the headline standing', () => {
    const without = pickAuthCopy(base({ utmSource: 'instagram' }))
    const with_ = pickAuthCopy(base({ utmSource: 'instagram', failure: 'network' }))
    expect(with_.headline).toBe(without.headline)
    expect(with_.subline).not.toBe(without.subline)
    expect(with_.rule).toBe(without.rule)
  })

  // ── constraint 1 ────────────────────────────────────────────────────────
  it('never names a person in any rule', () => {
    // The canvas copy named three real members. If any of those names comes
    // back, someone has transcribed the canvas verbatim over this file.
    const banned = ['Aarushi', 'Anisha', 'Aviana']
    const facts: AuthFacts[] = [
      base({ ref: 'member_123' }), base({ team: 'projects' }), base({ role: 'hr' }),
      base({ status: 'pending_approval', pendingDays: 9 }),
    ]
    for (const f of facts) {
      const c = pickAuthCopy(f)
      for (const name of banned) {
        expect(c.headline).not.toContain(name)
        expect(c.subline).not.toContain(name)
      }
    }
  })

  // ── the figures rule ────────────────────────────────────────────────────
  it('renders no figure that is not canonical', () => {
    // 12,480 and 41 are the two placeholder figures github.md records as
    // existing nowhere in the codebase.
    const banned = ['12,480', '12480', '41 projects', '106']
    const facts: AuthFacts[] = [
      base({ referrerHost: 'google.com' }),
      base({ utmSource: 'linkedin' }),
      base({ team: 'projects' }),
    ]
    for (const f of facts) {
      const c = pickAuthCopy(f)
      for (const n of banned) {
        expect(`${c.headline} ${c.subline}`).not.toContain(n)
      }
    }
  })

  it('uses canonical figures where it does quote one', () => {
    expect(pickAuthCopy(base({ utmSource: 'linkedin' })).subline).toContain(displayCount(ORG_FACTS.drivesWrittenUp))
    expect(pickAuthCopy(base({ referrerHost: 'google.com' })).subline).toContain('3,500+')
  })

  // ── copy hygiene ────────────────────────────────────────────────────────
  it('contains no em dash anywhere, per the project rule', () => {
    const facts: AuthFacts[] = [
      base(), base({ visitedBefore: true }), base({ visitCount: 3 }),
      base({ status: 'pending_approval' }), base({ status: 'rejected', rejectedDays: 40 }),
      base({ status: 'suspended' }), base({ qIndex: 0 }), base({ qIndex: 1 }), base({ qIndex: 2 }),
      base({ ref: 'x' }), base({ team: 'x' }), base({ role: 'x' }),
      base({ utmSource: 'instagram' }), base({ utmSource: 'linkedin' }),
      base({ referrerHost: 'google.com' }), base({ referrerHost: 'somewhere.example' }),
      base({ failure: 'network' }), base({ failure: 'oauth' }), base({ failure: 'rate_limit' }),
    ]
    for (const f of facts) {
      const c = pickAuthCopy(f)
      expect(c.headline).not.toContain('—')
      expect(c.subline).not.toContain('—')
    }
  })

  it('formats a break date rather than printing a raw Date', () => {
    const d = new Date('2026-10-14T00:00:00Z')
    const past = pickAuthCopy(base({ breakEndsOn: new Date('2020-01-01T00:00:00Z') }))
    expect(past.rule).toBe('break.ended')
    const future = pickAuthCopy(base({ breakEndsOn: new Date(Date.now() + 864e5) }))
    expect(future.rule).toBe('break.active')
    expect(pickAuthCopy(base({ breakEndsOn: d })).headline).not.toContain('GMT')
  })
})

describe('readAuthFacts', () => {
  it('survives storage being unavailable and returns usable facts', () => {
    // jsdom has storage, but the point is the shape is always complete: a
    // missing fact must be null/false, never undefined, or a rule's `when`
    // would throw and be swallowed.
    const f = readAuthFacts()
    expect(f.visitedBefore).toBe(false)
    expect(f.status).toBeNull()
    expect(typeof f.visitCount).toBe('number')
  })

  it('accepts an override so the caller can add authenticated facts', () => {
    expect(readAuthFacts({ status: 'pending_approval' }).status).toBe('pending_approval')
  })

  it('caps the visit counter so it cannot become a behavioural profile', () => {
    try { localStorage.setItem('aq_login_visits', '99999') } catch { /* ignore */ }
    expect(readAuthFacts().visitCount).toBeLessThanOrEqual(9)
  })
})
