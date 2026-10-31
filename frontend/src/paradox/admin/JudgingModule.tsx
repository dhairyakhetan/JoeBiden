// @ts-nocheck
// ─── Paradox OS · Phase 9 — Rubric & Judging + Certificates ──────────────────
// Pre-published weighted rubric, mobile score entry (odd panel via multiple
// judge rows), auto-aggregated leaderboard with tie handling, blind mode for
// photography, a publish_results-gated push to paradox_winners (feeds the public
// Winners/Scores page), and on-the-fly certificate generation (canvas→PNG, no
// new dependency) with runner-up + participation ON by default.
// Closes: photography dispute, "biased" Shark Tank / "be more fair" Dream Deck.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'
import { RecordsModule } from './RecordsModule'

export function JudgingModule({ canPublish = false }) {
  const { success, error: toastError } = useToast()
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [eventName, setEventName] = useState('')
  const [rubrics, setRubrics] = useState([])
  const [scores, setScores] = useState([])
  const [winners, setWinners] = useState([])
  const [reveal, setReveal] = useState(false)
  const [judge, setJudge] = useState('')
  const [team, setTeam] = useState('')
  const [entry, setEntry] = useState({})   // rubric_id -> score
  const [busy, setBusy] = useState(false)

  useEffect(() => { supabase.from('paradox_events').select('id,name').order('sort_order').then(({ data }) => setEvents(data || [])) }, [])

  const loadEvent = useCallback(async (id, name) => {
    setEventId(id); setEventName(name); setReveal(false)
    const [rb, sc, wn] = await Promise.all([
      supabase.from('paradox_judging_rubrics').select('*').eq('event_id', id).order('sort_order'),
      supabase.from('paradox_judging_scores').select('*').eq('event_id', id),
      supabase.from('paradox_winners').select('*').eq('event_id', id).order('rank'),
    ])
    setRubrics(rb.data || []); setScores(sc.data || []); setWinners(wn.data || [])
  }, [])

  const blind = useMemo(() => rubrics.some((r) => r.blind), [rubrics])

  // Leaderboard: per team, per criterion average across judges, normalised
  // (avg/max)·weight, summed and scaled to a 0-100 weighted score.
  const board = useMemo(() => {
    const totW = rubrics.reduce((s, r) => s + (Number(r.weight) || 0), 0) || 1
    const teams = {}
    for (const s of scores) {
      const t = teams[s.team_name] ||= {}
      ;(t[s.rubric_id] ||= []).push(Number(s.score) || 0)
    }
    const rows = Object.entries(teams).map(([name, perCrit]) => {
      let weighted = 0
      for (const r of rubrics) {
        const arr = perCrit[r.id] || []
        if (!arr.length) continue
        const avg = arr.reduce((a, b) => a + b, 0) / arr.length
        weighted += (avg / (Number(r.max_score) || 10)) * (Number(r.weight) || 0)
      }
      return { name, score: Math.round((weighted / totW) * 1000) / 10 }
    }).sort((a, b) => b.score - a.score)
    // dense rank with ties
    let rank = 0, prev = null
    rows.forEach((r, i) => { if (r.score !== prev) { rank = i + 1; prev = r.score } r.rank = rank })
    return rows
  }, [scores, rubrics])

  const teamOptions = useMemo(() => [...new Set(scores.map((s) => s.team_name))], [scores])

  const saveScores = async () => {
    if (!judge.trim() || !team.trim()) { toastError('Need judge + team'); return }
    const rows = rubrics.filter((r) => entry[r.id] !== undefined && entry[r.id] !== '').map((r) => ({
      event_id: eventId, rubric_id: r.id, judge: judge.trim(), team_name: team.trim(), score: Number(entry[r.id]),
    }))
    if (!rows.length) { toastError('Enter at least one score'); return }
    setBusy(true)
    const { data, error } = await supabase.from('paradox_judging_scores').insert(rows).select('*')
    setBusy(false)
    if (error) { toastError('Save failed', error.message); return }
    setScores((p) => [...p, ...(data || [])]); setEntry({}); setTeam(''); success(`Saved ${rows.length} scores`)
  }

  const publishResults = async () => {
    if (!canPublish) return
    if (board.length === 0) { toastError('No scores entered yet'); return }
    if (!window.confirm('Publish results? This writes winners to the public page.')) return
    setBusy(true)
    await supabase.from('paradox_winners').delete().eq('event_id', eventId)
    const top = board.filter((r) => r.rank <= 3).map((r) => ({
      event_id: eventId, event_name: eventName, rank: r.rank, winner_name: r.name, published: true, published_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('paradox_winners').insert(top)
    setBusy(false)
    if (error) { toastError('Publish failed', error.message); return }
    success(`Published ${top.length} winners`); loadEvent(eventId, eventName)
  }

  // Certificate generation — canvas → PNG, brand-styled, no external lib.
  const makeCert = (recipient, kind, rank) => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 850
    const x = c.getContext('2d')
    x.fillStyle = '#FBF5E6'; x.fillRect(0, 0, 1200, 850)
    x.strokeStyle = '#181818'; x.lineWidth = 6; x.strokeRect(28, 28, 1144, 794)
    x.fillStyle = '#FF4338'; x.fillRect(28, 28, 1144, 96)
    x.fillStyle = '#FBF5E6'; x.textAlign = 'center'; x.font = 'bold 46px Georgia, serif'; x.fillText('PARADOX 4.0', 600, 92)
    x.fillStyle = '#181818'; x.font = '26px Georgia, serif'
    const label = kind === 'winner' ? `${rank === 1 ? 'Champion' : rank === 2 ? 'Runner-up' : 'Second runner-up'}` : kind === 'special' ? 'Special Mention' : 'Certificate of Participation'
    x.fillText(label.toUpperCase(), 600, 250)
    x.font = 'bold 70px Georgia, serif'; x.fillText(recipient, 600, 360)
    x.font = '28px Georgia, serif'; x.fillText(eventName, 600, 440)
    x.font = '20px Georgia, serif'; x.fillStyle = '#555'; x.fillText('AquaTerra · inter-school fest', 600, 700)
    x.fillStyle = '#FF4338'; x.font = 'bold 22px Georgia, serif'; x.fillText('#Paradox2026', 600, 760)
    c.toBlob((b) => {
      const u = URL.createObjectURL(b); const a = document.createElement('a')
      a.href = u; a.download = `paradox-cert-${eventName}-${recipient}.png`.replace(/\s+/g, '_'); a.click(); URL.revokeObjectURL(u)
    })
    supabase.from('paradox_certificates').insert({ event_id: eventId, recipient, kind, rank: rank || null, issued: true }).then(() => {})
  }

  return (
    <div className="px-4 sm:px-6 py-4">
      <h2 className="mb-1 font-display text-xl">Rubric &amp; Judging</h2>
      <p className="mb-4 font-mono text-[11px] opacity-50">weighted · odd panel · tie-handled · blind for photography · results gate the public page</p>

      <label className="flex flex-col gap-1 mb-4" style={{ maxWidth: 280 }}>
        <span className="font-mono text-[9px] uppercase opacity-50">Event</span>
        <select value={eventId} onChange={(e) => loadEvent(e.target.value, e.target.options[e.target.selectedIndex].text)} className="px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]">
          <option value="">pick event…</option>{events.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </label>

      {eventId && (
        <>
          <section className="mb-6">
            <h3 className="mb-2 font-display text-base border-b-[1.5px] pb-1" style={{ borderColor: 'var(--ink)' }}>Rubric (published to participants)</h3>
            <RecordsModule table="paradox_judging_rubrics" scope={{ event_id: eventId }} canEdit title="" columns={[
              { key: 'criterion', label: 'Criterion' },
              { key: 'weight', label: 'Weight', type: 'num' },
              { key: 'max_score', label: 'Max', type: 'num' },
              { key: 'blind', label: 'Blind', type: 'bool' },
            ]} />
            <button onClick={() => loadEvent(eventId, eventName)} className="mt-2 font-mono text-[11px] underline opacity-60">↻ reload rubric into scoring</button>
          </section>

          {rubrics.length > 0 && (
            <section className="mb-6">
              <h3 className="mb-2 font-display text-base border-b-[1.5px] pb-1" style={{ borderColor: 'var(--ink)' }}>Enter scores</h3>
              <div className="flex flex-wrap gap-2 items-end">
                <Field label="Judge"><input value={judge} onChange={(e) => setJudge(e.target.value)} placeholder="judge name" className="px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
                <Field label="Team / entry"><input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="team" list="px-teams" className="px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /><datalist id="px-teams">{teamOptions.map((t) => <option key={t} value={t} />)}</datalist></Field>
                {rubrics.map((r) => (
                  <Field key={r.id} label={`${r.criterion} /${r.max_score}`}><input type="number" value={entry[r.id] ?? ''} onChange={(e) => setEntry({ ...entry, [r.id]: e.target.value })} className="w-16 px-2 py-1.5 rounded border-[1.5px] border-ink/20text-[12px]" /></Field>
                ))}
                <button onClick={saveScores} disabled={busy} className="rounded-lg px-3 py-2 font-mono text-[12px] min-h-[38px]" style={{ background: 'var(--c2)', border: '1.5px solid var(--ink)' }}>+ save</button>
              </div>
            </section>
          )}

          <section className="mb-6">
            <div className="flex items-center justify-between mb-2 border-b-[1.5px] pb-1" style={{ borderColor: 'var(--ink)' }}>
              <h3 className="font-display text-base">Leaderboard {blind && !reveal && <span className="font-mono text-[10px]" style={{ color: 'var(--c3)' }}>· BLIND</span>}</h3>
              <div className="flex gap-2">
                {blind && <button onClick={() => setReveal(!reveal)} className="font-mono text-[11px] rounded px-2 py-1 border">{reveal ? 'hide names' : 'reveal'}</button>}
                <button onClick={publishResults} disabled={!canPublish || busy} title={!canPublish ? 'needs publish_results' : 'publish to public page'} className="font-mono text-[11px] rounded px-3 py-1.5 disabled:opacity-50" style={{ background: 'var(--c2)', border: '1.5px solid var(--ink)' }}>publish results</button>
              </div>
            </div>
            {board.length === 0 ? <div className="font-mono text-[12px] opacity-50 py-3">No scores yet.</div> : (
              <div className="flex flex-col gap-1">
                {board.map((r, i) => (
                  <div key={r.name} className="flex items-center gap-3 rounded-lg border-[1.5px] px-3 py-2" style={{ borderColor: r.rank <= 3 ? 'var(--ink)' : 'var(--line, rgba(24,24,24,0.12))' }}>
                    <span className="font-display text-lg w-8 tabular-nums">{r.rank}</span>
                    <span className="flex-1 font-body text-[13px]">{blind && !reveal ? `Entry #${i + 1}` : r.name}</span>
                    <span className="font-mono text-[13px] tabular-nums">{r.score}</span>
                    {(reveal || !blind) && <button onClick={() => makeCert(r.name, r.rank <= 3 ? 'winner' : 'participation', r.rank)} className="font-mono text-[10px] rounded px-2 py-1 border" title="download certificate">🎓 cert</button>}
                  </div>
                ))}
              </div>
            )}
          </section>

          {winners.length > 0 && (
            <section>
              <h3 className="mb-2 font-display text-base">Published winners</h3>
              <div className="flex flex-wrap gap-2">
                {winners.map((w) => (
                  <span key={w.id} className="rounded-full border-[1.5px] px-3 py-1 font-mono text-[11px] inline-flex items-center gap-2" style={{ borderColor: 'var(--ink)' }}>
                    #{w.rank} {w.winner_name}
                    <button onClick={() => makeCert(w.winner_name, 'winner', w.rank)} title="download certificate">🎓</button>
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return <label className="flex flex-col gap-1"><span className="font-mono text-[9px] uppercase tracking-wide opacity-50">{label}</span>{children}</label>
}

export default JudgingModule
