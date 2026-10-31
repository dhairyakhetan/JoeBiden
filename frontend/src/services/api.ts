// Type-only exports - no Axios, no HTTP client.
// Community services use supabaseCommunity directly.

export interface Member {
  uuid: string
  email: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  phone?: string
  role: 'member' | 'hod' | 'director' | 'super_admin'
  status: 'pending_approval' | 'active' | 'rejected' | 'suspended'
  rejectionNote?: string
  isSuperAdmin?: boolean
  createdAt?: string
}

export interface Post {
  postId: number
  uuid: string
  category: string
  body: string
  linkUrl?: string
  linkTitle?: string
  linkImage?: string
  status: string
  createdAt: string
  authorId: number
  authorUuid: string
  authorName: string
  authorAvatar?: string
  authorRole: string
  likeCount: number
  commentCount: number
  // Post images can carry either `blobUrl` (new posts, from Supabase
  // signed/public URLs) or `url` (legacy / sample posts, plain CDN URLs).
  // We normalize at render time by reading both; both fields are kept
  // optional so the type doesn't lie about either branch existing.
  images?: { blobUrl?: string; url?: string; displayOrder: number }[]
  // PDF / PPTX attachments. Backend post_documents table - selectors
  // need to be extended to JOIN before this field will be populated;
  // until then it stays `undefined` and renders nothing.
  documents?: { url: string; fileName: string; mimeType: string; size: number; displayOrder: number }[]
  taggedMembers?: { memberId: number; uuid: string; fullName: string; avatarUrl?: string }[]
  isLiked?: boolean
  teamName?: string
  teamUuid?: string
  /** The sub-department this post was tagged to, if any — see sub_teams_hierarchy_2026_09_17.sql. */
  subTeamName?: string
  subTeamUuid?: string
  pinned?: boolean
  pinnedTitle?: string | null
  /** Featured on the Projects/Directory "featured drives" band (distinct from
      pinned/notice-board). See posts_featured_flag_2026_07.sql. */
  featured?: boolean
  /** Up to 2 highlighted stat blocks (e.g. { value: "150", label: "volunteers" }),
      shown in a colored rail on the feed card + full post page. Optional -
      most posts have none. See posts_stat_blocks_2026_07.sql. */
  stats?: { value: string; label: string }[]
  // ── Posts-as-primitive source linkage (post_feed_view enrichment, migration 019) ──
  // When a post was mirrored from a CMS row (a welfare project, a blog, or a job
  // opening), these carry enough to (a) show the source cover as the card image
  // and (b) deep-link the card to the source detail page instead of the generic
  // post modal. `sourceType` is null for a native member-authored post.
  sourceType?: 'welfare_project' | 'blog' | 'job_opening' | null
  sourceSlug?: string | null
  sourceTitle?: string | null
  sourceAuthor?: string | null
  /** Stored read time for an article, in minutes. Never derived from `body`. */
  sourceReadMinutes?: number | null
  sourceLocation?: string | null
}

export interface Achievement {
  achievementId: number
  uuid: string
  memberId: number
  title: string
  description?: string
  achievementType: 'leadership' | 'academic' | 'competition' | 'personal_project' | 'other'
  achievementDate: string
  achievementEndDate?: string | null
  proofUrl?: string
  createdAt: string
  updatedAt: string
  // Approval workflow. New achievements start as 'pending'; only
  // 'approved' rows show on public profile pages. Owner sees own at
  // any status with a status badge.
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: number | null
  reviewedAt?: string | null
  reviewNote?: string | null
}

// REDESIGN 2026-09: `AchievementReview` is DELETED along with the
// director-side review queue it existed for. Achievements are approved on
// submit now, so nothing joins an achievement to its submitter for a queue
// card. See CHANGELOG_FEATURES.md.

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    currentPage: number
    totalPages: number
    totalItems: number
    itemsPerPage: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface School {
  /** The numeric key `members.school_id` stores and every picker compares on.
   *  It was missing from this interface, which is why EditProfilePage declared
   *  its own local School type and force-cast the service result - and why the
   *  service could stop selecting the column without anything failing to
   *  compile. Declared here so the cast can go. */
  schoolId: number
  uuid: string
  name: string
  shortName?: string
  logoUrl?: string
  location?: string
  website?: string
  memberCount: number
  createdAt: string
}

export interface SchoolDetails extends School {
  recentMembers: {
    uuid: string
    fullName: string
    avatarUrl?: string
    classGrade?: string
    role: string
  }[]
  classes: {
    uuid: string
    name: string
    gradeLevel?: string
    academicYear?: string
    memberCount: number
  }[]
}

export interface SchoolMember {
  uuid: string
  fullName: string
  avatarUrl?: string
  classGrade?: string
  role: string
  bio?: string
  className?: string
  classUuid?: string
  createdAt: string
}
