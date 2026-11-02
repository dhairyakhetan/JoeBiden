import './OpportunitiesPage.css'
import { isApplicantApproved, AWAITING_APPROVAL_TAG, ACCEPT_BLOCKED_MESSAGE } from '../lib/applicantGate'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { hasLeaderAccess } from '../lib/roles'
import { jobOpenings, JobOpening, CustomQuestion, CAT_COLORS, OpeningStatus, STATUS_COLORS, STATUS_LABELS, ALLOWED_TRANSITIONS } from '../lib/jobOpenings'
import { I } from '../components/v6Shared'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import type { Database } from '../lib/database.types'
import teamService, { Team } from '../services/teamService'
import { OpeningQuestionBuilder, OpeningAnswersDisplay } from '../components/OpeningQuestionBuilder'
import PosterStudioModal from '../components/PosterStudioModal'
import { Sticker } from '../components/Sticker'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import useDialog from '../hooks/useDialog'
import Field from '../components/Field'
import { APPROVAL_TIME } from '../lib/orgFacts'
import { setAuthIntent, type GateCategory } from '../lib/authIntent'
import { Reveal, RevealGroup } from '../components/Reveal'
import ApplyModal from './ApplyModal'
import RoleTile from '../components/RoleTile'

type Member = Database['public']['Tables']['members']['Row']

const CAT_ICON: Record<string, string> = {
  events: '🎪', welfare: '🌱', labs: '⚡', operations: '⚙️', content: '✍️',
}

