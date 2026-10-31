import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import { setAuthIntent } from '../lib/authIntent'
import { Reveal, RevealGroup } from '../components/Reveal'

// "Class Cohorts" - members grouped by the class_grade they registered with.
// Auto-generated from live member data so the page stays current as members
// join, rather than being a static screen. The peer-tutoring CTAs stay below.
//
// GROUPED IN SQL, NOT HERE (changed 2026-09-18). This used to pull up to 3,000
// members' class_grade to the browser and tally them client-side. Two problems,
// both fixed by moving the grouping into class_cohort_counts():
//
//   1. SCRAPING. A public, unauthenticated route handed out a 3,000-row column
//      dump of the roster. The RPC is SECURITY DEFINER and returns aggregates
//      only - never an identifying row - so the page needs no anon grant at all.
//   2. JUNK ON A PUBLIC PAGE. class_grade is free text and holds 63 distinct
//      values for 9 real cohorts, so this page rendered "11" and "Class 11" as
//      two separate cohorts, five spellings of Class 11 in total, plus a literal
//      emoji and a timestamp someone had typed into their profile. The RPC
//      normalises to canonical labels and maps anything unrecognised to
//      "Other", so a new bad value can never reach the page again.
//      48 rows -> 14, with the total unchanged at 1,138.
//
// See scripts/class_cohort_normalise_v2_2026_09_18.sql. Display only: no member
// row is rewritten, so the desk, search and CVs still read the raw column.
// lib/classOptions.ts is the other half - it stops NEW bad values being written.

const HUES = ['var(--welfare)', 'var(--sky)', 'var(--grape)', 'var(--lemon)', 'var(--tomato)', 'var(--pink)']

type Cohort = { name: string; count: number }

/**
 * The term to search when someone taps a cohort.
 *
 * Not simply the cohort name, and this is deliberate. The tiles now show
 * canonical labels, but the members underneath still hold whatever they typed:
 * the 337 people in "Class 11" are stored as "11", "Class 11", "class 11",
 * "Grade 11" and "grade eleven". Searching the label itself would match only
 * the dozen who happened to type it that way and quietly break this page's own
 * "tap a cohort to meet the members in it" promise - the exact bug the 2026-09-06
 * fix below was written for.
 *
 * So for school classes we search the bare number, which is the dominant stored
 * spelling and a substring of every other one bar "grade eleven".
 *
 * KNOWN LIMIT, stated rather than hidden: college cohorts have no single term
 * that matches "1", "1st", "1st year" and "first year" at once, so those tiles
 * search their full label and under-return. Fixing it properly means teaching
 * search about cohorts using this same normalisation, which is a bigger change
 * than this page. "Other" is excluded from linking entirely below, because no
 * search term describes it.
 */
function searchTermFor(cohort: string): string {
  const m = /^Class (\d+)$/.exec(cohort)
  return m ? m[1] : cohort
}

