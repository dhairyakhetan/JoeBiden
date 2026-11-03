import Img from '../components/Img'
import '../styles/routes/projects.css'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { CAT_COLORS } from '../lib/jobOpenings'
import searchService from '../services/searchService'
import { Reveal } from '../components/Reveal'
import PostStreamCard, { PostStreamCardData, postStreamHref, pickTileShape } from '../components/PostStreamCard'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd, itemListLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { PUBLIC_DEPARTMENTS as DEPARTMENTS } from '../lib/departments'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'
import { departmentsPhrase } from '../lib/orgFigures'
import { useDepartmentCount } from '../hooks/useDepartmentCount'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import Skeleton from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { isOfficialAccount, VerifiedTick } from '../components/v6Shared'
import useDebounce from '../hooks/useDebounce'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { getInitials, hashColor } from '../lib/uiHelpers'

// Phase 10 Index page - was PublicProjectsPage, a welfare_projects-only
// listing. Now surfaces the unified `posts` stream (mirrored welfare
// projects + blogs + job openings + any native posts, see Phase 4/5) with
// real category classification instead of the old welfare-specific
// "objective" taxonomy (Workshop, Feeding Dogs, Plantation Drive, ...),
// which doesn't apply outside welfare content and never fit blogs/openings.
//
// Scope note: the old page's "Featured" ticker is dropped, not carried
// forward - it read `welfare_projects.featured`, a boolean that has no
// equivalent on `posts`. Fabricating a stand-in "featured" concept for the
// unified stream wasn't asked for and isn't obviously the right design
// call to make without the missing reference files (see AQ_BUILD_PROGRESS.md's
// Phase 9 note) - better to leave it out than invent one.
//
// The elaborate two-stage fetch + long-TTL localStorage cache the old page
// used existed specifically to work around `welfare_projects` living in a
// slow cross-region legacy Supabase project. `posts` lives in the primary
// community project (fast, same region as everything else the app already
// queries) - that whole caching apparatus is no longer solving a real
// problem, so it's simplified to a plain paginated fetch here.
//
// changelog/10-projects.md ("the archive") was written assuming this page
// queries `welfare_projects` directly and renders a masonry of its rows.
// It doesn't, and hasn't since the phase-10 rewrite above: the query below
// still reads the unified `post_feed_view` stream. Per that changelog's own
// WORKFLOW.md ("if an instruction contradicts the code, the code wins -
// report it"), this implementation keeps the unified-stream architecture and
// adapts the redesign's tile/rail/search ideas onto it rather than reverting
// a deliberate, already-shipped, commented architecture decision. Two
// concrete adaptations worth flagging:
//   1. The "shape by data" tiles (PostStreamCard.tsx) read `source_stat`,
//      post_feed_view's mirror of welfare_projects.key_statistic, rather
//      than querying welfare_projects. That required adding ONE column
//      (`source_stat`) to the select() below - the one query-shape change
//      in this file. It's an already-public, already-selected-elsewhere,
//      zero-join column; no new table, RLS or fetch.
//   2. The sticky rail's category counts are omitted, not fetched: verified
//      live there is no grouped-category-count RPC or view (PostgREST/
//      supabase-js has no bare GROUP BY), and 10.1 explicitly says to render
//      the rail without counts rather than fire one query per category.

type Category = 'all' | 'events' | 'welfare' | 'content' | 'operations' | 'labs'
const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'events', label: 'Events' },
  { key: 'welfare', label: 'Welfare' },
  { key: 'content', label: 'Content' },
  { key: 'operations', label: 'Operations' },
  { key: 'labs', label: 'Labs' },
]

const PAGE_SIZE = 24

// Featured bento: fetch a small buffer of the desk-curated projects, render up
// to FEATURED_SHOW as tiles, and surface the true remaining count as a CTA.
const FEATURED_SHOW = 7
const FEATURED_MAX = 8

// Canonical cumulative-impact figures, consistent across the redesign's
// marketing surfaces (the Playground `.dhero` uses the same numbers). These
// are org-level lifetime totals, not a live query - the post stream below is
// the live data. Kept here so the hero reads as the redesign intends.
//
// 2026-09-06: sourced from ORG_FACTS instead of hand-typed (§21.0, "no
// public-facing statistic may be written as a literal in a component. Ever.";
// §21.4, "a four-digit number followed by + in a .tsx file is a failure").
// None of the four values changed - only where they live. All four are
// BRAND_VOICE §3 CLEARED facts, so they are constants with a named owner
// rather than nulls; see the CONSTANTS block in scripts/compute-org-facts.mjs.
// sundarbansTrips is rendered raw, never through displayCount(), because it is
// a small exact count like teamsActive.
const IMPACT_STATS: { n: string; label: string }[] = [
  { n: displayCount(ORG_FACTS.saplingsPlanted), label: 'saplings planted' },
  { n: displayCount(ORG_FACTS.childrenReached), label: 'kids reached' },
  { n: String(ORG_FACTS.sundarbansTrips), label: 'sundarbans trips' },
  { n: displayCount(ORG_FACTS.bananasDistributed), label: 'bananas distributed' },
]

