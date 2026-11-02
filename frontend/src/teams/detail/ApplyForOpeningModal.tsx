// Split out of TeamDetailPage.tsx - was already a proper hooks-compliant
// component taking only props, so this move is a pure relocation with no
// behavior change.
import { useState, useEffect } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '../../components/Toast'
import { useAuth } from '../../auth/AuthContext'
import useDialog from '../../hooks/useDialog'
import { jobOpenings } from '../../lib/jobOpenings'
import { OpeningQuestionFields, useOpeningAnswers } from '../../components/OpeningQuestionBuilder'
import { SuccessCheck } from '../../components/SuccessCheck'
import Field from '../../components/Field'
import { TeamOpening } from './shared'
import NotYetMemberModal from '../../components/NotYetMemberModal'
import { joinGate, canApplyNow } from '../../lib/joinGate'

/** The orphan-label style, lifted to a const so both Fields share one copy. */
const LABEL_ST: React.CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6,
}

export default function ApplyForOpeningModal({
  opening, teamName, catColor, onClose, onSuccess,
}: {
  opening: TeamOpening
  teamName: string
  teamUuid: string
  catColor: string
  onClose: () => void
  onSuccess: () => void
}) {
  const { success: toastSuccess, error: toastError } = useToast()
  const { member: currentMember } = useAuth()
  const [applyMsg, setApplyMsg] = useState(`Applying for: ${opening.title}\n\n`)
  const [applyLoading, setApplyLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const questions = opening.customQuestions || []
  const { answers, setAnswer, files, setFile, phone, setPhone, phoneMissing, missingRequired, reset: resetAnswers, buildCustomAnswers } = useOpeningAnswers(questions)
  // Matches the scrim: once the application is in, Escape shouldn't dismiss the
  // success state out from under the member before they've read it.
  // Overlay-layer migration: panel 20 -> --r-outer, 2px ink border -> hairline
  // + --lift-4, and the error card's 1.5px/10px edge onto 1px/--r-tight.
  const panelRef = useDialog(true, onClose, { closeOnEscape: !applyLoading && !submitted })

  useEffect(() => {
    if (currentMember?.phone) setPhone(currentMember.phone)
  }, [currentMember])

  const closeModal = () => { setApplyMsg(`Applying for: ${opening.title}\n\n`); resetAnswers(); setSubmitted(false); setApplyError(null); onClose() }

  const handleApply = async () => {
    // Reachable again now that the button is only disabled while in flight -
    // this branch, and the two below it, were dead behind the old `disabled`.
    if (!applyMsg.trim()) { const msg = '"why are you a good fit?" is required'; toastError(msg); setApplyError(msg); return }
    if (phoneMissing) { const msg = 'Phone number is required'; toastError(msg); setApplyError(msg); return }
    if (missingRequired) { const msg = `"${missingRequired.label}" is required`; toastError(msg); setApplyError(msg); return }
    setApplyLoading(true); setApplyError(null)
    try {
      // Upload any file answers first - customAnswers stores the resulting
      // public URL, same "post-documents" bucket every post attachment
      // already uses (authenticated write, public read).
      const customAnswers = await buildCustomAnswers()
      const result = await jobOpenings.apply(
        opening.id, currentMember!.member_id,
        currentMember!.full_name || '', currentMember!.email || '', applyMsg.trim(),
        customAnswers, phone
      )
      if (result.alreadyApplied) {
        // Nothing was written. This used to fire a SUCCESS toast and flip to
        // the full "Application sent!" screen promising a lead would respond,
        // so a member re-applying after fixing an answer or a phone number
        // left believing a fresh application was in the queue. Same treatment
        // OpportunitiesPage already gives this branch.
        const msg = 'you already applied for this role.'
        toastError(msg, 'your first application is still in the queue.')
        setApplyError(msg)
        // onSuccess() still fires. It is the parent's "re-read whether I have
        // applied" hook, and this is the one branch where the parent is KNOWN
        // to be stale - it let the member open an apply modal for a role they
        // had already applied to. Dropping it left the Apply button wrong
        // until a reload. It does not close the modal; the error above stays
        // on screen.
        onSuccess()
      } else if (result.success) {
        toastSuccess('application sent.', 'You\'ll hear back via Notifications.')
        setSubmitted(true); onSuccess()
      } else {
        const msg = result.error || 'Failed to submit'
        toastError(msg); setApplyError(msg)
      }
    } catch (e: any) {
      const msg = e?.message || 'Failed to submit'
      toastError(msg); setApplyError(msg)
    } finally { setApplyLoading(false) }
  }

  // Portaled to <body>: a fixed overlay inside a transformed ancestor is sized to that ancestor, not the screen.
  // Not approved yet: no form, a pop-up that offers a reminder instead (lib/joinGate.ts).
  const gate = joinGate(currentMember)
  if (currentMember && !canApplyNow(gate)) {
    return <NotYetMemberModal gate={gate} memberId={currentMember.member_id} target={{ openingId: String(opening.id) }} subject={opening.title} accent={catColor} onClose={onClose} />
  }

  return createPortal(
    <div role="presentation" onClick={submitted ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 16px 16px' }}>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Apply for ${opening.title}`} tabIndex={-1} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: 'var(--card)', borderRadius: 'var(--r-outer)', padding: 24, border: 'var(--hair-2)', boxShadow: 'var(--lift-4)', outline: 'none' }}>
        {submitted ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}><SuccessCheck color={catColor} fx="confetti" /></div>
            <div className="h-display" style={{ fontSize: 24, marginTop: 12 }}>Application sent!</div>
            <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>The team lead will review your application and respond via Notifications.</p>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={closeModal}>Done</button>
          </div>
        ) : (
          <>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 20, marginBottom: 4 }}>apply</div>
            <div className="mono xs muted" style={{ marginBottom: 20 }}>
              {teamName} · <span style={{ color: catColor }}>{opening.title}</span>
            </div>
            {applyError && (
              <div role="alert" style={{ background: 'rgba(224,92,92,0.12)', border: '1px solid rgba(224,92,92,0.3)', borderRadius: 'var(--r-tight)', padding: '10px 14px', marginBottom: 14, color: 'var(--danger)', fontSize: 13 }}>
                {applyError}
              </div>
            )}
            {/* Both labels were orphans - no htmlFor, not wrapping - so both
                fields announced as unlabelled edit fields. Field generates the
                id and binds the pair; the label styling is unchanged. */}
            <Field label="why are you a good fit?" required labelStyle={LABEL_ST}>
              {id => (
                <textarea id={id} className="textarea" rows={5} value={applyMsg}
                  onChange={e => setApplyMsg(e.target.value)}
                  placeholder="Tell the team why you'd like this role..."
                  style={{ resize: 'vertical', marginBottom: 16, fontFamily: 'var(--eina)', fontSize: 16 }} />
              )}
            </Field>

            <Field label="phone number" required labelStyle={LABEL_ST}>
              {id => (
                <input id={id} className="input" type="tel" inputMode="tel" autoComplete="tel" aria-invalid={phoneMissing || undefined}
                  value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 98765 43210" style={{ marginBottom: 16 }} />
              )}
            </Field>

            {/* This opening's own questions, set by the team on the Openings tab */}
            <OpeningQuestionFields questions={questions} answers={answers} onAnswerChange={setAnswer} files={files} onFileChange={setFile} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-primary" style={{ flex: 1, justifyContent: 'center', gap: 8 }}
                onClick={handleApply} disabled={applyLoading}>
                {applyLoading && <span style={{ width: 13, height: 13, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />}
                {applyLoading ? 'submitting…' : 'submit application →'}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={onClose}>cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
    , document.body)
}
