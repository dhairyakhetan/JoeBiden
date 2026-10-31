// Pure aggregation helpers for the /accounts (Open Books) ledger. No
// Supabase, no React — every function here takes rows in and returns data
// out, so the whole pipeline is unit-testable against the PRD's §3.4
// fixtures without a network call. AccountsPage.tsx is the only caller.

export type LedgerFlow = 'in' | 'out'
export type LedgerSource = 'Bank' | 'Cash'

export interface LedgerRow {
  date: string // 'YYYY-MM-DD'
  category: string
  amount: number
  flow: LedgerFlow
  source: LedgerSource
  attribution: string
}

export interface LedgerFilter {
  category?: string | null
  attribution?: string | null
}

export interface CategoryTotal {
  category: string
  total: number
  byAttribution: Record<string, number>
}

export interface MonthlyRow {
  month: string // 'YYYY-MM'
  totalIn: number
  totalOut: number
  net: number
  count: number
}

/**
 * ₹ formatted the same way the approved reference does: rounded, en-IN
 * (lakh/crore) grouping. A negative amount gets the reference's own minus
 * glyph (−, not a hyphen) BEFORE the ₹ sign — "−₹47,764", matching
 * every negative figure on the approved reference page (net movement, owed
 * to suppliers, net position).
 */
export function formatINR(n: number): string {
  const rounded = Math.round(n)
  const sign = rounded < 0 ? '−' : ''
  return sign + '₹' + Math.abs(rounded).toLocaleString('en-IN')
}

/** Sum of `in`, `out`, their net, and the row count. */
export function ledgerTotals(rows: LedgerRow[]): { totalIn: number; totalOut: number; net: number; count: number } {
  let totalIn = 0
  let totalOut = 0
  for (const r of rows) {
    if (r.flow === 'in') totalIn += r.amount
    else totalOut += r.amount
  }
  return { totalIn, totalOut, net: totalIn - totalOut, count: rows.length }
}

/**
 * Rows of one flow ('in' or 'out'), summed per category, each carrying its
 * own per-attribution breakdown (the small tags under each bar). Categories
 * are ordered by `fixedOrder` first (the editorial ordering the PRD
 * requires — "bars do NOT sort by amount"), then any category not present
 * in `fixedOrder` is appended so nothing silently disappears if the data
 * ever carries a category the copy hasn't been written for yet.
 */
export function categoryTotals(rows: LedgerRow[], flow: LedgerFlow, fixedOrder: string[]): CategoryTotal[] {
  const byCategory = new Map<string, CategoryTotal>()
  for (const r of rows) {
    if (r.flow !== flow) continue
    let entry = byCategory.get(r.category)
    if (!entry) {
      entry = { category: r.category, total: 0, byAttribution: {} }
      byCategory.set(r.category, entry)
    }
    entry.total += r.amount
    entry.byAttribution[r.attribution] = (entry.byAttribution[r.attribution] || 0) + r.amount
  }
  const ordered: CategoryTotal[] = []
  for (const key of fixedOrder) {
    const entry = byCategory.get(key)
    if (entry) ordered.push(entry)
  }
  for (const [key, entry] of byCategory) {
    if (!fixedOrder.includes(key)) ordered.push(entry)
  }
  return ordered
}

/** Composes the category + attribution filters (PRD §4: "they compose"). */
export function filterRows(rows: LedgerRow[], filter: LedgerFilter): LedgerRow[] {
  const { category, attribution } = filter
  return rows.filter(r =>
    (!category || r.category === category) &&
    (!attribution || r.attribution === attribution))
}

/** Groups by `date.slice(0,7)`, ascending (PRD §4). */
export function monthlyGroups(rows: LedgerRow[]): MonthlyRow[] {
  const byMonth = new Map<string, MonthlyRow>()
  for (const r of rows) {
    const month = r.date.slice(0, 7)
    let entry = byMonth.get(month)
    if (!entry) {
      entry = { month, totalIn: 0, totalOut: 0, net: 0, count: 0 }
      byMonth.set(month, entry)
    }
    if (r.flow === 'in') entry.totalIn += r.amount
    else entry.totalOut += r.amount
    entry.net = entry.totalIn - entry.totalOut
    entry.count += 1
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

/** Distinct attributions present in `rows`, sorted alphabetically (for the filter select). */
export function distinctAttributions(rows: LedgerRow[]): string[] {
  return [...new Set(rows.map(r => r.attribution))].sort()
}

/** Distinct categories, income-first then expense, each in its own fixed order — matches the reference's filter select. */
export function categoriesForFilter(rows: LedgerRow[], incomeOrder: string[], expenseOrder: string[]): string[] {
  const present = new Set(rows.map(r => r.category))
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of [...incomeOrder, ...expenseOrder]) {
    if (present.has(key) && !seen.has(key)) { seen.add(key); out.push(key) }
  }
  for (const key of present) {
    if (!seen.has(key)) { seen.add(key); out.push(key) }
  }
  return out
}
