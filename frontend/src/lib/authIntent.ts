/**
 * The auth funnel's "why did you land here" intent layer.
 *
 * A small sessionStorage bridge: something gate-worthy happens (a signed-out
 * visitor presses like/save/comment on a real post, tries to apply for a real
 * open role, walks a guided demo to the end, types a staff URL, bookmarks a
 * member-only page, ...) and the component that redirects them to /login
 * calls `setAuthIntent(...)` in the same tick, right before the navigation.
 * LoginPage reads it back and renders a small hero above its sign-in card
 * that says which of those actually happened - never a guess, never a
 * placeholder.
 *
 * Deliberately sessionStorage, not a `/login?...` query string: a URL is
 * copyable, gets logged by analytics and referrers, and sits in browser
 * history. "you liked X" belongs to this one redirect, not to a link anyone
 * could replay or share.
 *
 * This mirrors lib/authCopy.ts's own constraints, because it feeds the same
 * page under the same policy:
 *   1. Never name a member on this page. The 'post' kind below deliberately
 *      carries no author name, even though the excerpt and category alone
 *      already tell an honest story.
 *   2. Never render a count that reads as pressure.
 *   3. `readAuthIntent()` is meant to be read once per navigation and
 *      memoised by the caller, keyed on the router's `location.key` - NOT a
 *      one-time `useState` initialiser. A second `setAuthIntent()` followed
 *      by a re-navigate to /login while a tab is already sitting there has to
 *      actually re-render with the new intent.
 *   4. A malformed, expired, or partially-written intent silently becomes
 *      `{ kind: 'default' }`. This screen never renders a blank interpolated
 *      into a sentence.
 */

const KEY = 'aq_auth_intent_v1'

/** Ten minutes. A stale tab reopened later gets the cold opener, not a wrong
 *  or dated-sounding hero - "still with HR" from an hour ago reads as broken,
 *  not as continuity. */
const TTL_MS = 10 * 60 * 1000

export type PostGateAction = 'like' | 'save' | 'comment'

/** Categories shared by posts and job openings across the app - see
 *  lib/uiHelpers.ts's CAT_COLORS (posts) and lib/jobOpenings.ts's CAT_COLORS
 *  (openings). Both resolve to the same five underlying hues. */
export type GateCategory = 'welfare' | 'events' | 'labs' | 'operations' | 'content'

export type AuthIntent =
  | { kind: 'default' }
  /** Pressed like / save / comment on a specific, real post while signed
   *  out. No author name - rule 1 above - the excerpt and category alone are
   *  the whole, honest story. */
  | { kind: 'post'; action: PostGateAction; excerpt: string; category: GateCategory }
  /** Pressed apply on a specific, real open role. */
  | { kind: 'opening'; title: string; category: GateCategory; teamName: string | null }
  /** Pressed a "join / apply to AquaTerra" control with no specific role or
   *  post attached - the join promo, the welcome letter, a footer link, a
   *  welfare-band CTA, and the dozen other "join the work" buttons scattered
   *  across the public site. They carry no distinguishing real data beyond
   *  "wants to join", so they share one honest variant rather than each
   *  inventing its own. */
  | { kind: 'apply' }
  /** Finished a guided demo walkthrough and pressed "Join AquaTerra". */
  | { kind: 'demo'; flowName: string }
  /** Hit a real signed-in-only route directly - a bookmark, a shared link, a
   *  typed URL - while signed out. */
  | { kind: 'resume'; label: string }
  /** Hit a staff/admin route directly while signed out. Deliberately carries
   *  no further detail - mirrors PermissionDenied's own disclosure rule for a
   *  signed-in-but-under-privileged member: never say which desk. */
  | { kind: 'admin' }

type StoredIntent = { intent: AuthIntent; ts: number }

function truncate(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}

const CATEGORIES: readonly GateCategory[] = ['welfare', 'events', 'labs', 'operations', 'content']
const isCategory = (v: unknown): v is GateCategory =>
  typeof v === 'string' && (CATEGORIES as readonly string[]).includes(v)

const POST_ACTIONS: readonly PostGateAction[] = ['like', 'save', 'comment']
const isPostAction = (v: unknown): v is PostGateAction =>
  typeof v === 'string' && (POST_ACTIONS as readonly string[]).includes(v)

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/**
 * The one place a stored value is trusted or rejected. Every branch that
 * cannot prove its required fields falls through to the `default` case at
 * the bottom - never a half-filled hero.
 */
function validate(raw: unknown): AuthIntent {
  if (!raw || typeof raw !== 'object') return { kind: 'default' }
  const r = raw as Record<string, unknown>

  switch (r.kind) {
    case 'post':
      if (isPostAction(r.action) && nonEmpty(r.excerpt) && isCategory(r.category)) {
        return { kind: 'post', action: r.action, excerpt: truncate(r.excerpt, 120), category: r.category }
      }
      return { kind: 'default' }
    case 'opening':
      if (nonEmpty(r.title) && isCategory(r.category)) {
        return {
          kind: 'opening',
          title: truncate(r.title, 90),
          category: r.category,
          teamName: nonEmpty(r.teamName) ? truncate(r.teamName as string, 40) : null,
        }
      }
      return { kind: 'default' }
    case 'apply':
      return { kind: 'apply' }
    case 'demo':
      if (nonEmpty(r.flowName)) return { kind: 'demo', flowName: truncate(r.flowName as string, 60) }
      return { kind: 'default' }
    case 'resume':
      if (nonEmpty(r.label)) return { kind: 'resume', label: truncate(r.label as string, 40) }
      return { kind: 'default' }
    case 'admin':
      return { kind: 'admin' }
    default:
      return { kind: 'default' }
  }
}

/**
 * Write the intent. Call this the moment something gate-worthy happens,
 * synchronously and BEFORE the redirect fires - a full-page navigation (or a
 * component teardown) can drop anything queued after it.
 */
export function setAuthIntent(intent: AuthIntent): void {
  try {
    const payload: StoredIntent = { intent, ts: Date.now() }
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    /* private mode / storage full - the hero just falls back to default */
  }
}

/**
 * Read the intent, or `{ kind: 'default' }` if there is none, it is stale, or
 * it fails validation. Pure and safe to call on every render; the caller is
 * responsible for memoising it against the right key (see the module comment
 * - LoginPage keys on `location.key`, not a mount-only initialiser).
 */
export function readAuthIntent(): AuthIntent {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return { kind: 'default' }
    const parsed = JSON.parse(raw) as Partial<StoredIntent> | null
    if (!parsed || typeof parsed.ts !== 'number' || Date.now() - parsed.ts > TTL_MS) {
      return { kind: 'default' }
    }
    return validate(parsed.intent)
  } catch {
    return { kind: 'default' }
  }
}

/**
 * Clear the intent. Call this the moment the post-sign-in redirect actually
 * resolves (AuthCallbackPage's routing effect) - intent only ever describes
 * WHY someone arrived at /login, never what happens after they sign in. The
 * existing return-URL/redirect-after-login logic (`aq_oauth_from`, router
 * state) is a separate concern and is untouched by this.
 */
export function clearAuthIntent(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* private mode */
  }
}
