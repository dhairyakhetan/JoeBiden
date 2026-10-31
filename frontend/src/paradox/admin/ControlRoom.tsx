// @ts-nocheck
// ─── Paradox OS · Phase 2 — Control Room + Event Workspace ───────────────────
// ONE screen that replaces the EventWise SUMMARY tab + the act of opening 11
// workbooks (Control Room), and ONE drill-in screen per event that replaces a
// 6-8-tab workbook (Event Workspace: Overview · Runbook · Requirements).
//
// Reads/writes the paradox_event_workspaces / paradox_runbook_steps /
// paradox_requirements tables created by frontend/scripts/paradox_os_01_schema.sql
// and seeded by paradox_os_02_seed_sample.sql. If those scripts haven't been
// run yet the component degrades to a clear setup banner instead of crashing.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { RUNBOOK_PHASE_LABELS } from '../lib/types'

const PHASES = ['reg', 'logistics', 'on_day', 'post'] as const

const STATUS_META = {
  draft:     { label: 'draft',     color: 'var(--ink)',  bg: 'rgba(24,24,24,0.08)' },
  greenlit:  { label: 'greenlit',  color: '#1a7a4a',     bg: 'rgba(26,122,74,0.12)' },
  live:      { label: 'live',      color: 'var(--c1)',   bg: 'rgba(255,67,56,0.12)' },
  done:      { label: 'done',      color: '#6a6a66',     bg: 'rgba(106,106,102,0.12)' },
  cancelled: { label: 'cancelled', color: '#a8380e',     bg: 'rgba(168,56,14,0.12)' },
}

const isMissingTable = (err) =>
  !!err && (err.code === '42P01' || /does not exist|schema cache/i.test(err.message || ''))

