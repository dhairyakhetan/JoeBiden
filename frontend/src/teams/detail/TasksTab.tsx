import { celebrate } from '../../lib/delight'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import EmptyState from '../../components/EmptyState'
import ErrorState from '../../components/ErrorState'
import { useToast } from '../../components/Toast'
import { taskService } from '../../services/taskService'
import TaskDetail from '../../tasks/TaskDetail'
import { TeamNumbers } from '../../tasks/TaskNumbers'
import { TaskCard } from '../../tasks/TaskRow'
import { finishesTheList, sortTasks, type Task } from '../../tasks/taskModel'
import '../../tasks/Tasks.css'

/**
 * A team's tasks, on the team page. The database decides what a viewer sees (team members and the people on a task);
 * this only lists them, with the same rows as /tasks, and opens the same detail.
 */
export default function TasksTab({ teamUuid, teamName }: { teamUuid: string; teamName: string }) {
  const { member } = useAuth()
  const toast = useToast()
  const viewerId = member?.member_id ?? null
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openUuid, setOpenUuid] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError('')
    try {
      setTasks(await taskService.listForTeam(teamUuid))
    } catch (err) {
      console.error('TasksTab load error:', err)
      setError("couldn't load this team's tasks.")
    } finally {
      setLoading(false)
    }
  }, [teamUuid])

  useEffect(() => { void load() }, [load])

  const sorted = useMemo(() => sortTasks(tasks), [tasks])
  const open = tasks.find(t => t.uuid === openUuid) ?? null

  async function toggleDone(t: Task, el?: HTMLElement) {
    if (busyId != null) return
    setBusyId(t.taskId)
    try {
      await taskService.update(t.taskId, { status: t.status === 'done' ? 'open' : 'done' })
      toast.success(t.status === 'done' ? 'reopened' : 'marked done')
      if (t.status !== 'done') {
        celebrate('stars', el)
        if (finishesTheList(sorted, t)) celebrate('confetti')
      }
      await load(true)
    } catch (err) {
      console.error('TasksTab toggle error:', err)
      toast.error("couldn't change that task", 'nothing changed. try again.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="tk-team">
      <div className="tk-head">
        <p className="tk-sub">what {teamName} is working on. everyone in the team can see these; only the people on a task can change it.</p>
        <Link to="/tasks" className="btn btn-sm btn-primary">new task</Link>
      </div>
      {loading && <div className="tk-skels" aria-hidden>{[1, 2].map(i => <div key={i} className="card tk-skel" />)}</div>}
      {!loading && error && <ErrorState message={error} hint="check your connection and try again." onRetry={() => void load()} variant="block" />}
      {!loading && !error && sorted.length === 0 && (
        <EmptyState title="no tasks for this team yet." hint="make one on the tasks page and pick this team." />
      )}
      {!loading && !error && sorted.length > 0 && <TeamNumbers tasks={sorted} />}
      {!loading && !error && sorted.length > 0 && (
        <ul className="tk-list">
          {sorted.map(t => <TaskCard key={t.taskId} task={t} viewerId={viewerId} busy={busyId === t.taskId} onOpen={() => setOpenUuid(t.uuid)} onToggleDone={el => void toggleDone(t, el)} />)}
        </ul>
      )}
      <TaskDetail task={open} viewerId={viewerId} onClose={() => setOpenUuid(null)} onChanged={() => void load(true)} />
    </div>
  )
}
