/**
 * Bundle budget gate.
 * ────────────────────────────────────────────────────────────────────────────
 * Run:  node scripts/check-bundle-budget.mjs      (postbuild, after vite build)
 *
 * WHY
 *   Audit 2026-09-17 (efficiency P3): the build had no bundle budget, no
 *   analyzer, and no assertion about what ends up preloaded. That is how
 *   `vendor-motion` came to be `modulepreload`ed on every route - including
 *   logged-out public pages that never animate - for the sake of a 150ms page
 *   fade and a Konami-code easter egg. Nothing in the pipeline could have
 *   noticed, because nothing was looking.
 *
 *   The expensive thing is not total bundle size. It is the EAGER CRITICAL
 *   PATH: the entry chunk, whatever it statically imports (which Vite emits as
 *   <link rel="modulepreload">), and the render-blocking stylesheet. Those bytes
 *   are fetched before anything renders, on every single page load. A lazy
 *   route chunk is a different kind of cost and is budgeted far more loosely.
 *
 * WHAT IT CHECKS
 *   1. The eager critical path stays under EAGER_BUDGET.
 *   2. No chunk on the DENYLIST is eager. This is the specific regression that
 *      already happened once: a single `import { motion } from 'framer-motion'`
 *      in any eagerly-imported module silently pulls 127KB back onto the path,
 *      and the byte budget alone might absorb it.
 *   3. No single lazy chunk exceeds CHUNK_BUDGET, which catches a route that
 *      has quietly become a monolith.
 *
 * WHEN IT FAILS
 *   Do not raise the number to make it pass. Find what joined the eager graph:
 *     node -e "..."  or trace static imports from src/main.tsx.
 *   Raising a budget is a decision to make deliberately, with the reason
 *   written next to the new number.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dir, '..', 'dist')
const ASSETS = join(DIST, 'assets')

// Measured at 8bc843d + the 2026-09-17 audit fixes: 658,448 bytes.
// Headroom is deliberately small. This number is meant to be felt.
const EAGER_BUDGET = 700_000

// Chunks that must never be reachable from the entry without a lazy boundary.
const DENYLIST = [
  { match: /^vendor-motion/, why: 'framer-motion: import it only in lazy-loaded components' },
  { match: /^vendor-zxing/, why: 'the barcode scanner is Paradox-admin only' },
  { match: /^vendor-barcode/, why: 'jsbarcode is only needed by the ticket surfaces' },
]

// A single lazy chunk over this is usually a page that wants splitting.
// Admin (Paradox) is the known, accepted exception.
const CHUNK_BUDGET = 200_000
const CHUNK_EXCEPTIONS = [/^Admin-/, /^vendor-zxing/, /^vendor-react/, /^vendor-supabase/]

const fail = msg => { console.error(`\n❌ Bundle budget FAILED: ${msg}\n`); process.exit(1) }
const kb = n => `${(n / 1024).toFixed(1)}KB`

if (!existsSync(DIST)) fail('dist/ is missing. Run the build first.')
const html = readFileSync(join(DIST, 'index.html'), 'utf8')

// The eager set: the entry <script type="module">, every modulepreload, and
// every render-blocking stylesheet in the document head.
const eager = new Set()
for (const re of [
  /<script[^>]+type="module"[^>]+src="\/assets\/([^"]+)"/g,
  /<link[^>]+rel="modulepreload"[^>]+href="\/assets\/([^"]+)"/g,
  /<link[^>]+rel="stylesheet"[^>]+href="\/assets\/([^"]+)"/g,
]) {
  for (const m of html.matchAll(re)) eager.add(m[1])
}
if (eager.size === 0) fail('found no entry script in dist/index.html — did the HTML layout change?')

let total = 0
const rows = []
for (const f of eager) {
  const p = join(ASSETS, f)
  if (!existsSync(p)) fail(`dist/index.html references /assets/${f}, which does not exist`)
  const size = statSync(p).size
  total += size
  rows.push([size, f])
}
rows.sort((a, b) => b[0] - a[0])

console.log('\nEager critical path (fetched before first render, on every page):')
for (const [size, f] of rows) console.log(`   ${kb(size).padStart(9)}  ${f}`)
console.log(`   ${'─'.repeat(9)}`)
console.log(`   ${kb(total).padStart(9)}  total   (budget ${kb(EAGER_BUDGET)})`)

for (const { match, why } of DENYLIST) {
  const hit = [...eager].find(f => match.test(f))
  if (hit) fail(`${hit} is on the EAGER path and must not be.\n   ${why}\n   Something in the static import graph from src/main.tsx now references it.`)
}

if (total > EAGER_BUDGET) {
  fail(`eager critical path is ${kb(total)}, over the ${kb(EAGER_BUDGET)} budget by ${kb(total - EAGER_BUDGET)}.
   Find what joined the eager graph rather than raising the number.`)
}

const oversized = readdirSync(ASSETS)
  .filter(f => f.endsWith('.js') && !eager.has(f))
  .filter(f => !CHUNK_EXCEPTIONS.some(re => re.test(f)))
  .map(f => [statSync(join(ASSETS, f)).size, f])
  .filter(([size]) => size > CHUNK_BUDGET)
  .sort((a, b) => b[0] - a[0])

if (oversized.length) {
  console.warn(`\n⚠ ${oversized.length} lazy chunk(s) over ${kb(CHUNK_BUDGET)}:`)
  for (const [size, f] of oversized) console.warn(`   ${kb(size).padStart(9)}  ${f}`)
  console.warn('   Not a failure, but worth splitting before one of them lands on a hot route.')
}

console.log(`\n✅ Bundle budget passed — eager ${kb(total)} / ${kb(EAGER_BUDGET)}, no denied chunk is eager.\n`)
