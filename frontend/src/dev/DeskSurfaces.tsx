import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import AuthContext from '../auth/AuthContext'
import CapabilityContext from '../auth/CapabilityContext'
import { effectiveCan, matrixCellKey, CAPABILITIES, type CapabilityRole } from '../lib/capabilities'
import type { DirectorContext } from '../director/DirectorDashboard'
import { isSuperAdmin as isSuperAdminRole } from '../lib/roles'
import { directorService } from '../services/directorService'
import { teamService } from '../services/teamService'
import breakService from '../services/breakService'
import { todayISO } from '../lib/breakWindows'
import { installVerifyStubs, viewerMember, type Scenario } from './deskVerifyKit'
import '../styles/routes/director.css'

/**
 * /dev/desk — the HoD desk preview harness.
 *
 * Mounts HoD desks with no session, no network and no database. Rules, unchanged:
 *
 *   - No production component gains a mock code path; nothing under `director/` is
 *     edited for this.
 *   - Network is off: `window.fetch` rejects while this route is mounted.
 *   - DEV only: the route is behind `import.meta.env.DEV` in App.tsx.
 *   - Every fixture is obviously synthetic (`@example.invalid`, `+91 00000 …`).
 *
 * WHAT CHANGED (verification pass): the data layer is no longer a set of swapped
 * service methods but an in-memory PostgREST fake (`deskVerifyKit.ts`) underneath the
 * REAL services, so search strings, keyset cursors, status guards and "already
 * decided" paths run for real. Writes mutate the in-memory tables (or throw, with the
 * `writes` switch). The viewer's role and the capability matrix are switchable, either
 * with the chips below or by URL: /dev/desk?desk=members&role=hr&off=action.assign_role
 *
 *   ?desk=<id>  ?role=hod|director|hr|super_admin  ?scenario=populated|empty|loading|error
 *   ?off=<capability keys, comma separated>   ?writes=fake|throw   ?shell=1 (wrap the desk in the real DirectorDashboard)
 *
 * Handles for scripts: window.__dev (see deskVerifyKit.ts).
 *
 * Still deliberately awkward fixtures: a name longer than its column, an email longer
 * than any sane column, no avatar, a break, an archive, a soft delete.
 */

function authValue(member: any) {
  return {
    member,
    isLoading: false,
    isAuthenticated: !!member,
    memberLoadFailed: false,
    logout: async () => {},
    refreshMember: async () => {},
  }
}

const PENDING_POSTS = [
  {
    postId: 9201, uuid: 'fixture-post-1', category: 'welfare',
    body: 'A short pending post.\n\nOne paragraph under it.',
    authorName: 'Test Member', authorAvatar: null, authorRole: 'member',
    createdAt: '2026-09-16T10:00:00Z', imageUrls: [], teamName: null,
  },
  {
    postId: 9202, uuid: 'fixture-post-2', category: 'events',
    body: 'A pending post written as a single unbroken paragraph with no blank line anywhere in it, which is the exact shape that the feed used to render as a seventeen-line headline before the length guard was applied to the card families.',
    authorName: 'Placeholder With A Deliberately Long Name', authorAvatar: null,
    authorRole: 'hod', createdAt: '2026-09-17T10:00:00Z', imageUrls: [], teamName: 'Welfare Projects',
  },
]

// Shape matches what TeamManagement reads off teamService.getTeams().
const TEAM_ROWS = [
  { uuid: 'fixture-team-1', name: 'Welfare Projects', category: 'welfare', memberCount: 56, logoUrl: null,
    description: 'The oldest and largest department.' },
  { uuid: 'fixture-team-2', name: 'Events', category: 'events', memberCount: 2, logoUrl: null,
    description: 'A deliberately long department description, one unbroken sentence, so the card has to decide what to do with it rather than being handed something that fits by luck.' },
  { uuid: 'fixture-team-3', name: 'A Department With A Deliberately Long Name', category: 'operations',
    memberCount: 0, logoUrl: null, description: null },
] as any[]

const SCENARIOS: { id: Scenario; label: string; note: string }[] = [
  { id: 'populated', label: 'populated', note: 'the rows, including the awkward ones' },
  { id: 'empty', label: 'empty', note: 'zero rows and no error — the state that must NOT read as a failure' },
  { id: 'loading', label: 'loading', note: 'the read never settles, so skeletons stay up' },
  { id: 'error', label: 'error', note: 'the read throws — this must never render as "nothing here yet"' },
]

const ROLES = ['hod', 'director', 'hr', 'super_admin'] as const
const ACTION_CAPS = CAPABILITIES.filter(c => c.key.startsWith('action.')).map(c => c.key)

