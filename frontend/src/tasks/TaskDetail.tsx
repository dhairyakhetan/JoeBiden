import { useCallback, useEffect, useState } from 'react'
import Modal from '../components/Modal'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { taskService } from '../services/taskService'
import PersonPicker, { type PickedMember } from './PersonPicker'
import TeamAdder, { type TeamMember } from './TeamAdder'
import { useAuth } from '../auth/AuthContext'
import { hasLeaderAccess } from '../lib/roles'
import { celebrate } from '../lib/delight'
import {
  DUE_LABEL, ROLES, ROLE_LABEL, STATUSES, STATUS_LABEL, TASK_LIMITS, canEditTask, dateInputFromDue, dueFromDateInput, dueState, eventSentence,
  formatDue, personOn,
  type Task, type TaskComment, type TaskEvent, type TaskRole, type TaskStatus,
} from './taskModel'
import './Tasks.css'

interface Props {
  task: Task | null
  viewerId: number | null
  onClose: () => void
  /** Called after any change so the page reloads its list. */
  onChanged: () => void
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/**
 * One task: its text, status and due date, the people with their roles, the comments and the change log.
 * Everything that changes it is shown only to people the database lets change it (canEditTask mirrors the policy);
 * a team member who can only see it gets a plain sentence saying why they cannot touch it.
 */
export default function TaskDetail({ task, viewerId, onClose, onChanged }: Props) {
  const toast = useToast()
  const confirm = useConfirm()
  const { member } = useAuth()
  const [teams, setTeams] = useState<{ teamId: number; name: string }[]>([])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [due, setDue] = useState('')
  const [comments, setComments] = useState<TaskComment[]>([])
  const [events, setEvents] = useState<TaskEvent[]>([])
  const [commentText, setCommentText] = useState('')
  const [busy, setBusy] = useState(false)

  const taskId = task?.taskId ?? null
  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description)
    setDue(dateInputFromDue(task.dueAt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.taskId, task?.updatedAt])

