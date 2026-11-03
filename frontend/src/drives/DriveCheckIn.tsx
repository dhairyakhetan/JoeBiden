import { celebrate } from '../lib/delight'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import attendanceService, { AttendanceRow, DriveInfo } from '../services/attendanceService'
import { enqueue, allQueued, flush, CheckInQueueItem } from '../lib/checkinQueue'
import { useDebounce } from '../hooks/useDebounce'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { hasLeaderAccess } from '../lib/roles'
import { getInitials, hashColor } from '../lib/uiHelpers'
import Img from '../components/Img'
import EmptyState from '../components/EmptyState'
import Field from '../components/Field'
import GatedButton from '../components/GatedButton'
import Skeleton from '../components/Skeleton'

/**
 * The welfare check-in sheet - `/drive/:id/check-in`. A drive lead, standing
 * at a table with a phone, searches/checks in members, allows walk-ups, and
 * tracks consent. Deliberately NOT wrapped in DashboardLayout/AQNav - this is
 * a standalone field tool, not a dashboard tab, so it renders its own
 * full-bleed page in the app's neubrutalist front-end system (hard ink
 * borders, hard offset shadows) rather than the calmer HoD-desk chrome.
 *
 * Offline-first: check-in and walk-up writes go through lib/checkinQueue.ts
 * (IndexedDB queue) and the header shows the pending count, syncing
 * automatically on reconnect. Check-out and the consent tick are simpler
 * direct writes against an already-synced row.
 */