export default function ClassesPage() {
  useMeta(pageMetadata.classes)
  useJsonLd('classes-breadcrumb', breadcrumbLd([['Home', '/'], ['Classes', '/classes']]))
  const navigate = useNavigate()
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [loading, setLoading] = useState(true)
  // Distinguishes a real fetch failure from a genuinely empty result (11.4/
  // 11.8) - previously any Supabase-level `error` was silently swallowed
  // (only `data` was destructured) and rendered as the same "cohorts will
  // appear here as members join" empty state as a true zero-rows case.
  const [loadError, setLoadError] = useState(false)

  const loadCohorts = () => {
    setLoading(true)
    setLoadError(false)
    let cancelled = false
    supabaseCommunity
      // `as never` matches the convention already used for every RPC added
      // since database.types.ts was last generated (see lib/auditLog.ts and
      // services/directorService.ts). The generated file does not know
      // class_cohort_counts() exists yet, so the literal fails the union check.
      .rpc('class_cohort_counts' as never)
      .then(({ data, error }) => {
        if (cancelled) return
        // 11.4/11.8: a real failure must not render as the same "cohorts will
        // appear here" empty state a genuine zero-rows result does.
        if (error) { setLoadError(true); setLoading(false); return }
        setCohorts(((data || []) as unknown as { cohort: string; member_count: number }[])
          .map(r => ({ name: r.cohort, count: Number(r.member_count) }))
          // The RPC already orders by count desc then name, so this is a
          // belt-and-braces re-sort, not a correction. Kept so the page's
          // ordering does not silently depend on the function's ORDER BY.
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)))
        setLoading(false)
      }, () => { if (!cancelled) { setLoadError(true); setLoading(false) } })
    return () => { cancelled = true }
  }

  useEffect(loadCohorts, [])

  const totalInCohorts = cohorts.reduce((s, c) => s + c.count, 0)

  return (
    <div className="route-enter container" style={{ padding: 'clamp(28px, 5vw, 48px) var(--page-px,24px) clamp(40px, 6vw, 64px)' }}>
      <span className="sticker sticker-lemon wobble sticker--diecut" style={{ ['--sticker-ground' as string]: 'var(--bg)' }}>★ class cohorts</span>
      <h1 className="h-display" style={{ fontSize: 'clamp(52px, 8vw, 88px)', margin: '12px 0 14px', lineHeight: 0.9 }}>
        the{' '}
        {/* "class of" was yellow (#FFC700) serif on the cream page bg — 1.36:1,
            near-invisible. A darkened-gold text fix would fail in dark theme
            (dark text on the navy dark-mode bg), so keep the serif-accent
            register but set it on a solid lemon marker chip with near-black
            ink: ~12.6:1 in both themes, hue preserved. */}
        <span style={{
          display: 'inline-block', fontStyle: 'italic', fontFamily: 'var(--serif)', fontWeight: 400,
          background: 'var(--lemon)', color: 'var(--ink)',
          padding: '0 0.22em', borderRadius: 'var(--r-tight)', transform: 'rotate(-1.5deg)',
        }}>class of</span> AQ.
      </h1>
      <p style={{ fontSize: 18, color: 'var(--ink-2)', maxWidth: 560, margin: '0 0 36px', lineHeight: 1.6 }}>
        Everyone at AquaTerra, grouped by the class they joined with. Tap a cohort to meet the members in it.
      </p>

      {/* Auto-generated cohort grid. Tiles are 08's hue-disc pattern (150px
          circle in a category hue, label pill overlapping its lower edge by
          16px) adapted from search's fixed five categories to Classes' N
          cohorts: since every count already comes from the one query above
          (not five separate ones, which 08.1 forbids), every disc's pill
          carries its own "N members" figure rather than reserving the count
          for a single selected disc. */}
      {loading ? (
        <div
          aria-busy="true"
          role="status"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px 12px', marginBottom: 40 }}
        >
          <span className="sr-only">loading class cohorts…</span>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="v6-skeleton" style={{ width: 'min(150px, 100%)', aspectRatio: '1', borderRadius: '50%' }} />
              <div className="v6-skeleton" style={{ width: '64%', height: 24, borderRadius: 'var(--r-pill)', marginTop: -16 }} />
            </div>
          ))}
        </div>
      ) : loadError ? (
        <ErrorState
          message="couldn't load class cohorts."
          hint="something went wrong fetching members. please try again."
          onRetry={loadCohorts}
          variant="block"
        />
      ) : cohorts.length > 0 ? (
        <>
          <div className="mono xs upper muted" style={{ fontWeight: 700, marginBottom: 14, fontVariantNumeric: 'tabular-nums' }}>
            {cohorts.length} cohorts · {totalInCohorts} members
          </div>
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '24px 12px', marginBottom: 44 }}>
            {cohorts.map((c, i) => {
              const hue = HUES[i % HUES.length]
              const label = /^\d+$/.test(c.name) ? `Class ${c.name}` : c.name
              // "Other" is the RPC's escape hatch for answers that do not form
              // a cohort, so there is no search term that describes it. Show
              // the tile honestly, but do not offer a tap that would land on an
              // empty result.
              const linkable = c.name !== 'Other'
              return (
                <Reveal key={c.name} delay={Math.min(i * 0.03, 0.4)}>
                  <button
                    type="button"
                    disabled={!linkable}
                    aria-disabled={!linkable || undefined}
                    title={linkable ? undefined : 'A mix of one-off answers rather than a single cohort'}
                    // Audit pass, 2026-09-06: was `&type=members` - SearchPage
                    // reads `kind` from the URL, never `type`, so this landed on
                    // the unfiltered "all" tab instead of a members-only view,
                    // silently breaking this page's own "tap a cohort to meet
                    // the members in it" promise. searchTermFor() exists to keep
                    // that promise now that the tiles show canonical labels while
                    // the members underneath still hold what they typed.
                    onClick={linkable
                      ? () => navigate(`/search?q=${encodeURIComponent(searchTermFor(c.name))}&kind=members`)
                      : undefined}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      background: 'none', border: 'none', padding: 0,
                      cursor: linkable ? 'pointer' : 'default',
                    }}
                  >
                    {/* The disc. */}
                    <span
                      style={{
                        width: 'min(150px, 100%)', aspectRatio: '1', borderRadius: 'var(--r-pill)',
                        background: hue, color: 'var(--ink)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 4, textAlign: 'center', padding: '0 14px', marginBottom: -16,
                        boxSizing: 'border-box',
                      }}
                    >
                      <span aria-hidden style={{ fontSize: 20, opacity: 0.6, lineHeight: 1 }}>🎓</span>
                      <span style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 17, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{label}</span>
                    </span>
                    {/* The overlapping count pill - relative + negative margin on
                        the disc above is what produces the 16px overlap. */}
                    <span
                      className="mono xs"
                      style={{
                        position: 'relative', zIndex: 1,
                        display: 'inline-flex', alignItems: 'center', minHeight: 44,
                        padding: '0 14px', borderRadius: 'var(--r-pill)',
                        background: 'var(--card)', border: 'var(--hair-2)', boxShadow: 'var(--lift-1)',
                        fontWeight: 700, color: 'var(--ink-2)', fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.count} member{c.count !== 1 ? 's' : ''}
                    </span>
                  </button>
                </Reveal>
              )
            })}
          </RevealGroup>
        </>
      ) : (
        <EmptyState
          icon="🎓"
          title="nothing here yet."
          hint="cohorts will appear here as members join."
          action={<Link to="/directory" className="btn btn-primary">browse the directory →</Link>}
        />
      )}

      {/* Peer tutoring CTAs */}
      <div className="card" style={{ padding: 'clamp(28px, 5vw, 44px)', background: 'var(--lemon)', color: 'var(--ink)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h2 className="h-display" style={{ fontSize: 'clamp(24px, 4vw, 38px)', lineHeight: 1 }}>students teaching students.</h2>
          <p style={{ margin: '8px 0 0', fontSize: 15, opacity: 0.75 }}>give a couple of hours, or find a free tutor. no fees, ever.</p>
        </div>
        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <Link to="/login" className="btn" style={{ background: 'var(--ink)', color: 'var(--lemon)', borderColor: 'var(--ink)' }} onClick={() => setAuthIntent({ kind: 'apply' })}>apply to teach →</Link>
          <Link to="/contact" className="btn">request a class</Link>
        </div>
      </div>
    </div>
  )
}
