import { useLayoutEffect, useRef, useState } from 'react'
import AuthContext, { useAuth } from '../auth/AuthContext'
import { CapabilityProvider } from '../auth/CapabilityContext'
import { installDemoShadow } from './runtime/demoShadow'
import type { Member } from './runtime/fakeIdentity'
import type { TableHandler } from './runtime/queryBuilder'

interface DemoProviderProps {
  member: Member
  tableHandlers: Record<string, TableHandler>
  children: React.ReactNode
}

/**
 * Saves whatever a real localStorage key currently holds, then restores
 * EXACTLY that (the value, or no key at all) later. Two real, unrelated
 * keys need this, both found by actually running a flow rather than by
 * reading the code:
 *
 *  - `aq_composer_draft_v1` (feed/composer/useComposerDraft.ts, 03.2.2) -
 *    a single flat draft-autosave key, not scoped per session. Left alone,
 *    it leaks in BOTH directions: a demo run can save the fixture's fake
 *    category/body into this browser's REAL draft slot (a "nothing is
 *    saved" violation), and a leftover real - or previous-demo - draft can
 *    get silently restored into a FRESH demo and instantly satisfy a
 *    later step's completion check before the visitor has done anything.
 *    That second failure mode is exactly what happened during manual
 *    verification: steps 2 and 3 raced straight through because an earlier
 *    test run's draft was still sitting in this exact key.
 *
 * (A second real interruption found the same way - WelcomeOverlay.tsx's
 * first-visit letter popup, gated on the REAL outer "not authenticated"
 * state that FirstRunController reads above BrowserRouter - could NOT be
 * fixed from here: that component mounts eagerly at app boot, while this
 * one only exists once /demo/*'s lazy chunks resolve, so by the time this
 * effect could touch its flag, WelcomeOverlay's own mount-time check had
 * already run and scheduled itself. It needed a one-line addition to that
 * file's own route-exclusion list instead - see WelcomeOverlay.tsx.)
 *
 * A THIRD real key, found the same way while building the certificate/CV/
 * break flows (which mount ProfilePage as their Backdrop): `aq_referral_ref`
 * (referrals/claimStoredReferral.ts). ProfilePage calls claimStoredReferral()
 * on every mount whenever `isOwn && currentMember.status === 'active'` - and
 * the demo's fake member IS active by construction (fakeIdentity.ts). If a
 * REAL visitor had earlier clicked a real invite link (rememberReferral() on
 * /login stores the referral id in this exact key, meant to survive days
 * across the Google OAuth redirect + HoD approval wait), then opened one of
 * these walkthroughs on the SAME browser before their own signup finished,
 * claimStoredReferral() would fire for real: it reads the stored id, calls
 * referralService.claimReferral() - which IS shadowed (an .rpc() call, so it
 * resolves through onMiss to `data: []`, i.e. `data === true` is false) - and
 * because the RPC "succeeded" with a falsy answer, treats it as "blocked" and
 * calls forgetReferral(), which does a REAL `localStorage.removeItem` with no
 * shadow involved at all. The visitor's real, still-pending referral credit
 * would be silently deleted by a demo click that has nothing to do with it.
 * Suppressing the key for the demo's duration (same "remove entirely"
 * treatment as the composer draft) makes storedReferral() return null for the
 * whole session, so claimStoredReferral() short-circuits to 'none' before it
 * ever calls the RPC or touches storage - not just a safer failure mode, no
 * call happens at all.
 */
function withSavedFlag(key: string) {
  let hadValue = false
  let previous: string | null = null
  return {
    /** Pass a value to set the key to that for the demo's duration (the
     *  welcome-overlay "seen" flag); omit it to clear the key entirely (the
     *  composer draft, which should simply not exist while a demo runs). */
    suppress(value?: string) {
      try {
        previous = localStorage.getItem(key)
        hadValue = previous !== null
        if (value === undefined) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      } catch { /* private mode - nothing to save or suppress */ }
    },
    restore() {
      try {
        if (hadValue) localStorage.setItem(key, previous as string)
        else localStorage.removeItem(key)
      } catch { /* private mode */ }
    },
  }
}

const COMPOSER_DRAFT_KEY = 'aq_composer_draft_v1'
const REFERRAL_KEY = 'aq_referral_ref'

