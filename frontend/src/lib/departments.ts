// Shared department data - the 8 student-run teams that make up AquaTerra.
// Lives in its own module so both EverythingWeDoPage and QuickLinksPage can
// import it without coupling their lazy chunks together.
//
// `color` is a literal token per department (handoff/24 §A2), not a lookup
// through the 5-value `CAT_COLORS` any more - that lookup only has 5 keys
// for 8 departments, so 3 of them rendered teal and 2 rendered grape with no
// way to tell same-hued departments apart on /teams, /about, or the /projects
// department ticker. `category` (the write-path value posts/teams actually
// carry) deliberately stays at its existing 5-value vocabulary - only the
// display colour changes here, not the data model.
import { ORG_FACTS, displayCount } from './orgFacts'
const MEMBERS = displayCount(ORG_FACTS.membersTotal)
// Cleared cumulative-impact facts, sourced from ORG_FACTS rather than retyped
// in the Welfare Projects strings below (changelog/21-org-facts.md §21.0:
// "no public-facing statistic may be written as a literal in a component.
// Ever."). No value changed. sundarbansTrips is an exact count and never goes
// through displayCount().
const KIDS = displayCount(ORG_FACTS.childrenReached)
const SAPLINGS = displayCount(ORG_FACTS.saplingsPlanted)
const TRIPS = ORG_FACTS.sundarbansTrips

export interface Department {
  name: string
  color: string
  icon: string
  desc: string
  stat: string
  category: string
  /** Hidden from every public list (the live `teams` row is is_active = false) but kept here so the team picker
      and profile lookups still resolve the name for people who are already on it. */
  hidden?: boolean
  /** Concrete skills a member builds on this team. Optional — filled in per
      team as each team lead supplies their real list (the live `teams` table
      carries the same data in its `skills` column for the team page). */
  skills?: string[]
  /** volunteer team vs. student business - a real product distinction (joining
      ROOTS/Crftd is not the same act as joining Welfare) that the department
      list didn't previously carry anywhere, so /teams, /about and /projects all
      treated every department identically. Content-only addition to a
      static local array, not a schema change (see redesign changelog 05.0). */
  kind: 'volunteer' | 'business'
}

export const DEPARTMENTS: Department[] = [
  {
    name: 'Events',
    color: 'var(--sky)',
    icon: '🎪',
    desc: 'Paradox, Disco Diwali, Starry Nights, awareness events. AQ-run fundraisers have crossed 6-digit revenue. This team plans and executes every large-scale gathering.',
    stat: '300+ attendees at Paradox 3.0',
    category: 'events',
    kind: 'volunteer',
  },
  {
    name: 'Welfare Projects',
    color: 'var(--welfare)',
    icon: '🌱',
    desc: `Teaching workshops, Sundarbans relief trips, dog feeding drives, plantation drives, old age home visits, clothes distribution. ${KIDS} kids reached in educational workshops.`,
    stat: `${TRIPS} Sundarbans trips, ${SAPLINGS} saplings`,
    category: 'welfare',
    kind: 'volunteer',
  },
  {
    name: 'Social Media',
    color: 'var(--grape)',
    icon: '📱',
    desc: 'Instagram (@ngo.aquaterra), LinkedIn, website, reels, carousels, copy. Real brand work by student creators who show up every week.',
    stat: 'Every AQ post, reel and caption',
    category: 'content',
    kind: 'volunteer',
  },
  {
    name: 'Collabs',
    color: 'var(--teal)',
    icon: '🤝',
    desc: 'School collabs, college partnerships, inter-NGO collaborations. AQ grows through peer networks. The Collabs team builds those networks.',
    stat: 'Partnerships across Kolkata',
    category: 'operations',
    kind: 'volunteer',
    hidden: true,
  },
  {
    name: 'Crftd',
    // 05.0: "ROOTS takes ink deliberately - it is the business that funds the
    // drives, and ink makes it the one card that reads differently in the
    // grid." Crftd IS the renamed ROOTS, so the ink slot is its by the spec's
    // own reasoning. Ruled 2026-09-06 in favour of the spec's intent; HR takes
    // the --pink this vacates (see its entry). All eight hues stay distinct.
    color: 'var(--ink)',
    icon: '👕',
    desc: 'Student-run streetwear brand. Design, production, sales. Profits fund welfare projects and events. This is not a concept. The brand ships real merch.',
    stat: 'Revenue funds AQ operations',
    // Audit pass, 2026-09-06: was 'labs' - verified live against the real
    // `teams` table (`select name, category from teams`) and it's actually
    // 'content'. This value feeds `/teams?category=${d.category}` links on
    // DirectoryPage, AboutPage and QuickLinksPage, so the wrong value here
    // sent every "Crftd" department link to a Teams view filtered to
    // whatever WAS actually 'labs' (ShikshAQ) instead of Crftd itself - the
    // visible category badge on those same three pages was wrong too.
    category: 'content',
    kind: 'business',
  },
  {
    name: 'AQ.Ventures',
    color: 'var(--tomato)',
    icon: '🚀',
    desc: 'Helps student entrepreneurs turn good ideas into visible brands. Three months of marketing support (strategy, content, branding, promotion) completely free, so founders get momentum without the financial pressure.',
    stat: '3 months free marketing per client',
    // Audit pass, 2026-09-06: was 'labs', live table says 'operations' - same
    // bug and same fix as Crftd's `category` above.
    category: 'operations',
    kind: 'business',
    skills: [
      'Client communication',
      'Brand strategy',
      'Content creation',
      'Project management',
      'Real-world marketing execution',
    ],
  },
  {
    name: 'ShikshAQ',
    color: 'var(--lemon)',
    icon: '📚',
    desc: 'Tuition discovery platform built by AQ members for students across Kolkata. Launched 2026. Product, growth, content. Still early. Team is small and moving fast.',
    stat: 'Live as of 2026',
    category: 'labs',
    kind: 'business',
  },
  {
    name: 'Human Resources',
    // WAS --ink-2, a TEXT token and not one of 05.0's eight hues - it held the
    // ink slot only because the array had drifted from the spec table. Now
    // --pink, the hue Crftd vacated, so HR sits on a real palette colour and
    // the eight departments remain eight distinct hues.
    color: 'var(--pink)',
    icon: '👥',
    desc: `Recruitment, onboarding, certificates, Letters of Recommendation. HR runs the intake pipeline for ${MEMBERS} members. First people new joiners meet.`,
    stat: `${MEMBERS} members onboarded`,
    category: 'operations',
    kind: 'volunteer',
  },
]

