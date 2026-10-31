/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION 34 · the grid host, phase one
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

   The ink greeting block hosts ONE of the 38 recipes in
   `AQ Adaptive Grids.dc.html`. Six ship in phase one, plus the fallback,
   evaluated FIRST-MATCH-WINS top to bottom, exactly like the feed card chooser
   in lib/feedShape.ts.

     G12  drive signed up for, within 14 days
     G04  no upcoming drive, has attended before
     G27  leader with pending work on their desk
     G01  brand new, account under 7 days
     G21  something the member themselves submitted is still waiting
     G09  a trail to pick up: unread notifications, or saved posts
     G30  leader, desk clear
     G19  attended nothing, account older than 7 days
     G33  on a break (break_start set, break_end in the future)
     G38  always matches

   G33 sits last DELIBERATELY: a member on a break who has also signed up for a
   drive should see the drive, because they chose it.

   ── 2026-09-07, WHY THE ORDER MOVED AND WHY THREE IDS ARE NEW ──────────────
   The owner (a super_admin, with a live desk) was seeing G38: the greeting and
   a single map tile. Diagnosed against the live database, two causes stacked.

   (a) STRUCTURAL. `queueDepth` was never assembled by any host - HomePage's
       own comment said so - so G27's `queue.total > 0` could not be true for
       ANYBODY, ever. Nothing summed a director's waiting rows.
   (b) THE OWNER'S ROW. `members.approved_at` is NULL on the super_admin row
       that logs in most recently (5 of the 17 leader rows are null; 1358 of
       1375 member rows are). `daysSinceApproved` is therefore undefined, so
       G19 (`(daysSinceApproved ?? 0) > 7`) is false and G01 (`typeof === 
       'number'`) is false. With G12/G04 needing drive data that does not exist
       (`drive_attendance` holds 0 rows; `welfare_projects` has 0 dates ahead
       of today) and no break set, every predicate above the floor missed.

   G27 also MOVED, from fifth to third. It used to sit below G19, and G19
   matches nearly every member alive today because `drive_attendance` is empty
   - so a leader with a full desk would have been shown "find something to do"
   instead of their queue even once (a) was fixed. A leader's waiting rows
   outrank a generic browse prompt. G12 and G04 stay above it: a drive they
   personally chose still wins over the desk, which is the same rule that puts
   G33 last.

   G21 and G09 sit above G19 for the same reason - a concrete thing waiting on
   this person beats "go and find something" - and below G01, because a
   week-old account has no trail to pick up. G30 sits below both so that a
   leader with a clear desk still gets their own reminders first, and above
   G19 so a leader is never dropped into a member-onboarding recipe.

   THE ids G21, G09 and G30 are new assignments in section 34's own numbering
   (which already re-assigns the canvas's ids - see ON THE RECIPE IDs below).
   They do not correspond to the canvas rows of those numbers.

   THE FOUR NON-NEGOTIABLES (section 34, restated because every visual pass so
   far has drifted off one of them):
     1. the grid lives INSIDE the ink greeting block, never as its own section
     2. row unit is 72px, FIXED. 58px was derived before the tile label was
        legible and clipped 13 of 16 tiles. Do not re-derive it.
     3. tiles are rgba(244,239,224,.07) on ink, with EXACTLY ONE solid hue tile
        per recipe. The wash is what makes the hue tile read as the answer.
     4. icons only on tiles spanning two or more rows. A 20px icon in a 72px
        tile leaves no room for its own label.
   Plus: every recipe ends with the full-width map tile, so there is always a
   way out. And a figure the host cannot resolve renders as a dashed live
   marker, never a zero. A zero is a claim.

   ON THE RECIPE IDs. `AQ Adaptive Grids.dc.html` numbers its 38 recipes by a
   different scheme: its G12 is "clear desk", its G19 is "break active", its
   G33 is "ranking down", its G38 is "partial failure". CHANGELOG-REDESIGN
   section 34 and docs/FEED-ALGORITHM.md section 4 re-assign the six ids to the
   member states above, and they agree with each other. Section 34 supersedes
   the canvas chooser (its own words), so the ids here follow section 34.
   Recorded in CHANGELOG_SEC10_34.md so nobody "fixes" one to match the other.

   NO NEW ENDPOINT. Every predicate reads from the context object the home page
   already has. This file fetches nothing and imports no Supabase client.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { departmentsPhrase } from './orgFigures'

export type GridRecipeId = 'G12' | 'G04' | 'G19' | 'G01' | 'G21' | 'G09' | 'G27' | 'G30' | 'G33' | 'G38'

/** Fixed. Section 34 non-negotiable 2. */
export const ROW_UNIT_PX = 72
export const GRID_COLUMNS = 4
export const GRID_GAP_PX = 6
/** rgba(244,239,224,.07) is the paper at 7% on ink. */
export const WASH_FILL = 'rgba(244,239,224,.07)'

/**
 * What the host knows about the member. Assembled by the mounting page from
 * data it ALREADY fetches. Every field is optional and `undefined` means "not
 * resolved", which is what makes the dashed live marker reachable instead of a
 * zero.
 */
export interface GridContext {
  /** members.full_name, first word only. Used by the greeting, not by a tile. */
  firstName?: string
  /** true when the viewer is signed in. A guest never reaches a member recipe. */
  signedIn?: boolean
  /** days since members.approved_at. */
  daysSinceApproved?: number
  /** The drive this member has an accepted signup for, if it is still ahead. */
  upcomingSignup?: {
    title: string
    place?: string
    /** whole days from today. 0 means today. */
    inDays: number
    dateLabel?: string
    goingCount?: number
    href?: string
  } | null
  /** The next open drive anyone could join. Used when they have no signup. */
  nextOpenDrive?: { title: string; place?: string; dateLabel?: string; spotsLabel?: string; href?: string } | null
  /** drive_attendance rows for this member. undefined = not resolved. */
  attendedCount?: number
  /** hasLeaderAccess(role) from lib/roles. Never a hand-rolled role check. */
  isDirector?: boolean
  /** total rows waiting across this leader's queues. */
  queueDepth?: number
  /**
   * The leader's queues, biggest first, already gated: a queue only appears
   * here if the viewer can actually open its desk (deskAccess privilege) AND
   * RLS would return its rows. Never widen this - it mirrors the desk gate.
   * Empty array = resolved and everything is clear. undefined = not resolved.
   */
  queues?: readonly { key: string; label: string; count: number; href: string }[]
  /**
   * The departments this leader moderates (`director_categories`), as one
   * plain lowercase phrase, e.g. "welfare and content". undefined when they
   * hold no category assignment, which means org-wide rather than none.
   */
  deptLabel?: string
  /**
   * Something the MEMBER submitted that is still waiting on somebody else:
   * a team join request, a job application, a post in review. Their own rows
   * only (own-row RLS), never a queue they cannot act on.
   */
  ownPending?: { label: string; count: number; href: string } | null
  /** notifications.is_read = false, this member's own rows. */
  unreadCount?: number
  /** saved_posts, this member's own rows. The read-later list. */
  savedCount?: number
  /** members.member_id, if the host already has it. Purely an optimisation:
   *  the enrichment hook resolves it from the session when this is absent. */
  memberId?: number
  /** members.break_start / break_end. */
  breakStart?: string | null
  breakEnd?: string | null
  /** REDESIGN 2026-09: `points` is gone from GridContext. The welfare-points
   *  system was retired from the product, and a context field nothing reads is
   *  an invitation to render it again. `points_ledger` still exists in the
   *  database, so restoring this is one line if the decision reverses. */
  /** hours volunteered, one unit, e.g. 18.5. */
  hours?: number
  /** counts the host already has on the page. */
  labsCount?: number
  teamsCount?: number
  openRolesCount?: number
  /** the member's own team, for the G04 tile. */
  teamName?: string
  /** the department the new member joined, for the G01 welcome tile. */
  departmentName?: string
  /** now, injectable so a test is not clock-dependent. */
  now?: Date
}

export type TileKind = 'hue' | 'wash' | 'map'

/**
 * One tile. `figure` is the only thing allowed to be coloured inside a wash
 * tile, and `figure: null` renders the dashed live marker.
 */
export interface GridTile {
  key: string
  kind: TileKind
  /** grid-column: span N. 1 to 4. */
  cols: 1 | 2 | 3 | 4
  /** grid-row: span N. */
  rows: 1 | 2
  /** the tile's own words. Never a source table name: provenance is annotation. */
  label: string
  /** second line, on 2-row tiles only. */
  sublabel?: string
  /** the number. null = unresolved, renders as the dashed live marker. */
  figure?: string | null
  /** which hue token the figure or the fill takes. */
  hue?: 'welfare' | 'events' | 'labs' | 'operations' | 'content' | 'pink' | 'lemon' | 'sky' | 'grape'
  /** heroicons name. Only legal on rows >= 2 (non-negotiable 4). */
  icon?: 'map-pin' | 'academic-cap' | 'book-open' | 'briefcase' | 'moon' | 'inbox-stack' | 'map'
  href?: string
}

export interface GridRecipe {
  id: GridRecipeId
  /** what state of the member this recipe is for. */
  name: string
  /** the machine-readable trigger, as written in the design annotation. */
  predicateText: string
  /** why the arrangement is what it is. */
  intent: string
  /** which tables each tile traces to. ANNOTATION ONLY, never rendered. */
  provenance: string
  predicate: (ctx: GridContext) => boolean
  tiles: (ctx: GridContext) => GridTile[]
}

// ── shared tiles ─────────────────────────────────────────────────────────────

/**
 * Every recipe ends with this. Full width, so there is always a way out of the
 * block into section 30's map.
 */
function mapTile(): GridTile {
  return { key: 'map', kind: 'map', cols: 4, rows: 1, label: 'the whole map', href: '/everything-we-do' }
}

/** A number the host may not have. `undefined` in, `null` out, marker rendered. */
function fig(n: number | undefined): string | null {
  return typeof n === 'number' && Number.isFinite(n) ? String(n) : null
}

/**
 * REDESIGN 2026-09: this WAS `pointsTile`, rendering `your points` with
 * `figure: fig(ctx.points)`.
 *
 * The welfare-points system was retired from the product on 2026-09-04 (user
 * decision, see REDESIGN_FEATURE_REQUESTS.md item 12): `PointsLedgerCard` is
 * deleted and no surface renders a balance any more. The tile survived on five
 * of the seven recipes, which meant the home grid was offering "your points"
 * with a permanent dashed live marker, linking to a profile that no longer has
 * a points card. A figure that can never resolve is exactly what the "never
 * render a figure with no source" rule exists to stop.
 *
 * Replaced rather than deleted, and at the SAME span, because the recipes are
 * packed grids: removing a 2x1 leaves two dead cells, which is the defect
 * `packGrid`/`hasNoHoles` was written to catch. This tile carries no figure at
 * all, so there is nothing to source.
 *
 * `points_ledger` and `pointsService` still exist in the database and the
 * codebase; the decision reverses by restoring this function.
 */
function profileTile(_ctx: GridContext): GridTile {
  return { key: 'profile', kind: 'wash', cols: 2, rows: 1, label: 'your profile', hue: 'labs', href: '/profile' }
}

/**
 * `hoursTile` ("hours volunteered", figure from `ctx.hours`) stood here until
 * 2026-09-11 and is deleted, not merely unused - walkthrough item 2.3.
 *
 * It had exactly one caller, G04. Its figure came from `drive_attendance`,
 * which holds ZERO rows live, because digital check-in only went live on
 * 2026-08-31 and every drive before that was taken on paper. So it did not
 * render "no data": it rendered `0h`, to members with years behind them. The
 * same trap as the retired `pointsTile` above, and the same rule catches both -
 * never render a figure whose source cannot answer.
 *
 * It comes back by restoring this function and its G04 call site, once
 * `drive_attendance` is a complete record rather than a three-week-old one.
 */
function labsTile(ctx: GridContext): GridTile {
  return { key: 'labs', kind: 'wash', cols: 1, rows: 1, label: 'labs', figure: fig(ctx.labsCount), hue: 'events', href: '/terranotes/articles/labs' }
}

function teamsTile(ctx: GridContext): GridTile {
  return { key: 'teams', kind: 'wash', cols: 1, rows: 1, label: 'teams', figure: fig(ctx.teamsCount), hue: 'pink', href: '/teams' }
}

function rolesTile(ctx: GridContext): GridTile {
  return { key: 'roles', kind: 'wash', cols: 2, rows: 1, label: 'open roles', figure: fig(ctx.openRolesCount), hue: 'content', href: '/opportunities' }
}

function handbookTile(cols: 1 | 2 | 3 | 4 = 2, rows: 1 | 2 = 1): GridTile {
  return { key: 'handbook', kind: 'wash', cols, rows, label: 'the handbook', href: '/volunteer' }
}

// ── the nine, in evaluation order ────────────────────────────────────────────

const G12: GridRecipe = {
  id: 'G12',
  name: 'a drive you signed up for',
  predicateText: 'signup.accepted AND drive.starts_within_days <= 14',
  intent:
    'They already chose this, so it is the one fact the block exists to carry. Place, date and who else is going go on the hue tile at 2x2; everything else drops to a wash. This is the recipe AQ Chrome Poster card H1 renders at real size, so it is the reference implementation for the other five.',
  provenance: 'hue tile: welfare_projects (header, location, workshop_date) + drive_attendance (going count). profile: static route. labs: the Labs repository. teams: team_members. map: static route.',
  predicate: ctx => !!ctx.signedIn && !!ctx.upcomingSignup && ctx.upcomingSignup.inDays >= 0 && ctx.upcomingSignup.inDays <= 14,
  tiles: ctx => {
    const d = ctx.upcomingSignup
    const going = typeof d?.goingCount === 'number' ? `${d.goingCount} going` : null
    const when = d?.dateLabel ?? null
    return [
      {
        key: 'drive',
        kind: 'hue',
        cols: 2,
        rows: 2,
        label: d?.title ?? 'your next drive',
        sublabel: [when, going].filter(Boolean).join(' · ') || undefined,
        hue: 'welfare',
        icon: 'map-pin',
        href: d?.href ?? '/projects',
      },
      profileTile(ctx),
      labsTile(ctx),
      teamsTile(ctx),
      mapTile(),
    ]
  },
}

const G04: GridRecipe = {
  id: 'G04',
  name: 'no upcoming drive, has been before',
  predicateText: 'signup.upcoming IS NULL AND drive_attendance.count > 0',
  intent:
    'They know what a drive is, so do not explain one. Offer the next drive they could actually join, and nothing else that is merely about them.',
  provenance: 'hue tile: welfare_projects, the next row with workshop_date in the future, via calendarService.getNextUpcomingDrive - or the archive when there is no such row. roles: job_openings. handbook: static route. map: static route.',
  predicate: ctx => !!ctx.signedIn && !ctx.upcomingSignup && (ctx.attendedCount ?? 0) > 0,
  /**
   * 2026-09-11, walkthrough items 2.2 and 2.3 - both of which were THIS recipe.
   *
   * 2.2 "there is no data or a system to process the next drive. How are you
   * showing the next drive?" The answer was that we were not. This tile read
   * `label: d?.title ?? 'the next drive'` while `ctx.nextOpenDrive` was never
   * populated by any host, so it rendered the WORDS "the next drive" over a
   * link to the archive - a headline for a thing that did not exist. The
   * fallback label is gone: with no scheduled drive the tile now says what it
   * actually links to. `calendarService.getNextUpcomingDrive()` (which already
   * existed and had no caller) is now wired in HomePage, so when welfare
   * schedules one the real row appears here.
   *
   * Counted live 2026-09-11: 558 welfare_projects, latest workshop_date
   * 2026-09-05, ZERO ahead of today. So the archive branch is what renders
   * today, truthfully, and the drive branch lights up on its own the day a
   * future-dated drive is approved. That is the "wire it to something real"
   * half of 2.2 rather than the "delete it" half.
   *
   * 2.3 "remove the your profile / hours volunteered / your team filler."
   * Those three tiles were this recipe's entire right-hand side, in that
   * order. `hours volunteered` was the worst of them: `drive_attendance` holds
   * 0 rows, so it rendered `0h` to people with years of drives behind them -
   * paper check-in predates the 2026-08-31 digital sheet. A figure that is
   * always wrong is worse than no figure. All three are replaced by two tiles
   * that carry something: open roles (a real job_openings count) and the
   * handbook. `hoursTile` had no other caller and is deleted with them.
   */
  /**
   * 2026-09-11, SECOND owner decision on this recipe. Earlier the same day the
   * phantom "the next drive" headline was replaced with a real
   * `ctx.nextOpenDrive` fetch, falling back to the archive when nothing was
   * scheduled. Asked how an upcoming drive would ever get created, the owner
   * answered that the feature will not be used for now and asked for the
   * affordances around it to be removed rather than left as a surface that can
   * never fill.
   *
   * So the branch is gone, not merely unreachable: this tile is the archive,
   * unconditionally, and `ctx.nextOpenDrive` is no longer read by anything.
   * HomePage's fetch of `calendarService.getNextUpcomingDrive()` is removed
   * with it - one query fewer on every signed-in home load.
   *
   * Restoring it is small and deliberate: read `ctx.nextOpenDrive` here again
   * and re-add the fetch in HomePage. Nothing about the drive DATA changed -
   * `welfare_projects.workshop_date` still exists and the calendar still shows
   * every drive, past and future; what is gone is the home page pretending a
   * next one is coming.
   */
  tiles: ctx => [
    {
      key: 'drives-archive',
      kind: 'hue',
      cols: 2,
      rows: 2,
      label: 'drives, written up',
      sublabel: 'every drive AQ has run',
      hue: 'welfare',
      icon: 'map-pin',
      href: '/projects',
    },
    rolesTile(ctx),
    handbookTile(),
    mapTile(),
  ],
}

const G19: GridRecipe = {
  id: 'G19',
  name: 'attended nothing, past the first week',
  predicateText: 'drive_attendance.count = 0 AND account_age_days > 7',
  intent:
    'A week in with nothing done means the problem is not urgency, it is that they do not know what is available. So the hue tile is the browse map itself rather than one drive, and the profile door sits at wash weight rather than being hidden.',
  provenance: 'hue tile: lib/departments (8 literal entries, not CAT_COLORS). roles: job_openings. profile: static route. handbook: static route. map: static route.',
  predicate: ctx => !!ctx.signedIn && (ctx.attendedCount ?? 0) === 0 && (ctx.daysSinceApproved ?? 0) > 7,
  tiles: ctx => [
    {
      key: 'browse',
      kind: 'hue',
      cols: 2,
      rows: 2,
      label: 'find something to do',
      sublabel: `all ${departmentsPhrase()}`,
      hue: 'events',
      icon: 'academic-cap',
      href: '/everything-we-do',
    },
    rolesTile(ctx),
    handbookTile(),
    { ...profileTile(ctx), cols: 4 },
    mapTile(),
  ],
}

const G01: GridRecipe = {
  id: 'G01',
  name: 'brand new',
  predicateText: 'account_age_days <= 7',
  intent:
    'Under a week old, so the block welcomes rather than measures. The hue tile names the department they actually joined, which is the one fact that makes the place feel like theirs. The profile door sits beside it so the block welcomes without measuring anything they have not done yet.',
  provenance: 'hue tile: members.approved_at + team_members / lib/departments. handbook: static route. roles: job_openings. profile: static route. map: static route.',
  predicate: ctx => !!ctx.signedIn && typeof ctx.daysSinceApproved === 'number' && ctx.daysSinceApproved <= 7,
  tiles: ctx => [
    {
      key: 'welcome',
      kind: 'hue',
      cols: 2,
      rows: 2,
      label: ctx.departmentName ? `welcome to ${ctx.departmentName}` : 'welcome in',
      sublabel: 'start with the handbook',
      hue: 'lemon',
      icon: 'book-open',
      href: '/volunteer',
    },
    handbookTile(),
    rolesTile(ctx),
    { ...profileTile(ctx), cols: 4 },
    mapTile(),
  ],
}

const G27: GridRecipe = {
  id: 'G27',
  name: 'leader with pending work',
  predicateText: 'hasLeaderAccess(role) AND queue.total > 0',
  intent:
    'Work first, and their OWN work. The hue tile is the depth of the queues this viewer can actually open, named by department where the schema has a department to name, and it links straight to the desk. The two wash tiles beside it are the two biggest queues by row count, so the number on the hue tile is decomposed rather than merely asserted. Their profile stays only when there is nothing to decompose.',
  provenance:
    'hue tile + queue tiles: members(pending_approval), posts(pending, scoped by director_categories), job_applications(pending, scoped by job_openings.category), team_join_requests(pending, RLS-scoped to the teams they lead), collaboration_submissions(new), volunteer_applications(unreviewed, HR/super only), certificate_requests(pending, HR/super only). Each is gated by the same deskAccess privilege as its desk route, so no tile names a queue the viewer cannot open. dept label: director_categories. map: static route.',
  predicate: ctx => !!ctx.signedIn && !!ctx.isDirector && (ctx.queueDepth ?? 0) > 0,
  tiles: ctx => {
    const qs = (ctx.queues ?? []).filter(q => q.count > 0).slice(0, 2)
    const head: GridTile = {
      key: 'queue',
      kind: 'hue',
      cols: 2,
      rows: 2,
      label: 'waiting on you',
      sublabel: [
        typeof ctx.queueDepth === 'number' ? `${ctx.queueDepth} to review` : undefined,
        ctx.deptLabel,
      ].filter(Boolean).join(' · ') || undefined,
      hue: 'pink',
      icon: 'inbox-stack',
      href: '/director',
    }
    // Two 2x1s beside the 2x2, so the block packs with no dead cells whether
    // the breakdown resolved or not.
    const rest: GridTile[] = qs.length >= 2
      ? qs.map((q, i) => ({
          key: `q-${q.key}`,
          kind: 'wash' as const,
          cols: 2 as const,
          rows: 1 as const,
          label: q.label,
          figure: String(q.count),
          hue: (i === 0 ? 'welfare' : 'lemon') as GridTile['hue'],
          href: q.href,
        }))
      : qs.length === 1
        ? [
            { key: `q-${qs[0].key}`, kind: 'wash', cols: 2, rows: 1, label: qs[0].label, figure: String(qs[0].count), hue: 'welfare', href: qs[0].href },
            profileTile(ctx),
          ]
        : [profileTile(ctx), { key: 'desk', kind: 'wash', cols: 2, rows: 1, label: 'the whole desk', href: '/director' }]
    return [head, ...rest, mapTile()]
  },
}

const G30: GridRecipe = {
  id: 'G30',
  name: 'leader, desk clear',
  predicateText: 'hasLeaderAccess(role) AND queue.total = 0 (resolved, not merely unknown)',
  intent:
    'A leader whose queues are empty must not be dropped into a member-onboarding recipe, which is what happened before this existed: G19 matches nearly everyone, so a HoD with nothing waiting was told to go and find something to do. The hue tile states the desk is clear and asks for nothing further, and the block goes back to being about the member they also are. It requires queueDepth to have RESOLVED to 0 - an unresolved queue is not a clear one, so it falls through rather than claiming.',
  provenance: 'hue tile: the same queue reads as G27, summed to zero. dept label: director_categories. teams: team_members. labs: the Labs repository. profile and map: static routes.',
  predicate: ctx => !!ctx.signedIn && !!ctx.isDirector && ctx.queueDepth === 0,
  tiles: ctx => [
    {
      key: 'clear',
      kind: 'hue',
      cols: 2,
      rows: 2,
      label: 'the desk is clear',
      sublabel: ctx.deptLabel ? `nothing waiting in ${ctx.deptLabel}` : 'nothing waiting',
      hue: 'operations',
      icon: 'inbox-stack',
      href: '/director',
    },
    profileTile(ctx),
    labsTile(ctx),
    teamsTile(ctx),
    mapTile(),
  ],
}

const G21: GridRecipe = {
  id: 'G21',
  name: 'something of yours is waiting',
  predicateText: 'own_pending_rows > 0 (team_join_requests | job_applications | posts, submitted by the viewer)',
  intent:
    'The one reminder a member cannot get anywhere else on this page: a thing THEY submitted that nobody has answered yet. It is their own row under own-row RLS, never a queue they cannot act on, so it says where their submission stands without exposing the desk it sits in. Above the browse recipes because a concrete open loop beats a generic prompt.',
  provenance: 'hue tile: team_join_requests(member_id = self, pending) / job_applications(applicant_id = self, pending) / posts(author_id = self, pending), whichever has the most rows. profile, labs, teams and map as elsewhere.',
  predicate: ctx => !!ctx.signedIn && !!ctx.ownPending && ctx.ownPending.count > 0,
  tiles: ctx => {
    const p = ctx.ownPending
    return [
      {
        key: 'own-pending',
        kind: 'hue',
        cols: 2,
        rows: 2,
        label: p?.label ?? 'still being read',
        sublabel: p && p.count > 1 ? `${p.count} waiting` : 'waiting on a reply',
        hue: 'lemon',
        icon: 'briefcase',
        href: p?.href ?? '/profile',
      },
      profileTile(ctx),
      labsTile(ctx),
      teamsTile(ctx),
      mapTile(),
    ]
  },
}

const G09: GridRecipe = {
  id: 'G09',
  name: 'a trail to pick up',
  predicateText: 'notifications.unread > 0 OR saved_posts.count > 0',
  intent:
    'The suggestion half of "suggestions and reminders". `member_activity` exists but holds ZERO rows live, so there is no intent tracker to read and deriving a suggestion from it would be a fabricated signal. What the member actually left behind is real and own-row readable: posts they saved to read later, and notifications they have not opened. Both are their own trail rather than an editorial guess, which is the only kind of suggestion this block is entitled to make.',
  provenance: 'hue tile: notifications(member_id = self, is_read = false) and saved_posts(member_id = self). saved tile: saved_posts. profile and map: static routes. NOTHING here reads member_activity - see the intent line.',
  predicate: ctx => !!ctx.signedIn && ((ctx.unreadCount ?? 0) > 0 || (ctx.savedCount ?? 0) > 0),
  tiles: ctx => {
    const unread = ctx.unreadCount ?? 0
    const saved = ctx.savedCount ?? 0
    const bits = [unread > 0 ? `${unread} unread` : null, saved > 0 ? `${saved} saved` : null].filter(Boolean)
    return [
      {
        key: 'trail',
        kind: 'hue',
        cols: 2,
        rows: 2,
        label: 'pick up where you left off',
        sublabel: bits.join(' · ') || undefined,
        hue: 'sky',
        icon: 'book-open',
        href: unread > 0 ? '/notifications' : '/saved',
      },
      { key: 'saved', kind: 'wash', cols: 2, rows: 1, label: 'saved to read', figure: fig(ctx.savedCount), hue: 'sky', href: '/saved' },
      profileTile(ctx),
      mapTile(),
    ]
  },
}

const G33: GridRecipe = {
  id: 'G33',
  name: 'on a break',
  predicateText: 'members.break_start IS NOT NULL AND members.break_end > now()',
  intent:
    'They told us they are studying, so the product visibly respects that. The hue tile states the break and when it ends and asks for nothing. No counts framed as debts, no nudge, no CTA. Last in the order on purpose: a member on a break who also signed up for a drive sees the drive, because they chose it.',
  provenance: 'hue tile: members.break_start / break_end / break_reason. handbook and map: static routes. Nothing here reads hours, deliberately.',
  predicate: ctx => {
    if (!ctx.signedIn || !ctx.breakStart || !ctx.breakEnd) return false
    const end = new Date(ctx.breakEnd).getTime()
    if (!Number.isFinite(end)) return false
    return end > (ctx.now ?? new Date()).getTime()
  },
  tiles: ctx => {
    const end = ctx.breakEnd ? new Date(ctx.breakEnd) : null
    const label = end && Number.isFinite(end.getTime())
      ? `on a break until ${end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
      : 'on a break'
    return [
      {
        key: 'break',
        kind: 'hue',
        cols: 2,
        rows: 2,
        label,
        sublabel: 'nudges are off, and nothing is removed',
        hue: 'operations',
        icon: 'moon',
        href: '/profile',
      },
      handbookTile(2, 2),
      mapTile(),
    ]
  },
}

/**
 * Always matches. The greeting plus a single full-width map tile and nothing
 * else. If a predicate throws, if the profile call fails, or if the member is
 * in a state none of the nine describe, this renders. The host must never render
 * an empty ink block, and never a tile with a figure it could not fetch.
 *
 * NOTE ON NON-NEGOTIABLE 3. Every other recipe carries exactly one solid hue
 * tile. G38 carries none, and that is correct rather than a violation: the rule
 * is "at most one, and the wash is what makes it read as the answer". G38 has
 * no answer to give, so it makes no claim. `hueTileCount` therefore asserts
 * <= 1, and the test pins G38 at exactly 0.
 */
const G38: GridRecipe = {
  id: 'G38',
  name: 'the fallback',
  predicateText: 'always',
  intent:
    'The block never disappears and never renders empty. One way out, stated plainly. Anything richer here would mean inventing a state the data does not describe.',
  provenance: 'map: static route. Nothing else is read, which is why this survives a failed profile call.',
  predicate: () => true,
  tiles: () => [mapTile()],
}

/** Ordered. First match wins. Do not sort this array. */
export const GRID_RECIPES: readonly GridRecipe[] = [G12, G04, G27, G01, G21, G09, G30, G19, G33, G38] as const

/**
 * Walk the array, take the first match. A predicate that throws is treated as
 * "did not match" and the walk continues, which is what makes G38 the floor
 * rather than a crash.
 */
export function chooseGridRecipe(ctx: GridContext): GridRecipe {
  for (const recipe of GRID_RECIPES) {
    try {
      if (recipe.predicate(ctx)) return recipe
    } catch {
      // A broken predicate must not take the block down. Fall through.
    }
  }
  return G38
}

/** Tiles for a recipe, with the same throw-proofing. */
export function tilesFor(recipe: GridRecipe, ctx: GridContext): GridTile[] {
  try {
    return recipe.tiles(ctx)
  } catch {
    return G38.tiles(ctx)
  }
}

// ── invariants, exported so the tests assert the same functions the host uses ─

export function hueTileCount(tiles: readonly GridTile[]): number {
  return tiles.filter(t => t.kind === 'hue').length
}

/** Every recipe ends with the full-width map tile. */
export function endsWithMapTile(tiles: readonly GridTile[]): boolean {
  const last = tiles[tiles.length - 1]
  return !!last && last.kind === 'map' && last.cols === 4
}

/** Icons only on tiles spanning two or more rows. */
export function iconsOnlyOnTallTiles(tiles: readonly GridTile[]): boolean {
  return tiles.every(t => !t.icon || t.rows >= 2)
}

/**
 * CSS grid auto-placement, simulated. `grid-auto-flow` is the default (row,
 * sparse), so each tile takes the first position at or after the previous
 * tile's start where its span fits. Returns the occupancy matrix.
 *
 * This exists because the failure it catches is invisible in code and obvious
 * on screen: a 2-wide tile placed after a 2x2 leaves two dead cells beside the
 * hue tile, and the ink block renders with a hole in it. Three of the six
 * recipes had exactly that before this was written.
 */
export function packGrid(tiles: readonly GridTile[]): boolean[][] {
  const grid: boolean[][] = []
  const rowAt = (r: number) => {
    while (grid.length <= r) grid.push(new Array(GRID_COLUMNS).fill(false))
    return grid[r]
  }
  const fits = (r: number, c: number, t: GridTile) => {
    if (c + t.cols > GRID_COLUMNS) return false
    for (let dr = 0; dr < t.rows; dr++) {
      const row = rowAt(r + dr)
      for (let dc = 0; dc < t.cols; dc++) if (row[c + dc]) return false
    }
    return true
  }
  let cursorRow = 0
  let cursorCol = 0
  for (const t of tiles) {
    let r = cursorRow
    let c = cursorCol
    // sparse flow: never search backwards past the cursor
    for (;;) {
      if (fits(r, c, t)) break
      c += 1
      if (c >= GRID_COLUMNS) { c = 0; r += 1 }
    }
    for (let dr = 0; dr < t.rows; dr++) {
      const row = rowAt(r + dr)
      for (let dc = 0; dc < t.cols; dc++) row[c + dc] = true
    }
    cursorRow = r
    cursorCol = c + t.cols
    if (cursorCol >= GRID_COLUMNS) { cursorCol = 0; cursorRow = r + 1 }
  }
  return grid
}

/** No dead cells anywhere in the block. */
export function hasNoHoles(tiles: readonly GridTile[]): boolean {
  return packGrid(tiles).every(row => row.every(Boolean))
}

/** A 4-column grid: no tile may span more than 4 columns. */
export function spansFitTheGrid(tiles: readonly GridTile[]): boolean {
  return tiles.every(t => t.cols >= 1 && t.cols <= GRID_COLUMNS && t.rows >= 1 && t.rows <= 2)
}
