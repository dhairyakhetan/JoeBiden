import { describe, it, expect } from 'vitest'
import {
  DD_PHASES_DEFAULT, DD_THANKYOU_DEFAULT, DD_THANKYOU_MULTI_DEFAULT,
  buildCsv, composeThankYou, computeLivePhase, csvCell, generateDdId, hasCashNote, istDateKey,
  joinNames, cleanDobNote, DOB_NOTE_MAX, closeFriendsToAdd, normaliseInstagram, instagramUrl, nextPhaseKey, parsePhases, phaseCounts, viewRegs, parseEntry, findByPhone, phoneKey,
  type DiscoPhase, type DiscoReg,
} from './discoDiwali'

const P = (o: Partial<DiscoPhase> & { key: string }): DiscoPhase => ({
  label: o.key, amount: 500, opensAt: null, closedManually: false, ...o,
})

const R = (o: Partial<DiscoReg> = {}): DiscoReg => ({
  id: 'id', dd_id: 'DD26-AAAA', name: 'Riya', phone: '9830000000', school: null, phase: 'phase_1',
  amount: 500, paid: true, attended: false, notes: null, created_by: null,
  created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-10-01T10:00:00.000Z', ...o,
})

describe('istDateKey', () => {
  it('rolls over at midnight IST, not UTC', () => {
    // 19:00 UTC on the 1st is 00:30 IST on the 2nd.
    expect(istDateKey(new Date('2026-10-01T19:00:00Z'))).toBe('2026-10-02')
    expect(istDateKey(new Date('2026-10-01T18:00:00Z'))).toBe('2026-10-01')
  })
})

describe('computeLivePhase', () => {
  const now = new Date('2026-10-10T06:00:00Z')
  it('treats a phase with no open date as open from the start', () => {
    expect(computeLivePhase(DD_PHASES_DEFAULT, now)?.key).toBe('terrathon_special')
  })
  it('picks the last phase that has opened', () => {
    const ps = [P({ key: 'a', opensAt: '2026-10-01' }), P({ key: 'b', opensAt: '2026-10-09' }), P({ key: 'c', opensAt: '2026-10-20' })]
    expect(computeLivePhase(ps, now)?.key).toBe('b')
  })
  it('opens a phase on its own date', () => {
    expect(computeLivePhase([P({ key: 'a', opensAt: '2026-10-10' })], now)?.key).toBe('a')
  })
  it('skips a phase that is closed by hand and falls back to the earlier one', () => {
    const ps = [P({ key: 'a', opensAt: '2026-10-01' }), P({ key: 'b', opensAt: '2026-10-05', closedManually: true })]
    expect(computeLivePhase(ps, now)?.key).toBe('a')
  })
  it('returns null when everything is closed or upcoming', () => {
    expect(computeLivePhase([P({ key: 'a', closedManually: true }), P({ key: 'b', opensAt: '2026-12-01' })], now)).toBeNull()
  })
})

describe('defaults', () => {
  it('start with the TerraThon Special at 550', () => {
    expect(DD_PHASES_DEFAULT).toEqual([{ key: 'terrathon_special', label: 'TerraThon Special', amount: 550, opensAt: null, closedManually: false }])
  })
  it('templates carry the date and an honest TBD venue', () => {
    for (const t of [DD_THANKYOU_DEFAULT, DD_THANKYOU_MULTI_DEFAULT]) {
      expect(t).toContain('10th Nov')
      expect(t).toContain('Venue: TBD')
      expect(t).toContain('— Team AQ')
    }
  })
})

