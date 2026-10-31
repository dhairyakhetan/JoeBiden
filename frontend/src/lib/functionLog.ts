import { supabaseCommunity } from './supabaseCommunity'
import { getCachedMemberId } from './authCache'

/**
 * Call-level telemetry, aimed at `client_function_logs`
 * (scripts/client_function_logs_2026_09_23.sql) - the companion to
 * errorTracking.ts's logSupabaseError(). That table answers "did this
 * Supabase call fail, and why"; this one answers "what actually gets
 * called, how often, and how long does it take" - every call, success or
 * failure, not just the failures.
 *
 * withFunctionLogging(name, service) wraps a services/*.ts object so every
 * method call is timed and logged automatically, without touching the
 * service's own function bodies. Apply it once at each service's export
 * point (see services/achievementService.ts for the pattern) rather than
 * instrumenting call sites by hand - a service gains logging for any method
 * it exports, including ones added later, for free.
 *
 * Same non-throwing, fire-and-forget contract as logClientError: a logging
 * failure must never become a second error, and must never delay or alter
 * the wrapped call's own result.
 */

const SESSION_KEY = 'aq_function_log_session_id'
// Deliberately much higher than logClientError's 20-per-session cap - this
// table is meant to capture normal traffic, not just anomalies. It still
// exists as a hard ceiling for the same reason the error logger has one: a
// genuine infinite-loop bug (the exact class fixed on RegisterPage.tsx,
// 2026-09-22) would otherwise write unbounded rows against a live budget.
const MAX_LOGS_PER_SESSION = 500

let loggedThisSession = 0

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return 'unknown'
  }
}

/**
 * Queued + batched, not one INSERT per call. An early version fired
 * immediately on every wrapped call - correct, but every one of those was a
 * real fetch competing with the page's actual data requests for the
 * browser's limited per-origin connections, right when a cold load's own
 * requests need that bandwidth most. Queuing and flushing in one batched
 * insert, off the main thread's idle time, keeps the same coverage with
 * near-zero effect on perceived load speed.
 */
type QueuedEntry = {
  service: string
  function: string
  success: boolean
  duration_ms: number
  pathname: string
  member_id: number | null
  session_id: string
}

const queue: QueuedEntry[] = []
const FLUSH_AT_QUEUE_SIZE = 25
const FLUSH_IDLE_TIMEOUT_MS = 2000
let flushScheduled = false

async function flush(): Promise<void> {
  flushScheduled = false
  if (queue.length === 0) return
  const batch = queue.splice(0, queue.length)
  try {
    await supabaseCommunity.from('client_function_logs' as never).insert(batch as never)
  } catch {
    // Logging must never throw or affect any caller - the batch is simply lost.
  }
}

function scheduleFlush(): void {
  if (flushScheduled) return
  flushScheduled = true
  const run = () => { void flush() }
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: FLUSH_IDLE_TIMEOUT_MS })
  } else {
    setTimeout(run, FLUSH_IDLE_TIMEOUT_MS)
  }
}

let visibilityHandlerInstalled = false
function ensureVisibilityFlush(): void {
  if (visibilityHandlerInstalled || typeof document === 'undefined') return
  visibilityHandlerInstalled = true
  // Best-effort tail flush when the tab is hidden/closed. Not guaranteed
  // delivery (no sendBeacon - Supabase's REST insert needs the apikey
  // header, which sendBeacon can't attach), but this is telemetry, not a
  // ledger: losing the last few queued rows on a hard close is an
  // acceptable, already-established tradeoff (same as logClientError's own
  // fire-and-forget contract).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush()
  })
}

function logFunctionCall(service: string, fn: string, success: boolean, durationMs: number): void {
  if (loggedThisSession >= MAX_LOGS_PER_SESSION) return
  loggedThisSession++
  ensureVisibilityFlush()

  // getCachedMemberId() resolves from an in-memory cache after the first
  // call anywhere in the app - this never triggers its own network request
  // here, it only reads what's already resolved.
  void getCachedMemberId().catch(() => null).then((memberId) => {
    queue.push({
      service,
      function: fn,
      success,
      duration_ms: Math.round(durationMs),
      pathname: window.location.pathname,
      member_id: memberId,
      session_id: sessionId(),
    })
    if (queue.length >= FLUSH_AT_QUEUE_SIZE) void flush()
    else scheduleFlush()
  })
}

/**
 * Wraps every function-valued property of `service` so a call through the
 * returned object is timed and logged, then wraps back to the exact same
 * result or throw - callers cannot tell the difference except for the
 * logging side effect. Non-function properties pass through untouched.
 *
 * Wrap the object ONCE, before it is assigned to both the named and default
 * export (services/*.ts commonly export both) - wrapping only one of the
 * two leaves call sites that import the other export uninstrumented.
 */
export function withFunctionLogging<T extends object>(serviceName: string, service: T): T {
  return new Proxy(service, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver)
      if (typeof value !== 'function') return value

      return function (this: unknown, ...args: unknown[]) {
        const start = performance.now()
        const fnName = String(prop)
        let result: unknown
        try {
          result = value.apply(target, args)
        } catch (err) {
          void logFunctionCall(serviceName, fnName, false, performance.now() - start)
          throw err
        }
        if (result instanceof Promise) {
          return result.then(
            (resolved) => {
              void logFunctionCall(serviceName, fnName, true, performance.now() - start)
              return resolved
            },
            (err) => {
              void logFunctionCall(serviceName, fnName, false, performance.now() - start)
              throw err
            }
          )
        }
        void logFunctionCall(serviceName, fnName, true, performance.now() - start)
        return result
      }
    },
  }) as T
}
