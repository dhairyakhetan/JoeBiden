import { describe, it, expect } from 'vitest'
import { applyPostScope, isPostScoped } from './postScope'

function stub() {
  const calls: string[] = []
  const q: any = {
    in: (col: string, vals: unknown[]) => { calls.push(`in ${col} [${vals.join(',')}]`); return q },
    or: (expr: string) => { calls.push(`or ${expr}`); return q },
  }
  return { q, calls }
}

describe('isPostScoped', () => {
  it('is false only when there is neither a category nor a team', () => {
    expect(isPostScoped([], [])).toBe(false)
    expect(isPostScoped(['events'], [])).toBe(true)
    expect(isPostScoped([], [8])).toBe(true)
  })
})

describe('applyPostScope', () => {
  it('leaves an unscoped leader alone', () => {
    const { q, calls } = stub()
    expect(applyPostScope(q, [], [], [])).toBe(q)
    expect(calls).toEqual([])
  })

  it('keeps today\'s category filter for a category-only leader', () => {
    const { q, calls } = stub()
    applyPostScope(q, ['events', 'labs'], [], [])
    expect(calls).toEqual(['in category [events,labs]'])
  })

  it('filters to the tagged posts for a team-only leader', () => {
    const { q, calls } = stub()
    applyPostScope(q, [], [8], [101, 102])
    expect(calls).toEqual(['in post_id [101,102]'])
  })

  it('ORs categories and tagged posts for a leader with both', () => {
    const { q, calls } = stub()
    applyPostScope(q, ['events'], [8], [101, 102])
    expect(calls).toEqual(['or category.in.(events),post_id.in.(101,102)'])
  })

  it('falls back to categories when the team scope holds no pending post', () => {
    const { q, calls } = stub()
    applyPostScope(q, ['events'], [8], [])
    expect(calls).toEqual(['in category [events]'])
  })

  it('shows nothing, not everything, for a team-only leader with no pending tagged posts', () => {
    const { q, calls } = stub()
    applyPostScope(q, [], [8], [])
    expect(calls).toEqual(['in post_id []'])
  })
})
