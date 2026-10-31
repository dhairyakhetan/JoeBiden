// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { lazyWithRetry as lazy } from '../../lib/lazyWithRetry'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { BrowserMultiFormatReader } from '@zxing/library'
import JsBarcode from 'jsbarcode'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Inquiry, Score, TeamMember, Update } from '../lib/types'
import { useToast } from '../components/ui/Toast'
import Field from '../../components/Field'

// The two label treatments used across this desk. Passed to <Field labelClassName>
// so a label is always bound to its control by id — the previous pattern here was
// a bare <label> sitting next to an <input>, associated with nothing.
const AL = 'block font-mono text-[9px] uppercase tracking-[0.1em] opacity-60 mb-1'
const AL2 = 'font-mono text-[10px] uppercase opacity-55 block mb-1'
// Admin OS modules are lazy-loaded (P5 perf): opening one tab no longer ships
// the whole OS. Each becomes its own chunk fetched on tab-open; the shared
// Admin chunk keeps only the registrations/events/etc. legacy tabs + chrome.
const ControlRoom    = lazy(() => import('../admin/ControlRoom').then(m => ({ default: m.ControlRoom })))
const FinanceModule  = lazy(() => import('../admin/FinanceModule').then(m => ({ default: m.FinanceModule })))
const AnalyticsModule = lazy(() => import('../admin/AnalyticsModule').then(m => ({ default: m.AnalyticsModule })))
const SponsorsModule = lazy(() => import('../admin/CrmModules').then(m => ({ default: m.SponsorsModule })))
const SchoolsModule  = lazy(() => import('../admin/CrmModules').then(m => ({ default: m.SchoolsModule })))
const LogisticsModule = lazy(() => import('../admin/CrmModules').then(m => ({ default: m.LogisticsModule })))
const CommsModule    = lazy(() => import('../admin/CommsModule').then(m => ({ default: m.CommsModule })))
const FixturesModule = lazy(() => import('../admin/FixturesModule').then(m => ({ default: m.FixturesModule })))
const JudgingModule  = lazy(() => import('../admin/JudgingModule').then(m => ({ default: m.JudgingModule })))
const DoorCheckin    = lazy(() => import('../admin/DoorCheckin').then(m => ({ default: m.DoorCheckin })))

// Suspense boundary for the lazy OS modules (Paradox-styled fallback).
function LazyPanel({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="py-16 grid place-items-center"><div style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(24,24,24,0.15)', borderTopColor: 'var(--c1)', animation: 'spin 0.7s linear infinite' }} role="status" aria-label="Loading" /></div>}>
      {children}
    </Suspense>
  )
}

// `TabKey` doubles as the key of every per-account permission flag.
// Most entries map 1:1 to a tab in the admin UI; `mark_paid` is a
// special "action permission" — it doesn't render a tab, it gates the
// Mark Paid / Mark Unpaid buttons inside the Registrations tab. Listing
// it here means the existing Accounts → permissions matrix picks it up
// automatically; we just filter it out when building the actual tab nav.
type TabKey =
  | 'control_room'
  | 'finance'
  | 'analytics'
  | 'sponsors'
  | 'schools'
  | 'logistics'
  | 'comms'
  | 'fixtures'
  | 'judging'
  | 'door'
  | 'registrations'
  | 'afterparty'
  | 'updates'
  | 'inquiries'
  | 'checkin'
  | 'events'
  | 'scores'
  | 'volunteers'
  | 'winners'
  | 'blog'
  | 'team'
  | 'settings'
  | 'audit'
  | 'accounts'
  | 'mark_paid'
  // Paradox OS action permissions (gate dangerous actions, render no tab — see
  // ACTION_PERMISSIONS). Each maps to a real failure the OS hard-gates:
  // refunds from personal accounts, unreconciled money, premature/biased result
  // announcements, rule-violating fixtures, and unbranded/duplicate comms.
  | 'issue_refund'
  | 'edit_finance'
  | 'publish_results'
  | 'edit_fixtures'
  | 'send_comms'

const ALL_TABS: TabKey[] = [
  'control_room', 'finance', 'analytics', 'door',
  'registrations', 'afterparty', 'updates', 'inquiries', 'checkin', 'events',
  'scores', 'volunteers', 'winners', 'blog', 'team',
  'sponsors', 'schools', 'logistics', 'comms', 'fixtures', 'judging',
  'settings', 'audit', 'accounts', 'mark_paid',
  'issue_refund', 'edit_finance', 'publish_results', 'edit_fixtures', 'send_comms',
]

// Permissions that aren't real tabs — gate individual actions instead.
// `visibleTabs` filters these out so they never appear in the tab nav.
const ACTION_PERMISSIONS: TabKey[] = [
  'mark_paid', 'issue_refund', 'edit_finance', 'publish_results', 'edit_fixtures', 'send_comms',
]

// Friendly labels for permission toggles
const TAB_LABELS: Record<TabKey, string> = {
  control_room: 'Control Room',
  finance: 'Finance',
  analytics: 'Analytics',
  registrations: 'Registrations',
  afterparty: 'After Party',
  updates: 'Updates',
  inquiries: 'Inquiries',
  checkin: 'Check-in',
  events: 'Events',
  scores: 'Scores',
  volunteers: 'Volunteers',
  winners: 'Winners',
  blog: 'Blog',
  team: 'Team',
  sponsors: 'Sponsors',
  schools: 'Schools',
  logistics: 'Logistics',
  comms: 'Comms',
  fixtures: 'Fixtures',
  judging: 'Judging',
  door: 'Door',
  settings: 'Settings',
  audit: 'Audit Log',
  accounts: 'Accounts',
  mark_paid: 'Mark as Paid',
  issue_refund: 'Issue Refund',
  edit_finance: 'Edit Finance',
  publish_results: 'Publish Results',
  edit_fixtures: 'Edit Fixtures',
  send_comms: 'Send Comms',
}

// Short codes for the dense permissions table in Accounts. Hover shows the
// full label via title attribute — but a meaningful 3-char code reads better
// than a generic 4-char prefix that strips meaning ("regi", "upda", "inqu").
const TAB_SHORT: Record<TabKey, string> = {
  control_room: 'CTRL',
  finance: 'LEDG',
  analytics: 'ANLY',
  registrations: 'REG',
  afterparty: 'AP',
  updates: 'UPD',
  inquiries: 'INQ',
  checkin: 'CHK',
  events: 'EVT',
  scores: 'SCR',
  volunteers: 'VOL',
  winners: 'WIN',
  blog: 'BLG',
  team: 'TEAM',
  sponsors: 'SPON',
  schools: 'SCHL',
  logistics: 'LGST',
  comms: 'MSG',
  fixtures: 'FXTR',
  judging: 'JDG',
  door: 'DOOR',
  settings: 'SET',
  audit: 'LOG',
  accounts: 'ACC',
  mark_paid: '$PAID',
  issue_refund: 'REFND',
  edit_finance: 'FIN',
  publish_results: 'PUBL',
  edit_fixtures: 'FIX',
  send_comms: 'COMMS',
}

// ─── Role presets ──────────────────────────────────────────────────────────
// One-click bundles of permissions for the "Set role" picker in the Accounts
// tab. The JSONB column remains the source of truth — these presets just give
// super admins a fast way to assign a coherent permission set without toggling
// every checkbox individually. They can still fine-tune after applying.
type RoleName = 'super_director' | 'director' | 'coordinator' | 'team_lead'

const ROLE_LABELS: Record<RoleName, string> = {
  super_director: 'Super Director',
  director: 'Director',
  coordinator: 'Coordinator',
  team_lead: 'Team Lead',
}

const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  super_director: 'Full access — every tab including settings, audit, and team',
  director: 'Operational lead — everything except settings and audit',
  coordinator: 'Day-to-day ops — registrations, scores, updates, check-in',
  team_lead: 'Field volunteer — registrations and check-in only',
}

const ROLE_PRESETS: Record<RoleName, AdminPermissions> = {
  super_director: {
    control_room: true, finance: true, analytics: true, door: true,
    sponsors: true, schools: true, logistics: true, comms: true, fixtures: true, judging: true,
    registrations: true, afterparty: true, updates: true, inquiries: true, checkin: true,
    events: true, scores: true, volunteers: true, winners: true, blog: true,
    team: true, settings: true, audit: true, accounts: false,
    mark_paid: true,
    issue_refund: true, edit_finance: true, publish_results: true, edit_fixtures: true, send_comms: true,
  },
  director: {
    control_room: true, finance: true, analytics: true, door: true,
    sponsors: true, schools: true, logistics: true, comms: true, fixtures: true, judging: true,
    registrations: true, afterparty: true, updates: true, inquiries: true, checkin: true,
    events: true, scores: true, volunteers: true, winners: true, blog: true,
    team: true, settings: false, audit: false, accounts: false,
    mark_paid: true,
    issue_refund: true, edit_finance: true, publish_results: true, edit_fixtures: true, send_comms: true,
  },
  coordinator: {
    control_room: true, finance: false, analytics: true, door: true,
    sponsors: false, schools: true, logistics: true, comms: true, fixtures: true, judging: true,
    registrations: true, afterparty: true, updates: true, inquiries: false, checkin: true,
    events: false, scores: true, volunteers: false, winners: true, blog: false,
    team: false, settings: false, audit: false, accounts: false,
    mark_paid: true,
    issue_refund: false, edit_finance: false, publish_results: false, edit_fixtures: false, send_comms: true,
  },
  // Field volunteers can see registrations + check people in but can't
  // toggle payment status — that stays with directors/coordinators who
  // are on the WA payment-verification flow.
  team_lead: {
    control_room: false, finance: false, analytics: false, door: true,
    sponsors: false, schools: false, logistics: false, comms: false, fixtures: false, judging: false,
    registrations: true, afterparty: false, updates: false, inquiries: false, checkin: true,
    events: false, scores: false, volunteers: false, winners: false, blog: false,
    team: false, settings: false, audit: false, accounts: false,
    mark_paid: false,
    issue_refund: false, edit_finance: false, publish_results: false, edit_fixtures: false, send_comms: false,
  },
}

type AdminPermissions = Record<TabKey, boolean>
type AdminUser = {
  id: string
  user_email: string
  display_name: string | null
  created_by: string | null
  permissions: AdminPermissions
  // Preset role label for the UI. The actual access is still governed by the
  // `permissions` JSONB; `role` is purely a hint so the picker can show what
  // bundle was last applied.
  role: RoleName
  is_active: boolean
  created_at: string
}
type AdminSession = {
  id: string
  user_email: string
  user_agent: string | null
  browser: string | null
  os: string | null
  created_at: string
  last_seen_at: string
  ended_at: string | null
  is_active: boolean
}

const SUPER_ADMIN = 'admin@gmail.com'

function parseUA(ua: string): { browser: string; os: string } {
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Unknown'
  const os =
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /Mac OS/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : 'Unknown'
  return { browser, os }
}

type RegRow = {
  id: string
  reg_id: string
  token: string
  event_id: string
  event_name: string
  name: string
  email: string
  phone: string
  school: string
  class_year: string | null
  paid: boolean
  attended: boolean
  notes: string | null
  // Free-text record of which admin texted this registrant on WhatsApp
  // with payment details. NULL = not yet texted; any string = texted by
  // that person. Drives the "Texted on WA" checkbox + attribution input
  // on each registration row. See scripts/paradox_add_wa_texted_by.sql.
  wa_texted_by: string | null
  // Mirror of wa_texted_by for phone-call follow-up. NULL = not yet
  // called; any string = called by that named admin. Drives the
  // "Called" checkbox + attribution input. See scripts/paradox_add_called_by.sql.
  called_by: string | null
  created_at: string
  event_date: string | null
  event_time: string | null
  event_venue: string | null
}

type EventLite = { id: string; name: string }

// After-party registration row, mirrored from the
// paradox_afterparty_registrations table.
type AfterPartyReg = {
  id: string         // PK uuid
  ap_id: string      // short human ID printed on the barcode, e.g. "AP-001"
  name: string
  phone: string
  school: string | null
  // Phase key is the `key` field of an entry in AFTERPARTY_PHASES_*.
  // Was a closed union of the 4 default keys; relaxed to string so
  // admins can add custom phases (phase_4, special_promo, etc.) via the
  // After Party tab without a type/DB migration each time. Format is
  // enforced at the DB layer
  // (scripts/paradox_afterparty_phase_open_constraint.sql).
  phase: string
  amount: number | null
  paid: boolean
  attended: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// True when a registration's notes mention cash — the door operator needs
// to collect/verify these, so they get a loud highlight in check-in mode.
const apHasCashNote = (notes: string | null | undefined): boolean =>
  !!notes && /cash/i.test(notes)

// Phase config shape — used by both the admin tab (dropdowns,
// amount auto-fill, table render) AND the public /paradox/afterparty
// page (ticket grid, hero pill, live-status math). Stored DB-side in
// paradox_site_settings.value under the key `afterparty_phases` so
// admins can edit prices + dates + closed-flag from the After Party
// tab without a code push.
type AfterPartyPhaseConfig = {
  // Free-form key — any [a-z0-9_]+ string (DB constraint matches).
  // Used to relate `paradox_afterparty_registrations.phase` rows back
  // to the phase config they were sold under.
  key: string
  label: string
  amount: number
  // ISO date this phase becomes the "live" one. null for closedManually
  // phases (Early bird, which sells out rather than expiring).
  opensAt: string | null
  // Hard-close flag — overrides the date math. Used for sold-out Early
  // bird so the live-status compute drops it regardless of date.
  closedManually: boolean
}

const AFTERPARTY_PHASES_KEY = 'afterparty_phases'

// Default values seeded if no row exists in site_settings, and what
// the "Reset to default" button restores. Kept in lockstep with the
// public AfterParty page's TICKET_TIERS pricing (May 2026 brief).
const AFTERPARTY_PHASES_DEFAULT: AfterPartyPhaseConfig[] = [
  { key: 'early_bird', label: 'Early bird', amount: 450, opensAt: null,         closedManually: true  },
  { key: 'phase_1',    label: 'Phase 1',    amount: 550, opensAt: '2026-05-24', closedManually: false },
  { key: 'phase_2',    label: 'Phase 2',    amount: 600, opensAt: '2026-05-26', closedManually: false },
  { key: 'phase_3',    label: 'Phase 3',    amount: 650, opensAt: '2026-05-27', closedManually: false },
]

// Parse the loaded site-settings value into a typed config array.
// Iterates whatever's stored in the DB (so custom phases added via the
// admin UI survive across reloads) rather than mapping over defaults
// — the old version dropped any rows beyond the 4 defaults, which
// broke the "+ Add phase" workflow. Each row is sanitised
// field-by-field; rows missing a usable `key` are skipped entirely.
// Returns the default list verbatim if the loaded value is
// null/undefined/not-an-array, or if every row was unparseable.
function parseAfterPartyPhases(raw: unknown): AfterPartyPhaseConfig[] {
  if (!Array.isArray(raw)) return AFTERPARTY_PHASES_DEFAULT
  const cleaned: AfterPartyPhaseConfig[] = []
  for (const r of raw as any[]) {
    if (!r || typeof r !== 'object') continue
    const key = typeof r.key === 'string' && /^[a-z0-9_]+$/.test(r.key) ? r.key : null
    if (!key) continue
    cleaned.push({
      key,
      label: typeof r.label === 'string' && r.label.trim() ? r.label : key,
      amount: Number.isFinite(r.amount) ? Number(r.amount) : 0,
      opensAt: typeof r.opensAt === 'string' ? r.opensAt : null,
      closedManually: typeof r.closedManually === 'boolean' ? r.closedManually : false,
    })
  }
  return cleaned.length > 0 ? cleaned : AFTERPARTY_PHASES_DEFAULT
}

// Find which phase is "live" right now: latest opens-at-or-before-today
// that isn't manually closed. Returns the key of the live phase, or null
// if everything is closed/upcoming. Mirrors the math on the public page
// — same algorithm, same source data.
function computeLivePhase(phases: AfterPartyPhaseConfig[]): AfterPartyPhaseConfig | null {
  const todayMs = new Date().setHours(0, 0, 0, 0)
  for (let i = phases.length - 1; i >= 0; i--) {
    const p = phases[i]
    if (p.closedManually) continue
    if (p.opensAt && new Date(p.opensAt).getTime() <= todayMs) return p
  }
  return null
}

// AP-ID alphabet — drops 0/1/I/O/L which look alike when read off
// a printed ticket. 4 chars from this 28-char alphabet → 614,656
// possible IDs. Collisions are caught by the UNIQUE constraint on
// ap_id; the insert handler retries up to 5 times with a fresh random
// value before giving up.
const AP_ID_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
function generateApId(): string {
  let s = ''
  for (let i = 0; i < 4; i++) {
    s += AP_ID_ALPHABET[Math.floor(Math.random() * AP_ID_ALPHABET.length)]
  }
  return `AP-${s}`
}

// Thank-you message templates — admins can edit these in the After Party tab.
// The DB-backed copy lives in paradox_site_settings under
// `afterparty_thankyou_msg`. This default is used when the row isn't
// present yet (fresh install / cache miss).
const AFTERPARTY_THANKYOU_KEY = 'afterparty_thankyou_msg'
const AFTERPARTY_THANKYOU_DEFAULT =
`Hi {name}! 🎉 Your Paradox 2026 After Party ticket is confirmed.

★ Booking ID: {ap_id}
★ Phase: {phase} · ₹{amount}

Show this ID at the door — 60, Chowringhee Banquets, 6th June, 5pm.

See you there!
— Team Paradox`

// Multi-ticket variant — used when admin selects ≥2 rows and clicks
// the "Copy message for N" button. Same placeholders aren't reused;
// instead the system fills these:
//   {names}    → "Riya, Karan & Aanya" (smart join)
//   {tickets}  → bullet list "• Riya — AP-Z3K7 (Early bird, ₹450)\n…"
//   {total}    → ₹ sum across all selected rows
//   {count}    → number of bookings
const AFTERPARTY_THANKYOU_MULTI_KEY = 'afterparty_thankyou_multi'
const AFTERPARTY_THANKYOU_MULTI_DEFAULT =
`Hi {names}! 🎉 Your {count} Paradox 2026 After Party bookings are confirmed.

★ Booking IDs:
{tickets}

★ Total: ₹{total}

Show your IDs at the door — 60, Chowringhee Banquets, 6th June, 5pm.

See you there!
— Team Paradox`

type NewUpdate = {
  title: string
  body: string
  event_name: string
  tag: 'announcement' | 'score' | 'winner' | 'reminder' | 'venue_change'
  pinned: boolean
}

type NewScore = {
  event_id: string
  event_name: string
  team_name: string
  school: string
  score: string
  position: string
  round: string
}

type NewWinner = {
  event_id: string
  event_name: string
  rank: string
  winner_name: string
  school: string
  prize: string
  photo_url: string
  published: boolean
}

type NewBlogPost = {
  slug: string
  title: string
  excerpt: string
  body: string
  author: string
  tag: string
  cover_color: string
  published: boolean
}

type EventFull = {
  id: string
  name: string
  slug: string
  category: string
  active: boolean
  date: string | null
  time: string | null
  venue: string | null
  fee: number | null
  prize: string | null
  team_format: string | null
  min_team_size: number | null
  max_team_size: number | null
  max_participants: number | null
  description: string | null
  rules: string | null
  sort_order: number | null
}

const TAG_COLORS: Record<string, string> = {
  announcement: 'bg-bg text-ink',
  score: 'bg-c3 text-white',
  winner: 'bg-c1 text-white',
  reminder: 'bg-c2 text-ink',
  venue_change: 'bg-[#FF6B35] text-white',
}

const TAG_OPTIONS: NewUpdate['tag'][] = ['announcement', 'score', 'winner', 'reminder', 'venue_change']

const ROUND_OPTIONS = ['Prelims', 'Semifinals', 'Finals']

const VOLUNTEER_STATUSES = ['new', 'briefed', 'confirmed', 'attended', 'no_show']

const BLOG_TAGS = ['announcement', 'hype', 'behind', 'rules', 'impact']

const COVER_COLORS = ['ink', 'hot', 'acid', 'cool', 'acc']
const COVER_COLOR_STYLES: Record<string, string> = {
  ink:  'var(--ink)',
  hot:  'var(--c1)',
  acid: 'var(--c2)',
  cool: 'var(--c3)',
  acc:  'var(--bg)',
}

const tabAnim = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
}

