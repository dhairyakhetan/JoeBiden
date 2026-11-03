#!/usr/bin/env node
/**
 * compute-org-facts.mjs — writes src/lib/orgFacts.ts from live Supabase data
 * ────────────────────────────────────────────────────────────────────────────
 * Run:  SUPABASE_SERVICE_ROLE_KEY=... node scripts/compute-org-facts.mjs
 *       (also runs as an early step of `npm run build`, see package.json)
 * Out:  frontend/src/lib/orgFacts.ts   (checked in — regenerated, not hand-edited)
 *       frontend/index.html            (four hardcoded figures patched — see patchIndexHtml)
 *       frontend/public/llms.txt       (two hardcoded figures patched — see patchLlmsTxt)
 *
 * WHY THIS EXISTS
 * ───────────────
 * The live site shipped FOUR different values for "drives/projects completed"
 * at once (450+ in index.html's JSON-LD, 512+ in an older metaConfig/AboutPage
 * pass, 534+ in another, 550+ in the live Marquee) because the number was
 * retyped by hand at every call site and nobody could tell which one was true.
 * `docs/BRAND_VOICE.md` §3 is explicit: "never invent, round up, or improve a
 * number." The fix isn't picking one of the four — it's removing hand-typed
 * statistics from components entirely and computing every one, here, from the
 * database that actually knows.
 *
 * CONTRACT (changelog/21-org-facts.md §21.2)
 * ───────────────────────────────────────────
 *   1. Connect with the SERVICE-ROLE key. This script never ships to the
 *      client bundle (it's a build-time .mjs under scripts/, not imported by
 *      any src/ file), and the key is never committed — see the fail-soft
 *      branch below for what happens when it's absent.
 *   2. One `count`-only query per computed fact (`head: true, count: 'exact'`)
 *      — no rows cross the wire to count them.
 *   3. Round DOWN, never up, when a fact is displayed as a "+" figure. See
 *      `displayCount` — it's exported from the generated file so every call
 *      site uses the SAME rounding, not a hand-rolled one per component.
 *   4. FAIL THE BUILD on any query error. A stale orgFacts.ts (last known-good,
 *      already committed) is better than a wrong one, so: don't write, exit 1.
 *      Never write a 0 for a query that errored.
 *   5. Log a diff against the previously-committed file. A >20% move in either
 *      direction is either real growth or a broken filter, and both deserve a
 *      loud line in the build log, not a silent commit.
 *
 * WHAT COULD NOT BE COMPUTED (verify against BRAND_VOICE.md §3 before "fixing")
 * ──────────────────────────────────────────────────────────────────────────
 *   - schoolsRepresented: `schools` exists as a table but holds ZERO rows, and
 *     every one of the 1,317 active `members` has `school_id IS NULL` (checked
 *     live 2026-09-05). The FK exists; nothing has ever populated it. This
 *     ships as `null` rather than the honest-but-useless "0 schools".
 *   - clothesDistributedKg: still not derivable, and now a CONSTANT the owner
 *     set (2,000 kg). `key_statistic` matches 55 rows on /cloth|kg/, but only
 *     14 say "clothes" (2 of them RANGES), 15 are BOOKS, 25 are unlabelled
 *     "N Kgs collected", and 1 is a child count. Summing that would fold books
 *     into a clothes figure. See the CONSTANTS block.
 *
 * CORRECTED 2026-09-06 — this section used to claim dogs were not derivable
 * either ("no table backs either claim at all"). That was WRONG, and it is a
 * good example of why §21 says to check the database rather than the comment:
 * `welfare_projects.key_statistic` records a per-drive figure for all 58
 * dog-feeding drives, every one with a parseable leading integer. It is now
 * DERIVED as `dogMealsServed` (see computeDogMeals). It is published as MEALS,
 * not as distinct dogs, because 58 drives around Kolkata necessarily feed
 * overlapping populations — see that function's header.
 *
 * FAIL-SOFT vs FAIL-HARD — read this before wiring a CI secret
 * ──────────────────────────────────────────────────────────────
 * `generate-sitemap.mjs` (the other build-time DB script in this repo) can
 * fail soft on a missing key because its anon key has a literal, safe,
 * checked-in fallback — anon keys are meant to be public. A SERVICE-ROLE key
 * can never have that fallback; committing one is a severe secret leak. So:
 *
 *   - Key ABSENT  → this is treated as "this environment doesn't have it yet"
 *     (a contributor's laptop, a fork, or a Vercel project where nobody has
 *     added SUPABASE_SERVICE_ROLE_KEY to Production/Preview env vars yet),
 *     NOT as an error. Warn loudly, leave the committed orgFacts.ts exactly as
 *     it is, exit 0. The alternative — hard-failing every build that lacks the
 *     secret — would turn "nobody has provisioned this key in Vercel yet" into
 *     "the site cannot deploy," which is a self-inflicted outage for a content
 *     freshness concern. See the "Does CI exist?" answer in the PR notes.
 *   - Key PRESENT but a query throws → this is the real failure §21.2.4 means.
 *     Fail hard, exit 1, do not touch orgFacts.ts.
 */

