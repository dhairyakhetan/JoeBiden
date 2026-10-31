/**
 * The auth funnel's smart headline engine.
 *
 * The login screen keeps ONE layout and swaps three strings: headline, subline
 * and primary label. Every entry in RULES is one rule. They are evaluated in
 * order and the first match renders, so the specific beats the general and the
 * cold opener is the floor.
 *
 * Design reference: AQ Auth.dc.html card A7 ("smart headline engine, 48
 * variations"). Section 02 step 38.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FOUR CONSTRAINTS, all enforced here rather than left to the caller:
 *
 *   1. NEVER name a member who has not opted into being named.
 *      There is no opt-in-to-be-named column in `members`. The canvas copy
 *      names people directly ("Aarushi thinks you should be here", "Anisha
 *      has your application", "Aviana Ghosh runs it"). Those are NOT
 *      transcribed. The referral rules say a person referred you without
 *      saying who, which is the same information minus the disclosure.
 *
 *   2. NEVER render a count that reads as pressure.
 *      The canvas's "Projects is 106 people deep" is dropped for this reason.
 *
 *   3. Resolve ONCE per mount and memoise, so a re-render cannot swap the copy
 *      mid-read. `pickAuthCopy` is pure; the caller wraps it in useMemo with a
 *      stable dependency list. Re-resolving on every render would make the
 *      headline flicker between variants as auth state settles.
 *
 *   4. The failure rules replace the SUBLINE only and leave the headline
 *      standing. A headline that changes because a network call failed reads
 *      as the page breaking.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * FIGURES. Two numbers in the canvas copy are NOT in this file, deliberately:
 * "12,480 lives reached" and "41 projects delivered". `github.md` records both
 * as placeholder figures that do not exist anywhere in the codebase, and the
 * project rule is that only a canonical figure or a dashed live marker may be
 * rendered. They are replaced with canonical ones (displayCount(ORG_FACTS.drivesWrittenUp)
 * projects, 3,500+ kids — see lib/orgFacts.ts), which say the same thing and are true.
 *
 * FACTS come only from what is already stored. No new tracking, no profiling,
 * and nothing sensitive is ever inferred. See AQ_EXPERIENCE_BRIEF.md §04
 * and §56.
 */

import type { AuthToken } from './authTokens'
import { countToken } from './authTokens'
import { ORG_FACTS, displayCount } from './orgFacts'

export type AuthFacts = {
  /** localStorage `aq_visited_before` — has this browser seen /login before. */
  visitedBefore: boolean
  /** How many times this browser has landed on /login. Capped, see readAuthFacts. */
  visitCount: number
  /** sessionStorage `aq_oauth_from` — where they were headed before the redirect. */
  oauthFrom: string | null
  /** document.referrer, host only. Never stored, never sent anywhere. */
  referrerHost: string | null
  /** Query-string signals: ?ref, ?team, ?role, ?utm_source. */
  ref: string | null
  team: string | null
  role: string | null
  utmSource: string | null
  /** Set only once a session exists. Signed-out visitors have all of these null. */
  status: 'pending_approval' | 'active' | 'rejected' | 'suspended' | null
  /** Days since the application was submitted, when known. */
  pendingDays: number | null
  /** Days since the rejection, when known. Drives the 30-day re-apply window. */
  rejectedDays: number | null
  /** In-flight registration progress, when the caller is mid-funnel. */
  qIndex: number | null
  /** members.break_end, when the member is on or just off a break. */
  breakEndsOn: Date | null
  /** True when a transient failure has just happened. Replaces the subline only. */
  failure: 'network' | 'oauth' | 'rate_limit' | null
}

