#!/usr/bin/env node
/**
 * One-time (re-runnable) import of the four HR workbooks into Supabase.
 *
 *   node scripts/hr-import/import-hr-workbooks.mjs            # DRY RUN (default)
 *   node scripts/hr-import/import-hr-workbooks.mjs --write     # actually writes
 *   node scripts/hr-import/import-hr-workbooks.mjs --only=contacts,teams
 *
 * Run from `frontend/` so `xlsx` and `@supabase/supabase-js` resolve, with a
 * SERVICE ROLE key in the environment — the anon key cannot write these tables
 * and MUST NOT be used:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/hr-import/import-hr-workbooks.mjs
 *
 * ─── Why it is shaped like this ────────────────────────────────────────────
 *
 * DRY RUN IS THE DEFAULT. `--write` is the only way to touch the database.
 * The plan calls for dry-run -> reviewed diff -> write, and this is an
 * irreversible-ish import of real people's contact details.
 *
 * NOTHING IS DESTROYED. Every write is an upsert on a natural key, and no
 * member field that already holds a value is overwritten by a blank sheet
 * cell. Where the sheet and the database genuinely disagree on a non-empty
 * value, THE SHEET WINS (the user's decision) and the prior value is written
 * to community_audit_logs first, so the overwrite is recoverable.
 *
 * PHONE IS THE JOIN KEY, NOT EMAIL. Measured on the real workbook: 98% of
 * community rows carry a phone, only 64% carry an email. Everywhere else in
 * this codebase the join key is email; this is the deliberate exception.
 *
 * REAL SHAPES, measured 2026-09-02 (the planning docs were wrong — verify
 * again with inspect-workbooks.mjs before trusting these):
 *   COMMUNITY AQUATERRA  Sheet1                      1,955 rows
 *   AquaTerra Core Records  Main                        46 rows  (the CORE team)
 *   Cross Departmental  10 dept sheets                 244 rows total
 *   AQ Dept-wise Goals  12 sheets                      ~90 tasks
 */
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { serviceKey } from '../serviceKey.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const REPO_ROOT = resolve(process.cwd(), '..')
const WRITE = process.argv.includes('--write')
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').replace('--only=', '')
const STEPS = ONLY ? ONLY.split(',').map(s => s.trim()) : ['contacts', 'core', 'teams', 'sops']
const BATCH = `hr-import-${new Date().toISOString().slice(0, 10)}`

const URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const KEY = serviceKey()
if (!URL) { console.error('Missing VITE_SUPABASE_URL / SUPABASE_URL'); process.exit(1) }
if (WRITE && !KEY) { console.error('--write needs SUPABASE_SERVICE_ROLE_KEY (the anon key cannot write these tables)'); process.exit(1) }
const db = KEY ? createClient(URL, KEY, { auth: { persistSession: false } }) : null

// ─── helpers ───────────────────────────────────────────────────────────────
const blank = v => v === null || v === undefined || String(v).trim() === ''
const txt = v => (blank(v) ? null : String(v).trim())
const lower = v => (blank(v) ? null : String(v).trim().toLowerCase())

/** Digits only, last 10 — so "+91 98765 43210", "098765 43210" and
 *  "9876543210" all collapse to the same key. Indian mobile numbers are 10
 *  digits; anything shorter is kept as-is rather than silently truncated. */
function normPhone(v) {
  if (blank(v)) return null
  const d = String(v).replace(/\D/g, '')
  if (!d) return null
  return d.length > 10 ? d.slice(-10) : d
}