import { createClient } from '@supabase/supabase-js'
import { serviceKey } from './serviceKey.mjs'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = join(__dir, '../src/lib/orgFacts.ts')
const INDEX_HTML_PATH = join(__dir, '../index.html')
const LLMS_TXT_PATH = join(__dir, '../public/llms.txt')

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hzowuwffjqtgszecngpe.supabase.co'
// One name for the service key across all four scripts that need it, so the
// pending rotation is a single edit. serviceKey() prefers
// SUPABASE_SERVICE_ROLE_KEY and still accepts the older SUPABASE_SERVICE_KEY
// with a warning. See scripts/serviceKey.mjs and scripts/ROTATE_SERVICE_KEY.md.
//
// Note this script deliberately does NOT load frontend/.env (loadEnv.mjs strips
// service keys on purpose), so locally it sees whatever the SHELL exports and
// usually nothing. Skipping is the normal, correct local outcome.
const SERVICE_KEY = serviceKey()
// "Numbers update themselves" (owner, 3 Nov 2026). Every fact below is a count over a table the public site already
// reads, so the browser's public (anon) key is enough: Vercel always has VITE_SUPABASE_ANON_KEY, which means every
// deploy refreshes the figures with no secret to set up. The service key, when present, still wins. On the anon path a
// failure is NEVER fatal (a deploy must not break over a number): it warns and keeps the committed files.
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || ''
const KEY = SERVICE_KEY || ANON_KEY
const USING_ANON = !SERVICE_KEY && !!ANON_KEY
const failExit = () => process.exit(USING_ANON ? 0 : 1)

// ── CONSTANTS ────────────────────────────────────────────────────────────────
// Never derived, never recomputed by this script. Each is either a fixed
// organisational fact (founding date, registration number) or a claim with no
// system of record that this pass could not resolve — see the file header.
// Changing any of these is a content decision for a human, not a re-run of
// this script; keep them all in this one place so the next person doesn't
// have to `git log -S` five components to find where a number came from.
const CONSTANTS = {
  // 11 June 2021, per AboutPage.tsx's founding narrative, llms.txt and
  // BRAND_VOICE.md §3.1 (all agree — not a disputed figure).
  foundedOn: '2021-06-11',
  // Trust registration number of TerraRoots (Charity Commissioner, 23 Jul 2025).
  // It was labelled "DARPAN" until 3 Nov 2026; the DARPAN portal ID is a separate
  // number, below. Both from the registration extract the owner supplied.
  trustRegNo: 'AAFTT2300ME20251',
  // DARPAN (NITI Aayog) portal ID, active since 31 Jul 2025.
  darpanId: 'WB/2025/0745627',
  // BRAND_VOICE.md §3's own audience section and the live site's copy target
  // "14-19". Two live call sites (lib/metaConfig.ts's `faq` and `members`
  // descriptions, and lib/faqData.ts's `what-is-aquaterra` handbook entry)
  // said "14-25" instead — a drift this constant exists specifically to kill.
  ageRange: '14–19',
  // https://in.linkedin.com/company/aquaterrango — the ONLY slug that appears
  // anywhere in the shipped app, index.html, llms.txt or seed data. BRAND_VOICE
  // §3.4 flags a second slug ("ngo-aquaterra") as "in circulation" and marks
  // this NEEDS HUMAN CONFIRMATION, but also says "the code is internally
  // consistent on aquaterrango, so use that if forced." There is zero evidence
  // for the alternate slug anywhere in this codebase, so this ships as the
  // real, already-in-use URL rather than as null — but the confirmation flag
  // is still open. A human should do one visual check of the live LinkedIn
  // page before this is next touched.
  linkedinUrl: 'https://in.linkedin.com/company/ngoaquaterra',
  // Month-precision only — no source anywhere states a day. BRAND_VOICE.md
  // §3.3 flags "Jun 2024 (AboutPage card) vs Jun 2025 (master brief)" as
  // NEEDS HUMAN CONFIRMATION. Resolved to 2024 here because that is what BOTH
  // AboutPage.tsx's Paradox 3.0 card AND src/paradox/pages/Legacy.tsx's own
  // `editions` timeline (`{ year: '2024', name: 'Paradox 3.0', ... }`) already
  // say, independently, in shipped code — the "2025" figure traces to an
  // internal strategy doc with no corroboration anywhere in the product. Per
  // WORKFLOW.md ("if an instruction contradicts the code, the code wins") and
  // changelog/21-org-facts.md §21.3's own instruction to check src/paradox/
  // for a date, this is a resolved cross-reference, not a guess between the
  // two conflicting values. Still worth a human's final sign-off.
  paradoxThreeDate: '2024-06',
  // RETIRED 2026-09-06 — superseded by the DERIVED `dogMealsServed` below.
  // The old comment here said "no table backs this claim at all". That was
  // wrong, and re-checking it against the live database is what found the
  // mistake: `welfare_projects.key_statistic` DOES record per-drive figures
  // ("45 Dogs fed", "50 Dogs fed", ...) for 58 dog-feeding drives, all 58 of
  // which carry a parseable leading integer. Kept as null so the name still
  // resolves for any straggling consumer; nothing should read it.
  strayDogsFed: null,
  // SET 2026-09-06 by the project owner (calcuttatraders393@gmail.com), who is
  // the named human §21.3 requires: "a claim with no system of record either
  // becomes a constant a named human owns, or it stops being published."
  //
  // Owner's figure: TWO TONNES = 2,000 kg. This is LOWER than the 2,500kg the
  // site had been publishing, which is the right direction — BRAND_VOICE.md §3
  // is "never invent, round up, or improve a number." It supersedes all three
  // conflicting values that existed in the repo (2,500kg in the master brief,
  // 950+ in index.html's JSON-LD, 1,000 in BrandPage's poster specimen).
  //
  // NOT derivable, and deliberately so: `key_statistic` matches 55 rows on
  // /cloth|kg/, but only 14 actually say "clothes" (2 of those are RANGES like
  // "10 - 15 Kgs"), 15 are BOOKS, 25 are unlabelled "N Kgs collected" with no
  // noun, and 1 is a child count ("160 Children got Clothes"). Summing that
  // would silently fold books into a clothes figure. If the drive records ever
  // gain a typed amount+unit+noun, revisit — until then this stays a constant.
  clothesDistributedKg: 2000,

  // ── The five CLEARED cumulative-impact figures ────────────────────────────
  // Added 2026-09-06. These are NOT disputed and NOT blocked: docs/
  // BRAND_VOICE.md §3 clears all five, and every live call site already agreed
  // on the same value (unlike drives, which shipped four). No table backs any
  // of them either — there is no `workshops`, `saplings` or `trips` table — so
  // they can never be computed, and §21.3's resolution for a cleared,
  // non-derivable fact is exactly this: a constant in the constants block,
  // owned by a named human, not a literal retyped at seven call sites.
  //
  // OWNER: the Welfare Projects HoD (the department that runs every drive
  // these count). Changing a value here is that person's decision and a
  // content change, not a re-run of this script.
  //
  // Before this block they were hand-typed in PublicProjectsPage.tsx,
  // BrandPage.tsx (x3), VolunteerHandbookPage.tsx, OnboardingPage.tsx,
  // PublicProjectDetailPage.tsx and lib/departments.ts — the exact seven-site
  // spread that produced the drives drift. NO VALUE IS CHANGED by moving
  // them; only their home. Each is stored as a raw integer and rendered
  // through displayCount(), which floors — so 3500 -> "3,500+", unchanged.
  childrenReached: 3500,
  saplingsPlanted: 4000,
  bananasDistributed: 15000,
  medicalCheckups: 1600,
  // Rendered as an EXACT count, never through displayCount() — like
  // teamsActive, it is a small, precisely-known figure ("8 Sundarbans trips"),
  // not a large approximate one.
  sundarbansTrips: 8,
}

