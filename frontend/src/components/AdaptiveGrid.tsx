/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION 34 · the grid host, phase one
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Walk the ordered recipe array, take the first match, render its tiles into
   the 4-column 72px grid. Render G38 on any throw.

   This is section 34's `GridHost`. It is named AdaptiveGrid because that is
   the filename the section-14 spec and this build both use; there is one
   component, not two.

   IT FETCHED NOTHING, AND NOW IT FETCHES ONE THING - 2026-09-07.
   ------------------------------------------------------------------------
   Every figure still arrives on the `ctx` prop wherever the host already has
   it, and `lib/gridRecipes.ts` remains pure: it imports no client and every
   predicate is a function of the context object, so the recipes stay unit
   testable. What changed is that two states the block is FOR could not be
   described by any data a host page happens to have lying around:

     - a leader's pending work (no service sums a director's queues; the
       home page's own comment said so, and G27 could therefore never fire
       for anybody - the owner, a super_admin with a live desk, was falling
       all the way to G38), and
     - a member's own open loops and trail (their pending join request, their
       unread notifications, the posts they saved), which live in five tables
       the home page has no other reason to touch.

   So `useGridEnrichment` below issues COUNT-ONLY reads (`head: true`) for
   exactly those, and merges them into the context. It adds no service, no
   RLS policy and no write. Every read is gated twice: once in code, on the
   same `deskAccess` privilege as the desk it links to, and once by the
   database policy on the table, which is `is_director()` / own-row for every
   one of them. A member never counts a queue they could not open.

   A figure that does not resolve is `undefined` in and a dashed live marker
   out. A queue that does not FULLY resolve leaves `queueDepth` undefined
   rather than short - a partial sum is a wrong claim, and `G30` ("the desk is
   clear") must never fire on a failed read.

   Pass `enrich={false}` to get the old fetch-nothing behaviour back.

   THE GRID LIVES INSIDE THE INK GREETING BLOCK. This component renders the ink
   block, the greeting and the grid together, precisely so that no caller can
   mount the grid as a separate paper section.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AcademicCapIcon,
  BookOpenIcon,
  BriefcaseIcon,
  InboxStackIcon,
  MapIcon,
  MapPinIcon,
  MoonIcon,
} from '@heroicons/react/24/outline'
import { chooseGridRecipe, tilesFor, type GridContext, type GridRecipeId, type GridTile } from '../lib/gridRecipes'
import { sized } from '../lib/imageUrl'
import { applyPostScope } from '../lib/postScope'
import { CAT_COLORS } from '../lib/uiHelpers'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { hasLeaderAccess, isSuperAdmin } from '../lib/roles'
import { useAuth } from '../auth/AuthContext'

/** localStorage key for "show me the tile grid". Owned by this file only. */
const GRID_OPEN_KEY = 'aq_home_map_open_v1'
import './AdaptiveGrid.css'

/* ── the enrichment reads ──────────────────────────────────────────────────
   Counts only. `head: true` means the rows themselves never leave the
   database, so nothing here can put a member's name, email or phone on the
   wire; the block only ever learns how many.

   Each leader queue names the desk route it links to, and `privilege` is the
   SAME value that desk carries in `director/deskAccess.ts`. 'super' there is
   `isSuperAdmin` (hr | super_admin), which is why volunteer applications and
   certificate requests are not counted for a plain HoD: they could not open
   those desks, and a number you cannot act on is noise. That mirrors the
   route guard - it does not widen it. If a desk's privilege changes in
   deskAccess.ts, change it here too.
   ────────────────────────────────────────────────────────────────────────── */

type QueueSpec = {
  key: string
  /** Tile copy. Lowercase and plain, matching "the whole map". */
  label: string
  href: string
  privilege: 'leader' | 'super'
  /** Whether the leader's team scope (director_scopes) can scope this queue. */
  scoped: boolean
}

const LEADER_QUEUES: readonly QueueSpec[] = [
  { key: 'approvals', label: 'members to approve', href: '/director/approvals', privilege: 'leader', scoped: false },
  { key: 'posts', label: 'posts to review', href: '/director/posts', privilege: 'leader', scoped: true },
  { key: 'hiring', label: 'applications to read', href: '/director/hiring', privilege: 'leader', scoped: true },
  { key: 'teams', label: 'join requests', href: '/director/teams', privilege: 'leader', scoped: false },
  { key: 'enquiries', label: 'enquiries', href: '/director/enquiries', privilege: 'leader', scoped: false },
  { key: 'volunteers', label: 'volunteer applications', href: '/director/volunteers', privilege: 'super', scoped: false },
  { key: 'certificates', label: 'certificate requests', href: '/director/certificates', privilege: 'super', scoped: false },
]