export type AuthCopy = {
  headline: string
  subline: string
  primaryLabel: string
  /**
   * A6 additions (section 02 step 40), both OPTIONAL so every existing caller
   * and every existing rule is unchanged by construction.
   *
   * `emphasis` is the substring of the headline that stays ink; the rest
   * renders muted. Absent means the whole headline stays ink, which is exactly
   * today's behaviour. See `splitHeadline` in lib/authTokens.ts for why this is
   * marked per rule rather than inferred from position.
   *
   * `tokens` are the inline 40px glyphs that sit INSIDE the sentence. Only
   * canonical-figure count pills exist today; lib/authTokens.ts records why the
   * initials disc named by step 40 is deliberately not implemented.
   */
  emphasis?: string
  tokens?: AuthToken[]
  /** Which rule fired. Development only — surfaced by the experience inspector. */
  rule: string
}

const GOOGLE = 'Sign up / sign in with Google'

/** A rule matches, or it does not. First match wins. */
type Rule = {
  id: string
  when: (f: AuthFacts) => boolean
  headline: string | ((f: AuthFacts) => string)
  subline: string | ((f: AuthFacts) => string)
  primaryLabel?: string
  /** A6: the clause that stays ink. Optional; absent = whole headline ink. */
  emphasis?: string
  /** A6: inline tokens. Optional; absent = no tokens, today's layout. */
  tokens?: AuthToken[]
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

/**
 * Ordered. Specific first, cold opener last.
 *
 * The groups follow the canvas: lifecycle and status, then breaks, then
 * registration progress, then referral, then where they came from, then how
 * many times they have been here, then the floor.
 */
const RULES: Rule[] = [
  // ── lifecycle and status ────────────────────────────────────────────────
  {
    id: 'status.suspended',
    when: f => f.status === 'suspended',
    headline: 'your account is on hold.',
    subline: 'Reach us on Instagram @ngo.aquaterra if you think this is a mistake.',
    primaryLabel: 'talk to us →',
  },
  {
    id: 'status.rejected.window_open',
    when: f => f.status === 'rejected' && (f.rejectedDays ?? 0) >= 30,
    headline: 'you can re-apply now.',
    subline: 'Thirty days are up. A stronger application usually lands it.',
  },
  {
    id: 'status.rejected.inside_30',
    when: f => f.status === 'rejected',
    headline: 'not this round, not never.',
    subline: 'Re-apply after 30 days. Drives are open to non-members meanwhile.',
    primaryLabel: 'browse open roles →',
  },
  {
    id: 'status.approved_while_signed_out',
    when: f => f.status === 'active' && !f.visitedBefore,
    headline: 'you were approved.',
    subline: 'Sign in and the feed is yours.',
  },
  {
    id: 'status.pending.slow',
    when: f => f.status === 'pending_approval' && (f.pendingDays ?? 0) > 7,
    headline: 'longer than usual, sorry.',
    // The canvas names the HoD here. Constraint 1: not transcribed.
    subline: 'An HoD has your application. Message us on Instagram if you need it sooner.',
  },
  {
    id: 'status.pending',
    when: f => f.status === 'pending_approval',
    headline: 'still with HR.',
    subline: 'Sign in to check. We also notify you in app the moment it changes.',
  },

  // ── breaks ──────────────────────────────────────────────────────────────
  {
    id: 'break.ended',
    when: f => !!f.breakEndsOn && f.breakEndsOn.getTime() <= Date.now(),
    headline: f => `your break ended on ${fmtDate(f.breakEndsOn!)}.`,
    subline: 'Welcome back. Pick your next drive when you are ready.',
  },
  {
    id: 'break.active',
    when: f => !!f.breakEndsOn && f.breakEndsOn.getTime() > Date.now(),
    headline: f => `you are on a break until ${fmtDate(f.breakEndsOn!)}.`,
    subline: 'Sign in anyway if you want to read, nobody will ping you.',
  },

  // ── registration abandoned mid-funnel ───────────────────────────────────
  {
    id: 'register.at_name',
    when: f => f.qIndex === 0,
    headline: 'one question in, three to go.',
    subline: 'Your progress is saved. Sign in to finish.',
  },
  {
    id: 'register.at_class',
    when: f => f.qIndex === 1,
    headline: 'two questions down.',
    subline: 'One left, then an HoD takes over.',
  },
  {
    id: 'register.at_phone',
    when: f => f.qIndex === 2,
    headline: 'last question.',
    subline: 'Add a phone number and your application is in.',
  },

  // ── referred and invited ────────────────────────────────────────────────
  // The canvas names the referrer and the team lead. Constraint 1 forbids it:
  // there is no column recording consent to be named on a public page.
  {
    id: 'referral.team',
    when: f => !!f.team,
    headline: 'someone picked a team for you.',
    subline: 'Sign in and you will land straight on it.',
  },
  {
    id: 'referral.role',
    when: f => !!f.role,
    headline: 'you were sent a role.',
    subline: 'Sign in and your application goes to the team that opened it.',
  },
  {
    id: 'referral.ref',
    when: f => !!f.ref,
    headline: 'someone thinks you should be here.',
    // No token here on purpose: a count beside a personal invitation reads as
    // pressure, which constraint 2 forbids.
    emphasis: 'you should be here.',
    subline: 'Sign in and their team sees your application first.',
  },

  // ── where they came from ────────────────────────────────────────────────
  {
    id: 'source.instagram',
    when: f => f.utmSource === 'instagram' || f.referrerHost === 'instagram.com',
    headline: 'you saw the post. this is the room.',
    emphasis: 'this is the room.',
    subline: 'Sign in with Google and we will create your account if you do not have one yet.',
  },
  {
    id: 'source.linkedin',
    when: f => f.utmSource === 'linkedin' || f.referrerHost === 'linkedin.com',
    headline: 'the work behind the posts.',
    // A6: "posts." is the point of this line, so it stays ink and the setup
    // greys. The token repeats the subline's canonical figure as a glyph.
    emphasis: 'posts.',
    tokens: [countToken(displayCount(ORG_FACTS.drivesWrittenUp), 'projects')].filter(Boolean) as AuthToken[],
    // Canvas said "41 projects delivered", which is a placeholder figure that
    // exists nowhere in the codebase. displayCount(ORG_FACTS.drivesWrittenUp)
    // ('540+' as of the last regeneration) is canonical — computed from
    // welfare_projects, not retyped from AboutPage (changelog/21-org-facts.md).
    subline: `${displayCount(ORG_FACTS.drivesWrittenUp)} projects delivered. Volunteer hours count toward your certificate.`,
  },
  {
    id: 'source.search',
    when: f => !!f.referrerHost && /google\.|bing\.|duckduckgo\.|search\./.test(f.referrerHost),
    headline: 'a student-run NGO in Kolkata, since 2021.',
    // Someone arriving from a search engine is checking whether this is real.
    // "Kolkata" is the fact that answers that, so it carries the emphasis.
    emphasis: 'Kolkata',
    tokens: [countToken('3,500+', 'kids')].filter(Boolean) as AuthToken[],
    // Canvas said "12,480 lives reached", also a placeholder. 3,500+ kids is
    // canonical.
    subline: '3,500+ kids in workshops. Written up by whoever ran the drive.',
  },
  {
    id: 'source.shared_link',
    when: f => !!f.referrerHost && !f.utmSource,
    headline: 'someone sent you here.',
    subline: 'That usually means they think you would be good at this.',
  },
  {
    id: 'source.bounced_from_home',
    when: f => !!f.oauthFrom && f.oauthFrom !== '/',
    headline: 'you were reading. now join in.',
    subline: 'Same button whether you have an account or not.',
  },

  // ── how many times they have been here ──────────────────────────────────
  {
    id: 'visits.third_plus',
    when: f => f.visitCount >= 3 && !f.status,
    headline: 'still deciding?',
    subline: 'Browse open roles first if you would rather look before you leap.',
  },
  {
    id: 'visits.second',
    when: f => f.visitedBefore && !f.status,
    headline: 'back again.',
    subline: 'Nothing to make. Your Google account is your AquaTerra account.',
  },

  // ── the floor. Always matches. ──────────────────────────────────────────
  {
    id: 'cold',
    when: () => true,
    headline: 'welfare drives run by the people who show up.',
    subline: 'New or returning, it is the same button.',
  },
]

/**
 * The five failure rules. These replace the SUBLINE only (constraint 4): the
 * headline the visitor was already reading stays where it is.
 */
const FAILURE_SUBLINE: Record<NonNullable<AuthFacts['failure']>, string> = {
  network: 'We could not reach the server. Check your connection and try again.',
  oauth: 'Google did not complete the sign-in. Try once more.',
  rate_limit: 'Too many attempts. Wait a moment, then try again.',
}

/** Pure, deterministic, first match wins. */
export function pickAuthCopy(facts: AuthFacts): AuthCopy {
  const rule = RULES.find(r => {
    try { return r.when(facts) } catch { return false }
  }) ?? RULES[RULES.length - 1]

  const headline = typeof rule.headline === 'function' ? rule.headline(facts) : rule.headline
  const subline = facts.failure
    ? FAILURE_SUBLINE[facts.failure]
    : (typeof rule.subline === 'function' ? rule.subline(facts) : rule.subline)

  return {
    headline,
    subline,
    primaryLabel: rule.primaryLabel ?? GOOGLE,
    rule: rule.id,
    // A6. Both optional and both absent on most rules, so the default render
    // is byte-identical to before this field existed.
    //
    // On a FAILURE the emphasis and tokens are dropped along with the subline:
    // constraint 4 says a failure replaces the subline and leaves the headline
    // standing, and a headline that keeps its decorative tokens while the line
    // under it turns into an error reads as the page not having noticed.
    emphasis: facts.failure ? undefined : rule.emphasis,
    tokens: facts.failure ? undefined : rule.tokens,
  }
}

/**
 * Reads the facts from storage and the URL. Every read is wrapped: private
 * mode throws on localStorage access, and a visitor in that mode should get
 * the cold opener, not a blank screen.
 *
 * Nothing here is written. The one write in this funnel is the existing
 * `aq_visited_before` flag, which LoginPage already owns.
 */
export function readAuthFacts(partial: Partial<AuthFacts> = {}): AuthFacts {
  const ls = (k: string): string | null => {
    try { return typeof window === 'undefined' ? null : localStorage.getItem(k) } catch { return null }
  }
  const ss = (k: string): string | null => {
    try { return typeof window === 'undefined' ? null : sessionStorage.getItem(k) } catch { return null }
  }

  const params = typeof window === 'undefined'
    ? new URLSearchParams()
    : new URLSearchParams(window.location.search)

  let referrerHost: string | null = null
  try {
    if (typeof document !== 'undefined' && document.referrer) {
      const u = new URL(document.referrer)
      // Same-origin referrers are navigation inside our own app, not a source.
      if (u.host !== window.location.host) referrerHost = u.host.replace(/^www\./, '')
    }
  } catch { /* malformed referrer, treat as none */ }

  // Capped at 9: the exact number is never rendered, only "is this the third
  // time or more", and an uncapped counter is a behavioural profile nobody
  // asked for.
  const rawCount = Number(ls('aq_login_visits') || '0')
  const visitCount = Number.isFinite(rawCount) ? Math.min(Math.max(rawCount, 0), 9) : 0

  return {
    visitedBefore: !!ls('aq_visited_before'),
    visitCount,
    oauthFrom: ss('aq_oauth_from'),
    referrerHost,
    ref: params.get('ref'),
    team: params.get('team'),
    role: params.get('role'),
    utmSource: params.get('utm_source'),
    status: null,
    pendingDays: null,
    rejectedDays: null,
    qIndex: null,
    breakEndsOn: null,
    failure: null,
    ...partial,
  }
}
