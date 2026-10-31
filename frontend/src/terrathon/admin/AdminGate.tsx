import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabaseCommunity } from '../../lib/supabaseCommunity'
import { useAuth } from '../../auth/AuthContext'
import { deskGate } from '../lib/deskGate'
import { EVENT } from '../config'
import { Wordmark } from '../components/Wordmark'

/**
 * The way into the TerraThon desk.
 *
 * Deliberately NOT the HoD desk and deliberately not /login. The desk is part
 * of this section: you reach it from the translucent link at the foot of the
 * page, you sign in on a panel that looks like the rest of TerraThon, and you
 * land on a screen that has nothing to do with /director.
 *
 * What is NOT separate is the thing that actually protects the data.
 *
 * The obvious reading of "its own login with a username and password" is one
 * shared password checked in the browser. That was considered and rejected,
 * because of how this app is built: there is no API server, the browser talks
 * to PostgREST directly, and every `terrathon_*` table is gated by RLS on
 * `is_director() or is_super_admin()`. A password checked in JavaScript would
 * have to ship inside the bundle or sit in a readable table, and, much worse,
 * the database would have no way to tell an admin from a stranger, so a few
 * hundred registrants' names and phone numbers would be protected by a modal
 * and nothing else.
 *
 * So this signs a real Supabase session in with email and password. The account
 * is a dedicated TerraThon one rather than anybody's personal login, it carries
 * a leader role so the existing RLS policies recognise it, and the session it
 * creates is what the database checks on every single read. The panel below is
 * convenience; the policies are the boundary.
 */

/** The desk can be opened from TerraThon's own routes or from the AquaTerra.live admin; the words and the way back follow. */
export type GateBrand = 'terrathon' | 'live'
const BRANDS: Record<GateBrand, { name: string; base: string }> = {
  terrathon: { name: 'TerraThon', base: EVENT.base },
  live: { name: 'AquaTerra.live', base: '/live' },
}

function SignInPanel({ onDone, brand }: { onDone: () => void; brand: GateBrand }) {
  const b = BRANDS[brand]
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => { emailRef.current?.focus() }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { error: err } = await supabaseCommunity.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (err) {
        // Deliberately one message for both a wrong address and a wrong
        // password: saying which was right tells someone probing the form
        // whether an account exists.
        setError('That email and password do not match an account.')
        return
      }
      onDone()
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="tt-wrap tt-page" style={{ maxWidth: 440 }}>
      <form className="tt-card tt-card--raised" onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        {brand === 'terrathon' ? <Wordmark size={34} tone="paper" /> : <div className="tt-kicker">{b.name}</div>}
        <div>
          <h1 style={{ fontSize: 30, textTransform: 'uppercase' }}>Desk sign-in</h1>
          <p style={{ margin: '6px 0 0', fontSize: 'var(--tt-fs-body)', color: 'var(--tt-muted)', lineHeight: 1.55 }}>
            For the {b.name} team only. This is a separate account from your own AquaTerra login.
          </p>
        </div>

        {error && (
          <p className="tt-err" role="alert" style={{ margin: 0 }}>{error}</p>
        )}

        <div>
          <label className="tt-label" htmlFor="tt-admin-email">Email</label>
          <input
            id="tt-admin-email" ref={emailRef} className="tt-input"
            type="email" autoComplete="username" required
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="tt-label" htmlFor="tt-admin-pw">Password</label>
          <input
            id="tt-admin-pw" className="tt-input"
            type="password" autoComplete="current-password" required
            value={password} onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="tt-btn" disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Open the desk'}
        </button>
        <Link to={b.base} className="tt-btn tt-btn--quiet" style={{ width: '100%' }}>
          Back to {b.name}
        </Link>
      </form>
    </div>
  )
}

