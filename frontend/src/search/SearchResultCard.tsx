import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import Img from '../components/Img'
import { I } from '../components/v6Shared'
import { getInitials, CAT_COLORS } from '../lib/uiHelpers'

/* ─────────────────────────────────────────────────────────────────────────
   The search result card — redesign 08.2. "One card, five kinds": drive ·
   post · member · team · opening. Two kinds beyond the design's five
   (school, class) are kept here rather than dropped - the live search
   backend (searchService.ts) still returns them and they used to have a
   working UI; folding them into the same card system (their own hue +
   verb) preserves that instead of deleting real functionality the file's
   own enumeration didn't anticipate. See the file 08 report for this note.

   No "why it matched" line: it needs a match-field from the query
   (which column matched, and a snippet), and searchService.ts's ilike
   branches don't return one. Per 08.0/08's own instruction, that means
   OMIT the line - never synthesise it client-side by re-scanning the body.
   ───────────────────────────────────────────────────────────────────────── */

export type ResultKind = 'drive' | 'post' | 'member' | 'team' | 'opening' | 'school' | 'class'

export type ResultMedia =
  | { type: 'photo'; src: string; alt: string }
  | { type: 'avatar'; src?: string; alt: string; initials: string }
  | { type: 'glyph'; glyph: ReactNode; initials?: string }

export interface SearchResultCardProps {
  kind: ResultKind
  href: string
  /** The part after the arrow in "kind → context" - a category, a school, "aquaterra · 3h". */
  context: string
  title: string
  media: ResultMedia
  /** A real 5-slug category (posts/teams only) - falls back to a fixed
   *  per-kind hue when absent, per 08.2 ("the hue comes from the result's
   *  category, or from its kind when it has no category"). */
  category?: string | null
}

const VERB: Record<ResultKind, string> = {
  drive: 'Open',
  post: 'Read',
  member: 'Profile',
  team: 'View',
  opening: 'Apply',
  school: 'Browse',
  class: 'Browse',
}

// Fixed per-kind fallback hue for kinds with no real category enum to key
// off (member has none at all; drive's `objective` field is free text, not
// the 5-slug vocabulary - see searchService.ts's SearchOpts comment).
const KIND_HUE: Record<ResultKind, string> = {
  drive: 'var(--c-welfare)',
  post: 'var(--c-events)',
  member: 'var(--c-events)',
  team: 'var(--c-ops)',
  opening: 'var(--c-content)',
  school: 'var(--c-labs)',
  class: 'var(--c-ops)',
}

function hueFor(kind: ResultKind, category?: string | null): string {
  if (category && CAT_COLORS[category]) return CAT_COLORS[category]
  return KIND_HUE[kind]
}

function Media({ media }: { media: ResultMedia }) {
  if (media.type === 'photo') {
    return (
      <div className="src-media src-media--photo">
        <Img ctx="thumb" src={media.src} alt={media.alt} />
      </div>
    )
  }
  if (media.type === 'avatar') {
    return (
      <div className="src-media src-media--ground">
        {media.src ? (
          <Img ctx="avatar" src={media.src} alt={media.alt} referrerPolicy="no-referrer" />
        ) : (
          <span aria-hidden="true">{media.initials}</span>
        )}
      </div>
    )
  }
  return (
    <div className="src-media src-media--ground">
      {media.initials ? <span aria-hidden="true">{media.initials}</span> : <span aria-hidden="true">{media.glyph}</span>}
    </div>
  )
}

export default function SearchResultCard({ kind, href, context, title, media, category }: SearchResultCardProps) {
  const hue = hueFor(kind, category)
  return (
    <Link to={href} className="src-card" style={{ background: hue }}>
      <Media media={media} />
      <div className="src-body">
        <div className="src-lockup">
          <span>{kind}</span>
          <span className="src-arrow" aria-hidden="true">→</span>
          <span>{context}</span>
        </div>
        <div className="src-title">{title}</div>
      </div>
      {/* Visual affordance only - the whole card is the one <a>, never a nested link. */}
      <span className="src-pill" aria-hidden="true">{VERB[kind]}</span>
    </Link>
  )
}

// Small glyphs reused for kinds with no photo/avatar source. Kept here
// (rather than inline at each call site) so SearchPage's mapping code stays
// about DATA, not icon choice.
export const KIND_GLYPH: Record<'drive' | 'post' | 'team' | 'opening' | 'class', ReactNode> = {
  drive: I.flag(),
  post: I.pen(),
  team: I.globe(),
  opening: I.rocket(),
  class: I.hash(),
}

export function resultInitials(name: string): string {
  return getInitials(name)
}
