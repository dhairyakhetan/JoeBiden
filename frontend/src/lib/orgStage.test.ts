import { describe, expect, it } from 'vitest'
import { buildStage, countTeams, insideChips, resolvePath, searchStage } from './orgStage'
import type { DepartmentTreeTeam } from '../services/teamService'
import type { ChartRoster } from './chartRoster'

const team = (uuid: string, name: string, count: number, subs: { uuid: string; slug: string; name: string; memberCount: number }[] = [], parentUuid?: string) =>
  ({ uuid, name, memberCount: count, subTeams: subs, parentUuid, description: '', category: 'content', createdAt: '' }) as unknown as DepartmentTreeTeam

const p = (uuid: string, name: string) => ({ uuid, name })

const tree = [
  team('mkt', 'Marketing', 0),
  team('soc', 'Social Media', 5, [{ uuid: 'reels', slug: 'reels', name: 'Reels Team', memberCount: 2 }], 'mkt'),
  team('mag', 'Digital Magazine', 3, [], 'mkt'),
  team('wel', 'Welfare Team', 9, [{ uuid: 'drives', slug: 'drives', name: 'Drives', memberCount: 2 }]),
]
const roster: ChartRoster = {
  byTeam: { wel: [p('w3', 'Test Member Wren')], soc: [p('s3', 'Test Member Sol')], mag: [p('m1', 'Test Member Moss')] },
  bySub: { drives: [p('w1', 'Test Member Wade'), p('w2', 'Test Member Wynn')], reels: [p('s1', 'Test Member Sky'), p('s2', 'Test Member Sage')] },
}

describe('buildStage', () => {
  const stage = buildStage(tree, roster)

  it('makes a department inside another a kid of its parent, not a top-level card', () => {
    expect(stage.map(d => d.name)).toEqual(['Marketing', 'Welfare Team'])
    expect(stage[0].kids.map(k => k.name)).toEqual(['Social Media', 'Digital Magazine'])
  })

  it('sums a parent from its kids and unions their people', () => {
    expect(stage[0].count).toBe(8)
    expect(stage[0].people.map(x => x.uuid).sort()).toEqual(['m1', 's1', 's2', 's3'])
  })

  it('gives a department its sub-department people plus the people on none of them', () => {
    expect(stage[1].people.map(x => x.uuid).sort()).toEqual(['w1', 'w2', 'w3'])
  })

  it('still builds with no roster: counts remain, people are empty', () => {
    const bare = buildStage(tree, null)
    expect(bare[1].count).toBe(9)
    expect(bare[1].people).toEqual([])
    expect(bare[1].subs[0].count).toBe(2)
  })
})

describe('resolvePath', () => {
  const stage = buildStage(tree, roster)
  it('resolves a department, a kid and a sub-department', () => {
    expect(resolvePath(stage, { dept: 'wel' })?.dept.name).toBe('Welfare Team')
    expect(resolvePath(stage, { dept: 'mkt', kid: 'soc' })?.kid?.name).toBe('Social Media')
    expect(resolvePath(stage, { dept: 'mkt', kid: 'soc', sub: 'reels' })?.sub?.name).toBe('Reels Team')
  })
  it('returns null for no path or an unknown department', () => {
    expect(resolvePath(stage, null)).toBeNull()
    expect(resolvePath(stage, { dept: 'nope' })).toBeNull()
  })
})

describe('searchStage', () => {
  const stage = buildStage(tree, roster)
  it('needs two characters', () => {
    expect(searchStage(stage, 'r')).toEqual([])
  })
  it('finds teams and sub-departments, teams before people', () => {
    const hits = searchStage(stage, 'reels')
    expect(hits[0]).toMatchObject({ kind: 'sub', label: 'Reels Team', path: { dept: 'mkt', kid: 'soc', sub: 'reels' } })
  })
  it('finds a person at the lowest node they belong to', () => {
    const hit = searchStage(stage, 'wade')[0]
    expect(hit).toMatchObject({ kind: 'person', personUuid: 'w1', path: { dept: 'wel', sub: 'drives' } })
    const direct = searchStage(stage, 'wren')[0]
    expect(direct.path).toEqual({ dept: 'wel' })
    const kidDirect = searchStage(stage, 'sol')[0]
    expect(kidDirect.path).toEqual({ dept: 'mkt', kid: 'soc' })
  })
  it('lists a person once and caps the list', () => {
    expect(searchStage(stage, 'test member').length).toBeLessThanOrEqual(8)
    const all = searchStage(stage, 'test member', 50).filter(h => h.kind === 'person').map(h => h.personUuid)
    expect(new Set(all).size).toBe(all.length)
  })
})

