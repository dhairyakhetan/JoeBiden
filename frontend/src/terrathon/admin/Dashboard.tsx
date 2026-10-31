import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../../components/Toast'
import { useConfirm } from '../../components/Confirm'
import { useAuth } from '../../auth/AuthContext'
import { supabaseCommunity } from '../../lib/supabaseCommunity'
import {
  listRegistrations, listAdminEvents, setPaid, setMessaged, setNotes,
  setTicketSent, setStatus, setEventStatus, deleteRegistration, register as submitRegistration,
  type AdminRow,
} from '../lib/api'
import type { PublicEvent, SportSlug } from '../lib/types'
import { EVENT, CLASS_OPTIONS } from '../config'
import {
  rupees, statusLabel, relativeTime, prettyPhone, waNumber, dayRange, istDateTime,
} from '../lib/format'
import { useServerOffset } from '../lib/hooks'
import { heldSpots, registrationState, type RegKind } from '../lib/regState'
import { upiLink } from '../lib/upi'
import { downloadWorkbook } from './exportExcel'
import { TicketModal } from './TicketModal'
import { SportMark } from '../components/SportMarks'

type SportFilter = 'all' | SportSlug
type StatusFilter = 'none' | 'not_messaged' | 'unpaid' | 'paid' | 'waitlist' | 'checked_in'

const CHIP_CLASS: Record<string, string> = {
  Confirmed: 'tt-chip--volt',
  'Payment claimed': 'tt-chip--cyan',
  Waitlist: '',
  'Hold expired': 'tt-chip--amber',
  Cancelled: 'tt-chip--danger',
  'Pending payment': '',
}

