import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { checkIn, listRegistrations, type AdminRow } from '../lib/api'
import type { CheckInResult, SportSlug } from '../lib/types'
import { EVENT } from '../config'
import { istDateTime } from '../lib/format'
import { enqueue, allQueued, flush, scanKey, type QueuedScan } from './offlineQueue'
import { tokenFromScan, istDayString } from '../lib/scan'
import { SportMark } from '../components/SportMarks'
import { playAdmit } from '../lib/sound'

// 'QUEUE_FAILED': the offline write itself did not persist (IndexedDB blocked,
// threw, or the quota is full). This must NOT reuse 'QUEUED' or the volunteer
// is told ADMIT for a scan that was never saved anywhere.
// 'SCAN_FAILED': the online request never got a server answer at all (network
// drop mid-scan), as opposed to a definite server verdict like INVALID.
type Outcome = CheckInResult['result'] | 'QUEUED' | 'QUEUE_FAILED' | 'SCAN_FAILED'

// The two admit states use --tt-go-ink, not --welfare. White on raw --welfare
// measures 4.35:1, under the 4.5:1 floor for normal text, and tokens.css
// already flags that exact pair as failing. --welfare-ink is 6.18:1. This is
// read at arm's length, outdoors, in daylight, by someone deciding whether to
// let a person through a gate.
const STYLE: Record<Outcome, { bg: string; fg: string; title: string }> = {
  OK:            { bg: 'var(--tt-go-ink, #146F47)', fg: '#FFFFFF', title: 'ADMIT' },
  QUEUED:        { bg: 'var(--tt-go-ink, #146F47)', fg: '#FFFFFF', title: 'ADMIT · OFFLINE' },
  ALREADY_IN:    { bg: 'var(--lemon, #FFC700)',   fg: '#0A0A0A', title: 'ALREADY IN' },
  WRONG_DAY:     { bg: 'var(--lemon, #FFC700)',   fg: '#0A0A0A', title: 'WRONG DAY' },
  NOT_CONFIRMED: { bg: 'var(--tomato, #FF4D2E)',  fg: '#0A0A0A', title: 'NOT PAID' },
  INVALID:       { bg: 'var(--tomato, #FF4D2E)',  fg: '#0A0A0A', title: 'NOT A TICKET' },
  FORBIDDEN:     { bg: 'var(--tomato, #FF4D2E)',  fg: '#0A0A0A', title: 'NO ACCESS' },
  // Same refusal colour language as the other tomato outcomes above; this is
  // deliberately NOT the green ADMIT colour, because nobody was admitted.
  QUEUE_FAILED:  { bg: 'var(--tomato, #FF4D2E)',  fg: '#0A0A0A', title: 'NOT ADMITTED' },
  SCAN_FAILED:   { bg: 'var(--tomato, #FF4D2E)',  fg: '#0A0A0A', title: 'TRY AGAIN' },
}

