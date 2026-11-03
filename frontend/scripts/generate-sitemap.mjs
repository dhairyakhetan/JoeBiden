/**
 * AquaTerra sitemap generator
 * ────────────────────────────────────────────────────────────────────────────
 * Run:  node scripts/generate-sitemap.mjs      (also runs as part of `npm run build`)
 * Out:  frontend/public/sitemap.xml            (vite copies public/ → dist/)
 *
 * Emits every PUBLIC, indexable route on the production origin:
 *   • curated static routes (verified 1:1 against src/App.tsx's <Routes> tree)
 *   • dynamic routes pulled live, read-only, from Supabase:
 *       welfare_projects → /projects/:slug
 *       blogs            → /blog/:slug
 *       teams            → /teams/:uuid
 *       job_openings     → /opportunities/:id   (status = open only)
 *       paradox_events / paradox_blog_posts → /paradox/…  (only when the
 *         Paradox project's env vars are set; otherwise the checked-in
 *         fallback slug list is used)
 *
 * DELIBERATELY EXCLUDED — keep in sync with public/robots.txt:
 *   auth        /login /register /auth/callback /pending /rejected /welcome
 *   member-only /profile/* /notifications /saved /my-posts /settings /search /feed
 *   admin       /director/* /paradox/admin /paradox/scores /paradox/updates
 *   dev-only    /dev/* /brand
 *   privacy     /member/:uuid — real students, many of them minors. Public
 *               profile pages are deliberately NOT advertised in the sitemap.
 *   /post/:uuid — member-authored permalinks; not curated content.
 *
 * FAILURE POLICY (important): this script must never break a deploy. Every
 * network call is timeout-bounded and individually try/caught; if Supabase is
 * unreachable, the env is missing, or a table 404s, the affected section is
 * logged as SKIPPED and the script still writes a valid sitemap of the static
 * routes and exits 0. scripts/verify-sitemap.mjs (postbuild) is what turns a
 * *silently missing or stale* sitemap into a loud build failure.
 *
 * lastmod is only ever emitted from a real row timestamp — never fabricated.
 * Static routes carry no lastmod because we have no honest value for them
 * (index pages inherit the newest lastmod of their own children, which is real).
 */

import './loadEnv.mjs'   // must precede any process.env read
import { terraNotesSitemapPaths } from './terranotes/prerender.mjs'
import { writeFileSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dir, '../public/sitemap.xml')

// ── Config ───────────────────────────────────────────────────────────────────
// Production origin. Verified against index.html's <link rel="canonical">,
// public/robots.txt (Sitemap:/Host:) and the Organization JSON-LD "url".
// Override with SITE_URL only if the canonical domain ever changes.
const BASE_URL = (process.env.SITE_URL || 'https://www.ngoaquaterra.com').replace(/\/+$/, '')

// Community/CMS Supabase project (welfare_projects, blogs, teams, job_openings
// all live here since the projects were consolidated). Env first so the build
// follows whatever the Vercel project is pointed at.
//
// There is NO literal key fallback. There used to be, and the comment here
// claimed it was "the same publishable anon key that already ships in the client
// bundle" - it was not. It was a legacy `eyJ...` JWT minted from the project's
// JWT secret, tracked in git, while the app had since moved to an
// `sb_publishable_...` key. So the repo carried a second, older, permanently
// checked-in credential for the live project that nobody was rotating.
// With no key the fetches below SKIP and the shrink guard preserves the existing
// sitemap, which is the correct failure mode: a clone with no .env gets a
// static-only sitemap rather than silently reaching a production database.
const DB_URL =
  process.env.VITE_SUPABASE_URL ||
  process.env.VITE_CMS_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://hzowuwffjqtgszecngpe.supabase.co'
const DB_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_CMS_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  ''

// Paradox lives in its own Supabase project. No literal fallback key exists in
// the repo for it, so when these are unset we fall back to the checked-in slug
// lists below rather than emitting nothing.
const PARADOX_URL = process.env.VITE_PARADOX_SUPABASE_URL || ''
const PARADOX_KEY = process.env.VITE_PARADOX_SUPABASE_ANON_KEY || ''

const FETCH_TIMEOUT_MS = 15_000
const PAGE_SIZE = 1000

