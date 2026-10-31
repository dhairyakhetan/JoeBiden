/**
 * Post-deploy smoke test.
 * ────────────────────────────────────────────────────────────────────────────
 *   node scripts/smoke.mjs                       # against production
 *   node scripts/smoke.mjs https://preview.url   # against a preview deploy
 *   npm run smoke
 *
 * Why this exists: a rewrite regression once 404'd /login, /director/*,
 * /post/:uuid and /member/:uuid in production while the homepage and every
 * prerendered page kept returning 200. Nothing noticed, because everything a
 * casual check would look at was fine.
 *
 * So this deliberately checks the routes that FAIL SILENTLY:
 *   - client-only routes, which only exist via the SPA catch-all rewrite
 *   - prerendered routes, which must still serve their OWN <title> rather than
 *     the generic SPA shell (a too-greedy rewrite would silently flatten every
 *     page's SEO to the homepage's, which no status code would reveal)
 *   - static assets, which must not be swallowed by the catch-all
 *
 * Retries with backoff so it can be run immediately after a push while the
 * deployment is still propagating.
 */
const BASE = (process.argv[2] || process.env.SMOKE_URL || 'https://www.ngoaquaterra.com').replace(/\/+$/, '')
const ATTEMPTS = Number(process.env.SMOKE_ATTEMPTS || 10)
const GAP_MS = Number(process.env.SMOKE_GAP_MS || 15000)
const TIMEOUT_MS = 20000

/** Routes that exist ONLY through the SPA rewrite — the silent-failure class. */
const CLIENT_ROUTES = ['/login', '/director', '/director/approvals', '/post/smoke-test', '/member/smoke-test', '/saved']

/** Prerendered routes → a distinctive fragment their own <title> must contain. */
const PRERENDERED = [
  ['/about', 'About AquaTerra'],
  ['/faq', 'FAQ'],
  ['/teams', 'Departments'],
  ['/crftd', 'Crftd'],
]

/** Static files that must survive the catch-all, with expected content-type. */
const ASSETS = [
  ['/robots.txt', 'text/plain'],
  ['/sitemap.xml', 'xml'],
]

const get = async (path) => {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(BASE + path, { signal: ctrl.signal, redirect: 'follow' })
    const body = res.headers.get('content-type')?.includes('text/html') ? await res.text() : ''
    return { status: res.status, type: res.headers.get('content-type') || '', body }
  } finally { clearTimeout(t) }
}

const titleOf = html => (html.match(/<title>([^<]*)<\/title>/i)?.[1] || '').trim()

async function run() {
  const fails = []

  for (const path of CLIENT_ROUTES) {
    const r = await get(path).catch(e => ({ status: 0, type: '', body: '', err: e.message }))
    if (r.status !== 200) fails.push(`${path} → ${r.status || r.err} (expected 200; SPA rewrite is broken)`)
  }

  for (const [path, mustContain] of PRERENDERED) {
    const r = await get(path).catch(e => ({ status: 0, body: '', err: e.message }))
    if (r.status !== 200) { fails.push(`${path} → ${r.status || r.err} (expected 200)`); continue }
    const title = titleOf(r.body)
    if (!title.toLowerCase().includes(mustContain.toLowerCase())) {
      fails.push(`${path} title is "${title}" — expected it to contain "${mustContain}". ` +
                 'The prerendered file is not being served; the rewrite is shadowing it.')
    }
  }

  for (const [path, type] of ASSETS) {
    const r = await get(path).catch(e => ({ status: 0, type: '', err: e.message }))
    if (r.status !== 200) fails.push(`${path} → ${r.status || r.err} (expected 200)`)
    else if (!r.type.includes(type)) fails.push(`${path} served as "${r.type}" — expected ${type}. Swallowed by the catch-all.`)
  }

  return fails
}

console.log(`\nSmoke test → ${BASE}`)
let fails = []
for (let i = 1; i <= ATTEMPTS; i++) {
  fails = await run()
  if (!fails.length) {
    const total = CLIENT_ROUTES.length + PRERENDERED.length + ASSETS.length
    console.log(`✅ Smoke test passed — ${total} checks (attempt ${i})\n`)
    process.exit(0)
  }
  if (i < ATTEMPTS) {
    console.log(`   attempt ${i}/${ATTEMPTS}: ${fails.length} failing, retrying in ${GAP_MS / 1000}s (deploy may still be propagating)…`)
    await new Promise(r => setTimeout(r, GAP_MS))
  }
}

console.error(`\n❌ Smoke test FAILED after ${ATTEMPTS} attempts:\n`)
fails.forEach((f, i) => console.error(`  ${i + 1}. ${f}`))
console.error('\n  See CLAUDE.md → "Vercel SPA rewrite".\n')
process.exit(1)
