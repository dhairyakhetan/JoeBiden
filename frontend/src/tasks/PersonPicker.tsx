import { useEffect, useId, useState } from 'react'
import { feedService } from '../services/feedService'
import { useDebounce } from '../hooks/useDebounce'
import { ROLES, ROLE_HINT, ROLE_LABEL, type TaskRole } from './taskModel'

export interface PickedMember {
  memberId: number
  uuid: string
  name: string
  avatarUrl?: string
}

interface Props {
  /** Members already on the task are left out of the results. */
  excludeIds: number[]
  onPick: (member: PickedMember, role: TaskRole, silent: boolean) => void
  disabled?: boolean
}

/**
 * Find a member by name and add them with a role. The role line under the selector says what each role means,
 * because the three are easy to mix up (performer does it, supervisor receives the result, spectator follows).
 * A silent spectator sees everything and changes nothing; the checkbox only appears for spectators.
 */
export default function PersonPicker({ excludeIds, onPick, disabled }: Props) {
  const uid = useId()
  const [query, setQuery] = useState('')
  const [role, setRole] = useState<TaskRole>('performer')
  const [silent, setSilent] = useState(false)
  const [results, setResults] = useState<PickedMember[]>([])
  const [searching, setSearching] = useState(false)
  const q = useDebounce(query.trim(), 250)

  useEffect(() => {
    if (q.length < 2) { setResults([]); return }
    let cancelled = false
    setSearching(true)
    feedService.searchMembers(q)
      .then(r => {
        if (cancelled) return
        setResults(r.data.members.map(m => ({ memberId: m.memberId, uuid: m.uuid, name: m.fullName, avatarUrl: m.avatarUrl })))
      })
      .catch(() => { if (!cancelled) setResults([]) })
      .finally(() => { if (!cancelled) setSearching(false) })
    return () => { cancelled = true }
  }, [q])

  const shown = results.filter(r => !excludeIds.includes(r.memberId))

  return (
    <div className="tk-picker">
      <div className="tk-picker-row">
        <label className="tk-sr" htmlFor={`${uid}-q`}>find a member by name</label>
        <input id={`${uid}-q`} className="input" value={query} placeholder="find a member by name" autoComplete="off"
          disabled={disabled} onChange={e => setQuery(e.target.value)} />
        <label className="tk-sr" htmlFor={`${uid}-role`}>their role</label>
        <select id={`${uid}-role`} className="input" value={role} disabled={disabled}
          onChange={e => { setRole(e.target.value as TaskRole); if (e.target.value !== 'spectator') setSilent(false) }}>
          {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </div>
      <p className="tk-hint">{ROLE_LABEL[role]}: {ROLE_HINT[role]}</p>
      {role === 'spectator' && (
        <label className="tk-check">
          <input type="checkbox" checked={silent} disabled={disabled} onChange={e => setSilent(e.target.checked)} />
          silent spectator: can see everything but cannot edit or comment
        </label>
      )}
      {q.length >= 2 && (
        <ul className="tk-results" aria-label="matching members">
          {searching && shown.length === 0 && <li className="tk-hint">searching</li>}
          {!searching && shown.length === 0 && <li className="tk-hint">nobody matches that</li>}
          {shown.map(m => (
            <li key={m.memberId}>
              <button type="button" className="tk-result" disabled={disabled}
                onClick={() => { onPick(m, role, role === 'spectator' ? silent : false); setQuery(''); setResults([]) }}>
                <span>{m.name}</span>
                <span className="tk-result-add">add as {ROLE_LABEL[role]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
