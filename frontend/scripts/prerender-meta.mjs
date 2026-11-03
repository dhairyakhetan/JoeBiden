/**
 * AquaTerra per-route prerender — <head> AND crawlable <body>
 * ────────────────────────────────────────────────────────────────────────────
 * Run:  node scripts/prerender-meta.mjs   (runs as the last step of `npm run build`)
 * Reads: frontend/dist/index.html   (the built SPA shell)
 * Reads: frontend/src/lib/metaConfig.ts   (single source of truth for meta)
 * Out:  frontend/dist/<route>.html   (one per static public route)
 *
 * WHY THIS EXISTS
 * ───────────────
 * The live app is a client-rendered Vite + React SPA. `vercel.json` rewrites
 * every unmatched path to /index.html, so a non-JS consumer — a social unfurler
 * (Facebook / LinkedIn / WhatsApp / X), a plain crawler, or an LLM bot — hitting
 * a deep link like /about gets the *homepage's* <head> (title, description,
 * og:*). The runtime `useMeta` hook only rewrites the head AFTER React boots, so
 * it never runs for those consumers.
 *
 * This script copies dist/index.html per route and swaps in that route's
 * <title>, description, canonical, og:* and twitter:* (sourced from
 * metaConfig.ts — imported, never duplicated), plus a BreadcrumbList JSON-LD.
 *
 * IT ALSO WRITES A REAL <body>. (It used to be head-only. A measurement of the
 * built output found every one of the 602 sitemap URLs served
 * `<div id="root"></div>` and ZERO characters of visible text — so:
 *   • Google had to queue each URL for a separate JS-render pass before it saw
 *     any content at all, which at 600 URLs is slow and lossy; and
 *   • the AI crawlers this repo goes to real trouble to welcome — GPTBot,
 *     ClaudeBot, PerplexityBot, OAI-SearchBot, each with its own hand-written
 *     group in public/robots.txt, plus a public/llms.txt — mostly do NOT execute
 *     JS. They were fetching /about and receiving an empty div. That entire
 *     effort was returning nothing.
 *   • With no body there were also no <a> tags, so the HTML contained zero
 *     internal links: nothing for a crawler to follow and no way for link
 *     equity to move between pages. Discovery depended entirely on the sitemap.
 *
 * WHY NO HEADLESS BROWSER
 * ───────────────────────
 * The dynamic-route pass below already fetches the real record content from
 * Supabase (blog body, project summary, team description) in order to build
 * descriptions. That is the same content a browser snapshot would produce, so
 * booting Playwright/Puppeteer in CI would add minutes of build time, a browser
 * binary, and a new flake surface to obtain something we already hold in memory.
 * We render it to semantic HTML directly instead.
 *
 * WHY THERE IS NO HYDRATION RISK
 * ──────────────────────────────
 * src/main.tsx uses `createRoot(...).render(...)`, NOT `hydrateRoot`. React
 * discards whatever is inside #root and mounts fresh, so the prerendered body
 * can differ from the client render without warnings or mismatch errors. It is
 * a crawler payload and a first-paint placeholder, not a hydration source. Do
 * not switch main.tsx to hydrateRoot without rewriting this to match the real
 * component output exactly.
 *
 * SCOPE
 * ─────
 *  • The 16 static public routes below, PLUS three dynamic per-record route
 *    families: /blog/:slug, /projects/:slug, /teams/:uuid (see "DYNAMIC
 *    ROUTES" below) — the biggest remaining non-JS-crawler gap, since the
 *    sitemap has advertised these 500+ URLs while they served the homepage's
 *    head. `/` is intentionally NOT rewritten here: dist/index.html already
 *    carries hand-tuned homepage meta + all the Organization/WebSite/Dataset
 *    JSON-LD, and the homepage never suffered the deep-link leak (it IS the
 *    default). Every generated file inherits that org-level JSON-LD for free.
 *  • /opportunities/:id, /member/:uuid, /post/:uuid stay OUT of scope:
 *    /member and /post are deliberately excluded from the sitemap too (see
 *    generate-sitemap.mjs — real students, many minors, and member-authored
 *    permalinks respectively); /opportunities/:id churns fast (open/paused/
 *    closed) and is lower-value than the other three. The SPA fallback
 *    (/(.*) → /index.html) keeps serving all three.
 *  • Authed/desk/auth routes and the entire /paradox sub-app are excluded.
 *
 * STATIC ROUTES must never ship a silently-unmodified copy: every head
 * replacement is asserted to have matched, and a missing match throws (fails
 * the build) — these 16 pages are few, fixed, and cheap to keep strict about.
 *
 * DYNAMIC ROUTES (blog/project/team) fail SOFT instead, matching
 * generate-sitemap.mjs's philosophy one script over in this same pipeline: a
 * live DB hiccup here shouldn't fail the whole deploy over an SEO enhancement
 * — worst case degrades back to today's behavior (SPA fallback + homepage
 * head) for whichever records couldn't be fetched, logged loudly as SKIPPED
 * rather than silently.
 */

import './loadEnv.mjs'   // must precede any process.env read
import { terraNotesPages, terraNotesLlms } from './terranotes/prerender.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { build } from 'esbuild'

const __dir = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dir, '../dist')
const INDEX_HTML = join(DIST, 'index.html')
const META_TS = join(__dir, '../src/lib/metaConfig.ts')

