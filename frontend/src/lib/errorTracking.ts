import { supabaseCommunity } from './supabaseCommunity'
import { getCachedMemberId } from './authCache'

/**
 * Client-side crash reporting, aimed at `client_error_logs`
 * (scripts/client_error_logs_2026_09_08.sql) instead of a third-party
 * service. Write-only from here - the table's RLS lets anon/authenticated
 * INSERT and nobody but a director/super_admin SELECT.
 *
 * Every call is fire-and-forget and never throws: a failure to log an error
 * must never itself become a second error. Same non-throwing contract as
 * notificationService.create().
 */

const SESSION_KEY = 'aq_error_session_id'
const MAX_LOGS_PER_SESSION = 20
const DEDUPE_WINDOW_MS = 3000

let loggedThisSession = 0
const recentSignatures = new Map<string, number>()

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

function isDuplicate(signature: string): boolean {
  const now = Date.now()
  const last = recentSignatures.get(signature)
  // Sweep old entries so this map cannot grow unbounded across a long session.
  if (recentSignatures.size > 50) {
    for (const [key, at] of recentSignatures) {
      if (now - at > DEDUPE_WINDOW_MS) recentSignatures.delete(key)
    }
  }
  recentSignatures.set(signature, now)
  return last !== undefined && now - last < DEDUPE_WINDOW_MS
}

type ErrorType = 'render' | 'unhandled_error' | 'unhandled_rejection' | 'supabase_error'

interface LogOptions {
  componentStack?: string
  extra?: Record<string, unknown>
}

export async function logClientError(errorType: ErrorType, error: unknown, options: LogOptions = {}): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined

    // A render loop or a rejection storm should not write hundreds of rows.
    // A stable per-session cap, plus a short dedupe window on the exact same
    // message+stack, keeps one real bug to a handful of rows instead of a
    // flood - a leader reading this table needs signal, not a log dump.
    const signature = `${errorType}:${message}:${stack?.slice(0, 200) ?? ''}`
    if (isDuplicate(signature)) return
    if (loggedThisSession >= MAX_LOGS_PER_SESSION) return
    loggedThisSession++

    // member_id is the one reliable identifier available outside a React
    // component (role lives in the `members` table, not auth metadata, and
    // is not worth a second query here - a director reading this table can
    // join client_error_logs.member_id -> members.member_id for anything
    // else they need, including role).
    const memberId = await getCachedMemberId().catch(() => null)

    await supabaseCommunity.from('client_error_logs' as never).insert({
      error_type: errorType,
      message: message.slice(0, 2000),
      stack: stack?.slice(0, 8000),
      component_stack: options.componentStack?.slice(0, 8000),
      pathname: window.location.pathname,
      href: window.location.href,
      member_id: memberId,
      user_agent: navigator.userAgent,
      viewport_w: window.innerWidth,
      viewport_h: window.innerHeight,
      session_id: sessionId(),
      extra: options.extra ?? null,
    } as never)
  } catch {
    // Logging the error must never throw. Silently give up - the console.error
    // callers already do next to this call still fires.
  }
}

/**
 * The service-layer contract (see CLAUDE.md) is `if (error) throw error` -
 * every Supabase call that fails throws, and the calling component catches
 * it and toasts. That means it's never an *unhandled* rejection, so the
 * window listeners above never see it - this codebase's actual Supabase
 * failure rate was invisible before this existed.
 *
 * Call this at the exact point a service is about to rethrow a Supabase
 * error (PostgrestError/AuthError/StorageError), then rethrow its return
 * value unchanged: `if (error) throw logSupabaseError('feedService.createPost', error)`.
 * It logs (fire-and-forget, same session cap/dedupe as logClientError) and
 * hands the same error straight back so the throw site doesn't change shape.
 *
 * `operation` should be `<file>.<function>` so a director scanning
 * client_error_logs can tell which code path is unreliable without opening
 * the repo.
 */
export function logSupabaseError<E>(operation: string, error: E, extra: Record<string, unknown> = {}): E {
  const err = (error ?? {}) as { message?: string; code?: string; details?: string; hint?: string; status?: number }
  const message = err.message ?? String(error)

  void logClientError('supabase_error', error instanceof Error ? error : new Error(message), {
    extra: {
      operation,
      code: err.code ?? null,
      details: err.details ?? null,
      hint: err.hint ?? null,
      status: err.status ?? null,
      ...extra,
    },
  })

  return error
}

let installed = false

/** Catches what an ErrorBoundary structurally cannot: async errors that
 * bubble to `window` instead of through React's render/commit phases. */
export function installGlobalErrorTracking(): void {
  if (installed) return
  installed = true

  window.addEventListener('error', (event: ErrorEvent) => {
    logClientError('unhandled_error', event.error ?? event.message)
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    logClientError('unhandled_rejection', event.reason)
  })
}
