import { celebrate } from '../lib/delight'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import attendanceService, { AttendanceRow, DriveInfo } from '../services/attendanceService'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { hasLeaderAccess } from '../lib/roles'
import EmptyState from '../components/EmptyState'
import Field from '../components/Field'
import Skeleton from '../components/Skeleton'

/**
 * Drive wrap - `/drive/:id/wrap`. After a drive: an attendance summary pulled
 * from the real roster, then typed outcome numbers that get pushed onto the
 * drive's linked feed post - so a HoD reviewing the post can see the roster
 * behind it instead of a guessed number. Standalone tool page, no
 * DashboardLayout/AQNav chrome, matching DriveCheckIn's visual language.
 *
 * Two real actions happen here, both idempotent: complete the drive (pays
 * out points once) and push roster-backed outcome numbers onto the linked
 * post - so a re-visit to fix a typo doesn't double-pay or duplicate anything.
 */

function fmtHours(ms: number | null): string {
  if (ms == null) return '–'
  const hrs = ms / 3600000
  return hrs < 0.1 ? '<0.1h' : `${hrs.toFixed(1)}h`
}

export default function DriveWrap() {
  const { id } = useParams<{ id: string }>()
  const welfareProjectId = Number(id)
  const { member: currentMember } = useAuth()
  const toast = useToast()
  const confirm = useConfirm()

  const [drive, setDrive] = useState<DriveInfo | null>(null)
  const [roster, setRoster] = useState<AttendanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [stat1Value, setStat1Value] = useState('')
  const [stat1Label, setStat1Label] = useState('')
  const [stat2Value, setStat2Value] = useState('')
  const [stat2Label, setStat2Label] = useState('')
  const [saving, setSaving] = useState(false)

  const isLead = drive?.driveLeadMemberId != null && drive.driveLeadMemberId === currentMember?.member_id
  const canWrap = isLead || hasLeaderAccess(currentMember?.role)

  const load = useCallback(async () => {
    if (!welfareProjectId) return
    setLoading(true); setAccessDenied(false)
    try {
      const [driveResult, rosterResult, statsResult] = await Promise.all([
        attendanceService.getDrive(welfareProjectId),
        attendanceService.getRoster(welfareProjectId),
        attendanceService.getDriveLinkedPostStats(welfareProjectId).catch(() => ({ success: true, data: null })),
      ])
      setDrive(driveResult.data)
      setRoster(rosterResult.data)
      const existing = statsResult.data
      if (existing?.[0]) { setStat1Value(existing[0].value); setStat1Label(existing[0].label) }
      if (existing?.[1]) { setStat2Value(existing[1].value); setStat2Label(existing[1].label) }
    } catch {
      setAccessDenied(true)
    } finally {
      setLoading(false)
    }
  }, [welfareProjectId])

  useEffect(() => { load() }, [load])

  // Suggest a first stat from the real roster the moment there's nothing
  // typed yet - editable, never forced. Real number, not a guess.
  useEffect(() => {
    if (!loading && roster.length > 0 && !stat1Value && !stat1Label) {
      const attended = roster.filter(r => r.status === 'here' || r.status === 'left').length
      if (attended > 0) { setStat1Value(String(attended)); setStat1Label(attended === 1 ? 'volunteer' : 'volunteers') }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, roster])

  const summary = useMemo(() => {
    const here = roster.filter(r => r.status === 'here').length
    const left = roster.filter(r => r.status === 'left').length
    const noShow = roster.filter(r => r.status === 'no_show').length
    const walkUps = roster.filter(r => r.status === 'walk_up').length
    const start = drive?.workshopDate ? new Date(drive.workshopDate).getTime() : null
    const end = drive?.scheduledEnd ? new Date(drive.scheduledEnd).getTime() : null
    const scheduledMs = start != null && end != null && end > start ? end - start : null
    let totalMs = 0
    let anyUnknown = false
    for (const r of roster) {
      if (r.status !== 'here' && r.status !== 'left') continue
      const checkedIn = r.checkedInAt ? new Date(r.checkedInAt).getTime() : null
      const checkedOut = r.checkedOutAt ? new Date(r.checkedOutAt).getTime() : null
      if (checkedIn != null && checkedOut != null && checkedOut > checkedIn) totalMs += checkedOut - checkedIn
      else if (scheduledMs != null) totalMs += scheduledMs
      else anyUnknown = true
    }
    return { here, left, noShow, walkUps, totalMs: (here + left) > 0 ? totalMs : null, anyUnknown }
  }, [roster, drive])

  const handleWrap = async () => {
    if (!welfareProjectId) return
    const stats = [
      stat1Value.trim() && stat1Label.trim() ? { value: stat1Value.trim(), label: stat1Label.trim() } : null,
      stat2Value.trim() && stat2Label.trim() ? { value: stat2Value.trim(), label: stat2Label.trim() } : null,
    ].filter(Boolean) as { value: string; label: string }[]

    const willPay = !drive?.attendanceCompletedAt
    // Both stat pairs are optional, and a value typed without its label also
    // yields an empty list - in which case updateDriveStats is never called and
    // the post's figures are untouched. The confirm and the toast both used to
    // promise the numbers regardless.
    const willWriteStats = stats.length > 0
    const ok = await confirm({
      title: 'wrap this drive?',
      body: willPay
        ? (willWriteStats
            ? `Attendance is recorded (one-time) and the post updates with these real numbers.`
            : `Attendance is recorded (one-time). You haven't filled in any numbers, so the post's figures stay as they are.`)
        : (willWriteStats
            ? `Attendance was already recorded, this just updates the post's numbers.`
            : `Attendance was already recorded and you haven't filled in any numbers, so this changes nothing.`),
      confirmLabel: 'wrap it up',
    })
    if (!ok) return

    setSaving(true)
    try {
      if (willPay) await attendanceService.completeDrive(welfareProjectId)
      if (willWriteStats) await attendanceService.updateDriveStats(welfareProjectId, stats)
      // Three real outcomes, not two. When attendance was ALREADY recorded and
      // no numbers were filled in, `completeDrive` is skipped and
      // `updateDriveStats` is skipped - nothing at all was written, and
      // "attendance recorded" would be the third false claim in this handler.
      toast.success(
        willWriteStats
          ? (willPay
              ? 'drive wrapped. the post now shows the real numbers'
              : 'the post now shows the real numbers')
          : (willPay
              ? 'attendance recorded. the post’s numbers are unchanged'
              : 'nothing to change - attendance was already recorded and no numbers were filled in'),
      )
      // Confetti only when this call actually recorded attendance; a wrap that changed nothing stays quiet.
      if (willPay || willWriteStats) celebrate('confetti')
      load()
    } catch (e: any) {
      toast.error('couldn’t wrap this drive.', e?.message || 'try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="route-enter" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
        <main style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 60px' }} role="status" aria-busy="true">
          <span className="sr-only">loading the drive…</span>
          <Skeleton variant="line" width="60%" height={28} style={{ marginBottom: 8 }} />
          <Skeleton variant="line" width={110} height={13} style={{ marginBottom: 20 }} />
          <div className="card" style={{ padding: 20, marginBottom: 20 }} aria-hidden="true">
            <Skeleton variant="line" width={140} height={12} style={{ marginBottom: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[0, 1, 2, 3].map(i => <Skeleton key={i} variant="line" height={18} />)}
            </div>
          </div>
          <Skeleton variant="line" width={180} height={12} style={{ marginBottom: 10 }} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Skeleton variant="block" width={90} height={40} />
            <Skeleton variant="block" height={40} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton variant="block" width={90} height={40} />
            <Skeleton variant="block" height={40} style={{ flex: 1 }} />
          </div>
        </main>
      </div>
    )
  }

  if (accessDenied || !drive) {
    return (
      <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
        <EmptyState
          icon="🔒"
          title="not your drive"
          hint="Only this drive's assigned lead (or a director) can wrap it up."
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
      <main id="main-content" tabIndex={-1} style={{ outline: 'none', maxWidth: 480, margin: '0 auto', padding: '20px 16px 60px' }}>
        <h1 className="h-display" style={{ fontSize: 'clamp(22px,5vw,30px)', margin: '0 0 6px' }}>{drive.header}</h1>
        <Link to={`/drive/${drive.id}/check-in`} className="mono xs muted" style={{ display: 'inline-block', marginBottom: drive.slug ? 6 : 20 }}>
          ← back to the sheet
        </Link>
        {/* Where the work ends up: the wrap used to finish with a toast and no way to see the result. */}
        {drive.slug && (
          <Link to={`/projects/${drive.slug}`} className="mono xs muted" style={{ display: 'block', marginBottom: 20 }}>
            see the public page →
          </Link>
        )}

        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h2 className="mono xs upper muted" style={{ fontWeight: 700, margin: '0 0 12px' }}>attendance summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 15, fontWeight: 700, fontFamily: 'var(--display)' }}>
            <div>{summary.here} here</div>
            <div>{summary.left} checked out</div>
            <div>{summary.noShow} no-show</div>
            <div>{summary.walkUps} walk-up{summary.walkUps === 1 ? '' : 's'}</div>
          </div>
          <div className="mono xs" style={{ marginTop: 14, color: 'var(--ink-2)' }}>
            total hours: {fmtHours(summary.totalMs)}
            {summary.anyUnknown && ' (some rows have no checkout and no scheduled end, undercounted)'}
          </div>
          {drive.attendanceCompletedAt && (
            <span className="chip chip-active" style={{ marginTop: 10 }}>✓ attendance already recorded</span>
          )}
        </div>

        <h2 id="drivewrap-outcomes" className="mono xs upper muted" style={{ fontWeight: 700, margin: '0 0 8px' }}>
          outcome numbers <span style={{ fontWeight: 400, textTransform: 'none' }}>(shown on the public post)</span>
        </h2>
        {/* Four placeholder-only inputs announced as "edit text, blank". Field
            binds each label to its control by id; the labels are `sr-only`
            because the row is a value/label pair whose visible layout is the
            design and a rendered label would be a second, competing one.
            `.input` is already `width: 100%`, so moving the 90px/flex sizing
            onto Field's wrapper renders identically. */}
        <fieldset aria-labelledby="drivewrap-outcomes" style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <Field label="First outcome number" labelClassName="sr-only" style={{ width: 90, flexShrink: 0 }}>
              {id => <input id={id} className="input" value={stat1Value} onChange={e => setStat1Value(e.target.value)} placeholder="500" readOnly={!canWrap} aria-describedby={canWrap ? undefined : 'drivewrap-locked'} />}
            </Field>
            <Field label="First outcome label" labelClassName="sr-only" style={{ flex: 1, minWidth: 0 }}>
              {id => <input id={id} className="input" value={stat1Label} onChange={e => setStat1Label(e.target.value)} placeholder="meals served" readOnly={!canWrap} aria-describedby={canWrap ? undefined : 'drivewrap-locked'} />}
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <Field label="Second outcome number" labelClassName="sr-only" style={{ width: 90, flexShrink: 0 }}>
              {id => <input id={id} className="input" value={stat2Value} onChange={e => setStat2Value(e.target.value)} placeholder="12" readOnly={!canWrap} aria-describedby={canWrap ? undefined : 'drivewrap-locked'} />}
            </Field>
            <Field label="Second outcome label" labelClassName="sr-only" style={{ flex: 1, minWidth: 0 }}>
              {id => <input id={id} className="input" value={stat2Label} onChange={e => setStat2Label(e.target.value)} placeholder="volunteers" readOnly={!canWrap} aria-describedby={canWrap ? undefined : 'drivewrap-locked'} />}
            </Field>
          </div>
        </fieldset>

        {canWrap ? (
          <button type="button" className="btn btn-primary" style={{ width: '100%', minHeight: 52 }} disabled={saving} onClick={handleWrap}>
            {saving ? 'wrapping…' : '✓ wrap this drive'}
          </button>
        ) : (
          /* §11.9 state 11. This sentence already existed for the button;
             the four outcome inputs above were `disabled` with nothing said at
             all, so they now point at it with aria-describedby and are
             `readOnly` rather than `disabled` - a disabled input is out of the
             tab order, which means the explanation it points at can never be
             reached. */
          <p className="mono xs muted" id="drivewrap-locked">only this drive's lead or a director can wrap it.</p>
        )}
      </main>
    </div>
  )
}