// Same canonical origin as useMeta.ts (CANONICAL_ORIGIN) and the sitemap script.
const ORIGIN = (process.env.SITE_URL || 'https://www.ngoaquaterra.com').replace(/\/+$/, '')

// Same DB env resolution + literal anon-key fallback as generate-sitemap.mjs,
// which runs earlier in the same `npm run build` pipeline against the same
// community/CMS Supabase project (welfare_projects/blogs/teams all live here
// since the projects were consolidated).
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
const FETCH_TIMEOUT_MS = 15_000
const PAGE_SIZE = 1000

/** Read-only PostgREST select - resolves to [] on ANY failure, never throws. Mirrors generate-sitemap.mjs's `select()`. */
async function select(label, { table, columns, filter = '' }) {
  // Mirrors generate-sitemap.mjs: no key means skip, not a 401 storm. The
  // literal key fallback that used to make this unreachable was removed - see
  // the comment on DB_KEY there.
  if (!DB_URL || !DB_KEY) {
    console.warn(`   ⚠ SKIPPED ${label}: no Supabase URL/key configured`)
    return []
  }
  const rows = []
  try {
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const qs = `select=${columns}${filter ? `&${filter}` : ''}`
      const res = await fetch(`${DB_URL}/rest/v1/${table}?${qs}`, {
        headers: { apikey: DB_KEY, Authorization: `Bearer ${DB_KEY}`, Range: `${offset}-${offset + PAGE_SIZE - 1}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })
      if (!res.ok) {
        console.warn(`   ⚠ SKIPPED ${label}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`)
        return rows
      }
      const page = await res.json()
      if (!Array.isArray(page)) { console.warn(`   ⚠ SKIPPED ${label}: unexpected response shape`); return rows }
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
    }
    return rows
  } catch (e) {
    console.warn(`   ⚠ SKIPPED ${label}: ${e?.message || e}`)
    return rows
  }
}

/** ~158-char trim at a word boundary - matches metaTrim() duplicated across BlogPostPage/PublicProjectDetailPage/TeamDetailPage. */
function metaTrim(s, max = 158) {
  const clean = (s || '').replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  if (clean.length <= max) return clean
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '').trimEnd() + '…'
}

/** Framer CDN downscale - matches lib/imageUrl.ts's sized(url, 'cover') (1600px longer edge). Every other host passes through untouched. */
function sizedCover(url) {
  if (!url || typeof url !== 'string') return ''
  if (!url.includes('framerusercontent.com/images/') || url.includes('scale-down-to=')) return url
  return `${url}${url.includes('?') ? '&' : '?'}scale-down-to=1600`
}

/**
 * The static public routes to prerender, each mapped to a short breadcrumb
 * label (the ONLY per-route string that isn't in metaConfig — titles and
 * descriptions are read from metaConfig, never duplicated here). The metaConfig
 * ENTRY is matched by its `path`, so we never hardcode metaConfig key names.
 * `/` is deliberately absent — see the header comment.
 */
const ROUTES = [
  { path: '/about',          label: 'About' },
  { path: '/projects',       label: 'Projects' },
  { path: '/blog',           label: 'Blog' },
  { path: '/teams',          label: 'Teams' },
  { path: '/opportunities',  label: 'Opportunities' },
  { path: '/members',        label: 'Members' },
  { path: '/contact',        label: 'Contact' },
  { path: '/faq',            label: 'FAQ' },
  { path: '/support',        label: 'Support' },
  { path: '/collaborations', label: 'Collaborations' },
  { path: '/volunteer',      label: 'Volunteer' },
  { path: '/links',          label: 'Quick Links' },
  { path: '/schools',        label: 'Schools' },
  { path: '/classes',        label: 'Classes' },
  { path: '/crftd',         label: 'Crftd' },
  { path: '/privacy-policy', label: 'Privacy Policy' },
  { path: '/equity-policy',  label: 'Equity Policy', noIndex: true },
  { path: '/games',          label: 'Mini Games' },
  // Redesign 2026-09: two new public surfaces, sections 33 and 27.
  { path: '/directory',      label: 'Everything at AQ' },
  { path: '/join',           label: 'Join AquaTerra' },
  { path: '/accounts',       label: 'Open Books' },
  // AquaTerra.live (events hub), docs/plans/aquaterra-live.md
  { path: '/live',          label: 'AquaTerra.live' },
  { path: '/live/disco-diwali', label: 'Disco Diwali 2026' },
  { path: '/live/events',     label: 'AquaTerra.live Events' },
  { path: '/live/vault',      label: 'AquaTerra.live Vault' },
  { path: '/live/why',        label: 'AquaTerra.live Why we host' },
  { path: '/live/company',    label: 'AquaTerra.live Good company' },
  { path: '/live/crew',       label: 'AquaTerra.live Crew' },
  { path: '/live/faq',      label: 'AquaTerra.live FAQ' },
  { path: '/live/contact',  label: 'AquaTerra.live Contact' },
  // TerraThon 2026. Nested paths, unlike every route above: the loop below
  // mkdir -p's for them. These matter more than most, because the whole
  // audience arrives from a link shared into a WhatsApp group.
  { path: '/terrathon',            label: 'TerraThon 2026' },
  { path: '/terrathon/cricket',    label: 'TerraThon Cricket' },
  { path: '/terrathon/pickleball', label: 'TerraThon Pickleball' },
  { path: '/terrathon/fifa',       label: 'TerraThon FIFA' },
  { path: '/terrathon/schedule',   label: 'TerraThon Schedule' },
  { path: '/terrathon/contact',    label: 'TerraThon Contact' },
  { path: '/terrathon/rules',      label: 'TerraThon Rules' },
  // Prerendered for the link preview, `noIndex` because a form is not a search
  // result. The three sport paths are the per-sport Instagram links, which
  // pre-fill the sport — the most-pasted URLs of the campaign, and until now
  // they all previewed as the generic AquaTerra homepage card.
  { path: '/terrathon/register',            label: 'TerraThon Register',    noIndex: true },
  { path: '/terrathon/register/cricket',    label: 'Enter Cricket',        noIndex: true },
  { path: '/terrathon/register/pickleball', label: 'Enter Pickleball',     noIndex: true },
  { path: '/terrathon/register/fifa',       label: 'Enter FIFA',           noIndex: true },
]

/** HTML-escape a value for use inside a double-quoted attribute or text node. */
const esc = s =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/* ══════════════════════════════════════════════════════════════════════════
   CRAWLABLE BODY
   ─────────────────────────────────────────────────────────────────────────
   Everything below builds the HTML that goes inside #root. Three rules it
   has to keep:

   1. It must say the SAME THING the real page says. This is a summary of the
      page's own content, never extra keywords — serving crawlers text that
      users don't get is cloaking, and it is also just dishonest.
   2. It must be semantic: one <h1>, real <a href> internal links, <article>
      for records. The links matter as much as the text — they are what let a
      crawler walk the site and what lets ranking signal flow between pages.
   3. It must be plain. React throws it away on mount, so anything elaborate
      is wasted bytes on every request and a bigger paint to discard.
   ══════════════════════════════════════════════════════════════════════════ */

/** Site-wide links, emitted on every prerendered page. Previously the served
 *  HTML contained no <a> at all, so this is the whole internal link graph. */
const SITE_LINKS = [
  ['/', 'Home'], ['/about', 'About AquaTerra'], ['/projects', 'Welfare projects'],
  ['/teams', 'Student teams'], ['/blog', 'Groundwork Diaries'], ['/members', 'Members'],
  ['/opportunities', 'Open roles'], ['/volunteer', 'Volunteer handbook'],
  ['/collaborations', 'Collaborate'], ['/schools', 'Schools'], ['/classes', 'Classes'],
  ['/crftd', 'Crftd'], ['/support', 'Support us'], ['/faq', 'FAQ'], ['/contact', 'Contact'],
]

/** Markdown-ish body text → escaped paragraphs. Blog bodies carry #, *, > and
 *  backticks; strip the syntax, keep the prose, cap the payload so a very long
 *  post doesn't bloat every byte of the served document. */
function toParagraphs(raw, maxChars = 2400) {
  const clean = String(raw || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')   // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links → their text
    .replace(/[#>*_`~]/g, '')
    .replace(/\r/g, '')
  const capped = clean.length > maxChars
    ? clean.slice(0, maxChars).replace(/\s+\S*$/, '') + '…'
    : clean
  return capped
    .split(/\n{2,}/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(p => `<p>${esc(p)}</p>`)
    .join('')
}

/** ISO timestamp → "12 September 2025". Bylines were emitting the raw
 *  `2025-09-12T00:00:00+00:00` straight out of the column. */
function humanDate(v) {
  if (!v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function linkList(links) {
  return `<nav aria-label="AquaTerra"><ul>${
    links.map(([href, label]) => `<li><a href="${esc(href)}">${esc(label)}</a></li>`).join('')
  }</ul></nav>`
}

/**
 * Assemble the #root payload.
 *  heading  — the page's <h1>
 *  intro    — one-paragraph summary (the meta description for static routes,
 *             the real summary/body for records)
 *  extra    — optional record body HTML
 *  links    — internal links to emit after the content
 */
function buildBody({ heading, intro, extra = '', links = SITE_LINKS }) {
  return [
    '<div data-prerender="body">',
    '<main>',
    `<h1>${esc(heading)}</h1>`,
    intro ? `<p>${esc(intro)}</p>` : '',
    extra,
    '</main>',
    linkList(links),
    '</div>',
  ].join('')
}

/**
 * The first-paint skeleton, styled by index.html's own inline <style>
 * (`.pr-skel*` — see that file for why the CSS lives there and not here).
 * Purely decorative chrome over the real crawlable body below it: same
 * markup on every route, `aria-hidden` so it's invisible to assistive tech,
 * and gone the instant React mounts (`createRoot(root).render()` replaces
 * every child of #root, this sibling included — see injectBody below).
 */
const SKELETON = [
  '<div class="pr-skel" aria-hidden="true">',
  '<div class="pr-skel-nav">',
  '<span class="pr-skel-dot"></span>',
  '<span class="pr-skel-pill" style="width:52px"></span>',
  '<span class="pr-skel-pill" style="width:68px"></span>',
  '<span class="pr-skel-pill" style="width:58px"></span>',
  '<span class="pr-skel-pill"></span>',
  '</div>',
  '<div class="pr-skel-main">',
  '<div class="pr-skel-brand"><span class="pr-skel-live"></span><span class="pr-skel-word">AQUATERRA</span></div>',
  '<span class="pr-skel-bar pr-skel-bar-xl" style="width:86%"></span>',
  '<span class="pr-skel-bar pr-skel-bar-xl" style="width:56%"></span>',
  '<span class="pr-skel-bar" style="width:94%"></span>',
  '<span class="pr-skel-bar" style="width:72%"></span>',
  '<div class="pr-skel-row">',
  '<span class="pr-skel-chip"></span><span class="pr-skel-chip"></span><span class="pr-skel-chip"></span><span class="pr-skel-chip"></span>',
  '</div>',
  '</div>',
  '</div>',
].join('')

/** Put the payload inside #root. Throws if the shell changed shape, because a
 *  silent no-match here would quietly restore the empty-body bug this fixes. */
function injectBody(html, bodyHtml, { skeleton = true } = {}) {
  const ROOT = '<div id="root"></div>'
  if (!html.includes(ROOT)) {
    throw new Error('prerender: could not find `<div id="root"></div>` in dist/index.html (shell layout changed?)')
  }
  return html.replace(ROOT, `<div id="root">${skeleton ? SKELETON : ''}${bodyHtml}</div>`)
}

/**
 * Import metaConfig.ts from Node by bundling it to ESM in-memory and importing
 * the result via a data: URL. This is the "run it through esbuild so it can
 * import the TS — don't hardcode the strings" path.
 *
 * Was a plain `transform()` (type-strip only, no bundling) back when
 * metaConfig.ts had zero imports of its own. changelog/21-org-facts.md added
 * `import { ORG_FACTS, displayCount } from './orgFacts'` to metaConfig.ts (no
 * literals in meta descriptions), and a bare type-strip leaves that relative
 * specifier in the output — which then fails to resolve, because the code is
 * imported from a `data:` URL, not a real file path, and `./orgFacts` has
 * nothing to be relative TO. `bundle: true` against the REAL on-disk entry
 * point is what makes esbuild resolve and inline that import (and any future
 * one metaConfig.ts or its dependencies pick up) before the data: URL import
 * ever sees it. Both files have zero node_modules dependencies, so this stays
 * a fast, pure in-memory bundle — no bigger than the previous transform.
 */
async function loadMetaConfig() {
  const result = await build({
    entryPoints: [META_TS],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  })
  const code = result.outputFiles[0].text
  const mod = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(code))
  if (!mod.pageMetadata) throw new Error('metaConfig.ts did not export pageMetadata')
  return mod.pageMetadata
}

/**
 * Append tags immediately before </head>.
 *
 * Used for anything index.html does NOT carry a default of. The canonical moved
 * here (audit 2026-09-17): the shell used to hardcode
 * `<link rel="canonical" href="https://www.ngoaquaterra.com" />` purely so this
 * script had something to replace, which meant every route the prerenderer does
 * NOT cover - /post/:uuid, /member/:uuid, /opportunities/:id, /teams/:uuid/sub/:slug
 * and all of /paradox/* - shipped a canonical pointing at the homepage. To a
 * crawler that is a claim those pages ARE the homepage. Absence is the correct
 * default: a page with no canonical self-canonicalises, and useMeta still sets
 * the right one at runtime for JS consumers.
 */
function injectHead(html, tags) {
  const block = (Array.isArray(tags) ? tags : [tags]).filter(Boolean).join('\n    ')
  if (!block) return html
  // LAST occurrence, not the first. index.html's own comments discuss the head
  // closing tag in prose, and a naive replace() matched the one inside a comment
  // and injected the canonical where it was inert. A silently dead tag is worse
  // than the wrong tag it replaced. The real closer is always the last one.
  const at = html.lastIndexOf('</head>')
  if (at === -1) {
    throw new Error('prerender: no head closing tag to inject into (index.html layout changed?)')
  }
  return html.slice(0, at) + '  ' + block + '\n  ' + html.slice(at)
}

/** Replace exactly one occurrence, throwing if the pattern never matched. */
function replaceOnce(html, re, replacement, name) {
  if (!re.test(html)) {
    throw new Error(`prerender: could not find <head> tag to replace: ${name} (index.html layout changed?)`)
  }
  return html.replace(re, () => replacement)
}

function buildBreadcrumbLd(label, path) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
      { '@type': 'ListItem', position: 2, name: label, item: `${ORIGIN}${path}` },
    ],
  }
}

/**
 * Produce the route's HTML: index.html with a route-specific <head>.
 * `opts.image`/`opts.imageAlt`/`opts.type` are for dynamic per-record routes
 * with a real content image - when omitted (every static route), og:image
 * and og:type are left as index.html's defaults, matching the previous
 * behavior exactly (those routes all have image:'' in metaConfig, so the
 * shared 1200×630 og-meadow.jpg is already the best card - SEO audit,
 * 2026-09-24: this comment used to name og-image.png, an unreferenced
 * leftover from an earlier default-image era; useMeta.ts/index.html's real
 * DEFAULT_OG_IMAGE has been og-meadow.jpg for a while, and public/og-image.png
 * itself has been deleted).
 */
function renderRoute(indexHtml, meta, label, path, opts = {}) {
  const title = meta.title
  const description = meta.description
  const canonical = `${ORIGIN}${path}`

  let html = indexHtml
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/,
    `<title>${esc(title)}</title>`, 'title')
  html = replaceOnce(html, /<meta name="description"[^>]*>/,
    `<meta name="description" content="${esc(description)}" />`, 'meta description')
  // Canonical is INJECTED, not replaced - index.html no longer carries one, so
  // unprerendered routes self-canonicalise instead of claiming to be the
  // homepage. See injectHead's comment.
  //
  // A route may opt OUT of indexing (currently only /equity-policy, which
  // publishes five named students' personal mobile numbers). The prerendered
  // HTML is what a crawler reads FIRST - before any JS runs - so useMeta's
  // client-side robots tag alone would not stop it. `follow` is deliberate:
  // crawlers still traverse the outbound links.
  //
  // NOTE: a noindex default in the shell was considered and rejected. Nothing
  // clears it on /paradox/*, which sets no per-page metadata at all, so it would
  // have silently deindexed all 15 Paradox URLs the sitemap advertises.
  html = injectHead(html, [
    `<link rel="canonical" href="${esc(canonical)}" />`,
    opts.noIndex ? '<meta name="robots" content="noindex, follow" />' : '',
  ])
  html = replaceOnce(html, /<meta property="og:title"[^>]*>/,
    `<meta property="og:title" content="${esc(title)}" />`, 'og:title')
  html = replaceOnce(html, /<meta property="og:description"[^>]*>/,
    `<meta property="og:description" content="${esc(description)}" />`, 'og:description')
  html = replaceOnce(html, /<meta property="og:url"[^>]*>/,
    `<meta property="og:url" content="${esc(canonical)}" />`, 'og:url')
  html = replaceOnce(html, /<meta name="twitter:title"[^>]*>/,
    `<meta name="twitter:title" content="${esc(title)}" />`, 'twitter:title')
  html = replaceOnce(html, /<meta name="twitter:description"[^>]*>/,
    `<meta name="twitter:description" content="${esc(description)}" />`, 'twitter:description')

  if (opts.type) {
    html = replaceOnce(html, /<meta property="og:type"[^>]*>/,
      `<meta property="og:type" content="${esc(opts.type)}" />`, 'og:type')
  }

  if (opts.image) {
    const alt = opts.imageAlt || title
    html = replaceOnce(html, /<meta property="og:image"[^>]*>/,
      `<meta property="og:image" content="${esc(opts.image)}" />`, 'og:image')
    html = replaceOnce(html, /<meta property="og:image:secure_url"[^>]*>/,
      `<meta property="og:image:secure_url" content="${esc(opts.image)}" />`, 'og:image:secure_url')
    html = replaceOnce(html, /<meta property="og:image:alt"[^>]*>/,
      `<meta property="og:image:alt" content="${esc(alt)}" />`, 'og:image:alt')
    // width/height/type stay index.html's 1200×630 JPEG declaration only for
    // the shared default - an arbitrary record image's real dimensions are
    // unknown here, so those three tags are dropped rather than lying about
    // them (matches runtime useMeta.ts, which never declares them either).
    html = html
      .replace(/\s*<meta property="og:image:type"[^>]*>\n?/, '\n')
      .replace(/\s*<meta property="og:image:width"[^>]*>\n?/, '\n')
      .replace(/\s*<meta property="og:image:height"[^>]*>\n?/, '\n')
    html = replaceOnce(html, /<meta name="twitter:image"[^>]*>/,
      `<meta name="twitter:image" content="${esc(opts.image)}" />`, 'twitter:image')
    html = replaceOnce(html, /<meta name="twitter:image:alt"[^>]*>/,
      `<meta name="twitter:image:alt" content="${esc(alt)}" />`, 'twitter:image:alt')
  }

  // Per-route BreadcrumbList, layered on top of the Organization/WebSite/Dataset
  // JSON-LD every generated file already inherits from index.html.
  //
  // `opts.jsonLd` carries anything richer the caller can build from the record it
  // already fetched: BlogPosting for a post, Article for a welfare project. Until
  // 2026-09-17 (audit, SEO P2) none of that reached the prerendered files - the
  // app emits it at runtime via useJsonLd, so it existed only for consumers that
  // execute JS, which is precisely the set of crawlers this pipeline exists to
  // serve without. 570 content pages carried BreadcrumbList and nothing else.
  const ldBlocks = [['breadcrumb', buildBreadcrumbLd(label, path)]]
  ;(opts.jsonLd || []).forEach((node, i) => { if (node) ldBlocks.push([`ld-${i}`, node]) })
  // Through injectHead, which targets the LAST head-closing tag. A bare
  // html.replace('</head>', ...) takes the FIRST, and index.html's own comments
  // have contained that tag in prose - that exact mistake silently buried a
  // canonical inside a comment earlier in this same audit.
  html = injectHead(html, ldBlocks.map(([id, node]) =>
    `<script type="application/ld+json" data-prerender="${id}">${JSON.stringify(node)}</script>`))

  // The crawlable body. `opts.body` lets a record route pass its real content;
  // static routes fall back to their own title + description, which is the
  // page's actual subject stated once, not invented copy. The title's
  // "| AquaTerra" / "· AquaTerra" suffix is dropped from the <h1> — it reads as
  // a document title, not a heading, and the brand is already in <title>.
  html = injectBody(html, opts.body || buildBody({
    heading: title.split(/\s*[|·]\s*/)[0].trim() || label,
    intro: description,
  }), { skeleton: !opts.noSkeleton })

  return html
}

