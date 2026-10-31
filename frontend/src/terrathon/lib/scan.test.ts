import { describe, it, expect } from 'vitest'
import { tokenFromScan, isRefCode, istDayString } from './scan'

const TOKEN = 'b8d56d84-7359-44c2-96a8-1a83dc2964f3'

describe('tokenFromScan', () => {
  it('reads the token out of the URL the QR actually encodes', () => {
    expect(tokenFromScan(`https://www.ngoaquaterra.com/terrathon/t/${TOKEN}`)).toBe(TOKEN)
  })

  it('accepts a bare token, which is what a pasted value usually is', () => {
    expect(tokenFromScan(TOKEN)).toBe(TOKEN)
    expect(tokenFromScan(`  ${TOKEN}  `)).toBe(TOKEN)
  })

  it('normalises case so an uppercased scan still matches the stored uuid', () => {
    expect(tokenFromScan(TOKEN.toUpperCase())).toBe(TOKEN)
  })

  it('survives a query string or fragment stuck on the end', () => {
    expect(tokenFromScan(`https://x.test/terrathon/t/${TOKEN}?src=wa`)).toBe(TOKEN)
    expect(tokenFromScan(`https://x.test/terrathon/t/${TOKEN}#top`)).toBe(TOKEN)
  })

  it('refuses anything it cannot resolve exactly', () => {
    // A near-miss that resolved to the wrong registration would admit the
    // wrong team, which is worse than asking for a rescan.
    expect(tokenFromScan('')).toBeNull()
    expect(tokenFromScan('TT26-CRK-004')).toBeNull()
    expect(tokenFromScan('https://x.test/terrathon/t/not-a-uuid')).toBeNull()
    expect(tokenFromScan(TOKEN.slice(0, 30))).toBeNull()
    expect(tokenFromScan('https://evil.test/?x=/t/' + TOKEN.slice(0, 20))).toBeNull()
  })
})

describe('isRefCode', () => {
  it('recognises the codes register() mints', () => {
    expect(isRefCode('TT26-CRK-004')).toBe(true)
    expect(isRefCode('tt26-pkl-011')).toBe(true)
    expect(isRefCode('TT26-FIF-1234')).toBe(true)
  })
  it('rejects near misses', () => {
    expect(isRefCode('TT25-CRK-004')).toBe(false)
    expect(isRefCode('TT26-CRICKET-004')).toBe(false)
    expect(isRefCode('TT26-CRK')).toBe(false)
  })
})

describe('istDayString', () => {
  it('returns the IST calendar day, not the host timezone day', () => {
    // 19:30 UTC on 2 Oct is already 3 Oct in IST. A gate phone on UTC must not
    // check people into the previous day.
    expect(istDayString(new Date('2026-10-02T19:30:00.000Z'))).toBe('2026-10-03')
    expect(istDayString(new Date('2026-10-02T18:00:00.000Z'))).toBe('2026-10-02')
  })
})
