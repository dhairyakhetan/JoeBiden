#!/usr/bin/env node
/**
 * The living product guide.
 *
 *   node scripts/feature-map/generate.mjs            write docs/product-guide.html and docs/feature-map/feature-map.json
 *   node scripts/feature-map/generate.mjs --check    same, then exit 1 if the registry has drifted from the code
 *   node scripts/feature-map/generate.mjs --session  SessionStart hook: write, then print what needs updating (never fails)
 *
 * Two inputs:
 *   1. The code. Routes come from src/App.tsx, desks from src/director/deskAccess.ts, and each page's tables,
 *      services and outbound links are read from its source. Nothing here is typed by hand.
 *   2. scripts/feature-map/features.json: the plain-language text, who it is for, and why two features connect.
 *
 * The generator cannot write good prose, so it does the part a machine can do: it fails (or, in --session, reports)
 * the moment a page or desk exists with no entry, an entry points at something that is gone, or a feature's
 * audience contradicts how its route is gated. Writing the entry is the job of whoever changed the feature.
 * See CLAUDE.md, "The living product guide".
 *
 * No dependencies on purpose: it must run in a fresh session before `npm install`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FRONTEND = path.resolve(HERE, '../..')
const REPO = path.resolve(FRONTEND, '..')
const SRC = path.join(FRONTEND, 'src')
const OUT_HTML = path.join(REPO, 'docs', 'product-guide.html')
// The same guide plus what only leaders should see: a status on every feature, a flow map for every desk and the
// findings from checking each one. Shown by director/ProductGuide.tsx. The shareable file above never carries any of it.
const OUT_HTML_LEADERS = path.join(REPO, 'docs', 'product-guide-leaders.html')
const AUDIT = path.join(HERE, 'desk-audit.json')
const OUT_JSON = path.join(REPO, 'docs', 'feature-map', 'feature-map.json')
const FEATURES = path.join(HERE, 'features.json')
const TEMPLATE = path.join(HERE, 'guide.template.html')

const STATUS_STATES = ['working', 'partial', 'retired', 'unverified']
const STATUS_LABELS = { working: 'Working', partial: 'Partly working', retired: 'Retired or not built', unverified: 'Not verified' }
const FINDING_SEV = ['bug', 'risk', 'gap']
const FINDING_STATE = ['fixed', 'open', 'flagged', 'unverified']
const VERDICTS = ['healthy', 'flawed', 'stale']

const ROLES = ['visitor', 'applicant', 'member', 'lead', 'hod', 'hr']
const ROLE_RANK = { visitor: 0, applicant: 1, member: 2, lead: 2, hod: 3, hr: 4 }
const GATE_NAME = ['anyone', 'signed in', 'active member', 'HoD or director', 'HR or super admin']

const read = (p) => fs.readFileSync(p, 'utf8')
const rel = (p) => path.relative(FRONTEND, p).split(path.sep).join('/')

// ── routes ────────────────────────────────────────────────────────────────────

function lazyImports(appSrc) {
  const map = new Map()
  for (const m of appSrc.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    map.set(m[1], path.join(SRC, m[2]))
  }
  // routeModules.ts exposes some pages through ROUTE_LOADERS.<key>
  const rm = path.join(SRC, 'lib', 'routeModules.ts')
  const loaders = new Map()
  if (fs.existsSync(rm)) {
    for (const m of read(rm).matchAll(/(\w+)\s*:\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      loaders.set(m[1], path.resolve(path.dirname(rm), m[2]))
    }
  }
  for (const m of appSrc.matchAll(/const\s+(\w+)\s*=\s*lazy\(\s*ROUTE_LOADERS\.(\w+)\s*\)/g)) {
    if (loaders.has(m[2])) map.set(m[1], loaders.get(m[2]))
  }
  return map
}

function resolveFile(p) {
  for (const ext of ['.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx']) {
    if (fs.existsSync(p + ext)) return p + ext
  }
  return fs.existsSync(p) && fs.statSync(p).isFile() ? p : null
}

/** Gate rank for a <Route> line: 0 public, 1 signed in, 2 active member, 3 leader, 4 super. */
function gateOf(line, inherited = 0) {
  if (/requireSuperAdmin/.test(line)) return 4
  if (/requireDirector/.test(line)) return 3
  if (/requireActive/.test(line)) return 2
  if (/ProtectedRoute/.test(line)) return 1
  return inherited
}

