import { describe, it, expect } from 'vitest'
import { splitBulkResult, revertRows } from './formResponsesLogic'

describe('splitBulkResult', () => {
  it('reports partial success', () => {
    expect(splitBulkResult([1, 2, 3], [{ id: 1 }, { id: 3 }])).toEqual({ ok: [1, 3], failed: [2] })
  })
  it('treats null as all failed', () => {
    expect(splitBulkResult([1], null)).toEqual({ ok: [], failed: [1] })
  })
})

describe('revertRows', () => {
  it('only touches the affected rows', () => {
    const cur = [{ id: 1, status: 'closed' }, { id: 2, status: 'contacted' }]
    const out = revertRows(cur, new Map([[1, 'new']]), [1])
    expect(out).toEqual([{ id: 1, status: 'new' }, { id: 2, status: 'contacted' }])
  })
})
