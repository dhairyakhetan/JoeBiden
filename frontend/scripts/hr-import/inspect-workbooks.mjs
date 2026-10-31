#!/usr/bin/env node
// Read-only structural dump of the four HR workbooks.
//
// The workbooks are gitignored (they hold ~2,360 members' names, emails and
// phone numbers, many of them minors — see the .gitignore comment), so this
// script prints STRUCTURE and FILL RATES, never row content beyond a single
// redacted sample. Run it before touching the import so the mapping is built
// against what the sheets actually contain rather than what a doc claims.
//
//   node scripts/hr-import/inspect-workbooks.mjs
//   node scripts/hr-import/inspect-workbooks.mjs --sample   (adds 1 raw row/sheet)
//
// Must run from frontend/ so `xlsx` resolves from node_modules.
import * as XLSX from 'xlsx'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(process.cwd(), '..')
const WORKBOOKS = [
  'COMMUNITY AQUATERRA.xlsx',
  'AquaTerra Core Records.xlsx',
  'Cross Departmental Database.xlsx',
  'AQ Dept-wise Goals & General Procedures Tracker.xlsx',
]

const showSample = process.argv.includes('--sample')

// Redact anything that looks like contact data unless explicitly asked for.
const SENSITIVE = /mail|phone|contact|number|insta|linkedin/i
function redact(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = SENSITIVE.test(k) && v ? '‹redacted›' : v
  }
  return out
}

function isBlank(v) {
  return v === null || v === undefined || String(v).trim() === ''
}

for (const file of WORKBOOKS) {
  const path = resolve(REPO_ROOT, file)
  if (!existsSync(path)) {
    console.log(`\n══════ ${file}\n  MISSING at ${path}`)
    continue
  }
  const wb = XLSX.read(readFileSync(path), { cellDates: true })
  console.log(`\n══════ ${file}  (${wb.SheetNames.length} sheet(s))`)

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null, raw: false })
    const live = rows.filter(r => Object.values(r).some(v => !isBlank(v)))
    if (!live.length) {
      console.log(`\n  ── "${name}"  EMPTY`)
      continue
    }
    const cols = [...new Set(live.flatMap(r => Object.keys(r)))]
    console.log(`\n  ── "${name}"  rows=${live.length}  cols=${cols.length}`)
    for (const c of cols) {
      const n = live.filter(r => !isBlank(r[c])).length
      const pct = Math.round((n / live.length) * 100)
      const distinct = new Set(live.map(r => (isBlank(r[c]) ? null : String(r[c]).trim())).filter(Boolean)).size
      console.log(`       ${String(pct).padStart(3)}%  ${String(n).padStart(5)}/${live.length}  distinct=${String(distinct).padStart(5)}  ${c}`)
    }
    if (showSample) console.log('       sample: ' + JSON.stringify(redact(live[0])))
  }
}
console.log('')
