/**
 * Keeps vercel.json's SPA rewrite in step with the router (handoff C-06, 3 Nov 2026).
 *
 * The old catch-all sent EVERY unknown path to the home page with HTTP 200 (a soft 404): /terms, /favicon.ico, /api/health.
 * Now only the top-level URLs the router actually owns reach the app; anything else gets Vercel's real 404 (public/404.html).
 * The first path segment of every `path="/..."` in src/App.tsx is the allow-list, so adding a route can never be forgotten
 * silently: `verify-routing.mjs` runs this with --check and fails the build when vercel.json is out of step.
 *
 * What it does NOT do: a path under a KNOWN segment (/projects/does-not-exist, /teams/<unknown-uuid>) still reaches the app and
 * shows the in-app "page not found" (noindex). Those pages are created while the site is live, so hard-404ing them would break
 * a new project or team until the next deploy.
 *
 *   node scripts/sync-vercel-rewrites.mjs          write vercel.json
 *   node scripts/sync-vercel-rewrites.mjs --check  exit 1 if vercel.json is not in step (used by the build)
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const APP = join(__dir, '../src/App.tsx')
const CONFIG = join(__dir, '../../vercel.json')

export function routeSegments(appSource) {
  const out = new Set()
  for (const m of appSource.matchAll(/path=['"]\/([^'"\/*:?]+)/g)) out.add(m[1])
  return [...out].sort()
}

export function rewriteSource(segments) {
  return `/(|(?:${segments.join('|')})(?:/.*)?)`
}

const isSpaRewrite = r => typeof r?.source === 'string' && r.destination === '/'

function main() {
  const check = process.argv.includes('--check')
  const segments = routeSegments(readFileSync(APP, 'utf8'))
  if (segments.length < 30) { console.error(`sync-vercel-rewrites: only ${segments.length} route segments found in App.tsx, refusing.`); process.exit(1) }
  const want = rewriteSource(segments)
  const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'))
  const rewrites = Array.isArray(cfg.rewrites) ? cfg.rewrites : []
  const i = rewrites.findIndex(isSpaRewrite)
  if (i < 0) { console.error('sync-vercel-rewrites: no SPA rewrite (destination "/") in vercel.json.'); process.exit(1) }
  if (rewrites[i].source === want) { console.log(`   vercel.json SPA rewrite is in step with App.tsx (${segments.length} top-level routes)`); return }
  if (check) {
    const current = rewrites[i].source
    const missing = segments.filter(s => !new RegExp('^' + current + '$').test('/' + s))
    console.error(`\n❌ vercel.json SPA rewrite is out of step with src/App.tsx.${missing.length ? ` Not reachable in production: ${missing.map(s => '/' + s).join(', ')}.` : ''}\n   Run: node frontend/scripts/sync-vercel-rewrites.mjs, and commit vercel.json.\n`)
    process.exit(1)
  }
  // A targeted text edit, not a re-serialise: vercel.json is hand-formatted and a rewrite would churn every line.
  const raw = readFileSync(CONFIG, 'utf8')
  const oldLiteral = JSON.stringify(rewrites[i].source)
  if (raw.split(oldLiteral).length !== 2) { console.error('sync-vercel-rewrites: could not find the SPA rewrite source exactly once in vercel.json.'); process.exit(1) }
  writeFileSync(CONFIG, raw.replace(oldLiteral, JSON.stringify(want)))
  console.log(`   wrote vercel.json SPA rewrite for ${segments.length} top-level routes`)
}

if (process.argv[1] && process.argv[1].endsWith('sync-vercel-rewrites.mjs')) main()
