export interface DashboardStats {
  pendingMemberApprovals: number
  pendingPostReviews: number
  /** New (unreviewed) rows across contact_submissions + collaboration_submissions. */
  pendingEnquiries: number
  /** job_applications still sitting at status='pending'. */
  pendingApplications: number
  /**
   * Members with status='active'. NOTE: this is "approved", not "onboarded" -
   * 1273 of these have never signed in (auth_uid IS NULL), because a member row
   * can be pre-seeded by email and only adopted on first Google sign-in. Do not
   * use it as an engagement denominator; it overstates by ~32x.
   */
  totalActiveMembers: number
  totalPublishedPosts: number
}

export interface PendingMember {
  memberId: number
  uuid: string
  email: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  phone?: string
  joinReason?: string
  createdAt: string
  /** When HR/a director marked this applicant as contacted - null until then. */
  contactedAt?: string | null
  /** True if this account was ever soft-deleted before (including via the
   *  self-service "appeal" flow on RejectedPage.tsx) - shown as a red flag
   *  on this row so whoever reviews the application knows it isn't a
   *  first-time applicant. Never cleared once set. */
  previouslyRemoved?: boolean
}

export interface RejectedMember {
  memberId: number
  uuid: string
  email: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  phone?: string
  joinReason?: string
  rejectionNote?: string
  createdAt: string
  /** When the rejection happened - members has no dedicated rejected_at column, so this is updated_at. */
  rejectedAt: string
}

export interface DirectoryMember {
  memberId: number
  uuid: string
  email: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  /** WhatsApp/contact number. Undefined if the view doesn't grant this column
   *  to the viewer's role rather than the member simply having none - don't
   *  render "no number" for undefined, render nothing/a neutral dash. */
  phone?: string
  /** Same grant caveat as `phone`: undefined means "not granted to this
   *  viewer", not "the member has none". `contact_access_log` records a reveal
   *  of either, per the Equity Policy's Direct Messaging principle. */
  instagram?: string
  linkedin?: string
  /**
   * The member's school, resolved by `member_directory_view` off
   * `members.school_id` -> `schools` — walkthrough item 5.1, "auto-hydrate
   * with the real fields".
   *
   * The view has carried this column all along and the directory query is a
   * `select('*')`, so it was ALREADY being fetched on every page of the desk
   * and thrown away by the mapper — the same defect `instagram`/`linkedin`
   * had until the 2026-09 pass. Counted live under a real director session:
   * 1,034 of 1,379 members have one. Not a new column, not a new query.
   */
  schoolName?: string
  role: 'member' | 'director' | 'hod' | 'hr' | 'super_admin'
  status: string
  createdAt: string
  postCount?: number
  /** Current/most-recent break summary, denormalized on `members` - see
   *  breakService.ts. `isCurrentlyOnBreak(breakEnd)` decides whether it's live. */
  breakEnd?: string | null
}

export interface Director {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl?: string
  email: string
  createdAt: string
  /**
   * NO `isSuperAdmin` FIELD. Removed 2026-09-17 (audit, security P3): it was
   * `role === 'super_admin'`, written before `hr` existed, so it was false for
   * an account that lib/roles.ts defines as equal in power. Ask
   * `isSuperAdmin(director.role)` from lib/roles.ts instead - that is the helper
   * the whole codebase is supposed to use, and it is right for both roles.
   */
  role?: string
  categories: string[]
}

export interface EligibleMember {
  memberId: number
  uuid: string
  email: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  createdAt: string
}

export interface CategoryAssignment {
  memberId: number
  uuid: string
  fullName: string
  avatarUrl?: string
  email: string
  assignedAt: string
}

export type CategoryAssignments = Record<string, CategoryAssignment[]>

/** A team a leader can be assigned to moderate. `parentTeamId` nests a department under its parent. */
export interface ScopeTeam {
  teamId: number
  name: string
  parentTeamId: number | null
}

/** Who moderates each team, keyed by `team_id`. Same assignee shape as the category desk. */
export type ScopeAssignments = Record<number, CategoryAssignment[]>