// ── COMPUTED — one exact count() per fact, no rows fetched ──────────────────
// [output key, table, query-builder]. Every filter here is chosen to match
// what a PUBLIC visitor would consider "real" (a draft project isn't "written
// up" yet; a rejected/pending applicant isn't a "member" yet), not just
// "every row in the table" — see the long comment in the generated file for
// why each filter was picked, including where it disagrees with the
// changelog's own draft example.
const JOBS = [
  ['drivesWrittenUp', 'welfare_projects', q => q.eq('is_draft', false)],
  ['drivesWithPhoto', 'welfare_projects', q => q.eq('is_draft', false).not('main_image', 'is', null)],
  // The changelog's draft comment says `status = 'approved'`. The live
  // `members.status` enum (checked 2026-09-05) is actually
  // 'pending_approval' | 'active' | 'rejected' — there is no 'approved'
  // value. 'active' is the real post-approval state (directorService.
  // approveMember flips a row to 'active', per CLAUDE.md's own account of the
  // signup funnel). This is exactly the "verify the live schema, not the
  // planning doc" lesson CLAUDE.md names twice already.
  ['membersTotal', 'members', q => q.eq('status', 'active')],
  ['postsPublished', 'posts', q => q.eq('status', 'published')],
  ['teamsActive', 'teams', q => q.eq('is_active', true)],
  // Top-level departments only: a department inside another (Marketing holds Social Media) is not
  // counted again. This is the figure the copy means by "N departments".
  ['departmentsActive', 'teams', q => q.eq('is_active', true).is('parent_team_id', null)],
  // Diagnostic only — see schoolsRepresented handling in main(). This is NOT
  // a distinct-schools count (PostgREST's `count=exact` counts rows, not
  // distinct values, and adding a real distinct aggregate would need a DB
  // view/RPC, which is a schema change this file is not allowed to make). It
  // exists only to detect the day someone starts populating school_id, so a
  // future run of this script has a reason to stop treating the fact as
  // permanently blocked.
  ['_membersWithSchool', 'members', q => q.eq('status', 'active').not('school_id', 'is', null)],
]

/** floor-then-format. THE one rounding rule — every call site imports this
 *  rather than rounding its own copy of a number.
 *
 *  changelog/21-org-facts.md §21.5 gives a worked formula that abbreviates to
 *  "k" (2031 → "2k+", 1247 → "1.2k+"), but its own prose examples in §21.2 use
 *  comma-grouped hundreds ("2,031 → 2,000+", "1,247 → 1,200+") — the same
 *  rounding MAGNITUDE (floor to the nearest 100 at four digits, nearest 10
 *  below that), different STRING FORMAT. §21.5 explicitly says either format
 *  is fine and the only rule is "decide once, use everywhere." Every existing
 *  canonical figure on the live site already uses comma-grouped format
 *  ("1,200+", "3,500+", "15,000+" — never "1.2k+" or "15k+"), so that's the
 *  format kept here, to avoid a second, incompatible number style shipping
 *  alongside the first one this file is trying to unify.
 */
export function displayCount(n) {
  if (!Number.isFinite(n) || n <= 0) return '0'
  const floor = n >= 1000 ? Math.floor(n / 100) * 100 : Math.floor(n / 10) * 10
  return floor.toLocaleString('en-US') + '+'
}

/** Pull the previously-committed computed values out of the existing
 *  generated file, so we can log a loud diff (§21.2.5) before overwriting it.
 *  Returns {} if the file doesn't exist yet or doesn't look like our own
 *  output (e.g. the very first run, before this script ever wrote it). */
function readPreviousComputed(path) {
  if (!existsSync(path)) return {}
  const src = readFileSync(path, 'utf8')
  const out = {}
  for (const [key] of JOBS) {
    if (key.startsWith('_')) continue
    const m = src.match(new RegExp(`${key}:\\s*(\\d+)`))
    if (m) out[key] = Number(m[1])
  }
  return out
}

function logDiff(key, before, after) {
  if (typeof before !== 'number' || before === 0) return
  const pct = Math.abs(after - before) / before
  if (pct > 0.2) {
    const dir = after > before ? 'up' : 'down'
    console.warn(
      `   ⚠ ${key} moved ${dir} ${(pct * 100).toFixed(0)}% (${before} → ${after}). ` +
      `That's either real growth or a broken filter — check it before trusting this build.`,
    )
  }
}

