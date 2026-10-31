import Img from '../components/Img'
import './PublicProjectDetailPage.css'
import '../styles/routes/projects.css'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { supabase, normalizeObj, OBJ_CAT_MAP, WelfareProject } from '../lib/supabase'
import { CAT_COLORS } from '../lib/jobOpenings'
import { useAuth } from '../auth/AuthContext'
import { hasLeaderAccess } from '../lib/roles'
import CarouselStudioModal from '../components/CarouselStudioModal'
import type { CarouselProject } from '../components/carouselGenerator'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, PUBLISHER_LD } from '../hooks/useJsonLd'
import Breadcrumbs from '../components/Breadcrumbs'
import { setAuthIntent } from '../lib/authIntent'
import { sized } from '../lib/imageUrl'
import { pushRecent } from '../lib/recentlyViewed'
import { Sticker } from '../components/Sticker'
import { heroStickerWord } from './heroStickerWord'
import type { StickerHue } from '../lib/stickerShapes'
import { ORG_FACTS, displayCount } from '../lib/orgFacts'
import { withRetry } from '../lib/asyncUtils'
import { Reveal } from '../components/Reveal'

// Cleared cumulative-impact fact, sourced from ORG_FACTS rather than retyped
// (changelog/21-org-facts.md §21.0/§21.4). Value unchanged.
const SAPLINGS = displayCount(ORG_FACTS.saplingsPlanted)

// changelog/10-projects.md's 5-value category vocabulary names one hue
// "ops"; lib/categories.ts / the live `posts.category` check constraint
// (and this page's own OBJ_CAT_MAP below) spell the same value "operations".
// One map, so a typo here can't silently fall through Sticker's dev-mode hue
// lookup.
const CATEGORY_TO_STICKER_HUE: Record<string, StickerHue> = {
  events: 'events', welfare: 'welfare', content: 'content', operations: 'ops', labs: 'labs',
}

// A single quiet line, specific to the kind of drive, bridging "you just read
// what we did" → "here's how people become part of it". Not a CTA.
const OBJECTIVE_BRIDGE: Record<string, string> = {
  'Workshop': 'ShikshAQ and Welfare Projects run workshops like this year-round →',
  'Feeding Dogs': 'This happens regularly. the team is still small →',
  'Plantation Drive': `${SAPLINGS} saplings planted. most by students who joined the way you might →`,
  'Distribution Drive': 'Everything here was organised by students, from Kolkata →',
  'Sundarbans Relief': `AquaTerra has made ${ORG_FACTS.sundarbansTrips} trips to the Sundarbans →`,
  'Old Age Home Visit': 'These visits happen across Kolkata, run by students →',
  'Fundraising Event': 'Events like this fund everything else AquaTerra does →',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
}

// Meta descriptions are pulled from free-text record fields, so a raw
// `.slice(0, N)` chops mid-word and reads like a truncated CMS field. Collapse
// whitespace, then cut back to the last word boundary and add an ellipsis so a
// real project/blog description ends cleanly.
function metaTrim(s: string, max = 158) {
  const clean = (s || '').replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…'
}

type RelatedProject = Pick<WelfareProject, 'slug' | 'header' | 'main_image' | 'main_image_alt' | 'objective' | 'location' | 'volunteers' | 'key_statistic'>

// The related grid reads sparse at 4 (barely a row) - 8 fills two full rows on
// desktop and still wraps cleanly on mobile via the auto-fill grid.
const RELATED_TARGET = 8
// Must match the grid's `minmax(RELATED_GRID_MIN_COL,1fr)` + gap below -
// used to recompute the actual column count from the container width.
const RELATED_GRID_MIN_COL = 240
const RELATED_GRID_GAP = 16