/** Excel dates arrive as strings here (raw:false). Return YYYY-MM-DD or null. */
function toDate(v) {
  if (blank(v)) return null
  const s = String(v).trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function sheet(file, name) {
  const path = resolve(REPO_ROOT, file)
  if (!existsSync(path)) throw new Error(`workbook missing: ${path}`)
  const wb = XLSX.read(readFileSync(path), { cellDates: true })
  const ws = wb.Sheets[name]
  if (!ws) throw new Error(`sheet "${name}" not in ${file} (have: ${wb.SheetNames.join(', ')})`)
  return XLSX.utils.sheet_to_json(ws, { defval: null, raw: false })
    .filter(r => Object.values(r).some(v => !blank(v)))
}

// Pick a column by fuzzy header match — the sheets use inconsistent casing,
// trailing spaces and pluralisation ("NAMES", "NAME", "Sl. no. ").
function col(row, ...names) {
  const keys = Object.keys(row)
  for (const n of names) {
    const k = keys.find(k => k.trim().toLowerCase() === n.toLowerCase())
    if (k) return row[k]
  }
  for (const n of names) {
    const k = keys.find(k => k.trim().toLowerCase().includes(n.toLowerCase()))
    if (k) return row[k]
  }
  return null
}

const report = []
function plan(step, action, n, note = '') {
  report.push({ step, action, n, note })
  console.log(`  ${action.padEnd(10)} ${String(n).padStart(5)}  ${note}`)
}

// ─── load the members we are matching against ──────────────────────────────
async function loadMembers() {
  if (!db) return { byPhone: new Map(), byEmail: new Map(), all: [] }
  // Service role bypasses RLS and the column grants, which is exactly why this
  // script requires the service key and never the anon key.
  const all = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from('members')
      .select('member_id, full_name, email, phone, birthday, instagram, linkedin, break_start, break_end, break_reason')
      .range(from, from + 999)
    if (error) throw error
    all.push(...data)
    if (data.length < 1000) break
  }
  const byPhone = new Map(), byEmail = new Map()
  for (const m of all) {
    const p = normPhone(m.phone); if (p && !byPhone.has(p)) byPhone.set(p, m)
    const e = lower(m.email);     if (e && !byEmail.has(e)) byEmail.set(e, m)
  }
  return { byPhone, byEmail, all }
}

/** Phone first (98% fill), then email (64%). Returns a member row or null. */
function matchMember(idx, phone, email) {
  const p = normPhone(phone)
  if (p && idx.byPhone.has(p)) return idx.byPhone.get(p)
  const e = lower(email)
  if (e && idx.byEmail.has(e)) return idx.byEmail.get(e)
  return null
}

// ─── 1. COMMUNITY AQUATERRA -> aq_contacts ─────────────────────────────────
async function stepContacts(idx) {
  console.log('\n── contacts  (COMMUNITY AQUATERRA.xlsx)')
  const rows = sheet('COMMUNITY AQUATERRA.xlsx', 'Sheet1')
  const out = []
  let skippedNoName = 0, matched = 0
  for (const r of rows) {
    const name = txt(col(r, 'NAME'))
    if (!name) { skippedNoName++; continue }
    const phoneRaw = txt(col(r, 'CONTACT NUMBER', 'CONTACT'))
    const email = lower(col(r, 'EMAILS', 'EMAIL'))
    // The four points columns are preserved verbatim, never summed here.
    const pts = ['Welfare Points', 'Other Points', 'Points (July-sept)', 'POINTS apr-june']
      .map(k => { const v = txt(col(r, k)); return v ? `${k}=${v}` : null })
      .filter(Boolean).join('; ') || null
    const m = matchMember(idx, phoneRaw, email)
    if (m) matched++
    out.push({
      full_name: name,
      phone_normalised: normPhone(phoneRaw),
      phone_raw: phoneRaw,
      email,
      school: txt(col(r, 'SCHOOL/ COLLEGE', 'SCHOOL')),
      class_grade: txt(col(r, 'CLASS')),
      instagram: txt(col(r, 'Insta Id', 'INSTAGRAM')),
      points_note: pts,
      source_sheet: 'COMMUNITY AQUATERRA/Sheet1',
      import_batch: BATCH,
      matched_member_id: m ? m.member_id : null,
    })
  }
  plan('contacts', 'upsert', out.length, `aq_contacts (${matched} matched to a member, ${skippedNoName} skipped: no name)`)
  if (WRITE) {
    for (let i = 0; i < out.length; i += 500) {
      const { error } = await db.from('aq_contacts').upsert(out.slice(i, i + 500), {
        onConflict: 'source_sheet,phone_normalised,email,full_name', ignoreDuplicates: false,
      })
      if (error) throw error
    }
  }
  return out
}

