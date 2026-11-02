import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import useDialog from '../hooks/useDialog'
import { useToast } from './Toast'
import { SuccessCheck } from './SuccessCheck'
import { canRegisterInterest, type JoinGate } from '../lib/joinGate'
import openingInterestService from '../services/openingInterestService'

/**
 * Shown instead of an apply or join form when the member's own sign-up has not been approved yet.
 * pending: "you are not part of AquaTerra yet, apply once you are confirmed", with a button that registers interest
 * (we remind you once you are in, and put a chip at the top of your feed). rejected / blocked: a plain no, no reminder.
 * See lib/joinGate.ts for the rule and scripts/opening_interests_2026_11_02.sql for the table behind the button.
 */
export default function NotYetMemberModal({ gate, memberId, target, subject, accent = 'var(--lemon)', draft, onClose }: {
  gate: JoinGate
  memberId: number
  /** What they wanted: a role (openingId) or a team (teamUuid). */
  target: { openingId: string } | { teamUuid: string }
  /** Human name of it, e.g. the role title or the team name. */
  subject: string
  accent?: string
  /** A form they had already typed before signing in. Saved with the interest so nothing is lost. */
  draft?: { message?: string; customAnswers?: Record<string, unknown> }
  onClose: () => void
}) {
  const toast = useToast()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [already, setAlready] = useState(false)
  const panelRef = useDialog(true, onClose, { closeOnEscape: !saving })
  const pending = canRegisterInterest(gate)

  // If they already asked to be reminded, say so instead of offering the button again.
  useEffect(() => {
    if (!pending) return
    let live = true
    openingInterestService.getMine(memberId, target)
      .then(i => { if (live && i && (i.state === 'waiting' || i.state === 'ready')) setAlready(true) })
      .catch(() => { /* not knowing is fine: the button still works and saving twice is harmless */ })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, pending])

  const remind = async () => {
    setSaving(true)
    try {
      await openingInterestService.register(memberId, target, draft)
      setSaved(true)
    } catch {
      toast.error('Could not save that', 'Please try again in a moment.')
    } finally {
      setSaving(false)
    }
  }

  const title = pending
    ? (saved || already ? 'you’re on the list.' : 'you’re not part of AquaTerra yet.')
    : 'you can’t apply right now.'

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, background: 'var(--card)', borderRadius: 'var(--r-outer)', overflow: 'hidden', border: 'var(--hair-2)', boxShadow: 'var(--lift-4)' }}>
        <div style={{ background: accent, padding: '18px 24px 16px', color: 'var(--ink)', borderBottom: 'var(--hair)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginBottom: 6 }}>you wanted to join</div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{subject}</div>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pending && (saved || already) && (
            <div style={{ display: 'flex', justifyContent: 'center' }}><SuccessCheck color={accent} /></div>
          )}
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 24, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{title}</div>
          {pending ? (
            saved || already ? (
              <p style={{ margin: 0, fontFamily: 'var(--eina)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                We’ll remind you the moment you’re confirmed, with a note in your notifications and a card at the top of your feed asking if you still want this.
              </p>
            ) : (
              <p style={{ margin: 0, fontFamily: 'var(--eina)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                Your sign-up is waiting for approval. Once you’re confirmed, you can apply. Want us to remind you when you’re in?
              </p>
            )
          ) : (
            <p style={{ margin: 0, fontFamily: 'var(--eina)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              {gate === 'rejected'
                ? 'Your AquaTerra sign-up wasn’t approved, so applications to teams are closed for now. You can sign up again after the waiting period.'
                : 'Your account can’t apply to teams at the moment. If you think that’s a mistake, ask your team lead or HR.'}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            {pending && !saved && !already && (
              <button type="button" className="btn btn-sm btn-primary" style={{ minHeight: 44 }} onClick={remind} disabled={saving}>
                {saving ? 'Saving…' : 'Yes, remind me'}
              </button>
            )}
            {gate === 'rejected' && (
              <Link to="/rejected" className="btn btn-sm btn-ghost" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }} onClick={onClose}>What happens next</Link>
            )}
            <button type="button" className="btn btn-sm btn-ghost" style={{ minHeight: 44 }} onClick={onClose}>
              {pending && !saved && !already ? 'Not now' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
