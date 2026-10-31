import { describe, it, expect } from 'vitest'
import { shouldMarkStale, DEFAULT_STALE_MS } from './staleAfterIdle'

const T = DEFAULT_STALE_MS
const now = 10_000_000

describe('shouldMarkStale', () => {
  it('flags a tab that was hidden past the threshold with equally old data', () => {
    expect(shouldMarkStale({ hiddenAt: now - T - 1000, loadedAt: now - T - 5000, now, thresholdMs: T })).toBe(true)
  })

  it('ignores a short alt-tab', () => {
    expect(shouldMarkStale({ hiddenAt: now - 2000, loadedAt: now - T * 4, now, thresholdMs: T })).toBe(false)
  })

  it('ignores a long absence when the data itself is fresh', () => {
    // Something else on the surface refetched while the tab was hidden.
    expect(shouldMarkStale({ hiddenAt: now - T * 3, loadedAt: now - 1000, now, thresholdMs: T })).toBe(false)
  })

  it('does not flag a tab that never went hidden, however old the data', () => {
    expect(shouldMarkStale({ hiddenAt: null, loadedAt: now - T * 10, now, thresholdMs: T })).toBe(false)
  })

  it('treats exactly the threshold as stale on both inputs', () => {
    expect(shouldMarkStale({ hiddenAt: now - T, loadedAt: now - T, now, thresholdMs: T })).toBe(true)
  })

  it('is one millisecond short of stale', () => {
    expect(shouldMarkStale({ hiddenAt: now - T + 1, loadedAt: now - T, now, thresholdMs: T })).toBe(false)
    expect(shouldMarkStale({ hiddenAt: now - T, loadedAt: now - T + 1, now, thresholdMs: T })).toBe(false)
  })

  it('respects a custom threshold', () => {
    expect(shouldMarkStale({ hiddenAt: now - 6000, loadedAt: now - 6000, now, thresholdMs: 5000 })).toBe(true)
    expect(shouldMarkStale({ hiddenAt: now - 4000, loadedAt: now - 6000, now, thresholdMs: 5000 })).toBe(false)
  })
})