// ── Static routes (verified against src/App.tsx) ─────────────────────────────
const STATIC_AQ = [
  { path: '/',               changefreq: 'daily',   priority: '1.0' },
  { path: '/projects',       changefreq: 'weekly',  priority: '0.9' },
  { path: '/blog',           changefreq: 'weekly',  priority: '0.9' },
  { path: '/about',          changefreq: 'monthly', priority: '0.9' },
  { path: '/teams',          changefreq: 'weekly',  priority: '0.8' },
  { path: '/members',        changefreq: 'weekly',  priority: '0.7' },
  { path: '/opportunities',  changefreq: 'weekly',  priority: '0.8' },
  { path: '/collaborations', changefreq: 'monthly', priority: '0.8' },
  { path: '/crftd',         changefreq: 'monthly', priority: '0.7' },
  { path: '/schools',        changefreq: 'monthly', priority: '0.6' },
  { path: '/games',          changefreq: 'monthly', priority: '0.5' },
  { path: '/classes',        changefreq: 'monthly', priority: '0.6' },
  { path: '/faq',            changefreq: 'monthly', priority: '0.7' },
  { path: '/support',        changefreq: 'monthly', priority: '0.7' },
  { path: '/contact',        changefreq: 'monthly', priority: '0.7' },
  { path: '/volunteer',      changefreq: 'monthly', priority: '0.6' },
  { path: '/links',          changefreq: 'monthly', priority: '0.6' },
  { path: '/directory',      changefreq: 'weekly',  priority: '0.7' },
  { path: '/join',           changefreq: 'monthly', priority: '0.8' },
  // Open Books. The Finance Director updates public_ledger monthly (PRD:
  // docs/PRD-open-books.md), so 'monthly' rather than 'weekly' here.
  { path: '/accounts',       changefreq: 'monthly', priority: '0.6' },
  // Terra Notes, the monthly digital magazine (and, inside it, AQ Labs '26: /terranotes/articles/labs and its
  // chapters). Derived from src/terranotes/data/ through scripts/terranotes/prerender.mjs, which prerender-meta.mjs
  // also reads, so the sitemap and the prerendered set cannot disagree about which pages exist. The old /labs and
  // /labs/:slug redirect into it and are deliberately no longer listed. Checked-in data, so no honest lastmod.
  ...terraNotesSitemapPaths().map(path => ({
    path,
    changefreq: path === '/terranotes' ? 'monthly' : 'yearly',
    priority: path === '/terranotes' ? '0.7' : '0.5',
  })),
  // /equity-policy is deliberately ABSENT: it is noindex (it publishes five
  // named students' personal mobile numbers, owner-ruled to stay). Listing a
  // noindex URL in a sitemap is a direct contradiction and Search Console
  // flags it. See EquityPolicyPage.tsx's comment for the full reasoning.
  // /privacy-policy is prerendered (it is in prerender-meta.mjs ROUTES) and
  // has a real metaConfig entry, but was missing here - an indexable page with
  // real content, orphaned from discovery. For an NGO run by minors the
  // privacy page is also a trust/E-E-A-T signal Google looks for explicitly.
  { path: '/privacy-policy', changefreq: 'yearly',  priority: '0.4' },

  // ── TerraThon 2026 ────────────────────────────────────────────────────────
  // Public surfaces only. Deliberately NOT listed, and never to be added:
  //   /terrathon/register/*  a form, nothing to index, and indexing it would
  //                          send crawlers at the one RPC that writes rows
  //   /terrathon/t/*         entry tickets. The token is the only thing between
  //                          a forwarded link and a free entry
  //   /terrathon/admin/*     the desk, which also carries noindex
  // Priority is high through September and drops to nothing after 4 October;
  // that is a manual edit, not worth a date branch in a build script.
  { path: '/terrathon',            changefreq: 'daily',   priority: '0.9' },
  { path: '/terrathon/cricket',    changefreq: 'daily',   priority: '0.8' },
  { path: '/terrathon/pickleball', changefreq: 'daily',   priority: '0.8' },
  { path: '/terrathon/fifa',       changefreq: 'daily',   priority: '0.8' },
  { path: '/terrathon/schedule',   changefreq: 'daily',   priority: '0.7' },
  // Was missing until 2026-09-21, and nothing caught it. prerender-meta.mjs
  // builds /terrathon/rules with its own title and description and does NOT
  // mark it noIndex, so it is a real indexable page carrying the eligibility
  // cut-off and the refund rule, and the register form's consent line links
  // straight at it. It was simply absent from this array, so no crawler was
  // ever told it exists. verify-sitemap.mjs checks that nothing PRIVATE leaks
  // in; it has no check for a public page being left out, which is why this
  // passed the build for as long as it did.
  { path: '/terrathon/rules',      changefreq: 'weekly',  priority: '0.7' },
  { path: '/terrathon/contact',    changefreq: 'weekly',  priority: '0.6' },

  // AquaTerra.live (events hub). Public pages only; the guest area and the admin are never listed.
  { path: '/live',                 changefreq: 'daily',   priority: '0.9' },
  { path: '/live/disco-diwali',    changefreq: 'daily',   priority: '0.9' },
  { path: '/live/events',          changefreq: 'weekly',  priority: '0.8' },
  // /live/events/<slug> pages are client routes with no prerendered head yet, so they are not listed: a crawler would be shown the
  // homepage's title for each. Add them here together with a prerender entry and a metaConfig key per slug.
  { path: '/live/vault',           changefreq: 'weekly',  priority: '0.6' },
  { path: '/live/why',             changefreq: 'monthly', priority: '0.6' },
  { path: '/live/company',         changefreq: 'monthly', priority: '0.5' },
  { path: '/live/crew',            changefreq: 'monthly', priority: '0.4' },
  { path: '/live/faq',             changefreq: 'weekly',  priority: '0.6' },
  { path: '/live/contact',         changefreq: 'weekly',  priority: '0.6' },
]

