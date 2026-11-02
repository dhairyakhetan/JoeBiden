import { describe, it, expect } from 'vitest'
import { canArchiveMember, archiveBlockedReason, showDeleteControl, createRequestTokens } from './memberDirectoryRules'

describe('canArchiveMember', () => {
  it('lets a HoD archive an ordinary member', () => expect(canArchiveMember('hod', 'member', false)).toBe(true))
  it('blocks a HoD or director archiving super_admin or hr', () => {
    expect(canArchiveMember('hod', 'super_admin', false)).toBe(false)
    expect(canArchiveMember('director', 'hr', false)).toBe(false)
  })
  it('lets the admin tier archive another admin', () => {
    expect(canArchiveMember('super_admin', 'hr', false)).toBe(true)
    expect(canArchiveMember('hr', 'super_admin', false)).toBe(true)
  })
  it('never lets anyone archive themselves', () => expect(canArchiveMember('super_admin', 'super_admin', true)).toBe(false))
  it('gives a reason only when blocked', () => {
    expect(archiveBlockedReason('hod', 'member', false)).toBeNull()
    expect(archiveBlockedReason('hod', 'hr', false)).toMatch(/super admin or HR/)
    expect(archiveBlockedReason('hod', 'member', true)).toMatch(/own account/)
  })
})

describe('showDeleteControl', () => {
  it('is admin tier only and never on deleted rows', () => {
    expect(showDeleteControl('super_admin', 'active')).toBe(true)
    expect(showDeleteControl('hr', 'archived')).toBe(true)
    expect(showDeleteControl('super_admin', 'deleted')).toBe(false)
    expect(showDeleteControl('hod', 'active')).toBe(false)
  })
})

describe('createRequestTokens', () => {
  it('only the newest request is latest', () => {
    const t = createRequestTokens()
    const a = t.next(); const b = t.next()
    expect(t.isLatest(a)).toBe(false)
    expect(t.isLatest(b)).toBe(true)
  })
})

import { isReadOnlyStatusView, showApprovalsLink, statusViewNoun, statusViewSuffix, statusViewEmpty } from './memberDirectoryRules'

describe('status views', () => {
  it('pending and suspended are read-only, the rest are not', () => {
    expect(isReadOnlyStatusView('pending_approval')).toBe(true)
    expect(isReadOnlyStatusView('suspended')).toBe(true)
    expect(isReadOnlyStatusView('active')).toBe(false)
    expect(isReadOnlyStatusView('archived')).toBe(false)
    expect(isReadOnlyStatusView('deleted')).toBe(false)
  })
  it('links to Approvals only for pending, only for HR and super admin', () => {
    expect(showApprovalsLink('hr', 'pending_approval')).toBe(true)
    expect(showApprovalsLink('super_admin', 'pending_approval')).toBe(true)
    expect(showApprovalsLink('hod', 'pending_approval')).toBe(false)
    expect(showApprovalsLink('hr', 'suspended')).toBe(false)
  })
  it('has copy for every view', () => {
    expect(statusViewNoun('pending_approval')).toBe('people waiting for approval')
    expect(statusViewNoun('suspended')).toBe('suspended accounts')
    expect(statusViewNoun('active')).toBe('active members')
    expect(statusViewSuffix('suspended')).toBe(' (suspended)')
    expect(statusViewSuffix('active')).toBe('')
    expect(statusViewEmpty('pending_approval').message).toBe('no one is waiting')
    expect(statusViewEmpty('suspended').message).toBe('no suspended accounts')
  })
  it('uses no em dashes', () => {
    for (const s of ['active', 'pending_approval', 'suspended', 'archived', 'deleted'] as const) {
      const e = statusViewEmpty(s)
      expect(e.message + e.sub + statusViewNoun(s) + statusViewSuffix(s)).not.toContain('—')
    }
  })
})
