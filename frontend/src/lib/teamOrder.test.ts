import { describe, it, expect } from 'vitest'
import { orderTeamsAsTree } from './teamOrder'

const t = (uuid: string, name: string, parentUuid?: string) => ({ uuid, name, parentUuid })

describe('orderTeamsAsTree', () => {
  it('puts each team directly under its department, both sorted by name', () => {
    const rows = orderTeamsAsTree([t('s', 'Social Media', 'm'), t('w', 'Welfare Team'), t('m', 'Marketing'), t('d', 'Digital Magazine', 'm')])
    expect(rows.map(r => r.team.name)).toEqual(['Marketing', 'Digital Magazine', 'Social Media', 'Welfare Team'])
    expect(rows.map(r => r.insideName)).toEqual([undefined, 'Marketing', 'Marketing', undefined])
  })

  it('keeps a team whose department is filtered out, as top level', () => {
    const rows = orderTeamsAsTree([t('s', 'Social Media', 'm'), t('w', 'Welfare Team')])
    expect(rows.map(r => r.team.name)).toEqual(['Social Media', 'Welfare Team'])
    expect(rows[0].insideName).toBeUndefined()
  })

  it('returns nothing for nothing', () => {
    expect(orderTeamsAsTree([])).toEqual([])
  })
})
