/**
 * Routing guard — runs as part of `npm run build`, before anything deploys.
 * ────────────────────────────────────────────────────────────────────────────
 * This exists because of a real outage: the SPA catch-all rewrite pointed at
 * `/index.html` while `cleanUrls: true` was set. Vercel 308-redirects
 * /index.html -> /, so the rewrite resolved to a redirect instead of a document
 * and every client-only route hard-404'd — /login, /director/*, /post/:uuid,
 * /member/:uuid. The 15 prerendered .html routes kept returning 200 (Vercel
 * checks the filesystem before rewrites), so the site looked healthy from the
 * homepage and the breakage was only reported days later as "the HoD desk 404s".
 *
 * A live smoke test can't catch this at build time (the new deployment doesn't
 * exist yet — see scripts/smoke.mjs for the post-deploy half). But the bug is
 * fully determined by vercel.json, so it can be caught statically, here, and
 * fail the build instead of shipping.
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const CONFIG = join(__dir, '../../vercel.json')

const problems = []
const note = m => console.log(`   ${m}`)

let cfg
try {
  cfg = JSON.parse(readFileSync(CONFIG, 'utf8'))
} catch (e) {
  console.error(`\n❌ Routing gate: cannot read/parse vercel.json — ${e.message}`)
  process.exit(1)
}

const rewrites = Array.isArray(cfg.rewrites) ? cfg.rewrites : []
const cleanUrls = cfg.cleanUrls === true

// ── 1. The SPA catch-all must exist, and must still catch client routes ─────
// Matched by BEHAVIOUR, not by string equality. The catch-all is allowed to
// carry a negative lookahead excluding static directories - /assets/ and
// /fonts/ are excluded so a STALE hashed asset 404s honestly instead of being
// handed the homepage as 200 text/html, which defeats lazyWithRetry's retry.
// String-matching '/(.*)' would reject that correct form, so instead we run
// the pattern against real routes and assert the ones that matter still match.
const CLIENT_ROUTES = [
  '/', '/login', '/register', '/director', '/director/members',
  '/post/abc-123', '/member/abc-123', '/settings', '/search', '/saved', '/bugs', '/tasks',
  // Prerendered directories that are ALSO client routes. These must never be
  // excluded: doing so turns a soft 404 into a hard one on live pages.
  '/blog/some-slug', '/projects/some-slug', '/teams/some-uuid', '/labs/x',
  // TerraThon. Worth its own line rather than trusting the samples above,
  // because this section is the one most likely to tempt somebody into
  // widening the exclusion: it loads its own Google Font, so `fonts/` sits
  // right there in the lookahead as a pattern to copy. Narrow that lookahead
  // to also exclude `terrathon/` and every /terrathon/* URL hard-404s in
  // production while this gate still prints a pass, because not one of the
  // sample paths above starts with /terrathon.
  '/terrathon', '/terrathon/cricket', '/terrathon/register/fifa', '/terrathon/admin',
  // Mini games: the hub is prerendered, /games/<slug> is a client route
  '/games', '/games/some-game',
  // Terra Notes. Every path under it is a client route (the app matches the rest itself), and its chapters/demos are
  // deeper than any sample above, so they get their own line for the same reason TerraThon does.
  '/terranotes', '/terranotes/articles/exam-stress', '/terranotes/articles/labs/photon', '/terranotes/articles/labs/wisdom-woods/demo',
]

const catchAll = rewrites.find(r => {
  if (r.source === '/:path*') return true
  if (typeof r.source !== 'string' || !r.source.startsWith('/')) return false
  let re
  try { re = new RegExp('^' + r.source + '$') } catch { return false }
  return CLIENT_ROUTES.every(p => re.test(p))
})

if (!catchAll) {
  problems.push(
    'No SPA catch-all rewrite that still matches every client route. Without ' +
    'it every client-only route (/login, /director/*, /post/:uuid) 404s.\n' +
    '      Expected { "source": "/(.*)", "destination": "/" }, or that pattern\n' +
    '      with a negative lookahead excluding ONLY static dirs, e.g.\n' +
    '      "/((?!assets/|fonts/).*)". If you added an exclusion, check it does\n' +
    '      not also swallow /blog/, /projects/, /teams/ or /labs/.')
}

// ── 1b. An exclusion must not leave the static dirs being served HTML ───────
// Only meaningful when an exclusion is present; a bare /(.*) is the old,
// still-valid form and skips this.
if (catchAll && catchAll.source.includes('?!')) {
  const re = new RegExp('^' + catchAll.source + '$')
  for (const asset of ['/assets/index-a1b2c3.js', '/fonts/NeutralFace.woff2']) {
    if (re.test(asset)) {
      problems.push(
        `Catch-all "${catchAll.source}" still matches ${asset}.\n` +
        '      A stale hashed asset then returns 200 text/html instead of 404,\n' +
        '      and a dynamic import of it fails on MIME type.')
    }
  }
}

// ── 2. The exact trap that caused the outage ────────────────────────────────
if (catchAll && cleanUrls && /\/index\.html$/.test(catchAll.destination || '')) {
  problems.push(
    `Catch-all rewrite points at "${catchAll.destination}" while cleanUrls is true.\n` +
    '      Vercel 308-redirects /index.html -> /, so this rewrite resolves to a\n' +
    '      redirect rather than a document and every client-only route hard-404s.\n' +
    '      Use { "source": "/(.*)", "destination": "/" } instead.')
}

// ── 3. Rewrites must not shadow real files ──────────────────────────────────
// Vercel checks the filesystem first, so this is belt-and-braces — but a
// `destination` pointing into /assets/ would break hashed bundles outright.
for (const r of rewrites) {
  if (typeof r.destination === 'string' && r.destination.startsWith('/assets/')) {
    problems.push(`Rewrite destination "${r.destination}" points into /assets/ (hashed build output).`)
  }
}

// ── 4. Schema hygiene: Vercel rejects unknown keys and fails the DEPLOY ─────
// (i.e. after a green build) — so catch it here instead.
const ALLOWED = new Set(['source', 'destination', 'has', 'missing', 'statusCode', 'permanent'])
for (const r of rewrites) {
  const unknown = Object.keys(r).filter(k => !ALLOWED.has(k))
  if (unknown.length) {
    problems.push(
      `Rewrite has key(s) Vercel's schema doesn't allow: ${unknown.join(', ')}. ` +
      'The build succeeds and the DEPLOY then fails. Keep comments out of vercel.json.')
  }
}

// ── 5. The Wisdom Woods demo is shown in a same-origin <iframe> ─────────────
// (terranotes/pages/DemoPage.jsx). The site-wide X-Frame-Options: DENY and CSP
// frame-ancestors 'none' would blank it, so the demo's files need their own
// relaxed rule AND the site-wide rule must not also match them (two rules setting
// the same header is order-dependent on Vercel, and this is not worth trusting).
{
  const DEMO_FILE = '/terranotes/editions/sep26/articles/labs/wisdom-woods/demo/index.html'
  const headers = Array.isArray(cfg.headers) ? cfg.headers : []
  const xfo = r => (r.headers || []).find(h => h.key === 'X-Frame-Options')?.value
  const strict = headers.filter(r => {
    if (xfo(r) !== 'DENY') return false
    try { return new RegExp('^' + r.source + '$').test(DEMO_FILE) } catch { return false }
  })
  if (strict.length) {
    problems.push(
      `A header rule (${strict.map(r => r.source).join(', ')}) still sends X-Frame-Options: DENY for ${DEMO_FILE}.\n` +
      '      Terra Notes frames that page (AQ Labs > Wisdom Woods demo) and it would render blank.')
  }
  if (!headers.some(r => /\/demo\//.test(r.source) && xfo(r) === 'SAMEORIGIN')) {
    problems.push('No header rule gives the Terra Notes demo folder X-Frame-Options: SAMEORIGIN (and CSP frame-ancestors \'self\').')
  }
}

if (problems.length) {
  console.error('\n❌ Routing gate FAILED:\n')
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}\n`))
  console.error('  See CLAUDE.md → "Vercel SPA rewrite".\n')
  process.exit(1)
}

console.log('\n✅ Routing gate passed')
note(`catch-all: ${catchAll.source} → ${catchAll.destination}${cleanUrls ? '  (cleanUrls on)' : ''}`)
