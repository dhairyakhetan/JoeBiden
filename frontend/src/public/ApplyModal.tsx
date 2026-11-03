import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { setAuthIntent, type GateCategory } from '../lib/authIntent'
import { jobOpenings, JobOpening, CAT_COLORS } from '../lib/jobOpenings'
import { useToast } from '../components/Toast'
import type { Database } from '../lib/database.types'
import { OpeningQuestionFields, useOpeningAnswers } from '../components/OpeningQuestionBuilder'
import { SuccessCheck } from '../components/SuccessCheck'
import useDialog from '../hooks/useDialog'
import GatedButton from '../components/GatedButton'
import NotYetMemberModal from '../components/NotYetMemberModal'
import { joinGate, canApplyNow } from '../lib/joinGate'
import { guestIdentityProblem, matchGuest, guestCopy, continueWithGoogle, type GuestMatch } from '../lib/guestApply'

type Member = Database['public']['Tables']['members']['Row']

/** The apply form, shared by the Opportunities list and the role detail page. Portals to <body> (see PR 96). */
export default function ApplyModal({ op, member, onClose, onApplied }: {
  op: JobOpening
  /** null: a signed-out visitor. They fill the form first and sign in with Google only when they press send. */
  member: Member | null
  onClose: () => void
  onApplied: () => void
}) {
  const { error: toastError } = useToast()
  const draftKey = `aq_apply_draft_${op.id}`
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  // Known phone and an optional note stay folded away: the common case is one tap on Submit.
  const [editPhone, setEditPhone] = useState(!member?.phone)
  const [showNote, setShowNote] = useState(false)
  // Signed-out visitors: step 1 collects who they are, step 2 (after `match`) signs them in with Google.
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [matching, setMatching] = useState(false)
  const [match, setMatch] = useState<GuestMatch | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const accent = CAT_COLORS[op.category] || 'var(--welfare)'
  const questions = op.customQuestions || []
  const { answers, setAnswer, files, setFile, phone, setPhone, phoneMissing, missingRequired, buildCustomAnswers } = useOpeningAnswers(questions)
  const panelRef = useDialog(true, onClose, { closeOnEscape: !submitting })

  // A visitor who filled the form, signed in and came back finds it as they left it (typed answers only, not files).
  useEffect(() => {
    if (member?.phone) setPhone(member.phone)
    if (!member) return
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (!raw) return
      sessionStorage.removeItem(draftKey)
      const d = JSON.parse(raw) as { phone?: string; message?: string; answers?: Record<string, string> }
      if (d.phone) setPhone(d.phone)
      if (d.message) { setMessage(d.message); setShowNote(true) }
      Object.entries(d.answers || {}).forEach(([k, v]) => setAnswer(k, v))
    } catch { /* storage blocked or malformed: start with an empty form */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member])

  const submit = async () => {
    if (phoneMissing) { toastError('Phone number is required'); return }
    if (missingRequired) { toastError(`"${missingRequired.label}" is required`); return }
    if (!member) {
      const problem = guestIdentityProblem({ name: guestName, phone, email: guestEmail })
      if (problem) { toastError(problem); return }
      setMatching(true)
      try {
        const m = await matchGuest(phone, guestEmail)
        if (m.outcome === 'limited') toastError('Too many tries just now.', 'You can still continue with Google below.')
        setMatch(m)
      } finally { setMatching(false) }
      return
    }
    setSubmitting(true)
    try {
      const customAnswers = await buildCustomAnswers()
      const result = await jobOpenings.apply(op.id, member.member_id, member.full_name, member.email, message, customAnswers, phone)
      if (result.alreadyApplied) { toastError('You already applied for this role.'); onApplied(); onClose(); return }
      if (!result.success) { toastError(result.error || 'Something went wrong.'); return }
      setDone(true)
      onApplied()
    } catch (e: any) {
      // buildCustomAnswers() uploads files and can reject; without this the
      // button would hang on "Submitting…" forever. Surface the error.
      toastError(e?.message || 'Something went wrong submitting your application.')
    } finally {
      setSubmitting(false)
    }
  }

  const startGoogle = async () => {
    if (!match) return
    setSigningIn(true)
    try { sessionStorage.setItem(draftKey, JSON.stringify({ phone, message, answers })) } catch { /* the guest draft below still carries it */ }
    setAuthIntent({ kind: 'opening', title: op.title, category: op.category as GateCategory, teamName: op.teamName || null })
    const { error } = await continueWithGoogle({
      draft: { openingId: op.id, title: op.title, name: guestName.trim(), email: guestEmail.trim(), phone, message, answers },
      returnTo: `/opportunities/${op.id}?apply=1`,
      loginHint: guestCopy(match, op.title).useHint ? guestEmail.trim() : undefined,
    })
    if (error) { toastError('Could not reach Google', error); setSigningIn(false) }
  }

  // Not approved yet: no form. Say so, and let a pending member ask to be reminded. A draft they typed before
  // signing in is kept with the interest, so coming back later costs them nothing.
  const gate = joinGate(member)
  if (member && !canApplyNow(gate)) {
    let draft: { message?: string; customAnswers?: Record<string, unknown> } | undefined
    try {
      const raw = sessionStorage.getItem(draftKey)
      if (raw) { const d = JSON.parse(raw); draft = { message: d.message, customAnswers: d.answers } }
    } catch { /* no draft is fine */ }
    return <NotYetMemberModal gate={gate} memberId={member.member_id} target={{ openingId: op.id }} subject={op.title} accent={accent} draft={draft} onClose={onClose} />
  }

  return createPortal(
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Same rounded-minimalism modal shell as OpeningFormModal above. */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Apply for ${op.title}`} tabIndex={-1} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: 'var(--r-outer)', overflow: 'hidden', border: 'var(--hair-2)', boxShadow: 'var(--lift-4)' }}>
        {/* Header */}
        <div style={{ background: accent, padding: '18px 24px 16px', color: 'var(--ink)', borderBottom: 'var(--hair)' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginBottom: 6 }}>
            applying for
          </div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 22, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {op.title}
          </div>
        </div>

        {done ? (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
              <SuccessCheck color={accent} fx="confetti" />
            </div>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 30, marginBottom: 10, letterSpacing: '-0.03em' }}>you&apos;re in.</div>
            <p style={{ fontFamily: 'var(--eina)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 20 }}>
              Application submitted. The team will review it and reach out.
            </p>
            <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} onClick={onClose}>Close</button>
          </div>
        ) : !member && match ? (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              const c = guestCopy(match, op.title)
              return (
                <>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}><strong style={{ color: 'var(--ink)' }}>Step 2 of 2.</strong> Sign in to send.</div>
                  <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 26, letterSpacing: '-0.03em', lineHeight: 1.05 }}>{c.heading}</div>
                  <p style={{ fontFamily: 'var(--eina)', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{c.body}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-primary btn-sm" disabled={signingIn}
                      style={{ flex: 1, justifyContent: 'center', minHeight: 44, background: accent, borderColor: accent, color: 'var(--ink)' }} onClick={startGoogle}>
                      {signingIn ? 'Opening Google…' : c.button}
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" style={{ minHeight: 44 }} disabled={signingIn} onClick={() => setMatch(null)}>Back</button>
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Who is applying */}
            {/* Card-inside-a-card well: off-spine 10px -> the 14px tight step. */}
            <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--r-tight)', padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
              {member ? <>Applying as <strong style={{ color: 'var(--ink)' }}>{member.full_name}</strong></> : <><strong style={{ color: 'var(--ink)' }}>Step 1 of 2.</strong> Tell us who you are. Step 2 is signing in with Google, right here. Your answers are kept.</>}
            </div>
            {!member && (
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label htmlFor="apply-name" style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>
                    Your name <span style={{ color: 'var(--accent-ink)' }}>*</span>
                  </label>
                  <input id="apply-name" type="text" required autoComplete="name" value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="Full name"
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-2)', border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', fontFamily: 'var(--eina)', fontSize: 16, color: 'var(--ink)', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label htmlFor="apply-email" style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>
                    Email <span style={{ color: 'var(--accent-ink)' }}>*</span>
                  </label>
                  <input id="apply-email" type="email" required autoComplete="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} placeholder="you@example.com"
                    style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-2)', border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', fontFamily: 'var(--eina)', fontSize: 16, color: 'var(--ink)', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
            {/* Phone */}
            {!editPhone && phone ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                <span>We will reach you on <strong style={{ color: 'var(--ink)' }}>{phone}</strong></span>
                <button type="button" className="btn btn-sm btn-ghost" style={{ minHeight: 36 }} onClick={() => setEditPhone(true)}>change</button>
              </div>
            ) : (
            <div>
              <label htmlFor="apply-phone" style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>
                Phone number <span style={{ color: 'var(--accent-ink)' }}>*</span>
              </label>
              <input
                id="apply-phone"
                type="tel"
                required
                autoComplete="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 98765 43210"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-2)', border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', fontFamily: 'var(--eina)', fontSize: 16, color: 'var(--ink)', boxSizing: 'border-box' }}
              />
            </div>
            )}
            {/* Message */}
            {!showNote ? (
              <button type="button" className="btn btn-sm btn-ghost" style={{ minHeight: 40, alignSelf: 'flex-start' }} onClick={() => setShowNote(true)}>+ add a note (optional)</button>
            ) : (
            <div>
              <label htmlFor="apply-message" style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6 }}>
                Why are you a good fit? <span style={{ opacity: 0.5, fontWeight: 400, textTransform: 'none' }}>(optional)</span>
              </label>
              <textarea
                id="apply-message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell the team a bit about yourself and why you're interested..."
                style={{ width: '100%', minHeight: 110, padding: '10px 12px', background: 'var(--bg-2)', border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', fontFamily: 'var(--eina)', fontSize: 16, color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            )}
            <OpeningQuestionFields questions={questions} answers={answers} onAnswerChange={setAnswer} files={files} onFileChange={setFile} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* §11.9 state 11. `submit` already had the right sentence for
                  each of these two cases - but the button was `disabled`, so
                  it could never run and the applicant was left with a dead
                  button and no idea which answer was missing. Same strings,
                  now shown where the problem is. Only `submitting` stays a
                  hard disable: that one explains itself in the label. */}
              <GatedButton
                className="btn btn-primary btn-sm"
                /* Primary CTA keeps a hard offset, but only the measured
                   --shadow-cta token (was a hand-rolled 2px 2px 0). */
                style={{ flex: 1, justifyContent: 'center', gap: 8, minHeight: 44, background: accent, borderColor: accent, color: 'var(--ink)', boxShadow: 'var(--shadow-cta)' }}
                disabled={submitting || matching}
                reason={
                  phoneMissing ? 'Phone number is required'
                    : missingRequired ? `"${missingRequired.label}" is required`
                    : null
                }
                onClick={submit}
              >
                {submitting && <span style={{ width: 13, height: 13, border: '2px solid rgba(10,10,10,0.3)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
                {submitting ? 'Submitting…' : matching ? 'Checking…' : member ? 'Submit application →' : 'Continue →'}
              </GatedButton>
              <button className="btn btn-sm btn-ghost" style={{ minHeight: 44 }} onClick={onClose}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
