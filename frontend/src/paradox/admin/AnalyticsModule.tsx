// @ts-nocheck
// ─── Paradox OS · Phase 12 — Analytics & post-mortem ─────────────────────────
// The post-mortem that this year had to be rebuilt from chat scrollback — filled
// in live from the same tables everything else writes. Per-event funnel
// (registered → paid → attended), conversion, no-show, and revenue (ledger if
// present, else an estimate from paid × parsed fee).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'

const inr = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN')
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)
const feeNum = (fee) => { const m = String(fee || '').replace(/[, ]/g, '').match(/\d+/); return m ? parseInt(m[0], 10) : 0 }

export function AnalyticsModule() {
  const { error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [regs, setRegs] = useState([])
  const [ledger, setLedger] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const [ev, rg, lg] = await Promise.all([
      supabase.from('paradox_events').select('id, name, fee').order('sort_order'),
      supabase.from('paradox_registrations').select('event_id, paid, attended'),
      supabase.from('paradox_ledger').select('sub_ledger, income, expenditure'),
    ])
    if (ev.error) { toastError('Load failed', ev.error.message); setLoading(false); return }
    setEvents(ev.data || [])
    setRegs(rg.data || [])
    setLedger(lg.error ? [] : (lg.data || []))
    setLoading(false)
  }, [toastError])
  useEffect(() => { load() }, [load])

  const { rows, totals, byLedger } = useMemo(() => {
    const m = new Map()
    for (const e of events) m.set(e.id, { id: e.id, name: e.name, fee: feeNum(e.fee), regs: 0, paid: 0, attended: 0 })
    for (const r of regs) {
      const row = m.get(r.event_id); if (!row) continue
      row.regs += 1; if (r.paid) row.paid += 1; if (r.attended) row.attended += 1
    }
    const rows = [...m.values()].map((r) => ({
      ...r,
      conv: pct(r.paid, r.regs),
      noShow: r.paid - r.attended > 0 ? r.paid - r.attended : 0,
      estRevenue: r.paid * r.fee,
    })).sort((a, b) => b.regs - a.regs)
    const totals = rows.reduce((t, r) => ({
      regs: t.regs + r.regs, paid: t.paid + r.paid, attended: t.attended + r.attended, est: t.est + r.estRevenue,
    }), { regs: 0, paid: 0, attended: 0, est: 0 })
    const lm = new Map()
    let income = 0, expenditure = 0
    for (const l of ledger) {
      income += Number(l.income) || 0; expenditure += Number(l.expenditure) || 0
      const k = l.sub_ledger || 'unsorted'; const c = lm.get(k) || { income: 0, expenditure: 0 }
      c.income += Number(l.income) || 0; c.expenditure += Number(l.expenditure) || 0; lm.set(k, c)
    }
    return { rows, totals: { ...totals, income, expenditure, net: income - expenditure }, byLedger: [...lm.entries()] }
  }, [events, regs, ledger])

  if (loading) return <div className="py-16 text-center font-mono text-sm opacity-60">crunching numbers…</div>

  return (
    <div className="px-4 sm:px-6 py-4">
      <h2 className="mb-3 font-display text-xl">Analytics &amp; post-mortem</h2>

      <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px,100%),1fr))' }}>
        <Stat label="Registrations" value={totals.regs} />
        <Stat label="Paid" value={totals.paid} sub={`${pct(totals.paid, totals.regs)}% conversion`} color={pct(totals.paid, totals.regs) < 60 ? 'var(--c1)' : '#1a7a4a'} />
        <Stat label="Attended" value={totals.attended} />
        <Stat label="Revenue (ledger)" value={inr(totals.income)} color="#1a7a4a" />
        <Stat label="Est. from paid" value={inr(totals.est)} sub="paid × fee" />
        <Stat label="Net (ledger)" value={inr(totals.net)} color={totals.net >= 0 ? '#1a7a4a' : 'var(--c1)'} />
      </div>

      {byLedger.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {byLedger.map(([k, v]) => (
            <span key={k} className="rounded-full border-[1.5px] px-3 py-1 font-mono text-[11px]" style={{ borderColor: 'var(--line, rgba(24,24,24,0.18))' }}>
              {k}: <strong style={{ color: v.income - v.expenditure >= 0 ? '#1a7a4a' : 'var(--c1)' }}>{inr(v.income - v.expenditure)}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="mb-2 font-mono text-[10px] uppercase tracking-wide opacity-60">Per-event funnel</div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 640 }}>
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wide opacity-60 text-left">
              <th className="py-2 pr-2">Event</th>
              <th className="py-2 px-2 text-center">Regs</th>
              <th className="py-2 px-2 text-center">Paid</th>
              <th className="py-2 px-2 text-center">Conv.</th>
              <th className="py-2 px-2 text-center">Attended</th>
              <th className="py-2 px-2 text-center">No-show</th>
              <th className="py-2 px-2 text-right">Est. rev</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--line, rgba(24,24,24,0.1))' }}>
                <td className="py-2 pr-2 font-display text-[13px]">{r.name}</td>
                <td className="py-2 px-2 text-center font-mono text-[12px] tabular-nums">{r.regs}</td>
                <td className="py-2 px-2 text-center font-mono text-[12px] tabular-nums">{r.paid}</td>
                <td className="py-2 px-2 text-center font-mono text-[12px] tabular-nums" style={{ color: r.conv < 60 ? 'var(--c1)' : '#1a7a4a' }}>{r.conv}%</td>
                <td className="py-2 px-2 text-center font-mono text-[12px] tabular-nums">{r.attended}</td>
                <td className="py-2 px-2 text-center font-mono text-[12px] tabular-nums" style={{ color: r.noShow ? '#a8380e' : 'inherit', opacity: r.noShow ? 1 : 0.4 }}>{r.noShow || '—'}</td>
                <td className="py-2 px-2 text-right font-mono text-[12px] tabular-nums">{r.estRevenue ? inr(r.estRevenue) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-mono text-[10px] opacity-50">Conversion under 60% flagged red — the "half of regs never paid" gap. Attended needs check-in (Phase 5) to be complete.</p>
    </div>
  )
}

function Stat({ label, value, sub, color }) {
  return (
    <div className="rounded-lg border-[1.5px] p-3" style={{ borderColor: 'var(--line, rgba(24,24,24,0.14))' }}>
      <div className="font-mono text-[10px] uppercase tracking-wide opacity-50">{label}</div>
      <div className="font-display text-lg tabular-nums" style={{ color: color || 'var(--ink)' }}>{value}</div>
      {sub && <div className="font-mono text-[9px] opacity-40">{sub}</div>}
    </div>
  )
}

export default AnalyticsModule
