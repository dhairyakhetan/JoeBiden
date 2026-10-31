import '../styles/routes/accounts.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { ORG_FACTS } from '../lib/orgFacts'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { Reveal, RevealGroup } from '../components/Reveal'
import {
  categoriesForFilter,
  categoryTotals,
  distinctAttributions,
  filterRows,
  formatINR,
  ledgerTotals,
  monthlyGroups,
  type LedgerRow,
} from '../lib/ledgerAggregations'
import {
  ASSETS,
  ASSETS_TOTAL,
  BALANCE_SHEET,
  CATEGORY_DESCRIPTIONS,
  CURRENT_FY,
  EXPENSE_ORDER,
  INCOME_ORDER,
  OTHER_INCOME_ORDER,
  PERIOD_LABEL,
  REVENUE_ORDER,
} from '../lib/ledgerConfig'

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 'YYYY-MM' -> 'Apr 26' */
function monthLabel(month: string): string {
  const [y, m] = month.split('-')
  return `${MONTH_ABBR[Number(m) - 1] || month} ${y.slice(2)}`
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** Explicit +/− prefix for the month table's In/Out/Net cells (the reference's own `amtCell`/net convention — always signed, unlike formatINR's plain positive). A zero renders as an em dash, never ₹0 (PRD §4). */
function signedCell(v: number, sign: '+' | '−'): React.ReactNode {
  if (v === 0) return <span className="acc-zero">&mdash;</span>
  return (sign === '−' ? '−' : '+') + formatINR(Math.abs(v))
}

/** "Suggest a saving on this line" — write-only to the public (PRD §6). Always shows the same confirmation whether the insert succeeded or failed; a failure is logged, never surfaced to the visitor. */
function ExpenseComment({ category }: { category: string }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const formId = `acc-cmt-${slugify(category)}`

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || submitting) return
    setSubmitting(true)
    try {
      // No `.select()` — there is deliberately no SELECT policy for anon on
      // ledger_comments (PRD §6), and chaining one here would error.
      const { error } = await supabase.from('ledger_comments').insert({ category, body })
      if (error) console.error('[AccountsPage] comment insert failed:', error)
    } catch (err) {
      console.error('[AccountsPage] comment insert threw:', err)
    } finally {
      setSubmitting(false)
      setOpen(false)
      setDone(true)
    }
  }, [category, text, submitting])

  if (done) return <p className="acc-cdone">Thank you. This is with the finance team.</p>

  return (
    <div className="acc-cmt">
      <button
        type="button"
        className="acc-cbtn"
        aria-expanded={open}
        aria-controls={formId}
        onClick={() => setOpen(o => !o)}
      >
        {open ? 'Close' : 'Suggest a saving on this line'}
      </button>
      {open && (
        <form className="acc-cform" id={formId} onSubmit={submit}>
          <label className="acc-clabel" htmlFor={`${formId}-input`}>Where could we spend this better?</label>
          <textarea
            id={`${formId}-input`}
            rows={3}
            required
            maxLength={2000}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="e.g. the generator could be shared across both event days"
          />
          <div className="acc-crow">
            <button type="submit" className="acc-csend" disabled={submitting || !text.trim()}>
              {submitting ? 'Sending…' : 'Send privately'}
            </button>
            <span className="acc-cnote">Only the finance team sees this.</span>
          </div>
        </form>
      )}
    </div>
  )
}

function LedgerBars({ rows, flow, order, commentable }: { rows: LedgerRow[]; flow: 'in' | 'out'; order: string[]; commentable: boolean }) {
  const flowTotal = useMemo(() => rows.filter(r => r.flow === flow).reduce((s, r) => s + r.amount, 0), [rows, flow])
  const cats = useMemo(() => categoryTotals(rows, flow, order), [rows, flow, order])

  return (
    <RevealGroup className="acc-bars">
      {cats.map((c, i) => {
        const pc = flowTotal > 0 ? (c.total / flowTotal) * 100 : 0
        const tags = Object.entries(c.byAttribution).sort((a, b) => b[1] - a[1])
        return (
          <Reveal key={c.category} delay={Math.min(i * 0.03, 0.4)} className={'acc-bar ' + flow}>
            <div className="acc-bar-fill" style={{ width: `${pc.toFixed(1)}%` }} />
            <div className="acc-bar-top">
              <span className="acc-bar-nm">{c.category} <span className="acc-bar-pc">{pc.toFixed(1)}%</span></span>
              <span className="acc-bar-am">{formatINR(c.total)}</span>
            </div>
            {CATEGORY_DESCRIPTIONS[c.category] && (
              <p className="acc-bar-desc">{CATEGORY_DESCRIPTIONS[c.category]}</p>
            )}
            <div className="acc-bar-tags">
              {tags.map(([attribution, amt]) => (
                <span key={attribution} className="acc-otag">{attribution} {formatINR(amt)}</span>
              ))}
            </div>
            {commentable && <ExpenseComment category={c.category} />}
          </Reveal>
        )
      })}
    </RevealGroup>
  )
}

