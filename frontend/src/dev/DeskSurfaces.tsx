import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import AuthContext from '../auth/AuthContext'
import type { DirectorContext } from '../director/DirectorDashboard'
import { makeDevPreviewMember } from '../lib/devPreview'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { directorService } from '../services/directorService'
import certificateService from '../services/certificateService'
import { teamService } from '../services/teamService'
import breakService from '../services/breakService'
import { todayISO } from '../lib/breakWindows'
import '../styles/routes/director.css'

/**
 * /dev/desk — the HoD desk preview harness.
 *
 * WHY THIS EXISTS, SEPARATELY FROM /dev/authed
 *
 * /dev/authed closed this gap for MEMBER surfaces: the profile nudge, the grid,
 * the compose modal, choose-team. It deliberately stops short of the desk. So
 * the 16 director desks — and in particular the three wide TABLES, which are the
 * hardest thing in this codebase to get right at a phone width — have never been
 * seen rendered by anyone who could not log in as a director. Every spacing and
 * contrast decision on them has been made by reading CSS.
 *
 * That is exactly backwards for a surface whose known failure mode is layout.
 * `director-people.css` carries its own scar from it: a tablet once rendered the
 * desk completely blank because a CSS breakpoint and a JS constant named
 * different widths, and nobody saw it because nobody could look.
 *
 * THE RULES, inherited from /dev/authed and not relaxed:
 *
 *   - **No production component gains a mock code path.** Nothing under
 *     `director/` is edited for this. A file that behaves differently under a
 *     flag is worse than the gap it closes.
 *   - **The swap lives here.** `directorService`'s exported singleton has its
 *     read methods replaced on mount and restored on unmount. The module is
 *     untouched on disk.
 *   - **Writes throw.** Every mutating method is replaced with a rejection, so a
 *     misclick in the harness cannot reach the database. There is no session, so
 *     RLS would refuse anyway; this makes it loud instead of silent.
 *   - **Network is off.** `window.fetch` rejects immediately while this route is
 *     mounted, so a missed seam fails fast rather than reaching Supabase.
 *   - **DEV only.** The route is behind `import.meta.env.DEV` in App.tsx and the
 *     import is inside that branch lexically, so Rollup drops the whole chunk
 *     from a production build.
 *
 * PII: every fixture below is obviously synthetic — `@example.invalid`
 * addresses, `+91 00000 …` numbers, names that read as placeholders. Nothing is
 * copied from the database or from any spreadsheet.
 *
 * THE FIXTURES ARE DELIBERATELY AWKWARD. A row set of tidy short names proves
 * nothing. These include the cases that actually break a table: a name longer
 * than its column, an email longer than any sane column, a member with no
 * avatar, one on a break, one archived, one soft-deleted, and one whose school
 * name is longer than the name itself.
 */

// ── fixture identity ────────────────────────────────────────────────────────
const FIXTURE_SUPER = {
  ...makeDevPreviewMember('super_admin'),
  full_name: 'Test Super Admin',
  email: 'test.super@example.invalid',
} as any

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

function Authed({ children }: { children: ReactNode }) {
  const value = useMemo(() => authValue(FIXTURE_SUPER), [])
  return <AuthContext.Provider value={value as any}>{children}</AuthContext.Provider>
}

/**
 * The desks are NOT standalone components. Four of them
 * (AccountApprovals, DirectorLanding, HiringResponses, PostModeration) call
 * `useOutletContext()` and destructure `DirectorContext` out of it, because in
 * the real app they are child ROUTES of DirectorDashboard, which supplies it
 * via `<Outlet context={ctx} />`.
 *
 * Mounting one directly throws "Cannot destructure property 'myCategories' of
 * useOutletContext(...) as it is undefined" - which this harness found on its
 * first run, and which is worth stating plainly: the desks have a dependency on
 * their router position that nothing in their own file declares.
 *
 * So the harness reproduces that position rather than faking the hook. A
 * two-level <Routes> gives a real parent whose element renders a real <Outlet>
 * carrying a real context. No production component is touched, and the desks
 * resolve the hook exactly the way they do under DirectorDashboard.
 */
