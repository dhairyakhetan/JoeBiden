/**
 * Sanitize a user-supplied search term before interpolating it into a
 * PostgREST filter string (`.or(...)` / `.ilike(...)`).
 *
 * `,` and `()` are PostgREST .or() grammar (delimiter + grouping) - an
 * unescaped one produces a malformed filter that 400s the whole request.
 * `%` and `_` are LIKE wildcards, and `\` is the LIKE escape character.
 * Stripping them keeps behavior identical for normal input while making
 * filter-injection via search boxes impossible.
 */
export function sanitizeFilterTerm(term: string): string {
  return term.replace(/[\\%,()_]/g, '').trim()
}
