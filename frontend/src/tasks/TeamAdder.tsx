import { useId, useState } from 'react'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { taskService } from '../services/taskService'
import { ROLES, ROLE_LABEL, type TaskRole } from './taskModel'

export interface TeamMember { memberId: number; uuid: string; name: string; avatarUrl?: string }

interface Props {
  teams: { teamId: number; name: string }[]
  /** Called with the team's current members once the person has confirmed. */
  onAdd: (members: TeamMember[], role: TaskRole, silent: boolean, teamName: string) => void
  disabled?: boolean
}

/**
 * "Add a whole team": pick a team and a role, everyone currently on it joins with that role. The common case is the
 * whole team as spectators so they can follow without being asked to do anything. Large teams ask first, since a
 * misclick would put dozens of people on a task.
 */
export default function TeamAdder({ teams, onAdd, disabled }: Props) {
  const uid = useId()
  const toast = useToast()
  const confirm = useConfirm()
  const [teamId, setTeamId] = useState('')
  const [role, setRole] = useState<TaskRole>('spectator')
  const [silent, setSilent] = useState(false)
  const [busy, setBusy] = useState(false)

  if (teams.length === 0) return null

  async function add() {
    const team = teams.find(t => String(t.teamId) === teamId)
    if (!team || busy) return
    setBusy(true)
    try {
      const members = await taskService.teamMembers(team.teamId)
      if (members.length === 0) { toast.info(`${team.name} has no active members`); return }
      if (members.length > 25) {
        const ok = await confirm({
          title: `add ${members.length} people?`,
          body: `everyone on ${team.name} joins as ${ROLE_LABEL[role]}${role === 'spectator' && silent ? ' (silent)' : ''}.`,
          confirmLabel: `add ${members.length}`,
        })
        if (!ok) return
      }
      onAdd(members, role, role === 'spectator' ? silent : false, team.name)
      setTeamId('')
    } catch (err) {
      console.error('TeamAdder error:', err)
      toast.error("couldn't load that team", 'nobody was added. try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tk-picker">
      <div className="tk-picker-row">
        <label className="tk-sr" htmlFor={`${uid}-team`}>add a whole team</label>
        <select id={`${uid}-team`} className="input" value={teamId} disabled={disabled || busy} onChange={e => setTeamId(e.target.value)}>
          <option value="">add a whole team</option>
          {teams.map(t => <option key={t.teamId} value={t.teamId}>{t.name}</option>)}
        </select>
        <label className="tk-sr" htmlFor={`${uid}-trole`}>their role</label>
        <select id={`${uid}-trole`} className="input" value={role} disabled={disabled || busy}
          onChange={e => { setRole(e.target.value as TaskRole); if (e.target.value !== 'spectator') setSilent(false) }}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      {role === 'spectator' && (
        <label className="tk-check">
          <input type="checkbox" checked={silent} disabled={disabled || busy} onChange={e => setSilent(e.target.checked)} />
          silent spectators: can see everything but cannot edit or comment
        </label>
      )}
      <div className="tk-actions">
        <button type="button" className="btn btn-sm" disabled={disabled || busy || !teamId} onClick={() => void add()}>
          {busy ? 'adding' : 'add everyone on this team'}
        </button>
      </div>
    </div>
  )
}