/** Build the full orgFacts.ts source. Pure function (no I/O) so it can be
 *  exercised without a live DB connection — this is the function a bootstrap
 *  run (no service-role key available) can still call directly with numbers
 *  obtained another way (e.g. read-only SQL through an admin connection) to
 *  produce a first, honest, real-numbers commit. */
export function buildOrgFactsFile(computed, generatedAt) {
  const c = computed
  return `/**
 * Facts about AquaTerra that appear in user-facing copy.
 *
 * GENERATED. Do not edit by hand. Written by scripts/compute-org-facts.mjs.
 * Regenerate (\`npm run org-facts\`, or let \`npm run build\` do it), do not patch.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS (changelog/21-org-facts.md)
 *
 * The live site once shipped four different values for "drives completed" at
 * once (450+ in index.html's JSON-LD, 512+, 534+, 550+ elsewhere) because the
 * number was retyped by hand at every call site. \`docs/BRAND_VOICE.md\` §3:
 * "never invent, round up, or improve a number." The fix is this file: every
 * public statistic is computed from the database, once, at build time, and
 * every component imports it instead of retyping it.
 *
 * TWO KINDS OF FACT, kept in clearly separate blocks, and never mixed:
 *   1. COMPUTED — read live from Supabase by scripts/compute-org-facts.mjs on
 *      every build. Each one below carries the query that produced it.
 *   2. CONSTANT — a founding date, a registration number, or (for three
 *      claims with no system of record at all — dogs fed, clothes
 *      distributed, Paradox 3.0's date) \`null\` until a named human sets one.
 *      These can never be "recomputed" to something wrong, so they live in
 *      the generator script's CONSTANTS block, not derived here.
 *
 * Historical context this file also carries forward (kept from the
 * hand-written version that predated the generator, decisions still in
 * force):
 *
 *   • Founding year said "est. 2023" on the login page and "2021" in eleven
 *     other places, including the About page's own founding narrative. It was
 *     wrong on the single page where someone decides whether the org is real.
 *
 *   • Approval time told an applicant "usually 24 hours, sometimes 48" on
 *     /register and "within a week" on /pending — the very next screen. A
 *     fifteen-year-old signs up, is promised a day, and is told a week before
 *     they've finished their first session. Resolved to the SLOWER, majority
 *     figure: six public surfaces already said "within a week," and a promise
 *     you beat is better than one you miss.
 *
 * NOTE: APPROVAL_TIME is the *member* approval SLA. The contact-form reply
 * time is a different promise and lives with the contact copy; don't merge them.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface OrgFacts {
  /** ISO timestamp of the last successful run of scripts/compute-org-facts.mjs. */
  generatedAt: string

  // ── COMPUTED — read live from Supabase. Regenerated on every build. ──────
  /** welfare_projects, count(*) where is_draft = false. Public/browsable drives
   *  only — a draft row is not "written up" yet (matches the definition of a
   *  public project scripts/generate-sitemap.mjs already uses for /projects/:slug).
   *  NOTE this is "written up," not "completed": ${c.drivesWrittenUp} rows exist and
   *  are publicly visible; whether every one of them literally happened as
   *  described is a different, unverifiable claim this figure does not make. */
  drivesWrittenUp: number
  /** welfare_projects, count(*) where is_draft = false and main_image is not null. */
  drivesWithPhoto: number
  /** members, count(*) where status = 'active'. The changelog's own draft
   *  comment said status = 'approved' — the live enum has no such value
   *  ('pending_approval' | 'active' | 'rejected', verified 2026-09-05).
   *  'active' is the equivalent post-approval state. This counts CURRENT
   *  active members, not everyone who ever registered (pending/rejected rows
   *  are excluded) — see §21's Unresolved Q3, answered here: active, because
   *  the figure is always paired with "ages 14-19," which implies presence. */
  membersTotal: number
  /** posts, count(*) where status = 'published'. Exposed for completeness —
   *  DirectoryPage.tsx already runs its own LIVE head-count query for posts
   *  (posts churn fast enough that a build-time figure would read stale
   *  within a day), so this is not currently rendered anywhere; it exists so
   *  a future call site doesn't have to retype the query. */
  postsPublished: number
  /** teams, count(*) where is_active = true. Rendered as an EXACT count (no
   *  "+", no rounding) everywhere it appears — it's a small, precisely-known
   *  structural fact ("8 departments"), not a large approximate one. */
  teamsActive: number
  /** Top-level departments, count(*) where is_active and parent_team_id is null. The figure every
   *  "N departments" sentence reads; render it with numberWord() from lib/orgFigures. */
  departmentsActive: number
  /** Dog MEALS served across every recorded feeding drive - a sum of the
   *  per-drive figures in welfare_projects.key_statistic, not a count of
   *  distinct animals. Pass through displayCount(); never relabel this as
   *  "dogs fed", which would assert a distinct-animal count the records
   *  cannot support. */
  dogMealsServed: number
  /** count(distinct school) among active members — BLOCKED, not a query
   *  failure. Checked live 2026-09-05: the \`schools\` table holds ZERO rows,
   *  and every one of the ${c.membersTotal} active members has \`school_id IS
   *  NULL\`. The column and the table exist; nothing has ever populated them.
   *  Ships as \`null\` rather than the honest-but-useless "0 schools
   *  represented" — see WORKFLOW.md's "never a 0, a zero is a claim" rule.
   *  Not currently rendered anywhere in the app (nothing to fix at a call
   *  site); SchoolsPage.tsx already independently discovered the same empty
   *  table and deliberately ships no school count of its own. */
  schoolsRepresented: number | null

  // ── CONSTANTS — never derived, never recomputed. A human sets these. ─────
  /** 11 June 2021. Not disputed — every source agrees. */
  foundedOn: string
  /** Trust registration number of the registered entity (TerraRoots). */
  trustRegNo: string
  /** DARPAN (NITI Aayog) portal ID. */
  darpanId: string
  /** "14–19", per BRAND_VOICE.md §3's audience definition. Two live call
   *  sites said "14-25" before this file existed; that was a copy drift, not
   *  a second real age range in use anywhere else. */
  ageRange: string
  /** The org's LinkedIn company page. BRAND_VOICE.md §3.4 flags a second slug
   *  as "in circulation" and marks this NEEDS HUMAN CONFIRMATION, but the
   *  live code is 100% consistent on this one and the alternate appears
   *  nowhere in the shipped app — see the generator script's CONSTANTS block
   *  for the full reasoning. Still open for a human's final sign-off. */
  linkedinUrl: string
  /** Month-precision only; no source states a day. Resolved to June 2024 from
   *  two independent, already-shipped code sources (AboutPage.tsx's card and
   *  src/paradox/pages/Legacy.tsx's own \`editions\` timeline) that agree with
   *  each other; BRAND_VOICE.md's conflicting "2025" traces to a single
   *  uncorroborated internal strategy doc. Still flagged for a human's final
   *  sign-off in BRAND_VOICE.md §3.3. */
  paradoxThreeDate: string
  /** NOT DERIVABLE, no table exists. Two conflicting public values already
   *  exist (1,500+ vs 1,200+) and no human has picked one in this pass, so
   *  this is \`null\` rather than a guess. Existing copy that already states
   *  one of the two values is UNCHANGED by this file. */
  strayDogsFed: number | null
  /** NOT DERIVABLE, no table exists. THREE conflicting public values already
   *  exist (2,500kg, 950+, 1,000) and no human has picked one, so this is
   *  \`null\`. Existing copy is UNCHANGED by this file. */
  clothesDistributedKg: number | null

  // ── CLEARED constants — not disputed, but not derivable either ───────────
  // BRAND_VOICE.md §3 clears all five and every live call site already agreed
  // on the value, so unlike dogs/clothes they are not null. No table backs
  // them, so they can never be computed — §21.3's answer for a cleared,
  // non-derivable fact is a constant with a named owner: the Welfare Projects
  // HoD. See the generator's CONSTANTS block. Values are UNCHANGED from the
  // seven call sites they were retyped at before 2026-09-06.
  /** kids reached in educational workshops. Render via displayCount(). */
  childrenReached: number
  /** saplings planted across plantation drives. Render via displayCount(). */
  saplingsPlanted: number
  /** bananas distributed. Bananas, not meals — see BRAND_VOICE.md. */
  bananasDistributed: number
  /** medical checkups run. Render via displayCount(). */
  medicalCheckups: number
  /** trips to the Sundarbans. An EXACT count like teamsActive — never passed
   *  through displayCount(). */
  sundarbansTrips: number
}

export const ORG_FACTS: OrgFacts = {
  generatedAt: '${generatedAt}',

  drivesWrittenUp: ${c.drivesWrittenUp},
  drivesWithPhoto: ${c.drivesWithPhoto},
  membersTotal: ${c.membersTotal},
  postsPublished: ${c.postsPublished},
  teamsActive: ${c.teamsActive},
  departmentsActive: ${c.departmentsActive},
  dogMealsServed: ${c.dogMealsServed},
  schoolsRepresented: ${c.schoolsRepresented === null || c.schoolsRepresented === undefined ? 'null' : c.schoolsRepresented},

  foundedOn: '${CONSTANTS.foundedOn}',
  trustRegNo: '${CONSTANTS.trustRegNo}',
  darpanId: '${CONSTANTS.darpanId}',
  ageRange: '${CONSTANTS.ageRange}',
  linkedinUrl: '${CONSTANTS.linkedinUrl}',
  paradoxThreeDate: '${CONSTANTS.paradoxThreeDate}',
  strayDogsFed: ${CONSTANTS.strayDogsFed === null ? 'null' : CONSTANTS.strayDogsFed},
  clothesDistributedKg: ${CONSTANTS.clothesDistributedKg === null ? 'null' : CONSTANTS.clothesDistributedKg},

  childrenReached: ${CONSTANTS.childrenReached},
  saplingsPlanted: ${CONSTANTS.saplingsPlanted},
  bananasDistributed: ${CONSTANTS.bananasDistributed},
  medicalCheckups: ${CONSTANTS.medicalCheckups},
  sundarbansTrips: ${CONSTANTS.sundarbansTrips},
}

/** floor-then-format — the ONE rounding rule for every "+" figure derived
 *  from ORG_FACTS. Never round a number up, and never round it anywhere but
 *  here (changelog/21-org-facts.md §21.5). Small EXACT counts (ORG_FACTS.teamsActive)
 *  are rendered as-is and never passed through this function. */
export function displayCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0'
  const floor = n >= 1000 ? Math.floor(n / 100) * 100 : Math.floor(n / 10) * 10
  return floor.toLocaleString('en-US') + '+'
}

/** The year AquaTerra started. June 2021. Kept as a plain number alongside
 *  ORG_FACTS.foundedOn (full ISO date) because most call sites only ever
 *  wanted the year. */
export const FOUNDED_YEAR = 2021

/** "kolkata · est. 2021" — the standard place/date tag. */
export const PLACE_AND_YEAR = \`kolkata · est. \${FOUNDED_YEAR}\`

/** How long a membership application takes to review, in the org's own words. */
export const APPROVAL_TIME = 'within a week'

/** Sentence-ready variant for flows that need a subject. */
export const APPROVAL_SENTENCE = \`an HoD reviews every application personally, usually \${APPROVAL_TIME}.\`

/** How long a contact-form message takes to get a reply, in the org's own words. Deliberately separate from APPROVAL_TIME — see note above. */
export const CONTACT_REPLY_TIME = 'within a week'

/*
 * REMOVED 2026-09-04, decision 12 in REDESIGN_FEATURE_REQUESTS.md: the
 * welfare points system is retired from the product.
 *
 *   export const POINTS_PER_ACTIVITY = 1
 *   export const POINTS_SENTENCE = \`\${POINTS_PER_ACTIVITY} point per volunteering
 *     activity, redeemable for discounted Crftd merchandise and discounted entry
 *     to AQ events like Paradox.\`
 *
 * Kept here as a comment, not restored, because a bare deletion with no stated
 * reason is exactly what gets "helpfully" re-added by the next person. The
 * \`points_ledger\` table and every service reading it are deliberately UNTOUCHED
 * so the decision is reversible without a migration; only the UI and this copy
 * were removed. If points come back, this constant comes back with them.
 */

/** How long a certificate/LoR/LoV request takes to be issued or declined, in the org's own words. Matches the org's other reviewed-by-a-human SLAs (APPROVAL_TIME, CONTACT_REPLY_TIME) rather than promising something faster. */
export const CERTIFICATE_WAIT_TIME = 'within a week'
`
}