// ---- helpers ----
// Age buckets for unpaid registrations. The chip's job is to give admins
// a "how much should I care" cue at a glance: yellow at 12h ("warming"),
// red at 24h ("urgent"), black-on-red at 48h ("critical — almost
// certainly lost if nobody follows up today").
const ageBucket = (createdAt: string): 'fresh' | 'stale12' | 'stale24' | 'stale48' => {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3600000
  if (hours >= 48) return 'stale48'
  if (hours >= 24) return 'stale24'
  if (hours >= 12) return 'stale12'
  return 'fresh'
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-')

const timeAgo = (iso: string) => {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

const TEMPLATES = (r: any, link: string) => ({
  ticket: `Hi ${r.name}! 🎉 Your spot at *${r.event_name}* is confirmed.\n\nHere's your entry ticket 👇\n${link}\n\n📅 ${r.event_date ?? 'Jun 1–6'} · 📍 ${r.event_venue ?? '60 Chowringhee'}\n\nShow this at the gate. See you at Paradox 2026!\n\n— Team AquaTerra`,
  upi: `Hi ${r.name}! 🙏 Thanks for registering for *${r.event_name}* at Paradox 2026.\n\nTo confirm your spot, please pay the entry fee to the UPI ID in the screenshot attached.\n\nDeadline: 48 hours.\n\nReply here once paid. — Team AquaTerra`,
  reminder: `Hey ${r.name}! 👋 *${r.event_name}* is tomorrow!\n\n📅 ${r.event_date ?? 'Jun 1–6'} · 📍 ${r.event_venue ?? '60 Chowringhee'} · 🕐 ${r.event_time ?? 'tbc'}\n🎟️ Bring your QR ticket: ${link}\n\nSee you there! 🔥 — Team Paradox 2026`,
  rejection: `Hi ${r.name}, we couldn't verify your payment for *${r.event_name}*.\n\nPlease pay the entry fee again and reply with the new transaction screenshot.\n\nNeed help? Just reply. — Team AquaTerra`,
})

export function AdminPage() {
  const { session, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const { success, error: toastError, warning, info } = useToast()
  // `useReducedMotion()` returns true when the OS-level "Reduce Motion"
  // preference is set. Accordion height-auto animations trigger layout each
  // frame; on mid-tier Android or for motion-sensitive users we skip the
  // animation and just snap open/closed.
  const reduceMotion = useReducedMotion()
  const accordionAnim = reduceMotion
    ? { initial: false as const, animate: { height: 'auto' as const, opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { height: 0, opacity: 0 }, animate: { height: 'auto' as const, opacity: 1 }, exit: { height: 0, opacity: 0 } }

  const [activeTab, setActiveTab] = useState<TabKey>('control_room')
  const [ready, setReady] = useState(false)

  const [rows, setRows] = useState<RegRow[]>([])
  const [events, setEvents] = useState<EventLite[]>([])
  const [updates, setUpdates] = useState<Update[]>([])
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [scores, setScores] = useState<Score[]>([])
  // After-party registrations — separate ticketed event, manually logged
  // by admins from WhatsApp / in-person confirmations. Each row gets a
  // short ap_id ("AP-001") that's printed as a CODE128 barcode on a
  // ticket the registrant brings to the door. See the After Party tab
  // below for the form + table + CSV export.
  const [apRegs, setApRegs] = useState<AfterPartyReg[]>([])
  // Default phase = the latest non-closed phase whose opensAt has
  // passed, computed once from the in-code defaults at component init.
  // The form's phase auto-shifts when liveApPhase changes via the
  // useEffect just below.
  const [apForm, setApForm] = useState({
    name: '',
    phone: '',
    school: '',
    phase: (computeLivePhase(AFTERPARTY_PHASES_DEFAULT)?.key ?? 'phase_1') as AfterPartyReg['phase'],
  })
  const [apSearch, setApSearch] = useState('')
  const [apAdding, setApAdding] = useState(false)
  // Check-in mode — flips the After Party tab into a focused door view:
  // big rows, one-tap check-in, live counter, cash-note highlight, and a
  // fast cash-walk-in add. Management chrome (phases/templates/compose/
  // edit/delete) is hidden while it's on.
  const [apCheckinMode, setApCheckinMode] = useState(false)
  const [apSort, setApSort] = useState<'recent' | 'name' | 'unchecked' | 'checked' | 'unpaid'>('recent')
  const [apStatusFilter, setApStatusFilter] = useState<'all' | 'unchecked' | 'checked' | 'unpaid' | 'cash'>('all')
  // The most recent check-in, for the one-tap "undo" affordance in the
  // check-in panel. Cleared when undone or when that same row is
  // un-checked manually.
  const [apLastCheckIn, setApLastCheckIn] = useState<AfterPartyReg | null>(null)
  const [apTicketReg, setApTicketReg] = useState<AfterPartyReg | null>(null)
  const [apEditing, setApEditing] = useState<AfterPartyReg | null>(null)
  // Local draft for inline notes input (mirrors the regs `notes` pattern):
  // typed value lives here until blur, then commits to the DB.
  const [apNotes, setApNotes] = useState<Record<string, string>>({})
  // Selected reg IDs for batch operations — primary use case is bundling
  // multiple bookings from one customer into a single consolidated
  // "thank you, your N tickets are confirmed, IDs are: …" message.
  // A freshly-added row is auto-added to the selection so the admin can
  // just keep tapping + Add for the same customer.
  const [apSelected, setApSelected] = useState<Set<string>>(new Set())

  // New tab state
  const [volunteers, setVolunteers] = useState<any[]>([])
  const [winners, setWinners] = useState<any[]>([])
  const [blogPosts, setBlogPosts] = useState<any[]>([])
  const [siteSettings, setSiteSettings] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])

  // ── After-party phase config — DB-backed via site_settings. ────────
  // Lives here (not next to apForm above) because the useMemo reads
  // `siteSettings`, which is declared on the line just above. Moving
  // these any earlier produces a "Cannot access 'siteSettings' before
  // initialization" TDZ crash on mount.
  const apPhases: AfterPartyPhaseConfig[] = useMemo(() => {
    const raw = siteSettings.find((s) => s.key === AFTERPARTY_PHASES_KEY)?.value
    return parseAfterPartyPhases(raw)
  }, [siteSettings])

  // Currently-active phase based on today's date. Used as the form's
  // default phase on mount so admins logging a new payment land on
  // the right tier without clicking through the dropdown.
  const liveApPhase = useMemo(() => computeLivePhase(apPhases), [apPhases])

  // Shared filtered + sorted view of after-party regs — drives BOTH the
  // management table and the check-in panel so search / filter / sort
  // stay in lockstep. Memoised on the inputs so typing elsewhere doesn't
  // resort the whole list.
  const apView = useMemo(() => {
    const q = apSearch.trim().toLowerCase()
    const list = apRegs.filter((r) => {
      if (q) {
        const hay = `${r.name} ${r.phone} ${r.school ?? ''} ${r.ap_id}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (apStatusFilter === 'unchecked' && r.attended) return false
      if (apStatusFilter === 'checked' && !r.attended) return false
      if (apStatusFilter === 'unpaid' && r.paid) return false
      if (apStatusFilter === 'cash' && !apHasCashNote(r.notes)) return false
      return true
    })
    const byName = (a: AfterPartyReg, b: AfterPartyReg) => a.name.localeCompare(b.name)
    const byRecent = (a: AfterPartyReg, b: AfterPartyReg) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    const sorted = [...list]
    switch (apSort) {
      case 'name': sorted.sort(byName); break
      // not-checked-in first (the queue you still need to work)
      case 'unchecked': sorted.sort((a, b) => Number(a.attended) - Number(b.attended) || byName(a, b)); break
      case 'checked': sorted.sort((a, b) => Number(b.attended) - Number(a.attended) || byName(a, b)); break
      // unpaid first (the people to chase at the door)
      case 'unpaid': sorted.sort((a, b) => Number(a.paid) - Number(b.paid) || byName(a, b)); break
      case 'recent':
      default: sorted.sort(byRecent); break
    }
    return sorted
  }, [apRegs, apSearch, apStatusFilter, apSort])

  // Live check-in tallies (global, not filtered) for the counter.
  const apCheckedInCount = useMemo(() => apRegs.filter((r) => r.attended).length, [apRegs])

  // Per-phase checked-in / total, for the counter breakdown. Keyed by
  // phase key; rendered in apPhases order (custom/legacy keys appended).
  const apPhaseCounts = useMemo(() => {
    const m = new Map<string, { checked: number; total: number }>()
    for (const r of apRegs) {
      const cur = m.get(r.phase) ?? { checked: 0, total: 0 }
      cur.total += 1
      if (r.attended) cur.checked += 1
      m.set(r.phase, cur)
    }
    return m
  }, [apRegs])

  // Snap the form's pre-selected phase to the live phase ONCE after
  // siteSettings hydrates. The seeded ref makes this a one-shot so a
  // later manual phase pick by the admin isn't clobbered by a
  // settings refresh.
  const apFormPhaseSeededRef = useRef(false)
  useEffect(() => {
    if (apFormPhaseSeededRef.current) return
    if (!liveApPhase) return
    apFormPhaseSeededRef.current = true
    setApForm((f) => (f.phase === liveApPhase.key ? f : { ...f, phase: liveApPhase.key }))
  }, [liveApPhase])

  // Registrations filters
  const [search, setSearch] = useState('')
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unpaid' | 'paid' | 'attended' | 'duplicates'>('all')
  // Sort modes:
  //   newest  — created_at desc (default, most-recent regs first)
  //   oldest  — created_at asc (time-since-reg surfacing — oldest pending bubble up)
  //   uncalled — uncalled rows first, then called (call-queue prioritisation)
  //   untexted — untexted rows first, then texted (WA-message queue prioritisation)
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'uncalled' | 'untexted'>('newest')
  const [notes, setNotes] = useState<Record<string, string>>({})
  // Local drafts for the "Texted on WA by ___" and "Called by ___" inputs
  // on each reg row. Both mirror the `notes` map pattern: typed value lives
  // here until blur, then the save handler commits to the DB.
  const [textedBy, setTextedBy] = useState<Record<string, string>>({})
  const [calledBy, setCalledBy] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)
  const [waMenu, setWaMenu] = useState<string | null>(null)

  // Updates state
  const [updateTagFilter, setUpdateTagFilter] = useState<string>('all')
  const [showNewUpdate, setShowNewUpdate] = useState(false)
  const [newUpdate, setNewUpdate] = useState<NewUpdate>({
    title: '',
    body: '',
    event_name: '',
    tag: 'announcement',
    pinned: false,
  })
  const [postingUpdate, setPostingUpdate] = useState(false)

  // Inquiries state
  const [inqNotes, setInqNotes] = useState<Record<string, string>>({})

  // Check-in state
  const [checkinSearch, setCheckinSearch] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)

  // Scores state
  const [scoreEventFilter, setScoreEventFilter] = useState<string>('all')
  const [showNewScore, setShowNewScore] = useState(false)
  const [newScore, setNewScore] = useState<NewScore>({
    event_id: '',
    event_name: '',
    team_name: '',
    school: '',
    score: '',
    position: '',
    round: 'Finals',
  })
  const [postingScore, setPostingScore] = useState(false)

  // Volunteers
  const [volStatusFilter, setVolStatusFilter] = useState<string>('all')

  // Winners
  const [showNewWinner, setShowNewWinner] = useState(false)
  const [winnerEventFilter, setWinnerEventFilter] = useState<string>('all')
  const [newWinner, setNewWinner] = useState<NewWinner>({
    event_id: '',
    event_name: '',
    rank: '1',
    winner_name: '',
    school: '',
    prize: '',
    photo_url: '',
    published: false,
  })
  const [postingWinner, setPostingWinner] = useState(false)

  // Blog
  const [showNewBlog, setShowNewBlog] = useState(false)
  const [blogTagFilter, setBlogTagFilter] = useState<string>('all')
  const [newBlog, setNewBlog] = useState<NewBlogPost>({
    slug: '',
    title: '',
    excerpt: '',
    body: '',
    author: '',
    tag: 'announcement',
    cover_color: 'ink',
    published: false,
  })
  const [postingBlog, setPostingBlog] = useState(false)
  const [blogSlugError, setBlogSlugError] = useState<string | null>(null)

  // Events CRUD tab
  const [eventsFull, setEventsFull] = useState<EventFull[]>([])
  const [editingEvent, setEditingEvent] = useState<Partial<EventFull> | null>(null)
  const [showEventForm, setShowEventForm] = useState(false)
  const [savingEvent, setSavingEvent] = useState(false)
  // Tracks which event is currently mid-toggle so we can disable the button
  // and prevent double-clicks from racing two updates against each other.
  const [togglingEventId, setTogglingEventId] = useState<string | null>(null)

  // Events tab — "who counts toward this number?" popup state. Set when
  // the user clicks one of the colored counts in the Cap column.
  //   mode:   which slice to show — regs / texted / paid
  //   eventId / eventName carry context for the modal title
  const [countPopup, setCountPopup] = useState<{
    eventId: string
    eventName: string
    mode: 'regs' | 'texted' | 'paid'
  } | null>(null)

  // Escape closes the count popup. Other modals in this file install
  // their own handlers; piggybacking on a shared one would couple them.
  useEffect(() => {
    if (!countPopup) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCountPopup(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [countPopup])

  // Settings — "add key" modal state (replaces the native prompt() flow)
  const [showAddSettingKey, setShowAddSettingKey] = useState(false)
  const [newSettingKey, setNewSettingKey] = useState('')

  // Team CRUD tab — backs the public /team page via paradox_team_members.
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [showTeamForm, setShowTeamForm] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Partial<TeamMember> | null>(null)
  const [savingTeam, setSavingTeam] = useState(false)
  // Locks up/down arrows on the row being moved to prevent rapid-click races.
  const [movingTeamId, setMovingTeamId] = useState<string | null>(null)

  // Audit
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all')
  const [auditResourceFilter, setAuditResourceFilter] = useState<string>('all')
  const [auditExpanded, setAuditExpanded] = useState<string | null>(null)

  // Accounts & sessions (super admin only)
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminSessions, setAdminSessions] = useState<AdminSession[]>([])
  const [authUsers, setAuthUsers] = useState<{ id: string; email: string; created_at: string; last_sign_in_at: string | null }[]>([])
  const [myPermissions, setMyPermissions] = useState<AdminPermissions | null>(null)
  const [myIsActive, setMyIsActive] = useState<boolean | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const isSuperAdmin = session?.user?.email === SUPER_ADMIN

  // New account form
  const [newAccountEmail, setNewAccountEmail] = useState('')
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountPassword, setNewAccountPassword] = useState('')
  // Defaults mirror the 'coordinator' preset — the most common starting role.
  // The super admin can pick a different preset before clicking Create.
  const [newAccountPerms, setNewAccountPerms] = useState<AdminPermissions>(ROLE_PRESETS.coordinator)
  const [newAccountRole, setNewAccountRole] = useState<RoleName>('coordinator')
  const [creatingAccount, setCreatingAccount] = useState(false)

  // Tabs visible to this user. ACTION_PERMISSIONS (e.g. `mark_paid`) are
  // permissions but not tabs — filter them out so they never render in the
  // tab nav even for super admins.
  const visibleTabs: TabKey[] = useMemo(() => {
    const baseTabs = ALL_TABS.filter((t) => !ACTION_PERMISSIONS.includes(t))
    if (isSuperAdmin) return baseTabs
    if (!myPermissions || myIsActive === false) return []
    return baseTabs.filter((t) => t !== 'accounts' && myPermissions[t])
  }, [isSuperAdmin, myPermissions, myIsActive])

  // Convenience gate for the Mark Paid / Mark Unpaid actions. Super admins
  // always have it; otherwise it comes from the JSONB permissions row.
  const canMarkPaid = isSuperAdmin || !!myPermissions?.mark_paid

  // When permissions load and the default tab isn't accessible, jump to the first visible tab
  useEffect(() => {
    if (visibleTabs.length > 0 && !visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0])
    }
  }, [visibleTabs]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session && !loading) navigate('/paradox/admin/login')
  }, [session, loading, navigate])

  useEffect(() => {
    if (!session) return

    // ── Two-phase load ───────────────────────────────────────────────
    // The admin page used to wait on a single Promise.all of 16 table
    // reads before flipping `ready` true — the slowest one (usually
    // paradox_registrations, which scales with reg volume) gated the
    // entire UI behind a skeleton. Split into:
    //   1. ESSENTIAL — small, cheap reads needed for the chrome to
    //      render: permissions (role gating), site settings (templates
    //      / phase config), active events (regs filter). These three
    //      together are sub-100ms even on a cold connection.
    //   2. DEFERRED — everything else. Loads in parallel right after
    //      the essential batch fires. Tabs render their own skeletons
    //      until their data lands. `ready` is already true so the
    //      chrome + nav + currently-visible tab paint immediately.

    // ESSENTIAL — gates `ready`. Keep this list tiny.
    Promise.all([
      supabase.from('paradox_admin_permissions').select('*').order('created_at'),
      supabase.from('paradox_site_settings').select('*'),
      supabase.from('paradox_events').select('id, name').eq('active', true),
    ]).then(([{ data: permsAll }, { data: setts }, { data: evs }]) => {
      setAdminUsers((permsAll ?? []) as AdminUser[])
      setSiteSettings((setts ?? []) as any[])
      setEvents((evs ?? []) as EventLite[])

      const myPerms = (permsAll ?? []).find((p: any) => p.user_email === session?.user?.email)
      if (myPerms) {
        setMyPermissions(myPerms.permissions as AdminPermissions)
        setMyIsActive(myPerms.is_active)
      }

      setReady(true)

      // Session insert + audit are fire-and-forget — never block on them.
      const { browser, os } = parseUA(navigator.userAgent)
      supabase.from('paradox_admin_sessions').insert({
        user_id: session?.user?.id ?? null,
        user_email: session?.user?.email ?? '',
        user_agent: navigator.userAgent.slice(0, 200),
        browser,
        os,
      }).select('id').single().then(({ data: sd }) => {
        if (sd?.id) setCurrentSessionId(sd.id)
      })
      supabase.from('paradox_audit_log').insert({
        actor_email: session?.user?.email ?? null,
        action: 'session_start',
        resource: 'admin',
        resource_id: session?.user?.id ?? null,
        details: { browser, os },
      }).then(() => {})
    })

    // DEFERRED — heavy reads. Doesn't gate the UI. Each setter is
    // independent so consumers (per-tab views) render their own
    // loading state until their slice arrives. Promise.all keeps
    // network parallelism + a single destructure point; if any one
    // fails we lose all data here, but the chrome stays up so the
    // admin can refresh or work in tabs whose data already landed
    // from realtime channels.
    Promise.all([
      supabase
        .from('paradox_registrations')
        .select('*, paradox_events ( date, time, venue )')
        .order('created_at', { ascending: false }),
      supabase.from('paradox_events').select('*').order('sort_order', { ascending: true, nullsFirst: false }).order('name'),
      supabase
        .from('paradox_updates')
        .select('*')
        .order('pinned', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('paradox_inquiries').select('*').order('created_at', { ascending: false }),
      supabase
        .from('paradox_scores')
        .select('*')
        .order('event_name')
        .order('position', { ascending: true, nullsFirst: false }),
      supabase.from('paradox_volunteers').select('*').order('created_at', { ascending: false }),
      supabase
        .from('paradox_winners')
        .select('*, paradox_events(name)')
        .order('event_name')
        .order('rank'),
      supabase.from('paradox_blog_posts').select('*').order('created_at', { ascending: false }),
      supabase.from('paradox_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('paradox_admin_sessions').select('*').order('last_seen_at', { ascending: false }).limit(200),
      supabase.from('paradox_auth_users_view').select('*').order('created_at'),
      supabase.from('paradox_team_members').select('*').order('kind').order('sort_order'),
      // After-party registrations (separate ticketed event, manually logged
      // by admins as confirmations come in over WhatsApp / in person).
      supabase.from('paradox_afterparty_registrations').select('*').order('created_at', { ascending: false }),
    ]).then(
      ([
        { data: regs },
        { data: evsFull },
        { data: ups },
        { data: inqs },
        { data: scs },
        { data: vols },
        { data: wins },
        { data: blogs },
        { data: audits },
        { data: sessAll },
        { data: authUsersData },
        { data: teamData },
        { data: apRegs },
      ]) => {
        const flat: RegRow[] = (regs ?? []).map((r: any) => ({
          ...r,
          event_date: r.paradox_events?.date ?? null,
          event_time: r.paradox_events?.time ?? null,
          event_venue: r.paradox_events?.venue ?? null,
        }))
        setRows(flat)
        setEventsFull((evsFull ?? []) as any[])
        setUpdates((ups ?? []) as Update[])
        setInquiries((inqs ?? []) as Inquiry[])
        setScores((scs ?? []) as Score[])
        setVolunteers((vols ?? []) as any[])
        setWinners((wins ?? []) as any[])
        setBlogPosts((blogs ?? []) as any[])
        setAuditLog((audits ?? []) as any[])
        setAdminSessions((sessAll ?? []) as AdminSession[])
        setAuthUsers((authUsersData ?? []) as any[])
        setTeamMembers((teamData ?? []) as TeamMember[])
        setApRegs((apRegs ?? []) as AfterPartyReg[])

        // hydrate inline editors after their source data lands
        const nMap: Record<string, string> = {}
        flat.forEach((r) => { nMap[r.reg_id] = r.notes ?? '' })
        setNotes(nMap)
        const iMap: Record<string, string> = {}
        ;(inqs ?? []).forEach((i: any) => {
          iMap[i.id] = i.notes ?? ''
        })
        setInqNotes(iMap)
      },
    )
  }, [session])

  // Heartbeat: update last_seen_at every 90s while admin is open.
  // Stored in a ref so the explicit logout button can clear it synchronously
  // (preventing the "blink back to active" race where the next tick fires
  // after signOut but before unmount).
  const heartbeatRef = React.useRef<number | null>(null)
  useEffect(() => {
    if (!currentSessionId) return
    const id = window.setInterval(() => {
      supabase.from('paradox_admin_sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', currentSessionId)
        .then(() => {})
    }, 90_000)
    heartbeatRef.current = id
    return () => {
      clearInterval(id)
      heartbeatRef.current = null
    }
  }, [currentSessionId])

  // Mark session ended on tab close — uses `fetch(..., keepalive: true)` so
  // the browser completes the request even after `beforeunload` returns.
  // `.then(() => {})` on the supabase client doesn't promise that behaviour
  // and frequently leaves rows with is_active=true after a tab close,
  // making the Accounts tab show ghost active sessions. `pagehide` is added
  // alongside `beforeunload` because mobile Safari fires it more reliably.
  useEffect(() => {
    if (!currentSessionId || !session) return
    const supabaseUrl =
      (import.meta as any).env.VITE_PARADOX_SUPABASE_URL ||
      (import.meta as any).env.VITE_SUPABASE_URL
    const anonKey =
      (import.meta as any).env.VITE_PARADOX_SUPABASE_ANON_KEY ||
      (import.meta as any).env.VITE_SUPABASE_ANON_KEY
    const accessToken = session.access_token

    const end = () => {
      try {
        const url = `${supabaseUrl}/rest/v1/paradox_admin_sessions?id=eq.${encodeURIComponent(currentSessionId)}`
        fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${accessToken}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ is_active: false, ended_at: new Date().toISOString() }),
          keepalive: true,
        }).catch(() => {})
      } catch { /* best-effort */ }
    }

    window.addEventListener('beforeunload', end)
    window.addEventListener('pagehide', end)
    return () => {
      window.removeEventListener('beforeunload', end)
      window.removeEventListener('pagehide', end)
    }
  }, [currentSessionId, session])

  // Realtime: live updates to sessions and permissions
  useEffect(() => {
    if (!session) return

    const channel = supabase
      .channel('admin-realtime')
      // Sessions: any row insert/update/delete → refresh live
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'paradox_admin_sessions',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAdminSessions((prev) => [payload.new as AdminSession, ...prev].slice(0, 200))
        } else if (payload.eventType === 'UPDATE') {
          setAdminSessions((prev) => prev.map((s) => s.id === (payload.new as AdminSession).id ? payload.new as AdminSession : s))
        } else if (payload.eventType === 'DELETE') {
          setAdminSessions((prev) => prev.filter((s) => s.id !== payload.old.id))
        }
      })
      // Permissions: any row insert/update → reflect immediately
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'paradox_admin_permissions',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAdminUsers((prev) => [...prev, payload.new as AdminUser])
        } else if (payload.eventType === 'UPDATE') {
          setAdminUsers((prev) => prev.map((u) => u.id === (payload.new as AdminUser).id ? payload.new as AdminUser : u))
          // Also update own permissions if this is the current user
          if ((payload.new as AdminUser).user_email === session.user?.email) {
            setMyPermissions((payload.new as AdminUser).permissions)
            setMyIsActive((payload.new as AdminUser).is_active)
          }
        } else if (payload.eventType === 'DELETE') {
          setAdminUsers((prev) => prev.filter((u) => u.id !== payload.old.id))
        }
      })
      // Audit log: new entries appear live
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'paradox_audit_log',
      }, (payload) => {
        setAuditLog((prev) => [payload.new, ...prev].slice(0, 200))
      })
      // Registrations: critical for multi-admin coordination during a live
      // event (one admin marks paid, the other should immediately see it).
      // Without this, the check-in tab fights stale state — admins press
      // "Mark Paid First" on regs that were paid moments ago.
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'paradox_registrations',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRows((prev) => [payload.new as RegRow, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setRows((prev) => prev.map((r) =>
            r.reg_id === (payload.new as RegRow).reg_id ? { ...r, ...(payload.new as RegRow) } : r
          ))
        } else if (payload.eventType === 'DELETE') {
          setRows((prev) => prev.filter((r) => r.reg_id !== (payload.old as RegRow).reg_id))
        }
      })
      .subscribe((status, err) => {
        // Surface realtime failures so a dropped subscription doesn't
        // silently leave admins looking at stale rows during a live
        // event. Possible statuses: SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT,
        // CLOSED. CHANNEL_ERROR / TIMED_OUT are the failure cases.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Admin] realtime subscription failed', status, err)
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [session])

  // Click-outside for WA menu
  useEffect(() => {
    if (!waMenu) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-wa-menu]')) setWaMenu(null)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [waMenu])

  // ---- audit logging ----
  const logAudit = async (action: string, resource: string, resource_id: string, details?: any) => {
    const entry = {
      actor_email: session?.user?.email ?? null,
      action,
      resource,
      resource_id,
      details: details ?? null,
    }
    const { data, error: auditErr } = await supabase
      .from('paradox_audit_log')
      .insert(entry)
      .select('*')
      .single()
    // Audit failures are non-critical (the underlying action already
    // succeeded), but they shouldn't silently disappear — log to console so
    // RLS regressions on paradox_audit_log are at least visible in dev
    // tools instead of leaving a phantom-quiet paper trail.
    if (auditErr) console.warn('[paradox_audit_log] insert failed:', auditErr.message, entry)
    if (data) setAuditLog((l) => [data, ...l].slice(0, 100))
  }

  // ---- derived ----
  const stats = useMemo(() => {
    const total = rows.length
    const paid = rows.filter((r) => r.paid).length
    const attended = rows.filter((r) => r.attended).length
    const unpaid = rows.filter((r) => !r.paid).length
    return { total, paid, attended, unpaid }
  }, [rows])

  // ── Duplicate detection ───────────────────────────────────────────────
  // Groups registrations by (normalised name + normalised phone + event_id)
  // — the same person registering for the same event multiple times. One
  // row per group is kept as CANONICAL and the rest are flagged as
  // duplicates. The flagged Set<reg_id> drives:
  //   - exclusion from Cap-column counts (regs / texted / paid)
  //   - the "duplicate" badge on the reg card
  //   - the "duplicates" status filter
  //
  // Canonical selection rule — most-progressed wins, with earliest as
  // tiebreak:
  //   1. paid = true               beats unpaid
  //   2. wa_texted_by = non-null   beats untexted
  //   3. earliest created_at       wins among equals
  //
  // Why "most-progressed" instead of "earliest": if a member registers
  // twice and the admin marks the LATER row paid (because the original
  // entry has a typo, or the duplicate carries the real notes), the
  // earlier-is-canonical rule would silently drop the paid signal from
  // the event-count badges. Picking the most-progressed row guarantees
  // that any paid/texted state inside a duplicate group rolls up into
  // the count exactly once.
  //
  // Normalisation handles:
  //   - case + whitespace differences in names
  //   - phone-format differences (+91, spaces, dashes, leading 0)
  // A bare 10-digit number and "+91 90734 55396" collapse to the same key.
  const duplicateRegIds = useMemo(() => {
    const normName = (s: string) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    const normPhone = (s: string) => {
      const d = (s ?? '').replace(/\D+/g, '')
      // Strip a leading "91" country code so +919073455396 == 9073455396
      return d.length === 12 && d.startsWith('91') ? d.slice(2) : d
    }
    const groups = new Map<string, RegRow[]>()
    for (const r of rows) {
      const key = `${normName(r.name)}|${normPhone(r.phone)}|${r.event_id}`
      const arr = groups.get(key) ?? []
      arr.push(r)
      groups.set(key, arr)
    }
    const dups = new Set<string>()
    for (const [, arr] of groups) {
      if (arr.length <= 1) continue
      arr.sort((a, b) => {
        // 1. paid > unpaid
        if (a.paid !== b.paid) return a.paid ? -1 : 1
        // 2. texted > untexted
        const aTexted = !!a.wa_texted_by
        const bTexted = !!b.wa_texted_by
        if (aTexted !== bTexted) return aTexted ? -1 : 1
        // 3. earliest wins
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      // arr[0] is the most-progressed = canonical. Rest are duplicates.
      for (let i = 1; i < arr.length; i++) dups.add(arr[i].reg_id)
    }
    return dups
  }, [rows])
  const duplicateCount = duplicateRegIds.size

  // ── Per-event count lookup (memoised) ────────────────────────────────
  // The Events tab table used to do this PER EVENT ROW, inside .map(),
  // inside render — three full passes over `rows` for each event. With
  // 13 events and ~500 regs that's ~20K filter ops on every render,
  // and the tab re-renders on every keystroke / sort toggle / realtime
  // update.
  //
  // Now: one O(rows) pass builds a Map<event_id, {regs, texted, paid}>
  // and we look it up O(1) per event. Memoised on `rows` +
  // `duplicateRegIds` so typing in unrelated inputs doesn't trigger
  // recomputation. Net: ~20K filter ops → ~500 array iterations per
  // render of the Events tab. At our scale, table renders go from
  // hundreds-of-ms to under 16ms.
  const eventCountsByEventId = useMemo(() => {
    const map = new Map<string, { regs: number; texted: number; paid: number }>()
    for (const r of rows) {
      if (duplicateRegIds.has(r.reg_id)) continue
      const cur = map.get(r.event_id) ?? { regs: 0, texted: 0, paid: 0 }
      cur.regs += 1
      if (r.wa_texted_by) cur.texted += 1
      if (r.paid) cur.paid += 1
      map.set(r.event_id, cur)
    }
    return map
  }, [rows, duplicateRegIds])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    // Fuzzy match: a query matches a haystack if either
    //   (a) it's a plain substring (fast path — "kris" matches "krishna"), or
    //   (b) every character of the query appears in the haystack in the same
    //       order with arbitrary gaps in between ("krsn" → "krishna" → ok;
    //       "krsx" → "krishna" → not ok).
    // This is the same algorithm VS Code / Sublime / fzf use for command
    // palette filtering. Cheap, no dependency, tolerates typos and
    // abbreviations. Phone numbers and reg IDs hit the substring fast path
    // so they behave exactly as before.
    const fuzzy = (needle: string, hay: string): boolean => {
      if (!needle) return true
      if (hay.includes(needle)) return true
      let ni = 0
      for (let hi = 0; hi < hay.length && ni < needle.length; hi++) {
        if (hay[hi] === needle[ni]) ni++
      }
      return ni === needle.length
    }

    const base = rows.filter((r) => {
      if (eventFilter !== 'all' && r.event_id !== eventFilter) return false
      if (statusFilter === 'paid' && !r.paid) return false
      if (statusFilter === 'unpaid' && r.paid) return false
      if (statusFilter === 'attended' && !r.attended) return false
      // "duplicates" filter: show ONLY rows flagged as duplicates so
      // admins can review them in isolation. Excludes the canonical
      // first registration from each duplicate group.
      if (statusFilter === 'duplicates' && !duplicateRegIds.has(r.reg_id)) return false
      if (q) {
        // email + school are nullable as of the form refresh — defend against
        // historical rows that still have values AND new rows where both are
        // null. Coerce every search target to a string first.
        const hay = [r.name, r.school, r.phone, r.email, r.reg_id]
          .map((v) => (v ?? '').toString().toLowerCase())
        if (!hay.some((s) => fuzzy(q, s))) return false
      }
      return true
    })

    // Sort — performed AFTER filter so the comparator only sees rows we'll
    // actually render. Default `newest` mirrors the pre-sort behaviour.
    // Sort is stable-ish: each comparator returns 0 for ties so React-Aria
    // chronological order survives within a group (i.e. uncalled-first puts
    // every uncalled row before every called row, but within each group
    // rows keep their natural newest-first order).
    const sorted = [...base]
    const byCreatedDesc = (a: RegRow, b: RegRow) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    if (sortMode === 'newest') sorted.sort(byCreatedDesc)
    if (sortMode === 'oldest') sorted.sort((a, b) => -byCreatedDesc(a, b))
    if (sortMode === 'uncalled') sorted.sort((a, b) => {
      const ax = a.called_by ? 1 : 0
      const bx = b.called_by ? 1 : 0
      return ax - bx || byCreatedDesc(a, b)
    })
    if (sortMode === 'untexted') sorted.sort((a, b) => {
      const ax = a.wa_texted_by ? 1 : 0
      const bx = b.wa_texted_by ? 1 : 0
      return ax - bx || byCreatedDesc(a, b)
    })
    return sorted
  }, [rows, search, eventFilter, statusFilter, sortMode, duplicateRegIds])

  const filteredUpdates = useMemo(() => {
    return updateTagFilter === 'all' ? updates : updates.filter((u) => u.tag === updateTagFilter)
  }, [updates, updateTagFilter])

  const filteredScores = useMemo(() => {
    return scoreEventFilter === 'all' ? scores : scores.filter((s) => s.event_id === scoreEventFilter)
  }, [scores, scoreEventFilter])

  const filteredVolunteers = useMemo(() => {
    return volStatusFilter === 'all'
      ? volunteers
      : volunteers.filter((v) => v.status === volStatusFilter)
  }, [volunteers, volStatusFilter])

  const filteredWinners = useMemo(() => {
    return winnerEventFilter === 'all'
      ? winners
      : winners.filter((w) => w.event_id === winnerEventFilter)
  }, [winners, winnerEventFilter])

  const filteredBlogPosts = useMemo(() => {
    return blogTagFilter === 'all' ? blogPosts : blogPosts.filter((b) => b.tag === blogTagFilter)
  }, [blogPosts, blogTagFilter])

  const filteredAudit = useMemo(() => {
    return auditLog.filter((a) => {
      if (auditActionFilter !== 'all' && a.action !== auditActionFilter) return false
      if (auditResourceFilter !== 'all' && a.resource !== auditResourceFilter) return false
      return true
    })
  }, [auditLog, auditActionFilter, auditResourceFilter])

  const auditActions = useMemo(() => Array.from(new Set(auditLog.map((a) => a.action))), [auditLog])
  const auditResources = useMemo(() => Array.from(new Set(auditLog.map((a) => a.resource).filter(Boolean))), [auditLog])

  const checkinResults = useMemo(() => {
    if (checkinSearch.trim().length < 3) return []
    const q = checkinSearch.toLowerCase()
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.reg_id.toLowerCase().includes(q),
    )
  }, [rows, checkinSearch])

  // ---- actions: registrations ----
  const markPaid = async (reg_id: string) => {
    // Belt-and-braces — even if the UI accidentally rendered the button,
    // bail before the DB write if this admin doesn't carry mark_paid.
    if (!canMarkPaid) {
      toastError('Not allowed', 'You need the "Mark as Paid" permission to do this.')
      return
    }
    if (!confirm('Mark this registration as paid?')) return
    // `.select()` so an RLS-blocked (or otherwise no-op) write surfaces as a
    // real error instead of silently doing nothing.
    const { data: paidRows, error: err } = await supabase.from('paradox_registrations').update({ paid: true }).eq('reg_id', reg_id).select('reg_id')
    if (err) { toastError('Update failed', err.message); return }
    if (!paidRows || paidRows.length === 0) { toastError('Update failed', 'No matching registration — you may not have permission.'); return }
    setRows((rs) => rs.map((r) => (r.reg_id === reg_id ? { ...r, paid: true } : r)))
    success('Marked as paid')
    logAudit('mark_paid', 'registration', reg_id)
  }
  // Reverse of markPaid — used when an admin needs to undo (refund, wrong
  // person, accidental click). Also clears `attended` to keep the state
  // machine sane: you can't be checked-in for an event you haven't paid for.
  const markUnpaid = async (reg_id: string) => {
    if (!canMarkPaid) {
      toastError('Not allowed', 'You need the "Mark as Paid" permission to do this.')
      return
    }
    const r = rows.find((x) => x.reg_id === reg_id)
    const wasAttended = !!r?.attended
    const warn = wasAttended
      ? `Mark this registration as UNPAID?\n\nThis will also un-check-in ${r?.name ?? 'them'} since you can't be checked in without payment.`
      : 'Mark this registration as UNPAID?'
    if (!confirm(warn)) return
    const { data: unpaidRows, error: err } = await supabase
      .from('paradox_registrations')
      .update({ paid: false, attended: false })
      .eq('reg_id', reg_id)
      .select('reg_id')
    if (err) { toastError('Update failed', err.message); return }
    if (!unpaidRows || unpaidRows.length === 0) { toastError('Update failed', 'No matching registration — you may not have permission.'); return }
    setRows((rs) => rs.map((x) => (x.reg_id === reg_id ? { ...x, paid: false, attended: false } : x)))
    success('Marked as unpaid', wasAttended ? `${r?.name} also un-checked-in` : undefined)
    logAudit('mark_unpaid', 'registration', reg_id, { was_attended: wasAttended })
  }
  const markAttended = async (reg_id: string) => {
    const r = rows.find((x) => x.reg_id === reg_id)
    if (!r?.paid) {
      warning('Cannot check in', 'Mark registration as paid first')
      return
    }
    const { data: attendedRows, error: err } = await supabase.from('paradox_registrations').update({ attended: true }).eq('reg_id', reg_id).select('reg_id')
    if (err) { toastError('Check-in failed', err.message); return }
    if (!attendedRows || attendedRows.length === 0) { toastError('Check-in failed', 'No matching registration — you may not have permission.'); return }
    setRows((rs) => rs.map((r) => (r.reg_id === reg_id ? { ...r, attended: true } : r)))
    success('Checked in!', r.name)
    logAudit('mark_attended', 'registration', reg_id)
  }
  const saveNotes = async (reg_id: string, n: string) => {
    const { data: noteRows, error } = await supabase.from('paradox_registrations').update({ notes: n }).eq('reg_id', reg_id).select('reg_id')
    if (error) {
      // Surface the failure — silently dropping notes makes the input look
      // like it's bugged when really RLS / a column constraint rejected.
      toastError("Couldn't save notes", error.message)
      return
    }
    if (!noteRows || noteRows.length === 0) {
      toastError("Couldn't save notes", 'No matching registration — you may not have permission.')
      return
    }
    setRows((rs) => rs.map((r) => (r.reg_id === reg_id ? { ...r, notes: n } : r)))
    logAudit('edit_notes', 'registration', reg_id, { notes: n.slice(0, 80) })
  }

  // Records who from the admin team texted this registrant on WhatsApp.
  // Passing `null` (or an empty string we coerce to null) marks the row
  // as not-yet-texted, which unchecks the box in the UI.
  const saveTextedBy = async (reg_id: string, value: string | null) => {
    const next = value && value.trim().length > 0 ? value.trim() : null
    const { data: textedRows, error } = await supabase
      .from('paradox_registrations')
      .update({ wa_texted_by: next })
      .eq('reg_id', reg_id)
      .select('reg_id')
    if (error) {
      toastError("Couldn't save 'texted by'", error.message)
      return
    }
    if (!textedRows || textedRows.length === 0) {
      toastError("Couldn't save 'texted by'", 'No matching registration — you may not have permission.')
      return
    }
    setRows((rs) => rs.map((r) => (r.reg_id === reg_id ? { ...r, wa_texted_by: next } : r)))
    setTextedBy((m) => ({ ...m, [reg_id]: next ?? '' }))
    logAudit('edit_texted_by', 'registration', reg_id, { value: next })
  }

  // Records who from the admin team phone-called this registrant. Mirrors
  // saveTextedBy 1:1 — same null-vs-string semantics, same audit shape.
  // See scripts/paradox_add_called_by.sql for the column migration.
  const saveCalledBy = async (reg_id: string, value: string | null) => {
    const next = value && value.trim().length > 0 ? value.trim() : null
    const { data: calledRows, error } = await supabase
      .from('paradox_registrations')
      .update({ called_by: next })
      .eq('reg_id', reg_id)
      .select('reg_id')
    if (error) {
      toastError("Couldn't save 'called by'", error.message)
      return
    }
    if (!calledRows || calledRows.length === 0) {
      toastError("Couldn't save 'called by'", 'No matching registration — you may not have permission.')
      return
    }
    setRows((rs) => rs.map((r) => (r.reg_id === reg_id ? { ...r, called_by: next } : r)))
    setCalledBy((m) => ({ ...m, [reg_id]: next ?? '' }))
    logAudit('edit_called_by', 'registration', reg_id, { value: next })
  }

  // ── After-party handlers ──────────────────────────────────────────────

  // Resolve the active single-ticket thank-you template — DB-backed
  // value wins, default covers the fresh-install case. Stored as a
  // plain string in paradox_site_settings.value (jsonb column accepts
  // string values).
  const apThankYouTemplate: string = (() => {
    const v = siteSettings.find((s) => s.key === AFTERPARTY_THANKYOU_KEY)?.value
    return typeof v === 'string' && v.trim().length > 0 ? v : AFTERPARTY_THANKYOU_DEFAULT
  })()

  // Multi-ticket template — used when admin selects ≥2 rows and copies
  // a consolidated message. Same DB-row lookup pattern as the single
  // template, separate setting key.
  const apThankYouMultiTemplate: string = (() => {
    const v = siteSettings.find((s) => s.key === AFTERPARTY_THANKYOU_MULTI_KEY)?.value
    return typeof v === 'string' && v.trim().length > 0 ? v : AFTERPARTY_THANKYOU_MULTI_DEFAULT
  })()

  // Compose the personalised thank-you message from the template.
  // Returns a single-ticket message when `regs.length === 1`, otherwise
  // a consolidated multi-ticket message using the multi template.
  const composeThankYou = (regs: AfterPartyReg[]): string => {
    if (regs.length === 0) return ''
    if (regs.length === 1) {
      const reg = regs[0]
      const phaseLabel = apPhases.find((p) => p.key === reg.phase)?.label ?? reg.phase
      return apThankYouTemplate
        .replace(/\{name\}/g, reg.name)
        .replace(/\{ap_id\}/g, reg.ap_id)
        .replace(/\{phase\}/g, phaseLabel)
        .replace(/\{amount\}/g, String(reg.amount ?? ''))
    }
    // Multi: build the names "A, B & C" join + the bullet list + total.
    const names = regs.map((r) => r.name)
    const namesJoined =
      names.length === 2 ? `${names[0]} & ${names[1]}` :
      names.length > 2  ? `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}` :
      names[0]
    const tickets = regs.map((r) => {
      const phaseLabel = apPhases.find((p) => p.key === r.phase)?.label ?? r.phase
      return `• ${r.name} — ${r.ap_id} (${phaseLabel}, ₹${r.amount ?? '?'})`
    }).join('\n')
    const total = regs.reduce((sum, r) => sum + (r.amount ?? 0), 0)
    return apThankYouMultiTemplate
      .replace(/\{names\}/g, namesJoined)
      .replace(/\{tickets\}/g, tickets)
      .replace(/\{total\}/g, total.toLocaleString('en-IN'))
      .replace(/\{count\}/g, String(regs.length))
  }

  // Copy the thank-you message text to the clipboard. No image any more —
  // after-party tickets are text-only (the AP-ID is what matters; admins
  // search for it at the door using the existing table search).
  const copyTicketToClipboard = async (regs: AfterPartyReg[]): Promise<'ok' | 'failed'> => {
    const message = composeThankYou(regs)
    try {
      await navigator.clipboard.writeText(message)
      return 'ok'
    } catch (err) {
      console.warn('[Admin] copyTicketToClipboard failed', err)
      return 'failed'
    }
  }

  // Add a new after-party registration. ap_id is now a random
  // 4-character code (AP-XXXX) from a no-confusion alphabet — drops
  // 0/1/I/O/L so admins won't misread a printed ticket. ~614K possible
  // IDs; collision retries up to 5 times before surfacing the error.
  const addAfterPartyReg = async (opts: { cashWalkIn?: boolean } = {}) => {
    const { cashWalkIn = false } = opts
    const name = apForm.name.trim()
    const phone = apForm.phone.trim()
    if (!name || !phone) {
      toastError('Missing fields', 'Name and phone are required')
      return
    }
    const phaseInfo = apPhases.find((p) => p.key === apForm.phase)
    setApAdding(true)
    let inserted: AfterPartyReg | null = null
    let lastError: { code?: string; message?: string } | null = null
    // Retry loop — if Postgres returns a unique-violation (23505) on
    // ap_id, generate a fresh ID and try again. Cap at 5 to avoid
    // infinite spinning if the table somehow has a different conflict.
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      const ap_id = generateApId()
      const { data, error } = await supabase
        .from('paradox_afterparty_registrations')
        .insert({
          ap_id,
          name,
          phone,
          school: apForm.school.trim() || null,
          phase: apForm.phase,
          amount: phaseInfo?.amount ?? null,
          paid: true,
          // Cash walk-in: they paid cash and are walking in right now, so
          // stamp 'cash' in notes (highlights at the door) and check them
          // in immediately.
          attended: cashWalkIn,
          notes: cashWalkIn ? 'cash' : null,
          created_by: session?.user?.email ?? null,
        })
        .select()
        .single()
      if (data) {
        inserted = data as AfterPartyReg
        break
      }
      lastError = (error as any) ?? { message: 'Unknown insert failure' }
      // 23505 = unique_violation. Only retry that; anything else (RLS,
      // schema mismatch, network) bubbles up immediately. Defensive:
      // if no error code at all, stop the loop so we don't spin.
      if (!error || (error as any).code !== '23505') break
    }
    setApAdding(false)
    if (!inserted) {
      const errMsg = lastError?.message ?? 'Unknown error'
      // Detect the legacy DB CHECK constraint that locks `phase` to the
      // original 4 keys. If we're trying to insert a custom phase
      // (anything beyond the 4 defaults) and Postgres bounces it, the
      // user needs to run the relax-constraint migration first. Give
      // them a clear pointer rather than the raw "check constraint
      // violated" gibberish.
      const isPhaseCheck =
        errMsg.toLowerCase().includes('paradox_afterparty_registrations_phase') ||
        (errMsg.toLowerCase().includes('check constraint') && errMsg.toLowerCase().includes('phase'))
      if (isPhaseCheck) {
        toastError(
          'Phase blocked at DB level',
          'Run scripts/paradox_afterparty_phase_open_constraint.sql in the Paradox Supabase SQL editor to allow custom phase keys.'
        )
      } else {
        toastError("Couldn't add registration", errMsg)
      }
      return
    }
    const data = inserted
    setApRegs((prev) => [data, ...prev])
    setApForm({ name: '', phone: '', school: '', phase: apForm.phase })
    if (cashWalkIn) {
      // Walk-in is already paid + checked in; no WA message needed, so
      // don't auto-select it for the consolidated-message bundle.
      logAudit('ap_add_cash_walkin', 'afterparty_registration', data.id, { ap_id: data.ap_id, name })
      success('Checked in', `${data.name} → ${data.ap_id} · cash · ✓ in`)
    } else {
      // Auto-add the new row to the selection so admins building a batch
      // for one customer don't have to manually check boxes. Then they
      // hit "Copy message for N" once at the end.
      setApSelected((prev) => {
        const next = new Set(prev)
        next.add(data.id)
        return next
      })
      logAudit('ap_add', 'afterparty_registration', data.id, { ap_id: data.ap_id, name })
      // Toast — no auto-copy here. Admins decide when to copy via the
      // selection bar so a multi-ticket booking yields ONE message.
      success('Logged', `${data.name} → ${data.ap_id}. Select & copy when ready.`)
    }
  }

  // Toggle the attended flag on an after-party registration (door scan).
  const toggleApAttended = async (r: AfterPartyReg, next: boolean) => {
    // Guard: warn before checking in someone who hasn't paid. Door staff
    // can still proceed (they decide), but it shouldn't be a silent wave-
    // through. No guard on un-checking.
    if (next && !r.paid) {
      if (!confirm(`${r.name} is marked UNPAID.\n\nCheck them in anyway?`)) return
    }
    const { data: apAttendedRows, error } = await supabase
      .from('paradox_afterparty_registrations')
      .update({ attended: next })
      .eq('id', r.id)
      .select('id')
    if (error) { toastError('Update failed', error.message); return }
    if (!apAttendedRows || apAttendedRows.length === 0) { toastError('Update failed', 'No matching registration — you may not have permission.'); return }
    setApRegs((prev) => prev.map((x) => (x.id === r.id ? { ...x, attended: next } : x)))
    // Track the latest check-in for the undo affordance. On un-check, clear
    // the slot only if it was this same row (other check-ins still stand).
    if (next) setApLastCheckIn({ ...r, attended: true })
    else setApLastCheckIn((cur) => (cur && cur.id === r.id ? null : cur))
    logAudit(next ? 'ap_mark_attended' : 'ap_mark_unattended', 'afterparty_registration', r.id)
  }

  // Generic partial-update handler for an after-party row. Used by the
  // edit modal, the inline notes input, and any future per-field tweaks.
  // Optimistically updates local state then reverts on DB error.
  const updateApReg = async (id: string, patch: Partial<AfterPartyReg>): Promise<boolean> => {
    const prev = apRegs.find((r) => r.id === id)
    if (!prev) return false
    // If phase changed but amount wasn't explicitly set, auto-fill it
    // from the phase pricing table so the row stays internally consistent.
    if (patch.phase && patch.amount === undefined) {
      const phaseInfo = apPhases.find((p) => p.key === patch.phase)
      if (phaseInfo) patch.amount = phaseInfo.amount
    }
    setApRegs((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)))
    const { data: apUpdateRows, error } = await supabase
      .from('paradox_afterparty_registrations')
      .update(patch)
      .eq('id', id)
      .select('id')
    if (error || !apUpdateRows || apUpdateRows.length === 0) {
      // Rollback the optimistic update so the UI matches the DB
      setApRegs((list) => list.map((r) => (r.id === id ? prev : r)))
      toastError("Couldn't save", error?.message ?? 'No matching registration — you may not have permission.')
      return false
    }
    logAudit('ap_update', 'afterparty_registration', id, { fields: Object.keys(patch) })
    return true
  }

  const saveApNotes = async (r: AfterPartyReg, v: string) => {
    const next = v.trim() || null
    if ((r.notes ?? null) === next) return // no-op
    await updateApReg(r.id, { notes: next })
  }

  // Hard-delete (mis-entries / refunds). Confirmation includes name + ap_id
  // so admins can't fat-finger the wrong row.
  const deleteApReg = async (r: AfterPartyReg) => {
    const ok = confirm(`Delete after-party registration?\n\n${r.name} (${r.ap_id})`)
    if (!ok) return
    const { data: apDeleteRows, error } = await supabase
      .from('paradox_afterparty_registrations')
      .delete()
      .eq('id', r.id)
      .select('id')
    if (error) { toastError('Delete failed', error.message); return }
    if (!apDeleteRows || apDeleteRows.length === 0) { toastError('Delete failed', 'No matching registration — you may not have permission.'); return }
    setApRegs((prev) => prev.filter((x) => x.id !== r.id))
    // Also drop from selection so the sticky bar count stays accurate.
    // Without this, deleting a selected row leaves a stale id in the
    // Set — harmless (compose path re-filters against apRegs) but
    // shows as "selected" until cleared.
    setApSelected((prev) => {
      if (!prev.has(r.id)) return prev
      const next = new Set(prev)
      next.delete(r.id)
      return next
    })
    logAudit('ap_delete', 'afterparty_registration', r.id, { ap_id: r.ap_id, name: r.name })
  }

  // CSV export — Excel-friendly column order. Matches the on-screen
  // table so admins can cross-reference rows visually.
  const exportApCSV = () => {
    const visible = apRegs.filter((r) => {
      if (!apSearch.trim()) return true
      const q = apSearch.toLowerCase()
      return (
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        (r.school ?? '').toLowerCase().includes(q) ||
        r.ap_id.toLowerCase().includes(q)
      )
    })
    const headers = ['#', 'AP ID', 'Name', 'Phone', 'School', 'Phase', 'Amount', 'Paid', 'Attended', 'Added by', 'Added at', 'Notes']
    const csv = [
      headers.join(','),
      ...visible.map((r, i) =>
        [
          i + 1,
          r.ap_id,
          `"${r.name.replace(/"/g, '""')}"`,
          r.phone,
          `"${(r.school ?? '').replace(/"/g, '""')}"`,
          r.phase,
          r.amount ?? '',
          r.paid,
          r.attended,
          r.created_by ?? '',
          new Date(r.created_at).toISOString(),
          `"${(r.notes ?? '').replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `paradox-afterparty-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    logAudit('ap_export_csv', 'afterparty_registration', 'bulk', { rows: visible.length })
  }

  // Hard-delete a registration. Used for fraudulent / test / duplicate rows.
  // Confirmation prompt is intentionally specific (uses the participant name
  // + reg_id) to prevent accidental deletes on a long admin table. Audit log
  // captures the deleted row so we have a paper trail.
  const deleteRegistration = async (r: RegRow) => {
    const ok = confirm(
      `Permanently delete this registration?\n\n` +
      `Name: ${r.name}\n` +
      `Reg ID: ${r.reg_id}\n` +
      `Event: ${r.event_name ?? '—'}\n\n` +
      `This cannot be undone. If they've already paid, refund them first.`
    )
    if (!ok) return
    const { data: deletedRegRows, error: err } = await supabase
      .from('paradox_registrations')
      .delete()
      .eq('reg_id', r.reg_id)
      .select('reg_id')
    if (err) { toastError('Delete failed', err.message); return }
    if (!deletedRegRows || deletedRegRows.length === 0) { toastError('Delete failed', 'No matching registration — you may not have permission.'); return }
    setRows((rs) => rs.filter((x) => x.reg_id !== r.reg_id))
    success('Registration deleted', r.name)
    logAudit('delete_registration', 'registration', r.reg_id, {
      name: r.name,
      reg_id: r.reg_id,
      event_name: r.event_name,
      paid: r.paid,
      attended: r.attended,
    })
  }

  const exportCSV = () => {
    // Includes team_members so venue staff get the full roster for duo
    // events. `team_members` is JSON: `[{ name, phone }]` for duos; serialise
    // as a readable "Name (phone) | Name (phone)" string for the CSV cell.
    const headers = ['#', 'Reg ID', 'Name', 'School', 'Class', 'Phone', 'Email', 'Event', 'Team Name', 'Team Members', 'Headcount', 'Paid', 'Attended', 'Texted on WA by', 'Called by', 'Notes']
    const fmtMembers = (tm: any): string => {
      if (!Array.isArray(tm) || tm.length === 0) return ''
      return tm.map((m: any) => {
        const name = (m?.name ?? '').toString().trim()
        const phone = (m?.phone ?? '').toString().trim()
        return phone ? `${name} (${phone})` : name
      }).filter(Boolean).join(' | ')
    }
    const csv = [
      headers.join(','),
      ...filtered.map((r, i) =>
        [
          i + 1,
          r.reg_id,
          `"${r.name}"`,
          `"${r.school ?? ''}"`,
          r.class_year ?? '',
          r.phone,
          r.email ?? '',
          `"${r.event_name}"`,
          `"${(r.team_name ?? '').replace(/"/g, '""')}"`,
          `"${fmtMembers(r.team_members).replace(/"/g, '""')}"`,
          (r as any).member_count ?? 1,
          r.paid,
          r.attended,
          `"${(r.wa_texted_by ?? '').replace(/"/g, '""')}"`,
          `"${(r.called_by ?? '').replace(/"/g, '""')}"`,
          `"${(r.notes ?? '').replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = `paradox-registrations-${Date.now()}.csv`
    a.click()
    logAudit('export_csv', 'registration', 'bulk', { rows: filtered.length, filters: { eventFilter, statusFilter } })
  }

  // ---- actions: updates ----
  const postUpdate = async () => {
    if (!newUpdate.title.trim() || !newUpdate.body.trim()) {
      warning('Missing fields', 'Title and body are required')
      return
    }
    setPostingUpdate(true)
    const { data, error: err } = await supabase
      .from('paradox_updates')
      .insert({ ...newUpdate, event_name: newUpdate.event_name || null })
      .select('id')
      .single()
    if (err) { toastError('Post failed', err.message); setPostingUpdate(false); return }
    if (data) {
      setUpdates((u) => [
        {
          id: data.id,
          ...newUpdate,
          event_name: newUpdate.event_name || null,
          created_at: new Date().toISOString(),
        } as any,
        ...u,
      ])
      success('Update posted', newUpdate.title)
      logAudit('post_update', 'update', data.id, { title: newUpdate.title })
      setNewUpdate({ title: '', body: '', event_name: '', tag: 'announcement', pinned: false })
      setShowNewUpdate(false)
    }
    setPostingUpdate(false)
  }
  // Hard-delete an update post. Spell-out confirm (title + tag + event) so
  // an admin scrolling a long table doesn't nuke the wrong row on a misclick.
  // Audit log captures the row's identity for the paper trail.
  const deleteUpdate = async (u: Update) => {
    const bodyPreview = (u.body ?? '').replace(/\s+/g, ' ').slice(0, 80)
    const ok = confirm(
      `Permanently delete this update?\n\n` +
      `Title: ${u.title}\n` +
      `Tag:   ${u.tag}\n` +
      `Event: ${u.event_name ?? '—'}\n` +
      (bodyPreview ? `Body:  ${bodyPreview}${(u.body ?? '').length > 80 ? '…' : ''}\n\n` : '\n') +
      `This cannot be undone.`
    )
    if (!ok) return
    const { data: deletedUpdateRows, error: err } = await supabase.from('paradox_updates').delete().eq('id', u.id).select('id')
    if (err) { toastError('Delete failed', err.message); return }
    if (!deletedUpdateRows || deletedUpdateRows.length === 0) { toastError('Delete failed', 'No matching update — you may not have permission.'); return }
    setUpdates((us) => us.filter((x) => x.id !== u.id))
    success('Update deleted', u.title)
    logAudit('delete_update', 'update', u.id, {
      title: u.title,
      tag: u.tag,
      event_name: u.event_name,
      pinned: u.pinned,
    })
  }
  const pinUpdate = async (id: string, pinned: boolean) => {
    const { data: pinRows, error: err } = await supabase.from('paradox_updates').update({ pinned }).eq('id', id).select('id')
    if (err) { toastError('Update failed', err.message); return }
    if (!pinRows || pinRows.length === 0) { toastError('Update failed', 'No matching update — you may not have permission.'); return }
    setUpdates((u) => u.map((x) => (x.id === id ? { ...x, pinned } : x)))
    logAudit(pinned ? 'pin_update' : 'unpin_update', 'update', id)
  }

  // ---- actions: inquiries ----
  const updateInquiry = async (id: string, patch: Partial<Inquiry>) => {
    const { data: inquiryRows, error } = await supabase.from('paradox_inquiries').update(patch).eq('id', id).select('id')
    if (error) {
      toastError("Couldn't update inquiry", error.message)
      return
    }
    if (!inquiryRows || inquiryRows.length === 0) {
      toastError("Couldn't update inquiry", 'No matching inquiry — you may not have permission.')
      return
    }
    setInquiries((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)))
    logAudit('update_inquiry', 'inquiry', id, patch)
  }

  // ---- actions: scores ----
  const postScore = async () => {
    if (!newScore.event_id || !newScore.team_name || !newScore.school) {
      warning('Missing fields', 'Event, team name, and school are all required')
      return
    }
    setPostingScore(true)
    const payload = {
      event_id: newScore.event_id,
      event_name: newScore.event_name,
      team_name: newScore.team_name,
      school: newScore.school,
      score: newScore.score || null,
      position: newScore.position ? parseInt(newScore.position) : null,
      round: newScore.round,
      notes: null,
    }
    // `.insert(...).select('id').single()` round-trips the inserted row's
    // ID so we can append it to local state. This pattern relies on the
    // SELECT policy on paradox_scores letting the inserting admin read
    // what they just wrote — currently true for admin role. If SELECT
    // is ever tightened past INSERT (e.g. "only directors can read"),
    // this returns a PGRST116 "no rows" error even though the insert
    // succeeded; future maintainers should fall back to a synthetic ID
    // and skip the select-back in that case. Same pattern below in
    // paradox_winners / paradox_blog_posts / paradox_events.
    const { data, error: err } = await supabase.from('paradox_scores').insert(payload).select('id').single()
    if (err) { toastError('Save failed', err.message); setPostingScore(false); return }
    if (data) {
      setScores((s) => [
        ...s,
        { id: data.id, ...payload, created_at: new Date().toISOString() } as any,
      ])
      success('Score saved', newScore.team_name)
      logAudit('post_score', 'score', data.id, { team: newScore.team_name })
      setNewScore({
        event_id: '',
        event_name: '',
        team_name: '',
        school: '',
        score: '',
        position: '',
        round: 'Finals',
      })
      setShowNewScore(false)
    }
    setPostingScore(false)
  }
  const deleteScore = async (id: string) => {
    if (!confirm('Delete this score entry?')) return
    const { data: deletedScoreRows, error: err } = await supabase.from('paradox_scores').delete().eq('id', id).select('id')
    if (err) { toastError('Delete failed', err.message); return }
    if (!deletedScoreRows || deletedScoreRows.length === 0) { toastError('Delete failed', 'No matching score — you may not have permission.'); return }
    setScores((s) => s.filter((x) => x.id !== id))
    success('Score deleted')
    logAudit('delete_score', 'score', id)
  }
  const updateScoreField = async (id: string, field: string, value: string) => {
    const parsed: any = field === 'position' ? (value ? parseInt(value) : null) : value || null
    const prev = scores.find((x) => x.id === id)
    setScores((s) => s.map((x) => (x.id === id ? { ...x, [field]: parsed } : x)))
    const { data: scoreFieldRows, error: err } = await supabase.from('paradox_scores').update({ [field]: parsed }).eq('id', id).select('id')
    if (err || !scoreFieldRows || scoreFieldRows.length === 0) {
      toastError('Save failed', err?.message ?? 'No matching score — you may not have permission.')
      if (prev) setScores((s) => s.map((x) => (x.id === id ? prev : x)))
      return
    }
    success('Score saved')
    logAudit('edit_score_field', 'score', id, { field, value: parsed })
  }

  // ---- actions: volunteers ----
  const updateVolunteer = async (id: string, patch: any) => {
    const { data: volunteerRows, error: err } = await supabase.from('paradox_volunteers').update(patch).eq('id', id).select('id')
    if (err) { toastError('Update failed', err.message); return }
    if (!volunteerRows || volunteerRows.length === 0) { toastError('Update failed', 'No matching volunteer — you may not have permission.'); return }
    setVolunteers((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    logAudit('update_volunteer', 'volunteer', id, patch)
  }

  // ---- actions: winners ----
  const postWinner = async () => {
    if (!newWinner.event_id || !newWinner.winner_name) {
      warning('Missing fields', 'Event and winner name are required')
      return
    }
    setPostingWinner(true)
    const payload = {
      event_id: newWinner.event_id,
      event_name: newWinner.event_name,
      rank: parseInt(newWinner.rank),
      winner_name: newWinner.winner_name,
      school: newWinner.school || null,
      prize: newWinner.prize || null,
      photo_url: newWinner.photo_url || null,
      published: newWinner.published,
      published_at: newWinner.published ? new Date().toISOString() : null,
    }
    const { data, error: err } = await supabase.from('paradox_winners').insert(payload).select('id').single()
    if (err) { toastError('Save failed', err.message); setPostingWinner(false); return }
    if (data) {
      setWinners((w) => [
        ...w,
        { id: data.id, ...payload, created_at: new Date().toISOString() },
      ])
      success('Winner saved', newWinner.winner_name)
      logAudit('post_winner', 'winner', data.id, { name: newWinner.winner_name })
      setNewWinner({
        event_id: '',
        event_name: '',
        rank: '1',
        winner_name: '',
        school: '',
        prize: '',
        photo_url: '',
        published: false,
      })
      setShowNewWinner(false)
    }
    setPostingWinner(false)
  }
  const updateWinner = async (id: string, patch: any) => {
    const { data: winnerRows, error: err } = await supabase.from('paradox_winners').update(patch).eq('id', id).select('id')
    if (err) { toastError('Save failed', err.message); return }
    if (!winnerRows || winnerRows.length === 0) { toastError('Save failed', 'No matching winner — you may not have permission.'); return }
    setWinners((w) => w.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    logAudit('update_winner', 'winner', id, patch)
  }
  const deleteWinner = async (id: string) => {
    if (!confirm('Delete this winner entry?')) return
    const { data: deletedWinnerRows, error: err } = await supabase.from('paradox_winners').delete().eq('id', id).select('id')
    if (err) { toastError('Delete failed', err.message); return }
    if (!deletedWinnerRows || deletedWinnerRows.length === 0) { toastError('Delete failed', 'No matching winner — you may not have permission.'); return }
    setWinners((w) => w.filter((x) => x.id !== id))
    success('Winner deleted')
    logAudit('delete_winner', 'winner', id)
  }
  const toggleWinnerPublished = async (id: string, published: boolean) => {
    const patch = {
      published,
      published_at: published ? new Date().toISOString() : null,
    }
    await updateWinner(id, patch)
  }

  // ---- actions: blog ----
  const postBlog = async () => {
    if (!newBlog.title.trim() || !newBlog.body.trim()) {
      warning('Missing fields', 'Title and body are required')
      return
    }
    setBlogSlugError(null)
    setPostingBlog(true)
    const finalSlug = newBlog.slug.trim() || slugify(newBlog.title)
    // uniqueness check
    const { data: existing } = await supabase
      .from('paradox_blog_posts')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle()
    if (existing) {
      setBlogSlugError('Slug already exists — change the title or edit the slug field.')
      setPostingBlog(false)
      return
    }
    const payload = {
      slug: finalSlug,
      title: newBlog.title,
      excerpt: newBlog.excerpt || null,
      body: newBlog.body,
      author: newBlog.author || null,
      tag: newBlog.tag,
      cover_color: newBlog.cover_color || null,
      published: newBlog.published,
      published_at: newBlog.published ? new Date().toISOString() : null,
      views: 0,
    }
    const { data, error: err } = await supabase.from('paradox_blog_posts').insert(payload).select('id').single()
    if (err) { toastError('Save failed', err.message); setPostingBlog(false); return }
    if (data) {
      setBlogPosts((b) => [
        {
          id: data.id,
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        ...b,
      ])
      success('Post saved', newBlog.title)
      logAudit('post_blog', 'blog_post', data.id, { title: newBlog.title })
      setNewBlog({
        slug: '',
        title: '',
        excerpt: '',
        body: '',
        author: '',
        tag: 'announcement',
        cover_color: 'ink',
        published: false,
      })
      setShowNewBlog(false)
    }
    setPostingBlog(false)
  }
  const toggleBlogPublished = async (id: string, published: boolean) => {
    const patch = {
      published,
      published_at: published ? new Date().toISOString() : null,
    }
    const { data: blogPatchRows, error: err } = await supabase.from('paradox_blog_posts').update(patch).eq('id', id).select('id')
    if (err) { toastError('Save failed', err.message); return }
    if (!blogPatchRows || blogPatchRows.length === 0) { toastError('Save failed', 'No matching post — you may not have permission.'); return }
    setBlogPosts((b) => b.map((x) => (x.id === id ? { ...x, ...patch } : x)))
    info(published ? 'Post published' : 'Post unpublished')
    logAudit(published ? 'publish_blog' : 'unpublish_blog', 'blog_post', id)
  }
  const deleteBlog = async (id: string) => {
    if (!confirm('Delete this blog post?')) return
    const { data: deletedBlogRows, error: err } = await supabase.from('paradox_blog_posts').delete().eq('id', id).select('id')
    if (err) { toastError('Delete failed', err.message); return }
    if (!deletedBlogRows || deletedBlogRows.length === 0) { toastError('Delete failed', 'No matching post — you may not have permission.'); return }
    setBlogPosts((b) => b.filter((x) => x.id !== id))
    success('Post deleted')
    logAudit('delete_blog', 'blog_post', id)
  }

  // ---- actions: events ----
  const slugifyEvent = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const openNewEventForm = () => {
    setEditingEvent({
      name: '', slug: '', category: 'sport', active: true,
      date: '', time: '', venue: '',
      fee: null, prize: '', team_format: 'solo',
      min_team_size: 1, max_team_size: 1,
      max_participants: null,
      limited_spots: false,
      description: '', rules: '',
    })
    setShowEventForm(true)
  }

  const openEditEventForm = (ev: any) => {
    setEditingEvent({ ...ev })
    setShowEventForm(true)
  }

  const saveEvent = async () => {
    if (!editingEvent?.name?.trim()) {
      warning('Missing field', 'Event name is required')
      return
    }
    setSavingEvent(true)
    const slug = editingEvent.slug?.trim() || slugifyEvent(editingEvent.name ?? '')
    // Build the base payload (always-safe fields) and the "extra" payload
    // (fields that may not exist in older Paradox DB schemas). If the
    // limited_spots column hasn't been migrated yet
    // (see scripts/paradox_add_limited_spots.sql), PostgREST 400s the whole
    // request — so we retry without it on that specific error.
    const basePayload: any = {
      name: editingEvent.name,
      slug,
      category: editingEvent.category ?? 'sport',
      active: editingEvent.active ?? true,
      date: editingEvent.date || null,
      time: editingEvent.time || null,
      venue: editingEvent.venue || null,
      fee: editingEvent.fee ?? null,
      prize: editingEvent.prize || null,
      team_format: editingEvent.team_format || null,
      min_team_size: editingEvent.min_team_size ?? null,
      max_team_size: editingEvent.max_team_size ?? null,
      max_participants: editingEvent.max_participants ?? null,
      description: editingEvent.description || null,
      rules: editingEvent.rules || null,
    }
    const payload: any = {
      ...basePayload,
      limited_spots: !!editingEvent.limited_spots,
    }

    // PostgREST signals an unknown column with code PGRST204 or a message
    // containing "limited_spots". Match either — covers every error phrasing
    // we've seen ("column does not exist", "could not find the column",
    // "schema cache", future variants).
    const isUnknownLimitedSpots = (err: any) => {
      if (!err) return false
      if (err.code === 'PGRST204') return true
      const msg = String(err.message ?? err.details ?? err.hint ?? '')
      return /limited_spots/i.test(msg)
    }

    let saved = false
    if (editingEvent.id) {
      // update
      let { error } = await supabase.from('paradox_events').update(payload).eq('id', editingEvent.id)
      // Schema fallback: column missing → retry with the base payload only
      if (error && isUnknownLimitedSpots(error)) {
        console.warn('[paradox_events] limited_spots column missing — saving without it. Run scripts/paradox_add_limited_spots.sql to enable.')
        const retry = await supabase.from('paradox_events').update(basePayload).eq('id', editingEvent.id)
        error = retry.error
        if (!error) {
          warning('Saved (limited_spots ignored)', 'Run paradox_add_limited_spots.sql to enable the toggle.')
        }
      }
      if (!error) {
        setEventsFull((prev) => prev.map((e) => e.id === editingEvent.id ? { ...e, ...payload, id: editingEvent.id! } : e))
        // also refresh EventLite list
        setEvents((prev) => prev.map((e) => e.id === editingEvent.id ? { id: editingEvent.id!, name: payload.name } : e))
        success('Event saved', `"${payload.name}" updated`)
        logAudit('update_event', 'event', editingEvent.id, { name: payload.name })
        saved = true
      } else {
        toastError('Save failed', error.message)
      }
    } else {
      // insert
      let { data, error } = await supabase.from('paradox_events').insert(payload).select('*').single()
      if (error && isUnknownLimitedSpots(error)) {
        console.warn('[paradox_events] limited_spots column missing — inserting without it. Run scripts/paradox_add_limited_spots.sql to enable.')
        const retry = await supabase.from('paradox_events').insert(basePayload).select('*').single()
        data = retry.data
        error = retry.error
        if (!error) {
          warning('Created (limited_spots ignored)', 'Run paradox_add_limited_spots.sql to enable the toggle.')
        }
      }
      if (!error && data) {
        setEventsFull((prev) => [...prev, data as any])
        setEvents((prev) => [...prev, { id: data.id, name: data.name }])
        success('Event saved', `"${payload.name}" created`)
        logAudit('create_event', 'event', data.id, { name: payload.name })
        saved = true
      } else if (error) {
        toastError('Save failed', error.message)
      }
    }
    setSavingEvent(false)
    // Only close the form on a successful save — otherwise the user's edits
    // would silently vanish and the failure would feel like the button is broken.
    if (saved) {
      setShowEventForm(false)
      setEditingEvent(null)
    }
  }

  const toggleEventActive = async (id: string, active: boolean) => {
    // Guard against rapid clicks creating a race between two parallel updates
    if (togglingEventId === id) return
    setTogglingEventId(id)
    const { data: eventActiveRows, error: err } = await supabase.from('paradox_events').update({ active }).eq('id', id).select('id')
    if (err || !eventActiveRows || eventActiveRows.length === 0) {
      toastError('Update failed', err?.message ?? 'No matching event — you may not have permission.')
      setTogglingEventId(null)
      return
    }
    setEventsFull((prev) => prev.map((e) => e.id === id ? { ...e, active } : e))
    logAudit(active ? 'activate_event' : 'deactivate_event', 'event', id)
    setTogglingEventId(null)
  }

  // Hard-delete an event. Warns about cascade — if registrations/scores/winners
  // FK to this event with ON DELETE RESTRICT, the DB will reject. We catch the
  // error and surface it to the user rather than swallow it.
  const deleteEvent = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}"?\n\nThis can't be undone. If the event has registrations or scores, the delete will be blocked.`)) return
    const { data: deletedEventRows, error: err } = await supabase.from('paradox_events').delete().eq('id', id).select('id')
    if (err) {
      toastError('Delete failed', err.message.includes('foreign')
        ? 'Event has linked registrations, scores, or winners. Remove those first.'
        : err.message)
      return
    }
    if (!deletedEventRows || deletedEventRows.length === 0) { toastError('Delete failed', 'No matching event — you may not have permission.'); return }
    setEventsFull((prev) => prev.filter((e) => e.id !== id))
    success('Event deleted', name)
    logAudit('delete_event', 'event', id, { name })
  }

  // ---- actions: settings ----
  // Opens the "add new settings key" modal. The actual insert happens in
  // submitNewSettingKey() so the user gets a styled form + validation feedback
  // instead of a native browser prompt() dialog.
  const addSettingsKey = () => {
    setNewSettingKey('')
    setShowAddSettingKey(true)
  }

  const submitNewSettingKey = async () => {
    const key = newSettingKey.trim()
    if (!key) {
      warning('Missing key', 'Enter a settings key in snake_case')
      return
    }
    // Enforce snake_case so keys stay consistent with the existing schema.
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      warning('Invalid format', 'Use lowercase letters, digits, and underscores only (snake_case)')
      return
    }
    if (siteSettings.find((s) => s.key === key)) {
      warning('Key already exists', key)
      return
    }
    const payload = { key, value: {}, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('paradox_site_settings').insert(payload)
    if (error) {
      toastError('Save failed', error.message)
      return
    }
    setSiteSettings((list) => [...list, payload])
    success('Settings key added', key)
    logAudit('add_setting', 'setting', key)
    setShowAddSettingKey(false)
    setNewSettingKey('')
  }

  // ---- actions: team members ----
  // The public /team page reads paradox_team_members. These handlers let
  // admins add/edit/remove rows without touching code.
  const openNewTeamForm = (kind: 'leadership' | 'department') => {
    // Append to the end of the chosen group so the new card lands after the
    // existing ones rather than jumping to the top.
    const existing = teamMembers.filter((t) => t.kind === kind)
    const nextOrder = existing.length === 0
      ? 0
      : Math.max(...existing.map((t) => t.sort_order)) + 1
    setEditingTeam({ kind, name: '', role: '', sort_order: nextOrder, photo_url: null })
    setShowTeamForm(true)
  }

  const openEditTeamForm = (m: TeamMember) => {
    setEditingTeam({ ...m })
    setShowTeamForm(true)
  }

  const saveTeamMember = async () => {
    if (!editingTeam?.name?.trim()) {
      warning('Missing field', 'Name is required')
      return
    }
    if (!editingTeam.kind) {
      warning('Missing field', 'Pick leadership or department')
      return
    }
    setSavingTeam(true)
    const payload = {
      kind: editingTeam.kind,
      name: editingTeam.name.trim(),
      role: editingTeam.role?.trim() || null,
      sort_order: editingTeam.sort_order ?? 0,
      photo_url: editingTeam.photo_url || null,
      updated_at: new Date().toISOString(),
    }
    let saved = false
    if (editingTeam.id) {
      const { error } = await supabase
        .from('paradox_team_members')
        .update(payload)
        .eq('id', editingTeam.id)
      if (error) {
        toastError('Save failed', error.message)
      } else {
        setTeamMembers((prev) =>
          prev.map((m) => (m.id === editingTeam.id ? { ...m, ...payload, id: m.id, created_at: m.created_at } : m)),
        )
        success('Team member saved', `"${payload.name}" updated`)
        logAudit('update_team_member', 'team_member', editingTeam.id, { name: payload.name })
        saved = true
      }
    } else {
      const { data, error } = await supabase
        .from('paradox_team_members')
        .insert(payload)
        .select('*')
        .single()
      if (error || !data) {
        toastError('Save failed', error?.message ?? 'No data returned')
      } else {
        setTeamMembers((prev) => [...prev, data as TeamMember])
        success('Team member added', `"${payload.name}"`)
        logAudit('create_team_member', 'team_member', (data as TeamMember).id, { name: payload.name })
        saved = true
      }
    }
    setSavingTeam(false)
    if (saved) {
      setShowTeamForm(false)
      setEditingTeam(null)
    }
  }

  const deleteTeamMember = async (id: string, name: string) => {
    if (!confirm(`Remove "${name}" from the team?`)) return
    const { error } = await supabase.from('paradox_team_members').delete().eq('id', id)
    if (error) { toastError('Delete failed', error.message); return }
    setTeamMembers((prev) => prev.filter((m) => m.id !== id))
    success('Team member removed', name)
    logAudit('delete_team_member', 'team_member', id, { name })
  }

  // Bump sort_order up or down by swapping with the adjacent row in the same
  // group. Two writes per swap — small enough to not worry about batching.
  const moveTeamMember = async (id: string, direction: 'up' | 'down') => {
    // Guard against rapid clicks that would interleave two swap writes.
    if (movingTeamId) return
    const member = teamMembers.find((m) => m.id === id)
    if (!member) return
    const group = teamMembers
      .filter((m) => m.kind === member.kind)
      .sort((a, b) => a.sort_order - b.sort_order)
    const idx = group.findIndex((m) => m.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= group.length) return
    const other = group[swapIdx]
    // Swap their sort_order values.
    const [a, b] = [member.sort_order, other.sort_order]
    setMovingTeamId(id)
    try {
      const { error: e1 } = await supabase
        .from('paradox_team_members')
        .update({ sort_order: b, updated_at: new Date().toISOString() })
        .eq('id', member.id)
      if (e1) { toastError('Move failed', e1.message); return }
      const { error: e2 } = await supabase
        .from('paradox_team_members')
        .update({ sort_order: a, updated_at: new Date().toISOString() })
        .eq('id', other.id)
      if (e2) { toastError('Move failed', e2.message); return }
      setTeamMembers((prev) =>
        prev.map((m) => {
          if (m.id === member.id) return { ...m, sort_order: b }
          if (m.id === other.id) return { ...m, sort_order: a }
          return m
        }),
      )
      logAudit('reorder_team_member', 'team_member', id, { direction })
    } finally {
      setMovingTeamId(null)
    }
  }

  // ---- actions: role presets ----
  // Apply a role bundle to a user: sets the role label AND overwrites the
  // permissions JSONB with the preset. Super admins can still toggle
  // individual checkboxes after to fine-tune.
  const applyRolePreset = async (userEmail: string, role: RoleName) => {
    const preset = ROLE_PRESETS[role]
    if (!preset) return
    const { error } = await supabase
      .from('paradox_admin_permissions')
      .update({ role, permissions: preset })
      .eq('user_email', userEmail)
    if (error) { toastError('Apply role failed', error.message); return }
    // Optimistic — realtime will reconcile.
    setAdminUsers((prev) =>
      prev.map((u) =>
        u.user_email === userEmail ? { ...u, role, permissions: preset } : u,
      ),
    )
    success('Role applied', `${userEmail} → ${ROLE_LABELS[role]}`)
    logAudit('apply_role_preset', 'account', userEmail, { role })
  }

  // ---- guards ----
  if (loading || !session || !ready) {
    return (
      <div className="min-h-dvh w-full bg-ink text-bg p-5 space-y-3">
        <div className="bg-bg/10 h-8 w-40 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="bg-bg/10 h-14 animate-pulse" />
          <div className="bg-bg/10 h-14 animate-pulse" />
          <div className="bg-bg/10 h-14 animate-pulse" />
          <div className="bg-bg/10 h-14 animate-pulse" />
        </div>
        <div className="bg-bg/10 h-10 animate-pulse" />
        <div className="bg-bg/10 h-32 animate-pulse" />
      </div>
    )
  }

  // ---- render ----
  return (
    <div className="min-h-dvh bg-ink text-bg font-body">
      {/* TOP BAR */}
      <div className="sticky top-0 z-50 border-b border-bg/10 px-4 sm:px-6 h-[64px] flex justify-between items-center"
        // Landscape iPhone notch safety on the sticky top bar.
        // `paddingLeft/Right: env(safe-area-inset-*)` keeps the logo + action
        // buttons clear of the notch cut-out without disturbing the layout
        // on devices without notches (env returns 0 on those).
        style={{
          background: 'color-mix(in oklch, var(--ink) 95%, transparent)',
          backdropFilter: 'blur(12px)',
          paddingLeft: 'max(16px, env(safe-area-inset-left))',
          paddingRight: 'max(16px, env(safe-area-inset-right))',
        }}>
        {/* Logo */}
        <Link to="/paradox/admin" className="flex items-center gap-2 shrink-0">
          <img src="/paradox/paradox-logo.png" alt="Paradox"
            style={{ height: 52, width: 'auto', transform: 'rotate(-3deg)', display: 'block', filter: 'brightness(0) invert(1) opacity(0.9)' }}
            draggable={false}
          />
          <span className="font-mono text-[10px] tracking-[0.14em] uppercase opacity-35 hidden sm:inline">admin</span>
        </Link>

        {/* Actions */}
        <div className="flex gap-2 items-center">
          {activeTab === 'registrations' && (
            <button onClick={exportCSV}
              className="font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-2 rounded-full border border-bg/20 hover:bg-bg/10 transition-[background-color,opacity] active:scale-[0.96] min-h-[44px]">
              export csv
            </button>
          )}
          <Link to="/paradox"
            className="font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-2 rounded-full border border-bg/20 hover:bg-bg/10 transition-[background-color,opacity] active:scale-[0.96] min-h-[44px] flex items-center">
            ← site
          </Link>
          <span className="font-mono text-[10px] opacity-30 hidden lg:inline max-w-[140px] truncate">
            {session?.user?.email}
          </span>
          <button
            onClick={async () => {
              // Stop the heartbeat synchronously so the post-signOut interval
              // can't fire and bump last_seen_at, which would briefly make
              // the row look active again in the Accounts tab.
              if (heartbeatRef.current != null) {
                clearInterval(heartbeatRef.current)
                heartbeatRef.current = null
              }
              if (currentSessionId) {
                await supabase.from('paradox_admin_sessions')
                  .update({ is_active: false, ended_at: new Date().toISOString() })
                  .eq('id', currentSessionId)
              }
              await signOut()
              navigate('/paradox/admin/login')
            }}
            className="font-mono text-[10px] tracking-[0.08em] uppercase px-3 py-2 rounded-full min-h-[44px] active:scale-[0.96] transition-[background-color,opacity]"
            style={{ background: 'rgba(255,67,56,0.15)', color: 'var(--c1)', border: '1px solid rgba(255,67,56,0.3)' }}
          >
            logout
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="px-5 py-4 flex flex-wrap gap-2 border-b border-bg/10">
        {[
          { label: 'total',    value: stats.total,    accent: 'var(--bg)',  bg: 'rgba(255,255,255,0.06)' },
          { label: 'paid',     value: stats.paid,     accent: 'var(--c2)',  bg: 'rgba(255,210,63,0.1)' },
          { label: 'attended', value: stats.attended, accent: 'var(--c3)',  bg: 'rgba(183,156,237,0.1)' },
          { label: 'unpaid',   value: stats.unpaid,   accent: 'var(--c1)',  bg: 'rgba(255,67,56,0.1)' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="px-4 py-2.5 rounded-xl flex items-baseline gap-2 border border-bg/10"
            style={{ background: s.bg }}
          >
            <span className="font-display text-[26px] leading-[0.95] tabular-nums" style={{ color: s.accent }}>{s.value}</span>
            <span className="font-mono text-[10px] uppercase opacity-50 tracking-[0.1em]">{s.label}</span>
          </motion.div>
        ))}
      </div>

      {/* TAB BAR — horizontal pill tabs */}
      <div className="px-4 sm:px-6 py-3 flex gap-1.5 overflow-x-auto no-scrollbar border-b border-bg/10">
        {visibleTabs.map((key) => {
          const label = TAB_LABELS[key] ?? key
          const active = activeTab === key
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className="px-3.5 py-2 rounded-full font-mono text-[10px] tracking-[0.08em] uppercase whitespace-nowrap transition-[background-color,color,font-weight] duration-150 active:scale-[0.96] min-h-[44px]"
              style={{
                background: active ? 'var(--c1)' : 'rgba(255,255,255,0.07)',
                color: active ? 'var(--bg)' : 'rgba(255,255,255,0.55)',
                border: active ? 'none' : '1px solid rgba(255,255,255,0.1)',
                fontWeight: active ? 700 : 400,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* TAB CONTENT */}
      <AnimatePresence mode="wait">
        {activeTab === 'control_room' && (
          <motion.div key="control_room" {...tabAnim} className="px-4 sm:px-6 py-4">
            <LazyPanel><ControlRoom /></LazyPanel>
          </motion.div>
        )}
        {activeTab === 'finance' && (
          <motion.div key="finance" {...tabAnim}>
            <LazyPanel><FinanceModule canEdit={!!(myPermissions && myPermissions.edit_finance)} actorEmail={session?.user?.email || null} /></LazyPanel>
          </motion.div>
        )}
        {activeTab === 'analytics' && (
          <motion.div key="analytics" {...tabAnim}>
            <LazyPanel><AnalyticsModule /></LazyPanel>
          </motion.div>
        )}
        {activeTab === 'sponsors' && (
          <motion.div key="sponsors" {...tabAnim}><LazyPanel><SponsorsModule canEdit /></LazyPanel></motion.div>
        )}
        {activeTab === 'schools' && (
          <motion.div key="schools" {...tabAnim}><LazyPanel><SchoolsModule canEdit /></LazyPanel></motion.div>
        )}
        {activeTab === 'logistics' && (
          <motion.div key="logistics" {...tabAnim}><LazyPanel><LogisticsModule canEdit /></LazyPanel></motion.div>
        )}
        {activeTab === 'comms' && (
          <motion.div key="comms" {...tabAnim}>
            <LazyPanel><CommsModule canSend={isSuperAdmin || !!(myPermissions && myPermissions.send_comms)} actorEmail={session?.user?.email || null} /></LazyPanel>
          </motion.div>
        )}
        {activeTab === 'fixtures' && (
          <motion.div key="fixtures" {...tabAnim}>
            <LazyPanel><FixturesModule canEdit={isSuperAdmin || !!(myPermissions && myPermissions.edit_fixtures)} /></LazyPanel>
          </motion.div>
        )}
        {activeTab === 'judging' && (
          <motion.div key="judging" {...tabAnim}>
            <LazyPanel><JudgingModule canPublish={isSuperAdmin || !!(myPermissions && myPermissions.publish_results)} /></LazyPanel>
          </motion.div>
        )}
        {activeTab === 'door' && (
          <motion.div key="door" {...tabAnim}><LazyPanel><DoorCheckin /></LazyPanel></motion.div>
        )}
        {activeTab === 'registrations' && (
          <motion.div key="registrations" {...tabAnim}>
            {/* Filters */}
            <div className="px-4 sm:px-6 py-3 flex gap-2 flex-wrap border-b border-bg/10 items-center">
              <input
                type="text"
                placeholder="fuzzy search — name / school / phone / reg id…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 min-w-[200px] bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-[13px] outline-none placeholder:opacity-40 focus:border-c2 focus:ring-1 focus:ring-c2/30 transition-[border-color,box-shadow]"
              />
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
              >
                <option value="all" className="bg-ink">all events</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id} className="bg-ink">{e.name}</option>
                ))}
              </select>
              {/* Sort dropdown — order options match the queue-prioritisation
                  workflow: oldest pending bubble up, uncalled bubble up,
                  untexted bubble up. Default stays newest first so the
                  freshest activity is always visible without explicit toggle. */}
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as typeof sortMode)}
                title="Sort order"
                className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
              >
                <option value="newest"   className="bg-ink">↓ newest first</option>
                <option value="oldest"   className="bg-ink">↑ oldest first (time since reg)</option>
                <option value="uncalled" className="bg-ink">☎ uncalled first</option>
                <option value="untexted" className="bg-ink">✉ untexted first</option>
              </select>
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'unpaid', 'paid', 'attended'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className="px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.08em] min-h-[44px] sm:min-h-[32px] [transition:background-color_150ms,color_150ms,border-color_150ms,transform_120ms] active:scale-[0.96]"
                    style={{
                      background: statusFilter === s ? 'var(--c2)' : 'rgba(255,255,255,0.07)',
                      color: statusFilter === s ? 'var(--ink)' : 'rgba(255,255,255,0.6)',
                      border: statusFilter === s ? 'none' : '1px solid rgba(255,255,255,0.1)',
                      fontWeight: statusFilter === s ? 700 : 400,
                    }}
                  >
                    {s}
                  </button>
                ))}
                {/* Duplicates pill — only renders when there ARE dups so it
                    doesn't clutter the row in the common case (zero dups).
                    Red tint to flag it as needs-action. Clicking filters to
                    duplicate-only view; clicking again resets to "all". */}
                {duplicateCount > 0 && (
                  <button
                    onClick={() => setStatusFilter(statusFilter === 'duplicates' ? 'all' : 'duplicates')}
                    title="Same name + phone + event registered more than once. Click to review duplicates."
                    className="px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.08em] min-h-[44px] sm:min-h-[32px] [transition:background-color_150ms,color_150ms,border-color_150ms,transform_120ms] active:scale-[0.96]"
                    style={{
                      background: statusFilter === 'duplicates' ? 'var(--c1)' : 'rgba(255,67,56,0.14)',
                      color: statusFilter === 'duplicates' ? 'var(--bg)' : 'var(--c1)',
                      border: statusFilter === 'duplicates' ? 'none' : '1px solid rgba(255,67,56,0.35)',
                      fontWeight: 700,
                    }}
                  >
                    ⚠ {duplicateCount} duplicate{duplicateCount === 1 ? '' : 's'}
                  </button>
                )}
              </div>
            </div>

            {/* Registration cards — replaces the unreadable 11-col table */}
            <div className="px-4 sm:px-6 py-4 space-y-2">
              <AnimatePresence>
                {filtered.map((r, i) => {
                  const bucket = !r.paid ? ageBucket(r.created_at) : 'fresh'
                  return (
                    <motion.div
                      key={r.reg_id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 28, delay: Math.min(i * 0.02, 0.3) }}
                      // `overflow-visible` so the WA dropdown can render
                      // outside the card bounds. The card had `overflow-hidden`
                      // for rounded-corner clipping, but all children sit
                      // inside `px-4` padding (no background paints reaching
                      // the rounded edge) so removing it is safe and lets the
                      // WA template menu pop downward without being cropped.
                      className="rounded-2xl border overflow-visible transition-colors"
                      style={{
                        borderColor: r.attended ? 'rgba(183,156,237,0.3)' : r.paid ? 'rgba(183,156,237,0.15)' : 'rgba(255,67,56,0.2)',
                        background: r.attended ? 'rgba(183,156,237,0.07)' : r.paid ? 'rgba(255,255,255,0.04)' : 'rgba(255,67,56,0.05)',
                      }}
                    >
                      {/* ── Card top: name + status badges ── */}
                      <div className="flex items-start justify-between gap-3 px-4 pt-3.5 pb-2">
                        <div className="min-w-0">
                          <div className="font-display text-bg text-[18px] leading-tight truncate">{r.name}</div>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-mono text-[10px] text-c2 tabular-nums opacity-80">{r.reg_id}</span>
                            {bucket === 'stale48' && (
                              <span
                                className="font-mono text-[9px] px-2 py-0.5 rounded-full border"
                                style={{ background: 'var(--ink)', color: 'var(--c1)', borderColor: 'var(--c1)', fontWeight: 700 }}
                                title="Registered more than 48 hours ago and still unpaid — likely lost without urgent follow-up."
                              >
                                48h+ critical
                              </span>
                            )}
                            {bucket === 'stale24' && <span className="font-mono text-[9px] bg-c1 text-bg px-2 py-0.5 rounded-full">24h+ unpaid</span>}
                            {bucket === 'stale12' && <span className="font-mono text-[9px] bg-c2 text-ink px-2 py-0.5 rounded-full">12h+ unpaid</span>}
                            {/* Duplicate badge — only on rows flagged as
                                duplicates (i.e. not the earliest in their
                                name+phone+event group). Same red palette
                                as the duplicates filter pill so the cue
                                ties together visually. */}
                            {duplicateRegIds.has(r.reg_id) && (
                              <span
                                className="font-mono text-[9px] px-2 py-0.5 rounded-full border"
                                style={{ background: 'rgba(255,67,56,0.18)', color: 'var(--c1)', borderColor: 'rgba(255,67,56,0.45)', fontWeight: 700 }}
                                title="Same name + phone + event already registered earlier. Not counted in Events tab numbers."
                              >
                                ⚠ duplicate
                              </span>
                            )}
                          </div>
                        </div>
                        {/* Status pills */}
                        <div className="flex gap-1.5 shrink-0 items-center mt-0.5">
                          <span className="font-mono text-[9px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
                            style={{
                              background: r.paid ? 'rgba(183,156,237,0.2)' : 'rgba(255,67,56,0.15)',
                              color: r.paid ? 'var(--c3)' : 'var(--c1)',
                              border: `1px solid ${r.paid ? 'rgba(183,156,237,0.3)' : 'rgba(255,67,56,0.3)'}`,
                            }}>
                            {r.paid ? 'paid' : 'unpaid'}
                          </span>
                          {r.attended && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(183,156,237,0.25)', color: 'var(--c3)', border: '1px solid rgba(183,156,237,0.4)' }}>
                              in ✓
                            </span>
                          )}
                        </div>
                      </div>

                      {/* ── Card body: event + school + phone ── */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2.5 text-[12px]">
                        <span className="font-body opacity-90 font-medium">{r.event_name}</span>
                        {(r.school || r.class_year) && (
                          <span className="font-body opacity-55">{r.school ?? ''}{r.school && r.class_year ? ' · ' : ''}{r.class_year ?? ''}</span>
                        )}
                        {/* Phone tap = copy to clipboard.
                            The dedicated "💬 Text on WA" button in the
                            action row below already handles opening the
                            WhatsApp chat, so the number itself is now
                            single-purpose: one tap copies it (raw,
                            unformatted) so admins can paste it into
                            anything — CRM, address book, phone dialer,
                            another chat thread. A 1.2s "✓ copied"
                            confirmation replaces the number so the
                            tap registers visually. */}
                        {r.phone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              navigator.clipboard.writeText(r.phone).then(() => {
                                setCopied(`phone:${r.reg_id}`)
                                setTimeout(() => setCopied((c) => c === `phone:${r.reg_id}` ? null : c), 1200)
                              }).catch(() => {})
                            }}
                            title="Click to copy"
                            className="font-mono opacity-55 hover:opacity-100 hover:text-[#25D366] transition-[opacity,color] tabular-nums bg-transparent border-0 p-0 cursor-pointer"
                            style={{ fontSize: 'inherit', color: copied === `phone:${r.reg_id}` ? '#25D366' : undefined, opacity: copied === `phone:${r.reg_id}` ? 1 : undefined }}
                          >
                            {copied === `phone:${r.reg_id}` ? '✓ copied' : r.phone}
                          </button>
                        )}
                      </div>

                      {/* ── Card footer: actions ── */}
                      <div className="flex flex-wrap items-center gap-2 px-4 pb-3.5 pt-1 border-t border-bg/8">
                        {/* Notes inline */}
                        <input
                          type="text"
                          value={notes[r.reg_id] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [r.reg_id]: e.target.value }))}
                          onBlur={(e) => { if ((r.notes ?? '') !== e.target.value) saveNotes(r.reg_id, e.target.value) }}
                          className="flex-1 min-w-[120px] bg-bg/8 border border-bg/15 rounded-lg px-3 py-1.5 font-mono text-base sm:text-[10px] outline-none focus:border-c2 placeholder:opacity-30 transition-colors"
                          placeholder="add note…"
                        />

                        {/* "Texted on WA by ___" pill.
                            - Checkbox tracks `!!r.wa_texted_by` (truthy when the
                              attribution field has a value).
                            - Toggling the checkbox: if currently true → clear
                              wa_texted_by to NULL; if false → leave the input
                              empty so the admin can type the name (the row
                              becomes "truly texted" once they type + blur).
                            - Text input commits on blur — same UX as the notes
                              input above.
                            - Whole widget tints green when set so admins can
                              scan a long table and see who's been contacted. */}
                        <label
                          className={[
                            'flex items-center gap-1.5 rounded-lg px-2 py-1.5 border',
                            'min-h-[36px] cursor-pointer transition-colors',
                          ].join(' ')}
                          style={
                            r.wa_texted_by
                              ? { background: 'rgba(37,211,102,0.10)', borderColor: 'rgba(37,211,102,0.35)' }
                              : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }
                          }
                          title={r.wa_texted_by ? `Texted by ${r.wa_texted_by}` : 'Mark as texted on WhatsApp + record who'}
                        >
                          <input
                            type="checkbox"
                            checked={!!r.wa_texted_by}
                            onChange={(e) => {
                              if (e.target.checked) {
                                // Don't write to DB yet — just light up the
                                // input so the admin can type their name.
                                setTextedBy((m) => ({ ...m, [r.reg_id]: m[r.reg_id] ?? '' }))
                              } else {
                                // Untick → clear DB + local draft
                                saveTextedBy(r.reg_id, null)
                              }
                            }}
                            className="w-3.5 h-3.5 shrink-0 cursor-pointer"
                            style={{ accentColor: '#25D366' }}
                          />
                          <span className="font-mono text-[9px] uppercase tracking-[0.08em] opacity-70 shrink-0">
                            Texted by
                          </span>
                          <input
                            type="text"
                            value={textedBy[r.reg_id] ?? r.wa_texted_by ?? ''}
                            onChange={(e) => setTextedBy((m) => ({ ...m, [r.reg_id]: e.target.value }))}
                            onBlur={(e) => {
                              const v = e.target.value
                              if ((r.wa_texted_by ?? '') !== v) saveTextedBy(r.reg_id, v)
                            }}
                            placeholder="name…"
                            className="w-[80px] sm:w-[110px] bg-transparent border-none outline-none font-mono text-base sm:text-[10px] placeholder:opacity-30"
                          />
                        </label>

                        {/* "Called by ___" pill — mirrors the texted pill 1:1.
                            Uses var(--c3) purple to stay distinct from the
                            WhatsApp-green texted pill so admins can scan a
                            row and tell at a glance whether it's been texted,
                            called, both, or neither. */}
                        <label
                          className={[
                            'flex items-center gap-1.5 rounded-lg px-2 py-1.5 border',
                            'min-h-[36px] cursor-pointer transition-colors',
                          ].join(' ')}
                          style={
                            r.called_by
                              ? { background: 'rgba(183,156,237,0.14)', borderColor: 'rgba(183,156,237,0.40)' }
                              : { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }
                          }
                          title={r.called_by ? `Called by ${r.called_by}` : 'Mark as phone-called + record who'}
                        >
                          <input
                            type="checkbox"
                            checked={!!r.called_by}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCalledBy((m) => ({ ...m, [r.reg_id]: m[r.reg_id] ?? '' }))
                              } else {
                                saveCalledBy(r.reg_id, null)
                              }
                            }}
                            className="w-3.5 h-3.5 shrink-0 cursor-pointer"
                            style={{ accentColor: 'var(--c3)' }}
                          />
                          <span className="font-mono text-[9px] uppercase tracking-[0.08em] opacity-70 shrink-0">
                            Called by
                          </span>
                          <input
                            type="text"
                            value={calledBy[r.reg_id] ?? r.called_by ?? ''}
                            onChange={(e) => setCalledBy((m) => ({ ...m, [r.reg_id]: e.target.value }))}
                            onBlur={(e) => {
                              const v = e.target.value
                              if ((r.called_by ?? '') !== v) saveCalledBy(r.reg_id, v)
                            }}
                            placeholder="name…"
                            className="w-[80px] sm:w-[110px] bg-transparent border-none outline-none font-mono text-base sm:text-[10px] placeholder:opacity-30"
                          />
                        </label>

                        {/* Action buttons — paid is a two-way toggle so
                            admins can undo a misclick or refund. Both pills
                            are gated on the `mark_paid` per-account
                            permission so e.g. team leads see registrations
                            but can't change payment state. When the user
                            lacks the permission, render a non-interactive
                            "paid"/"unpaid" status chip instead. */}
                        {canMarkPaid ? (
                          !r.paid ? (
                            <button onClick={() => markPaid(r.reg_id)}
                              className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform]"
                              style={{ background: 'rgba(255,210,63,0.2)', color: 'var(--c2)', border: '1px solid rgba(255,210,63,0.3)' }}>
                              Mark Paid
                            </button>
                          ) : (
                            <button
                              onClick={() => markUnpaid(r.reg_id)}
                              title={`Mark ${r.name} as unpaid`}
                              className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform]"
                              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.15)' }}
                            >
                              ✓ Paid · undo
                            </button>
                          )
                        ) : (
                          <span
                            title="Only admins with the Mark as Paid permission can change this."
                            className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] inline-flex items-center cursor-not-allowed"
                            style={{
                              background: r.paid ? 'rgba(255,210,63,0.10)' : 'rgba(255,255,255,0.04)',
                              color: r.paid ? 'rgba(255,210,63,0.6)' : 'rgba(255,255,255,0.45)',
                              border: r.paid ? '1px solid rgba(255,210,63,0.20)' : '1px solid rgba(255,255,255,0.12)',
                            }}
                          >
                            {r.paid ? '✓ Paid' : 'Unpaid'}
                          </span>
                        )}
                        {r.paid && !r.attended && (
                          <button onClick={() => markAttended(r.reg_id)}
                            className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform]"
                            style={{ background: 'rgba(183,156,237,0.2)', color: 'var(--c3)', border: '1px solid rgba(183,156,237,0.3)' }}>
                            Check In
                          </button>
                        )}
                        <Link to={`/paradox/ticket/${r.token}`} target="_blank"
                          className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] border border-bg/20 hover:bg-bg/10 transition-colors flex items-center">
                          Ticket ↗
                        </Link>
                        {/* Direct "open WhatsApp chat" button — different from
                            the WA ▾ template-copy dropdown below. Opens
                            wa.me/{phone} so the admin can just start typing.
                            Strip non-digits and assume +91 for bare 10-digit
                            local numbers (most common case for paradox regs). */}
                        {(() => {
                          const digits = (r.phone ?? '').replace(/\D+/g, '')
                          if (!digits) return null
                          const waNumber = digits.length === 10 ? `91${digits}` : digits
                          return (
                            <a
                              href={`https://wa.me/${waNumber}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={`Open WhatsApp chat with ${r.name}`}
                              className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] flex items-center gap-1.5 active:scale-[0.96] transition-[background-color,transform]"
                              style={{ background: '#25D366', color: '#0A0A0A', border: '1px solid rgba(0,0,0,0.15)' }}
                            >
                              <span aria-hidden>💬</span>
                              <span>Text on WA</span>
                            </a>
                          )
                        })()}
                        {r.paid && (
                          <div className="relative" data-wa-menu>
                            <button onClick={() => setWaMenu(waMenu === r.reg_id ? null : r.reg_id)}
                              className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform]"
                              style={{ background: 'rgba(183,156,237,0.15)', color: 'var(--c3)', border: '1px solid rgba(183,156,237,0.25)' }}>
                              {copied === r.reg_id ? '✓ copied' : 'WA ▾'}
                            </button>
                            {waMenu === r.reg_id && (
                              // `right-0 sm:left-0 sm:right-auto` —
                              // on mobile the WA button often wraps to the
                              // right edge of the action row, where a
                              // left-anchored 140px menu would clip past
                              // the card. Anchor right on phones, left on
                              // desktop where there's room.
                              <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 z-30 rounded-xl border border-bg/20 overflow-hidden shadow-xl min-w-[140px]"
                                style={{ background: 'color-mix(in oklch, var(--ink) 95%, transparent)', backdropFilter: 'blur(12px)' }}>
                                {(['ticket', 'upi', 'reminder', 'rejection'] as const).map((k) => (
                                  <button key={k}
                                    onClick={() => {
                                      const link = `${location.origin}/ticket/${r.token}`
                                      navigator.clipboard.writeText(TEMPLATES(r, link)[k])
                                      setCopied(r.reg_id); setWaMenu(null)
                                      setTimeout(() => setCopied(null), 1500)
                                    }}
                                    className="flex w-full items-center gap-2 px-3.5 py-2.5 text-bg font-mono text-[10px] uppercase tracking-[0.06em] hover:bg-bg/10 transition-colors">
                                    {k === 'ticket' ? '🎟️' : k === 'upi' ? '💸' : k === 'reminder' ? '⏰' : '❌'}
                                    <span>{k === 'ticket' ? 'Ticket' : k === 'upi' ? 'UPI' : k === 'reminder' ? 'Reminder' : 'Reject'}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {/* Spacer pushes Delete to the right so it isn't
                            adjacent to primary actions (Mark Paid, Check In)
                            — reduces accidental taps on a long table. */}
                        <span className="flex-1" aria-hidden />
                        <button
                          onClick={() => deleteRegistration(r)}
                          title={`Delete ${r.name}'s registration`}
                          aria-label={`Delete ${r.name}'s registration`}
                          className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform]"
                          style={{ background: 'rgba(255,67,56,0.10)', color: 'var(--c1)', border: '1px solid rgba(255,67,56,0.30)' }}
                        >
                          Delete
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>

              {filtered.length === 0 && (
                <div className="py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">registrations</span>
                  <span className="font-display text-[22px] opacity-40">Nothing matches</span>
                  <span className="font-mono text-[11px] opacity-30">Try clearing your filters</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'updates' && (
          <motion.div key="updates" {...tabAnim}>
            <div className="px-5 py-3 flex gap-2 flex-wrap items-center border-b border-bg/8">
              <button
                onClick={() => setShowNewUpdate((s) => !s)}
                className="bg-c1 text-white px-3.5 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform"
              >
                {showNewUpdate ? '× Cancel' : '+ New Update'}
              </button>
              <div className="flex flex-wrap gap-1.5 ml-2">
                {(['all', ...TAG_OPTIONS] as string[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setUpdateTagFilter(t)}
                    className={`px-2.5 py-1 min-h-[28px] font-mono text-[10px] uppercase tracking-[0.08em] border transition-colors duration-150 ${
                      updateTagFilter === t
                        ? 'bg-c2 text-ink border-c2'
                        : 'border-bg/20 text-bg opacity-70 hover:opacity-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {showNewUpdate && (
                <motion.div
                  {...accordionAnim}
                  className="bg-bg/4 px-5 py-4 border-b border-bg/10 overflow-hidden"
                >
                  <div className="grid gap-3 max-w-2xl">
                    <input
                      type="text"
                      placeholder="title…"
                      value={newUpdate.title}
                      onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })}
                      className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base outline-none focus:border-c2"
                    />
                    <textarea
                      placeholder="body…"
                      rows={4}
                      value={newUpdate.body}
                      onChange={(e) => setNewUpdate({ ...newUpdate, body: e.target.value })}
                      className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2 resize-y"
                    />
                    <div className="flex gap-2 flex-wrap">
                      <select
                        value={newUpdate.event_name}
                        onChange={(e) => setNewUpdate({ ...newUpdate, event_name: e.target.value })}
                        className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[12px] outline-none focus:border-c2 flex-1 min-w-[180px]"
                      >
                        <option value="" className="bg-ink">— no event —</option>
                        {events.map((e) => (
                          <option key={e.id} value={e.name} className="bg-ink">{e.name}</option>
                        ))}
                      </select>
                      <select
                        value={newUpdate.tag}
                        onChange={(e) =>
                          setNewUpdate({ ...newUpdate, tag: e.target.value as NewUpdate['tag'] })
                        }
                        className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
                      >
                        {TAG_OPTIONS.map((t) => (
                          <option key={t} value={t} className="bg-ink">{t}</option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] px-3 py-2 border border-bg/20 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newUpdate.pinned}
                          onChange={(e) => setNewUpdate({ ...newUpdate, pinned: e.target.checked })}
                        />
                        pin
                      </label>
                    </div>
                    <button
                      disabled={postingUpdate}
                      onClick={postUpdate}
                      className="bg-c2 text-ink font-bold px-4 py-2.5 self-start disabled:opacity-60 hover:brightness-110 active:scale-[0.96] transition-transform flex items-center gap-2"
                    >
                      {postingUpdate && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                      {postingUpdate ? 'Posting…' : 'Post update →'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="sticky top-0 bg-ink z-10">
                  <tr className="font-mono text-[10px] opacity-35 tracking-[0.12em] uppercase border-b border-bg/10">
                    {['Pin', 'Tag', 'Title', 'Event', 'Posted', '', ''].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredUpdates.map((u) => (
                      <motion.tr
                        key={u.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-bg/6 hover:bg-bg/3"
                      >
                        <td className="px-3 py-2.5">
                          {u.pinned ? <span className="text-c2">★</span> : <span className="opacity-20">☆</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 ${
                              TAG_COLORS[u.tag] ?? 'bg-bg/20 text-bg'
                            }`}
                          >
                            {u.tag}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[320px]">
                          <div className="font-medium truncate">{u.title}</div>
                          <div className="opacity-60 text-[12px] truncate">{u.body}</div>
                        </td>
                        <td className="px-3 py-2.5 text-[12px] opacity-70">{u.event_name ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] opacity-60">
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => pinUpdate(u.id, !u.pinned)}
                            className="font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-1 min-h-[44px] sm:min-h-[32px] border border-bg/20 hover:border-c2 active:scale-[0.96] transition-transform duration-150"
                          >
                            {u.pinned ? 'Unpin' : 'Pin'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => deleteUpdate(u)}
                            title={`Delete update: ${u.title}`}
                            aria-label={`Delete update ${u.title}`}
                            className="font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-2 min-h-[44px] rounded-full bg-c1/15 border border-c1/30 text-c1 hover:bg-c1/25 active:scale-[0.96] transition-transform duration-150"
                          >
                            Delete
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filteredUpdates.length === 0 && (
                <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">updates</span>
                  <span className="font-display text-[22px] opacity-40">No updates yet</span>
                  <span className="font-mono text-[11px] opacity-30">Click "+ New Update" to post one</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'inquiries' && (
          <motion.div key="inquiries" {...tabAnim}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="sticky top-0 bg-ink z-10">
                  <tr className="font-mono text-[10px] opacity-35 tracking-[0.12em] uppercase border-b border-bg/10">
                    {['#', 'Company', 'Contact', 'Phone', 'Email', 'Tier', 'Status', 'Notes', 'Submitted'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inquiries.map((i, idx) => (
                    <tr key={i.id} className="border-b border-bg/6 hover:bg-bg/3">
                      <td className="px-3 py-2.5 font-mono text-[11px] opacity-50">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-medium">{i.company}</td>
                      <td className="px-3 py-2.5 text-[13px]">{i.contact}</td>
                      <td className="px-3 py-2.5 font-mono text-[12px] opacity-80">{i.phone}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] opacity-70">{i.email}</td>
                      <td className="px-3 py-2.5 text-[12px] opacity-80">{i.tier ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <select
                          value={i.status}
                          onChange={(e) => updateInquiry(i.id, { status: e.target.value })}
                          className={`bg-transparent border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] outline-none ${
                            i.status === 'new'
                              ? 'border-c1/50 text-c1'
                              : i.status === 'contacted'
                              ? 'border-c2/50 text-c2'
                              : 'border-c3/50 text-c3'
                          }`}
                        >
                          <option value="new" className="bg-ink">new</option>
                          <option value="contacted" className="bg-ink">contacted</option>
                          <option value="closed" className="bg-ink">closed</option>
                        </select>
                      </td>
                      <td className="px-3 py-2.5 min-w-[200px]">
                        <input
                          type="text"
                          value={inqNotes[i.id] ?? ''}
                          onChange={(e) =>
                            setInqNotes((n) => ({ ...n, [i.id]: e.target.value }))
                          }
                          onBlur={(e) => {
                            if ((i.notes ?? '') !== e.target.value)
                              updateInquiry(i.id, { notes: e.target.value })
                          }}
                          className="w-full bg-transparent border border-bg/15 px-2 py-1 font-mono text-base sm:text-[11px] outline-none focus:border-c2"
                          placeholder="…"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] opacity-60">
                        {new Date(i.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {inquiries.length === 0 && (
                <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">inquiries</span>
                  <span className="font-display text-[22px] opacity-40">No inquiries yet</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── After-party tab ─────────────────────────────────────────────
            Admins log confirmed after-party tickets here as they trickle
            in (WhatsApp / in-person). Each row gets a sequential ap_id
            (AP-001, AP-002, …) that doubles as the CODE128 barcode payload
            printed on the door ticket. Same JsBarcode-on-canvas pattern
            as /paradox/ticket so scanners read both alike. */}
        {activeTab === 'afterparty' && (
          <motion.div key="afterparty" {...tabAnim}>
            {/* Top stats strip — at-a-glance totals */}
            <div className="px-4 sm:px-6 py-3 flex flex-wrap gap-2 border-b border-bg/10 items-center">
              <div className="flex gap-3 mr-auto text-[11px] font-mono uppercase tracking-[0.1em]">
                <span className="opacity-60">total <span className="text-c2 ml-1 tabular-nums">{apRegs.length}</span></span>
                <span className="opacity-60">attended <span className="ml-1 tabular-nums" style={{ color: '#25D366' }}>{apRegs.filter((r) => r.attended).length}</span></span>
                <span className="opacity-60">total ₹ <span className="text-c3 ml-1 tabular-nums">{apRegs.reduce((s, r) => s + (r.amount ?? 0), 0).toLocaleString('en-IN')}</span></span>
              </div>
              {/* Check-in mode toggle — flips into the focused door view. */}
              <button
                onClick={() => { if (apCheckinMode) setApLastCheckIn(null); setApCheckinMode((v) => !v) }}
                className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform] border"
                style={
                  apCheckinMode
                    ? { background: '#25D366', color: 'var(--ink)', borderColor: '#25D366', fontWeight: 700 }
                    : { background: 'rgba(37,211,102,0.12)', color: '#25D366', borderColor: 'rgba(37,211,102,0.35)' }
                }
                title="Door check-in view"
              >
                {apCheckinMode ? '✓ check-in mode' : '⊕ check-in mode'}
              </button>
              <button
                onClick={exportApCSV}
                disabled={apRegs.length === 0}
                className="px-3 py-2 min-h-[44px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform] disabled:opacity-40"
                style={{ background: 'rgba(183,156,237,0.2)', color: 'var(--c3)', border: '1px solid rgba(183,156,237,0.35)' }}
              >
                ↓ Export CSV
              </button>
            </div>

            {/* Management chrome (phase + template editors) — hidden in
                check-in mode so the door view stays focused. */}
            {!apCheckinMode && (<>
            {/* Editable phase config — prices, opens-at dates, closed
                flag. DB-backed via paradox_site_settings.afterparty_phases
                so the public /paradox/afterparty page and this admin tab
                stay in lockstep. Save-on-blur on each field; "Reset to
                default" restores the in-code defaults if the admin
                wants to start over. The currently-live phase (computed
                from opens-at dates) drives the form's default selection. */}
            <details className="px-4 sm:px-6 py-2 border-b border-bg/10">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.1em] opacity-60 hover:opacity-100 py-2 transition-opacity">
                ✎ Edit phases (prices + dates)
                {liveApPhase && (
                  <span className="ml-2 normal-case tracking-normal opacity-70">
                    · live now: <strong>{liveApPhase.label}</strong> ₹{liveApPhase.amount}
                  </span>
                )}
              </summary>
              <div className="py-3">
                <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(120px, 1.5fr) minmax(80px, 1fr) minmax(140px, 1.4fr) auto auto' }}>
                  {/* Header row */}
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] opacity-50">Label</div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] opacity-50">Price (₹)</div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] opacity-50">Opens (YYYY-MM-DD)</div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] opacity-50">Closed</div>
                  <div className="font-mono text-[9.5px] uppercase tracking-[0.12em] opacity-50" aria-hidden></div>

                  {apPhases.map((p, idx) => {
                    const updatePhaseField = async (patch: Partial<AfterPartyPhaseConfig>) => {
                      const next = apPhases.map((x, i) => (i === idx ? { ...x, ...patch } : x))
                      // Snapshot for rollback — restore the prior settings if
                      // the DB write fails so the admin (and the public page
                      // that reads this same key) don't see a phantom save.
                      const prevSettings = siteSettings
                      setSiteSettings((list) => {
                        const exists = list.find((x) => x.key === AFTERPARTY_PHASES_KEY)
                        return exists
                          ? list.map((x) => (x.key === AFTERPARTY_PHASES_KEY ? { ...x, value: next } : x))
                          : [...list, { key: AFTERPARTY_PHASES_KEY, value: next, updated_at: new Date().toISOString() } as any]
                      })
                      const { error } = await supabase
                        .from('paradox_site_settings')
                        .upsert({ key: AFTERPARTY_PHASES_KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
                      if (error) {
                        setSiteSettings(prevSettings)
                        toastError("Couldn't save phase", error.message)
                        return
                      }
                      logAudit('update_setting', 'setting', AFTERPARTY_PHASES_KEY, { phase: p.key, fields: Object.keys(patch) })
                    }
                    return (
                      <React.Fragment key={p.key}>
                        <input
                          type="text"
                          defaultValue={p.label}
                          onBlur={(e) => { if (e.target.value.trim() && e.target.value !== p.label) updatePhaseField({ label: e.target.value.trim() }) }}
                          className="bg-bg/8 border border-bg/20 rounded text-bg px-2 py-1.5 font-body text-base sm:text-[12px] outline-none focus:border-c2"
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          defaultValue={p.amount}
                          onBlur={(e) => {
                            const n = parseInt(e.target.value, 10)
                            if (Number.isFinite(n) && n !== p.amount) updatePhaseField({ amount: n })
                          }}
                          className="bg-bg/8 border border-bg/20 rounded text-bg px-2 py-1.5 font-mono text-base sm:text-[12px] tabular-nums outline-none focus:border-c2"
                        />
                        <input
                          type="date"
                          defaultValue={p.opensAt ?? ''}
                          onBlur={(e) => {
                            const v = e.target.value || null
                            if (v !== p.opensAt) updatePhaseField({ opensAt: v })
                          }}
                          className="bg-bg/8 border border-bg/20 rounded text-bg px-2 py-1.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2"
                        />
                        <label className="flex items-center justify-center cursor-pointer px-2">
                          <input
                            type="checkbox"
                            checked={p.closedManually}
                            onChange={(e) => updatePhaseField({ closedManually: e.target.checked })}
                            className="w-4 h-4 cursor-pointer"
                            style={{ accentColor: 'var(--c1)' }}
                            aria-label={`${p.label} sold out / closed`}
                          />
                        </label>
                        {/* Remove this phase. Disabled when only one
                            phase remains — the public page needs at
                            least one tier to render. Confirms because
                            existing registrations referencing this key
                            will still display its label via the join,
                            but the phase itself vanishes from the
                            sell-side flow. */}
                        <button
                          onClick={async () => {
                            if (apPhases.length <= 1) return
                            if (!confirm(`Remove "${p.label}"? Existing registrations under this phase will keep their data but the phase won't appear in the form anymore.`)) return
                            const next = apPhases.filter((_, i) => i !== idx)
                            const prevSettings = siteSettings
                            setSiteSettings((list) => {
                              const exists = list.find((x) => x.key === AFTERPARTY_PHASES_KEY)
                              return exists
                                ? list.map((x) => (x.key === AFTERPARTY_PHASES_KEY ? { ...x, value: next } : x))
                                : [...list, { key: AFTERPARTY_PHASES_KEY, value: next, updated_at: new Date().toISOString() } as any]
                            })
                            const { error } = await supabase
                              .from('paradox_site_settings')
                              .upsert({ key: AFTERPARTY_PHASES_KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
                            if (error) { setSiteSettings(prevSettings); toastError("Couldn't remove phase", error.message); return }
                            logAudit('update_setting', 'setting', AFTERPARTY_PHASES_KEY, { removed: p.key })
                          }}
                          disabled={apPhases.length <= 1}
                          className="flex items-center justify-center px-2 min-h-[36px] min-w-[36px] rounded font-mono text-[12px] hover:bg-c1/15 disabled:opacity-25 disabled:cursor-not-allowed transition-[background-color,opacity]"
                          style={{ color: apPhases.length > 1 ? 'var(--c1)' : undefined }}
                          title={apPhases.length <= 1 ? 'At least one phase must remain' : `Remove ${p.label}`}
                          aria-label={`Remove ${p.label}`}
                        >
                          ✕
                        </button>
                      </React.Fragment>
                    )
                  })}
                </div>

                {/* Add / Reset row + helper text */}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-bg/10">
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] opacity-50 mr-auto">
                    changes save on blur · {liveApPhase ? `live: ${liveApPhase.label} ₹${liveApPhase.amount}` : 'no phase live (all closed or upcoming)'}
                  </span>
                  {/* + Add phase — appends a new tier to the end. Key
                      auto-generates from the highest `phase_N` suffix
                      already in use; falls back to `phase_N+1` where
                      N is the current count if no numbered phases
                      exist yet. */}
                  <button
                    onClick={async () => {
                      const usedKeys = new Set(apPhases.map((p) => p.key))
                      const nums = apPhases
                        .map((p) => {
                          const m = /^phase_(\d+)$/.exec(p.key)
                          return m ? parseInt(m[1], 10) : 0
                        })
                        .filter((n) => Number.isFinite(n) && n > 0)
                      let nextN = (nums.length > 0 ? Math.max(...nums) : apPhases.length) + 1
                      let nextKey = `phase_${nextN}`
                      while (usedKeys.has(nextKey)) {
                        nextN += 1
                        nextKey = `phase_${nextN}`
                      }
                      // Today's date as ISO YYYY-MM-DD for the opensAt
                      // default — admin can edit before/after.
                      const today = new Date()
                      const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
                      const newPhase: AfterPartyPhaseConfig = {
                        key: nextKey,
                        label: `Phase ${nextN}`,
                        amount: 0,
                        opensAt: iso,
                        closedManually: false,
                      }
                      const next = [...apPhases, newPhase]
                      const prevSettings = siteSettings
                      setSiteSettings((list) => {
                        const exists = list.find((x) => x.key === AFTERPARTY_PHASES_KEY)
                        return exists
                          ? list.map((x) => (x.key === AFTERPARTY_PHASES_KEY ? { ...x, value: next } : x))
                          : [...list, { key: AFTERPARTY_PHASES_KEY, value: next, updated_at: new Date().toISOString() } as any]
                      })
                      const { error } = await supabase
                        .from('paradox_site_settings')
                        .upsert({ key: AFTERPARTY_PHASES_KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
                      if (error) { setSiteSettings(prevSettings); toastError("Couldn't add phase", error.message); return }
                      success('Phase added', `${newPhase.label} created — set the price and date above.`)
                      logAudit('update_setting', 'setting', AFTERPARTY_PHASES_KEY, { added: nextKey })
                    }}
                    className="px-3 py-2 min-h-[36px] rounded-full font-mono text-[10px] uppercase tracking-[0.08em] active:scale-[0.96] transition-[background-color,transform] border"
                    style={{ background: 'rgba(255,210,63,0.10)', color: 'var(--c2)', borderColor: 'rgba(255,210,63,0.35)' }}
                  >
                    + Add phase
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm('Reset all phases to the original defaults? (Early bird ₹450 closed, Phase 1 ₹550 May 24, Phase 2 ₹600 May 26, Phase 3 ₹650 May 27)')) return
                      const prevSettings = siteSettings
                      setSiteSettings((list) => {
                        const exists = list.find((x) => x.key === AFTERPARTY_PHASES_KEY)
                        return exists
                          ? list.map((x) => (x.key === AFTERPARTY_PHASES_KEY ? { ...x, value: AFTERPARTY_PHASES_DEFAULT } : x))
                          : [...list, { key: AFTERPARTY_PHASES_KEY, value: AFTERPARTY_PHASES_DEFAULT, updated_at: new Date().toISOString() } as any]
                      })
                      const { error } = await supabase
                        .from('paradox_site_settings')
                        .upsert({ key: AFTERPARTY_PHASES_KEY, value: AFTERPARTY_PHASES_DEFAULT, updated_at: new Date().toISOString() }, { onConflict: 'key' })
                      if (error) { setSiteSettings(prevSettings); toastError("Reset failed", error.message); return }
                      success('Phases reset', 'Default prices + dates restored.')
                      logAudit('update_setting', 'setting', AFTERPARTY_PHASES_KEY, { reset: true })
                    }}
                    className="px-3 py-2 min-h-[36px] rounded-full font-mono text-[10px] uppercase tracking-[0.08em] active:scale-[0.96] transition-[background-color,transform] border"
                    style={{ background: 'rgba(255,67,56,0.08)', color: 'var(--c1)', borderColor: 'rgba(255,67,56,0.3)' }}
                  >
                    ↺ Reset to default
                  </button>
                </div>
              </div>
            </details>

            {/* Editable thank-you templates — TWO templates side-by-side:
                one for single-ticket confirmations and one for multi-
                ticket bundles. Both stored in paradox_site_settings so
                every admin sees the same templates. The copy-message
                handler picks single vs multi based on selection count. */}
            <details className="px-4 sm:px-6 py-2 border-b border-bg/10">
              <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.1em] opacity-60 hover:opacity-100 py-2 transition-opacity">
                ✎ Edit thank-you templates
              </summary>
              <div className="py-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Single-ticket template */}
                <div className="space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-70">
                    1 selected · single ticket
                  </div>
                  <textarea
                    value={apThankYouTemplate}
                    onChange={(e) => {
                      const next = e.target.value
                      setSiteSettings((list) => {
                        const exists = list.find((x) => x.key === AFTERPARTY_THANKYOU_KEY)
                        return exists
                          ? list.map((x) => (x.key === AFTERPARTY_THANKYOU_KEY ? { ...x, value: next } : x))
                          : [...list, { key: AFTERPARTY_THANKYOU_KEY, value: next, updated_at: new Date().toISOString() } as any]
                      })
                    }}
                    onBlur={async (e) => {
                      const next = e.target.value
                      const { error } = await supabase
                        .from('paradox_site_settings')
                        .upsert({ key: AFTERPARTY_THANKYOU_KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
                      if (error) { toastError("Couldn't save", error.message); return }
                      success('Template saved')
                      logAudit('update_setting', 'setting', AFTERPARTY_THANKYOU_KEY, { length: next.length })
                    }}
                    rows={8}
                    spellCheck={false}
                    className="w-full bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-[13px] outline-none focus:border-c2 resize-y"
                    placeholder={AFTERPARTY_THANKYOU_DEFAULT}
                  />
                  <div className="font-mono text-[10px] opacity-50 uppercase tracking-[0.08em]">
                    placeholders: <code>{'{name}'}</code> <code>{'{ap_id}'}</code> <code>{'{phase}'}</code> <code>{'{amount}'}</code>
                  </div>
                </div>

                {/* Multi-ticket template */}
                <div className="space-y-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-70">
                    2+ selected · consolidated message
                  </div>
                  <textarea
                    value={apThankYouMultiTemplate}
                    onChange={(e) => {
                      const next = e.target.value
                      setSiteSettings((list) => {
                        const exists = list.find((x) => x.key === AFTERPARTY_THANKYOU_MULTI_KEY)
                        return exists
                          ? list.map((x) => (x.key === AFTERPARTY_THANKYOU_MULTI_KEY ? { ...x, value: next } : x))
                          : [...list, { key: AFTERPARTY_THANKYOU_MULTI_KEY, value: next, updated_at: new Date().toISOString() } as any]
                      })
                    }}
                    onBlur={async (e) => {
                      const next = e.target.value
                      const { error } = await supabase
                        .from('paradox_site_settings')
                        .upsert({ key: AFTERPARTY_THANKYOU_MULTI_KEY, value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
                      if (error) { toastError("Couldn't save", error.message); return }
                      success('Multi template saved')
                      logAudit('update_setting', 'setting', AFTERPARTY_THANKYOU_MULTI_KEY, { length: next.length })
                    }}
                    rows={8}
                    spellCheck={false}
                    className="w-full bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-[13px] outline-none focus:border-c2 resize-y"
                    placeholder={AFTERPARTY_THANKYOU_MULTI_DEFAULT}
                  />
                  <div className="font-mono text-[10px] opacity-50 uppercase tracking-[0.08em]">
                    placeholders: <code>{'{names}'}</code> <code>{'{tickets}'}</code> <code>{'{total}'}</code> <code>{'{count}'}</code>
                  </div>
                </div>
              </div>
            </details>
            </>)}

            {/* Add-form row — one-line form so logging a new confirmation
                is a single sweep. Auto-fills amount from phase. */}
            <div className="px-4 sm:px-6 py-4 border-b border-bg/10">
              <div className="flex flex-wrap gap-2 items-end">
                <Field label="Name" required className="flex-1 min-w-[160px]" labelClassName={AL}>
                  {id => (
                  <input
                    id={id}
                    type="text"
                    value={apForm.name}
                    onChange={(e) => setApForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="full name"
                    className="w-full bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-[13px] outline-none focus:border-c2"
                  />
                  )}
                </Field>
                <Field label="Phone" required className="flex-1 min-w-[140px]" labelClassName={AL}>
                  {id => (
                  <input
                    id={id}
                    type="tel"
                    inputMode="tel"
                    value={apForm.phone}
                    onChange={(e) => setApForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 …"
                    className="w-full bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-[13px] outline-none focus:border-c2"
                  />
                  )}
                </Field>
                <Field label={<>School <span className="opacity-60 normal-case tracking-normal">(optional)</span></>} className="flex-1 min-w-[140px]" labelClassName={AL}>
                  {id => (
                  <input
                    id={id}
                    type="text"
                    value={apForm.school}
                    onChange={(e) => setApForm((f) => ({ ...f, school: e.target.value }))}
                    placeholder="school / college"
                    className="w-full bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-[13px] outline-none focus:border-c2"
                  />
                  )}
                </Field>
                <Field label="Phase" labelClassName={AL}>
                  {id => (
                  <select
                    id={id}
                    value={apForm.phase}
                    onChange={(e) => setApForm((f) => ({ ...f, phase: e.target.value as AfterPartyReg['phase'] }))}
                    className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[12px] outline-none focus:border-c2"
                  >
                    {apPhases.map((p) => (
                      <option key={p.key} value={p.key} className="bg-ink">
                        {p.label} · ₹{p.amount}
                      </option>
                    ))}
                  </select>
                  )}
                </Field>
                <button
                  onClick={() => addAfterPartyReg()}
                  disabled={apAdding || !apForm.name.trim() || !apForm.phone.trim()}
                  className="px-5 py-2.5 min-h-[44px] rounded-full font-mono text-[11px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform] disabled:opacity-40 disabled:cursor-not-allowed font-bold"
                  style={{ background: 'var(--c2)', color: 'var(--ink)' }}
                >
                  {apAdding ? '…' : '+ Add'}
                </button>
                {/* Walk-in: paid cash at the door + checked in, one tap.
                    Stamps 'cash' in notes so it highlights, marks attended. */}
                <button
                  onClick={() => addAfterPartyReg({ cashWalkIn: true })}
                  disabled={apAdding || !apForm.name.trim() || !apForm.phone.trim()}
                  className="px-5 py-2.5 min-h-[44px] rounded-full font-mono text-[11px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform] disabled:opacity-40 disabled:cursor-not-allowed font-bold border"
                  style={{ background: 'rgba(37,211,102,0.15)', color: '#25D366', borderColor: 'rgba(37,211,102,0.45)' }}
                  title="Add a cash walk-in: paid + checked in immediately"
                >
                  {apAdding ? '…' : '💵 Cash & check in'}
                </button>
              </div>
            </div>

            {/* Live check-in counter — only in check-in mode. */}
            {apCheckinMode && (
              <div className="px-4 sm:px-6 py-4 border-b border-bg/10 space-y-3">
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="font-display tabular-nums" style={{ fontSize: 'clamp(28px,5vw,40px)', lineHeight: 1, color: '#25D366' }}>
                    {apCheckedInCount}
                  </span>
                  <span className="font-mono text-[13px] opacity-60 tabular-nums">/ {apRegs.length} checked in</span>
                  {apRegs.length > 0 && (
                    <span className="font-mono text-[11px] opacity-40 tabular-nums ml-auto">
                      {Math.round((apCheckedInCount / apRegs.length) * 100)}%
                    </span>
                  )}
                </div>

                {/* Per-phase breakdown — only when there's more than one phase. */}
                {apRegs.length > 0 && (() => {
                  const known = apPhases
                    .filter((p) => apPhaseCounts.has(p.key))
                    .map((p) => ({ key: p.key, label: p.label }))
                  const extra = [...apPhaseCounts.keys()]
                    .filter((k) => !apPhases.some((p) => p.key === k))
                    .map((k) => ({ key: k, label: k }))
                  const rows = [...known, ...extra]
                  if (rows.length <= 1) return null
                  return (
                    <div className="flex gap-1.5 flex-wrap">
                      {rows.map(({ key, label }) => {
                        const c = apPhaseCounts.get(key)!
                        const done = c.total > 0 && c.checked === c.total
                        return (
                          <span key={key} className="inline-flex items-center gap-1.5 rounded-full bg-bg/8 border border-bg/15 px-2.5 py-1 font-mono text-[11px]">
                            <span className="opacity-70">{label}</span>
                            <span className="tabular-nums" style={{ color: done ? '#25D366' : undefined, opacity: done ? 1 : 0.5 }}>
                              {c.checked}/{c.total}
                            </span>
                          </span>
                        )
                      })}
                    </div>
                  )
                })()}

                {/* Undo the most recent check-in (door mis-tap recovery). */}
                {apLastCheckIn && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2"
                    style={{ background: 'rgba(37,211,102,0.10)', border: '1px solid rgba(37,211,102,0.30)' }}
                  >
                    <span className="font-mono text-[11px] min-w-0 truncate" style={{ color: '#25D366' }}>
                      ✓ checked in <strong className="text-bg">{apLastCheckIn.name}</strong>
                    </span>
                    <button
                      onClick={() => toggleApAttended(apLastCheckIn, false)}
                      className="ml-auto shrink-0 rounded-md bg-bg/10 hover:bg-bg/20 border border-bg/20 px-3.5 py-2.5 font-mono text-[12px] text-bg transition-[background-color,transform] active:scale-[0.96]"
                      title={`Undo check-in for ${apLastCheckIn.name}`}
                    >
                      ↺ undo
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Search + sort + filter */}
            <div className="px-4 sm:px-6 py-3 border-b border-bg/10 space-y-2.5">
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  type="text"
                  placeholder="search name / phone / school / AP ID…"
                  value={apSearch}
                  onChange={(e) => setApSearch(e.target.value)}
                  className="flex-1 min-w-[200px] bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-[13px] outline-none placeholder:opacity-40 focus:border-c2"
                />
                <select
                  value={apSort}
                  onChange={(e) => setApSort(e.target.value as typeof apSort)}
                  className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[12px] outline-none focus:border-c2"
                  title="Sort"
                >
                  <option value="recent" className="bg-ink">↧ recent</option>
                  <option value="name" className="bg-ink">A–Z name</option>
                  <option value="unchecked" className="bg-ink">not checked in first</option>
                  <option value="checked" className="bg-ink">checked in first</option>
                  <option value="unpaid" className="bg-ink">unpaid first</option>
                </select>
              </div>
              {/* Quick filter chips */}
              <div className="flex gap-1.5 flex-wrap">
                {([
                  ['all', 'all'],
                  ['unchecked', 'not in'],
                  ['checked', '✓ in'],
                  ['unpaid', 'unpaid'],
                  ['cash', '💵 cash'],
                ] as const).map(([key, label]) => {
                  const on = apStatusFilter === key
                  return (
                    <button
                      key={key}
                      onClick={() => setApStatusFilter(key)}
                      className="px-3 py-1.5 min-h-[32px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] border transition-[background-color,color]"
                      style={
                        on
                          ? { background: 'var(--c2)', color: 'var(--ink)', borderColor: 'var(--c2)', fontWeight: 700 }
                          : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.15)' }
                      }
                    >
                      {label}
                    </button>
                  )
                })}
                <span className="font-mono text-[10px] opacity-40 self-center ml-auto tabular-nums">
                  {apView.length} shown
                </span>
              </div>
            </div>

            {/* Selection bar — only shows when ≥1 row selected. Lets the
                admin bundle multiple recent rows (e.g. one customer paid
                for 4 tickets) into a single consolidated message via
                the multi-template. */}
            {!apCheckinMode && (() => {
              const selectedRegs = apRegs.filter((r) => apSelected.has(r.id))
              if (selectedRegs.length === 0) return null
              const selectedTotal = selectedRegs.reduce((s, r) => s + (r.amount ?? 0), 0)
              return (
                <div
                  className="sticky top-0 z-20 px-4 sm:px-6 py-3 border-b border-bg/10 flex flex-wrap items-center gap-3"
                  style={{ background: 'rgba(255,210,63,0.10)', borderTop: '1.5px solid rgba(255,210,63,0.35)', borderBottomColor: 'rgba(255,210,63,0.25)' }}
                >
                  <span className="font-mono text-[11px] uppercase tracking-[0.1em] mr-auto" style={{ color: 'var(--c2)' }}>
                    {selectedRegs.length} selected · ₹{selectedTotal.toLocaleString('en-IN')}
                  </span>
                  <button
                    onClick={() => setApSelected(new Set())}
                    className="px-3 py-2 min-h-[40px] rounded-full font-mono text-[10px] uppercase tracking-[0.08em] active:scale-[0.96] transition-[background-color,transform] border"
                    style={{ background: 'transparent', color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.18)' }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={async () => {
                      const result = await copyTicketToClipboard(selectedRegs)
                      if (result === 'ok') {
                        const msg = selectedRegs.length === 1
                          ? `1 booking ID copied to clipboard.`
                          : `${selectedRegs.length} booking IDs consolidated into one message.`
                        success('Copied', msg)
                        logAudit('ap_copy_message', 'afterparty_registration', 'bulk', { count: selectedRegs.length, ids: selectedRegs.map((r) => r.ap_id) })
                      } else {
                        toastError('Copy failed', 'Clipboard permission denied — paste manually.')
                      }
                    }}
                    className="px-4 py-2 min-h-[40px] rounded-full font-mono text-[10px] uppercase tracking-[0.08em] active:scale-[0.96] transition-[background-color,transform] font-bold"
                    style={{ background: '#25D366', color: '#0A0A0A', border: '1px solid #25D366' }}
                  >
                    📋 Copy message for {selectedRegs.length}
                  </button>
                </div>
              )
            })()}

            {/* Check-in panel (focused door view) — big rows, one-tap
                check-in, cash highlight, unpaid warning. Driven by the
                same apView (search + filter + sort) as the table. */}
            {apCheckinMode ? (
              <div className="px-3 sm:px-5 py-3 flex flex-col gap-2">
                {apView.length === 0 ? (
                  <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">check-in</span>
                    <span className="font-display text-[22px] opacity-40">{apRegs.length === 0 ? 'No registrations yet' : 'No matches'}</span>
                    <span className="font-mono text-[11px] opacity-30">{apRegs.length === 0 ? 'Add a walk-in above' : 'Adjust search or filters'}</span>
                  </div>
                ) : apView.map((r) => {
                  const phaseInfo = apPhases.find((p) => p.key === r.phase)
                  const isCash = apHasCashNote(r.notes)
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border flex items-center gap-3 p-3"
                      style={{
                        borderColor: r.attended ? 'rgba(37,211,102,0.4)' : isCash ? 'rgba(37,211,102,0.3)' : 'rgba(255,255,255,0.12)',
                        background: r.attended ? 'rgba(37,211,102,0.08)' : isCash ? 'rgba(37,211,102,0.05)' : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display font-bold text-[16px] truncate">{r.name}</span>
                          <span className="font-mono text-[11px] font-bold text-c2">{r.ap_id}</span>
                          {isCash && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,211,102,0.18)', color: '#25D366', border: '1px solid rgba(37,211,102,0.4)' }}>💵 cash</span>
                          )}
                          {!r.paid && (
                            <span className="font-mono text-[9px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,67,56,0.15)', color: 'var(--c1)', border: '1px solid rgba(255,67,56,0.4)' }}>⚠ unpaid</span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] opacity-55 mt-0.5 truncate">
                          {phaseInfo?.label ?? r.phase} · ₹{r.amount ?? phaseInfo?.amount ?? '—'}{r.phone ? ` · ${r.phone}` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleApAttended(r, !r.attended)}
                        className="px-5 py-3 min-h-[52px] min-w-[124px] rounded-full font-mono text-[12px] uppercase tracking-[0.06em] font-bold active:scale-[0.96] transition-[background-color,transform] border flex-shrink-0"
                        style={
                          r.attended
                            ? { background: 'rgba(37,211,102,0.15)', color: '#25D366', borderColor: 'rgba(37,211,102,0.45)' }
                            : { background: '#25D366', color: 'var(--ink)', borderColor: '#25D366' }
                        }
                      >
                        {r.attended ? '✓ checked in' : 'Check in'}
                      </button>
                    </div>
                  )
                })}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[940px]">
                <thead className="sticky top-0 bg-ink z-10">
                  <tr className="font-mono text-[10px] opacity-35 tracking-[0.12em] uppercase border-b border-bg/10">
                    {/* Select-all header checkbox — toggles every visible
                        row in the current filter set. */}
                    <th className="text-left px-3 py-2.5 font-normal w-[36px]">
                      {(() => {
                        const visible = apView
                        const allSelected = visible.length > 0 && visible.every((r) => apSelected.has(r.id))
                        const someSelected = visible.some((r) => apSelected.has(r.id))
                        return (
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected }}
                            onChange={(e) => {
                              setApSelected((prev) => {
                                const next = new Set(prev)
                                if (e.target.checked) {
                                  visible.forEach((r) => next.add(r.id))
                                } else {
                                  visible.forEach((r) => next.delete(r.id))
                                }
                                return next
                              })
                            }}
                            className="w-4 h-4 cursor-pointer"
                            style={{ accentColor: 'var(--c2)' }}
                            aria-label="Select all visible"
                          />
                        )
                      })()}
                    </th>
                    {['AP ID', 'Name', 'Phone', 'School', 'Phase', '₹', 'Notes', 'Added', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {apView
                    .map((r) => {
                      const phaseInfo = apPhases.find((p) => p.key === r.phase)
                      const isSelected = apSelected.has(r.id)
                      const isCash = apHasCashNote(r.notes)
                      return (
                        <tr key={r.id} className="border-b border-bg/6 hover:bg-bg/3" style={isSelected ? { background: 'rgba(255,210,63,0.06)' } : isCash ? { background: 'rgba(37,211,102,0.05)' } : undefined}>
                          <td className="px-3 py-2.5 w-[36px]">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                setApSelected((prev) => {
                                  const next = new Set(prev)
                                  if (e.target.checked) next.add(r.id)
                                  else next.delete(r.id)
                                  return next
                                })
                              }}
                              className="w-4 h-4 cursor-pointer"
                              style={{ accentColor: 'var(--c2)' }}
                              aria-label={`Select ${r.ap_id}`}
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] font-bold text-c2">{r.ap_id}</td>
                          <td className="px-3 py-2.5 font-medium text-[13px]">
                            {r.name}
                            {isCash && (
                              <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded" style={{ background: 'rgba(37,211,102,0.18)', color: '#25D366', border: '1px solid rgba(37,211,102,0.4)' }}>
                                💵 cash
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] opacity-80">{r.phone}</td>
                          <td className="px-3 py-2.5 text-[12px] opacity-70 max-w-[160px] truncate">{r.school ?? '—'}</td>
                          <td className="px-3 py-2.5 font-mono text-[11px] opacity-70">{phaseInfo?.label ?? r.phase}</td>
                          <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums">₹{r.amount ?? phaseInfo?.amount ?? '—'}</td>
                          {/* Inline notes — same blur-to-save pattern as
                              the regs `notes` column. Optimistic update
                              via updateApReg with auto-rollback on DB error. */}
                          <td className="px-3 py-2.5 min-w-[180px]">
                            <input
                              type="text"
                              value={apNotes[r.id] ?? r.notes ?? ''}
                              onChange={(e) => setApNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                              onBlur={(e) => saveApNotes(r, e.target.value)}
                              className="w-full bg-bg/8 border border-bg/15 rounded px-2 py-1 font-mono text-base sm:text-[10px] outline-none focus:border-c2 placeholder:opacity-30"
                              placeholder="add note…"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[10px] opacity-50 whitespace-nowrap">
                            {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => toggleApAttended(r, !r.attended)}
                              className="font-mono text-[10px] uppercase tracking-[0.06em] px-3 py-2 min-h-[36px] border rounded-full active:scale-[0.96] transition-[background-color,transform]"
                              style={
                                r.attended
                                  ? { background: 'rgba(37,211,102,0.15)', color: '#25D366', borderColor: 'rgba(37,211,102,0.4)' }
                                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.55)', borderColor: 'rgba(255,255,255,0.15)' }
                              }
                            >
                              {r.attended ? '✓ in' : 'mark in'}
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => setApEditing(r)}
                                className="px-3 py-2 min-h-[36px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform] border"
                                style={{ background: 'rgba(255,210,63,0.12)', color: 'var(--c2)', borderColor: 'rgba(255,210,63,0.3)' }}
                                title="Edit"
                              >
                                ✎ Edit
                              </button>
                              <button
                                onClick={() => setApTicketReg(r)}
                                className="px-3 py-2 min-h-[36px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform] border"
                                style={{ background: 'rgba(183,156,237,0.15)', color: 'var(--c3)', borderColor: 'rgba(183,156,237,0.35)' }}
                                title="Show barcode"
                              >
                                ⊞ Ticket
                              </button>
                              <button
                                onClick={() => deleteApReg(r)}
                                className="px-3 py-2 min-h-[36px] rounded-full font-mono text-[10px] uppercase tracking-[0.06em] active:scale-[0.96] transition-[background-color,transform] border"
                                style={{ background: 'rgba(255,67,56,0.1)', color: 'var(--c1)', borderColor: 'rgba(255,67,56,0.25)' }}
                                title="Delete"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
              {apRegs.length === 0 && (
                <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">after-party</span>
                  <span className="font-display text-[22px] opacity-40">No registrations yet</span>
                  <span className="font-mono text-[11px] opacity-30">Log the first one above to get started</span>
                </div>
              )}
            </div>
            )}

            {/* Ticket details modal — now text-only (no QR / no image).
                Shows the AP-ID, name, phone, school, phase, amount in a
                compact panel with a "📋 Copy this booking's message"
                button. Useful when the admin wants to re-send the single
                booking to one customer rather than bundling. */}
            <AnimatePresence>
              {apTicketReg && (
                <ApTicketModal
                  reg={apTicketReg}
                  phases={apPhases}
                  onClose={() => setApTicketReg(null)}
                  onCopyAll={async () => {
                    const result = await copyTicketToClipboard([apTicketReg])
                    if (result === 'ok') success('Copied', 'Message on clipboard.')
                    else toastError("Couldn't copy", 'Clipboard permission denied.')
                  }}
                />
              )}
            </AnimatePresence>

            {/* Edit modal — fix typos / change phase / etc. AP-ID is
                never editable (it's printed on the barcode and may already
                be in the registrant's hands). Save uses the same
                optimistic-with-rollback pattern as updateApReg above. */}
            <AnimatePresence>
              {apEditing && (
                <ApEditModal
                  reg={apEditing}
                  phases={apPhases}
                  onClose={() => setApEditing(null)}
                  onSave={async (patch) => {
                    const ok = await updateApReg(apEditing.id, patch)
                    if (ok) {
                      success('Updated', `${patch.name ?? apEditing.name} saved.`)
                      setApEditing(null)
                    }
                  }}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'checkin' && (
          <motion.div key="checkin" {...tabAnim} className="px-5 py-5 max-w-2xl mx-auto w-full">

            {/* Scanner overlay */}
            <AnimatePresence>
              {scannerOpen && (
                <BarcodeScannerOverlay
                  onScan={(code) => {
                    setCheckinSearch(code)
                    setScannerOpen(false)
                  }}
                  onClose={() => setScannerOpen(false)}
                />
              )}
            </AnimatePresence>

            {/* Scan button + text search row */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setScannerOpen(true)}
                className="shrink-0 bg-c2 text-ink px-4 py-3.5 min-h-[52px] font-mono text-[11px] uppercase tracking-[0.08em] border-[1.5px] border-bg/30 flex items-center gap-2 hover:brightness-95 active:scale-[0.96] transition-transform"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                  <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  <line x1="7" y1="12" x2="7" y2="12.01"/>
                  <line x1="12" y1="7" x2="12" y2="17"/>
                  <line x1="17" y1="12" x2="17" y2="12.01"/>
                </svg>
                Scan
              </button>
              <input
                type="text"
                value={checkinSearch}
                onChange={(e) => setCheckinSearch(e.target.value)}
                placeholder="search name, phone, or reg ID…"
                className="flex-1 bg-bg/6 border-[1.5px] border-bg/20 px-4 py-3.5 text-base outline-none focus:border-c2 placeholder:opacity-50"
              />
            </div>
            {checkinSearch.trim().length < 3 ? (
              <div className="mt-6 text-center font-mono text-[12px] opacity-50">Type at least 3 characters to search (name, phone, or reg ID)</div>
            ) : (
              <div className="mt-5 space-y-3">
                {checkinResults.map((r) => {
                  const status = r.attended ? 'attended' : r.paid ? 'paid' : 'unpaid'
                  return (
                    <motion.div
                      key={r.reg_id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-bg/5 border border-bg/12 p-4 relative"
                    >
                      <div className="flex justify-between items-start mb-2 gap-3">
                        <div>
                          <div className="font-display text-[22px] leading-tight text-balance">{r.name}</div>
                          <div className="font-mono text-[11px] opacity-60 mt-0.5">{r.event_name}</div>
                        </div>
                        <span
                          className={`font-mono text-[10px] uppercase tracking-[0.1em] px-2 py-1 whitespace-nowrap ${
                            status === 'attended'
                              ? 'bg-c3 text-white'
                              : status === 'paid'
                              ? 'bg-c2 text-ink'
                              : 'bg-c1 text-white'
                          }`}
                        >
                          {status === 'attended' ? 'already in' : status === 'paid' ? 'ready' : 'unpaid'}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] opacity-60 mb-3 tabular-nums">
                        {[r.school, r.phone, r.reg_id].filter(Boolean).join(' · ')}
                      </div>
                      {status === 'paid' && (
                        <button
                          onClick={() => markAttended(r.reg_id)}
                          className="w-full bg-c1 text-white py-3.5 min-h-[44px] font-bold text-base hover:brightness-110 active:scale-[0.96] transition-transform duration-150"
                        >
                          ✓ CHECK IN →
                        </button>
                      )}
                      {status === 'unpaid' && (
                        <button
                          onClick={() => {
                            setActiveTab('registrations')
                            setSearch(r.name)
                          }}
                          className="w-full bg-bg/10 border border-bg/20 py-3 min-h-[44px] font-mono text-[12px] uppercase tracking-[0.08em] hover:bg-bg/20 active:scale-[0.96] transition-transform duration-150"
                        >
                          Mark Paid First →
                        </button>
                      )}
                      {status === 'attended' && (
                        <div className="font-mono text-[12px] text-c3">✓ already checked in</div>
                      )}
                    </motion.div>
                  )
                })}
                {checkinResults.length === 0 && (
                  <div className="py-12 text-center flex flex-col items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">check-in</span>
                    <span className="font-display text-[22px] opacity-40">No matches</span>
                    <span className="font-mono text-[11px] opacity-30">Try a different name, phone, or reg ID</span>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ══ EVENTS TAB ══ */}
        {activeTab === 'events' && (
          <motion.div key="events" {...tabAnim}>
            {/* Toolbar */}
            <div className="px-5 py-3 flex gap-2 flex-wrap items-center border-b border-bg/8">
              <button
                onClick={openNewEventForm}
                className="bg-c1 text-white px-3.5 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform"
              >
                + Add Event
              </button>
              <span className="font-mono text-[11px] opacity-40 ml-1">
                {eventsFull.length} events
              </span>
            </div>

            {/* Edit / Create panel */}
            <AnimatePresence>
              {showEventForm && editingEvent && (
                <motion.div
                  {...accordionAnim}
                  className="bg-bg/4 px-5 py-5 border-b border-bg/10 overflow-hidden"
                >
                  <div className="max-w-4xl">
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50 mb-4">
                      {editingEvent.id ? `editing: ${editingEvent.name}` : 'new event'}
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {/* Name */}
                      <div className="lg:col-span-2">
                        <label htmlFor="apx-f1" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Name</label>
                        <input id="apx-f1"
                          type="text"
                          placeholder="Event name"
                          value={editingEvent.name ?? ''}
                          onChange={(e) => {
                            const name = e.target.value
                            setEditingEvent((ev) => ({
                              ...ev!,
                              name,
                              slug: ev?.id ? ev.slug ?? '' : slugifyEvent(name),
                            }))
                          }}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                        />
                      </div>
                      {/* Slug */}
                      <div>
                        <label htmlFor="apx-f2" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Slug</label>
                        <input id="apx-f2"
                          type="text"
                          placeholder="auto-generated"
                          value={editingEvent.slug ?? ''}
                          onChange={(e) =>
                            setEditingEvent((ev) => ({ ...ev!, slug: slugifyEvent(e.target.value) }))
                          }
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-mono text-[12px] outline-none focus:border-c2"
                        />
                      </div>
                      {/* Category */}
                      <div>
                        <label htmlFor="apx-f3" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Category</label>
                        <select id="apx-f3"
                          value={editingEvent.category ?? 'sport'}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev!, category: e.target.value }))}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-mono text-[12px] outline-none focus:border-c2"
                        >
                          {['sport', 'business', 'creative', 'cultural', 'other'].map((c) => (
                            <option key={c} value={c} className="bg-ink">{c}</option>
                          ))}
                        </select>
                      </div>
                      {/* Date */}
                      <div>
                        <label htmlFor="apx-f4" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Date</label>
                        <input id="apx-f4"
                          type="text"
                          placeholder="Jun 4, 2026"
                          value={editingEvent.date ?? ''}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev!, date: e.target.value }))}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                        />
                      </div>
                      {/* Time */}
                      <div>
                        <label htmlFor="apx-f5" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Time</label>
                        <input id="apx-f5"
                          type="text"
                          placeholder="10:00 AM"
                          value={editingEvent.time ?? ''}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev!, time: e.target.value }))}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                        />
                      </div>
                      {/* Venue */}
                      <div className="sm:col-span-2 lg:col-span-2">
                        <label htmlFor="apx-f6" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Venue</label>
                        <input id="apx-f6"
                          type="text"
                          placeholder="60 Chowringhee Rd"
                          value={editingEvent.venue ?? ''}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev!, venue: e.target.value }))}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                        />
                      </div>
                      {/* Fee */}
                      <div>
                        <label htmlFor="apx-f7" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Fee (₹)</label>
                        <input id="apx-f7"
                          type="number"
                          placeholder="0"
                          value={editingEvent.fee ?? ''}
                          onChange={(e) =>
                            setEditingEvent((ev) => ({
                              ...ev!,
                              fee: e.target.value ? Number(e.target.value) : null,
                            }))
                          }
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-mono text-[12px] outline-none focus:border-c2"
                        />
                      </div>
                      {/* Prize */}
                      <div>
                        <label htmlFor="apx-f8" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Prize</label>
                        <input id="apx-f8"
                          type="text"
                          placeholder="₹10,000 cash"
                          value={editingEvent.prize ?? ''}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev!, prize: e.target.value }))}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                        />
                      </div>
                      {/* Team format — solo / duo / team toggle. Picking "team"
                          reveals a number input for participants per team. */}
                      {/* Button group — role="group", not a <label>. */}
                      <div className="sm:col-span-2" role="group" aria-labelledby="apx-format-cap">
                        <span id="apx-format-cap" className={AL2}>Format</span>
                        <div className="flex gap-1 border border-bg/20 rounded-md p-1 w-fit">
                          {(['solo', 'duo', 'team'] as const).map((f) => {
                            const active = (editingEvent.team_format ?? 'solo') === f
                            return (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setEditingEvent((ev) => {
                                  if (!ev) return ev
                                  const base = { ...ev, team_format: f }
                                  if (f === 'solo') { base.min_team_size = 1; base.max_team_size = 1 }
                                  else if (f === 'duo') { base.min_team_size = 2; base.max_team_size = 2 }
                                  else { // team — keep existing values if they're >=2, else default to 3..5
                                    if (!base.min_team_size || base.min_team_size < 2) base.min_team_size = 3
                                    if (!base.max_team_size || base.max_team_size < base.min_team_size) base.max_team_size = Math.max(5, base.min_team_size)
                                  }
                                  return base
                                })}
                                className={[
                                  'px-4 py-1.5 rounded font-mono text-[11px] uppercase tracking-[0.1em] transition-colors min-h-[44px] sm:min-h-[36px]',
                                  active ? 'bg-c2 text-ink' : 'text-bg/70 hover:text-bg',
                                ].join(' ')}
                              >
                                {f}
                              </button>
                            )
                          })}
                        </div>
                        {editingEvent.team_format === 'team' && (
                          <div className="flex items-end gap-3 mt-3">
                            <div>
                              <label htmlFor="apx-f9" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Min players</label>
                              <input id="apx-f9"
                                type="number"
                                min={2}
                                max={50}
                                value={editingEvent.min_team_size ?? 3}
                                onChange={(e) => {
                                  const v = Math.max(2, Number(e.target.value) || 2)
                                  setEditingEvent((ev) => ev ? { ...ev, min_team_size: v, max_team_size: Math.max(v, ev.max_team_size ?? v) } : ev)
                                }}
                                className="w-24 bg-transparent border border-bg/20 text-bg px-3 py-2 font-mono text-[13px] tabular-nums outline-none focus:border-c2"
                              />
                            </div>
                            <div className="opacity-40 pb-2 font-mono text-[12px]">to</div>
                            <div>
                              <label htmlFor="apx-f10" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Max players</label>
                              <input id="apx-f10"
                                type="number"
                                min={editingEvent.min_team_size ?? 2}
                                max={50}
                                value={editingEvent.max_team_size ?? (editingEvent.min_team_size ?? 3)}
                                onChange={(e) => {
                                  const min = editingEvent.min_team_size ?? 2
                                  const v = Math.max(min, Number(e.target.value) || min)
                                  setEditingEvent((ev) => ev ? { ...ev, max_team_size: v } : ev)
                                }}
                                className="w-24 bg-transparent border border-bg/20 text-bg px-3 py-2 font-mono text-[13px] tabular-nums outline-none focus:border-c2"
                              />
                            </div>
                            <div className="opacity-50 pb-2 font-mono text-[11px]">players per team</div>
                          </div>
                        )}
                      </div>
                      {/* Max participants */}
                      <div>
                        <label htmlFor="apx-f11" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Max participants</label>
                        <input id="apx-f11"
                          type="number"
                          placeholder="no limit"
                          value={editingEvent.max_participants ?? ''}
                          onChange={(e) =>
                            setEditingEvent((ev) => ({
                              ...ev!,
                              max_participants: e.target.value ? Number(e.target.value) : null,
                            }))
                          }
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-mono text-[12px] outline-none focus:border-c2"
                        />
                      </div>
                      {/* Active toggle */}
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] px-3 py-2.5 border border-bg/20 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingEvent.active ?? true}
                            onChange={(e) => setEditingEvent((ev) => ({ ...ev!, active: e.target.checked }))}
                            className="w-3.5 h-3.5 accent-c2"
                          />
                          active (visible on site)
                        </label>
                      </div>
                      {/* Limited spots toggle — independent of max_participants.
                          When ON, event cards + detail page render the red
                          "★ limited spots" highlight. Numbers are never
                          surfaced to participants. */}
                      <div className="flex items-end pb-1">
                        <label
                          className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] px-3 py-2.5 border cursor-pointer transition-colors"
                          style={{
                            background: editingEvent.limited_spots ? 'rgba(255,67,56,0.15)' : 'transparent',
                            borderColor: editingEvent.limited_spots ? 'rgba(255,67,56,0.45)' : 'rgba(255,255,255,0.2)',
                            color: editingEvent.limited_spots ? 'var(--c1)' : undefined,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={editingEvent.limited_spots ?? false}
                            onChange={(e) => setEditingEvent((ev) => ({ ...ev!, limited_spots: e.target.checked }))}
                            className="w-3.5 h-3.5"
                            style={{ accentColor: 'var(--c1)' }}
                          />
                          ★ limited spots highlight
                        </label>
                      </div>
                      {/* Description */}
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label htmlFor="apx-f12" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Description</label>
                        <textarea id="apx-f12"
                          rows={3}
                          placeholder="Short description shown on event listing…"
                          value={editingEvent.description ?? ''}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev!, description: e.target.value }))}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2 resize-y"
                        />
                      </div>
                      {/* Rules */}
                      <div className="sm:col-span-2 lg:col-span-3">
                        <label htmlFor="apx-f13" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Rules</label>
                        <textarea id="apx-f13"
                          rows={4}
                          placeholder="Full rules — markdown ok…"
                          value={editingEvent.rules ?? ''}
                          onChange={(e) => setEditingEvent((ev) => ({ ...ev!, rules: e.target.value }))}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2 resize-y"
                        />
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      <button
                        disabled={savingEvent || !editingEvent.name?.trim()}
                        onClick={saveEvent}
                        className="bg-c2 text-ink font-bold px-5 py-2.5 disabled:opacity-50 hover:brightness-110 active:scale-[0.96] transition-transform flex items-center gap-2"
                      >
                        {savingEvent && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                        {savingEvent ? 'Saving…' : editingEvent.id ? 'Save changes →' : 'Create event →'}
                      </button>
                      <button
                        onClick={() => { setShowEventForm(false); setEditingEvent(null) }}
                        className="px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] border border-bg/20 text-bg opacity-60 hover:opacity-100 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Events table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="sticky top-0 bg-ink z-10">
                  <tr className="font-mono text-[10px] opacity-35 tracking-[0.12em] uppercase border-b border-bg/10">
                    {['Name', 'Category', 'Date', 'Venue', 'Fee', 'Format', 'Regs · Texted · Paid / Cap', 'Active', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence initial={false}>
                    {eventsFull.map((ev) => {
                      // O(1) lookup against the memoised count map (see
                      // eventCountsByEventId above). Duplicates are excluded
                      // at map-build time so the on-screen numbers always
                      // reflect unique humans, never raw row counts.
                      const counts = eventCountsByEventId.get(ev.id) ?? { regs: 0, texted: 0, paid: 0 }
                      const regCount = counts.regs
                      const textedCount = counts.texted
                      const paidCount = counts.paid
                      return (
                        <motion.tr
                          key={ev.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-bg/6 hover:bg-bg/3"
                        >
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-[14px]">{ev.name}</span>
                              {ev.limited_spots && (
                                <span
                                  className="font-mono text-[9px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                                  style={{
                                    background: 'rgba(255,67,56,0.18)',
                                    color: 'var(--c1)',
                                    border: '1px solid rgba(255,67,56,0.35)',
                                  }}
                                  title="Limited-spots highlight is ON"
                                >
                                  ★ limited
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[10px] opacity-40 truncate max-w-[180px]">{ev.slug}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 bg-bg/10 text-bg/70">
                              {ev.category}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] opacity-70 whitespace-nowrap">
                            {ev.date ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] opacity-70 max-w-[160px] truncate">
                            {ev.venue ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums">
                            {ev.fee != null ? `₹${ev.fee}` : 'free'}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] opacity-70">
                            {(() => {
                              const f = ev.team_format
                              if (f === 'solo') return 'solo'
                              if (f === 'duo' || f === 'pair') return 'duo'
                              if (f === 'team' || f === 'small_team' || f === 'large_team') {
                                const mn = ev.min_team_size, mx = ev.max_team_size
                                if (mn && mx && mn !== mx) return `team · ${mn}–${mx}`
                                if (mx) return `team · ${mx}`
                                return 'team'
                              }
                              return f?.replace('_', ' ') ?? '—'
                            })()}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] tabular-nums" title={`${regCount} registered · ${textedCount} texted on WA · ${paidCount} paid${ev.max_participants != null ? ` · cap ${ev.max_participants}` : ''}`}>
                            {/* Each count is a button → opens a popup
                                listing the players counted toward that
                                number. Disabled (no pointer cursor) when
                                zero so we don't show an empty modal. */}
                            <button
                              type="button"
                              disabled={regCount === 0}
                              onClick={() => regCount > 0 && setCountPopup({ eventId: ev.id, eventName: ev.name, mode: 'regs' })}
                              className={(regCount > 0 ? 'text-c2 hover:underline cursor-pointer' : 'opacity-40 cursor-default') + ' bg-transparent border-0 p-0 font-mono text-[12px] tabular-nums'}
                              aria-label={regCount > 0 ? `Show ${regCount} registered participants` : undefined}
                            >
                              {regCount}
                            </button>
                            <span className="opacity-30 px-1">·</span>
                            {/* Texted-on-WA — sky blue, sits between
                                yellow (registered) and green (paid) so
                                the triplet reads as a status progression:
                                leads → contacted → closed. */}
                            <button
                              type="button"
                              disabled={textedCount === 0}
                              onClick={() => textedCount > 0 && setCountPopup({ eventId: ev.id, eventName: ev.name, mode: 'texted' })}
                              style={{ color: textedCount > 0 ? '#3DA9FC' : undefined }}
                              className={(textedCount > 0 ? 'hover:underline cursor-pointer' : 'opacity-40 cursor-default') + ' bg-transparent border-0 p-0 font-mono text-[12px] tabular-nums'}
                              aria-label={textedCount > 0 ? `Show ${textedCount} texted on WhatsApp` : undefined}
                            >
                              {textedCount}
                            </button>
                            <span className="opacity-30 px-1">·</span>
                            {/* Paid count — WhatsApp green (closed). */}
                            <button
                              type="button"
                              disabled={paidCount === 0}
                              onClick={() => paidCount > 0 && setCountPopup({ eventId: ev.id, eventName: ev.name, mode: 'paid' })}
                              style={{ color: paidCount > 0 ? '#25D366' : undefined }}
                              className={(paidCount > 0 ? 'hover:underline cursor-pointer' : 'opacity-40 cursor-default') + ' bg-transparent border-0 p-0 font-mono text-[12px] tabular-nums'}
                              aria-label={paidCount > 0 ? `Show ${paidCount} paid participants` : undefined}
                            >
                              {paidCount}
                            </button>
                            <span className="opacity-30">
                              {ev.max_participants != null ? ` / ${ev.max_participants}` : ''}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => toggleEventActive(ev.id, !ev.active)}
                              disabled={togglingEventId === ev.id}
                              className={`font-mono text-[10px] uppercase tracking-[0.06em] px-3 py-2 min-h-[44px] border transition-[background-color,color] active:scale-[0.96] disabled:opacity-40 disabled:cursor-wait ${
                                ev.active
                                  ? 'bg-c3/20 border-c3/40 text-c3'
                                  : 'border-bg/20 text-bg opacity-50'
                              }`}
                            >
                              {togglingEventId === ev.id ? '…' : ev.active ? '✓ live' : 'hidden'}
                            </button>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => openEditEventForm(ev)}
                                className="font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-1 min-h-[32px] border border-bg/20 hover:border-c2 text-bg opacity-70 hover:opacity-100 active:scale-[0.96] transition"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => deleteEvent(ev.id, ev.name)}
                                className="font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-1 min-h-[32px] border border-c1/30 text-c1/80 hover:bg-c1/15 hover:text-c1 active:scale-[0.96] transition"
                                title="Delete event"
                              >
                                Del
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
              {eventsFull.length === 0 && (
                <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">events</span>
                  <span className="font-display text-[22px] opacity-40">No events yet</span>
                  <span className="font-mono text-[11px] opacity-30">Click "+ Add Event" to create one</span>
                </div>
              )}
            </div>

            {/* ── Players-in-count popup ────────────────────────────────
                Opened by tapping the yellow / blue / green counts in the
                Cap column above. Renders the actual registrants that the
                clicked count rolled up. Duplicates are excluded the same
                way they are in eventCountsByEventId so the list length
                matches the badge number exactly. */}
            <AnimatePresence>
              {countPopup && (() => {
                const playerRows = rows.filter((r) => {
                  if (r.event_id !== countPopup.eventId) return false
                  if (duplicateRegIds.has(r.reg_id)) return false
                  if (countPopup.mode === 'texted' && !r.wa_texted_by) return false
                  if (countPopup.mode === 'paid' && !r.paid) return false
                  return true
                })
                const labelByMode = {
                  regs:   { title: 'Registered',     color: 'var(--c2)' },
                  texted: { title: 'Texted on WA',   color: '#3DA9FC' },
                  paid:   { title: 'Paid',           color: '#25D366' },
                } as const
                const meta = labelByMode[countPopup.mode]
                return (
                  <motion.div
                    key="count-popup-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    onClick={() => setCountPopup(null)}
                    style={{
                      position: 'fixed', inset: 0, zIndex: 10000,
                      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 20,
                    }}
                  >
                    <motion.div
                      onClick={(e) => e.stopPropagation()}
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="count-popup-title"
                      initial={{ opacity: 0, scale: 0.96, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: 4 }}
                      transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
                      style={{
                        background: 'var(--ink)',
                        border: '1.5px solid color-mix(in oklch, var(--bg) 18%, transparent)',
                        borderRadius: 14,
                        boxShadow: '6px 6px 0 rgba(0,0,0,0.4)',
                        width: '100%', maxWidth: 640, maxHeight: '82dvh',
                        display: 'flex', flexDirection: 'column', overflow: 'hidden',
                        color: 'var(--bg)',
                      }}
                    >
                      {/* Header */}
                      <div className="px-5 py-3 flex items-center gap-3 border-b border-bg/10 flex-shrink-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50">
                            {countPopup.eventName}
                          </div>
                          <div id="count-popup-title" className="font-display text-[18px] mt-0.5 flex items-center gap-2">
                            <span style={{ color: meta.color }}>●</span>
                            <span>{meta.title}</span>
                            <span className="font-mono text-[12px] opacity-50 tabular-nums">{playerRows.length}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setCountPopup(null)}
                          className="font-mono text-[14px] opacity-60 hover:opacity-100 px-2.5 py-1.5 min-h-[40px] min-w-[40px] flex items-center justify-center hover:bg-bg/10 rounded transition-[opacity,background-color]"
                          aria-label="Close"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Player list */}
                      <div className="flex-1 overflow-y-auto">
                        {playerRows.length === 0 ? (
                          <div className="px-5 py-12 text-center opacity-40 font-mono text-[11px] uppercase tracking-[0.08em]">
                            No matching players
                          </div>
                        ) : (
                          <ul className="divide-y divide-bg/8">
                            {playerRows.map((r) => (
                              <li key={r.reg_id} className="px-5 py-3 flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-[14px]">{r.name}</span>
                                    {r.paid && (
                                      <span
                                        className="font-mono text-[9px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                                        style={{ background: 'rgba(37,211,102,0.18)', color: '#25D366', border: '1px solid rgba(37,211,102,0.35)' }}
                                      >
                                        paid
                                      </span>
                                    )}
                                    {r.wa_texted_by && (
                                      <span
                                        className="font-mono text-[9px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                                        style={{ background: 'rgba(61,169,252,0.18)', color: '#3DA9FC', border: '1px solid rgba(61,169,252,0.35)' }}
                                        title={`Texted by ${r.wa_texted_by}`}
                                      >
                                        wa · {r.wa_texted_by}
                                      </span>
                                    )}
                                    {r.called_by && (
                                      <span
                                        className="font-mono text-[9px] uppercase tracking-[0.08em] px-1.5 py-0.5 rounded"
                                        style={{ background: 'rgba(183,156,237,0.16)', color: 'var(--c3)', border: '1px solid rgba(183,156,237,0.32)' }}
                                        title={`Called by ${r.called_by}`}
                                      >
                                        called · {r.called_by}
                                      </span>
                                    )}
                                  </div>
                                  <div className="font-mono text-[11px] opacity-60 mt-0.5 tabular-nums">
                                    {r.phone || '—'}
                                  </div>
                                  <div className="font-mono text-[10px] opacity-45 mt-0.5">
                                    {[r.school, r.class_year].filter(Boolean).join(' · ') || '—'}
                                    <span className="opacity-60"> · </span>
                                    <span className="opacity-60">{r.reg_id}</span>
                                  </div>
                                  {/* Notes — admin's free-text comment
                                      from the main registrations table.
                                      Indented + soft border so it reads
                                      as a sub-block beneath the headline
                                      metadata, not as another stat line. */}
                                  {r.notes && r.notes.trim() && (
                                    <div
                                      className="mt-2 px-2.5 py-1.5 text-[12px] leading-relaxed whitespace-pre-wrap"
                                      style={{
                                        background: 'color-mix(in oklch, var(--bg) 6%, transparent)',
                                        borderLeft: '2px solid color-mix(in oklch, var(--bg) 25%, transparent)',
                                        borderRadius: 4,
                                        color: 'color-mix(in oklch, var(--bg) 78%, transparent)',
                                      }}
                                    >
                                      {r.notes}
                                    </div>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {/* Footer hint */}
                      <div className="px-5 py-2 border-t border-bg/8 font-mono text-[10px] opacity-40 flex-shrink-0">
                        Click anywhere outside to close · Esc
                      </div>
                    </motion.div>
                  </motion.div>
                )
              })()}
            </AnimatePresence>
          </motion.div>
        )}

        {activeTab === 'scores' && (
          <motion.div key="scores" {...tabAnim}>
            <div className="px-5 py-3 flex gap-2 flex-wrap items-center border-b border-bg/8">
              <button
                onClick={() => setShowNewScore((s) => !s)}
                className="bg-c1 text-white px-3.5 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform"
              >
                {showNewScore ? '× Cancel' : '+ Add Score'}
              </button>
              <select
                value={scoreEventFilter}
                onChange={(e) => setScoreEventFilter(e.target.value)}
                className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
              >
                <option value="all" className="bg-ink">all events</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id} className="bg-ink">{e.name}</option>
                ))}
              </select>
            </div>

            <AnimatePresence>
              {showNewScore && (
                <motion.div
                  {...accordionAnim}
                  className="bg-bg/4 px-5 py-4 border-b border-bg/10 overflow-hidden"
                >
                  <div className="grid gap-3 max-w-3xl grid-cols-1 sm:grid-cols-2">
                    <select
                      value={newScore.event_id}
                      onChange={(e) => {
                        const ev = events.find((x) => x.id === e.target.value)
                        setNewScore({
                          ...newScore,
                          event_id: e.target.value,
                          event_name: ev?.name ?? '',
                        })
                      }}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
                    >
                      <option value="" className="bg-ink">— pick event —</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.id} className="bg-ink">{e.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="team / participant"
                      value={newScore.team_name}
                      onChange={(e) => setNewScore({ ...newScore, team_name: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-sm outline-none focus:border-c2"
                    />
                    <input
                      type="text"
                      placeholder="school"
                      value={newScore.school}
                      onChange={(e) => setNewScore({ ...newScore, school: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-sm outline-none focus:border-c2"
                    />
                    <input
                      type="text"
                      placeholder="score (e.g. 92 / 100)"
                      value={newScore.score}
                      onChange={(e) => setNewScore({ ...newScore, score: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-sm outline-none focus:border-c2"
                    />
                    <input
                      type="number"
                      placeholder="position (1, 2, 3…)"
                      value={newScore.position}
                      onChange={(e) => setNewScore({ ...newScore, position: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-sm outline-none focus:border-c2"
                    />
                    <select
                      value={newScore.round}
                      onChange={(e) => setNewScore({ ...newScore, round: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
                    >
                      {ROUND_OPTIONS.map((r) => (
                        <option key={r} value={r} className="bg-ink">{r}</option>
                      ))}
                    </select>
                    <button
                      disabled={postingScore}
                      onClick={postScore}
                      className="bg-c2 text-ink font-bold px-4 py-2.5 sm:col-span-2 disabled:opacity-60 hover:brightness-110 active:scale-[0.96] transition-transform flex items-center justify-center gap-2"
                    >
                      {postingScore && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                      {postingScore ? 'Saving…' : 'Save score →'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[900px]">
                <thead className="sticky top-0 bg-ink z-10">
                  <tr className="font-mono text-[10px] opacity-35 tracking-[0.12em] uppercase border-b border-bg/10">
                    {['Pos', 'Event', 'Team / Participant', 'School', 'Score', 'Round', ''].map((h, i) => (
                      <th key={i} className="text-left px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {filteredScores.map((s) => {
                      const medal =
                        s.position === 1 ? '🥇' : s.position === 2 ? '🥈' : s.position === 3 ? '🥉' : ''
                      const posBg =
                        s.position === 1
                          ? 'bg-c2 text-ink'
                          : s.position === 2
                          ? 'bg-bg/30 text-ink'
                          : s.position === 3
                          ? 'bg-[#CD7F32]/40 text-bg'
                          : 'bg-bg/10'
                      return (
                        <motion.tr
                          key={s.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-b border-bg/6 hover:bg-bg/3"
                        >
                          <td className="px-3 py-2.5">
                            <span className={`inline-block ${posBg} px-2 py-1 font-mono text-[11px]`}>
                              {medal} {s.position ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[13px]">{s.event_name}</td>
                          <td className="px-3 py-2.5">
                            <input
                              key={`${s.id}-name-${s.team_name}`}
                              defaultValue={s.team_name}
                              onBlur={(e) => {
                                if (e.target.value !== s.team_name)
                                  updateScoreField(s.id, 'team_name', e.target.value)
                              }}
                              className="bg-transparent border border-transparent hover:border-bg/15 focus:border-c2 px-2 py-1 font-medium outline-none w-full"
                            />
                          </td>
                          <td className="px-3 py-2.5 text-[13px] opacity-80">{s.school}</td>
                          <td className="px-3 py-2.5">
                            <input
                              key={`${s.id}-score-${s.score ?? ''}`}
                              defaultValue={s.score ?? ''}
                              onBlur={(e) => {
                                if (e.target.value !== (s.score ?? ''))
                                  updateScoreField(s.id, 'score', e.target.value)
                              }}
                              className="bg-transparent border border-transparent hover:border-bg/15 focus:border-c2 px-2 py-1 font-mono text-[12px] outline-none w-24"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11px] opacity-70">{s.round}</td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => deleteScore(s.id)}
                              className="font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-2 min-h-[44px] rounded-full bg-c1/15 border border-c1/30 text-c1 hover:bg-c1/25 active:scale-[0.96] transition-transform duration-150"
                            >
                              Delete
                            </button>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
              {filteredScores.length === 0 && (
                <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">scores</span>
                  <span className="font-display text-[22px] opacity-40">No scores yet</span>
                  <span className="font-mono text-[11px] opacity-30">Click "+ Add Score" to record results</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* VOLUNTEERS */}
        {activeTab === 'volunteers' && (
          <motion.div key="volunteers" {...tabAnim}>
            <div className="px-5 py-3 flex gap-1.5 flex-wrap items-center border-b border-bg/8">
              {(['all', ...VOLUNTEER_STATUSES] as string[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setVolStatusFilter(s)}
                  className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] border transition ${
                    volStatusFilter === s
                      ? 'bg-c2 text-ink border-c2'
                      : 'border-bg/20 text-bg opacity-70 hover:opacity-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="sticky top-0 bg-ink z-10">
                  <tr className="font-mono text-[10px] opacity-35 tracking-[0.12em] uppercase border-b border-bg/10">
                    {['#', 'Name', 'Email', 'Phone', 'School', 'Role', 'Available', 'Status', 'Notes'].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredVolunteers.map((v, idx) => {
                    const statusColor =
                      v.status === 'new'
                        ? 'border-c1/50 text-c1'
                        : v.status === 'briefed'
                        ? 'border-c2/50 text-c2'
                        : v.status === 'confirmed'
                        ? 'border-c3/50 text-c3'
                        : v.status === 'attended'
                        ? 'border-c3/50 text-c3'
                        : 'border-bg/30 text-bg opacity-70'
                    return (
                      <tr key={v.id} className="border-b border-bg/6 hover:bg-bg/3">
                        <td className="px-3 py-2.5 font-mono text-[11px] opacity-50">{idx + 1}</td>
                        <td className="px-3 py-2.5 font-medium">{v.name}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px] opacity-70">{v.email}</td>
                        <td className="px-3 py-2.5 font-mono text-[12px] opacity-80">{v.phone}</td>
                        <td className="px-3 py-2.5 text-[13px] opacity-80">{v.school ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-[11px]">{v.role_pref}</td>
                        <td className="px-3 py-2.5 font-mono text-[10px] opacity-70">
                          {Array.isArray(v.availability) ? v.availability.join(', ') : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={v.status}
                            onChange={(e) => updateVolunteer(v.id, { status: e.target.value })}
                            className={`bg-transparent border px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] outline-none ${statusColor}`}
                          >
                            {VOLUNTEER_STATUSES.map((s) => (
                              <option key={s} value={s} className="bg-ink">
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5 min-w-[160px]">
                          <input
                            key={`${v.id}-notes-${v.notes ?? ''}`}
                            type="text"
                            defaultValue={v.notes ?? ''}
                            onBlur={(e) => {
                              if ((v.notes ?? '') !== e.target.value)
                                updateVolunteer(v.id, { notes: e.target.value })
                            }}
                            className="w-full bg-transparent border border-bg/15 px-2 py-1 font-mono text-base sm:text-[11px] outline-none focus:border-c2"
                            placeholder="…"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredVolunteers.length === 0 && (
                <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">volunteers</span>
                  <span className="font-display text-[22px] opacity-40">No volunteers</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* WINNERS */}
        {activeTab === 'winners' && (
          <motion.div key="winners" {...tabAnim}>
            <div className="px-5 py-3 flex gap-2 flex-wrap items-center border-b border-bg/8">
              <button
                onClick={() => setShowNewWinner((s) => !s)}
                className="bg-c1 text-white px-3.5 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform"
              >
                {showNewWinner ? '× Cancel' : '+ Add Winner'}
              </button>
              <select
                value={winnerEventFilter}
                onChange={(e) => setWinnerEventFilter(e.target.value)}
                className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
              >
                <option value="all" className="bg-ink">all events</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id} className="bg-ink">{e.name}</option>
                ))}
              </select>
            </div>

            <AnimatePresence>
              {showNewWinner && (
                <motion.div
                  {...accordionAnim}
                  className="bg-bg/4 px-5 py-4 border-b border-bg/10 overflow-hidden"
                >
                  <div className="grid gap-3 max-w-3xl grid-cols-1 sm:grid-cols-2">
                    <select
                      value={newWinner.event_id}
                      onChange={(e) => {
                        const ev = events.find((x) => x.id === e.target.value)
                        setNewWinner({
                          ...newWinner,
                          event_id: e.target.value,
                          event_name: ev?.name ?? '',
                        })
                      }}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
                    >
                      <option value="" className="bg-ink">— pick event —</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.id} className="bg-ink">{e.name}</option>
                      ))}
                    </select>
                    <select
                      value={newWinner.rank}
                      onChange={(e) => setNewWinner({ ...newWinner, rank: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
                    >
                      <option value="1" className="bg-ink">1 — 🥇 Gold</option>
                      <option value="2" className="bg-ink">2 — 🥈 Silver</option>
                      <option value="3" className="bg-ink">3 — 🥉 Bronze</option>
                    </select>
                    <input
                      type="text"
                      placeholder="winner name"
                      value={newWinner.winner_name}
                      onChange={(e) => setNewWinner({ ...newWinner, winner_name: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-sm outline-none focus:border-c2"
                    />
                    <input
                      type="text"
                      placeholder="school (optional)"
                      value={newWinner.school}
                      onChange={(e) => setNewWinner({ ...newWinner, school: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-sm outline-none focus:border-c2"
                    />
                    <input
                      type="text"
                      placeholder="prize (optional)"
                      value={newWinner.prize}
                      onChange={(e) => setNewWinner({ ...newWinner, prize: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-sm outline-none focus:border-c2"
                    />
                    <input
                      type="text"
                      placeholder="photo URL (optional)"
                      value={newWinner.photo_url}
                      onChange={(e) => setNewWinner({ ...newWinner, photo_url: e.target.value })}
                      className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
                    />
                    <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] px-3 py-2 border border-bg/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newWinner.published}
                        onChange={(e) =>
                          setNewWinner({ ...newWinner, published: e.target.checked })
                        }
                      />
                      publish immediately
                    </label>
                    <button
                      disabled={postingWinner}
                      onClick={postWinner}
                      className="bg-c2 text-ink font-bold px-4 py-2.5 sm:col-span-2 disabled:opacity-60 hover:brightness-110 active:scale-[0.96] transition-transform flex items-center justify-center gap-2"
                    >
                      {postingWinner && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                      {postingWinner ? 'Saving…' : 'Save winner →'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="sticky top-0 bg-ink z-10">
                  <tr className="font-mono text-[10px] opacity-35 tracking-[0.12em] uppercase border-b border-bg/10">
                    {['#', 'Event', 'Rank', 'Winner', 'School', 'Prize', 'Published', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredWinners.map((w, idx) => {
                    const medal = w.rank === 1 ? '🥇' : w.rank === 2 ? '🥈' : w.rank === 3 ? '🥉' : ''
                    return (
                      <tr key={w.id} className="border-b border-bg/6 hover:bg-bg/3">
                        <td className="px-3 py-2.5 font-mono text-[11px] opacity-50">{idx + 1}</td>
                        <td className="px-3 py-2.5 text-[13px]">{w.event_name}</td>
                        <td className="px-3 py-2.5 font-mono text-[12px]">
                          {medal} {w.rank}
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            key={`${w.id}-name-${w.winner_name}`}
                            defaultValue={w.winner_name}
                            onBlur={(e) => {
                              if (e.target.value !== w.winner_name)
                                updateWinner(w.id, { winner_name: e.target.value })
                            }}
                            className="bg-transparent border border-transparent hover:border-bg/15 focus:border-c2 px-2 py-1 font-medium outline-none w-full"
                          />
                        </td>
                        <td className="px-3 py-2.5 text-[13px] opacity-80">{w.school ?? '—'}</td>
                        <td className="px-3 py-2.5 text-[13px] opacity-80">{w.prize ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => toggleWinnerPublished(w.id, !w.published)}
                            className={`font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-2 min-h-[44px] border transition-[background-color,color] active:scale-[0.96] ${
                              w.published
                                ? 'bg-c3/20 border-c3/40 text-c3'
                                : 'border-bg/20 text-bg opacity-70'
                            }`}
                          >
                            {w.published ? '✓ live' : 'draft'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            onClick={() => deleteWinner(w.id)}
                            className="font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-2 min-h-[44px] rounded-full bg-c1/15 border border-c1/30 text-c1 hover:bg-c1/25 active:scale-[0.96] transition-transform duration-150"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredWinners.length === 0 && (
                <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">winners</span>
                  <span className="font-display text-[22px] opacity-40">No winners yet</span>
                  <span className="font-mono text-[11px] opacity-30">Click "+ Add Winner" to record them</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* BLOG */}
        {activeTab === 'blog' && (
          <motion.div key="blog" {...tabAnim}>
            <div className="px-5 py-3 flex gap-2 flex-wrap items-center border-b border-bg/8">
              <button
                onClick={() => { setShowNewBlog((s) => !s); setBlogSlugError(null) }}
                className="bg-c1 text-white px-3.5 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform"
              >
                {showNewBlog ? '× Cancel' : '+ New Post'}
              </button>
              <div className="flex flex-wrap gap-1.5 ml-2">
                {(['all', ...BLOG_TAGS] as string[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setBlogTagFilter(t)}
                    className={`px-2.5 py-1 min-h-[28px] font-mono text-[10px] uppercase tracking-[0.08em] border transition-colors duration-150 ${
                      blogTagFilter === t
                        ? 'bg-c2 text-ink border-c2'
                        : 'border-bg/20 text-bg opacity-70 hover:opacity-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <AnimatePresence>
              {showNewBlog && (
                <motion.div
                  {...accordionAnim}
                  className="bg-bg/4 px-5 py-4 border-b border-bg/10 overflow-hidden"
                >
                  <div className="grid gap-3 max-w-3xl">
                    <input
                      type="text"
                      placeholder="title…"
                      value={newBlog.title}
                      onChange={(e) => setNewBlog({ ...newBlog, title: e.target.value })}
                      className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base outline-none focus:border-c2"
                    />
                    <div>
                      <input
                        type="text"
                        placeholder="slug (auto from title if blank)"
                        value={newBlog.slug}
                        onChange={(e) => {
                          setBlogSlugError(null)
                          setNewBlog({ ...newBlog, slug: slugify(e.target.value) })
                        }}
                        className={`w-full bg-transparent border text-bg px-3 py-2 font-mono text-[12px] outline-none focus:border-c2 ${blogSlugError ? 'border-hot' : 'border-bg/20'}`}
                      />
                      {blogSlugError && (
                        <div className="font-mono text-[11px] text-c1 mt-1">
                          {blogSlugError}
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="excerpt (optional, 1-line)"
                      value={newBlog.excerpt}
                      onChange={(e) => setNewBlog({ ...newBlog, excerpt: e.target.value })}
                      className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                    />
                    <textarea
                      placeholder="body (markdown ok)…"
                      rows={6}
                      value={newBlog.body}
                      onChange={(e) => setNewBlog({ ...newBlog, body: e.target.value })}
                      className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2 resize-y"
                    />
                    <div className="flex gap-2 flex-wrap">
                      <input
                        type="text"
                        placeholder="author"
                        value={newBlog.author}
                        onChange={(e) => setNewBlog({ ...newBlog, author: e.target.value })}
                        className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-body text-base sm:text-sm outline-none focus:border-c2 flex-1 min-w-[140px]"
                      />
                      <select
                        value={newBlog.tag}
                        onChange={(e) => setNewBlog({ ...newBlog, tag: e.target.value })}
                        className="bg-bg/8 border border-bg/20 rounded-lg text-bg px-3 py-2.5 font-mono text-base sm:text-[11px] outline-none focus:border-c2 transition-colors"
                      >
                        {BLOG_TAGS.map((t) => (
                          <option key={t} value={t} className="bg-ink">{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[10px] uppercase tracking-[0.08em] opacity-60 mr-1">
                        cover:
                      </span>
                      {COVER_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setNewBlog({ ...newBlog, cover_color: c })}
                          className={`w-7 h-7 border-2 ${
                            newBlog.cover_color === c ? 'border-c2 scale-110' : 'border-bg/20'
                          } transition-transform`}
                          style={{ background: COVER_COLOR_STYLES[c] }}
                          title={c}
                        />
                      ))}
                      <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] px-3 py-2 border border-bg/20 cursor-pointer ml-auto">
                        <input
                          type="checkbox"
                          checked={newBlog.published}
                          onChange={(e) => setNewBlog({ ...newBlog, published: e.target.checked })}
                        />
                        publish immediately
                      </label>
                    </div>
                    <button
                      disabled={postingBlog}
                      onClick={postBlog}
                      className="bg-c2 text-ink font-bold px-4 py-2.5 self-start disabled:opacity-60 hover:brightness-110 active:scale-[0.96] transition-transform flex items-center gap-2"
                    >
                      {postingBlog && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                      {postingBlog ? 'Posting…' : 'Save post →'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead className="sticky top-0 bg-ink z-10">
                  <tr className="font-mono text-[10px] opacity-35 tracking-[0.12em] uppercase border-b border-bg/10">
                    {['#', 'Title', 'Tag', 'Author', 'Views', 'Published', 'Posted', ''].map((h) => (
                      <th key={h} className="text-left px-3 py-2.5 font-normal">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBlogPosts.map((b, idx) => (
                    <tr key={b.id} className="border-b border-bg/6 hover:bg-bg/3">
                      <td className="px-3 py-2.5 font-mono text-[11px] opacity-50">{idx + 1}</td>
                      <td className="px-3 py-2.5 max-w-[300px]">
                        <div className="font-medium truncate">{b.title}</div>
                        <div className="opacity-50 font-mono text-[10px] truncate">{b.slug}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 bg-bg/10">
                          {b.tag}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[13px] opacity-80">{b.author ?? '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] opacity-70">{b.views ?? 0}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => toggleBlogPublished(b.id, !b.published)}
                          className={`font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-2 min-h-[44px] border transition-[background-color,color] active:scale-[0.96] ${
                            b.published
                              ? 'bg-c3/20 border-c3/40 text-c3'
                              : 'border-bg/20 text-bg opacity-70'
                          }`}
                        >
                          {b.published ? '✓ live' : 'draft'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] opacity-60">
                        {new Date(b.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => deleteBlog(b.id)}
                          className="font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-2 min-h-[44px] rounded-full bg-c1/15 border border-c1/30 text-c1 hover:bg-c1/25 active:scale-[0.96] transition-transform duration-150"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredBlogPosts.length === 0 && (
                <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">blog</span>
                  <span className="font-display text-[22px] opacity-40">No posts yet</span>
                  <span className="font-mono text-[11px] opacity-30">Click "+ New Post" to write one</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* TEAM */}
        {activeTab === 'team' && (
          <motion.div key="team" {...tabAnim}>
            <div className="px-5 py-3 flex gap-2 flex-wrap items-center border-b border-bg/8">
              <button
                onClick={() => openNewTeamForm('leadership')}
                className="bg-c1 text-white px-3.5 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform"
              >
                + New leadership
              </button>
              <button
                onClick={() => openNewTeamForm('department')}
                className="bg-c2 text-ink px-3.5 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform"
              >
                + New department
              </button>
              <span className="font-mono text-[11px] opacity-50">
                {teamMembers.filter((m) => m.kind === 'leadership').length} leadership ·
                {' '}{teamMembers.filter((m) => m.kind === 'department').length} departments
              </span>
            </div>

            {/* Edit / Create panel */}
            <AnimatePresence>
              {showTeamForm && editingTeam && (
                <motion.div
                  {...accordionAnim}
                  className="bg-bg/4 px-5 py-5 border-b border-bg/10 overflow-hidden"
                >
                  <div className="max-w-2xl">
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50 mb-4">
                      {editingTeam.id ? `editing: ${editingTeam.name}` : `new ${editingTeam.kind}`}
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                      <div>
                        <label htmlFor="apx-f14" className="font-mono text-[10px] uppercase opacity-55 block mb-1">
                          Kind
                        </label>
                        <select id="apx-f14"
                          value={editingTeam.kind ?? 'department'}
                          onChange={(e) =>
                            setEditingTeam((m) => ({ ...m!, kind: e.target.value as 'leadership' | 'department' }))
                          }
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                        >
                          <option value="leadership">Leadership</option>
                          <option value="department">Department</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="apx-f15" className="font-mono text-[10px] uppercase opacity-55 block mb-1">
                          {editingTeam.kind === 'leadership' ? 'Person name' : 'Department name'}
                        </label>
                        <input id="apx-f15"
                          type="text"
                          value={editingTeam.name ?? ''}
                          onChange={(e) => setEditingTeam((m) => ({ ...m!, name: e.target.value }))}
                          placeholder={editingTeam.kind === 'leadership' ? 'Kanishka Gogwal' : 'Logistics'}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                        />
                      </div>
                      <div>
                        <label htmlFor="apx-f16" className="font-mono text-[10px] uppercase opacity-55 block mb-1">
                          {editingTeam.kind === 'leadership' ? 'Title' : 'Lead(s)'}
                        </label>
                        <input id="apx-f16"
                          type="text"
                          value={editingTeam.role ?? ''}
                          onChange={(e) => setEditingTeam((m) => ({ ...m!, role: e.target.value }))}
                          placeholder={editingTeam.kind === 'leadership' ? 'Event Director' : 'Hiten · Devanshi'}
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                        />
                      </div>
                      <div>
                        <label htmlFor="apx-f17" className="font-mono text-[10px] uppercase opacity-55 block mb-1">
                          Sort order
                        </label>
                        <input id="apx-f17"
                          type="number"
                          value={editingTeam.sort_order ?? 0}
                          onChange={(e) =>
                            setEditingTeam((m) => ({ ...m!, sort_order: parseInt(e.target.value) || 0 }))
                          }
                          className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={saveTeamMember}
                        disabled={savingTeam}
                        className="bg-c2 text-ink px-4 py-2 min-h-[40px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform disabled:opacity-50"
                      >
                        {savingTeam ? 'Saving…' : editingTeam.id ? 'Save changes' : 'Add member'}
                      </button>
                      <button
                        onClick={() => { setShowTeamForm(false); setEditingTeam(null) }}
                        disabled={savingTeam}
                        className="border border-bg/20 text-bg px-4 py-2 min-h-[40px] font-mono text-[11px] tracking-[0.08em] uppercase hover:bg-bg/5 active:scale-[0.96] transition-transform disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Two-column listing: leadership on the left, departments on the right.
                Stacks to one column on narrow viewports. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 px-5 py-4">
              {(['leadership', 'department'] as const).map((kind) => {
                const rows = teamMembers
                  .filter((m) => m.kind === kind)
                  .sort((a, b) => a.sort_order - b.sort_order)
                return (
                  <div key={kind}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-50 mb-2">
                      {kind === 'leadership' ? 'leadership' : 'departments'} ({rows.length})
                    </div>
                    <div className="space-y-2">
                      {rows.map((m, idx) => (
                        <div
                          key={m.id}
                          className="border border-bg/10 bg-bg/5 px-3 py-2.5 flex items-center gap-3 min-h-[56px]"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-display text-[15px] leading-tight truncate">{m.name}</div>
                            {m.role && (
                              <div className="font-mono text-[10px] opacity-55 truncate">{m.role}</div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => moveTeamMember(m.id, 'up')}
                              disabled={idx === 0 || movingTeamId !== null}
                              className="w-7 h-7 border border-bg/20 font-mono text-[12px] hover:bg-bg/10 active:scale-[0.96] transition-transform disabled:opacity-25 disabled:cursor-not-allowed"
                              aria-label="Move up"
                            >
                              {movingTeamId === m.id ? '…' : '↑'}
                            </button>
                            <button
                              onClick={() => moveTeamMember(m.id, 'down')}
                              disabled={idx === rows.length - 1 || movingTeamId !== null}
                              className="w-7 h-7 border border-bg/20 font-mono text-[12px] hover:bg-bg/10 active:scale-[0.96] transition-transform disabled:opacity-25 disabled:cursor-not-allowed"
                              aria-label="Move down"
                            >
                              ↓
                            </button>
                            <button
                              onClick={() => openEditTeamForm(m)}
                              className="px-2.5 h-7 border border-bg/20 font-mono text-[10px] uppercase tracking-[0.06em] hover:bg-bg/10 active:scale-[0.96] transition-transform"
                            >
                              edit
                            </button>
                            <button
                              onClick={() => deleteTeamMember(m.id, m.name)}
                              className="px-2.5 h-7 border border-c1/40 text-c1 font-mono text-[10px] uppercase tracking-[0.06em] hover:bg-c1/10 active:scale-[0.96] transition-transform"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                      {rows.length === 0 && (
                        <div className="border border-dashed border-bg/15 px-3 py-6 text-center font-mono text-[11px] opacity-40">
                          No {kind === 'leadership' ? 'leadership' : 'departments'} yet
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <motion.div key="settings" {...tabAnim}>
            <div className="px-5 py-3 flex gap-2 flex-wrap items-center border-b border-bg/8">
              <button
                onClick={addSettingsKey}
                className="bg-c1 text-white px-3.5 py-2.5 min-h-[44px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform"
              >
                + Add new key
              </button>
              <span className="font-mono text-[11px] opacity-50">
                {siteSettings.length} keys
              </span>
            </div>

            {/* Inline "add settings key" modal — replaces the old native prompt() */}
            <AnimatePresence>
              {showAddSettingKey && (
                <motion.div
                  {...accordionAnim}
                  className="bg-bg/4 px-5 py-5 border-b border-bg/10 overflow-hidden"
                >
                  <div className="max-w-md">
                    <div className="font-mono text-[10px] uppercase tracking-[0.12em] opacity-50 mb-4">
                      new settings key
                    </div>
                    <label htmlFor="apx-f18" className="font-mono text-[10px] uppercase opacity-55 block mb-1">
                      Key (snake_case)
                    </label>
                    <input id="apx-f18"
                      type="text"
                      placeholder="e.g. hero_subtitle"
                      value={newSettingKey}
                      autoFocus
                      onChange={(e) => setNewSettingKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitNewSettingKey()
                        if (e.key === 'Escape') setShowAddSettingKey(false)
                      }}
                      className="w-full bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-base sm:text-sm outline-none focus:border-c2"
                    />
                    <p className="font-mono text-[10px] opacity-40 mt-2">
                      Lowercase letters, digits, and underscores only. The key is permanent.
                    </p>
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={submitNewSettingKey}
                        className="bg-c2 text-ink px-4 py-2 min-h-[40px] font-mono text-[11px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform"
                      >
                        Add key
                      </button>
                      <button
                        onClick={() => { setShowAddSettingKey(false); setNewSettingKey('') }}
                        className="border border-bg/20 text-bg px-4 py-2 min-h-[40px] font-mono text-[11px] tracking-[0.08em] uppercase hover:bg-bg/5 active:scale-[0.96] transition-transform"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {/* ── Pinned: WhatsApp Group Link ──
                Extracted to its own component so hook calls aren't inside an
                IIFE (Rules of Hooks). Save mechanics stay here so toasts +
                audit log share the existing scope. */}
            <WhatsAppGroupSetting
              value={(() => {
                const v = siteSettings.find(s => s.key === 'whatsapp_group_url')?.value
                return typeof v === 'string' ? v : ''
              })()}
              onSave={async (next): Promise<SaveResult> => {
                const { error: err } = await supabase
                  .from('paradox_site_settings')
                  .upsert(
                    { key: 'whatsapp_group_url', value: next, updated_at: new Date().toISOString() },
                    { onConflict: 'key' },
                  )
                if (err) {
                  toastError('Save failed', err.message)
                  return { ok: false, error: err.message }
                }
                setSiteSettings(list => {
                  const exists = list.find(x => x.key === 'whatsapp_group_url')
                  return exists
                    ? list.map(x => x.key === 'whatsapp_group_url' ? { ...x, value: next } : x)
                    : [...list, { key: 'whatsapp_group_url', value: next, updated_at: new Date().toISOString() }]
                })
                success('Saved', 'WhatsApp group link updated across all pages')
                logAudit('update_setting', 'setting', 'whatsapp_group_url', { value: next.slice(0, 60) })
                return { ok: true }
              }}
            />

            {siteSettings.map((s) => (
              <SettingRow
                key={s.key}
                setting={s}
                onSave={async (key, value) => {
                  const { error: err } = await supabase
                    .from('paradox_site_settings')
                    .update({ value, updated_at: new Date().toISOString() })
                    .eq('key', key)
                  if (err) {
                    toastError('Save failed', err.message)
                    return { ok: false, error: err.message }
                  }
                  setSiteSettings((list) =>
                    list.map((x) => (x.key === key ? { ...x, value } : x)),
                  )
                  const previewVal =
                    typeof value === 'string' ? value.slice(0, 50) : JSON.stringify(value).slice(0, 50)
                  success('Settings saved', key)
                  logAudit('update_setting', 'setting', key, { value: previewVal })
                  return { ok: true }
                }}
              />
            ))}
            {siteSettings.length === 0 && (
              <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">settings</span>
                <span className="font-display text-[22px] opacity-40">No settings yet</span>
                <span className="font-mono text-[11px] opacity-30">Click "Add new key" to create one</span>
              </div>
            )}
          </motion.div>
        )}

        {/* AUDIT */}
        {activeTab === 'audit' && (
          <motion.div key="audit" {...tabAnim}>
            {/* Filter bar */}
            <div className="px-5 py-3 space-y-2 border-b border-bg/8">
              {/* Action filters */}
              <div className="flex gap-1.5 flex-wrap items-center">
                <span className="font-mono text-[9px] uppercase opacity-40 tracking-[0.1em] mr-1">action</span>
                {['all', ...auditActions].map((a) => (
                  <button
                    key={a}
                    onClick={() => setAuditActionFilter(a)}
                    className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] border transition ${
                      auditActionFilter === a
                        ? 'bg-c2 text-ink border-c2'
                        : 'border-bg/20 text-bg opacity-60 hover:opacity-100'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
              {/* Resource filters */}
              <div className="flex gap-1.5 flex-wrap items-center">
                <span className="font-mono text-[9px] uppercase opacity-40 tracking-[0.1em] mr-1">resource</span>
                {['all', ...auditResources].map((r) => (
                  <button
                    key={r}
                    onClick={() => setAuditResourceFilter(r)}
                    className={`px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] border transition ${
                      auditResourceFilter === r
                        ? 'bg-c3 text-white border-c3'
                        : 'border-bg/20 text-bg opacity-60 hover:opacity-100'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {/* Summary + export */}
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-[10px] opacity-40">
                  {filteredAudit.length} {filteredAudit.length === 1 ? 'entry' : 'entries'}
                  {filteredAudit.length !== auditLog.length && ` of ${auditLog.length} total`}
                </span>
                <button
                  onClick={() => {
                    const headers = ['When', 'Who', 'Action', 'Resource', 'Resource ID', 'Details']
                    const csv = [
                      headers.join(','),
                      ...filteredAudit.map((a) => [
                        new Date(a.created_at).toISOString(),
                        `"${a.actor_email ?? ''}"`,
                        a.action,
                        a.resource ?? '',
                        a.resource_id ?? '',
                        `"${a.details ? JSON.stringify(a.details).replace(/"/g, '""') : ''}"`,
                      ].join(','))
                    ].join('\n')
                    const el = document.createElement('a')
                    el.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
                    el.download = `paradox-audit-${Date.now()}.csv`
                    el.click()
                  }}
                  className="font-mono text-[10px] uppercase tracking-[0.08em] px-3 py-1 border border-bg/20 text-bg opacity-60 hover:opacity-100 transition"
                >
                  Export CSV ↓
                </button>
              </div>
            </div>

            {/* Log table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="sticky top-0 bg-ink z-10">
                  <tr className="font-mono text-[10px] opacity-40 tracking-[0.1em] uppercase border-b border-bg/12">
                    <th className="text-left px-4 py-2.5 font-normal w-[130px]">When</th>
                    <th className="text-left px-4 py-2.5 font-normal">Who</th>
                    <th className="text-left px-4 py-2.5 font-normal">Action</th>
                    <th className="text-left px-4 py-2.5 font-normal">Resource</th>
                    <th className="text-left px-4 py-2.5 font-normal">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((a) => {
                    const isExpanded = auditExpanded === a.id
                    const actionColor = a.action.startsWith('delete') || a.action.startsWith('remove')
                      ? 'bg-c1/20 text-c1 border border-c1/30'
                      : a.action.startsWith('post') || a.action.startsWith('add') || a.action.startsWith('create')
                      ? 'bg-c3/20 text-c3 border border-c3/30'
                      : a.action.startsWith('mark') || a.action.startsWith('publish') || a.action.startsWith('pin') || a.action.startsWith('update') || a.action.startsWith('edit')
                      ? 'bg-c3/20 text-c3 border border-c3/30'
                      : a.action === 'session_start'
                      ? 'bg-c2/20 text-c2 border border-c2/30'
                      : a.action.startsWith('export')
                      ? 'bg-bg/10 text-bg/60 border border-bg/20'
                      : 'bg-bg/10 text-bg/70 border border-bg/20'
                    return (
                      <React.Fragment key={a.id}>
                        <tr
                          onClick={() => setAuditExpanded(isExpanded ? null : a.id)}
                          className="border-b border-bg/6 hover:bg-bg/5 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-2.5 font-mono text-[10px] opacity-55 whitespace-nowrap" title={new Date(a.created_at).toLocaleString()}>
                            {timeAgo(a.created_at)}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] opacity-75 max-w-[160px] truncate">
                            {a.actor_email ?? <span className="opacity-30">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 ${actionColor}`}>
                              {a.action.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px]">
                            <span className="opacity-70">{a.resource ?? '—'}</span>
                            {a.resource_id && a.resource_id !== 'bulk' && (
                              <span className="opacity-35 ml-1">· {String(a.resource_id).slice(0, 14)}</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[10px] opacity-45 max-w-[280px] truncate">
                            {a.details ? JSON.stringify(a.details) : '—'}
                          </td>
                        </tr>
                        {isExpanded && a.details && (
                          <tr className="bg-bg/5 border-b border-bg/6">
                            <td colSpan={5} className="px-4 py-3">
                              <div className="font-mono text-[10px] opacity-50 uppercase tracking-[0.08em] mb-1">full details</div>
                              <pre className="font-mono text-[11px] text-bg/80 whitespace-pre-wrap break-all bg-bg/5 px-3 py-2 border border-bg/10">
                                {JSON.stringify(a.details, null, 2)}
                              </pre>
                              <div className="font-mono text-[10px] opacity-35 mt-1.5">
                                {new Date(a.created_at).toLocaleString()} · ID: {a.id}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
              {filteredAudit.length === 0 && (
                <div className="px-5 py-16 text-center flex flex-col items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-35">audit log</span>
                  <span className="font-display text-[22px] opacity-40">No entries match</span>
                  <span className="font-mono text-[11px] opacity-30">Try clearing the filters</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══ ACCOUNTS TAB (super admin only) ══ */}
        {activeTab === 'accounts' && isSuperAdmin && (
          <motion.div key="accounts" {...tabAnim} className="px-5 py-5 max-w-5xl mx-auto w-full space-y-8">

            {/* ── Live sessions ── */}
            <section>
              <h2 className="font-display text-[22px] leading-tight text-balance mb-3">
                Active sessions
              </h2>
              <div className="border border-bg/15 overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="sticky top-0 bg-ink z-10">
                    <tr className="font-mono text-[10px] uppercase tracking-[0.08em] opacity-40 border-b border-bg/12">
                      {['Who', 'Browser', 'OS', 'Started', 'Last seen', 'Status', ''].map((h) => (
                        <th key={h} className="text-left px-4 py-2 font-normal">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adminSessions.map((s) => {
                      const isMe = s.id === currentSessionId
                      return (
                        <tr key={s.id} className={`border-b border-bg/8 ${isMe ? 'bg-c2/10' : 'hover:bg-bg/5'}`}>
                          <td className="px-4 py-2.5 font-mono text-[11px]">
                            {s.user_email}
                            {isMe && <span className="ml-1.5 font-mono text-[9px] bg-c2 text-ink px-1 py-0.5">you</span>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] opacity-70">{s.browser ?? '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-[11px] opacity-70">{s.os ?? '—'}</td>
                          <td className="px-4 py-2.5 font-mono text-[10px] opacity-55 whitespace-nowrap">{timeAgo(s.created_at)}</td>
                          <td className="px-4 py-2.5 font-mono text-[10px] opacity-55 whitespace-nowrap">{timeAgo(s.last_seen_at)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`font-mono text-[9px] uppercase px-1.5 py-0.5 ${s.is_active ? 'bg-c3/20 text-c3' : 'bg-bg/10 opacity-40 text-bg'}`}>
                              {s.is_active ? 'active' : 'ended'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {s.is_active && !isMe && (
                              <button
                                onClick={async () => {
                                  if (!confirm(`Revoke ${s.user_email}'s session?`)) return
                                  const { error: err } = await supabase.from('paradox_admin_sessions')
                                    .update({ is_active: false, ended_at: new Date().toISOString() })
                                    .eq('id', s.id)
                                  if (err) {
                                    toastError("Couldn't revoke session", err.message)
                                    return
                                  }
                                  setAdminSessions((prev) => prev.map((x) => x.id === s.id ? { ...x, is_active: false } : x))
                                  logAudit('revoke_session', 'session', s.id, { user: s.user_email })
                                  success('Session revoked', s.user_email)
                                }}
                                className="font-mono text-[10px] text-c1 hover:underline min-h-[44px] px-2"
                              >
                                revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {adminSessions.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center font-mono text-[11px] opacity-40">No session records yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* ── Admin users & permissions ── */}
            <section>
              <h2 className="font-display text-[22px] leading-tight text-balance mb-3">
                Admin accounts & permissions
              </h2>
              <div className="border border-bg/15 overflow-x-auto mb-4">
                <table className="w-full min-w-[900px]">
                  <thead className="sticky top-0 bg-ink z-10">
                    <tr className="font-mono text-[10px] uppercase tracking-[0.08em] opacity-40 border-b border-bg/12">
                      <th className="text-left px-4 py-2 font-normal w-[220px]">Account</th>
                      <th className="text-left px-4 py-2 font-normal w-[100px]">Last login</th>
                      <th className="text-left px-3 py-2 font-normal w-[140px]">Role</th>
                      {(Object.keys(TAB_LABELS) as TabKey[]).filter(t => t !== 'accounts').map((t) => (
                        <th
                          key={t}
                          className="text-center px-1.5 py-2 font-normal text-[10px] whitespace-nowrap"
                          title={TAB_LABELS[t]}
                        >
                          {TAB_SHORT[t]}
                        </th>
                      ))}
                      <th className="text-left px-4 py-2 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Merge auth users with permissions rows — show every auth user */}
                    {authUsers.map((au) => {
                      const permsRow = adminUsers.find((u) => u.user_email === au.email)
                      const isSA = au.email === SUPER_ADMIN
                      const isActive = permsRow?.is_active ?? false
                      const hasPerms = !!permsRow
                      const activeSessions = adminSessions.filter((s) => s.user_email === au.email && s.is_active)
                      return (
                        <tr key={au.id} className={`border-b border-bg/8 ${isSA ? '' : 'hover:bg-bg/5'} transition-colors`}>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {activeSessions.length > 0 && (
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-c1 opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-c1" />
                                </span>
                              )}
                              <div>
                                <div className="font-mono text-[11px]">{au.email}</div>
                                {permsRow?.display_name && <div className="font-mono text-[10px] opacity-40">{permsRow.display_name}</div>}
                                {isSA && <div className="font-mono text-[9px] text-c2">super admin</div>}
                                {!hasPerms && <div className="font-mono text-[9px] text-c1/70">no permissions row</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[10px] opacity-50">
                            {au.last_sign_in_at ? timeAgo(au.last_sign_in_at) : '—'}
                          </td>
                          {/* Role picker — applies a preset bundle to the
                              permissions JSONB in one click. Super admin row is
                              locked to "Super Director" since their access is
                              gated by email, not the picker. */}
                          <td className="px-3 py-2.5">
                            {isSA ? (
                              <span className="inline-flex px-2 py-1 border border-c2/40 text-c2 font-mono text-[9px] uppercase tracking-[0.08em]">
                                Super Director
                              </span>
                            ) : !hasPerms ? (
                              <span className="opacity-25 font-mono text-[10px]">—</span>
                            ) : (
                              <select
                                value={permsRow!.role ?? 'coordinator'}
                                onChange={async (e) => {
                                  const newRole = e.target.value as RoleName
                                  if (!confirm(`Apply preset "${ROLE_LABELS[newRole]}" to ${au.email}? This overwrites their current permissions.`)) {
                                    return
                                  }
                                  await applyRolePreset(au.email, newRole)
                                }}
                                className="bg-bg/6 border border-bg/20 font-mono text-[10px] uppercase tracking-[0.06em] px-2 py-1 outline-none focus:border-c2"
                              >
                                {(Object.keys(ROLE_LABELS) as RoleName[]).map((r) => (
                                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                              </select>
                            )}
                          </td>
                          {(Object.keys(TAB_LABELS) as TabKey[]).filter(t => t !== 'accounts').map((t) => (
                            <td key={t} className="text-center px-1.5 py-2.5">
                              {isSA ? (
                                <span className="font-mono text-[10px] text-c2">✓</span>
                              ) : !hasPerms ? (
                                <span className="opacity-20 text-[10px]">—</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={permsRow!.permissions?.[t] ?? false}
                                  onChange={async (e) => {
                                    const updated = { ...permsRow!.permissions, [t]: e.target.checked }
                                    const { error: permsErr } = await supabase.from('paradox_admin_permissions')
                                      .update({ permissions: updated })
                                      .eq('user_email', au.email)
                                    if (permsErr) { toastError('Update failed', permsErr.message); return }
                                    // Realtime will update state — but also update optimistically
                                    setAdminUsers((prev) => prev.map((x) => x.user_email === au.email ? { ...x, permissions: updated } : x))
                                    info('Permissions updated', `${au.email} · ${TAB_LABELS[t]}`)
                                    logAudit('update_permission', 'account', au.email, { tab: t, value: e.target.checked })
                                  }}
                                  className="w-3.5 h-3.5 accent-c2 cursor-pointer"
                                />
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-1">
                              {!hasPerms ? (
                                <button
                                  onClick={async () => {
                                    // Grant uses the 'coordinator' preset by default —
                                    // a sensible operational baseline that the super
                                    // admin can refine afterwards via the role picker
                                    // or per-tab checkboxes.
                                    const { data, error: grantErr } = await supabase.from('paradox_admin_permissions').insert({
                                      user_email: au.email,
                                      display_name: null,
                                      created_by: session?.user?.email,
                                      role: 'coordinator',
                                      permissions: ROLE_PRESETS.coordinator,
                                      is_active: true,
                                    }).select('*').single()
                                    if (grantErr) { toastError('Grant failed', grantErr.message); return }
                                    if (data) setAdminUsers((p) => [...p, data as AdminUser])
                                    success('Access granted', `${au.email} → Coordinator`)
                                    logAudit('grant_access', 'account', au.email, { role: 'coordinator' })
                                  }}
                                  className="font-mono text-[10px] px-2 py-0.5 border border-c3/40 text-c3 hover:brightness-125"
                                >
                                  grant access
                                </button>
                              ) : isSA ? (
                                <span className="font-mono text-[9px] opacity-30">locked</span>
                              ) : (
                                <button
                                  onClick={async () => {
                                    const next = !isActive
                                    const { error: err } = await supabase.from('paradox_admin_permissions')
                                      .update({ is_active: next })
                                      .eq('user_email', au.email)
                                    if (err) {
                                      toastError(`Couldn't ${next ? 'enable' : 'disable'} account`, err.message)
                                      return
                                    }
                                    setAdminUsers((prev) => prev.map((x) => x.user_email === au.email ? { ...x, is_active: next } : x))
                                    logAudit(next ? 'enable_account' : 'disable_account', 'account', au.email)
                                    success(next ? 'Account enabled' : 'Account disabled', au.email)
                                  }}
                                  className={`font-mono text-[10px] px-2 py-0.5 border ${isActive ? 'border-bg/20 opacity-60 hover:text-c1' : 'border-c3/40 text-c3'}`}
                                >
                                  {isActive ? 'disable' : 'enable'}
                                </button>
                              )}
                              {activeSessions.length > 0 && (
                                <span className="font-mono text-[9px] text-c3">{activeSessions.length} online</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Create new account ── */}
              <div className="border border-bg/15 p-5">
                <h3 className="font-display text-[18px] tracking-tightest mb-4">Create new admin account</h3>
                <div className="grid sm:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label htmlFor="apx-f19" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Email</label>
                    <input id="apx-f19"
                      type="email"
                      value={newAccountEmail}
                      onChange={(e) => setNewAccountEmail(e.target.value)}
                      placeholder="staff@aquaterra.org"
                      className="w-full bg-bg/6 border border-bg/20 px-3 py-2 font-mono text-[12px] outline-none focus:border-c2"
                    />
                  </div>
                  <div>
                    <label htmlFor="apx-f20" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Display name</label>
                    <input id="apx-f20"
                      type="text"
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      placeholder="Priya Sharma"
                      className="w-full bg-bg/6 border border-bg/20 px-3 py-2 font-mono text-[12px] outline-none focus:border-c2"
                    />
                  </div>
                  <div>
                    <label htmlFor="apx-f21" className="font-mono text-[10px] uppercase opacity-55 block mb-1">Password</label>
                    <input id="apx-f21"
                      type="password"
                      value={newAccountPassword}
                      onChange={(e) => setNewAccountPassword(e.target.value)}
                      placeholder="min 6 characters"
                      className="w-full bg-bg/6 border border-bg/20 px-3 py-2 font-mono text-[12px] outline-none focus:border-c2"
                    />
                  </div>
                </div>

                {/* Permission toggles */}
                {/* Role preset picker — clicking a role applies a bundle of
                    permission booleans to the checkbox row below. The admin can
                    still fine-tune individual checkboxes afterwards. */}
                <div className="mb-4">
                  <div className="font-mono text-[10px] uppercase opacity-55 mb-2">Role preset</div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(ROLE_LABELS) as RoleName[]).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setNewAccountRole(r)
                          setNewAccountPerms(ROLE_PRESETS[r])
                        }}
                        className={`flex flex-col items-start gap-0.5 px-3 py-2 border cursor-pointer font-mono text-[10px] uppercase tracking-[0.06em] transition-colors text-left active:scale-[0.97] ${
                          newAccountRole === r
                            ? 'border-c2 text-c2 bg-c2/10'
                            : 'border-bg/20 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <span className="font-semibold tracking-[0.08em]">{ROLE_LABELS[r]}</span>
                        <span className="font-mono text-[9px] tracking-normal normal-case opacity-70 max-w-[180px]">
                          {ROLE_DESCRIPTIONS[r]}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <div className="font-mono text-[10px] uppercase opacity-55 mb-2">
                    Permissions <span className="opacity-50">(fine-tune individual tabs)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(TAB_LABELS) as TabKey[]).filter(t => t !== 'accounts').map((t) => (
                      <label key={t} className={`flex items-center gap-1.5 px-2.5 py-1.5 border cursor-pointer font-mono text-[10px] uppercase tracking-[0.06em] transition-colors ${
                        newAccountPerms[t] ? 'border-c2 text-c2 bg-c2/10' : 'border-bg/20 opacity-50 hover:opacity-80'
                      }`}>
                        <input
                          type="checkbox"
                          checked={newAccountPerms[t]}
                          onChange={(e) => setNewAccountPerms((p) => ({ ...p, [t]: e.target.checked }))}
                          className="w-3 h-3 accent-c2"
                        />
                        {TAB_LABELS[t]}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  disabled={creatingAccount || !newAccountEmail || !newAccountPassword}
                  onClick={async () => {
                    if (!newAccountEmail || newAccountPassword.length < 6) {
                      warning('Invalid input', 'Email required and password must be at least 6 characters')
                      return
                    }
                    setCreatingAccount(true)
                    try {
                      // Step 1: Create auth user via secure DB function (SECURITY DEFINER)
                      const { data: rpcResult, error: rpcErr } = await supabase.rpc('create_auth_user', {
                        p_email: newAccountEmail,
                        p_password: newAccountPassword,
                      })
                      if (rpcErr || rpcResult?.error) {
                        toastError('Creation failed', rpcResult?.error ?? rpcErr?.message)
                        setCreatingAccount(false)
                        return
                      }
                      // Step 2: Insert permissions row — if this fails, we delete the auth user
                      // (via delete_auth_user RPC) to avoid an orphan auth.users row sitting around
                      // with no admin permissions row. Without this rollback the email would be
                      // unusable (unique constraint) until a super admin cleans it up manually.
                      const { data: newPermsRow, error: permsErr } = await supabase
                        .from('paradox_admin_permissions')
                        .insert({
                          user_email: newAccountEmail,
                          display_name: newAccountName || null,
                          created_by: session?.user?.email,
                          role: newAccountRole,
                          permissions: newAccountPerms,
                          is_active: true,
                        }).select('*').single()
                      if (permsErr) {
                        // Try to roll back the auth.users insert from step 1.
                        const { data: delResult, error: delErr } = await supabase.rpc('delete_auth_user', {
                          p_user_id: rpcResult.id,
                        })
                        if (delErr || delResult?.error) {
                          // Best-effort: surface both failures so a super admin can clean up manually.
                          toastError(
                            'Creation failed (orphan!)',
                            `Permissions error: ${permsErr.message}. Cleanup also failed: ${delResult?.error ?? delErr?.message}. Delete ${newAccountEmail} manually from auth.users.`,
                          )
                        } else {
                          toastError('Creation failed', `Permissions insert failed (${permsErr.message}). Auth user rolled back — safe to retry.`)
                        }
                        setCreatingAccount(false)
                        return
                      }
                      if (newPermsRow) setAdminUsers((p) => [...p, newPermsRow as AdminUser])
                      // Step 3: Add to auth users view list
                      setAuthUsers((p) => [...p, { id: rpcResult.id, email: newAccountEmail, created_at: new Date().toISOString(), last_sign_in_at: null }])
                      success('Account created', newAccountEmail)
                      logAudit('create_account', 'account', rpcResult.id, { email: newAccountEmail, name: newAccountName })
                      setNewAccountEmail('')
                      setNewAccountName('')
                      setNewAccountPassword('')
                      setNewAccountRole('coordinator')
                      setNewAccountPerms(ROLE_PRESETS.coordinator)
                    } catch (e) {
                      toastError('Creation failed', (e as Error).message)
                    }
                    setCreatingAccount(false)
                  }}
                  className="bg-c1 text-white px-5 py-2.5 min-h-[40px] font-mono text-[11px] uppercase tracking-[0.08em] disabled:opacity-40 hover:brightness-110 active:scale-[0.96] transition-transform flex items-center gap-2"
                >
                  {creatingAccount && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>}
                  {creatingAccount ? 'Creating…' : 'Create Account →'}
                </button>
              </div>
            </section>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}

// ─── Barcode scanner overlay ───────────────────────────────────────────────
function BarcodeScannerOverlay({
  onScan,
  onClose,
}: {
  onScan: (code: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(true)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const stop = useCallback(() => {
    readerRef.current?.reset()
    readerRef.current = null
  }, [])

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader.listVideoInputDevices()
      .then((devices) => {
        if (devices.length === 0) {
          setError('No camera found on this device.')
          return
        }
        // Prefer back camera on mobile
        const back = devices.find((d) =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('environment')
        )
        const deviceId = back?.deviceId ?? devices[0].deviceId

        reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result, err) => {
          if (result) {
            const text = result.getText()
            setLastResult(text)
            setScanning(false)
            // Brief flash then hand off
            setTimeout(() => onScan(text), 400)
          }
          if (err && !(err.message?.includes('No MultiFormat'))) {
            // Suppress normal "no barcode found" errors — they fire constantly
          }
        })
      })
      .catch(() => setError('Camera permission denied. Allow camera access and try again.'))

    return () => { stop() }
  }, [onScan, stop])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-ink/95 flex flex-col items-center justify-center p-6"
    >
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className="font-mono text-[10px] text-bg/50 uppercase tracking-[0.14em]">check-in scanner</div>
            <div className="font-display font-semibold text-[24px] text-bg leading-tight mt-0.5">
              point at barcode
            </div>
          </div>
          <button
            onClick={() => { stop(); onClose() }}
            className="w-9 h-9 rounded-full border border-bg/30 text-bg flex items-center justify-center font-mono text-sm hover:border-bg/60"
          >
            ✕
          </button>
        </div>

        {/* Viewfinder */}
        <div className="relative aspect-[3/2] bg-black border-[1.5px] border-bg/20 overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />

          {/* Corner brackets */}
          {!lastResult && scanning && (
            <>
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-c2" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-c2" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-c2" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-c2" />
              {/* Scanning line — animate `y` (transform) instead of `top`
                  (layout property) so the browser composites this on the GPU
                  instead of re-laying-out the parent every frame. The element
                  is anchored at top:20% and translates ~60% of its parent height. */}
              <motion.div
                animate={{ y: ['0%', '300%', '0%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute left-4 right-4 h-[1.5px] bg-c2/70"
                style={{ top: '20%', willChange: 'transform' }}
              />
            </>
          )}

          {/* Success flash */}
          {lastResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-c2/30 flex items-center justify-center"
            >
              <div className="bg-c2 text-ink px-4 py-2 font-mono text-[13px] font-bold">
                ✓ {lastResult}
              </div>
            </motion.div>
          )}
        </div>

        {error ? (
          <div className="mt-4 font-mono text-[12px] text-c1 text-center">{error}</div>
        ) : (
          <div className="mt-3 font-mono text-[11px] text-bg/40 text-center">
            {lastResult ? 'found — loading…' : 'align the barcode within the frame'}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Settings row ──────────────────────────────────────────────────────────
// One row per site setting. Holds local draft state so the user can type
// without auto-firing a save on every keystroke or blur (the previous
// `defaultValue` + `onBlur` pattern silently saved on focus change and was
// what the user described as the "old apply way"). Now: explicit Apply button,
// visible dirty indicator, Reset to discard. BOOL and SELECT keys still save
// instantly because there's no draft to commit.
type SettingItem = { key: string; value: any; updated_at?: string }
type SaveResult = { ok: boolean; error?: string }

/**
 * Pinned setting row for the WhatsApp group URL. Extracted out of the
 * Settings tab JSX so the `useState` calls live inside a real component
 * (the previous IIFE pattern was a Rules of Hooks violation — worked
 * under @ts-nocheck, but fragile under any conditional wrapping).
 *
 * Stateless about the save mechanics — receives `onSave(next): Promise<{ ok, error? }>`
 * from the parent so toasts + audit logging stay scoped to AdminPage's
 * useToast / logAudit context. Re-syncs when `value` prop changes so a
 * realtime update from another admin populates the input correctly.
 */
/**
 * ApEditModal — fix typos or change phase on an after-party row. Every
 * field IS editable except `ap_id` (it's printed on the barcode and may
 * already be in the registrant's hands; changing it would invalidate
 * the ticket). Phase change auto-recalculates `amount` from the phase
 * pricing table; the admin can override the amount after if needed
 * (refund, comp, partial-payment edge case).
 */
function ApEditModal({
  reg,
  phases,
  onClose,
  onSave,
}: {
  reg: AfterPartyReg
  phases: AfterPartyPhaseConfig[]
  onClose: () => void
  onSave: (patch: Partial<AfterPartyReg>) => Promise<void>
}) {
  const [form, setForm] = useState({
    name: reg.name,
    phone: reg.phone,
    school: reg.school ?? '',
    phase: reg.phase,
    amount: reg.amount?.toString() ?? '',
    paid: reg.paid,
    notes: reg.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  // When the phase changes, auto-fill the amount with the phase price
  // (admin can still override after). Keeps phase + amount visually in
  // sync as the dropdown moves.
  const onPhaseChange = (next: AfterPartyReg['phase']) => {
    const phaseInfo = phases.find((p) => p.key === next)
    setForm((f) => ({ ...f, phase: next, amount: phaseInfo ? String(phaseInfo.amount) : f.amount }))
  }

  const handleSave = async () => {
    if (!form.name.trim() || !form.phone.trim()) return
    setSaving(true)
    const parsedAmount = form.amount.trim() === '' ? null : parseInt(form.amount, 10)
    await onSave({
      name: form.name.trim(),
      phone: form.phone.trim(),
      school: form.school.trim() || null,
      phase: form.phase,
      amount: Number.isFinite(parsedAmount as number) ? (parsedAmount as number) : null,
      paid: form.paid,
      notes: form.notes.trim() || null,
    })
    setSaving(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26, bounce: 0 }}
        style={{
          width: '100%', maxWidth: 460,
          background: 'var(--bg)', color: 'var(--ink)',
          border: '2px solid var(--ink)',
          boxShadow: '5px 5px 0 var(--c2)',
          padding: 24,
          position: 'relative',
          maxHeight: '90dvh', overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          style={{
            position: 'absolute', top: 8, right: 8,
            minWidth: 40, minHeight: 40,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 0, cursor: 'pointer',
            fontSize: 18, fontWeight: 900, color: 'var(--ink)',
          }}
        >×</button>

        <div className="font-mono uppercase tracking-[0.14em] text-[10px] opacity-55" style={{ marginBottom: 4 }}>
          ✎ Edit Registration
        </div>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>
          {reg.ap_id}
        </div>
        <div className="font-mono text-[11px] opacity-50 uppercase tracking-[0.08em]" style={{ marginBottom: 14 }}>
          AP-ID is permanent — barcode already issued
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] opacity-60">Name *</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full bg-bg/8 border border-bg/20 rounded-lg text-ink px-3 py-2.5 font-body text-base outline-none focus:border-c2"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] opacity-60">Phone *</span>
            <input
              type="tel" inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full bg-bg/8 border border-bg/20 rounded-lg text-ink px-3 py-2.5 font-body text-base outline-none focus:border-c2"
            />
          </label>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] opacity-60">School <span className="opacity-60 normal-case tracking-normal">(optional)</span></span>
            <input
              type="text"
              value={form.school}
              onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
              className="mt-1 w-full bg-bg/8 border border-bg/20 rounded-lg text-ink px-3 py-2.5 font-body text-base outline-none focus:border-c2"
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] opacity-60">Phase</span>
              <select
                value={form.phase}
                onChange={(e) => onPhaseChange(e.target.value as AfterPartyReg['phase'])}
                className="mt-1 w-full bg-bg/8 border border-bg/20 rounded-lg text-ink px-3 py-2.5 font-mono text-[12px] outline-none focus:border-c2"
              >
                {phases.map((p) => (
                  <option key={p.key} value={p.key}>{p.label} · ₹{p.amount}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] opacity-60">Amount (₹)</span>
              <input
                type="number" inputMode="numeric"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="mt-1 w-full bg-bg/8 border border-bg/20 rounded-lg text-ink px-3 py-2.5 font-mono text-base tabular-nums outline-none focus:border-c2"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.paid}
              onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
              style={{ accentColor: '#25D366', width: 16, height: 16 }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] opacity-80">Paid</span>
          </label>

          <label className="block">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] opacity-60">Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="mt-1 w-full bg-bg/8 border border-bg/20 rounded-lg text-ink px-3 py-2.5 font-body text-base outline-none focus:border-c2 resize-y"
              placeholder="anything to remember…"
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button
            onClick={onClose}
            className="flex-1 rounded-full font-mono text-[11px] uppercase tracking-[0.06em] py-3 min-h-[44px] active:scale-[0.96] transition-[background-color,transform]"
            style={{ border: '1.5px solid var(--ink)', background: 'transparent', color: 'var(--ink)', fontWeight: 700 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.phone.trim()}
            className="flex-1 rounded-full font-mono text-[11px] uppercase tracking-[0.06em] py-3 min-h-[44px] active:scale-[0.96] transition-[background-color,transform] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--c2)', color: 'var(--ink)', border: '1.5px solid var(--c2)', fontWeight: 700 }}
          >
            {saving ? '…' : '✓ Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/**
 * ApTicketModal — compact text-only ticket panel. No QR, no canvas image.
 * Shows the booking details (AP-ID, name, phone, school, phase, amount)
 * plus a "Copy ID" button for the bare AP-ID and a "Copy this booking's
 * message" button (wired by parent via onCopyAll) for the full thank-you.
 * Bulk consolidated messages happen from the selection bar on the table,
 * not this modal.
 */
function ApTicketModal({ reg, phases, onClose, onCopyAll }: { reg: AfterPartyReg; phases: AfterPartyPhaseConfig[]; onClose: () => void; onCopyAll?: () => void }) {
  const [copiedFlash, setCopiedFlash] = useState(false)
  const phaseInfo = phases.find((p) => p.key === reg.phase)

  const handleCopy = () => {
    navigator.clipboard.writeText(reg.ap_id).then(() => {
      setCopiedFlash(true)
      setTimeout(() => setCopiedFlash(false), 1500)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(10,10,10,0.88)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26, bounce: 0 }}
        style={{
          width: '100%', maxWidth: 400,
          background: 'var(--bg)', color: 'var(--ink)',
          border: '2px solid var(--ink)',
          boxShadow: '5px 5px 0 var(--c3)',
          padding: 24,
          position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close"
          style={{
            position: 'absolute', top: 8, right: 8,
            minWidth: 40, minHeight: 40, display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 0, cursor: 'pointer',
            fontSize: 18, fontWeight: 900, color: 'var(--ink)',
          }}
        >×</button>

        <div className="font-mono uppercase tracking-[0.14em] text-[10px] opacity-55" style={{ marginBottom: 4 }}>
          ★ Paradox 2026 · After Party
        </div>
        <div className="font-display tabular-nums" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12, color: 'var(--c1)' }}>
          {reg.ap_id}
        </div>

        {/* Booking details — text-only, no QR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginBottom: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.55, fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Name</span>
            <span style={{ fontWeight: 600 }}>{reg.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.55, fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phone</span>
            <span style={{ fontFamily: 'var(--mono)' }}>{reg.phone}</span>
          </div>
          {reg.school && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.55, fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>School</span>
              <span>{reg.school}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.55, fontFamily: 'var(--mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Phase</span>
            <span>{phaseInfo?.label ?? reg.phase} · ₹{reg.amount ?? phaseInfo?.amount ?? '—'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {/* Primary — copy the full thank-you message (single-ticket
              template, since this modal is per-row). Bulk consolidated
              messages happen from the table's selection bar instead. */}
          {onCopyAll && (
            <button
              onClick={onCopyAll}
              className="rounded-full font-mono text-[11px] uppercase tracking-[0.06em] py-3 min-h-[44px] active:scale-[0.96] transition-[background-color,transform]"
              style={{ background: '#25D366', color: '#0A0A0A', border: '1.5px solid #25D366', fontWeight: 700 }}
            >
              📋 Copy thank-you message
            </button>
          )}
          <button
            onClick={handleCopy}
            className="rounded-full font-mono text-[11px] uppercase tracking-[0.06em] py-3 min-h-[44px] active:scale-[0.96] transition-[background-color,transform]"
            style={{
              border: '1.5px solid var(--ink)',
              background: copiedFlash ? 'var(--c2)' : 'transparent',
              color: 'var(--ink)',
              fontWeight: 700,
            }}
          >
            {copiedFlash ? '✓ Copied' : 'Copy AP-ID only'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function WhatsAppGroupSetting({
  value,
  onSave,
}: {
  value: string
  onSave: (next: string) => Promise<SaveResult>
}) {
  const [val, setVal] = React.useState(value)
  const [saving, setSaving] = React.useState(false)
  React.useEffect(() => { setVal(value) }, [value])

  const save = async () => {
    setSaving(true)
    await onSave(val.trim())
    setSaving(false)
  }

  return (
    <div className="px-5 py-4 border-b border-bg/10" style={{ background: 'rgba(37,211,102,0.08)' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase" style={{ color: '#25D366' }}>★ whatsapp group link</span>
        <span className="font-mono text-[10px] opacity-35">— reflected everywhere on the site</span>
      </div>
      <div className="flex gap-2">
        <input
          type="url"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="https://chat.whatsapp.com/..."
          className="flex-1 bg-transparent border border-bg/20 text-bg px-3 py-2 font-body text-sm outline-none focus:border-[#25D366] rounded"
        />
        <button
          disabled={saving || !val.trim()}
          onClick={save}
          className="px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] disabled:opacity-40 transition-opacity"
          style={{ background: '#25D366', color: '#0A0A0A', borderRadius: 6, minHeight: 40 }}
        >
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function SettingRow({
  setting,
  onSave,
}: {
  setting: SettingItem
  onSave: (key: string, value: any) => Promise<SaveResult>
}) {
  const TEXT_KEYS = [
    'event_dates', 'upi_qr_url', 'afterparty_price_phase1',
    'afterparty_price_phase2', 'afterparty_price_door',
    'afterparty_venue', 'afterparty_date', 'afterparty_dresscode',
    'hero_countdown_target',
  ]
  const MONO_TEXT_KEYS = ['upi_id']
  const SELECT_KEYS = ['site_phase']
  const BOOL_KEYS = ['registration_open']
  const TEXTAREA_KEYS = ['whatsapp_payment_msg']

  const initialDisplay =
    typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value)
  const initialJson =
    typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value, null, 2)

  // Draft state per row. Resets whenever the parent feeds us a new `setting`
  // (e.g. after a successful save, or when realtime delivers a new row).
  const [draft, setDraft] = useState<string>(initialDisplay)
  const [jsonDraft, setJsonDraft] = useState<string>(initialJson)
  const [saving, setSaving] = useState(false)

  // Adjusted during render (same prevBase technique as components/Img.tsx)
  // instead of an effect, so a new incoming `setting` lands in the same
  // render rather than a tick later.
  const [prevInitialDisplay, setPrevInitialDisplay] = useState(initialDisplay)
  const [prevInitialJson, setPrevInitialJson] = useState(initialJson)
  if (initialDisplay !== prevInitialDisplay || initialJson !== prevInitialJson) {
    setPrevInitialDisplay(initialDisplay)
    setPrevInitialJson(initialJson)
    setDraft(initialDisplay)
    setJsonDraft(initialJson)
  }

  const inputClass =
    'w-full bg-bg/8 border border-bg/20 rounded-lg text-bg font-body text-base sm:text-[13px] px-3 py-2.5 outline-none focus:border-c2 focus:ring-1 focus:ring-c2/30 transition-[border-color,box-shadow]'

  const labelEl = (hint?: string, dirty?: boolean) => (
    <div className="flex items-center gap-3 mb-2">
      <span className="font-mono text-[11px] tracking-[0.1em] uppercase opacity-70">
        {setting.key}
      </span>
      {hint && (
        <span className="font-mono text-[9px] tracking-[0.08em] uppercase opacity-35 border border-bg/20 px-1.5 py-0.5">
          {hint}
        </span>
      )}
      {dirty && (
        <span className="font-mono text-[9px] tracking-[0.08em] uppercase text-c2 border border-c2/40 px-1.5 py-0.5">
          unsaved
        </span>
      )}
    </div>
  )

  // Reusable apply / reset row for text-style inputs. A render-function
  // (not a <Component/>) so it is not re-created as a component each render.
  const applyRow = ({
    currentDraft,
    parsedValue,
    onReset,
  }: {
    currentDraft: string
    parsedValue: any
    onReset: () => void
  }) => {
    const dirty = currentDraft !== initialDisplay && currentDraft !== initialJson
    if (!dirty) return null
    return (
      <div className="flex gap-2 mt-2">
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            await onSave(setting.key, parsedValue)
            setSaving(false)
          }}
          className="bg-c2 text-ink px-3 py-1.5 min-h-[44px] sm:min-h-[36px] font-mono text-[10px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Apply'}
        </button>
        <button
          disabled={saving}
          onClick={onReset}
          className="border border-bg/20 text-bg px-3 py-1.5 min-h-[36px] font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-bg/5 active:scale-[0.96] transition-transform disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    )
  }

  // ── Boolean toggle — saves instantly ──
  if (BOOL_KEYS.includes(setting.key)) {
    const isOpen = setting.value === true || setting.value === 'true'
    return (
      <div className="border-b border-bg/10 px-5 py-4">
        {labelEl('toggle')}
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            await onSave(setting.key, !isOpen)
            setSaving(false)
          }}
          className={`inline-flex items-center gap-2.5 px-4 py-2 font-mono text-[12px] font-semibold tracking-[0.06em] uppercase transition-colors border ${
            isOpen
              ? 'bg-c2/20 border-c2 text-c2'
              : 'bg-c1/20 border-c1 text-c1'
          } disabled:opacity-50`}
        >
          <span className={`w-3 h-3 rounded-full ${isOpen ? 'bg-c2' : 'bg-c1'}`} />
          {isOpen ? 'Open' : 'Closed'}
        </button>
        <div className="font-mono text-[10px] opacity-40 mt-1.5">
          Click to toggle — saves immediately
        </div>
      </div>
    )
  }

  // ── Select — saves instantly ──
  if (SELECT_KEYS.includes(setting.key)) {
    return (
      <div className="border-b border-bg/10 px-5 py-4">
        {labelEl('select')}
        <select
          value={initialDisplay}
          disabled={saving}
          onChange={async (e) => {
            setSaving(true)
            await onSave(setting.key, e.target.value)
            setSaving(false)
          }}
          className={inputClass + ' cursor-pointer bg-ink disabled:opacity-50'}
        >
          <option value="pre_event">pre_event</option>
          <option value="live">live</option>
          <option value="post_event">post_event</option>
        </select>
        <div className="font-mono text-[10px] opacity-40 mt-1">
          Controls phase-gated nav and feature visibility
        </div>
      </div>
    )
  }

  // ── Textarea (multi-line) — explicit Apply ──
  if (TEXTAREA_KEYS.includes(setting.key)) {
    const dirty = draft !== initialDisplay
    return (
      <div className="border-b border-bg/10 px-5 py-4">
        {labelEl('textarea', dirty)}
        <textarea
          value={draft}
          rows={4}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass + ' resize-y'}
        />
        {applyRow({
          currentDraft: draft,
          parsedValue: draft,
          onReset: () => setDraft(initialDisplay),
        })}
      </div>
    )
  }

  // ── Mono text — explicit Apply ──
  if (MONO_TEXT_KEYS.includes(setting.key)) {
    const dirty = draft !== initialDisplay
    return (
      <div className="border-b border-bg/10 px-5 py-4">
        {labelEl('text · mono', dirty)}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass + ' font-mono tracking-wider'}
        />
        {applyRow({
          currentDraft: draft,
          parsedValue: draft,
          onReset: () => setDraft(initialDisplay),
        })}
      </div>
    )
  }

  // ── Plain text — explicit Apply ──
  if (TEXT_KEYS.includes(setting.key)) {
    const hint =
      setting.key === 'upi_qr_url'
        ? 'url'
        : setting.key === 'hero_countdown_target'
        ? 'ISO date'
        : 'text'
    const dirty = draft !== initialDisplay
    return (
      <div className="border-b border-bg/10 px-5 py-4">
        {labelEl(hint, dirty)}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className={inputClass}
        />
        {applyRow({
          currentDraft: draft,
          parsedValue: draft,
          onReset: () => setDraft(initialDisplay),
        })}
      </div>
    )
  }

  // ── Raw JSON fallback — parses on Apply ──
  const dirty = jsonDraft !== initialJson
  const lineCount = jsonDraft.split('\n').length + 4
  let parseError: string | null = null
  let parsed: any = null
  if (dirty) {
    try {
      parsed = JSON.parse(jsonDraft)
    } catch (err) {
      parseError = (err as Error).message
    }
  }
  return (
    <div className="border-b border-bg/10 px-5 py-4">
      {labelEl('raw json', dirty)}
      <textarea
        value={jsonDraft}
        rows={Math.min(12, lineCount)}
        onChange={(e) => setJsonDraft(e.target.value)}
        className="w-full bg-bg/5 border border-bg/20 text-bg font-mono text-[12px] p-3 outline-none focus:border-c2 resize-y"
      />
      {parseError && (
        <div className="font-mono text-[10px] text-c1 mt-1">Invalid JSON: {parseError}</div>
      )}
      {dirty && (
        <div className="flex gap-2 mt-2">
          <button
            disabled={saving || !!parseError}
            onClick={async () => {
              if (parseError) return
              setSaving(true)
              await onSave(setting.key, parsed)
              setSaving(false)
            }}
            className="bg-c2 text-ink px-3 py-1.5 min-h-[44px] sm:min-h-[36px] font-mono text-[10px] tracking-[0.08em] uppercase hover:brightness-110 active:scale-[0.96] transition-transform disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Apply'}
          </button>
          <button
            disabled={saving}
            onClick={() => setJsonDraft(initialJson)}
            className="border border-bg/20 text-bg px-3 py-1.5 min-h-[36px] font-mono text-[10px] tracking-[0.08em] uppercase hover:bg-bg/5 active:scale-[0.96] transition-transform disabled:opacity-50"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  )
}
