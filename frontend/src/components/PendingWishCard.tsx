import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { readWish, clearWish, type WishTarget } from '../lib/pendingWish'
import openingInterestService from '../services/openingInterestService'
import { useToast } from './Toast'

/**
 * On the waiting page: "you wanted to apply for X. Want us to remind you once you're approved?"
 * The role or team comes from lib/pendingWish.ts (remembered by AuthCallbackPage when they signed in heading for it).
 * A form they had already typed before signing in is saved with the reminder, so nothing is lost. Renders nothing when
 * there is no wish, the role is gone or closed, or they already asked.
 */
export default function PendingWishCard() {
  const { member } = useAuth()
  const toast = useToast()
  const [target, setTarget] = useState<WishTarget | null>(() => readWish())
  const [subject, setSubject] = useState<string | null>(null)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'already'>('idle')
  const memberId = member?.member_id

  useEffect(() => {
    if (!target || !memberId) return
    let live = true
    ;(async () => {
      try {
        let title: string | null = null
        if ('openingId' in target) {
          const { data } = await (supabaseCommunity as any).from('job_openings').select('title, status, deleted_at').eq('id', target.openingId).maybeSingle()
          title = data && !data.deleted_at && data.status === 'open' ? data.title : null
        } else {
          const { data } = await supabaseCommunity.from('teams').select('name').eq('uuid', target.teamUuid).maybeSingle()
          title = (data as any)?.name ?? null
        }
        if (!live) return
        if (!title) { setTarget(null); return }
        const mine = await openingInterestService.getMine(memberId, target).catch(() => null)
        if (!live) return
        setSubject(title)
        if (mine && (mine.state === 'waiting' || mine.state === 'ready')) setState('already')
      } catch { if (live) setTarget(null) }
    })()
    return () => { live = false }
  }, [target, memberId])

  if (!target || !subject || !memberId) return null

  const remind = async () => {
    setState('saving')
    try {
      let draft: { message?: string; customAnswers?: Record<string, unknown> } | undefined
      if ('openingId' in target) {
        try {
          const raw = sessionStorage.getItem(`aq_apply_draft_${target.openingId}`)
          if (raw) { const d = JSON.parse(raw); draft = { message: d.message, customAnswers: d.answers } }
        } catch { /* no draft */ }
      }
      await openingInterestService.register(memberId, target, draft)
      clearWish()
      setState('saved')
    } catch {
      setState('idle')
      toast.error('Could not save that', 'Please try again in a moment.')
    }
  }
  const dismiss = () => { clearWish(); setTarget(null) }

  return (
    <section aria-label="You wanted to join this" className="card" style={{ padding: '18px 20px', marginBottom: 24, borderRadius: 'var(--r-outer)', background: 'color-mix(in srgb, var(--lemon) 38%, var(--card))' }}>
      <div className="mono xs upper" style={{ fontWeight: 800, letterSpacing: '0.08em', opacity: 0.6 }}>you wanted to join</div>
      <div className="h-display" style={{ fontSize: 22, margin: '4px 0 6px' }}>{subject}</div>
      {state === 'saved' || state === 'already' ? (
        <p style={{ margin: 0, fontFamily: 'var(--eina)', fontSize: 14, lineHeight: 1.55 }}>
          You’re on the list. The moment you’re approved we’ll remind you, with a note in your notifications and a card at the top of your feed.
        </p>
      ) : (
        <>
          <p style={{ margin: '0 0 12px', fontFamily: 'var(--eina)', fontSize: 14, lineHeight: 1.55 }}>
            You can apply once your account is approved. Want us to remind you when you’re in?
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm btn-primary" style={{ minHeight: 44 }} onClick={remind} disabled={state === 'saving'}>
              {state === 'saving' ? 'Saving…' : 'Yes, remind me'}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" style={{ minHeight: 44 }} onClick={dismiss}>No thanks</button>
          </div>
        </>
      )}
    </section>
  )
}