export default function DriveCheckIn() {
  const { id } = useParams<{ id: string }>()
  const welfareProjectId = Number(id)
  const { member: currentMember } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [drive, setDrive] = useState<DriveInfo | null>(null)
  const [roster, setRoster] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [syncing, setSyncing] = useState(false)
  const [completing, setCompleting] = useState(false)

  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [results, setResults] = useState<{ member_id: number; full_name: string; avatar_url: string | null }[]>([])
  const [walkupOpen, setWalkupOpen] = useState(false)
  const [walkupName, setWalkupName] = useState('')

  const isLead = drive?.driveLeadMemberId != null && drive.driveLeadMemberId === currentMember?.member_id
  const canComplete = isLead || hasLeaderAccess(currentMember?.role)

  const refreshPendingBadge = useCallback(async () => {
    const items = await allQueued()
    setPendingKeys(new Set(items.map(i => i.key)))
  }, [])

  const load = useCallback(async () => {
    if (!welfareProjectId) return
    setLoading(true); setAccessDenied(false)
    try {
      const [driveResult, rosterResult] = await Promise.all([
        attendanceService.getDrive(welfareProjectId),
        attendanceService.getRoster(welfareProjectId),
      ])
      setDrive(driveResult.data)
      setRoster(rosterResult.data)
    } catch {
      // RLS returning nothing/erroring reads as "you're not this drive's
      // lead" - the honest message, not a generic error banner.
      setAccessDenied(true)
    } finally {
      setLoading(false)
      await refreshPendingBadge()
    }
  }, [welfareProjectId, refreshPendingBadge])

  useEffect(() => { load() }, [load])

  const sync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    const { ok, failed } = await flush(async (item: CheckInQueueItem) => {
      // `item.checkedInAt` is the whole point of queueing. Without it every
      // row synced hours after the drive carried the SYNC time, and hours are
      // computed from checked_in_at - so a morning spent offline, which is the
      // exact case this queue was built for, was erased from the record.
      if (item.status === 'walk_up' && item.walkupName) {
        await attendanceService.addWalkup(item.welfareProjectId, item.walkupName, item.checkedInAt ?? undefined)
      } else if (item.memberId != null) {
        await attendanceService.checkIn(item.welfareProjectId, item.memberId, item.checkedInAt ?? undefined)
      } else {
        throw new Error('malformed queue item')
      }
    })
    setSyncing(false)
    await refreshPendingBadge()
    if (ok) { toast.success(`synced ${ok} check-in${ok > 1 ? 's' : ''}`); celebrate('stars'); load() }
    else if (failed) toast.error('sync failed', 'still offline? will retry.')
  }, [syncing, refreshPendingBadge, toast, load])

  useEffect(() => {
    const on = () => { setOnline(true); sync() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [sync])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (debouncedSearch.trim().length < 2) { setResults([]); return }
      try {
        const res = await attendanceService.searchMembers(debouncedSearch.trim())
        if (!cancelled) setResults(res.data)
      } catch { /* search is an assist, not required */ }
    }
    run()
    return () => { cancelled = true }
  }, [debouncedSearch])

  // One tap per person - optimistic local roster update, queue, sync-if-online.
  // Never blocks on the network.
  const tapCheckIn = async (m: { member_id: number; full_name: string; avatar_url: string | null }) => {
    const key = `${welfareProjectId}:${m.member_id}`
    setRoster(prev => {
      if (prev.some(r => r.memberId === m.member_id)) return prev
      const optimistic: AttendanceRow = {
        id: -m.member_id, welfareProjectId, memberId: m.member_id, walkupName: null,
        status: 'here', checkedInAt: new Date().toISOString(), checkedOutAt: null,
        consentSigned: false, updatedAt: new Date().toISOString(),
        memberName: m.full_name, memberAvatarUrl: m.avatar_url,
      }
      return [optimistic, ...prev]
    })
    setSearch(''); setResults([])
    await enqueue({ key, welfareProjectId, memberId: m.member_id, walkupName: null, status: 'here', consentSigned: false, checkedInAt: new Date().toISOString(), checkedOutAt: null })
    setPendingKeys(p => new Set(p).add(key))
    if (online) sync()
  }

  const tapWalkup = async () => {
    const name = walkupName.trim()
    if (!name) return
    const key = `${welfareProjectId}:walkup:${Date.now()}`
    setRoster(prev => [{
      id: -Date.now(), welfareProjectId, memberId: null, walkupName: name,
      status: 'walk_up', checkedInAt: new Date().toISOString(), checkedOutAt: null,
      consentSigned: false, updatedAt: new Date().toISOString(),
    }, ...prev])
    setWalkupName(''); setWalkupOpen(false)
    await enqueue({ key, welfareProjectId, memberId: null, walkupName: name, status: 'walk_up', consentSigned: false, checkedInAt: new Date().toISOString(), checkedOutAt: null })
    setPendingKeys(p => new Set(p).add(key))
    if (online) sync()
  }

  const tapCheckOut = async (row: AttendanceRow) => {
    if (row.id < 0) { toast.error('still syncing', 'wait for this check-in to sync before checking them out.'); return }
    try {
      const result = await attendanceService.checkOut(row.id)
      setRoster(prev => prev.map(r => (r.id === row.id ? result.data : r)))
    } catch (e: any) {
      toast.error('couldn’t check them out.', e?.message || 'try again.')
    }
  }

  const toggleConsent = async (row: AttendanceRow) => {
    if (row.id < 0) return
    try {
      const result = await attendanceService.setConsent(row.id, !row.consentSigned)
      setRoster(prev => prev.map(r => (r.id === row.id ? result.data : r)))
    } catch (e: any) {
      toast.error('couldn’t update consent.', e?.message || 'try again.')
    }
  }

  const handleComplete = async () => {
    if (!welfareProjectId) return
    const hereCount = roster.filter(r => (r.status === 'here' || r.status === 'left') && r.memberId != null).length
    const ok = await confirm({
      title: 'complete this drive?',
      // REDESIGN 2026-09: was "N members will earn 1 point each." The points
      // system is no longer surfaced anywhere, so promising it here would be a
      // reward the member can never see. The once-per-drive warning is the
      // part that actually matters before confirming.
      body: `Attendance for ${hereCount} member${hereCount === 1 ? '' : 's'} will be recorded. This can only happen once per drive.`,
      confirmLabel: 'complete & pay out',
    })
    if (!ok) return
    setCompleting(true)
    try {
      const result = await attendanceService.completeDrive(welfareProjectId)
      if (result.data.already_completed) toast.info('already completed', 'this drive was already wrapped up.')
      else { toast.success(`drive complete: ${result.data.attendees_paid} attendance${result.data.attendees_paid === 1 ? '' : 's'} recorded`); celebrate('confetti') }
      load()
    } catch (e: any) {
      toast.error('couldn’t complete the drive.', e?.message || 'try again.')
    } finally {
      setCompleting(false)
    }
  }

  const pendingCount = pendingKeys.size
  const hereCount = useMemo(() => roster.filter(r => r.status === 'here').length, [roster])

  if (loading) {
    return (
      <div className="route-enter" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px 128px' }} role="status" aria-busy="true">
          <span className="sr-only">loading the sheet…</span>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
            <Skeleton variant="line" width="50%" height={28} />
            <Skeleton variant="pill" width={72} height={24} />
          </div>
          <Skeleton variant="block" height={52} style={{ marginBottom: 16, borderRadius: 'var(--r-tight)' }} />
          <Skeleton variant="card" count={4} label="loading roster" />
        </main>
      </div>
    )
  }

  if (accessDenied || !drive) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
        <EmptyState
          icon="🔒"
          title="not your sheet"
          hint="Only this drive's assigned lead (or a director) can open its check-in sheet. If this should be your drive, ask a director to assign you as its lead."
          action={<Link to="/" className="btn btn-primary">← back home</Link>}
        />
      </div>
    )
  }

  return (
    <div className="route-enter" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* This route is registered outside PublicLayout/DashboardLayout, so the
          landmark and the page heading have to be declared here or the screen
          has neither. Mirrors components/PublicLayout.tsx. */}
      <main id="main-content" tabIndex={-1} style={{ outline: 'none', maxWidth: 560, margin: '0 auto', padding: '20px 16px 128px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="h-display" style={{ fontSize: 'clamp(22px,5vw,30px)', margin: 0 }}>{drive.header}</h1>
            {drive.attendanceCompletedAt && (
              <span className="chip chip-active" style={{ marginTop: 8 }}>✓ completed</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <span className="chip" style={online ? undefined : { borderColor: 'var(--tomato-ink)', color: 'var(--tomato-ink)' }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: online ? 'var(--welfare)' : 'var(--tomato)', display: 'inline-block' }} />
              {online ? 'online' : 'offline'}
            </span>
            {pendingCount > 0 && (
              <button type="button" className="btn btn-sm btn-lemon" onClick={sync} disabled={syncing}>
                {syncing ? 'syncing…' : `⇅ ${pendingCount} pending`}
              </button>
            )}
            <span className="chip">{hereCount} here</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          {/* Placeholder-only before: announced as "edit text, blank". The label
              is sr-only because the placeholder already carries it visually and
              a rendered label would sit on top of the sheet's one-line search. */}
          <Field label="Search a member to check in" labelClassName="sr-only">
            {id => (
              <input
                id={id}
                className="input"
                style={{ minHeight: 52, fontSize: 16 }}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="search a member to check in…"
                autoFocus
              />
            )}
          </Field>
          {/* The results list below appears with no announcement of its own. */}
          <span className="sr-only" role="status" aria-live="polite">{search ? `${results.length} members match` : ''}</span>
          {results.length > 0 && (
            <div className="card" style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 5, padding: 0, maxHeight: 280, overflowY: 'auto' }}>
              {results.map((m, i) => (
                <button
                  key={m.member_id}
                  type="button"
                  onClick={() => tapCheckIn(m)}
                  style={{
                    display: 'flex', width: '100%', alignItems: 'center', gap: 10, minHeight: 56,
                    padding: '8px 14px', textAlign: 'left', background: 'none', border: 'none',
                    borderBottom: i < results.length - 1 ? 'var(--hair)' : 'none',
                    cursor: 'pointer', fontFamily: 'var(--sans)', fontSize: 15,
                  }}
                >
                  <span className="avatar avatar-sm" style={{ background: hashColor(m.full_name), overflow: 'hidden' }}>
                    {m.avatar_url
                      ? <Img ctx="avatar" src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                      : getInitials(m.full_name)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontWeight: 700 }}>{m.full_name}</span>
                  <span className="mono xs" style={{ color: 'var(--welfare-ink)', fontWeight: 700 }}>+ check in</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!walkupOpen ? (
          <button type="button" className="btn btn-sm" style={{ marginBottom: 16, minHeight: 44 }} onClick={() => setWalkupOpen(true)}>
            + add someone (walk-up)
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <Field label="Walk-up attendee name" labelClassName="sr-only" style={{ flex: 1, minWidth: 0 }}>
              {id => (
                <input
                  id={id}
                  className="input"
                  style={{ minHeight: 48 }}
                  value={walkupName}
                  onChange={e => setWalkupName(e.target.value)}
                  placeholder="their name"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && tapWalkup()}
                />
              )}
            </Field>
            {/* §11.9 state 11 */}
            <GatedButton type="button" className="btn btn-primary" style={{ minHeight: 48 }} reason={walkupName.trim() ? null : 'type their name first.'} onClick={tapWalkup}>add</GatedButton>
            <button type="button" className="btn btn-ghost" style={{ minHeight: 48 }} onClick={() => { setWalkupOpen(false); setWalkupName('') }}>cancel</button>
          </div>
        )}

        {/* Roster */}
        {roster.length === 0 ? (
          <EmptyState title="nobody checked in yet" hint="search above or add a walk-up." />
        ) : (
          <div className="card" style={{ padding: 0 }}>
            {roster.map((row, i) => {
              const key = row.memberId != null ? `${welfareProjectId}:${row.memberId}` : row.id.toString()
              const isPending = pendingKeys.has(key) || row.id < 0
              const name = row.memberName || row.walkupName || 'unknown'
              const badgeBg = row.status === 'left' ? 'var(--welfare)' : row.status === 'walk_up' ? 'var(--lemon)' : 'var(--ink)'
              const badgeFg = row.status === 'walk_up' ? '#0A0A0A' : row.status === 'left' ? '#0A0A0A' : '#fff'
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, minHeight: 64, padding: '10px 14px',
                    borderBottom: i < roster.length - 1 ? 'var(--hair)' : 'none',
                    background: row.status === 'left' ? 'rgba(27,138,90,0.06)' : 'transparent',
                  }}
                >
                  <span aria-hidden className="avatar" style={{ width: 40, height: 40, fontSize: 16, background: badgeBg, color: badgeFg }}>
                    {row.status === 'left' ? '✓' : row.status === 'walk_up' ? '＋' : '●'}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'var(--display)', fontWeight: 700, fontSize: 15 }}>
                      {name}{row.walkupName && ' (walk-up)'}
                    </span>
                    <span className="mono xs muted" style={{ display: 'block' }}>
                      {isPending ? 'queued · will sync' : row.status === 'left' ? 'checked out' : 'here'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleConsent(row)}
                    disabled={isPending}
                    title="paper release signed"
                    aria-pressed={row.consentSigned}
                    className="btn btn-sm"
                    style={row.consentSigned ? { background: 'var(--welfare)', borderColor: 'var(--ink)' } : undefined}
                  >
                    {row.consentSigned ? '✓ consent' : 'consent'}
                  </button>
                  {row.status === 'here' && (
                    <button type="button" onClick={() => tapCheckOut(row)} disabled={isPending} className="btn btn-sm btn-ghost">
                      check out
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Once the lead completes the drive the bar above used to vanish, taking the only route to the wrap-up with it. */}
      {canComplete && drive.attendanceCompletedAt && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          background: 'var(--bg)', borderTop: 'var(--hair-2)', boxShadow: 'var(--lift-3)',
        }}>
          <div style={{ display: 'flex', gap: 8, maxWidth: 560, margin: '0 auto', width: '100%', flexWrap: 'wrap' }}>
            <Link to={`/drive/${welfareProjectId}/wrap`} className="btn btn-primary" style={{ flex: 1, minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              wrap up the numbers →
            </Link>
            {drive.slug && (
              <Link to={`/projects/${drive.slug}`} className="btn" style={{ minHeight: 52, display: 'flex', alignItems: 'center' }}>
                public page
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Sticky bottom action bar */}
      {canComplete && !drive.attendanceCompletedAt && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          padding: '12px 16px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          background: 'var(--bg)', borderTop: 'var(--hair-2)', boxShadow: 'var(--lift-3)',
          display: 'flex', gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 8, maxWidth: 560, margin: '0 auto', width: '100%' }}>
            <button type="button" className="btn btn-primary" style={{ flex: 1, minHeight: 52 }} disabled={completing} onClick={handleComplete}>
              {completing ? 'completing…' : '✓ complete & pay out'}
            </button>
            <Link to={`/drive/${welfareProjectId}/wrap`} className="btn" style={{ minHeight: 52, display: 'flex', alignItems: 'center' }}>
              wrap up →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
