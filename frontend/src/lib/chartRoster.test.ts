import { describe, expect, it } from 'vitest'
import { groupChartRoster } from './chartRoster'

const m = (uuid: string, name: string) => ({ uuid, full_name: name, avatar_url: null })

const rows = [
  {
    uuid: 'team-a',
    sub_teams: [
      { sub_team_id: 1, uuid: 'sub-1', is_active: true },
      { sub_team_id: 2, uuid: 'sub-2', is_active: true },
      { sub_team_id: 3, uuid: 'sub-hidden', is_active: false },
    ],
    team_members: [
      { is_active: true, members: m('p3', 'Test Member C'), team_member_sub_teams: [{ sub_team_id: 1 }] },
      { is_active: true, members: m('p1', 'Test Member A'), team_member_sub_teams: [{ sub_team_id: 1 }, { sub_team_id: 2 }] },
      { is_active: true, members: m('p2', 'Test Member B'), team_member_sub_teams: [] },
      { is_active: true, members: m('p4', 'Test Member D'), team_member_sub_teams: [{ sub_team_id: 3 }] },
      { is_active: false, members: m('p5', 'Test Member E'), team_member_sub_teams: [] },
      { is_active: true, members: null, team_member_sub_teams: [] },
    ],
  },
  { uuid: 'team-b', sub_teams: [], team_members: [{ is_active: true, members: m('p6', 'Test Member F') }] },
]

describe('groupChartRoster', () => {
  const r = groupChartRoster(rows)

  it('hangs a person from the sub-department they are assigned to, sorted by name', () => {
    expect(r.bySub['sub-1'].map(p => p.uuid)).toEqual(['p1', 'p3'])
    expect(r.bySub['sub-2'].map(p => p.uuid)).toEqual(['p1'])
  })

  it('puts a person on none of the active sub-departments under the department', () => {
    expect(r.byTeam['team-a'].map(p => p.uuid)).toEqual(['p2', 'p4'])
  })

  it('treats a hidden sub-department as no sub-department, so nobody vanishes', () => {
    expect(r.bySub['sub-hidden']).toBeUndefined()
    expect(r.byTeam['team-a'].some(p => p.uuid === 'p4')).toBe(true)
  })

  it('skips removed members and rows with no member', () => {
    const all = [...Object.values(r.byTeam), ...Object.values(r.bySub)].flat().map(p => p.uuid)
    expect(all).not.toContain('p5')
  })

  it('handles a department with no sub-departments and a missing link list', () => {
    expect(r.byTeam['team-b'].map(p => p.uuid)).toEqual(['p6'])
  })

  it('returns empty maps for no rows', () => {
    expect(groupChartRoster([])).toEqual({ byTeam: {}, bySub: {} })
  })
})
