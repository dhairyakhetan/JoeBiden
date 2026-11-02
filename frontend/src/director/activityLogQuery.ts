/**
 * Pure helpers for the Activity Log's server-side filtering. Live data holds
 * the same action in two spellings (TEAM_MEMBER_ADDED and team_member_added),
 * so everything is normalised to lower case for display and filtering, and the
 * query matches both spellings.
 */

/** Canonical (lower case) form of an action name. */
export function normalizeAction(action: string): string {
  return (action || '').trim().toLowerCase()
}

/** True for the scheduler's own heartbeat rows (cron_publish_scheduled etc). */
export function isCronAction(action: string): boolean {
  return normalizeAction(action).startsWith('cron_')
}

/** Both stored spellings of a canonical action, for an `.in()` filter. */
export function actionSpellings(action: string): string[] {
  const lower = normalizeAction(action)
  return Array.from(new Set([lower, lower.toUpperCase()]))
}

/** Escape a user term for use inside a PostgREST `ilike` pattern within `.or()`. */
export function ilikeTerm(term: string): string {
  // strip characters that would break the or() grammar, escape LIKE wildcards
  return term.replace(/[,()"\\]/g, ' ').replace(/[%_]/g, m => `\\${m}`).trim()
}

/** Distinct canonical actions, sorted, from a list of stored actions. */
export function distinctActions(stored: string[], known: string[] = []): string[] {
  const seen = new Set<string>()
  for (const a of [...known, ...stored]) {
    const n = normalizeAction(a)
    if (n) seen.add(n)
  }
  return Array.from(seen).sort()
}

/** Start-of-day ISO for a yyyy-mm-dd input, or null. */
export function dayStartIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const d = new Date(`${day}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Exclusive end (next midnight) ISO for a yyyy-mm-dd input, or null. */
export function dayEndIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const d = new Date(`${day}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}
