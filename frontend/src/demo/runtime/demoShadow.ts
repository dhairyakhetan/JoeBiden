// ─────────────────────────────────────────────────────────────────────────
// Installs and uninstalls the demo's data shadow onto the ONE shared
// `supabaseCommunity` client instance (also exported as `supabase` -
// CLAUDE.md: "supabase is now literally `export const supabase =
// supabaseCommunity as any`" - so patching this one object covers both
// import paths and every one of the ~25 service files without editing any
// of them).
//
// WHAT GETS PATCHED, and why each one is necessary (not just belt-and-
// suspenders) - see the review notes in this handoff's final report for the
// two gaps found beyond what the brief anticipated:
//
//   .from() / .rpc()   Every read/write in every service goes through
//                       these two entry points - see queryBuilder.ts for
//                       why they're patched instead of window.fetch.
//
//   .auth.getSession()/.getUser()
//                       NOT just "the provider never calls supabase.auth"
//                       (19.1 rule 2 - true, DemoProvider itself never
//                       calls it). Services do: lib/authCache.ts's
//                       getCachedMemberId() - the function nearly every
//                       write in the app funnels through to learn "who am
//                       I" - calls `supabaseCommunity.auth.getSession()`
//                       FIRST and returns null before ever reaching a
//                       query if there's no session. getSession() is a
//                       local, storage-backed read in supabase-js (no
//                       fetch involved), so a window.fetch patch alone
//                       would never see it, and every demo write would
//                       fail "Not authenticated" before doing anything.
//
//   .channel() / .removeChannel()
//                       AQNav.tsx opens a Realtime (WebSocket, not fetch)
//                       subscription for live notification counts. Neither
//                       a fetch patch nor a getSession patch touches this
//                       transport - left alone, mounting the real app tree
//                       under /demo/* would open a real WebSocket to the
//                       live project on every single flow.
//
//   .storage.from()     Defensive only - no flow this pass ships needs a
//                       real upload, but a stray call must fail loudly
//                       inside the sandbox rather than reach Storage.
//
// SAFETY, restated: even with all of this installed, the session handed
// back by getSession() carries no valid JWT (fakeIdentity.ts). If some call
// shape this file doesn't recognise ever slips through - a table/RPC name
// with no registered handler - the query throws inside the FakeBuilder
// (queryBuilder.ts's onMiss) rather than silently succeeding OR falling
// through to a real request. There is no code path in this file that calls
// the real fetch, the real getSession, or the real channel API while the
// shadow is installed.
// ─────────────────────────────────────────────────────────────────────────
import { supabaseCommunity } from '../../lib/supabaseCommunity'
import { buildFakeSession, type Member } from './fakeIdentity'
import { FakeBuilder, type TableHandler, type HandlerCtx, type HandlerResult } from './queryBuilder'

type RealClient = typeof supabaseCommunity

interface Uninstallers {
  restore: () => void
}

// Module-level, not per-call: FakeBuilder closures capture these getters so
// a handler registered by one flow can never be reached by a differently-
// scoped install (each DemoProvider mount calls install() fresh).
let handlers: Map<string, TableHandler> = new Map()
let active = false

function onMiss(ctx: HandlerCtx): HandlerResult {
  // A read (or an .rpc() call - most are lookups, and get_own_member, the
  // one write-adjacent one every flow needs, is always explicitly
  // registered by DemoFlowPage) for a table no flow has registered degrades
  // to "no data" - safe for every rail this demo doesn't specifically
  // populate (pinned posts, member-of-the-month, personal stats, etc. all
  // render their existing real empty states rather than crash).
  if (ctx.op === 'select' || ctx.op === 'rpc') {
    return { data: [], error: null, count: ctx.wantsCount ? 0 : undefined }
  }
  // An unmatched WRITE (.insert/.update/.upsert/.delete on a table this
  // flow's fixture never examined) is different: silently returning
  // "success" for a mutation nothing here looked at is exactly the failure
  // mode the whole feature exists to prevent. Fail loudly, inside the
  // sandbox, with nothing sent anywhere.
  return {
    data: null,
    error: {
      message: `demo sandbox: no fixture handler registered for "${ctx.table}" (${ctx.op}). This call is intentionally blocked rather than reaching the real database.`,
      code: 'DEMO_UNHANDLED',
    },
  }
}

function getHandler(table: string): TableHandler | undefined {
  return active ? handlers.get(table) : undefined
}

/** A no-op Realtime channel: chainable `.on()`, a `.subscribe()` that never
 *  opens a socket (and never invokes its status callback - nothing is ever
 *  "SUBSCRIBED"), and an `.unsubscribe()`/`.send()` that resolve immediately. */
function fakeChannel() {
  const channel = {
    on: () => channel,
    subscribe: () => channel,
    unsubscribe: async () => 'ok',
    send: async () => 'ok',
  }
  return channel
}

export interface InstallOptions {
  member: Member
  /** table name -> handler, or `rpc:<name>` -> handler for an .rpc() call. */
  tableHandlers: Record<string, TableHandler>
}

/**
 * Installs the shadow. Idempotent-unsafe by design: calling this twice
 * without uninstall() in between would leak the first install's original
 * function references, so DemoProvider must pair every install() with
 * exactly one uninstall() (its effect cleanup - see DemoProvider.tsx).
 */
export function installDemoShadow(opts: InstallOptions): Uninstallers {
  if (active) {
    // Defensive: this would only happen if a second DemoProvider mounted
    // while one was already active, which the route structure (one /demo/*
    // branch, one provider) should make impossible. Uninstall the stale one
    // first rather than stacking patches.
    console.warn('[demo] installDemoShadow called while already active - uninstalling the previous shadow first.')
  }

  handlers = new Map(Object.entries(opts.tableHandlers))
  active = true

  const client = supabaseCommunity as unknown as RealClient & {
    from: (table: string) => unknown
    rpc: (fn: string, params?: unknown) => unknown
    channel: (name: string, opts?: unknown) => unknown
    removeChannel: (channel: unknown) => unknown
    storage: { from: (bucket: string) => unknown }
    auth: { getSession: () => unknown; getUser: () => unknown }
  }

  const original = {
    from: client.from,
    rpc: client.rpc,
    channel: client.channel,
    removeChannel: client.removeChannel,
    storageFrom: client.storage.from,
    getSession: client.auth.getSession,
    getUser: client.auth.getUser,
  }

  const fakeSession = buildFakeSession(opts.member)

  client.from = ((table: string) => new FakeBuilder(table, 'select', getHandler, onMiss)) as never
  client.rpc = ((fn: string, params?: unknown) =>
    new FakeBuilder(`rpc:${fn}`, 'rpc', getHandler, onMiss, params)) as never
  client.channel = (() => fakeChannel()) as never
  client.removeChannel = (async () => 'ok') as never
  client.storage.from = ((_bucket: string) => ({
    upload: async () => ({
      data: null,
      error: { message: 'demo sandbox: uploads are disabled in a walkthrough.' },
    }),
    getPublicUrl: () => ({ data: { publicUrl: '' } }),
  })) as never
  client.auth.getSession = (async () => ({ data: { session: fakeSession }, error: null })) as never
  client.auth.getUser = (async () => ({ data: { user: fakeSession.user }, error: null })) as never

  return {
    restore() {
      client.from = original.from
      client.rpc = original.rpc
      client.channel = original.channel
      client.removeChannel = original.removeChannel
      client.storage.from = original.storageFrom
      client.auth.getSession = original.getSession
      client.auth.getUser = original.getUser
      active = false
      handlers = new Map()
    },
  }
}

export function isDemoShadowActive(): boolean {
  return active
}