export default function AccountsPage() {
  useMeta(pageMetadata.accounts)
  useJsonLd('accounts-breadcrumb', breadcrumbLd([['Home', '/'], ['Open Books', '/accounts']]))

  const [rows, setRows] = useState<LedgerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [category, setCategory] = useState('')
  const [attribution, setAttribution] = useState('')

  const loadLedger = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    ;(async () => {
      const { data, error } = await supabase
        .from('public_ledger')
        .select('date,category,amount,flow,source,attribution')
        .eq('fy', CURRENT_FY)
        .order('date', { ascending: true })
      if (error) throw error
      setRows(((data || []) as LedgerRow[]).map(r => ({ ...r, amount: Number(r.amount) })))
    })()
      .catch((e: unknown) => {
        console.error('[AccountsPage] ledger fetch failed:', e)
        setLoadError('Failed to load the ledger.')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(loadLedger, [loadLedger])

  const totals = useMemo(() => ledgerTotals(rows), [rows])
  const categoryOptions = useMemo(() => categoriesForFilter(rows, INCOME_ORDER, EXPENSE_ORDER), [rows])
  const attributionOptions = useMemo(() => distinctAttributions(rows), [rows])
  const filtered = useMemo(
    () => filterRows(rows, { category: category || null, attribution: attribution || null }),
    [rows, category, attribution],
  )
  const months = useMemo(() => monthlyGroups(filtered), [filtered])
  const filteredTotals = useMemo(() => ledgerTotals(filtered), [filtered])

  // Live totals cited inside the context caveats below, so they can never
  // drift from the bars above once the Finance Director adds a month's rows.
  const revenueRows = useMemo(
    () => rows.filter(r => r.flow === 'in' && REVENUE_ORDER.includes(r.category)),
    [rows],
  )
  const otherIncomeRows = useMemo(
    () => rows.filter(r => r.flow === 'in' && OTHER_INCOME_ORDER.includes(r.category)),
    [rows],
  )
  const welfareTotal = useMemo(
    () => rows.filter(r => r.flow === 'out' && r.category === 'Welfare, volunteer and on-ground logistics').reduce((s, r) => s + r.amount, 0),
    [rows],
  )
  const technologyTotal = useMemo(
    () => rows.filter(r => r.flow === 'out' && r.category === 'Technology').reduce((s, r) => s + r.amount, 0),
    [rows],
  )

  return (
    <div className="route-enter acc-page">
      <div className="container">
        <header className="acc-header">
          <p className="acc-kicker">AquaTerra &middot; Open Books</p>
          <h1 className="acc-h1">Every rupee in.<br />Every rupee <em>out</em>.</h1>
          <p className="acc-lede">
            We have been asked whether the money AquaTerra raises ends up in someone&rsquo;s
            pocket. This page is the answer. It is the full ledger for the current financial year, grouped
            plainly, with nothing summarised out of view.
          </p>
          <div className="acc-asof">
            <span className="acc-chip">{PERIOD_LABEL.fy}</span>
            <span className="acc-chip">{PERIOD_LABEL.range}</span>
            <span className="acc-chip">{loading ? '…' : rows.length} entries</span>
            <span className="acc-chip">Bank + cash, combined</span>
          </div>
        </header>

        {loadError ? (
          <ErrorState message="couldn't load the ledger." hint={loadError} onRetry={loadLedger} variant="block" />
        ) : loading ? (
          <div aria-busy="true" role="status" style={{ padding: '40px 0' }}>
            <span className="sr-only">Loading the ledger&hellip;</span>
            <div className="acc-tiles">
              {[0, 1].map(i => (
                <div key={i} className="acc-tile" style={{ background: 'var(--bg-2)', animation: 'aq-pulse 1.8s ease-in-out infinite' }} />
              ))}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="nothing here yet." hint="the ledger hasn't been published for this period." />
        ) : (
          <>
            <section className="acc-section">
              <p className="acc-kicker">The year so far</p>
              <h2 className="acc-h2">Money in, money out</h2>
              <div className="acc-tiles">
                <div className="acc-tile in">
                  <p className="acc-kicker">Money in</p>
                  <p className="acc-tile-v">{formatINR(totals.totalIn)}</p>
                  <p className="acc-tile-sub">Event tickets, and what CRFTD earns after covering its own costs.</p>
                </div>
                <div className="acc-tile out">
                  <p className="acc-kicker">Money out</p>
                  <p className="acc-tile-v">{formatINR(totals.totalOut)}</p>
                  <p className="acc-tile-sub">Welfare logistics, event production, prizes, refunds, technology.</p>
                </div>
              </div>
              <div className="acc-rows tight">
                <div className="acc-row">
                  <span className="acc-lbl">Net movement over the period</span>
                  <span className={'acc-amt' + (totals.net < 0 ? ' neg' : '')}>{formatINR(totals.net)}</span>
                </div>
              </div>
            </section>

            <section className="acc-section">
              <p className="acc-kicker">Position</p>
              <h2 className="acc-h2">What we hold, and what we owe</h2>
              <div className="acc-rows">
                <div className="acc-row">
                  <span className="acc-lbl">Funds held
                    <span className="acc-exp">Bank and cash, combined into a single figure. There is no second pot.</span>
                  </span>
                  <span className="acc-amt">{formatINR(BALANCE_SHEET.fundsHeld)}</span>
                </div>
                <div className="acc-row">
                  <span className="acc-lbl">Owed to suppliers
                    <span className="acc-exp">Merchandise stock received and not yet paid for.</span>
                  </span>
                  <span className="acc-amt neg">{formatINR(BALANCE_SHEET.owedToSuppliers)}</span>
                </div>
                <div className="acc-row total">
                  <span className="acc-lbl">Net position</span>
                  <span className="acc-amt neg">{formatINR(BALANCE_SHEET.netPosition)}</span>
                </div>
              </div>
            </section>

            <section className="acc-section">
              <p className="acc-kicker">Where it went</p>
              <h2 className="acc-h2">Expenses by category</h2>
              <div className="acc-callout">
                <p><strong>Think we are overspending somewhere?</strong> Leave a comment on any line below.
                  If you can see a way to use these funds more efficiently, we want to hear it. We read every
                  one, and we will either act on it or come back to you to ask for your help.</p>
                <p className="acc-fine">Comments go to the AquaTerra finance team only. They are not shown publicly on this page.</p>
              </div>
              <LedgerBars rows={rows} flow="out" order={EXPENSE_ORDER} commentable />
            </section>

            <section className="acc-section">
              <p className="acc-kicker">Where it came from</p>
              <h2 className="acc-h2">Revenue by source</h2>
              <LedgerBars rows={revenueRows} flow="in" order={REVENUE_ORDER} commentable={false} />
              <p className="acc-note">This is ticket revenue only. What it cost to run these events — venue,
                sound and lights, prizes, refunds and the rest — is broken down in expenses by category, above.</p>
            </section>

            <section className="acc-section">
              <p className="acc-kicker">Earned through ventures</p>
              <h2 className="acc-h2">Income</h2>
              <LedgerBars rows={otherIncomeRows} flow="in" order={OTHER_INCOME_ORDER} commentable={false} />
              <p className="acc-note">AquaTerra takes no donations and no external funding. Every rupee here was
                earned by selling something a student chose to buy.</p>
            </section>

            <section className="acc-section">
              <p className="acc-kicker">Assets</p>
              <h2 className="acc-h2">What AquaTerra owns</h2>
              <p className="acc-note">Things the organisation holds that are not cash. These are not counted in the
                figures above, which track money moving in and out. They are stated at what they cost, with no
                adjustment for depreciation, damage or loss, so the real resale value today is lower.</p>
              <RevealGroup className="acc-rows">
                {ASSETS.map((a, i) => (
                  <Reveal className="acc-row" key={a.label} delay={i * 0.03}>
                    <span className="acc-lbl">{a.label}
                      <span className="acc-exp">{a.description}</span>
                    </span>
                    <span className="acc-amt">{formatINR(a.value)}</span>
                  </Reveal>
                ))}
                <div className="acc-row total">
                  <span className="acc-lbl">Total assets held</span>
                  <span className="acc-amt">{formatINR(ASSETS_TOTAL)}</span>
                </div>
              </RevealGroup>
            </section>

            <section className="acc-section">
              <p className="acc-kicker">Month by month</p>
              <h2 className="acc-h2">How the ledger moved</h2>
              <p className="acc-note">The running track of the year. Filter by category or by event and venture to see
                how that one line moved across the months.</p>
              <div className="acc-controls">
                <select className="acc-select" aria-label="Filter by category" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="">All categories</option>
                  {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="acc-select" aria-label="Filter by event or venture" value={attribution} onChange={e => setAttribution(e.target.value)}>
                  <option value="">All events and ventures</option>
                  {attributionOptions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <span className="acc-count">{filtered.length} of {rows.length} entries</span>
              </div>
              <Reveal className="acc-tablewrap">
                <table className="acc-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th style={{ textAlign: 'right' }}>In</th>
                      <th style={{ textAlign: 'right' }}>Out</th>
                      <th style={{ textAlign: 'right' }}>Net movement</th>
                      <th style={{ textAlign: 'right' }}>Entries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.map(m => (
                      <tr key={m.month}>
                        <td className="d">{monthLabel(m.month)}</td>
                        <td className="a in">{signedCell(m.totalIn, '+')}</td>
                        <td className="a out">{signedCell(m.totalOut, '−')}</td>
                        <td className={'a ' + (m.net < 0 ? 'out' : 'in')}>{signedCell(m.net, m.net < 0 ? '−' : '+')}</td>
                        <td className="a n">{m.count}</td>
                      </tr>
                    ))}
                  </tbody>
                  {months.length > 0 && (
                    <tfoot>
                      <tr className="acc-tfoot">
                        <td>Total</td>
                        <td className="a in">{signedCell(filteredTotals.totalIn, '+')}</td>
                        <td className="a out">{signedCell(filteredTotals.totalOut, '−')}</td>
                        <td className={'a ' + (filteredTotals.net < 0 ? 'out' : 'in')}>{signedCell(filteredTotals.net, filteredTotals.net < 0 ? '−' : '+')}</td>
                        <td className="a n">{filtered.length}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {months.length === 0 && <div className="acc-empty">Nothing moved under that filter.</div>}
              </Reveal>
            </section>

            <section className="acc-section">
              <p className="acc-kicker">Context</p>
              <h2 className="acc-h2">A few things worth knowing</h2>
              <div className="acc-caveats">
                <div className="acc-cav">
                  <h3>Welfare runs on hours, not rupees</h3>
                  <p>{formatINR(welfareTotal)} sits under welfare, volunteer and on-ground logistics. A workshop costs
                    volunteer time and travel rather than budget, which is why the cash figure will always
                    look smaller than the work behind it. {ORG_FACTS.drivesWrittenUp} completed projects is what those hours bought.</p>
                </div>
                <div className="acc-cav">
                  <h3>Technology is an investment in what students build</h3>
                  <p>{formatINR(technologyTotal)} on software and hosting. AquaTerra is increasingly about handing students
                    the experience of building a real startup with a real team: CRFTD, ShikshAq and AQ Labs. That
                    takes tools, and tools cost money.</p>
                </div>
                <div className="acc-cav">
                  <h3>How the books are kept</h3>
                  <p>AquaTerra is a registered organisation and money is received into TerraRoots, our
                    registered entity. Every person who handles income or expenses on a regular basis is trained
                    to log them, and those entries are systematically tracked and tallied. Our books are audited
                    by a Chartered Accountant as required by compliance, and our transactions are reported to the
                    Income Tax Department.</p>
                </div>
              </div>
              <p className="acc-note">For context, the previous financial year closed with <span style={{ fontFamily: 'var(--code)', fontVariantNumeric: 'tabular-nums' }}>{formatINR(BALANCE_SHEET.priorFyClosingBalance)}</span> in hand.</p>
            </section>

            <footer className="acc-footnote">
              <p>Figures cover {PERIOD_LABEL.range} and are stated in Indian rupees. Questions about any
                single line on this page are welcome, and will be answered with the underlying entry.</p>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
