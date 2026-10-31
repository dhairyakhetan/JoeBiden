import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import type { PublicEvent } from '../terrathon/lib/types'
import type { AdminRow } from '../terrathon/lib/api'
import { SportCard } from '../terrathon/components/SportCard'
import { SuccessMoment } from '../terrathon/components/SuccessMoment'
import { StadiumScene } from '../terrathon/components/StadiumScene'
import { Countdown } from '../terrathon/components/Countdown'
import { Wordmark } from '../terrathon/components/Wordmark'
import { resolveCountdown, splitDuration } from '../terrathon/lib/countdown'
import '../terrathon/terrathon.css'

/**
 * DEV-ONLY preview harness for TerraThon. Route: /dev/terrathon
 *
 * Same idea as /dev/desk one section over: mount the real surfaces against
 * fixtures, with the network switched off, so they can be designed and reviewed
 * without a session, a database, or a registration that has to be cleaned up
 * afterwards. Several of these states are otherwise almost impossible to see on
 * purpose — a full sport, a waitlisted signup, the scanner's five result cards.
 *
 * It never ships: App.tsx wraps the import() itself in `import.meta.env.DEV`,
 * so Rollup folds the whole branch and drops the chunk. The guard has to be on
 * the IMPORT, not the route — guarding only the route still emits the chunk,
 * which is how ~57KB of dev code once reached production here.
 */
type Scenario = 'populated' | 'empty' | 'loading' | 'error'

const SCENARIOS: Scenario[] = ['populated', 'empty', 'loading', 'error']

function ev(p: Partial<PublicEvent> = {}): PublicEvent {
  return {
    slug: 'cricket', display_name: 'Cricket', status: 'open', fee_inr: 2400,
    team_size_min: 7, team_size_max: 8, roster_min_at_signup: 0,
    prize_pool_inr: 9000, prize_split: { winner: 5500, runner_up: 3500 },
    venue: 'VS Sports Arena, Bhowanipore', venue_map_url: 'https://maps.google.com',
    day_first: '2026-10-03', day_last: '2026-10-04',
    report_time: '9:30 AM', match_window: '10 AM to 3:30 PM',
    rules_md: '## Format\n\nOne innings, knockout.\n\n- 8 overs per innings\n- One substitute allowed\n- **Carry school ID**',
    closes_at: '2026-10-02T18:29:00.000Z', sort_order: 2,
    filling_fast: false, accepting: true, ...p,
  }
}

const EVENTS: PublicEvent[] = [
  ev({ slug: 'pickleball', display_name: 'Pickleball', fee_inr: 750, team_size_min: 2, team_size_max: 2, prize_pool_inr: 6000, prize_split: { winner: 4000, runner_up: 2000 }, day_first: '2026-10-02', day_last: '2026-10-02', sort_order: 1, filling_fast: true }),
  ev({}),
  ev({ slug: 'fifa', display_name: 'FIFA', fee_inr: 350, team_size_min: 1, team_size_max: 1, prize_pool_inr: 2500, prize_split: { winner: 1500, runner_up: 1000 }, day_first: '2026-10-03', day_last: '2026-10-03', sort_order: 3, accepting: false }),
]

function reg(p: Partial<AdminRow> = {}): AdminRow {
  return {
    id: 'r1', ref_code: 'TT26-CRK-004', event_id: 'e1',
    captain_name: 'Aarav Shah', age: 16, class_label: null, school: null,
    phone: '+919876543210', email: null, team_name: 'Night Owls',
    status: 'confirmed', wa_texted_by: 7, wa_texted_at: '2026-09-20T10:00:00.000Z',
    paid: true, paid_at: '2026-09-20T11:00:00.000Z', paid_by: 7,
    amount_paid_inr: 2400, utr: '123456789012', utr_submitted_at: null,
    hold_expires_at: null, ticket_token: '11111111-2222-3333-4444-555555555555',
    ticket_sent_at: null, notes: null, source: 'web',
    created_at: '2026-09-20T09:00:00.000Z', updated_at: '2026-09-20T11:00:00.000Z',
    event_slug: 'cricket', event_name: 'Cricket', roster: ['Riya D', 'Kabir M'], last_checkin: null,
    ...p,
  }
}

