import { describe, it, expect, afterEach, vi } from 'vitest'
import { clarityEvent, clarityTag } from './clarity'

const setWindow = (clarity: unknown) => {
  ;(globalThis as { window?: unknown }).window = { clarity }
}
afterEach(() => {
  delete (globalThis as { window?: unknown }).window
})

describe('clarity helpers', () => {
  it('are no-ops, and never throw, when there is no window or no tag', () => {
    expect(() => clarityEvent('x', { a: 1 })).not.toThrow()
    expect(() => clarityTag('area', 'terranotes')).not.toThrow()
    setWindow(undefined)
    expect(() => clarityEvent('x')).not.toThrow()
    setWindow('not a function')
    expect(() => clarityTag('a', 'b')).not.toThrow()
  })

  it('sends the event, then each non-null prop as a tag stringified', () => {
    const c = vi.fn()
    setWindow(c)
    clarityEvent('signin_started', { method: 'google', firstVisit: false, skipped: null, alsoSkipped: undefined, n: 3 })
    expect(c.mock.calls).toEqual([
      ['event', 'signin_started'],
      ['set', 'method', 'google'],
      ['set', 'firstVisit', 'false'],
      ['set', 'n', '3'],
    ])
  })

  it('sends a bare event with no tags when there are no props', () => {
    const c = vi.fn()
    setWindow(c)
    clarityEvent('signup_profile_started')
    expect(c.mock.calls).toEqual([['event', 'signup_profile_started']])
  })

  it('tags a session', () => {
    const c = vi.fn()
    setWindow(c)
    clarityTag('area', 'terranotes')
    expect(c.mock.calls).toEqual([['set', 'area', 'terranotes']])
  })

  it('swallows an error thrown by the tag itself', () => {
    setWindow(() => { throw new Error('boom') })
    expect(() => clarityEvent('x', { a: 1 })).not.toThrow()
    expect(() => clarityTag('a', 'b')).not.toThrow()
  })
})
