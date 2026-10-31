import { describe, it, expect } from 'vitest'
import {
  REFERRAL_NOTE_MAX,
  REFERRAL_STATE_COPY,
  REFERRAL_STEPS,
  REFERRAL_TIERS,
  REFERRAL_TTL_DAYS,
  ROLE_REFERRAL_TTL_DAYS,
  badgeTier,
  buildReferralLink,
  daysLeft,
  deriveReferralState,
  isExpired,
  isSelfReferral,
  nextTierGap,
  normalizeNote,
  referralExpiry,
  referrerHealth,
  validateNote,
  whatsappShareUrl,
} from './referrals'

/**
 * These tests exist to stop the four constraints in referrals.ts from being
 * quietly undone. Three of them are shaped by live RLS policies rather than by
 * taste: a member cannot accept their own referral, clicks are not public, and
 * the referrer is never named to the person being referred.
 *
 * Written on the pattern of lib/authCopy.test.ts.
 */

const DAY = 86_400_000
const T0 = Date.parse('2026-09-04T00:00:00Z')

describe('referralExpiry', () => {
  it('gives an open invite 30 days and a role invite 7', () => {
    expect(Date.parse(referralExpiry(false, T0)) - T0).toBe(REFERRAL_TTL_DAYS * DAY)
    expect(Date.parse(referralExpiry(true, T0)) - T0).toBe(ROLE_REFERRAL_TTL_DAYS * DAY)
  })

  it('returns an ISO string, which is what the column takes', () => {
    expect(referralExpiry(false, T0)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('isExpired and daysLeft', () => {
  it('treats a null expiry as never expiring', () => {
    expect(isExpired(null, T0)).toBe(false)
    expect(daysLeft(null, T0)).toBeNull()
  })

  it('expires exactly at the boundary, not after it', () => {
    const at = new Date(T0).toISOString()
    expect(isExpired(at, T0)).toBe(true)
    expect(isExpired(new Date(T0 + 1).toISOString(), T0)).toBe(false)
  })

  it('never returns a negative day count', () => {
    expect(daysLeft(new Date(T0 - 9 * DAY).toISOString(), T0)).toBe(0)
  })

  it('survives a malformed timestamp rather than throwing', () => {
    expect(isExpired('not a date', T0)).toBe(false)
    expect(daysLeft('not a date', T0)).toBeNull()
  })
})

describe('deriveReferralState', () => {
  const at = (offsetDays: number) => new Date(T0 + offsetDays * DAY).toISOString()

  it('is sent when nothing has happened', () => {
    expect(deriveReferralState({ status: 'open', expiresAt: at(10), clicks: 0 }, T0)).toBe('sent')
  })

  it('is opened once a click exists, from referral_clicks and not from a write', () => {
    // The member cannot move status to `clicked`: UPDATE is is_director().
    // The state has to be derivable from a click row alone.
    expect(deriveReferralState({ status: 'open', expiresAt: at(10), clicks: 1 }, T0)).toBe('opened')
  })

  it('lets a leader-written applied or accepted win over a click', () => {
    expect(deriveReferralState({ status: 'applied', expiresAt: at(10), clicks: 4 }, T0)).toBe('applied')
    expect(deriveReferralState({ status: 'accepted', expiresAt: at(10), clicks: 4 }, T0)).toBe('accepted')
  })

  it('reads an expired link as expired even when it was opened', () => {
    // "opened" would invite the referrer to keep waiting on a dead link.
    expect(deriveReferralState({ status: 'open', expiresAt: at(-1), clicks: 3 }, T0)).toBe('expired')
  })

  it('keeps a credited referral credited past its expiry', () => {
    expect(deriveReferralState({ status: 'accepted', expiresAt: at(-30), clicks: 1 }, T0)).toBe('accepted')
  })
})

// ── constraint 2: a member cannot move their own referral to accepted ──────
describe('the accepted step is never presented as a member action', () => {
  it('has four ordered steps, ending at the one only an HoD can set', () => {
    expect(REFERRAL_STEPS).toEqual(['sent', 'opened', 'applied', 'accepted'])
  })

  it('says out loud that accepted is a leader write', () => {
    expect(REFERRAL_STATE_COPY.accepted.hint.toLowerCase()).toContain('hod')
  })

  it('gives every state a label and a hint, so no step renders bare', () => {
    for (const s of Object.values(REFERRAL_STATE_COPY)) {
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.hint.length).toBeGreaterThan(0)
    }
  })
})

// ── constraint 1: the link never carries a name ────────────────────────────
describe('buildReferralLink', () => {
  it('points at /login with ref, which is what lib/authCopy.ts already reads', () => {
    const url = buildReferralLink({ origin: 'https://www.ngoaquaterra.com', referralId: 'abc-123' })
    expect(url).toBe('https://www.ngoaquaterra.com/login?ref=abc-123')
    expect(new URLSearchParams(new URL(url).search).get('ref')).toBe('abc-123')
  })

  it('adds role only when a role is given, so authCopy picks the right rule', () => {
    const url = buildReferralLink({ origin: 'https://x.test', referralId: 'r1', openingUuid: 'o-9' })
    const q = new URLSearchParams(new URL(url).search)
    expect(q.get('role')).toBe('o-9')
    expect(new URL(buildReferralLink({ origin: 'https://x.test', referralId: 'r1' })).search)
      .not.toContain('role')
  })

  it('tolerates a trailing slash on the origin', () => {
    expect(buildReferralLink({ origin: 'https://x.test/', referralId: 'r1' }))
      .toBe('https://x.test/login?ref=r1')
  })

  it('carries no member id, no name and no note', () => {
    const url = buildReferralLink({ origin: 'https://x.test', referralId: 'r1', openingUuid: 'o-9' })
    const q = new URLSearchParams(new URL(url).search)
    expect([...q.keys()].sort()).toEqual(['ref', 'role'])
  })
})

describe('whatsappShareUrl', () => {
  it('does not repeat the referrer note, which they already wrote once', () => {
    expect(whatsappShareUrl('https://x.test/login?ref=r1')).not.toContain('note')
  })

  it('contains no em dash, per the project copy rule', () => {
    expect(decodeURIComponent(whatsappShareUrl('https://x.test'))).not.toContain('—')
  })
})

describe('the note', () => {
  it('is optional: empty and whitespace both normalize to null', () => {
    expect(normalizeNote('')).toBeNull()
    expect(normalizeNote('   \n ')).toBeNull()
    expect(validateNote('')).toBeNull()
  })

  it('rejects only over the cap, and says by how much', () => {
    expect(validateNote('x'.repeat(REFERRAL_NOTE_MAX))).toBeNull()
    const err = validateNote('x'.repeat(REFERRAL_NOTE_MAX + 3))
    expect(err).toContain('3')
  })

  it('has no em dash in its error copy', () => {
    expect(validateNote('x'.repeat(REFERRAL_NOTE_MAX + 1))).not.toContain('—')
  })
})

// ── the figures rule ───────────────────────────────────────────────────────
describe('badgeTier', () => {
  it('returns null, never 0, when the figure could not be sourced', () => {
    // members.referred_by has no SELECT grant for `authenticated`, so this is
    // a real state. A zero would be a claim.
    expect(badgeTier(null)).toBeNull()
    expect(nextTierGap(null)).toBeNull()
  })

  it('climbs one tier per threshold', () => {
    expect(badgeTier(0)).toBe(0)
    expect(badgeTier(1)).toBe(1)
    expect(badgeTier(4)).toBe(1)
    expect(badgeTier(5)).toBe(2)
    expect(badgeTier(10)).toBe(3)
    expect(badgeTier(99)).toBe(REFERRAL_TIERS.length)
  })

  it('reports the gap to the next tier, and nothing at the top', () => {
    expect(nextTierGap(0)).toBe(1)
    expect(nextTierGap(3)).toBe(2)
    expect(nextTierGap(10)).toBeNull()
  })
})

describe('referrerHealth', () => {
  it('flags at five rejections', () => {
    expect(referrerHealth({ invited: 6, approved: 1, rejected: 5 }).flagged).toBe(true)
    expect(referrerHealth({ invited: 6, approved: 2, rejected: 4 }).flagged).toBe(false)
  })

  it('flags a hit rate under a quarter, but only over eight invites', () => {
    expect(referrerHealth({ invited: 8, approved: 1, rejected: 0 }).flagged).toBe(true)
    expect(referrerHealth({ invited: 7, approved: 0, rejected: 0 }).flagged).toBe(false)
    expect(referrerHealth({ invited: 8, approved: 2, rejected: 0 }).flagged).toBe(false)
  })

  it('always states a reason when it flags, never a bare boolean', () => {
    const v = referrerHealth({ invited: 20, approved: 1, rejected: 9 })
    expect(v.flagged).toBe(true)
    expect(v.reason).toBeTruthy()
    expect(v.reason).not.toContain('—')
  })

  it('gives a clean referrer no reason at all', () => {
    expect(referrerHealth({ invited: 4, approved: 3, rejected: 1 })).toEqual({ flagged: false, reason: null })
  })
})

describe('isSelfReferral', () => {
  it('catches a member inviting themselves', () => {
    expect(isSelfReferral(7, 7)).toBe(true)
    expect(isSelfReferral(7, 8)).toBe(false)
  })

  it('is false when either side is unknown, rather than guessing', () => {
    expect(isSelfReferral(null, 7)).toBe(false)
    expect(isSelfReferral(7, null)).toBe(false)
  })
})
