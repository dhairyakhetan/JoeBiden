// Split out of TeamDetailPage.tsx's 'openings' tab body - the largest of the
// six tabs. Renders the list of job_openings for this team, plus (for
// leaders) the inline applicant list per opening. Deep-link highlighting
// (?opening=<id>) is driven entirely by `highlightedOpeningId`/the
// `opening-${id}` DOM id, both still owned by the parent shell - this
// component just needs to render the right one lit up.
import { useRef, useState } from 'react'
import { isApplicantApproved, AWAITING_APPROVAL_TAG, ACCEPT_BLOCKED_MESSAGE } from '../../lib/applicantGate'
import { useModalA11y } from '../../hooks/useDialog'
import { Link } from 'react-router-dom'
import { I } from '../../components/v6Shared'
import { useToast } from '../../components/Toast'
import { jobOpenings } from '../../lib/jobOpenings'
import { OpeningAnswersDisplay } from '../../components/OpeningQuestionBuilder'
import { TeamOpening, isOpenStatus, STATUS_BADGE } from './shared'
import { setAuthIntent, type GateCategory } from '../../lib/authIntent'

export default function OpeningsTab({
  openings, openingsLoading, openOpenings, canManageOpenings, isMobile,
  highlightedOpeningId, catColor, teamName,
  currentMember, isTeamMember, appliedOpeningIds,
  expandedApplicants, setExpandedApplicants, loadingApplicants, toggleApplicants,
  onAddOpening, onEditOpening, onApply, onShare,
}: {
  openings: TeamOpening[]
  openingsLoading: boolean
  openOpenings: TeamOpening[]
  canManageOpenings: boolean
  isMobile: boolean
  highlightedOpeningId: string | null
  catColor: string
  /** This team's real name, for the auth-intent hero when a signed-out
   *  visitor presses "log in to apply" below. */
  teamName: string
  currentMember: unknown
  isTeamMember: boolean | undefined
  appliedOpeningIds: Set<string>
  expandedApplicants: Record<string, any[]>
  setExpandedApplicants: React.Dispatch<React.SetStateAction<Record<string, any[]>>>
  loadingApplicants: Record<string, boolean>
  toggleApplicants: (openingId: string) => void
  onAddOpening: () => void
  onEditOpening: (op: TeamOpening) => void
  onApply: (op: TeamOpening) => void
  onShare: (op: TeamOpening) => void
}) {
  const { success: toastSuccess, error: toastError } = useToast()

  // §20.7: same reject-with-reason gate as ResponsesTab.tsx/HiringResponses.tsx.
  const [rejecting, setRejecting] = useState<{ openingId: string; appId: string; name: string } | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectBusy, setRejectBusy] = useState(false)
  const closeReject = () => { setRejecting(null); setRejectNote('') }
  // See ResponsesTab: this panel promised `aria-modal="true"` without any of
  // the behaviour behind it. Same hook, same busy flag, same reason.
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
      setExpandedApplicants(prev => ({
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

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="h-display" style={{ fontSize: 28, marginBottom: 4 }}>open roles</h2>
          <p className="mono xs muted">{openOpenings.length} position{openOpenings.length !== 1 ? 's' : ''} available</p>
        </div>
        {canManageOpenings && (
          <button className="btn btn-sm btn-primary" onClick={onAddOpening}>
            <I.plus /> Add Opening
          </button>
        )}
      </div>

      {openingsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-hidden="true">
          {[1, 2].map(i => (
            <div key={i} className="card" style={{ padding: 20 }}>
              <div className="v6-skeleton" style={{ width: '45%', height: 18, marginBottom: 10, animationDelay: `${i * 0.08}s` }} />
              <div className="v6-skeleton" style={{ width: '80%', height: 12, marginBottom: 14 }} />
              <div className="row gap-2">
                <div className="v6-skeleton sk-pill" style={{ width: 70, height: 24 }} />
                <div className="v6-skeleton sk-pill" style={{ width: 90, height: 24 }} />
              </div>
            </div>
          ))}
        </div>
      ) : openings.length === 0 ? (
        <div className="card" style={{ padding: 'clamp(28px, 7vw, 60px) var(--page-px, 24px)', textAlign: 'center' }}>
          <span className="sticker sticker-lemon sticker--diecut" style={{ display: 'inline-block', marginBottom: 16, ['--sticker-ground' as string]: 'var(--card)' }}>★ nothing yet</span>
          <div className="h-display" style={{ fontSize: 28 }}>no openings posted.</div>
          <p className="muted" style={{ marginTop: 8 }}>
            {canManageOpenings ? 'Add the first opening to start recruiting.' : 'Check back soon. The team may post openings.'}
          </p>
          {canManageOpenings && (
            <button className="btn btn-sm btn-primary" style={{ marginTop: 16 }} onClick={onAddOpening}>
              <I.plus /> Post an opening
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {openings.map(op => {
            const isOpen = isOpenStatus(op.status)
            const badge = STATUS_BADGE[op.status]
            const isHighlighted = highlightedOpeningId === op.id
            return (
              <div
                key={op.id}
                id={`opening-${op.id}`}
                style={{
                  padding: 0, overflow: 'hidden',
                  borderRadius: 'var(--r-inner)',
                  border: `2px solid ${isHighlighted ? 'var(--welfare)' : 'var(--ink)'}`,
                  boxShadow: isHighlighted ? '0 0 0 4px color-mix(in srgb, var(--welfare) 30%, transparent), var(--lift-1)' : 'var(--lift-1)',
                  borderLeft: `5px solid ${isOpen ? catColor : 'var(--line)'}`,
                  background: 'var(--card)',
                  opacity: isOpen ? 1 : 0.55,
                  transition: 'opacity 0.15s, box-shadow 0.3s, border-color 0.3s',
                }}
              >
                <div style={{ padding: '20px 22px' }}>
                  {/* Title row */}
                  {isMobile ? (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.1, marginBottom: 6 }}>
                        {op.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {op.status !== 'open' && (
                          <span style={{
                            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                            padding: '3px 10px', borderRadius: 999,
                            background: badge.color + '22',
                            color: badge.color,
                            border: `1px solid ${badge.color}44`,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            {badge.label}
                          </span>
                        )}
                        {canManageOpenings && (
                          <button
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => onEditOpening(op)}
                            title="Edit opening"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {op.title}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                        {op.status !== 'open' && (
                          <span style={{
                            fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                            padding: '3px 10px', borderRadius: 999,
                            background: badge.color + '22',
                            color: badge.color,
                            border: `1px solid ${badge.color}44`,
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            {badge.label}
                          </span>
                        )}
                        {canManageOpenings && (
                          <button
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={() => onEditOpening(op)}
                            title="Edit opening"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)', marginBottom: 12, whiteSpace: 'pre-wrap' }}>
                    {op.description}
                  </p>

                  {/* Skills */}
                  {op.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {op.skills.map(s => (
                        <span key={s} className="chip" style={{ fontSize: 11, background: catColor + '18', color: catColor, borderColor: catColor + '44' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer row */}
                  <div className="opening-footer-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingTop: 12, borderTop: '1px dashed var(--line)' }}>
                    {op.commitment && (
                      <span className="mono xs muted">⏱ {op.commitment}</span>
                    )}
                    {/* Share button. Opens the share sheet, which carries the
                        link, a QR code, the story card AND the poster studio -
                        it stopped being story-only when poster generation moved
                        into the sheet, so the label no longer promises one
                        format. */}
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: 12 }}
                      onClick={() => onShare(op)}
                      title="Share this role - link, story card or poster"
                      aria-label="Share this role"
                    >
                      {/* Because the button has content, `title` is not the
                          accessible name - it announced as "artist palette". */}
                      <span aria-hidden="true">🎨</span>
                    </button>
                    <span style={{ flex: 1 }} />
                    {isOpen ? (
                      currentMember && !isTeamMember ? (
                        appliedOpeningIds.has(op.id) ? (
                          <span className="chip" style={{ fontSize: 11 }}>application pending</span>
                        ) : (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onApply(op)}
                          >
                            Apply for this role →
                          </button>
                        )
                      ) : isTeamMember ? (
                        <span className="mono xs muted">you're in the team</span>
                      ) : (
                        <Link
                          to="/login"
                          className="btn btn-sm"
                          onClick={() => setAuthIntent({
                            kind: 'opening', title: op.title, category: op.category as GateCategory, teamName,
                          })}
                        >log in to apply</Link>
                      )
                    ) : (
                      <span className="chip" style={{ fontSize: 11, color: 'var(--ink-3)' }}>position {op.status}</span>
                    )}
                  </div>
                  {canManageOpenings && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        className="btn btn-sm"
                        style={{ fontSize: 11, color: 'var(--welfare-ink)' }}
                        onClick={() => toggleApplicants(op.id)}
                        aria-expanded={!!expandedApplicants[op.id]}
                        aria-controls={`applicants-${op.id}`}
                      >
                        {loadingApplicants[op.id] ? 'loading…'
                          : expandedApplicants[op.id]
                            ? `hide applicants (${expandedApplicants[op.id].length})`
                            : 'view applicants →'}
                      </button>
                      {expandedApplicants[op.id] && (
                        <div id={`applicants-${op.id}`} style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {expandedApplicants[op.id].length === 0
                            ? <div className="mono xs muted">no applications yet.</div>
                            : expandedApplicants[op.id].map((app: any) => (
                                <div key={app.id} style={{ padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 'var(--r-tight)', border: '1px solid var(--line)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{app.applicant_name || 'Anonymous'}</div>
                    {!isApplicantApproved(app) && <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }} title={ACCEPT_BLOCKED_MESSAGE}>{AWAITING_APPROVAL_TAG}</div>}
                                    {/* Was an unlabelled ~86x21 select at 10px:
                                        under the 44px floor, and 10px triggers
                                        iOS Safari's focus zoom. */}
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
                                        setExpandedApplicants(prev => ({
                                          ...prev,
                                          [op.id]: prev[op.id].map((a: any) => a.id === app.id ? { ...a, status: newStatus } : a)
                                        }))
                                        try {
                                          await jobOpenings.updateApplicationStatus(app.id, newStatus)
                                          toastSuccess(`Marked ${newStatus}`)
                                        } catch (err: any) {
                                          setExpandedApplicants(prev => ({
                                            ...prev,
                                            [op.id]: prev[op.id].map((a: any) => a.id === app.id ? { ...a, status: prevStatus } : a)
                                          }))
                                          toastError('status didn’t change.', err?.message ?? 'try again.')
                                        }
                                      }}
                                      style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, padding: '10px 12px', minHeight: 44, borderRadius: 6, border: '1.5px solid var(--line-2)', background: 'var(--card)', color: app.status === 'accepted' ? 'var(--welfare-ink)' : app.status === 'rejected' ? 'var(--danger)' : 'var(--ink-2)', cursor: 'pointer' }}
                                    >
                                      <option value="pending">Pending</option>
                                      <option value="reviewed">Reviewed</option>
                                      <option value="accepted" disabled={!isApplicantApproved(app)}>Accepted</option>
                                      <option value="rejected">Rejected</option>
                                    </select>
                                  </div>
                                  {app.applicant_email && <div className="mono xs muted" style={{ marginTop: 3 }}>{app.applicant_email}</div>}
                                  {app.applicant_phone && <div className="mono xs muted" style={{ marginTop: 3 }}>{app.applicant_phone}</div>}
                                  {app.message && <p style={{ fontFamily: 'var(--eina)', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, margin: '8px 0 0' }}>{app.message}</p>}
                                  <OpeningAnswersDisplay questions={op.customQuestions} answers={app.custom_answers} compact />
                                  <div className="mono xs muted" style={{ marginTop: 6 }}>{new Date(app.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                                </div>
                              ))
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
            <label htmlFor="ot-rej-note" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>rejection reason *</label>
            <textarea
              id="ot-rej-note"
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
