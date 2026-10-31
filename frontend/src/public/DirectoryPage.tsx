import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabaseCommunity } from '../lib/supabaseCommunity'
import { PUBLIC_DEPARTMENTS as DEPARTMENTS, isDarkDepartmentFill } from '../lib/departments'
import { CATEGORY_SLUGS } from '../lib/categories'
import { APPROVAL_TIME, ORG_FACTS, displayCount } from '../lib/orgFacts'
import { departmentsPhrase, numberWord, yearsPhrase } from '../lib/orgFigures'

const DRIVES = displayCount(ORG_FACTS.drivesWrittenUp)
const MEMBERS = displayCount(ORG_FACTS.membersTotal)
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import './DirectoryPage.css'
import { pageMetadata } from '../lib/metaConfig'
import { Reveal, RevealGroup } from '../components/Reveal'

/* ══════════════════════════════════════════════════════════════════════════
   SECTION 30 · THE AQ MAP

   Wayfinding, not a feed. Every block on this page is a DOORWAY: it names what
   is behind it, how much of it there is, and where it goes. Nothing here is
   content to be consumed, so nothing here has a like, a save or a body. A
   person should be able to enter at whichever part of AQ they already care
   about, which is why there are four entrances rather than one filter row: a
   filter row assumes you already know what you want, and a map does not.

   FOUR ENTRANCES, in this order: by intent, by department, by kind, by year.

   THE COUNT RULE, which is the rule this page is most likely to be broken by.
   Every figure is in exactly one of three states, and there is no fourth:

     canonical  a figure the org already publishes (AboutPage / orgFacts).
                Rendered as itself. displayCount(ORG_FACTS.drivesWrittenUp) projects,
                the department count, displayCount(ORG_FACTS.membersTotal) members.
     live       resolved from a `head: true` count query at render. Renders as
                the dashed marker until it lands, then as the number.
     unsourced  no query this public surface can honestly run. Renders as the
                dashed marker PERMANENTLY, and says so to a screen reader.

   A plausible number is never written into this page. `1,247` began life as an
   invented member number on the sign-in receipt and reached seven places before
   anyone checked it; the dashed marker exists so that never has a second cause.

   DEPARTMENTS ARE NOT CATEGORIES. The eight come from `lib/departments.ts` with
   their own literal colour tokens, and route through the five-value category
   vocabulary underneath. Three departments share `labs` and two share
   `operations`; the map says so rather than papering over it. Never colour a
   department through `CAT_COLORS` - five keys cannot serve eight teams, and
   the collision put three on teal and two on grape the last time someone tried.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Entrance 1 · by intent ───────────────────────────────────────────────
   Five behavioural modes reduced to the four that land on a route this site
   actually serves. Each bar is a single line, so it is a 999px bar; the
   destination sits in mono BENEATH the bar, outside the link, because a
   two-line capsule loses about a third of its width to the end caps. */
const INTENTS: { label: string; to: string; sub: string }[] = [
  {
    label: 'I want to join',
    to: '/login',
    sub: `2 minutes to apply. An HoD reads every one, usually ${APPROVAL_TIME}.`,
  },
  {
    label: 'I want to see the work',
    to: '/projects',
    sub: `${DRIVES} projects, written up by whoever ran them.`,
  },
  {
    label: 'I want to read',
    to: '/blog',
    sub: 'Blogs by members, straight from the composer.',
  },
  {
    label: 'I want to support this',
    to: '/support',
    sub: '₹0 donations since 2021. Buy from Crftd instead.',
  },
]

/* ── Entrance 3 · by kind ─────────────────────────────────────────────────
   The legend, and it carries where each kind lives on the site.

   This used to print the raw database table name (`welfare_projects`,
   `job_openings`) and, for Labs, a source file path (`public/LabsPage.tsx`,
   which the row truncated on screen to "public/LabsPage.t"). That was schema
   leaking into public UI. `where` names the destination in the site's own
   vocabulary instead.

   `count` is one of the three states above. `hideWhenZero` exists for open
   roles only: a recruitment door that reads "0" is worse than no door, so the
   block is absent when nothing is open rather than advertising an empty room. */
type CountKey = 'posts' | 'blogs' | 'openings'

interface Kind {
  key: string
  name: string
  note: string
  /** Where this kind lives on the site, in the site's own words. */
  where: string
  to: string
  /** A canonical figure, rendered as itself. */
  canonical?: string
  /** Which live count fills this door, if any. */
  live?: CountKey
  /** Why no count can be sourced here. Renders the dashed marker forever. */
  unsourced?: string
  hideWhenZero?: boolean
}