type Row = {
  post_id: number
  uuid: string
  category: string
  body: string
  author_name: string
  created_at: string
  images: { url?: string; blobUrl?: string; displayOrder?: number }[] | null
  source_type?: string | null
  /** workshop_date of the linked welfare project (C-12): the date the drive happened, not when the record was made. */
  event_date?: string | null
  source_title?: string | null
  source_slug?: string | null
  // ADDED for changelog/10-projects.md's shape-by-data tiles (10.0): mirrors
  // welfare_projects.key_statistic - verified byte-identical to it live for
  // every welfare-sourced row. This is the one query-shape change this file
  // made (a column added to fetchPage's select() below): the redesign's
  // whole "tall photo tile / cream well tile" premise depends on knowing
  // whether a row has a real statistic, and post_feed_view already exposes
  // it under this generic mirror name at zero extra query cost (same view,
  // same RLS, no join, no new fetch) - see PublicProjectsPage's own file-
  // level note for the fuller justification and why this is flagged rather
  // than done silently.
  source_stat?: string | null
  /**
   * `post_feed_view.stats` - the SECOND column added to this file's select,
   * for item 3.2, and flagged here for the same reason `source_stat` above is.
   * Same view, same RLS, no join, no extra fetch. It carries
   * `[{label:'volunteers', value:'4'}, ...]`, and the volunteer headcount is
   * what separates a 40-person drive from the median four - the archive was
   * 89% one tile shape without it.
   */
  stats?: unknown
}

function rowTitle(body: string): string {
  const line = (body || '').split('\n').map(s => s.trim()).find(Boolean)
  if (!line) return 'Untitled'
  return line.length > 90 ? line.slice(0, 87) + '…' : line
}

/** Volunteers off `post_feed_view.stats` - item 3.2. The array is
 *  `[{label, value}]` with `value` a STRING ("4"), so it is parsed, not cast,
 *  and a non-numeric or missing entry yields null rather than NaN or 0 (a
 *  fabricated zero would read as "nobody came"). */
function volunteersFrom(stats: Row['stats']): number | null {
  if (!Array.isArray(stats)) return null
  const row = stats.find(s => s && typeof s === 'object' && (s as any).label === 'volunteers')
  if (!row) return null
  const n = Number.parseInt(String((row as any).value ?? ''), 10)
  return Number.isFinite(n) ? n : null
}

function toCard(row: Row, displayNum: number): PostStreamCardData {
  const img = row.images?.[0]
  return {
    uuid: row.uuid,
    category: row.category,
    title: rowTitle(row.body),
    authorName: row.author_name,
    createdAt: row.created_at,
    eventDate: row.event_date ?? undefined,
    imageUrl: img?.blobUrl || img?.url || undefined,
    color: CAT_COLORS[row.category] || 'var(--welfare)',
    displayNum,
    sourceType: row.source_type,
    sourceTitle: row.source_title,
    sourceSlug: row.source_slug,
    stat: row.source_stat ?? null,
    // Item 3.2. `images` was already selected and only `[0]` was ever read;
    // the length is what tells a shoot from a snapshot.
    imageCount: Array.isArray(row.images) ? row.images.length : 0,
    volunteers: volunteersFrom(row.stats),
  }
}

/** Cards used to show the record's created_at ("JUL 2026" on a drive that ran in Dec 2025). Look up the
 *  real drive date (welfare_projects.workshop_date) for the project rows on screen, in one query. */
async function attachWorkshopDates(rows: Row[]): Promise<Row[]> {
  const slugs = Array.from(new Set(rows.filter(r => r.source_type === 'welfare_project' && r.source_slug).map(r => r.source_slug as string)))
  if (!slugs.length) return rows
  const { data, error } = await supabaseCommunity.from('welfare_projects').select('slug,workshop_date').in('slug', slugs)
  if (error || !data) return rows
  const bySlug = new Map((data as { slug: string; workshop_date: string | null }[]).map(d => [d.slug, d.workshop_date]))
  return rows.map(r => (r.source_type === 'welfare_project' && r.source_slug && bySlug.get(r.source_slug)
    ? { ...r, event_date: bySlug.get(r.source_slug) }
    : r))
}

function featDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toLowerCase()
}

// Featured band - a smart scrapbook BENTO of the drives the desk actually
// curates. The featured set lives on `welfare_projects.featured` (toggled in
// the Projects desk tab); `post_feed_view.featured` mirrors only the unrelated
// `posts.featured` flag, so an earlier version read the wrong column and showed
// nothing the user had marked. These `items` are the mirrored posts of the real
// featured projects (resolved in the fetch effect below). Varied tile sizes come
// from the `.pbento` nth-child rhythm; the first tile is an eager LCP cover.
// Shared band chrome, so the loading, error and loaded states are the same
// band rather than three differently-shaped things swapping places.
//
// COPY FLAG (needs the owner's words): "★ featured drives" / "picked by the
// desk" are placeholders in the plainest voice already used by this page's
// other headings ("the drives.", "the archive"). Not invented brand copy.
function FeaturedBandShell({ children }: { children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 'clamp(22px, 4vw, 34px)' }}>
      <div className="container">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <span className="pfeat-pill">★ featured drives</span>
          <span className="pfeat-note">picked by the desk</span>
        </div>
        {children}
      </div>
    </section>
  )
}

// Loading: the bento's own geometry, not a generic grey slab - the hero spans
// both columns at --r-outer (32), the two 1:1 tiles take --r-tight (14),
// exactly matching .pbento/.pbento-tile so nothing reflows when data lands.
// One role=status/aria-busy for the whole surface (11.2), never one per block.
function FeaturedBandSkeleton() {
  return (
    <FeaturedBandShell>
      <div className="pbento" role="status" aria-busy="true">
        <span className="sr-only">Loading featured drives…</span>
        <Skeleton style={{ gridColumn: 'span 2', aspectRatio: '16 / 10' }} height="auto" radius="var(--r-outer)" />
        <Skeleton style={{ aspectRatio: '1' }} height="auto" radius="var(--r-tight)" />
        <Skeleton style={{ aspectRatio: '1' }} height="auto" radius="var(--r-tight)" />
      </div>
    </FeaturedBandShell>
  )
}

