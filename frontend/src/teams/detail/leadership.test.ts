import { describe, it, expect } from 'vitest'
import { leadersFirst, isTeamLeader } from './leadership'

const m = (name: string, orgRole: string) => ({ name, orgRole })

describe('leadersFirst', () => {
  it('puts HoDs and directors ahead of members, keeping everyone else in order', () => {
    const out = leadersFirst([m('a', 'member'), m('b', 'hod'), m('c', 'member'), m('d', 'director'), m('e', 'member')])
    expect(out.map(x => x.name)).toEqual(['b', 'd', 'a', 'c', 'e'])
  })

  it('leaves a leaderless team untouched and survives missing roles', () => {
    const input = [m('a', 'member'), { name: 'b', orgRole: null }, { name: 'c' }]
    expect(leadersFirst(input).map(x => x.name)).toEqual(['a', 'b', 'c'])
    expect(leadersFirst([])).toEqual([])
  })

  it('does not mutate its input', () => {
    const input = [m('a', 'member'), m('b', 'hod')]
    leadersFirst(input)
    expect(input.map(x => x.name)).toEqual(['a', 'b'])
  })

  it('agrees with the role model: member is not a leader, hod and director are', () => {
    expect(isTeamLeader({ orgRole: 'member' })).toBe(false)
    expect(isTeamLeader({ orgRole: 'hod' })).toBe(true)
    expect(isTeamLeader({ orgRole: 'director' })).toBe(true)
  })
})