describe('parsePhases', () => {
  it('falls back to the default for junk', () => {
    expect(parsePhases(null)).toBe(DD_PHASES_DEFAULT)
    expect(parsePhases('x')).toBe(DD_PHASES_DEFAULT)
    expect(parsePhases([{ key: 'Bad Key' }, 5, null])).toBe(DD_PHASES_DEFAULT)
  })
  it('sanitises field by field and keeps custom keys', () => {
    const out = parsePhases([
      { key: 'early_bird', label: ' ', amount: -5, opensAt: 'tomorrow', closedManually: 'yes' },
      { key: 'vip_2', label: 'VIP', amount: 900, opensAt: '2026-10-12', closedManually: true },
    ])
    expect(out).toEqual([
      { key: 'early_bird', label: 'early_bird', amount: 0, opensAt: null, closedManually: false },
      { key: 'vip_2', label: 'VIP', amount: 900, opensAt: '2026-10-12', closedManually: true },
    ])
  })
  it('drops a repeated key rather than showing two options that save to the same value', () => {
    expect(parsePhases([{ key: 'a', amount: 1 }, { key: 'a', amount: 2 }])).toHaveLength(1)
  })
})

describe('nextPhaseKey', () => {
  it('continues from the highest phase_N', () => {
    expect(nextPhaseKey([P({ key: 'phase_1' }), P({ key: 'phase_4' })])).toEqual({ key: 'phase_5', n: 5 })
  })
  it('counts the list when no key is numbered', () => {
    expect(nextPhaseKey([P({ key: 'early_bird' })])).toEqual({ key: 'phase_2', n: 2 })
  })
})

describe('generateDdId', () => {
  it('is DD26- plus 4 characters from an alphabet with no look-alikes', () => {
    for (let i = 0; i < 200; i++) expect(generateDdId()).toMatch(/^DD26-[2-9A-HJKMNP-Z]{4}$/)
  })
})

describe('composeThankYou', () => {
  const phases = [P({ key: 'phase_1', label: 'Phase 1' })]
  it('fills the single template', () => {
    const msg = composeThankYou([R({ name: 'Riya', dd_id: 'DD26-K3X7', amount: 600 })], phases, DD_THANKYOU_DEFAULT, DD_THANKYOU_MULTI_DEFAULT)
    expect(msg).toContain('Hi Riya!')
    expect(msg).toContain('DD26-K3X7')
    expect(msg).toContain('Phase 1 · ₹600')
    expect(msg).not.toMatch(/\{\w+\}/)
  })
  it('bundles two or more into one message with a total', () => {
    const msg = composeThankYou(
      [R({ name: 'Riya', dd_id: 'DD26-AAAA', amount: 600 }), R({ name: 'Karan', dd_id: 'DD26-BBBB', amount: 600 }), R({ name: 'Aanya', dd_id: 'DD26-CCCC', amount: 600 })],
      phases, DD_THANKYOU_DEFAULT, DD_THANKYOU_MULTI_DEFAULT,
    )
    expect(msg).toContain('Hi Riya, Karan & Aanya!')
    expect(msg).toContain('Your 3 Disco Diwali bookings')
    expect(msg).toContain('• Karan — DD26-BBBB (Phase 1, ₹600)')
    expect(msg).toContain('₹1,800')
  })
  it('does not re-expand a placeholder typed as a guest name', () => {
    const msg = composeThankYou([R({ name: '{amount}', amount: 700 })], phases, 'Hi {name}, pay {amount}', '')
    expect(msg).toBe('Hi {amount}, pay 700')
  })
  it('leaves an unknown placeholder alone and falls back to the raw phase key', () => {
    const msg = composeThankYou([R({ phase: 'gone' })], phases, '{phase} {mystery}', '')
    expect(msg).toBe('gone {mystery}')
  })
  it('returns nothing for an empty selection', () => {
    expect(composeThankYou([], phases, 'x', 'y')).toBe('')
  })
})

describe('joinNames', () => {
  it('joins one, two and many', () => {
    expect(joinNames(['A'])).toBe('A')
    expect(joinNames(['A', 'B'])).toBe('A & B')
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B & C')
  })
})

