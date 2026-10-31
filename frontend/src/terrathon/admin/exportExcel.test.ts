import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildWorkbook, exportFilename } from './exportExcel'
import type { AdminRow } from '../lib/api'

function row(p: Partial<AdminRow> = {}): AdminRow {
  return {
    id: 'id-1', ref_code: 'TT26-CRK-004', event_id: 'e1',
    captain_name: 'Aarav Shah', age: 16, class_label: 'Class 11', school: 'Test School',
    phone: '+919876543210', email: null, team_name: 'Night Owls',
    status: 'confirmed', wa_texted_by: 7, wa_texted_at: '2026-09-20T10:00:00.000Z',
    paid: true, paid_at: '2026-09-20T11:00:00.000Z', paid_by: 7,
    amount_paid_inr: 2400, utr: '123456789012', utr_submitted_at: null,
    hold_expires_at: null, ticket_token: 'tok', ticket_sent_at: null, notes: null,
    source: 'web', created_at: '2026-09-20T09:00:00.000Z', updated_at: '2026-09-20T11:00:00.000Z',
    event_slug: 'cricket', event_name: 'Cricket', roster: ['Two', 'Three'], last_checkin: null,
    ...p,
  }
}

function open(rows: AdminRow[]) {
  return unzipSync(buildWorkbook(rows))
}

describe('buildWorkbook', () => {
  it('emits every part an .xlsx reader requires', () => {
    const files = open([row()])
    for (const p of [
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
      'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
      'xl/worksheets/sheet3.xml', 'xl/worksheets/sheet4.xml',
    ]) {
      expect(Object.keys(files)).toContain(p)
    }
  })

  it('names the four sheets the team expects', () => {
    const wb = strFromU8(open([row()])['xl/workbook.xml'])
    for (const n of ['MASTER', 'CRICKET', 'PICKLEBALL', 'FIFA']) {
      expect(wb).toContain(`name="${n}"`)
    }
  })

  it('splits rows into the right sport sheet', () => {
    const rows = [
      row({ id: 'a', ref_code: 'TT26-CRK-001', event_slug: 'cricket', event_name: 'Cricket' }),
      row({ id: 'b', ref_code: 'TT26-PKL-001', event_slug: 'pickleball', event_name: 'Pickleball' }),
      row({ id: 'c', ref_code: 'TT26-FIF-001', event_slug: 'fifa', event_name: 'FIFA' }),
    ]
    const f = open(rows)
    const master = strFromU8(f['xl/worksheets/sheet1.xml'])
    const cricket = strFromU8(f['xl/worksheets/sheet2.xml'])
    const pickle = strFromU8(f['xl/worksheets/sheet3.xml'])
    const fifa = strFromU8(f['xl/worksheets/sheet4.xml'])

    expect(master).toContain('TT26-CRK-001')
    expect(master).toContain('TT26-PKL-001')
    expect(master).toContain('TT26-FIF-001')

    expect(cricket).toContain('TT26-CRK-001')
    expect(cricket).not.toContain('TT26-PKL-001')
    expect(pickle).toContain('TT26-PKL-001')
    expect(pickle).not.toContain('TT26-CRK-001')
    expect(fifa).toContain('TT26-FIF-001')
    expect(fifa).not.toContain('TT26-CRK-001')
  })

  it('writes a header row on every sheet, even an empty one', () => {
    const f = open([])
    for (const n of [1, 2, 3, 4]) {
      const s = strFromU8(f[`xl/worksheets/sheet${n}.xml`])
      expect(s).toContain('Ref Code')
      expect(s).toContain('Last Updated (IST)')
      expect(s).toContain('<pane ySplit="1"')
      expect(s).toContain('<autoFilter')
    }
  })

  it('keeps the +91 on a phone number instead of letting it parse as a number', () => {
    // Written as an inline string, so nothing downstream can drop the plus the
    // way a spreadsheet would if it guessed the type.
    const s = strFromU8(open([row()])['xl/worksheets/sheet1.xml'])
    expect(s).toContain('+919876543210')
    expect(s).toContain('t="inlineStr"')
  })

  it('writes booleans as booleans so the checkbox columns work', () => {
    const s = strFromU8(open([row({ paid: true, wa_texted_by: 7 })])['xl/worksheets/sheet1.xml'])
    expect(s).toContain('t="b"')
  })

  it('derives the status column rather than dumping the raw status', () => {
    const s = strFromU8(open([
      row({ paid: false, status: 'pending_payment', utr: null, hold_expires_at: '2020-01-01T00:00:00.000Z' }),
    ])['xl/worksheets/sheet1.xml'])
    expect(s).toContain('Hold expired')
  })

  it('escapes XML metacharacters in free text', () => {
    const s = strFromU8(open([row({ team_name: 'A & B <script>', notes: 'says "hi"' })])['xl/worksheets/sheet1.xml'])
    expect(s).toContain('A &amp; B &lt;script&gt;')
    expect(s).not.toContain('<script>')
  })

  it('counts players as roster plus the captain', () => {
    const s = strFromU8(open([row({ roster: ['a', 'b', 'c'] })])['xl/worksheets/sheet1.xml'])
    expect(s).toContain('<v>4</v>')
  })

  it('produces a non-trivial zip for a realistic number of rows', () => {
    const many = Array.from({ length: 120 }, (_, i) => row({ id: `id-${i}`, ref_code: `TT26-CRK-${i}` }))
    expect(buildWorkbook(many).byteLength).toBeGreaterThan(1200)
  })
})

describe('exportFilename', () => {
  it('is marked confidential, because it leaves with minors\' phone numbers in it', () => {
    const n = exportFilename(new Date('2026-09-27T18:30:00'))
    expect(n).toContain('CONFIDENTIAL')
    expect(n.endsWith('.xlsx')).toBe(true)
    expect(n).toContain('2026-09-27')
  })
})