/** A count, or `null` when the read failed. Never a zero it did not fetch. */
async function countOf(build: () => any): Promise<number | null> {
  try {
    const { count, error } = await build()
    if (error) return null
    return typeof count === 'number' ? count : null
  } catch {
    return null
  }
}

const sb = () => supabaseCommunity as any

function deptPhrase(cats: string[]): string | undefined {
  if (cats.length === 0) return undefined
  if (cats.length === 1) return cats[0]
  return `${cats.slice(0, -1).join(', ')} and ${cats[cats.length - 1]}`
}

/**
 * Fills the fields the host leaves unresolved. Returns `{}` until the reads
 * settle, so the block paints its host-only recipe first and then upgrades
 * once - it never flickers between two claims, because every field it sets is
 * set in the same state update.
 */
function useGridEnrichment(enabled: boolean, memberId?: number, role?: string | null): Partial<GridContext> {
  const [extra, setExtra] = useState<Partial<GridContext>>({})

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      // Guarded INSIDE the async body rather than in the effect body: the
      // reset is a callback, not a synchronous cascading render.
      if (!enabled || typeof memberId !== 'number') { if (!cancelled) setExtra({}); return }
      const leader = hasLeaderAccess(role)
      const admin = isSuperAdmin(role)
      const next: Partial<GridContext> = { memberId }

      // ── the member's own rows. Own-row RLS on all five. ──────────────────
      const [unread, saved, ownJoin, ownApp, ownPost] = await Promise.all([
        countOf(() => sb().from('notifications').select('id', { count: 'exact', head: true }).eq('member_id', memberId).eq('is_read', false)),
        countOf(() => sb().from('saved_posts').select('saved_id', { count: 'exact', head: true }).eq('member_id', memberId)),
        countOf(() => sb().from('team_join_requests').select('request_id', { count: 'exact', head: true }).eq('member_id', memberId).eq('status', 'pending')),
        countOf(() => sb().from('job_applications').select('id', { count: 'exact', head: true }).eq('applicant_id', memberId).eq('status', 'pending')),
        // 'pending_review', not 'pending'. `posts_status_check` permits only
        // pending_review | published | rejected | scheduled, so `'pending'`
        // matched nothing and - because the query SUCCEEDS and just returns
        // zero - `countOf` handed back a confident 0 rather than null. The grid
        // then told a member with a post in the queue that nothing of theirs
        // was waiting. Every other call site in the codebase already used
        // 'pending_review'; this one was never updated.
        countOf(() => sb().from('posts').select('post_id', { count: 'exact', head: true }).eq('author_id', memberId).eq('status', 'pending_review').is('deleted_at', null)),
      ])
      if (unread !== null) next.unreadCount = unread
      if (saved !== null) next.savedCount = saved

      // The loop worth naming is the one with the most rows behind it. All
      // three unresolved leaves `ownPending` undefined rather than null, so
      // G21 falls through instead of asserting "nothing of yours is waiting".
      const own = [
        { label: 'your join request is waiting', count: ownJoin, href: '/teams' },
        { label: 'your application is being read', count: ownApp, href: '/opportunities' },
        { label: 'your post is in review', count: ownPost, href: '/my-posts' },
      ].filter(o => o.count !== null) as { label: string; count: number; href: string }[]
      if (own.length === 3) {
        const top = own.slice().sort((a, b) => b.count - a.count)[0]
        next.ownPending = top.count > 0 ? top : null
      } else if (own.some(o => o.count > 0)) {
        next.ownPending = own.slice().sort((a, b) => b.count - a.count)[0]
      }

      // ── the leader's queues ─────────────────────────────────────────────
      if (leader) {
        // Teams-as-categories slice 4: a leader's scope is their TEAMS (director_scopes,
        // one level of children). The five categories are no longer read here.
        // `null` = the scope read failed, so scoping is unknown and the scoped queues
        // are skipped rather than counted org-wide (which would show a HoD rows
        // outside their department). `[]` = resolved, no scope, which means org-wide.
        const scopeTeams = await (async () => {
          try {
            const own = await sb().from('director_scopes').select('team_id, teams(name)').eq('member_id', memberId)
            if (own.error) return null
            const rows = (own.data || []) as any[]
            const ids = rows.map(r => r.team_id as number)
            const names = rows.map(r => String(r.teams?.name ?? '').toLowerCase()).filter(Boolean)
            if (ids.length === 0) return { ids: [] as number[], names }
            const kids = await sb().from('teams').select('team_id').in('parent_team_id', ids).eq('is_active', true)
            if (kids.error) return null
            return { ids: Array.from(new Set([...ids, ...(kids.data || []).map((r: any) => r.team_id as number)])), names }
          } catch { return null }
        })()
        const scopeKnown = scopeTeams !== null
        const teamScope = scopeTeams?.ids ?? []
        const scopeNames = scopeTeams?.names ?? []
        const teamPostIds: number[] | null = teamScope.length
          ? await (async () => {
              try {
                const { data, error } = await sb().from('post_teams')
                  .select('post_id, posts!inner(status)').in('team_id', teamScope).eq('posts.status', 'pending_review')
                if (error) return null
                return Array.from(new Set((data || []).map((r: any) => r.post_id as number)))
              } catch { return null }
            })()
          : []
        // Pending posts nobody tagged to a team belong to every leader's queue, so a
        // post without a tag is never invisible to a scoped leader.
        const untaggedIds: number[] = teamScope.length
          ? await (async () => {
              try {
                const { data, error } = await sb().from('posts').select('post_id, post_teams(post_id)')
                  .eq('status', 'pending_review').is('deleted_at', null).is('post_teams', null)
                return error ? [] : (data || []).map((r: any) => r.post_id as number)
              } catch { return [] as number[] }
            })()
          : []

        const specs = LEADER_QUEUES.filter(q => (q.privilege === 'super' ? admin : true))
          .filter(q => (q.scoped ? scopeKnown : true))

        const counts = await Promise.all(specs.map(q => {
          switch (q.key) {
            case 'approvals':
              return countOf(() => sb().from('members').select('member_id', { count: 'exact', head: true }).eq('status', 'pending_approval'))
            case 'posts': {
              // Must agree with directorService.getScopedPendingPostsCount and
              // getPendingPosts, or the desk tile and the desk disagree about
              // the same queue. Same 'pending' -> 'pending_review' correction,
              // plus the two filters those two carry: soft-deleted rows are not
              // in review, and a mirrored row (a drive write-up, an opening) is
              // owned by another desk and is not a submission awaiting a verdict.
              let qb = sb().from('posts').select('post_id', { count: 'exact', head: true })
                .eq('status', 'pending_review').is('deleted_at', null).is('source_kind', null)
              if (teamPostIds === null) return Promise.resolve(null)
              qb = applyPostScope(qb as any, [], teamScope, [...teamPostIds, ...untaggedIds]) as typeof qb
              return countOf(() => qb)
            }
            case 'hiring': {
              // The department of an application is the department of the
              // opening it answers, so the scope filter rides the embedded
              // resource. `!inner` is what makes that a filter rather than a
              // left join that would keep every row.
              const unscoped = () => countOf(() => sb().from('job_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'))
              if (!teamScope.length) return unscoped()
              // An embedded filter is the one read here that PostgREST could
              // reject on a schema change. Falling back to the unscoped count
              // keeps the queue RESOLVED (a wider number, never a wrong one)
              // rather than letting a single 400 take the whole desk recipe
              // down to the fallback - which is the failure this change
              // exists to end.
              return countOf(() => sb().from('job_applications')
                .select('id, opening:job_openings!inner(team_id)', { count: 'exact', head: true })
                .eq('status', 'pending').in('opening.team_id', teamScope))
                .then(n => (n === null ? unscoped() : n))
            }
            case 'teams':
              // RLS already narrows this to the teams they lead (or all, for
              // a director), so no extra filter is needed or wanted.
              return countOf(() => sb().from('team_join_requests').select('request_id', { count: 'exact', head: true }).eq('status', 'pending'))
            case 'enquiries':
              return countOf(() => sb().from('collaboration_submissions').select('id', { count: 'exact', head: true }).eq('status', 'new'))
            case 'volunteers':
              return countOf(() => sb().from('volunteer_applications').select('id', { count: 'exact', head: true }).or('reviewed.is.null,reviewed.eq.false'))
            case 'certificates':
              return countOf(() => sb().from('certificate_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'))
            default:
              return Promise.resolve(null)
          }
        }))

        // ALL of them, or none. A partial sum understates the desk, and
        // "the desk is clear" on a failed read is the worst thing this block
        // could say to a leader.
        if (counts.every(c => c !== null) && specs.length === LEADER_QUEUES.filter(q => (q.privilege === 'super' ? admin : true)).length) {
          const resolved = specs.map((q, i) => ({ key: q.key, label: q.label, href: q.href, count: counts[i] as number }))
          next.queues = resolved.slice().sort((a, b) => b.count - a.count)
          next.queueDepth = resolved.reduce((n, q) => n + q.count, 0)
        }
        next.deptLabel = deptPhrase(scopeNames)
      }

      if (!cancelled) setExtra(next)
    })()

    return () => { cancelled = true }
  }, [enabled, memberId, role])

  return extra
}