const KINDS: Kind[] = [
  {
    key: 'posts',
    name: 'posts',
    note: 'what members wrote up, the day they did it',
    where: 'the feed',
    to: '/',
    live: 'posts',
  },
  {
    key: 'projects',
    name: 'projects',
    note: 'albums with a paragraph. Every drive is written up here once it has happened',
    where: 'drives',
    to: '/projects',
    canonical: DRIVES,
  },
  {
    key: 'blogs',
    name: 'blogs',
    note: 'the longer pieces, out of the same composer',
    where: 'the blog',
    to: '/blog',
    live: 'blogs',
  },
  {
    key: 'teams',
    name: 'teams',
    note: `the ${departmentsPhrase()}, and who runs each one`,
    where: 'departments',
    to: '/teams',
    canonical: String(DEPARTMENTS.length),
  },
  {
    key: 'members',
    name: 'members',
    note: 'the whole roll, school by school',
    where: 'the roll',
    to: '/members',
    canonical: MEMBERS,
  },
  {
    key: 'openings',
    name: 'open roles',
    note: 'every opening across every team, with the application attached',
    where: 'opportunities',
    to: '/opportunities',
    live: 'openings',
    hideWhenZero: true,
  },
  {
    key: 'labs',
    name: 'AQ Labs',
    note: 'the student ventures: products, brands and one documentary',
    where: 'labs',
    to: '/terranotes/articles/labs',
    // AQ Labs now lives inside Terra Notes (src/terranotes/articles/labs/); its
    // cohort is a module-private literal in the ported page and is not exported,
    // so there is nothing to import and count. The size of the
    // cohort is build-time context, not a figure the org publishes, so writing
    // it here would be exactly the invented number this page forbids.
    unsourced: 'the Labs cohort is not exported from its page',
  },
]

/* ── Entrance 4 · by year ─────────────────────────────────────────────────
   SIX CHAPTERS ACROSS FIVE ELAPSED YEARS. "five years, six chapters" is
   correct; do not "fix" it.

   These six strings are duplicated VERBATIM from the `milestones` array in
   `public/AboutPage.tsx`. They are duplicated rather than imported because that
   array is a component-local const in a file this section does not own. If the
   two ever disagree the About page is right and this is wrong. Extracting them
   into a shared module is the correct fix and belongs to whoever owns
   AboutPage.tsx next; until then, changing one means changing both.

   The hue rotation is display-type-only, per the poster system: the year sits
   at 44px and the milestone line beneath it takes solid ink. Every hue used
   here clears 4.5:1 against ink. `--pink-ink` #C4185C, which does not (3.42:1),
   is deliberately absent from the rotation. */
const YEARS: { y: string; t: string; c: string }[] = [
  { y: '2021', t: '16 students, a WhatsApp group, and a Sundarbans relief trip with no budget', c: 'var(--welfare)' },
  { y: '2022', t: '200 members, first leadership handover, certificates as currency', c: 'var(--sky)' },
  { y: '2023', t: 'dipped. recovered. original team stepped back in and rebuilt', c: 'var(--lemon)' },
  { y: '2024', t: 'Disco Diwali. Starry Nights. both crossed 6-digit revenue. Crftd launched.', c: 'var(--tomato)' },
  /* 2026-09-06, changelog/21-org-facts.md §21.0 ("no public-facing statistic
     may be written as a literal in a component. Ever."): this array used to
     print `1,100 members. 550+ projects.` on 2025 and `1,200+ active members`
     on 2026 — three hand-typed figures, two of them the disputed drives/
     members values ACCEPTANCE §F bans outright, all four contradicting the
     `540+ / 8 / 1,300+` this same page publishes 200px above under the
     sentence "Only 540+, 8 and 1,300+ are figures AquaTerra already publishes."
     2025's two figures are DELETED rather than re-derived: an ORG_FACTS count
     is today's number, and pinning today's number to a past chapter would be a
     new, wrong claim. 2026 is the "now" chapter, so its figure is exactly the
     live one and is derived. No other word in either string changed. */
  { y: '2025', t: 'AQ.Ventures and ShikshAQ in the ecosystem.', c: 'var(--grape)' },
  { y: '2026', t: `${MEMBERS} active members. ShikshAQ live. still student-run. still Kolkata.`, c: 'var(--teal)' },
]

/** The department fill that is dark enough to need paper glyphs on it. The
    branch lives HERE, once, and never at a call site: the same class of rule
    (ink on a saturated fill) has been re-broken by per-instance patching four
    separate times on this project. `--ink-2` is Human Resources' literal token
    in `lib/departments.ts`. */
