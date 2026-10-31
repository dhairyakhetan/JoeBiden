import { describe, it, expect } from 'vitest'
import { latestPeriodPerTeam } from './momPicks'
import type { MemberOfMonthPick } from './memberOfMonthService'

const pick = (id: number, teamId: number, teamName: string, period: string, memberName: string): MemberOfMonthPick => ({
  id, period, teamId, teamUuid: `t${teamId}`, teamName, teamCategory: 'content',
  memberId: id, memberUuid: `m${id}`, memberName, memberAvatarUrl: null, citation: null,
  pickedById: null, pickedByName: null, photoUrl: null, photoUploadedAt: null, createdAt: '2026-10-01',
})

describe('latestPeriodPerTeam', () => {
  it('keeps EVERY honoree from a team\'s newest month (owner decision 2026-10-03)', () => {
    const rows = [
      pick(1, 9, 'Social Media', '2026-10-01', 'Zoya'),
      pick(2, 9, 'Social Media', '2026-10-01', 'Asha'),
      pick(3, 9, 'Social Media', '2026-09-01', 'Old Winner'),
    ]
    expect(latestPeriodPerTeam(rows).map(r => r.memberName)).toEqual(['Asha', 'Zoya'])
  })

  it('works per team: a team with no pick this month falls back to its own latest month', () => {
    const rows = [
      pick(1, 9, 'Social Media', '2026-10-01', 'Asha'),
      pick(2, 8, 'Welfare Team', '2026-09-01', 'Ravi'),
      pick(3, 8, 'Welfare Team', '2026-09-01', 'Meera'),
      pick(4, 8, 'Welfare Team', '2026-08-01', 'Older'),
    ]
    expect(latestPeriodPerTeam(rows).map(r => `${r.teamName}:${r.memberName}`)).toEqual([
      'Social Media:Asha', 'Welfare Team:Meera', 'Welfare Team:Ravi',
    ])
  })

  it('is order-independent and handles an empty list', () => {
    expect(latestPeriodPerTeam([])).toEqual([])
    const a = pick(1, 1, 'A', '2026-09-01', 'X')
    const b = pick(2, 1, 'A', '2026-10-01', 'Y')
    expect(latestPeriodPerTeam([a, b])).toEqual(latestPeriodPerTeam([b, a]))
  })
})
