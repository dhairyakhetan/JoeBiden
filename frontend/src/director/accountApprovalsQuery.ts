// Pure helpers for the Approvals desk's server-side search and class filter.
// Kept out of the component so the rules are unit-testable.

import { sanitizeFilterTerm } from '../lib/pgrestEscape'

export type ApprovalsView = 'pending' | 'contacted' | 'all' | 'rejected' | 'duplicates'
export type ContactedFilter = 'any' | 'not_contacted' | 'contacted'

/** How long typing must pause before the search goes to the server. */
export const SEARCH_DEBOUNCE_MS = 250

/** Which contacted split a queue tab maps to. */
export function contactedFilterForView(view: ApprovalsView): ContactedFilter {
  if (view === 'pending') return 'not_contacted'
  if (view === 'contacted') return 'contacted'
  return 'any'
}

/** The text that actually goes to the server: sanitized for PostgREST, trimmed, lowercased. */
export function normalizeSearch(raw: string): string {
  return sanitizeFilterTerm(raw).toLowerCase()
}

/** PostgREST `or` filter for name or email, or null when there is nothing to search for. */
export function buildSearchOrFilter(raw: string): string | null {
  const term = normalizeSearch(raw)
  if (!term) return null
  return `full_name.ilike.%${term}%,email.ilike.%${term}%`
}

/** 'all' (the pill) and blank mean no grade filter. */
export function normalizeGrade(grade: string | null | undefined): string | null {
  if (!grade || grade === 'all') return null
  return grade
}

export interface ApprovalsFilters {
  search: string
  classGrade: string | null
}

export function buildFilters(search: string, grade: string | null | undefined): ApprovalsFilters {
  return { search: normalizeSearch(search), classGrade: normalizeGrade(grade) }
}

/** Two filter sets that would produce the same query. Guards against refetching when only whitespace changed. */
export function sameFilters(a: ApprovalsFilters, b: ApprovalsFilters): boolean {
  return a.search === b.search && a.classGrade === b.classGrade
}

export function isFiltered(f: ApprovalsFilters): boolean {
  return f.search !== '' || f.classGrade !== null
}

/** Merge a loaded grade list with a freshly fetched one: never shrinks, sorted, blanks dropped. */
export function mergeGrades(known: readonly string[], incoming: readonly (string | null | undefined)[]): string[] {
  const set = new Set(known)
  for (const g of incoming) if (g && g.trim()) set.add(g)
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export interface ContactedCounts { notContacted: number; contacted: number }

/** Header number for a queue tab, from the server counts for the active filter. Null until counts arrive. */
export function countForView(view: ApprovalsView, counts: ContactedCounts | null): number | null {
  if (!counts) return null
  if (view === 'pending') return counts.notContacted
  if (view === 'contacted') return counts.contacted
  if (view === 'all') return counts.notContacted + counts.contacted
  return null
}

/** Fallback header number: the loaded row count, used only while the server count is unavailable. */
export function headerCount(view: ApprovalsView, counts: ContactedCounts | null, loadedRows: number): number {
  return countForView(view, counts) ?? loadedRows
}
