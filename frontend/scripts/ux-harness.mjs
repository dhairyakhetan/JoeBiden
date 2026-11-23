/**
 * UX affordance + speed harness. One script, any route.
 * ────────────────────────────────────────────────────────────────────────────
 *   npx vite --port 5199 &                                  # dev server (the /dev/* surfaces only exist in dev)
 *   node scripts/ux-harness.mjs                             # default route list, both viewports
 *   node scripts/ux-harness.mjs /dev/desk?desk=members /about   # chosen routes
 *   UX_BASE=https://www.ngoaquaterra.com node scripts/ux-harness.mjs /about /teams
 *   UX_STRICT=1 node scripts/ux-harness.mjs                 # exit 1 on any "fail" finding (for CI)
 *   fuser -k 5199/tcp                                       # stop the dev server (never pkill -f)
 *
 * What it measures, per route and per viewport (390x844 phone, 1440x900 laptop):
 *
 *   FAIL  (an affordance a person cannot get past)
 *     name      interactive element with no accessible name (icon button with no aria-label)
 *     label     form control with no label, aria-label or placeholder
 *     fakebtn   non-interactive element styled and wired as a button (pointer cursor, no role,
 *               no tabindex): keyboard and screen-reader users cannot reach it
 *     overflow  page scrolls sideways
 *     dupid     duplicate id (breaks label-for and aria-labelledby)
 *     console   uncaught page error
 *   WARN  (worth fixing, judgement call)
 *     target    tap target under 32px (phone only; 44px is the guideline, 32 is the floor)
 *     alt       <img> with no alt attribute at all
 *     clip      text cut off by its own box (scrollWidth > clientWidth with overflow hidden)
 *     focus     element shows no visible change when keyboard-focused (first 25 tab stops)
 *     h1        page has no h1, or more than one
 *     slow      first contentful paint over 2.5 s, or more than 120 requests, or over 2.5 MB
 *
 * It does NOT replace looking at the page. It finds the mechanical class of problem across
 * every page at once so a person only has to judge the rest. Findings are written to
 * docs/ux-harness/latest.json and latest.md.
 */
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(HERE, '../../docs/ux-harness')
const BASE = (process.env.UX_BASE || 'http://localhost:5199').replace(/\/+$/, '')
const STRICT = process.env.UX_STRICT === '1'

/** Routes that render without a session. Desk and member surfaces are mounted from fixtures
 *  under /dev/*, so they can be checked offline. Extend this list when a surface is added. */
// The desks /dev/desk can mount (dev/DeskSurfaces.tsx), each in three states. 'loading' never settles in the
// harness, so it is left out. the rest of the desks are not mountable offline; they are covered by reading, not here.
const DESK_IDS = ['landing', 'shell', 'members', 'guide', 'approvals', 'posts', 'volunteers', 'certificates', 'teams', 'hiring', 'activity', 'blogs', 'mom', 'projects', 'hods', 'content', 'yearbook', 'categories', 'enquiries']
const DESK_ROUTES = DESK_IDS.flatMap(d => ['populated', 'empty', 'error'].map(sc => `/dev/desk?desk=${d}&role=hr&scenario=${sc}&shell=1`))
// A plain HoD sees different controls (no approvals badge, scoped copy), so check the landing and hiring as one.
const HOD_ROUTES = ['landing', 'hiring', 'posts'].map(d => `/dev/desk?desk=${d}&role=hod&scenario=populated&shell=1`)
// Signed-in member pages (feed, profile, post) need a real session and cannot be mounted offline. What can be
// mounted: the fixture surfaces below. Public pages need no session at all.
const FIXTURE_ROUTES = ['/dev/authed', '/dev/bugs', '/dev/admin', '/dev/cards', '/dev/components', '/dev/variations']
const PUBLIC_ROUTES = ['/', '/about', '/teams', '/projects', '/blog', '/faq', '/login', '/join', '/games', '/brand', '/support',
  '/links', '/collaborations', '/contact', '/opportunities', '/schools', '/classes', '/crftd', '/impact', '/shikshaq', '/sports', '/ai']