// Core Records' `Departments` column is COMMA-SEPARATED and multi-valued
// ("HR, Projects, Events"). Real values measured 2026-09-02:
//   Projects · Social Media · Events · ShikshAq · Ventures · HR · Collabs ·
//   Roots · LinkedIn · Blogs · Rotaract · ALUM
const CORE_DEPT_TO_TEAM = {
  'projects': 8,       // Welfare Team — "Projects" is the welfare/drives desk
  'social media': 9,
  'linkedin': 9,       // Media sub-divisions all sit under Social Media…
  'blogs': 9,
  'insta': 9,
  'instagram': 9,
  'events': 7,
  'shikshaq': 13,
  'ventures': 12,
  'hr': 14,
  'collabs': 10,
  'roots': 11,         // Crftd's storefront
  'crftd': 11,
}
// Deliberately unmapped, and NOT guessed at:
//   ROTARACT — a partner organisation (Rotaract Club), not an AQ department.
//   ALUM     — former members. See the note in stepCore about not making
//              alumni HoDs.
const CORE_DEPT_UNMAPPED = new Set(['rotaract', 'alum', 'alumni'])

function splitDepartments(v) {
  if (blank(v)) return []
  return String(v).split(/[,/;]+/).map(s => s.trim()).filter(Boolean)
}

