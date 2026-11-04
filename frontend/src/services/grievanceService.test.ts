import { describe, it, expect, vi } from 'vitest'
import { daysSince, isOverdue, grievanceProblem, RESPONSE_DAYS, CATEGORIES, CATEGORY_LABEL } from './grievanceService'

vi.mock('../lib/supabaseCommunity', () => ({ supabaseCommunity: {} }))
vi.mock('../lib/authCache', () => ({ getCachedMemberId: async () => 1 }))
vi.mock('../lib/errorTracking', () => ({ logSupabaseError: (_w: string, e: unknown) => e }))

const NOW = Date.parse('2026-11-10T12:00:00Z')
const ago = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

describe('overdue marker', () => {
  it('counts whole days', () => { expect(daysSince(ago(3), NOW)).toBe(3) })
  it('is overdue at the promise and not before, for new and in review only', () => {
    expect(isOverdue({ status: 'new', createdAt: ago(RESPONSE_DAYS) }, NOW)).toBe(true)
    expect(isOverdue({ status: 'in_review', createdAt: ago(RESPONSE_DAYS + 3) }, NOW)).toBe(true)
    expect(isOverdue({ status: 'new', createdAt: ago(RESPONSE_DAYS - 1) }, NOW)).toBe(false)
    expect(isOverdue({ status: 'resolved', createdAt: ago(30) }, NOW)).toBe(false)
    expect(isOverdue({ status: 'closed', createdAt: ago(30) }, NOW)).toBe(false)
  })
})

describe('the form', () => {
  it('offers the six categories from the brief', () => {
    expect(CATEGORIES).toEqual(['harassment', 'discrimination', 'safety', 'misconduct_member', 'misconduct_leader', 'other'])
    for (const c of CATEGORIES) expect(CATEGORY_LABEL[c].length).toBeGreaterThan(0)
  })
  it('wants a category and enough text, and not too much', () => {
    expect(grievanceProblem({ category: 'safety', description: 'too short' })).toMatch(/more/)
    expect(grievanceProblem({ category: 'safety', description: 'x'.repeat(4001) })).toMatch(/shorten/)
    expect(grievanceProblem({ category: 'nonsense' as never, description: 'long enough text here' })).toMatch(/pick/)
    expect(grievanceProblem({ category: 'safety', description: 'long enough text here' })).toBeNull()
  })
  it('refuses a date in the future', () => {
    expect(grievanceProblem({ category: 'other', description: 'long enough text here', incidentDate: '2999-01-01' })).toMatch(/future/)
    expect(grievanceProblem({ category: 'other', description: 'long enough text here', incidentDate: '2020-01-01' })).toBeNull()
  })
})
