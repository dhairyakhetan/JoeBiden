/**
 * What AuthContext's auth-state listener should do with an event. Pulled out of the listener so the one rule that prevents a startup
 * freeze is written down, named and tested rather than buried in a closure.
 *
 * THE RULE: while Supabase is still initialising, a SIGNED_IN event must not trigger a member load from inside the listener.
 *
 * Why. For a returning visitor the client replays their stored session as `SIGNED_IN` during `initialize()`, and it AWAITS every
 * listener before `initializePromise` can resolve. The listener used to `await fetchMember()`, whose RPC begins with
 * `auth.getSession()`, whose first line is `await this.initializePromise`. A circular wait: init waits for the listener, the listener
 * waits for init. Nothing logged an error and no request left the page until our own 8 second `withTimeout` finally gave up, which is
 * why one cold start in roughly fourteen sat on a blank screen for 8 seconds while every other Supabase call queued behind it (each
 * one also starts with `getSession()`). Supabase documents the pattern as unsafe: never call another Supabase method, awaited, from
 * inside `onAuthStateChange` while init is pending.
 *
 * The member load is not lost by ignoring the event: `initSession()` awaits `getSession()`, which resolves the moment init finishes,
 * and then loads the member itself. After init the listener is safe to await in, so every later sign-in behaves exactly as before.
 */
export type AuthEventAction = 'ignore' | 'sign_out' | 'defer_to_init' | 'load_member'

export function actionForAuthEvent(event: string, hasUser: boolean, authReady: boolean): AuthEventAction {
  // Handled by initSession().
  if (event === 'INITIAL_SESSION') return 'ignore'
  // A token refresh or metadata change never changes which member row maps to this user. Re-fetching on these was the main cause of
  // spurious mid-session "logouts".
  if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return 'ignore'
  // Signing out is local work (no Supabase call), so it is safe at any time, including during init.
  if (event === 'SIGNED_OUT' || !hasUser) return 'sign_out'
  // See the file comment: awaiting a Supabase call here before init finishes is a deadlock.
  if (!authReady) return 'defer_to_init'
  return 'load_member'
}
