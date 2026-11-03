/**
 * Facts about AquaTerra that appear in user-facing copy.
 *
 * GENERATED. Do not edit by hand. Written by scripts/compute-org-facts.mjs.
 * Regenerate (`npm run org-facts`, or let `npm run build` do it), do not patch.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS (changelog/21-org-facts.md)
 *
 * The live site once shipped four different values for "drives completed" at
 * once (450+ in index.html's JSON-LD, 512+, 534+, 550+ elsewhere) because the
 * number was retyped by hand at every call site. `docs/BRAND_VOICE.md` §3:
 * "never invent, round up, or improve a number." The fix is this file: every
 * public statistic is computed from the database, once, at build time, and
 * every component imports it instead of retyping it.
 *
 * TWO KINDS OF FACT, kept in clearly separate blocks, and never mixed:
 *   1. COMPUTED — read live from Supabase by scripts/compute-org-facts.mjs on
 *      every build. Each one below carries the query that produced it.
 *   2. CONSTANT — a founding date, a registration number, or (for three
 *      claims with no system of record at all — dogs fed, clothes
 *      distributed, Paradox 3.0's date) `null` until a named human sets one.
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
   *  NOTE this is "written up," not "completed": 548 rows exist and
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
  /** Dog MEALS served across every recorded feeding drive - the sum of the
   *  per-drive figures in welfare_projects.key_statistic, NOT a count of
   *  distinct animals. 58 drives around Kolkata necessarily feed overlapping
   *  street-dog populations, so a distinct-animal claim is unsupportable.
   *  Pass through displayCount(); never relabel this as "dogs fed". */
  dogMealsServed: number
  /** count(distinct school) among active members — BLOCKED, not a query
   *  failure. Checked live 2026-09-05: the `schools` table holds ZERO rows,
   *  and every one of the 1317 active members has `school_id IS
   *  NULL`. The column and the table exist; nothing has ever populated them.
   *  Ships as `null` rather than the honest-but-useless "0 schools
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
   *  src/paradox/pages/Legacy.tsx's own `editions` timeline) that agree with
   *  each other; BRAND_VOICE.md's conflicting "2025" traces to a single
   *  uncorroborated internal strategy doc. Still flagged for a human's final
   *  sign-off in BRAND_VOICE.md §3.3. */
  paradoxThreeDate: string
  /** NOT DERIVABLE, no table exists. Two conflicting public values already
   *  exist (1,500+ vs 1,200+) and no human has picked one in this pass, so
   *  this is `null` rather than a guess. Existing copy that already states
   *  one of the two values is UNCHANGED by this file. */
  strayDogsFed: number | null
  /** NOT DERIVABLE, no table exists. THREE conflicting public values already
   *  exist (2,500kg, 950+, 1,000) and no human has picked one, so this is
   *  `null`. Existing copy is UNCHANGED by this file. */
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
  generatedAt: '2026-09-05T18:21:38.596Z',

  drivesWrittenUp: 548,
  drivesWithPhoto: 491,
  membersTotal: 1317,
  postsPublished: 586,
  teamsActive: 8,
  // Set to the live count on 2026-10-18 (7: Collabs is hidden, Social Media sits inside Marketing).
  // The build rewrites this from the database whenever it has the service key.
  departmentsActive: 7,
  // 3,265 = the sum across all 58 dog-feeding drives, every row parsing
  // cleanly (verified live against the database 2026-09-06). Renders via
  // displayCount() as "3,200+ dog meals served" - floored, per contract
  // rule 3 and BRAND_VOICE.md §3's "never round up".
  dogMealsServed: 3265,
  schoolsRepresented: null,

  foundedOn: '2021-06-11',
  trustRegNo: 'AAFTT2300ME20251',
  darpanId: 'WB/2025/0745627',
  ageRange: '14–19',
  linkedinUrl: 'https://in.linkedin.com/company/aquaterrango',
  paradoxThreeDate: '2024-06',
  // RETIRED - superseded by the derived `dogMealsServed` above. The claim that
  // no table backed this was wrong; welfare_projects.key_statistic did all
  // along. Kept as null so the name still resolves; nothing should read it.
  strayDogsFed: null,
  // 2,000 kg (two tonnes), set by the project owner as the named human §21.3
  // requires. LOWER than the 2,500kg previously published - BRAND_VOICE.md §3
  // is "never invent, round up, or improve a number." Supersedes all three
  // conflicting repo values (2,500 / 950+ / 1,000). Not derivable: the
  // key_statistic "kg" rows mix books, clothes, ranges and a child count.
  clothesDistributedKg: 2000,

  childrenReached: 3500,
  saplingsPlanted: 4000,
  bananasDistributed: 15000,
  medicalCheckups: 1600,
  sundarbansTrips: 8,
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
export const PLACE_AND_YEAR = `kolkata · est. ${FOUNDED_YEAR}`

/** How long a membership application takes to review, in the org's own words. */
export const APPROVAL_TIME = 'within a week'

/** Sentence-ready variant for flows that need a subject. */
export const APPROVAL_SENTENCE = `an HoD reviews every application personally, usually ${APPROVAL_TIME}.`

/** How long a contact-form message takes to get a reply, in the org's own words. Deliberately separate from APPROVAL_TIME — see note above. */
export const CONTACT_REPLY_TIME = 'within a week'

/*
 * REMOVED 2026-09-04, decision 12 in REDESIGN_FEATURE_REQUESTS.md: the
 * welfare points system is retired from the product.
 *
 *   export const POINTS_PER_ACTIVITY = 1
 *   export const POINTS_SENTENCE = `${POINTS_PER_ACTIVITY} point per volunteering
 *     activity, redeemable for discounted Crftd merchandise and discounted entry
 *     to AQ events like Paradox.`
 *
 * Kept here as a comment, not restored, because a bare deletion with no stated
 * reason is exactly what gets "helpfully" re-added by the next person. The
 * `points_ledger` table and every service reading it are deliberately UNTOUCHED
 * so the decision is reversible without a migration; only the UI and this copy
 * were removed. If points come back, this constant comes back with them.
 */

/** How long a certificate/LoR/LoV request takes to be issued or declined, in the org's own words. Matches the org's other reviewed-by-a-human SLAs (APPROVAL_TIME, CONTACT_REPLY_TIME) rather than promising something faster. */
export const CERTIFICATE_WAIT_TIME = 'within a week'
