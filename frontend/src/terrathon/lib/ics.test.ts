import { describe, it, expect } from 'vitest'
import { buildIcs } from './ics'
import type { PublicEvent } from './types'

function ev(p: Partial<PublicEvent> = {}): PublicEvent {
  return {
    slug: 'cricket', display_name: 'Cricket', status: 'open', fee_inr: 2400,
    team_size_min: 7, team_size_max: 8, roster_min_at_signup: 0,
    prize_pool_inr: 9000, prize_split: null, venue: null, venue_map_url: null,
    day_first: '2026-10-03', day_last: '2026-10-04', report_time: null,
    match_window: null, rules_md: null, closes_at: null, sort_order: 2,
    filling_fast: false, accepting: true,
    ...p,
  }
}

describe('buildIcs', () => {
  it('produces a well-formed single VEVENT', () => {
    const s = buildIcs(ev(), 'TT26-CRK-004')
    expect(s.startsWith('BEGIN:VCALENDAR')).toBe(true)
    expect(s.trimEnd().endsWith('END:VCALENDAR')).toBe(true)
    expect(s.match(/BEGIN:VEVENT/g)).toHaveLength(1)
    expect(s).toContain('VERSION:2.0')
    expect(s).toContain('UID:TT26-CRK-004@')
  })

  it('uses CRLF line endings, which several clients require', () => {
    const s = buildIcs(ev(), 'TT26-CRK-004')
    expect(s).toContain('\r\n')
    expect(s.split('\r\n').length).toBeGreaterThan(8)
  })

  it('makes DTEND exclusive, so a two-day sport does not bleed into a third', () => {
    // RFC 5545: an all-day DTEND is the day AFTER the last one. Getting this
    // wrong puts a phantom Monday in everyone's calendar.
    const s = buildIcs(ev({ day_first: '2026-10-03', day_last: '2026-10-04' }), 'TT26-CRK-004')
    expect(s).toContain('DTSTART;VALUE=DATE:20261003')
    expect(s).toContain('DTEND;VALUE=DATE:20261005')
  })

  it('handles a single-day sport', () => {
    const s = buildIcs(ev({ slug: 'fifa', display_name: 'FIFA', day_first: '2026-10-03', day_last: '2026-10-03' }), 'TT26-FIF-001')
    expect(s).toContain('DTSTART;VALUE=DATE:20261003')
    expect(s).toContain('DTEND;VALUE=DATE:20261004')
  })

  it('treats a null day_last as a one-day event', () => {
    const s = buildIcs(ev({ day_first: '2026-10-02', day_last: null }), 'TT26-PKL-001')
    expect(s).toContain('DTSTART;VALUE=DATE:20261002')
    expect(s).toContain('DTEND;VALUE=DATE:20261003')
  })

  it('escapes the characters that would otherwise break the file', () => {
    const s = buildIcs(ev({ venue: 'VS Arena, Bhowanipore; gate 2' }), 'TT26-CRK-004')
    expect(s).toContain('\\,')
    expect(s).toContain('\\;')
  })

  it('carries the reference code, which is the point of adding it at all', () => {
    expect(buildIcs(ev(), 'TT26-CRK-004')).toContain('TT26-CRK-004')
  })

  it('returns empty rather than a broken file when the date is unknown', () => {
    expect(buildIcs(ev({ day_first: null }), 'TT26-CRK-004')).toBe('')
  })

  it('omits LOCATION entirely when no venue is confirmed', () => {
    expect(buildIcs(ev({ venue: null }), 'TT26-CRK-004')).not.toContain('LOCATION:')
  })

  describe('line folding', () => {
    // RFC 5545 measures the 75 limit in UTF-8 OCTETS and forbids splitting a
    // multi-octet sequence. Folding by JS string length measures UTF-16 code
    // units instead, which agrees for anything in the Basic Multilingual Plane
    // and so looks correct for accented letters and Bengali script. A
    // supplementary-plane character is a surrogate PAIR, and cutting between
    // its halves leaves a lone surrogate on each line: not valid UTF-16, so
    // the calendar app shows a replacement character or rejects the file.

    /** A high surrogate with no low after it, or a low with no high before. */
    const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

    const octets = (s: string) => new TextEncoder().encode(s).length

    it('never splits a surrogate pair, at any offset across the fold boundary', () => {
      // Sweep the emoji across where the cut lands rather than trusting one
      // hand-computed position.
      for (let pad = 55; pad <= 80; pad++) {
        const venue = 'A'.repeat(pad) + '\u{1F3CF}' + 'B'.repeat(24)
        const s = buildIcs(ev({ venue }), 'TT26-CRK-004')
        expect(LONE_SURROGATE.test(s), `split a surrogate pair at pad=${pad}`).toBe(false)
        // And the bat survives the round trip rather than being mangled.
        expect(s.replace(/\r\n /g, '')).toContain('\u{1F3CF}')
      }
    })

    it('keeps every line inside 75 octets', () => {
      const venue = 'Very Long Venue Name '.repeat(8) + '\u{1F3CF}'
      const s = buildIcs(ev({ venue, display_name: 'Cricket' }), 'TT26-CRK-004')
      for (const line of s.split('\r\n')) {
        expect(octets(line), `line over 75 octets: ${JSON.stringify(line)}`).toBeLessThanOrEqual(75)
      }
    })

    it('marks every continuation line with the leading space that unfolds it', () => {
      const venue = 'C'.repeat(200)
      const s = buildIcs(ev({ venue }), 'TT26-CRK-004')
      const locIdx = s.split('\r\n').findIndex((l) => l.startsWith('LOCATION:'))
      expect(locIdx).toBeGreaterThan(-1)
      // The line after a folded LOCATION must continue it, not start a new
      // property, or the C's leak out as a bogus field name.
      expect(s.split('\r\n')[locIdx + 1].startsWith(' ')).toBe(true)
    })

    it('leaves a short ASCII line completely alone', () => {
      const s = buildIcs(ev({ venue: 'Turf XL' }), 'TT26-CRK-004')
      expect(s).toContain('LOCATION:Turf XL\r\n')
    })
  })
})
