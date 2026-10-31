import { useCallback, useEffect, useState } from 'react'
import { useMeta } from '../../hooks/useMeta'
import { useToast } from '../../components/Toast'
import { istDateTime } from '../../terrathon/lib/format'
import { TOPICS, listEnquiries, setEnquiryHandled, type EnquiryRow } from '../lib/enquiries'

const topicLabel = (v: string) => TOPICS.find(t => t.value === v)?.label ?? v

/** The contact form's inbox. A message is handled by the person who replied; ticking it takes it off the to-do list. */
export function LiveAdminEnquiries() {
  useMeta({ title: 'Enquiries | AquaTerra.live admin', description: 'AquaTerra.live enquiries.', path: '/live/admin/enquiries', noIndex: true })
  const { success, error: toastError } = useToast()
  const [rows, setRows] = useState<EnquiryRow[] | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [showDone, setShowDone] = useState(false)

  const fetchRows = useCallback(() => {
    listEnquiries().then(r => { setRows(r); setState('ok') }).catch((e: any) => {
      setState(/relation|does not exist|schema cache/i.test(String(e?.message)) ? 'missing' : 'error')
    })
  }, [])
  const load = () => { setState('loading'); fetchRows() }
  useEffect(fetchRows, [fetchRows])

  const tick = async (r: EnquiryRow) => {
    setRows(list => (list ?? []).map(x => (x.id === r.id ? { ...x, handled: !x.handled } : x)))
    try { await setEnquiryHandled(r.id, !r.handled); success(r.handled ? 'Back on the list' : 'Marked handled') }
    catch (e: any) { setRows(list => (list ?? []).map(x => (x.id === r.id ? r : x))); toastError("Couldn't save", e?.message ?? 'Try again.') }
  }

  const list = (rows ?? []).filter(r => showDone || !r.handled)
  return (
    <div className="tt-wrap tt-page" style={{ maxWidth: 900 }}>
      <header style={{ display: 'flex', alignItems: 'end', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div><div className="tt-kicker">AquaTerra.live admin</div><h1>Enquiries</h1></div>
        <label className="tt-check" style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={showDone} onChange={e => setShowDone(e.target.checked)} /><span>Show handled</span>
        </label>
        <button type="button" className="tt-btn tt-btn--quiet" onClick={load}>Refresh</button>
      </header>
      {state === 'loading' && <div role="status" aria-label="Loading" className="tt-card">Loading…</div>}
      {state === 'missing' && <div className="tt-card" role="alert"><h2>The inbox table is not set up yet.</h2><p>Run <code>scripts/live_enquiries_2026_10_24.sql</code> in the Supabase SQL editor. Until then the contact form tells visitors to use WhatsApp.</p></div>}
      {state === 'error' && <div className="tt-card" role="alert"><h2>Couldn&apos;t load enquiries.</h2><p>Your account may not have permission. Try Refresh.</p></div>}
      {state === 'ok' && list.length === 0 && <div className="tt-card"><h2>All caught up.</h2><p>No enquiries waiting.</p></div>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
        {list.map(r => (
          <li key={r.id} className="tt-card" style={{ display: 'grid', gap: 6, opacity: r.handled ? 0.6 : 1 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>{r.name}</strong>
              <span className="tt-chip">{topicLabel(r.topic)}</span>
              <span style={{ marginLeft: 'auto', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>{istDateTime(r.created_at)}</span>
            </div>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.message}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <a className="tt-btn tt-btn--quiet" href={r.contact.includes('@') ? `mailto:${r.contact}` : `https://wa.me/${r.contact.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">Reply to {r.contact}</a>
              <button type="button" className={`tt-btn ${r.handled ? 'tt-btn--quiet' : ''}`} onClick={() => void tick(r)}>{r.handled ? 'Not handled' : 'Mark handled'}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
