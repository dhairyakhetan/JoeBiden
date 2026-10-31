import { describe, expect, it } from 'vitest'
import { DEPARTMENTS, PUBLIC_DEPARTMENTS } from './departments'
import { ORG_FACTS } from './orgFacts'

describe('public department list', () => {
  it('matches the active department count the copy is built from', () => {
    expect(PUBLIC_DEPARTMENTS.length).toBe(ORG_FACTS.departmentsActive)
  })

  it('leaves hidden departments out of public lists but keeps them in the full list', () => {
    const hidden = DEPARTMENTS.filter(d => d.hidden).map(d => d.name)
    expect(hidden).toContain('Collabs')
    expect(PUBLIC_DEPARTMENTS.some(d => d.name === 'Collabs')).toBe(false)
    expect(DEPARTMENTS.some(d => d.name === 'Collabs')).toBe(true)
  })
})
