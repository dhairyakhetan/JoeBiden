import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { UndoQueue, idSetKey, pruneSelection, toggleSelection } from './adminKitLogic'

describe('row selection helpers', () => {
  it('idSetKey ignores order and changes when ids are added', () => {
    expect(idSetKey(['a', 'b'])).toBe(idSetKey(['b', 'a']))
    expect(idSetKey(['a', 'b'])).not.toBe(idSetKey(['a', 'b', 'c']))
  })

  it('pruneSelection keeps ids across an appended page', () => {
    const sel = new Set(['a', 'b'])
    expect(pruneSelection(sel, ['a', 'b', 'c', 'd'])).toBe(sel)
  })

  it('pruneSelection drops ids whose row left the list', () => {
    expect([...pruneSelection(new Set(['a', 'b']), ['b', 'c'])]).toEqual(['b'])
  })

  it('toggleSelection toggles one id, and ranges with an explicit shift key', () => {
    const ids = ['a', 'b', 'c', 'd']
    let s = toggleSelection(new Set(), ids, 'a', null, false)
    expect([...s]).toEqual(['a'])
    s = toggleSelection(s, ids, 'c', 0, true)
    expect([...s].sort()).toEqual(['a', 'b', 'c'])
    s = toggleSelection(s, ids, 'c', 0, true) // c selected -> range deselects
    expect([...s]).toEqual([])
  })
})

describe('UndoQueue', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })
  const make = (settle = vi.fn(async () => {})) => {
    const onChange = vi.fn()
    const q = new UndoQueue<{ id: string }>({ windowMs: () => 1000, keyOf: i => i.id, settle, onChange })
    return { q, settle, onChange }
  }

  it('settles after the window and clears pending', async () => {
    const { q, settle } = make()
    q.schedule({ id: '1' })
    expect([...q.pendingKeys()]).toEqual(['1'])
    await vi.advanceTimersByTimeAsync(1000)
    expect(settle).toHaveBeenCalledTimes(1)
    expect(q.pendingKeys().size).toBe(0)
  })

  it('cancel inside the window stops the write', async () => {
    const { q, settle } = make()
    q.schedule({ id: '1' })
    expect(q.cancel('1')).toBe('cancelled')
    await vi.advanceTimersByTimeAsync(2000)
    expect(settle).not.toHaveBeenCalled()
  })

  it('a late undo is too-late while the write is in flight and after it finished', async () => {
    let release!: () => void
    const settle = vi.fn(() => new Promise<void>(r => { release = r }))
    const { q } = make(settle)
    q.schedule({ id: '1' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(q.cancel('1')).toBe('too-late')
    release()
    await vi.advanceTimersByTimeAsync(0)
    expect(q.cancel('1')).toBe('too-late')
  })

  it('two actions on one key do not orphan the first timer', async () => {
    const { q, settle } = make()
    q.schedule({ id: '1' })
    q.schedule({ id: '1' })
    expect(settle).toHaveBeenCalledTimes(1) // the first was settled, not orphaned
    await vi.advanceTimersByTimeAsync(1000)
    expect(settle).toHaveBeenCalledTimes(2)
  })

  it('dispose(flush) runs armed writes now; dispose(false) drops them; nothing fires later', async () => {
    const a = make()
    a.q.schedule({ id: '1' })
    a.q.dispose(true)
    expect(a.settle).toHaveBeenCalledTimes(1)
    const b = make()
    b.q.schedule({ id: '2' })
    b.q.dispose(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(b.settle).not.toHaveBeenCalled()
    expect(a.settle).toHaveBeenCalledTimes(1)
  })

  it('revive lets a StrictMode remount schedule again', async () => {
    const { q, settle } = make()
    q.dispose(true)
    q.schedule({ id: '1' })
    expect(settle).not.toHaveBeenCalled()
    q.revive()
    q.schedule({ id: '1' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(settle).toHaveBeenCalledTimes(1)
  })
})