async function main() {
  let indexHtml
  try {
    indexHtml = readFileSync(INDEX_HTML, 'utf8')
  } catch {
    throw new Error(`prerender: ${INDEX_HTML} not found — run this AFTER \`vite build\`.`)
  }

  const pageMetadata = await loadMetaConfig()
  const byPath = new Map(Object.values(pageMetadata).map(m => [m.path, m]))

  console.log(`Prerendering per-route <head> for ${ROUTES.length} static public routes → dist/`)

  let written = 0
  const evidence = []
  for (const { path, label, noIndex } of ROUTES) {
    const meta = byPath.get(path)
    if (!meta) {
      throw new Error(`prerender: no metaConfig entry with path "${path}"`)
    }
    const outName = `${path.slice(1)}.html` // '/about' → 'about.html'
    const outPath = join(DIST, outName)
    // Nested static routes ('/terrathon/cricket' → 'terrathon/cricket.html')
    // need their directory to exist. Vercel checks the filesystem before
    // rewrites, so this file is what a crawler and a WhatsApp link-preview
    // fetcher actually get; the SPA still serves the live route to a browser.
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, renderRoute(indexHtml, meta, label, path, { noIndex }), 'utf8')
    written++
    evidence.push(`   ✓ ${outName.padEnd(20)} ${meta.title}`)
  }

  console.log(evidence.join('\n'))

  // ── Dynamic per-record routes: /blog/:slug, /projects/:slug, /teams/:uuid ──
  // Same head-swap as the static routes above, but per-record content sourced
  // live from Supabase, and one write per row instead of one per fixed path.
  // Any fetch failure here is logged + skipped, never thrown - see the
  // "DYNAMIC ROUTES" note in the file header for why.
  let dynWritten = 0

  // Item 4.2: blogs are posts. Field-for-field the same page, read from the
  // new home - `headliner`→`title`, `body`→`article_body` (NOT `body`, which
  // for a blog is the short feed excerpt and would prerender a stub as the
  // article), `written_by`/`minutes_of_read`→`article` jsonb, and the cover
  // out of the embedded `post_images` rather than a column.
  //
  // `status=eq.published` is load-bearing here: a scheduled essay prerendered
  // to dist/ is a static HTML file of unpublished writing, served to anyone who
  // guesses the URL and indexable by any crawler that finds it. That is a worse
  // version of the leak this whole pass exists to close.
  const blogRows = await select('blogs', {
    table: 'posts',
    columns: 'slug,title,article_body,article,published_at,created_at,post_images(blob_url,display_order)',
    // deleted_at too: without it a soft-deleted blog keeps a STATIC html file
    // in dist/, served to anyone with the URL long after the desk deleted it.
    filter: 'slug=not.is.null&source_kind=eq.blog&status=eq.published&deleted_at=is.null',
  })
  for (const b of blogRows) {
    if (!b.slug) continue
    const path = `/blog/${b.slug}`
    const meta = {
      title: `${b.title} | AquaTerra Groundwork Diaries`,
      description: metaTrim((b.article_body || '').replace(/[#>*_`]/g, ''))
        || `${b.title} — a field story from AquaTerra's Groundwork Diaries, by the students who were there in Kolkata.`,
    }
    // Lowest display_order wins: the migrated cover was inserted at 0.
    const cover = (b.post_images || [])
      .filter(i => i && i.blob_url)
      .sort((x, y) => (x.display_order ?? 0) - (y.display_order ?? 0))[0]
    const byline = (b.article && b.article.byline) || ''
    const image = sizedCover(cover && cover.blob_url)
    // BlogPosting built from the row already in hand. Every field is real: no
    // invented author, no fabricated dateModified. `byline` is often empty, in
    // which case the organisation is the author, which is true of the
    // Groundwork Diaries.
    const blogLd = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: b.title,
      description: meta.description,
      url: `${ORIGIN}${path}`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${ORIGIN}${path}` },
      ...(image ? { image } : {}),
      ...(b.published_at || b.created_at
        ? { datePublished: String(b.published_at || b.created_at).slice(0, 10) } : {}),
      author: byline
        ? { '@type': 'Person', name: byline }
        : { '@type': 'Organization', name: 'AquaTerra', url: `${ORIGIN}/` },
      publisher: { '@type': 'Organization', name: 'AquaTerra', url: `${ORIGIN}/` },
      isPartOf: { '@type': 'Blog', name: 'Groundwork Diaries', url: `${ORIGIN}/blog` },
    }
    const html = renderRoute(indexHtml, meta, b.title || 'Blog post', path, {
      jsonLd: [blogLd],
      // No alt was ever stored for these - all 36 rows had it empty in `blogs`
      // too - so the generated fallback is the only honest option.
      type: 'article', image, imageAlt: `${b.title} - AquaTerra blog cover`,
      // Real post prose — this is the page's own content, and the reason a
      // blog post is worth indexing at all.
      body: buildBody({
        heading: b.title || 'Groundwork Diaries',
        intro: [
          byline ? `By ${byline}` : '',
          humanDate(b.published_at || b.created_at),
        ].filter(Boolean).join(' · '),
        extra: `<article>${toParagraphs(b.article_body)}</article>`,
        links: [['/blog', 'More from Groundwork Diaries'], ...SITE_LINKS],
      }),
    })
    mkdirSync(join(DIST, 'blog'), { recursive: true })
    writeFileSync(join(DIST, 'blog', `${b.slug}.html`), html, 'utf8')
    dynWritten++
  }
  console.log(`   ✓ ${blogRows.length.toString().padStart(4)} blog post pages`)

  const projectRows = await select('welfare_projects', {
    table: 'welfare_projects',
    // long_writeup joins the select purely for the crawlable body — the meta
    // description still comes from short_summary.
    columns: 'slug,header,short_summary,long_writeup,main_image,main_image_alt,location',
    filter: 'is_draft=eq.false',
  })
  for (const p of projectRows) {
    if (!p.slug) continue
    const path = `/projects/${p.slug}`
    const meta = {
      title: `${p.header} | AquaTerra Welfare Project`,
      description: metaTrim(
        p.short_summary || `${p.header} — a student-led AquaTerra welfare drive${p.location ? ` in ${p.location}` : ' in Kolkata'}, run by the members who showed up.`
      ),
    }
    const image = sizedCover(p.main_image)
    // Article, not BlogPosting: a welfare-project write-up is a report of work
    // done, and there is no author field on the record to claim otherwise.
    const projectLd = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: p.header,
      description: meta.description,
      url: `${ORIGIN}${path}`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${ORIGIN}${path}` },
      ...(image ? { image } : {}),
      ...(p.location ? { contentLocation: { '@type': 'Place', name: p.location } } : {}),
      author: { '@type': 'Organization', name: 'AquaTerra', url: `${ORIGIN}/` },
      publisher: { '@type': 'Organization', name: 'AquaTerra', url: `${ORIGIN}/` },
    }
    const html = renderRoute(indexHtml, meta, p.header || 'Project', path, {
      jsonLd: [projectLd],
      type: 'article', image, imageAlt: p.main_image_alt || `${p.header} - AquaTerra welfare project`,
      body: buildBody({
        heading: p.header || 'Welfare project',
        intro: p.location ? `AquaTerra welfare project · ${p.location}` : 'AquaTerra welfare project · Kolkata',
        extra: `<article>${toParagraphs(p.long_writeup || p.short_summary)}</article>`,
        links: [['/projects', 'All welfare projects'], ...SITE_LINKS],
      }),
    })
    mkdirSync(join(DIST, 'projects'), { recursive: true })
    writeFileSync(join(DIST, 'projects', `${p.slug}.html`), html, 'utf8')
    dynWritten++
  }
  console.log(`   ✓ ${projectRows.length.toString().padStart(4)} welfare project pages`)

  const teamRows = await select('teams', {
    table: 'teams',
    columns: 'uuid,name,description,category,logo_url',
    filter: 'is_active=eq.true',
  })
  for (const t of teamRows) {
    if (!t.uuid) continue
    const path = `/teams/${t.uuid}`
    const meta = {
      title: `${t.name} | AquaTerra Student Team`,
      description: metaTrim(t.description || '')
        || `${t.name} — AquaTerra's ${t.category || 'student-led'} department, a student-run team owning real work in Kolkata.`,
    }
    const image = sizedCover(t.logo_url)
    const html = renderRoute(indexHtml, meta, t.name || 'Team', path, {
      image, imageAlt: `${t.name} team logo`,
      body: buildBody({
        heading: t.name || 'Student team',
        intro: t.category ? `AquaTerra ${t.category} department` : 'AquaTerra student team',
        extra: `<article>${toParagraphs(t.description)}</article>`,
        links: [['/teams', 'All student teams'], ['/opportunities', 'Open roles'], ...SITE_LINKS],
      }),
    })
    mkdirSync(join(DIST, 'teams'), { recursive: true })
    writeFileSync(join(DIST, 'teams', `${t.uuid}.html`), html, 'utf8')
    dynWritten++
  }
  console.log(`   ✓ ${teamRows.length.toString().padStart(4)} team pages`)

  // ── Sub-team routes: /teams/:uuid/sub/:slug ────────────────────────────────
  // 25 live pages that had no prerendered head at all, so a crawler that does
  // not run JS got the SPA shell. They were also absent from the sitemap and had
  // no crawlable inbound link until the About org chart's buttons became
  // anchors. Audit 2026-09-17, SEO P2.
  //
  // The parent team's uuid and name come from an embedded select, so this is one
  // request, and BOTH the sub-team and its parent must be active: a sub-team of
  // an archived team is not a live page and must not get a static file.
  //
  // TITLE/DESCRIPTION MUST MATCH src/teams/SubTeamDetailPage.tsx's useMeta()
  // exactly. That is the whole point of this file, and /directory, /labs and
  // /join were each serving two different titles for precisely this reason
  // until the same audit. If you change the shape here, change it there.
  const subTeamRows = await select('sub_teams', {
    table: 'sub_teams',
    columns: 'sub_team_id,slug,name,description,is_active,teams(uuid,name,is_active)',
    filter: 'is_active=eq.true',
  })
  let subTeamWritten = 0
  for (const st of subTeamRows) {
    const team = st.teams
    if (!st.slug || !team?.uuid || !team?.is_active) continue
    const path = `/teams/${team.uuid}/sub/${st.slug}`
    const meta = {
      title: `${st.name} · ${team.name} | AquaTerra`,
      description: metaTrim(st.description || '')
        || `${st.name}, a sub-team within AquaTerra's ${team.name}, in Kolkata.`,
    }
    const html = renderRoute(indexHtml, meta, st.name || 'Sub-team', path, {
      body: buildBody({
        heading: st.name || 'Sub-team',
        intro: `Part of AquaTerra's ${team.name}`,
        extra: `<article>${toParagraphs(st.description)}</article>`,
        links: [[`/teams/${team.uuid}`, `All of ${team.name}`], ['/teams', 'All student teams'], ...SITE_LINKS],
      }),
    })
    mkdirSync(join(DIST, 'teams', team.uuid, 'sub'), { recursive: true })
    writeFileSync(join(DIST, 'teams', team.uuid, 'sub', `${st.slug}.html`), html, 'utf8')
    dynWritten++
    subTeamWritten++
  }
  console.log(`   ✓ ${subTeamWritten.toString().padStart(4)} sub-team pages`)

  // ── Terra Notes (/terranotes/*) ───────────────────────────────────────────
  // AQ's monthly digital magazine, and inside it AQ Labs (the old /labs, which now redirects there). Like the Labs
  // cohort before it there is no table behind it: the articles are checked-in data (src/terranotes/data/), so this is
  // a loop over that data, decided by scripts/terranotes/prerender.mjs. Each page gets its own head (title, description,
  // og:*, canonical, preview picture) and, inside #root, its text as plain HTML for crawlers that don't run JavaScript;
  // the app replaces it the moment it mounts, and `.tn-js .tn-static{display:none}` hides it before that so people never
  // see it flash. The Wisdom Woods demo page (noindex) carries no text: it is only a frame around the demo.
  const TN_HIDE = '<script>document.documentElement.classList.add("tn-js")</script><style>.tn-js .tn-static{display:none}</style>'
  let tnWritten = 0
  for (const pg of terraNotesPages(ORIGIN)) {
    if (pg.standalone) {
      const out = join(DIST, pg.file)
      mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, pg.html, 'utf8')
      dynWritten++
      tnWritten++
      continue
    }
    let html = renderRoute(indexHtml, { title: pg.title, description: pg.description }, pg.label, pg.path, {
      type: pg.type,
      image: pg.image,
      imageAlt: pg.imageAlt,
      noIndex: pg.noIndex,
      body: pg.body || ' ',
      noSkeleton: true,
    })
    // renderRoute drops og:image:width/height because an arbitrary image's size is unknown; a Terra Notes preview
    // picture is always 1200x630, so say so (chat apps lay the card out sooner when they are told)
    if (pg.wide) html = html.replace('<meta property="og:image:alt"', '<meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="630" />\n    <meta property="og:image:alt"')
    html = html.replace(/<\/head>(?![\s\S]*<\/head>)/, m => TN_HIDE + m)
    const out = join(DIST, pg.file)
    mkdirSync(dirname(out), { recursive: true })
    writeFileSync(out, html, 'utf8')
    if (pg.copy) { mkdirSync(dirname(join(DIST, pg.copy.to)), { recursive: true }); writeFileSync(join(DIST, pg.copy.to), pg.copy.buf) }
    dynWritten++
    tnWritten++
  }
  for (const [name, text] of Object.entries(terraNotesLlms(ORIGIN))) writeFileSync(join(DIST, 'terranotes', name), text, 'utf8')
  console.log(`   ✓ ${tnWritten.toString().padStart(4)} Terra Notes pages (+ llms.txt, llms-full.txt)`)

  // ── Homepage ──────────────────────────────────────────────────────────────
  // index.html's HEAD is deliberately left alone: it carries hand-tuned
  // homepage meta plus the Organization/WebSite/Dataset JSON-LD that every
  // generated file inherits. But its BODY was empty like all the others, and
  // it is both the most-linked page on the site and the SPA fallback that
  // serves every unmatched route. Body only; head untouched.
  const homeMeta = byPath.get('/') || null
  const homeIntro = homeMeta?.description
    || (indexHtml.match(/<meta name="description" content="([^"]*)"/) || [])[1]
    || ''
  // NO CANONICAL ON dist/index.html, and this is the whole point of the change.
  //
  // This file is not only the homepage: vercel.json rewrites every unmatched
  // path to `/`, so it is also the document served for /post/:uuid,
  // /member/:uuid, /opportunities/:id, /teams/:uuid/sub/:slug and all of
  // /paradox/*. Any canonical put here is inherited by all of them, which is
  // precisely the defect being fixed - it told crawlers those pages ARE the
  // homepage. Writing `${ORIGIN}/` here would have reintroduced it wholesale.
  //
  // With no tag, every one of those routes self-canonicalises to its own URL,
  // which is correct, and the homepage self-canonicalises to `/`, which is also
  // correct. useMeta still sets an explicit, query-stripped canonical at runtime
  // for anything that executes JS (Googlebot does).
  const homeHtml = injectBody(indexHtml, buildBody({
    heading: 'AquaTerra, a student-led NGO and community in Kolkata',
    intro: homeIntro.replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
    links: SITE_LINKS,
  }))
  writeFileSync(INDEX_HTML, homeHtml, 'utf8')
  console.log('   ✓ index.html          crawlable body added (no canonical: it is also the SPA fallback)')

  console.log(`\n✅ Wrote ${written} static + ${dynWritten} dynamic prerendered route file(s), plus the homepage body.`)
}

main().catch(e => {
  console.error(`\n❌ prerender-meta FAILED: ${e?.message || e}\n`)
  process.exit(1)
})