const DIRECTORY_ROWS_COUNT = 6

const DESK_CTX: DirectorContext = {
  stats: {
    totalMembers: DIRECTORY_ROWS_COUNT, pendingApprovals: 2, pendingPostReviews: 2,
    totalTeams: 8, totalPosts: 584, openOpenings: 0, pendingCertificates: 0,
    pendingEnquiries: 2, pendingApplications: 2,
  } as any,
  statsError: false,
  canApproveMembers: true,
  isSuperAdmin: true,
  myCategories: [],
  myTeamIds: [],
  myScopeTeamIds: [],
  scopedPendingPosts: null,
}

function AtRoutePosition({ children }: { children: ReactNode }) {
  return (
    <Routes>
      <Route path="*" element={<Outlet context={DESK_CTX} />}>
        <Route index element={<>{children}</>} />
        <Route path="*" element={<>{children}</>} />
      </Route>
    </Routes>
  )
}

// ── fixture rows ────────────────────────────────────────────────────────────
// Shape matches DirectoryMember exactly (directorService.getMemberDirectory's
// mapper). If that mapper gains a field, add it here or the desk will render a
// blank column and look like a CSS bug when it is a fixture gap.
const DIRECTORY_ROWS = [
  {
    memberId: 9001, uuid: 'fixture-0001', email: 'test.member@example.invalid',
    fullName: 'Test Member', avatarUrl: null, classGrade: 'Class 11',
    phone: '+91 00000 00001', instagram: 'test_member', linkedin: null,
    schoolName: 'Test School', role: 'member', status: 'active',
    createdAt: '2026-01-14T10:00:00Z', breakEnd: null,
  },
  {
    // THE TRUNCATION CASE. This address is longer than the contact column has
    // ever been, which is the row that exposed the missing title attribute.
    memberId: 9002, uuid: 'fixture-0002',
    email: 'a.very.long.placeholder.address.for.layout@example.invalid',
    fullName: 'Placeholder With A Deliberately Long Name', avatarUrl: null,
    classGrade: 'College 2nd Year', phone: '+91 00000 00002',
    instagram: null, linkedin: 'placeholder-long-name',
    schoolName: 'A School Whose Name Is Longer Than The Column',
    role: 'hod', status: 'active', createdAt: '2025-11-02T10:00:00Z', breakEnd: null,
  },
  {
    memberId: 9003, uuid: 'fixture-0003', email: 'test.hr@example.invalid',
    fullName: 'Test HR', avatarUrl: null, classGrade: 'Alumni',
    phone: null, instagram: null, linkedin: null, schoolName: null,
    role: 'hr', status: 'active', createdAt: '2025-06-20T10:00:00Z', breakEnd: null,
  },
  {
    // On a break: exercises the break pill and the date formatting.
    memberId: 9004, uuid: 'fixture-0004', email: 'test.break@example.invalid',
    fullName: 'Test On Break', avatarUrl: null, classGrade: 'Class 12',
    phone: '+91 00000 00004', instagram: null, linkedin: null,
    schoolName: 'Test School', role: 'member', status: 'active',
    createdAt: '2026-02-01T10:00:00Z', breakEnd: '2026-12-01',
  },
  {
    memberId: 9005, uuid: 'fixture-0005', email: 'test.archived@example.invalid',
    fullName: 'Test Archived', avatarUrl: null, classGrade: 'Class 10',
    phone: null, instagram: null, linkedin: null, schoolName: null,
    role: 'member', status: 'archived', createdAt: '2025-03-10T10:00:00Z', breakEnd: null,
  },
  {
    memberId: 9006, uuid: 'fixture-0006', email: 'test.deleted@example.invalid',
    fullName: 'Test Removed', avatarUrl: null, classGrade: null,
    phone: null, instagram: null, linkedin: null, schoolName: null,
    role: 'member', status: 'deleted', createdAt: '2025-01-05T10:00:00Z', breakEnd: null,
  },
]