function Refused({ title, body, fix, showSignOut, brand = 'terrathon' }: {
  title: string
  body: string
  /** The one link that actually unblocks this state. A refusal with no way
   *  forward is a dead end, and the first person to set the desk up hits
   *  every one of these states in order. */
  fix?: { to: string; label: string }
  showSignOut?: boolean
  brand?: GateBrand
}) {
  return (
    <div className="tt-wrap tt-page" style={{ maxWidth: 440 }}>
      <div className="tt-card" style={{ display: 'grid', gap: 12 }}>
        <div className="tt-kicker" style={{ color: 'var(--tt-amber)' }}>Not your desk</div>
        <h1 style={{ fontSize: 30, textTransform: 'uppercase' }}>{title}</h1>
        <p style={{ margin: 0, fontSize: 'var(--tt-fs-body)', color: 'var(--tt-muted)', lineHeight: 1.6 }}>{body}</p>
        {fix && <Link to={fix.to} className="tt-btn">{fix.label}</Link>}
        {showSignOut && (
          <button
            type="button"
            className="tt-btn tt-btn--quiet"
            onClick={() => { void supabaseCommunity.auth.signOut() }}
          >
            Sign in as someone else
          </button>
        )}
        <Link to={BRANDS[brand].base} className="tt-btn tt-btn--quiet">Back to {BRANDS[brand].name}</Link>
      </div>
    </div>
  )
}

export function AdminGate({ children, brand = 'terrathon' }: { children: React.ReactNode; brand?: GateBrand }) {
  const { member, loading } = useAuth() as any
  const [justSignedIn, setJustSignedIn] = useState(0)

  // AuthContext owns the session and re-fetches the member row on an auth
  // change, so signing in here does not need its own listener. This counter
  // only exists to re-render immediately rather than waiting for that round
  // trip to land.
  useEffect(() => { /* re-render on sign-in */ }, [justSignedIn])

  // The decision itself lives in lib/deskGate.ts as a pure function, so the
  // five refusal shapes are unit-tested rather than reachable only by holding
  // five differently-broken real accounts. This component just renders it.
  const gate = deskGate(member, loading)

  if (gate === 'loading') {
    return (
      <div style={{ minHeight: '50vh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Loading">
        <div
          style={{
            width: 28, height: 28, borderRadius: '50%',
            border: '3px solid rgba(10,10,10,0.14)', borderTopColor: 'var(--tt-hot)',
            animation: 'spin 0.7s linear infinite',
          }}
        />
      </div>
    )
  }

  if (gate === 'signed-out') return <SignInPanel onDone={() => setJustSignedIn((n) => n + 1)} brand={brand} />

  // Each refusal names the desk that unblocks it, and they are ordered by what
  // has to happen first. A brand-new account fails all three at once, so
  // reporting the last of them would strand whoever is setting the desk up.
  if (gate === 'incomplete-profile') {
    return (
      <Refused brand={brand}
        title="Finish your profile first"
        body="This account still needs a class and a phone number. Every entrance to the app asks for them, this one included. It takes about a minute."
        fix={{ to: '/register', label: 'Finish the profile' }}
        showSignOut
      />
    )
  }

  if (gate === 'pending-approval') {
    return (
      <Refused brand={brand}
        title="Waiting on approval"
        body="This account exists but has not been approved yet. A super admin approves it on the Account Approvals desk, then promotes it, and this page opens."
        showSignOut
      />
    )
  }

  if (gate === 'inactive') {
    return (
      <Refused brand={brand}
        title="This account is closed"
        body={`This account is no longer active, so it cannot open the desk. Sign in with the ${BRANDS[brand].name} team account.`}
        showSignOut
      />
    )
  }

  if (gate === 'not-a-leader') {
    return (
      <Refused brand={brand}
        title="You don't run the gate"
        body="This account is approved but does not carry a leader role, so the database will not return any registrations to it. A super admin promotes it on the Director Management desk. Otherwise, sign in with the TerraThon team account."
        showSignOut
      />
    )
  }

  return <>{children}</>
}