// ── desks ───────────────────────────────────────────────────────────────────
// Lazy so a desk that fails to mount cannot take the picker down with it. New imports are
// DEV-conditional so Rollup drops them from a production build (CLAUDE.md, preview harnesses).
const Placeholder = () => null
const MemberDirectory = lazy(() => import('../director/MemberDirectory'))
const ProductGuide = lazy(() => import('../director/ProductGuide'))
const AccountApprovals = lazy(() => import('../director/AccountApprovals'))
const PostModeration = lazy(() => import('../director/PostModeration'))
const VolunteerApplications = lazy(() => import('../director/VolunteerApplications'))
const CertificateRequests = lazy(() => import('../director/CertificateRequests'))
const TeamManagement = lazy(() => import('../director/TeamManagement'))
const DirectorLanding = lazy(() => import('../director/DirectorLanding'))
const HiringResponses = import.meta.env.DEV ? lazy(() => import('../director/HiringResponses')) : Placeholder
const ActivityLog = import.meta.env.DEV ? lazy(() => import('../director/ActivityLog')) : Placeholder
const BlogDrafts = import.meta.env.DEV ? lazy(() => import('../director/BlogDrafts')) : Placeholder
const MemberOfMonth = import.meta.env.DEV ? lazy(() => import('../director/MemberOfMonth')) : Placeholder
const DirectorDashboard = import.meta.env.DEV ? lazy(() => import('../director/DirectorDashboard')) : Placeholder

const DESKS: { id: string; label: string; note: string; el: ReactNode; shell?: boolean }[] = [
  { id: 'landing', label: 'Desk home', note: 'what needs you today: one slab, one set of counts', el: <DirectorLanding /> },
  { id: 'shell', label: 'Shell + home', note: 'the REAL DirectorDashboard (rail with badges) around the landing', el: <DirectorLanding />, shell: true },
  { id: 'members', label: 'Members', note: 'the 7-column table and its card fallback — the widest thing on the desk', el: <MemberDirectory /> },
  { id: 'guide', label: 'Product guide', note: 'the generated guide in a sandboxed frame; it ignores the scenario switch', el: <ProductGuide /> },
  { id: 'approvals', label: 'Approvals', note: 'pending / contacted / all / rejected / shared phones', el: <AccountApprovals /> },
  { id: 'posts', label: 'Post Queue', note: 'moderation cards, long bodies, category tags', el: <PostModeration /> },
  { id: 'volunteers', label: 'Vol. Applications', note: 'the other wide table (7 cols)', el: <VolunteerApplications /> },
  { id: 'certificates', label: 'Certificates', note: 'request rows with decisions', el: <CertificateRequests /> },
  { id: 'teams', label: 'Teams', note: 'team cards and rosters', el: <TeamManagement /> },
  { id: 'hiring', label: 'Hiring', note: 'applications to openings, accept / reject', el: <HiringResponses /> },
  { id: 'activity', label: 'Activity Log', note: 'audit rows, cron rows hidden by default', el: <ActivityLog /> },
  { id: 'blogs', label: 'Blog Drafts', note: 'drafts and live-and-scheduled', el: <BlogDrafts /> },
  { id: 'mom', label: 'Member of Month', note: 'the team picker and the queued-month note', el: <MemberOfMonth /> },
]

const qp = (k: string) => { try { return new URLSearchParams(window.location.search).get(k) } catch { return null } }