export function readRoutes() {
  const app = read(path.join(SRC, 'App.tsx'))
  const lazy = lazyImports(app)
  const routes = []
  let parent = null // last absolute route that opens children
  for (const line of app.split('\n')) {
    const m = /<Route\b[^>]*?\bpath="([^"]+)"/.exec(line)
    if (!m) continue
    if (/import\.meta\.env\.DEV/.test(line)) continue
    let p = m[1]
    const selfClosing = /\/>\s*$/.test(line.trim()) || /\/>\s*\}?\s*$/.test(line.trim())
    let inherited = 0
    if (!p.startsWith('/')) {
      if (!parent || p === '*') continue
      parent.route.wrapper = true // it only holds children: the children are the pages
      inherited = parent.gate
      p = (parent.path + '/' + p).replace(/\/+/g, '/')
    }
    if (p === '*' || p.startsWith('/dev/')) continue
    const el = /element=\{<(\w+)/.exec(line)
    const redirect = /Navigate|Redirect/.test(line.split('element=')[1] || '')
    const gate = gateOf(line, inherited)
    const comp = el && !['ProtectedRoute', 'PublicLayout', 'DashboardLayout'].includes(el[1]) ? el[1] : null
    // a protected wrapper route names its page as a nested <Route index element=...>; resolve that below
    const route = { path: p, gate, redirect, component: comp, file: comp && lazy.has(comp) ? rel(resolveFile(lazy.get(comp))) : null }
    routes.push(route)
    if (!selfClosing && p.startsWith('/')) parent = { path: p, gate, route }
  }
  // wrapper routes (ProtectedRoute > DashboardLayout) hold their page in a nested index route on the next lines
  const lines = app.split('\n')
  for (const r of routes) {
    if (r.file || r.redirect) continue
    const at = lines.findIndex(l => l.includes(`path="${r.path}"`))
    for (let i = at + 1; i < Math.min(at + 8, lines.length); i++) {
      const im = /<Route\s+index\s+element=\{<(\w+)/.exec(lines[i])
      if (im && lazy.has(im[1])) { r.component = im[1]; r.file = rel(resolveFile(lazy.get(im[1]))); break }
      const um = /<Route\s+path="[^"]+"\s+element=\{<(\w+)/.exec(lines[i])
      if (um && lazy.has(um[1])) { r.component = um[1]; r.file = rel(resolveFile(lazy.get(um[1]))); break }
    }
  }
  const seen = new Set()
  return routes.filter(r => !r.wrapper).filter(r => (seen.has(r.path) ? false : seen.add(r.path)))
}

