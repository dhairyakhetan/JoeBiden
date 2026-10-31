import { describe, it, expect, beforeEach, vi } from 'vitest'
import savedStore from './savedStore'

/**
 * Item 8.2. The store is the single source of "is this post bookmarked" for
 * the whole session, so the rules that matter are the ones that are easy to
 * get subtly wrong and impossible to see in a screenshot: unknown vs false,
 * emitting only on real change, and clearing on sign-out.
 */

beforeEach(() => savedStore.clear())

describe('savedStore', () => {
  it('distinguishes "never been told" from "not saved"', () => {
    expect(savedStore.get(1)).toBeUndefined()
    savedStore.set(1, false)
    expect(savedStore.get(1)).toBe(false)
  })

  it('records a save and an unsave', () => {
    savedStore.set(7, true)
    expect(savedStore.get(7)).toBe(true)
    savedStore.set(7, false)
    expect(savedStore.get(7)).toBe(false)
  })

  // The whole point of the store: two cards for the same post, one truth.
  it('notifies subscribers when a post changes', () => {
    const spy = vi.fn()
    const off = savedStore.subscribe(spy)
    savedStore.set(3, true)
    expect(spy).toHaveBeenCalledTimes(1)
    off()
    savedStore.set(3, false)
    expect(spy).toHaveBeenCalledTimes(1)   // unsubscribed
  })

  // Without this a feed of 30 cards re-renders on every no-op write.
  it('does not notify when nothing actually changed', () => {
    savedStore.set(4, true)
    const spy = vi.fn()
    savedStore.subscribe(spy)
    savedStore.set(4, true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('bumps the version only on a real change', () => {
    const v0 = savedStore.getVersion()
    savedStore.set(5, true)
    const v1 = savedStore.getVersion()
    expect(v1).toBeGreaterThan(v0)
    savedStore.set(5, true)
    expect(savedStore.getVersion()).toBe(v1)
  })

  describe('seed', () => {
    // This is what makes a batched feed load authoritative: ids that were
    // ASKED about and came back unsaved must become a known false, or every
    // card re-fetches its own state one at a time (the N+1 the batch exists
    // to avoid).
    it('records asked-but-not-saved ids as a known false', () => {
      savedStore.seed([10, 11, 12], [11])
      expect(savedStore.get(10)).toBe(false)
      expect(savedStore.get(11)).toBe(true)
      expect(savedStore.get(12)).toBe(false)
      expect(savedStore.get(13)).toBeUndefined()
    })

    it('overwrites an earlier value when the server disagrees', () => {
      savedStore.set(20, true)
      savedStore.seed([20], [])
      expect(savedStore.get(20)).toBe(false)
    })

    it('does not notify when the seed matches what is already known', () => {
      savedStore.seed([30, 31], [30])
      const spy = vi.fn()
      savedStore.subscribe(spy)
      savedStore.seed([30, 31], [30])
      expect(spy).not.toHaveBeenCalled()
    })
  })

  it('lists the saved ids', () => {
    savedStore.seed([1, 2, 3], [1, 3])
    expect(savedStore.savedIds().sort()).toEqual([1, 3])
  })

  // The one genuinely harmful failure: a shared browser, and the next member
  // sees the previous member's bookmarks flagged on the feed.
  it('clears everything on sign-out, including the known set', () => {
    savedStore.seed([1, 2], [1])
    savedStore.clear()
    expect(savedStore.get(1)).toBeUndefined()
    expect(savedStore.get(2)).toBeUndefined()
    expect(savedStore.savedIds()).toEqual([])
  })

  it('clear does not notify when there was nothing to clear', () => {
    const spy = vi.fn()
    savedStore.subscribe(spy)
    savedStore.clear()
    expect(spy).not.toHaveBeenCalled()
  })
})
