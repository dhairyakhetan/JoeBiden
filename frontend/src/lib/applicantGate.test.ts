import { describe, it, expect } from 'vitest'
import { isApplicantApproved, AWAITING_APPROVAL_TAG, ACCEPT_BLOCKED_MESSAGE } from './applicantGate'

describe('isApplicantApproved', () => {
  it('is true only for an active account', () => {
    expect(isApplicantApproved({ applicant: { status: 'active' } })).toBe(true)
  })
  it('is false for every other state', () => {
    for (const status of ['pending_approval', 'rejected', 'suspended', 'deleted', null, undefined]) {
      expect(isApplicantApproved({ applicant: { status } })).toBe(false)
    }
  })
  it('is false when the account row is missing', () => {
    expect(isApplicantApproved({ applicant: null })).toBe(false)
    expect(isApplicantApproved({})).toBe(false)
    expect(isApplicantApproved(null)).toBe(false)
  })
  it('keeps its copy in the house voice with no em dashes', () => {
    expect(AWAITING_APPROVAL_TAG).toBe(AWAITING_APPROVAL_TAG.toLowerCase())
    expect(ACCEPT_BLOCKED_MESSAGE).not.toContain('—')
  })
})
