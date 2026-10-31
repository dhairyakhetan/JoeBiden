import { useCallback, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import useMeta from '../hooks/useMeta'
import DemoProvider from './DemoProvider'
import DemoRibbon from './DemoRibbon'
import DemoEndCard from './DemoEndCard'
import CoachMark from './coach/CoachMark'
import { getFlow } from './flows/registry'
import { FixtureStore } from './flows/types'
import { getRoleLabel } from '../lib/roles'
import { clearAuthCache } from '../lib/authCache'
import './demo.css'

/**
 * Runs one flow end to end: builds its fixture identity + fixture store +
 * table handlers exactly once (the lazy useState initializers below never
 * re-run for the lifetime of this mount), wraps everything in DemoProvider,
 * and steps through the flow's coach-mark script to the end card.
 *
 * Keyed by :flowId from DemoRoute.tsx's <Routes>, so picking a different
 * flow (including "Try another" from the end card, which navigates back to
 * /demo rather than re-using this instance) always mounts a fresh
 * DemoFlowPage - a fresh member, a fresh FixtureStore, a fresh install of
 * the shadow. Nothing carries over between flows, matching 19.1's "no
 * persistence" rule literally, not just for writes.
 */
export default function DemoFlowPage() {
  const { flowId } = useParams<{ flowId: string }>()
  const navigate = useNavigate()
  const flow = flowId ? getFlow(flowId) : undefined
  useMeta({ title: flow ? `${flow.name} - walkthrough | AquaTerra` : 'Walkthrough | AquaTerra', noIndex: true })

  // authCache.ts's cached member id is a module-level singleton, outside
  // React entirely, so remounting this page (a fresh flow, per the header
  // comment above) does NOT reset it on its own. A real signed-in session,
  // or an EARLIER demo flow's fixture member, can leave a stale member_id
  // cached under the demo's own fixed DEMO_AUTH_UID - the next flow's
  // buildFakeMember() mints a NEW id, so any query keyed off the stale
  // cached one (createPost's own role lookup, notably) finds no row in
  // this flow's fixture store and surfaces as "Member not found", even
  // though the walkthrough never touched real data. Cleared eagerly on
  // every mount so each flow starts from a guaranteed cache miss.
  clearAuthCache()
  const [member] = useState(() => flow?.buildMember())
  const [store] = useState(() => new FixtureStore())
  const [handlers] = useState(() => (flow && member ? flow.buildHandlers({ member, store }) : {}))
  const [stepIndex, setStepIndex] = useState(0)
  const [completed, setCompleted] = useState(false)

  const handleLeave = useCallback(() => navigate('/'), [navigate])
  const handleTryAnother = useCallback(() => navigate('/demo'), [navigate])

  const handleAdvance = useCallback(() => {
    if (!flow) return
    setStepIndex((i) => {
      if (i >= flow.steps.length - 1) { setCompleted(true); return i }
      return i + 1
    })
  }, [flow])

  const handleBack = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), [])

  // The three HoD flows render DirectorDashboard as their Backdrop - and
  // DirectorDashboard is a REAL /director/* screen, which in the live app
  // never shows the public front-end's AQNav/AQFooter/MobileMenuBar at all
  // (DashboardLayout.tsx, the real ancestor those routes use instead of
  // PublicLayout, explicitly skips all three - see its own comment on why
  // stacking two navigations is a defect this app already fixed once).
  // DemoRoute.tsx, shared by every one of the eleven flows, always wraps
  // this page in PublicLayout - correct for the eight flows whose Backdrop
  // is itself a public page that expects to sit under AQNav, but for the
  // three HoD flows this leaves a real, visible bug: found by actually
  // loading hod-approve-account and measuring it, AQNav's own 64px doesn't
  // get fully covered by the ribbon's 40px, so a ~24px sliver of the public
  // nav shows between the ribbon and the admin desk on every HoD flow, and
  // PublicLayout's footer/mobile tab bar render underneath/around a desk
  // that never has either for real.
  //
  // Fixed here rather than by restructuring DemoRoute.tsx's shared route
  // tree (which would need to know, one level up, whether the CURRENT
  // :flowId is role-borrowed just to pick a layout) or by editing
  // PublicLayout.tsx itself (used by nearly every real route - a demo-only
  // conditional does not belong in it): toggle one body class for exactly
  // the lifetime of a role-borrowed flow's mount, same "flag the document,
  // scope the CSS to the flag" technique this codebase already uses for
  // CvCard.tsx's print mode (`document.body.classList.add('cv-printing')`).
  // demo.css's `body.demo-hod-flow` rules hide the three and zero out
  // PublicLayout's inline nav-reserving padding (needs `!important` - an
  // inline style otherwise wins over any class selector).
  // Gated on `hidesPublicChrome`, NOT on `roleBorrowed`. The class exists to
  // stop the public nav/footer showing THROUGH the HoD desk, and the desk is
  // the only backdrop that needs it. `roleBorrowed` means something different -
  // "this flow borrows a role" - and hod-post-opening borrows one while its
  // backdrop is a normal public team page, so it was having the real nav and
  // footer stripped off a route that is supposed to have them.
  useEffect(() => {
    if (!flow?.hidesPublicChrome) return
    document.body.classList.add('demo-hod-flow')
    return () => document.body.classList.remove('demo-hod-flow')
  }, [flow?.hidesPublicChrome])

  if (!flow || !member) {
    // Not one of the flows this pass ships (or a bad url) - the launcher is
    // the only place that should ever link into /demo/:flowId, and it never
    // links a 'soon' one, so this is a not-found/typed-url case, not a
    // reachable dead end from within the product.
    return <Navigate to="/demo" replace />
  }

  const step = flow.steps[stepIndex]
  const Backdrop = flow.Backdrop

  return (
    <DemoProvider member={member} tableHandlers={handlers}>
      <DemoRibbon
        flowName={flow.name}
        stepIndex={completed ? flow.steps.length - 1 : stepIndex}
        totalSteps={flow.steps.length}
        borrowedRoleLabel={flow.roleBorrowed ? getRoleLabel(flow.role) : undefined}
        onLeave={handleLeave}
      />
      <div className="demo-page-shell">
        <Backdrop />
      </div>
      {completed ? (
        <DemoEndCard data={flow.endCard} flowName={flow.name} onTryAnother={handleTryAnother} />
      ) : (
        <CoachMark
          key={step.id}
          step={step}
          stepIndex={stepIndex}
          totalSteps={flow.steps.length}
          context={{ member, store }}
          onAdvance={handleAdvance}
          onBack={handleBack}
          onLostTarget={handleLeave}
          isFirstStep={stepIndex === 0}
        />
      )}
    </DemoProvider>
  )
}
