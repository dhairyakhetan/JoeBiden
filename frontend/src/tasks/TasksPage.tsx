import { celebrate } from '../lib/delight'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import OfflineBanner from '../components/OfflineBanner'
import { Reveal } from '../components/Reveal'
import { CountUp } from '../components/CountUp'
import { useToast } from '../components/Toast'
import { taskService } from '../services/taskService'
import TaskForm from './TaskForm'
import TaskDetail from './TaskDetail'
import { TaskCard } from './TaskRow'
import ProgressRing from './ProgressRing'
import { OrgTotals, YourNumbers } from './TaskNumbers'
import { hasLeaderAccess } from '../lib/roles'
import {
  TABS, TAB_LABEL, dueState, finishesTheList, groupByTab, personOn,
  type Task, type TaskTab,
} from './taskModel'
import './Tasks.css'

const EMPTY: Record<TaskTab, { title: string; hint: string }> = {
  doing: { title: 'nothing to do right now.', hint: 'tasks you are assigned to do show up here.' },
  supervising: { title: 'nothing waiting on you.', hint: 'tasks whose result comes to you show up here.' },
  spectating: { title: 'nothing to follow.', hint: 'tasks you were added to as a spectator show up here.' },
  team: { title: 'no team tasks.', hint: 'tasks your teams are working on, that you are not on, show up here.' },
  done: { title: 'nothing finished yet.', hint: 'completed tasks move here.' },
}

function Summary({ doing, soon, late }: { doing: number; soon: number; late: number }) {
  const tiles = [
    { key: 'doing', n: doing, label: 'on your plate', hue: 'var(--sky)' },
    { key: 'soon', n: soon, label: 'due in two days', hue: 'var(--lemon)' },
    { key: 'late', n: late, label: 'running late', hue: 'var(--tomato)' },
  ]
  return (
    <div className="tk-summary" role="group" aria-label="your tasks at a glance">
      {tiles.map((t, i) => (
        <Reveal key={t.key} delay={i * 0.06}>
          <div className={'tk-tile' + (t.n === 0 ? ' is-zero' : '')} style={{ ['--tc' as string]: t.hue }}>
            <CountUp value={t.n} className="tk-tile-n" />
            <span className="tk-tile-l">{t.label}</span>
          </div>
        </Reveal>
      ))}
    </div>
  )
}

/**
 * /tasks: the tasks a member is on, follows, or sees through their team. Tabs follow the member's role on each
 * task (to do, I supervise, I follow, my teams, done). The database decides what is returned and who can change it;
 * this page only arranges it.
 */
export default function TasksPage() {
  useMeta({ ...pageMetadata.tasks, noIndex: true })
  const { member } = useAuth()
  const toast = useToast()
  const viewerId = member?.member_id ?? null
  const [busyId, setBusyId] = useState<number | null>(null)

  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TaskTab>('doing')
  const [formOpen, setFormOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const [openUuid, setOpenUuid] = useState<string | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true)
    setError('')
    try {
      setTasks(await taskService.list())
    } catch (err) {
      console.error('TasksPage load error:', err)
      setError("couldn't load your tasks.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const grouped = useMemo(() => groupByTab(tasks, viewerId), [tasks, viewerId])
  const glance = useMemo(() => {
    const mine = [...grouped.doing, ...grouped.supervising]
    return {
      doing: grouped.doing.length,
      soon: mine.filter(t => dueState(t) === 'due_soon').length,
      late: mine.filter(t => dueState(t) === 'overdue').length,
    }
  }, [grouped])

  async function toggleDone(t: Task, el?: HTMLElement) {
    if (busyId != null) return
    setBusyId(t.taskId)
    try {
      await taskService.update(t.taskId, { status: t.status === 'done' ? 'open' : 'done' })
      toast.success(t.status === 'done' ? 'reopened' : 'marked done')
      if (t.status !== 'done') {
        celebrate('stars', el)
        if (finishesTheList(grouped.doing, t)) celebrate('confetti')
      }
      await load(true)
    } catch (err) {
      console.error('TasksPage toggle error:', err)
      toast.error("couldn't change that task", 'nothing changed. try again.')
    } finally {
      setBusyId(null)
    }
  }
  const open = tasks.find(t => t.uuid === openUuid) ?? null
  const rows = grouped[tab]
  // My own list only: tasks I perform. Supervising and following do not count towards my ring.
  const mineAll = useMemo(() => {
    const mine = tasks.filter(t => personOn(t, viewerId)?.role === 'performer')
    return { total: mine.length, done: mine.filter(t => t.status === 'done').length }
  }, [tasks, viewerId])

  return (
    <div className="route-enter aq-wrap tk-page">
      <OfflineBanner />
      <header className="tk-head">
        <div className="tk-titlerow">
          {mineAll.total > 0 && <ProgressRing done={mineAll.done} total={mineAll.total} />}
          <div>
            <h1 className="h-display tk-title">tasks.</h1>
            <p className="tk-sub">who is doing what, who it is for, and who is following along.</p>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setFormKey(k => k + 1); setFormOpen(true) }}>new task</button>
      </header>

      {!isLoading && !error && tasks.length > 0 && <Summary doing={glance.doing} soon={glance.soon} late={glance.late} />}

      <div className="tk-tabs" role="tablist" aria-label="task views">
        {TABS.map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={'chip ' + (tab === t ? 'chip-active' : '')} onClick={() => setTab(t)}>
            {TAB_LABEL[t]} {grouped[t].length}
          </button>
        ))}
      </div>

      {!isLoading && !error && tab === 'done' && <YourNumbers tasks={tasks} viewerId={viewerId} />}
      {!isLoading && !error && tab === 'done' && hasLeaderAccess(member?.role) && <OrgTotals />}

      {isLoading && <div className="tk-skels" aria-hidden>{[1, 2, 3].map(i => <div key={i} className="card tk-skel" />)}</div>}
      {!isLoading && error && <ErrorState message={error} hint="check your connection and try again." onRetry={() => void load()} variant="block" />}
      {!isLoading && !error && rows.length === 0 && (
        <EmptyState
          title={EMPTY[tab].title}
          hint={EMPTY[tab].hint}
          action={<button type="button" className="btn btn-primary" onClick={() => { setFormKey(k => k + 1); setFormOpen(true) }}>new task</button>}
        />
      )}
      {!isLoading && !error && rows.length > 0 && (
        <ul className="tk-list">
          {rows.map(t => <TaskCard key={t.taskId} task={t} viewerId={viewerId} busy={busyId === t.taskId} onOpen={() => setOpenUuid(t.uuid)} onToggleDone={el => void toggleDone(t, el)} />)}
        </ul>
      )}

      <TaskForm key={formKey} open={formOpen} onClose={() => setFormOpen(false)} onCreated={uuid => { setTab('supervising'); void load(true).then(() => setOpenUuid(uuid)) }} />
      <TaskDetail task={open} viewerId={viewerId} onClose={() => setOpenUuid(null)} onChanged={() => void load(true)} />
    </div>
  )
}
