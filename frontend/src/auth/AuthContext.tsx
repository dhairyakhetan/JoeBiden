import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { Database } from '../lib/database.types'
import { resolveDevPreviewRole, makeDevPreviewMember } from '../lib/devPreview'
import savedStore from '../lib/savedStore'
import { clearRecent } from '../lib/recentlyViewed'
import { discardComposerDraft } from '../feed/composer/useComposerDraft'
import { MEMBER_CACHE_KEY } from '../lib/cachedIdentity'
import { clearSnapshots } from '../lib/homeSnapshot'
import { actionForAuthEvent } from './authEvents'

/**
 * Every browser-local store that belongs to the member who was signed in, and
 * is NOT keyed by their uuid. Sign-out has to say so explicitly, because on a
 * shared browser - which is most of this org's users - the next person to sign
 * in would otherwise open the composer to the previous member's unsent post
 * and find their browsing history in "recently viewed."
 *
 * Deliberately NOT cleared here: `aq_visited*` / intro-seen flags (device
 * preferences, not member data) and anything already scoped by member uuid.
 */
function clearMemberLocalState(): void {
  savedStore.clear()
  discardComposerDraft()
  clearRecent()
  // The home-screen snapshot (lib/homeSnapshot) is a copy of what this member's feed last showed. It is keyed by member, but on a
  // shared browser it still must not outlive the sign-out.
  clearSnapshots()
}

type Member = Database['public']['Tables']['members']['Row']

// DEV-only: null in production (import.meta.env.DEV gate inside).
const DEV_PREVIEW_ROLE = resolveDevPreviewRole()

interface AuthContextType {
  member: Member | null
  isLoading: boolean
  isAuthenticated: boolean
  /**
   * True when we have a live Supabase session but could NOT resolve its
   * members row (RPC error, timeout, ensure_member failure). Distinct from
   * plain `!isAuthenticated`, which also covers "no session at all".
   *
   * Without this the two cases were indistinguishable, and a first-time
   * signup whose member fetch failed looped forever: AuthCallbackPage saw
   * !isAuthenticated and bounced to /login, LoginPage saw !isAuthenticated
   * and rendered the Google button, Google still had a live session so it
   * returned instantly to the callback - with no error text on screen at any
   * point. A returning user never hit it because they had a cached member.
   */
  memberLoadFailed: boolean
  logout: () => Promise<void>
  refreshMember: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// ── Member cache (stale-while-revalidate) ──────────────────────────────────
// The app derives isAuthenticated from the members-table row. Without a cache,
// EVERY page load blocked on a Tokyo round-trip (~150ms+) before it knew you
// were logged in - which read as "slow" and, when the fetch stalled/raced,
// as "signed in sometimes, signed out other times / stuck on loading".
// We persist the row in localStorage and hydrate it synchronously on boot, so
// the UI paints logged-in instantly and revalidates in the background. The
// network is the source of truth; the cache only removes the blocking wait.
// (Client-side role only chooses which UI renders - all data access is still
// RLS-gated server-side, so a tampered cache cannot read protected data.)
// Render-optimization only - a stale cache never grants access RLS wouldn't:
// every seed from cache is revalidated against Supabase in the background
// (see the `initSession` effect below), and route guards (ProtectedRoute)
// always check the *current* context `member`, which fetchMember() overwrites
// once the network responds. This is purely "how fast do we paint the
// logged-in UI on a returning visit", never a substitute for the real check.
const MEMBER_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24h

// Does a Supabase auth-token actually exist in storage? supabase-js persists the
// session under `sb-<ref>-auth-token` (possibly chunked `.0/.1`). If it's gone,
// there is no session - so a lingering member cache is STALE and must not be
// trusted, otherwise the login page would treat a logged-out visitor as logged
// in and instantly redirect them away ("auth page is buggy").
function hasSupabaseSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith('sb-') && k.includes('-auth-token')) return true
    }
  } catch {
    /* storage blocked - fall through */
  }
  return false
}

type MemberCacheEntry = { member: Member; cachedAt: number }

