import { useCallback, useEffect, useMemo, useState } from 'react'
import Img from '../components/Img'
import breakService from '../services/breakService'
import { splitBreaks, onNowLine, upcomingLine, todayISO, type BreakWithMember } from '../lib/breakWindows'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { AdminSkeleton, AdminErrorState, EmptyLedger } from './adminKit'
import './BreaksOverview.css'

/**
 * Members desk, "On a break" chip: who is away right now (with the day they
 * are back), then who has a break booked (with both dates). Replaces the old
 * behaviour of filtering whatever page of members happened to be loaded, which
 * showed no dates and missed anyone not on that page. Read-only: setting or
 * ending a break stays on the member's row and in the bulk bar.
 *
 * Gating is the database's: member_breaks RLS shows a director or HR everyone
 * and a team lead only their own team, so a lead sees a shorter list with no
 * code here deciding it.
 */
function Person({ b, line }: { b: BreakWithMember; line: string }) {
  return (
    <li className="qrow brk-row">
      <span className="brk-avatar" style={{ background: b.avatarUrl ? undefined : hashColor(b.fullName) }} aria-hidden>
        {b.avatarUrl
          ? <Img ctx="avatar" src={b.avatarUrl} alt="" referrerPolicy="no-referrer" />
          : getInitials(b.fullName)}
      </span>
      <div className="qmeta">
        <div className="qname">{b.fullName}</div>
        <div className="qsub">{line}</div>
        {b.note && <div className="brk-note">{b.note}</div>}
      </div>
      <span className="qtag">{b.reason}</span>
    </li>
  )
}

export default function BreaksOverview() {
  const [rows, setRows] = useState<BreakWithMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setRows(null)
    try {
      setRows(await breakService.listCurrentAndUpcoming())
    } catch (e) {
      setError((e as { message?: string })?.message || 'unknown error')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  const today = todayISO()
  const { onNow, upcoming } = useMemo(() => splitBreaks(rows ?? [], today), [rows, today])

  if (error) return <AdminErrorState message={`Could not load breaks - ${error}`} onRetry={() => void load()} />
  if (!rows) return <AdminSkeleton rows={5} />
  if (onNow.length === 0 && upcoming.length === 0) {
    return <EmptyLedger message="no one is on a break" sub="Nothing running and nothing booked." />
  }

  return (
    <div className="brk-wrap">
      <section className="card brk-card" aria-labelledby="brk-now">
        <div className="panel-h">
          <b id="brk-now">On a break now</b>
          <span className="qtag">{onNow.length}</span>
        </div>
        {onNow.length === 0
          ? <p className="brk-none">nobody is away today.</p>
          : <ul className="brk-list">{onNow.map(b => <Person key={b.id} b={b} line={onNowLine(b, today)} />)}</ul>}
      </section>
      <section className="card brk-card" aria-labelledby="brk-next">
        <div className="panel-h">
          <b id="brk-next">Upcoming breaks</b>
          <span className="qtag">{upcoming.length}</span>
        </div>
        {upcoming.length === 0
          ? <p className="brk-none">nothing booked yet.</p>
          : <ul className="brk-list">{upcoming.map(b => <Person key={b.id} b={b} line={upcomingLine(b, today)} />)}</ul>}
      </section>
    </div>
  )
}
