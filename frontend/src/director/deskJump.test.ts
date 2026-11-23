import { describe, it, expect } from 'vitest'
import { matchDesks, DESK_ALIASES } from './deskJump'
import { DESK_BY_KEY, NAV_GROUPS, visibleDeskGroups } from './deskAccess'

const keys = (q: string, groups = NAV_GROUPS) => matchDesks(groups, q).map(h => h.desk.key)

describe('matchDesks', () => {
  it('empty query opens nothing', () => {
    expect(keys('')).toEqual([])
    expect(keys('   ')).toEqual([])
  })
  it('the reporter example: "Enquiri" finds Enquiries first', () => {
    expect(keys('Enquiri')[0]).toBe('enquiries')
  })
  it('prefix of the label beats a word inside another label', () => {
    expect(keys('m')[0]).toBe('members')
  })
  it('finds a desk by a word people use for it', () => {
    expect(keys('collab')).toContain('enquiries')
    expect(keys('applicants')).toContain('approvals')
  })
  it('finds by group name', () => {
    expect(keys('intake')).toEqual(expect.arrayContaining(['hiring', 'enquiries']))
  })
  it('never offers a desk the viewer cannot see', () => {
    const leader = visibleDeskGroups({ role: 'hod', canApproveMembers: false, can: () => true })
    expect(keys('approvals', leader)).not.toContain('approvals')
    expect(keys('activity', leader)).not.toContain('activity_log')
  })
  it('caps the list', () => {
    expect(matchDesks(NAV_GROUPS, 'e', 3)).toHaveLength(3)
  })
  it('every alias key is a real desk', () => {
    for (const k of Object.keys(DESK_ALIASES)) expect(DESK_BY_KEY[k as keyof typeof DESK_BY_KEY]).toBeDefined()
  })
})
