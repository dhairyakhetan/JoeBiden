import { describe, it, expect } from 'vitest'
import {
  contactedFilterForView, normalizeSearch, buildSearchOrFilter, normalizeGrade, buildFilters,
  sameFilters, isFiltered, mergeGrades, countForView, headerCount, SEARCH_DEBOUNCE_MS,
} from './accountApprovalsQuery'
import { createRequestTokens } from './memberDirectoryRules'

describe('contactedFilterForView', () => {
  it('maps the tabs', () => {
    expect(contactedFilterForView('pending')).toBe('not_contacted')
    expect(contactedFilterForView('contacted')).toBe('contacted')
    expect(contactedFilterForView('all')).toBe('any')
  })
})

describe('search building', () => {
  it('lowercases and trims', () => expect(normalizeSearch('  Ana ')).toBe('ana'))
  it('strips PostgREST grammar characters', () => {
    expect(buildSearchOrFilter('a,b(c)%')).toBe('full_name.ilike.%abc%,email.ilike.%abc%')
  })
  it('returns null for empty or all-stripped input', () => {
    expect(buildSearchOrFilter('   ')).toBeNull()
    expect(buildSearchOrFilter('%_,')).toBeNull()
  })
  it('matches name and email', () => {
    expect(buildSearchOrFilter('Priya')).toBe('full_name.ilike.%priya%,email.ilike.%priya%')
  })
})

describe('grade and filters', () => {
  it('treats all and blank as no filter', () => {
    expect(normalizeGrade('all')).toBeNull()
    expect(normalizeGrade('')).toBeNull()
    expect(normalizeGrade(undefined)).toBeNull()
    expect(normalizeGrade('Class 9')).toBe('Class 9')
  })
  it('sameFilters ignores whitespace-only edits', () => {
    expect(sameFilters(buildFilters('ana ', 'all'), buildFilters(' ANA', null))).toBe(true)
    expect(sameFilters(buildFilters('ana', 'all'), buildFilters('ana', '9'))).toBe(false)
  })
  it('isFiltered', () => {
    expect(isFiltered(buildFilters('', 'all'))).toBe(false)
    expect(isFiltered(buildFilters('x', 'all'))).toBe(true)
    expect(isFiltered(buildFilters('', '9'))).toBe(true)
  })
})

describe('mergeGrades', () => {
  it('never shrinks, dedupes, sorts naturally', () => {
    expect(mergeGrades(['10', '9'], ['9', null, '', '11', '8'])).toEqual(['8', '9', '10', '11'])
  })
})

describe('counts', () => {
  const c = { notContacted: 5, contacted: 3 }
  it('per view', () => {
    expect(countForView('pending', c)).toBe(5)
    expect(countForView('contacted', c)).toBe(3)
    expect(countForView('all', c)).toBe(8)
    expect(countForView('rejected', c)).toBeNull()
  })
  it('falls back to loaded rows', () => {
    expect(headerCount('pending', null, 7)).toBe(7)
    expect(headerCount('pending', c, 7)).toBe(5)
  })
})

describe('stale response guard', () => {
  it('only the latest token may write', () => {
    const t = createRequestTokens()
    const a = t.next(), b = t.next()
    expect(t.isLatest(a)).toBe(false)
    expect(t.isLatest(b)).toBe(true)
  })
  it('debounce is about a quarter second', () => expect(SEARCH_DEBOUNCE_MS).toBe(250))
})
