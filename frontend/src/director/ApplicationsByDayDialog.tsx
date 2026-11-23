import { useCallback, useEffect, useRef, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useModalA11y } from '../hooks/useDialog'
import directorService from '../services/directorService'
import { summariseApplications, windowStart, dayLabel, type ApplicationsSummary } from '../lib/applicationsByDay'
import './ApplicationsByDayDialog.css'

/**
 * "Applications by day": how many people applied to AquaTerra on each day, opened from the Approvals desk header.
 * An application is a first Google sign-in (it creates the pending members row), so this counts members rows by the
 * Kolkata day they were created, and splits each day by what has happened since: still waiting, approved, rejected.
 * Read-only: no mutation, so no toast; a failed load shows its error with a retry button.
 */
const RANGES = [7, 14, 30, 90] as const
type Range = typeof RANGES[number]

export default function ApplicationsByDayDialog({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  useModalA11y(true, panelRef, onClose)
  const [range, setRange] = useState<Range>(14)
  const [summary, setSummary] = useState<ApplicationsSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (days: Range) => {
    setLoading(true)
    setError(null)
    try {
      const rows = await directorService.getApplicationRows(windowStart(days))
      setSummary(summariseApplications(rows, days))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(range) }, [range, load])

  const max = Math.max(1, ...(summary?.days.map(d => d.total) ?? [1]))

  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="abd-title" className="modal abd" tabIndex={-1}>
        <div className="modal-head">
          <h3 id="abd-title" className="abd-title">Applications by day</h3>
          <button className="iconbtn" onClick={onClose} aria-label="Close" title="Close">
            <XMarkIcon width={18} height={18} strokeWidth={2.2} aria-hidden />
          </button>
        </div>
        <div className="modal-body">
          <p className="abd-sub">Everyone who signed up to join, by the day they applied (Kolkata time), and where each application stands now.</p>

          <div className="adm-seg abd-seg" role="group" aria-label="Period">
            {RANGES.map(r => (
              <button key={r} type="button" className={range === r ? 'is-active' : ''} aria-pressed={range === r} onClick={() => setRange(r)}>
                {r} days
              </button>
            ))}
          </div>

          {error ? (
            <div className="abd-error" role="alert">
              <p>Could not load applications - {error}</p>
              <button className="btn btn-sm" onClick={() => load(range)}>try again</button>
            </div>
          ) : !summary ? (
            <div className="abd-loading" role="status" aria-label="Loading">loading…</div>
          ) : (
            <div aria-busy={loading} className={loading ? 'abd-dim' : undefined}>
              <dl className="abd-stats">
                <div><dt>applied</dt><dd>{summary.total}</dd></div>
                <div><dt>a day, on average</dt><dd>{summary.perDay}</dd></div>
                <div><dt>still waiting</dt><dd>{summary.pending}</dd></div>
                <div><dt>approved</dt><dd>{summary.approved}</dd></div>
                <div><dt>rejected</dt><dd>{summary.rejected}</dd></div>
                <div><dt>busiest day</dt><dd>{summary.busiest ? `${dayLabel(summary.busiest.date)} · ${summary.busiest.total}` : 'none'}</dd></div>
              </dl>

              <div className="abd-legend" aria-hidden>
                <span><i className="abd-k abd-k-p" />waiting</span>
                <span><i className="abd-k abd-k-a" />approved</span>
                <span><i className="abd-k abd-k-r" />rejected or removed</span>
              </div>

              <table className="abd-table">
                <caption className="abd-sr">Applications per day, newest first</caption>
                <thead>
                  <tr><th scope="col">day</th><th scope="col"><span className="abd-sr">chart</span></th><th scope="col">applied</th></tr>
                </thead>
                <tbody>
                  {summary.days.map(d => (
                    <tr key={d.date} className={d.total === 0 ? 'abd-zero' : undefined}>
                      <th scope="row">{dayLabel(d.date)}</th>
                      <td className="abd-barcell">
                        <span className="abd-bar" style={{ width: `${(d.total / max) * 100}%` }}
                          title={`${d.pending} waiting, ${d.approved} approved, ${d.rejected + d.other} rejected or removed`}>
                          {d.pending > 0 && <span className="abd-seg-p" style={{ flex: d.pending }} />}
                          {d.approved > 0 && <span className="abd-seg-a" style={{ flex: d.approved }} />}
                          {d.rejected + d.other > 0 && <span className="abd-seg-r" style={{ flex: d.rejected + d.other }} />}
                        </span>
                      </td>
                      <td className="abd-n">{d.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