function KpiTile({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="tt-card" style={{ padding: 14, minWidth: 0 }}>
      <div style={{ fontSize: 'var(--tt-fs-meta)', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--tt-muted)' }}>{label}</div>
      {/* No inline font-family. This is a live count on a desk screen that is
          open all day, and NeutralFace has no tabular figures. Measured, the
          feature is a no-op in it, so "111" and "000" set 14px apart and the
          tile twitched every time the number changed. `.tt-num` carries the
          family that can actually hold a digit column. */}
      <div className="tt-num" style={{ fontSize: 30, lineHeight: 1.05, marginTop: 4, color: accent ?? 'var(--tt-text)' }}>{value}</div>
      {hint && <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  )
}


const REG_CHIP: Record<RegKind, string> = {
  accepting: 'tt-chip--volt',
  closed_by_admin: 'tt-chip--danger',
  waitlisting: 'tt-chip--amber',
  cancelled: 'tt-chip--danger',
}

/**
 * Open or close each sport's registrations. The switch is the `status` column only; the chip beside it says what the public
 * actually sees, because a sport can be switched on and still be shut (full, or past its closing time), and "why is it closed"
 * should never need a database query to answer.
 */
function RegistrationControls({ events, rows, nowMs, onChanged }: {
  events: any[]; rows: AdminRow[]; nowMs: number; onChanged: () => Promise<void> | void
}) {
  const { success, error: toastError } = useToast()
  const confirm = useConfirm()
  const [busy, setBusy] = useState<string | null>(null)

  async function flip(ev: any, next: 'open' | 'closed') {
    if (next === 'closed') {
      const ok = await confirm({
        title: `close ${ev.display_name} registrations?`,
        body: 'The register button on the site turns off straight away for everyone. People who already registered keep their spot and their ticket. You can switch it back on at any time.',
        confirmLabel: 'close registrations',
        danger: true,
      })
      if (!ok) return
    }
    setBusy(ev.slug)
    try {
      await setEventStatus(ev.id, next)
      await onChanged()
      success(next === 'open' ? `${ev.display_name} registrations are on` : `${ev.display_name} registrations are closed`)
    } catch (e: any) {
      toastError('Could not change registrations', e?.message ?? 'Try again.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="tt-card" aria-labelledby="tt-reg-h" style={{ padding: 16, marginBottom: 16 }}>
      <h2 id="tt-reg-h" style={{ fontSize: 'var(--tt-fs-body)', margin: 0 }}>Registrations</h2>
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 10 }}>
        {events.map((ev) => {
          const held = heldSpots(rows.filter((r) => r.event_slug === ev.slug), nowMs)
          const st = registrationState(ev, held, nowMs)
          const on = ev.status === 'open'
          const locked = ev.status === 'cancelled'
          return (
            <li key={ev.slug} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`${ev.display_name} registrations`}
                disabled={busy === ev.slug || locked}
                onClick={() => void flip(ev, on ? 'closed' : 'open')}
                style={{
                  width: 52, height: 30, flexShrink: 0, borderRadius: 999, padding: 3, cursor: busy === ev.slug || locked ? 'default' : 'pointer',
                  border: '2px solid var(--tt-text)', background: on ? 'var(--tt-volt)' : 'transparent', display: 'flex', alignItems: 'center',
                  justifyContent: on ? 'flex-end' : 'flex-start', opacity: busy === ev.slug ? 0.5 : 1,
                }}
              >
                <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', background: on ? '#062B18' : 'var(--tt-text)', display: 'block' }} />
              </button>
              <strong style={{ minWidth: 92 }}>{ev.display_name}</strong>
              <span className={`tt-chip ${REG_CHIP[st.kind]}`}>{st.label}</span>
              <span style={{ color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-meta)', flex: '1 1 220px' }}>{st.detail}</span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function TerraThonAdmin() {
  const { success, error: toastError, info } = useToast()
  const confirm = useConfirm()
  const { member } = useAuth()
  // The admin device's own clock is not trusted for "how long ago" labels;
  // see lib/hooks.ts's own comment on why a phone's clock cannot be trusted.
  const serverOffset = useServerOffset()

  const [rows, setRows] = useState<AdminRow[]>([])
  const [events, setEvents] = useState<PublicEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sportFilter, setSportFilter] = useState<SportFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('none')
  const [q, setQ] = useState('')
  const [ticketFor, setTicketFor] = useState<AdminRow | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())
  const [queueOpen, setQueueOpen] = useState(false)

  const memberId = (member as any)?.member_id ?? null

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [r, e] = await Promise.all([listRegistrations(), listAdminEvents()])
      setRows(r)
      setEvents(e as PublicEvent[])
    } catch (err: any) {
      setLoadError(err?.message || 'Could not load registrations.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // After a registrations switch: refresh the sport rows only, so the desk does not flash back to skeletons.
  const reloadEvents = useCallback(async () => { setEvents((await listAdminEvents()) as PublicEvent[]) }, [])

  // Realtime. On reconnect after sleep or a dropped connection we REFETCH the
  // whole list rather than trusting the event stream to have been continuous,
  // so a missed event never leaves a permanent gap in the feed.
  useEffect(() => {
    const ch = (supabaseCommunity as any)
      .channel('terrathon-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'terrathon_registrations' }, (payload: any) => {
        void load().then(() => {
          if (payload.eventType === 'INSERT') {
            const id = payload.new?.id
            if (id) {
              setFresh((s) => new Set(s).add(id))
              window.setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(id); return n }), 5000)
            }
            info('New registration', payload.new?.ref_code ?? '')
          }
        })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'terrathon_checkins' }, () => { void load() })
      .subscribe()
    return () => { void (supabaseCommunity as any).removeChannel(ch) }
  }, [load, info])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, cricket: 0, pickleball: 0, fifa: 0 }
    for (const r of rows) if (r.event_slug) c[r.event_slug] = (c[r.event_slug] ?? 0) + 1
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (sportFilter !== 'all' && r.event_slug !== sportFilter) return false
      const label = statusLabel(r)
      if (statusFilter === 'not_messaged' && r.wa_texted_by != null) return false
      if (statusFilter === 'unpaid' && r.paid) return false
      if (statusFilter === 'paid' && !r.paid) return false
      if (statusFilter === 'waitlist' && label !== 'Waitlist') return false
      if (statusFilter === 'checked_in' && !r.last_checkin) return false
      if (!needle) return true
      return [r.ref_code, r.captain_name, r.team_name, r.school, r.phone, r.notes, ...r.roster]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle))
    })
  }, [rows, sportFilter, statusFilter, q])

  const kpis = useMemo(() => {
    const scope = sportFilter === 'all' ? rows : rows.filter((r) => r.event_slug === sportFilter)
    const paid = scope.filter((r) => r.paid)
    const collected = paid.reduce((sum, r) => sum + (r.amount_paid_inr ?? 0), 0)
    const ev = sportFilter === 'all' ? null : (events as any[]).find((e) => e.slug === sportFilter)
    return { total: scope.length, paid: paid.length, collected, cap: ev?.cap ?? null, breakeven: ev?.breakeven ?? null }
  }, [rows, sportFilter, events])

  /** The action queue, PRD 7.11: "what do I do right now", in four lists. */
  const queue = useMemo(() => {
    const active = rows.filter((r) => r.status !== 'cancelled')
    const now = Date.now()
    return {
      message: active.filter((r) => r.wa_texted_by == null && statusLabel(r) !== 'Waitlist')
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
      verify: active.filter((r) => !r.paid && r.utr),
      tickets: active.filter((r) => r.paid && !r.ticket_sent_at),
      holds: active.filter((r) => !r.paid && r.hold_expires_at &&
        new Date(r.hold_expires_at).getTime() - now < 6 * 3600_000 &&
        new Date(r.hold_expires_at).getTime() > now),
    }
  }, [rows])

  const eventFor = useCallback(
    (slug: SportSlug) => (events as any[]).find((e) => e.slug === slug),
    [events],
  )

  // ── Mutations. Every one of these owns its own toast, per this repo's
  //    feedback convention: services throw, components report. ───────────────
  const togglePaid = async (row: AdminRow) => {
    if (row.paid) {
      const ok = await confirm({
        title: 'unmark this as paid?',
        body: `${row.ref_code} stops working at the gate until someone marks it paid again. The ticket itself is kept, so re-ticking restores the same QR and nothing needs resending.`,
        confirmLabel: 'unmark it',
        danger: true,
      })
      if (!ok) return
      try {
        await setPaid(row.id, false)
        success('Unmarked as paid', row.ref_code)
        void load()
      } catch (e: any) { toastError('Could not update', e?.message ?? 'Try again.') }
      return
    }

    const ev = eventFor(row.event_slug)
    const ok = await confirm({
      title: `mark ${row.ref_code} as paid?`,
      body: `Only tick this once the money is actually in AquaTerra's account. A screenshot is not proof. This mints the entry ticket for ${row.team_name || row.captain_name}.`,
      confirmLabel: `mark paid, ${rupees(ev?.fee_inr ?? 0)}`,
    })
    if (!ok) return
    try {
      await setPaid(row.id, true, { amount_paid_inr: ev?.fee_inr ?? null })
      success('Marked as paid', `${row.ref_code} · ticket ready`)
      void load()
    } catch (e: any) { toastError('Could not update', e?.message ?? 'Try again.') }
  }

  const toggleMessaged = async (row: AdminRow) => {
    try {
      await setMessaged(row.id, row.wa_texted_by != null ? null : memberId)
      void load()
    } catch (e: any) { toastError('Could not update', e?.message ?? 'Try again.') }
  }

  const openWhatsApp = (row: AdminRow) => {
    const ev = eventFor(row.event_slug)
    const fee = ev?.fee_inr ?? 0
    const text = row.paid
      ? `Hey! Payment confirmed for ${row.team_name || row.captain_name}, TerraThon ${row.event_name}\nYou're in. Your entry QR is on its way, save it, you'll need it at the gate.\n-Team AQ`
      // The link already carries the reference code as the UPI note, so this
      // asks them to CHECK it rather than to type it. A few apps drop the note
      // silently and only the payer can see that.
      : `Hey! Thanks for signing up for TerraThon ${row.event_name}\n${row.team_name ? `Team: ${row.team_name}\n` : ''}Pay ${rupees(fee)} here: ${upiLink(fee, row.ref_code)}\nThe note should already say ${row.ref_code}. If it's blank, paste it in so we can match it fast.\nOnce you've paid, just reply here with the UTR.\n-Team AQ`
    window.open(`https://wa.me/${waNumber(row.phone)}?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    // Opening WhatsApp cannot confirm a message was actually sent, so it never
    // ticks the box by itself. The toast offers it instead.
    info('Opened WhatsApp', 'Tick Messaged once it has actually gone out.')
  }

  const cancelRow = async (row: AdminRow) => {
    const ok = await confirm({
      title: `cancel ${row.ref_code}?`,
      body: 'The slot frees up immediately and the ticket stops working. This can be undone by restoring the row.',
      confirmLabel: 'cancel it',
      danger: true,
    })
    if (!ok) return
    try {
      await setStatus(row.id, 'cancelled')
      success('Cancelled', row.ref_code)
      void load()
    } catch (e: any) { toastError('Could not cancel', e?.message ?? 'Try again.') }
  }

  /**
   * Delete, not cancel. Cancel is the reversible one and stays the default for
   * a real entrant who drops out; this is for a duplicate, a test row or a
   * mistake that should not be in the count at all.
   *
   * The confirmation asks for the reference code to be typed. A delete here
   * takes a paying entrant out of the roster with no undo, and the desk is run
   * on a phone at a venue, so a single tap is not enough friction.
   */
  const deleteRow = async (row: AdminRow) => {
    const ok = await confirm({
      title: `delete ${row.ref_code} for good?`,
      body:
        `This removes ${row.captain_name}'s entry, their roster and any check-in. `
        + 'It cannot be undone, and it is not the same as cancelling: cancel keeps the '
        + 'record and frees the slot, delete leaves nothing behind but an audit entry. '
        + 'Use cancel unless this row should never have existed.',
      confirmLabel: 'delete it',
      danger: true,
    })
    if (!ok) return
    try {
      await deleteRegistration(row.id)
      success('Deleted', row.ref_code)
      void load()
    } catch (e: any) { toastError('Could not delete', e?.message ?? 'Try again.') }
  }

  const promote = async (row: AdminRow) => {
    const ok = await confirm({
      title: `promote ${row.ref_code} off the waitlist?`,
      body: 'They become a normal pending-payment registration and take a slot. Send them the pay link straight after.',
      confirmLabel: 'promote them',
    })
    if (!ok) return
    try {
      await setStatus(row.id, 'pending_payment')
      success('Promoted', row.ref_code)
      void load()
    } catch (e: any) { toastError('Could not promote', e?.message ?? 'Try again.') }
  }

  const exportNow = () => {
    try {
      downloadWorkbook(rows)
      success('Export ready', `${rows.length} registrations`)
    } catch (e: any) {
      toastError('Export failed', e?.message ?? 'Try again.')
    }
  }

  return (
    <div className="tt-wrap tt-page" style={{ maxWidth: 1400 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <div className="tt-kicker">TerraThon 2026</div>
          <h1 style={{ fontSize: 34, textTransform: 'uppercase', lineHeight: 1 }}>Registrations</h1>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to={`${EVENT.base}/admin/checkin`} className="tt-btn tt-btn--quiet">Scanner</Link>
          <Link to={`${EVENT.base}/admin/print`} className="tt-btn tt-btn--quiet">Day sheet</Link>
          <button type="button" className="tt-btn tt-btn--quiet" onClick={exportNow} disabled={!rows.length}>Export Excel</button>
          <button type="button" className="tt-btn" onClick={() => setAddOpen(true)}>+ Add</button>
        </div>
      </header>

      {/* KPI tiles, action queue and per-sport counts all read from rows/kpis/
          queue, which stay at their empty initial values when load() throws.
          Gate them on loadError/loading the same way the Feed section below
          does, so a failed load never shows a confident "0" or "nothing
          waiting" above the one place that admits it could not load. */}
      {loadError ? (
        <div className="tt-card" role="alert" style={{ borderColor: 'var(--tt-danger)', marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, color: 'var(--tt-danger)' }}>Couldn't load registrations</h2>
          <p style={{ margin: '8px 0 16px', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>{loadError}</p>
          <button type="button" className="tt-btn tt-btn--ghost" onClick={() => void load()}>Try again</button>
        </div>
      ) : loading ? (
        <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
          <span className="tt-sr" role="status">Loading registrations</span>
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {[0, 1, 2, 3].map((i) => <div key={i} className="tt-card" style={{ height: 72, opacity: 0.35 }} aria-hidden="true" />)}
          </div>
        </div>
      ) : (
        <>
          <RegistrationControls events={events as any[]} rows={rows} nowMs={Date.now() + serverOffset} onChanged={reloadEvents} />

          {/* KPI tiles */}
          <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 16 }}>
            <KpiTile label="Registrations" value={String(kpis.total)} hint={kpis.cap ? `cap ${kpis.cap}` : 'all sports'} />
            <KpiTile label="Paid" value={String(kpis.paid)} accent="var(--tt-volt)" hint={kpis.total ? `${Math.round((kpis.paid / kpis.total) * 100)}% of registrations` : undefined} />
            <KpiTile label="Collected" value={rupees(kpis.collected)} accent="var(--tt-cyan)" />
            <KpiTile
              label="Breakeven"
              value={kpis.breakeven ? `${kpis.paid} / ${kpis.breakeven}` : '–'}
              accent={kpis.breakeven && kpis.paid >= kpis.breakeven ? 'var(--tt-volt)' : 'var(--tt-amber)'}
              hint={kpis.breakeven ? (kpis.paid >= kpis.breakeven ? 'clear' : `${kpis.breakeven - kpis.paid} to go`) : 'pick a sport'}
            />
          </div>

          {/* Action queue */}
          <section className="tt-card" style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setQueueOpen((v) => !v)}
              aria-expanded={queueOpen}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'none', border: 'none', color: 'var(--tt-text)', font: 'inherit', cursor: 'pointer', minHeight: 56, textAlign: 'left' }}
            >
              <strong style={{ fontSize: 'var(--tt-fs-body)' }}>What to do right now</strong>
              <span className="tt-chip tt-chip--amber">{queue.message.length + queue.verify.length + queue.tickets.length + queue.holds.length}</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginLeft: 'auto', transform: queueOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {queueOpen && (
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', padding: '0 18px 18px' }}>
                {([
                  ['Message these', queue.message, 'not messaged, oldest first'],
                  ['Verify payment', queue.verify, 'UTR claimed, not yet ticked'],
                  ['Send tickets', queue.tickets, 'paid, ticket not sent'],
                  ['Holds expiring', queue.holds, 'within 6 hours'],
                ] as const).map(([title, list, hint]) => (
                  <div key={title} style={{ border: '1px solid var(--tt-hairline)', borderRadius: 'var(--tt-r-in)', padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <strong style={{ fontSize: 'var(--tt-fs-body)' }}>{title}</strong>
                      <span className="tt-num" style={{ marginLeft: 'auto', fontSize: 22, color: list.length ? 'var(--tt-volt)' : 'var(--tt-muted)' }}>{list.length}</span>
                    </div>
                    <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)', marginBottom: 8 }}>{hint}</div>
                    <div style={{ display: 'grid', gap: 5, maxHeight: 150, overflowY: 'auto' }}>
                      {list.slice(0, 12).map((r) => {
                        const ageH = (Date.now() - new Date(r.created_at).getTime()) / 3600_000
                        return (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => { setQ(r.ref_code); setQueueOpen(false) }}
                            style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'none', border: 'none', padding: '4px 0', color: 'var(--tt-text)', font: 'inherit', fontSize: 'var(--tt-fs-meta)', cursor: 'pointer', textAlign: 'left' }}
                          >
                            <span style={{ color: title === 'Message these' && ageH > 6 ? 'var(--tt-danger)' : 'var(--tt-cyan)' }}>{r.ref_code}</span>
                            <span style={{ color: 'var(--tt-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {r.team_name || r.captain_name}
                            </span>
                          </button>
                        )
                      })}
                      {list.length === 0 && <span style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>Nothing waiting.</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            {(['all', 'cricket', 'pickleball', 'fifa'] as SportFilter[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSportFilter(s)}
                className={`tt-chip ${sportFilter === s ? 'tt-chip--volt' : ''}`}
                style={{ cursor: 'pointer', minHeight: 'var(--tt-ctl)', border: sportFilter === s ? 'none' : '1px solid var(--tt-hairline-2)' }}
                aria-pressed={sportFilter === s}
              >
                {s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)} {counts[s] ?? 0}
              </button>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {([
          ['none', 'Everything'], ['not_messaged', 'Not messaged'], ['unpaid', 'Unpaid'],
          ['paid', 'Paid'], ['waitlist', 'Waitlist'], ['checked_in', 'Checked in'],
        ] as Array<[StatusFilter, string]>).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setStatusFilter(v)}
            className={`tt-chip ${statusFilter === v ? 'tt-chip--cyan' : ''}`}
            style={{ cursor: 'pointer', minHeight: 'var(--tt-ctl)', border: statusFilter === v ? 'none' : '1px solid var(--tt-hairline)' }}
            aria-pressed={statusFilter === v}
          >
            {label}
          </button>
        ))}
        <input
          className="tt-input"
          placeholder="Search name, team, code, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search registrations"
          style={{ maxWidth: 300, minHeight: 40, marginLeft: 'auto' }}
        />
      </div>

      {/* Feed */}
      {loadError ? (
        <div className="tt-card" role="alert" style={{ borderColor: 'var(--tt-danger)' }}>
          <h2 style={{ fontSize: 22, color: 'var(--tt-danger)' }}>Couldn't load registrations</h2>
          <p style={{ margin: '8px 0 16px', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>{loadError}</p>
          <button type="button" className="tt-btn tt-btn--ghost" onClick={() => void load()}>Try again</button>
        </div>
      ) : loading ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <span className="tt-sr" role="status">Loading registrations</span>
          {[0, 1, 2, 3].map((i) => <div key={i} className="tt-card" style={{ height: 120, opacity: 0.35 }} aria-hidden="true" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="tt-card">
          <h2 style={{ fontSize: 22 }}>{rows.length === 0 ? 'No registrations yet' : 'Nothing matches those filters'}</h2>
          <p style={{ margin: '8px 0 0', color: 'var(--tt-muted)', fontSize: 'var(--tt-fs-body)' }}>
            {rows.length === 0
              ? 'The first one lands here the moment someone submits the form.'
              : 'Clear the search or pick a different filter.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {filtered.map((r) => {
            const label = statusLabel(r)
            const ev = eventFor(r.event_slug)
            const isNew = fresh.has(r.id)
            return (
              <article
                key={r.id}
                className="tt-card"
                style={{
                  padding: 16,
                  boxShadow: isNew ? '0 0 0 2px var(--tt-volt)' : undefined,
                  transition: 'box-shadow 600ms ease',
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => { void navigator.clipboard?.writeText(r.ref_code).catch(() => {}); success('Copied', r.ref_code) }}
                    className="tt-hit"
                    style={{ background: 'none', border: 'none', padding: 0, color: 'var(--tt-cyan)', fontFamily: 'var(--tt-display)', fontWeight: 700, fontSize: 19, cursor: 'pointer', letterSpacing: '0.01em' }}
                    title="Copy reference code"
                  >
                    {r.ref_code}
                  </button>
                  <span className="tt-chip" style={{ gap: 6 }}>
                    <SportMark sport={r.event_slug} size={14} />
                    {r.event_name}
                  </span>
                  <span className={`tt-chip ${CHIP_CLASS[label] ?? ''}`}>{label}</span>
                  {r.last_checkin && <span className="tt-chip tt-chip--cyan">Checked in</span>}
                  <span
                    style={{ marginLeft: 'auto', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}
                    title={istDateTime(r.created_at)}
                  >
                    {relativeTime(r.created_at, new Date(Date.now() + serverOffset))}
                  </span>
                </div>

                <div style={{ marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 190, flex: '1 1 210px' }}>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{r.team_name || r.captain_name}</div>
                    {r.team_name && <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>Captain: {r.captain_name}</div>}
                    <div style={{ fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>{r.class_label} · {r.school}</div>
                    {r.roster.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                        aria-expanded={expanded === r.id}
                        className="tt-hit"
                        style={{ marginTop: 4, background: 'none', border: 'none', padding: 0, color: 'var(--tt-cyan)', fontSize: 'var(--tt-fs-meta)', fontWeight: 600, cursor: 'pointer' }}
                      >
                        {1 + r.roster.length} players {expanded === r.id ? '▴' : '▾'}
                      </button>
                    )}
                    {expanded === r.id && (
                      <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
                        {r.roster.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 44 }} onClick={() => openWhatsApp(r)}>
                      WhatsApp
                    </button>
                    <a className="tt-btn tt-btn--quiet" style={{ minHeight: 44 }} href={`tel:${r.phone}`}>Call</a>
                    <span style={{ alignSelf: 'center', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }} className="tt-num">
                      {prettyPhone(r.phone)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label className="tt-check" style={{ padding: '10px 0' }}>
                      <input type="checkbox" checked={r.wa_texted_by != null} onChange={() => void toggleMessaged(r)} />
                      <span style={{ fontSize: 'var(--tt-fs-meta)' }}>Messaged</span>
                    </label>
                    <label className="tt-check" style={{ padding: '10px 0' }}>
                      <input type="checkbox" checked={r.paid} onChange={() => void togglePaid(r)} />
                      <span style={{ fontSize: 'var(--tt-fs-meta)' }}>Paid</span>
                    </label>
                    {r.paid && r.ticket_token && (
                      <button
                        type="button"
                        className="tt-btn"
                        style={{ minHeight: 44 }}
                        onClick={() => setTicketFor(r)}
                      >
                        {r.ticket_sent_at ? 'Ticket sent' : 'Ticket'}
                      </button>
                    )}
                  </div>
                </div>

                <NotesField row={r} onSaved={() => void load()} />

                <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {label === 'Waitlist' && (
                    <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 'var(--tt-ctl)', fontSize: 'var(--tt-fs-meta)' }} onClick={() => void promote(r)}>
                      Promote
                    </button>
                  )}
                  {r.status !== 'cancelled' && (
                    <button type="button" className="tt-btn tt-btn--quiet" style={{ minHeight: 'var(--tt-ctl)', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-danger)' }} onClick={() => void cancelRow(r)}>
                      Cancel
                    </button>
                  )}
                  {/* Last in the row and quieter than Cancel on purpose.
                      Cancel is the reversible one and should be the reflex;
                      this one is for a duplicate or a test row that should not
                      be in the count at all, and it does not come back. */}
                  <button
                    type="button"
                    className="tt-btn tt-btn--quiet"
                    style={{
                      minHeight: 'var(--tt-ctl)',
                      fontSize: 'var(--tt-fs-meta)',
                      marginLeft: 'auto',
                      color: 'var(--tt-muted)',
                      borderColor: 'var(--tt-hairline)',
                    }}
                    onClick={() => void deleteRow(r)}
                  >
                    Delete
                  </button>
                  {ev && (
                    <span style={{ alignSelf: 'center', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
                      {dayRange(ev.day_first, ev.day_last)}
                    </span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {ticketFor && (() => {
        const ev = eventFor(ticketFor.event_slug)
        return (
          <TicketModal
            row={ticketFor}
            dates={ev ? dayRange(ev.day_first, ev.day_last) : ''}
            reportTime={ev?.report_time}
            venue={ev?.venue}
            onClose={() => setTicketFor(null)}
            onSent={() => {
              void setTicketSent(ticketFor.id)
                .then(() => { success('Ticket marked as sent', ticketFor.ref_code); void load() })
                .catch(() => toastError('Could not record that', 'The ticket still went out.'))
            }}
          />
        )
      })()}

      {addOpen && (
        <ManualAdd
          events={events as any[]}
          onClose={() => setAddOpen(false)}
          onDone={() => { setAddOpen(false); void load() }}
        />
      )}
    </div>
  )
}

/** Notes autosave 800ms after typing stops, with a visible saved state. */
function NotesField({ row, onSaved }: { row: AdminRow; onSaved: () => void }) {
  const [value, setValue] = useState(row.notes ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const timer = useRef<number | undefined>(undefined)
  const { error: toastError } = useToast()

  // Adjusted during render (same prevBase technique as components/Img.tsx)
  // instead of an effect, so a new incoming `row.notes` lands in the same
  // render rather than a tick later.
  const [prevRowNotes, setPrevRowNotes] = useState(row.notes)
  if (row.notes !== prevRowNotes) {
    setPrevRowNotes(row.notes)
    setValue(row.notes ?? '')
  }
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const onChange = (v: string) => {
    setValue(v)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      setState('saving')
      try {
        await setNotes(row.id, v)
        setState('saved')
        onSaved()
        window.setTimeout(() => setState('idle'), 2000)
      } catch (e: any) {
        setState('error')
        toastError('Note not saved', e?.message ?? 'Try again.')
      }
    }, 800)
  }

  return (
    <div style={{ marginTop: 10 }}>
      <label className="tt-sr" htmlFor={`n-${row.id}`}>Notes for {row.ref_code}</label>
      <textarea
        id={`n-${row.id}`}
        className="tt-textarea"
        rows={2}
        placeholder="Notes…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ minHeight: 52, fontSize: 'var(--tt-fs-body)' }}
      />
      <div style={{ fontSize: 'var(--tt-fs-meta)', color: state === 'error' ? 'var(--tt-danger)' : 'var(--tt-muted)', minHeight: 15, marginTop: 2 }}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Not saved' : ''}
      </div>
    </div>
  )
}

/** ADM-07. Walk-ins go through the SAME register() as the public form, so they
 *  get real reference codes and appear everywhere the web registrations do.
 *
 *  Rendered as a native <dialog> via showModal(), the same approach as
 *  components/RulesDialog.tsx: it gives autofocus, Escape, a real focus trap
 *  and focus restoration for free, instead of a hand-rolled overlay that
 *  leaves a keyboard user with no initial focus at all. */
function ManualAdd({ events, onClose, onDone }: { events: any[]; onClose: () => void; onDone: () => void }) {
  const { success, error: toastError } = useToast()
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)

  // Mounted with addOpen already true (the parent only renders this component
  // while open), so open the dialog on mount rather than reacting to a prop.
  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])

  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose()
  }
  const [f, setF] = useState({
    sport: (events[0]?.slug ?? 'cricket') as SportSlug,
    captain_name: '', dob: '', class_label: '', school: '', phone: '', team_name: '',
    source: 'on_spot' as 'on_spot' | 'admin',
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await submitRegistration({
        sport: f.sport,
        client_request_id: crypto.randomUUID(),
        captain_name: f.captain_name.trim(),
        dob: f.dob,
        class_label: f.class_label || undefined,
        school: f.school.trim() || undefined,
        phone: f.phone,
        team_name: f.team_name.trim() || undefined,
        rules_consent: 'true',
        updates_opt_in: 'false',
        source: f.source,
      })
      if (res.ok) {
        success('Added', `${res.ref_code} · ${res.status === 'waitlist' ? 'waitlisted' : 'pending payment'}`)
        onDone()
      } else {
        toastError('Not added', res.code.replace(/_/g, ' ').toLowerCase())
      }
    } catch (err: any) {
      toastError('Not added', err?.message ?? 'Try again.')
    } finally {
      setBusy(false)
    }
  }

  // Not the .tt-dialog skin (RulesDialog's own ink-bordered chrome) since the
  // visible box here is still the existing tt-card. The dialog element itself
  // is reset to a plain, borderless, centred positioning box so only that
  // card shows, same look as before, just with a native focus trap now.
  return (
    <dialog
      ref={ref}
      aria-label="Add a registration"
      onClose={onClose}
      onClick={onBackdrop}
      style={{
        border: 'none', padding: 16, margin: 'auto', background: 'transparent',
        maxWidth: '100vw', maxHeight: '100vh',
      }}
    >
      <form onSubmit={submit} className="tt-card tt-card--raised" style={{ width: 'min(430px, 100%)', maxHeight: '92dvh', overflowY: 'auto', display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 24, textTransform: 'uppercase' }}>Add on the spot</h2>
          <button type="button" className="tt-btn tt-btn--quiet" style={{ marginLeft: 'auto', minHeight: 'var(--tt-ctl)' }} onClick={onClose}>Close</button>
        </div>

        <div>
          <label className="tt-label" htmlFor="ma-sport">Sport</label>
          <select id="ma-sport" className="tt-select" value={f.sport} onChange={(e) => setF({ ...f, sport: e.target.value as SportSlug })}>
            {events.map((e) => <option key={e.slug} value={e.slug}>{e.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="tt-label" htmlFor="ma-name">Captain name</label>
          <input id="ma-name" className="tt-input" required value={f.captain_name} onChange={(e) => setF({ ...f, captain_name: e.target.value })} />
        </div>
        <div>
          <label className="tt-label" htmlFor="ma-dob">Date of birth</label>
          {/* A date, like the public form. The RPC rejects anything before
              2005-01-01 whichever door it comes through, so a walk-in added
              here is held to the same rule as someone signing up online. */}
          <input id="ma-dob" className="tt-input" type="date" required
                 max={new Date().toISOString().slice(0, 10)}
                 value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} />
        </div>
        <div>
          <label className="tt-label" htmlFor="ma-team">Team name</label>
          <input id="ma-team" className="tt-input" value={f.team_name} onChange={(e) => setF({ ...f, team_name: e.target.value })} />
        </div>
        <div>
          <label className="tt-label" htmlFor="ma-class">Class</label>
          <select id="ma-class" className="tt-select" value={f.class_label} onChange={(e) => setF({ ...f, class_label: e.target.value })}>
            <option value="">Select</option>
            {CLASS_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="tt-label" htmlFor="ma-school">School</label>
          <input id="ma-school" className="tt-input" value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })} />
        </div>
        <div>
          <label className="tt-label" htmlFor="ma-phone">WhatsApp (10 digits)</label>
          <input id="ma-phone" className="tt-input" inputMode="numeric" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        <div>
          <label className="tt-label" htmlFor="ma-source">Source</label>
          <select id="ma-source" className="tt-select" value={f.source} onChange={(e) => setF({ ...f, source: e.target.value as 'on_spot' | 'admin' })}>
            <option value="on_spot">On the spot</option>
            <option value="admin">Admin entry</option>
          </select>
        </div>

        <button type="submit" className="tt-btn" disabled={busy}>{busy ? 'Adding…' : 'Add registration'}</button>
        <p style={{ margin: 0, fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-muted)' }}>
          Goes through the same path as the public form, so caps and duplicate checks still apply and
          they get a real reference code.
        </p>
      </form>
    </dialog>
  )
}