export function ControlRoom() {
  const { success, error: toastError } = useToast()
  const [loading, setLoading] = useState(true)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [events, setEvents] = useState([])          // paradox_events
  const [workspaces, setWorkspaces] = useState([])  // paradox_event_workspaces
  const [steps, setSteps] = useState([])            // paradox_runbook_steps
  const [reqs, setReqs] = useState([])              // paradox_requirements
  const [regs, setRegs] = useState([])              // paradox_registrations (slim)
  const [autolog, setAutolog] = useState([])        // paradox_automation_log (Phase 3)
  const [ticking, setTicking] = useState(false)
  const [selected, setSelected] = useState(null)    // drilled-in event id

  const load = useCallback(async () => {
    setLoading(true)
    const [evRes, wsRes, stRes, rqRes, rgRes, alRes] = await Promise.all([
      supabase.from('paradox_events').select('id, name, slug, date, active, max_participants, fee').order('sort_order'),
      supabase.from('paradox_event_workspaces').select('*'),
      supabase.from('paradox_runbook_steps').select('id, event_id, phase, task, owner, owner_role, due_offset, due_at, status, is_gate, auto_condition, depends_on, escalation_level, sort_order'),
      supabase.from('paradox_requirements').select('id, event_id, category, item, qty, source, owner, arranged, sort_order'),
      supabase.from('paradox_registrations').select('event_id, paid'),
      supabase.from('paradox_automation_log').select('id, event_id, kind, detail, level, created_at').order('created_at', { ascending: false }).limit(25),
    ])
    if (evRes.error) { toastError('Load failed', evRes.error.message); setLoading(false); return }
    // If the OS tables aren't created yet, flag setup but still show events.
    if (isMissingTable(wsRes.error) || isMissingTable(stRes.error) || isMissingTable(rqRes.error)) {
      setNeedsSetup(true)
    }
    setEvents(evRes.data || [])
    setWorkspaces(wsRes.data || [])
    setSteps(stRes.data || [])
    setReqs(rqRes.data || [])
    setRegs(rgRes.data || [])
    setAutolog(alRes.error ? [] : (alRes.data || []))
    setLoading(false)
  }, [toastError])

  // Phase 3 — run the enforcement heartbeat on demand (auto-progress + chase).
  // pg_cron runs it every 15 min server-side; this is the manual "run now".
  const runTick = async () => {
    setTicking(true)
    const { data, error } = await supabase.rpc('paradox_os_tick')
    setTicking(false)
    if (error) { toastError('Automation', error.message); return }
    success(typeof data === 'string' ? data : 'automation ran')
    load()
  }

  // Greenlight gate — commit an event to run (registrations may then open).
  const greenlight = async (eventId) => {
    if (!window.confirm('Greenlight this event?\n\nThis commits it to run and lets registrations open.')) return
    const { data, error } = await supabase.rpc('paradox_os_greenlight', { p_event: eventId })
    if (error) { toastError('Greenlight failed', error.message); return }
    success(typeof data === 'string' ? data : 'greenlit')
    load()
  }

  useEffect(() => { load() }, [load])

  // Per-event roll-up for the Control Room table.
  const rows = useMemo(() => {
    const wsByEvent = new Map(workspaces.map((w) => [w.event_id, w]))
    const stepByEvent = new Map()
    for (const s of steps) { const a = stepByEvent.get(s.event_id) || []; a.push(s); stepByEvent.set(s.event_id, a) }
    const regByEvent = new Map()
    for (const r of regs) {
      const cur = regByEvent.get(r.event_id) || { total: 0, paid: 0 }
      cur.total += 1; if (r.paid) cur.paid += 1
      regByEvent.set(r.event_id, cur)
    }
    const now = Date.now()
    return events.map((e) => {
      const ws = wsByEvent.get(e.id)
      const evSteps = stepByEvent.get(e.id) || []
      const open = evSteps.filter((s) => s.status !== 'done')
      const blocked = evSteps.filter((s) => s.status === 'blocked').length
      const overdue = evSteps.filter((s) => s.status !== 'done' && s.due_at && new Date(s.due_at).getTime() < now).length
      const rc = regByEvent.get(e.id) || { total: 0, paid: 0 }
      const cfg = ws?.config || {}
      const breakeven = Number(cfg.breakeven) || null
      const cap = Number(cfg.cap) || Number(e.max_participants) || null
      const readyCount = ws ? [ws.head_confirmed, ws.rules_final, ws.fixtures_final, ws.judges_confirmed].filter(Boolean).length : 0
      return {
        ev: e, ws, status: ws?.status || (e.active ? 'live' : 'draft'),
        total: rc.total, paid: rc.paid, breakeven, cap,
        openCount: open.length, blocked, overdue, readyCount,
      }
    })
  }, [events, workspaces, steps, regs])

  const selectedRow = useMemo(() => rows.find((r) => r.ev.id === selected) || null, [rows, selected])

  // ── Mutations (optimistic + persist; the .select() guard catches RLS) ──────
  const setStepStatus = async (step, status) => {
    setSteps((prev) => prev.map((s) => (s.id === step.id ? { ...s, status } : s)))
    const patch = { status, completed_at: status === 'done' ? new Date().toISOString() : null }
    const { data, error } = await supabase.from('paradox_runbook_steps').update(patch).eq('id', step.id).select('id')
    if (error || !data?.length) { toastError('Save failed', error?.message || 'no row updated'); load() }
  }
  const toggleReq = async (req) => {
    const next = !req.arranged
    setReqs((prev) => prev.map((r) => (r.id === req.id ? { ...r, arranged: next } : r)))
    const { data, error } = await supabase.from('paradox_requirements')
      .update({ arranged: next, arranged_at: next ? new Date().toISOString() : null })
      .eq('id', req.id).select('id')
    if (error || !data?.length) { toastError('Save failed', error?.message || 'no row updated'); load() }
  }
  const setReadiness = async (ws, field, value) => {
    setWorkspaces((prev) => prev.map((w) => (w.id === ws.id ? { ...w, [field]: value } : w)))
    const { data, error } = await supabase.from('paradox_event_workspaces').update({ [field]: value }).eq('id', ws.id).select('id')
    if (error || !data?.length) { toastError('Save failed', error?.message || 'no row updated'); load() }
    else success('Saved')
  }

  if (loading) {
    return <div className="py-16 text-center font-mono text-sm opacity-60">loading control room…</div>
  }

  return (
    <div>
      {needsSetup && (
        <div className="mb-4 rounded-lg border-[1.5px] p-4 font-mono text-[12px]" style={{ borderColor: 'var(--c1)', background: 'rgba(255,67,56,0.08)' }}>
          <strong>Paradox OS tables not found.</strong> Run{' '}
          <code>frontend/scripts/paradox_os_01_schema.sql</code> then{' '}
          <code>paradox_os_02_seed_sample.sql</code> in the Paradox SQL editor to
          activate the Event Workspace + Control Room. Showing events read-only meanwhile.
        </div>
      )}

      {!selectedRow ? (
        // ── CONTROL ROOM (cross-event command view) ──────────────────────────
        <>
          <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-display text-xl">Control Room</h2>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] opacity-60 tabular-nums">{rows.length} events · no spreadsheets</span>
              <button
                onClick={runTick}
                disabled={ticking}
                title="Run the enforcement heartbeat now (auto-progress + chase). pg_cron also runs it every 15 min."
                className="rounded-lg border-[1.5px] px-3 py-1.5 font-mono text-[11px] min-h-[36px] active:scale-[0.97] transition-transform disabled:opacity-50"
                style={{ borderColor: 'var(--ink)' }}
              >
                {ticking ? 'running…' : '↻ run automation'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 720 }}>
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-wide opacity-60 text-left">
                  <th className="py-2 pr-3">Event</th>
                  <th className="py-2 px-2 text-center">Status</th>
                  <th className="py-2 px-2 text-center">Regs</th>
                  <th className="py-2 px-2 text-center">Paid</th>
                  <th className="py-2 px-2 text-center">Breakeven</th>
                  <th className="py-2 px-2 text-center">Ready</th>
                  <th className="py-2 px-2 text-center">Open</th>
                  <th className="py-2 px-2 text-center">Flags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const sm = STATUS_META[r.status] || STATUS_META.draft
                  const beHit = r.breakeven ? r.paid >= r.breakeven : null
                  return (
                    <tr
                      key={r.ev.id}
                      onClick={() => setSelected(r.ev.id)}
                      className="cursor-pointer border-t hover:bg-ink/[0.03] transition-colors"
                      style={{ borderColor: 'var(--line, rgba(24,24,24,0.1))' }}
                    >
                      <td className="py-2.5 pr-3 font-display text-[13px]">{r.ev.name}</td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase" style={{ color: sm.color, background: sm.bg }}>{sm.label}</span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-[12px] tabular-nums">{r.total}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-[12px] tabular-nums">{r.paid}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-[11px] tabular-nums">
                        {r.breakeven ? (
                          <span style={{ color: beHit ? '#1a7a4a' : 'var(--ink)' }}>{r.paid}/{r.breakeven}{beHit ? ' ✓' : ''}</span>
                        ) : <span className="opacity-40">—</span>}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono text-[11px] tabular-nums">{r.readyCount}/4</td>
                      <td className="py-2.5 px-2 text-center font-mono text-[12px] tabular-nums">{r.openCount}</td>
                      <td className="py-2.5 px-2 text-center font-mono text-[10px]">
                        {r.overdue > 0 && <span className="mr-1" style={{ color: 'var(--c1)' }} title="overdue steps">⏰{r.overdue}</span>}
                        {r.blocked > 0 && <span style={{ color: '#a8380e' }} title="blocked steps">⛔{r.blocked}</span>}
                        {r.overdue === 0 && r.blocked === 0 && <span className="opacity-30">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* What the system did — observability for the enforcement engine. */}
          {autolog.length > 0 && (
            <div className="mt-5">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wide opacity-60">What the system did · recent</div>
              <div className="flex flex-col gap-1">
                {autolog.slice(0, 12).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="rounded px-1.5 py-0.5 text-[9px] uppercase font-bold shrink-0" style={{
                      background: a.kind === 'escalate' ? 'rgba(168,56,14,0.14)' : a.kind === 'chase' ? 'rgba(255,67,56,0.12)' : 'rgba(26,122,74,0.12)',
                      color: a.kind === 'escalate' ? '#a8380e' : a.kind === 'chase' ? 'var(--c1)' : '#1a7a4a',
                    }}>{a.kind}</span>
                    <span className="flex-1 min-w-0 truncate opacity-80">{a.detail}</span>
                    <span className="opacity-50 shrink-0">{new Date(a.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        // ── EVENT WORKSPACE (drill-in: Overview · Runbook · Requirements) ────
        <EventWorkspace
          row={selectedRow}
          steps={steps.filter((s) => s.event_id === selected)}
          reqs={reqs.filter((r) => r.event_id === selected)}
          onBack={() => setSelected(null)}
          onSetStepStatus={setStepStatus}
          onToggleReq={toggleReq}
          onSetReadiness={setReadiness}
          onGreenlight={greenlight}
        />
      )}
    </div>
  )
}

function EventWorkspace({ row, steps, reqs, onBack, onSetStepStatus, onToggleReq, onSetReadiness, onGreenlight }) {
  const { ev, ws, status, total, paid, breakeven, cap } = row
  const cfg = ws?.config || {}
  const sm = STATUS_META[status] || STATUS_META.draft
  const READINESS = [
    ['head_confirmed', 'Head confirmed'],
    ['rules_final', 'Rules & rubric final'],
    ['fixtures_final', 'Fixtures final'],
    ['judges_confirmed', 'Judges confirmed'],
  ]
  const overview = [
    ['Venue', cfg.venue], ['Date', cfg.date], ['Time', cfg.time],
    ['Entry fee', cfg.entry_fee], ['Team size', cfg.team_size], ['Format', cfg.format],
    ['Cap', cap], ['Breakeven', breakeven], ['Prize split', cfg.prize_split],
  ].filter(([, v]) => v != null && v !== '')

  return (
    <div>
      <button onClick={onBack} className="mb-3 font-mono text-[12px] opacity-70 hover:opacity-100">← Control Room</button>
      <div className="mb-4 flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="font-display text-2xl">{ev.name}</h2>
        <div className="flex items-center gap-2">
          {status === 'draft' && (
            <button
              onClick={() => onGreenlight(ev.id)}
              title="Greenlight — commit the event to run so registrations can open"
              className="rounded-lg border-[1.5px] px-3 py-1.5 font-mono text-[11px] min-h-[36px] active:scale-[0.97] transition-transform"
              style={{ borderColor: '#1a7a4a', color: '#1a7a4a' }}
            >✓ Greenlight</button>
          )}
          <span className="inline-block rounded-full px-3 py-1 font-mono text-[11px] font-bold uppercase" style={{ color: sm.color, background: sm.bg }}>{sm.label}</span>
        </div>
      </div>

      {/* Readiness header */}
      <div className="mb-5 flex flex-wrap gap-2">
        {READINESS.map(([field, label]) => {
          const on = !!ws?.[field]
          return (
            <button
              key={field}
              disabled={!ws}
              onClick={() => ws && onSetReadiness(ws, field, !on)}
              className="rounded-lg border-[1.5px] px-3 py-2 font-mono text-[11px] min-h-[40px] transition-colors disabled:opacity-40"
              style={{ borderColor: on ? '#1a7a4a' : 'var(--line, rgba(24,24,24,0.18))', background: on ? 'rgba(26,122,74,0.12)' : 'transparent', color: on ? '#1a7a4a' : 'var(--ink)' }}
            >
              {on ? '✓ ' : '○ '}{label}
            </button>
          )
        })}
      </div>

      {/* Overview */}
      <Section title="Overview">
        {overview.length ? (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(160px,100%), 1fr))' }}>
            {overview.map(([k, v]) => (
              <div key={k}>
                <div className="font-mono text-[10px] uppercase tracking-wide opacity-50">{k}</div>
                <div className="font-display text-[14px]">{String(v)}</div>
              </div>
            ))}
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wide opacity-50">Registrations</div>
              <div className="font-display text-[14px] tabular-nums">{paid} paid · {total} total{cap ? ` · cap ${cap}` : ''}</div>
            </div>
          </div>
        ) : <Empty>No overview config yet.</Empty>}
      </Section>

      {/* Runbook */}
      <Section title="Runbook">
        {steps.length ? PHASES.map((ph) => {
          const list = steps.filter((s) => s.phase === ph).sort((a, b) => a.sort_order - b.sort_order)
          if (!list.length) return null
          return (
            <div key={ph} className="mb-4">
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wide opacity-60">{RUNBOOK_PHASE_LABELS[ph]}</div>
              <div className="flex flex-col gap-1.5">
                {list.map((s) => {
                  const done = s.status === 'done'
                  return (
                    <div key={s.id} className="flex items-center gap-3 rounded-lg border-[1.5px] px-3 py-2" style={{ borderColor: 'var(--line, rgba(24,24,24,0.12))', opacity: done ? 0.6 : 1 }}>
                      <button
                        onClick={() => onSetStepStatus(s, done ? 'todo' : 'done')}
                        className="shrink-0 rounded-md w-6 h-6 grid place-items-center font-bold"
                        style={{ border: '1.5px solid var(--ink)', background: done ? 'var(--c2)' : 'transparent' }}
                        title={done ? 'Mark not done' : 'Mark done'}
                      >{done ? '✓' : ''}</button>
                      <div className="flex-1 min-w-0">
                        <div className="font-body text-[13px]" style={{ textDecoration: done ? 'line-through' : 'none' }}>
                          {s.is_gate && <span title="Gate — blocks the event until done" style={{ color: 'var(--c1)' }}>⦿ </span>}{s.task}
                        </div>
                        <div className="font-mono text-[10px] opacity-50">
                          {s.owner || s.owner_role || 'unassigned'}{s.due_offset ? ` · ${s.due_offset}` : ''}{s.auto_condition ? ` · auto: ${s.auto_condition}` : ''}
                        </div>
                      </div>
                      {!done && (
                        <button
                          onClick={() => onSetStepStatus(s, s.status === 'blocked' ? 'todo' : 'blocked')}
                          className="shrink-0 font-mono text-[10px] rounded px-2 py-1"
                          style={{ color: s.status === 'blocked' ? '#fff' : '#a8380e', background: s.status === 'blocked' ? '#a8380e' : 'transparent', border: '1px solid #a8380e' }}
                        >{s.status === 'blocked' ? 'blocked' : 'block'}</button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        }) : <Empty>No runbook yet — run the seed script to scaffold it.</Empty>}
      </Section>

      {/* Requirements */}
      <Section title="Requirements">
        {reqs.length ? (
          <div className="flex flex-col gap-1.5">
            {[...reqs].sort((a, b) => a.sort_order - b.sort_order).map((r) => (
              <label key={r.id} className="flex items-center gap-3 rounded-lg border-[1.5px] px-3 py-2 cursor-pointer" style={{ borderColor: 'var(--line, rgba(24,24,24,0.12))' }}>
                <input type="checkbox" checked={!!r.arranged} onChange={() => onToggleReq(r)} className="w-5 h-5" style={{ accentColor: 'var(--c2)' }} />
                <span className="flex-1 min-w-0 font-body text-[13px]" style={{ textDecoration: r.arranged ? 'line-through' : 'none', opacity: r.arranged ? 0.6 : 1 }}>
                  {r.item}{r.qty ? ` · ${r.qty}` : ''}
                </span>
                <span className="font-mono text-[10px] opacity-50 shrink-0">{r.category || ''}{r.source ? ` · ${r.source}` : ''}</span>
              </label>
            ))}
          </div>
        ) : <Empty>No requirements yet.</Empty>}
      </Section>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 font-display text-lg border-b-[1.5px] pb-1" style={{ borderColor: 'var(--ink)' }}>{title}</h3>
      {children}
    </section>
  )
}
function Empty({ children }) {
  return <div className="font-mono text-[12px] opacity-50 py-2">{children}</div>
}

export default ControlRoom
