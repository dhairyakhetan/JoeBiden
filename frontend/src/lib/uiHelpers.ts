// Small presentational helpers duplicated (byte-identically, in most cases)
// across many components - avatar initials, name-hash colour, relative
// timestamps, and the post-category colour map. Consolidated here rather
// than left to drift further; see each export's comment for what was
// deliberately NOT merged in (genuinely different behavior, not duplication).

/** "Jane Doe" -> "JD". Falls back to 'U' for an empty/missing name. */
export function getInitials(name: string): string {
  return (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

/**
 * `count(1, 'member')` -> "1 member"; `count(0, 'member')` -> "0 members".
 *
 * The desk was writing `{team.memberCount} members` in four places and
 * rendering "1 members" on any team with one person in it - visible on the
 * Teams desk at 390px, where four of the eight teams are that size. Two OTHER
 * places in the same folder already did `n === 1 ? singular : plural` by hand,
 * so this is the house rule being applied consistently rather than a new one.
 *
 * `plural` is a parameter because English mostly adds an "s" and sometimes
 * does not ("entry"/"entries"), and a helper that silently produced "entrys"
 * would be worse than the bug it replaces.
 */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`
}

// Public/member-facing palette - CSS custom properties, matches the brand's
// neubrutalist token system. Used by feed/profile/search/member pages.
export const AVATAR_COLORS = ['var(--welfare)', 'var(--pink)', 'var(--lemon)', 'var(--grape)', 'var(--tomato)', 'var(--sky)']

/** Deterministic string hash - picks a stable colour per name/id from `palette`. */
export function hashColor(str: string, palette: string[] = AVATAR_COLORS): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return palette[Math.abs(h) % palette.length]
}

/** "3m ago" / "2h ago" / "5d ago" / "2mo ago" / "1y ago". Does not extend to weeks - see NotificationsPage for that variant. */
/**
 * Reading time in whole minutes, floor 1, at 200 words per minute.
 *
 * ONE implementation (audit 2026-09-17, efficiency P3). There were two: this
 * one, exported from services/blogService.ts, and a copy in
 * feed/feedItemFromPost.ts that omitted the `|| ''` guard and so threw on a null
 * body. Only the call site's own `|| ''` was stopping that. A pure function that
 * two unrelated layers both want does not belong in a service.
 */
export function readMinutes(body: string | null | undefined): number {
  return Math.max(1, Math.round((body || '').trim().split(/\s+/).filter(Boolean).length / 200))
}

/**
 * Relative time, e.g. "5m ago".
 *
 * NOTE, from the same audit: this is NOT the only timeAgo in the tree, and the
 * others are deliberately NOT consolidated here. components/PostFocusModal.tsx
 * returns "5m" with no "ago", and feed/NotificationsPage.tsx carries a weeks
 * tier ("3wk ago") that this one does not. They share a name and nothing else;
 * merging them would silently change what two surfaces display. Same story for
 * the four `fmtDate` helpers, which use long vs short months, with and without
 * a time component, and disagree on what to return when parsing fails.
 */
export function timeAgo(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  const days = Math.floor(d / 86400)
  if (days < 30) return `${days}d ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// The 5 post categories' correct, distinct hues, from the --c-* CSS custom
// properties (v6.css) - shared by post-moderation-style UIs (ContentManager,
// PostPage, TeamManagement, PostFocusModal). NOT the same thing as
// lib/jobOpenings.ts's own CAT_COLORS export, which is a deliberately
// different palette for job-opening cards specifically - don't merge them.
export const CAT_COLORS: Record<string, string> = {
  events: 'var(--c-events)',
  welfare: 'var(--c-welfare)',
  labs: 'var(--c-labs)',
  operations: 'var(--c-ops)',
  content: 'var(--c-content)',
}

// Sticker rotation - changelog 13.4 (13-sticker-system.md). Ten fixed values,
// indexed by a hash of the sticker's OWN text, never Math.random(): a random
// rotation re-rolls on every React re-render, so the page would twitch
// whenever anything above a sticker changed state. The same sticker therefore
// sits at the same angle on every render and after every reload. Rotation is
// composition, not motion - it stays under prefers-reduced-motion; only
// transitions (the stamped hover/active press) are removed there.
// Consume via the sticker's `--rot` custom property, e.g.
// style={{ '--rot': `${stickerRotation(label)}deg` } as CSSProperties}, so
// :hover/:active on `.sticker--stamped` can preserve it (v6.css) - an
// un-rotate on hover reads as a glitch.
const STICKER_ROTATIONS = [-6, -3, -2.5, -2, 1.5, 2, 3, 4, 6, 8]
export function stickerRotation(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0
  return STICKER_ROTATIONS[Math.abs(h) % STICKER_ROTATIONS.length]
}

/**
 * Today's date as YYYY-MM-DD **in the viewer's own timezone**.
 *
 * `new Date().toISOString().slice(0, 10)` is the UTC date, and this
 * organisation is in Kolkata (UTC+5:30), so between 00:00 and 05:29 IST it
 * returns YESTERDAY. That is harmless for a filename and wrong for anything
 * stored or compared:
 *
 *   - `sops.completed_on` was stamped from it, so a task ticked off at 1am was
 *     recorded as completed the previous day;
 *   - the "overdue" comparison on the tasks card and the calendar's "today"
 *     both read a day early for the same five and a half hours.
 *
 * `sv-SE` is used only because its locale format IS `YYYY-MM-DD`; nothing
 * about the string is Swedish. An explicit `timeZone` can be passed when a
 * date must mean "in Kolkata" regardless of where the viewer is.
 */
export function localDateISO(date: Date = new Date(), timeZone?: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(date)
}

/**
 * Turn a canvas `data:` URL into a File, for navigator.share and downloads.
 *
 * ONE copy (audit 2026-09-17). components/PosterStudioModal.tsx and
 * components/ShareModal.tsx carried byte-identical versions of this.
 *
 * profile/MemberOfMonthClaimCard.tsx has a DIFFERENT implementation - synchronous,
 * decoding the base64 itself with atob rather than round-tripping through fetch -
 * and is deliberately left alone. It is not a duplicate of this; merging them
 * would change that card from sync to async.
 */
export async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return new File([blob], filename, { type: blob.type || 'image/png' })
}
