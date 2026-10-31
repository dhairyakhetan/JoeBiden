import { motion, useReducedMotion } from 'framer-motion'
import Img from '../components/Img'
import { springPop, tapScale } from '../lib/motion'
import { getInitials, hashColor } from '../lib/uiHelpers'
import {
  DUE_LABEL, ROLE_LABEL, STATUS_LABEL, canEditTask, dueState, formatDue, personOn,
  type Task,
} from './taskModel'
import './Tasks.css'

function AvatarStack({ task }: { task: Task }) {
  const shown = task.people.slice(0, 4)
  const more = task.people.length - shown.length
  return (
    <span className="tk-stack" aria-label={`${task.people.length} ${task.people.length === 1 ? 'person' : 'people'} on this task`}>
      {shown.map(p => (
        <span key={p.memberId} className="tk-av" style={{ background: hashColor(p.name) }} title={`${p.name}, ${ROLE_LABEL[p.role]}`}>
          {p.avatarUrl ? <Img ctx="avatar" src={p.avatarUrl} alt="" referrerPolicy="no-referrer" /> : getInitials(p.name)}
        </span>
      ))}
      {more > 0 && <span className="tk-av tk-av-more">+{more}</span>}
    </span>
  )
}

/** One task in a list: a done circle (for people who can edit it), the title, badges and who is on it. */
export function TaskCard({ task, viewerId, onOpen, onToggleDone, busy }: {
  task: Task; viewerId: number | null; onOpen: () => void; onToggleDone: (el: HTMLElement) => void; busy: boolean
}) {
  const reduced = useReducedMotion()
  const state = dueState(task)
  const mine = personOn(task, viewerId)
  const done = task.status === 'done'
  const canToggle = canEditTask(task, viewerId)
  return (
    <li className={'tk-row' + (done ? ' is-done' : '')} data-status={task.status} data-due={state}>
      {canToggle ? (
        <motion.button
          type="button"
          className="tk-tick"
          aria-pressed={done}
          aria-label={done ? `reopen ${task.title}` : `mark ${task.title} done`}
          disabled={busy}
          whileTap={reduced ? undefined : tapScale}
          onClick={e => onToggleDone(e.currentTarget)}
        >
          <motion.svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={false} animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }} transition={reduced ? { duration: 0 } : springPop} />
          </motion.svg>
        </motion.button>
      ) : (
        <span className="tk-tick is-static" aria-hidden />
      )}
      <button type="button" className="tk-card" onClick={onOpen}>
        <span className="tk-card-title">{task.title}</span>
        <span className="tk-badges">
          <span className="tk-pill">{task.kind === 'team' ? (task.teamName ?? 'team task') : 'general'}</span>
          <span className={'tk-pill tk-status s-' + task.status}>{STATUS_LABEL[task.status]}</span>
          {task.dueAt && <span className={'tk-pill tk-due d-' + state}>{DUE_LABEL[state]}, {formatDue(task.dueAt)}</span>}
          {mine && <span className="tk-pill tk-you">you: {ROLE_LABEL[mine.role]}{mine.silent ? ', silent' : ''}</span>}
        </span>
        <AvatarStack task={task} />
      </button>
    </li>
  )
}