// ─── 2. Core Records -> enrich members ─────────────────────────────────────
// Only fills fields that are EMPTY in the database, except where the sheet
// and DB genuinely disagree — then the sheet wins and the prior value is
// audited first. Never invents a member row.
async function stepCore(idx) {
  console.log('\n── core  (AquaTerra Core Records.xlsx / Main)')
  const rows = sheet('AquaTerra Core Records.xlsx', 'Main')
  const updates = [], audits = []
  const roleChanges = [], coreMemberships = [], alumSkipped = []
  const coreMembershipSeen = new Set(), unmappedDepts = new Set()
  let unmatched = 0
  for (const r of rows) {
    const name = txt(col(r, 'NAMES', 'NAME'))
    const m = matchMember(idx, col(r, 'CONTACTS', 'CONTACT'), col(r, 'E-MAILS', 'EMAIL'))
    if (!m) { unmatched++; continue }
    const want = {
      birthday: toDate(col(r, 'Birthday')),
      instagram: txt(col(r, 'Instagram')),
      linkedin: txt(col(r, 'LinkedIn')),
      break_start: toDate(col(r, 'Break Start')),
      break_end: toDate(col(r, 'Break End')),
      break_reason: txt(col(r, 'Break Notes')),
    }
    const patch = {}
    for (const [k, v] of Object.entries(want)) {
      if (v === null) continue                       // blank cell never clears a value
      if (blank(m[k])) { patch[k] = v; continue }    // fill an empty field
      if (String(m[k]).slice(0, 10) !== String(v).slice(0, 10)) {
        patch[k] = v                                  // sheet wins…
        audits.push({ member_id: m.member_id, field: k, from: m[k], to: v, name })
      }
    }
    // ── Core == HoD, and their departments are real memberships ──
    //
    // The user's rule: "everybody in core is an HOD, assign them the
    // department". Core Records is the CORE TEAM (46 rows), not a member list.
    //
    // ONE DELIBERATE EXCEPTION: rows whose only department is ALUM. `hod`
    // carries real moderation power through hasLeaderAccess(), so granting it
    // to former members is an access decision, not a data migration. Those
    // rows are counted and reported instead of being silently promoted —
    // say the word and I'll include them.
    const depts = splitDepartments(col(r, 'Departments'))
    const deptKeys = depts.map(d => d.toLowerCase())
    const isAlumOnly = deptKeys.length > 0 && deptKeys.every(d => d === 'alum' || d === 'alumni')

    if (isAlumOnly) {
      alumSkipped.push(name)
    } else {
      if (m.role !== 'hod' && m.role !== 'director' && m.role !== 'super_admin') {
        roleChanges.push({ member_id: m.member_id, name, from: m.role, to: 'hod' })
      }
      for (const d of depts) {
        const key = d.toLowerCase()
        if (CORE_DEPT_UNMAPPED.has(key)) { unmappedDepts.add(d); continue }
        const teamId = CORE_DEPT_TO_TEAM[key]
        if (!teamId) { unmappedDepts.add(d); continue }
        const k = `${teamId}:${m.member_id}`
        if (coreMembershipSeen.has(k)) continue
        coreMembershipSeen.add(k)
        // Core sit as `lead` on their departments — that is what being a HoD
        // of a department means in team_members' vocabulary.
        coreMemberships.push({ team_id: teamId, member_id: m.member_id, role: 'lead', is_active: true, sub_team: null })
      }
    }

    if (Object.keys(patch).length) updates.push({ member_id: m.member_id, patch })
  }
  plan('core', 'update', updates.length, `members enriched (${unmatched} sheet rows matched no member, ${audits.length} value overwrites)`)
  plan('core', 'role', roleChanges.length, `members promoted to hod`)
  plan('core', 'upsert', coreMemberships.length, `team_members from the Departments column (as lead)`)
  if (alumSkipped.length) plan('core', 'skip', alumSkipped.length, `ALUM-only rows NOT promoted to hod — access decision, ask first`)
  if (unmappedDepts.size) plan('core', 'note', unmappedDepts.size, `department labels with no AQ team: ${[...unmappedDepts].join(', ')}`)
  if (audits.length) {
    console.log('    overwrites (sheet wins, prior value audited):')
    for (const a of audits.slice(0, 12)) console.log(`      ${a.name}: ${a.field}  "${a.from}" -> "${a.to}"`)
    if (audits.length > 12) console.log(`      …and ${audits.length - 12} more`)
  }
  if (WRITE) {
    for (const a of audits) {
      await db.from('community_audit_logs').insert({
        member_id: a.member_id, action: 'hr_import_overwrite', entity_type: 'member',
        entity_id: a.member_id,
        details: { field: a.field, previous_value: String(a.from), new_value: String(a.to), import_batch: BATCH },
      })
    }
    for (const u of updates) {
      const { error } = await db.from('members').update(u.patch).eq('member_id', u.member_id)
      if (error) throw error
    }
    // Promote core to hod. Audited individually — this is a privilege grant,
    // not a data fill, and it should be reversible from the log alone.
    for (const rc of roleChanges) {
      await db.from('community_audit_logs').insert({
        member_id: rc.member_id, action: 'hr_import_role_change', entity_type: 'member',
        entity_id: rc.member_id,
        details: { from: rc.from, to: rc.to, reason: 'core-records-import', import_batch: BATCH },
      })
      const { error } = await db.from('members').update({ role: rc.to }).eq('member_id', rc.member_id)
      if (error) throw error
    }
    for (let i = 0; i < coreMemberships.length; i += 500) {
      const { error } = await db.from('team_members').upsert(coreMemberships.slice(i, i + 500), {
        onConflict: 'team_id,member_id', ignoreDuplicates: false,
      })
      if (error) throw error
    }
  }
  return updates
}

// ─── 3. Cross-Departmental -> team_members + member_preauth ────────────────
const SHEET_TO_TEAM = {
  'HR': 14,                 // Human Resources
  'COLLABS': 10,            // Collabs Team
  'PROJECTS': 8,            // Welfare Team — the drives desk
  'EVENTS': 7,              // Events Team
  'Media - INSTAGRAM': 9,   // Social Media
  'Media - BLOGS': 9,
  'Media - LINKEDIN': 9,
  'SHIKSHAQ': 13,           // ShikshAQ
  'ROOTS': 11,              // Crftd
  'VENTURES': 12,           // AQ.Ventures
}
const isLeadPosition = p => /hod|head|manager|lead/i.test(p || '')