// ── the harness ─────────────────────────────────────────────────────────────
export default function DeskSurfaces() {
  const [desk, setDesk] = useState(() => DESKS.find(d => d.id === qp('desk'))?.id ?? DESKS[0].id)
  const [scenario, setScenario] = useState<Scenario>(() => (SCENARIOS.find(s => s.id === qp('scenario'))?.id ?? 'populated'))
  const [role, setRole] = useState<string>(() => (ROLES as readonly string[]).includes(qp('role') ?? '') ? (qp('role') as string) : 'super_admin')
  const [off, setOff] = useState<string[]>(() => (qp('off') ?? '').split(',').filter(Boolean))
  const [writes, setWrites] = useState<'fake' | 'throw'>(() => (qp('writes') === 'throw' ? 'throw' : 'fake'))
  const [inShell, setInShell] = useState(() => qp('shell') === '1')
  const [ready, setReady] = useState(false)
  const [w, setW] = useState(typeof window === 'undefined' ? 0 : window.innerWidth)
  const scenarioRef = useRef(scenario); scenarioRef.current = scenario
  const roleRef = useRef(role); roleRef.current = role
  const writesRef = useRef(writes); writesRef.current = writes

  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // HARNESS FIDELITY: the real desk never shows PublicLayout's floating dock.
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-dev-desk', '')
    style.textContent = '.aq-bottom-bar, .aq-bottom-bar-spacer { display: none !important; }'
    document.head.appendChild(style)
    return () => { style.remove() }
  }, [])

  // Everything below is installed per VIEWER ROLE: changing role tears the fake down and
  // re-seeds it (the viewer's own members row decides what getPickableTeams sees).
  useEffect(() => {
    const realFetch = window.fetch
    window.fetch = (() => Promise.reject(new Error('[dev/desk] network is disabled in the preview harness'))) as any
    const restoreKit = installVerifyStubs({
      scenario: () => scenarioRef.current,
      viewerRole: () => roleRef.current,
      writes: () => writesRef.current,
    })

    const ds = directorService as any
    const saved: Record<string, any> = {}
    const swap = (name: string, fn: any) => { saved[name] = ds[name]; ds[name] = fn }
    const settle = <T,>(value: T): Promise<T> => {
      const s = scenarioRef.current
      if (s === 'loading') return new Promise<T>(() => {})
      if (s === 'error') return Promise.reject(new Error('[fixture] read failed'))
      return Promise.resolve(value)
    }
    const rows = <T,>(v: T[]): Promise<T[]> => settle(scenarioRef.current === 'empty' ? [] : v)
    // Post Queue reads a view this fake does not model; its reads stay swapped.
    swap('getPendingPosts', () => settle({
      success: true, data: scenarioRef.current === 'empty' ? [] : PENDING_POSTS,
      pagination: { currentPage: 1, totalPages: 1, totalItems: PENDING_POSTS.length, itemsPerPage: 20, hasNextPage: false, hasPrevPage: false },
    }))
    swap('getMyCategories', () => settle([]))
    swap('getCategoryAssignments', () => rows([]))

    const realGetTeams = (teamService as any).getTeams
    const realTeamWrites: Record<string, any> = {}
    ;(teamService as any).getTeams = () => settle({
      success: true,
      data: scenarioRef.current === 'empty' ? [] : TEAM_ROWS,
      pagination: { currentPage: 1, totalPages: 1, totalItems: TEAM_ROWS.length, itemsPerPage: 50, hasNextPage: false, hasPrevPage: false },
    })
    for (const k of ['createTeam', 'updateTeam', 'deleteTeam']) {
      realTeamWrites[k] = (teamService as any)[k]
      ;(teamService as any)[k] = async () => { throw new Error(`[dev/desk] teamService.${k}() is disabled in the preview harness`) }
    }

    const realBreaks = (breakService as any).listCurrentAndUpcoming
    const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return todayISO(d) }
    ;(breakService as any).listCurrentAndUpcoming = () => rows([
      { id: 1, memberId: 11, start: dayOffset(-9), end: dayOffset(4), reason: 'boards', note: 'back for the november drive', fullName: 'Ananya Sen', avatarUrl: null },
      { id: 2, memberId: 12, start: dayOffset(-2), end: dayOffset(20), reason: 'college exams', note: null, fullName: 'Rohan Das', avatarUrl: null },
    ])

    setReady(true)
    return () => {
      setReady(false)
      restoreKit()
      window.fetch = realFetch
      for (const k of Object.keys(saved)) ds[k] = saved[k]
      ;(teamService as any).getTeams = realGetTeams
      for (const k of Object.keys(realTeamWrites)) (teamService as any)[k] = realTeamWrites[k]
      ;(breakService as any).listCurrentAndUpcoming = realBreaks
    }
  }, [role])

  const member = useMemo(() => viewerMember(role), [role])
  const authVal = useMemo(() => authValue(member), [member])
  const matrix = useMemo(() => {
    const m: Record<string, boolean> = {}
    for (const k of off) m[matrixCellKey(k, role as CapabilityRole)] = false
    return m
  }, [off, role])
  const capVal = useMemo(() => ({
    matrix, ready: true, error: null, refresh: async () => {},
    can: (k: string) => effectiveCan(matrix, k, role),
  }), [matrix, role])
  const isTop = isSuperAdminRole(role)
  const ctx: DirectorContext = useMemo(() => ({
    stats: {
      pendingMemberApprovals: 25, pendingPostReviews: 2, pendingEnquiries: 3, pendingApplications: 5,
      totalActiveMembers: 120, totalPublishedPosts: 584,
    } as any,
    statsError: false, canApproveMembers: isTop, isSuperAdmin: isTop,
    myCategories: [], myTeamIds: [], myScopeTeamIds: [], scopedPendingPosts: null,
  }), [isTop])

  const active = DESKS.find(d => d.id === desk) ?? DESKS[0]
  const band = w <= 600 ? 'phone' : w <= 1024 ? 'tablet' : 'desktop'
  const toggleCap = (k: string) => setOff(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k])
  const chip = (on: boolean, extra: object = {}) => ({
    padding: '6px 10px', minHeight: 36, borderRadius: 999, cursor: 'pointer',
    border: '1px solid rgba(10,10,10,0.15)', background: on ? 'var(--lemon, #FFC700)' : 'transparent',
    fontFamily: 'var(--mono, monospace)', fontSize: 11, ...extra,
  })

  const body = (active.shell || inShell) ? (
    <Routes>
      <Route path="*" element={<DirectorDashboard />}>
        <Route index element={<>{active.el}</>} />
        <Route path="*" element={<>{active.el}</>} />
      </Route>
    </Routes>
  ) : (
    <Routes>
      <Route path="*" element={<Outlet context={ctx} />}>
        <Route index element={<>{active.el}</>} />
        <Route path="*" element={<>{active.el}</>} />
      </Route>
    </Routes>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg, #F4EFE0)' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 100, padding: '10px 14px',
        background: '#111', color: '#fff', fontFamily: 'var(--mono, monospace)', fontSize: 12,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      }}>
        <strong style={{ letterSpacing: '0.08em', fontFamily: 'var(--code)' }}>/dev/desk</strong>
        <span style={{ opacity: 0.6 }}>no session · network off · writes: {writes === 'fake' ? 'in-memory' : 'refused'}</span>
        <span style={{ marginLeft: 'auto', opacity: 0.85 }}>
          {w}px · <strong>{band}</strong>
        </span>
      </div>

      <div data-testid="desk-picker" style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {DESKS.map(d => (
          <button key={d.id} type="button" data-desk={d.id} onClick={() => setDesk(d.id)} title={d.note}
            style={{
              padding: '8px 12px', minHeight: 44, borderRadius: 999, cursor: 'pointer',
              border: '1px solid rgba(10,10,10,0.15)',
              background: d.id === desk ? '#111' : 'transparent',
              color: d.id === desk ? '#fff' : 'inherit',
              fontFamily: 'var(--mono, monospace)', fontSize: 12,
            }}>{d.label}</button>
        ))}
      </div>

      <div data-testid="viewer-bar" style={{ padding: '0 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>viewer</span>
        {ROLES.map(r => (
          <button key={r} type="button" data-role={r} onClick={() => { if (r !== role) { setReady(false); setRole(r) } }} style={chip(r === role)}>{r}</button>
        ))}
        <span className="mono" style={{ fontSize: 11, opacity: 0.7, marginLeft: 8 }}>shell</span>
        <button type="button" data-shell="1" aria-pressed={inShell} onClick={() => setInShell(v => !v)} style={chip(inShell)}>inside the real DirectorDashboard</button>
        <span className="mono" style={{ fontSize: 11, opacity: 0.7, marginLeft: 8 }}>writes</span>
        {(['fake', 'throw'] as const).map(m => (
          <button key={m} type="button" data-writes={m} onClick={() => setWrites(m)} style={chip(m === writes)}>{m === 'fake' ? 'in-memory' : 'refuse'}</button>
        ))}
      </div>
      <div data-testid="cap-bar" style={{ padding: '0 14px 8px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>capability switched OFF for this role</span>
        {ACTION_CAPS.map(k => (
          <button key={k} type="button" data-cap={k} aria-pressed={off.includes(k)} onClick={() => toggleCap(k)}
            style={chip(off.includes(k), { textDecoration: off.includes(k) ? 'line-through' : 'none' })}>{k.replace('action.', '')}</button>
        ))}
        <span className="mono" style={{ fontSize: 10, opacity: 0.55 }}>(super_admin is never restrictable)</span>
      </div>

      <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {SCENARIOS.map(s => (
          <button key={s.id} type="button" data-scenario={s.id} onClick={() => setScenario(s.id)} title={s.note} style={chip(s.id === scenario)}>{s.label}</button>
        ))}
        <span style={{ fontSize: 11, opacity: 0.6, fontFamily: 'var(--mono, monospace)' }}>
          {SCENARIOS.find(s => s.id === scenario)?.note}
        </span>
      </div>

      <p style={{ margin: '0 14px 14px', fontSize: 12, opacity: 0.7, maxWidth: 760 }}>
        {active.note}. Changing scenario, viewer or capabilities remounts the desk, so its reads fire again
        against freshly seeded in-memory data. The member table mounts only at 1025px and above.
      </p>

      <div className="admin" key={`${desk}:${scenario}:${role}:${off.join('|')}:${inShell}`}>
        <Suspense fallback={<div style={{ padding: 24, fontFamily: 'var(--mono, monospace)', fontSize: 12 }}>loading desk…</div>}>
          {ready ? (
            <AuthContext.Provider value={authVal as any}>
              <CapabilityContext.Provider value={capVal as any}>{body}</CapabilityContext.Provider>
            </AuthContext.Provider>
          ) : null}
        </Suspense>
      </div>
    </div>
  )
}