const PENDING_APPROVALS = [
  {
    memberId: 9101, uuid: 'fixture-p001', email: 'test.applicant@example.invalid',
    fullName: 'Test Applicant', avatarUrl: null, classGrade: 'Class 9',
    phone: '+91 00000 00101',
    joinReason: 'A short reason, the common case.',
    bio: null, createdAt: '2026-09-10T10:00:00Z', contactedAt: null, previouslyRemoved: false,
  },
  {
    // A long free-text reason, which is what actually stretches this card.
    memberId: 9102, uuid: 'fixture-p002', email: 'test.longreason@example.invalid',
    fullName: 'Test Long Reason', avatarUrl: null, classGrade: 'College 1st Year',
    phone: '+91 00000 00102',
    joinReason:
      'A deliberately long joining reason, written as one unbroken paragraph so the card has to decide what to do with it rather than being handed a tidy sentence that fits by luck. This is the shape real applicants actually submit.',
    bio: null, createdAt: '2026-09-12T10:00:00Z', contactedAt: '2026-09-13T10:00:00Z',
    previouslyRemoved: true,
  },
]

const PENDING_POSTS = [
  {
    postId: 9201, uuid: 'fixture-post-1', category: 'welfare',
    body: 'A short pending post.\n\nOne paragraph under it.',
    authorName: 'Test Member', authorAvatar: null, authorRole: 'member',
    createdAt: '2026-09-16T10:00:00Z', imageUrls: [], teamName: null,
  },
  {
    // No blank line, one long run: the shape that produced a 17-line headline
    // on the public feed before derivePostHeadline() was wired into the .aqc
    // cards. Kept here so the desk's own rendering of it stays visible.
    postId: 9202, uuid: 'fixture-post-2', category: 'events',
    body: 'A pending post written as a single unbroken paragraph with no blank line anywhere in it, which is the exact shape that the feed used to render as a seventeen-line headline before the length guard was applied to the card families.',
    authorName: 'Placeholder With A Deliberately Long Name', authorAvatar: null,
    authorRole: 'hod', createdAt: '2026-09-17T10:00:00Z', imageUrls: [], teamName: 'Welfare Projects',
  },
]

const VOLUNTEER_APPS = [
  {
    id: 9301, full_name: 'Test Enquiry', phone: '+91 00000 00301',
    email: 'test.enquiry@example.invalid', class_grade: 'Class 11',
    school: 'Test School', message: 'A short enquiry.', reviewed: false,
    created_at: '2026-09-14T10:00:00Z',
  },
  {
    id: 9302, full_name: 'Test Long Enquiry', phone: '+91 00000 00302',
    email: 'a.very.long.placeholder.address.for.layout@example.invalid',
    class_grade: 'College 3rd Year', school: 'A School Whose Name Is Longer Than The Column',
    message:
      'A long enquiry message, again as one paragraph, because the seven-column table has to survive this and a one-line message proves nothing about whether it does.',
    reviewed: true, created_at: '2026-09-15T10:00:00Z',
  },
]

