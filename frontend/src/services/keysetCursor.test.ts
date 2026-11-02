import { describe, it, expect } from 'vitest'
import { keysetOrFilter, cursorFromLast, trimPage, appendUnique } from './keysetCursor'

describe('keysetCursor', () => {
  it('builds a strictly-after filter with an id tiebreak', () => {
    expect(keysetOrFilter('created_at', 'member_id', { createdAt: '2026-01-01T10:00:00.123456+00:00', id: 7 }))
      .toBe('created_at.gt."2026-01-01T10:00:00.123456+00:00",and(created_at.eq."2026-01-01T10:00:00.123456+00:00",member_id.gt.7)')
  })
  it('strips quotes from the timestamp so it cannot break out of the filter', () => {
    expect(keysetOrFilter('c', 'i', { createdAt: 'a"b', id: 1 })).not.toContain('a"b')
  })
  it('takes the cursor from the last row, null when empty', () => {
    const rows = [{ c: 'a', i: 1 }, { c: 'b', i: 2 }]
    expect(cursorFromLast(rows, r => r.c, r => r.i)).toEqual({ createdAt: 'b', id: 2 })
    expect(cursorFromLast([], (r: any) => r.c, (r: any) => r.i)).toBeNull()
  })
  it('trims the extra probe row and reports more', () => {
    expect(trimPage([1, 2, 3], 2)).toEqual({ rows: [1, 2], hasMore: true })
    expect(trimPage([1, 2], 2)).toEqual({ rows: [1, 2], hasMore: false })
  })
  it('appends without duplicating held rows', () => {
    expect(appendUnique([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }], r => r.id).map(r => r.id)).toEqual([1, 2, 3])
  })
})
