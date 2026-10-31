import { describe, it, expect } from 'vitest'
import {
  computeCompleteness,
  nudgeVisibility,
  dismissNudge,
  retireNudge,
  daysUntilReturn,
  maskPhone,
  normalizePhone,
  isPlausiblePhone,
  EMPTY_NUDGE_STATE,
  NUDGE_SNOOZE_MS,
  NUDGE_MAX_DISMISSALS,
  type NudgeProfileFacts,
} from './profileNudge'

const NOW = Date.parse('2026-09-07T12:00:00.000Z')

const EVERYTHING: NudgeProfileFacts = {
  avatarUrl: 'https://example.test/a.jpg',
  classGrade: 'XI',
  phone: '9876543210',
  schoolId: 4,
  bio: 'i pick up litter.',
}

describe('computeCompleteness', () => {
  it('reports 0/5 for a brand-new member (the 99% case)', () => {
    const p = computeCompleteness({})
    expect(p.doneCount).toBe(0)
    expect(p.total).toBe(5)
    expect(p.percent).toBe(0)
    expect(p.remaining).toBe(5)
    expect(p.isComplete).toBe(false)
    expect(p.isOneLeft).toBe(false)
  })

  it('puts the avatar first — the cheapest, highest-impact item', () => {
    const p = computeCompleteness({})
    expect(p.items[0].key).toBe('avatar')
    expect(p.next?.key).toBe('avatar')
  })

  it('keeps the five rows in their documented order', () => {
    expect(computeCompleteness({}).items.map(i => i.key)).toEqual([
      'avatar', 'class', 'phone', 'school', 'bio',
    ])
  })

  it('does not include instagram or any sixth field', () => {
    expect(computeCompleteness({}).items).toHaveLength(5)
  })

  it('moves the bar visibly on a single tap (20% per item)', () => {
    expect(computeCompleteness({ avatarUrl: 'x' }).percent).toBe(20)
    expect(computeCompleteness({ avatarUrl: 'x', classGrade: 'X' }).percent).toBe(40)
  })

  it('reports 100% and isComplete when everything is filled', () => {
    const p = computeCompleteness(EVERYTHING)
    expect(p.percent).toBe(100)
    expect(p.isComplete).toBe(true)
    expect(p.next).toBeNull()
    expect(p.remaining).toBe(0)
  })

  it('flags the one-item-left state', () => {
    const p = computeCompleteness({ ...EVERYTHING, bio: '' })
    expect(p.isOneLeft).toBe(true)
    expect(p.next?.key).toBe('bio')
  })

  it('treats whitespace-only strings as missing', () => {
    expect(computeCompleteness({ ...EVERYTHING, bio: '   ' }).isComplete).toBe(false)
    expect(computeCompleteness({ ...EVERYTHING, avatarUrl: '' }).items[0].done).toBe(false)
  })

  it('counts schoolId 0 as present but null/undefined as missing', () => {
    expect(computeCompleteness({ schoolId: 0 }).items[3].done).toBe(true)
    expect(computeCompleteness({ schoolId: null }).items[3].done).toBe(false)
    expect(computeCompleteness({}).items[3].done).toBe(false)
  })

  // ── The safeguarding rule ────────────────────────────────────────────────
  describe('phone: own OR guardian, weighted equally', () => {
    const base = { ...EVERYTHING, phone: null, guardianPhone: null }

    it('is not done when neither number is present', () => {
      expect(computeCompleteness(base).items[2].done).toBe(false)
    })

    it('is done on the member’s own number alone', () => {
      expect(computeCompleteness({ ...base, phone: '9876543210' }).items[2].done).toBe(true)
    })

    it('is EQUALLY done on a guardian’s number alone', () => {
      expect(computeCompleteness({ ...base, guardianPhone: '9876543210' }).items[2].done).toBe(true)
    })

    it('reaches 100% with only a guardian number — a member never has to give their own', () => {
      expect(computeCompleteness({ ...base, guardianPhone: '9876543210' }).isComplete).toBe(true)
    })

    it('degrades safely when the guardian column does not exist yet (undefined)', () => {
      const p = computeCompleteness({ ...base, guardianPhone: undefined, phone: '9876543210' })
      expect(p.items[2].done).toBe(true)
      expect(p.isComplete).toBe(true)
    })
  })
})

describe('nudgeVisibility', () => {
  it('shows for a member who has never dismissed it', () => {
    expect(nudgeVisibility(EMPTY_NUDGE_STATE, NOW)).toBe('show')
  })

  it('is snoozed while the deadline is in the future', () => {
    const state = { dismissCount: 1, snoozedUntil: new Date(NOW + 1000).toISOString() }
    expect(nudgeVisibility(state, NOW)).toBe('snoozed')
  })

  it('shows again once the snooze expires', () => {
    const state = { dismissCount: 1, snoozedUntil: new Date(NOW - 1000).toISOString() }
    expect(nudgeVisibility(state, NOW)).toBe('show')
  })

  it('is retired after two dismissals', () => {
    expect(nudgeVisibility({ dismissCount: 2, snoozedUntil: null }, NOW)).toBe('retired')
    expect(nudgeVisibility({ dismissCount: 9, snoozedUntil: null }, NOW)).toBe('retired')
  })

  it('stays retired even if a stale future snooze is also recorded', () => {
    const state = { dismissCount: 2, snoozedUntil: new Date(NOW + NUDGE_SNOOZE_MS).toISOString() }
    expect(nudgeVisibility(state, NOW)).toBe('retired')
  })

  it('does not hide forever on an unparseable timestamp', () => {
    expect(nudgeVisibility({ dismissCount: 1, snoozedUntil: 'not-a-date' }, NOW)).toBe('show')
  })
})