export function readDesks() {
  const src = read(path.join(SRC, 'director', 'deskAccess.ts'))
  const modules = read(path.join(SRC, 'director', 'deskModules.ts'))
  const files = new Map()
  for (const m of modules.matchAll(/(\w+)\s*:\s*\(\)\s*=>\s*import\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const f = resolveFile(path.resolve(path.join(SRC, 'director'), m[2]))
    if (f) files.set(m[1], rel(f))
  }
  const desks = []
  const re = /\{\s*key:\s*'(\w+)',\s*label:\s*'([^']*)',\s*icon:\s*'[^']*',\s*path:\s*'([^']*)',\s*privilege:\s*'(\w+)',\s*blurb:\s*'((?:[^'\\]|\\.)*)'/g
  for (const m of src.matchAll(re)) {
    desks.push({ key: m[1], label: m[2], path: m[3], privilege: m[4], blurb: m[5].replace(/\\'/g, "'"), file: files.get(m[1]) ?? null })
  }
  return desks
}

// ── facts read from a page's source ───────────────────────────────────────────

function sourceBundle(file) {
  // the page itself plus the files it imports from its own folder (not shared components, which would
  // make every page look like it links to everything the nav links to)
  if (!file) return ''
  const abs = path.join(FRONTEND, file)
  if (!fs.existsSync(abs)) return ''
  let text = read(abs)
  const dir = path.dirname(abs)
  for (const m of text.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) {
    const f = resolveFile(path.resolve(dir, m[1]))
    if (f && /\.(tsx|ts|jsx|js)$/.test(f) && !/\.test\./.test(f)) text += '\n' + read(f)
  }
  return text
}

function factsFrom(text) {
  const tables = [...new Set([...text.matchAll(/\.from\(\s*['"`]([a-z_][a-z0-9_]*)['"`]\s*\)/g)].map(m => m[1]))].sort()
  const services = [...new Set([...text.matchAll(/from\s+['"]\.\.?\/(?:\.\.\/)?services\/(\w+)['"]/g)].map(m => m[1]))].sort()
  const links = [...new Set([...text.matchAll(/(['"`])(\/[a-z0-9][a-z0-9\-_/]*)\1/g)].map(m => m[2].replace(/\/$/, '')))]
  return { tables, services, links }
}

function patternRegex(pattern) {
  if (pattern.endsWith('/*')) {
    const base = pattern.slice(0, -2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:\w+/g, '[^/]+')
    return new RegExp(`^${base}(/.*)?$`)
  }
  return new RegExp('^' + pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\?:\w+/g, '[^/]+') + '$')
}

// ── analysis ──────────────────────────────────────────────────────────────────

export function analyze() {
  const registry = JSON.parse(read(FEATURES))
  const routes = readRoutes()
  const desks = readDesks()
  const errors = []
  const warnings = []

  const featureById = new Map(registry.features.map(f => [f.id, f]))
  if (featureById.size !== registry.features.length) errors.push('features.json has a duplicate feature id')
  const areaIds = new Set(registry.areas.map(a => a.id))

  // claims
  const claimedRoute = new Map() // route pattern -> feature id
  const claimedDesk = new Map()
  for (const f of registry.features) {
    if (!areaIds.has(f.area)) errors.push(`feature "${f.id}" has unknown area "${f.area}"`)
    for (const k of ['name', 'summary', 'use', 'reach']) if (!f[k] || !String(f[k]).trim()) errors.push(`feature "${f.id}" has no ${k}`)
    if (!Array.isArray(f.who) || f.who.length === 0) errors.push(`feature "${f.id}" lists no audience (who)`)
    for (const w of f.who || []) if (!ROLES.includes(w)) errors.push(`feature "${f.id}" has an unknown role "${w}"`)
    for (const r of f.routes || []) {
      if (claimedRoute.has(r)) errors.push(`route ${r} is claimed by both "${claimedRoute.get(r)}" and "${f.id}"`)
      claimedRoute.set(r, f.id)
    }
    for (const d of f.desks || []) {
      if (claimedDesk.has(d)) errors.push(`desk ${d} is claimed by both "${claimedDesk.get(d)}" and "${f.id}"`)
      claimedDesk.set(d, f.id)
    }
    for (const c of f.connects || []) {
      if (!featureById.has(c.to)) errors.push(`feature "${f.id}" connects to unknown feature "${c.to}"`)
      if (c.to === f.id) errors.push(`feature "${f.id}" connects to itself`)
      if (!c.why) errors.push(`feature "${f.id}" has a connection to "${c.to}" with no reason`)
    }
  }

  const liveRoutes = routes.filter(r => !r.redirect)
  const redirects = routes.filter(r => r.redirect)
  const routePaths = new Set(routes.map(r => r.path))

  // every real page is claimed; /director/* desks are claimed through `desks`
  const claimMatchers = [...claimedRoute.keys()].map(p => ({ p, re: patternRegex(p) }))
  const unclaimedRoutes = []
  for (const r of liveRoutes) {
    if (r.path === '/director') {
      if (!claimedRoute.has('/director')) unclaimedRoutes.push(r.path)
      continue
    }
    const hit = claimMatchers.find(c => c.p === r.path || c.re.test(r.path))
    if (!hit) unclaimedRoutes.push(r.path)
  }
  // a redirect needs no entry, but a feature may claim one (the old /labs addresses) and that must still exist
  for (const p of claimedRoute.keys()) {
    const exists = routePaths.has(p) || [...routePaths].some(x => patternRegex(p).test(x))
    if (!exists) errors.push(`feature "${claimedRoute.get(p)}" claims ${p}, which is no longer a route in App.tsx`)
  }
  for (const p of unclaimedRoutes) errors.push(`new page with no guide entry: ${p}. Add it to a feature's "routes" in scripts/feature-map/features.json (or add a feature).`)

  const deskKeys = new Set(desks.map(d => d.key))
  for (const d of desks) if (!claimedDesk.has(d.key)) errors.push(`new desk with no guide entry: ${d.key} (${d.label}). Add "${d.key}" to a feature's "desks".`)
  for (const k of claimedDesk.keys()) if (!deskKeys.has(k)) errors.push(`feature "${claimedDesk.get(k)}" claims desk "${k}", which is no longer in deskAccess.ts`)

  // statuses and the desk audit (leaders build). Missing ones are errors on purpose: a new feature or desk must say
  // whether it works, and a deleted desk must not leave a flow map behind.
  for (const f of registry.features) {
    if (!f.status || !STATUS_STATES.includes(f.status.state)) errors.push(`feature "${f.id}" has no status (one of ${STATUS_STATES.join(', ')}) in features.json`)
    else if (!f.status.note || !String(f.status.note).trim()) errors.push(`feature "${f.id}" has a status but no one-line note saying why`)
  }
  let audit = null
  if (!fs.existsSync(AUDIT)) errors.push('scripts/feature-map/desk-audit.json is missing (flow maps and findings for the leaders guide)')
  else {
    audit = JSON.parse(read(AUDIT))
    const flowKeys = new Set()
    for (const d of audit.flows || []) {
      if (d.desk !== 'shell' && !deskKeys.has(d.desk)) errors.push(`desk-audit.json has a flow map for desk "${d.desk}", which is not in deskAccess.ts`)
      if (flowKeys.has(d.desk)) errors.push(`desk-audit.json has two flow maps for "${d.desk}"`)
      flowKeys.add(d.desk)
      if (!VERDICTS.includes(d.verdict)) errors.push(`flow map "${d.desk}" has verdict "${d.verdict}" (use ${VERDICTS.join(', ')})`)
      if (!d.name || !d.summary || !d.who || !Array.isArray(d.rows) || d.rows.length === 0) errors.push(`flow map "${d.desk}" needs name, summary, who and at least one row`)
      for (const r of d.rows || []) if (!r.control || !r.does) errors.push(`flow map "${d.desk}" has a row with no control or no description`)
    }
    for (const d of desks) if (!flowKeys.has(d.key)) errors.push(`desk "${d.key}" (${d.label}) has no flow map in desk-audit.json`)
    const ids = new Set()
    for (const x of audit.findings || []) {
      if (ids.has(x.id)) errors.push(`desk-audit.json has two findings with id "${x.id}"`)
      ids.add(x.id)
      if (!flowKeys.has(x.desk)) errors.push(`finding "${x.id}" points at "${x.desk}", which has no flow map`)
      if (!FINDING_SEV.includes(x.sev)) errors.push(`finding "${x.id}" has severity "${x.sev}" (use ${FINDING_SEV.join(', ')})`)
      if (!FINDING_STATE.includes(x.state)) errors.push(`finding "${x.id}" has state "${x.state}" (use ${FINDING_STATE.join(', ')})`)
      if (!x.title || !x.plain) errors.push(`finding "${x.id}" needs a title and a plain-language description`)
      if (x.state === 'fixed' && !x.how) errors.push(`finding "${x.id}" is marked fixed but says nothing about what was done`)
    }
  }

  // audience must not contradict the gate
  const features = registry.features.map(f => {
    const myRoutes = liveRoutes.filter(r => (f.routes || []).some(p => p === r.path || patternRegex(p).test(r.path)))
    const myRedirects = redirects.filter(r => (f.routes || []).includes(r.path))
    const myDesks = (f.desks || []).map(k => desks.find(d => d.key === k)).filter(Boolean)
    const ranks = [
      ...myRoutes.map(r => r.gate),
      ...myDesks.map(d => (d.privilege === 'super' ? 4 : 3)),
    ]
    // /director itself is a leader route
    const gate = ranks.length ? Math.min(...ranks) : null
    if (gate !== null) {
      for (const w of f.who || []) {
        if (ROLE_RANK[w] < gate) errors.push(`feature "${f.id}" lists "${w}" as an audience, but its page needs ${GATE_NAME[gate]}`)
      }
      // and the reverse: someone who clearly can use it is missing
      const should = ROLES.filter(w => ROLE_RANK[w] >= gate && w !== 'applicant' && !(w === 'lead' && gate >= 3))
      const missing = should.filter(w => !(f.who || []).includes(w) && !(w === 'visitor'))
      if (gate >= 2 && missing.length && !(f.who || []).some(w => ROLE_RANK[w] >= gate)) {
        warnings.push(`feature "${f.id}" does not list who can use it (${missing.join(', ')})`)
      }
    }
    const files = new Set([...myRoutes.map(r => r.file), ...myDesks.map(d => d.file)].filter(Boolean))
    let text = ''
    for (const file of files) text += '\n' + sourceBundle(file)
    const facts = factsFrom(text)
    return {
      ...f,
      gate: gate === null ? null : GATE_NAME[gate],
      pages: myRoutes.map(r => ({ path: r.path, file: r.file, gate: GATE_NAME[r.gate] })),
      redirects: myRedirects.map(r => r.path),
      deskList: myDesks.map(d => ({ key: d.key, label: d.label, path: '/director/' + d.path, privilege: d.privilege, blurb: d.blurb })),
      files: [...files].sort(),
      tables: facts.tables,
      services: facts.services,
      _links: facts.links,
    }
  })

  // links found in code -> edges between features
  const ownerOf = (link) => {
    for (const f of features) {
      const all = [...(f.routes || []), ...f.deskList.map(d => d.path)]
      if (all.some(p => p === link || patternRegex(p).test(link))) return f.id
    }
    const root = link.split('/').slice(0, 2).join('/')
    for (const f of features) if ((f.routes || []).some(p => p === root || p.startsWith(root + '/'))) return f.id
    return null
  }
  const edges = []
  const key = (a, b) => `${a}>${b}`
  const seenEdge = new Set()
  for (const f of features) {
    for (const c of f.connects || []) {
      if (featureById.has(c.to) && !seenEdge.has(key(f.id, c.to))) { seenEdge.add(key(f.id, c.to)); edges.push({ from: f.id, to: c.to, why: c.why, kind: 'described' }) }
    }
  }
  for (const f of features) {
    for (const l of f._links) {
      const to = ownerOf(l)
      if (to && to !== f.id && !seenEdge.has(key(f.id, to))) { seenEdge.add(key(f.id, to)); edges.push({ from: f.id, to, why: `the page links to ${l}`, kind: 'in code' }) }
    }
  }
  for (const f of features) delete f._links

  // pages nobody links to: the route string appears nowhere in the app outside its own files and the router
  const corpus = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { if (!['terranotes', 'demo', 'dev', 'terrathon', 'paradox'].includes(e.name) || dir !== SRC) walk(p) }
      else if (/\.(tsx|ts|jsx|js)$/.test(e.name) && !/\.test\./.test(e.name)) corpus.push(p)
    }
  }
  walk(SRC)
  const skip = new Set(['src/App.tsx', 'src/lib/routeModules.ts', 'src/lib/metaConfig.ts', 'src/auth/ProtectedRoute.tsx'])
  const texts = corpus.filter(p => !skip.has(rel(p))).map(p => ({ file: rel(p), text: read(p) }))
  const orphans = []
  for (const f of features) {
    if (f.area === 'leadership' || f.area === 'joining') continue
    for (const pg of f.pages) {
      if (['/', '/login', '/auth/callback', '/register', '/pending', '/rejected', '/choose-team', '/brand', '/thank-you', '/join'].includes(pg.path)) continue
      const staticPart = pg.path.split('/:')[0].replace(/\/\*$/, '')
      if (staticPart.length < 2) continue
      const own = new Set(f.files)
      const inbound = texts.some(t => !own.has(t.file) && (t.text.includes(`'${staticPart}'`) || t.text.includes(`"${staticPart}"`) || t.text.includes(`\`${staticPart}`) || t.text.includes(`'${staticPart}/`) || t.text.includes(`"${staticPart}/`) || t.text.includes(`'${staticPart}?`)))
      if (!inbound) orphans.push({ feature: f.id, path: pg.path })
    }
  }
  for (const o of orphans) warnings.push(`no link to ${o.path} was found anywhere in the app (feature "${o.feature}"): a page people can only reach by typing the address`)

  // links to addresses that are not routes: typos and pages that were removed
  const known = [...routes.map(r => patternRegex(r.path)), ...desks.map(d => patternRegex('/director/' + d.path))]
  const brokenLinks = []
  for (const t of texts) {
    for (const m of t.text.matchAll(/(?:\bto=|\bhref=|\bnavigate\()\s*[{(]?\s*(['"`])(\/[a-z0-9][a-z0-9\-/]*)\1/g)) {
      const link = m[2].replace(/\/$/, '')
      if (!known.some(re => re.test(link))) brokenLinks.push({ file: t.file, link })
    }
  }
  const seenBroken = new Set()
  for (const b of brokenLinks) {
    const k = b.file + b.link
    if (seenBroken.has(k)) continue
    seenBroken.add(k)
    warnings.push(`${b.file} links to ${b.link}, which is not a page in App.tsx`)
  }

  // features whose code changed after the guide was last edited
  const stale = staleFeatures(features)

  return { registry, audit, features, areas: registry.areas, edges, desks, routes, errors, warnings, orphans, brokenLinks, stale }
}

function git(args) {
  try { return execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return '' }
}

function staleFeatures(features) {
  const base = git(['log', '-1', '--format=%H', '--', 'frontend/scripts/feature-map/features.json'])
  if (!base) return []
  const changed = new Set([
    ...git(['diff', '--name-only', `${base}..HEAD`, '--', 'frontend/src']).split('\n'),
    ...git(['diff', '--name-only', 'HEAD', '--', 'frontend/src']).split('\n'),
    ...git(['ls-files', '--others', '--exclude-standard', '--', 'frontend/src']).split('\n'),
  ].filter(Boolean).map(f => f.replace(/^frontend\//, '')))
  const out = []
  for (const f of features) {
    const dirs = new Set(f.files.map(x => path.posix.dirname(x)))
    const hit = [...changed].filter(c => f.files.includes(c) || [...dirs].some(d => path.posix.dirname(c) === d && /\.(tsx|ts)$/.test(c) && !/\.test\./.test(c) && !d.endsWith('/components') && d !== 'src/director' && d !== 'src/public'))
    if (hit.length) out.push({ feature: f.id, files: hit.slice(0, 4), more: Math.max(0, hit.length - 4) })
  }
  return out
}

// ── output ────────────────────────────────────────────────────────────────────

function buildHtml(a, leaders = false) {
  const data = {
    areas: a.areas,
    roles: [
      { id: 'visitor', label: 'Visitor', note: 'Not signed in' },
      { id: 'applicant', label: 'Applicant', note: 'Signed in, not yet approved' },
      { id: 'member', label: 'Member', note: 'Approved volunteer' },
      { id: 'lead', label: 'Team lead', note: 'A member who leads one team' },
      { id: 'hod', label: 'HoD or director', note: 'Leadership' },
      { id: 'hr', label: 'HR or super admin', note: 'The top tier' },
    ],
    features: a.features.map(f => ({
      id: f.id, area: f.area, name: f.name, summary: f.summary, use: f.use, reach: f.reach, who: f.who,
      paths: [...f.pages.map(p => p.path), ...f.deskList.map(d => d.path)],
      desks: f.deskList.map(d => d.label),
      gate: f.gate,
      ...(leaders && f.status ? { status: { state: f.status.state, note: f.status.note } } : {}),
    })),
    edges: a.edges.map(e => ({ from: e.from, to: e.to, why: e.why, kind: e.kind })),
  }
  if (leaders && a.audit) {
    data.leaders = true
    data.asOf = a.audit.asOf
    data.statusLabels = STATUS_LABELS
    data.flows = a.audit.flows
    data.findings = a.audit.findings
  }
  const tpl = read(TEMPLATE)
  return tpl.replace('/*__GUIDE_DATA__*/null', () => JSON.stringify(data))
}

function buildFacts(a) {
  return JSON.stringify({
    note: 'Generated by scripts/feature-map/generate.mjs. Do not edit. Regenerated at every session start.',
    counts: {
      features: a.features.length,
      pages: a.routes.filter(r => !r.redirect).length,
      desks: a.desks.length,
      connections: a.edges.length,
    },
    features: a.features.map(f => ({
      id: f.id, name: f.name, area: f.area, who: f.who, gate: f.gate,
      pages: f.pages, desks: f.deskList.map(d => ({ key: d.key, path: d.path, privilege: d.privilege })),
      tables: f.tables, services: f.services,
    })),
    edges: a.edges,
    redirects: a.routes.filter(r => r.redirect).map(r => r.path),
    pagesWithNoLinkIn: a.orphans,
  }, null, 2) + '\n'
}

function writeIfChanged(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  if (fs.existsSync(file) && read(file) === text) return false
  fs.writeFileSync(file, text)
  return true
}

function main() {
  const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--session') ? 'session' : 'build'
  let a
  try { a = analyze() } catch (e) {
    console.error('feature guide: could not read the code: ' + e.message)
    process.exit(mode === 'session' ? 0 : 1)
  }
  const wroteHtml = writeIfChanged(OUT_HTML, buildHtml(a)) | writeIfChanged(OUT_HTML_LEADERS, buildHtml(a, true))
  const wroteJson = writeIfChanged(OUT_JSON, buildFacts(a))

  const lines = []
  if (mode === 'session') {
    lines.push(`AquaTerra product guide: ${a.features.length} features, ${a.routes.filter(r => !r.redirect).length} pages, ${a.desks.length} desks, ${a.edges.length} connections.`)
    if (wroteHtml || wroteJson) lines.push('Regenerated docs/product-guide.html, docs/product-guide-leaders.html and docs/feature-map/feature-map.json (commit them with your work).')
    if (a.errors.length) {
      lines.push('', 'THE GUIDE IS OUT OF DATE. Fix these in frontend/scripts/feature-map/features.json before you finish (plain language, written for a member):')
      for (const e of a.errors) lines.push('  - ' + e)
    }
    if (a.stale.length) {
      lines.push('', 'Code changed since the guide was last edited. If behaviour changed, update the entry (and docs/PRODUCT_PRD.md if a rule changed):')
      for (const s of a.stale.slice(0, 12)) lines.push(`  - ${s.feature}: ${s.files.join(', ')}${s.more ? ` (+${s.more} more)` : ''}`)
    }
    if (a.warnings.length) {
      lines.push('', 'Usability warnings (real gaps, fix when you are in the area):')
      for (const w of a.warnings.slice(0, 8)) lines.push('  - ' + w)
    }
    if (!a.errors.length && !a.stale.length) lines.push('The guide matches the code.')
    console.log(lines.join('\n'))
    return
  }
  console.log(`product guide: ${a.features.length} features, ${a.routes.filter(r => !r.redirect).length} pages, ${a.desks.length} desks, ${a.edges.length} connections`)
  console.log(`  docs/product-guide.html ${wroteHtml ? 'written' : 'unchanged'}, docs/feature-map/feature-map.json ${wroteJson ? 'written' : 'unchanged'}`)
  for (const w of a.warnings) console.log('  warning: ' + w)
  for (const e of a.errors) console.error('  ERROR: ' + e)
  if (mode === 'check' && a.errors.length) {
    console.error(`\nproduct guide drifted from the code (${a.errors.length}). Edit frontend/scripts/feature-map/features.json.`)
    process.exit(1)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
