import { describe, it, expect } from 'vitest'
import { GoTrueClient } from '@supabase/auth-js'
import { actionForAuthEvent } from './authEvents'

/**
 * These run the REAL installed @supabase/auth-js client, not a mock of it, because the bug lives in how that library orders its
 * own promises. A mock would only prove our assumptions about it.
 *
 * The bug (see authEvents.ts): the client replays a stored session as SIGNED_IN while `initialize()` is pending and waits for every
 * listener; a listener that awaits `getSession()` waits on `initializePromise`; each waits on the other.
 */

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
const AUTH_UID = '11111111-1111-4111-8111-111111111111'
const jwt = (exp: number) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: AUTH_UID, role: 'authenticated', exp })}.sig`
const FAR = 4_102_444_800
const user = { id: AUTH_UID, aud: 'authenticated', role: 'authenticated', email: 't@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const storedSession = { access_token: jwt(FAR), token_type: 'bearer', expires_in: 3600, expires_at: FAR, refresh_token: 'r', user }

/** A fresh client holding a valid stored session, exactly like a returning visitor's browser. */
function clientWithStoredSession() {
  const mem = new Map<string, string>([['sb-test-auth-token', JSON.stringify(storedSession)]])
  const storage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => { mem.set(k, v) },
    removeItem: (k: string) => { mem.delete(k) },
  }
  const fetchStub = (async () => new Response(JSON.stringify(user), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
  return new GoTrueClient({
    url: 'https://stub.supabase.co/auth/v1', headers: {}, storageKey: 'sb-test-auth-token', storage,
    autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, fetch: fetchStub,
  })
}

const settles = <T,>(p: Promise<T>, ms: number): Promise<'settled' | 'hung'> =>
  Promise.race([p.then(() => 'settled' as const, () => 'settled' as const), new Promise<'hung'>(r => setTimeout(() => r('hung'), ms))])

describe('the startup deadlock, against the real auth client', () => {
  it('REPRODUCES it: a listener that awaits getSession() on the replayed SIGNED_IN never lets init finish', async () => {
    const client = clientWithStoredSession()
    let listenerFinished = false
    // Registered immediately, i.e. before initialize() has finished: the same position AuthContext's useEffect can land in.
    client.onAuthStateChange(async event => {
      if (event === 'SIGNED_IN') { await client.getSession(); listenerFinished = true } // the old listener's shape (it awaited an RPC that starts with getSession)
    })
    expect(await settles(client.initialize(), 1500)).toBe('hung')
    expect(await settles(client.getSession(), 300)).toBe('hung') // and so does every other caller, which is why ALL data requests froze
    expect(listenerFinished).toBe(false)
  })

  it('THE FIX: ignoring SIGNED_IN until init is done lets init finish at once, and getSession then returns the session', async () => {
    const client = clientWithStoredSession()
    let ready = false
    const seen: string[] = []
    client.onAuthStateChange(async event => {
      const action = actionForAuthEvent(event, true, ready)
      seen.push(`${event}:${action}`)
      if (action === 'load_member') await client.getSession()
    })
    expect(await settles(client.initialize(), 1500)).toBe('settled')
    ready = true
    const { data } = await client.getSession()
    expect(data.session?.user.id).toBe(AUTH_UID) // initSession() still gets the session it loads the member from
    expect(seen).toContain('SIGNED_IN:defer_to_init')
  })

  it('AFTER init the awaited listener is safe and behaves exactly as before (a later password sign-in still loads the member)', async () => {
    // signInWithPassword is the post-startup sign-in this app really uses (the TerraThon admin gate). It notifies listeners WITHOUT
    // holding the auth lock, so an awaited getSession() inside the listener is fine once init is done.
    //
    // Not covered on purpose: setSession / exchangeCodeForSession notify while HOLDING the lock, and an awaiting listener hangs on
    // those (verified while writing this test). The app calls neither (OAuth returns through the init path instead); if one is ever
    // added, defer the member load out of the listener with setTimeout(..., 0).
    const tokenResponse = { access_token: jwt(FAR), token_type: 'bearer', expires_in: 3600, expires_at: FAR, refresh_token: 'r2', user }
    const mem = new Map<string, string>()
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v) }, removeItem: (k: string) => { mem.delete(k) } }
    const fetchStub = (async () => new Response(JSON.stringify(tokenResponse), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
    const client = new GoTrueClient({ url: 'https://stub.supabase.co/auth/v1', headers: {}, storageKey: 'sb-test-auth-token', storage, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, fetch: fetchStub })
    let ready = false
    let loaded = 0
    client.onAuthStateChange(async event => {
      if (actionForAuthEvent(event, true, ready) === 'load_member') { await client.getSession(); loaded++ }
    })
    await client.initialize()
    ready = true
    expect(loaded).toBe(0) // nothing loaded during startup
    expect(await settles(client.signInWithPassword({ email: 't@example.com', password: 'x' }), 2000)).toBe('settled')
    expect(loaded).toBe(1) // the listener ran its awaited load once, and did NOT deadlock
  })

  it('stress: 25 fresh clients in a row all initialise promptly with the fixed listener', async () => {
    const times: number[] = []
    for (let i = 0; i < 25; i++) {
      const client = clientWithStoredSession()
      let ready = false
      client.onAuthStateChange(async event => {
        if (actionForAuthEvent(event, true, ready) === 'load_member') await client.getSession()
      })
      const t0 = Date.now()
      expect(await settles(client.initialize(), 1000)).toBe('settled')
      ready = true
      times.push(Date.now() - t0)
    }
    expect(Math.max(...times)).toBeLessThan(500)
  })
})

describe('actionForAuthEvent: the decision table', () => {
  it.each([
    // [event, hasUser, authReady, expected]
    ['INITIAL_SESSION', true, false, 'ignore'],
    ['INITIAL_SESSION', true, true, 'ignore'],
    ['TOKEN_REFRESHED', true, true, 'ignore'],
    ['TOKEN_REFRESHED', true, false, 'ignore'],
    ['USER_UPDATED', true, true, 'ignore'],
    ['SIGNED_OUT', false, true, 'sign_out'],
    ['SIGNED_OUT', false, false, 'sign_out'], // signing out is local, safe during init, and must never be swallowed
    ['SIGNED_OUT', true, false, 'sign_out'],
    ['SIGNED_IN', false, true, 'sign_out'], // an event with no user is a sign-out whatever it is called
    ['SIGNED_IN', false, false, 'sign_out'],
    ['SIGNED_IN', true, false, 'defer_to_init'], // THE FIX: the replayed startup session
    ['SIGNED_IN', true, true, 'load_member'], // a real sign-in after startup is unchanged
    ['PASSWORD_RECOVERY', true, true, 'load_member'],
    ['PASSWORD_RECOVERY', true, false, 'defer_to_init'],
    ['MFA_CHALLENGE_VERIFIED', true, true, 'load_member'],
  ] as const)('%s (user=%s, ready=%s) -> %s', (event, hasUser, ready, expected) => {
    expect(actionForAuthEvent(event, hasUser, ready)).toBe(expected)
  })
})
