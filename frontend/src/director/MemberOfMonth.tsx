import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import Img from '../components/Img'
import Field from '../components/Field'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { useAuth } from '../auth/AuthContext'
import { getInitials } from '../lib/uiHelpers'
import { isSuperAdmin } from '../lib/roles'
import { notificationService } from '../services/notificationService'
import feedService from '../services/feedService'
import { generateStory, downloadStory } from '../components/StoryGenerator'
import memberOfMonthService, {
  currentPeriod, formatPeriod, shiftPeriod, buildMomCsv, downloadCsv,
  type MemberOfMonthPick, type PickCandidate, type PickableTeam, type PeriodState,
} from '../services/memberOfMonthService'
import {
  AdminLayout, AdminTabHeader, DataToolbar, EmptyLedger,
  AdminSkeleton, AdminErrorState, BulkActionBar, useRowSelection,
} from './adminKit'
import '../styles/routes/director-people.css'

/**
 * FR11-b · Member of the month — rebuilt for per-team picks
 * (scripts/member_of_the_month_team_scoping_2026_09_05.sql).
 *
 * ONE pick per team per calendar month, chosen by a person. There is no
 * ranking, no score and no automatic shortlist: points were removed from
 * this app app-wide, and re-deriving "who deserves it" from any number would
 * quietly reintroduce that idea through the back door. A leader searches for
 * the member they have in mind (scoped to the team's own roster) and says why.
 *
 * Team scoping: a hod/director sees and can only pick for team(s) they hold
 * an active team_members row for; super_admin/hr can pick for any team AND
 * are the only ones who can open/close a month for picking (see the "this
 * month" panel below) and export the HR CSV. See the migration file's
 * TEAM-SCOPING DECISION comment for why team_members membership (not
 * team_members.role='lead') is what "their team" means here — it's a live,
 * ambiguity-flagged product call, not an incidental implementation detail.
 *
 * The month stepper is what makes this a flow rather than a single button:
 * you can correct last month's pick, and you can queue next month's early
 * (once HR has opened it). A queued future pick is invisible to ordinary
 * members until that month begins — enforced in RLS, not here (see the
 * service header) — and is never notified early either (see handleSave).
 *
 * Chrome comes entirely from the desk's shared vocabulary: `.card` panels,
 * `.panel-h` headers, `.qrow` rows, `.qtag` pills, `.iconbtn` actions. The
 * only inline styles are flex/gap layout, matching every other tab.
 */

const labelSt: CSSProperties = {
  fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.06em', color: 'var(--ink-3)', display: 'block', marginBottom: 6,
}

const CITATION_MAX = 280

function Avatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  return (
    <div
      className="people-av"
      style={{ width: size, height: size, fontSize: size < 32 ? 10 : 12, background: 'var(--accent)' }}
      aria-hidden
    >
      {url ? <Img ctx="avatar" src={url} alt="" referrerPolicy="no-referrer" /> : getInitials(name)}
    </div>
  )
}

