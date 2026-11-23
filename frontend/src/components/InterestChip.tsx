import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useToast } from './Toast'
import openingInterestService, { type Interest } from '../services/openingInterestService'
import './InterestChip.css'

/**
 * First card in the feed for a member who has just been approved and had asked to be reminded about a role or team
 * while their sign-up was pending ("you wanted to join this. Still want to?"). Self-contained: loads its own state and
 * renders nothing when there is nothing to ask. Yes opens the real apply flow; Not now retires it for good.
 * The database trigger (scripts/opening_interests_2026_11_02.sql) flips the interest to `ready` on approval.
 */
export default function InterestChip({ enabled, onVisibleChange }: { enabled: boolean; /** Lets the feed hold back other prompts while this one shows: one prompt at a time. */ onVisibleChange?: (visible: boolean) => void }) {
  const { member } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [items, setItems] = useState<Interest[]>([])
  const [busy, setBusy] = useState(false)
  const memberId = member?.member_id

  useEffect(() => {
    if (!enabled || !memberId) { setItems([]); return }
    let live = true
    openingInterestService.listReady(memberId)
      .then(r => { if (live) setItems(r) })
      .catch(() => { /* a nudge that cannot load simply does not show */ })
    return () => { live = false }
  }, [enabled, memberId])

  const first = items[0]
  const dismiss = useCallback(async () => {
    if (!first) return
    setBusy(true)
    try {
      await openingInterestService.setState(first.id, 'dismissed')
      setItems(prev => prev.filter(i => i.id !== first.id))
    } catch {
      toast.error('Could not clear that', 'Please try again in a moment.')
    } finally {
      setBusy(false)
    }
  }, [first, toast])

  const visible = enabled && !!first
  useEffect(() => { onVisibleChange?.(visible) }, [visible, onVisibleChange])

  if (!enabled || !first) return null

  const label = first.openingTitle ?? first.teamName ?? 'a team'
  // Role titles often already name the team ("Tutor, ShikshAQ"): only add "on <team>" when they do not.
  const where = first.openingTitle && first.teamName && !first.openingTitle.toLowerCase().includes(first.teamName.toLowerCase()) ? ` on ${first.teamName}` : ''
  const go = () => {
    // Opening the real form is the point; the interest closes itself when the application goes in (markApplied).
    if (first.openingId) navigate(`/opportunities/${first.openingId}?apply=1`)
    else if (first.teamUuid) navigate(`/teams/${first.teamUuid}`)
  }

  return (
    <section className="interest-chip" aria-label="You asked to be reminded about this">
      <span className="interest-chip-star" aria-hidden>★</span>
      <div className="interest-chip-text">
        <div className="interest-chip-kicker">you’re in. you wanted to join</div>
        <div className="interest-chip-title">{label}{where}. Still want to?</div>
        {items.length > 1 && <div className="interest-chip-more">and {items.length - 1} more you asked about</div>}
      </div>
      <div className="interest-chip-actions">
        <button type="button" className="btn btn-sm btn-primary" style={{ minHeight: 44 }} onClick={go} disabled={busy}>
          {first.openingId ? 'Yes, apply' : 'Yes, take me there'}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" style={{ minHeight: 44 }} onClick={dismiss} disabled={busy}>Not now</button>
      </div>
    </section>
  )
}
