import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import needsMeService, { type NeedRow } from '../services/needsMeService'
import './NeedsMeCard.css'

/**
 * "Waiting on you" at the top of the feed: overdue or due-soon tasks, a drive you were made lead of, a fix to confirm.
 * Self-contained: renders nothing while loading and nothing when nothing is waiting, so it only ever appears when it is
 * useful. Tells the feed whether it is showing (onVisibleChange) so only one prompt competes for the top of the feed.
 */
export default function NeedsMeCard({ enabled, onVisibleChange }: { enabled: boolean; onVisibleChange?: (visible: boolean) => void }) {
  const { member } = useAuth()
  const memberId = member?.member_id
  const [rows, setRows] = useState<NeedRow[]>([])

  useEffect(() => {
    if (!enabled || !memberId) { setRows([]); return }
    let live = true
    needsMeService.loadNeeds(memberId).then(r => { if (live) setRows(r) }).catch(() => {})
    return () => { live = false }
  }, [enabled, memberId])

  const visible = enabled && rows.length > 0
  useEffect(() => { onVisibleChange?.(visible) }, [visible, onVisibleChange])
  if (!visible) return null

  return (
    <section className="needs-me" aria-label="Waiting on you">
      <div className="needs-me-kicker">waiting on you</div>
      {rows.map(r => (
        <Link key={r.key} to={r.to} className={'needs-me-row' + (r.urgent ? ' is-urgent' : '')}>
          <span className="needs-me-icon" aria-hidden>{r.icon}</span>
          <span className="needs-me-text">{r.text}</span>
          <span className="needs-me-go" aria-hidden>→</span>
        </Link>
      ))}
    </section>
  )
}
