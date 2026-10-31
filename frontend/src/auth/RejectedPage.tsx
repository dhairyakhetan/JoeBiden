import './RejectedPage.css'
import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { useToast } from '../components/Toast'

const RejectedPage = () => {
  const navigate = useNavigate()
  const { member, logout, isAuthenticated, refreshMember } = useAuth()
  const toast = useToast()
  const [appealing, setAppealing] = useState(false)

  const status = member?.status
  const isSuspended = status === 'suspended'
  const isDeleted = status === 'deleted'
  const blocked = status === 'rejected' || status === 'suspended' || status === 'deleted'

  // Self-service appeal (2026-09-14, owner request): sends the account back
  // through the real apply -> pending -> approve funnel instead of waiting
  // on a super admin to notice and restore it. Only offered for
  // suspended/deleted - 'rejected' keeps its existing "re-apply after 30
  // days" policy copy below, which an instant appeal button would
  // contradict. appeal_removed_account() (SECURITY DEFINER) also stamps
  // members.previously_removed = true, which is what puts the red "removed
  // before" flag on this application when a HoD reviews it.
  const handleAppeal = async () => {
    setAppealing(true)
    try {
      const { error } = await supabaseCommunity.rpc('appeal_removed_account' as never)
      if (error) throw error
      await refreshMember()
      navigate('/pending', { replace: true })
    } catch (e: any) {
      toast.error('couldn’t send that appeal.', e?.message)
      setAppealing(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !blocked) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, blocked, navigate])

  if (!isAuthenticated || !blocked) {
    return null
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="route-enter aq-wrap" style={{ paddingTop: 'clamp(44px, 8vw, 80px)', paddingBottom: 'clamp(44px, 8vw, 80px)', maxWidth: 600, textAlign: 'center' }}>
      {/* Section 02, rejected spec: the seedling emoji at 90px is DELETED.
          It was the page's largest element, and a growing plant is an
          optimistic mark on the one screen that has to deliver a no. */}
      <span className="rj-sticker">{isSuspended ? '★ account update' : isDeleted ? '★ account update' : '★ application update'}</span>
      <h1 className="h-display rj-h1">
        {isSuspended ? (
          <>on<br /><span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>hold</span>.</>
        ) : isDeleted ? (
          <>account<br /><span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>removed</span>.</>
        ) : (
          <>not this<br /><span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>round</span>.</>
        )}
      </h1>
      <p style={{ fontSize: 18, marginTop: 16, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        {isSuspended
          ? 'your AquaTerra account has been suspended. you will not be able to use the community platform while the suspension is in place.'
          : isDeleted
            ? 'your AquaTerra account was removed by an admin. nothing was permanently lost - a super admin can restore it.'
            : 'your application to join AquaTerra was not approved this time.'}
      </p>

      {/* Full 2px ink border rather than a 4px tomato left edge: the reason is
          the most important thing on this page and a partial accent read as a
          quotation. The mono label moves to --pink, which is a display hue and
          would measure 3.14:1 as 11px text on a white card, so it uses
          --pink-ink. */}
      {(member as any)?.rejection_note && (
        <div className="card rj-reason">
          <div className="mono xs upper" style={{ fontWeight: 700, marginBottom: 8, color: 'var(--pink-ink)' }}>reason</div>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{(member as any).rejection_note}</p>
        </div>
      )}

      <div className="card rj-whatnow">
        <div className="mono xs upper" style={{ fontWeight: 700, marginBottom: 12, color: 'var(--ink)' }}>★ what now</div>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 2, color: 'var(--ink-2)' }}>
          {isSuspended || isDeleted ? (
            <>
              <li>reach us on Instagram <strong>@ngo.aquaterra</strong> if you think this is a mistake</li>
              <li>a super admin can reinstate your account after review</li>
            </>
          ) : (
            <>
              <li>re-apply after 30 days with a stronger application</li>
              <li>reach us on Instagram <strong>@ngo.aquaterra</strong> with questions</li>
              <li>volunteer at community drives without being a formal member</li>
            </>
          )}
        </ul>
      </div>

      {/* Three chips at flex: 1 rather than three centred buttons, so the row
          fills the measure and every target clears 46px. */}
      <div className="rj-actions">
        {(isSuspended || isDeleted) && (
          <button className="btn btn-primary" onClick={handleAppeal} disabled={appealing}>
            {appealing ? 'sending appeal…' : 'appeal →'}
          </button>
        )}
        <a href="https://instagram.com/ngo.aquaterra" target="_blank" rel="noopener noreferrer" className="btn">
          talk to us →
        </a>
        <Link to="/" className="btn">back home →</Link>
        <button className="btn" onClick={handleLogout}>log out</button>
      </div>
    </div>
  )
}

export default RejectedPage
