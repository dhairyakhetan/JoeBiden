/**
 * The HoD desk's SINGLE SOURCE OF TRUTH for "which desk needs which privilege".
 * ────────────────────────────────────────────────────────────────────────────
 * Before this file the required privilege for a desk was declared TWICE - once
 * as a `<ProtectedRoute requireSuperAdmin>` prop in App.tsx and once as a
 * `superOnly: true` flag in DirectorDashboard's NAV_GROUPS - and a third time,
 * as a hand-copied filter expression, in DirectorLanding. CLAUDE.md records
 * that a drift between the route guard and the nav gate has already shipped as
 * a real privilege bug on this project ("a lower-privileged leader can reach a
 * super-admin-only screen by typing the URL directly").
 *
 * Now every one of those reads from `DESKS` below:
 *   - App.tsx generates its 18 `<Route>`s from it (guard from `privilege`),
 *   - DirectorDashboard's rail and DirectorLanding's desk list both filter
 *     with `isDeskVisible()`,
 *   - deskAccess.test.ts asserts route-guard and nav-gate agree for every
 *     desk × every role, so the historical bug class fails the test run.
 *
 * `privilege` mirrors RLS, not taste (see lib/roles.ts and changelog 11.7:
 * "Mirror the route guard. Never widen it."). Changing a value here changes
 * BOTH gates at once, which is the point - but it is a real access change and
 * must be matched against the database policy for that desk's tables.
 *
 * This file is deliberately pure data + pure functions (no React, no CSS
 * import) so the unit test can import it under vitest's node environment.
 */
import { hasLeaderAccess, isSuperAdmin } from '../lib/roles'

/**
 * `wall_notes` ("Removed Notes") was here until 2026-09-11 and is gone -
 * walkthrough item 4.1, "delete Removed Notes as a desk".
 *
 * It was a whole nav entry over `profile_notes where deleted_at is not null`,
 * a table holding ZERO rows live. Its own header already conceded the point
 * (§20.2: "a child of post moderation, not a fifth nav group"). Deleted here,
 * in App.tsx's element map, in deskModules' lazy map, and the component file
 * with it. `wallService.listRemoved()` is kept - see the note on it - because
 * the moderation capability is not what was being removed, the DESK was.
 */
export type NavKey =
  | 'blogs' | 'posts' | 'approvals' | 'members' | 'categories'
  | 'teams' | 'hods' | 'content' | 'volunteer_apps' | 'projects'
  | 'enquiries' | 'hiring' | 'certificates' | 'yearbook'
  | 'member_of_month' | 'roles' | 'activity_log' | 'guide'

/**
 * The privilege a desk requires.
 *  - `leader`: hasLeaderAccess() - director / hod / hr / super_admin. Inherited
 *    from the `/director` wrapper route's `requireDirector`; these desks carry
 *    no extra per-route guard.
 *  - `super`:  isSuperAdmin() - hr / super_admin. Rendered with an extra
 *    `<ProtectedRoute requireSuperAdmin>` AND hidden from the nav.
 */
export type DeskPrivilege = 'leader' | 'super'

export type Desk = {
  key: NavKey
  /** Route path, relative to `/director`. */
  path: string
  /** Human-readable label - the nav item and the denied page both use it. */
  label: string
  /** Rail/list glyph (17.1). Presentation, not access. */
  icon: string
  privilege: DeskPrivilege
  /**
   * One sentence saying what this desk is FOR, in plain words - walkthrough
   * item 4.3, "a short tooltip on every desk saying what it is for, starting
   * with Approvals". The Approvals wording below is the user's own from the
   * walkthrough and is the register every other blurb is written to match:
   * what the thing IS and what doing it DOES, not a restatement of the label.
   *
   * Required, not optional, so a desk added later cannot ship without one -
   * deskAccess.test.ts asserts every desk has a non-empty blurb. Rendered as
   * the rail item's `title` and as the description line on the desk list.
   */
  blurb: string
}

