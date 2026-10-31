import { useState, useEffect, useRef, useMemo, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import searchService, { SearchResults } from '../services/searchService'
import feedService from '../services/feedService'
import { Post } from '../services/api'
import { I } from '../components/v6Shared'
import Sticker from '../components/Sticker'
import Sheet, { useSheetPageStyle, type SheetDetent } from '../components/Sheet'
import Img from '../components/Img'
import { useIsMobile } from '../hooks/useMobile'
import { useEmptyJoke } from '../lib/emptyJokes'
import { useMeta } from '../hooks/useMeta'
import { pageMetadata } from '../lib/metaConfig'
import { getInitials, CAT_COLORS, timeAgo } from '../lib/uiHelpers'
import Skeleton from '../components/Skeleton'
import { CATEGORY_SLUGS, type CategorySlug } from '../lib/categories'
import SearchResultCard, { KIND_GLYPH, type ResultKind, type ResultMedia } from './SearchResultCard'
import { getCategoryIcon } from '../feed/post/categoryIcons'
import './SearchPage.css'

// redesign 08.0/08.1/08.2/08.3 - see changelog/08-search-saved-notifications.md.
// The N+1 08.0 names (SearchPage:259) is already gone: results come from one
// batched searchService.search() Promise.all, and per-card saved/opening
// state comes from one useFeedCardBatch() call, not a per-card fetch. That
// part of the file was already fixed before this pass touched it.

const EMPTY_RESULTS: SearchResults = { people: [], projects: [], teams: [], schools: [], classes: [], posts: [], openings: [] }

// UI "kind" -> searchService's own `type` vocabulary. Kept distinct because
// the page uses the changelog's words (drives/openings) while the service
// predates this file and calls the same things projects/people.
const KIND_TO_SVC: Record<string, string> = {
  all: 'all', drives: 'projects', posts: 'posts', members: 'people',
  teams: 'teams', openings: 'openings', schools: 'schools', classes: 'classes',
}
// Five from the design + two the live schema still searches (schools,
// classes) that 08.2's "five kinds" enumeration doesn't mention. Dropping
// them would delete working functionality no instruction asked to remove -
// kept at the end of the row rather than silently removed. See report.
const KIND_CHIPS: Array<[string, string]> = [
  ['all', 'all'], ['drives', 'drives'], ['posts', 'posts'], ['members', 'members'],
  ['teams', 'teams'], ['openings', 'openings'], ['schools', 'schools'], ['classes', 'classes'],
]
const WHEN_CHIPS: Array<[string, string]> = [['anytime', 'anytime'], ['year', 'this year'], ['month', 'this month']]
// Same labels PostStreamCard.tsx uses for the same five categories - kept as
// its own small local copy rather than exported/shared, matching how that
// file's own version is scoped.
const CAT_LABELS: Record<string, string> = {
  events: 'Events', welfare: 'Welfare', content: 'Content', operations: 'Operations', labs: 'Labs',
}
// StickerHue spells the operations category "ops"; CATEGORY_SLUGS spells it
// "operations" (the live posts.category/director_categories value). One map,
// here, rather than a silent mismatch at the Sticker call site.
const CATEGORY_TO_STICKER_HUE: Record<CategorySlug, 'welfare' | 'events' | 'content' | 'ops' | 'labs'> = {
  welfare: 'welfare', events: 'events', content: 'content', operations: 'ops', labs: 'labs',
}

type ResultItem = {
  key: string
  kind: ResultKind
  href: string
  context: string
  title: string
  media: ResultMedia
  category?: string | null
}

/* A discover row's tile - photo-first, a caption underneath, no engagement
   chrome. Real post, real photo (when the post has one; most trending rows
   do - see feedShape.ts's own C02 data note), real category hue. A post
   with no image falls back to a quiet quote-card treatment rather than a
   blank or stretched box, so the row still reads as intentional. */
function DiscoverTile({ post, hue }: { post: Post; hue: string }) {
  const photo = post.images?.[0]?.blobUrl
  const snippet = post.body && post.body.length > 60 ? `${post.body.slice(0, 60)}…` : post.body
  return (
    <Link
      to={`/post/${post.uuid}`}
      style={{ flex: '0 0 200px', display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none', color: 'var(--ink)' }}
    >
      {photo ? (
        <Img
          src={photo}
          ctx="card"
          alt=""
          style={{ width: 200, height: 220, objectFit: 'cover', borderRadius: 'var(--r-inner)', display: 'block' }}
        />
      ) : (
        <div style={{
          width: 200, height: 180, borderRadius: 'var(--r-inner)', background: '#FFFDF2',
          border: '1px solid rgba(10,10,10,.1)', borderLeft: `3px solid ${hue}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px 18px', boxSizing: 'border-box',
        }}>
          <span className="h-display" style={{ fontSize: 13, lineHeight: 1.4, textAlign: 'center', color: 'var(--ink)' }}>
            &ldquo;{snippet}&rdquo;
          </span>
        </div>
      )}
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, lineHeight: 1.35 }}>
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: hue, flexShrink: 0 }} />
        {photo && snippet ? snippet : post.authorName}
      </span>
    </Link>
  )
}

export default function SearchPage() {
  useMeta(pageMetadata.search)
  const emptyLine = useEmptyJoke('search', 'we looked everywhere. nothing here matches it.')
  const [searchParams, setSearchParams] = useSearchParams()
  const { member } = useAuth()
  const isMobile = useIsMobile(1024)

  const [q, setQ] = useState(() => searchParams.get('q') || '')
  const [kind, setKind] = useState(() => searchParams.get('kind') || 'all')
  const [category, setCategory] = useState<string | null>(() => searchParams.get('category') || null)
  const [when, setWhen] = useState(() => searchParams.get('when') || 'anytime')

  const [results, setResults] = useState<SearchResults>(EMPTY_RESULTS)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [sheetDetent, setSheetDetent] = useState<SheetDetent>('peek')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const filtersBtnRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [trending, setTrending] = useState<Post[]>([])
  const [trendingLoading, setTrendingLoading] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  const hasQuery = Boolean(q)
  const hasFacet = Boolean(category) || when !== 'anytime'
  const isBrowsingOrSearching = hasQuery || hasFacet
  const filtersActive = kind !== 'all' || Boolean(category) || when !== 'anytime'

  // Trending this week - shown only on the pure browse screen (no query, no
  // facet), same one query as before this pass, just relocated under the discs.
  // 2026-09-09: widened from limit 4 to 24 so the single flat rail can split
  // into real per-category rows below (see `trendingByCategory`) - one fetch,
  // grouped client-side, rather than one query per category.
  useEffect(() => {
    let cancelled = false
    setTrendingLoading(true)
    feedService.getTrending({ limit: 24, days: 7 })
      .then(r => { if (!cancelled && r.success) setTrending(r.data.filter(p => (p.likeCount ?? 0) > 0)) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setTrendingLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Split the one trending fetch into real per-category rows - a category
  // with zero trending posts this week gets no row at all (never a fake
  // empty one). Capped at 6 per row so a single hot category can't crowd
  // the rest off a phone screen; order follows CATEGORY_SLUGS, not volume,
  // so the row order is stable across reloads instead of reshuffling with
  // the like counts.
  const trendingByCategory = useMemo(() => {
    const groups: { category: CategorySlug; label: string; posts: Post[] }[] = []
    for (const slug of CATEGORY_SLUGS) {
      const posts = trending.filter(p => p.category === slug).slice(0, 6)
      if (posts.length > 0) groups.push({ category: slug, label: CAT_LABELS[slug] || slug, posts })
    }
    return groups
  }, [trending])
  useEffect(() => {
    const params: Record<string, string> = {}
    if (q) params.q = q
    if (kind !== 'all') params.kind = kind
    if (category) params.category = category
    if (when !== 'anytime') params.when = when
    setSearchParams(params, { replace: true })
  }, [q, kind, category, when, setSearchParams])

  useEffect(() => {
    if (!isBrowsingOrSearching) {
      setResults(EMPTY_RESULTS); setTotalCount(0); setLoading(false); setError(null)
      return
    }
    if (debounce.current) clearTimeout(debounce.current)
    setLoading(true)
    setError(null)
    // `cancelled` guards the case the plain clearTimeout below cannot: once
    // the 250ms timer has already fired and searchService.search() is in
    // flight, changing kind/category/when again cancels nothing, and a
    // slower older response could resolve after a newer one and overwrite
    // results with stale data. Same pattern the trending fetch above
    // already uses - this effect had drifted from it.
    let cancelled = false
    // 08.0: keep the debounce, tightened to 250ms per this file's own
    // instruction ("if there is none, add 250ms - it is a performance fix").
    debounce.current = setTimeout(async () => {
      try {
        const svcType = KIND_TO_SVC[kind] ?? 'all'
        const res = await searchService.search(q, svcType, 20, { category: category ?? undefined, when: when as any })
        if (cancelled) return
        setResults(res.data.results)
        setTotalCount(res.data.totalCount)
        if (res.errors?.length) {
          setError(`some results couldn't load (${res.errors.length === 1 ? res.errors[0].split(':')[0] : `${res.errors.length} sections`}). try again in a moment.`)
        }
      } catch (e: any) {
        console.error('[SearchPage] search failed:', e)
        if (!cancelled) setError('Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 250)
    return () => { cancelled = true; if (debounce.current) clearTimeout(debounce.current) }
  }, [q, kind, category, when, isBrowsingOrSearching, retryTick])

  // Close the desktop popover on outside click / Escape, return focus to its trigger.
  useEffect(() => {
    if (!popoverOpen) return
    const onDown = (e: MouseEvent) => {
      if (popoverRef.current?.contains(e.target as Node) || filtersBtnRef.current?.contains(e.target as Node)) return
      setPopoverOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setPopoverOpen(false); filtersBtnRef.current?.focus() } }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [popoverOpen])

  const items: ResultItem[] = useMemo(() => {
    const out: ResultItem[] = []
    for (const p of results.projects) {
      out.push({
        key: `drive-${p.uuid}`, kind: 'drive', href: `/projects/${p.uuid}`,
        context: p.category, title: p.title,
        media: p.coverImageUrl ? { type: 'photo', src: p.coverImageUrl, alt: '' } : { type: 'glyph', glyph: KIND_GLYPH.drive },
      })
    }
    for (const p of results.posts) {
      const photo = (p.images || [])[0]
      const src = photo?.url || photo?.blobUrl
      out.push({
        key: `post-${p.uuid}`, kind: 'post', href: `/post/${p.uuid}`,
        context: `${p.authorName} · ${timeAgo(p.createdAt)}`, title: p.body,
        media: src ? { type: 'photo', src, alt: '' } : { type: 'glyph', glyph: KIND_GLYPH.post },
        category: p.category,
      })
    }
    for (const m of results.people) {
      const uuid = m.uuid
      const path = member?.uuid === uuid ? `/profile/${uuid}` : `/member/${uuid}`
      out.push({
        key: `member-${uuid}`, kind: 'member', href: path,
        context: m.classGrade || m.role || 'member', title: m.fullName,
        media: { type: 'avatar', src: m.avatarUrl, alt: '', initials: getInitials(m.fullName) },
      })
    }
    for (const t of results.teams) {
      out.push({
        key: `team-${t.uuid}`, kind: 'team', href: `/teams/${t.uuid}`,
        context: t.category, title: t.name,
        media: t.logoUrl ? { type: 'photo', src: t.logoUrl, alt: '' } : { type: 'glyph', glyph: KIND_GLYPH.team },
        category: t.category,
      })
    }
    for (const o of results.openings) {
      out.push({
        key: `opening-${o.id}`, kind: 'opening', href: `/opportunities/${o.id}`,
        context: o.teamName || o.category || 'open role', title: o.title,
        media: { type: 'glyph', glyph: KIND_GLYPH.opening },
      })
    }
    for (const s of results.schools) {
      out.push({
        key: `school-${s.uuid}`, kind: 'school', href: `/search?q=${encodeURIComponent(s.name)}&kind=members`,
        context: s.location || 'school', title: s.name,
        media: s.logoUrl ? { type: 'photo', src: s.logoUrl, alt: '' } : { type: 'glyph', glyph: null, initials: getInitials(s.name) },
      })
    }
    for (const c of results.classes) {
      out.push({
        key: `class-${c.uuid}`, kind: 'class', href: `/search?q=${encodeURIComponent(c.name)}&kind=members`,
        context: `${c.memberCount} member${c.memberCount !== 1 ? 's' : ''}`, title: c.name,
        media: { type: 'glyph', glyph: KIND_GLYPH.class },
      })
    }
    return out
  }, [results, member?.uuid])

  const filterSummary = useMemo(() => {
    const parts: string[] = []
    if (category) parts.push(category)
    if (kind !== 'all') parts.push(kind)
    if (when !== 'anytime') parts.push(when === 'year' ? 'this year' : 'this month')
    return parts.join(' · ')
  }, [category, kind, when])

  const activeFacetCount = (kind !== 'all' ? 1 : 0) + (category ? 1 : 0) + (when !== 'anytime' ? 1 : 0)
  const filtersPillLabel = activeFacetCount > 0 ? `${activeFacetCount} filter${activeFacetCount !== 1 ? 's' : ''}` : 'Filters'

  const clearFilters = () => { setKind('all'); setCategory(null); setWhen('anytime') }
  const clearAll = () => { setQ(''); clearFilters() }

  const sheetActive = isMobile && isBrowsingOrSearching
  const pageStyle = useSheetPageStyle(sheetDetent, sheetActive)

  const selectCategory = (slug: CategorySlug) => setCategory(prev => (prev === slug ? null : slug))

  const filterGroups: ReactNode = (
    <>
      <div className="aqs-popover-group">
        <span className="aqs-popover-label">kind</span>
        <div className="aqs-popover-chips">
          {KIND_CHIPS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={kind === k} className={'chip ' + (kind === k ? 'chip-active' : '')} onClick={() => setKind(k)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="aqs-popover-group">
        <span className="aqs-popover-label">category</span>
        <div className="aqs-popover-chips">
          <button type="button" aria-pressed={!category} className={'chip ' + (!category ? 'chip-active' : '')} onClick={() => setCategory(null)}>any</button>
          {CATEGORY_SLUGS.map(slug => (
            <button key={slug} type="button" aria-pressed={category === slug} className={'chip ' + (category === slug ? 'chip-active' : '')} onClick={() => setCategory(slug)}>
              {slug}
            </button>
          ))}
        </div>
      </div>
      <div className="aqs-popover-group">
        <span className="aqs-popover-label">when</span>
        <div className="aqs-popover-chips">
          {WHEN_CHIPS.map(([w, label]) => (
            <button key={w} type="button" aria-pressed={when === w} className={'chip ' + (when === w ? 'chip-active' : '')} onClick={() => setWhen(w)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-sm" onClick={clearFilters}>Reset</button>
      </div>
    </>
  )

  // The wrapper below deliberately does NOT carry `route-enter`. Search is
  // reachable by ⌘K / Ctrl+K (App.tsx), which is the one navigation in this app
  // a person repeats dozens of times a day — and animation on a
  // keyboard-initiated action reads as lag, not polish. Every other route keeps
  // its 220ms entrance; this one opens instantly, the way a palette should.
  return (
    <div className="aqs-scale-wrap" style={pageStyle}>
      <div className="aqs-hero">
        <h1 className="aqs-headline">find a <em>drive,</em> a person, a post.</h1>
        <p className="aqs-sub muted" style={{ color: 'rgba(244,239,224,0.55)' }}>posts, members, and teams, all in one place.</p>

        <form className="aqs-field" onSubmit={e => e.preventDefault()}>
          <span className="aqs-field-icon" aria-hidden>{I.search()}</span>
          <input
            id="aq-search"
            autoFocus
            placeholder="sundarbans, riya, benches…"
            value={q}
            onChange={e => setQ(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Search AquaTerra"
          />
          {q && (
            <button type="button" className="aqs-field-clear" onClick={() => setQ('')} aria-label="Clear search">
              clear
            </button>
          )}
          <button type="submit" className="aqs-field-submit" aria-label="Search" title="Search">
            {I.search()}
          </button>
        </form>

        {/* Discs are the browse surface whenever there is no typed query -
            "the default state, not an empty state" (08.1) - and stay up even
            once a category is selected (only the selected one gains a
            count). Typing a query moves to full search mode and hides them. */}
        {!hasQuery && (
          <div className="aqs-discs">
            {CATEGORY_SLUGS.map(slug => {
              const selected = category === slug
              const Icon = getCategoryIcon(slug)
              return (
                <div key={slug} className="aqs-disc-wrap" data-selected={selected}>
                  <button
                    type="button"
                    className="aqs-disc"
                    style={{ background: CAT_COLORS[slug] }}
                    aria-pressed={selected}
                    onClick={() => selectCategory(slug)}
                  >
                    {/* A flat colour fill with nothing on it read as an
                        unstyled placeholder ("solids look bad" - the
                        redesign feedback this responds to). A glyph gives
                        each disc an actual identity beyond its hue - same
                        icon set the composer/post-detail category badges
                        already use, so this isn't a new visual language. */}
                    <Icon className="aqs-disc-icon" aria-hidden />
                    <span className="sr-only">Browse {slug}</span>
                  </button>
                  {/* Never a decorative 0 (08 Verification 10): an empty
                      category paints no starburst at all rather than one
                      reading "0". */}
                  {selected && totalCount > 0 && (
                    <span className="aqs-disc-sticker">
                      <Sticker shape="burst12" hue={CATEGORY_TO_STICKER_HUE[slug]} rotate={-10} size={72} numeral={{ value: String(totalCount) }} />
                    </span>
                  )}
                  <button type="button" className="aqs-disc-label" onClick={() => selectCategory(slug)} aria-pressed={selected}>
                    {slug}
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {isBrowsingOrSearching && (
          <div className="aqs-summary">
            <span className="aqs-count" aria-live="polite" aria-atomic="true">
              {totalCount} result{totalCount !== 1 ? 's' : ''}{loading ? '…' : ''}
            </span>
            {!isMobile && (
              <div className="aqs-desktop-only" style={{ position: 'relative' }}>
                <button
                  ref={filtersBtnRef}
                  type="button"
                  className="aqs-filters-pill"
                  aria-haspopup="true"
                  aria-expanded={popoverOpen}
                  onClick={() => setPopoverOpen(o => !o)}
                >
                  {filtersPillLabel}
                </button>
                {popoverOpen && (
                  <div className="aqs-popover" ref={popoverRef}>
                    {filterGroups}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="aqs-results">
        <div className="aqs-list">
          {loading ? (
            // Three result-card skeletons at the real geometry (08's States
            // section: "not a spinner"), one hand-assembled aria-busy group
            // per Skeleton.tsx's documented composite pattern.
            <div role="status" aria-busy="true">
              <span className="sr-only">Loading results…</span>
              {[0, 1, 2].map(i => (
                <div key={i} className="src-card-skel" style={{ marginBottom: i < 2 ? 14 : 0 }} aria-hidden="true">
                  <Skeleton variant="block" width={96} height={72} radius="var(--r-inner)" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Skeleton variant="line" width="40%" height={10} />
                    <Skeleton variant="line" width="80%" height={16} />
                  </div>
                  <Skeleton variant="pill" width={76} height={44} />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="aqs-well" role="alert">
              <div className="aqs-well-title">that didn't load.</div>
              <p className="aqs-well-hint">{error}</p>
              <div className="aqs-well-actions">
                <button className="aqs-well-btn" onClick={() => setRetryTick(t => t + 1)}>try again</button>
              </div>
            </div>
          ) : items.length === 0 && isBrowsingOrSearching ? (
            <div className="aqs-well">
              <div className="aqs-well-title">{q ? `nothing under "${q}".` : 'nothing here yet.'}</div>
              <p className="aqs-well-hint">{emptyLine}</p>
              <div className="aqs-well-actions">
                {filtersActive && <button className="aqs-well-btn" onClick={clearFilters}>clear filters</button>}
                <button className="aqs-well-btn" onClick={clearAll}>browse the discs</button>
              </div>
            </div>
          ) : (
            items.map(item => (
              <SearchResultCard key={item.key} kind={item.kind} href={item.href} context={item.context} title={item.title} media={item.media} category={item.category} />
            ))
          )}
        </div>

        {/* Discover rows - one real horizontal strip per category with
            trending posts this week, instead of one flat "trending" grid.
            A category with nothing trending gets no row (never a fake empty
            one) - trendingByCategory already drops empties, so mapping it
            directly is the whole "does this category get a row" decision. */}
        {!isBrowsingOrSearching && (trendingLoading || trendingByCategory.length > 0) && (
          <div style={{ maxWidth: 1080, margin: 'clamp(36px, 8vw, 56px) auto 0', display: 'flex', flexDirection: 'column', gap: 'clamp(28px, 5vw, 40px)' }}>
            {trendingLoading ? (
              <div>
                <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 16 }}>★ trending this week</div>
                {/* Same overflow model as the loaded row below, not `hidden`.
                    A skeleton exists to reserve the exact shape the real thing
                    will occupy; with `overflowX: hidden` on a 390px phone the
                    four 220px placeholders were clipped mid-card at the right
                    edge, so the loading state advertised a narrower row than
                    the one that replaced it and the layout jumped on arrival.
                    `paddingBottom` matches too, or the row grows 8px taller the
                    moment the data lands. Audit 2026-09-17, responsiveness P3. */}
                <div style={{ display: 'flex', gap: 16, overflowX: 'auto', overscrollBehaviorX: 'contain', paddingBottom: 8 }}>
                  {[1, 2, 3, 4].map(i => <div key={i} className="v6-skeleton" style={{ flex: '0 0 220px', height: 240, borderRadius: 'var(--r-inner)', animationDelay: `${i * 0.08}s` }} />)}
                </div>
              </div>
            ) : (
              trendingByCategory.map(group => (
                <div key={group.category}>
                  <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 16 }}>
                    ★ trending in {group.label.toLowerCase()}
                  </div>
                  {/* REDESIGN 2026-09-09: was a strip of full FeedPostCards
                      (engagement chrome, 320px) - reads nothing like the
                      reference's clean image-forward discover row. Real data
                      untouched (still trendingByCategory's real per-week
                      trending posts, grouped and RLS-scoped exactly as
                      before); only the tile changed, to a photo-first card
                      with a caption, no like/save/comment buttons - a lighter
                      surface, deliberately, matching what a discover row is
                      FOR (browsing into a post, not acting on it in place).
                      Scrolls, never clips (audit-design.sh rule 18);
                      overscroll contained (rule 19). */}
                  <div style={{ display: 'flex', gap: 16, overflowX: 'auto', overscrollBehaviorX: 'contain', paddingBottom: 8 }}>
                    {group.posts.map(p => (
                      <DiscoverTile key={p.postId} post={p} hue={CAT_COLORS[group.category]} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {sheetActive && (
        <Sheet
          detent={sheetDetent}
          onDetentChange={setSheetDetent}
          ariaLabel="Filters"
          returnFocusRef={filtersBtnRef}
          peek={
            <>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', fontVariantNumeric: 'tabular-nums' }}>
                {totalCount} result{totalCount !== 1 ? 's' : ''}{loading ? '…' : ''}
              </div>
              {filterSummary && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'rgba(244,239,224,0.6)', marginTop: 4, textTransform: 'uppercase' }}>
                  {filterSummary}
                </div>
              )}
            </>
          }
          footer={
            <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={() => setSheetDetent('peek')}>
              {loading ? 'Show results' : `Show ${totalCount} result${totalCount !== 1 ? 's' : ''}`}
            </button>
          }
        >
          {filterGroups}
        </Sheet>
      )}
    </div>
  )
}
