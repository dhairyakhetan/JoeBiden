import { describe, expect, it } from 'vitest'
import { capitalise, countDepartments, departmentsPhrase, numberWord, yearsPhrase, yearsSince } from './orgFigures'

describe('yearsSince', () => {
  it('counts completed years and rolls over on the anniversary', () => {
    expect(yearsSince('2021-06-11', new Date('2026-06-10T12:00:00Z'))).toBe(4)
    expect(yearsSince('2021-06-11', new Date('2026-06-11T00:00:00Z'))).toBe(5)
    expect(yearsSince('2021-06-11', new Date('2026-10-18T00:00:00Z'))).toBe(5)
    expect(yearsSince('2021-06-11', new Date('2027-06-11T00:00:00Z'))).toBe(6)
  })
  it('is never negative', () => {
    expect(yearsSince('2030-01-01', new Date('2026-10-18T00:00:00Z'))).toBe(0)
  })
})

describe('words', () => {
  it('spells small numbers and leaves large ones as digits', () => {
    expect(numberWord(7)).toBe('seven')
    expect(numberWord(13)).toBe('13')
    expect(capitalise('five')).toBe('Five')
  })
  it('pluralises', () => {
    expect(yearsPhrase(new Date('2022-06-11T00:00:00Z'))).toBe('one year')
    expect(yearsPhrase(new Date('2026-10-18T00:00:00Z'))).toBe('five years')
    expect(departmentsPhrase(7)).toBe('seven departments')
    expect(departmentsPhrase(1)).toBe('one department')
  })
})

describe('countDepartments', () => {
  it('counts only top-level departments', () => {
    expect(countDepartments([{}, { parentUuid: 'a' }, {}, { parentUuid: 'b' }])).toBe(2)
  })
})