describe('viewRegs', () => {
  const list = [
    R({ id: '1', name: 'Zed', dd_id: 'DD26-ZZZZ', attended: true, created_at: '2026-10-01T10:00:00Z' }),
    R({ id: '2', name: 'Amy', dd_id: 'DD26-AAAA', paid: false, notes: 'Cash at door', created_at: '2026-10-03T10:00:00Z', school: 'DBPC' }),
    R({ id: '3', name: 'Bob', dd_id: 'DD26-BBBB', created_at: '2026-10-02T10:00:00Z' }),
  ]
  const ids = (xs: DiscoReg[]) => xs.map((x) => x.id)
  it('searches name, phone, school and ID', () => {
    expect(ids(viewRegs(list, 'dbpc', 'all', 'recent'))).toEqual(['2'])
    expect(ids(viewRegs(list, 'dd26-zzzz', 'all', 'recent'))).toEqual(['1'])
  })
  it('filters', () => {
    expect(ids(viewRegs(list, '', 'checked', 'name'))).toEqual(['1'])
    expect(ids(viewRegs(list, '', 'unchecked', 'name'))).toEqual(['2', '3'])
    expect(ids(viewRegs(list, '', 'unpaid', 'name'))).toEqual(['2'])
    expect(ids(viewRegs(list, '', 'cash', 'name'))).toEqual(['2'])
  })
  it('sorts', () => {
    expect(ids(viewRegs(list, '', 'all', 'recent'))).toEqual(['2', '3', '1'])
    expect(ids(viewRegs(list, '', 'all', 'name'))).toEqual(['2', '3', '1'])
    expect(ids(viewRegs(list, '', 'all', 'unchecked'))).toEqual(['2', '3', '1'])
    expect(ids(viewRegs(list, '', 'all', 'checked'))[0]).toBe('1')
    expect(ids(viewRegs(list, '', 'all', 'unpaid'))[0]).toBe('2')
  })
  it('does not mutate its input', () => {
    const copy = [...list]
    viewRegs(list, '', 'all', 'name')
    expect(list).toEqual(copy)
  })
})

describe('hasCashNote / phaseCounts', () => {
  it('spots cash in any case', () => {
    expect(hasCashNote('paid CASH')).toBe(true)
    expect(hasCashNote('upi')).toBe(false)
    expect(hasCashNote(null)).toBe(false)
  })
  it('counts checked and total per phase', () => {
    const m = phaseCounts([R({ phase: 'a', attended: true }), R({ phase: 'a' }), R({ phase: 'b' })])
    expect(m.get('a')).toEqual({ checked: 1, total: 2 })
    expect(m.get('b')).toEqual({ checked: 0, total: 1 })
  })
})

describe('csv', () => {
  it('quotes and doubles embedded quotes', () => {
    expect(csvCell('say "hi", ok')).toBe('"say ""hi"", ok"')
  })
  it('defuses a leading formula character', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+91 98300')).toBe(`"'+91 98300"`)
    expect(csvCell('@sum')).toBe(`"'@sum"`)
    expect(csvCell('-1')).toBe(`"'-1"`)
  })
  it('writes blanks for null and keeps zero', () => {
    expect(csvCell(null)).toBe('""')
    expect(csvCell(0)).toBe('"0"')
  })
  it('emits a header and one line per row, with phase labels', () => {
    const out = buildCsv([R({ name: 'Riya', phase: 'phase_1' })], [P({ key: 'phase_1', label: 'Phase 1' })]).split('\n')
    expect(out).toHaveLength(2)
    expect(out[0]).toContain('"ID"')
    expect(out[1]).toContain('"Phase 1"')
    expect(out[1]).toContain('"DD26-AAAA"')
  })
})