const STATIC_PARADOX = [
  { path: '/paradox',            changefreq: 'weekly',  priority: '0.9' },
  { path: '/paradox/events',     changefreq: 'weekly',  priority: '0.8' },
  { path: '/paradox/blog',       changefreq: 'weekly',  priority: '0.8' },
  { path: '/paradox/afterparty', changefreq: 'monthly', priority: '0.7' },
  { path: '/paradox/team',       changefreq: 'monthly', priority: '0.6' },
  { path: '/paradox/contact',    changefreq: 'monthly', priority: '0.6' },
]

// Fallback only — used when the Paradox project's env vars aren't available at
// build time. Seeded May 2026 from the live paradox_blog_posts table.
const PARADOX_BLOG_SLUGS_FALLBACK = [
  'picklejam-paradox-2026',
  'startup-standoff-paradox-2026',
  'the-prodigy-paradox-2026',
  'wicket-wars-paradox-2026',
  'score-for-a-smile-paradox-2026',
  'terramun-paradox-2026',
  'dream-deck-paradox-2026',
  'showstopper-paradox-2026',
  'shutternaut-paradox-2026',
]

// Paths that must never appear in the sitemap (mirrors robots.txt).
// verify-sitemap.mjs re-checks the built file against this same list.
export const EXCLUDED_PREFIXES = [
  '/login', '/_login', '/register', '/auth', '/pending', '/rejected', '/welcome',
  '/profile', '/notifications', '/saved', '/my-posts', '/bugs', '/tasks', '/settings', '/search',
  '/feed', '/director', '/brand', '/dev', '/member/', '/post/',
  '/paradox/admin', '/paradox/scores', '/paradox/updates', '/paradox/register',
  '/paradox/ticket',
  // The TerraThon equivalents, for the same belt-and-braces reason the Paradox
  // three are here: none of them is in STATIC_AQ, so today this changes
  // nothing. It matters the day somebody copies one of the six adjacent
  // TerraThon entries above to add a route and reaches for /terrathon/register
  // by mistake. Without these lines that would ship into the public sitemap
  // AND pass verify-sitemap.mjs's privacy check, because the check consults
  // exactly this list.
  '/terrathon/register', '/terrathon/t', '/terrathon/admin',
]