// Shape matches CertificateRequest (certificateService's mapRequest). The
// desk itself only reads id / memberName / status, but the rest is filled in
// so a future column does not silently render blank.
const CERTIFICATE_ROWS = [
  {
    id: 9401, memberId: 9001, docType: 'certificate', status: 'pending',
    memberNote: 'A short note.', hoursAtRequest: 24, driveCountAtRequest: 6,
    dateRangeStart: '2026-01-01', dateRangeEnd: '2026-08-31',
    requestedAt: '2026-09-14T10:00:00Z', decidedBy: null, decidedAt: null,
    decisionNote: null, memberName: 'Test Member',
  },
  {
    id: 9402, memberId: 9002, docType: 'lor', status: 'pending',
    memberNote:
      'A long request note, written as one paragraph, because a one-line note proves nothing about how this row behaves when somebody actually explains themselves.',
    hoursAtRequest: 112, driveCountAtRequest: 31,
    dateRangeStart: '2025-06-01', dateRangeEnd: '2026-09-01',
    requestedAt: '2026-09-15T10:00:00Z', decidedBy: null, decidedAt: null,
    decisionNote: null, memberName: 'Placeholder With A Deliberately Long Name',
  },
  {
    id: 9403, memberId: 9003, docType: 'lov', status: 'issued',
    memberNote: null, hoursAtRequest: 40, driveCountAtRequest: 9,
    dateRangeStart: null, dateRangeEnd: null,
    requestedAt: '2026-08-02T10:00:00Z', decidedBy: 9001,
    decidedAt: '2026-08-04T10:00:00Z', decisionNote: 'Issued.', memberName: 'Test HR',
  },
] as any[]

// Shape matches what TeamManagement reads off teamService.getTeams().
const TEAM_ROWS = [
  { uuid: 'fixture-team-1', name: 'Welfare Projects', category: 'welfare', memberCount: 56, logoUrl: null,
    description: 'The oldest and largest department.' },
  { uuid: 'fixture-team-2', name: 'Events', category: 'events', memberCount: 2, logoUrl: null,
    description: 'A deliberately long department description, one unbroken sentence, so the card has to decide what to do with it rather than being handed something that fits by luck.' },
  { uuid: 'fixture-team-3', name: 'A Department With A Deliberately Long Name', category: 'operations',
    memberCount: 0, logoUrl: null, description: null },
] as any[]

// ── scenarios ───────────────────────────────────────────────────────────────
// The four states every desk has and only one of which is ever designed.
type Scenario = 'populated' | 'empty' | 'loading' | 'error'
const SCENARIOS: { id: Scenario; label: string; note: string }[] = [
  { id: 'populated', label: 'populated', note: 'the rows above, including the awkward ones' },
  { id: 'empty', label: 'empty', note: 'zero rows and no error — the state that must NOT read as a failure' },
  { id: 'loading', label: 'loading', note: 'the read never settles, so skeletons stay up' },
  { id: 'error', label: 'error', note: 'the read throws — this must never render as "nothing here yet"' },
]

// ── desks ───────────────────────────────────────────────────────────────────
// Lazy so a desk that fails to mount cannot take the picker down with it.
import { lazy, Suspense } from 'react'
const MemberDirectory = lazy(() => import('../director/MemberDirectory'))
const ProductGuide = lazy(() => import('../director/ProductGuide'))
const AccountApprovals = lazy(() => import('../director/AccountApprovals'))
const PostModeration = lazy(() => import('../director/PostModeration'))
const VolunteerApplications = lazy(() => import('../director/VolunteerApplications'))
const CertificateRequests = lazy(() => import('../director/CertificateRequests'))
const TeamManagement = lazy(() => import('../director/TeamManagement'))
const DirectorLanding = lazy(() => import('../director/DirectorLanding'))

const DESKS: { id: string; label: string; note: string; el: ReactNode }[] = [
  { id: 'landing', label: 'Desk home', note: 'what needs you today: one slab, one set of counts', el: <DirectorLanding /> },
  { id: 'members', label: 'Members', note: 'the 7-column table and its card fallback — the widest thing on the desk', el: <MemberDirectory /> },
  { id: 'guide', label: 'Product guide', note: 'the generated guide in a sandboxed frame; it ignores the scenario switch', el: <ProductGuide /> },
  { id: 'approvals', label: 'Approvals', note: 'pending + rejected queues, free-text join reasons', el: <AccountApprovals /> },
  { id: 'posts', label: 'Post Queue', note: 'moderation cards, long bodies, category tags', el: <PostModeration /> },
  { id: 'volunteers', label: 'Vol. Applications', note: 'the other wide table (7 cols)', el: <VolunteerApplications /> },
  { id: 'certificates', label: 'Certificates', note: 'request rows with decisions', el: <CertificateRequests /> },
  { id: 'teams', label: 'Teams', note: 'team cards and rosters', el: <TeamManagement /> },
]