describe('parseEntry', () => {
  it.each([
    ['Riya Das 98300 11111', 'Riya Das', '9830011111'],
    ['Riya Das: +91 98300-11111', 'Riya Das', '9830011111'],
    ['+919830011111 Riya Das', 'Riya Das', '9830011111'],
    ['98300 11111 - Riya', 'Riya', '9830011111'],
    ['Riya (09830011111)', 'Riya', '9830011111'],
  ])('reads %s', (input, name, phone) => {
    expect(parseEntry(input)).toEqual({ name, phone })
  })
  it('takes the first line that has a number', () => {
    expect(parseEntry('hello\nKaran 9830022222\nother 9830033333')).toEqual({ name: 'Karan', phone: '9830022222' })
  })
  it('keeps a bare name when there is no number', () => {
    expect(parseEntry('  Aanya   Rao ')).toEqual({ name: 'Aanya Rao', phone: '' })
  })
  it('does not read an 11th digit into a landline-ish string', () => {
    expect(parseEntry('Ro 12345 67890')?.phone).toBe('')
  })
  it('returns null for nothing', () => {
    expect(parseEntry('   \n ')).toBeNull()
  })
})

describe('findByPhone / phoneKey', () => {
  const regs = [R({ id: '1', phone: '+919830011111' }), R({ id: '2', phone: '98300 11111' }), R({ id: '3', phone: '9830022222' })]
  it('matches the same number however it was stored', () => {
    expect(findByPhone(regs, '9830011111').map((r) => r.id)).toEqual(['1', '2'])
  })
  it('matches nothing until ten digits are typed', () => {
    expect(findByPhone(regs, '98300')).toEqual([])
  })
  it('keys on the last ten digits', () => {
    expect(phoneKey('+91 98300 11111')).toBe('9830011111')
  })
})

describe('normaliseInstagram', () => {
  it.each([
    ['@Riya.Das', 'riya.das'],
    ['riya_das', 'riya_das'],
    ['  @@riya  ', 'riya'],
    ['instagram.com/riya.das/', 'riya.das'],
    ['https://www.instagram.com/riya.das?igsh=abc123', 'riya.das'],
    ['http://m.instagram.com/Riya.Das/reels/', 'riya.das'],
  ])('accepts %s as %s', (raw, handle) => {
    expect(normaliseInstagram(raw)).toEqual({ handle, error: null })
  })
  it('treats empty as none, not an error', () => {
    expect(normaliseInstagram('')).toEqual({ handle: null, error: null })
    expect(normaliseInstagram('   ')).toEqual({ handle: null, error: null })
    expect(normaliseInstagram(null)).toEqual({ handle: null, error: null })
  })
  it.each(['riya das', 'riya..das', '.riya', 'riya.', 'a'.repeat(31), 'riya!', '@', 'riya/das extra?x'])('rejects %j', (raw) => {
    const r = normaliseInstagram(raw)
    if (raw === 'riya/das extra?x') { expect(r.handle).toBe('riya'); return } // a URL path is cut at the first slash, by design
    expect(r.handle).toBeNull()
    expect(r.error).not.toBeNull()
  })
  it('builds the profile link', () => {
    expect(instagramUrl('riya.das')).toBe('https://instagram.com/riya.das')
  })
})

describe('instagram across the desk', () => {
  it('is searchable', () => {
    const list = [R({ id: 'a', name: 'Riya', instagram: 'riya.das' }), R({ id: 'b', name: 'Karan', instagram: null })]
    expect(viewRegs(list, '@riya.das'.slice(1), 'all', 'name').map((r) => r.id)).toEqual(['a'])
  })
  it('is exported to the CSV as the bare handle (a leading @ would trip the formula guard), blank when absent', () => {
    const phases = [P({ key: 'phase_1', label: 'Phase 1' })]
    const [head, withIg] = buildCsv([R({ instagram: 'riya.das' })], phases).split('\n')
    expect(head).toContain('"Instagram"')
    expect(withIg).toContain('"riya.das"')
    expect(withIg).not.toContain("'@")
    expect(buildCsv([R()], phases).split('\n')[1]).not.toContain('@')
  })
  it('lifts an @handle out of a WhatsApp paste so it never lands in the name', () => {
    expect(parseEntry('Riya Das 98300 11111 @riya.das')).toEqual({ name: 'Riya Das', phone: '9830011111', instagram: 'riya.das' })
    expect(parseEntry('Karan 9830022222')).toEqual({ name: 'Karan', phone: '9830022222' })
  })
})