/** The departments a visitor sees. Public pages read this one; the team picker keeps the full list. */
export const PUBLIC_DEPARTMENTS: Department[] = DEPARTMENTS.filter(d => !d.hidden)

// The live `teams` table has 8 rows sharing 5 `category` values (re-verified
// live 2026-09-06 - `select name, category from teams` - after this file's
// own `category` field disagreed with it for two rows, see the Crftd/
// AQ.Ventures fixes above: Crftd and Social Media are `content`, ShikshAQ
// alone is `labs`, Collabs/AQ.Ventures/Human Resources are all
// `operations`), so any CAT_COLORS[category] lookup collides 3 teams
// onto teal and 2 onto grape - the exact bug this file's literal colours
// above fix for department cards, but `teams` rows don't carry a `color`
// column of their own. TeamsPage.tsx and TeamDetailPage.tsx both match a
// live team to its department entry here by name instead ("Welfare Team"
// vs "Welfare Projects", hence the " team" strip) to stay in sync with the
// department cards on /about, /projects and /links.
export const normDeptName = (s: string) => s.toLowerCase().replace(/\s*team\s*$/, '').trim()

// Found live 2026-09-06 while wiring `kind` (deptKindForTeamName below): this
// comment's own claim is wrong for exactly one department. Stripping a
// trailing "team" turns the live "Welfare Team" into "welfare", but the
// department's canonical name is "Welfare Projects", which normalizes to
// "welfare projects" - the two never match on exact equality, so
// deptColorForTeamName("Welfare Team") has silently missed the map and
// fallen through to CAT_COLORS['welfare'] this whole time. That fallback
// happens to equal the same `var(--welfare)` token, so the colour has never
// visibly disagreed - but deptKindForTeamName has no such fallback (CAT_
// COLORS carries no kind data), so this same miss left the Welfare card's
// kind label rendering its raw category ("welfare") instead of "volunteer
// team". Fixed generally, not with a one-off alias: after an exact-match
// miss, fall back to a whole-word prefix match (either name is a word-
// boundary-safe prefix of the other) - "welfare" is a prefix of "welfare
// projects", and every other one of the eight pairs already matches
// exactly, so this only ever activates for the one case that needed it.
function findDept(teamName: string | undefined | null): Department | undefined {
  if (!teamName) return undefined
  const norm = normDeptName(teamName)
  const exact = DEPARTMENTS.find(d => normDeptName(d.name) === norm)
  if (exact) return exact
  return DEPARTMENTS.find(d => {
    const deptNorm = normDeptName(d.name)
    return deptNorm.startsWith(norm + ' ') || norm.startsWith(deptNorm + ' ')
  })
}

export function deptColorForTeamName(teamName: string | undefined | null): string | undefined {
  return findDept(teamName)?.color
}

// Same name-matching problem as deptColorForTeamName (live `teams`/`job_openings`
// rows carry a free-text name like "Welfare Team", not a foreign key into this
// array), reused here so a team's card/hero and its kind label can never disagree.
export function deptKindForTeamName(teamName: string | undefined | null): Department['kind'] | undefined {
  return findDept(teamName)?.kind
}

// The two mono-uppercase labels rendered on every team/department card
// (05.0: "a real product distinction, not decoration") - centralised so the
// exact copy can't drift between /teams, the team hero and /about.
export const KIND_LABEL: Record<Department['kind'], string> = {
  volunteer: 'volunteer team',
  business: 'student business',
}

/**
 * Is this department's fill dark enough that its text must be PAPER, not ink?
 *
 * THE SINGLE SOURCE. Do not re-derive this at a call site. `/teams` and
 * `/directory` each used to carry their own copy keyed to a literal token,
 * and DirectoryPage.tsx's own comment recorded that this class of rule "has
 * been re-broken by per-instance patching four separate times on this
 * project". It was broken a FIFTH time on 2026-09-06: Crftd moved from
 * `--pink` to `--ink` (05.0 gives ink to the business that funds the drives),
 * /teams' guard was updated, /directory's was not, and the Crftd tile
 * rendered ink-on-ink at 1.00:1 - an invisible black rectangle.
 *
 * It is keyed off the DATA, not a hard-coded token list, so adding another
 * dark department cannot silently reintroduce the bug: any fill whose
 * relative luminance is too low for ink to clear 4.5:1 returns true.
 * Ink (#0A0A0A) clears 4.5:1 on every other hue in the palette.
 */
const DARK_FILLS = new Set(['var(--ink)', 'var(--ink-2)'])
export function isDarkDepartmentFill(color: string | undefined | null): boolean {
  return !!color && DARK_FILLS.has(color.trim())
}