const ICONS = {
  'map-pin': MapPinIcon,
  'academic-cap': AcademicCapIcon,
  'book-open': BookOpenIcon,
  briefcase: BriefcaseIcon,
  moon: MoonIcon,
  'inbox-stack': InboxStackIcon,
  map: MapIcon,
} as const

/**
 * Hue lookup. The five mapped categories come from `lib/uiHelpers.CAT_COLORS`
 * (post moderation's map, NOT `lib/jobOpenings`'s: the two are deliberately
 * different and the comment in uiHelpers says not to merge them). The three
 * non-category hues resolve to their palette tokens directly. No hex is
 * written here.
 */
function hueVar(hue: GridTile['hue']): string {
  if (!hue) return 'var(--welfare)'
  return CAT_COLORS[hue] ?? `var(--${hue})`
}

function Tile({ tile }: { tile: GridTile }) {
  const Icon = tile.icon ? ICONS[tile.icon] : null
  const style: React.CSSProperties = {
    gridColumn: `span ${tile.cols}`,
    gridRow: `span ${tile.rows}`,
  }

  if (tile.kind === 'hue') {
    return (
      <a className="aqg-tile aqg-tile-hue" data-rows={tile.rows} href={tile.href} style={{ ...style, background: hueVar(tile.hue) }}>
        {Icon ? <Icon className="aqg-icon" width={20} height={20} strokeWidth={1.9} aria-hidden="true" /> : null}
        <span>
          <span className="aqg-tile-label">{tile.label}</span>
          {tile.sublabel ? <span className="aqg-tile-sub">{tile.sublabel}</span> : null}
        </span>
      </a>
    )
  }

  if (tile.kind === 'map') {
    return (
      <a className="aqg-tile aqg-tile-map" data-rows={tile.rows} href={tile.href} style={style}>
        <span className="aqg-tile-label">{tile.label}</span>
        <span className="aqg-arrow" aria-hidden="true">&#8594;</span>
      </a>
    )
  }

  // A wash tile. `figure === undefined` means the tile carries no number at
  // all; `figure === null` means it should have one and the host could not
  // resolve it, so the dashed live marker goes in its place.
  const hasFigureSlot = tile.figure !== undefined
  const wide = tile.cols >= 2

  return (
    <a
      className={`aqg-tile ${wide || !hasFigureSlot ? 'aqg-tile-wash' : 'aqg-tile-stat'}`}
      data-rows={tile.rows}
      href={tile.href}
      style={style}
    >
      {wide || !hasFigureSlot ? (
        <>
          <span className="aqg-tile-label">{tile.label}</span>
          {hasFigureSlot ? <FigureSlot tile={tile} /> : <span className="aqg-arrow" aria-hidden="true">&#8594;</span>}
        </>
      ) : (
        <>
          <FigureSlot tile={tile} small />
          <span className="aqg-tile-mono">{tile.label}</span>
        </>
      )}
    </a>
  )
}

function FigureSlot({ tile, small }: { tile: GridTile; small?: boolean }) {
  if (tile.figure === null) {
    return (
      <span className="aq-live aq-live--on-ink">
        <span aria-hidden="true">live</span>
        <span className="sr-only">{tile.label} is not available yet</span>
      </span>
    )
  }
  return (
    <span className={`aqg-figure${small ? ' aqg-figure-sm' : ''}`} style={{ color: hueVar(tile.hue) }}>
      {tile.figure}
    </span>
  )
}

/* ── the greeting sentence ─────────────────────────────────────────────────
   2026-09-07, the visual pass. THE SENTENCE IS THE HEADLINE.

   It used to be a greeting line ("MORNING, AQUA.") stacked above a separate
   sub-line at 12.5px, which read as a heading plus a caption - two things -
   and made the block feel like a card with a title rather than one statement.
   The owner's reference does the opposite: ONE oversized mixed-weight
   sentence carries the name AND the fact, with a small round chip sitting
   between the words on the text baseline.

   The weight alternation is DERIVED, never invented. `line` is host copy
   (HomePage's HI_LINES) and every entry that has two sentences puts the
   payload first and the reassurance second - "You are down for a drive this
   week." then "Everything else can wait." So the first sentence takes the
   bold payload weight and the remainder takes the house emphasis device: one
   italic serif clause in an accent (the same device sections 01/06/12.8 use,
   `.serif` in v6.css). A one-sentence line simply does not split and stays
   entirely at payload weight - no copy is added, removed or reworded here.

   THE CHIP is the reference's strongest device and it is real, not a glyph
   stand-in: the member's own avatar, through `sized(url, 'avatar')` so a
   26px circle never ships a full-resolution original. With no avatar it
   falls back to their initial; with neither it renders NOTHING, because a
   chip with nothing in it is the weak version of the device. It is
   decorative - the name is already in the text beside it - so it is
   aria-hidden and carries no alt text.

   NO EMOJI. DESIGN.md forbids emoji-as-icons and the reference's 👋/😇/🏆
   are explicitly out of scope; the block already carries the mascot in its
   one sticker slot.
   ────────────────────────────────────────────────────────────────────────── */

/** Split on the FIRST sentence boundary. No boundary, no split. */
export function splitSay(line: string | undefined): { lead: string; tail?: string } {
  const text = (line ?? '').trim()
  if (!text) return { lead: '' }
  const i = text.indexOf('. ')
  if (i < 0 || i + 2 >= text.length) return { lead: text }
  return { lead: text.slice(0, i + 1), tail: text.slice(i + 2).trim() }
}

function SayChip({ avatarUrl, initial }: { avatarUrl?: string | null; initial?: string }) {
  if (avatarUrl) {
    return (
      <span className="aqg-chip" aria-hidden="true">
        <img src={sized(avatarUrl, 'avatar')} alt="" width={26} height={26} loading="lazy" decoding="async" />
      </span>
    )
  }
  if (initial) {
    return <span className="aqg-chip aqg-chip-i" aria-hidden="true">{initial}</span>
  }
  return null
}

export interface AdaptiveGridProps {
  /** Everything the predicates read. Assembled by the mounting page. */
  ctx: GridContext
  /** Section 14 owns this copy: the time-of-day eyebrow and the greeting. */
  eyebrow?: string
  greeting?: string
  /** One sentence, the state the recipe is answering. */
  line?: string
  /** QA affordance. Section 14 says keep the recipe pill in production. */
  showRecipeId?: boolean
  /** A sticker belongs to the ink block, not to a feed card. At most one. */
  sticker?: React.ReactNode
  /**
   * Count-only reads for the states no host page has data for: a leader's
   * queues, and the member's own open loops and trail. Defaults ON so the
   * existing call site needs no change; `false` restores the pure
   * fetch-nothing behaviour and every enriched field stays unresolved.
   */
  enrich?: boolean
  /**
   * Fires whenever the recipe THIS component actually renders changes id.
   * Exists because the host's own `chooseGridRecipe` call (used to pick
   * `line`/`greeting` copy and, on HomePage, the mascot's pose) reads a
   * context with no `queueDepth`/`ownPending`/`unreadCount`/`savedCount` -
   * those only exist once `useGridEnrichment` resolves, here, below. Before
   * this existed the host's guess and this component's real answer could
   * name two different recipes (G27/G30/G21/G09 could never be reached by the
   * host's own copy at all), which is how a break-recipe mascot pose could
   * sit over a grid that had already moved on to "your join request is
   * waiting" once enrichment landed. Called from an effect, never inline in
   * render, so it never fires more than once per settled id.
   */
  onRecipeChange?: (id: GridRecipeId) => void
  /**
   * Collapse the TILE GRID behind a toggle, leaving only the greeting line.
   *
   * Added 2026-09-10 after the owner's walkthrough: "you're always showing
   * this, it's blocking up so much wasted space... don't force a hero." The
   * grid was unconditional, so on a signed-in home every visit opened with a
   * full-height block of navigation tiles before a single post.
   *
   * The recipe system is untouched and still picks the right state - a member
   * on a break, a brand-new account, a leader with a full queue are all worth
   * saying. What changed is that saying it no longer costs the whole viewport:
   * the sentence stays, the tiles are one tap away, and the choice is
   * remembered per viewer.
   */
  collapsible?: boolean
}

export default function AdaptiveGrid({
  ctx,
  eyebrow,
  greeting = 'HI THERE.',
  line,
  showRecipeId = true,
  sticker,
  enrich = true,
  onRecipeChange,
  collapsible = false,
}: AdaptiveGridProps) {
  // The session is the only source for "who is looking" that cannot disagree
  // with RLS - it is the same row `get_current_member_id()` resolves.
  const { member } = useAuth()

  /**
   * Whether the tile grid is open. Collapsed by default (see `collapsible`),
   * remembered per viewer so someone who wants the map every visit only says
   * so once.
   *
   * Wrapped in try/catch and read lazily: a private-mode browser can throw on
   * localStorage access, and a thrown initialiser here would take the whole
   * home page down rather than merely forgetting a preference.
   */
  const [gridOpen, setGridOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(GRID_OPEN_KEY) === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem(GRID_OPEN_KEY, gridOpen ? '1' : '0') } catch { /* preference only */ }
  }, [gridOpen])

  const extra = useGridEnrichment(
    enrich && !!ctx.signedIn,
    ctx.memberId ?? (typeof member?.member_id === 'number' ? member.member_id : undefined),
    member?.role,
  )
  // Host first, enrichment second: the page's own numbers win, and the
  // enrichment only fills fields the host left out. A host that resolves these
  // itself should pass `enrich={false}` rather than fight the merge.
  const merged = useMemo<GridContext>(() => ({ ...extra, ...ctx }), [extra, ctx])

  // The sentence, its derived weight break, and the chip's fallback initial.
  const say = useMemo(() => splitSay(line), [line])
  const sayInitial = useMemo(() => {
    const src = (ctx.firstName || member?.full_name || '').trim()
    return src ? src.charAt(0).toUpperCase() : ''
  }, [ctx.firstName, member?.full_name])

  const { recipe, tiles } = useMemo(() => {
    try {
      const r = chooseGridRecipe(merged)
      return { recipe: r, tiles: tilesFor(r, merged) }
    } catch {
      // chooseGridRecipe already swallows a throwing predicate, so reaching
      // here means something upstream of it broke. G38 still renders: the host
      // never shows an empty ink block.
      const g38 = chooseGridRecipe({})
      return { recipe: g38, tiles: tilesFor(g38, {}) }
    }
  }, [merged])

  // Reported through a ref so a host that passes a fresh arrow function every
  // render (HomePage does) never turns this into a render-triggering
  // dependency - only `recipe.id` actually changing fires the callback.
  const onRecipeChangeRef = useRef(onRecipeChange)
  onRecipeChangeRef.current = onRecipeChange
  useEffect(() => {
    onRecipeChangeRef.current?.(recipe.id)
  }, [recipe.id])

  return (
    <section
      className={`aqg-block${collapsible ? ' is-collapsible' : ''}${collapsible && !gridOpen ? ' is-collapsed' : ''}`}
      aria-label="Your AquaTerra summary"
    >
      {showRecipeId ? <span className="aqg-id" aria-hidden="true">{recipe.id}</span> : null}
      {sticker}
      <div className="aqg-head">
        {eyebrow ? <span className="aqg-eyebrow">{eyebrow}</span> : null}
        <p className="aqg-say">
          <span className="aqg-say-name">{greeting}</span>
          <SayChip avatarUrl={member?.avatar_url} initial={sayInitial} />
          {say.lead ? <span className="aqg-say-lead">{say.lead}</span> : null}
          {say.tail ? <span className="aqg-say-tail">{say.tail}</span> : null}
        </p>
        {collapsible && (
          <button
            type="button"
            className="aqg-toggle"
            aria-expanded={gridOpen}
            onClick={() => setGridOpen(o => !o)}
          >
            {gridOpen ? 'hide the map' : 'the whole map'}
          </button>
        )}
      </div>
      {/* `hidden` rather than unmounting: the tiles are cheap, and keeping them
          in the tree means aria-expanded refers to something that exists and
          the open state is not re-derived on every toggle. */}
      <div className="aqg-grid" hidden={collapsible && !gridOpen}>
        {tiles.map(t => <Tile key={t.key} tile={t} />)}
      </div>
    </section>
  )
}
