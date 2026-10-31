import { useEffect, useMemo, useState } from 'react'
import { Reveal } from '../components/Reveal'
import { CountUp } from '../components/CountUp'
import { taskService } from '../services/taskService'
import { formatRate, perPerformer, rollupTotals, statsFor, type TeamTotals } from './taskStats'
import { personOn, type Task } from './taskModel'
import './Tasks.css'

/**
 * The viewer's own record on tasks they perform: how often they finish on time, how late when they do not, how often
 * a date moved. Counted from the tasks they can already see; nothing about anyone else.
 */
export function YourNumbers({ tasks, viewerId }: { tasks: Task[]; viewerId: number | null }) {
  const stats = useMemo(() => statsFor(tasks.filter(t => personOn(t, viewerId)?.role === 'performer')), [tasks, viewerId])
  if (stats.done + stats.open === 0) return null
  const cells = [
    { key: 'rate', label: 'finished on time', value: formatRate(stats.onTimeRate), note: stats.onTimeRate === null ? 'nothing with a due date finished yet' : `${stats.onTime} of ${stats.onTime + stats.late}` },
    { key: 'done', label: 'tasks finished', count: stats.done, note: stats.open === 0 ? 'nothing open' : `${stats.open} still open` },
    { key: 'late', label: 'days late, on average', value: stats.avgDaysLate === null ? '-' : stats.avgDaysLate.toFixed(1), note: stats.late === 0 ? 'none late' : `${stats.late} finished late` },
    { key: 'moved', label: 'dates moved', count: stats.moved, note: stats.moved === 0 ? 'every date held' : 'first date is what counts' },
  ]
  return (
    <section className="tk-numbers" aria-label="your record on tasks you do">
      <h2 className="tk-numbers-h">your record</h2>
      <div className="tk-numbers-grid">
        {cells.map((c, i) => (
          <Reveal key={c.key} delay={i * 0.05}>
            <div className="tk-num">
              <span className="tk-num-n">{'count' in c ? <CountUp value={c.count as number} /> : c.value}</span>
              <span className="tk-num-l">{c.label}</span>
              <span className="tk-num-note">{c.note}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

/**
 * Counts across every task a leader's scope covers, last six months, one line per team. HR and super admin see all
 * teams (private tasks counted, never shown); a HoD sees their own. The database refuses anyone else, so this renders
 * only where the caller already checked the role. Overdue sorts first: the line that needs a look is on top.
 */
export function OrgTotals() {
  const [rows, setRows] = useState<TeamTotals[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    taskService.totals(6)
      .then(r => { if (!cancelled) setRows(rollupTotals(r)) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])
  if (failed) return <p className="tk-numbers-note" role="status">team totals could not load. try again in a moment.</p>
  if (rows === null) return <div className="tk-numbers" aria-hidden><div className="card tk-skel" /></div>
  if (rows.length === 0) return null
  return (
    <section className="tk-numbers" aria-label="task totals by team, last six months">
      <h2 className="tk-numbers-h">across teams, last six months</h2>
      <div className="tk-table" role="table">
        <div className="tk-trow tk-thead" role="row">
          <span role="columnheader">team</span>
          <span role="columnheader">made</span>
          <span role="columnheader">overdue</span>
          <span role="columnheader">done</span>
          <span role="columnheader">on time</span>
        </div>
        {rows.map(r => (
          <div key={String(r.teamId)} className="tk-trow" role="row">
            <span role="cell" className="tk-tname">{r.name}</span>
            <span role="cell" className="tk-tnum">{r.created}</span>
            <span role="cell" className={'tk-tnum' + (r.openOverdue > 0 ? ' is-late' : '')}>{r.openOverdue}</span>
            <span role="cell" className="tk-tnum">{r.completed}</span>
            <span role="cell" className="tk-tnum">{formatRate(r.onTimeRate)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

/** One row per person doing work on a team's tasks: what is on their plate and how they finish. */
export function TeamNumbers({ tasks }: { tasks: Task[] }) {
  const rows = useMemo(() => perPerformer(tasks), [tasks])
  if (rows.length === 0) return null
  return (
    <section className="tk-numbers" aria-label="who is doing what on this team">
      <h2 className="tk-numbers-h">who is on what</h2>
      <div className="tk-table" role="table">
        <div className="tk-trow tk-thead" role="row">
          <span role="columnheader">person</span>
          <span role="columnheader">open</span>
          <span role="columnheader">overdue</span>
          <span role="columnheader">done</span>
          <span role="columnheader">on time</span>
        </div>
        {rows.map(r => (
          <div key={r.memberId} className="tk-trow" role="row">
            <span role="cell" className="tk-tname">{r.name}</span>
            <span role="cell" className="tk-tnum">{r.open}</span>
            <span role="cell" className={'tk-tnum' + (r.overdue > 0 ? ' is-late' : '')}>{r.overdue}</span>
            <span role="cell" className="tk-tnum">{r.done}</span>
            <span role="cell" className="tk-tnum">{formatRate(r.onTimeRate)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
