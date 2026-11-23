import { describe, it, expect } from 'vitest'
import { decisionNotice } from './certificateService'

describe('decisionNotice', () => {
  it('says issued in plain language', () => {
    const n = decisionNotice('lor', 'issued')
    expect(n.title).toContain('letter of recommendation')
    expect(n.title).toContain('ready')
    // Since the pipeline (20 Nov 2026) the member opens their own document on the site.
    expect(n.subtitle).toBe('The team has approved your request. Open it from your certificates page to download it.')
  })
  it('uses the type’s own label when the caller has it, and a safe word when it does not', () => {
    expect(decisionNotice('recognition', 'issued', null, 'Letter of Recognition').title).toBe('Your letter of recognition is ready')
    expect(decisionNotice('something_new', 'issued').title).toBe('Your certificate is ready')
  })
  it('carries the decline reason and avoids em dashes', () => {
    const n = decisionNotice('certificate', 'declined', ' not enough hours ')
    expect(n.subtitle).toBe('Reason: not enough hours')
    expect(JSON.stringify(n)).not.toContain('—')
  })
})
