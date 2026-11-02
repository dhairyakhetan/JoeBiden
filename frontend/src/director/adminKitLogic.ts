/**
 * Pure logic behind adminKit's `useRowSelection` and `useUndoableAction`.
 * ────────────────────────────────────────────────────────────────────────────
 * Kept free of React, CSS and the toast provider so it can be unit tested under
 * vitest's node environment (adminKit.tsx imports CSS and the demo runtime).
 */

/* ── Row selection ──────────────────────────────────────────────────────── */

/**
 * Selection after the row list changed: keep every selected id that is still
 * present, drop the rest. Returns the SAME set when nothing was dropped so a
 * caller can skip a state update.
 *
 * This replaces "clear whenever the array identity changes", which also wiped
 * the selection on load-more (the old rows are all still there). Rows that
 * left the list (approved, rejected, filtered out) still fall out of the
 * selection, so a bulk action can never target an id the person cannot see.
 */
export function pruneSelection(selected: ReadonlySet<string>, ids: readonly string[]): ReadonlySet<string> {
  if (selected.size === 0) return selected
  const present = new Set(ids)
  let dropped = false
  const next = new Set<string>()
  for (const id of selected) {
    if (present.has(id)) next.add(id)
    else dropped = true
  }
  return dropped ? next : selected
}

/** A string that changes exactly when the SET of ids changes (order-insensitive). */
export function idSetKey(ids: readonly string[]): string {
  return [...ids].sort().join('\u0001')
}

/**
 * Toggle one row, or a whole range when `shiftKey` is held and an anchor
 * exists. `shouldSelect` is decided by the clicked row's own state, so
 * shift-clicking a selected row deselects the range.
 */
export function toggleSelection(
  prev: ReadonlySet<string>,
  ids: readonly string[],
  id: string,
  anchorIndex: number | null,
  shiftKey: boolean,
): Set<string> {
  const idx = ids.indexOf(id)
  const next = new Set(prev)
  if (shiftKey && anchorIndex != null && idx !== -1) {
    const [lo, hi] = anchorIndex < idx ? [anchorIndex, idx] : [idx, anchorIndex]
    const shouldSelect = !prev.has(id)
    for (let i = lo; i <= hi; i++) {
      const rowId = ids[i]
      if (rowId == null) continue
      if (shouldSelect) next.add(rowId); else next.delete(rowId)
    }
  } else if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  return next
}

/* ── Undoable action queue ──────────────────────────────────────────────── */

export type UndoCancelResult =
  /** The write had not gone out; it is now cancelled and the caller should run its undo. */
  | 'cancelled'
  /** The write is already in flight or finished; Undo must NOT restore the row. */
  | 'too-late'

type Entry<T> = {
  item: T
  key: string
  timer: ReturnType<typeof setTimeout> | null
  state: 'armed' | 'inflight'
}

/**
 * Owns the timing of "do it after N ms unless undone".
 *
 *  - Each `schedule` gets its own entry, so two actions on one key never
 *    orphan the first timer: the first is settled immediately (it was already
 *    reported as done) and the second gets a fresh window.
 *  - `cancel` only succeeds while the entry is still `armed`. Once the timer
 *    fired the write is in flight and may succeed, so Undo reports 'too-late'.
 *  - `dispose` clears every timer. With `flush` the armed writes run now (real
 *    desk: a moderator who navigates away must not lose an approval); without
 *    it they are dropped (the demo sandbox must never reach the database).
 */
export class UndoQueue<T> {
  private entries = new Set<Entry<T>>()
  private disposed = false

  constructor(private readonly opts: {
    windowMs: () => number
    keyOf: (item: T) => string
    settle: (item: T) => Promise<void>
    onChange: () => void
  }) {}

  /** Keys with an armed or in-flight write. */
  pendingKeys(): Set<string> {
    return new Set([...this.entries].map(e => e.key))
  }

  schedule(item: T): void {
    if (this.disposed) return
    const key = this.opts.keyOf(item)
    for (const e of [...this.entries]) {
      if (e.key === key && e.state === 'armed') this.fire(e)
    }
    const entry: Entry<T> = { item, key, timer: null, state: 'armed' }
    entry.timer = setTimeout(() => this.fire(entry), this.opts.windowMs())
    this.entries.add(entry)
    this.opts.onChange()
  }

  cancel(key: string): UndoCancelResult {
    const armed = [...this.entries].reverse().find(e => e.key === key && e.state === 'armed')
    if (!armed) return 'too-late'
    if (armed.timer) clearTimeout(armed.timer)
    this.entries.delete(armed)
    this.opts.onChange()
    return 'cancelled'
  }

  /** Re-arm after a dispose (React StrictMode runs cleanup then setup again on mount). */
  revive(): void { this.disposed = false }

  dispose(flush: boolean): void {
    this.disposed = true
    for (const e of [...this.entries]) {
      if (e.timer) { clearTimeout(e.timer); e.timer = null }
      if (e.state !== 'armed') continue
      if (flush) this.fire(e)
      else this.entries.delete(e)
    }
  }

  private fire(entry: Entry<T>): void {
    if (entry.state !== 'armed') return
    if (entry.timer) { clearTimeout(entry.timer); entry.timer = null }
    entry.state = 'inflight'
    const done = () => { this.entries.delete(entry); if (!this.disposed) this.opts.onChange() }
    this.opts.settle(entry.item).then(done, done)
  }
}
