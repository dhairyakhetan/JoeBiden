import { describe, expect, it } from 'vitest'
import { DEPARTMENTS, PUBLIC_DEPARTMENTS, departmentCountFromTree } from './departments'
import { ORG_FACTS } from './orgFacts'

describe('public department list', () => {
  it('matches the active department count the copy is built from', () => {
    expect(PUBLIC_DEPARTMENTS.length).toBe(ORG_FACTS.departmentsActive)
  })

  it('lists the eight departments by their owner-approved names (3 Nov 2026)', () => {
    expect(PUBLIC_DEPARTMENTS.map(d => d.name).sort()).toEqual(
      ['AQ.Ventures', 'Collabs', 'Crftd', 'Events Team', 'Human Resources', 'Marketing', 'ShikshAQ', 'Welfare Projects'])
  })

  it('has no separate Social Media or Digital Magazine department: they live under Marketing', () => {
    expect(DEPARTMENTS.some(d => /social media|digital magazine/i.test(d.name))).toBe(false)
    expect(DEPARTMENTS.some(d => d.name === 'Marketing')).toBe(true)
  })

  it('shows Collabs as a card only: public, no live team, never hidden', () => {
    const collabs = DEPARTMENTS.find(d => d.name === 'Collabs')
    expect(collabs?.cardOnly).toBe(true)
    expect(collabs?.hidden).toBeFalsy()
    expect(PUBLIC_DEPARTMENTS.some(d => d.name === 'Collabs')).toBe(true)
  })

  it('still lets hidden departments stay out of public lists', () => {
    expect(PUBLIC_DEPARTMENTS.every(d => !d.hidden)).toBe(true)
  })
})

describe('departmentCountFromTree', () => {
  it('adds the card-only departments to the live top-level teams, matching the card list', () => {
    const tree = Array.from({ length: PUBLIC_DEPARTMENTS.length - 1 }, () => ({})).concat([{ parentUuid: 'x' }])
    expect(departmentCountFromTree(tree)).toBe(PUBLIC_DEPARTMENTS.length)
  })
  it('an empty tree is a failed read, not zero departments plus Collabs', () => {
    expect(departmentCountFromTree([])).toBe(0)
  })
})
