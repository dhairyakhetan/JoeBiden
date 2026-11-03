/**
 * "The role or team they were heading for when they signed in."
 *
 * A visitor who presses Apply on a role (or "sign in to join" on a team) signs in with Google, registers, and lands on
 * /pending. The round trip dropped what they had chosen. AuthCallbackPage now remembers it here when the member is not
 * yet approved, and the waiting page offers "remind me" for it (a pending member cannot apply: lib/joinGate.ts).
 *
 * sessionStorage, one tab, expires on its own: a wish is only meaningful to the sign-in it came from. Never throws.
 */
const WISH_SLOT = 'aq_pending_wish_v1'
const TTL_MS = 6 * 60 * 60 * 1000

export type WishTarget = { openingId: string } | { teamUuid: string }
interface Stored { target: WishTarget; at: number }

const UUID = '[0-9a-fA-F-]{8,40}'

/** Turn a return path into a target, or null when it is not a role or team page. */
export function parseWishPath(path: string | null | undefined): WishTarget | null {
  if (!path) return null
  const opening = new RegExp(`^/opportunities/(${UUID})(?:[/?#]|$)`).exec(path)
  if (opening) return { openingId: opening[1] }
  const team = new RegExp(`^/teams/(${UUID})(?:[/?#]|$)`).exec(path)
  if (team) return { teamUuid: team[1] }
  return null
}

export function stashWish(path: string | null | undefined): void {
  try {
    const target = parseWishPath(path)
    if (!target) return
    sessionStorage.setItem(WISH_SLOT, JSON.stringify({ target, at: Date.now() } satisfies Stored))
  } catch { /* storage blocked: the wish is a convenience */ }
}

export function readWish(): WishTarget | null {
  try {
    const raw = sessionStorage.getItem(WISH_SLOT)
    if (!raw) return null
    const s = JSON.parse(raw) as Stored
    if (!s?.target || typeof s.at !== 'number' || Date.now() - s.at > TTL_MS) { sessionStorage.removeItem(WISH_SLOT); return null }
    if (!('openingId' in s.target) && !('teamUuid' in s.target)) return null
    return s.target
  } catch { return null }
}

export function clearWish(): void {
  try { sessionStorage.removeItem(WISH_SLOT) } catch { /* nothing to clear */ }
}