function readMemberCache(): Member | null {
  try {
    // Only trust the cached member if a session token is present. A cache that
    // outlives its session (server-side expiry, sign-out elsewhere) is dropped.
    if (!hasSupabaseSession()) {
      localStorage.removeItem(MEMBER_CACHE_KEY)
      return null
    }
    const raw = localStorage.getItem(MEMBER_CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as MemberCacheEntry
    if (!entry || typeof entry.cachedAt !== 'number' || !entry.member) return null
    if (Date.now() - entry.cachedAt > MEMBER_CACHE_MAX_AGE_MS) {
      // Stale - still revalidated on every mount anyway, but past 24h we'd
      // rather block briefly on the network than paint a very old identity.
      localStorage.removeItem(MEMBER_CACHE_KEY)
      return null
    }
    return entry.member
  } catch {
    return null
  }
}

function writeMemberCache(m: Member | null) {
  try {
    if (m) {
      const entry: MemberCacheEntry = { member: m, cachedAt: Date.now() }
      localStorage.setItem(MEMBER_CACHE_KEY, JSON.stringify(entry))
    } else {
      localStorage.removeItem(MEMBER_CACHE_KEY)
    }
  } catch {
    /* private mode / quota - caching is best-effort */
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Hydrate from cache synchronously: a returning user is logged-in on frame 1.
  // DEV preview short-circuits to a synthetic member (see lib/devPreview).
  const [member, setMemberState] = useState<Member | null>(
    () => DEV_PREVIEW_ROLE ? makeDevPreviewMember(DEV_PREVIEW_ROLE) : readMemberCache()
  )
  // Only BLOCK first paint when we have nothing cached and must ask the network
  // who this is. With a cached member we render immediately and revalidate.
  const [isLoading, setIsLoading] = useState<boolean>(
    () => DEV_PREVIEW_ROLE ? false : readMemberCache() === null
  )

  // See AuthContextType.memberLoadFailed. Set by fetchMember's error paths,
  // cleared centrally the moment any real member row lands.
  const [memberLoadFailed, setMemberLoadFailed] = useState(false)

  // Single setter that keeps the persistent cache in lock-step with state.
  const setMember = useCallback((m: Member | null) => {
    setMemberState(m)
    writeMemberCache(m)
    if (m) setMemberLoadFailed(false)
  }, [])

  // Resolve the members row for an auth user. CRITICAL: only clear the member
  // when the query SUCCEEDS but returns no row AND we self-heal to nothing.
  // On a transient failure (network blip, RLS hiccup, timeout) we KEEP the
  // current/cached member - nulling there is exactly what surfaced as random
  // mid-session "logouts". maybeSingle() distinguishes 0-rows from real errors.
  // _userId: kept for caller symmetry (session.user.id); get_own_member()
  // resolves via auth.uid() server-side and no longer needs it as a param.
  const fetchMember = useCallback(async (_userId: string) => {
    try {
      // get_own_member() (SECURITY DEFINER RPC) instead of a raw `select('*')`
      // on members - it returns the caller's own row regardless of the
      // authenticated role's column grants on email/phone/auth_uid/google_id,
      // which are locked down at the column level (see
      // scripts/members_pii_lockdown_2026_07_29.sql). A plain `select('*')`
      // would now fail outright for those columns.
      const { data, error } = await supabaseCommunity
        .rpc('get_own_member' as never)
        .maybeSingle()

      if (error) {
        console.error('[Auth] fetchMember transient error (keeping state):', error)
        setMemberLoadFailed(true)
        return // keep cached/in-memory member - do NOT flip to logged-out
      }
      if (data) { setMember(data as any); return }

      // Valid session but NO members row (row removed, or an OAuth user the
      // signup trigger missed). members has no INSERT RLS policy, so bootstrap
      // via the SECURITY DEFINER ensure_member() RPC (creates only the caller's
      // own pending row), then re-read. On RPC/refetch failure keep state.
      const { error: rpcErr } = await supabaseCommunity.rpc('ensure_member' as never)
      if (rpcErr) {
        console.error('[Auth] ensure_member RPC failed (keeping state):', rpcErr)
        setMemberLoadFailed(true)
        return
      }
      // First-time-only: match this email against the HR/leadership
      // pre-authorization waiting list (member_preauth). SECURITY DEFINER,
      // resolves the caller's own row server-side, marks it claimed. Never
      // blocks signup on failure - this is a nice-to-have match, not the
      // bootstrap itself. Seeding team_members from the returned
      // intended_team_id/intended_position is intentionally NOT done here:
      // team_members INSERT is director/team-lead-only by RLS, so a member
      // can't self-assign - that needs its own SECURITY DEFINER RPC, which
      // is a separate follow-up (see scripts/member_preauth_2026_08_29.sql).
      try {
        const { error: preauthErr } = await supabaseCommunity.rpc('claim_member_preauth' as never)
        if (preauthErr) console.error('[Auth] claim_member_preauth RPC failed (non-blocking):', preauthErr)
      } catch (preauthErr) {
        console.error('[Auth] claim_member_preauth RPC threw (non-blocking):', preauthErr)
      }
      const { data: healed, error: reErr } = await supabaseCommunity
        .rpc('get_own_member' as never)
        .maybeSingle()
      if (reErr) {
        console.error('[Auth] post-heal refetch error (keeping state):', reErr)
        setMemberLoadFailed(true)
        return
      }
      setMember((healed as any) ?? null)
    } catch (err) {
      console.error('[Auth] fetchMember threw (keeping state):', err)
      setMemberLoadFailed(true)
    }
  }, [setMember])

  useEffect(() => {
    // DEV preview: never touch the real Supabase session.
    if (DEV_PREVIEW_ROLE) { setIsLoading(false); return }

    let mounted = true

    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        ),
      ])

    const initSession = async () => {
      try {
        const { data: { session } } = await withTimeout(
          supabaseCommunity.auth.getSession(),
          8000,
          'getSession'
        )
        if (!mounted) return

        if (session?.user) {
          // If the cached row belongs to a DIFFERENT user (shared browser, account
          // switch), drop it before revalidating so we never show the wrong identity.
          const cached = readMemberCache()
          if (cached && cached.auth_uid !== session.user.id) setMember(null)
          await withTimeout(fetchMember(session.user.id), 8000, 'fetchMember').catch((err) => {
            console.error('[Auth] init fetchMember failed/timed out (keeping state):', err)
          })
        } else {
          // Genuinely no session → logged out. Clear any stale cache. A token that expired or was revoked elsewhere never fires
          // SIGNED_OUT in this tab, so drop every MEMBER's home snapshot here too; the public `anon` one is not personal and stays.
          setMember(null)
          clearSnapshots('anon')
        }
      } catch (err) {
        // getSession failed/timed out - transient (cold start, slow network).
        // Do NOT signOut() and do NOT null the member: a tampered/destroyed
        // session would log the user out for real. Keep the cached member; the
        // next event / getSession corrects it.
        console.error('[Auth] init getSession failed (keeping state):', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    }

    initSession()

    // Has Supabase finished initialising? The listener below must not await a Supabase call before then: the client replays the stored
    // session as SIGNED_IN during init and waits for every listener, while any Supabase call waits for init. That circular wait froze
    // every data request for 8 seconds (our withTimeout was the only thing that ended it). Full story in auth/authEvents.ts.
    // `initialize()` is idempotent: it hands back the promise the client created itself.
    let authReady = false
    const markReady = () => { authReady = true }
    void supabaseCommunity.auth.initialize().then(markReady, markReady)

    const { data: { subscription } } = supabaseCommunity.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      const action = actionForAuthEvent(event, !!session?.user, authReady)
      // INITIAL_SESSION is handled by initSession(). A token refresh / metadata change never changes which member row maps to this
      // user: re-fetching on those (Supabase fires TOKEN_REFRESHED on a timer and on tab focus) was the main cause of spurious
      // mid-session "logouts".
      if (action === 'ignore') return

      if (action === 'sign_out') {
        setMember(null)
        // Item 8.2. The saved-post store is module-level and survives a
        // route change by design, which means it also survives a sign-out
        // unless it is told. On a shared browser - which is most of this
        // org's users - the next member would otherwise see the previous
        // one's bookmarks flagged on the feed until each card refetched.
        // Same argument applies to the composer draft and recently-viewed:
        // see clearMemberLocalState above.
        clearMemberLocalState()
        // A real sign-out is not a failed load - clear the flag so the
        // recovery screen doesn't outlive the session that caused it.
        setMemberLoadFailed(false)
        setIsLoading(false)
        return
      }

      // Clarity is loaded in index.html for ANONYMOUS visitors only, because
      // most signed-in users here are students and a large share are minors.
      // That check runs at page load, so it cannot catch a sign-in that
      // happens inside an already-open tab - the tag is running by then.
      // Stop it here. Optional-call because the tag legitimately does not
      // exist on a signed-in first load, which is the whole point.
      try { (window as any).clarity?.('stop') } catch { /* never block auth */ }

      // The replayed startup session: initSession() above loads the member the moment init finishes, so doing it here too would be
      // redundant AND is the deadlock. Return without awaiting anything.
      if (action === 'defer_to_init') return

      // actionForAuthEvent already sent a user-less event to 'sign_out'; this narrows the type for the compiler and costs nothing.
      const userId = session?.user?.id
      if (!userId) return

      // SIGNED_IN / PASSWORD_RECOVERY etc. - load the member, but NEVER let this
      // hang isLoading (the previous code awaited with no timeout → permanent
      // spinner if the round-trip stalled). Always clear isLoading in finally.
      try {
        await withTimeout(fetchMember(userId), 8000, 'fetchMember(onAuth)')
      } catch (err) {
        console.error('[Auth] onAuthStateChange fetchMember failed (keeping state):', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchMember, setMember])

  const logout = useCallback(async () => {
    setMember(null) // clears cache too
    // Also cleared in the SIGNED_OUT branch above, which is the path a normal
    // sign-out takes. Repeated here because that event never fires if the
    // signOut call below throws - and a network blip must not be what leaves
    // the previous member's draft on a shared machine. Both calls are
    // idempotent.
    clearMemberLocalState()
    // Audit pass, 2026-09-06: was a bare `await`, and none of this function's
    // three callers (RejectedPage, PendingApprovalPage, AuthCallbackPage) wrap
    // their own `await logout()` in a try/catch either - a rejected signOut
    // call (a network blip is enough) left the promise rejected, so whatever
    // that caller meant to do next (usually `navigate(...)`) never ran and
    // nothing told the member anything happened. The local half of "log out"
    // - clearing the cached member above - is what the rest of the app
    // actually keys off `isAuthenticated` for, so it must complete and this
    // promise must resolve regardless of whether Supabase's own sign-out
    // network call succeeds.
    try {
      await supabaseCommunity.auth.signOut()
    } catch (err) {
      console.error('supabaseCommunity.auth.signOut() failed during logout (local session already cleared):', err)
    }
  }, [setMember])

  const refreshMember = useCallback(async () => {
    const { data: { session } } = await supabaseCommunity.auth.getSession()
    if (session?.user) await fetchMember(session.user.id)
    else setMember(null)
  }, [fetchMember, setMember])

  // Memoized so consumers of useAuth() don't re-render on every AuthProvider
  // render - only when one of these values actually changes (member/isLoading
  // are state, logout/refreshMember are already useCallback-stable).
  const value = useMemo(() => ({
    member,
    isLoading,
    isAuthenticated: !!member,
    memberLoadFailed,
    logout,
    refreshMember,
  }), [member, isLoading, memberLoadFailed, logout, refreshMember])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {DEV_PREVIEW_ROLE && (
        <div
          style={{
            position: 'fixed', bottom: 8, left: 8, zIndex: 99999,
            background: '#FF4D2E', color: '#fff', fontFamily: 'monospace',
            fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
            pointerEvents: 'none', letterSpacing: '0.04em',
          }}
        >
          DEV PREVIEW · {DEV_PREVIEW_ROLE} · ?dev=off to exit
        </div>
      )}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
