// The canonical 5-value category vocabulary - posts.category,
// director_categories.category and sops.department_slug all key off this
// exact list live in the database (see posts_category_check and the CHECK
// constraint in scripts/sops_and_todos_desk_2026_08_29.sql). Widening this
// to the 8 real departments is a separate, larger decision (touches those
// constraints plus moderation scoping) - not done here. This is the single
// source for the value list itself; several files used to hardcode their
// own independent copy (TeamManagement.tsx, directorService.ts) and drift
// out of sync with each other.
export const CATEGORY_SLUGS = ['events', 'welfare', 'content', 'operations', 'labs'] as const
export type CategorySlug = typeof CATEGORY_SLUGS[number]

// Maps a post/role/feed category to the slug of its department card on
// /everything-we-do (each department <article> carries this id as an anchor).
// Used by the passive content-network links on PostPage, OpportunitiesPage,
// and FeedPage so a category chip becomes "see what this team does".
export const CAT_TO_DEPT: Record<string, string> = {
  events: 'events',
  welfare: 'welfare-projects',
  content: 'social-media',
  operations: 'collabs',
  labs: 'shikshaq',
}
