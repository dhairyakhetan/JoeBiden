// Split out of TeamDetailPage.tsx's 'responses' tab body - every applicant
// across every one of this team's job_openings in one place, so a leader
// doesn't have to expand each opening's Openings-tab applicant list one at
// a time.
import { useRef, useState } from 'react'
import { useModalA11y } from '../../hooks/useDialog'
import { useToast } from '../../components/Toast'
import { jobOpenings } from '../../lib/jobOpenings'
import { OpeningAnswersDisplay } from '../../components/OpeningQuestionBuilder'
import { TeamOpening } from './shared'

export default function ResponsesTab({
  openings, openingResponses, setOpeningResponses, responsesLoading, responsesError,
  onRetryResponses, totalResponses, isMobile,
}: {
  openings: TeamOpening[]
  openingResponses: Record<string, any[]>
  setOpeningResponses: React.Dispatch<React.SetStateAction<Record<string, any[]>>>
  responsesLoading: boolean
  /** The fetch FAILED, as opposed to nobody having applied. */
  responsesError: boolean
  onRetryResponses: () => void
  totalResponses: number
  isMobile: boolean
}) {
  const { success: toastSuccess, error: toastError } = useToast()

  // §20.7: "rejection needs a reason that reaches the applicant" - rejecting
  // opens this note modal instead of applying immediately (same gate as
  // director/HiringResponses.tsx's identical flow). The select is a
  // controlled value bound to `app.status` via the parent's state, so
  // cancelling naturally leaves it unchanged - no optimistic flip until the
  // reason is confirmed.
  const [rejecting, setRejecting] = useState<{ openingId: string; appId: string; name: string } | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)
  const closeReject = () => { setRejecting(null); setRejectNote('') }
  // This panel declared `aria-modal="true"` - which tells assistive tech the
  // page behind it is inert - while implementing none of what that promises:
  // Tab walked straight out onto the applicant list behind the scrim, Escape
  // did nothing, and focus was never returned to whatever opened it. Same hook
  // the director desk's identical reject panels already use; `rejectBusy`
  // suppresses Escape mid-submit so a dismissal can't lose an in-flight write.
  // The note field's `autoFocus` came off with it: the hook parks focus on the
  // panel's first control a frame later regardless, so it was already dead -
  // leaving it in would only have implied a focus target that never won.
  const rejectPanelRef = useRef<HTMLDivElement>(null)
  useModalA11y(!!rejecting, rejectPanelRef, closeReject, rejectBusy)

  const confirmReject = async () => {
    if (!rejecting) return
    const reason = rejectNote.trim()
    if (!reason) return
    const { openingId, appId } = rejecting
    setRejectBusy(true)
    try {
      await jobOpenings.updateApplicationStatus(appId, 'rejected', reason)
      // Applied only on success (no optimistic flip here) - the modal's own
      // confirm step already is the "are you sure," so there's nothing to
      // roll back if the write fails.
      setOpeningResponses(prev => ({
        ...prev,
        [openingId]: prev[openingId].map((a: any) => a.id === appId ? { ...a, status: 'rejected' } : a),
      }))
      toastSuccess('Marked rejected')
      closeReject()
    } catch (err: any) {
      toastError('status didn’t change.', err?.message ?? 'try again.')
    } finally {
      setRejectBusy(false)
    }
  }

  if (responsesLoading) {
    return (
      <div aria-hidden="true">
        <div className="v6-skeleton" style={{ width: 180, height: 12, marginBottom: 12 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card" style={{ padding: isMobile ? 14 : 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div className="v6-skeleton" style={{ width: 140, height: 14, animationDelay: `${i * 0.08}s` }} />
                <div className="v6-skeleton sk-pill" style={{ width: 100, height: 28 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Before the empty well, not after it: a failed load left a leader reading
  // "no responses yet." and concluding nobody had applied.
  if (responsesError) {
    return (
      <div className="card" style={{ padding: 60, textAlign: 'center' }}>
        <div className="h-display" style={{ fontSize: 28 }}>responses didn’t load.</div>
        <p className="muted" style={{ marginTop: 8 }}>this isn’t “nobody applied” - the list couldn’t be fetched.</p>
        <button className="btn btn-sm" style={{ marginTop: 16 }} onClick={onRetryResponses}>try again</button>
      </div>
    )
  }

  if (totalResponses === 0) {
    return (
      <div className="card" style={{ padding: 60, textAlign: 'center' }}>
        <div className="h-display" style={{ fontSize: 28 }}>no responses yet.</div>
        <p className="muted" style={{ marginTop: 8 }}>applications to this team's openings will show up here.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {openings.filter(op => (openingResponses[op.id] || []).length > 0).map(op => (
        <div key={op.id}>
          <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 10 }}>
            {op.title} <span style={{ opacity: 0.6 }}>({openingResponses[op.id].length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {openingResponses[op.id].map((app: any) => (
              <div key={app.id} className="card" style={{ padding: isMobile ? 14 : 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{app.applicant_name || 'Anonymous'}</div>
                  {/* Was an unlabelled ~86x21 select at 10px: under the 44px
                      floor, and 10px triggers iOS Safari's focus zoom. */}
                  <select
                    aria-label={`Application status for ${app.applicant_name || 'applicant'}`}
                    value={app.status}
                    onChange={async e => {
                      const newStatus = e.target.value as any
                      if (newStatus === 'rejected') {
                        setRejecting({ openingId: op.id, appId: app.id, name: app.applicant_name || 'this applicant' })
                        return
                      }
                      const prevStatus = app.status
                      // Optimistic update with rollback + toast on failure.
                      setOpeningResponses(prev => ({
                        ...prev,
                        [op.id]: prev[op.id].map((a: any) => a.id === app.id ? { ...a, status: newStatus } : a)
                      }))
                      try {
                        await jobOpenings.updateApplicationStatus(app.id, newStatus)
                        toastSuccess(`Marked ${newStatus}`)
                      } catch (err: any) {
                        setOpeningResponses(prev => ({
                          ...prev,
                          [op.id]: prev[op.id].map((a: any) => a.id === app.id ? { ...a, status: prevStatus } : a)
                        }))
                        toastError('status didn’t change.', err?.message ?? 'try again.')
                      }
                    }}
                    style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, padding: '10px 12px', minHeight: 44, borderRadius: 6, border: '1.5px solid var(--line-2)', background: 'var(--bg-2)', color: app.status === 'accepted' ? 'var(--welfare-ink)' : app.status === 'rejected' ? 'var(--danger)' : 'var(--ink-2)', cursor: 'pointer' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                {app.applicant_email && <div className="mono xs muted" style={{ marginTop: 3 }}>{app.applicant_email}</div>}
                {app.applicant_phone && <div className="mono xs muted" style={{ marginTop: 3 }}>{app.applicant_phone}</div>}
                {app.message && <p style={{ fontFamily: 'var(--eina)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{app.message}</p>}
                {/* Custom question answers, each against its own question label */}
                <OpeningAnswersDisplay questions={op.customQuestions} answers={app.custom_answers} />
                <div className="mono xs muted" style={{ marginTop: 8 }}>{new Date(app.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {rejecting && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) closeReject() }}>
          <div ref={rejectPanelRef} role="dialog" aria-modal="true" aria-label="Reject application" className="modal">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', margin: 0, color: 'var(--danger)' }}>Reject application</h3>
              <button className="iconbtn" onClick={closeReject} aria-label="Close" title="Close">✕</button>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              reject <strong style={{ color: 'var(--ink)' }}>{rejecting.name}</strong>? they will see an in-app notification with the reason below.
            </p>
            <label htmlFor="rt-rej-note" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>rejection reason *</label>
            <textarea
              id="rt-rej-note"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={3}
              placeholder="why this application wasn't a fit - the applicant will read this"
              style={{ width: '100%', resize: 'vertical', marginBottom: 12 }}
            />
            <div className="aqc-actions">
              <button onClick={closeReject} className="btn btn-sm" disabled={rejectBusy}>cancel</button>
              <button
                onClick={confirmReject}
                disabled={!rejectNote.trim() || rejectBusy}
                className="btn btn-sm"
                style={{ background: 'var(--danger)', color: 'var(--paper)', borderRadius: 999, minHeight: 44, whiteSpace: 'nowrap' }}
              >
                {rejectBusy ? '...' : 'confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
