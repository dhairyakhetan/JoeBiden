// Keyset ("after this row") pagination for the decision queues.
//
// The queues shrink while a director works: approving or rejecting a row
// removes it server-side. Offset paging (`page * 20`) then skips whatever slid
// up into the gap, so "load more" silently lost rows. A cursor on the queue's
// own order (created_at ascending, id as tiebreak) is immune to that.

export interface KeysetCursor {
  /** The row's created_at exactly as the server returned it (never re-parsed, so microseconds survive). */
  createdAt: string
  id: number
}

/** PostgREST `or` filter selecting rows strictly after the cursor in (created, id) ascending order. */
export function keysetOrFilter(createdCol: string, idCol: string, cursor: KeysetCursor): string {
  const ts = `"${cursor.createdAt.replace(/"/g, '')}"`
  return `${createdCol}.gt.${ts},and(${createdCol}.eq.${ts},${idCol}.gt.${cursor.id})`
}

/** The cursor for the last row of an already-ordered list, or null when the list is empty. */
export function cursorFromLast<T>(
  rows: readonly T[],
  getCreatedAt: (row: T) => string,
  getId: (row: T) => number,
): KeysetCursor | null {
  const last = rows[rows.length - 1]
  return last ? { createdAt: getCreatedAt(last), id: getId(last) } : null
}

/** Fetching limit+1 rows tells us whether another page exists without a count. */
export function trimPage<T>(rows: readonly T[], limit: number): { rows: T[]; hasMore: boolean } {
  return { rows: rows.slice(0, limit), hasMore: rows.length > limit }
}

/** Append a page, dropping rows already held (a row removed locally but not yet decided server-side can come back). */
export function appendUnique<T>(prev: readonly T[], next: readonly T[], getId: (row: T) => number): T[] {
  const seen = new Set(prev.map(getId))
  return [...prev, ...next.filter(r => !seen.has(getId(r)))]
}
