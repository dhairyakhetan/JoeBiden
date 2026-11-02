import { describe, it, expect } from 'vitest'
import { decisionNotice } from './certificateService'

describe('decisionNotice', () => {
  it('says issued in plain language', () => {
    const n = decisionNotice('lor', 'issued')
    expect(n.title).toContain('letter of recommendation')
    expect(n.title).toContain('ready')
    expect(n.subtitle).toBe('The team has approved your request. HR will send the document to you directly.')
    expect(n.subtitle).not.toMatch(/profile|download/i)
  })
  it('carries the decline reason and avoids em dashes', () => {
    const n = decisionNotice('certificate', 'declined', ' not enough hours ')
    expect(n.subtitle).toBe('Reason: not enough hours')
    expect(JSON.stringify(n)).not.toContain('—')
  })
})