// ── Opening Form Modal ────────────────────────────────────────────────────────
function OpeningFormModal({
  opening, onClose, onSaved, createdByName, createdByRole,
}: {
  opening: JobOpening | null
  onClose: () => void
  onSaved: () => void
  createdByName: string
  createdByRole: string
}) {
  const isNew = !opening
  const { success, error: toastError } = useToast()
  const [saving, setSaving] = useState(false)
  const [title, setTitle]     = useState(opening?.title || '')
  const [desc, setDesc]       = useState(opening?.description || '')
  const [cat, setCat]         = useState(opening?.category || 'welfare')
  const [teamUuid, setTeamUuid] = useState('')
  const [teams, setTeams]     = useState<Team[]>([])
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [skills, setSkills]   = useState(opening?.skills.join(', ') || '')
  const [commit, setCommit]   = useState(opening?.commitment || '')
  const [deadline, setDeadline] = useState(opening?.deadline ? opening.deadline.slice(0, 10) : '')
  const [questions, setQuestions] = useState<CustomQuestion[]>(opening?.customQuestions || [])

  useEffect(() => {
    teamService.getTeams({ limit: 100 }).then(result => {
      if (result.success) {
        setTeams(result.data)
        // Match the opening's existing free-text team name back to a team,
        // if one exists - editing an opening created before this dropdown
        // shipped shouldn't force re-picking a team it already had.
        if (opening?.teamName) {
          const match = result.data.find(t => t.name === opening.teamName)
          if (match) setTeamUuid(match.uuid)
        }
      }
    }).finally(() => setTeamsLoading(false))
  }, [opening?.teamName])

  const accent = CAT_COLORS[cat] || 'var(--welfare)'
  // Escape stays enabled while editing but not mid-save — dismissing a request
  // in flight would leave the user unsure whether the opening posted.
  const panelRef = useDialog(true, onClose, { closeOnEscape: !saving })
  const labelSt: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6 }
  // Rounded-minimalism: inputs sit on the hairline edge + the 22px inner
  // radius (was 1.5px --line-2 / an off-spine 12px).
  const inputSt: React.CSSProperties = { width: '100%', padding: '10px 12px', background: 'var(--bg-2)', border: 'var(--hair-2)', borderRadius: 'var(--r-inner)', color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 16 }

  const handleSave = async () => {
    if (!title.trim() || !desc.trim()) return
    const teamName = teams.find(t => t.uuid === teamUuid)?.name
    const data = {
      title: title.trim(), description: desc.trim(),
      category: cat, teamName,
      skills: skills.split(',').map(s => s.trim()).filter(Boolean),
      commitment: commit.trim() || undefined,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      createdByName, createdByRole,
      customQuestions: questions,
    }
    setSaving(true)
    try {
      if (isNew) {
        await jobOpenings.create(data)
        success('Opening posted!', 'Now live on the board.')
      } else {
        await jobOpenings.update(opening!.id, data)
        success('Opening updated ✓')
      }
      onSaved(); onClose()
    } catch (e: any) {
      toastError('opening didn’t save.', e?.message ?? 'try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Rounded-minimalism modal shell: hairline edge, 32px outer radius and
          the deepest soft lift (was a 2px ink border + 6px hard offset at an
          off-spine 20px radius). The header band's own 2px ink rule is a
          divider inside the panel, so it drops to --hair. */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={isNew ? 'Post a job opening' : 'Edit opening'} tabIndex={-1} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, background: 'var(--card)', borderRadius: 'var(--r-outer)', overflow: 'hidden', border: 'var(--hair-2)', boxShadow: 'var(--lift-4)', maxHeight: '90dvh', overflowY: 'auto' }}>
        <div style={{ background: accent, padding: '20px 24px 16px', color: 'var(--ink)', borderBottom: 'var(--hair)' }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 20 }}>{isNew ? 'post a job opening' : 'edit opening'}</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, opacity: 0.7, marginTop: 2 }}>{isNew ? 'visible to all members immediately' : `editing: ${opening?.title}`}</div>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Role title" required labelStyle={labelSt}>
            {id => <input id={id} style={inputSt} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Social Media Manager" maxLength={80} />}
          </Field>
          {/* Category is a button group, not one control — role="group" carries
              the name; a <label> here would have pointed at nothing. */}
          <div role="group" aria-labelledby="op-cat-cap">
            <span id="op-cat-cap" style={labelSt}>Category <span style={{ color: 'var(--danger)' }} aria-hidden>*</span></span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(CAT_COLORS).map(([c, col]) => (
                <button key={c} onClick={() => setCat(c)} className="btn btn-sm"
                  aria-pressed={cat === c}
                  style={{ minHeight: 44, background: cat === c ? col : 'var(--bg-2)', color: cat === c ? 'var(--ink)' : 'var(--ink)', borderColor: cat === c ? col : 'transparent', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.04em' }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <Field label="Description" required labelStyle={labelSt}>
            {id => <textarea id={id} style={{ ...inputSt, minHeight: 100, resize: 'vertical' }} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What does this role involve? What's expected?" />}
          </Field>
          <div className="opening-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label={<>Team <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></>} labelStyle={labelSt}>
              {id => teamsLoading ? (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>LOADING...</div>
              ) : (
                <select id={id} style={inputSt} value={teamUuid} onChange={e => setTeamUuid(e.target.value)}>
                  <option value="">No team</option>
                  {teams.map(t => <option key={t.uuid} value={t.uuid}>{t.name}</option>)}
                </select>
              )}
            </Field>
            <Field label={<>Commitment <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional)</span></>} labelStyle={labelSt}>
              {id => <input id={id} style={inputSt} value={commit} onChange={e => setCommit(e.target.value)} placeholder="e.g. 2-3 hrs/week" />}
            </Field>
          </div>
          <Field label={<>Skills <span style={{ opacity: 0.5, fontWeight: 400 }}>(comma separated)</span></>} labelStyle={labelSt}>
            {id => <input id={id} style={inputSt} value={skills} onChange={e => setSkills(e.target.value)} placeholder="e.g. Canva, Excel, Communication" />}
          </Field>
          <Field label={<>Deadline <span style={{ opacity: 0.5, fontWeight: 400 }}>(optional - leave empty for an always-open role; otherwise it auto-pauses when passed)</span></>} labelStyle={labelSt}>
            {id => <input id={id} type="date" style={inputSt} value={deadline} onChange={e => setDeadline(e.target.value)} min={new Date().toISOString().slice(0, 10)} />}
          </Field>
          <OpeningQuestionBuilder questions={questions} onChange={setQuestions} />
          <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-primary btn-sm" style={{ flex: 1, minHeight: 44, justifyContent: 'center', background: accent, borderColor: accent, color: 'var(--ink)' }}
              disabled={!title.trim() || !desc.trim() || saving} onClick={handleSave}>
              {saving ? '…' : isNew ? '✓ post opening' : '✓ save changes'}
            </button>
            <button className="btn btn-sm btn-ghost" style={{ minHeight: 44 }} onClick={onClose}>cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Applications Modal (leader/director view) ─────────────────────────────────
// The hue stays as the tint; it is no longer the glyph colour. Measured before:
// #b38a00 3.01:1, --sky 2.26:1, --welfare 3.67:1, all on their own blended
// grounds, and the status IS the whole content of the control.
const APP_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:  { bg: '#FFC70022', color: 'var(--ink)' },
  reviewed: { bg: '#3DA9FC22', color: 'var(--ink)' },
  accepted: { bg: '#1B8A5A22', color: 'var(--ink)' },
  rejected: { bg: 'var(--danger-tint)', color: 'var(--ink)' },
}

function ApplicationsModal({ op, onClose }: { op: JobOpening; onClose: () => void }) {
  const { success, error: toastError } = useToast()
  const [apps, setApps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const accent = CAT_COLORS[op.category] || 'var(--welfare)'
  const panelRef = useDialog(true, onClose)

  useEffect(() => {
    jobOpenings.getApplications(op.id)
      .then(data => { setApps(data); setLoading(false) })
      .catch(() => { setLoadError(true); setLoading(false) })
  }, [op.id])

  const updateStatus = async (appId: string, status: 'pending' | 'reviewed' | 'accepted' | 'rejected', rejectionReason?: string) => {
    // Optimistic update with rollback + toast, so a failed write doesn't leave
    // the UI showing a status the DB never accepted.
    const prevApps = apps
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status } : a))
    try {
      await jobOpenings.updateApplicationStatus(appId, status, rejectionReason)
      success(`Marked ${status}`)
    } catch (e: any) {
      setApps(prevApps)
      toastError('status didn’t change.', e?.message ?? 'try again.')
    }
  }

  // §20.7: rejection needs a reason that reaches the applicant - same gate as
  // director/HiringResponses.tsx and the team-detail tabs' identical flow.
  const [rejecting, setRejecting] = useState<{ appId: string; name: string } | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const closeReject = () => { setRejecting(null); setRejectNote('') }
  const confirmReject = async () => {
    if (!rejecting) return
    const reason = rejectNote.trim()
    if (!reason) return
    await updateStatus(rejecting.appId, 'rejected', reason)
    closeReject()
  }

  return (
    <div role="presentation" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      {/* Same rounded-minimalism modal shell as ApplyModal above - see the note in OpeningFormModal. */}
      <div ref={panelRef} role="dialog" aria-modal="true" aria-label={`Applications for ${op.title}`} tabIndex={-1} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'var(--card)', borderRadius: 'var(--r-outer)', overflow: 'hidden', border: 'var(--hair-2)', boxShadow: 'var(--lift-4)', maxHeight: '85dvh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ background: accent, padding: '16px 24px 14px', color: 'var(--ink)', borderBottom: 'var(--hair)', flexShrink: 0 }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6, marginBottom: 4 }}>
            Applications
          </div>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 20, letterSpacing: '-0.03em', lineHeight: 1.05 }}>
            {op.title}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--ink-3)' }}>Loading…</div>
          ) : loadError ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 22, marginBottom: 8, letterSpacing: '-0.03em' }}>couldn’t load applications.</div>
              <p style={{ fontFamily: 'var(--eina)', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>Something went wrong fetching applications. Close this and try again.</p>
            </div>
          ) : apps.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 22, marginBottom: 8, letterSpacing: '-0.03em' }}>no applications yet.</div>
              <p style={{ fontFamily: 'var(--eina)', fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6 }}>Applications from members will appear here.</p>
            </div>
          ) : (
            <div>
              {apps.map((app, i) => {
                const pill = APP_STATUS_STYLE[app.status] || APP_STATUS_STYLE.pending
                return (
                  <div key={app.id} style={{ padding: '16px 24px', borderBottom: i < apps.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div>
                        <div style={{ fontFamily: 'var(--eina)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{app.applicant_name}</div>
                    {!isApplicantApproved(app) && <div className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }} title={ACCEPT_BLOCKED_MESSAGE}>{AWAITING_APPROVAL_TAG}</div>}
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{app.applicant_email}</div>
                        {app.applicant_phone && <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{app.applicant_phone}</div>}
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', marginTop: 3 }}>
                          {new Date(app.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                      <select
                        value={app.status || 'pending'}
                        onChange={e => {
                          const next = e.target.value as any
                          if (next === 'rejected') setRejecting({ appId: app.id, name: app.applicant_name || 'this applicant' })
                          else updateStatus(app.id, next)
                        }}
                        aria-label={`Application status for ${app.applicant_name || 'applicant'}`}
                        style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '5px 10px', borderRadius: 999, whiteSpace: 'nowrap', background: pill.bg, color: pill.color, border: '1px solid var(--line-2)', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <option value="pending">Pending</option>
                        <option value="reviewed">Reviewed</option>
                        <option value="accepted" disabled={!isApplicantApproved(app)}>Accepted</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    {app.message && (
                      <p style={{ fontFamily: 'var(--eina)', fontSize: 13, color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.65, background: 'var(--bg-2)', padding: '10px 12px', borderRadius: 'var(--r-tight)', whiteSpace: 'pre-wrap', margin: '10px 0 0' }}>
                        {app.message}
                      </p>
                    )}
                    <OpeningAnswersDisplay questions={op.customQuestions || []} answers={app.custom_answers} />
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--line)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>
            {loading ? '…' : `${apps.length} application${apps.length !== 1 ? 's' : ''}`}
          </span>
          <button className="btn btn-sm btn-ghost" style={{ minHeight: 44 }} onClick={onClose}>Close</button>
        </div>
      </div>

      {rejecting && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) closeReject() }}>
          <div role="dialog" aria-modal="true" aria-label="Reject application" className="modal">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', margin: 0, color: 'var(--danger)' }}>Reject application</h3>
              <button className="iconbtn" onClick={closeReject} aria-label="Close" title="Close">✕</button>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              reject <strong style={{ color: 'var(--ink)' }}>{rejecting.name}</strong>? they will see an in-app notification with the reason below.
            </p>
            <label htmlFor="op-rej-note" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>rejection reason *</label>
            <textarea
              id="op-rej-note"
              value={rejectNote}
              onChange={e => setRejectNote(e.target.value)}
              rows={3}
              placeholder="why this application wasn't a fit - the applicant will read this"
              style={{ width: '100%', resize: 'vertical', marginBottom: 12 }}
              autoFocus
            />
            <div className="aqc-actions">
              <button onClick={closeReject} className="btn btn-sm" style={{ minHeight: 44 }}>cancel</button>
              <button
                onClick={confirmReject}
                disabled={!rejectNote.trim()}
                className="btn btn-sm"
                style={{ background: 'var(--danger)', color: 'var(--paper)', borderRadius: 999, minHeight: 44, whiteSpace: 'nowrap' }}
              >
                confirm rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Opening Card ──────────────────────────────────────────────────────────────
function OpeningCard({ op, isLeader, onManage, member, isAuthenticated, highlight }: {
  op: JobOpening
  isLeader: boolean
  onManage: (op: JobOpening) => void
  member: Member | null
  isAuthenticated: boolean
  // Deep-link target - set when a visitor arrives via ?opening=<id> (e.g. from
  // OpeningPickerModal's first-run picker). Scrolls the matching card into
  // view and opens its Apply modal automatically, once, on mount.
  highlight?: boolean
}) {
  const accent = CAT_COLORS[op.category] || 'var(--welfare)'
  const isPaused = op.status === 'paused'
  const isClosed = op.status === 'closed'
  const isInactive = isPaused || isClosed
  const daysLeft = op.deadline ? Math.ceil((new Date(op.deadline).getTime() - Date.now()) / 86400000) : null
  const [applyOpen, setApplyOpen] = useState(false)
  const [hasApplied, setHasApplied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!member || op.status !== 'open') return
    jobOpenings.hasApplied(op.id, member.member_id).then(setHasApplied)
  }, [op.id, member])

  useEffect(() => {
    if (!highlight) return
    cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (isAuthenticated && !isInactive) setApplyOpen(true)
    // Only on mount/highlight-becoming-true - not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlight])

  return (
    <>
      <div
        id={`opening-${op.id}`}
        ref={cardRef}
        style={{
          background: 'var(--card)',
          // Resting card: hairline edge, 32px outer radius, --lift-1 (was a
          // 3px ink border at 18px with a 4px hard offset). The deep-link
          // highlight keeps a visible accent ring - it has to out-read the
          // hairline to do its job - just no longer at 3px.
          border: highlight ? '2px solid var(--accent)' : 'var(--hair-2)',
          borderRadius: 'var(--r-outer)',
          boxShadow: 'var(--lift-1)',
          overflow: 'hidden',
          position: 'relative',
          opacity: isInactive ? 0.72 : 1,
          transition: 'transform 0.16s var(--ease-pop)',
        }}
        /* Hover is a translate only now - the resting shadow stays constant
           instead of climbing a 4px -> 6px hard-offset ladder. */
        onMouseEnter={e => { if (isInactive) return; const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)' }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = '' }}
      >
        {/* Category cap - a thin colour bar down the left edge ties the whole
            block to its vertical without a heavy header band. */}
        <div aria-hidden style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 6, borderRadius: '0 6px 6px 0', background: isInactive ? 'var(--line-2)' : accent }} />

        {/* Oversized category icon watermark - the plain white box + thin
            colour bar read as flat/generic next to the rest of the brand's
            scrapbook cards (team cards, project tickets) which all carry a
            big rotated icon. Same motif here, kept faint so it doesn't
            compete with the title. */}
        {!isInactive && (
          <div aria-hidden style={{
            position: 'absolute', top: -14, right: -8, fontSize: 76, lineHeight: 1,
            opacity: 0.08, transform: 'rotate(8deg)', pointerEvents: 'none', userSelect: 'none',
          }}>
            {CAT_ICON[op.category] || '★'}
          </div>
        )}

        {/* "each card design should have variations that helps make everything
            feel lively and varied" - a data-driven sticker rather than a
            random one: a role genuinely closing within 3 days is real
            urgency, and openings closing that soon are naturally rare, so
            this self-throttles instead of needing an artificial density cap
            the way a purely decorative sticker would (Sticker.tsx's own
            "one per card, three per viewport" rule - a bounded list of
            openings, unlike an infinite-scroll feed, can actually honour it). */}
        {!isInactive && op.status === 'open' && daysLeft != null && daysLeft >= 0 && daysLeft <= 3 && (
          <span style={{ position: 'absolute', top: -10, right: -10, zIndex: 2 }}>
            <Sticker
              shape="burst12"
              hue="tomato"
              rotate={-9}
              size={72}
              numeral={{ value: String(daysLeft), unit: daysLeft === 1 ? 'day left' : 'days left' }}
              label={`closes in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
            />
          </span>
        )}

        {/* One cohesive block: chip · title · description · skills · footer */}
        <div style={{ padding: '18px 20px 16px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Top: category chip + team + status + manage */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              letterSpacing: '0.06em', padding: '4px 11px', borderRadius: 999,
              background: accent, color: 'var(--ink)', border: 'var(--hair-2)',
            }}>{op.category}</span>
            {op.teamName && <span className="mono xs muted" style={{ fontWeight: 700 }}>· {op.teamName}</span>}
            {isInactive && (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.06em', padding: '2px 8px', borderRadius: 999,
                background: `color-mix(in srgb, ${STATUS_COLORS[op.status]} 22%, white)`, color: 'var(--ink)',
                border: `1px solid ${STATUS_COLORS[op.status]}`,
              }}>{STATUS_LABELS[op.status]}</span>
            )}
            <span style={{ flex: 1 }} />
            {isLeader && (
              <button
                className="btn btn-sm btn-ghost"
                style={{ minWidth: 44, minHeight: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: 16, flexShrink: 0, background: 'var(--bg-2)', border: 'none', boxShadow: 'none' }}
                onClick={() => onManage(op)}
                title="Manage opening"
                aria-label="Manage opening"
              >⋯</button>
            )}
          </div>

          {/* Title - links to the opening's own shareable page. */}
          <h3 style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 'clamp(19px, 3.5vw, 24px)', letterSpacing: '-0.03em', lineHeight: 1.02, margin: 0, textWrap: 'balance' } as React.CSSProperties}>
            <Link to={`/opportunities/${op.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              {op.title}
            </Link>
          </h3>

          {/* Description */}
          <p style={{ fontFamily: 'var(--eina)', fontSize: 14, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, whiteSpace: 'pre-wrap', textWrap: 'pretty' } as React.CSSProperties}>
            {op.description}
          </p>

          {/* Skills */}
          {op.skills.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {op.skills.map(s => (
                <span key={s} style={{
                  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 999,
                  background: `color-mix(in srgb, ${accent} 15%, white)`, color: 'var(--ink)',
                  border: `1px solid color-mix(in srgb, ${accent} 45%, white)`,
                }}>{s}</span>
              ))}
            </div>
          )}

          {/* Footer: meta + apply */}
          {/* In-panel divider drops from 2px to hairline weight; the dashed
              motif is kept deliberately (it is the card's stub-tear line). */}
          <div style={{ marginTop: 2, paddingTop: 12, borderTop: '1px dashed var(--line)', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {op.commitment && <span className="mono xs muted">⏱ {op.commitment}</span>}
              {daysLeft !== null && daysLeft > 0 && (
                <span className="mono xs muted" style={{ color: daysLeft <= 3 ? 'var(--danger)' : undefined, fontVariantNumeric: 'tabular-nums' }}>
                  {daysLeft <= 3 ? `⚠ ${daysLeft}d left` : `${daysLeft}d left`}
                </span>
              )}
              <span className="mono xs muted">- {op.createdByName}</span>
            </div>

          {/* CTA - auth-aware */}
          {op.status === 'open' ? (
            !isAuthenticated ? (
              <Link
                to="/login"
                className="btn btn-sm"
                /* Primary CTA: the one measured --shadow-cta offset, held
                   constant - hover is a translate only, not a growing ladder. */
                style={{ flexShrink: 0, minHeight: 44, background: accent, borderColor: 'var(--ink)', color: 'var(--ink)', boxShadow: 'var(--shadow-cta)', fontWeight: 700, transition: 'transform 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = '' }}
                onClick={() => setAuthIntent({
                  kind: 'opening', title: op.title, category: op.category as GateCategory, teamName: op.teamName || null,
                })}
              >
                log in to apply →
              </Link>
            ) : hasApplied ? (
              <span style={{
                fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                padding: '5px 12px', borderRadius: 999,
                background: '#1B8A5A18', color: 'var(--welfare-ink)',
                border: '1px solid #1B8A5A44',
              }}>
                ✓ applied
              </span>
            ) : (
              <button
                className="btn btn-sm btn-primary"
                style={{ flexShrink: 0, minHeight: 44, background: accent, borderColor: accent, color: 'var(--ink)', boxShadow: 'var(--shadow-cta)' }}
                onClick={() => setApplyOpen(true)}
              >
                Apply →
              </button>
            )
          ) : (
            <span className="mono xs muted" style={{ fontSize: 11 }}>
              {isClosed ? 'role closed' : 'applications paused'}
            </span>
          )}
          </div>
        </div>
      </div>

      {applyOpen && member && (
        <ApplyModal
          op={op}
          member={member}
          onClose={() => setApplyOpen(false)}
          onApplied={() => { setHasApplied(true); setApplyOpen(false) }}
        />
      )}
    </>
  )
}

// ── Manage Popover ────────────────────────────────────────────────────────────
function ManagePopover({ op, onAction, onEdit, onViewApplications, onGenerateGraphic, onClose }: {
  op: JobOpening
  onAction: (action: () => Promise<void>) => void
  onEdit: () => void
  onViewApplications: () => void
  onGenerateGraphic: () => void
  onClose: () => void
}) {
  const confirm = useConfirm()
  const can = (to: OpeningStatus) => ALLOWED_TRANSITIONS[op.status]?.includes(to)
  const do_ = (fn: () => void) => { fn(); onClose() }
  // Guard terminal/destructive transitions (close, delete) behind a confirm.
  const confirmThen = async (
    opts: { title: string; body: string; confirmLabel: string },
    action: () => Promise<void>,
  ) => {
    onClose()
    if (await confirm({ ...opts, danger: true })) onAction(action)
  }

  return (
    // Centered sheet (was previously a fixed bottom-right floater that
    // jumped to the corner regardless of which card's ⋯ you tapped - felt
    // disconnected from the trigger). Backdrop click closes; the title row
    // includes the opening name so context is preserved.
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Leader-only, but rendered on this public/member route, so it uses the
          same shell as the other modals in this file. Since the rounded-
          minimalism pass that shell is a hairline edge + soft lift on the
          32/22/14 radius spine - no --hod-* fallbacks, no hard ink offsets. */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', borderRadius: 'var(--r-outer)', border: 'var(--hair-2)',
          padding: 8, minWidth: 240, maxWidth: 360, width: '100%',
          // Modal-class panel -> the deepest soft lift (was a 4px hard ink offset).
          boxShadow: 'var(--lift-4)',
        }}
      >
        <div className="mono xs muted" style={{ padding: '4px 12px 8px', fontWeight: 700, borderBottom: '1px solid var(--line)', marginBottom: 4 }}>
          {op.title.slice(0, 30)}{op.title.length > 30 ? '…' : ''}
          <span style={{ marginLeft: 8, fontSize: 10, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap', background: `color-mix(in srgb, ${STATUS_COLORS[op.status]} 22%, white)`, color: 'var(--ink)' }}>
            {STATUS_LABELS[op.status]}
          </span>
        </div>
        <button className="btn btn-sm btn-ghost" style={{ width: '100%', minHeight: 44, justifyContent: 'flex-start' }} onClick={() => do_(onViewApplications)}>⊞ applications</button>
        <button className="btn btn-sm btn-ghost" style={{ width: '100%', minHeight: 44, justifyContent: 'flex-start' }} onClick={() => do_(onEdit)}>✎ edit</button>
        <button className="btn btn-sm btn-ghost" style={{ width: '100%', minHeight: 44, justifyContent: 'flex-start' }} onClick={() => do_(onGenerateGraphic)}>🎨 generate poster / story</button>
        {can('open')   && <button className="btn btn-sm btn-ghost" style={{ width: '100%', minHeight: 44, justifyContent: 'flex-start', color: STATUS_COLORS.open }}   onClick={() => do_(() => onAction(async () => { await jobOpenings.resume(op.id) }))}>▶ resume</button>}
        {can('paused') && <button className="btn btn-sm btn-ghost" style={{ width: '100%', minHeight: 44, justifyContent: 'flex-start', color: STATUS_COLORS.paused }} onClick={() => do_(() => onAction(async () => { await jobOpenings.pause(op.id) }))}>⏸ pause</button>}
        {can('closed') && <button className="btn btn-sm btn-ghost" style={{ width: '100%', minHeight: 44, justifyContent: 'flex-start', color: STATUS_COLORS.closed }} onClick={() => confirmThen({ title: 'Close this role?', body: 'Closing is terminal - the opening stops accepting applications and moves to closed.', confirmLabel: 'Close role' }, async () => { await jobOpenings.close(op.id) })}>✓ close role <span style={{ fontSize: 9, opacity: 0.6 }}>(terminal)</span></button>}
        <div style={{ height: 1, background: 'var(--line)', margin: '4px 0' }} />
        {can('deleted') && <button className="btn btn-sm btn-ghost" style={{ width: '100%', minHeight: 44, justifyContent: 'flex-start', color: 'var(--danger)' }} onClick={() => confirmThen({ title: 'Delete this opening?', body: 'This takes the opening down. It can’t be undone from here, and the applications already submitted are kept.', confirmLabel: 'Delete' }, async () => { await jobOpenings.delete_(op.id) })}>✕ delete</button>}
      </div>
    </div>
  )
}

// ── 05.5 - the section header ahead of the fan ─────────────────────────────
// A hairline rule, centred, then a serif title with one italic coloured
// phrase, then the lede in Eina. The count is bound to the real `openCount`
// (never a hard-coded "nine") - the mock's own line ("Applications for the
// winter cohort close on Sunday...") asserts a cohort/closing-date this
// schema has no concept of, so this keeps the page's own real, data-bound
// lede (already using the live APPROVAL_TIME figure) instead of inventing a
// weekday deadline with nothing behind it.
function OpeningsSectionHeader({ openCount }: { openCount: number }) {
  return (
    <div className="op-section-head">
      <div className="op-section-rule" aria-hidden="true" />
      <h2 className="op-section-title">
        <em style={{ color: 'var(--welfare-ink)' }}>{openCount}</em>{' '}
        role{openCount !== 1 ? 's' : ''} {openCount === 1 ? 'is' : 'are'} open right now.
      </h2>
      <p className="op-section-lede">
        tap a role to apply, or open more info to read about the work first. it takes two minutes.
      </p>
    </div>
  )
}

// ── 05.4 - the fanned hand ──────────────────────────────────────────────────
// Exactly five cards in the fan - a sixth at 212px minus overlap exceeds the
// frame, and the reference is a hand of five. The rest live behind
// "All N openings ->", an in-page anchor down to the full grid/filters
// section below rather than a second copy of the same list. Below 760px
// (OpportunitiesPage.css) this becomes a plain vertical stack: no rotation,
// no negative margins, no hover - touch has no hover to straighten it into.
function OpeningsFan({ ops, totalOpen }: { ops: JobOpening[]; totalOpen: number }) {
  if (ops.length === 0) {
    // Empty state per 05: KEEP "no openings right now" and replace the fan
    // with a single full-width cream well, never five empty cards.
    return <div className="op-fan-empty">no openings right now.</div>
  }
  return (
    <>
      <RevealGroup className="rt-board">
        {ops.slice(0, 5).map((op, i) => (
          <Reveal key={op.id} delay={i * 0.05}>
            <RoleTile op={op} />
          </Reveal>
        ))}
      </RevealGroup>
      {totalOpen > ops.slice(0, 5).length && (
        <a href="#all-openings" className="op-fan-more">
          All {totalOpen} openings →
        </a>
      )}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OpportunitiesPage() {
  useMeta(pageMetadata.opportunities)
  useJsonLd('opps-breadcrumb', breadcrumbLd([['Home', '/'], ['Opportunities', '/opportunities']]))
  const { member, isAuthenticated } = useAuth()
  const { success, error: toastError } = useToast()
  const isLeader = hasLeaderAccess(member?.role)
  // Deep-link support for OpeningPickerModal (first-run picker) - /opportunities?opening=<id>
  const [searchParams] = useSearchParams()
  const highlightOpeningId = searchParams.get('opening')
  // A repeat visit paints the last open list at once; the fetch below swaps in the fresh one.
  const [stale] = useState(() => jobOpenings.peekOpen())
  const [opsList, setOpsList] = useState<JobOpening[]>(stale ?? [])
  // The list had NO loading and NO error state. `displayed.length === 0` was
  // the only branch, so "★ all quiet / no openings right now." painted on the
  // very first render before the fetch resolved, and STAYED there for good if
  // the fetch threw - telling a prospective volunteer the org is not recruiting
  // while roles are open. `opsLoaded` starts false so the empty state can only
  // be reached once we actually know the answer.
  const [opsLoaded, setOpsLoaded] = useState(stale !== null)
  const [opsError, setOpsError] = useState(false)
  const [catFilter, setCatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<OpeningStatus | 'all'>('all')
  const [dashboardView, setDashboardView] = useState<'public' | 'manage'>('public')
  const [editingOp, setEditingOp] = useState<JobOpening | null | 'new'>(null)
  const [managingOp, setManagingOp] = useState<JobOpening | null>(null)
  const [viewingApplicationsOp, setViewingApplicationsOp] = useState<JobOpening | null>(null)
  const [graphicOp, setGraphicOp] = useState<JobOpening | null>(null)

  const reload = () => {
    const fetch = isLeader ? jobOpenings.getAll() : jobOpenings.getOpen()
    // jobOpenings.getAll/getOpen already retry once internally on a transient
    // failure - if it still throws after that, keep whatever's already on
    // screen instead of wiping it to an empty list (that combo used to be
    // exactly what made the page "sometimes blank until you refresh a few
    // times": a single failed fetch on cold load, no second attempt, and
    // nothing left to look at once it landed).
    setOpsError(false)
    fetch
      .then(rows => { setOpsList(rows); setOpsError(false) })
      .catch(() => { setOpsError(true); toastError('openings didn’t load. check your connection.') })
      .finally(() => setOpsLoaded(true))
  }

  useEffect(() => { reload() }, [isLeader])

  const openOnly = opsList.filter(o => o.status === 'open')
  // The fan above already shows up to 5 open roles as "the org's current
  // openings" - repeating those same roles in the unfiltered grid below reads
  // as the identical role appearing twice on one screen (worst when there's
  // only one open role total: hero card, then the same card again). Only
  // exclude them when the category filter is untouched ("all"); once a
  // visitor picks a specific category that's a deliberate request to see
  // every match, fan included.
  const fannedIds = new Set(openOnly.slice(0, 5).map(o => o.id))
  // BUG, fixed: a visitor following a `?opening=<id>` deep link (from
  // OpeningPickerModal, a shared link, a WhatsApp broadcast) landed on a
  // page where the grid below had excluded exactly that opening as
  // "already in the fan" - so there was no `OpeningCard` anywhere in the
  // DOM for `highlight`/auto-scroll/auto-open-Apply to attach to. Clicking
  // "apply" did nothing because the target simply didn't exist. The
  // deep-linked opening is never excluded, regardless of what the fan
  // already shows.
  const publicDisplayed = openOnly
    .filter(o => catFilter !== 'all' || !fannedIds.has(o.id) || o.id === highlightOpeningId)
    .filter(o => catFilter === 'all' || o.category === catFilter)
  // All open roles fit in the fan above, and no category filter is hiding
  // any of them - the grid below has nothing left to add, so it shouldn't
  // show a "no openings right now" message that contradicts the hero above
  // it. Not true, though, while a deep link needs its own card rendered.
  const allOpensInFan = catFilter === 'all' && openOnly.length > 0 && openOnly.length <= fannedIds.size
    && !(highlightOpeningId && fannedIds.has(highlightOpeningId))
  const manageDisplayed = opsList.filter(o => statusFilter === 'all' || o.status === statusFilter).filter(o => catFilter === 'all' || o.category === catFilter)
  const displayed = dashboardView === 'manage' ? manageDisplayed : publicDisplayed
  const openCount = openOnly.length

  // NO JobPosting schema on this listing page, deliberately.
  //
  // Google's JobPosting guidelines require the markup to live on the job's own
  // detail page, one posting per page - not as a @graph array on an index.
  // OpeningDetailPage.tsx already does it correctly, per posting, so this was
  // both a guideline violation and a duplicate of markup that already exists
  // in the right place.
  //
  // The listing version was also the weaker of the two: it guarded on
  // `o.description && o.title` but NOT `o.createdAt`, so `datePosted` could
  // serialize away and leave a posting missing one of Google's four required
  // fields - which risks a rich-result penalty across the whole board rather
  // than one role.

  return (
    <div className="route-enter">
      {/* Hero - dark dhero, 1:1 with the Playground Openings screen.
          Vertical padding only - `.container` below already applies
          var(--page-px) horizontally, so adding it here too doubled the
          gutter and made the black box look unevenly inset on mobile. */}
      <section style={{ padding: 'clamp(20px, 4vw, 40px) 0 0' }}>
        <div className="container">
          <div style={{
            /* No ink border. changelog/12-secondary-pages.md's blanket
               transform #1 (§00.6): "delete every 2px/3px ink border and every
               Npx Npx 0 offset" — DESIGN.md §1 keeps the ink keyline on primary
               buttons and stamped stickers only. A 3px ink border on an ink
               fill was drawing nothing anyway; the fill itself is what
               separates this block from the cream page. */
            background: 'var(--ink)', color: 'var(--bg)',
            borderRadius: 'var(--r-md)', padding: 'clamp(26px, 5vw, 52px)', position: 'relative', overflow: 'hidden',
          }}>
            {/* accent-lint-ok: measured in-browser, the ground here is the ink slab (#0A0A0A), not cream. The display hue clears AA on ink (welfare 4.55:1, lemon 15.1:1) and its --*-ink partner does NOT (3.20:1 / 3.36:1) - swapping it made this worse and was reverted. The ground is on an ancestor element, so a static checker cannot see it. */}
            <div aria-hidden style={{ position: 'absolute', top: 26, right: 34, fontSize: 30, color: 'var(--lemon)', animation: 'spin-slow 14s linear infinite', pointerEvents: 'none', opacity: 0.85 }}>✦</div>
            {/* changelog/05-teams-and-openings.md §05.2: "when a team has no
                openings, say `nothing open`... A ZERO IS A CLAIM ABOUT A
                NUMBER; 'NOTHING OPEN' IS A STATE." §12.5 puts it harder: "a
                recruitment door that reads 0 is worse than no door." This
                kicker rendered `0 roles open right now` beside a pulsing live
                dot — a live indicator asserting a zero. The teams grid one
                route away already does this correctly on all eight cards.
                The dot goes with the number: it signals "this count is live,"
                which is meaningless with no count to be live about. */}
            {/* accent-lint-ok: measured in-browser, the ground here is the ink slab (#0A0A0A), not cream. The display hue clears AA on ink (welfare 4.55:1, lemon 15.1:1) and its --*-ink partner does NOT (3.20:1 / 3.36:1) - swapping it made this worse and was reverted. The ground is on an ancestor element, so a static checker cannot see it. */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--accent)' }}>
              {openCount > 0 ? (
                <>
                  <span className="livedot" aria-hidden />
                  {openCount} role{openCount !== 1 ? 's' : ''} open right now
                </>
              ) : 'nothing open right now'}
            </span>
            <h1 style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 'clamp(44px, 8vw, 78px)', lineHeight: 0.9, letterSpacing: '-0.04em', margin: '12px 0', color: 'var(--bg)', textWrap: 'balance' } as React.CSSProperties}>
              {/* accent-lint-ok: measured in-browser, the ground here is the ink slab (#0A0A0A), not cream. The display hue clears AA on ink (welfare 4.55:1, lemon 15.1:1) and its --*-ink partner does NOT (3.20:1 / 3.36:1) - swapping it made this worse and was reverted. The ground is on an ancestor element, so a static checker cannot see it. */}
              find your <span className="underline-doodle" style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', color: 'var(--accent)', fontWeight: 400 }}>lane</span>.
            </h1>
            {/* --nav-fg-soft, not rgba(255,255,255,0.6): DESIGN.md §0.1 "no new
                hex" and §2's paper-on-ink ladder. Raw white is not on the
                ladder — the paper tone on ink is the cream --nav-fg-* family. */}
            <p style={{ fontFamily: 'var(--eina)', fontSize: 15, lineHeight: 1.6, color: 'var(--nav-fg-soft)', maxWidth: 440, margin: 0 }}>
              real responsibility from day one. pick a team, apply in two minutes, usually replies {APPROVAL_TIME}.
            </p>
            {isLeader && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 22 }}>
                <button className="btn btn-primary" onClick={() => setEditingOp('new')}><I.plus /> Post Opening</button>
                <button
                  className={'btn btn-sm ' + (dashboardView === 'manage' ? 'btn-primary' : '')}
                  onClick={() => setDashboardView(v => v === 'manage' ? 'public' : 'manage')}
                  style={dashboardView === 'manage' ? {} : { background: 'transparent', color: 'var(--bg)', borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  {dashboardView === 'manage' ? '← public view' : `⚙ manage (${opsList.length})`}
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 05.5/05.4 - section header + the fanned hand of up to five open
          roles. Independent of the category filter below (openOnly, not
          publicDisplayed) so it always reads as "the org's current openings"
          rather than whatever category the visitor last picked in the grid.
          Gated on there being at least one open role - when there are none,
          the grid section below already renders the one, richer "no openings
          right now" empty state (with the leader/non-leader CTAs); stacking
          this section's own cream well on top of that would just repeat the
          same message twice in two different shapes. */}
      {openOnly.length > 0 && (
        <div className="container" style={{ paddingTop: 'clamp(28px, 5vw, 44px)' }}>
          <OpeningsSectionHeader openCount={openCount} />
          <OpeningsFan ops={openOnly} totalOpen={openCount} />
        </div>
      )}

      {/* Filters */}
      <div id="all-openings" className="container" style={{ paddingTop: 18, paddingBottom: 0, scrollMarginTop: 80 }}>
        {isLeader && dashboardView === 'manage' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10, alignItems: 'center' }}>
            <span className="mono xs muted" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
            {(['all', 'open', 'paused', 'closed'] as const).map(s => (
              <button
                key={s}
                className={'chip ' + (statusFilter === s ? 'chip-active' : '')}
                aria-pressed={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                style={statusFilter === s && s !== 'all' ? { background: STATUS_COLORS[s as OpeningStatus], color: 'var(--ink)', borderColor: STATUS_COLORS[s as OpeningStatus] } : {}}
              >
                {s === 'all' ? `all (${opsList.length})` : `${s} (${opsList.filter(o => o.status === s).length})`}
              </button>
            ))}
          </div>
        )}
        {/* Gated on there being anything to filter. With an empty dataset these
            seven chips rendered anyway: every one a live 44px control with
            aria-pressed, none disabled, and all seven producing the identical
            "no openings right now." card — a filter UI that cannot change what
            is on screen. changelog/10-projects.md's States section requires an
            empty-filtered state to name the filter and offer a clear-filter
            action; with no data there is no filter to name, so the honest
            shape is no filter row at all and one empty state below.
            `opsList`, not `displayed` — the row must survive a filter that
            legitimately matches nothing, or it would delete the control the
            visitor needs to undo their own choice. */}
        {opsList.length > 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, scrollbarWidth: 'none', overscrollBehaviorX: 'none', marginBottom: 10 }}>
            <button className={'chip ' + (catFilter === 'all' ? 'chip-active' : '')} aria-pressed={catFilter === 'all'} onClick={() => setCatFilter('all')} style={{ flexShrink: 0 }}>all</button>
            {Object.keys(CAT_COLORS).map(c => (
              <button key={c} className={'chip ' + (catFilter === c ? 'chip-active' : '')} aria-pressed={catFilter === c} onClick={() => setCatFilter(c)} style={{ flexShrink: 0 }}>{c}</button>
            ))}
          </div>
        )}
      </div>

      {/* Openings list */}
      <div className="container" style={{ paddingBottom: 80 }}>
        {/* The openings list itself had no heading, so the page ran h1 -> h3. */}
        <h2 className="sr-only">Open roles</h2>
        {/* Permanent "always open" band (2026-10-03, HR ask). Present whenever
            the list loaded, including when nothing is posted: a role with no
            deadline never expires, and the way in is a team even when no
            specific role is listed. */}
        {opsLoaded && !opsError && (() => {
          const standing = openOnly.filter(o => !o.deadline).length
          return (
            <div className="card" role="note" style={{ padding: '14px 18px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <b>always open</b>
              <span className="muted" style={{ flex: 1, minWidth: 220 }}>
                {standing > 0
                  ? `${standing} ${standing === 1 ? 'role has' : 'roles have'} no deadline: apply any time.`
                  : 'no specific role is posted, but every team takes people who show up and help.'}
              </span>
              <Link to="/teams" className="aq-thread-link">pick a team →</Link>
            </div>
          )
        })()}
        {!opsLoaded ? (
          <div className="op-skels" aria-busy="true" aria-label="loading roles">
            {[0, 1, 2].map(i => <div key={i} className="v6-skeleton op-skel" />)}
          </div>
        ) : opsError ? (
          <div className="card" style={{ padding: 'clamp(32px, 5vw, 60px) 24px', textAlign: 'center' }}>
            <div className="h-display" style={{ fontSize: 'clamp(24px, 5vw, 32px)' }}>couldn’t load the roles.</div>
            <p className="muted" style={{ marginTop: 8 }}>
              This is a connection problem on our side, not an empty list - there may well be roles open.
            </p>
            <button type="button" className="btn btn-primary" style={{ marginTop: 20 }} onClick={reload}>try again</button>
          </div>
        ) : dashboardView === 'public' && allOpensInFan ? (
          // Every open role already appeared in the fan above - nothing left
          // to add here, and repainting "no openings right now" under a hero
          // that just said the opposite would contradict it.
          null
        ) : displayed.length === 0 ? (
          <div className="card" style={{ padding: 'clamp(32px, 5vw, 60px) 24px', textAlign: 'center' }}>
            <span className="sticker sticker-lemon sticker--diecut" style={{ display: 'inline-block', marginBottom: 16, ['--sticker-ground' as string]: 'var(--card)' }}>★ all quiet</span>
            <div className="h-display" style={{ fontSize: 'clamp(24px, 5vw, 32px)' }}>no openings right now.</div>
            <p className="muted" style={{ marginTop: 8 }}>
              {isLeader ? 'Post the first opening to start recruiting.' : 'Check back soon - new roles get posted regularly.'}
            </p>
            {!isLeader && (
              /* No specific role open - the two other ways in. */
              <div style={{ marginTop: 16, display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/login" className="aq-thread-link" onClick={() => setAuthIntent({ kind: 'apply' })}>apply to AquaTerra →</Link>
                <Link to="/volunteer" className="aq-thread-link">read the volunteer handbook →</Link>
              </div>
            )}
            {isLeader && (
              <button className="btn btn-primary btn-sm" style={{ marginTop: 16, minHeight: 44 }} onClick={() => setEditingOp('new')}>
                <I.plus /> Post first opening
              </button>
            )}
          </div>
        ) : (
          <RevealGroup className="stag" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
            {displayed.map((op, i) => (
              <Reveal key={op.id} delay={Math.min(i * 0.03, 0.4)}>
                <OpeningCard
                  op={op}
                  isLeader={isLeader}
                  onManage={setManagingOp}
                  member={member}
                  isAuthenticated={isAuthenticated}
                  highlight={highlightOpeningId === op.id}
                />
              </Reveal>
            ))}
          </RevealGroup>
        )}

        {/* General application CTA */}
        {/* Off-spine 16px -> the 32px outer step. The 2px keyline is --welfare,
            not ink, so it is genuinely visible on the ink slab and stays. */}
        <div style={{ marginTop: 48, background: 'var(--ink)', borderRadius: 'var(--r-outer)', padding: 'clamp(20px, 4vw, 32px)', border: '2px solid var(--welfare)' }}>
          {/* accent-lint-ok: measured in-browser, the ground here is the ink slab (#0A0A0A), not cream. The display hue clears AA on ink (welfare 4.55:1, lemon 15.1:1) and its --*-ink partner does NOT (3.20:1 / 3.36:1) - swapping it made this worse and was reverted. The ground is on an ancestor element, so a static checker cannot see it. */}
          <div className="mono xs upper" style={{ color: 'var(--welfare)', fontWeight: 700, marginBottom: 12 }}>★ GENERAL APPLICATION</div>
          <div className="h-display" style={{ fontSize: 'clamp(22px, 4vw, 40px)', color: 'var(--card)', marginBottom: 10, textWrap: 'balance' } as React.CSSProperties}>
            don&apos;t see your role? apply anyway.
          </div>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
            AquaTerra runs rolling recruitment. Send an application even if no specific role is open - we review everyone.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex' }} onClick={() => setAuthIntent({ kind: 'apply' })}>
            Apply to AquaTerra →
          </Link>
        </div>
      </div>

      {/* Modals */}
      {editingOp !== null && (
createPortal(
        <OpeningFormModal
          opening={editingOp === 'new' ? null : editingOp}
          onClose={() => setEditingOp(null)}
          onSaved={reload}
          createdByName={member?.full_name || 'HoD'}
          createdByRole={member?.role || 'director'}
        />,
          document.body,
        )
      )}

      {managingOp && (
        <ManagePopover
          op={managingOp}
          onAction={async (fn) => {
            try { await fn(); success('Opening updated ✓') } catch { toastError('didn’t go through.') }
            reload()
          }}
          onEdit={() => { setEditingOp(managingOp); setManagingOp(null) }}
          onViewApplications={() => { setViewingApplicationsOp(managingOp); setManagingOp(null) }}
          onGenerateGraphic={() => { setGraphicOp(managingOp); setManagingOp(null) }}
          onClose={() => setManagingOp(null)}
        />
      )}

      {viewingApplicationsOp && (
createPortal(
        <ApplicationsModal
          op={viewingApplicationsOp}
          onClose={() => setViewingApplicationsOp(null)}
        />,
          document.body,
        )
      )}

      {/* Poster/story studio for an opening - leader-only, same studio the
          feed uses for posts. An opening has no photo of its own, so this
          feeds a dedicated `hiring` PosterData block instead of dumping
          title+description into one paragraph - skills, commitment,
          deadline and team surface as their own laid-out fields, and the
          generator's hiring-only template pool renders them accordingly. */}
      {graphicOp && (
        <PosterStudioModal
          data={{
            body: graphicOp.title,
            authorName: graphicOp.createdByName,
            category: graphicOp.category,
            uuid: graphicOp.id,
            hiring: {
              skills: graphicOp.skills,
              commitment: graphicOp.commitment,
              deadline: graphicOp.deadline ? new Date(graphicOp.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : undefined,
              teamName: graphicOp.teamName,
            },
          }}
          onClose={() => setGraphicOp(null)}
        />
      )}
    </div>
  )
}