// ── the harness ─────────────────────────────────────────────────────────────
export default function DeskSurfaces() {
  const [desk, setDesk] = useState(DESKS[0].id)
  const [scenario, setScenario] = useState<Scenario>('populated')
  const [ready, setReady] = useState(false)
  const [w, setW] = useState(typeof window === 'undefined' ? 0 : window.innerWidth)
  const scenarioRef = useRef(scenario)
  scenarioRef.current = scenario

  useEffect(() => {
    const onResize = () => setW(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  /* HARNESS FIDELITY, not a design change.
     /dev/desk is not a /director route, so PublicLayout renders the floating
     MobileMenuBar dock over it. The real desk never has that: DashboardLayout
     renders both the dock and its spacer behind `!isDirectorRoute`, because the
     desk's own .ops-phonebar replaces it.
     Leaving it visible here would invent a bug - the first phone screenshot of
     this harness showed the dock sitting on the Approvals filter row, which
     looks exactly like an overlap defect and is not one. Hidden while the
     harness is mounted so what is on screen is what a director actually sees. */
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-dev-desk', '')
    style.textContent = '.aq-bottom-bar, .aq-bottom-bar-spacer { display: none !important; }'
    document.head.appendChild(style)
    return () => { style.remove() }
  }, [])

  useEffect(() => {
    const realFetch = window.fetch
    const ds = directorService as any
    const saved: Record<string, any> = {}
    const swap = (name: string, fn: any) => { saved[name] = ds[name]; ds[name] = fn }

    window.fetch = (() => Promise.reject(new Error('[dev/desk] network is disabled in the preview harness'))) as any

    // Every read honours the scenario, so one switch drives the whole desk.
    const settle = <T,>(value: T): Promise<T> => {
      const s = scenarioRef.current
      if (s === 'loading') return new Promise<T>(() => {})
      if (s === 'error') return Promise.reject(new Error('[fixture] read failed'))
      return Promise.resolve(value)
    }
    const rows = <T,>(v: T[]): Promise<T[]> => settle(scenarioRef.current === 'empty' ? [] : v)
    const paged = (v: any[]) => settle({
      success: true,
      data: scenarioRef.current === 'empty' ? [] : v,
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalItems: scenarioRef.current === 'empty' ? 0 : v.length,
        itemsPerPage: 20,
        hasNextPage: false,
        hasPrevPage: false,
      },
    })

    swap('getMemberDirectory', () => paged(DIRECTORY_ROWS))
    swap('getPendingApprovals', () => paged(PENDING_APPROVALS))
    swap('getRejectedApprovals', () => paged([]))
    swap('getPendingContactedCounts', () => settle({ pending: PENDING_APPROVALS.length, contacted: 1 }))
    swap('getPendingPosts', () => paged(PENDING_POSTS))
    swap('getDashboardStats', () => settle({
      totalMembers: DIRECTORY_ROWS.length, pendingApprovals: PENDING_APPROVALS.length,
      pendingPostReviews: PENDING_POSTS.length, totalTeams: 8, totalPosts: 584,
      openOpenings: 0, pendingCertificates: 0,
    }))
    swap('getMyCategories', () => settle([]))
    swap('getCategoryAssignments', () => rows([]))

    // Certificates and Teams do not go through directorService at all, so they
    // need their own singletons swapped or they render "nothing pending" and
    // "no teams yet" forever - which is exactly the empty-state-that-lies trap
    // this harness exists to make visible.
    const realListAll = (certificateService as any).listAll
    const realDecide = (certificateService as any).decide
    // listAll returns { success, data }, not a bare array - the desk does
    // `setRequests(result.data)` straight off it.
    ;(certificateService as any).listAll = () => settle({
      success: true,
      data: scenarioRef.current === 'empty' ? [] : CERTIFICATE_ROWS,
    })
    ;(certificateService as any).decide = async () => {
      throw new Error('[dev/desk] certificateService.decide() is disabled in the preview harness')
    }
    const realGetTeams = (teamService as any).getTeams
    const realCreateTeam = (teamService as any).createTeam
    const realUpdateTeam = (teamService as any).updateTeam
    const realDeleteTeam = (teamService as any).deleteTeam
    ;(teamService as any).getTeams = () => settle({
      success: true,
      data: scenarioRef.current === 'empty' ? [] : TEAM_ROWS,
      pagination: { currentPage: 1, totalPages: 1, totalItems: TEAM_ROWS.length, itemsPerPage: 50, hasNextPage: false, hasPrevPage: false },
    })
    for (const k of ['createTeam', 'updateTeam', 'deleteTeam']) {
      ;(teamService as any)[k] = async () => {
        throw new Error(`[dev/desk] teamService.${k}() is disabled in the preview harness`)
      }
    }

    // The Members desk's "On a break" view reads breakService, not directorService.
    // Dates are relative to today so the preview never goes stale.
    const realBreaks = (breakService as any).listCurrentAndUpcoming
    const dayOffset = (n: number) => {
      const d = new Date(); d.setDate(d.getDate() + n)
      return todayISO(d)
    }
    ;(breakService as any).listCurrentAndUpcoming = () => rows([
      { id: 1, memberId: 11, start: dayOffset(-9), end: dayOffset(4), reason: 'boards', note: 'back for the november drive', fullName: 'Ananya Sen', avatarUrl: null },
      { id: 2, memberId: 12, start: dayOffset(-2), end: dayOffset(20), reason: 'college exams', note: null, fullName: 'Rohan Das', avatarUrl: null },
      { id: 3, memberId: 13, start: dayOffset(12), end: dayOffset(21), reason: 'school exams', note: null, fullName: 'Ishita Banerjee', avatarUrl: null },
      { id: 4, memberId: 11, start: dayOffset(40), end: dayOffset(46), reason: 'family', note: 'wedding', fullName: 'Ananya Sen', avatarUrl: null },
    ])

    // Writes are loud, not silent. A misclick here must not look like it worked.
    for (const name of [
      'changeRole', 'deleteMember', 'restoreDeletedMember', 'restartMemberAsApplicant',
      'setArchived', 'approveMember', 'rejectMember', 'markContacted',
      'approvePost', 'rejectPost',
    ]) {
      if (typeof ds[name] === 'function') {
        swap(name, async () => { throw new Error(`[dev/desk] ${name}() is disabled in the preview harness`) })
      }
    }

    // VolunteerApplications talks to the client directly rather than through a
    // service, so it needs the same thenable-chain stub /dev/authed uses.
    const realFrom = (supabaseCommunity as any).from
    ;(supabaseCommunity as any).from = (table: string) => {
      const resolve = () => {
        const s = scenarioRef.current
        if (s === 'loading') return new Promise(() => {})
        if (s === 'error') return Promise.resolve({ data: null, error: { message: '[fixture] read failed', code: 'PGRST000' } })
        const data = s === 'empty' ? [] : table === 'volunteer_applications' ? VOLUNTEER_APPS : []
        return Promise.resolve({ data, error: null, count: data.length })
      }
      const chain: any = new Proxy({}, {
        get(_t, prop: string) {
          if (prop === 'then') return (res: any, rej: any) => resolve().then(res, rej)
          if (prop === 'catch') return (rej: any) => resolve().catch(rej)
          if (prop === 'finally') return (f: any) => resolve().finally(f)
          if (prop === 'maybeSingle' || prop === 'single') {
            return () => resolve().then((r: any) => ({ ...r, data: r.data?.[0] ?? null }))
          }
          // select / eq / order / limit / range / update / in / is / neq …
          return () => chain
        },
      })
      return chain
    }

    setReady(true)
    return () => {
      window.fetch = realFetch
      for (const k of Object.keys(saved)) ds[k] = saved[k]
      ;(supabaseCommunity as any).from = realFrom
      ;(certificateService as any).listAll = realListAll
      ;(certificateService as any).decide = realDecide
      ;(teamService as any).getTeams = realGetTeams
      ;(teamService as any).createTeam = realCreateTeam
      ;(teamService as any).updateTeam = realUpdateTeam
      ;(teamService as any).deleteTeam = realDeleteTeam
      ;(breakService as any).listCurrentAndUpcoming = realBreaks
    }
  }, [])

  const active = DESKS.find(d => d.id === desk) ?? DESKS[0]
  const band = w <= 600 ? 'phone' : w <= 1024 ? 'tablet' : 'desktop'

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg, #F4EFE0)' }}>
      {/* The harness chrome. Deliberately plain and OUTSIDE .admin, so nothing
          here can be mistaken for desk design while judging desk design. */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100, padding: '10px 14px',
        background: '#111', color: '#fff', fontFamily: 'var(--mono, monospace)', fontSize: 12,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
      }}>
        {/* A literal route, so --code: --mono is NeutralFace and caps-only. */}
        <strong style={{ letterSpacing: '0.08em', fontFamily: 'var(--code)' }}>/dev/desk</strong>
        <span style={{ opacity: 0.6 }}>no session · writes disabled · network off</span>
        <span style={{ marginLeft: 'auto', opacity: 0.85 }}>
          {w}px · <strong>{band}</strong>
          {w === 1024 ? ' · the width that used to be styled by neither branch' : ''}
        </span>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {DESKS.map(d => (
          <button key={d.id} type="button" onClick={() => setDesk(d.id)} title={d.note}
            style={{
              padding: '8px 12px', minHeight: 44, borderRadius: 999, cursor: 'pointer',
              border: '1px solid rgba(10,10,10,0.15)',
              background: d.id === desk ? '#111' : 'transparent',
              color: d.id === desk ? '#fff' : 'inherit',
              fontFamily: 'var(--mono, monospace)', fontSize: 12,
            }}>{d.label}</button>
        ))}
      </div>

      <div style={{ padding: '0 14px 12px', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {SCENARIOS.map(s => (
          <button key={s.id} type="button" onClick={() => { setScenario(s.id); setDesk(d => d) }} title={s.note}
            style={{
              padding: '6px 10px', minHeight: 36, borderRadius: 999, cursor: 'pointer',
              border: '1px solid rgba(10,10,10,0.15)',
              background: s.id === scenario ? 'var(--lemon, #FFC700)' : 'transparent',
              fontFamily: 'var(--mono, monospace)', fontSize: 11,
            }}>{s.label}</button>
        ))}
        <span style={{ fontSize: 11, opacity: 0.6, fontFamily: 'var(--mono, monospace)' }}>
          {SCENARIOS.find(s => s.id === scenario)?.note}
        </span>
      </div>

      <p style={{ margin: '0 14px 14px', fontSize: 12, opacity: 0.7, maxWidth: 760 }}>
        {active.note}. Switching scenario remounts the desk, so a read fires again.
        Resize the window to move between phone, tablet and desktop: the desk
        switches chrome at 1024/1025 and the member table mounts only at 1025 and
        above, so the card grid below that is not a fallback, it is the design.
      </p>

      {/* .admin is what scopes styles/routes/director.css. Without it the desk
          renders unstyled and every finding is an artefact of the harness. */}
      <div className="admin" key={`${desk}:${scenario}`}>
        <Suspense fallback={<div style={{ padding: 24, fontFamily: 'var(--mono, monospace)', fontSize: 12 }}>loading desk…</div>}>
          {ready ? <Authed><AtRoutePosition>{active.el}</AtRoutePosition></Authed> : null}
        </Suspense>
      </div>
    </div>
  )
}
