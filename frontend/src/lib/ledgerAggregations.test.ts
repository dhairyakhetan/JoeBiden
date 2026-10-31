import { describe, expect, it } from 'vitest'
import {
  categoriesForFilter,
  categoryTotals,
  distinctAttributions,
  filterRows,
  formatINR,
  ledgerTotals,
  monthlyGroups,
  type LedgerRow,
} from './ledgerAggregations'
import { EXPENSE_ORDER, INCOME_ORDER } from './ledgerConfig'
import fixtureRows from './__fixtures__/ledger-fy2026-27.json'

// The fixture is the full FY2026-27 ledger (149 rows) from the approved
// reference (accounts-reference.html's TX array) — the PRD's own §3.4 says
// to use these totals as test fixtures: "if the component's computed totals
// do not match, the data pipeline is wrong."
const ROWS = fixtureRows as LedgerRow[]

describe('ledgerTotals', () => {
  it('matches the PRD §3.4 totals: in 3,55,973 · out 4,03,737 · net -47,764 · 149 entries', () => {
    const { totalIn, totalOut, net, count } = ledgerTotals(ROWS)
    expect(Math.round(totalIn)).toBe(355973)
    expect(Math.round(totalOut)).toBe(403737)
    expect(Math.round(net)).toBe(-47764)
    expect(count).toBe(149)
  })
})

describe('categoryTotals', () => {
  it('matches the PRD §3.4 expense figures, in fixed editorial order', () => {
    const cats = categoryTotals(ROWS, 'out', EXPENSE_ORDER)
    expect(cats.map(c => c.category)).toEqual(EXPENSE_ORDER)
    const byName = Object.fromEntries(cats.map(c => [c.category, Math.round(c.total)]))
    expect(byName['Welfare, volunteer and on-ground logistics']).toBe(82829)
    expect(byName['Sound, lights and DJ']).toBe(89095)
    expect(byName['Venue and decor']).toBe(79868)
    expect(byName['Prizes and participant costs']).toBe(54350)
    expect(byName['Refunds issued to participants']).toBe(46902)
    expect(byName['Technology']).toBe(30844)
    expect(byName['Stationery and small furniture']).toBe(19615)
    expect(byName['Bank fees']).toBe(234)
  })

  it('matches the PRD §3.4 income figures, in fixed editorial order', () => {
    const cats = categoryTotals(ROWS, 'in', INCOME_ORDER)
    expect(cats.map(c => c.category)).toEqual(INCOME_ORDER)
    const byName = Object.fromEntries(cats.map(c => [c.category, Math.round(c.total)]))
    expect(byName['Event ticket sales']).toBe(345414)
    expect(byName['Contribution from CRFTD']).toBe(10559)
  })

  it('is NOT sorted by amount — Welfare stays first even though Sound/lights/DJ is larger', () => {
    const cats = categoryTotals(ROWS, 'out', EXPENSE_ORDER)
    expect(cats[0].category).toBe('Welfare, volunteer and on-ground logistics')
    expect(cats[0].total).toBeLessThan(cats[1].total)
  })

  it('appends a category absent from the fixed order rather than dropping it', () => {
    const rows: LedgerRow[] = [
      { date: '2026-04-01', category: 'Mystery Fees', amount: 100, flow: 'out', source: 'Bank', attribution: 'Organisation' },
      { date: '2026-04-02', category: 'Bank fees', amount: 50, flow: 'out', source: 'Bank', attribution: 'Organisation' },
    ]
    const cats = categoryTotals(rows, 'out', EXPENSE_ORDER)
    expect(cats.map(c => c.category)).toEqual(['Bank fees', 'Mystery Fees'])
  })

  it('breaks each category total down by attribution', () => {
    const cats = categoryTotals(ROWS, 'out', EXPENSE_ORDER)
    const welfare = cats.find(c => c.category === 'Welfare, volunteer and on-ground logistics')!
    expect(welfare.byAttribution.Welfare).toBeGreaterThan(0)
    expect(Object.values(welfare.byAttribution).reduce((a, b) => a + b, 0)).toBeCloseTo(welfare.total, 5)
  })
})

describe('monthlyGroups', () => {
  it('groups by YYYY-MM, ascending, and a totals row equals the grand total', () => {
    const months = monthlyGroups(ROWS)
    expect(months[0].month).toBe('2026-04')
    expect(months[months.length - 1].month).toBe('2026-08')
    for (let i = 1; i < months.length; i++) expect(months[i].month > months[i - 1].month).toBe(true)
    const { totalIn, totalOut } = ledgerTotals(ROWS)
    expect(Math.round(months.reduce((s, m) => s + m.totalIn, 0))).toBe(Math.round(totalIn))
    expect(Math.round(months.reduce((s, m) => s + m.totalOut, 0))).toBe(Math.round(totalOut))
    expect(months.reduce((s, m) => s + m.count, 0)).toBe(149)
  })

  it('nets in - out per month', () => {
    const months = monthlyGroups(ROWS)
    for (const m of months) expect(m.net).toBeCloseTo(m.totalIn - m.totalOut, 5)
  })
})

describe('filterRows', () => {
  it('composes category and attribution filters (AND, not OR)', () => {
    const both = filterRows(ROWS, { category: 'Sound, lights and DJ', attribution: 'Paradox' })
    expect(both.length).toBeGreaterThan(0)
    expect(both.every(r => r.category === 'Sound, lights and DJ' && r.attribution === 'Paradox')).toBe(true)

    const categoryOnly = filterRows(ROWS, { category: 'Sound, lights and DJ' })
    expect(categoryOnly.length).toBeGreaterThanOrEqual(both.length)
  })

  it('returns everything when no filter is set', () => {
    expect(filterRows(ROWS, {})).toHaveLength(149)
    expect(filterRows(ROWS, { category: null, attribution: null })).toHaveLength(149)
  })

  it('returns an empty array for a filter combination that matches nothing', () => {
    expect(filterRows(ROWS, { category: 'Bank fees', attribution: 'Welfare' })).toHaveLength(0)
  })
})

describe('distinctAttributions', () => {
  it('lists every attribution present, sorted', () => {
    expect(distinctAttributions(ROWS)).toEqual(['CRFTD', 'Organisation', 'Paradox', 'Terrathon', 'Welfare'])
  })
})

describe('categoriesForFilter', () => {
  it('lists income first, then expense, each in its own fixed order', () => {
    const cats = categoriesForFilter(ROWS, INCOME_ORDER, EXPENSE_ORDER)
    expect(cats[0]).toBe('Event ticket sales')
    expect(cats[1]).toBe('Contribution from CRFTD')
    expect(cats.slice(2)).toEqual(EXPENSE_ORDER)
  })
})

describe('formatINR', () => {
  it('rounds and groups using the en-IN (lakh/crore) convention', () => {
    expect(formatINR(355972.58)).toBe('₹3,55,973')
    expect(formatINR(234)).toBe('₹234')
    expect(formatINR(-47764.27)).toBe('−₹47,764')
  })
})
