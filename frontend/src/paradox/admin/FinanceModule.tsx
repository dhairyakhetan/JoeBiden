// @ts-nocheck
// ─── Paradox OS · Phase 6 — Finance ledger + live P&L + refund queue ─────────
// One live ledger (the only place money is recorded), with personal-account
// flagging and reconciliation, a portfolio P&L (after-party = revenue hub), and
// the refund queue. Backed by paradox_ledger / paradox_refunds / paradox_pnl
// (frontend/scripts/paradox_os_05_finance_comms.sql). Editing gated by the
// edit_finance permission; refunds by issue_refund.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'

const SUBLEDGERS = ['event', 'afterparty', 'sponsorship', 'stalls', 'ops', 'refund']
const METHODS = ['upi', 'cash', 'bank', 'personal']
const inr = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN')
const blank = () => ({ entry_date: new Date().toISOString().slice(0, 10), description: '', sub_ledger: 'event', method: 'upi', income: '', expenditure: '', personal_account: false })

export function FinanceModule({ canEdit = false, actorEmail = null }) {
  const { success, error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [rows, setRows] = useState([])
  const [refunds, setRefunds] = useState([])
  const [form, setForm] = useState(blank())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [lg, rf] = await Promise.all([
      supabase.from('paradox_ledger').select('*').order('entry_date', { ascending: false }).limit(500),
      supabase.from('paradox_refunds').select('*').order('created_at', { ascending: false }).limit(200),
    ])
    if (lg.error && (lg.error.code === '42P01' || /does not exist|schema cache/i.test(lg.error.message || ''))) {
      setNeedsSetup(true); setLoading(false); return
    }
    if (lg.error) { toastError('Load failed', lg.error.message); setLoading(false); return }
    setRows(lg.data || [])
    setRefunds(rf.error ? [] : (rf.data || []))
    setLoading(false)
  }, [toastError])
  useEffect(() => { load() }, [load])

  // Live P&L roll-up (computed client-side from the ledger — single source).
  const pnl = useMemo(() => {
    const by = new Map()
    let income = 0, expenditure = 0, personal = 0, unrec = 0
    for (const r of rows) {
      income += Number(r.income) || 0
      expenditure += Number(r.expenditure) || 0
      if (r.personal_account) personal++
      if (!r.reconciled) unrec++
      const k = r.sub_ledger || 'unsorted'
      const cur = by.get(k) || { income: 0, expenditure: 0 }
      cur.income += Number(r.income) || 0; cur.expenditure += Number(r.expenditure) || 0
      by.set(k, cur)
    }
    return { income, expenditure, net: income - expenditure, personal, unrec, by: [...by.entries()] }
  }, [rows])

  const addRow = async () => {
    if (!form.description.trim()) { toastError('Need a description'); return }
    setSaving(true)
    const payload = {
      entry_date: form.entry_date, description: form.description.trim(), sub_ledger: form.sub_ledger,
      method: form.method, income: Number(form.income) || 0, expenditure: Number(form.expenditure) || 0,
      personal_account: !!form.personal_account || form.method === 'personal', created_by: actorEmail,
    }
    const { data, error } = await supabase.from('paradox_ledger').insert(payload).select('*')
    setSaving(false)
    if (error || !data?.length) { toastError('Save failed', error?.message || 'no row inserted'); return }
    setRows((prev) => [data[0], ...prev]); setForm(blank()); success('Ledger entry added')
  }

  const toggleReconciled = async (r) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, reconciled: !x.reconciled } : x)))
    const { data, error } = await supabase.from('paradox_ledger').update({ reconciled: !r.reconciled }).eq('id', r.id).select('id')
    if (error || !data?.length) { toastError('Save failed', error?.message || 'no row'); load() }
  }
  const markRefundPaid = async (rf) => {
    setRefunds((prev) => prev.map((x) => (x.id === rf.id ? { ...x, status: 'paid', issued_at: new Date().toISOString() } : x)))
    const { data, error } = await supabase.from('paradox_refunds').update({ status: 'paid', issued_by: actorEmail, issued_at: new Date().toISOString() }).eq('id', rf.id).select('id')
    if (error || !data?.length) { toastError('Save failed', error?.message || 'no row'); load() }
  }

  if (loading) return <div className="py-16 text-center font-mono text-sm opacity-60">loading finance…</div>
  if (needsSetup) return (
    <div className="rounded-lg border-[1.5px] p-4 font-mono text-[12px]" style={{ borderColor: 'var(--c1)', background: 'rgba(255,67,56,0.08)' }}>
      <strong>Finance tables not found.</strong> Run <code>paradox_os_05_finance_comms.sql</code> in the Paradox SQL editor to activate the ledger + P&L + refund queue.
    </div>
  )

  return (
    <div className="px-4 sm:px-6 py-4">
      <h2 className="mb-3 font-display text-xl">Finance · live P&amp;L</h2>

      {/* P&L summary */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(150px,100%),1fr))' }}>
        <Stat label="Income" value={inr(pnl.income)} color="#1a7a4a" />
        <Stat label="Expenditure" value={inr(pnl.expenditure)} color="#a8380e" />
        <Stat label="Net" value={inr(pnl.net)} color={pnl.net >= 0 ? '#1a7a4a' : 'var(--c1)'} />
        <Stat label="On personal a/c" value={pnl.personal} color={pnl.personal ? 'var(--c1)' : 'var(--ink)'} hint="should be 0" />
        <Stat label="Unreconciled" value={pnl.unrec} color={pnl.unrec ? '#a8380e' : 'var(--ink)'} />
      </div>
      {pnl.by.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          {pnl.by.map(([k, v]) => (
            <span key={k} className="rounded-full border-[1.5px] px-3 py-1 font-mono text-[11px]" style={{ borderColor: 'var(--line, rgba(24,24,24,0.18))' }}>
              {k}: <strong style={{ color: v.income - v.expenditure >= 0 ? '#1a7a4a' : 'var(--c1)' }}>{inr(v.income - v.expenditure)}</strong>
            </span>
          ))}
        </div>
      )}

      {/* Add row (gated) */}
      {canEdit && (
        <div className="mb-5 rounded-lg border-[1.5px] p-3 flex flex-wrap gap-2 items-end" style={{ borderColor: 'var(--ink)' }}>
          <Field label="Date"><input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} className="px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
          <Field label="Description" grow><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="what was this?" className="w-full px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
          <Field label="Sub-ledger"><select value={form.sub_ledger} onChange={(e) => setForm({ ...form, sub_ledger: e.target.value })} className="px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]">{SUBLEDGERS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Method"><select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]">{METHODS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Income"><input type="number" value={form.income} onChange={(e) => setForm({ ...form, income: e.target.value })} placeholder="0" className="w-20 px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
          <Field label="Expense"><input type="number" value={form.expenditure} onChange={(e) => setForm({ ...form, expenditure: e.target.value })} placeholder="0" className="w-20 px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
          <button onClick={addRow} disabled={saving} className="rounded-lg px-3 py-2 font-mono text-[12px] min-h-[36px]" style={{ background: 'var(--c2)', border: '1.5px solid var(--ink)' }}>{saving ? '…' : '+ add'}</button>
        </div>
      )}

      {/* Refund queue */}
      {refunds.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide opacity-60">Refund queue</div>
          <div className="flex flex-col gap-1.5">
            {refunds.map((rf) => (
              <div key={rf.id} className="flex items-center gap-3 rounded-lg border-[1.5px] px-3 py-2 font-mono text-[12px]" style={{ borderColor: 'var(--line, rgba(24,24,24,0.12))' }}>
                <span className="font-bold">{inr(rf.amount)}</span>
                <span className="flex-1 min-w-0 truncate opacity-80">{rf.reason}</span>
                <span className="rounded px-1.5 py-0.5 text-[9px] uppercase font-bold" style={{ background: rf.status === 'paid' ? 'rgba(26,122,74,0.12)' : 'rgba(255,67,56,0.12)', color: rf.status === 'paid' ? '#1a7a4a' : 'var(--c1)' }}>{rf.status}</span>
                {canEdit && rf.status === 'queued' && <button onClick={() => markRefundPaid(rf)} className="rounded px-2 py-1 text-[10px] border">mark paid</button>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ledger */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 720 }}>
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-wide opacity-60 text-left">
              <th className="py-2 pr-2">Date</th><th className="py-2 px-2">Description</th><th className="py-2 px-2">Ledger</th>
              <th className="py-2 px-2">Method</th><th className="py-2 px-2 text-right">In</th><th className="py-2 px-2 text-right">Out</th>
              <th className="py-2 px-2 text-center">Rec?</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t" style={{ borderColor: 'var(--line, rgba(24,24,24,0.1))', background: r.personal_account ? 'rgba(255,67,56,0.06)' : 'transparent' }}>
                <td className="py-2 pr-2 font-mono text-[11px] whitespace-nowrap">{r.entry_date}</td>
                <td className="py-2 px-2 text-[12px]">{r.description}{r.personal_account && <span className="ml-2 font-mono text-[9px] font-bold" style={{ color: 'var(--c1)' }}>⚠ PERSONAL A/C</span>}</td>
                <td className="py-2 px-2 font-mono text-[11px]">{r.sub_ledger}</td>
                <td className="py-2 px-2 font-mono text-[11px]">{r.method}</td>
                <td className="py-2 px-2 text-right font-mono text-[12px] tabular-nums" style={{ color: '#1a7a4a' }}>{r.income ? inr(r.income) : ''}</td>
                <td className="py-2 px-2 text-right font-mono text-[12px] tabular-nums" style={{ color: '#a8380e' }}>{r.expenditure ? inr(r.expenditure) : ''}</td>
                <td className="py-2 px-2 text-center">
                  <input type="checkbox" checked={!!r.reconciled} disabled={!canEdit} onChange={() => toggleReconciled(r)} style={{ accentColor: 'var(--c2)' }} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="py-8 text-center font-mono text-[12px] opacity-50">No ledger entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value, color, hint }) {
  return (
    <div className="rounded-lg border-[1.5px] p-3" style={{ borderColor: 'var(--line, rgba(24,24,24,0.14))' }}>
      <div className="font-mono text-[10px] uppercase tracking-wide opacity-50">{label}</div>
      <div className="font-display text-lg tabular-nums" style={{ color }}>{value}</div>
      {hint && <div className="font-mono text-[9px] opacity-40">{hint}</div>}
    </div>
  )
}
function Field({ label, children, grow }) {
  return (
    <label className="flex flex-col gap-1" style={{ flex: grow ? '1 1 180px' : '0 0 auto' }}>
      <span className="font-mono text-[9px] uppercase tracking-wide opacity-50">{label}</span>
      {children}
    </label>
  )
}

export default FinanceModule
