// ─── Paradox OS · P1 — real-data importer ────────────────────────────────────
// Parses the team's per-event workbooks (in scripts/import-data/, gitignored —
// PII/source) and replaces the generic Phase-2 seed with the REAL per-event
// SOPs: EVENT FLOW → paradox_runbook_steps, REQUIREMENTS → paradox_requirements,
// MESSAGE BANK → paradox_message_templates. Idempotent: each run DELETEs that
// event's rows then re-inserts, so re-running converges (no duplicates).
//
// Skipped on purpose: registrations (already live in the DB from the public
// site), and the freeform OVERVIEW / RULES narrative (rubric is entered via the
// Judging UI). Run:  PXTOKEN=sbp_... node scripts/import_paradox_workbooks.mjs
//
// xlsx (SheetJS) is a DEV-ONLY dependency (build/ops script, never bundled).
import XLSX from 'xlsx'
import fs from 'fs'

const DIR = 'C:/Users/kanis/Desktop/AquaTerra/LATEST WEB/vercelaq-main/frontend/scripts/import-data'
const REF = 'drvucogrjphctwfealxd'
const TOKEN = process.env.PXTOKEN
if (!TOKEN) { console.error('Set PXTOKEN'); process.exit(2) }

// workbook file → event slug (matches paradox_events.slug). PickleJam has no
// workbook; registrations workbook + afterparty handled separately/skipped.
const FILE_SLUG = {
  'ANKLE_BREAKER_BASKETBALL_PARADOX4.xlsx': 'basketball',
  'DREAM_DECK_IPL_AUCTION_PARADOX4.xlsx': 'ipl-auction',
  'SHOWSTOPPER_DANCE_PARADOX4.xlsx': 'danceoff',
  'SHUTTERNAUT_PHOTOGRAPHY_PARADOX4.xlsx': 'photography',
  'SOCCER_STORM_FIFA_PARADOX4.xlsx': 'ps5fifa',
  'STARTUP_STANDOFF_SHARKTANK_PARADOX4.xlsx': 'sharktank',
  'TERRAMUN_MUN_PARADOX4.xlsx': 'terramun',
  'THE_PRODIGY_BM_HRPR_PARADOX4.xlsx': 'bestmanager',
  'WICKET_WARS_CRICKET_PARADOX4.xlsx': 'cricket',
}

