import { describe, it, expect } from 'vitest'
import { resubmitBlockReason, buildResubmitPatch, type ResubmitAttempt } from './resubmit'

const clean: ResubmitAttempt = {
  imageCount: 0, documentCount: 0, blogContent: '', scheduleOn: false, teamUuid: '',
}

describe('resubmitBlockReason', () => {
  it('allows a plain text edit', () => {
    expect(resubmitBlockReason(clean)).toBeNull()
  })

  it('blocks newly attached photos rather than dropping them', () => {
    expect(resubmitBlockReason({ ...clean, imageCount: 2 })).toMatch(/keeps the files/)
  })

  it('blocks newly attached documents', () => {
    expect(resubmitBlockReason({ ...clean, documentCount: 1 })).toMatch(/keeps the files/)
  })

  it('blocks blog mode', () => {
    expect(resubmitBlockReason({ ...clean, blogContent: 'an article' })).toMatch(/blog/)
  })

  it('ignores whitespace-only blog content', () => {
    expect(resubmitBlockReason({ ...clean, blogContent: '   \n ' })).toBeNull()
  })

  it('blocks scheduling, because a resubmit goes back to review', () => {
    expect(resubmitBlockReason({ ...clean, scheduleOn: true })).toMatch(/scheduled/)
  })

  it('blocks re-targeting the post at a team', () => {
    expect(resubmitBlockReason({ ...clean, teamUuid: 'abc-123' })).toMatch(/team/)
  })

  it('reports the attachment reason first when several apply', () => {
    const r = resubmitBlockReason({ ...clean, imageCount: 1, scheduleOn: true, teamUuid: 'x' })
    expect(r).toMatch(/keeps the files/)
  })
})

describe('buildResubmitPatch', () => {
  it('trims the body and always returns pending_review', () => {
    expect(buildResubmitPatch('  hello world  ', 'events')).toEqual({
      body: 'hello world', category: 'events', status: 'pending_review',
    })
  })

  it('never emits published/rejected — the RLS policy would reject the row', () => {
    const patch = buildResubmitPatch('x', 'welfare')
    expect(patch.status).toBe('pending_review')
  })
})