const REGS: any[] = [
  { ...reg(), terrathon_events: { slug: 'cricket', display_name: 'Cricket' }, terrathon_roster: [{ full_name: 'Riya D' }, { full_name: 'Kabir M' }], terrathon_checkins: [] },
  { ...reg({ id: 'r2', ref_code: 'TT26-PKL-011', team_name: 'Dink Dynasty', captain_name: 'Riya Das', paid: false, status: 'pending_payment', wa_texted_by: null, utr: null, ticket_token: null, event_slug: 'pickleball', event_name: 'Pickleball' }), terrathon_events: { slug: 'pickleball', display_name: 'Pickleball' }, terrathon_roster: [{ full_name: 'Meera P' }], terrathon_checkins: [] },
  { ...reg({ id: 'r3', ref_code: 'TT26-FIF-023', team_name: null, captain_name: 'Kabir Mehta', paid: false, status: 'waitlist', wa_texted_by: null, utr: null, ticket_token: null, event_slug: 'fifa', event_name: 'FIFA' }), terrathon_events: { slug: 'fifa', display_name: 'FIFA' }, terrathon_roster: [], terrathon_checkins: [] },
]

const EVENT_ROWS = [
  { id: 'e1', slug: 'pickleball', display_name: 'Pickleball', fee_inr: 750, cap: 24, breakeven: 20, day_first: '2026-10-02', day_last: '2026-10-02', venue: null, report_time: null, sort_order: 1, status: 'open', closes_at: null },
  { id: 'e2', slug: 'cricket', display_name: 'Cricket', fee_inr: 2100, cap: 16, breakeven: 14, day_first: '2026-10-03', day_last: '2026-10-04', venue: null, report_time: null, sort_order: 2, status: 'open', closes_at: null },
  { id: 'e3', slug: 'fifa', display_name: 'FIFA', fee_inr: 350, cap: 24, breakeven: 20, day_first: '2026-10-03', day_last: '2026-10-03', venue: null, report_time: null, sort_order: 3, status: 'open', closes_at: null },
]

