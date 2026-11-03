import './LoginPage.css'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { AuthFullScreenSpinner, AuthSpinner } from '../components/AuthShell'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { trackSignInStarted } from '../lib/funnel'
import { PLACE_AND_YEAR, ORG_FACTS, displayCount } from '../lib/orgFacts'
import { pickAuthCopy, readAuthFacts } from '../lib/authCopy'
import { splitHeadline } from '../lib/authTokens'
import { readAuthIntent } from '../lib/authIntent'
import { resolveAuthHero } from '../lib/authHero'
import AuthHero from './AuthHero'
import ReferralInviteBanner from '../referrals/ReferralInviteBanner'
import { rememberReferral, isReferralId } from '../referrals/claimStoredReferral'
import ErrorState from '../components/ErrorState'
import { Mascot } from '../components/Mascot'

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, flexShrink: 0 }} aria-hidden>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

const LoginPage = () => {
  useMeta(pageMetadata.login)
  const navigate = useNavigate()
  const location = useLocation()
  const { member, isLoading: authLoading, isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Returning vs first-time - flips the "welcome" / "welcome back" heading.
  // Read-only lazy init (StrictMode double-invokes state initializers in dev -
  // writing localStorage inside one would silently flip a real first-time
  // visitor to "returning" on the very first render); the write-once side
  // effect lives in the useEffect below instead.
  const [firstVisit] = useState(() =>
    typeof window !== 'undefined' && !localStorage.getItem('aq_visited_before')
  )
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('aq_visited_before', '1')
  }, [])

  // Step 39. Resolved ONCE per mount and memoised, per constraint 3: a
  // re-render must not be able to swap the headline while it is being read.
  // The dependency list is deliberately empty of anything that changes during
  // the session - `firstVisit` is already a one-shot lazy value.
  //
  // The old `firstVisit ? ... : ...` branches for the heading and subline are
  // GONE from this component: that decision is now the `visits.second` rule
  // inside authCopy.ts, so there is one place that decides what this screen
  // says. The eyebrow keeps its own firstVisit branch, because it is a state
  // badge rather than copy.
  useEffect(() => {
    // The visit counter feeds the "still deciding?" rule. Capped in
    // readAuthFacts; incremented once per mount.
    try {
      const n = Number(localStorage.getItem('aq_login_visits') || '0')
      localStorage.setItem('aq_login_visits', String(Math.min((Number.isFinite(n) ? n : 0) + 1, 9)))
    } catch { /* private mode, the cold opener is the right fallback */ }
  }, [])

  const copy = useMemo(() => pickAuthCopy(readAuthFacts()), [])

  // REDESIGN 2026-09-09, second pass: the previous redesign put a real drive
  // photo full-bleed behind the card (welfare_projects.main_image, fetched
  // fresh per mount). Replaced with an illustrated garden built from the
  // app's own mascot cast (components/Mascot.tsx - real border-radius shapes,
  // no image asset, so nothing to fetch and nothing that can fail offline).
  // `pickAuthCopy`/`resolveAuthHero` still give the TEXT its per-visit
  // variety; the mascots are the one constant piece of brand furniture, not a
  // per-visit random pick, so the page reads as "this is AquaTerra" on every
  // load rather than picking a different scene each time.

  // The contextual "why did you land here" hero, ABOVE the card below - a
  // wholly separate system from `copy` above it. `copy` infers a headline
  // from ambient signals (referrer, UTM, visit count); this hero renders only
  // an EXPLICIT intent some other screen wrote to sessionStorage the instant
  // it redirected here (see lib/authIntent.ts). Keyed on `location.key`, not
  // a mount-only initialiser: a second `setAuthIntent()` followed by a
  // re-navigate to /login while a tab is already sitting on it (e.g. another
  // "log in to apply" press) has to actually re-render with the new intent,
  // which a `useState(() => …)` lazy initialiser would miss. `location.key`
  // is deliberately in the dependency array even though `readAuthIntent()`
  // never reads it - it exists purely to force recomputation on navigation
  // identity, not on any value the function consumes, which is exactly what
  // exhaustive-deps can't distinguish from a stray dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const intent = useMemo(() => readAuthIntent(), [location.key])
  const heroCounts = useMemo(() => ({
    membersDisplay: displayCount(ORG_FACTS.membersTotal),
    departmentsActive: ORG_FACTS.departmentsActive,
    drivesDisplay: displayCount(ORG_FACTS.drivesWrittenUp),
  }), [])
  const hero = useMemo(() => resolveAuthHero(intent, heroCounts), [intent, heroCounts])

  // The three garden mascots subtly lean toward the cursor on desktop, or the
  // device's tilt on mobile - a live-feeling detail, not Companion.tsx's
  // "follow the pointer across the screen" mechanic (a few px, never a chase).
  // `useReducedMotion` disables it entirely, matching this file's other motion.
  const gardenTiltRefs = useRef<(HTMLSpanElement | null)[]>([])
  const [needsGyroTap, setNeedsGyroTap] = useState(false)
  const requestGyroRef = useRef<(() => void) | null>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (reducedMotion || typeof window === 'undefined') return
    const tilts = gardenTiltRefs.current.filter((el): el is HTMLSpanElement => !!el)
    if (!tilts.length) return
    const MAX = 6 // px - "subtle", never the whole-panel chase Companion.tsx does

    const applyFromViewportPoint = (px: number, py: number) => {
      tilts.forEach(el => {
        const r = el.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const dx = Math.max(-1, Math.min(1, (px - cx) / 300)) * MAX
        const dy = Math.max(-1, Math.min(1, (py - cy) / 300)) * MAX
        el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`
      })
    }

    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches
    if (!coarsePointer) {
      const onMove = (e: PointerEvent) => applyFromViewportPoint(e.clientX, e.clientY)
      window.addEventListener('pointermove', onMove, { passive: true })
      return () => window.removeEventListener('pointermove', onMove)
    }

    // Mobile: device orientation drives the same offset instead of a pointer.
    //
    // NOT verified against a real device in this sandboxed environment - the
    // beta/gamma -> screen-point mapping below is a reasonable read of the
    // DeviceOrientationEvent spec, not something exercised on hardware, so
    // give this a real phone check before shipping. The safe default either
    // way is the mascots simply staying static, which is what happens if the
    // API is missing, permission is refused, or a reading looks unusable.
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      const px = window.innerWidth / 2 + Math.max(-1, Math.min(1, e.gamma / 30)) * 300
      const py = window.innerHeight / 2 + Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * 300
      applyFromViewportPoint(px, py)
    }

    const DOE = (window as any).DeviceOrientationEvent
    if (DOE && typeof DOE.requestPermission === 'function') {
      // iOS 13+: only a real tap may call this - browsers reject a bare call
      // made on mount. `requestGyroRef` is fired from the tap affordance
      // rendered below, never from here.
      requestGyroRef.current = () => {
        DOE.requestPermission()
          .then((state: string) => {
            if (state === 'granted') window.addEventListener('deviceorientation', onOrientation)
          })
          .catch(() => { /* denied, or the call itself failed - stay static */ })
        setNeedsGyroTap(false)
      }
      setNeedsGyroTap(true)
    } else if ('DeviceOrientationEvent' in window) {
      // Android and pre-13 iOS: no permission gate, events just work.
      window.addEventListener('deviceorientation', onOrientation)
    }

    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
      requestGyroRef.current = null
    }
  }, [reducedMotion])

  // A6 is a VARIANT, not a replacement (decision 2 of the 2026-09-05 study).
  // It fires only where the engine has high-confidence intent worth a one-line
  // treatment, which in practice means a rule that marked an emphasis. Every
  // other rule - including the cold opener, which is what most visitors get -
  // keeps the eyebrow + heading + paragraph layout. That keeps the change
  // reversible and stops a layout swap riding on a weak signal, which is the
  // same caution the experience brief's confidence ladder asks for.
  const isA6 = !!copy.emphasis

  // Section 15. The invite id off `/login?ref=<uuid>`, read ONCE per mount for
  // the same reason `copy` is: the sentence under the headline must not be able
  // to appear or vanish while someone is reading it. This is a read-only lazy
  // initialiser - the localStorage write lives in the effect below, because
  // StrictMode double-invokes initialisers in development and a write in here
  // would run twice.
  //
  // Validated to a uuid before it is used for anything. `ref` carries a
  // `referrals.id`, so anything else is not a stale invite, it is not an
  // invite: it can never log a click (the FK refuses it) and can never be
  // claimed. Saying "a member sent you this link" over a value with nothing
  // behind it would be a claim with no source, which is the one thing this
  // section is not allowed to print.
  const [referralId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    const raw = new URLSearchParams(window.location.search).get('ref')
    return isReferralId(raw) ? raw : null
  })

  // Carry the invite across the funnel. `claim_member_referral` refuses anyone
  // who is not already `status = 'active'` (read live from pg_proc), so the
  // claim cannot happen on this screen, at /register, or at /pending - it
  // happens at the first active render, days later. localStorage, therefore,
  // not the sessionStorage used for `aq_oauth_from` a few lines down, which
  // only has to survive one redirect.
  useEffect(() => {
    rememberReferral(referralId)
  }, [referralId])

  // Was `.pathname` alone, which silently dropped any query string a
  // ProtectedRoute redirect was carrying - a shareable link like
  // `/profile/me?break=1` lost the `?break=1` on the way through here,
  // landing a signed-out visitor on a bare profile page post-login instead
  // of the form the link promised. `.search` already starts with '?' or is
  // '', so this concatenates cleanly either way.
  const fromLoc = (location.state as { from?: { pathname: string; search?: string } })?.from
  const from = fromLoc ? fromLoc.pathname + (fromLoc.search || '') : '/'

  // Guard only - an already-authenticated visitor landing on /login (back
  // button, stale tab, bookmark) is bounced to the callback page, which owns
  // the actual four-way routing decision (register / home / pending /
  // rejected). LoginPage itself no longer branches on member status.
  useEffect(() => {
    if (!authLoading && isAuthenticated && member) {
      navigate('/auth/callback', { replace: true, state: { from: { pathname: from } } })
    }
  }, [authLoading, isAuthenticated, member, navigate, from])

  if (authLoading) {
    return <AuthFullScreenSpinner />
  }

  const handleGoogleLogin = async () => {
    setIsLoading(true); setError(null)
    // Fired BEFORE signInWithOAuth: that call navigates the whole page to
    // Google, so anything queued after it may never be sent.
    trackSignInStarted('google', { firstVisit })
    try {
      // The full-page OAuth redirect drops router state, so stash the intended
      // destination for AuthCallbackPage to pick up (and clear) after Google
      // sends the user back.
      try {
        if (from && from !== '/') sessionStorage.setItem('aq_oauth_from', from)
        else sessionStorage.removeItem('aq_oauth_from')
      } catch { /* storage unavailable - fall back to '/' */ }
      const { error: e } = await supabaseCommunity.auth.signInWithOAuth({
        provider: 'google',
        // Return to /auth/callback - a dedicated spinner-only page that owns
        // the post-auth routing decision (new → /register, pending →
        // /pending, rejected → /rejected, active → app). Avoids flashing the
        // full login form for a returning OAuth user before bouncing them on.
        options: { redirectTo: window.location.origin + '/auth/callback' },
      })
      if (e) throw e
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google')
      setIsLoading(false)
    }
  }

  return (
    <div className="lg-page">
      {/* REDESIGN 2026-09-09, second pass: full rebuild, not a patch on the
          previous ink-page card. Two panes: an illustrated garden built from
          the real mascot cast (never an image asset - components/Mascot.tsx
          is pure border-radius shapes), and the sign-in card. `/login` sits
          inside PublicLayout, which owns the page's single <main
          id="main-content">. */}
      <div className="lg-garden" aria-hidden>
        <div className="lg-garden-word">
          <span>AquaTerra</span>
          {/* Said "est. 2023" against eleven other surfaces saying 2021 —
              including About's own founding narrative — on the one page
              where someone is deciding whether this org is real. */}
          <span className="lg-garden-tag">{PLACE_AND_YEAR}</span>
        </div>
        <span className="lg-garden-mascot lg-garden-mascot--a">
          <span className="lg-garden-tilt" ref={el => { gardenTiltRefs.current[0] = el }}>
            <Mascot character="nolen" pose="idle" size={110} />
          </span>
        </span>
        <span className="lg-garden-mascot lg-garden-mascot--b">
          <span className="lg-garden-tilt" ref={el => { gardenTiltRefs.current[1] = el }}>
            <Mascot character="mishti" pose="idle" size={110} />
          </span>
        </span>
        <span className="lg-garden-mascot lg-garden-mascot--c">
          <span className="lg-garden-tilt" ref={el => { gardenTiltRefs.current[2] = el }}>
            <Mascot character="tuk" pose="idle" size={110} />
          </span>
        </span>
        {needsGyroTap && (
          // iOS-only affordance: DeviceOrientationEvent.requestPermission()
          // must be called from a real tap. Small and easy to ignore on
          // purpose - the mascots already work (static) without it.
          <button
            type="button"
            className="lg-garden-gyro-enable"
            onClick={() => requestGyroRef.current?.()}
          >
            tap for tilt
          </button>
        )}
        {/* The contextual "why did you land here" hero lives in the garden,
            not stacked above the card: it is scene-setting copy, the card
            below is the action. Untouched logic - AuthHero only gets a new
            skin (AuthHero.css) to sit on paper instead of ink. */}
        <div className="lg-garden-hero">
          <AuthHero hero={hero} navKey={`${location.key}:${hero.kind}`} />
        </div>
      </div>

      <div className="lg-card" data-first={String(firstVisit)}>
        <Link to="/" className="lg-back">← back to site</Link>

        <div className={'lg-body' + (isA6 ? ' is-a6' : '')}>
          {/* A6 (section 02 step 40) drops the eyebrow, because the layout's
              whole idea is ONE line carrying the state instead of a badge
              above a heading plus a paragraph. The eyebrow stays for every
              other rule, where it is still the thing that says welcome vs
              welcome back. */}
          {!isA6 && (
            <span className="sticker sticker-mint lg-eyebrow">
              {firstVisit ? '★ welcome' : '★ welcome back'}
            </span>
          )}

          {/* Two treatments, one heading.

              DEFAULT: the serif-italic word is the brand's one register shift
              per screen. The engine returns a plain string, so the italic goes
              on the last word rather than being baked into every rule.

              A6: the rule marks which clause stays ink; everything else greys.
              `splitHeadline` guarantees the segments rejoin to the original
              string exactly, so a mismatched or absent emphasis degrades to
              the whole headline in ink rather than to a broken line. The
              serif italic is dropped here on purpose - greying a clause and
              italicising a word are two emphasis systems, and running both in
              one line means neither reads. */}
          <h1 className="h-display lg-heading">
            {isA6 ? (
              splitHeadline(copy.headline, copy.emphasis).map((seg, i) => (
                <span key={i} className={seg.strong ? undefined : 'lg-muted'}>{seg.text}</span>
              ))
            ) : (
              (() => {
                const words = copy.headline.split(' ')
                const last = words.pop() as string
                return <>{words.join(' ')} <i>{last}</i></>
              })()
            )}
            {/* Inline tokens sit INSIDE the sentence, after the last clause.
                Count pills only today; see lib/authTokens.ts. */}
            {isA6 && copy.tokens?.map((t, i) =>
              t.kind === 'count' ? (
                <span key={i} className="lg-token" aria-hidden>
                  <b>{t.value}</b><i>{t.label}</i>
                </span>
              ) : (
                <img key={i} className="lg-token lg-token-photo" src={t.src} alt={t.alt} width={40} height={40} />
              ),
            )}
          </h1>
          {/* This copy is doing funnel work, not decoration. There is no
              separate sign-up form anywhere in the app — a first-time Google
              sign-in IS the sign-up (AuthContext.fetchMember calls ensure_member()
              and routes to /register). Prospective members were reading
              "Sign in" + "log in", concluding an account had to exist first,
              going to look for a non-existent "create account" button, and
              bouncing. Say the quiet part out loud. */}
          <p className="lg-sub">{copy.subline}</p>

          {/* Section 15, card R3. Sits UNDER the headline `pickAuthCopy`
              produces, never above it: `referral.role` and `referral.ref` are
              already rules inside authCopy.ts, so this block adds the context
              line and never a second headline competing with the first.

              It renders null when there is no `ref`, so it can sit here
              unconditionally. It logs the click itself, once per id - do not
              add a second recordClick call anywhere. And it takes ONE prop on
              purpose: the referrer's name, their note and the team they picked
              are all unreadable to a signed-out visitor by RLS, so anything
              said about them here would be a claim, not a source. */}
          <div className="lg-invite">
            <ReferralInviteBanner referralId={referralId} />
          </div>

          {/* changelog/11-system-states.md §11.4 + ACCEPTANCE.md §B: the
              shared `ErrorState` primitive (tinted well at .16, `--danger`
              glyph, ink text, `role="alert"`) with a real retry. It replaces
              a hand-rolled `.lg-error`: a SOLID `--rust` fill with `--paper`
              text (the inverse of 11.4's "ink text on the tint") whose only
              control was a dismiss ×. A dismiss removes the sentence and
              leaves the visitor unable to sign in; `try again` re-runs the
              OAuth call that failed. */}
          {error && (
            <div className="lg-error-slot">
              <ErrorState message={error} onRetry={handleGoogleLogin} />
            </div>
          )}

          {/* Owner request 2026-09-14: the page didn't say, in so many words,
              that pressing this button means joining AquaTerra - "Sign in"
              copy reads as a returning-user action even with lg-signup-note
              right below it. One short label directly over the CTA, where
              someone deciding whether to click is already looking. */}
          <p className="lg-join-label mono xs upper">join aquaterra:</p>

          <button
            className="btn lg-google"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <AuthSpinner small />
                signing in…
              </>
            ) : (
              <>
                <GoogleIcon />
                {copy.primaryLabel}
              </>
            )}
          </button>

          {/* Sits directly under the CTA, where someone hunting for a
              "create account" button is already looking. Kept to one line —
              the numbered steps below carry the detail, and saying it twice
              at length just makes both versions easier to skip. */}
          <p className="lg-signup-note">
            <strong>This is the sign-up.</strong> No separate form. Your Google
            account is your AquaTerra account.
          </p>

          {/* The email/password fallback (behind a "use email and password
              instead" toggle) was removed 2026-09-06: live data showed 0 of
              104 real users have a password set (`auth.users.encrypted_password`)
              and no code path anywhere lets one be created or reset, so the
              toggle was a dead end for every real visitor, not a fallback for
              "a handful of accounts predating OAuth" as the old comment here
              assumed — that handful is empirically zero. Google is the only
              working sign-in path; `handleGoogleLogin` above is it. */}

          {/* The whole journey in three beats. People weren't bouncing because
              the button was hard to find — they bounced because they couldn't
              tell what pressing it would commit them to. Showing the full path
              (including that a human approves you) removes that. Kept to three
              short steps; anything longer reads as a form to dread.
              Owner request 2026-09-14: A6 used to demote this to one dense
              fine-print line (step 40) - too easy to miss on the exact
              variant (referral/high-intent landings) where "what does this
              commit me to" matters most. Same three-card graphic now renders
              on every variant. */}
          <ol className="lg-steps" aria-label="How joining works">
            {/* Step 18: each li is now a bordered card and a flex ROW, so the
                title and detail need a column wrapper. The old markup relied on
                a two-column grid with named areas. Copy is unchanged. */}
            <li>
              <span className="lg-step-n" aria-hidden>1</span>
              <span className="lg-step-txt">
                <span className="lg-step-t">Sign in with Google</span>
                <span className="lg-step-d">one tap, no password to make</span>
              </span>
            </li>
            <li>
              <span className="lg-step-n" aria-hidden>2</span>
              <span className="lg-step-txt">
                <span className="lg-step-t">Add your name &amp; class</span>
                <span className="lg-step-d">takes about a minute</span>
              </span>
            </li>
            <li>
              <span className="lg-step-n" aria-hidden>3</span>
              <span className="lg-step-txt">
                <span className="lg-step-t">HR approves you</span>
                {/* REDESIGN 2026-09: was "teams, drives, points". Section 02
                    freezes this copy, and it is changed here for the same
                    reason the BreakModal string was: the thing it promises no
                    longer exists, so leaving it would make the funnel's most
                    load-bearing screen tell a new member about a feature they
                    will never find. */}
                <span className="lg-step-d">then you’re in: teams, drives, the feed</span>
              </span>
            </li>
          </ol>

        </div>
      </div>
    </div>
  )
}

export default LoginPage