const DEFAULT_ROUTES = [...PUBLIC_ROUTES, ...FIXTURE_ROUTES, ...DESK_ROUTES, ...HOD_ROUTES]

// Design galleries show fixed-width specimens and demo-sized controls on purpose (dev-only, never shipped).
// They still get the checks that are about names, labels, duplicate ids and console errors.
const LENIENT = ['/dev/components', '/dev/variations', '/dev/cards']

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true },
  { name: 'laptop', width: 1440, height: 900, isMobile: false, hasTouch: false },
]

/** Runs inside the page. Returns plain findings; no DOM nodes cross the boundary. */
function inspect({ phone, lenient, dev }) {
  const out = []
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0
  }
  const desc = (el) => {
    const t = el.tagName.toLowerCase()
    const id = el.id ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40)
    return `${t}${id}${cls}${txt ? ` "${txt}"` : ''}`
  }
  const name = (el) => {
    const lb = el.getAttribute('aria-labelledby')
    if (lb) {
      const t = lb.split(/\s+/).map(i => document.getElementById(i)?.textContent || '').join(' ').trim()
      if (t) return t
    }
    return (el.getAttribute('aria-label') || '').trim()
      || (el.labels && el.labels.length ? [...el.labels].map(l => l.textContent || '').join(' ').trim() : '')
      || (el.textContent || '').trim()
      || (el.getAttribute('title') || '').trim()
      || (el.querySelector('img[alt]:not([alt=""])')?.getAttribute('alt') || '').trim()
      || (el.querySelector('svg title')?.textContent || '').trim()
      || (el.value && el.type !== 'password' && ['submit', 'button', 'reset'].includes(el.type) ? el.value : '')
  }
  const add = (sev, kind, el, msg) => out.push({ sev, kind, el: desc(el), msg })

  // name + target size
  document.querySelectorAll('a[href], button, [role=button], [role=link], [role=tab], [role=menuitem], summary, input[type=submit], input[type=button]').forEach(el => {
    if (!visible(el) || el.closest('[aria-hidden=true]') || el.disabled) return
    if (!name(el)) add('fail', 'name', el, 'no accessible name')
    if (phone && !lenient) {
      const r = el.getBoundingClientRect()
      // Inline text links inside a paragraph are exempt (WCAG 2.5.8 inline exception).
      const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline'
      // A control can reach the floor through an invisible hit area (a ::after overlay). Probe where a tap lands:
      // if points 16px out from the centre on every side still hit this control, its real target is >= 32px.
      // elementFromPoint only sees the viewport, so bring a small control into view before probing it.
      if (!inline && (r.width < 32 || r.height < 32)) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })
      const r2 = el.getBoundingClientRect()
      const cx = r2.left + r2.width / 2, cy = r2.top + r2.height / 2
      const hits = (x, y) => { const t = document.elementFromPoint(x, y); return !!t && el.contains(t) }
      const wide = r.width >= 32 || (hits(cx - 16, cy) && hits(cx + 16, cy))
      const tall = r.height >= 32 || (hits(cx, cy - 16) && hits(cx, cy + 16))
      if (!inline && !(wide && tall)) add('warn', 'target', el, `${Math.round(r.width)}x${Math.round(r.height)}px tap target`)
    }
  })

  // labels
  document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea').forEach(el => {
    if (!visible(el) || el.closest('[aria-hidden=true]')) return
    const labelled = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')
      || el.closest('label') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`))
    if (!labelled && !el.getAttribute('placeholder')) add('fail', 'label', el, 'form control with no label')
    else if (!labelled) add('warn', 'label', el, 'placeholder is the only label (vanishes on typing)')
  })

  // fake buttons: pointer cursor on a non-interactive element nobody can tab to
  const interactiveTag = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|LABEL|OPTION)$/
  let fake = 0
  document.querySelectorAll('div, span, li, p, td, section, article, img, h1, h2, h3, h4').forEach(el => {
    if (lenient || fake > 40 || !visible(el)) return
    if (interactiveTag.test(el.tagName) || el.getAttribute('role') || el.hasAttribute('tabindex')) return
    if (el.closest('a[href], button, [role=button], label, summary, [aria-hidden=true]')) return
    // a wrapper that CONTAINS the real control (a card with its own button or link) is not a fake button
    if (el.querySelector('a[href], button, [role=button], [role=link], summary, input, select, textarea')) return
    if (getComputedStyle(el).cursor !== 'pointer') return
    // a child of a pointer parent inherits the cursor; only report the outermost
    const parent = el.parentElement
    if (parent && getComputedStyle(parent).cursor === 'pointer') return
    fake++
    add('fail', 'fakebtn', el, 'looks clickable but has no role, no tabindex, not keyboard reachable')
  })

  // images
  document.querySelectorAll('img').forEach(el => {
    if (visible(el) && !el.hasAttribute('alt')) add('warn', 'alt', el, 'img has no alt attribute')
  })

  // duplicate ids
  const seen = new Map()
  document.querySelectorAll('[id]').forEach(el => seen.set(el.id, (seen.get(el.id) || 0) + 1))
  seen.forEach((n, id) => { if (n > 1) out.push({ sev: 'fail', kind: 'dupid', el: `#${id}`, msg: `${n} elements share this id` }) })

  // clipped text
  let clip = 0
  document.querySelectorAll('button, a, span, p, h1, h2, h3, h4, td, label, li').forEach(el => {
    if (clip > 25 || !visible(el)) return
    const cs = getComputedStyle(el)
    if (cs.overflowX === 'visible') return
    if (cs.textOverflow === 'ellipsis') return // deliberate truncation
    if (el.clientWidth <= 2 || el.clientHeight <= 2) return // sr-only text, a 1px box on purpose
    if (el.scrollWidth > el.clientWidth + 2 && (el.textContent || '').trim()) {
      // scrollWidth also counts decorative overshoot (a ::after notch, a hover underline). Measure the TEXT:
      // only report when the words themselves reach past the box.
      const range = document.createRange()
      range.selectNodeContents(el)
      const tr = range.getBoundingClientRect(), br = el.getBoundingClientRect()
      if (tr.right <= br.right + 2 && tr.left >= br.left - 2) return
      clip++
      add('warn', 'clip', el, `text cut off (${Math.round(tr.width)}px of text in a ${Math.round(br.width)}px box)`)
    }
  })

  // sideways scroll
  const de = document.documentElement
  if (!lenient && de.scrollWidth > de.clientWidth + 1) {
    // name the widest offender so the finding is actionable
    let worst = null, w = 0
    document.querySelectorAll('body *').forEach(el => {
      const r = el.getBoundingClientRect()
      if (r.right > de.clientWidth + 1 && r.width > 0 && r.right > w && visible(el)) { w = r.right; worst = el }
    })
    out.push({ sev: 'fail', kind: 'overflow', el: worst ? desc(worst) : 'page', msg: `page is ${de.scrollWidth}px wide in a ${de.clientWidth}px window` })
  }

  // tables: a table wider than its frame must sit in something that scrolls, and the frame should say it scrolls
  document.querySelectorAll('table').forEach(t => {
    if (!visible(t) || t.closest('[aria-hidden=true]')) return
    const tw = t.getBoundingClientRect().width
    let a = t.parentElement, scroller = null
    while (a && a !== document.body) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll') { scroller = a; break } a = a.parentElement }
    const frame = (scroller || t.parentElement).getBoundingClientRect().width
    if (tw <= frame + 3) return
    if (!scroller) { add('fail', 'table', t, `table is ${Math.round(tw)}px in a ${Math.round(frame)}px frame and nothing scrolls: columns are unreachable`); return }
    const bg = getComputedStyle(scroller).backgroundImage
    if (!/gradient/.test(bg)) add('warn', 'tablecue', t, 'table scrolls sideways but nothing on screen says so (no scroll shadow)')
  })

  // headings
  const h1s = [...document.querySelectorAll('h1')].filter(visible)
  // /dev/* surfaces mount several pages side by side, so one h1 each is expected there
  if (!dev && h1s.length !== 1) out.push({ sev: 'warn', kind: 'h1', el: 'page', msg: `${h1s.length} visible h1 elements (want exactly 1)` })

  return out
}