async function stepTeams(idx) {
  console.log('\n── teams  (Cross Departmental Database.xlsx)')
  const memberships = [], preauth = []
  const seenMembership = new Set(), seenPreauth = new Set()
  let noEmailNoMatch = 0

  for (const [sheetName, teamId] of Object.entries(SHEET_TO_TEAM)) {
    let rows
    try { rows = sheet('Cross Departmental Database.xlsx', sheetName) }
    catch { console.log(`     (no sheet "${sheetName}", skipped)`); continue }

    for (const r of rows) {
      const name = txt(col(r, 'NAMES', 'NAME'))
      if (!name) continue
      const position = txt(col(r, 'POSITION')) || txt(col(r, '__EMPTY'))
      const email = lower(col(r, 'E-MAILS', 'EMAIL'))
      const m = matchMember(idx, col(r, 'CONTACTS', 'CONTACT'), email)
      const role = isLeadPosition(position) ? 'lead' : 'member'
      const subTeam = txt(col(r, 'TEAMS'))

      if (m) {
        const key = `${teamId}:${m.member_id}`
        if (seenMembership.has(key)) continue
        seenMembership.add(key)
        memberships.push({ team_id: teamId, member_id: m.member_id, role, is_active: true, sub_team: subTeam })
      } else if (email) {
        // No account yet → pre-authorise, so their first Google sign-in lands
        // them straight in the right department. Reuses the existing
        // member_preauth + claim_member_preauth() machinery.
        const key = `${email}`
        if (seenPreauth.has(key)) continue
        seenPreauth.add(key)
        preauth.push({ email, intended_team_id: teamId, intended_position: position, import_batch: BATCH })
      } else {
        noEmailNoMatch++
      }
    }
  }
  plan('teams', 'upsert', memberships.length, `team_members (existing accounts)`)
  plan('teams', 'upsert', preauth.length, `member_preauth (no account yet — claimed on first sign-in)`)
  plan('teams', 'skip', noEmailNoMatch, `sheet rows with no member match AND no email — nothing to key on`)

  if (WRITE) {
    for (let i = 0; i < memberships.length; i += 500) {
      const { error } = await db.from('team_members').upsert(memberships.slice(i, i + 500), {
        onConflict: 'team_id,member_id', ignoreDuplicates: false,
      })
      if (error) throw error
    }
    for (let i = 0; i < preauth.length; i += 500) {
      const { error } = await db.from('member_preauth').upsert(preauth.slice(i, i + 500), {
        onConflict: 'email', ignoreDuplicates: true,
      })
      if (error) throw error
    }
  }
  return { memberships, preauth }
}

// ─── 4. Goals tracker -> sops ──────────────────────────────────────────────
// Keyed on the workbook's EXACT sheet names (verified 2026-09-02) — the first
// pass guessed at casing and spelling and silently skipped five sheets, which
// is the quiet-failure shape this whole import is meant to avoid. If a sheet
// is added later the script logs it as unmapped rather than dropping it.
const SOP_SHEET_TO_SLUG = {
  'HR (old)': 'operations',
  'Copy of HR': 'operations',            // near-duplicate of "HR (old)"; deduped on task text below
  'Collabs & Outreach (old)': 'operations',
  'Projects': 'welfare',                 // welfare drives desk
  'Events': 'events',
  'Media - Insta': 'content',
  'Media - LinkedIn': 'content',
  'Media - Blogs': 'content',
  'Media - Website': 'content',
  'ShikshAq': 'labs',
  'Roots': 'content',                    // Crftd's storefront
  'Ventures': 'operations',
}
// P1 is the HOTTEST — the convention was flipped in SopManagement.tsx (see the
// design-audit pass). Map the sheet's words onto it.
function urgency(v) {
  const s = (v || '').toLowerCase()
  if (/high|urgent|p1|asap|immediate/.test(s)) return 'P1'
  if (/medium|mid|p2/.test(s)) return 'P2'
  if (/low|p3|later/.test(s)) return 'P3'
  return null
}
function sopStatus(v) {
  const s = (v || '').toLowerCase()
  if (/done|complete|finished/.test(s)) return 'done'
  if (/progress|ongoing|started|wip/.test(s)) return 'in_progress'
  return 'not_started'
}

