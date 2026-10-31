import { celebrate } from '../lib/delight'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { useToast } from '../components/Toast'
import { taskService } from '../services/taskService'
import TaskDetail from './TaskDetail'
import { TaskCard } from './TaskRow'
import { finishesTheList, showsOnProfileByUuid, sortTasks, type Task } from './taskModel'
import './Tasks.css'

/**
 * Tasks on a member's profile: what they perform or supervise, never what they only follow. The database decides which
 * of those the viewer may see (a private task stays private), so on someone else's profile this is the part they
 * share with you, and the empty sentence says so.
 */
export default function ProfileTasks({ memberUuid, isOwn, name }: { memberUuid: string; isOwn: boolean; name: string }) {
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
      setTasks((await taskService.list()).filter(t => showsOnProfileByUuid(t, memberUuid)))
    } catch (err) {
      console.error('ProfileTasks load error:', err)
      setError("couldn't load tasks.")
    } finally {
      setLoading(false)
    }
  }, [memberUuid])

  useEffect(() => { void load() }, [load])

  const { active, finished } = useMemo(() => {
    const sorted = sortTasks(tasks)
    return { active: sorted.filter(t => t.status !== 'done'), finished: sorted.filter(t => t.status === 'done') }
  }, [tasks])
  const open = tasks.find(t => t.uuid === openUuid) ?? null

  async function toggleDone(t: Task, el?: HTMLElement) {
    if (busyId != null) return
    setBusyId(t.taskId)
    try {
      await taskService.update(t.taskId, { status: t.status === 'done' ? 'open' : 'done' })
      toast.success(t.status === 'done' ? 'reopened' : 'marked done')
      if (t.status !== 'done') {
        celebrate('stars', el)
        if (finishesTheList(active, t)) celebrate('confetti')
      }
      await load(true)
    } catch (err) {
      console.error('ProfileTasks toggle error:', err)
      toast.error("couldn't change that task", 'nothing changed. try again.')
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <div className="tk-skels" aria-hidden>{[1, 2].map(i => <div key={i} className="card tk-skel" />)}</div>
  if (error) return <ErrorState message={error} hint="check your connection and try again." onRetry={() => void load()} variant="block" />
  if (tasks.length === 0) {
    return (
      <EmptyState
        title={isOwn ? 'nothing on your plate.' : 'nothing you can see.'}
        hint={isOwn ? 'tasks you do or supervise show up here.' : `${name}'s tasks that you are on, or that belong to a team you are on, show up here.`}
      />
    )
  }
  const row = (t: Task) => <TaskCard key={t.taskId} task={t} viewerId={viewerId} busy={busyId === t.taskId} onOpen={() => setOpenUuid(t.uuid)} onToggleDone={el => void toggleDone(t, el)} />
  return (
    <div className="tk-team">
      {active.length > 0 && <ul className="tk-list">{active.map(row)}</ul>}
      {finished.length > 0 && (
        <>
          <h3 className="tk-h3">done</h3>
          <ul className="tk-list">{finished.slice(0, 5).map(row)}</ul>
        </>
      )}
      <TaskDetail task={open} viewerId={viewerId} onClose={() => setOpenUuid(null)} onChanged={() => void load(true)} />
    </div>
  )
}