/** Open the dialogs a desk offers and audit each one. Runs only on the /dev/desk surfaces, where every desk is mounted
 *  with fixtures and buttons are safe to press (writes stay in memory). A dialog must be a readable width, keep its text
 *  off its own edge, keep everything inside itself, and stay on screen. */
async function auditModals(browser, route, vp) {
  const out = []
  const OPENER = /reject|decline|create|new |add |edit|teams for|put .* on a break|archive|remove|delete|reveal|show contact|decision|schedule|note/i
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch })
  const page = await ctx.newPage()
  try {
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(1200)
    const labels = await page.evaluate(src => {
      const re = new RegExp(src, 'i'); const seen = new Set()
      return [...document.querySelectorAll('.admin button')].filter(e => e.getBoundingClientRect().width > 0 && !e.disabled).map(e => (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ')).filter(t => t && re.test(t) && !seen.has(t.replace(/test [a-z ]+/i, '')) && seen.add(t.replace(/test [a-z ]+/i, ''))).slice(0, 8)
    }, OPENER.source)
    if (process.env.UX_DEBUG) console.log('modal openers:', route.slice(0, 40), vp.name, JSON.stringify(labels))
    for (const label of labels) {
      await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 }); await page.waitForTimeout(1500)
      const opened = await page.evaluate(l => { const e = [...document.querySelectorAll('.admin button')].find(x => x.getBoundingClientRect().width > 0 && ((x.getAttribute('aria-label') || x.textContent || '').trim().replace(/\s+/g, ' ') === l)); if (!e) return false; e.scrollIntoView({ block: 'center', behavior: 'instant' }); e.click(); return true }, label)
      if (process.env.UX_DEBUG) console.log('  opener', JSON.stringify(label), opened)
      if (!opened) continue
      await page.waitForTimeout(450)
      const found = await page.evaluate(({ phone }) => {
        const d = document.querySelector('[role=dialog], [role=alertdialog]'); if (!d) return null
        const r = d.getBoundingClientRect(), res = []
        const name = (d.getAttribute('aria-label') || d.textContent || '').trim().slice(0, 36)
        // The Drives form is a two-pane editor and is wide on purpose (.pm-modal, max 840): allowed up to 900.
        const wideOk = d.classList.contains('pm-modal') || d.classList.contains('modal--wide')
        if (!phone && r.width > (wideOk ? 900 : 760)) res.push(['fail', 'modal-wide', `${Math.round(r.width)}px wide (readable max is ~560, ~900 for a deliberately wide editor)`])
        if (r.left < -1 || r.right > innerWidth + 1) res.push(['fail', 'modal-offscreen', 'dialog extends past the screen edge'])
        const oy = getComputedStyle(d).overflowY
        if ((r.top < -1 || r.bottom > innerHeight + 1) && oy === 'visible') res.push(['fail', 'modal-offscreen', 'dialog is taller than the screen and does not scroll'])
        let flush = 0, cut = 0
        d.querySelectorAll('*').forEach(e => {
          const er = e.getBoundingClientRect(); if (er.width < 2 || er.height < 2) return
          if (er.right > r.right + 1.5 && getComputedStyle(e).position !== 'absolute') cut++
          const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 3)
          if (own && er.left - r.left < 10 && !e.closest('.panel-h, .modal-head')) flush++
        })
        if (cut) res.push(['fail', 'modal-cut', `${cut} element(s) extend past the dialog edge and are cut off`])
        if (flush) res.push(['warn', 'modal-flush', `${flush} text element(s) sit against the dialog edge with no padding`])
        return res.map(x => ({ sev: x[0], kind: x[1], el: `dialog "${name}"`, msg: x[2] }))
      }, { phone: vp.isMobile })
      if (process.env.UX_DEBUG) console.log('  dialog result', JSON.stringify(found))
      if (found) out.push(...found.map(f => ({ ...f, msg: `${f.msg} (opened by "${label.slice(0, 40)}")` })))
    }
  } catch (e) { if (process.env.UX_DEBUG) console.log('modal audit error:', route, String(e.message).slice(0, 200)) }
  await ctx.close()
  return out
}