function FeaturedBento({ items, total, onViewAll }: { items: PostStreamCardData[]; total: number; onViewAll: () => void }) {
  const content = items.slice(0, FEATURED_SHOW)
  const remaining = total - content.length
  const meta = (c: PostStreamCardData) => [c.category, featDate(c.eventDate ?? c.createdAt)].filter(Boolean).join(' · ')
  return (
    <FeaturedBandShell>
        <div className="pbento">
          {content.map((c, i) => {
            const isHero = i === 0
            return (
              // The desk-curated featured bento is the most prominent set of links on
      // the project index, and it pointed at /post/:uuid - the URL PostPage
      // canonicals away, the sitemap excludes and robots.txt disallows. So the
      // page's strongest internal links poured equity into URLs that
      // immediately redirect, while the identical card below it linked to
      // /projects/:slug. Shared resolver now, so they cannot disagree.
      <Link key={c.uuid} to={postStreamHref(c)} className={'pbento-tile' + (c.imageUrl ? '' : ' no-img')} style={{ ['--fk' as any]: c.color }}>
                {isHero && <span className="pbento-hero-badge" aria-hidden>★ featured</span>}
                {c.imageUrl
                  ? <Img ctx={isHero ? 'cover' : 'card'} src={c.imageUrl} alt={c.title} eager={isHero} className="proj-feat-img" />
                  : <div className="proj-feat-img proj-feat-noimg" style={{ background: c.color }} />}
                <div className="proj-feat-scrim" />
                <div className="proj-feat-body">
                  <span className="proj-feat-kick">{meta(c)}</span>
                  <h3 className={'proj-feat-title' + (isHero ? '' : ' proj-feat-title-sm')}>{c.title}</h3>
                  {isHero && (
                    <span className="proj-feat-by" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      by {c.authorName}
                      {isOfficialAccount(c.authorName) && <VerifiedTick size={12} />}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
          {remaining > 0 && (
            <button type="button" className="pbento-cta" onClick={onViewAll}>
              <span className="pbento-cta-n">+{remaining}</span>
              <span className="pbento-cta-label">see all drives →</span>
            </button>
          )}
        </div>
    </FeaturedBandShell>
  )
}

// ── "Everything we do" intro (merged in from the retired /everything-we-do) ──
// Slug used both as each department card's anchor id (#events, #welfare-projects,
// …) and to match the deep-links other pages still point at via CAT_TO_DEPT.
const deptSlug = (name: string) => name.toLowerCase().replace(/\s+/g, '-').replace(/\./g, '')

const DEPT_LINKS: Record<string, { to: string; label: string }> = {
  'Events': { to: '/projects?category=events', label: 'see event posts →' },
  'Welfare Projects': { to: '/projects?category=welfare', label: 'browse the drives →' },
  'Social Media': { to: '/projects?category=content', label: 'see what we publish →' },
  'Collabs': { to: '/collaborations', label: 'partner with us →' },
  'Crftd': { to: '/crftd', label: 'see brand work →' },
  'AQ.Ventures': { to: '/opportunities', label: 'open roles →' },
  'ShikshAQ': { to: 'https://shikshaq.in', label: 'the platform →' },
  'Human Resources': { to: '/login', label: 'join the work →' },
}

function WhatWeDoIntro() {
  const departments = useDepartmentCount()
  return (
    <>
      {/* The 8 teams as a slick left-to-right chip ticker (replaced the node
          web + the big department cards - minimal vertical space). */}
      <section className="container" style={{ padding: 'clamp(22px, 4vw, 38px) var(--page-px) 4px' }}>
        <div className="row gap-2" style={{ marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="sticker sticker-sky sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>✦ the teams</span>
          <span className="mono xs muted">{departmentsPhrase(departments)}, student-run · tap to explore</span>
        </div>
        <div className="dir-team-chips">
          {DEPARTMENTS.map(dept => {
            const deptLink = DEPT_LINKS[dept.name]
            const dest = deptLink?.to || '/teams'
            const isExternal = /^https?:\/\//.test(dest)
            const ChipTag = isExternal ? 'a' : Link
            const chipProps = isExternal ? { href: dest, target: '_blank', rel: 'noopener noreferrer' } : { to: dest }
            // These chips look identical but go three genuinely different
            // places: an in-page category filter, another page on this site,
            // or straight into the login/apply flow. A visitor tapping
            // "Human Resources" expecting to read about that department was
            // landing on a sign-in page with no warning. The marker tells
            // them which kind of thing they're about to trigger, using the
            // site's own convention (↗ external, → navigates away, · filters
            // this page in place).
            const isInPageFilter = dest.startsWith('/projects?')
            const isAuthFlow = dest === '/login'
            const marker = isExternal ? '↗' : isInPageFilter ? '·' : '→'
            const markerTitle = isExternal
              ? `${dept.desc}. opens in a new tab`
              : isInPageFilter
                ? `${dept.desc}. filters this page`
                : isAuthFlow
                  ? `${dept.desc}. starts the sign-up`
                  : `${dept.desc}. goes to another page`
            return (
              <ChipTag
                key={dept.name}
                id={deptSlug(dept.name)}
                {...(chipProps as any)}
                className="dir-team-chip"
                style={{ ['--tc' as string]: dept.color, scrollMarginTop: 'calc(var(--nav-h) + 16px)' } as React.CSSProperties}
                title={markerTitle}
              >
                <span className="dir-team-chip-dot" aria-hidden />
                <span>{dept.name}</span>
                <span aria-hidden className="dir-team-chip-marker">{marker}</span>
              </ChipTag>
            )
          })}
        </div>
        {/* The marker convention, printed rather than left in a `title` that a
            touch device can never surface. */}
        <p className="dir-chip-legend">the marker tells you what the tap does · dot filters this page · arrow goes elsewhere · corner arrow opens a new tab</p>
      </section>

      {/* Divider into the live stream */}
      <div className="container" style={{ padding: 'clamp(20px, 4vw, 32px) var(--page-px) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="h-display" style={{ fontSize: 30, lineHeight: 1, letterSpacing: '-0.045em', margin: 0 }}>
            the <span className="underline-doodle" style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: 'var(--welfare-ink)' }}>drives</span>.
          </h2>
          <span aria-hidden style={{ flex: 1, height: 2, background: 'var(--line)' }} />
          <span className="mono xs muted">live feed ↓</span>
        </div>
      </div>
    </>
  )
}

export default function PublicProjectsPage() {
  const departments = useDepartmentCount()
  useMeta(pageMetadata.projects)
  useJsonLd('projects-breadcrumb', breadcrumbLd([['Home', '/'], ['Projects', '/projects']]))
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') || '')
  // Audit pass, 2026-09-06: was a hardcoded `'all'`, never reading the URL at
  // all - but WhatWeDoIntro's own department chips link here as
  // `/projects?category=events` etc. with a "·" marker captioned "filters
  // this page" (and a printed legend saying the same), so the on-page copy
  // was documenting a behavior the state never implemented: the URL changed,
  // the toolbar still read "Everything, newest first." Validated against the
  // known `Category` values so a stray/garbage `?category=` can't set state
  // to something none of the chips or the CATEGORIES rail can ever produce.
  const [category, setCategory] = useState<Category>(() => {
    const c = searchParams.get('category')
    return (CATEGORIES.some(opt => opt.key === c) ? c : 'all') as Category
  })
  const [rows, setRows] = useState<Row[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [featuredRows, setFeaturedRows] = useState<Row[]>([])
  const [featuredTotal, setFeaturedTotal] = useState(0)
  const [featuredLoading, setFeaturedLoading] = useState(true)
  const [featuredError, setFeaturedError] = useState<string | null>(null)
  // Bumping this re-runs the featured effect below - that's the retry wire for
  // the band's ErrorState (11.4: "wire this to actually re-run the fetch,
  // never window.location.reload()").
  const [featuredReload, setFeaturedReload] = useState(0)

  // Featured band - the projects the desk actually curates live on
  // `welfare_projects.featured` (toggled from the Projects tab). post_feed_view
  // exposes only `posts.featured` (a different, near-empty flag), so we resolve
  // the real set here: (1) pull the featured welfare_projects - each mirrored to
  // a post via `linked_post_id` - keeping an exact total for the "see all" CTA,
  // then (2) load those mirrored posts from the view so the tiles share the exact
  // card shape/imagery as the stream below. Independent of the paginated browse
  // query so pagination/category filtering never disturbs it.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Deferred to a microtask rather than set synchronously in the effect
      // body, matching the browse effect's `reset` promise below
      // (react-hooks/set-state-in-effect).
      await Promise.resolve()
      if (cancelled) return
      setFeaturedError(null)
      setFeaturedLoading(true)
      // `welfare_projects` lives in the same Supabase project but isn't in this
      // client's generated Database type (it predates the consolidation), so the
      // builder is cast - matching how the browse query below casts the view's
      // runtime-only `source_type`/`featured` columns.
      // .order('created_at') alone is ambiguous when many rows share one
      // timestamp (a bulk import batch) - .id as a secondary key makes which
      // FEATURED_MAX rows come back deterministic across repeated calls
      // (React 19 StrictMode's double-invoked mount effect calls this query
      // twice; without a tiebreaker those two calls could each pick a
      // different subset of the tied rows).
      const { data: feats, count, error: fErr } = await (supabaseCommunity as any)
        .from('welfare_projects')
        .select('linked_post_id', { count: 'exact' })
        .eq('featured', true)
        .not('linked_post_id', 'is', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(FEATURED_MAX)
      if (cancelled) return
      // Was `if (cancelled || fErr || !feats?.length) return` - a failed
      // featured query was indistinguishable from "nothing is featured", so
      // the band vanished with only a swallowed error object. Those are two
      // different states and this codebase requires the failure to be visible.
      if (fErr) {
        console.error('featured drives query failed', fErr)
        setFeaturedError(fErr.message || 'The featured drives query failed.')
        setFeaturedLoading(false)
        return
      }
      if (!feats?.length) { setFeaturedTotal(0); setFeaturedLoading(false); return }
      const ids = (feats as { linked_post_id: string | null }[])
        .map(f => f.linked_post_id).filter(Boolean) as string[]
      const { data, error } = await supabaseCommunity
        .from('post_feed_view')
        .select('post_id,uuid,category,body,author_name,created_at,images,source_type,source_title,source_slug')
        .in('uuid', ids)
        .eq('status', 'published')
      if (cancelled) return
      if (error || !data) {
        console.error('featured drives post fetch failed', error)
        setFeaturedError(error?.message || 'The featured drives could not be loaded.')
        setFeaturedLoading(false)
        return
      }
      // The `.in()` fetch returns rows in arbitrary order - restore the
      // welfare_projects "most-recently-featured first" order.
      const order = new Map(ids.map((id, i) => [id, i]))
      const sorted = (data as unknown as Row[]).slice()
        .sort((a, b) => (order.get(a.uuid) ?? 1e9) - (order.get(b.uuid) ?? 1e9))
      setFeaturedRows(await attachWorkshopDates(sorted))
      if (typeof count === 'number') setFeaturedTotal(count)
      setFeaturedLoading(false)
    })().catch(e => {
      // supabase-js resolves rather than rejects on a query error, but a
      // network/DNS failure still throws - without this the band would hang on
      // its skeleton forever (a silent failure by another route).
      if (cancelled) return
      console.error('featured drives fetch threw', e)
      setFeaturedError('The featured drives could not be loaded.')
      setFeaturedLoading(false)
    })
    return () => { cancelled = true }
  }, [featuredReload])

  // changelog/10-projects.md's "with a statistic" shortcut (10.1): a second,
  // independent filter dimension ANDed with `category` - "the ones with
  // numbers" in the sticky rail. `.not('source_stat','is',null)` on the
  // already-selected column above; no new query, no new fetch.
  const [statOnly, setStatOnly] = useState(false)

  // The featured bento's "see all drives" used to set the category filter
  // and nothing else - the stream it filtered is well off-screen from the
  // bento, so the user's action produced an invisible state change with
  // nothing moving to meet them. This scrolls the results they asked for
  // into view.
  const streamRef = useRef<HTMLElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Scroll-revealed search (10.1) ────────────────────────────────────
  // "The search bar is not in the header. It appears when the grid's top
  // passes the viewport top... IntersectionObserver on a sentinel above the
  // grid - never a scroll listener." Replaces the old barStuck mechanic,
  // which measured getBoundingClientRect() on a scroll listener every frame.
  const searchSentinelRef = useRef<HTMLDivElement>(null)
  const [searchVisible, setSearchVisible] = useState(false)
  // The y the sentinel has to pass for the bar to reveal: the bottom of the
  // fixed nav plus a hair. Read once, and shared by the observer's rootMargin
  // and the direct-measurement fallback below so the two can't disagree.
  const [navLine] = useState(() => (typeof document === 'undefined'
    ? 70
    : parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 70) + 8)
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const el = searchSentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      // `isIntersecting` is false BOTH when the sentinel hasn't been scrolled
      // to yet (still below the fold, on first mount) AND once it has been
      // scrolled past (above the viewport) - naively inverting it (the
      // original form here) reveals the bar from the very first paint,
      // before any scroll happens, because a fresh sentinel starts off
      // below the fold with isIntersecting already false. Confirmed live:
      // `.arch-search` computed `is-visible` at scrollY 0 on initial load.
      //
      // Comparing `boundingClientRect.top` to a bare 0 isn't right either:
      // the rootMargin below shrinks the root's top edge inward by navH+8px
      // precisely so the reveal fires as the sentinel passes UNDER the fixed
      // nav bar, not only once it's fully above y=0 - confirmed live via a
      // raw observer log, the callback that should reveal the bar reports
      // `top: 39` (still positive) alongside `rootBounds.top: 78`. So the
      // correct comparison is against the margin-shrunk root's own top
      // (`entry.rootBounds.top`), not a hardcoded 0 - that is what actually
      // tells "exited above the shrunk root" apart from "not reached below
      // it yet", both of which report `isIntersecting: false`.
      ([entry]) => setSearchVisible(!entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0)),
      { rootMargin: `-${navLine}px 0px 0px 0px` },
    )
    io.observe(el)

    // An IntersectionObserver only reports a CROSSING. An instant jump - the
    // `#welfare-projects` hash landing, a restored scroll position, this
    // page's own scrollIntoView calls - can take the sentinel from "below the
    // fold, not intersecting" straight to "above the nav, not intersecting"
    // with no intersecting frame in between, so no record is queued and the
    // bar keeps whatever state it had. Confirmed live before this fix:
    // loading /projects and calling scrollTo(0, 2600) left `.arch-search`
    // stuck at opacity 0 (class list still bare `arch-search`) with the grid
    // scrolled well past it. A direct measurement covers exactly those jumps.
    // This is NOT the per-frame scroll listener 10.1 rules out: `scrollend`
    // fires once, after the scroll settles (and where it is unsupported the
    // observer above still handles every continuous scroll).
    const sync = () => {
      const r = el.getBoundingClientRect()
      setSearchVisible(r.bottom < navLine)
    }
    window.addEventListener('hashchange', sync)
    window.addEventListener('scrollend', sync)
    return () => {
      io.disconnect()
      window.removeEventListener('hashchange', sync)
      window.removeEventListener('scrollend', sync)
    }
  }, [navLine])

  // Reachable without scrolling (10.1): a header icon that scrolls the
  // sentinel out of view (which is what the observer above reacts to, so the
  // bar reveals itself the normal way) and focuses the field once it lands -
  // one action for a keyboard user instead of tabbing past the hero, the
  // team ticker and the featured bento first.
  const jumpToSearch = useCallback(() => {
    searchSentinelRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    window.setTimeout(() => searchInputRef.current?.focus(), reduceMotion ? 0 : 380)
  }, [reduceMotion])

  const isSearching = search.trim().length > 0
  // The search query itself is debounced (250ms, matching MembersPage) so a
  // 60-row ilike scan isn't fired on every keystroke; isSearching stays on the
  // live value so the UI (headers, filter count, empty states) responds
  // instantly, not just the network call.
  const debouncedSearch = useDebounce(search, 250)

  // Browse mode: paginated, category-filtered fetch straight off post_feed_view.
  const fetchPage = useCallback(async (pageIndex: number, replace: boolean) => {
    const from = pageIndex * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    let query = supabaseCommunity
      .from('post_feed_view')
      // source_stat ADDED for 10-projects.md's shape-by-data tiles - see the
      // file-level note above and Row's own comment for why this one column
      // was added rather than treated as an "omit the element" case.
      .select('post_id,uuid,category,body,author_name,created_at,images,source_type,source_title,source_slug,source_stat,stats', { count: pageIndex === 0 ? 'exact' : undefined })
      .eq('status', 'published')
      // Job-opening mirrors belong on /opportunities, not the directory -
      // they used to render here as a HiringCard ticket mixed into the
      // welfare/blog grid, which reads as noise on a page about drives.
      // (source_type isn't in the stale generated types for this view.)
      // Plain `.neq` compiles to `<>`, which is NULL for a NULL source_type and
      // dropped every member-authored post (16 live, 5 of them welfare). The
      // explicit `is.null` arm keeps them; same form as searchService.ts.
      .or('source_type.is.null,source_type.neq.job_opening')
      .order('created_at', { ascending: false })
      .order('post_id', { ascending: false })
      .range(from, to)
    if (category !== 'all') query = query.eq('category', category)
    // "with a statistic" shortcut (10.1) - ANDs with category, doesn't replace it.
    if (statOnly) query = query.not('source_stat' as any, 'is', null)

    const { data, error, count } = await query
    if (error) throw error
    // source_type/source_title exist on post_feed_view at runtime but the
    // generated types are stale for the view, so cast through unknown.
    const newRows = await attachWorkshopDates((data || []) as unknown as Row[])
    setRows(prev => replace ? newRows : [...prev, ...newRows])
    if (pageIndex === 0 && count != null) setTotalCount(count)
    setHasMore(newRows.length === PAGE_SIZE)
  }, [category, statOnly])

  // Search mode: delegate to searchService (Phase 11's fixed, deduped posts
  // search) instead of a bespoke ilike query - this is exactly what "search
  // bar wired to searchService.ts" means. Not paginated; search result sets
  // are inherently smaller and a flat list is the right UX here.
  useEffect(() => {
    let cancelled = false
    // The query itself keys off the debounced value, not the live `search` -
    // that's what turns per-keystroke network calls into one call per pause.
    const queryIsSearching = debouncedSearch.trim().length > 0
    // Loading/error resets happen inside the async chain rather than
    // synchronously in the effect body (react-hooks/set-state-in-effect) -
    // React batches the microtask-deferred update, so the spinner still
    // appears before any network response lands. Same UX, no cascading
    // sync render.
    const reset = Promise.resolve().then(() => {
      if (cancelled) return
      setLoading(true); setFetchError(null)
    })
    if (queryIsSearching) {
      reset
        .then(() => searchService.search(debouncedSearch.trim(), 'posts', 60))
        .then(r => {
          if (cancelled) return
          const mapped: Row[] = r.data.results.posts
            .filter(p => category === 'all' || p.category === category)
            .map(p => ({
              post_id: p.postId, uuid: p.uuid, category: p.category, body: p.body,
              author_name: p.authorName, created_at: p.createdAt, images: p.images,
            }))
          setRows(mapped)
          setTotalCount(mapped.length)
          setHasMore(false)
        })
        .catch(e => { console.error('[PublicProjectsPage] search failed:', e); if (!cancelled) setFetchError('Search failed') })
        .finally(() => { if (!cancelled) setLoading(false) })
    } else {
      reset
        .then(() => { if (!cancelled) setPage(0); return fetchPage(0, true) })
        .catch(e => { console.error('[PublicProjectsPage] load failed:', e); if (!cancelled) setFetchError('Failed to load posts') })
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    return () => { cancelled = true }
  }, [debouncedSearch, category, fetchPage])

  const loadMore = useCallback(() => {
    if (isSearching || loadingMore || !hasMore) return
    setLoadingMore(true)
    const next = page + 1
    // Audit pass, 2026-09-06: was `.then(...).finally(...)` with no `.catch`.
    // fetchPage throws on a query error (line above), so a failed page-2+
    // load became an unhandled promise rejection - no toast, no error text,
    // and since `loadingMore`/`hasMore` still reset via `finally`, the
    // IntersectionObserver sentinel could silently re-fire the same failing
    // request every time it re-entered view. The initial-load effect above
    // already has a `.catch` (into `fetchError`); reusing that state here
    // would blank out the posts already on screen behind a full error view,
    // so this surfaces a toast instead and leaves the loaded rows in place.
    fetchPage(next, false)
      .then(() => setPage(next))
      .catch(e => toast.error('Couldn’t load more posts', e?.message || 'Please try again'))
      .finally(() => setLoadingMore(false))
  }, [isSearching, loadingMore, hasMore, page, fetchPage, toast])

  // Always call the latest loadMore without needing to recreate the observer
  // for it - the observer itself is keyed to the sentinel DOM node's actual
  // lifecycle instead (see the callback ref below), which is the part that
  // was broken: the sentinel <div> doesn't exist until cards first render,
  // so a plain useRef + a `[loadMore]`-keyed effect grabbed a null ref once
  // and never re-attached once the div actually mounted - infinite scroll
  // silently stopped after the first page everywhere, worse on mobile where
  // there's no hover/scrollbar affordance hinting more content exists.
  const loadMoreRef = useRef(loadMore)
  useEffect(() => { loadMoreRef.current = loadMore }, [loadMore])

  const observerInstanceRef = useRef<IntersectionObserver | null>(null)
  const sentinelCallbackRef = useCallback((node: HTMLDivElement | null) => {
    observerInstanceRef.current?.disconnect()
    observerInstanceRef.current = null
    if (!node) return
    observerInstanceRef.current = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreRef.current() },
      { rootMargin: '200px' }
    )
    observerInstanceRef.current.observe(node)
  }, [])

  const cards = useMemo(() => rows.map((r, i) => toCard(r, (totalCount || rows.length) - i)), [rows, totalCount])
  const featuredCards = useMemo(() => featuredRows.map((r, i) => toCard(r, i)), [featuredRows])
  const activeFilterCount = (category !== 'all' ? 1 : 0) + (isSearching ? 1 : 0) + (statOnly ? 1 : 0)
  const clearAllFilters = useCallback(() => { setCategory('all'); setSearch(''); setStatOnly(false) }, [])

  // Toolbar's contributor cluster (10.1): real, non-fabricated initials
  // avatars from the distinct authors actually present on the current page
  // of results - never a stock/placeholder image and never a new query
  // (author_name is already selected above; author_avatar is not, and adding
  // it would be exactly the "query gained a column" ACCEPTANCE.md forbids
  // for something purely decorative).
  const contributorNames = useMemo(() => {
    const seen = new Set<string>()
    const ordered: string[] = []
    for (const c of cards) {
      if (c.authorName && !seen.has(c.authorName)) { seen.add(c.authorName); ordered.push(c.authorName) }
    }
    return ordered
  }, [cards])

  // ItemList of the drives actually rendered in the stream below, in the same
  // order. Capped at 50 - the page paginates, and a list longer than what a
  // visitor can see on this URL would no longer mirror visible content.
  useJsonLd('projects-items', itemListLd(
    'AquaTerra drives and projects',
    cards.slice(0, 50)
      .filter(c => c.title && c.title !== 'Untitled')
      // Same resolver the visible card uses. This emitted /post/:uuid, so the
      // structured data advertised 50 canonicalized-away, sitemap-excluded,
      // robots-disallowed duplicates instead of the prerendered canonical URLs.
      .map(c => ({ name: c.title, path: postStreamHref(c) })),
  ))

  return (
    <div className="route-enter">
      {/* ── HERO (redesign .dhero - dark rounded card, "our projects.") ──
          Vertical padding only - `.container` below already applies
          var(--page-px) horizontally; adding it here too doubled the gutter. */}
      <section style={{ padding: 'clamp(20px, 4vw, 40px) 0 0' }}>
        <div className="container">
          <div style={{
            background: 'var(--ink)', color: 'var(--bg)',
            border: 'var(--hair-2)', borderRadius: 32,
            padding: 'clamp(22px, 5vw, 52px) clamp(18px, 4vw, 44px)', position: 'relative', overflow: 'hidden',
          }}>
            {/* deco. The spinning glyph is deleted (section 05b): a permanently
                rotating character beside an h1 is motion with no message, and it
                carried no reduced-motion branch. The ring stays. */}
            <div aria-hidden style={{ position: 'absolute', bottom: -40, right: -30, width: 180, height: 180, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
              {/* accent-lint-ok: measured in-browser, the ground here is the ink slab (#0A0A0A), not cream. The display hue clears AA on ink (welfare 4.55:1, lemon 15.1:1) and its --*-ink partner does NOT (3.20:1 / 3.36:1) - swapping it made this worse and was reverted. The ground is on an ancestor element, so a static checker cannot see it. */}
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', animation: 'pulse-blink 2s ease-in-out infinite' }} />
                {departmentsPhrase(departments)} · {totalCount > 0 ? `${totalCount}+` : displayCount(ORG_FACTS.drivesWrittenUp)} drives, blogs & openings
              </span>
              <h1 className="dir-hero-h1">
                {/* accent-lint-ok: measured in-browser, the ground here is the ink slab (#0A0A0A), not cream. The display hue clears AA on ink (welfare 4.55:1, lemon 15.1:1) and its --*-ink partner does NOT (3.20:1 / 3.36:1) - swapping it made this worse and was reverted. The ground is on an ancestor element, so a static checker cannot see it. */}
                the <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400, color: 'var(--accent)' }}>directory</span>.
              </h1>
              <p style={{
                fontFamily: 'var(--eina)', fontSize: 'clamp(14px, 1.5vw, 16px)', lineHeight: 1.6,
                color: 'rgba(255,255,255,0.6)', maxWidth: 460, margin: 0,
              } as React.CSSProperties}>
                everything AquaTerra does, in one place - the {departmentsPhrase(departments)}, every welfare drive
                and workshop, the blog, the Crftd label and the openings. all documented since 2021.
              </p>
              <div className="dir-hero-stats">
                {IMPACT_STATS.map(s => (
                  <div key={s.label} style={{ display: 'flex', flexDirection: 'column' }}>
                    <b style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 26, lineHeight: 1, color: 'var(--paper)', fontVariantNumeric: 'tabular-nums' }}>{s.n}</b>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'color-mix(in srgb, var(--paper) 50%, transparent)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── "EVERYTHING WE DO" INTRO - departments map + grid (merged in) ── */}
      <WhatWeDoIntro />

      {/* ── FEATURED bento (welfare_projects.featured, desk-curated) — only when
          browsing the default "all" view; shows whenever ≥1 project is featured ── */}
      {!isSearching && category === 'all' && featuredLoading && <FeaturedBandSkeleton />}
      {!isSearching && category === 'all' && !featuredLoading && featuredError && (
        <FeaturedBandShell>
          <ErrorState
            message="couldn't load the featured drives."
            hint={featuredError}
            onRetry={() => setFeaturedReload(n => n + 1)}
          />
        </FeaturedBandShell>
      )}
      {/* Zero featured rows: no shell, no heading, no empty grid - the whole
          band is simply absent. */}
      {!isSearching && category === 'all' && !featuredLoading && !featuredError && featuredCards.length >= 1 && (
        <FeaturedBento
          items={featuredCards}
          total={featuredTotal}
          onViewAll={() => {
            setCategory('welfare')
            // Honors reduced-motion, matching the app's global stance on
            // decorative motion - the jump still happens, just instantly.
            const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
            requestAnimationFrame(() => {
              streamRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
            })
          }}
        />
      )}

      {/* ── THE ARCHIVE (10-projects.md) ──────────────────────────────── */}
      <section ref={streamRef} className="archive-stick" style={{ padding: 'clamp(28px, 4vw, 44px) 0 clamp(48px, 6vw, 72px)', scrollMarginTop: 'calc(var(--nav-h) + 16px)' }}>
        <div className="container">

          {/* Sentinel the IntersectionObserver watches (10.1: "never a scroll
              listener"). Sits just above the search bar; once it scrolls out
              of view past the nav, the bar reveals. Zero-size and
              non-interactive - it exists only as an observation target. */}
          <div ref={searchSentinelRef} className="arch-search-sentinel" aria-hidden />

          <div className={'arch-search' + (searchVisible ? ' is-visible' : '')} aria-hidden={!searchVisible}>
            <MagnifyingGlassIcon width={16} height={16} strokeWidth={2.2} aria-hidden style={{ color: 'var(--ink-3)', flexShrink: 0 }} />
            {/* fontSize 16 is load-bearing: anything smaller makes iOS Safari
                zoom the page on focus. Placeholder reads the live count -
                "never hard-code it" (10.1). */}
            <input
              ref={searchInputRef}
              type="text"
              className="arch-search-input"
              /* "drives", not "posts". changelog/10-projects.md §10.1: the
                 placeholder "states the corpus size so the field explains its
                 scope" - the count was already live and correct, but this is
                 the drives archive and naming the corpus "posts" described a
                 different collection than the one being searched. */
              placeholder={`search ${(totalCount || ORG_FACTS.drivesWrittenUp).toLocaleString()} drives`}
              aria-label="Search posts"
              value={search}
              onChange={e => setSearch(e.target.value)}
              tabIndex={searchVisible ? 0 : -1}
            />
            {activeFilterCount > 0 && (
              <button type="button" className="arch-search-clear" onClick={clearAllFilters} tabIndex={searchVisible ? 0 : -1}>
                {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} · clear
              </button>
            )}
            <button type="button" className="arch-search-go" aria-label="Search" title="Search" tabIndex={searchVisible ? 0 : -1} onClick={() => searchInputRef.current?.focus()}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--paper)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12h13M13 7l5 5-5 5" /></svg>
            </button>
          </div>

          <div className="arch-grid arch-grid--no-rail">

            <div>
              {/* Mobile/tablet rail: below 900px this IS the rail (10.1), not
                  a lesser version of it. */}
              <div className="arch-rail-mobile">
                <div className="arch-rail-mobile-scroll">
                  {CATEGORIES.map(c => (
                    <button key={c.key} className={'chip' + (category === c.key ? ' chip-active' : '')}
                      onClick={() => setCategory(c.key)} style={{ flexShrink: 0 }}>
                      {c.label}
                    </button>
                  ))}
                  <button className={'chip' + (statOnly ? ' chip-active' : '')} onClick={() => setStatOnly(v => !v)} style={{ flexShrink: 0 }}>
                    with a statistic
                  </button>
                </div>
              </div>

              {/* Toolbar: title · count pill · contributor cluster · sort pill */}
              <div className="arch-toolbar">
                <span className="arch-toolbar-title">
                  {isSearching ? 'Search results' : statOnly ? 'The ones with numbers' : category === 'all' ? 'Everything, newest first' : `${CATEGORIES.find(c => c.key === category)?.label}, newest first`}
                </span>
                <span className="arch-count-pill">{loading ? '…' : totalCount.toLocaleString()}</span>
                <span className="arch-toolbar-spacer" />
                {contributorNames.length > 0 && (
                  <div className="arch-avatars" aria-hidden="true">
                    {contributorNames.slice(0, 3).map(name => (
                      <span key={name} className="arch-avatar" style={{ background: hashColor(name) }}>{getInitials(name)}</span>
                    ))}
                    {contributorNames.length > 3 && (
                      <span className="arch-avatar arch-avatar--more">+{contributorNames.length - 3}</span>
                    )}
                  </div>
                )}
                <span className="arch-sort-pill">
                  newest
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="3.4" strokeLinecap="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
                </span>
                <button type="button" className="arch-search-skip" onClick={jumpToSearch} aria-label="Jump to search" title="Jump to search">
                  <MagnifyingGlassIcon width={16} height={16} strokeWidth={2.2} aria-hidden />
                </button>
              </div>

              {loading ? (
                <div className="arch-skel-cols">
                  {/* Real tile heights, not a uniform grid (states/06.7): three
                      rough bands so nothing reflows into masonry once data lands. */}
                  {[280, 160, 340, 200, 260, 180].map((h, i) => (
                    <div key={i} className="arch-skel" style={{ height: h, animationDelay: `${i * 0.08}s` }} />
                  ))}
                </div>
              ) : fetchError ? (
                <div style={{ margin: '20px 0 40px' }}>
                  <ErrorState
                    message="couldn't load posts."
                    hint={fetchError}
                    variant="block"
                    onRetry={() => { setFetchError(null); setLoading(true); setPage(0); fetchPage(0, true).catch(e => { console.error('[PublicProjectsPage] retry failed:', e); setFetchError('Failed to load posts') }).finally(() => setLoading(false)) }}
                  />
                </div>
              ) : cards.length === 0 ? (
                <EmptyState
                  title={isSearching ? 'no posts match your search.' : 'nothing here yet.'}
                  hint={
                    isSearching
                      ? 'try a different keyword or clear the filters.'
                      : activeFilterCount > 0
                        ? <span className="arch-empty-filter">{category !== 'all' ? CATEGORIES.find(c => c.key === category)?.label : ''}{category !== 'all' && statOnly ? ' · ' : ''}{statOnly ? 'with a statistic' : ''}</span>
                        : undefined
                  }
                  action={activeFilterCount > 0 ? <button className="btn btn-primary" onClick={clearAllFilters}>clear filters</button> : undefined}
                />
              ) : (
                <>
                  <div className={'arch-masonry' + (isSearching ? ' is-search' : '')}>
                    {cards.filter(c => pickTileShape(c) !== null).map((c, i) => (
                      <Reveal key={c.uuid} delay={(i % 4) * 0.05}>
                        {/* loading="lazy" on every tile but the first three - at
                            2,000+ rows this route matters more than anywhere
                            else in the product for it (10.1). */}
                        <PostStreamCard {...c} eager={i < 3} />
                      </Reveal>
                    ))}
                  </div>
                  {hasMore && !isSearching && (
                    <div ref={sentinelCallbackRef} style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 20, height: 20, border: '2px solid var(--line-2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'aqSpin 0.7s linear infinite' }} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