/**
 * `approvals` alone carries an EXTRA nav filter beyond its privilege
 * (`canApproveMembers`). Since 2026-09-12 the Approvals desk is `super`
 * (HR / super admin only), so DirectorDashboard passes
 * `canApproveMembers = isSuperAdmin(role)`, which is exactly what the `super`
 * privilege already requires: the filter subtracts nothing the privilege gate
 * had not already removed, and the route guard and nav gate agree. It stays as
 * a named exception so the test can assert that equality; if the two ever
 * diverge the test fails rather than the nav quietly hiding a desk the URL
 * still opens (or showing one the URL refuses).
 */
export const EXTRA_NAV_FILTER: Partial<Record<NavKey, 'canApproveMembers'>> = {
  approvals: 'canApproveMembers',
}

/** True if a role satisfies a desk's privilege. This is what the ROUTE does. */
export function canAccessDesk(desk: Desk, role?: string | null): boolean {
  // Every desk sits under `/director`, whose requireDirector gate runs first.
  if (!hasLeaderAccess(role)) return false
  if (desk.privilege === 'super') return isSuperAdmin(role)
  return true
}

/**
 * Options both nav gates take.
 *
 * `can` is the capability matrix from /director/roles, passed in as a plain
 * predicate rather than imported, so this file stays free of React and of
 * lib/capabilities' own imports and `deskAccess.test.ts` can keep running under
 * vitest's node environment. Omitting it means "no restrictions", which is
 * exactly the pre-engine behaviour and what every existing test asserts.
 */
export type DeskVisibilityOpts = {
  role?: string | null
  canApproveMembers: boolean
  /** `(capabilityKey) => boolean`, normally `useCapabilities().can`. */
  can?: (capabilityKey: string) => boolean
}

/**
 * True if a desk should appear in the nav. This is what the NAV does.
 *
 * The capability check is applied LAST and can only remove a desk that already
 * passed the privilege gate - it never adds one back. App.tsx wraps the same
 * desks in DeskCapabilityGate so the URL refuses in step with the nav.
 */
export function isDeskVisible(desk: Desk, opts: DeskVisibilityOpts): boolean {
  if (!canAccessDesk(desk, opts.role)) return false
  if (EXTRA_NAV_FILTER[desk.key] === 'canApproveMembers' && !opts.canApproveMembers) return false
  if (opts.can && !opts.can(`desk.${desk.key}`)) return false
  return true
}

/**
 * Narrow a desk's rows to the viewer's own teams - walkthrough item 6.1.
 * ────────────────────────────────────────────────────────────────────────────
 * Pure and tested rather than inlined in the component, because every rule in
 * it is a decision that can be got backwards, and two of them are the kind of
 * mistake that is invisible until somebody is looking at an empty desk:
 *
 *   · `isSuperAdmin` short-circuits. "super_admin and HR keep the unscoped
 *     view" was explicit.
 *   · EMPTY `myTeamIds` MEANS UNSCOPED. This is the one most likely to be
 *     "fixed" into the opposite later. A leader who has been given no lead row
 *     and no category assignment must keep the reach they had before scoping
 *     existed - live today that is every non-super leader in the org - because
 *     silently emptying a desk looks exactly like "nobody has applied".
 *   · An item with NO team is out of scope, not in every scope. An opening
 *     that predates the `team_id` FK belongs to no team, and a scoped HoD
 *     seeing it would be seeing something that is not theirs.
 *
 * None of this is a security boundary; RLS is, and is unchanged. This decides
 * what is worth showing someone, not what they are permitted to read.
 */
export function scopeToMyTeams<T extends { teamId?: number | null }>(
  items: readonly T[],
  opts: { isSuperAdmin: boolean; myTeamIds: readonly number[] },
): T[] {
  if (opts.isSuperAdmin) return [...items]
  if (opts.myTeamIds.length === 0) return [...items]
  const allowed = new Set(opts.myTeamIds)
  // A row with no team stays visible: hiding it is how leaders were told about applications and then saw none
  // (report 875f0da1). The database already decided they may read it; this filter only narrows by team.
  return items.filter(i => i.teamId == null || allowed.has(i.teamId))
}

/** The role name to show on the permission-denied page (11.7: "name the role needed"). */
export function requiredRoleLabel(privilege: DeskPrivilege): string {
  return privilege === 'super' ? 'HR or Super Admin' : 'HoD or Director'
}

type NavGroup = { label: string; icon: string; items: Desk[] }