/** Tab through the first stops; report stops with no visible focus indication. */
async function focusAudit(page) {
  const bad = []
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0) })
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab')
    const r = await page.evaluate(() => {
      const el = document.activeElement
      if (!el || el === document.body) return null
      if (el.tagName === 'A' && /^skip to/i.test(el.textContent || '')) return null // slides in over 150 ms; measured too early
      const cs = getComputedStyle(el)
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
      const shadow = cs.boxShadow && cs.boxShadow !== 'none'
      // :focus-visible styles that change border or background count too, so compare to an unfocused clone
      const probe = el.cloneNode(false)
      const same = (() => {
        try {
          el.blur()
          const b = getComputedStyle(el)
          const geo = (c, e) => [c.outlineStyle, c.boxShadow, c.borderColor, c.backgroundColor, c.transform, c.clipPath, c.opacity, (() => { const r = e.getBoundingClientRect(); return `${Math.round(r.top)},${Math.round(r.left)},${Math.round(r.width)}` })()].join('|')
          const unf = geo(b, el)
          el.focus({ focusVisible: true })
          const f = getComputedStyle(el)
          return unf === geo(f, el)
        } catch { return false }
      })()
      void probe
      const rect = el.getBoundingClientRect()
      return {
        tag: el.tagName.toLowerCase(), txt: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40),
        none: !outline && !shadow && same, visible: rect.width > 0 && rect.height > 0,
      }
    })
    if (r && r.visible && r.none) bad.push({ sev: 'warn', kind: 'focus', el: `${r.tag} "${r.txt}"`, msg: 'no visible change when keyboard-focused' })
  }
  return bad
}

