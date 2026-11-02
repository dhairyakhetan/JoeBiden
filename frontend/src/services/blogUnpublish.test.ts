import { describe, it, expect } from 'vitest'
import { isLiveStatus, unpublishPatch, unpublishAlreadyChangedMessage, unpublishNotice } from './blogUnpublish'

describe('blogUnpublish', () => {
  it('knows live statuses', () => {
    expect(isLiveStatus('published')).toBe(true)
    expect(isLiveStatus('scheduled')).toBe(true)
    expect(isLiveStatus('pending_review')).toBe(false)
    expect(isLiveStatus(null)).toBe(false)
  })
  it('patch clears schedule and publish stamps, touches nothing else', () => {
    expect(unpublishPatch()).toEqual({ status: 'pending_review', scheduled_for: null, published_at: null })
  })
  it('flags already-changed rows', () => {
    expect(unpublishAlreadyChangedMessage({ status: 'pending_review', deleted_at: null })).toMatch(/already back in drafts/)
    expect(unpublishAlreadyChangedMessage({ status: 'published', deleted_at: '2026-11-01' })).toMatch(/deleted/)
    expect(unpublishAlreadyChangedMessage({ status: 'rejected', deleted_at: null })).toMatch(/"rejected"/)
  })
  it('treats a still-live or missing row as a permission problem', () => {
    expect(unpublishAlreadyChangedMessage({ status: 'published', deleted_at: null })).toBeNull()
    expect(unpublishAlreadyChangedMessage({ status: 'scheduled', deleted_at: null })).toBeNull()
    expect(unpublishAlreadyChangedMessage(null)).toBeNull()
  })
  it('notice is plain and has no em dash', () => {
    const n = unpublishNotice('Rivers')
    expect(n.subtitle).toContain('"Rivers" is back in drafts')
    expect(n.title + n.subtitle).not.toContain('—')
    expect(unpublishNotice(null).subtitle).toContain('Your essay')
  })
})
