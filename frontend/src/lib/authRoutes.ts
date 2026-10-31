/**
 * The one definition of "this route is the auth flow".
 * ────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * `PublicLayout` wrapped every route, auth included, in the public nav and the
 * full marketing footer. Measured on /login at 1274x900 on 2026-09-11:
 *
 *     nav           76px   — carrying a "Log in →" button, on the login page
 *     auth shell   830px
 *     footer      1266px   — the bento, the link columns, the manifesto, all of it
 *     ─────────────────
 *     total       2186px   — the page is 38% sign-in and 58% marketing
 *
 * Someone arriving to sign in was met with a nav telling them to sign in, a
 * card, and then the entire site footer underneath. That is most of why the
 * auth page reads as broken, and it is why the footer kept getting named in
 * the same breath as it.
 *
 * An auth route owns its viewport. It gets no nav, no footer and no bottom
 * dock; the page's own "back to site" link is the way out, and its own legal
 * line is the only chrome it needs.
 *
 * NOT reusing `isBottomNavHidden` from MobileMenuBar, which looks like the same
 * list but is not: it includes `/volunteer`, the public volunteer handbook,
 * which absolutely should keep the nav and footer. Two predicates that are
 * nearly the same are exactly how a route ends up in the wrong bucket, so this
 * one is defined separately and says what it means.
 */

/**
 * Prefix-matched, so `/register/step-2` and `/auth/callback?code=…` are covered
 * without listing every variant.
 *
 * `/auth/callback` is included deliberately: it renders for a second or two
 * mid-OAuth, and painting a nav and a 1266px footer behind a spinner nobody is
 * meant to read is both ugly and wasted work.
 */
const AUTH_ROUTE_PREFIXES = [
  '/login',
  '/register',
  '/pending',
  '/rejected',
  '/auth/callback',
] as const

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTE_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p + '?'))
}

export default isAuthRoute
