import { Routes, Route } from 'react-router-dom'
import DirectorDashboard from '../../director/DirectorDashboard'
import AccountApprovals from '../../director/AccountApprovals'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler, HandlerCtx } from '../runtime/queryBuilder'
import { clickElement, setReactFieldValue, findByText } from '../coach/domActions'
import type { DemoFlow, FixtureStore } from './types'

// ── 19.4: "A HoD approves an account" (spec says 4 steps). Built and tested
// as 3 (search, read why they applied, approve) - see this file's own
// header note below on why a 4th was rejected, same honesty standard as
// requestCertificate.tsx/signUpDrive.tsx's documented mismatches.
//
// ARCHITECTURE - two things this flow needed that no earlier flow did:
//
// 1. director/AccountApprovals.tsx calls `useOutletContext<DirectorContext>()`
//    - it is NOT a standalone screen, it only exists as an <Outlet> CHILD of
//      DirectorDashboard.tsx (App.tsx: DirectorDashboard wraps every
//      /director/* leaf route). A bare `Backdrop: () => <AccountApprovals/>`
//      throws immediately ("Cannot destructure property 'myCategories' of
//      undefined") - found by trying exactly that first. The fix is to mount
//      DirectorDashboard itself and let ITS <Outlet> resolve to
//      AccountApprovals, via the same `<Routes location>` override
//      wallNote.tsx already established (see that file for why a nested
//      <MemoryRouter> is impossible here too).
//
// 2. The override location starts DIRECTLY at `director/approvals`, not at
//    the desk's own index (DirectorLanding) with a first step to click
//    into it. This is not the same "start where the deep link already goes"
//    shortcut wallNote.tsx took - it is closer to a real constraint: every
//    nav link in DirectorDashboard's own rail is a genuine react-router
//    <NavLink>, and this Backdrop has no second Router to contain it in -
//    clicking one would fire the app's ONE REAL ambient navigate(), sending
//    the real browser to an ACTUAL `/director/*` URL that `<Routes
//    location>` (fixed per render) would not track, and which the real
//    ProtectedRoute would then bounce to /login since the outer, real auth
//    context has no idea this visitor is a director. Landing already on
//    approvals sidesteps the one navigation this demo cannot let a visitor
//    trigger for real.
//
// DirectorDashboard is rendered WITHOUT its real ancestor DashboardLayout.tsx
// on purpose: that layout's only jobs are the `.admin` scope class (which
// DirectorDashboard already applies to its own root div - `route-enter admin
// ops-shell` - independent of DashboardLayout) and skipping the public AQNav
// for `/director/*` routes, decided via `useLocation().pathname.startsWith
// ('/director')`. Against an OVERRIDDEN location that starts with
// `/demo/hod-approve-account`, that check would read false and show the
// public nav on top of the desk's own - the exact "two navigation bars
// stacked" bug DashboardLayout exists to prevent, just triggered from the
// opposite direction. Skipping DashboardLayout avoids relying on a check
// that cannot give the right answer here; PublicLayout's own AQNav (via
// DemoRoute.tsx, shared by every flow) still wraps this Backdrop the same
// way it wraps every other flow's - verified live rather than assumed to be
// a problem, see this pass's final report for what that actually looks like.
const APPLICANT_UUID = '00000000-0000-4000-f000-000000000001'