async function auditRoute(browser, route, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch,
    deviceScaleFactor: 1,
  })
  const page = await ctx.newPage()
  const errors = []
  let requests = 0, bytes = 0
  page.on('pageerror', e => errors.push(String(e.message || e).slice(0, 200)))
  page.on('response', async r => { requests++; try { const l = r.headers()['content-length']; if (l) bytes += Number(l) } catch { /* ignore */ } })
  await page.addInitScript(() => {
    window.__ux = { fcp: null, lcp: null, longTasks: 0, longMs: 0 }
    try {
      new PerformanceObserver(l => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__ux.fcp = e.startTime }).observe({ type: 'paint', buffered: true })
      new PerformanceObserver(l => { const e = l.getEntries().pop(); if (e) window.__ux.lcp = e.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__ux.longTasks++; window.__ux.longMs += e.duration } }).observe({ type: 'longtask', buffered: true })
    } catch { /* observer types vary by browser */ }
  })
  const t0 = Date.now()
  let loadErr = null
  try { await page.goto(BASE + route, { waitUntil: 'load', timeout: 30000 }) } catch (e) { loadErr = String(e.message).slice(0, 160) }
  await page.waitForTimeout(1500) // let lazy chunks and first fetches settle
  const wall = Date.now() - t0
  const findings = loadErr ? [{ sev: 'fail', kind: 'console', el: 'page', msg: `did not load: ${loadErr}` }] : await page.evaluate(inspect, { phone: vp.isMobile, lenient: LENIENT.some(p => route.startsWith(p)), dev: route.startsWith('/dev/') })
  if (!loadErr && !vp.isMobile) findings.push(...await focusAudit(page))
  const perf = await page.evaluate(() => window.__ux).catch(() => ({}))
  for (const m of errors) findings.push({ sev: 'fail', kind: 'console', el: 'page', msg: m })
  if (perf?.fcp > 2500) findings.push({ sev: 'warn', kind: 'slow', el: 'page', msg: `first contentful paint ${Math.round(perf.fcp)} ms` })
  const dev = /localhost|127\.0\.0\.1/.test(BASE) // the dev server serves unbundled modules: request and byte counts mean nothing there
  if (!dev && requests > 120) findings.push({ sev: 'warn', kind: 'slow', el: 'page', msg: `${requests} requests` })
  if (!dev && bytes > 2.5e6) findings.push({ sev: 'warn', kind: 'slow', el: 'page', msg: `${(bytes / 1e6).toFixed(1)} MB transferred` })
  await ctx.close()
  if (route.startsWith('/dev/desk') && route.includes('scenario=populated') && !route.includes('desk=guide')) findings.push(...await auditModals(browser, route, vp))
  return { route, viewport: vp.name, wallMs: wall, fcp: perf?.fcp ? Math.round(perf.fcp) : null, lcp: perf?.lcp ? Math.round(perf.lcp) : null,
    longTasks: perf?.longTasks ?? 0, longMs: Math.round(perf?.longMs ?? 0), requests, kb: Math.round(bytes / 1024), findings }
}