/** Disco Diwali fixtures. Rebuilt whenever the scenario changes, so 'empty' really starts empty. */
const discoSeed = (scenario: Scenario) => ({
  regs: scenario === 'empty' ? [] : [
    { id: 'd1', dd_id: 'DD26-K3X7', name: 'Riya Das', phone: '9830011111', school: 'DBPC', phase: 'terrathon_special', amount: 550, paid: true, attended: true, notes: null, created_by: 'admin@example.com', created_at: '2026-10-01T08:00:00.000Z', updated_at: '2026-10-01T08:00:00.000Z' },
    { id: 'd2', dd_id: 'DD26-M4PQ', name: 'Karan Mehta', phone: '9830022222', school: null, phase: 'terrathon_special', amount: 550, paid: false, attended: false, notes: null, created_by: 'admin@example.com', created_at: '2026-10-01T09:00:00.000Z', updated_at: '2026-10-01T09:00:00.000Z' },
    { id: 'd3', dd_id: 'DD26-9ZTA', name: 'Aanya Rao', phone: '9830033333', school: 'La Martiniere', phase: 'terrathon_special', amount: 550, paid: true, attended: false, notes: 'cash at the door', created_by: 'admin@example.com', created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-10-01T10:00:00.000Z' },
    { id: 'd4', dd_id: 'DD26-HH2E', name: '=cmd formula guest', phone: '9830044444', school: null, phase: 'gone_phase', amount: null, paid: true, attended: false, notes: null, created_by: null, created_at: '2026-10-01T11:00:00.000Z', updated_at: '2026-10-01T11:00:00.000Z' },
  ] as any[],
  settings: [] as any[],
})

/** A tiny stateful stand-in for the two disco tables: select / insert / update / delete / upsert, filtered by .eq(). */
function discoChain(store: any[], pk: string, gate: <T,>(v: T) => Promise<T>) {
  let op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  let payload: any = null
  let eq: [string, any] | null = null
  let single = false
  const run = () => {
    const match = (r: any) => !eq || r[eq[0]] === eq[1]
    let out: any[] = []
    if (op === 'select') out = store.filter(match)
    if (op === 'insert') {
      const now = new Date().toISOString()
      const row = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...payload }
      store.unshift(row)
      out = [row]
    }
    if (op === 'update') { out = store.filter(match); out.forEach((r) => Object.assign(r, payload)) }
    if (op === 'delete') { out = store.filter(match); out.forEach((r) => store.splice(store.indexOf(r), 1)) }
    if (op === 'upsert') {
      const hit = store.find((r) => r[pk] === payload[pk])
      if (hit) Object.assign(hit, payload); else store.push({ ...payload })
      out = [hit ?? payload]
    }
    return single ? { data: out[0] ?? null, error: null } : { data: out, error: null }
  }
  const self: any = {
    select: () => self, order: () => self, limit: () => self,
    eq: (c: string, v: any) => { eq = [c, v]; return self },
    insert: (p: any) => { op = 'insert'; payload = p; return self },
    update: (p: any) => { op = 'update'; payload = p; return self },
    upsert: (p: any) => { op = 'upsert'; payload = p; return self },
    delete: () => { op = 'delete'; return self },
    single: () => { single = true; return self },
    then: (res: any, rej: any) => gate(null).then(() => run()).then(res, rej),
  }
  return self
}

type SurfaceId =
  | 'hero' | 'cards' | 'scenes' | 'success' | 'waitlist'
  | 'desk' | 'scanner' | 'daysheet' | 'disco'

const SURFACES: Array<{ id: SurfaceId; label: string; note: string }> = [
  { id: 'hero',     label: 'Hero + countdown', note: 'The ink slab, wordmark and the four digit blocks.' },
  { id: 'cards',    label: 'Sport cards',      note: 'All three, including a filling-fast and a closed one.' },
  { id: 'scenes',   label: 'Stadium scenes',   note: 'The three posters side by side.' },
  { id: 'success',  label: 'Success moment',   note: 'Choreography, confetti and the full card.' },
  { id: 'waitlist', label: 'Waitlisted',       note: 'The variant with no pay card. Hard to reach for real.' },
  { id: 'desk',     label: 'Admin desk',       note: 'Live feed, KPI tiles, action queue, row controls.' },
  { id: 'scanner',  label: 'Gate scanner',     note: 'Camera is off in the harness; use the manual field.' },
  { id: 'daysheet', label: 'Printed day sheet', note: 'Black on white. Ctrl+P to see the print layout.' },
  { id: 'disco',    label: 'Disco Diwali desk', note: 'In-memory fake: add, check in, edit, delete and phase edits all work and reset with the scenario.' },
]