describe('insideChips and countTeams', () => {
  const stage = buildStage(tree, roster)

  it('names every team inside a department, departments inside it first', () => {
    expect(insideChips(stage[0]).map(c => c.label)).toEqual(['Social Media', 'Digital Magazine', 'Reels Team'])
    expect(insideChips(stage[1]).map(c => c.label)).toEqual(['Drives'])
  })

  it('counts departments, the ones inside them and every sub-department', () => {
    // Marketing + Social Media + Digital Magazine + Reels Team, Welfare Team + Drives
    expect(countTeams(stage)).toBe(6)
  })
})

import { openingsFor, openingsByNode, groupOpeningsByDepartment, type OpeningRef } from './orgStage'

describe('open roles on the stage', () => {
  const mk = (uuid: string, name: string, teamId: number, subs: string[] = [], parentUuid?: string): any => ({
    uuid, name, teamId, parentUuid, description: '', category: 'content', createdAt: '', memberCount: 1,
    subTeams: subs.map(n => ({ uuid: 'sub-' + n, slug: n, name: n, memberCount: 1 })),
  })
  const tree = [mk('mkt', 'Marketing', 18, ['Reels Team']), mk('soc', 'Social Media', 9, [], 'mkt'), mk('wel', 'Welfare', 1)]
  const stage = buildStage(tree, null)
  const ops: OpeningRef[] = [
    { id: 'a', title: 'Editor', teamId: 9, teamName: 'Social Media' },
    { id: 'b', title: 'Reels lead', teamName: 'Reels Team' },
    { id: 'c', title: 'Coordinator', teamId: 1 },
    { id: 'd', title: 'Stray', teamId: 999, teamName: 'Welfare' },
  ]
  it('matches by team id when both sides have one, even if the name differs', () => {
    expect(openingsFor({ name: 'Anything', teamId: 1 }, ops).map(o => o.id)).toEqual(['c'])
  })
  it('does not match a different id just because the names agree', () => {
    expect(openingsFor({ name: 'Welfare', teamId: 1 }, ops).map(o => o.id)).toEqual(['c'])
  })
  it('matches a sub-department by the name the opening was written with', () => {
    expect(openingsFor({ name: 'reels team' }, ops).map(o => o.id)).toEqual(['b'])
  })
  it('rolls openings up from sub-departments and departments inside', () => {
    const m = openingsByNode(stage, ops)
    expect(m.get('mkt')!.map(o => o.id).sort()).toEqual(['a', 'b'])
    expect(m.get('soc')!.map(o => o.id)).toEqual(['a'])
    expect(m.get('sub-Reels Team')!.map(o => o.id)).toEqual(['b'])
    expect(m.get('wel')!.map(o => o.id)).toEqual(['c'])
  })
  it('counts an opening once even if it matches twice', () => {
    const m = openingsByNode(stage, [{ id: 'x', title: 'Dup', teamId: 9, teamName: 'Reels Team' }])
    expect(m.get('mkt')).toHaveLength(1)
  })
  it('is empty when nothing is open', () => expect(openingsByNode(stage, []).get('mkt')).toEqual([]))
})

describe('groupOpeningsByDepartment', () => {
  const mk = (uuid: string, name: string, teamId: number, subs: string[] = [], parentUuid?: string): any => ({
    uuid, name, teamId, parentUuid, description: '', category: 'content', createdAt: '', memberCount: 1,
    subTeams: subs.map(n => ({ uuid: 'sub-' + n, slug: n, name: n, memberCount: 1 })),
  })
  const stage = buildStage([mk('mkt', 'Marketing', 18, ['Reels Team']), mk('soc', 'Social Media', 9, [], 'mkt'), mk('wel', 'Welfare', 1)], null)
  const ops: OpeningRef[] = [
    { id: 'a', title: 'Editor', teamId: 9 }, { id: 'b', title: 'Reels lead', teamName: 'Reels Team' },
    { id: 'c', title: 'Coordinator', teamId: 1 }, { id: 'z', title: 'Floating', teamName: 'Nobody' },
  ]
  it('groups roles under their department, biggest group first', () => {
    const g = groupOpeningsByDepartment(stage, ops)
    expect(g.map(x => x.name)).toEqual(['Marketing', 'Welfare', 'across AquaTerra'])
    expect(g[0].items.map(o => o.id).sort()).toEqual(['a', 'b'])
  })
  it('lists every role exactly once', () => {
    const all = groupOpeningsByDepartment(stage, ops).flatMap(g => g.items.map(o => o.id))
    expect(all.sort()).toEqual(['a', 'b', 'c', 'z'])
  })
  it('puts unclaimed roles in a last group instead of hiding them', () => {
    const g = groupOpeningsByDepartment(stage, ops)
    expect(g[g.length - 1].items.map(o => o.id)).toEqual(['z'])
  })
  it('is empty with no openings', () => expect(groupOpeningsByDepartment(stage, [])).toEqual([]))
})