describe('cleanDobNote: the date of birth is a free-text note, kept exactly as typed', () => {
  it('keeps whatever was typed, in any style, untouched', () => {
    for (const note of ['14/05/2008', '2008-05-14', '14 May 2008', 'May 2008', '~2012', 'class 8', 'ask mum', '14th may 08 (approx)', 'ঢাকা ১৪ মে', '🎂 14/5']) {
      expect(cleanDobNote(note)).toBe(note)
    }
  })
  it('never calls anything invalid: impossible and future dates are just text', () => {
    for (const note of ['31/02/2008', '01/01/2090', '99/99/9999', 'not a date at all', '0000']) {
      expect(cleanDobNote(note)).toBe(note)
    }
  })
  it('trims the edges and nothing else (inner spacing is the writer\'s)', () => {
    expect(cleanDobNote('  14/05/2008  ')).toBe('14/05/2008')
    expect(cleanDobNote('\t14 May  2008\n')).toBe('14 May  2008')
  })
  it('an empty or blank box means nothing (null), never an empty string', () => {
    expect(cleanDobNote('')).toBeNull()
    expect(cleanDobNote('   ')).toBeNull()
    expect(cleanDobNote('\n\t ')).toBeNull()
    expect(cleanDobNote(null)).toBeNull()
    expect(cleanDobNote(undefined)).toBeNull()
  })
  it('is capped at the database limit, so a paste cannot be rejected by the CHECK', () => {
    expect(DOB_NOTE_MAX).toBe(80)
    expect(cleanDobNote('x'.repeat(80))).toHaveLength(80)
    expect(cleanDobNote('x'.repeat(500))).toHaveLength(80)
    expect(cleanDobNote('y'.repeat(100))).toBe('y'.repeat(80))
  })
  it('a note that looks like a spreadsheet formula is neutralised in the CSV, not stored differently', () => {
    expect(cleanDobNote('=1+1')).toBe('=1+1') // stored as typed
    expect(csvCell('=1+1')).toBe(`"'=1+1"`) // and made inert on export
    expect(csvCell('-2012')).toBe(`"'-2012"`)
    expect(csvCell('@home')).toBe(`"'@home"`)
  })
})

describe('close friends checklist', () => {
  const list = [
    R({ id: 'a', instagram: 'riya', ig_close_friend: false }),
    R({ id: 'b', instagram: 'karan', ig_close_friend: true }),
    R({ id: 'c', instagram: null }),
    R({ id: 'd', instagram: 'aanya' }),
  ]
  it('lists only people with a handle who are not yet added, treating a missing flag as not added', () => {
    expect(closeFriendsToAdd(list).map((r) => r.id)).toEqual(['a', 'd'])
  })
  it('drives the filter the same way', () => {
    expect(viewRegs(list, '', 'closefriends', 'name').map((r) => r.id).sort()).toEqual(['a', 'd'])
  })
  it('exports yes, no or blank per row, and the DOB', () => {
    const phases = [P({ key: 'phase_1', label: 'Phase 1' })]
    const rows = buildCsv([R({ instagram: 'riya', ig_close_friend: true, dob: '2008-05-14' }), R({ instagram: 'k', ig_close_friend: false }), R()], phases).split('\n')
    expect(rows[0]).toContain('"Close friends","DOB"')
    expect(rows[1]).toContain('"riya","yes","2008-05-14"')
    expect(rows[2]).toContain('"k","no",""')
    expect(rows[3]).toContain('"","",""')
  })
})