/** Replace exactly one regex match, throwing (shape changed) rather than
 *  silently no-op'ing when it isn't found — mirrors prerender-meta.mjs's
 *  `replaceOnce`, which the same failure mode already exists for there. */
function replaceOnce(text, re, replacement, name, fileLabel) {
  if (!re.test(text)) {
    throw new Error(`${fileLabel}: "${name}" not found or shape changed — refusing a silent no-op`)
  }
  return text.replace(re, replacement)
}

/**
 * Patch every derivable figure baked directly into index.html's static
 * markup. There are TEN, across two schema.org blocks and the three social
 * meta tags — all of them easy to miss because none are sourced from
 * metaConfig.ts's `home` entry (which useMeta.ts applies to the SPA at
 * runtime): prerender-meta.mjs deliberately leaves index.html's own <head>
 * untouched ("it carries hand-tuned homepage meta... Body only; head
 * untouched"), so THIS file's own copies are what actually ship in the raw
 * HTML a crawler or unfurler fetches for "/". A first pass at this function
 * patched only the Dataset JSON-LD's drives figure and missed the other six —
 * found by diffing dist/index.html's rendered tags against metaConfig.ts's
 * `home` description after a full `npm run build` and noticing they disagreed,
 * then a full re-read of the file turning up two more in the Organization block.
 *
 *   1. Dataset JSON-LD "Welfare Drives Written Up" value        → drives, "+"
 *   2. Organization JSON-LD "description" ("...1200 active volunteers")
 *                                                               → members, no "+"
 *      (prose already says "over", so a bare rounded number reads correctly;
 *      adding "+" after "over 1,300+" would double up the qualifier)
 *   3. Organization JSON-LD makesOffer → Volunteer Opportunities description
 *                                                               → members, "+"
 *   4-6. <meta name="description">, og:description, twitter:description
 *                                                               → members, "+"
 *   7-10. Dataset JSON-LD "Educational Workshops" / "Trees Planted" /
 *      "Medical Checkups" / "Food Distribution" values          → CONSTANTS, "+"
 *      SET (2026-09-24, SEO audit): these four used to ship byte-identical on
 *      the reasoning that they are "uncontested constants with no table
 *      either way," so there was nothing to verify them against. That is true
 *      but beside the point - they are still a human-set number duplicated in
 *      two files (here and the CONSTANTS block below), which is exactly the
 *      "four different values for one figure" pattern this whole script
 *      exists to kill, just with a human as the source of truth instead of a
 *      query. The day CONSTANTS.saplingsPlanted next changes, index.html
 *      would otherwise go stale silently. Clothes/dogs stay unpatched - they
 *      are not in this JSON-LD block at all (still `null`, per the CONSTANTS
 *      comment above).
 *
 * Throws if any line isn't found (shape changed), so a silent no-op can't ship.
 */