export function TerraThonCheckin() {
  const { success, error: toastError, info } = useToast()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<any>(null)
  const lastScan = useRef<{ text: string; at: number }>({ text: '', at: 0 })

  const [day, setDay] = useState(istDayString())
  const [sport, setSport] = useState<SportSlug | 'all'>('all')
  // `sport` is only carried so the success tone knows which clip to play; it
  // is not rendered.
  const [result, setResult] = useState<{ outcome: Outcome; detail: string; sub?: string; sport?: SportSlug } | null>(null)
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pending, setPending] = useState<QueuedScan[]>([])
  const [cache, setCache] = useState<AdminRow[]>([])
  const [cacheError, setCacheError] = useState<string | null>(null)
  const [camError, setCamError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [torch, setTorch] = useState(false)
  const [scanning, setScanning] = useState(false)

  // ── Offline cache: the day's confirmed registrations, so a scan can be
  //    validated and admitted with no network at all. ────────────────────────
  const loadCache = useCallback(async () => {
    try {
      const rows = await listRegistrations()
      // A registration can be marked paid and THEN cancelled (refund,
      // disqualification, duplicate cleanup). The online path is safe because
      // terrathon_check_in checks status itself, but this cache backs the
      // offline path, which has no such backstop. statusLabel() already
      // treats 'cancelled' as beating 'paid'; match that here.
      setCache(rows.filter((r) => r.paid && r.ticket_token && r.status !== 'cancelled'))
      setCacheError(null)
    } catch (e: any) {
      setCacheError(e?.message || 'Could not cache the day list.')
    }
  }, [])

  const refreshPending = useCallback(async () => { setPending(await allQueued()) }, [])

  useEffect(() => { void loadCache(); void refreshPending() }, [loadCache, refreshPending])

  const sync = useCallback(async () => {
    const { ok, failed, rejected } = await flush(async (item) => {
      const res = await checkIn(item.token, item.day)
      // ALREADY_IN means the row is in, which is exactly what the queue wanted.
      if (res.result === 'OK' || res.result === 'ALREADY_IN') return
      // Anything else is a definitive server verdict, not a connectivity
      // problem: this ticket was invalid (cancelled, wrong day, ...) and will
      // still be invalid on the next retry. Mark it so flush() drops it from
      // the queue instead of retrying forever, and reports it separately.
      const err: any = new Error(res.result)
      err.permanent = true
      throw err
    })
    await refreshPending()
    if (ok) { success(`Synced ${ok} check-in${ok > 1 ? 's' : ''}`); void loadCache() }
    if (rejected.length) {
      // These people are already through the gate, admitted offline on a
      // ticket the server has now definitively refused. That is a "find them"
      // problem, not a "wait for wifi" problem, so it must not look like the
      // ordinary retry-pending toast below.
      toastError(
        `${rejected.length} admitted on an invalid ticket`,
        rejected.map((r) => r.label).join(', '),
      )
    }
    if (failed && !rejected.length) toastError('Sync failed', 'Still offline? It will retry.')
  }, [refreshPending, success, toastError, loadCache])

  useEffect(() => {
    const on = () => { setOnline(true); void sync() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [sync])

  const byToken = useMemo(() => {
    const m = new Map<string, AdminRow>()
    for (const r of cache) if (r.ticket_token) m.set(r.ticket_token, r)
    return m
  }, [cache])

  const checkedInToday = useMemo(() => {
    const queued = new Set(pending.filter((p) => p.day === day).map((p) => p.registrationId))
    const scope = sport === 'all' ? cache : cache.filter((r) => r.event_slug === sport)
    const done = scope.filter((r) => queued.has(r.id) || (r.last_checkin && r.last_checkin.slice(0, 10) === day))
    return { done: done.length, total: scope.length }
  }, [cache, pending, day, sport])

  // ── Handle one scanned or typed code ─────────────────────────────────────
  const handle = useCallback(async (raw: string) => {
    const token = tokenFromScan(raw)
    if (!token) { setResult({ outcome: 'INVALID', detail: 'That code is not a TerraThon ticket.' }); return }

    const cached = byToken.get(token)

    if (!online) {
      // Offline: validate against the cache, admit optimistically, queue the write.
      if (!cached) {
        setResult({ outcome: 'INVALID', detail: 'Not in the offline list.', sub: 'Reconnect and scan again.' })
        return
      }
      const key = scanKey(cached.id, day)
      const already = pending.some((p) => p.key === key)
      if (already) {
        setResult({ outcome: 'ALREADY_IN', detail: cached.team_name || cached.captain_name, sub: 'Queued on this phone already' })
        return
      }
      const persisted = await enqueue({ key, registrationId: cached.id, token, day, at: Date.now(), label: cached.team_name || cached.captain_name })
      await refreshPending()
      if (!persisted) {
        // The write never landed (IndexedDB blocked, threw, or the quota is
        // full). It is NOT in `pending`, will never sync, and nothing else on
        // screen says so, so this must read as a refusal, not an admission,
        // or a volunteer lets someone in on a scan that was never recorded.
        setResult({
          outcome: 'QUEUE_FAILED',
          detail: cached.team_name || cached.captain_name,
          sub: 'Could not save on this device. Not admitted, try again or use the paper sheet.',
          sport: cached.event_slug,
        })
        return
      }
      setResult({
        outcome: 'QUEUED',
        detail: cached.team_name || cached.captain_name,
        sub: `${cached.event_name} · ${1 + cached.roster.length} players · syncs when back online`,
        sport: cached.event_slug,
      })
      return
    }

    try {
      const res = await checkIn(token, day)
      const sport = cached?.event_slug
      if (res.result === 'OK') {
        setResult({ outcome: 'OK', detail: res.team_name || res.captain_name, sub: `${res.display_name} · ${res.players} players`, sport })
        void loadCache()
      } else if (res.result === 'ALREADY_IN') {
        setResult({ outcome: 'ALREADY_IN', detail: res.ref_code, sub: `Checked in at ${istDateTime(res.scanned_at)}${res.scanned_by ? ` by ${res.scanned_by}` : ''}`, sport })
      } else if (res.result === 'NOT_CONFIRMED') {
        setResult({ outcome: 'NOT_CONFIRMED', detail: res.ref_code, sub: 'Send them to the payment desk.', sport })
      } else if (res.result === 'WRONG_DAY') {
        setResult({ outcome: 'WRONG_DAY', detail: res.ref_code, sub: `Registered for ${res.display_name}`, sport })
      } else if (res.result === 'FORBIDDEN') {
        setResult({ outcome: 'FORBIDDEN', detail: 'Your account cannot check people in.', sub: 'Ask a director to run the gate.' })
      } else {
        setResult({ outcome: 'INVALID', detail: 'Not a TerraThon ticket.' })
      }
    } catch (e: any) {
      // A thrown request (network dropped mid-scan) used to be a corner toast
      // only, easy to miss at a loud gate, and easy to mistake for silence.
      // Give it a full result card like every other outcome so the volunteer
      // sees it and re-scans instead of waving the person through.
      setResult({ outcome: 'SCAN_FAILED', detail: 'Could not reach the server.', sub: e?.message ?? 'Scan again once the connection is back.' })
    }
  }, [byToken, online, day, pending, refreshPending, loadCache])

  // Result card clears itself after 2.5s so scanning resumes hands-free.
  useEffect(() => {
    if (!result) return
    const admitted = result.outcome === 'OK' || result.outcome === 'QUEUED'
    // navigator.vibrate has never shipped in WebKit, so on every iOS browser
    // this silently no-ops and the screen colour was the only feedback at
    // all. playAdmit() is iOS-aware (unlocked from a real user gesture
    // elsewhere) and already checks the section's own mute preference, so it
    // is safe to call unconditionally here as the second feedback channel.
    if (navigator.vibrate) navigator.vibrate(admitted ? 40 : [30, 60, 30])
    if (admitted) playAdmit()
    const t = window.setTimeout(() => setResult(null), 2500)
    return () => window.clearTimeout(t)
  }, [result])

  // ── Camera ───────────────────────────────────────────────────────────────
  // `starting` alone is not enough as a re-entrancy guard: it is a state
  // update, so it does not take effect until the next render, and
  // `decodeFromConstraints` awaits a permission prompt and device init well
  // before that. A second tap in that window would start a second session;
  // whichever resolves last wins `controlsRef.current`, and the loser's
  // MediaStream and decode loop are never referenced again, so the unmount
  // cleanup below can never reach them and the camera LED stays on for the
  // rest of the session. `startingRef` is checked and set synchronously, so
  // it closes that window; `starting` state only drives the disabled button.
  const startingRef = useRef(false)
  const [starting, setStarting] = useState(false)
  const startCamera = useCallback(async () => {
    if (startingRef.current || scanning) return
    startingRef.current = true
    setStarting(true)
    setCamError(null)
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library')
      const reader = new BrowserMultiFormatReader()
      const controls = await reader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (res: any) => {
          if (!res) return
          const text = res.getText?.() ?? String(res)
          const now = Date.now()
          // Cameras fire the same code many times a second; debounce so one
          // physical ticket produces one decision.
          if (text === lastScan.current.text && now - lastScan.current.at < 2600) return
          lastScan.current = { text, at: now }
          void handle(text)
        },
      )
      controlsRef.current = controls ?? reader
      setScanning(true)
    } catch (e: any) {
      setCamError(
        e?.name === 'NotAllowedError'
          ? 'Camera permission was refused. Allow it in the browser settings, or type the code instead.'
          : 'Could not start the camera on this device. Type the code instead.',
      )
    } finally {
      startingRef.current = false
      setStarting(false)
    }
  }, [handle, scanning])

  useEffect(() => () => {
    try { controlsRef.current?.stop?.(); controlsRef.current?.reset?.() } catch { /* already gone */ }
  }, [])

  const toggleTorch = async () => {
    try {
      const stream = (videoRef.current?.srcObject as MediaStream | null)
      const track = stream?.getVideoTracks()[0]
      if (!track) return
      const next = !torch
      await track.applyConstraints({ advanced: [{ torch: next } as any] })
      setTorch(next)
    } catch {
      info('No torch', 'This device does not expose the torch to the browser.')
    }
  }

  const style = result ? STYLE[result.outcome] : null

  return (
    <div className="tt-wrap tt-page" style={{ maxWidth: 680 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div className="tt-kicker">Gate</div>
          <h1 style={{ fontSize: 30, textTransform: 'uppercase', lineHeight: 1 }}>Check in</h1>
        </div>
        <Link to={`${EVENT.base}/admin`} className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto', minHeight: 'var(--tt-ctl)' }}>
          Back
        </Link>
      </header>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        <span className={`tt-chip ${online ? 'tt-chip--volt' : 'tt-chip--amber'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
        {pending.length > 0 && (
          <button type="button" className="tt-chip tt-chip--cyan" style={{ cursor: 'pointer' }} onClick={() => void sync()}>
            {pending.length} to sync · tap to retry
          </button>
        )}
        <span className="tt-chip tt-num">
          Checked in today: {checkedInToday.done} of {checkedInToday.total}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['all', 'cricket', 'pickleball', 'fifa'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSport(s)}
            aria-pressed={sport === s}
            className={`tt-chip ${sport === s ? 'tt-chip--volt' : ''}`}
            style={{ cursor: 'pointer', border: sport === s ? 'none' : '1px solid var(--tt-hairline-2)' }}
          >
            {s !== 'all' && <SportMark sport={s} size={14} />}
            {s === 'all' ? 'All sports' : s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
        <label className="tt-sr" htmlFor="tt-day">Event day</label>
        <input id="tt-day" type="date" className="tt-input" value={day} onChange={(e) => setDay(e.target.value)} style={{ maxWidth: 170 }} />
      </div>

      {cacheError && (
        <div className="tt-card" role="alert" style={{ borderColor: 'var(--tt-danger)', padding: 12, marginBottom: 12 }}>
          <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)', color: 'var(--tt-danger)' }}>
            Offline list not loaded: {cacheError} Scanning still works while online, but a network drop
            will stop the gate.
          </p>
          <button type="button" className="tt-btn tt-btn--quiet" style={{ marginTop: 10, minHeight: 'var(--tt-ctl)' }} onClick={() => void loadCache()}>
            Retry
          </button>
        </div>
      )}

      {/* Viewfinder */}
      <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#05070A', aspectRatio: '3 / 4' }}>
        <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* Corner brackets */}
        {!result && scanning && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: '12%', pointerEvents: 'none' }}>
            <g fill="none" stroke="var(--tt-volt)" strokeWidth="2.4" strokeLinecap="round">
              <path d="M2 16 V2 H16" /><path d="M84 2 H98 V16" />
              <path d="M98 84 V98 H84" /><path d="M16 98 H2 V84" />
            </g>
          </svg>
        )}

        {!scanning && !camError && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24 }}>
            <button type="button" className="tt-btn" disabled={starting} onClick={() => void startCamera()}>
              {starting ? 'Starting…' : 'Start scanner'}
            </button>
          </div>
        )}

        {camError && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
            <div>
              <p role="alert" style={{ margin: '0 0 14px', fontSize: 'var(--tt-fs-body)', color: 'var(--tt-danger)' }}>{camError}</p>
              <button type="button" className="tt-btn tt-btn--quiet" onClick={() => void startCamera()}>Try again</button>
            </div>
          </div>
        )}

        {/* Result card fills the frame */}
        {result && style && (
          <div
            role="status"
            style={{
              position: 'absolute', inset: 0, background: style.bg, color: style.fg,
              display: 'grid', placeContent: 'center', textAlign: 'center', padding: 24, gap: 10,
            }}
          >
            <div style={{ fontFamily: 'var(--tt-display)', fontSize: 'clamp(44px, 13vw, 84px)', lineHeight: 1 }}>
              {style.title}
            </div>
            <div style={{ fontSize: 19, fontWeight: 700 }}>{result.detail}</div>
            {result.sub && <div style={{ fontSize: 'var(--tt-fs-body)' }}>{result.sub}</div>}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {scanning && <button type="button" className="tt-btn tt-btn--quiet" onClick={() => void toggleTorch()}>{torch ? 'Torch off' : 'Torch'}</button>}
        <button type="button" className="tt-btn tt-btn--quiet" onClick={() => void loadCache()}>Refresh list</button>
      </div>

      {/* Manual entry, ADM-13. Always available: a cracked screen, a dead
          battery or a scuffed printout all end here. */}
      <form
        onSubmit={(e) => { e.preventDefault(); const v = manual.trim(); if (!v) return; void handleManual(v) }}
        style={{ marginTop: 18 }}
      >
        <label className="tt-label" htmlFor="tt-manual">Type a code instead</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="tt-manual"
            className="tt-input"
            placeholder="TT26-CRK-004"
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            autoComplete="off"
          />
          <button type="submit" className="tt-btn">Check</button>
        </div>
        <p className="tt-help">Reference code from the ticket, or paste the full ticket link.</p>
      </form>
    </div>
  )

  /** Reference codes are not tokens, so a typed code is resolved through the
   *  cached day list before it can be checked in. */
  async function handleManual(value: string) {
    const direct = tokenFromScan(value)
    if (direct) { await handle(direct); setManual(''); return }
    const row = cache.find((r) => r.ref_code.toUpperCase() === value.toUpperCase())
    if (!row?.ticket_token) {
      setResult({
        outcome: 'INVALID',
        detail: 'No confirmed ticket for that code.',
        sub: 'Either it is unpaid, or the list needs refreshing.',
      })
      setManual('')
      return
    }
    await handle(row.ticket_token)
    setManual('')
  }
}