/**
 * Nav grouping - same four groups and same order as before this file existed.
 * The `privilege` field replaces the old `superOnly?: boolean` flag; nothing
 * else about the grouping changed.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'queue',
    // 17.1 Tier 1: five glyphs, ONE PER GROUP. Declared here, not read from
    // items[0].icon - the first VISIBLE item changes with the viewer's role.
    icon: '◧',
    items: [
      // Narrowed to super_admin/HR-only 2026-09-12 (owner: "account approvals
      // that are the general aq sign up are only for hr" - a plain HoD or
      // team lead lost this, since a brand-new applicant isn't on any team
      // yet to scope their access by). members_update's own RLS/trigger
      // enforce this as a real boundary, not just a hidden tab - see
      // members_guard_privileged_cols() and scripts/team_scoped_hod_powers_2026_09_12.sql.
      { key: 'approvals', label: 'Approvals', icon: '◧', path: 'approvals', privilege: 'super',
        blurb: 'New people trying to get into AQ. Approving one makes them a member.' },
      { key: 'posts', label: 'Post Queue', icon: '▤', path: 'posts', privilege: 'leader',
        blurb: 'Everything members have written, waiting to go live on the feed.' },
      { key: 'blogs', label: 'Blog Drafts', icon: '▥', path: 'blogs', privilege: 'leader',
        blurb: 'Long-form pieces on their way to the blog.' },
    ],
  },
  {
    label: 'people',
    icon: '◍',
    items: [
      { key: 'members', label: 'Members', icon: '◍', path: 'members', privilege: 'leader',
        blurb: 'Every account on AQ, with their role, their teams and their contact details.' },
      // FR11. Deliberately 'leader': the desk must open for any director/HoD/HR.
      // WHO CAN PICK is decided by the DB function can_pick_mom_for_team(team_id).
      // Since 2026-11-02 (owner: "allow them") any ACTIVE director or HoD may pick
      // for ANY team, and HR / super admin as before. The nominee must still be an
      // active member of that team and the period open (unless a super admin picks).
      // Until then a HoD could pick only for teams they sat on, so a HoD on no team
      // opened the desk and every pick was refused.
      { key: 'member_of_month', label: 'Member of the Month', icon: '★', path: 'member-of-month', privilege: 'leader',
        blurb: 'Pick the month’s standout and write the citation that goes out with it.' },
      { key: 'teams', label: 'Teams', icon: '▦', path: 'teams', privilege: 'leader',
        blurb: 'Who leads each team, and who is on it.' },
      // Label is the PRD's "Moderation (was Categories)". Key and path stay
      // `categories`; only what a person reads changed.
      { key: 'categories', label: 'Moderation', icon: '◫', path: 'categories', privilege: 'leader',
        blurb: 'Which team each director or HoD moderates posts for.' },
      // 'drives' (this desk's own standalone nav entry) was deleted
      // 2026-09-12 per owner request - "who leads a drive on the day" moved
      // into `projects`' own edit modal (DriveLeadField in
      // ProjectManagerShared.tsx) instead of a separate leader-level desk
      // over the same welfare_projects rows. That narrows who can assign a
      // lead from any director/HoD to super_admin only (projects' own
      // privilege below), a deliberate tradeoff of the consolidation, not
      // an oversight.
    ],
  },
  {
    label: 'intake',
    icon: '◐',
    items: [
      { key: 'hiring', label: 'Hiring', icon: '◐', path: 'hiring', privilege: 'leader',
        blurb: 'Open roles, and the people who have applied to them.' },
      { key: 'enquiries', label: 'Enquiries', icon: '◑', path: 'enquiries', privilege: 'leader',
        blurb: 'Messages sent in through the contact and collaboration forms.' },
      // The HR desk. FR10 (user, 2026-09-05): "certificate only for HR" -
      // issuing a certificate / LoR / LoV is an HR act, not general HoD work.
      // 'super' resolves through isSuperAdmin(), whose ADMIN_ROLES are exactly
      // ['hr', 'super_admin'] - a plain hod/director does not see or reach it.
      { key: 'certificates', label: 'Certificates', icon: '◒', path: 'certificates', privilege: 'super',
        blurb: 'Requests for a certificate, a recommendation letter or proof of volunteering.' },
      // Any director/HoD can run an invite round; yearbook_entries' own RLS
      // already scopes who can see an unsubmitted entry.
      { key: 'yearbook', label: 'Yearbook', icon: '◓', path: 'yearbook', privilege: 'leader',
        blurb: 'Invite members to write their yearbook entry, and read what comes back.' },
    ],
  },
  {
    label: 'admin',
    icon: '◆',
    items: [
      // Relabelled (owner: relabel, do not rebuild). The desk component and its
      // `content` key are unchanged; it is the post review desk.
      { key: 'content', label: 'All posts', icon: '▧', path: 'content', privilege: 'super',
        blurb: 'Where leaders review and tidy every post on the feed.' },
      // Item 7.7. Renamed from "Projects", which named the same rows as the
      // Drives desk without saying so - a drive and a project are one thing in
      // this org, and the public site already calls them drives ("search 570
      // drives"). The route stays `projects`: the label is what a person
      // reads, the path is a URL nothing about this change should break.
      { key: 'projects', label: 'Drive Write-ups', icon: '▨', path: 'projects', privilege: 'super',
        blurb: 'Publishing a drive: its photos, its numbers and its story.' },
      { key: 'hods', label: 'Manage HoDs', icon: '◆', path: 'directors', privilege: 'super',
        blurb: 'Promote a member to HoD or director, or step one back down.' },
      { key: 'volunteer_apps', label: 'Vol. Applications', icon: '◇', path: 'volunteers', privilege: 'super',
        blurb: 'The volunteer outreach list: who has been contacted, with labels and an export.' },
      // Moved in from the standalone /roles route (2026-09-08) - was a
      // community-wide transparency page (requireActive, any signed-in
      // member), now super_admin-only per explicit instruction. RLS on
      // role_capability_notes was already is_super_admin() for writes
      // and unrestricted for reads; this only tightens the app-level gate,
      // it does not touch the table's own policies.
      { key: 'roles', label: 'Roles & Permissions', icon: '◈', path: 'roles', privilege: 'super',
        blurb: 'What each role can reach. Unticking a box takes access away; nothing here can add any.' },
      // Owner request: "an edit log page that logs all the functions, HoDs
      // and people are doing on the website." community_audit_logs already
      // exists and has been written to since 2026-09-11/12 (log_action() RPC
      // + the team_membership trigger - see the two scripts/*audit* files),
      // but nothing in the app has ever read it. 'super' matches the table's
      // own RLS exactly: "Super admin can view audit logs" is its only
      // SELECT policy, so a plain leader would just see a permission error
      // if this were 'leader' instead - the nav gate has to agree with that.
      { key: 'activity_log', label: 'Activity Log', icon: '▤', path: 'activity-log', privilege: 'super',
        blurb: 'Who approved, rejected, or changed what, and when.' },
    ],
  },
  {
    label: 'reference',
    icon: '◎',
    items: [
      { key: 'guide', label: 'Product guide', icon: '◎', path: 'guide', privilege: 'leader',
        blurb: 'Every page and desk on the site in plain language, who each is for, and a map of what connects to what.' },
    ],
  },
]

/** Flat list of every desk, in nav order. App.tsx generates its routes from this. */
export const DESKS: Desk[] = NAV_GROUPS.flatMap(g => g.items)

/** Lookup by key. */
export const DESK_BY_KEY: Record<NavKey, Desk> = Object.fromEntries(
  DESKS.map(d => [d.key, d]),
) as Record<NavKey, Desk>

/** Lookup by route path (relative to /director) - used by the denied page. */
export const DESK_BY_PATH: Record<string, Desk> = Object.fromEntries(
  DESKS.map(d => [d.path, d]),
)

/** The nav's filtered groups. Both the rail and the landing desk list use this. */
export function visibleDeskGroups(opts: DeskVisibilityOpts) {
  return NAV_GROUPS
    .map(g => ({ ...g, items: g.items.filter(item => isDeskVisible(item, opts)) }))
    .filter(g => g.items.length > 0)
}

/**
 * One hue per NAV_GROUP, for the desk list's glyph disc and hover border
 * (section 08). GROUP hues, not category or department hues.
 */
export const GROUP_HUES: Record<string, string> = {
  queue:  'var(--lemon)',
  people: 'var(--welfare)',
  intake: 'var(--events)',
  admin:  'var(--teal)',
}
