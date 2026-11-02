/** Split a bulk update's requested ids by whether the database confirmed them. */
export function splitBulkResult(requested: number[], confirmed: Array<{ id: number }> | null | undefined) {
  const done = new Set((confirmed ?? []).map(r => r.id))
  return {
    ok: requested.filter(id => done.has(id)),
    failed: requested.filter(id => !done.has(id)),
  }
}

/**
 * Put back ONLY the given rows' previous status, leaving every other row as it
 * is now (a concurrent change to another row must survive a revert).
 */
export function revertRows<T extends { id: number; status: string }>(
  current: T[], previous: Map<number, string>, ids: number[],
): T[] {
  const set = new Set(ids)
  return current.map(r => (set.has(r.id) && previous.has(r.id) ? { ...r, status: previous.get(r.id)! } : r))
}