export function patchIndexHtml(html, drivesWrittenUp, membersTotal, constants) {
  const drives = displayCount(drivesWrittenUp)
  const members = displayCount(membersTotal)
  let out = html
  // [\d,]+, not \d+: displayCount()'s own output is comma-grouped
  // (toLocaleString('en-US')) once the figure passes 1,000, and both of these
  // match against what a PRIOR run of this same function already wrote. A
  // bare \d+ stops at the first comma, so the very first build after members
  // crossed 1,000 wrote "1,300" and every build after that threw here
  // ("not found or shape changed") instead of patching - confirmed live by
  // running this function against the checked-in index.html. Found and fixed
  // 2026-09-24, alongside the four new Dataset stats above.
  out = replaceOnce(
    out,
    /(creating environmental and social impact with over )[\d,]+( active volunteers)/,
    (_m, pre, post) => `${pre}${members.replace(/\+$/, '')}${post}`,
    'Organization description (active volunteers)', 'index.html',
  )
  out = replaceOnce(
    out,
    /(Join our network of )[\d,]+\+?( active volunteers)/,
    (_m, pre, post) => `${pre}${members}${post}`,
    'Volunteer Opportunities offer description (JSON-LD)', 'index.html',
  )
  out = replaceOnce(
    out,
    /("name":\s*"Welfare Drives Written Up",\s*"value":\s*")[^"]+(")/,
    (_m, pre, post) => `${pre}${drives}${post}`,
    'Welfare Drives Written Up (JSON-LD)', 'index.html',
  )
  // The Dataset block's other four stats are CONSTANTS (no live query backs
  // them - see the CONSTANTS block's own comment), but they were still
  // hand-typed directly into index.html with no regeneration wiring at all -
  // exactly the "four different values for one number" failure mode this
  // whole script exists to kill, just not yet caught here. Patched from the
  // same CONSTANTS this script already writes into orgFacts.ts, so index.html
  // can never drift from the generated file again.
  out = replaceOnce(
    out,
    /("name":\s*"Educational Workshops",\s*"value":\s*")[^"]+(")/,
    (_m, pre, post) => `${pre}${displayCount(constants.childrenReached)}${post}`,
    'Educational Workshops (JSON-LD)', 'index.html',
  )
  out = replaceOnce(
    out,
    /("name":\s*"Trees Planted",\s*"value":\s*")[^"]+(")/,
    (_m, pre, post) => `${pre}${displayCount(constants.saplingsPlanted)}${post}`,
    'Trees Planted (JSON-LD)', 'index.html',
  )
  out = replaceOnce(
    out,
    /("name":\s*"Medical Checkups",\s*"value":\s*")[^"]+(")/,
    (_m, pre, post) => `${pre}${displayCount(constants.medicalCheckups)}${post}`,
    'Medical Checkups (JSON-LD)', 'index.html',
  )
  out = replaceOnce(
    out,
    /("name":\s*"Food Distribution",\s*"value":\s*")[^"]+(")/,
    (_m, pre, post) => `${pre}${displayCount(constants.bananasDistributed)}${post}`,
    'Food Distribution (JSON-LD)', 'index.html',
  )
  out = replaceOnce(
    out,
    /(<meta name="description" content="AquaTerra: a student-led community and NGO in Kolkata where )[\d,]+\+( teenagers)/,
    (_m, pre, post) => `${pre}${members}${post}`,
    'meta description', 'index.html',
  )
  out = replaceOnce(
    out,
    /(<meta property="og:description" content=")[\d,]+\+( students running real welfare)/,
    (_m, pre, post) => `${pre}${members}${post}`,
    'og:description', 'index.html',
  )
  out = replaceOnce(
    out,
    /(<meta name="twitter:description" content=")[\d,]+\+( students\. real welfare)/,
    (_m, pre, post) => `${pre}${members}${post}`,
    'twitter:description', 'index.html',
  )
  return out
}

/**
 * Patch public/llms.txt's two member-count mentions. This file ships to
 * `/llms.txt` verbatim (it's plain text, not code, so it can't import
 * ORG_FACTS) — it's patched here for the same reason index.html is: a
 * hardcoded number in a file this script doesn't touch is exactly the
 * four-way-drives-conflict failure mode repeating itself somewhere new.
 * llms.txt makes no drives claim, so only the member count is patched.
 */
export function patchLlmsTxt(text, membersTotal) {
  const members = displayCount(membersTotal)
  let out = text
  out = replaceOnce(
    out,
    /([\d,]+\+)( teenage volunteers run real welfare)/,
    (_m, _old, post) => `${members}${post}`,
    'intro paragraph volunteer count', 'llms.txt',
  )
  out = replaceOnce(
    out,
    /(- Volunteers: )[\d,]+\+/,
    (_m, pre) => `${pre}${members}`,
    'Volunteers key fact', 'llms.txt',
  )
  return out
}

/**
 * dogMealsServed — the one DERIVED fact that is a sum over text, not a count.
 *
 * Why it is not in JOBS: every other fact is `count: 'exact', head: true`, so
 * no rows cross the wire. This one has to read 58 short strings, because the
 * figure lives inside `welfare_projects.key_statistic` free text ("45 Dogs
 * fed"). That is a deliberate, bounded exception to contract rule 2 — one
 * narrow column, one filter, ~58 rows — not a licence to fetch tables.
 *
 * Why the metric is "meals served" and not "dogs fed": the records are
 * per-drive counts across 58 separate street-feeding drives around Kolkata,
 * which necessarily feed OVERLAPPING dog populations. Summing them gives
 * feedings, not distinct animals. Publishing "3,265 dogs fed" would assert
 * 3,265 individual dogs, which the data cannot support — BRAND_VOICE.md §3:
 * "never invent, round up, or improve a number." Ruled 2026-09-06: publish it
 * as dog MEALS, which is exactly what was counted.
 *
 * Two of the 58 rows read "10+ dogs and cows were fed biscuits", so a small
 * number of cow feedings are inside this total. At ~20 of ~3,265 that is well
 * under the rounding floor displayCount() applies, so it cannot move the
 * published figure — noted here so nobody rediscovers it as a bug.
 */
async function computeDogMeals(db) {
  const { data, error } = await db
    .from('welfare_projects')
    .select('key_statistic')
    .ilike('key_statistic', '%dog%')
  if (error) throw error
  if (!Array.isArray(data)) throw new Error('no rows returned for dogMealsServed')

  let total = 0
  const unparseable = []
  for (const row of data) {
    const raw = (row?.key_statistic || '').trim()
    const m = raw.match(/^\s*(\d+)/)
    if (!m) { unparseable.push(raw); continue }
    total += Number(m[1])
  }
  // Contract rule 4: never ship a wrong number quietly. If the records drift
  // into a shape this cannot read, fail the build rather than publish a total
  // that silently dropped rows.
  if (unparseable.length) {
    throw new Error(
      `${unparseable.length} of ${data.length} dog rows have no leading integer ` +
      `(e.g. ${JSON.stringify(unparseable[0])}). Refusing to publish a partial sum.`
    )
  }
  if (!data.length || total <= 0) throw new Error('dogMealsServed computed as 0 — refusing to ship')
  return { total, drives: data.length }
}

async function main() {
  if (!KEY) {
    console.warn('\n⚠ ORG_FACTS not regenerated: no SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY in this environment.')
    console.warn('  Keeping the committed frontend/src/lib/orgFacts.ts exactly as it is.')
    console.warn('  This is expected on a contributor machine or a fork. To regenerate on every')
    console.warn('  Vercel build, add SUPABASE_SERVICE_ROLE_KEY to the Vercel project\'s Production')
    console.warn('  + Preview environment variables (Supabase Dashboard → Project Settings → API).\n')
    process.exit(0)
  }

  const db = createClient(SUPABASE_URL, KEY, { auth: { persistSession: false } })
  console.log(`Computing ORG_FACTS from ${SUPABASE_URL} ...`)

  const results = {}
  const errors = []
  for (const [key, table, build] of JOBS) {
    try {
      // `members` has column-level grants: the public key may not read every column, so `select *` is refused. A count only
      // needs one readable column.
      const { count, error } = await build(db.from(table).select(table === 'members' ? 'member_id' : '*', { count: 'exact', head: true }))
      if (error) throw error
      if (typeof count !== 'number') throw new Error('no count returned')
      results[key] = count
      console.log(`   ok   ${key.padEnd(22)} ${count}`)
    } catch (e) {
      // A diagnostic (leading underscore) the public key cannot compute is not worth failing a deploy over.
      if (USING_ANON && key.startsWith('_')) { console.warn(`   skip ${key.padEnd(22)} (not readable with the public key)`); continue }
      errors.push(`${key}: ${e?.message || e?.code || JSON.stringify(e)}`)
      console.error(`   FAIL ${key.padEnd(22)} ${e?.message || e?.code || JSON.stringify(e)}`)
    }
  }

  if (errors.length) {
    console.error(`\n❌ ORG_FACTS generation FAILED (${errors.length} of ${JOBS.length} queries). ` +
      `Leaving the previously-committed orgFacts.ts and index.html in place.\n`)
    failExit()
  }

  // Anon path only: a count the public key can see is only the truth if RLS lets it see every row. If a figure comes
  // back implausibly low (a policy change hiding rows), keep the committed numbers rather than publish an undercount.
  if (USING_ANON && ((results.membersTotal ?? 0) < 1000 || (results.drivesWrittenUp ?? 0) < 400)) {
    console.warn(`\n⚠ ORG_FACTS not regenerated: the public key counted ${results.membersTotal} members and ${results.drivesWrittenUp} drives, which looks like an undercount. Keeping the committed files.\n`)
    process.exit(0)
  }

  // schoolsRepresented stays permanently null until the underlying data
  // exists (see the long comment in JOBS and in the generated file). The
  // diagnostic _membersWithSchool count is logged so a future run notices the
  // day this stops being true, but it is deliberately never shipped as the
  // fact itself (it's "members with A school on file", not "distinct schools").
  if (results._membersWithSchool > 0) {
    console.warn(`   ⚠ ${results._membersWithSchool} member(s) now have school_id set (was 0). ` +
      `schoolsRepresented can be built for real once there's a distinct-count path — still ships as null this run.`)
  }

  // The one derived-by-parsing fact (see computeDogMeals' header). Same
  // fail-hard contract as the counted jobs: a throw here leaves the committed
  // orgFacts.ts untouched rather than publishing a partial figure.
  let dogMeals
  try {
    const r = await computeDogMeals(db)
    dogMeals = r.total
    console.log(`   ok   ${'dogMealsServed'.padEnd(22)} ${r.total}  (across ${r.drives} drives)`)
  } catch (e) {
    console.error(`   FAIL ${'dogMealsServed'.padEnd(22)} ${e?.message || e}`)
    console.error(`
❌ ORG_FACTS generation FAILED. Leaving the previously-committed orgFacts.ts in place.
`)
    failExit()
  }

  const previous = readPreviousComputed(OUT_PATH)
  for (const [key] of JOBS) {
    if (key.startsWith('_')) continue
    logDiff(key, previous[key], results[key])
  }

  const generatedAt = new Date().toISOString()
  const fileContent = buildOrgFactsFile(
    {
      drivesWrittenUp: results.drivesWrittenUp,
      drivesWithPhoto: results.drivesWithPhoto,
      membersTotal: results.membersTotal,
      postsPublished: results.postsPublished,
      teamsActive: results.teamsActive,
      departmentsActive: results.departmentsActive,
      dogMealsServed: dogMeals,
      schoolsRepresented: null,
    },
    generatedAt,
  )
  writeFileSync(OUT_PATH, fileContent, 'utf8')
  console.log(`\n✅ Wrote src/lib/orgFacts.ts (generatedAt ${generatedAt})`)

  try {
    const html = readFileSync(INDEX_HTML_PATH, 'utf8')
    const patchedHtml = patchIndexHtml(html, results.drivesWrittenUp, results.membersTotal, CONSTANTS)
    if (patchedHtml !== html) {
      writeFileSync(INDEX_HTML_PATH, patchedHtml, 'utf8')
      console.log(`✅ Patched index.html (drives "${displayCount(results.drivesWrittenUp)}", members "${displayCount(results.membersTotal)}")`)
    }
  } catch (e) {
    console.error(`\n❌ ORG_FACTS generation FAILED while patching index.html: ${e?.message || e}\n`)
    failExit()
  }

  try {
    const llms = readFileSync(LLMS_TXT_PATH, 'utf8')
    const patchedLlms = patchLlmsTxt(llms, results.membersTotal)
    if (patchedLlms !== llms) {
      writeFileSync(LLMS_TXT_PATH, patchedLlms, 'utf8')
      console.log(`✅ Patched public/llms.txt (members "${displayCount(results.membersTotal)}")`)
    }
  } catch (e) {
    console.error(`\n❌ ORG_FACTS generation FAILED while patching public/llms.txt: ${e?.message || e}\n`)
    failExit()
  }
}

// Only run when this file is the actual entry point (`node compute-org-facts.mjs`
// or `npm run build`/`npm run org-facts`), never when another script — e.g. a
// one-off bootstrap that reuses buildOrgFactsFile/patchIndexHtmlDataset with
// numbers obtained another way — imports it purely for its pure functions.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch(e => {
    console.error('\n❌ compute-org-facts FAILED:', e)
    failExit()
  })
}