function pendingApplicant(id: number, uuid: string, fullName: string, classGrade: string, daysAgo: number, joinReason: string) {
  return {
    member_id: id,
    uuid,
    email: `${fullName.toLowerCase().replace(/\s+/g, '.')}@example.invalid`,
    full_name: fullName,
    avatar_url: null,
    class_grade: classGrade,
    phone: null,
    join_reason: joinReason,
    created_at: new Date(Date.now() - daysAgo * 86_400_000).toISOString(),
  }
}

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  store.seed('pending_member_approvals', [
    pendingApplicant(800001, APPLICANT_UUID, 'Oindrila Sarkar', '9', 2,
      "My cousin volunteers with the welfare team and I've heard good things - I'd like to help with the Sundarban drives."),
    pendingApplicant(800002, '00000000-0000-4000-f000-000000000002', 'Kabir Khan', '11', 1,
      'A friend from ShikshAQ told me you always need more tutoring volunteers on weekends.'),
    pendingApplicant(800003, '00000000-0000-4000-f000-000000000003', 'Ritu Podder', '10', 3,
      'I want to be part of the events team - I helped run my school fest last year.'),
  ])

  return {
    'rpc:get_own_member': () => ({ data: [member], error: null }),
    members: (ctx: HandlerCtx) => {
      if (ctx.wantsCount) {
        const eqStatus = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'status')
        if (eqStatus?.args[1] === 'pending_approval') return { data: [], error: null, count: store.rows('pending_member_approvals').length }
        return { data: [], error: null, count: 0 }
      }
      // approveMember()'s own UPDATE ({status:'active',...}).eq('member_id', X) -
      // move the row from pending to "approved" in the fixture store so it
      // is gone if anything ever re-lists pending approvals, and report
      // success either way (this flow's own UI already removed the row
      // optimistically before this call fires - see the 'approve' step).
      if (ctx.op === 'update') {
        const idFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'member_id')
        const rows = store.rows('pending_member_approvals') as any[]
        const row = idFilter ? rows.find(r => r.member_id === idFilter.args[1]) : undefined
        if (row) Object.assign(row, ctx.payload)
        return { data: row ? [row] : [], error: null }
      }
      const targetsThisMember = ctx.filters.some(f => f.method === 'eq' && (f.args[0] === 'member_id' ? f.args[1] === member.member_id : f.args[0] === 'auth_uid' ? f.args[1] === member.auth_uid : false))
      return { data: targetsThisMember ? [member] : [], error: null }
    },
    director_categories: () => ({ data: [], error: null }),

    pending_member_approvals: () => {
      const rows = store.rows('pending_member_approvals')
      return { data: rows, error: null, count: rows.length }
    },
    rejected_member_approvals: () => ({ data: [], error: null, count: 0 }),

    member_directory_view: (ctx) => {
      const idFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'member_id')
      const rows = store.rows('pending_member_approvals') as any[]
      const match = idFilter ? rows.find(r => r.member_id === idFilter.args[1]) : undefined
      return { data: match ? [match] : [], error: null }
    },

    notifications: () => ({ data: [], error: null }),
  }
}

// `<Routes location>`'s override must start with the branch already matched
// to reach this Backdrop (see wallNote.tsx's own note on this restriction) -
// `/demo/hod-approve-account` here - with the real absolute desk path
// (`director/approvals`, App.tsx) matched as the relative remainder.
const approvalsLocation = { pathname: '/demo/hod-approve-account/director/approvals', search: '', hash: '', state: null, key: 'demo-hod-approve' }

const flow: DemoFlow = {
  id: 'hod-approve-account',
  name: 'A HoD approves an account',
  durationLabel: 'about a minute',
  role: 'hod',
  roleBorrowed: true,
  // Backdrop IS the HoD desk, so the public nav/footer must not show through.
  hidesPublicChrome: true,
  buildMember: () => buildFakeMember({ fullName: 'Trina Basak', role: 'hod', classGrade: '12' }),
  buildHandlers,
  Backdrop: () => (
    <Routes location={approvalsLocation}>
      <Route element={<DirectorDashboard />}>
        <Route path="director/approvals" element={<AccountApprovals />} />
      </Route>
    </Routes>
  ),
  steps: [
    {
      id: 'find-them',
      title: 'Find them in the queue.',
      body: "Every sign-up lands here the moment they register - search finds them the same way you would for real.",
      findTarget: () => document.querySelector<HTMLInputElement>('input[placeholder*="Search name or email" i]'),
      doItForMe: ({ target }) => setReactFieldValue(target as HTMLInputElement, 'Oindrila'),
      isComplete: (target) => ((target as HTMLInputElement | null)?.value.trim().length ?? 0) >= 3,
    },
    {
      id: 'read-reason',
      title: 'See why they applied.',
      body: 'Every applicant writes a real line about why they want in - this is the one you actually read before deciding.',
      findTarget: () => findByText(document, '.adm-disclose', 'why they joined'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('.adm-row-expand'),
    },
    {
      id: 'approve',
      title: 'Approve them.',
      body: 'They get a real account instantly - this is the actual moment someone becomes a member, not a formality after it.',
      manualHint: 'or tap the arrow yourself',
      // Optimistic: AccountApprovals removes the row from its OWN local list
      // the instant you click (handleApprove), before the 5s undo window
      // even starts - the button is gone on the very next frame. Watch the
      // undo toast it replaces the row with instead (adminKit.tsx's
      // useUndoableAction: toast.action(`${name} approved`, {label:'Undo'})),
      // same "watch what survives, not what vanishes" rule as every other
      // send-shaped step in this pass.
      findTarget: () => findByText(document, '.adm-verdicts button', 'approve'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => (document.querySelector('.aq-toasts')?.textContent || '').includes('approved'),
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />approved<br />an account.</>,
    body: "One tap, and someone real is in - hours, teams, everything the same day they applied.",
  },
}

export default flow
