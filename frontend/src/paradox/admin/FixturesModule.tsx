// @ts-nocheck
// ─── Paradox OS · Phase 8 — Fixtures generator (constraint-enforced) ─────────
// Generates a round-robin schedule and assigns it to time slots / courts under
// hard constraints, then REFUSES to publish a schedule that violates them:
//   • no team plays back-to-back (≥1 empty slot rest)
//   • no match inside the lunch window
//   • finals all on one court
// Publish-locks to paradox_fixtures with a version bump. Closes the back-to-back
// matches + fixture-mix-up apology from this year.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'

const hhmmToMin = (s) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null }
const minToHhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`

// Circle-method round robin → array of rounds; each round = [[a,b], …].
function roundRobin(teams) {
  const t = teams.slice()
  if (t.length % 2) t.push('__BYE__')
  const n = t.length, rounds = []
  for (let r = 0; r < n - 1; r++) {
    const pairs = []
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i]
      if (a !== '__BYE__' && b !== '__BYE__') pairs.push([a, b])
    }
    rounds.push(pairs)
    t.splice(1, 0, t.pop()) // rotate, keep first fixed
  }
  return rounds
}

// Greedy constraint-aware slot assignment.
function schedule(rounds, { courts, slotMin, startMin, lunchStart, lunchEnd }) {
  const lastRound = rounds.length - 1
  const matches = []
  rounds.forEach((pairs, ri) => pairs.forEach(([a, b]) => matches.push({ a, b, round: ri + 1, isFinal: ri === lastRound && rounds.length > 1 })))
  const remaining = matches.slice()
  const placed = []
  const teamLastSlot = {}
  const inLunch = (slot) => {
    if (lunchStart == null || lunchEnd == null) return false
    const t = startMin + slot * slotMin
    return t < lunchEnd && (t + slotMin) > lunchStart
  }
  let slot = 0
  const MAX = 500
  while (remaining.length && slot < MAX) {
    if (inLunch(slot)) { slot++; continue }
    const usedThisSlot = new Set()
    for (let court = 0; court < courts; court++) {
      const idx = remaining.findIndex((m) => {
        if (m.isFinal && court !== 0) return false           // finals → court 0
        if (!m.isFinal && remaining.some((x) => x.isFinal) && court === 0 && remaining.filter((x) => x.isFinal).length >= (courts)) { /* keep court 0 free near finals: soft, skip */ }
        if (usedThisSlot.has(m.a) || usedThisSlot.has(m.b)) return false
        if (teamLastSlot[m.a] === slot - 1 || teamLastSlot[m.b] === slot - 1) return false // rest gap
        return true
      })
      if (idx >= 0) {
        const m = remaining.splice(idx, 1)[0]
        placed.push({ ...m, slot, court, timeMin: startMin + slot * slotMin })
        usedThisSlot.add(m.a); usedThisSlot.add(m.b)
        teamLastSlot[m.a] = slot; teamLastSlot[m.b] = slot
      }
    }
    slot++
  }
  return { placed, unplaced: remaining }
}

function validate(placed, { lunchStart, lunchEnd, slotMin }) {
  const violations = []
  // back-to-back
  const byTeam = {}
  for (const m of placed) { (byTeam[m.a] ||= []).push(m.slot); (byTeam[m.b] ||= []).push(m.slot) }
  for (const [team, slots] of Object.entries(byTeam)) {
    const s = slots.sort((x, y) => x - y)
    for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] < 2) { violations.push(`${team} plays back-to-back (slots ${s[i - 1]}→${s[i]})`); break }
  }
  // lunch
  if (lunchStart != null && lunchEnd != null) {
    for (const m of placed) if (m.timeMin < lunchEnd && (m.timeMin + slotMin) > lunchStart) { violations.push(`A match falls in the lunch window (${minToHhmm(m.timeMin)})`); break }
  }
  // finals court
  const finals = placed.filter((m) => m.isFinal)
  if (finals.length && new Set(finals.map((m) => m.court)).size > 1) violations.push('Finals are split across courts (must be one court)')
  return violations
}

export function FixturesModule({ canEdit = false }) {
  const { success, error: toastError } = useToast()
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [teamsText, setTeamsText] = useState('')
  const [courts, setCourts] = useState(2)
  const [slotMin, setSlotMin] = useState(30)
  const [start, setStart] = useState('10:00')
  const [lunchS, setLunchS] = useState('13:00')
  const [lunchE, setLunchE] = useState('14:00')
  const [date, setDate] = useState('')
  const [gen, setGen] = useState(null)        // { placed, unplaced }
  const [published, setPublished] = useState([])
  const [needsSetup, setNeedsSetup] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { supabase.from('paradox_events').select('id,name').order('sort_order').then(({ data }) => setEvents(data || [])) }, [])

  const loadEvent = useCallback(async (id) => {
    setGen(null)
    const [regRes, fxRes] = await Promise.all([
      supabase.from('paradox_registrations').select('team_name, name').eq('event_id', id),
      supabase.from('paradox_fixtures').select('*').eq('event_id', id).order('slot_no'),
    ])
    if (fxRes.error && (fxRes.error.code === '42P01' || /does not exist/i.test(fxRes.error.message || ''))) { setNeedsSetup(true); return }
    const teams = [...new Set((regRes.data || []).map((r) => (r.team_name || r.name || '').trim()).filter(Boolean))]
    setTeamsText(teams.join('\n'))
    setPublished(fxRes.data || [])
  }, [])

  const teams = useMemo(() => teamsText.split('\n').map((s) => s.trim()).filter(Boolean), [teamsText])
  const opts = useMemo(() => ({ courts: Math.max(1, +courts || 1), slotMin: Math.max(5, +slotMin || 30), startMin: hhmmToMin(start) ?? 600, lunchStart: hhmmToMin(lunchS), lunchEnd: hhmmToMin(lunchE) }), [courts, slotMin, start, lunchS, lunchE])
  const violations = useMemo(() => (gen ? validate(gen.placed, opts) : []), [gen, opts])
  const canPublish = gen && gen.unplaced.length === 0 && violations.length === 0

  const generate = () => {
    if (teams.length < 2) { toastError('Need at least 2 teams'); return }
    setGen(schedule(roundRobin(teams), opts))
  }

  const publish = async () => {
    if (!canPublish) return
    setBusy(true)
    const ver = (published[0]?.version || 0) + 1
    // Replace this event's unpublished/old set, write the new published version.
    await supabase.from('paradox_fixtures').delete().eq('event_id', eventId)
    const rows = gen.placed.map((m) => ({
      event_id: eventId, round: `Round ${m.round}${m.isFinal ? ' (Final)' : ''}`, slot_no: m.slot,
      court: `Court ${m.court + 1}`, team_a: m.a, team_b: m.b,
      scheduled_at: date ? new Date(`${date}T${minToHhmm(m.timeMin)}:00`).toISOString() : null,
      status: 'scheduled', version: ver, published: true,
    }))
    const { error } = await supabase.from('paradox_fixtures').insert(rows)
    // mark fixtures_final on the workspace so the runbook gate auto-progresses
    await supabase.from('paradox_event_workspaces').update({ fixtures_final: true }).eq('event_id', eventId)
    setBusy(false)
    if (error) { toastError('Publish failed', error.message); return }
    success(`Published v${ver} — ${rows.length} fixtures`)
    loadEvent(eventId)
  }

  // NOTE: this hook must run on every render (before any early return) to keep
  // hook order stable — React's rules-of-hooks. It was previously declared after
  // the `needsSetup` early-return below, which made it conditional.
  const grid = useMemo(() => {
    if (!gen) return null
    const maxSlot = Math.max(0, ...gen.placed.map((m) => m.slot))
    const rows = []
    for (let s = 0; s <= maxSlot; s++) {
      const cells = []
      for (let c = 0; c < opts.courts; c++) {
        const m = gen.placed.find((x) => x.slot === s && x.court === c)
        cells.push(m)
      }
      if (cells.some(Boolean)) rows.push({ slot: s, time: minToHhmm(opts.startMin + s * opts.slotMin), cells })
    }
    return rows
  }, [gen, opts])

  if (needsSetup) return <div className="px-4 sm:px-6 py-4"><div className="rounded-lg border-[1.5px] p-4 font-mono text-[12px]" style={{ borderColor: 'var(--c1)', background: 'rgba(255,67,56,0.08)' }}><strong>Fixtures table not found.</strong> Run <code>paradox_os_06_modules.sql</code>.</div></div>

  return (
    <div className="px-4 sm:px-6 py-4">
      <h2 className="mb-1 font-display text-xl">Fixtures generator</h2>
      <p className="mb-4 font-mono text-[11px] opacity-50">Constraint-enforced · won't publish a schedule that breaks rest / lunch / finals rules</p>

      <div className="flex flex-wrap gap-2 items-end mb-3">
        <Field label="Event"><select value={eventId} onChange={(e) => { setEventId(e.target.value); loadEvent(e.target.value) }} className="px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]"><option value="">pick event…</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></Field>
        <Field label="Courts"><input type="number" value={courts} onChange={(e) => setCourts(e.target.value)} className="w-16 px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
        <Field label="Slot min"><input type="number" value={slotMin} onChange={(e) => setSlotMin(e.target.value)} className="w-16 px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
        <Field label="Start"><input value={start} onChange={(e) => setStart(e.target.value)} className="w-20 px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
        <Field label="Lunch"><div className="flex gap-1"><input value={lunchS} onChange={(e) => setLunchS(e.target.value)} className="w-16 px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /><input value={lunchE} onChange={(e) => setLunchE(e.target.value)} className="w-16 px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></div></Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
      </div>

      <Field label={`Teams (${teams.length}) — one per line, auto-filled from registrations`}>
        <textarea value={teamsText} onChange={(e) => setTeamsText(e.target.value)} rows={4} className="w-full rounded border-[1.5px] border-ink/20p-2 font-mono text-[12px]" placeholder="Team A&#10;Team B&#10;…" />
      </Field>

      <div className="flex items-center gap-2 my-3 flex-wrap">
        <button onClick={generate} className="rounded-lg px-3 py-2 font-mono text-[12px] min-h-[40px]" style={{ border: '1.5px solid var(--ink)' }}>⚙ Generate</button>
        {gen && (
          <button onClick={publish} disabled={!canEdit || !canPublish || busy}
            title={!canEdit ? 'needs edit_fixtures' : !canPublish ? 'fix violations / unplaced first' : 'publish + lock'}
            className="rounded-lg px-3 py-2 font-mono text-[12px] min-h-[40px] disabled:opacity-50" style={{ background: canPublish ? 'var(--c2)' : 'transparent', border: '1.5px solid var(--ink)' }}>
            {busy ? '…' : '🔒 Publish'}
          </button>
        )}
        {published.length > 0 && <span className="font-mono text-[11px]" style={{ color: '#1a7a4a' }}>published v{published[0].version} · {published.length} fixtures</span>}
      </div>

      {gen && violations.length > 0 && (
        <div className="mb-3 rounded-lg border-[1.5px] p-3 font-mono text-[12px]" style={{ borderColor: 'var(--c1)', background: 'rgba(255,67,56,0.08)' }}>
          <strong>Cannot publish — {violations.length} violation(s):</strong>
          <ul className="mt-1 list-disc pl-5">{violations.map((v, i) => <li key={i}>{v}</li>)}</ul>
        </div>
      )}
      {gen && gen.unplaced.length > 0 && (
        <div className="mb-3 font-mono text-[11px]" style={{ color: '#a8380e' }}>{gen.unplaced.length} match(es) couldn't be placed within constraints — add courts or widen the day.</div>
      )}
      {gen && violations.length === 0 && gen.unplaced.length === 0 && (
        <div className="mb-3 font-mono text-[11px]" style={{ color: '#1a7a4a' }}>✓ Valid schedule — no back-to-back, no lunch clash, finals on one court.</div>
      )}

      {grid && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: 480 }}>
            <thead><tr className="font-mono text-[10px] uppercase opacity-60"><th className="py-1 px-2 text-left">Time</th>{Array.from({ length: opts.courts }, (_, c) => <th key={c} className="py-1 px-2">Court {c + 1}</th>)}</tr></thead>
            <tbody>
              {grid.map((r) => (
                <tr key={r.slot} className="border-t" style={{ borderColor: 'var(--line, rgba(24,24,24,0.1))' }}>
                  <td className="py-1.5 px-2 font-mono text-[11px] tabular-nums">{r.time}</td>
                  {r.cells.map((m, c) => <td key={c} className="py-1.5 px-2 text-center font-body text-[12px]">{m ? <span>{m.a} <span className="opacity-40">v</span> {m.b}{m.isFinal && <span className="ml-1 font-mono text-[9px]" style={{ color: 'var(--c1)' }}>FINAL</span>}</span> : <span className="opacity-20">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return <label className="flex flex-col gap-1"><span className="font-mono text-[9px] uppercase tracking-wide opacity-50">{label}</span>{children}</label>
}

export default FixturesModule