const MemberOfMonth = () => {
  const toast = useToast()
  const confirm = useConfirm()
  const { member: me } = useAuth()
  const iAmAdmin = isSuperAdmin(me?.role) // hr / super_admin — "any team, any time"
  // "Edit" on a past pick (below) only ever changed `period`/`selectedTeamId`
  // - the picker panel those drive sits ABOVE "past picks" in the DOM, so
  // the click did the right thing with zero visible sign of it. Reported as
  // "the edit button doesn't work". It works; it just needed to bring the
  // panel it changed into view.
  const pickPanelRef = useRef<HTMLDivElement>(null)

  const [period, setPeriod] = useState<string>(() => currentPeriod())
  const [picks, setPicks] = useState<MemberOfMonthPick[]>([])
  const [teams, setTeams] = useState<PickableTeam[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [periodState, setPeriodState] = useState<PeriodState | null>(null)
  /** The period read failed, as opposed to resolving to "never opened". */
  const [periodStateFailed, setPeriodStateFailed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [togglingPeriod, setTogglingPeriod] = useState(false)
  const [exportingCsv, setExportingCsv] = useState(false)

  // Candidate search. Debounced so typing a name is not one request per key.
  const [search, setSearch] = useState('')
  const [candidates, setCandidates] = useState<PickCandidate[]>([])
  const [searching, setSearching] = useState(false)

  const [chosen, setChosen] = useState<PickCandidate | null>(null)
  const [citation, setCitation] = useState('')
  const [saving, setSaving] = useState(false)
  // Per-row busy for the past-picks list, never one desk-wide flag — clearing
  // one team/month must not freeze the button next to another.
  const [clearing, setClearing] = useState<string | null>(null)

  const thisPeriod = currentPeriod()
  const selectedTeam = teams.find(t => t.teamId === selectedTeamId) || null
  // A team can honour several members in a month (owner decision 2026-10-03).
  const picksForPeriod = picks.filter(p => p.period === period && p.teamId === selectedTeamId)
  const pickedMemberIds = new Set(picksForPeriod.map(p => p.memberId))
  const isFuture = period > thisPeriod
  const isOpen = periodState?.isOpen ?? false
  // super_admin/hr never need the month "opened" - they're the ones opening
  // it for everyone else (mirrors mom_insert_leaders'/mom_update_leaders' own
  // `is_super_admin() or mom_period_is_open(period)` check).
  const canWriteNow = !!selectedTeamId && (iAmAdmin || isOpen)

  const fetchAll = useCallback(async () => {
    setLoadError(null)
    try {
      const [teamRows, pickRows] = await Promise.all([
        memberOfMonthService.getPickableTeams(),
        memberOfMonthService.list(),
      ])
      setTeams(teamRows)
      setPicks(pickRows)
      setSelectedTeamId(prev => prev && teamRows.some(t => t.teamId === prev) ? prev : (teamRows[0]?.teamId ?? null))
    } catch (err: any) {
      const msg = err?.message || 'unknown error'
      setLoadError(msg)
      toast.error('picks didn’t load.', msg)
    } finally {
      setIsLoading(false)
    }
    // toast is stable from its provider; listing it re-runs the fetch forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Reload "is this month open" whenever the month being edited changes.
  useEffect(() => {
    let cancelled = false
    memberOfMonthService.getPeriodState(period)
      .then(state => { if (!cancelled) { setPeriodState(state); setPeriodStateFailed(false) } })
      // getPeriodState returns null ONLY for "no row" (the month was never
      // opened) and THROWS on a real error - so collapsing the throw to null
      // made a failed read indistinguishable from a closed month. The desk then
      // disabled picking and said the month was closed, with no way to tell it
      // simply had not loaded.
      .catch(() => { if (!cancelled) { setPeriodState(null); setPeriodStateFailed(true) } })
    return () => { cancelled = true }
  }, [period])

  // Reset the draft whenever the month or team changes: the citation belongs
  // to the month+team it was typed for, and carrying it across was a real way
  // to attach last month's (or another team's) reason to this pick.
  useEffect(() => {
    setChosen(null)
    setSearch('')
    setCandidates([])
    setCitation('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, selectedTeamId])

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2 || !selectedTeamId) { setCandidates([]); setSearching(false); return }
    setSearching(true)
    let cancelled = false
    const t = setTimeout(() => {
      memberOfMonthService.searchCandidates(selectedTeamId, term)
        .then(rows => { if (!cancelled) setCandidates(rows) })
        .catch((e: any) => {
          if (cancelled) return
          setCandidates([])
          toast.error('member search failed.', e?.message ?? 'try again.')
        })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedTeamId])

  const handleSave = async () => {
    if (!chosen || !selectedTeamId || !selectedTeam) return
    // Picks now ADD: a team can honour several members in a month, so saving
    // never overwrites someone else's name and needs no replace confirm.
    // Auto-post to the feed only for a genuinely NEW pick, not
    // every re-save of an existing one (e.g. fixing a typo in the citation) -
    // otherwise editing a citation would re-announce the same win as a fresh
    // feed post every time. ADDED 2026-09-14 (social-system IA audit):
    // previously a MoM win was an admin-only artifact that reached the feed
    // only if the winner manually uploaded a photo and shared it themselves -
    // the org's own recognition never showed up as content unless the
    // honoree did the work. This makes the recognition itself the post.
    const isNewOrChangedPick = !pickedMemberIds.has(chosen.memberId)
    setSaving(true)
    try {
      const pickedBy = await memberOfMonthService.getCurrentMemberId()
      const saved = await memberOfMonthService.setPick({
        period, teamId: selectedTeamId, memberId: chosen.memberId, citation, pickedBy,
      })
      toast.success(isNewOrChangedPick
        ? `${saved.memberName} added as a ${selectedTeam.name} pick for ${formatPeriod(period)}`
        : `Updated ${saved.memberName}’s note for ${formatPeriod(period)}`)
      // Tell the member. Fire-and-forget by design (notificationService.create
      // is the one non-throwing service call), and only once the month has
      // actually started — a queued future pick must not announce itself.
      if (!isFuture && isNewOrChangedPick) {
        notificationService.create({
          memberId: saved.memberId,
          type: 'system',
          title: `You’re ${selectedTeam.name}’s member of the month for ${formatPeriod(period)}`,
          subtitle: saved.citation ? saved.citation : 'Upload a photo from your profile to get your poster and post ready.',
          link: '/profile/me',
        })
      }
      if (!isFuture && isNewOrChangedPick) {
        const VALID_POST_CATEGORIES = new Set(['welfare', 'events', 'content', 'operations', 'labs'])
        const category = VALID_POST_CATEGORIES.has(selectedTeam.category) ? selectedTeam.category : 'welfare'
        const body = [
          `🏆 ${saved.memberName} is ${selectedTeam.name}’s member of the month for ${formatPeriod(period)}!`,
          saved.citation || null,
        ].filter(Boolean).join('\n\n')
        // This desk is only reachable by hod/director/super_admin/hr (see
        // deskAccess.ts), all of whom hasLeaderAccess - so createPost
        // auto-publishes rather than landing in pending_review.
        feedService.createPost({
          body,
          category,
          taggedMemberIds: [saved.memberId],
        }).catch((e: any) => {
          // Best-effort: the pick itself already saved and notified - a
          // failed auto-post must not look like the whole save failed.
          console.error('[MemberOfMonth] auto-post to feed failed:', e)
          toast.info('the pick saved, but the feed announcement didn’t post.', e?.message)
        })
      }
      setChosen(null)
      setSearch('')
      setCandidates([])
      await fetchAll()
    } catch (e: any) {
      toast.error('couldn’t save that pick.', e?.message ?? 'try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async (pick: MemberOfMonthPick) => {
    const ok = await confirm({
      title: 'Remove this pick?',
      body: `${pick.memberName} will no longer be shown as ${pick.teamName}’s member of the month for ${formatPeriod(pick.period)}.`,
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    const key = String(pick.id)
    setClearing(key)
    try {
      await memberOfMonthService.clearPick(pick.id)
      toast.success(`Removed ${pick.memberName} from ${pick.teamName}’s picks for ${formatPeriod(pick.period)}`)
      await fetchAll()
    } catch (e: any) {
      toast.error('couldn’t remove that pick.', e?.message ?? 'try again.')
    } finally {
      setClearing(null)
    }
  }

  const handleToggleOpen = async () => {
    setTogglingPeriod(true)
    try {
      const myId = await memberOfMonthService.getCurrentMemberId()
      if (isOpen) {
        await memberOfMonthService.closePeriod(period, myId)
        toast.success(`${formatPeriod(period)} is closed for picking.`)
      } else {
        await memberOfMonthService.openPeriod(period, myId)
        toast.success(`${formatPeriod(period)} is open — HoDs/directors can pick now.`)
      }
      const state = await memberOfMonthService.getPeriodState(period)
      setPeriodState(state)
    } catch (e: any) {
      toast.error('couldn’t update this month.', e?.message ?? 'try again.')
    } finally {
      setTogglingPeriod(false)
    }
  }

  // ── Story downloads (item 2/4 of the download feature) ─────────────────
  // Anyone who can see this desk can download a decided pick's story - the
  // permission boundary is picking, not downloading, so this reads straight
  // off `picks` with no extra role check.
  const storyDataForPick = (p: MemberOfMonthPick) => ({
    type: 'member_of_month' as const,
    memberName: p.memberName,
    teamName: p.teamName,
    teamCategory: p.teamCategory,
    period: formatPeriod(p.period),
    citation: p.citation || undefined,
    imageUrl: p.photoUrl || p.memberAvatarUrl || undefined,
  })
  const storyFilenameForPick = (p: MemberOfMonthPick) =>
    `aq-mom-${p.teamName.toLowerCase().replace(/\s+/g, '-')}-${p.period}.png`

  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const handleDownloadStory = async (p: MemberOfMonthPick) => {
    setDownloadingId(String(p.id))
    try {
      const { dataUrl } = await generateStory(storyDataForPick(p))
      downloadStory(dataUrl, storyFilenameForPick(p))
    } catch (e: any) {
      toast.error('couldn’t generate that story card.', e?.message ?? 'try again.')
    } finally {
      setDownloadingId(null)
    }
  }

  const [selectMode, setSelectMode] = useState(false)
  const selectionItems = useMemo(() => picks.map(p => ({ id: String(p.id) })), [picks])
  const selection = useRowSelection(selectionItems)
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const handleBulkDownload = async () => {
    const chosen = picks.filter(p => selection.isSelected(String(p.id)))
    if (chosen.length === 0) return
    setBulkDownloading(true)
    try {
      for (const p of chosen) {
        const { dataUrl } = await generateStory(storyDataForPick(p))
        downloadStory(dataUrl, storyFilenameForPick(p))
        // There's no server-side zip here - each download is its own <a
        // download> click, and browsers throttle/drop a burst of those fired
        // back to back. A short gap between each keeps every file landing.
        await new Promise(res => setTimeout(res, 350))
      }
      toast.success(`downloaded ${chosen.length} ${chosen.length === 1 ? 'story' : 'stories'}.`)
      selection.clear()
    } catch (e: any) {
      toast.error('bulk download stopped early.', e?.message ?? 'some stories may not have downloaded.')
    } finally {
      setBulkDownloading(false)
    }
  }

  // Missing-photo recovery: one generic link (same precedent as the existing
  // `/profile/me?break=1` break-request link) an HoD copies and sends the
  // member directly - it resolves to whoever is signed in when they open it,
  // so it needs no per-member token or database row.
  const handleCopyUploadLink = async (p: MemberOfMonthPick) => {
    const link = `${window.location.origin}/profile/edit?uploadAvatar=1`
    try { await navigator.clipboard.writeText(link) } catch {
      const el = document.createElement('input'); el.value = link
      document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    toast.success(`link copied — send it to ${p.memberName}`)
  }

  const handleExportCsv = async () => {
    setExportingCsv(true)
    try {
      const rows = await memberOfMonthService.list(1000)
      downloadCsv(buildMomCsv(rows), `member-of-the-month-${thisPeriod.slice(0, 7)}.csv`)
    } catch (e: any) {
      toast.error('couldn’t export the CSV.', e?.message ?? 'try again.')
    } finally {
      setExportingCsv(false)
    }
  }

  const monthNav = (
    <div className="qacts" role="group" aria-label="Change month">
      <button
        type="button"
        className="iconbtn"
        onClick={() => setPeriod(p => shiftPeriod(p, -1))}
        aria-label={`Go to ${formatPeriod(shiftPeriod(period, -1))}`}
        title={formatPeriod(shiftPeriod(period, -1))}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        className="iconbtn"
        onClick={() => setPeriod(p => shiftPeriod(p, 1))}
        aria-label={`Go to ${formatPeriod(shiftPeriod(period, 1))}`}
        title={formatPeriod(shiftPeriod(period, 1))}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  )

  return (
    <AdminLayout>
      <div style={{ paddingBottom: 64, maxWidth: 860 }}>
        <AdminTabHeader
          label="Recognition"
          title="Member of the month"
          subtitle="One member per team, per month, chosen by you. The winner uploads their own photo, and the home rail shows every team's current pick."
        />

        {isLoading ? (
          <AdminSkeleton rows={4} />
        ) : loadError ? (
          <AdminErrorState
            message={`Could not load the picks - ${loadError}`}
            onRetry={() => { setIsLoading(true); fetchAll() }}
          />
        ) : (
          <>
            {/* ── HR/super_admin only: open or close this month for picking ── */}
            {iAmAdmin && (
              <div className="card" style={{ marginBottom: 16, padding: 0 }}>
                <div className="panel-h">
                  <b>this month</b>
                  <span className="mono xs muted adm-nums">{formatPeriod(period)}</span>
                </div>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <span className="qtag" style={{ ['--cc' as any]: periodStateFailed ? 'var(--lemon)' : isOpen ? 'var(--welfare)' : 'var(--ink-3)' }}>
                      {periodStateFailed ? 'unknown' : isOpen ? 'open for picking' : 'closed'}
                    </span>
                    <p className="adm-note is-quiet" style={{ marginTop: 8 }}>
                      {periodStateFailed
                        ? 'We couldn’t check whether this month is open - that’s a loading problem, not a closed month. Reload before assuming picking is shut.'
                        : isOpen
                          ? 'HoDs and directors can pick their team’s winner for this month.'
                          : 'HoDs and directors can’t pick yet - open this month first. You can still pick for any team yourself while it’s closed.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={isOpen ? 'btn btn-sm' : 'btn btn-sm btn-primary'}
                    onClick={handleToggleOpen}
                    disabled={togglingPeriod}
                  >
                    {togglingPeriod ? 'working…' : isOpen ? 'close this month' : 'open this month'}
                  </button>
                </div>
              </div>
            )}

            {teams.length === 0 ? (
              <div className="card" style={{ padding: 24 }}>
                <p className="adm-note">
                  You’re not on any team’s roster, so there’s no team to pick a winner for.
                  Ask a super admin or HR to add you to a team, or to make this month’s pick for you.
                </p>
              </div>
            ) : (
              <>
                {/* ── Which team ── */}
                <div className="card" style={{ marginBottom: 16, padding: '16px 18px' }}>
                  <Field label="Team" labelStyle={labelSt} hint={iAmAdmin ? 'Any active team.' : 'Teams you belong to.'}>
                    {(id, describedBy) => (
                      <select
                        id={id}
                        aria-describedby={describedBy}
                        className="input"
                        style={{ width: '100%' }}
                        value={selectedTeamId ?? ''}
                        onChange={e => setSelectedTeamId(Number(e.target.value))}
                      >
                        {teams.map(t => (
                          <option key={t.teamId} value={t.teamId}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </Field>
                </div>

                {/* ── The month being edited ── */}
                <div className="card" style={{ marginBottom: 16, padding: 0 }}>
                  <div className="panel-h">
                    <b>{formatPeriod(period)}{selectedTeam ? ` · ${selectedTeam.name}` : ''}</b>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isFuture && <span className="qtag" style={{ ['--cc' as any]: 'var(--lemon)' }}>queued</span>}
                      {period === thisPeriod && <span className="qtag" style={{ ['--cc' as any]: 'var(--welfare)' }}>this month</span>}
                      {monthNav}
                    </div>
                  </div>

                  {picksForPeriod.length > 0 ? (
                    picksForPeriod.map(pk => (
                    <div key={pk.id} className="qrow" style={{ ['--cc' as any]: 'var(--welfare)' }}>
                      <Avatar url={pk.memberAvatarUrl} name={pk.memberName} />
                      <div className="qmeta">
                        <div className="qname">{pk.memberName}</div>
                        <div className="qsub">
                          {pk.citation || 'no reason recorded'}
                          {pk.pickedByName ? ` · picked by ${pk.pickedByName}` : ''}
                          {pk.photoUrl ? ' · photo uploaded ✓' : ' · waiting on their photo'}
                        </div>
                      </div>
                      <div className="qacts">
                        <button
                          type="button"
                          className="iconbtn no"
                          onClick={() => handleClear(pk)}
                          disabled={clearing === String(pk.id)}
                          aria-label={`Remove ${pk.memberName} from ${formatPeriod(pk.period)}’s picks`}
                          title="Remove this pick"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                            <path d="M18 6 6 18M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    ))
                  ) : (
                    <EmptyLedger
                      message={`nobody picked for ${selectedTeam?.name ?? 'this team'} in ${formatPeriod(period)} yet`}
                      sub="Search for a member below and record why."
                    />
                  )}
                </div>

                {/* ── Make (or change) the pick ── */}
                <div ref={pickPanelRef} className="card" style={{ marginBottom: 16, padding: 0 }}>
                  <div className="panel-h">
                    <b>{picksForPeriod.length > 0 ? 'add another pick' : 'make the pick'}</b>
                    <span className="mono xs muted adm-nums">{formatPeriod(period)}</span>
                  </div>

                  <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <DataToolbar
                      search={search}
                      onSearch={setSearch}
                      // Reverted 2026-09-13 alongside searchCandidates - the
                      // pick is scoped back to this team's own roster.
                      searchPlaceholder="Search this team's active members…"
                    />

                    {chosen ? (
                      <div className="qrow" style={{ ['--cc' as any]: 'var(--welfare)' }}>
                        <Avatar url={chosen.avatarUrl} name={chosen.fullName} />
                        <div className="qmeta">
                          <div className="qname">{chosen.fullName}</div>
                          <div className="qsub">{chosen.classGrade || 'member'} · selected</div>
                        </div>
                        <div className="qacts">
                          <button
                            type="button"
                            className="iconbtn no"
                            onClick={() => setChosen(null)}
                            aria-label={`Deselect ${chosen.fullName}`}
                            title="Deselect"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ) : searching ? (
                      <p className="adm-note is-quiet">searching…</p>
                    ) : search.trim().length >= 2 && candidates.length === 0 ? (
                      // Reverted to team-scoped 2026-09-13, so "of this team"
                      // is accurate again.
                      <p className="adm-note is-quiet">no active member of this team matches that name.</p>
                    ) : candidates.length > 0 ? (
                      <div>
                        {candidates.map(c => (
                          <div key={c.memberId} className="qrow" style={{ ['--cc' as any]: 'var(--teal)' }}>
                            <Avatar url={c.avatarUrl} name={c.fullName} size={30} />
                            <div className="qmeta">
                              <div className="qname">{c.fullName}</div>
                              <div className="qsub">{c.classGrade || 'member'}{pickedMemberIds.has(c.memberId) ? ' · already picked, saving updates their note' : ''}</div>
                            </div>
                            <div className="qacts">
                              <button
                                type="button"
                                className="iconbtn ok"
                                onClick={() => setChosen(c)}
                                aria-label={`Pick ${c.fullName} for ${formatPeriod(period)}`}
                                title="Pick this member"
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                  <path d="m20 6-11 11-5-5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="adm-note is-quiet">type at least two letters of a name to search.</p>
                    )}

                    <Field
                      label="Why them"
                      labelStyle={labelSt}
                      hint={`Optional. Shown under their name, ${CITATION_MAX} characters at most.`}
                    >
                      {(id, describedBy) => (
                        <textarea
                          id={id}
                          aria-describedby={describedBy}
                          className="textarea"
                          style={{ width: '100%', minHeight: 72, resize: 'vertical' }}
                          value={citation}
                          onChange={e => setCitation(e.target.value)}
                          maxLength={CITATION_MAX}
                          placeholder="e.g. Ran the Ballygunge feeding drive three weekends straight and trained two new leads."
                        />
                      )}
                    </Field>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ minHeight: 44, justifyContent: 'center' }}
                        disabled={!chosen || saving || !canWriteNow}
                        onClick={handleSave}
                      >
                        {saving ? 'saving…' : chosen && pickedMemberIds.has(chosen.memberId) ? '✓ update their note' : picksForPeriod.length > 0 ? '✓ add this pick' : '✓ save the pick'}
                      </button>
                      <span className="mono xs muted adm-nums">{citation.length}/{CITATION_MAX}</span>
                      {!chosen && canWriteNow && <span className="adm-note is-quiet">pick a member first.</span>}
                    </div>

                    {!canWriteNow && (
                      <p className="adm-note">
                        {formatPeriod(period)} isn’t open for picking yet. Ask a super admin or HR to open it from the panel above.
                      </p>
                    )}
                    {canWriteNow && isFuture && (
                      <p className="adm-note">
                        {formatPeriod(period)} has not started. Members will not see or be notified of this pick until it does.
                      </p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── Everything picked so far, across every team ── */}
            <div className="card" style={{ padding: 0 }}>
              <div className="panel-h">
                <b>past picks</b>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="mono xs muted adm-nums">{picks.length} {picks.length === 1 ? 'pick' : 'picks'}</span>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => { setSelectMode(m => !m); selection.clear() }}
                    disabled={picks.length === 0}
                  >
                    {selectMode ? 'done selecting' : 'select'}
                  </button>
                  {iAmAdmin && (
                    <button type="button" className="btn btn-sm" onClick={handleExportCsv} disabled={exportingCsv || picks.length === 0}>
                      {exportingCsv ? 'exporting…' : '↓ export CSV'}
                    </button>
                  )}
                </div>
              </div>
              {picks.length === 0 ? (
                <EmptyLedger
                  message="no member of the month yet"
                  sub="The first pick you save shows up here and on the home rail."
                />
              ) : picks.map(p => {
                const key = String(p.id)
                const hasPhoto = !!(p.photoUrl || p.memberAvatarUrl)
                return (
                <div key={p.id} className="qrow" style={{ ['--cc' as any]: p.period === thisPeriod ? 'var(--welfare)' : 'var(--teal)' }}>
                  {selectMode && (
                    <label className="adm-checkcell">
                      <input
                        type="checkbox"
                        className="adm-row-check"
                        checked={selection.isSelected(key)}
                        onChange={() => selection.toggle(key)}
                        aria-label={`Select ${p.teamName}'s pick for ${formatPeriod(p.period)}`}
                      />
                    </label>
                  )}
                  <Avatar url={p.memberAvatarUrl} name={p.memberName} size={30} />
                  <div className="qmeta">
                    <div className="qname">{p.memberName}</div>
                    <div className="qsub">{p.citation || 'no reason recorded'}</div>
                  </div>
                  <span className="qtag" style={{ ['--cc' as any]: 'var(--grape)' }}>{p.teamName}</span>
                  <span className="qtag" style={{ ['--cc' as any]: p.period > thisPeriod ? 'var(--lemon)' : 'var(--teal)' }}>
                    {formatPeriod(p.period)}
                  </span>
                  <div className="qacts">
                    <button
                      type="button"
                      className="iconbtn"
                      onClick={() => handleDownloadStory(p)}
                      disabled={downloadingId === key}
                      aria-label={`Download ${p.teamName}'s story for ${formatPeriod(p.period)}`}
                      title={downloadingId === key ? 'designing…' : 'Download story'}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />
                      </svg>
                    </button>
                    {!hasPhoto && (
                      <button
                        type="button"
                        className="iconbtn"
                        onClick={() => handleCopyUploadLink(p)}
                        aria-label={`Copy an upload link for ${p.memberName}`}
                        title="Copy upload link (no photo yet)"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 4.5" />
                          <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.34-1.34" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      className="iconbtn"
                      onClick={() => {
                        setPeriod(p.period)
                        setSelectedTeamId(p.teamId)
                        const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
                        pickPanelRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
                      }}
                      aria-label={`Edit ${p.teamName}'s pick for ${formatPeriod(p.period)}`}
                      title="Edit this pick"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="iconbtn no"
                      onClick={() => handleClear(p)}
                      disabled={clearing === String(p.id)}
                      aria-label={`Remove ${p.memberName} from ${p.teamName}'s picks for ${formatPeriod(p.period)}`}
                      title="Remove this pick"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                )
              })}
            </div>

            {selectMode && (
              <BulkActionBar count={selection.selected.size} onClear={selection.clear} busy={bulkDownloading}>
                <button type="button" className="btn btn-sm btn-primary" onClick={handleBulkDownload} disabled={bulkDownloading || selection.selected.size === 0}>
                  {bulkDownloading ? 'downloading…' : `↓ download ${selection.selected.size} ${selection.selected.size === 1 ? 'story' : 'stories'}`}
                </button>
              </BulkActionBar>
            )}

            {/* Cross-exploration: the desk is not a dead end. The person you
                just named has a profile, and the roster is one tap away. */}
            <p className="adm-note" style={{ marginTop: 14 }}>
              Looking for someone’s record? The <Link to="/director/members">member directory</Link> has the full roster.
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

export default MemberOfMonth
