/**
 * Run design-probe.js against a built site, in a real browser, from CI.
 *
 * WHY REPORT-ONLY, DELIBERATELY
 * -----------------------------
 * This never fails the build. That is not timidity, it is the lesson this repo
 * already paid for: during the 2026-09-18 UI pass four of its own DOM detectors
 * produced confident, specific, wrong findings (chips "wrapping" that were
 * nowrap, headings "misaligned" that were card padding, titles at "1.15
 * contrast" that had a gradient scrim behind them, a "626px empty block" that
 * was position:absolute). A hard gate on rendered measurements is the gate that
 * gets switched off after its first false positive, and then nobody runs it at
 * all. Printed findings that a human reads are worth more than a red X nobody
 * trusts.
 *
 * So: it prints, it exits 0, and it says loudly that it is advisory.
 *
 * design-probe.js is a plain IIFE EXPRESSION, not a module. It is read off disk
 * and handed to page.evaluate() verbatim; `await import()` of it does not work
 * and the file's own header says so.
 *
 * USAGE
 *   cd frontend
 *   npm run build
 *   node scripts/run-design-probe.mjs                  # serves dist itself
 *   node scripts/run-design-probe.mjs --base https://www.ngoaquaterra.com
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const PROBE = join(HERE, 'design-probe.js')

// A deliberately small set. The probe measures ONE viewport per run, so every
// route here costs two page loads. These are the surfaces where layout breaks
// have actually shipped.
const ROUTES = ['/', '/projects', '/members', '/teams', '/about']
const VIEWPORTS = [
  { label: 'phone',   width: 390,  height: 844 },
  { label: 'desktop', width: 1280, height: 900 },
]

const baseArg = process.argv.indexOf('--base')
const EXTERNAL_BASE = baseArg > -1 ? process.argv[baseArg + 1] : null

function say(s = '') { process.stdout.write(s + '\n') }

// ── The browser is optional on purpose ──────────────────────────────────────
// If Playwright is not installed this prints why and exits 0, so adding the
// step to a workflow cannot break a repo that has not installed it yet.
let chromium
try {
  ({ chromium } = await import('playwright'))
} catch {
  say('\ndesign-probe: playwright is not installed, skipping.')
  say('  npm i -D playwright && npx playwright install --with-deps chromium\n')
  process.exit(0)
}

if (!existsSync(PROBE)) {
  say('\ndesign-probe: scripts/design-probe.js not found, skipping.\n')
  process.exit(0)
}
const probeSource = readFileSync(PROBE, 'utf8')

// ── Serve dist, unless pointed at a live origin ─────────────────────────────
let server = null
let base = EXTERNAL_BASE

if (!base) {
  const dist = join(HERE, '..', 'dist')
  if (!existsSync(dist)) {
    say('\ndesign-probe: no dist/. Run `npm run build` first. Skipping.\n')
    process.exit(0)
  }
  const PORT = 4179
  base = `http://localhost:${PORT}`
  server = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: join(HERE, '..'), stdio: 'ignore' }
  )
  // vite preview is quick, but give it a moment and then poll rather than guess.
  const deadline = Date.now() + 30_000
  for (;;) {
    try {
      const r = await fetch(base + '/', { signal: AbortSignal.timeout(2000) })
      if (r.ok) break
    } catch { /* not up yet */ }
    if (Date.now() > deadline) {
      say('\ndesign-probe: preview server did not start in 30s, skipping.\n')
      server.kill()
      process.exit(0)
    }
    await new Promise(r => setTimeout(r, 400))
  }
}

// ── Probe ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch()
const all = []

try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } })
    const page = await ctx.newPage()
    for (const route of ROUTES) {
      try {
        await page.goto(base + route, { waitUntil: 'networkidle', timeout: 30_000 })
      } catch {
        // A slow or data-dependent route is not a design finding. Say so, move on.
        all.push({ route, vp: vp.label, findings: [], note: 'did not settle in 30s' })
        continue
      }
      await page.waitForTimeout(1200)          // let reveal animations land
      let result
      try {
        result = await page.evaluate(probeSource)
      } catch (err) {
        all.push({ route, vp: vp.label, findings: [], note: 'probe threw: ' + String(err).slice(0, 120) })
        continue
      }
      // Drop tap-target findings at desktop width. This repo's 44px floor is
      // `v6.css:2310` and is scoped `@media (max-width: 760px)` on purpose, so
      // a 38px control on a 1280px screen is the design, not a defect. Its
      // first CI run reported 18 to 28 of them per desktop route against 1 to 3
      // per phone route: left in, the noise buries the signal and the job gets
      // ignored, which is the exact failure this step's own comment warns about.
      const findings = (result?.findings ?? []).filter(
        f => !(vp.label === 'desktop' && String(f.area || '').toLowerCase() === 'targets')
      )
      all.push({ route, vp: vp.label, findings, note: null })
    }
    await ctx.close()
  }
} finally {
  await browser.close()
  if (server) server.kill()
}

// ── Report ──────────────────────────────────────────────────────────────────
say('\n' + '─'.repeat(72))
say('design-probe  ·  ADVISORY. This never fails the build.')
say('─'.repeat(72))

let high = 0, medium = 0, low = 0
for (const r of all) {
  const f = r.findings
  for (const x of f) {
    const sev = String(x.severity || x.level || 'low').toLowerCase()
    if (sev === 'high') high++; else if (sev === 'medium') medium++; else low++
  }
  const head = `${r.vp.padEnd(8)} ${r.route.padEnd(12)}`
  if (r.note) { say(`  ${head} skipped (${r.note})`); continue }
  if (!f.length) { say(`  ${head} clean`); continue }
  say(`  ${head} ${f.length} finding(s)`)
  // design-probe emits {severity, area, detail, sample[]}. Read those fields
  // rather than falling through to a truncated JSON.stringify, which cut the
  // line off at exactly the point it became useful: the first CI run printed
  // `{"severity":"low","area":"targets","detail":"3 controls under 44px",
  // "sample":["button.btn` and stopped, so the report said a problem existed
  // and never said where.
  for (const x of f.slice(0, 6)) {
    const sev = String(x.severity || x.level || 'low').toUpperCase()
    const area = x.area ? `${x.area}: ` : ''
    const detail = x.detail || x.what || x.message || x.title || JSON.stringify(x).slice(0, 120)
    say(`      [${sev}] ${area}${detail}`)
    for (const s of (Array.isArray(x.sample) ? x.sample : []).slice(0, 4)) {
      say(`             · ${String(s).slice(0, 150)}`)
    }
  }
  if (f.length > 6) say(`      ... and ${f.length - 6} more`)
}

say('')
say(`  totals: ${high} high, ${medium} medium, ${low} low`)
say('')
say('  Read these, do not trust them. The probe locates candidates; a')
say('  screenshot decides. Known blind spots: it cannot resolve a gradient or')
say('  pseudo-element background, it skips text over photography, and because')
say('  body has overflow-x:hidden a clean horizontal-scroll result does NOT')
say('  mean nothing is clipped.')
say('─'.repeat(72) + '\n')

process.exit(0)