/**
 * Does `path` fall under an excluded prefix?
 *
 * Segment-aware ON PURPOSE. The naive `path.startsWith(p)` matched `/directory`
 * against `/director` and silently dropped a real, prerendered public page from
 * the sitemap for months - the page existed in dist/ at 15KB and was advertised
 * nowhere. Entries that already end in `/` (`/member/`, `/post/`) are explicit
 * subtree prefixes and keep plain startsWith; the rest match the route itself or
 * a child segment of it, never a longer sibling word.
 *
 * verify-sitemap.mjs imports THIS function rather than re-implementing the test,
 * because it previously carried its own copy of the same bug.
 */
export const isExcludedPath = path =>
  EXCLUDED_PREFIXES.some(p =>
    p.endsWith('/') ? path.startsWith(p) : path === p || path.startsWith(p + '/'))

// ── Small helpers ────────────────────────────────────────────────────────────
const xmlEscape = s =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
           .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

/** ISO timestamp → YYYY-MM-DD, or null if the value isn't a usable date. */
function isoDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  if (d.getTime() > Date.now() + 86_400_000) return null // never emit a future lastmod
  return d.toISOString().slice(0, 10)
}

function urlEntry({ path, changefreq, priority, lastmod }) {
  const out = ['  <url>', `    <loc>${xmlEscape(BASE_URL + path)}</loc>`]
  if (lastmod) out.push(`    <lastmod>${lastmod}</lastmod>`)
  if (changefreq) out.push(`    <changefreq>${changefreq}</changefreq>`)
  if (priority) out.push(`    <priority>${priority}</priority>`)
  out.push('  </url>')
  return out.join('\n')
}

/** Newest lastmod out of a list of entries (used for index pages). */
const newestLastmod = entries =>
  entries.map(e => e.lastmod).filter(Boolean).sort().pop() || null

/**
 * Read-only PostgREST select. Resolves to [] on ANY failure (bad env, network,
 * missing table/column, non-2xx) after logging why — never throws, never exits.
 */
