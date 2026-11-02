import { describe, it, expect } from 'vitest'
import { normalizeAction, isCronAction, actionSpellings, ilikeTerm, distinctActions, dayStartIso, dayEndIso } from './activityLogQuery'

describe('activityLogQuery', () => {
  it('normalises both spellings to one', () => {
    expect(normalizeAction('TEAM_MEMBER_ADDED')).toBe('team_member_added')
    expect(distinctActions(['TEAM_MEMBER_ADDED', 'team_member_added'])).toEqual(['team_member_added'])
  })
  it('detects cron rows in either case', () => {
    expect(isCronAction('cron_publish_scheduled')).toBe(true)
    expect(isCronAction('CRON_X')).toBe(true)
    expect(isCronAction('post_approved')).toBe(false)
  })
  it('matches both stored spellings', () => {
    expect(actionSpellings('Team_Member_Added')).toEqual(['team_member_added', 'TEAM_MEMBER_ADDED'])
  })
  it('escapes ilike wildcards and or() breakers', () => {
    expect(ilikeTerm('a%b_c,(d)')).toBe('a\\%b\\_c  d')
  })
  it('builds day bounds', () => {
    expect(dayStartIso('nope')).toBeNull()
    const s = dayStartIso('2026-11-01')!, e = dayEndIso('2026-11-01')!
    expect(new Date(e).getTime() - new Date(s).getTime()).toBeGreaterThanOrEqual(23 * 3600e3)
  })
})