export default function TerraThonSurfaces() {
  const [scenario, setScenario] = useState<Scenario>('populated')
  const [surface, setSurface] = useState<SurfaceId>('cards')
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario
  const discoRef = useRef<{ scenario: Scenario; data: ReturnType<typeof discoSeed> }>({ scenario, data: discoSeed(scenario) })
  if (discoRef.current.scenario !== scenario) discoRef.current = { scenario, data: discoSeed(scenario) }

  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── Fixtures in, network off ─────────────────────────────────────────────
  useEffect(() => {
    const realFetch = window.fetch
    const db = supabaseCommunity as any
    const realFrom = db.from
    const realRpc = db.rpc

    window.fetch = (() =>
      Promise.reject(new Error('[dev/terrathon] network is disabled in the preview harness'))) as any

    const settle = <T,>(value: T): Promise<T> => {
      const s = scenarioRef.current
      if (s === 'loading') return new Promise<T>(() => {})
      if (s === 'error') return Promise.reject(new Error('[fixture] read failed'))
      return Promise.resolve(value)
    }

    /** A thenable that answers every builder method with itself. */
    const chain = (rowsFor: () => any[]) => {
      const data = () => (scenarioRef.current === 'empty' ? [] : rowsFor())
      const self: any = {
        select: () => self, order: () => self, in: () => self,
        is: () => self, not: () => self, limit: () => self, range: () => self,
        // .update(patch).eq(col, val) really changes the fixture row, so a switch on the desk can be flipped and seen
        eq: (col: string, val: any) => { self._eq = [col, val]; return self },
        neq: () => self,
        update: (patch: any) => { self._patch = patch; return self },
        insert: () => self, delete: () => self, upsert: () => self,
        maybeSingle: () => settle({ data: data()[0] ?? null, error: null }),
        single: () => settle({ data: data()[0] ?? null, error: null }),
        then: (res: any, rej: any) => {
          if (self._patch) {
            const [col, val] = self._eq ?? []
            for (const r of rowsFor()) if (!col || r[col] === val) Object.assign(r, self._patch)
            return settle({ data: null, error: null }).then(res, rej)
          }
          return settle({ data: data(), error: null, count: data().length }).then(res, rej)
        },
      }
      return self
    }

    db.from = (table: string) => {
      if (table === 'terrathon_registrations') return chain(() => REGS)
      if (table === 'terrathon_events') return chain(() => EVENT_ROWS)
      if (table === 'terrathon_public_events') return chain(() => EVENTS)
      if (table === 'disco_diwali_registrations') return discoChain(discoRef.current.data.regs, 'id', settle)
      if (table === 'disco_diwali_settings') return discoChain(discoRef.current.data.settings, 'key', settle)
      return chain(() => [])
    }
    db.rpc = (name: string) => {
      if (name === 'terrathon_server_now') return settle({ data: new Date().toISOString(), error: null })
      if (name === 'terrathon_register') return settle({ data: { ok: true, ref_code: 'TT26-CRK-007', status: 'pending_payment' }, error: null })
      if (name === 'terrathon_check_in') return settle({ data: { result: 'OK', ref_code: 'TT26-CRK-004', display_name: 'Cricket', team_name: 'Night Owls', captain_name: 'Aarav Shah', players: 3 }, error: null })
      return settle({ data: null, error: null })
    }

    return () => {
      window.fetch = realFetch
      db.from = realFrom
      db.rpc = realRpc
    }
  }, [])

  const cd = resolveCountdown(EVENTS, new Date())
  const parts = splitDuration(cd.target ? cd.target.getTime() - Date.now() : 0)
  const band = w <= 600 ? 'phone' : w <= 1024 ? 'tablet' : 'desktop'
  const active = SURFACES.find((s) => s.id === surface) ?? SURFACES[0]

  return (
    <div className="tt-root" style={{ minHeight: '100dvh' }}>
      <div className="tt-bg" aria-hidden="true"><div className="tt-bg__stripes" /><div className="tt-bg__grain" /></div>

      {/* Harness chrome */}
      <div className="tt-slab" style={{ position: 'sticky', top: 0, zIndex: 80, borderBottom: '2px solid #0A0A0A' }}>
        <div style={{ padding: '12px 18px', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <strong style={{ fontFamily: 'var(--tt-display)', fontSize: 15, textTransform: 'uppercase' }}>
            TerraThon preview
          </strong>
          <span className="tt-chip tt-chip--lemon">{band} · {w}px</span>
          <span className="tt-chip" style={{ background: 'transparent', color: 'var(--bg, #F4EFE0)' }}>network off</span>

          <span style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap' }}>
            {SCENARIOS.map((s) => (
              <button key={s} type="button" onClick={() => setScenario(s)} aria-pressed={scenario === s}
                      className={`tt-chip ${scenario === s ? 'tt-chip--hot' : ''}`} style={{ cursor: 'pointer' }}>
                {s}
              </button>
            ))}
          </span>
        </div>
        <div style={{ padding: '0 18px 12px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {SURFACES.map((s) => (
            <button key={s.id} type="button" onClick={() => setSurface(s.id)} aria-pressed={surface === s.id}
                    className={`tt-chip ${surface === s.id ? 'tt-chip--on' : ''}`} style={{ cursor: 'pointer' }}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <p style={{ margin: 0, padding: '12px 18px', fontSize: 13.5, color: 'var(--ink-3, #5A5A55)', borderBottom: '2px solid #0A0A0A' }}>
        {active.note}
      </p>

      {/* No router here: App already provides one, and nesting a second throws
          "You cannot render a <Router> inside another <Router>". The <Link>s in
          these surfaces therefore navigate for real, which is fine in a harness. */}
      <>
        <div className="tt-content" style={{ padding: 18 }}>
          {surface === 'hero' && (
            <div className="tt-slab" style={{ padding: 28, borderRadius: 32, border: '2px solid #0A0A0A' }}>
              <Wordmark tone="ink" size={72} />
              <div style={{ marginTop: 26 }}><Countdown target={cd} parts={parts} tone="ink" /></div>
            </div>
          )}

          {surface === 'cards' && (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
              {EVENTS.map((e, i) => <SportCard key={e.slug} event={e} index={i} />)}
            </div>
          )}

          {surface === 'scenes' && (
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              {(['cricket', 'pickleball', 'fifa'] as const).map((s) => (
                <div key={s} className="tt-card" style={{ padding: 0, overflow: 'hidden' }}>
                  <StadiumScene sport={s} style={{ height: 210, borderBottom: '2px solid #0A0A0A' }} />
                  <div style={{ padding: 14, fontFamily: 'var(--tt-display)', fontWeight: 700, textTransform: 'uppercase' }}>{s}</div>
                </div>
              ))}
            </div>
          )}

          {(surface === 'success' || surface === 'waitlist') && (
            <div style={{ maxWidth: 560 }}>
              <SuccessMoment
                key={surface}
                sport="cricket"
                event={EVENTS[1]}
                refCode="TT26-CRK-004"
                waitlisted={surface === 'waitlist'}
                firstName="Aarav"
              />
            </div>
          )}

          {surface === 'desk' && <LazyDesk />}
          {surface === 'disco' && <LazyDisco key={scenario} />}
          {surface === 'scanner' && <LazyScanner />}
          {surface === 'daysheet' && <LazyDaySheet />}
        </div>
      </>
    </div>
  )
}

/* The three admin surfaces are lazy so opening the harness on a public surface
   does not pull zxing or the Excel writer in with it. */
const Desk = lazy(() => import('../terrathon/admin/Dashboard').then((m) => ({ default: m.TerraThonAdmin })))
const Scanner = lazy(() => import('../terrathon/admin/Checkin').then((m) => ({ default: m.TerraThonCheckin })))
const DaySheet = lazy(() => import('../terrathon/admin/Print').then((m) => ({ default: m.TerraThonPrint })))
const Disco = lazy(() => import('../terrathon/admin/DiscoDiwali').then((m) => ({ default: m.TerraThonDiscoDiwali })))

const Fallback = () => <div style={{ padding: 40, color: 'var(--ink-3, #5A5A55)' }}>Loading surface…</div>
const LazyDesk = () => <Suspense fallback={<Fallback />}><Desk /></Suspense>
const LazyScanner = () => <Suspense fallback={<Fallback />}><Scanner /></Suspense>
const LazyDisco = () => <Suspense fallback={<Fallback />}><Disco /></Suspense>
const LazyDaySheet = () => <Suspense fallback={<Fallback />}><DaySheet /></Suspense>
