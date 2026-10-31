import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listRegistrations, listAdminEvents, type AdminRow } from '../lib/api'
import type { SportSlug } from '../lib/types'
import { EVENT } from '../config'
import { prettyPhone, statusLabel, dayRange } from '../lib/format'

/**
 * The paper fallback, ADM-14 / PRD 7.7.
 *
 * Print one per sport per day on Thu 1 Oct. If the venue Wi-Fi dies AND the
 * offline cache was never warmed on the gate phone, this sheet is the gate.
 * It is deliberately black on white with no colour: a volunteer is printing it
 * on whatever printer the school has, and a dark-themed page would eat a
 * cartridge and come out unreadable.
 */
export function TerraThonPrint() {
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<AdminRow[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const sport = (params.get('sport') || 'cricket') as SportSlug
  const day = params.get('day') || ''

  // Pulled out of the effect so the retry button below can re-run the exact
  // same fetch instead of falling back to a full page reload. This is the
  // page opened specifically because the venue wifi died, so "reload the
  // page" is a worse retry than "try the request again".
  const loadSheet = useCallback(() => {
    let alive = true
    setLoading(true)
    setError(null)
    Promise.all([listRegistrations(), listAdminEvents()])
      .then(([r, e]) => { if (alive) { setRows(r); setEvents(e) } })
      .catch((e: any) => { if (alive) setError(e?.message || 'Could not load the day sheet.') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  useEffect(() => loadSheet(), [loadSheet])

  const event = events.find((e) => e.slug === sport)

  const list = useMemo(
    () => rows
      .filter((r) => r.event_slug === sport && r.status !== 'cancelled')
      .sort((a, b) => (a.team_name || a.captain_name).localeCompare(b.team_name || b.captain_name)),
    [rows, sport],
  )

  const paidCount = list.filter((r) => r.paid).length

  return (
    <div className="tt-print-root">
      <div className="tt-wrap tt-noprint" style={{ paddingTop: 20, paddingBottom: 10, maxWidth: 900 }}>
        <header style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 28, textTransform: 'uppercase' }}>Day sheet</h1>
          <Link to={`${EVENT.base}/admin`} className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto', minHeight: 40 }}>Back</Link>
        </header>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {(['cricket', 'pickleball', 'fifa'] as SportSlug[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`tt-chip ${sport === s ? 'tt-chip--volt' : ''}`}
              style={{ cursor: 'pointer', minHeight: 40, border: sport === s ? 'none' : '1px solid var(--tt-hairline-2)' }}
              aria-pressed={sport === s}
              onClick={() => setParams({ sport: s, ...(day ? { day } : {}) })}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </button>
          ))}
          <button type="button" className="tt-btn" style={{ marginLeft: 'auto' }} onClick={() => window.print()} disabled={!list.length}>
            Print
          </button>
        </div>
        <p style={{ marginTop: 10, fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
          Prints black on white. Everyone is listed, paid or not, so the gate can see who still owes.
        </p>
      </div>

      {error ? (
        <div className="tt-wrap tt-noprint" style={{ maxWidth: 900 }}>
          <div className="tt-card" role="alert" style={{ borderColor: 'var(--tt-danger)' }}>
            <h2 style={{ fontSize: 20, color: 'var(--tt-danger)' }}>Couldn't load the day sheet</h2>
            <p style={{ margin: '8px 0 0', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>{error}</p>
            <button type="button" className="tt-btn tt-btn--quiet" style={{ marginTop: 10, minHeight: 'var(--tt-ctl)' }} onClick={() => loadSheet()}>
              Retry
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="tt-wrap tt-noprint" style={{ maxWidth: 900 }}>
          <span className="tt-sr" role="status">Loading</span>
          <div className="tt-card" style={{ height: 240, opacity: 0.35 }} aria-hidden="true" />
        </div>
      ) : (
        <div className="tt-sheet">
          <div className="tt-sheet__head">
            <div>
              <h2>TerraThon 2026 · {event?.display_name ?? sport}</h2>
              <p>
                {event ? dayRange(event.day_first, event.day_last) : ''}
                {event?.venue ? ` · ${event.venue}` : ''}
                {event?.report_time ? ` · report by ${event.report_time}` : ''}
              </p>
            </div>
            <div className="tt-sheet__count">
              <strong>{list.length}</strong> teams · <strong>{paidCount}</strong> paid
            </div>
          </div>

          {list.length === 0 ? (
            <p className="tt-sheet__empty">No registrations for this sport yet.</p>
          ) : (
            <table className="tt-sheet__table">
              <thead>
                <tr>
                  <th style={{ width: '13%' }}>Ref</th>
                  <th style={{ width: '22%' }}>Team</th>
                  <th style={{ width: '18%' }}>Captain</th>
                  <th style={{ width: '14%' }}>Phone</th>
                  <th style={{ width: '6%' }}>Plrs</th>
                  <th style={{ width: '9%' }}>Paid</th>
                  <th style={{ width: '8%' }}>In</th>
                  <th style={{ width: '10%' }}>Signature</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.ref_code}</td>
                    <td>{r.team_name || '–'}</td>
                    <td>{r.captain_name}</td>
                    <td className="mono">{prettyPhone(r.phone)}</td>
                    <td className="center">{1 + r.roster.length}</td>
                    <td className="center">{r.paid ? 'PAID' : statusLabel(r) === 'Waitlist' ? 'WAIT' : 'DUE'}</td>
                    <td className="box" />
                    <td className="box" />
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="tt-sheet__foot">
            One scan per team per day. A team marked DUE has not paid: send them to the payment desk, do
            not admit them. Printed {new Date().toLocaleString('en-IN')}. Contains personal data,
            shred after the event.
          </p>
        </div>
      )}

      <style>{`
        .tt-sheet {
          background: #fff; color: #000;
          max-width: 900px; margin: 0 auto 60px; padding: 24px;
          border-radius: 12px;
          font-family: system-ui, sans-serif;
        }
        .tt-sheet__head { display: flex; gap: 16px; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 12px; }
        .tt-sheet__head h2 { font-size: 20px; margin: 0; font-family: inherit; text-transform: none; }
        .tt-sheet__head p { margin: 4px 0 0; font-size: 13px; }
        .tt-sheet__count { margin-left: auto; font-size: 13px; white-space: nowrap; }
        .tt-sheet__table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .tt-sheet__table th, .tt-sheet__table td { border: 1px solid #000; padding: 6px 7px; text-align: left; vertical-align: middle; }
        .tt-sheet__table th { background: #eee; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
        .tt-sheet__table td.center { text-align: center; }
        .tt-sheet__table td.mono { font-family: ui-monospace, monospace; }
        .tt-sheet__table td.box { height: 26px; }
        .tt-sheet__empty { font-size: 14px; }
        .tt-sheet__foot { margin-top: 14px; font-size: 11px; line-height: 1.5; }

        @media print {
          .tt-noprint, .tt-bg { display: none !important; }
          .tt-print-root { background: #fff !important; }
          .tt-sheet { margin: 0; padding: 0; border-radius: 0; max-width: none; }
          .tt-sheet__table { font-size: 10.5px; }
          .tt-sheet__table thead { display: table-header-group; }
          .tt-sheet__table tr { break-inside: avoid; }
          @page { margin: 12mm; }
        }
      `}</style>
    </div>
  )
}
