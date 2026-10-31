import { useEffect, useMemo, useRef, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import type { DirectorContext } from './DirectorDashboard'
import { scopeToMyTeams } from './deskAccess'
import { useModalA11y } from '../hooks/useDialog'
import { jobOpenings, JobOpening, CAT_COLORS as OPENING_CAT_COLORS } from '../lib/jobOpenings'
import { count } from '../lib/uiHelpers'
import {
  AdminLayout, AdminTabHeader, DataToolbar, FilterPill, EmptyLedger,
  StatusStamp, AdminSkeleton, AdminRow, AdminErrorState, BulkActionBar,
  BottomSheet, useIsPhone, useRowSelection, type StampTone,
} from './adminKit'
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { OpeningAnswersDisplay } from '../components/OpeningQuestionBuilder'
import { useToast } from '../components/Toast'
import WhatsAppTemplates from './WhatsAppTemplates'

// HoD-desk-wide view of every application to every team's job openings - the
// per-opening applicant list already exists on each team's own page and on
// /opportunities, but a director wanting to review hiring across the whole
// org had to open every team individually. This aggregates all of it into
// one tab, same as Enquiries does for contact/collab form submissions.
//
// Structure is the desk-standard ledger: header → toolbar → skeleton/error/
// empty/rows. Long-form content (the applicant's message and their answers to
// the opening's custom questions) lives behind the row's expand toggle so the
// list stays scannable - a hiring desk is triage first, reading second.

type Application = {
  id: string
  opening_id: string
  applicant_name: string
  applicant_email: string
  applicant_phone?: string | null
  message: string | null
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected'
  created_at: string
  custom_answers?: Record<string, string>
}

const STATUS_TONE: Record<Application['status'], StampTone> = {
  pending: 'pending', reviewed: 'custom', accepted: 'approved', rejected: 'rejected',
}

/** Shell tint only - the select stays native and every option label is unchanged. */
const STATUS_TINT: Record<Application['status'], string> = {
  pending: 'color-mix(in srgb, var(--lemon) 26%, var(--card))',
  reviewed: 'color-mix(in srgb, var(--sky) 22%, var(--card))',
  accepted: 'color-mix(in srgb, var(--welfare) 22%, var(--card))',
  rejected: 'color-mix(in srgb, var(--rust) 16%, var(--card))',
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch { return iso }
}

export default function HiringResponses() {
  const { success: toastSuccess, error: toastError } = useToast()
  const { myTeamIds, isSuperAdmin } = useOutletContext<DirectorContext>()
  const [openings, setOpenings] = useState<JobOpening[]>([])
  const [appsByOpening, setAppsByOpening] = useState<Record<string, Application[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Application['status']>('all')
  const [openingFilter, setOpeningFilter] = useState<'all' | string>('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Per-row busy - a status change on one applicant must never freeze the rest.
  const [busy, setBusy] = useState<Set<string>>(new Set())
  // The HR desk's WhatsApp recruitment-script browser lives as a second tab
  // here rather than its own route - it's a sibling tool for the same
  // "getting someone from applied to onboarded" job this screen already owns.
  const [subTab, setSubTab] = useState<'applications' | 'templates'>('applications')
  // Presentation-only: the role picker's sheet and the phone bulk sheet.
  const [rolesOpen, setRolesOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const ops = await jobOpenings.getAllIncludeDeleted()
        if (cancelled) return
        setOpenings(ops)
        // One batched query for all openings instead of one per opening.
        const byOpening = await jobOpenings.getApplicationsForOpenings(ops.map(o => o.id))
        if (cancelled) return
        setAppsByOpening(byOpening)
      } catch (e: any) {
        if (cancelled) return
        const msg = e?.message || 'Something went wrong.'
        setLoadError(msg)
        toastError('responses didn’t load.', msg)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [toastError, reloadKey])

  const updateStatus = async (openingId: string, appId: string, status: Application['status'], rejectionReason?: string) => {
    setBusy(prev => new Set(prev).add(appId))
    try {
      await jobOpenings.updateApplicationStatus(appId, status, rejectionReason)
      setAppsByOpening(prev => ({
        ...prev,
        [openingId]: prev[openingId].map(a => a.id === appId ? { ...a, status } : a),
      }))
      toastSuccess(`Marked ${status}`)
    } catch (e: any) {
      toastError('status didn’t change.', e?.message ?? 'try again.')
    } finally {
      setBusy(prev => { const next = new Set(prev); next.delete(appId); return next })
    }
  }

  // §20.7: "rejection needs a reason that reaches the applicant" - a reject
  // (single row or bulk) opens this note-taking modal instead of applying
  // immediately, same pattern as AccountApprovals.tsx's reject flow. The
  // select stays a controlled input bound to `app.status`, so cancelling the
  // modal naturally reverts its displayed value with no extra state.
  const [rejectingApp, setRejectingApp] = useState<{ openingId: string; appId: string; name: string } | null>(null)
  const [rejectingBulkOpen, setRejectingBulkOpen] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')
  const [isRejectingModal, setIsRejectingModal] = useState(false)
  const closeRejectModal = () => { setRejectingApp(null); setRejectingBulkOpen(false); setRejectionNote('') }
  // The last desk reject panel still declaring `aria-modal="true"` with none of
  // the behaviour behind it - its siblings in AccountApprovals and
  // PostModeration have used this hook for a while. Open covers both the single
  // and bulk cases, matching the render condition below exactly.
  const rejectPanelRef = useRef<HTMLDivElement>(null)
  useModalA11y(!!rejectingApp || rejectingBulkOpen, rejectPanelRef, closeRejectModal, isRejectingModal)

  const confirmReject = async () => {
    const reason = rejectionNote.trim()
    if (!reason) return
    setIsRejectingModal(true)
    try {
      if (rejectingBulkOpen) {
        const targets = filtered.filter(a => selection.isSelected(a.id))
        selection.clear()
        // Promise.all rejects on the FIRST failure but does not cancel the
        // others - by the time the catch below ran, some of the remaining
        // calls could already have committed. The UI then showed every
        // target as unchanged (setAppsByOpening never ran) while some rows
        // had, in fact, already flipped to 'rejected' live - a refresh
        // would show a different desk than the one on screen. allSettled +
        // updating only the ones that actually succeeded, plus a refetch
        // when any failed, keeps the screen honest either way.
        const results = await Promise.allSettled(targets.map(a => jobOpenings.updateApplicationStatus(a.id, 'rejected', reason)))
        const succeeded = targets.filter((_, i) => results[i].status === 'fulfilled')
        const failedCount = targets.length - succeeded.length
        setAppsByOpening(prev => {
          const next = { ...prev }
          for (const a of succeeded) {
            const list = next[a.opening.id]
            if (list) next[a.opening.id] = list.map(x => x.id === a.id ? { ...x, status: 'rejected' } : x)
          }
          return next
        })
        if (failedCount > 0) {
          setReloadKey(k => k + 1) // re-sync with the DB rather than trust local state after a partial failure
          toastError(`${succeeded.length} rejected, ${failedCount} failed.`, 'reloading to confirm what actually changed.')
        } else {
          toastSuccess(`Marked ${targets.length} rejected`)
        }
      } else if (rejectingApp) {
        await updateStatus(rejectingApp.openingId, rejectingApp.appId, 'rejected', reason)
      }
      closeRejectModal()
    } catch (e: any) {
      toastError('couldn’t reject.', e?.message ?? 'try again.')
    } finally {
      setIsRejectingModal(false)
    }
  }

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  /**
   * Item 6.1: "scope Hiring by team. An HoD of Social Media sees only Social
   * Media's openings and applicants. super_admin and HR keep the unscoped
   * view." Same shape as PostModeration's category scope, deliberately, so the
   * two desks cannot drift into meaning different things by "your scope".
   *
   * An empty `myTeamIds` means UNSCOPED, not "nothing" - see
   * teamService.getMyDeskTeamIds. It is empty for super admins and HR because
   * the dashboard does not even run the query for them.
   *
   * This is a VIEW filter over an already-authorised read, not a security
   * boundary: `job_applications`' own RLS is what actually stops a leader
   * reading another team's applicants, and it is unchanged. Narrowing here
   * without narrowing there would be theatre; this exists so a Social Media
   * HoD is not made to scroll past Welfare's hiring to find their own.
   */
  const scopedOpenings = useMemo(
    () => scopeToMyTeams(openings, { isSuperAdmin, myTeamIds }),
    [openings, myTeamIds, isSuperAdmin],
  )

  const isScoped = !isSuperAdmin && myTeamIds.length > 0 && scopedOpenings.length < openings.length

  const allApps = useMemo(() => {
    const openingById = new Map(scopedOpenings.map(op => [op.id, op]))
    return Object.entries(appsByOpening).flatMap(([openingId, apps]) =>
      apps.map(a => ({ ...a, opening: openingById.get(openingId) }))
    ).filter(a => a.opening) as (Application & { opening: JobOpening })[]
  }, [scopedOpenings, appsByOpening])

  const term = search.trim().toLowerCase()
  // Memoised so its array identity is stable across renders - useRowSelection
  // clears the selection whenever the items identity changes, which we want on
  // a data/filter change but NOT on every unrelated re-render.
  const filtered = useMemo(() => allApps
    .filter(a => statusFilter === 'all' || a.status === statusFilter)
    .filter(a => openingFilter === 'all' || a.opening.id === openingFilter)
    .filter(a => !term || a.applicant_name.toLowerCase().includes(term) || a.applicant_email.toLowerCase().includes(term) || a.opening.title.toLowerCase().includes(term))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [allApps, statusFilter, openingFilter, term])

  const selection = useRowSelection(filtered)
  const [bulkBusy, setBulkBusy] = useState(false)

  // Apply one status to every selected applicant at once (triage in bulk).
  const bulkSetStatus = async (status: Application['status']) => {
    const targets = filtered.filter(a => selection.isSelected(a.id))
    if (targets.length === 0) return
    selection.clear()
    setBulkBusy(true)
    try {
      // allSettled, not all - see confirmReject's bulk branch above for why
      // an all-or-nothing Promise.all left the desk showing stale state
      // after a partial failure.
      const results = await Promise.allSettled(targets.map(a => jobOpenings.updateApplicationStatus(a.id, status)))
      const succeeded = targets.filter((_, i) => results[i].status === 'fulfilled')
      const failedCount = targets.length - succeeded.length
      setAppsByOpening(prev => {
        const next = { ...prev }
        for (const a of succeeded) {
          const list = next[a.opening.id]
          if (list) next[a.opening.id] = list.map(x => x.id === a.id ? { ...x, status } : x)
        }
        return next
      })
      if (failedCount > 0) {
        setReloadKey(k => k + 1)
        toastError(`${succeeded.length} updated, ${failedCount} failed.`, 'reloading to confirm what actually changed.')
      } else {
        toastSuccess(`Marked ${targets.length} ${status}`)
      }
    } catch (e) {
      toastError('couldn’t update those.', e instanceof Error ? e.message : 'try again.')
    } finally {
      setBulkBusy(false)
    }
  }

  // Scoped, so the "which opening" filter cannot offer another team's opening.
  const openingsWithApps = scopedOpenings.filter(op => (appsByOpening[op.id] || []).length > 0)
  const isPhone = useIsPhone()

  return (
    <AdminLayout>
      <AdminTabHeader
        label="Hiring"
        title="Opening responses"
        // A scoped HoD is looking at a SUBSET, and a header that says "every
        // team" while showing one team's applicants is how someone concludes
        // nobody applied. Same correction PostModeration's header already
        // carries for its category scope.
        subtitle={isScoped
          ? 'Applications to your team’s openings. Other teams’ hiring is not yours to see.'
          : "Every application to every team's job openings, in one place."}
        count={allApps.length}
      />

      <div className="adm-seg" role="group" aria-label="Tool" style={{ marginBottom: 16 }}>
        <button type="button" className={subTab === 'applications' ? 'is-active' : ''} aria-pressed={subTab === 'applications'} onClick={() => setSubTab('applications')}>applications</button>
        <button type="button" className={subTab === 'templates' ? 'is-active' : ''} aria-pressed={subTab === 'templates'} onClick={() => setSubTab('templates')}>WhatsApp templates</button>
      </div>

      {subTab === 'templates' ? (
        <WhatsAppTemplates />
      ) : (
        <>
      <DataToolbar search={search} onSearch={setSearch} searchPlaceholder="Search name, email, or role…">
        <div className="adm-hscroll">
          <FilterPill active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>all</FilterPill>
          {(['pending', 'reviewed', 'accepted', 'rejected'] as const).map(s => (
            <FilterPill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>{s}</FilterPill>
          ))}
        </div>
      </DataToolbar>

      {openingsWithApps.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            className="adm-picker"
            aria-haspopup="dialog"
            aria-expanded={rolesOpen}
            onClick={() => setRolesOpen(true)}
          >
            <span>{openingFilter === 'all' ? 'all roles' : (openingsWithApps.find(o => o.id === openingFilter)?.title || 'all roles')}</span>
            <span className="adm-picker-count">{count(openingsWithApps.length, 'opening')}</span>
            <ChevronDownIcon width={14} height={14} strokeWidth={2.2} aria-hidden />
          </button>
          <BottomSheet open={rolesOpen} onClose={() => setRolesOpen(false)} title="Filter by role">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                type="button"
                className={'adm-sheet-opt' + (openingFilter === 'all' ? ' is-active' : '')}
                onClick={() => { setOpeningFilter('all'); setRolesOpen(false) }}
              >
                <span>all roles</span>
                <span className="adm-picker-count">{allApps.length}</span>
              </button>
              {openingsWithApps.map(op => (
                <button
                  key={op.id}
                  type="button"
                  className={'adm-sheet-opt' + (openingFilter === op.id ? ' is-active' : '')}
                  onClick={() => { setOpeningFilter(op.id); setRolesOpen(false) }}
                >
                  <span>{op.title}</span>
                  <span className="adm-picker-count">{(appsByOpening[op.id] || []).length}</span>
                </button>
              ))}
            </div>
          </BottomSheet>
        </div>
      )}

      {loading ? (
        <AdminSkeleton rows={5} />
      ) : loadError ? (
        <AdminErrorState
          message={`Could not load hiring responses - ${loadError}`}
          onRetry={() => setReloadKey(k => k + 1)}
        />
      ) : filtered.length === 0 ? (
        <EmptyLedger
          message={allApps.length === 0 ? 'no responses yet' : 'nothing matches'}
          sub={allApps.length === 0 ? "applications to any team's openings will show up here." : 'try a different search or filter.'}
        />
      ) : (
        filtered.map(app => {
          const hasDetail = !!app.message || Object.keys(app.custom_answers || {}).length > 0
          const isOpen = expanded.has(app.id)
          return (
            <AdminRow
              key={app.id}
              busy={busy.has(app.id)}
              selected={selection.isSelected(app.id)}
              onSelect={() => selection.toggle(app.id)}
              stamp={<StatusStamp label={app.status} tone={STATUS_TONE[app.status]} color={app.status === 'reviewed' ? 'var(--sky)' : undefined} />}
              primary={app.applicant_name || 'Anonymous'}
              secondary={
                <>
                  {app.applicant_email}
                  {app.applicant_phone && <> · {app.applicant_phone}</>}
                  <div className="adm-lcard-facts">
                    <span
                      className="qtag"
                      style={{ ['--cc' as any]: OPENING_CAT_COLORS[app.opening.category] || 'var(--welfare)' }}
                    >
                      {app.opening.title}
                    </span>
                    {app.opening.teamName && (
                      <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)' }}>
                        {app.opening.teamName}
                      </span>
                    )}
                  </div>
                  {hasDetail && (
                    <button
                      type="button"
                      className="adm-disclose"
                      aria-expanded={isOpen}
                      onClick={e => { e.stopPropagation(); toggleExpand(app.id) }}
                    >
                      {isOpen ? 'hide application' : 'read application'}
                      {isOpen
                        ? <ChevronUpIcon strokeWidth={2.2} aria-hidden />
                        : <ChevronDownIcon strokeWidth={2.2} aria-hidden />}
                    </button>
                  )}
                </>
              }
              meta={fmtDate(app.created_at)}
              onToggleExpand={hasDetail ? () => toggleExpand(app.id) : undefined}
              expanded={hasDetail && isOpen ? (
                <>
                  {app.message && (
                    <>
                      <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 6 }}>their message</div>
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{app.message}</p>
                    </>
                  )}
                  <OpeningAnswersDisplay questions={app.opening.customQuestions || []} answers={app.custom_answers} />
                </>
              ) : undefined}
              actions={
                <span className="adm-selectpill sop-statuspill" style={{ ['--tint' as any]: STATUS_TINT[app.status] }}>
                  <select
                    value={app.status}
                    onChange={e => {
                      const next = e.target.value as Application['status']
                      if (next === 'rejected') {
                        setRejectingApp({ openingId: app.opening.id, appId: app.id, name: app.applicant_name || 'this applicant' })
                      } else {
                        updateStatus(app.opening.id, app.id, next)
                      }
                    }}
                    aria-label={`Status for ${app.applicant_name || 'applicant'}`}
                    className="adm-nums"
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <ChevronDownIcon width={12} height={12} strokeWidth={2.2} aria-hidden />
                </span>
              }
            />
          )
        })
      )}

      <BulkActionBar count={selection.count} onClear={selection.clear} busy={bulkBusy}>
        {isPhone ? (
          <button className="btn btn-sm" onClick={() => setBulkOpen(true)}>mark…</button>
        ) : (
          <>
            <button className="btn btn-sm" onClick={() => bulkSetStatus('reviewed')}>mark reviewed</button>
            <button className="btn btn-sm adm-approve" onClick={() => bulkSetStatus('accepted')}>mark accepted</button>
            <button className="btn btn-sm adm-reject" onClick={() => setRejectingBulkOpen(true)}>mark rejected</button>
          </>
        )}
      </BulkActionBar>

      <BottomSheet open={bulkOpen} onClose={() => setBulkOpen(false)} title={`Mark ${count(selection.count, 'application')}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="adm-sheet-opt" onClick={() => { setBulkOpen(false); bulkSetStatus('reviewed') }}>mark reviewed</button>
          <button className="adm-sheet-opt" onClick={() => { setBulkOpen(false); bulkSetStatus('accepted') }}>mark accepted</button>
          <button className="adm-sheet-opt" onClick={() => { setBulkOpen(false); setRejectingBulkOpen(true) }}>mark rejected</button>
        </div>
      </BottomSheet>

      {/* §20.7 reject-with-reason modal, one row or the whole bulk selection. */}
      {(rejectingApp || rejectingBulkOpen) && (
        <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) closeRejectModal() }}>
          <div ref={rejectPanelRef} role="dialog" aria-modal="true" aria-label="Reject application" className="modal">
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h3 style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 18, letterSpacing: '-0.01em', margin: 0, color: 'var(--danger)' }}>Reject application</h3>
              <button className="iconbtn" onClick={closeRejectModal} aria-label="Close" title="Close">✕</button>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              {rejectingBulkOpen
                ? <>reject <strong style={{ color: 'var(--ink)' }}>{selection.count} selected applications</strong>? each applicant gets an in-app notification with the reason below.</>
                : <>reject <strong style={{ color: 'var(--ink)' }}>{rejectingApp?.name}</strong>? they will see an in-app notification with the reason below.</>}
            </p>
            <label htmlFor="hr-rej-note" className="mono xs upper muted" style={{ fontWeight: 700, display: 'block', marginBottom: 6 }}>rejection reason *</label>
            <textarea
              id="hr-rej-note"
              value={rejectionNote}
              onChange={e => setRejectionNote(e.target.value)}
              rows={3}
              placeholder="why this application wasn't a fit - the applicant will read this"
              style={{ width: '100%', resize: 'vertical', marginBottom: 12 }}
            />
            <div className="aqc-actions">
              <button onClick={closeRejectModal} className="btn btn-sm" disabled={isRejectingModal}>cancel</button>
              <button
                onClick={confirmReject}
                disabled={!rejectionNote.trim() || isRejectingModal}
                className="btn btn-sm"
                style={{ background: 'var(--danger)', color: 'var(--paper)', borderRadius: 999, minHeight: 44, whiteSpace: 'nowrap' }}
              >
                {isRejectingModal ? '...' : 'confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </AdminLayout>
  )
}
