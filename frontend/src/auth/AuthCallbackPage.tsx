import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { AuthFullScreenSpinner } from '../components/AuthShell'
import { clearAuthIntent } from '../lib/authIntent'
import { isUnblockableTestAccount } from '../lib/testAccounts'
import { isRegistrationComplete } from '../lib/profileNudge'

// Post-OAuth landing page. Google's redirectTo now points here instead of
// /login (see LoginPage's handleGoogleLogin) - this component owns the ENTIRE
// post-auth routing decision so a returning OAuth user never renders the full
// login form before being bounced onward.
//
// The happy-path branch below was moved verbatim out of LoginPage's post-auth
// useEffect - don't rewrite that logic, it is a relocation.
const AuthCallbackPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { member, isLoading: authLoading, isAuthenticated, memberLoadFailed, logout, refreshMember } = useAuth()

  // Intended destination: router state (in-app bounce from LoginPage) wins,
  // then the sessionStorage stash written just before signInWithOAuth (the
  // full-page OAuth redirect drops router state), then '/'.
  const stashedFrom = typeof window !== 'undefined' ? sessionStorage.getItem('aq_oauth_from') : null
  // Same fix as LoginPage's own `from` - `.pathname` alone drops a query
  // string (e.g. `/profile/me?break=1`) that a shareable link relies on.
  const fromLoc = (location.state as { from?: { pathname: string; search?: string } })?.from
  const from = (fromLoc ? fromLoc.pathname + (fromLoc.search || '') : null) || stashedFrom || '/'

  // This page used to render an unconditional spinner with no timeout and no
  // way out, so any stall in the auth handshake left a 14-year-old on 3G
  // staring at it with no path forward. After 6s we offer the escape hatches.
  const [slow, setSlow] = useState(false)
  const [retrying, setRetrying] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 6000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!authLoading && isAuthenticated && member) {
      sessionStorage.removeItem('aq_oauth_from')
      // The post-sign-in redirect has actually resolved - the auth-intent
      // hero's job (saying WHY someone landed on /login) is done, regardless
      // of which of the four branches below fires. See lib/authIntent.ts.
      clearAuthIntent()
      // See lib/testAccounts.ts - the owner's own demo/test account skips
      // straight to the app regardless of status, so a mid-demo delete never
      // locks them out of the site they're trying to show people.
      if (isUnblockableTestAccount(member.email)) navigate(from, { replace: true })
      else if (!isRegistrationComplete(member)) navigate('/register', { replace: true })
      else if (member.status === 'active') navigate(from, { replace: true })
      else if (member.status === 'pending_approval') navigate('/pending', { replace: true })
      else if (member.status === 'rejected' || member.status === 'suspended' || member.status === 'deleted') navigate('/rejected', { replace: true })
    } else if (!authLoading && !isAuthenticated && !memberLoadFailed) {
      // Genuinely no session (OAuth failed/cancelled, or a direct visit) -
      // nothing to route, send back to the real entry point.
      //
      // The `!memberLoadFailed` guard is what breaks the infinite login loop:
      // when a session DOES exist but its members row couldn't be resolved,
      // bouncing to /login just sent the user back through Google, which
      // returned here instantly because the session was already live. That
      // case now falls through to the recovery card below instead.
      navigate('/login', { replace: true })
    }
  }, [authLoading, isAuthenticated, member, memberLoadFailed, navigate, from])

  const startOver = async () => {
    sessionStorage.removeItem('aq_oauth_from')
    await logout()
    navigate('/login', { replace: true })
  }

  const retry = async () => {
    setRetrying(true)
    try { await refreshMember() } finally { setRetrying(false) }
  }

  const showRecovery = (!authLoading && !isAuthenticated && memberLoadFailed) || slow

  if (!showRecovery) return <AuthFullScreenSpinner />

  return (
    <div
      className="route-enter"
      style={{
        minHeight: '100dvh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 'var(--page-px, 24px)',
      }}
    >
      <div className="card" style={{ padding: 28, maxWidth: 420, textAlign: 'center' }}>
        <div className="h-display" style={{ fontSize: 26, margin: 0 }}>
          {memberLoadFailed ? 'almost there' : 'still working…'}
        </div>
        <p style={{ color: 'var(--ink-2)', marginTop: 10, lineHeight: 1.6 }}>
          {memberLoadFailed
            ? "we signed you in, but couldn't load your profile. this is usually a slow connection, not your account."
            : 'this is taking longer than usual. your connection may be slow.'}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={retry} disabled={retrying}>
            {retrying ? 'retrying…' : 'try again'}
          </button>
          <button className="btn" onClick={startOver} disabled={retrying}>
            start over
          </button>
        </div>
      </div>
    </div>
  )
}

export default AuthCallbackPage