describe('dismissNudge — snooze, return once, then never again', () => {
  it('first dismissal snoozes ~2 weeks', () => {
    const s1 = dismissNudge(EMPTY_NUDGE_STATE, NOW)
    expect(s1.dismissCount).toBe(1)
    expect(Date.parse(s1.snoozedUntil!)).toBe(NOW + NUDGE_SNOOZE_MS)
    expect(nudgeVisibility(s1, NOW)).toBe('snoozed')
  })

  it('the card returns exactly once, 14 days later', () => {
    const s1 = dismissNudge(EMPTY_NUDGE_STATE, NOW)
    expect(nudgeVisibility(s1, NOW + NUDGE_SNOOZE_MS - 1)).toBe('snoozed')
    expect(nudgeVisibility(s1, NOW + NUDGE_SNOOZE_MS + 1)).toBe('show')
  })

  it('the second dismissal retires it permanently', () => {
    const s1 = dismissNudge(EMPTY_NUDGE_STATE, NOW)
    const later = NOW + NUDGE_SNOOZE_MS + 1
    const s2 = dismissNudge(s1, later)
    expect(s2.dismissCount).toBe(NUDGE_MAX_DISMISSALS)
    expect(s2.snoozedUntil).toBeNull()
    expect(nudgeVisibility(s2, later)).toBe('retired')
    // ...and a year on, still gone.
    expect(nudgeVisibility(s2, later + 365 * 86400000)).toBe('retired')
  })

  it('never climbs past the cap or resurrects a retired card', () => {
    const s3 = dismissNudge(dismissNudge(dismissNudge(EMPTY_NUDGE_STATE, NOW), NOW), NOW)
    expect(s3.dismissCount).toBe(NUDGE_MAX_DISMISSALS)
    expect(nudgeVisibility(s3, NOW + 10 * 365 * 86400000)).toBe('retired')
  })
})

describe('retireNudge', () => {
  it('retires the card for good after completion', () => {
    const s = retireNudge()
    expect(nudgeVisibility(s, NOW)).toBe('retired')
    expect(s.snoozedUntil).toBeNull()
  })
})

describe('daysUntilReturn', () => {
  it('is 14 right after the first dismissal', () => {
    expect(daysUntilReturn(dismissNudge(EMPTY_NUDGE_STATE, NOW), NOW)).toBe(14)
  })
  it('is 0 when nothing is snoozed or the date is junk', () => {
    expect(daysUntilReturn(EMPTY_NUDGE_STATE, NOW)).toBe(0)
    expect(daysUntilReturn({ dismissCount: 1, snoozedUntil: 'nope' }, NOW)).toBe(0)
  })
  it('never goes negative once the snooze has lapsed', () => {
    const s = { dismissCount: 1, snoozedUntil: new Date(NOW - 86400000).toISOString() }
    expect(daysUntilReturn(s, NOW)).toBe(0)
  })
})

describe('maskPhone', () => {
  it('reveals only the last four digits', () => {
    expect(maskPhone('9876543210')).toBe('••••••3210')
  })
  it('ignores formatting when counting', () => {
    // 12 digits -> 8 hidden + last 4.
    expect(maskPhone('+91 98765 43210')).toBe('••••••••3210')
  })
  it('never leaks a short or empty value', () => {
    expect(maskPhone('')).toBe('••••')
    expect(maskPhone(null)).toBe('••••')
    expect(maskPhone(undefined)).toBe('••••')
    expect(maskPhone('12')).toBe('••••')
  })
  it('always hides at least two positions', () => {
    expect(maskPhone('123456')).toBe('••3456')
    expect(maskPhone('12345')).toBe('••2345')
  })
})

describe('normalizePhone / isPlausiblePhone', () => {
  it('strips spaces, dashes and brackets', () => {
    expect(normalizePhone(' 98765-43210 ')).toBe('9876543210')
    expect(normalizePhone('(033) 2222 3333')).toBe('03322223333')
  })
  it('keeps a leading +', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('+919876543210')
  })
  it('accepts a 10-digit Indian mobile and a +91 form', () => {
    expect(isPlausiblePhone('9876543210')).toBe(true)
    expect(isPlausiblePhone('+91 98765 43210')).toBe(true)
  })
  it('rejects obvious non-numbers', () => {
    expect(isPlausiblePhone('')).toBe(false)
    expect(isPlausiblePhone('123')).toBe(false)
    expect(isPlausiblePhone('1234567890123456')).toBe(false)
  })
})