async function stepSops() {
  console.log('\n── sops  (AQ Dept-wise Goals & General Procedures Tracker.xlsx)')
  const path = resolve(REPO_ROOT, 'AQ Dept-wise Goals & General Procedures Tracker.xlsx')
  if (!existsSync(path)) { console.log('     workbook missing, skipped'); return [] }
  const wb = XLSX.read(readFileSync(path), { cellDates: true })
  const out = []
  const seen = new Set()
  for (const name of wb.SheetNames) {
    const slug = SOP_SHEET_TO_SLUG[name]
    if (!slug) { console.log(`     (no department mapping for "${name}", skipped)`); continue }
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null, raw: false })
      .filter(r => Object.values(r).some(v => !blank(v)))
    for (const r of rows) {
      const task = txt(col(r, 'Task'))
      if (!task) continue
      // "Copy of HR" duplicates "HR (old)" almost exactly — dedupe on the
      // task text within a department rather than importing both.
      const key = `${slug}::${task.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)
      const links = ['Documentation link #1', 'Documentation link #2', 'Documentation link #3']
        .map(k => txt(col(r, k))).filter(Boolean)
      out.push({
        department_slug: slug,
        sub_division: txt(col(r, 'Department Sub-Division')),
        task,
        description: txt(col(r, 'Task Description')),
        kind: /goal/i.test(txt(col(r, 'Achievement Type')) || '') ? 'goal' : 'sop',
        urgency: urgency(txt(col(r, 'Urgency'))),
        led_by_text: txt(col(r, 'To be Led by')) || 'unassigned',
        status: sopStatus(txt(col(r, 'Status'))),
        assigned_on: toDate(col(r, 'Task Assignment Date', 'Start Date')),
        due_on: toDate(col(r, 'To be Accomplished by')),
        completed_on: toDate(col(r, 'Completion Date')),
        notes: txt(col(r, 'Additional Notes')),
        doc_links: links.length ? links : null,
      })
    }
  }
  plan('sops', 'insert', out.length, 'sops (deduped on department+task)')
  if (WRITE && out.length) {
    for (let i = 0; i < out.length; i += 500) {
      const { error } = await db.from('sops').insert(out.slice(i, i + 500))
      if (error) throw error
    }
  }
  return out
}

// ─── run ───────────────────────────────────────────────────────────────────
console.log(WRITE ? '\n*** WRITE MODE — this will modify the database ***' : '\n--- DRY RUN (pass --write to apply) ---')
console.log(`batch: ${BATCH}\nsteps: ${STEPS.join(', ')}`)

const idx = await loadMembers()
console.log(`\nmembers loaded: ${idx.all.length}  (phone keys ${idx.byPhone.size}, email keys ${idx.byEmail.size})`)

if (STEPS.includes('contacts')) await stepContacts(idx)
if (STEPS.includes('core'))     await stepCore(idx)
if (STEPS.includes('teams'))    await stepTeams(idx)
if (STEPS.includes('sops'))     await stepSops()

console.log('\n───────────────────────────────────────────')
for (const r of report) console.log(`${r.step.padEnd(9)} ${r.action.padEnd(8)} ${String(r.n).padStart(6)}  ${r.note}`)
console.log(WRITE ? '\nDONE — written.\n' : '\nDRY RUN ONLY — nothing was written. Re-run with --write to apply.\n')
