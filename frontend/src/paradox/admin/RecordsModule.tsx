// @ts-nocheck
// ─── Paradox OS — reusable editable-grid module (CRMs / logistics / vendors) ──
// A spreadsheet-like surface the team already understands, but backed by one
// source of truth with follow-up flags + status. Used for sponsors, schools,
// stalls, venues, logistics. Cells edit in place (text/num/date save on blur,
// bool/select on change), optimistic + .select() RLS guard. Defensive against
// the table not existing yet.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'

// columns: { key, label, type?: 'text'|'num'|'bool'|'select'|'date', options?: string[] }
// scope: optional {col: value} — filters rows to that scope and stamps it onto
// inserts (e.g. {event_id} for per-event rubrics).
export function RecordsModule({ table, title, subtitle, columns, canEdit = true, searchKeys = [], scope = null }) {
  const { success, error: toastError } = useToast()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const scopeKey = scope ? JSON.stringify(scope) : ''
  const load = useCallback(async () => {
    setLoading(true)
    let qy = supabase.from(table).select('*').order('created_at', { ascending: false }).limit(1000)
    if (scope) qy = qy.match(scope)
    const { data, error } = await qy
    if (error && (error.code === '42P01' || /does not exist|schema cache/i.test(error.message || ''))) { setNeedsSetup(true); setLoading(false); return }
    if (error) { toastError('Load failed', error.message); setLoading(false); return }
    setRows(data || []); setLoading(false)
  }, [table, toastError, scopeKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase(); if (!s) return rows
    const keys = searchKeys.length ? searchKeys : columns.map((c) => c.key)
    return rows.filter((r) => keys.some((k) => String(r[k] ?? '').toLowerCase().includes(s)))
  }, [rows, q, columns, searchKeys])

  const save = async (id, key, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)))
    const { data, error } = await supabase.from(table).update({ [key]: value }).eq('id', id).select('id')
    if (error || !data?.length) { toastError('Save failed', error?.message || 'no row'); load() }
  }
  const addRow = async () => {
    setBusy(true)
    const seed = { ...(scope || {}) }
    const firstText = columns.find((c) => !c.type || c.type === 'text')
    if (firstText) seed[firstText.key] = 'New'
    const { data, error } = await supabase.from(table).insert(seed).select('*')
    setBusy(false)
    if (error || !data?.length) { toastError('Add failed', error?.message || 'no row'); return }
    setRows((prev) => [data[0], ...prev]); success('Row added — fill it in')
  }
  const del = async (id) => {
    if (!window.confirm('Delete this row?')) return
    setRows((prev) => prev.filter((r) => r.id !== id))
    // `.select()` so an RLS-blocked (or otherwise no-op) delete surfaces as a
    // real error instead of leaving the row optimistically-vanished from the
    // UI while it still exists in the DB — same guard `save()` already has.
    const { data, error } = await supabase.from(table).delete().eq('id', id).select('id')
    if (error || !data?.length) { toastError('Delete failed', error?.message || 'no row — you may not have permission'); load() }
  }

  if (loading) return <div className="py-16 text-center font-mono text-sm opacity-60">loading {title}…</div>
  if (needsSetup) return (
    <div className="rounded-lg border-[1.5px] p-4 font-mono text-[12px]" style={{ borderColor: 'var(--c1)', background: 'rgba(255,67,56,0.08)' }}>
      <strong>{table} not found.</strong> Run <code>paradox_os_06_modules.sql</code> in the Paradox SQL editor.
    </div>
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-display text-lg">{title}</h3>
          {subtitle && <p className="font-mono text-[11px] opacity-50">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search…" className="px-3 py-1.5 rounded-lg border text-[12px]" style={{ borderColor: 'var(--line, rgba(24,24,24,0.2))' }} />
          <span className="font-mono text-[11px] opacity-50 tabular-nums">{filtered.length}</span>
          {canEdit && <button onClick={addRow} disabled={busy} className="rounded-lg px-3 py-1.5 font-mono text-[12px] min-h-[36px]" style={{ background: 'var(--c2)', border: '1.5px solid var(--ink)' }}>+ add</button>}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: Math.max(640, columns.length * 130) }}>
          <thead><tr className="font-mono text-[10px] uppercase tracking-wide opacity-60 text-left">
            {columns.map((c) => <th key={c.key} className="py-2 px-2">{c.label}</th>)}
            {canEdit && <th className="py-2 px-2"></th>}
          </tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t align-top" style={{ borderColor: 'var(--line, rgba(24,24,24,0.1))' }}>
                {columns.map((c) => <td key={c.key} className="py-1.5 px-2">{cell(r, c, canEdit, save)}</td>)}
                {canEdit && <td className="py-1.5 px-2"><button onClick={() => del(r.id)} title="delete" className="font-mono text-[12px]" style={{ color: '#a8380e' }}>✕</button></td>}
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={columns.length + 1} className="py-8 text-center font-mono text-[12px] opacity-50">nothing yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function cell(r, c, canEdit, save) {
  const v = r[c.key]
  const bd = { borderColor: 'var(--line, rgba(24,24,24,0.18))' }
  if (!canEdit) {
    if (c.type === 'bool') return v ? '✓' : '—'
    return <span className="font-body text-[12px]">{String(v ?? '')}</span>
  }
  if (c.type === 'bool') return <input type="checkbox" checked={!!v} onChange={(e) => save(r.id, c.key, e.target.checked)} style={{ accentColor: 'var(--c2)', width: 16, height: 16 }} />
  if (c.type === 'select') return (
    <select value={v ?? ''} onChange={(e) => save(r.id, c.key, e.target.value)} className="px-1.5 py-1 rounded border-[1.5px] border-ink/20text-[11px] font-mono" style={bd}>
      <option value=""></option>
      {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
  if (c.type === 'num') return <input type="number" defaultValue={v ?? ''} onBlur={(e) => { const n = e.target.value === '' ? null : Number(e.target.value); if (n !== v) save(r.id, c.key, n) }} className="w-20 px-1.5 py-1 rounded border-[1.5px] border-ink/20text-[12px]" style={bd} />
  if (c.type === 'date') return <input type="date" defaultValue={v ?? ''} onBlur={(e) => { if (e.target.value !== v) save(r.id, c.key, e.target.value || null) }} className="px-1.5 py-1 rounded border-[1.5px] border-ink/20text-[11px]" style={bd} />
  return <input defaultValue={v ?? ''} onBlur={(e) => { const t = e.target.value; if (t !== (v ?? '')) save(r.id, c.key, t || null) }} placeholder={c.label.toLowerCase()} className="w-full min-w-[110px] px-1.5 py-1 rounded border-[1.5px] border-ink/20text-[12px]" style={bd} />
}

export default RecordsModule