async function select(label, { url, key, table, columns, filter = '', order = '' }) {
  if (!url || !key) {
    console.warn(`   ⚠ SKIPPED ${label}: no Supabase URL/key configured`)
    return []
  }
  const rows = []
  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const qs = `select=${columns}${filter ? `&${filter}` : ''}${order ? `&order=${order}` : ''}`
      const res = await fetch(`${url}/rest/v1/${table}?${qs}`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Range: `${offset}-${offset + PAGE_SIZE - 1}`,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) {
        console.warn(`   ⚠ SKIPPED ${label}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`)
        return rows
      }
      const page = await res.json()
      if (!Array.isArray(page)) {
        console.warn(`   ⚠ SKIPPED ${label}: unexpected response shape`)
        return rows
      }
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
    }
    return rows
  } catch (e) {
    console.warn(`   ⚠ SKIPPED ${label}: ${e?.message || e}`)
    return rows
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function generate() {
  console.log(`Generating sitemap for ${BASE_URL}`)
  console.log(`  data source: ${DB_URL}`)
  console.log(`  paradox source: ${PARADOX_URL || '(not configured — using checked-in slug fallback)'}\n`)

  // ── /projects/:slug ────────────────────────────────────────────────────────
  const projectRows = await select('welfare_projects', {
    url: DB_URL, key: DB_KEY, table: 'welfare_projects',
    columns: 'slug,created_at,workshop_date', filter: 'is_draft=eq.false',
    order: 'created_at.desc',
  })
  // created_at is the day the record was imported (381 pages said 2026-05-01), not the day the page's subject happened. The
  // drive's own date is a real, varied value and is never in the future (isoDate drops a future date); the import date is the
  // fallback for the rare row with none.
  const projectEntries = projectRows
    .filter(r => r.slug)
    .map(r => ({
      path: `/projects/${encodeURIComponent(r.slug)}`,
      changefreq: 'yearly', priority: '0.6', lastmod: isoDate(r.workshop_date) || isoDate(r.created_at),
    }))
  console.log(`   ✓ ${projectEntries.length} project pages`)

  // ── /blog/:slug ────────────────────────────────────────────────────────────
  // Item 4.2: blogs are posts. `status=eq.published` replaces what the old
  // `blogs` RLS did implicitly, and matters MORE here than in the app: a
  // scheduled essay listed in the sitemap is an invitation for a crawler to
  // fetch a page that does not exist yet, and this is exactly the surface where
  // fourteen future-dated essays previously leaked
  // (scheduled_blogs_leak_and_source_kind_2026_09_11.sql).
  const blogRows = await select('blogs', {
    url: DB_URL, key: DB_KEY, table: 'posts',
    columns: 'slug,published_at,created_at',
    // deleted_at too: a soft-deleted blog would otherwise keep a sitemap
    // entry pointing at a page /blog/:slug now 404s for the crawler.
    filter: 'slug=not.is.null&source_kind=eq.blog&status=eq.published&deleted_at=is.null',
    order: 'published_at.desc',
  })
  const blogEntries = blogRows
    .filter(r => r.slug)
    .map(r => ({
      path: `/blog/${encodeURIComponent(r.slug)}`,
      changefreq: 'yearly', priority: '0.6',
      lastmod: isoDate(r.published_at) || isoDate(r.created_at),
    }))
  console.log(`   ✓ ${blogEntries.length} blog posts`)

  // ── /teams/:uuid ───────────────────────────────────────────────────────────
  const teamRows = await select('teams', {
    url: DB_URL, key: DB_KEY, table: 'teams',
    columns: 'uuid,updated_at,created_at', filter: 'is_active=eq.true',
    order: 'created_at.desc',
  })
  const teamEntries = teamRows
    .filter(r => r.uuid)
    .map(r => ({
      path: `/teams/${r.uuid}`,
      changefreq: 'monthly', priority: '0.6',
      lastmod: isoDate(r.updated_at) || isoDate(r.created_at),
    }))
  console.log(`   ✓ ${teamEntries.length} team pages`)

  // ── /teams/:uuid/sub/:slug ──────────────────────────────────────────────
  // 25 real pages that were advertised nowhere. Added 2026-09-17 (audit, SEO
  // P2): SubTeamDetailPage sets its own title, description and BreadcrumbList,
  // but the only inbound link was a <button onClick={navigate(...)}> in the
  // About page org chart, so nothing crawlable pointed at any of them. That
  // button is an <a href> now; this makes them discoverable directly too.
  //
  // The team uuid comes from an embedded select rather than a second query, and
  // BOTH the sub-team and its parent team must be active - a sub-team of an
  // archived team is not a live page.
  const subTeamRows = await select('sub_teams', {
    url: DB_URL, key: DB_KEY, table: 'sub_teams',
    // No updated_at on this table - only created_at. Confirmed against the
    // live schema: asking for it 400s and the section silently empties.
    columns: 'slug,created_at,is_active,sub_team_id,description,teams(uuid,is_active)',
    filter: 'is_active=eq.true',
  })
  // Empty shells (no members, no description) are left out of the sitemap (C-21). Their URLs keep working.
  const subTeamMemberRows = await select('team_member_sub_teams', {
    url: DB_URL, key: DB_KEY, table: 'team_member_sub_teams', columns: 'sub_team_id',
  })
  const populatedSubTeamIds = new Set(subTeamMemberRows.map(r => r.sub_team_id))
  const subTeamEntries = subTeamRows
    .filter(r => r.slug && r.teams?.uuid && r.teams?.is_active)
    .filter(r => populatedSubTeamIds.has(r.sub_team_id) || (r.description && String(r.description).trim()))
    .map(r => ({
      path: `/teams/${r.teams.uuid}/sub/${r.slug}`,
      changefreq: 'monthly', priority: '0.5',
      lastmod: isoDate(r.created_at),
    }))
  console.log(`   ✓ ${subTeamEntries.length} sub-team pages`)

  // ── /opportunities/:id — open roles only (paused/closed ones stop being
  //    linked from the site, so don't advertise them to crawlers) ─────────────
  const openingRows = await select('job_openings', {
    url: DB_URL, key: DB_KEY, table: 'job_openings',
    columns: 'id,updated_at,created_at', filter: 'status=eq.open',
    order: 'created_at.desc',
  })
  const openingEntries = openingRows
    .filter(r => r.id)
    .map(r => ({
      path: `/opportunities/${r.id}`,
      changefreq: 'weekly', priority: '0.7',
      lastmod: isoDate(r.updated_at) || isoDate(r.created_at),
    }))
  console.log(`   ✓ ${openingEntries.length} open opportunities`)

  // ── Paradox dynamic (env-gated) ────────────────────────────────────────────
  const paradoxEventRows = PARADOX_URL
    ? await select('paradox_events', {
        url: PARADOX_URL, key: PARADOX_KEY, table: 'paradox_events', columns: 'slug',
      })
    : []
  const paradoxEventEntries = paradoxEventRows
    .filter(r => r.slug)
    .map(r => ({ path: `/paradox/events/${encodeURIComponent(r.slug)}`, changefreq: 'monthly', priority: '0.7' }))

  const paradoxBlogRows = PARADOX_URL
    ? await select('paradox_blog_posts', {
        url: PARADOX_URL, key: PARADOX_KEY, table: 'paradox_blog_posts',
        columns: 'slug,published_at', filter: 'published=eq.true',
      })
    : []
  const paradoxBlogEntries = paradoxBlogRows.length
    ? paradoxBlogRows.filter(r => r.slug).map(r => ({
        path: `/paradox/blog/${encodeURIComponent(r.slug)}`,
        changefreq: 'yearly', priority: '0.7', lastmod: isoDate(r.published_at),
      }))
    : PARADOX_BLOG_SLUGS_FALLBACK.map(slug => ({
        path: `/paradox/blog/${slug}`, changefreq: 'yearly', priority: '0.7',
      }))
  const paradoxBlogSource = paradoxBlogRows.length ? 'live' : 'checked-in fallback list'
  console.log(`   ✓ ${paradoxEventEntries.length} paradox event pages`)
  console.log(`   ✓ ${paradoxBlogEntries.length} paradox blog posts (${paradoxBlogSource})`)

  // ── Static routes; index pages inherit their children's newest real date ──
  const inheritedLastmod = {
    '/projects': newestLastmod(projectEntries),
    '/blog': newestLastmod(blogEntries),
    '/teams': newestLastmod(teamEntries),
    '/opportunities': newestLastmod(openingEntries),
  }
  const staticAqEntries = STATIC_AQ.map(s => ({ ...s, lastmod: inheritedLastmod[s.path] || null }))
  const staticParadoxEntries = STATIC_PARADOX.map(s => ({
    ...s,
    lastmod: s.path === '/paradox/blog' ? newestLastmod(paradoxBlogEntries) : null,
  }))

  // ── Assemble, de-dupe, and defend the exclusion list ──────────────────────
  const sections = [
    ['AQUATERRA STATIC', staticAqEntries],
    ['AQUATERRA BLOG POSTS', blogEntries],
    ['WELFARE PROJECT PAGES', projectEntries],
    ['TEAM PAGES', teamEntries],
    ['SUB-TEAM PAGES', subTeamEntries],
    ['OPEN OPPORTUNITIES', openingEntries],
    ['PARADOX STATIC', staticParadoxEntries],
    ['PARADOX EVENT PAGES', paradoxEventEntries],
    ['PARADOX BLOG POSTS', paradoxBlogEntries],
  ]

  const seen = new Set()
  let dropped = 0
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9',
    '        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">',
    '',
    `  <!-- Generated ${new Date().toISOString()} by scripts/generate-sitemap.mjs -->`,
  ]

  let total = 0
  for (const [label, entries] of sections) {
    const kept = entries.filter(e => {
      if (seen.has(e.path)) return false
      if (isExcludedPath(e.path)) { dropped++; return false }
      seen.add(e.path)
      return true
    })
    if (!kept.length) continue
    lines.push('', `  <!-- ━━━ ${label} (${kept.length}) ━━━ -->`, ...kept.map(urlEntry))
    total += kept.length
  }
  lines.push('', '</urlset>', '')

  // ── Shrink guard ──────────────────────────────────────────────────────────
  // Every dynamic fetch above fails SOFT (⚠ SKIPPED + continue). That's right
  // for one flaky table, but if the DB is unreachable entirely, every section is
  // skipped and we'd happily overwrite a good 594-URL sitemap with the ~31
  // static routes — silently, with exit 0. That really happened (the 594→31
  // collapse committed in d3d703e during a network outage).
  // So: never let a run replace a materially bigger existing sitemap. Keep the
  // old file and warn instead. A genuine large deletion can still be applied by
  // deleting public/sitemap.xml first, or by re-running once the DB is back.
  try {
    const existing = readFileSync(OUT_PATH, 'utf8')
    const existingCount = (existing.match(/<url>/g) || []).length
    if (existingCount > 0 && total < existingCount * 0.6) {
      console.warn(
        `\n⚠ REFUSING to overwrite sitemap: would drop ${existingCount} → ${total} URLs ` +
        `(${Math.round((1 - total / existingCount) * 100)}% smaller).`)
      console.warn('  This almost always means the Supabase fetches were skipped (see ⚠ above),')
      console.warn('  not that the content actually disappeared. Keeping the existing sitemap.')
      // Keep the URLs, but refresh the `Generated <iso>` stamp. verify-sitemap.mjs
      // hard-fails on a stale stamp ("was NOT regenerated by this build") — the
      // right signal for a silent no-op, wrong here, where preserving good
      // content is a deliberate decision. URLs unchanged, clock reset.
      //
      // BUT the re-stamp used to be the ONLY trace: the artifact then claimed to
      // be freshly generated and nothing downstream could tell otherwise, so a
      // sitemap preserved through a dozen failed runs read as current every time.
      // Preserving the content stays; pretending it is fresh does not. We now
      // also write a PRESERVED marker carrying the real age and the original
      // stamp, which verify-sitemap.mjs surfaces as a loud warning (not a
      // failure - failing here would defeat the whole point of preserving).
      const priorStamp = (existing.match(/Generated (\d{4}-\d{2}-\d{2}T[\d:.]+Z)/) || [])[1]
      const restamped = existing
        .replace(/\s*<!-- PRESERVED [^>]*-->/g, '')
        .replace(
          /Generated \d{4}-\d{2}-\d{2}T[\d:.]+Z/,
          `Generated ${new Date().toISOString()}`)
        .replace(/<urlset([^>]*)>/,
          `<urlset$1>
  <!-- PRESERVED from a previous run (this build fetched only ${total} URLs). ` +
          `Content last genuinely generated ${priorStamp || 'at an unknown time'}. -->`)
      writeFileSync(OUT_PATH, restamped, 'utf8')
      console.warn(`  Kept ${existingCount} URLs, refreshed the build stamp, and marked the file PRESERVED.`)
      return
    }
  } catch { /* no existing sitemap — first run, just write it */ }

  writeFileSync(OUT_PATH, lines.join('\n'), 'utf8')

  console.log(`\n✅ Wrote public/sitemap.xml — ${total} URLs`)
  if (dropped) console.log(`   (${dropped} URL(s) dropped for matching an excluded/private prefix)`)
  const withLastmod = [...sections].reduce(
    (n, [, es]) => n + es.filter(e => e.lastmod).length, 0)
  console.log(`   ${withLastmod} carry a real <lastmod> from a row timestamp`)
}

// Never fail the build on a sitemap problem — log loudly and exit 0 with
// whatever we managed to write. verify-sitemap.mjs is the hard gate.
generate().catch(e => {
  console.error('⚠ Sitemap generation hit an unexpected error:', e)
  try {
    const fallback = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      `  <!-- Generated ${new Date().toISOString()} (static-only fallback) -->`,
      // Same exclusion filter as the happy path. Without it the fallback emitted
      // whatever STATIC_* happened to contain, and verify-sitemap.mjs hard-fails
      // on an excluded path - so the one code path that exists to survive an
      // outage was itself capable of failing the build it was protecting.
      ...[...STATIC_AQ, ...STATIC_PARADOX].filter(e => !isExcludedPath(e.path)).map(urlEntry),
      '</urlset>',
      '',
    ].join('\n')
    writeFileSync(OUT_PATH, fallback, 'utf8')
    console.error(`   Wrote static-only fallback sitemap (${STATIC_AQ.length + STATIC_PARADOX.length} URLs)`)
  } catch (writeErr) {
    console.error('   Could not write fallback sitemap either:', writeErr)
  }
  process.exit(0)
})
