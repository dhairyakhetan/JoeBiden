import { describe, expect, it } from 'vitest'
import {
  groupDuplicatePhones, matchesDuplicateSearch, toDuplicatePhoneRow, type DuplicatePhoneRow,
} from './duplicatePhones'

const row = (over: Partial<DuplicatePhoneRow>): DuplicatePhoneRow => ({
  phoneKey: '9830012345', memberId: 1, fullName: 'Asha Rao', email: 'asha@example.com',
  phone: '+91 98300 12345', status: 'active', classGrade: '10', createdAt: '2026-01-01T00:00:00', ...over,
})

describe('toDuplicatePhoneRow', () => {
  it('maps snake_case RPC rows and tolerates nulls', () => {
    const r = toDuplicatePhoneRow({
      phone_key: '9830012345', member_id: '7', full_name: null, email: 'a@b.co',
      phone: '9830012345', status: 'pending_approval', class_grade: null, created_at: '2026-02-02T00:00:00',
    })
    expect(r.memberId).toBe(7)
    expect(r.fullName).toBe('')
    expect(r.classGrade).toBeNull()
  })
})

describe('groupDuplicatePhones', () => {
  it('groups by key, keeps order, and drops singletons', () => {
    const groups = groupDuplicatePhones([
      row({ memberId: 1 }),
      row({ memberId: 2, phoneKey: '1111111111' }),
      row({ memberId: 3 }),
      row({ memberId: 4, phoneKey: '1111111111' }),
      row({ memberId: 5, phoneKey: '2222222222' }),
    ])
    expect(groups.map(g => g.phoneKey)).toEqual(['9830012345', '1111111111'])
    expect(groups[0].members.map(m => m.memberId)).toEqual([1, 3])
  })

  it('returns nothing for no rows', () => {
    expect(groupDuplicatePhones([])).toEqual([])
  })
})

describe('matchesDuplicateSearch', () => {
  const group = { phoneKey: '9830012345', members: [row({}), row({ memberId: 2, fullName: 'Ravi K', email: 'ravi@x.in' })] }
  it('matches name, email and phone digits, ignoring case and formatting', () => {
    expect(matchesDuplicateSearch(group, 'RAVI')).toBe(true)
    expect(matchesDuplicateSearch(group, 'asha@example')).toBe(true)
    expect(matchesDuplicateSearch(group, '98300 12345')).toBe(true)
    expect(matchesDuplicateSearch(group, 'nobody')).toBe(false)
  })
  it('treats an empty term as a match', () => {
    expect(matchesDuplicateSearch(group, '  ')).toBe(true)
  })
})
