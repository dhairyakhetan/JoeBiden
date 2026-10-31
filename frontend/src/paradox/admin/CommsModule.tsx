// @ts-nocheck
// ─── Paradox OS · Phase 7 (UI) — Comms engine send surface ───────────────────
// The Message Bank, live: pick a brand-checked template, fill the tokens, get
// copy-paste-ready WhatsApp text with no unfilled placeholders, and log the
// send so nothing re-fires and no confirmation is ever missed. Sending is gated
// by the send_comms permission. Auto-fire templates (mode='auto') are marked so
// the team knows the system will send those on state changes (wired per flow).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'

const tokensOf = (body) => [...new Set([...String(body || '').matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]

export function CommsModule({ canSend = false, actorEmail = null }) {
  const { success, error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [templates, setTemplates] = useState([])
  const [log, setLog] = useState([])
  const [sel, setSel] = useState(null)
  const [vals, setVals] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const [tp, lg] = await Promise.all([
      supabase.from('paradox_message_templates').select('*').order('key'),
      supabase.from('paradox_message_log').select('*').order('created_at', { ascending: false }).limit(20),
    ])
    if (tp.error && (tp.error.code === '42P01' || /does not exist|schema cache/i.test(tp.error.message || ''))) { setNeedsSetup(true); setLoading(false); return }
    if (tp.error) { toastError('Load failed', tp.error.message); setLoading(false); return }
    setTemplates(tp.data || [])
    setLog(lg.error ? [] : (lg.data || []))
    setLoading(false)
  }, [toastError])
  useEffect(() => { load() }, [load])

  const select = (t) => { setSel(t); setVals(Object.fromEntries(tokensOf(t.body).map((k) => [k, '']))) }

  const rendered = useMemo(() => {
    if (!sel) return ''
    return String(sel.body).replace(/\{(\w+)\}/g, (_, k) => (vals[k]?.trim() ? vals[k].trim() : `{${k}}`))
  }, [sel, vals])
  const unfilled = useMemo(() => (sel ? tokensOf(sel.body).filter((k) => !vals[k]?.trim()) : []), [sel, vals])

  const copyAndLog = async () => {
    try { await navigator.clipboard.writeText(rendered) } catch { toastError('Clipboard blocked'); return }
    const { error } = await supabase.from('paradox_message_log').insert({
      template_key: sel.key, rendered_body: rendered, sent_by: actorEmail,
    }).select('id')
    if (error) { toastError('Logged copy failed', error.message); return }
    success('Copied + logged')
    load()
  }

  if (loading) return <div className="py-16 text-center font-mono text-sm opacity-60">loading comms…</div>
  if (needsSetup) return (
    <div className="px-4 sm:px-6 py-4"><div className="rounded-lg border-[1.5px] p-4 font-mono text-[12px]" style={{ borderColor: 'var(--c1)', background: 'rgba(255,67,56,0.08)' }}>
      <strong>Comms tables not found.</strong> Run <code>paradox_os_05_finance_comms.sql</code> in the Paradox SQL editor.
    </div></div>
  )

  return (
    <div className="px-4 sm:px-6 py-4">
      <h2 className="mb-1 font-display text-xl">Comms</h2>
      <p className="mb-4 font-mono text-[11px] opacity-50">Brand-checked templates · Paradox 4.0 / #Paradox2026 / no AI tone · every send logged</p>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.4fr)' }}>
        {/* Template list */}
        <div className="flex flex-col gap-1.5">
          {templates.map((t) => (
            <button key={t.id} onClick={() => select(t)}
              className="text-left rounded-lg border-[1.5px] px-3 py-2 transition-colors"
              style={{ borderColor: sel?.id === t.id ? 'var(--ink)' : 'var(--line, rgba(24,24,24,0.14))', background: sel?.id === t.id ? 'rgba(24,24,24,0.04)' : 'transparent' }}>
              <div className="flex items-center gap-2">
                <span className="font-display text-[13px]">{t.name}</span>
                <span className="rounded px-1.5 py-0.5 font-mono text-[8px] uppercase font-bold" style={{ background: t.mode === 'auto' ? 'rgba(26,122,74,0.14)' : 'rgba(24,24,24,0.08)', color: t.mode === 'auto' ? '#1a7a4a' : 'var(--ink)' }}>{t.mode}</span>
              </div>
              <div className="font-mono text-[10px] opacity-50">{t.when_to_send} · {t.audience}</div>
            </button>
          ))}
        </div>

        {/* Composer */}
        <div>
          {!sel ? <div className="font-mono text-[12px] opacity-50 py-8">Pick a template →</div> : (
            <>
              {tokensOf(sel.body).length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {tokensOf(sel.body).map((k) => (
                    <label key={k} className="flex flex-col gap-1">
                      <span className="font-mono text-[9px] uppercase opacity-50">{k}</span>
                      <input value={vals[k] || ''} onChange={(e) => setVals({ ...vals, [k]: e.target.value })}
                        placeholder={k} className="px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" style={{ borderColor: 'var(--line, rgba(24,24,24,0.2))', width: 130 }} />
                    </label>
                  ))}
                </div>
              )}
              <textarea readOnly value={rendered} rows={7}
                className="w-full rounded-lg border-[1.5px] p-3 font-body text-[13px] leading-relaxed" style={{ borderColor: 'var(--ink)', background: 'var(--bg)' }} />
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <button onClick={copyAndLog} disabled={!canSend || unfilled.length > 0}
                  title={!canSend ? 'needs send_comms permission' : unfilled.length ? 'fill all tokens first' : 'copy + log'}
                  className="rounded-lg px-3 py-2 font-mono text-[12px] min-h-[40px] disabled:opacity-50" style={{ background: 'var(--c2)', border: '1.5px solid var(--ink)' }}>
                  ⧉ Copy + log
                </button>
                {unfilled.length > 0 && <span className="font-mono text-[10px]" style={{ color: 'var(--c1)' }}>unfilled: {unfilled.join(', ')}</span>}
                {!canSend && <span className="font-mono text-[10px] opacity-50">view-only — needs send_comms</span>}
              </div>
            </>
          )}
        </div>
      </div>

      {log.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wide opacity-60">Recent sends (logged)</div>
          <div className="flex flex-col gap-1">
            {log.map((l) => (
              <div key={l.id} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="rounded px-1.5 py-0.5 text-[9px] uppercase font-bold shrink-0" style={{ background: 'rgba(24,24,24,0.08)' }}>{l.template_key}</span>
                <span className="flex-1 min-w-0 truncate opacity-70">{l.rendered_body}</span>
                <span className="opacity-40 shrink-0">{new Date(l.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default CommsModule
