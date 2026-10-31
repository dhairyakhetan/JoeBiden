import { useEffect, useState } from 'react'
import Modal from '../components/Modal'
import Field from '../components/Field'
import { useToast } from '../components/Toast'
import { useAuth } from '../auth/AuthContext'
import { hasLeaderAccess } from '../lib/roles'
import { taskService } from '../services/taskService'
import PersonPicker, { type PickedMember } from './PersonPicker'
import TeamAdder from './TeamAdder'
import {
  ROLES, ROLE_LABEL, TASK_LIMITS, addMany, dueFromDateInput, validateNewTask,
  type PersonInput, type TaskKind, type TaskRole,
} from './taskModel'
import './Tasks.css'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (uuid: string) => void
}

/**
 * New task. Team or general, a title, what to do, an optional due date, and the people with their roles. Every
 * mutation shows a pending state and a toast (CLAUDE.md feedback pattern). The creator is added as supervisor unless
 * they pick a role for themselves, and the form says so, because that is the one thing people would not guess.
 */
export default function TaskForm({ open, onClose, onCreated }: Props) {
  const { member } = useAuth()
  const toast = useToast()
  const isLeader = hasLeaderAccess(member?.role)

  const [kind, setKind] = useState<TaskKind>('team')
  const [teams, setTeams] = useState<{ teamId: number; name: string }[]>([])
  const [teamId, setTeamId] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [due, setDue] = useState('')
  const [people, setPeople] = useState<PersonInput[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || member?.member_id == null) return
    let cancelled = false
    taskService.teamsFor(member.member_id, isLeader)
      .then(t => {
        if (cancelled) return
        setTeams(t)
        setTeamId(cur => cur ?? (t.length === 1 ? t[0].teamId : null))
        if (t.length === 0) setKind('general')
      })
      .catch(() => { if (!cancelled) toast.error("couldn't load your teams", 'you can still make a general task.') })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member?.member_id, isLeader])

  function addPerson(m: PickedMember, role: TaskRole, silent: boolean) {
    setPeople(list => [...list.filter(p => p.memberId !== m.memberId), { ...m, role, silent }])
  }

  function changeRole(memberId: number, role: TaskRole) {
    setPeople(list => list.map(p => (p.memberId === memberId ? { ...p, role, silent: role === 'spectator' ? p.silent : false } : p)))
  }

  async function submit() {
    if (!member) return
    const input = { title, description, kind, teamId: kind === 'team' ? teamId : null, dueAt: dueFromDateInput(due), people }
    const problem = validateNewTask(input)
    if (problem) { setError(problem); return }
    setError('')
    setSaving(true)
    try {
      const uuid = await taskService.create(input, {
        memberId: member.member_id, uuid: member.uuid, name: member.full_name, avatarUrl: member.avatar_url ?? undefined,
      })
      toast.success('task created')
      onCreated(uuid)
      onClose()
    } catch (err) {
      console.error('TaskForm create error:', err)
      toast.error("couldn't create the task", 'nothing was saved. try again.')
    } finally {
      setSaving(false)
    }
  }

  const iAmListed = people.some(p => p.memberId === member?.member_id)

  return (
    <Modal isOpen={open} onClose={saving ? () => {} : onClose} title="new task" size="lg" fullScreenMobile>
      <form className="tk-form" onSubmit={e => { e.preventDefault(); void submit() }}>
        <fieldset className="tk-kinds">
          <legend className="tk-sr">kind of task</legend>
          <label className={'tk-kind' + (kind === 'team' ? ' is-on' : '')}>
            <input type="radio" name="kind" checked={kind === 'team'} disabled={saving || teams.length === 0} onChange={() => setKind('team')} />
            <b>team task</b>
            <span>everyone in the team can see it. Only the people on it can change it.</span>
          </label>
          <label className={'tk-kind' + (kind === 'general' ? ' is-on' : '')}>
            <input type="radio" name="kind" checked={kind === 'general'} disabled={saving} onChange={() => setKind('general')} />
            <b>general task</b>
            <span>private. Only the people you add can see it.</span>
          </label>
        </fieldset>

        {kind === 'team' && (
          <Field label="which team" required>
            {id => (
              <select id={id} className="input" value={teamId ?? ''} disabled={saving} onChange={e => setTeamId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">pick a team</option>
                {teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
              </select>
            )}
          </Field>
        )}

        <Field label="title" required>
          {id => <input id={id} className="input" value={title} maxLength={TASK_LIMITS.titleMax} disabled={saving} onChange={e => setTitle(e.target.value)} />}
        </Field>
        <Field label="what needs doing" hint="optional. Say what done looks like.">
          {id => <textarea id={id} className="input" rows={4} value={description} maxLength={TASK_LIMITS.descriptionMax} disabled={saving} onChange={e => setDescription(e.target.value)} />}
        </Field>
        <Field label="due date" hint="optional. The task counts as late after the end of this day.">
          {id => <input id={id} type="date" className="input" value={due} disabled={saving} onChange={e => setDue(e.target.value)} />}
        </Field>

        <div className="tk-people-block">
          <h3 className="tk-h3">people</h3>
          <PersonPicker excludeIds={people.map(p => p.memberId)} onPick={addPerson} disabled={saving} />
          <TeamAdder
            teams={teams}
            disabled={saving}
            onAdd={(members, role, silent, teamName) => {
              const before = people.length
              const next = addMany(people, members, role, silent, member ? [member.member_id] : [])
              setPeople(next)
              toast.success(`${next.length - before} from ${teamName} added`)
            }}
          />
          {people.length > 0 && (
            <ul className="tk-people" aria-label="people on this task">
              {people.map(p => (
                <li key={p.memberId} className="tk-person">
                  <span className="tk-person-name">{p.name}{p.silent ? ' (silent)' : ''}</span>
                  <select className="input tk-person-role" aria-label={`role for ${p.name}`} value={p.role} disabled={saving} onChange={e => changeRole(p.memberId, e.target.value as TaskRole)}>
                    {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  <button type="button" className="btn btn-sm" disabled={saving} onClick={() => setPeople(list => list.filter(x => x.memberId !== p.memberId))}>remove</button>
                </li>
              ))}
            </ul>
          )}
          {!iAmListed && <p className="tk-hint">you will be added as the supervisor, since you are probably the one who assigned it. Add yourself above with another role to change that.</p>}
        </div>

        {error && <p className="tk-error" role="alert">{error}</p>}

        <div className="tk-actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'creating' : 'create task'}</button>
        </div>
      </form>
    </Modal>
  )
}