  const memberId = member?.member_id ?? null
  const isLeader = hasLeaderAccess(member?.role)
  useEffect(() => {
    if (!task || memberId == null) return
    let cancelled = false
    taskService.teamsFor(memberId, isLeader).then(t => { if (!cancelled) setTeams(t) }).catch(() => { if (!cancelled) setTeams([]) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.taskId, memberId, isLeader])

  const loadThread = useCallback(async () => {
    if (taskId == null) return
    try {
      const [c, e] = await Promise.all([taskService.comments(taskId), taskService.events(taskId)])
      setComments(c)
      setEvents(e)
    } catch (err) {
      console.error('TaskDetail thread error:', err)
      toast.error("couldn't load the comments", 'try opening the task again.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  useEffect(() => { setComments([]); setEvents([]); setCommentText(''); void loadThread() }, [loadThread])

  if (!task) return null

  const mine = personOn(task, viewerId)
  const canEdit = canEditTask(task, viewerId)
  const state = dueState(task)
  const dirty = title.trim() !== task.title || description !== task.description || due !== dateInputFromDue(task.dueAt)

  async function run(work: () => Promise<void>, done: string, failed = "couldn't save that change", after?: () => void) {
    if (busy) return
    setBusy(true)
    try {
      await work()
      toast.success(done)
      after?.()
      onChanged()
      await loadThread()
    } catch (err) {
      console.error('TaskDetail error:', err)
      toast.error(failed, err instanceof Error && err.message.startsWith('you are not allowed') ? 'you cannot change this task.' : 'nothing changed. try again.')
    } finally {
      setBusy(false)
    }
  }

  const save = () => run(
    () => taskService.update(task.taskId, { title: title.trim(), description, due_at: dueFromDateInput(due) }),
    'task saved',
  )

  const setStatus = (status: TaskStatus) => run(
    () => taskService.update(task.taskId, { status }),
    status === 'done' ? 'marked done' : 'status changed',
    undefined,
    status === 'done' && task.status !== 'done' ? () => celebrate('stars', document.getElementById('tk-status')) : undefined,
  )

  async function remove(memberId: number, name: string) {
    const ok = await confirm({ title: `remove ${name}?`, body: 'they will no longer see this task unless it belongs to their team.', confirmLabel: 'remove', danger: true })
    if (ok) await run(() => taskService.removePerson(task!.taskId, memberId), 'removed')
  }

  const addPerson = (m: PickedMember, role: TaskRole, silent: boolean) =>
    run(() => taskService.addPerson(task.taskId, { memberId: m.memberId, role, silent }), `${m.name} added`)

  const addTeam = (members: TeamMember[], role: TaskRole, silent: boolean, teamName: string) => {
    const onTask = new Set(task!.people.map(p => p.memberId))
    const fresh = members.filter(m => !onTask.has(m.memberId))
    if (fresh.length === 0) { toast.info(`everyone on ${teamName} is already on this task`); return }
    void run(() => taskService.addPeople(task!.taskId, fresh.map(m => ({ memberId: m.memberId, role, silent }))), `${fresh.length} from ${teamName} added`)
  }

  const comment = () => {
    const body = commentText.trim()
    if (!body || viewerId == null) return
    void run(async () => { await taskService.addComment(task.taskId, viewerId, body); setCommentText('') }, 'comment added', "couldn't post that")
  }

  return (
    <Modal isOpen onClose={onClose} title={task.title} size="xl" fullScreenMobile>
      <div className="tk-detail">
        <div className="tk-badges">
          <span className="tk-pill">{task.kind === 'team' ? (task.teamName ?? 'team task') : 'general task'}</span>
          <span className={'tk-pill tk-status s-' + task.status}>{STATUS_LABEL[task.status]}</span>
          {task.dueAt && <span className={'tk-pill tk-due d-' + state}>{DUE_LABEL[state]}, {formatDue(task.dueAt)}</span>}
          {task.dueMoves > 0 && task.firstDueAt && <span className="tk-pill">moved {task.dueMoves} {task.dueMoves === 1 ? 'time' : 'times'}, first due {formatDue(task.firstDueAt)}</span>}
        </div>

        {!canEdit && (
          <p className="tk-note">
            {mine?.silent
              ? 'you are a silent spectator: you can see everything and change nothing.'
              : 'you can see this because it belongs to your team. Only the people on it can change it.'}
          </p>
        )}

        {canEdit ? (
          <div className="tk-edit">
            <label className="tk-label" htmlFor="tk-title">title</label>
            <input id="tk-title" className="input" value={title} maxLength={TASK_LIMITS.titleMax} disabled={busy} onChange={e => setTitle(e.target.value)} />
            <label className="tk-label" htmlFor="tk-desc">what needs doing</label>
            <textarea id="tk-desc" className="input" rows={5} value={description} maxLength={TASK_LIMITS.descriptionMax} disabled={busy} onChange={e => setDescription(e.target.value)} />
            <div className="tk-edit-row">
              <div>
                <label className="tk-label" htmlFor="tk-due">due date</label>
                <input id="tk-due" type="date" className="input" value={due} disabled={busy} onChange={e => setDue(e.target.value)} />
              </div>
              <div>
                <label className="tk-label" htmlFor="tk-status">status</label>
                <select id="tk-status" className="input" value={task.status} disabled={busy} onChange={e => void setStatus(e.target.value as TaskStatus)}>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
            </div>
            <div className="tk-actions">
              <button type="button" className="btn btn-primary" disabled={busy || !dirty || title.trim().length < TASK_LIMITS.titleMin} onClick={() => void save()}>save changes</button>
            </div>
          </div>
        ) : (
          task.description && <p className="tk-text">{task.description}</p>
        )}

        <h3 className="tk-h3">people</h3>
        <ul className="tk-people" aria-label="people on this task">
          {task.people.map(p => (
            <li key={p.memberId} className="tk-person">
              <span className="tk-person-name">{p.name}{p.silent ? ' (silent)' : ''}</span>
              {canEdit ? (
                <>
                  <select className="input tk-person-role" aria-label={`role for ${p.name}`} value={p.role} disabled={busy}
                    onChange={e => void run(() => taskService.setPerson(task.taskId, p.memberId, { role: e.target.value as TaskRole }), 'role changed')}>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  {p.role === 'spectator' && (
                    <label className="tk-check">
                      <input type="checkbox" checked={p.silent} disabled={busy}
                        onChange={e => void run(() => taskService.setPerson(task.taskId, p.memberId, { silent: e.target.checked }), e.target.checked ? 'now a silent spectator' : 'can now edit')} />
                      silent
                    </label>
                  )}
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void remove(p.memberId, p.name)}>remove</button>
                </>
              ) : <span className="tk-pill">{ROLE_LABEL[p.role]}</span>}
            </li>
          ))}
        </ul>
        {canEdit && <PersonPicker excludeIds={task.people.map(p => p.memberId)} onPick={(m, r, s) => void addPerson(m, r, s)} disabled={busy} />}
        {canEdit && <TeamAdder teams={teams} onAdd={addTeam} disabled={busy} />}

        <h3 className="tk-h3">comments</h3>
        {comments.length === 0 ? <p className="tk-hint">no comments yet.</p> : (
          <ul className="tk-comments">
            {comments.map(c => (
              <li key={c.id}><b>{c.name}</b> <span className="tk-when">{when(c.createdAt)}</span><p>{c.body}</p></li>
            ))}
          </ul>
        )}
        {canEdit ? (
          <div className="tk-comment-form">
            <label className="tk-sr" htmlFor="tk-comment">add a comment</label>
            <textarea id="tk-comment" className="input" rows={2} value={commentText} maxLength={TASK_LIMITS.commentMax} placeholder="add a comment" disabled={busy} onChange={e => setCommentText(e.target.value)} />
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !commentText.trim()} onClick={comment}>comment</button>
          </div>
        ) : <p className="tk-hint">only the people on a task can comment.</p>}

        <h3 className="tk-h3">change log</h3>
        {events.length === 0 ? <p className="tk-hint">loading</p> : (
          <ol className="tk-log">
            {events.map(e => <li key={e.id}><span className="tk-when">{when(e.at)}</span> {eventSentence(e)}</li>)}
          </ol>
        )}
      </div>
    </Modal>
  )
}