const isDarkFill = isDarkDepartmentFill

/** The dashed marker. It is the ONLY thing that may stand where a number would
    go when there is no number. A zero is a claim; this is not.
    `label` defaults to "live" (still counting / unsourced); 08's own
    "never render a 0 - say nothing yet" rule reuses the same dashed
    treatment with the word "nothing yet" for a count that has genuinely
    resolved to zero (see renderCount below) - it isn't the same state as
    "counting", but it is the same "no number to show" shape. */
function LiveMarker({ reason, label = 'live' }: { reason?: string; label?: string }) {
  return (
    <span
      className="dir-count dir-count--live"
      title={reason ? `no count on this page: ${reason}` : 'counting'}
    >
      {label}
    </span>
  )
}

export default function DirectoryPage() {
  useMeta(pageMetadata.directory)
  useJsonLd('directory-breadcrumb', breadcrumbLd([['Home', '/'], ['The map', '/directory']]))

  /* Counts resolve independently and asynchronously. Each starts as null (the
     dashed marker) and only ever becomes a number, so a slow or denied query
     leaves the marker standing rather than collapsing to a zero. `head: true`
     means no rows cross the wire; these are three cheap COUNT(*) calls.

     These are NEW queries added by this page, not edits to existing ones. Each
     reads a table that is already publicly readable under its live RLS policy,
     which is why the map does not carry doors for `certificate_requests`,
     `contact_submissions` or `collaboration_submissions`: those are gated on
     `is_director()`, so a public visitor would see a zero that is not a zero. */
  const [counts, setCounts] = useState<Record<CountKey, number | null>>({
    posts: null, blogs: null, openings: null,
  })

  useEffect(() => {
    let alive = true
    const apply = (key: CountKey, count: number | null | undefined) => {
      if (!alive || typeof count !== 'number') return
      setCounts(prev => ({ ...prev, [key]: count }))
    }
    // `posts` RLS also exposes a signed-in member's own pending rows, so the
    // status filter is explicit rather than left to the policy.
    supabaseCommunity.from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published')
      .then(({ count }) => apply('posts', count))
      .then(undefined, () => { /* stays a dashed marker */ })
    // A blog IS a post now (item 4.2) - `source_kind = 'blog'` - and the old
    // `blogs` table was retired on 2026-09-12. This call still named it, so the
    // essays door's count silently failed and sat on its dashed placeholder
    // forever. The `.then(undefined, ...)` swallow below is what made it
    // silent, which is why nothing surfaced when the table went away.
    //
    // The status filter is explicit for the same reason as `posts` above:
    // `posts` RLS also exposes a signed-in member's own pending rows, and a
    // scheduled blog must not be counted as published.
    supabaseCommunity.from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('source_kind', 'blog')
      .eq('status', 'published')
      .is('deleted_at', null)
      .then(({ count }) => apply('blogs', count))
      .then(undefined, () => { /* stays a dashed marker */ })
    supabaseCommunity.from('job_openings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open')
      .then(({ count }) => apply('openings', count))
      .then(undefined, () => { /* stays a dashed marker */ })
    return () => { alive = false }
  }, [])

  const renderCount = (k: Kind) => {
    if (k.canonical) return <span className="dir-count">{k.canonical}</span>
    if (k.unsourced) return <LiveMarker reason={k.unsourced} />
    const n = k.live ? counts[k.live] : null
    if (n === null || n === undefined) return <LiveMarker />
    // 08.7: "never render a 0 - say nothing yet." `openings` already has its
    // own stronger treatment (the whole door hides via hideWhenZero below);
    // posts/blogs don't, so a genuine zero here fell straight through to
    // `n.toLocaleString()` = "0" before this - a real gap for a page whose
    // one governing rule is "no fourth state, and never a plausible number."
    if (n === 0) return <LiveMarker label="nothing yet" reason="count resolved to zero" />
    return <span className="dir-count">{n.toLocaleString()}</span>
  }

  const visibleKinds = KINDS.filter(k => {
    if (!k.hideWhenZero || !k.live) return true
    return counts[k.live] !== 0
  })

  return (
    <div className="map-page route-enter">
      <div className="container dir-shell">

        <header className="dir-masthead">
          <p className="dir-eyebrow">the map</p>
          <h1 className="dir-h1">
            a map of everything <span className="dir-h1-serif">at AQ</span>.
          </h1>
          <p className="dir-standfirst">
            Wayfinding, not a feed. Every block here is a doorway, so you can see the shape of the
            whole organisation before choosing where to go. Four ways in: by intent, by department,
            by kind, by year.
          </p>
        </header>

        {/* ── 1 · BY INTENT ────────────────────────────────────────────── */}
        <section className="dir-entrance" aria-labelledby="dir-h-intent">
          <h2 className="dir-entrance-h" id="dir-h-intent">by intent</h2>
          <p className="dir-entrance-sub">pick one, and we will route you</p>
          <RevealGroup>
            <ul className="dir-intents">
              {INTENTS.map((i, idx) => (
                <li key={i.to} className="dir-intent-item">
                  <Reveal delay={Math.min(idx * 0.03, 0.4)}>
                    <Link to={i.to} className="dir-intent">
                      <span className="dir-intent-label">{i.label}</span>
                      <span className="dir-intent-arrow" aria-hidden>→</span>
                    </Link>
                    <p className="dir-intent-sub">
                      <span className="dir-route">{i.to}</span>
                      {i.sub}
                    </p>
                  </Reveal>
                </li>
              ))}
            </ul>
          </RevealGroup>
        </section>

        {/* ── 2 · BY DEPARTMENT ────────────────────────────────────────── */}
        <section className="dir-entrance" aria-labelledby="dir-h-dept">
          <h2 className="dir-entrance-h" id="dir-h-dept">by department</h2>
          <p className="dir-entrance-sub">
            {DEPARTMENTS.length} teams, {MEMBERS} people. {CATEGORY_SLUGS.length} category values underneath them,
            so three teams share labs and two share operations.
          </p>
          <RevealGroup>
            <ul className="dir-depts">
              {DEPARTMENTS.map((d, idx) => (
                <li key={d.name}>
                  <Reveal delay={Math.min(idx * 0.03, 0.4)}>
                    <Link
                      to={`/teams?category=${d.category}`}
                      className={'dir-dept' + (isDarkFill(d.color) ? ' dir-dept--dark' : '')}
                      style={{ background: d.color }}
                    >
                      <span className="dir-dept-name">{d.name}</span>
                      <span className="dir-dept-stat">{d.stat}</span>
                      <span className="dir-dept-cat">{d.category}</span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </RevealGroup>
        </section>

        {/* ── 3 · BY KIND ──────────────────────────────────────────────── */}
        <section className="dir-entrance" aria-labelledby="dir-h-kind">
          <h2 className="dir-entrance-h" id="dir-h-kind">by kind</h2>
          <p className="dir-entrance-sub">the legend, and where each kind lives</p>
          <RevealGroup>
            <ul className="dir-kinds">
              {visibleKinds.map((k, idx) => (
                <li key={k.key}>
                  <Reveal delay={Math.min(idx * 0.03, 0.4)}>
                    <Link to={k.to} className="dir-kind">
                      {renderCount(k)}
                      <span className="dir-kind-body">
                        <span className="dir-kind-name">{k.name}</span>
                        <span className="dir-kind-note">{k.note}</span>
                      </span>
                      <span className="dir-kind-table">{k.where}</span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </RevealGroup>
          <p className="dir-legend">
            A dashed <span className="dir-count dir-count--live dir-count--inline">live</span> means the
            number comes from a query when the page loads, never from a figure written into the design.
            Only {DRIVES}, {DEPARTMENTS.length} and {MEMBERS} are figures AquaTerra already publishes.
          </p>
        </section>

        {/* ── 4 · BY YEAR ──────────────────────────────────────────────── */}
        <section className="dir-entrance" aria-labelledby="dir-h-year">
          <h2 className="dir-entrance-h" id="dir-h-year">by year</h2>
          <p className="dir-entrance-sub">{yearsPhrase()}, {numberWord(YEARS.length)} chapters</p>
          <RevealGroup>
            <ul className="dir-years">
              {YEARS.map((y, idx) => (
                <li key={y.y}>
                  <Reveal delay={Math.min(idx * 0.03, 0.4)}>
                    <Link to="/about#story" className="dir-year" style={{ background: y.c }}>
                      <span className="dir-year-n">{y.y}</span>
                      <span className="dir-year-t">{y.t}</span>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </RevealGroup>
        </section>

        {/* No screen is a dead end, this one least of all. Both exits are
            places a person who has just read the whole shape of the org
            plausibly wants next, not a generic banner. */}
        <nav className="dir-exits" aria-label="Where to go next">
          <Link to="/volunteer" className="dir-exit">
            <span className="dir-exit-h">read the handbook</span>
            <span className="dir-exit-p">The long version: how the work runs, department by department.</span>
          </Link>
        </nav>

      </div>
    </div>
  )
}