export default function PublicProjectDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { member } = useAuth()
  // Audit pass, 2026-09-06: was a hand-rolled
  // `['hod','director','super_admin'].includes(...)` - lib/roles.ts's own
  // header and CLAUDE.md's role-model section both say never do this, and it
  // silently omitted 'hr' (equal in power to super_admin by the 2026-09-03
  // decision), while the equivalent "generate graphic" button on a blog post
  // (BlogPostPage.tsx) already correctly calls hasLeaderAccess() and grants
  // it to hr. Same tier of feature, was inconsistent access for no reason
  // traceable to anything but skipping the shared helper.
  const canMakeCarousel = hasLeaderAccess(member?.role)
  const [showCarousel, setShowCarousel] = useState(false)
  const [project, setProject] = useState<WelfareProject | null>(null)
  const [related, setRelated] = useState<RelatedProject[]>([])
  // The grid renders `repeat(auto-fill, minmax(RELATED_MIN_COL,1fr))`, so the
  // number of columns varies with viewport width. If `related.length` isn't a
  // multiple of that column count, the last row is left-aligned with a gap
  // hanging off the end. Measure the actual rendered column count and trim
  // the list to a full-row multiple so every row is evenly filled.
  const relatedGridRef = useRef<HTMLDivElement>(null)
  const [relatedCols, setRelatedCols] = useState(1)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  /** The read FAILED, as opposed to the project not existing. */
  const [loadError, setLoadError] = useState(false)
  const [activeImg, setActiveImg] = useState(0)
  // Autoplay was ungated: a member who asked the OS for no motion still got the
  // photos swapping under them. The pause control already existed; it now just
  // starts on the other side.
  const [isPlaying, setIsPlaying] = useState(
    () => !(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  )
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAutoplay = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }, [])

  const resetAutoplay = useCallback((total: number) => {
    clearAutoplay()
    if (total <= 1) return
    intervalRef.current = setInterval(() => {
      setActiveImg(i => (i + 1) % total)
    }, 3800)
  }, [clearAutoplay])

  const goTo = useCallback((idx: number, total: number) => {
    setActiveImg(idx)
    resetAutoplay(total)
  }, [resetAutoplay])

  // Start autoplay once images are known
  useEffect(() => {
    if (!project) return
    const imgs = [
      project.main_image,
      project.image_1, project.image_2, project.image_3, project.image_4,
    ].filter(Boolean)
    if (imgs.length > 1 && isPlaying) resetAutoplay(imgs.length)
    return clearAutoplay
  }, [project, isPlaying, resetAutoplay, clearAutoplay])

  useEffect(() => {
    if (!slug) return
    let cancelled = false
    // Retried: a cold session load can stall acquiring supabase-js's auth
    // navigator lock (worse with several AquaTerra tabs open at once, each
    // racing to refresh the same token) rather than throw outright, and a
    // single un-retried attempt turned that transient stall straight into
    // "couldn't load this project" with nothing to distinguish it from a
    // real outage. See lib/asyncUtils.ts's withRetry for why a timeout race
    // is needed here rather than a plain try/catch retry.
    withRetry<{ data: any; error: any }>(() => supabase
      .from('welfare_projects')
      .select('*')
      .eq('slug', slug)
      .eq('is_draft', false)
      .single() as any)
      .then(({ data, error }) => {
        if (cancelled) return
        // PGRST116 is PostgREST's "no rows" from .single() - a genuine 404.
        // Everything else (a 5xx, a timeout, an RLS denial, a schema change)
        // is a FAILURE TO LOAD, and this public, SEO-reachable route used to
        // tell a visitor the project does not exist for all of them, with no
        // retry and no way to tell an outage from a dead link.
        if (error && error.code !== 'PGRST116') { setLoadError(true); setLoading(false); return }
        if (error || !data) { setNotFound(true); setLoading(false); return }
        setProject(data)
        setLoading(false)

        pushRecent({
          kind: 'project',
          id: data.slug,
          title: data.header || 'Project',
          subtitle: data.location || (data.objective ? normalizeObj(data.objective) : undefined),
          image: data.main_image || undefined,
          href: `/projects/${data.slug}`,
        })

        const cols = 'slug,header,main_image,main_image_alt,objective,location,volunteers,key_statistic'
        const objective = (data.objective || '').trim()

        // Stage 1 - same objective, case-insensitive. The source data has real
        // casing drift ("Workshop" vs "workshop"), which an exact `eq` match
        // silently split into near-empty buckets - most projects only ever saw
        // a handful of "similar" cards even when dozens of true matches existed.
        const stage1 = objective
          ? supabase.from('welfare_projects').select(cols).eq('is_draft', false)
              .ilike('objective', objective).neq('slug', slug)
              .order('workshop_date', { ascending: false }).limit(RELATED_TARGET)
          : Promise.resolve({ data: [] as RelatedProject[] })

        stage1.then(({ data: rel }) => {
          if (cancelled) return
          const primary = rel ?? []
          if (primary.length >= RELATED_TARGET) { setRelated(primary); return }

          // Stage 2 - backfill. The exact-theme pool alone was too thin to fill
          // a satisfying grid, so top it up with other recent projects rather
          // than leave the section showing just one or two cards.
          const seen = new Set([slug, ...primary.map(p => p.slug)])
          supabase
            .from('welfare_projects')
            .select(cols)
            .eq('is_draft', false)
            .order('workshop_date', { ascending: false })
            .limit(RELATED_TARGET + primary.length + 12)
            .then(({ data: more }) => {
              if (cancelled) return
              const backfill = (more ?? []).filter(p => !seen.has(p.slug)).slice(0, RELATED_TARGET - primary.length)
              setRelated([...primary, ...backfill])
            })
        })
      })
      .catch(() => {
        // withRetry exhausted its retries and threw (a genuine timeout/
        // network failure, not a resolved {error} from Supabase) - the
        // .then above never runs for that case, so this is the only path
        // left to clear the loading state and show the retry screen.
        if (!cancelled) { setLoadError(true); setLoading(false) }
      })
    return () => { cancelled = true }
  }, [slug])

  // Track the related-grid's actual column count so the card list can be
  // trimmed to a full-row multiple (see relatedCols declaration above).
  useEffect(() => {
    const el = relatedGridRef.current
    if (!el || related.length === 0) return
    const compute = () => {
      const width = el.offsetWidth
      const cols = Math.max(1, Math.floor((width + RELATED_GRID_GAP) / (RELATED_GRID_MIN_COL + RELATED_GRID_GAP)))
      setRelatedCols(cols)
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [related.length])

  // Full rows only. If there aren't even enough cards for one row, show the
  // partial single row as-is rather than hiding everything.
  const evenedRelated = useMemo(() => {
    if (related.length <= relatedCols) return related
    const full = Math.floor(related.length / relatedCols) * relatedCols
    return related.slice(0, full)
  }, [related, relatedCols])

  // Per-route SEO - unique title/description/social image from the loaded project.
  // Loading fallbacks are real copy, not the `{projectName}` templates from
  // metaConfig - those used to be emitted verbatim before the record arrived.
  useMeta({
    title: project ? `${project.header} | AquaTerra Welfare Project` : 'Welfare Project | AquaTerra',
    description: project
      ? metaTrim(
          project.short_summary
          || `${project.header}, a student-led AquaTerra welfare drive${project.location ? ` in ${project.location}` : ' in Kolkata'}, run by the members who showed up.`
        )
      : 'A student-led welfare drive run by AquaTerra members in Kolkata.',
    image: project?.main_image || '',
    imageAlt: project?.header ? `${project.header} - AquaTerra welfare project` : undefined,
    type: 'article',
  })

  // Article + breadcrumb structured data for each welfare-project page.
  const projCanonical = `https://www.ngoaquaterra.com/projects/${slug}`
  useJsonLd('project-article', project ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: project.header,
    description: (project.short_summary || project.objective || '').slice(0, 200),
    image: project.main_image || 'https://www.ngoaquaterra.com/logo.png',
    author: { '@type': 'Organization', name: 'NGO AquaTerra' },
    publisher: PUBLISHER_LD,
    contentLocation: project.location ? { '@type': 'Place', name: project.location } : undefined,
    mainEntityOfPage: { '@type': 'WebPage', '@id': projCanonical },
    url: projCanonical,
  } : null)
  // Rendered as a visible trail by <Breadcrumbs> below, which emits this same
  // BreadcrumbList. One array, so the schema and the page agree by construction.
  const crumbs: Array<[string, string]> = project
    ? [['Home', '/'], ['Projects', '/projects'], [project.header || 'Project', `/projects/${slug}`]]
    : []

  // Map the project into the carousel generator's shape (captioned images,
  // headline copy, the impact stat). Memoized on the underlying primitive
  // fields so an unrelated re-render while the studio is open (liking the
  // page, the image-gallery arrows, anything) doesn't hand the modal a "new"
  // project object and retrigger its generation effect - that read as "it
  // keeps refreshing on its own". Must live above the loading/notFound early
  // returns below: a hook can never run conditionally, or React throws
  // "Rendered more hooks than during the previous render" the moment the
  // component transitions from the loading render to the loaded one - which
  // is exactly what was crashing the page (and reading as a refresh loop)
  // every single time a project finished loading.
  const carouselData: CarouselProject | null = useMemo(() => {
    if (!project) return null
    const norm = normalizeObj(project.objective)
    const category = OBJ_CAT_MAP[norm] || 'welfare'
    const images = [
      project.image_1 && { src: project.image_1, alt: project.image_1_alt, label: project.label_1 },
      project.image_2 && { src: project.image_2, alt: project.image_2_alt, label: project.label_2 },
      project.image_3 && { src: project.image_3, alt: project.image_3_alt, label: project.label_3 },
      project.image_4 && { src: project.image_4, alt: project.image_4_alt, label: project.label_4 },
    ].filter(Boolean) as { src: string; alt: string | null; label: string | null }[]
    const allImages = project.main_image
      ? [{ src: project.main_image, alt: project.main_image_alt, label: null }, ...images]
      : images
    return {
      title: project.header,
      location: project.location,
      keyStatistic: project.key_statistic,
      objective: project.objective,
      shortSummary: project.short_summary,
      longWriteup: project.long_writeup,
      collabName: project.collab_name,
      volunteers: project.volunteers,
      workshopDate: project.workshop_date ? formatDate(project.workshop_date) : null,
      category,
      slug: project.slug,
      mainImage: project.main_image,
      images: allImages.map(im => ({ url: im.src, label: im.label })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project?.header, project?.location, project?.key_statistic, project?.objective,
    project?.short_summary, project?.long_writeup, project?.collab_name, project?.volunteers,
    project?.workshop_date, project?.slug, project?.main_image,
    project?.main_image_alt, project?.image_1, project?.image_1_alt, project?.label_1,
    project?.image_2, project?.image_2_alt, project?.label_2, project?.image_3,
    project?.image_3_alt, project?.label_3, project?.image_4, project?.image_4_alt, project?.label_4,
  ])

  if (loading) {
    return (
      <div className="route-enter container" style={{ padding: 'clamp(44px, 8vw, 80px) var(--page-px,24px) clamp(32px, 5vw, 56px)' }} aria-hidden="true">
        <div className="v6-skeleton sk-pill" style={{ width: 90, height: 24, marginBottom: 18 }} />
        <div className="v6-skeleton" style={{ width: '70%', height: 40, marginBottom: 12 }} />
        <div className="v6-skeleton" style={{ width: '40%', height: 14, marginBottom: 28 }} />
        <div className="v6-skeleton" style={{ width: '100%', height: 320, borderRadius: 'var(--r-outer)' }} />
      </div>
    )
  }

  if (loadError && !project) {
    return (
      <div className="route-enter container" style={{ padding: 'clamp(44px, 8vw, 80px) var(--page-px,24px) clamp(32px, 5vw, 56px)', textAlign: 'center' }}>
        <h1 className="h-display" style={{ fontSize: 40, margin: 0 }}>couldn’t load this project.</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          The project is probably fine — this is a connection problem on our side.
        </p>
        <button type="button" className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => window.location.reload()}>try again</button>
      </div>
    )
  }

  if (notFound || !project) {
    return (
      <div className="route-enter container" style={{ padding: 'clamp(44px, 8vw, 80px) var(--page-px,24px) clamp(32px, 5vw, 56px)', textAlign: 'center' }}>
        {/* h1, not a div: this branch replaces the ENTIRE page, so without it
            the document has no heading at all and a screen reader has
            nothing to announce on arrival. Same visual treatment. */}
        <h1 className="h-display" style={{ fontSize: 40, margin: 0 }}>project not found.</h1>
        <Link to="/projects" className="btn btn-primary" style={{ marginTop: 20, display: 'inline-flex' }}>← all projects</Link>
      </div>
    )
  }

  const norm = normalizeObj(project.objective)
  const category = OBJ_CAT_MAP[norm] || 'welfare'
  // One hue per vertical (welfare=mint, events=sky, etc - the fixed --c-*
  // tokens), not the old fine-grained per-objective OBJ_COLORS palette, which
  // predates that fix and could show a different, off-token colour per
  // objective even within a single category.
  const accentColor = CAT_COLORS[category] || CAT_COLORS.welfare

  const images = [
    project.image_1 && { src: project.image_1, alt: project.image_1_alt, label: project.label_1 },
    project.image_2 && { src: project.image_2, alt: project.image_2_alt, label: project.label_2 },
    project.image_3 && { src: project.image_3, alt: project.image_3_alt, label: project.label_3 },
    project.image_4 && { src: project.image_4, alt: project.image_4_alt, label: project.label_4 },
  ].filter(Boolean) as { src: string; alt: string | null; label: string | null }[]

  const allImages = project.main_image
    ? [{ src: project.main_image, alt: project.main_image_alt, label: null }, ...images]
    : images

  const writeupParagraphs = (project.long_writeup || '').split('\n\n').filter(p => p.trim())

  return (
    <div className="route-enter">

      {/* ── BACK NAV ──
           The trail replaces a bare "← all projects" button: it carries the
           same link plus where this page sits, and it's the deepest route on
           the site (548 of them), so orientation is worth the row. The
           carousel action keeps its place on the right. */}
      <div className="container" style={{ padding: '20px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <Breadcrumbs items={crumbs} id="project-breadcrumb" className="proj-crumbs" />
        {/* Carousel studio - leadership only. Turns this project into a
            ready-to-post Instagram deck. */}
        {canMakeCarousel && (
          <button
            className="btn btn-sm proj-carousel-btn"
            onClick={() => setShowCarousel(true)}
            title="Generate an Instagram carousel deck from this project"
            aria-label="Generate Instagram carousel"
            style={{
              background: 'var(--grape)', color: '#fff', border: 'none',
              fontWeight: 800, gap: 6, boxShadow: '0 2px 8px rgba(126,91,255,0.3)',
              transition: 'transform 0.12s var(--ease-out)', display: 'inline-flex', alignItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="2" y="5" width="14" height="14" rx="3" />
              <path d="M18 7h2a2 2 0 0 1 2 2v8" opacity="0.55" />
            </svg>
            <span className="mono" style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.02em' }}>carousel</span>
          </button>
        )}
      </div>

      {/* Carousel studio modal (portal so it escapes layout) */}
      {showCarousel && carouselData && createPortal(
        <CarouselStudioModal project={carouselData} onClose={() => setShowCarousel(false)} />,
        document.body
      )}

      {/* ── TWO-COLUMN: sticky media (left) · scrolling info (right).
            Stacks top-to-bottom on mobile. ── */}
      <div className="proj-layout">

        {/* LEFT - media (sticky on desktop) */}
        <div className="proj-media-col">
          <div className="proj-viewer" role="group" aria-roledescription="carousel" aria-label={`${project.header} photos`}>
            {/* Slide changes were never announced. */}
            <span className="sr-only" role="status" aria-live="polite">{`Photo ${activeImg + 1} of ${allImages.length}`}</span>
            {allImages.length > 0 ? (
              <Img
                src={sized(allImages[activeImg].src, 'full')}
                alt={allImages[activeImg].alt || project.header}
                decoding="async"
                fetchPriority="high"
              />
            ) : (
              <div className="proj-viewer-ph" style={{ background: accentColor + '22' }}>
                <span className="h-display" style={{ fontSize: 56, opacity: 0.3 }}>{norm}</span>
              </div>
            )}

            {/* Two-stop scrim (10.2/15.7) - never a flat tint/opacity/filter.
                Paper measures 14.2:1 on the darkest stop. */}
            <span className="proj-hero-scrim" aria-hidden />

            {/* 44px back button, additive alongside the Breadcrumbs trail
                above the hero (10.2's own literal chrome). */}
            <Link to="/projects" className="proj-hero-back" aria-label="Back to all projects">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
            </Link>

            {/* Stamped category sticker, one per page (13.9's "milestone on a
                photo" slot; 13's own >3-per-viewport dev warning is exactly
                why this route's masonry tiles use a plain hairline pill
                instead and reserve the real Sticker component for this
                single, one-off hero use). */}
            <div className="proj-hero-cat">
              {/* "ticket" is one of the component's two wide (200x64) shapes
                  that can hold a word - there is no "pill"/"squircle" shape
                  in the real, shipped set (13-sticker-system.md's prose
                  describes a different, earlier shape list than what
                  actually landed: circle/hexagon/octagon/diamond/shield/
                  quatrefoil/cloud/splat/drip/blob/star4/burstN/rosetteN/
                  wavyN/gearN, plus ticket/ribbon/flag/chevron). */}
              <Sticker shape="ticket" hue={CATEGORY_TO_STICKER_HUE[category] || 'welfare'} rotate={-3} size={132}>{heroStickerWord(norm)}</Sticker>
            </div>

            {/* One stacked bottom block instead of two independently
                absolutely-positioned ones (the overlap rule / README: reserve
                space, don't layer two absolute elements over the same
                corner) - the per-image caption becomes the block's own top
                line rather than a second `position:absolute;bottom:0` sibling
                that would collide with the title on any image that has one. */}
            <div className="proj-hero-body">
              {allImages.length > 0 && allImages[activeImg].label && (
                <span className="proj-gallery-caption" style={{ position: 'static', background: 'none', padding: 0, marginBottom: 8 }}>
                  {allImages[activeImg].label}
                </span>
              )}
              <span className="proj-hero-kicker">{norm}{project.workshop_date ? ` · ${formatDate(project.workshop_date)}` : ''}</span>
              <h1 className="proj-hero-title">{project.header}</h1>
            </div>

            {allImages.length > 1 && (
              <>
                <div className="proj-gallery-counter">
                  {String(activeImg + 1).padStart(2, '0')} / {String(allImages.length).padStart(2, '0')}
                </div>
                {isPlaying && (
                  <div className="proj-progress-bar" key={activeImg}>
                    <div className="proj-progress-fill" style={{ animationDuration: '3.8s' }} />
                  </div>
                )}
                <button
                  className="proj-gallery-playpause"
                  onClick={() => setIsPlaying(p => !p)}
                  aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
                >
                  {isPlaying ? '⏸' : '▶'}
                </button>
                <button
                  className="proj-gallery-nav proj-gallery-prev"
                  onClick={() => goTo((activeImg - 1 + allImages.length) % allImages.length, allImages.length)}
                  aria-label="Previous photo"
                >←</button>
                <button
                  className="proj-gallery-nav proj-gallery-next"
                  onClick={() => goTo((activeImg + 1) % allImages.length, allImages.length)}
                  aria-label="Next photo"
                >→</button>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {allImages.length > 1 && (
            <div className="proj-gallery-strip">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  className={'proj-thumb ' + (activeImg === i ? 'active' : '')}
                  onClick={() => goTo(i, allImages.length)}
                  aria-current={activeImg === i ? 'true' : undefined}
                  aria-label={`View photo ${i + 1}`}
                >
                  <Img ctx="thumb" src={img.src} alt={img.alt || ''} loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT - info (scrolls) */}
        <div className="proj-info-col">
          {/* The category chip and the <h1> that used to open this column
              moved into the hero (10.2: title lives over the photo now, and
              the category is the stamped Sticker there) - kept once, not
              duplicated. Meta chips keep location only; the date is now the
              hero kicker's job. */}
          {project.location && (
            <div className="proj-meta-chips">
              <span className="proj-meta-chip">📍 {project.location}</span>
            </div>
          )}

          {/* Notch-geometry bands (17.2, reused per 10.2) instead of the old
              hard-ink-bordered, 16px-radius stat cards. Two data bands only -
              volunteers and key_statistic - because welfare_projects has no
              shortfall/target-vs-actual column anywhere (verified against the
              live column list), so 10.2's "ink band states what's still
              missing" + segmented bar has no row to ever draw from. Going
              straight to the general-join CTA band below is 10.2's own
              documented fallback for exactly this data shape, not a shortcut
              taken here. */}
          {(project.volunteers != null || project.key_statistic) && (
            <div className="proj-bands">
              {project.volunteers != null && (
                // Audit pass, 2026-09-06: this was `<Link to="/members">` with a
                // "volunteers →" label - a false affordance. welfare_projects
                // tracks `volunteers` as a plain headcount with no relation to
                // WHICH members joined a given drive (no join table), so the
                // link could only ever land on the generic, unfiltered
                // "1317 active members" directory - unrelated to this drive,
                // regardless of which project you came from. That's a promise
                // ("tap to see who") the data can't keep, not a shortcut to a
                // real destination. Downgraded to a plain stat, matching the
                // key_statistic band right below, which was never a link.
                <div className="proj-band" style={{ background: 'var(--c-welfare)' }}>
                  <span className="proj-band-fig">{project.volunteers}</span>
                  <span className="proj-band-body">
                    <span className="proj-band-label">volunteers</span>
                    <span className="proj-band-sub">joined this drive</span>
                  </span>
                </div>
              )}
              {project.key_statistic && (
                <div className="proj-band" style={{ background: 'var(--c-labs)' }}>
                  {/* One consistent size, not a 34px/8.5px number+unit split -
                      key_statistic is plain text with no reliable number/unit
                      boundary (a live sample turned up full sentences like
                      "20 cookies were distributed by the volunteers to the
                      residents...", not a short unit to isolate). Rendered as
                      the band's body copy rather than forcing it into the
                      tabular-nums figure slot meant for a real number. */}
                  <span className="proj-band-body" style={{ flex: 1 }}>
                    <span className="proj-band-label">the impact</span>
                    <span className="proj-band-sub" style={{ fontSize: 13, fontWeight: 700 }}>{project.key_statistic}</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {project.short_summary && (
            <p className="proj-summary" style={{ marginTop: 22 }}>{project.short_summary}</p>
          )}

          {/* Partner + photos link */}
          {(project.collab_name || project.google_drive_link || project.instagram_link) && (
            <div className="row gap-2 flex-wrap" style={{ margin: '0 0 28px' }}>
              {project.collab_name && (
                <div className="card" style={{ padding: '10px 14px', display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                  <span className="mono xs upper muted" style={{ fontWeight: 700 }}>partner</span>
                  {project.collab_logo && (
                    <Img
                      src={sized(project.collab_logo, 'thumb')}
                      alt={project.collab_name}
                      style={{
                        height: 24, width: 'auto', maxWidth: 80,
                        objectFit: 'contain', display: 'block',
                        // Was `outline` - outline ignores border-radius and
                        // draws a square across this rounded corner (00.15).
                        border: '1px solid rgba(0,0,0,0.1)',
                        borderRadius: 4,
                      }}
                    />
                  )}
                  <Link
                    to={`/projects?q=${encodeURIComponent(project.collab_name)}`}
                    style={{ fontWeight: 700, fontSize: 14, color: 'var(--welfare-ink)', textDecoration: 'none' }}
                  >
                    {project.collab_name}
                  </Link>
                </div>
              )}
              {project.google_drive_link && (
                <a href={project.google_drive_link} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                  view photos ↗
                </a>
              )}
              {project.instagram_link && (
                <a href={project.instagram_link} target="_blank" rel="noopener noreferrer" className="btn btn-sm">
                  view on instagram ↗
                </a>
              )}
            </div>
          )}

          {/* Long writeup, as a white card (10.2). No author row: 10.2 asks
              for one, but a welfare_projects row identifies its lead only via
              `drive_lead_member_id` (an integer FK, not a name/avatar) which
              this page doesn't currently fetch - resolving it would mean a
              new join this file wasn't asked to add ("never add a query to
              make a design work" - WORKFLOW.md rule 3). Omitted and reported
              rather than guessed. */}
          {writeupParagraphs.length > 0 && (
            <div className="proj-writeup-card">
              <div className="proj-writeup-inner proj-writeup">
                {writeupParagraphs.map((para, i) => <p key={i}>{para}</p>)}
              </div>
              {/* Photo pair at radius 22 after the write-up (10.2), built
                  from the SAME image_1..4 fields already fetched for the main
                  gallery above - no new query. Shows however many of the two
                  slots exist (0, 1 or 2); never repeats a photo already used
                  as the hero/main_image. */}
              {images.length > 0 && (
                <div className="proj-writeup-pair">
                  {images.slice(0, 2).map((img, i) => (
                    <span key={i}>
                      <Img ctx="card" src={img.src} alt={img.alt || `${project.header} photo`} loading="lazy" decoding="async" />
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Quiet bridge: "you read what we did" → "here's how to be part of it" ── */}
      <div className="container" style={{ padding: '4px var(--page-px,16px) clamp(28px,4vw,40px)' }}>
        <Link to="/volunteer" className="aq-thread-link" style={{ letterSpacing: '0.04em' }}>
          {OBJECTIVE_BRIDGE[norm] || 'this is what AquaTerra does →'}
        </Link>
      </div>

      {/* ── SIMILAR PROJECTS ── */}
      {related.length > 0 && (
        <div style={{
          borderTop: 'var(--hair-2)',
          padding: 'clamp(32px,5vw,56px) 0 0',
          marginTop: 'clamp(32px,5vw,48px)',
        }}>
          <div className="container">
            {/* Section label */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <span className="sticker sticker-mint sticker--diecut" style={{ display: 'inline-flex', fontSize: 10, marginBottom: 10, ['--sticker-ground' as string]: 'var(--bg)' }}>
                  ★ MORE LIKE THIS
                </span>
                <h2 className="h-display" style={{ fontSize: 'clamp(28px,4vw,42px)', margin: 0, lineHeight: 0.95 }}>
                  similar <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400, color: accentColor }}>projects.</span>
                </h2>
              </div>
              <Link to="/projects" className="btn btn-sm btn-ghost" style={{ flexShrink: 0 }}>
                all projects →
              </Link>
            </div>

            {/* Ticket grid - trimmed to a full-row multiple of relatedCols so
                the last row is never left dangling with empty column gaps. */}
            {/* Plain div, not RevealGroup - `relatedGridRef` measures this
                element's rendered width to compute the actual column count
                (see the declaration above), and RevealGroup doesn't forward
                a ref. Each card below still gets its own Reveal. */}
            <div ref={relatedGridRef} style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fill, minmax(${RELATED_GRID_MIN_COL}px, 1fr))`,
              gap: RELATED_GRID_GAP,
              paddingBottom: 'clamp(32px,5vw,60px)',
            }}>
              {evenedRelated.map((r, i) => {
                const rNorm = normalizeObj(r.objective)
                const rColor = CAT_COLORS[OBJ_CAT_MAP[rNorm] || 'welfare'] || CAT_COLORS.welfare
                return (
                  <Reveal key={r.slug} delay={Math.min(i * 0.03, 0.4)}>
                  <Link
                    to={`/projects/${r.slug}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {/* Minimal, photo-led card - a nudge toward the project, not a
                        full summary. The cover image does the talking; the only
                        text is the title, laid directly over the photo. */}
                    <div style={{
                      position: 'relative',
                      borderRadius: 'var(--r-outer)', // was a bare 16 - off the 999/32/22/14 scale
                      overflow: 'hidden',
                      aspectRatio: '4/5',
                      background: rColor + '22',
                      transition: 'transform 0.18s var(--ease-pop)',
                      cursor: 'pointer',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = '' }}
                    >
                      {r.main_image ? (
                        <Img
                          src={sized(r.main_image, 'card')}
                          alt={r.main_image_alt || r.header}
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontFamily: 'var(--display)', fontWeight: 800, fontSize: 40, color: rColor, opacity: 0.5 }}>{rNorm[0]}</span>
                        </div>
                      )}

                      {/* The canonical two-stop scrim (10.1/15.7) - unified
                          onto the one formula this route uses everywhere else
                          a photo tile carries overlaid text. Was a three-stop
                          ramp with different numbers (.72/.15/0). */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(10,10,10,.88) 0%, rgba(10,10,10,.42) 44%, rgba(10,10,10,.06) 100%)',
                      }} />
                      <div style={{
                        position: 'absolute', left: 0, right: 0, bottom: 0,
                        padding: '14px 14px 12px',
                        fontFamily: 'var(--display)', fontWeight: 800, fontSize: 14,
                        lineHeight: 1.2, color: '#fff',
                        // Legibility floor: the scrim above handles most covers,
                        // but a bright/pale photo can still wash out white text -
                        // the text-shadow guarantees contrast over any image.
                        textShadow: '0 1px 10px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.5)',
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const,
                        overflow: 'hidden',
                      }}>
                        {r.header}
                      </div>
                    </div>
                  </Link>
                  </Reveal>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── CTA band (10.2) ──────────────────────────────────────────────
          Welfare-filled, ink text (full opacity - welfare sits 0.05 above
          the 4.5:1 floor, so no lightening the fill and no reducing the
          text's weight or alpha - README invariant 7). No shortfall data
          exists on any welfare_projects row (verified live), so this is the
          "no ink band, CTA becomes a general join link" path 10.2 itself
          documents, not a workaround. `browse all projects` stays as a real,
          separate link outside the band rather than folded into a second
          band button - 10.2 specs exactly one full-width action inside it. */}
      <div className="container" style={{ padding: '0 16px 24px' }}>
        <div className="proj-cta-band">
          <span className="proj-cta-circle" aria-hidden />
          <div className="proj-cta-inner">
            <h2 className="proj-cta-head">want to be<br />part of the next one?</h2>
            <p className="proj-cta-body">welfare drives happen regularly. join AquaTerra to get notified and show up.</p>
          </div>
          <Link to="/login" className="proj-cta-action" onClick={() => setAuthIntent({ kind: 'apply' })}>Come do the work with us</Link>
        </div>
      </div>
      <div className="container" style={{ padding: '0 16px 80px', textAlign: 'center' }}>
        <Link to="/projects" className="btn btn-sm btn-ghost">browse all projects →</Link>
      </div>

    </div>
  )
}
