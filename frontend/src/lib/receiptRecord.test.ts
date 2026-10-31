import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  buildReceiptRows,
  formatMemberNo,
  formatReceiptTimestamp,
  formatStatus,
  hasPrintedReceipt,
  markReceiptPrinted,
  receiptReference,
  receiptSignoff,
  receiptStamp,
  type ReceiptSource,
} from './receiptRecord'

/**
 * The receipt is a provenance document, so these tests are mostly about what
 * it refuses to print. `1,247` entered this project as an invented member
 * number on this exact screen and spread to seven places as a fake member
 * count; the canonical public headcount is displayCount(ORG_FACTS.membersTotal)
 * (lib/orgFacts.ts) and a member number is not a count.
 */

const src = (over: Partial<ReceiptSource> = {}): ReceiptSource => ({
  full_name: 'Riya Agarwal',
  email: 'riya@example.com',
  class_grade: 'Class 11',
  phone: '+91 98301 00000',
  status: 'pending_approval',
  created_at: '2026-09-03T09:41:00Z',
  member_no: 412,
  referred_by: null,
  deskName: null,
  ...over,
})

describe('every row names its source', () => {
  it('gives every row a non-empty source string', () => {
    for (const row of buildReceiptRows(src({ referred_by: 5, deskName: 'Welfare Projects' }))) {
      expect(row.source.length).toBeGreaterThan(0)
    }
  })

  it('prints the rows in the order the cue sheet feeds them', () => {
    const keys = buildReceiptRows(src({ referred_by: 5, deskName: 'Welfare' })).map(r => r.key)
    expect(keys).toEqual(['name', 'email', 'class', 'phone', 'desk', 'joined', 'referred by', 'member no'])
  })
})

// ── rule 4: never render a figure with no source ───────────────────────────
describe('a value that cannot be sourced becomes null, never a placeholder', () => {
  it('returns null for a missing member number rather than any number', () => {
    const rows = buildReceiptRows(src({ member_no: null }))
    const no = rows.find(r => r.key === 'member no')!
    expect(no.value).toBeNull()
  })

  it('never emits 1247 or 1,247 from an empty source', () => {
    const rows = buildReceiptRows(src({ member_no: null, full_name: null, email: null, class_grade: null, phone: null, created_at: null }))
    const printed = rows.map(r => r.value ?? '').join(' ')
    expect(printed).not.toContain('1247')
    expect(printed).not.toContain('1,247')
    expect(printed.trim()).toBe('')
  })

  it('drops the reference line and the sign off with no member number', () => {
    expect(receiptReference(null)).toBeNull()
    expect(receiptSignoff(null)).toBeNull()
  })

  it('prints the member number with no thousands separator, because it is an identifier', () => {
    expect(formatMemberNo(1247)).toBe('1247')
    expect(receiptReference(1247)).toBe('AQ-1247')
    expect(receiptSignoff(412)).toBe("keep this. you're number 412.")
    expect(receiptSignoff(1247)).not.toContain('1,247')
  })
})

// ── the referrer is never named ────────────────────────────────────────────
describe('the referred-by row', () => {
  it('is omitted entirely when nobody referred them', () => {
    expect(buildReceiptRows(src({ referred_by: null })).some(r => r.key === 'referred by')).toBe(false)
  })

  it('records the fact without naming the referrer', () => {
    const row = buildReceiptRows(src({ referred_by: 5 })).find(r => r.key === 'referred by')!
    expect(row.value).toBe("on a member's invite")
    // The canvas printed "Aarushi Jain" here. There is no opt-in-to-be-named
    // column, so a name must never come back.
    expect(row.value).not.toMatch(/[A-Z][a-z]+ [A-Z][a-z]+/)
    expect(row.source).toContain('referred_by')
  })
})

