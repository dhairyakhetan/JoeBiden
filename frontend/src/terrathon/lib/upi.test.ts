import { describe, it, expect } from 'vitest'
import { upiLink, isInAppBrowser, isIos, inAppHint } from './upi'
import { UPI } from '../config'

describe('upiLink', () => {
  const link = upiLink(2400, 'TT26-CRK-004')

  it('carries every parameter a UPI app needs', () => {
    expect(link.startsWith('upi://pay?')).toBe(true)
    expect(link).toContain(`pa=${encodeURIComponent(UPI.vpa)}`)
    expect(link).toContain('am=2400.00')
    expect(link).toContain('cu=INR')
    expect(link).toContain('tn=TT26-CRK-004')
  })

  it('encodes a space as %20 and NEVER as +', () => {
    // URLSearchParams would emit "Team+AquaTerra", and several UPI apps render
    // that plus literally on the payer's confirmation screen. The same bug in
    // the note field breaks reference-code matching for Finance.
    expect(link).toContain('pn=Team%20AquaTerra')
    expect(link).not.toContain('+')
  })

  it('prefills the payment note with the reference code, decoded exactly', () => {
    // This is the whole reconciliation story: Finance matches a bank entry to a
    // team by this note. A UPI app parses the link as a URL, so assert what it
    // would actually read out, not just that the substring is present.
    const parsed = new URL(upiLink(2400, 'TT26-CRK-004').replace('upi://', 'https://')).searchParams
    expect(parsed.get('tn')).toBe('TT26-CRK-004')
    expect(parsed.get('pn')).toBe('Team AquaTerra')
    expect(parsed.get('pa')).toBe(UPI.vpa)
    expect(parsed.get('am')).toBe('2400.00')
    expect(parsed.get('cu')).toBe('INR')
  })

  it('always sends paise, because some apps reject a bare integer amount', () => {
    expect(upiLink(350, 'TT26-FIF-001')).toContain('am=350.00')
    expect(upiLink(750.5, 'TT26-PKL-001')).toContain('am=750.50')
  })

  it('points at the NGO collection account, not a placeholder', () => {
    expect(UPI.vpa).toMatch(/^[^@\s]+@[^@\s]+$/)
    expect(UPI.vpa).not.toContain('example')
  })
})

describe('in-app browser detection', () => {
  const IG = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Instagram 300.0.0.0'
  const FB = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 [FB_IAB/FB4A;FBAV/400.0.0.0;]'
  const CHROME = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'
  const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'

  it('flags the arrival channels that mishandle upi: links', () => {
    expect(isInAppBrowser(IG)).toBe(true)
    expect(isInAppBrowser(FB)).toBe(true)
  })

  it('leaves real browsers alone, so the one-tap button stays primary', () => {
    expect(isInAppBrowser(CHROME)).toBe(false)
    expect(isInAppBrowser(SAFARI)).toBe(false)
  })

  it('names the right escape route per platform', () => {
    expect(isIos(IG)).toBe(true)
    expect(inAppHint(IG)).toContain('Safari')
    expect(inAppHint(FB)).toContain('Chrome')
  })
})