const routes = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_ROUTES
const browser = await chromium.launch()
const results = []
for (const route of routes) for (const vp of VIEWPORTS) {
  const r = await auditRoute(browser, route, vp)
  results.push(r)
  const f = r.findings.filter(x => x.sev === 'fail').length, w = r.findings.filter(x => x.sev === 'warn').length
  console.log(`${f ? 'FAIL' : w ? 'warn' : ' ok '}  ${vp.name.padEnd(6)} ${route}  fail ${f}  warn ${w}  fcp ${r.fcp ?? '-'}ms  ${r.requests} req`)
}
await browser.close()

// Roll findings up by kind so a pattern across many pages reads as one problem, not 400 lines.
const byKind = {}
for (const r of results) for (const f of r.findings) {
  const k = (byKind[`${f.sev}:${f.kind}`] ||= { sev: f.sev, kind: f.kind, count: 0, routes: new Set(), samples: [] })
  k.count++; k.routes.add(r.route)
  if (k.samples.length < 6 && !k.samples.some(s => s.el === f.el)) k.samples.push({ route: r.route, viewport: r.viewport, el: f.el, msg: f.msg })
}
const rollup = Object.values(byKind).sort((a, b) => (a.sev === b.sev ? b.count - a.count : a.sev === 'fail' ? -1 : 1))
mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'latest.json'), JSON.stringify({ base: BASE, results, rollup: rollup.map(k => ({ ...k, routes: [...k.routes] })) }, null, 1))
const md = ['# UX harness, latest run', '', `Base: ${BASE}. Routes: ${routes.length}. Generated by \`scripts/ux-harness.mjs\`; do not edit by hand.`, '',
  '## Findings by kind', '', '| severity | kind | count | routes | example |', '|---|---|---|---|---|',
  ...rollup.map(k => `| ${k.sev} | ${k.kind} | ${k.count} | ${k.routes.size} | ${(k.samples[0]?.el || '').replace(/\|/g, '/')} (${k.samples[0]?.route}) |`), '',
  '## Speed by route', '', '| route | viewport | FCP ms | LCP ms | long tasks | requests | KB |', '|---|---|---|---|---|---|---|',
  ...results.map(r => `| ${r.route} | ${r.viewport} | ${r.fcp ?? '-'} | ${r.lcp ?? '-'} | ${r.longTasks} (${r.longMs} ms) | ${r.requests} | ${r.kb} |`)]
writeFileSync(resolve(OUT, 'latest.md'), md.join('\n') + '\n')
const fails = rollup.filter(k => k.sev === 'fail').reduce((n, k) => n + k.count, 0)
console.log(`\n${results.length} runs, ${fails} fail findings, ${rollup.length} kinds. Wrote docs/ux-harness/latest.md`)
if (STRICT && fails) process.exit(1)
