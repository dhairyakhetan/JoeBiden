import { describe, it, expect } from 'vitest'
import { yearbookCounts } from './yearbookService'
describe('yearbookCounts', () => {
  it('does not count skipped as waiting', () => {
    expect(yearbookCounts([{ status: 'invited' }, { status: 'skipped' }, { status: 'submitted' }]))
      .toEqual({ total: 3, submitted: 1, skipped: 1, waiting: 1 })
  })
})