/**
 * The one thing that makes every real screen believe a prospective member is
 * a signed-in one (19.1). Two jobs, both safety-critical:
 *
 *   1. Shadows the auth context - a nested <AuthContext.Provider> further
 *      down the tree than the real <AuthProvider> in App.tsx, so useAuth()
 *      anywhere inside `children` resolves to the fake value below instead
 *      of the real one. This never touches AuthContext.tsx itself: it's the
 *      same context OBJECT, just given a second, closer provider - exactly
 *      the "shadow" 19.1's diagram describes, with zero edits to the file
 *      it shadows.
 *   2. Installs/uninstalls the data shadow (demoShadow.ts) for exactly the
 *      lifetime of this component - see the effect below for why the
 *      teardown here is the actual safety guarantee, not the mounting.
 *
 * Mounted ONLY by DemoFlowPage, itself reached only through the /demo/*
 * branch in App.tsx - verify with:
 *   grep -rn "DemoProvider" frontend/src --include=*.tsx
 * and confirm every hit is inside frontend/src/demo/.
 */
export default function DemoProvider({ member, tableHandlers, children }: DemoProviderProps) {
  // The REAL outer context - captured here, BEFORE this component renders
  // its own nested provider below, so this is the ancestor <AuthProvider>'s
  // value, not the fake one. See the effect below for why it's needed.
  const realOuterAuth = useAuth()
  const realLogoutRef = useRef(realOuterAuth.logout)
  realLogoutRef.current = realOuterAuth.logout

  /**
   * WAS THE VISITOR REALLY SIGNED IN WHEN THIS DEMO STARTED?
   *
   * Captured once, at mount, from the REAL outer context - before the fake
   * provider below can confuse the answer. The unmount cleanup used to call
   * the real `logout()` unconditionally, which is correct for a signed-out
   * visitor and is a genuine bug for everyone else: a member who was properly
   * logged in, opened a walkthrough to see how something works, and closed it
   * again was silently signed out of their own account and bounced to /login.
   *
   * A ref, not state, because the cleanup must read the value from mount time
   * and must never re-run - re-running is what would make this racy.
   */
  const wasReallySignedIn = useRef(realOuterAuth.isAuthenticated)

  // useLayoutEffect, NOT useEffect - found by actually watching the network
  // tab, not by reading the code (see this handoff's final report). React
  // runs children's effects before their parent's, in BOTH phases, but the
  // two phases themselves are strictly ordered: every layout effect in the
  // whole tree fires, THEN every passive effect fires. DemoProvider is an
  // ANCESTOR of the real app tree it renders (HomePage, OpeningsStrip,
  // AQNav's siblings...), so a useEffect here would still lose the race to
  // any descendant's OWN useEffect-driven fetch - which is exactly what
  // happened: OpeningsStrip's Promise.all([jobOpenings.getOpen(),
  // teamService.getTeams()]) fired, for real, against the live Supabase
  // project, before this effect ever ran, because both are passive effects
  // and the descendant's fires first. It failed closed (PGRST301, "Expected
  // 3 parts in JWT; got 2" - the garbage token in fakeIdentity.ts has no
  // real signature to check), which is the intended belt-and-suspenders
  // outcome for an ESCAPED request - but the point of this file is that
  // nothing should escape in the first place. useLayoutEffect fires
  // synchronously before paint and before ANY passive effect anywhere in
  // the same commit, parent or child, closing the gap at its root rather
  // than chasing individual early-firing components.
  useLayoutEffect(() => {
    const composerDraft = withSavedFlag(COMPOSER_DRAFT_KEY)
    composerDraft.suppress() // remove entirely - see withSavedFlag's own doc comment
    const referralRef = withSavedFlag(REFERRAL_KEY)
    referralRef.suppress() // remove entirely - see this file's header comment on aq_referral_ref
    const shadow = installDemoShadow({ member, tableHandlers })
    return () => {
      shadow.restore()
      composerDraft.restore()
      referralRef.restore()
      // Defence in depth, not the primary mechanism (uninstalling the
      // shadow above already means no further demo request can resolve
      // fake data). The remaining risk this closes: the REAL top-level
      // <AuthProvider> in App.tsx mounts unconditionally on every route,
      // including this one, and runs its own one-time session check on
      // mount. Forcing the REAL context's member back to null on the way
      // out - regardless of whether it ever actually picked up the fake
      // one - means a visitor who leaves the demo and lands back on a real
      // page can never inherit a fake "logged in" identity there. Nothing
      // inside the demo route itself ever reads this outer context (every
      // descendant sees the shadow below instead), so calling it here has
      // no effect on the demo UI - only on the real app state a visitor
      // returns to.
      // ONLY for a visitor who was signed out when the demo began. For them
      // this is the belt-and-braces described above: they cannot inherit a
      // fake identity on the real page they return to. For a genuinely
      // signed-in member there is nothing to clear and everything to lose -
      // the shadow is already uninstalled by this point, so their real
      // session is the only session left, and logging it out just throws
      // them out of the app for having read the docs.
      if (!wasReallySignedIn.current) {
        realLogoutRef.current().catch(() => {})
      }
    }
    // Intentionally mount-once: a flow's member/handlers are fixed for its
    // whole run (DemoFlowPage remounts this component - and generates a
    // fresh FixtureStore - per flow, via a `key`, rather than this effect
    // re-running mid-flow).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A React-visible snapshot of `member`. `member` itself is the one stable
  // object identity a flow's own table handlers close over and mutate
  // in-place (e.g. takeABreak.tsx's `members` UPDATE handler does
  // `Object.assign(member, payload)` for break_start/break_end) - necessary
  // because a real screen that self-mutates (ProfilePage's "come back early",
  // BreakModal's onSaved) calls the auth context's `refreshMember()`
  // expecting the member it reads back to reflect the write that just
  // happened. Found the same way as the localStorage keys above: BEFORE this
  // fix, refreshMember was a hard no-op (safe for the two flows that never
  // call it, but wrong for one that does), so ProfilePage's `onBreak` -
  // derived from `currentMember.break_end` - could never flip true and the
  // break banner never appeared even though the fixture write "succeeded".
  // liveMember starts as the same object and only visibly diverges once
  // something actually calls refreshMember(), so this is a no-op for every
  // flow that never does.
  const [liveMember, setLiveMember] = useState(member)

  const fakeAuthValue = {
    member: liveMember,
    isLoading: false,
    isAuthenticated: true,
    memberLoadFailed: false,
    // A demo write is never real, so there is nothing for logout to do to a
    // real session - kept as a safe no-op rather than wired to anything so
    // that a stray call from deep in the real UI (a settings page's log-out
    // button, say) can't reach the real supabase.auth.signOut either.
    logout: async () => {},
    // Re-reads whatever a flow's own handlers have mutated on the shared
    // `member` object (see liveMember's own comment above) and pushes a new
    // object reference so consumers re-render with it. Shallow clone only -
    // identity (uuid/member_id/role) never changes mid-flow, only fields a
    // real write can legitimately change (break_*, etc).
    refreshMember: async () => { setLiveMember({ ...member }) },
  }

  return (
    <AuthContext.Provider value={fakeAuthValue}>
      {/*
        A SECOND CapabilityProvider, nested inside the fake auth - same shadow
        trick as the line above, for the same reason, and it is not optional.

        REGRESSION THIS FIXES, found 2026-09-11 by running every flow: the
        capability engine added earlier that day put `useCan('action.…')`
        gates into the desk screens (AccountApprovals, PostModeration). The
        real <CapabilityProvider> is mounted in App.tsx ABOVE the whole router,
        so inside a demo it is an ANCESTOR of this component and still reads
        the REAL useAuth() - a signed-out visitor. `role` is therefore null,
        `effectiveCan` returns false for everything, and every gated control
        in a demo rendered as its denied state. Measured: the HoD approval
        flow's final step showed `<span class="mono xs muted">view only</span>`
        where the approve button should be, so the step's target did not exist
        and the walkthrough died on "lost the spot".

        Nesting it here puts it BELOW the fake auth, so it resolves against the
        flow's borrowed role instead. Its own fetch of `role_capabilities` hits
        the data shadow, which has no handler registered for that table and so
        THROWS (queryBuilder's onMiss) rather than reaching the network - the
        provider catches that and fails open onto the role's RLS ceilings,
        which is exactly what a demo wants: a borrowed HoD gets HoD ceilings,
        no request leaves the page, and the sandbox's zero-network promise is
        intact.
      */}
      <CapabilityProvider>
        {children}
      </CapabilityProvider>
    </AuthContext.Provider>
  )
}