const q = async (sql) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Connection: 'close' },
    body: JSON.stringify({ query: sql }),
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`)
  return t
}

// ── SQL literal helpers ──
const sq = (v) => { if (v === null || v === undefined || String(v).trim() === '') return 'NULL'; return "'" + String(v).trim().replace(/'/g, "''") + "'" }
const sb = (v) => (v ? 'true' : 'false')
const si = (v) => { const n = parseInt(String(v).replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : 0 }

const sheet = (wb, name) => { const ws = wb.Sheets[name]; return ws ? XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' }) : null }
const findHeader = (rows, tokens) => rows.findIndex((r) => tokens.every((t) => r.some((c) => String(c).toUpperCase().includes(t))))
const colIdx = (header, token) => header.findIndex((c) => String(c).toUpperCase().includes(token))

const mapPhase = (p) => { const s = String(p).toUpperCase(); if (s.includes('REGISTR')) return 'reg'; if (s.includes('POST')) return 'post'; if (s.includes('ON-DAY') || s.includes('ON DAY') || s.includes('MATCH DAY') || s.includes('EVENT DAY')) return 'on_day'; return 'logistics' }
const mapStatus = (s) => { const x = String(s).toLowerCase(); if (x.includes('done') || x.includes('complete')) return 'done'; if (x.includes('progress')) return 'in_progress'; if (x.includes('block')) return 'blocked'; return 'todo' }
const isArranged = (v) => /^(yes|y|done|true|arranged|complete)/i.test(String(v).trim())
// gate / auto-condition heuristics from the task text — maps the dangerous steps.
function gateOf(task) {
  const t = String(task).toLowerCase()
  if (/open registration|registration.{0,8}open|greenlight/.test(t)) return { gate: true, auto: 'greenlit' }
  if (/breakeven|break-even/.test(t)) return { gate: false, auto: 'breakeven_reached' }
  if (/publish.{0,10}fixture|fixtures?.{0,12}(out|published|live|ready)|share.{0,10}fixture/.test(t)) return { gate: true, auto: 'fixtures_published' }
  if (/announce|winner announcement|declare winner|publish.{0,10}(result|winner)/.test(t)) return { gate: true, auto: 'results_published' }
  if (/enter.{0,10}result|results?.{0,8}(to|into).{0,12}judg|score.{0,8}sheet/.test(t)) return { gate: true, auto: 'results_entered' }
  if (/prize cash|hand.{0,6}(out|over).{0,10}(prize|cash)|disburse|cash prize/.test(t)) return { gate: true, auto: null }
  return { gate: false, auto: null }
}
const tmplMode = (name) => (/confirmation|fixture|winner|result|certificate|refund|ticket/i.test(name) ? 'auto' : 'manual')

const mapping = [] // for the build-log doc
let totSteps = 0, totReqs = 0, totTmpl = 0

const events = JSON.parse(await q('select id, slug from paradox_events'))
const idBySlug = Object.fromEntries(events.map((e) => [e.slug, e.id]))

for (const [file, slug] of Object.entries(FILE_SLUG)) {
  const eid = idBySlug[slug]
  if (!eid) { console.warn(`! no event for slug ${slug} (${file}) — skipping`); continue }
  const wb = XLSX.read(fs.readFileSync(`${DIR}/${file}`), { type: 'buffer' })
  const parts = []

  // EVENT FLOW → runbook_steps
  const flow = sheet(wb, 'EVENT FLOW')
  if (flow) {
    const hi = findHeader(flow, ['PHASE', 'TASK'])
    if (hi >= 0) {
      const H = flow[hi]
      const ci = { phase: colIdx(H, 'PHASE'), task: colIdx(H, 'TASK'), owner: colIdx(H, 'OWNER'), dead: colIdx(H, 'DEADLINE'), status: colIdx(H, 'STATUS') }
      const data = flow.slice(hi + 1).filter((r) => String(r[ci.task] || '').trim())
      const vals = data.map((r, i) => {
        const g = gateOf(r[ci.task])
        return `(${sq(eid)},${sq(mapPhase(r[ci.phase]))},${sq(r[ci.task])},${sq(r[ci.owner])},${sq(r[ci.dead])},${sq(mapStatus(r[ci.status]))},${g.auto ? sq(g.auto) : 'NULL'},${sb(g.gate)},${i * 10 + 10})`
      })
      if (vals.length) {
        parts.push(`delete from paradox_runbook_steps where event_id=${sq(eid)};`)
        parts.push(`insert into paradox_runbook_steps (event_id,phase,task,owner,due_offset,status,auto_condition,is_gate,sort_order) values\n${vals.join(',\n')};`)
        totSteps += vals.length
      }
    }
  }

  // REQUIREMENTS → requirements
  const req = sheet(wb, 'REQUIREMENTS')
  if (req) {
    const hi = findHeader(req, ['CATEGORY', 'ITEM'])
    if (hi >= 0) {
      const H = req[hi]
      const ci = { cat: colIdx(H, 'CATEGORY'), item: colIdx(H, 'ITEM'), qty: colIdx(H, 'QTY'), src: colIdx(H, 'SOURCE'), arr: colIdx(H, 'ARRANGED') }
      const data = req.slice(hi + 1).filter((r) => String(r[ci.item] || '').trim())
      const vals = data.map((r, i) => `(${sq(eid)},${sq(r[ci.cat])},${sq(r[ci.item])},${sq(r[ci.qty])},${sq(r[ci.src])},${sb(isArranged(r[ci.arr]))},${i * 10 + 10})`)
      if (vals.length) {
        parts.push(`delete from paradox_requirements where event_id=${sq(eid)};`)
        parts.push(`insert into paradox_requirements (event_id,category,item,qty,source,arranged,sort_order) values\n${vals.join(',\n')};`)
        totReqs += vals.length
      }
    }
  }

  // MESSAGE BANK → message_templates (event-scoped keys)
  const msg = sheet(wb, 'MESSAGE BANK')
  if (msg) {
    const hi = findHeader(msg, ['WHEN TO SEND'])
    if (hi >= 0) {
      const H = msg[hi]
      const ci = { name: 0, when: colIdx(H, 'WHEN'), body: colIdx(H, 'DRAFTED') }
      const data = msg.slice(hi + 1).filter((r) => /^MSG\b/i.test(String(r[0] || '').trim()))
      const vals = data.map((r, i) => {
        const name = String(r[0]).trim()
        const key = `${slug}_${String(i + 1).padStart(2, '0')}` // positional → guaranteed unique per event
        return `(${sq(key)},${sq(name)},${sq(r[ci.when])},${sq('participant')},${sq(tmplMode(name))},${sq(r[ci.body])})`
      })
      if (vals.length) {
        parts.push(`delete from paradox_message_templates where key like ${sq(slug + '%')};`)
        parts.push(`insert into paradox_message_templates (key,name,when_to_send,audience,mode,body) values\n${vals.join(',\n')};`)
        totTmpl += vals.length
      }
    }
  }

  if (parts.length) {
    await q('begin;\n' + parts.join('\n') + '\ncommit;')
    console.log(`✓ ${slug.padEnd(12)} ← ${file}`)
    mapping.push(`- **${slug}** (${file}): EVENT FLOW→runbook_steps, REQUIREMENTS→requirements, MESSAGE BANK→message_templates`)
  }
}

console.log(`\nDONE · runbook steps: ${totSteps} · requirements: ${totReqs} · templates: ${totTmpl}`)
console.log('\n--- mapping (for build log) ---\n' + mapping.join('\n'))