describe('the desk row', () => {
  it('is omitted when there is no primary team, rather than printed empty', () => {
    expect(buildReceiptRows(src({ deskName: null })).some(r => r.key === 'desk')).toBe(false)
    expect(buildReceiptRows(src({ deskName: 'Welfare Projects' })).find(r => r.key === 'desk')!.value)
      .toBe('Welfare Projects')
  })
})

describe('formatters', () => {
  it('formats the joined timestamp without a raw Date or a GMT tail', () => {
    const out = formatReceiptTimestamp('2026-09-03T09:41:00Z')!
    expect(out).not.toContain('GMT')
    expect(out).toContain('2026')
    expect(out).toContain(',')
  })

  it('returns null for a missing or malformed timestamp', () => {
    expect(formatReceiptTimestamp(null)).toBeNull()
    expect(formatReceiptTimestamp('not a date')).toBeNull()
  })

  it('prints status as one word, upper case', () => {
    expect(formatStatus('pending_approval')).toBe('PENDING APPROVAL')
    expect(formatStatus(null)).toBeNull()
  })

  it('stamps only the four statuses that exist, and invents none', () => {
    expect(receiptStamp('pending_approval')).toBe('with hr')
    expect(receiptStamp('active')).toBe('approved')
    expect(receiptStamp('rejected')).toBe('not this round')
    expect(receiptStamp('suspended')).toBe('on hold')
    expect(receiptStamp('something_else')).toBeNull()
    expect(receiptStamp(null)).toBeNull()
  })

  it('uses no em dash in any printed string', () => {
    const strings = [
      ...buildReceiptRows(src({ referred_by: 3, deskName: 'Welfare' })).map(r => `${r.key} ${r.value} ${r.source}`),
      receiptReference(412) ?? '', receiptSignoff(412) ?? '',
      receiptStamp('pending_approval') ?? '', formatStatus('pending_approval') ?? '',
    ]
    for (const s of strings) expect(s).not.toContain('—')
  })
})

// ── the once-only flag ─────────────────────────────────────────────────────
describe('the print-once flag', () => {
  // vitest.config.ts runs these on the `node` environment, deliberately: every
  // other covered file is a pure function and none of them needs a DOM. The
  // flag helpers do read localStorage, so this is the smallest possible stand
  // in rather than a config change that would pull jsdom into every run.
  const store = new Map<string, string>()
  beforeAll(() => {
    ;(globalThis as Record<string, unknown>).window = globalThis
    ;(globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    }
  })
  afterAll(() => {
    delete (globalThis as Record<string, unknown>).window
    delete (globalThis as Record<string, unknown>).localStorage
  })
  beforeEach(() => { store.clear() })

  it('is persisted, not per session, so a reload does not reprint', () => {
    expect(hasPrintedReceipt('uuid-a')).toBe(false)
    markReceiptPrinted('uuid-a')
    expect(hasPrintedReceipt('uuid-a')).toBe(true)
  })

  it('is per member, so two people on one browser each get theirs once', () => {
    markReceiptPrinted('uuid-a')
    expect(hasPrintedReceipt('uuid-b')).toBe(false)
    markReceiptPrinted('uuid-b')
    expect(hasPrintedReceipt('uuid-a')).toBe(true)
    expect(hasPrintedReceipt('uuid-b')).toBe(true)
  })

  it('is idempotent and does not grow without bound', () => {
    for (let i = 0; i < 25; i++) markReceiptPrinted(`uuid-${i}`)
    markReceiptPrinted('uuid-24')
    expect(JSON.parse(localStorage.getItem('aq_receipt_printed_v1')!)).toHaveLength(10)
    expect(hasPrintedReceipt('uuid-24')).toBe(true)
  })

  it('survives junk in the key rather than throwing on the first screen a member sees', () => {
    localStorage.setItem('aq_receipt_printed_v1', 'not json')
    expect(hasPrintedReceipt('uuid-a')).toBe(false)
    markReceiptPrinted('uuid-a')
    expect(hasPrintedReceipt('uuid-a')).toBe(true)
  })
})
