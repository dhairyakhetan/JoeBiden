import { describe, it, expect } from 'vitest'
import { isDirty, shouldGuard, type FormSnapshot } from './unsavedChanges'

// changelog/11-system-states.md §11.9 state 10. The risk this file exists to
// hold down is NOT "the guard fails to fire" — it is "the guard fires when it
// shouldn't", which is how a guard turns into a nag and gets deleted. Every
// false-positive case named in the brief has a test here.

describe('isDirty', () => {
  const initial: FormSnapshot = { name: '', body: '', tags: [] }

  it('is false for an untouched form', () => {
    expect(isDirty({ name: '', body: '', tags: [] }, initial)).toBe(false)
  })

  it('is false when the member only focused a field (no keystrokes)', () => {
    // Focus changes nothing, so the snapshot is identical. This is the case
    // the brief calls out explicitly: "not merely the field was focused".
    expect(isDirty(initial, initial)).toBe(false)
  })

  it('is false for whitespace-only input', () => {
    expect(isDirty({ ...initial, body: '   \n ' }, initial)).toBe(false)
  })

  it('is true once there is real text', () => {
    expect(isDirty({ ...initial, body: 'hi' }, initial)).toBe(true)
  })

  it('is true when text is deleted back below the original', () => {
    expect(isDirty({ name: '', body: '', tags: [] }, { name: '', body: 'draft', tags: [] })).toBe(true)
  })

  it('treats null / undefined / empty-string as the same nothing', () => {
    expect(isDirty({ a: null, b: undefined, c: '' }, { a: '', b: '', c: undefined })).toBe(false)
  })

  it('compares arrays by content, not identity', () => {
    expect(isDirty({ tags: [1, 2] }, { tags: [1, 2] })).toBe(false)
    expect(isDirty({ tags: [1, 2] }, { tags: [2, 1] })).toBe(true)
    expect(isDirty({ tags: [] }, { tags: undefined })).toBe(false)
  })

  it('counts a field that only one side has, but only if it has content', () => {
    expect(isDirty({ title: '' }, {})).toBe(false)
    expect(isDirty({ title: 'x' }, {})).toBe(true)
  })

  it('notices a boolean toggle', () => {
    expect(isDirty({ pinned: true }, { pinned: false })).toBe(true)
    expect(isDirty({ pinned: false }, {})).toBe(false)
  })
})

describe('shouldGuard', () => {
  it('does not fire on a clean form', () => {
    expect(shouldGuard({ dirty: false })).toBe(false)
  })

  it('fires on a dirty form', () => {
    expect(shouldGuard({ dirty: true })).toBe(true)
  })

  it('does NOT fire after a successful submit', () => {
    expect(shouldGuard({ dirty: true, submitted: true })).toBe(false)
  })

  it('does NOT fire while a write is in flight', () => {
    expect(shouldGuard({ dirty: true, submitting: true })).toBe(false)
  })

  it('does NOT fire when a draft has already persisted the content', () => {
    expect(shouldGuard({ dirty: true, persisted: true })).toBe(false)
  })

  it('DOES fire when there is content the draft cannot persist', () => {
    // Images and attachments never reach localStorage (useComposerDraft's own
    // rule), so a saved draft is not a promise that the photos survive.
    expect(shouldGuard({ dirty: true, persisted: true, unpersistable: true })).toBe(true)
  })

  it('still stands down after submit even with unpersistable content', () => {
    expect(shouldGuard({ dirty: true, unpersistable: true, submitted: true })).toBe(false)
    expect(shouldGuard({ dirty: true, unpersistable: true, submitting: true })).toBe(false)
  })

  it('respects the enabled kill switch', () => {
    expect(shouldGuard({ dirty: true, enabled: false })).toBe(false)
    expect(shouldGuard({ dirty: true, unpersistable: true, enabled: false })).toBe(false)
  })
})
