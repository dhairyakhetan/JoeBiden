// Post-queue scoping for a director or HoD (teams-as-categories, slice 3).
//
// A leader's moderation queue is the posts in their assigned CATEGORIES (the
// five fixed ones, `director_categories`) OR the posts tagged to one of their
// assigned TEAMS (`director_scopes` + `post_teams`). A leader with neither is
// unscoped and sees the whole queue: the same fail-open rule the category
// scope has always had (narrowing someone to nothing by accident of missing
// data is worse than showing too much; RLS is the real boundary).
//
// This is a display scope, exactly like the category filter it extends: the
// posts RLS has no category or team clause.
//
// Three call sites must agree on it or the desk badge, the desk tile and the
// queue disagree about the same queue: directorService.getPendingPosts,
// directorService.getScopedPendingPostsCount and the leader tile in
// components/AdaptiveGrid. All three go through `applyPostScope`.

/** The slice of a PostgREST filter builder this file needs. */
export interface ScopableQuery<Q> {
  in(column: string, values: readonly (string | number)[]): Q
  or(filters: string): Q
}

/** True when the leader has any scope at all (so an empty result is "nothing in your scope", not "unscoped"). */
export function isPostScoped(categories: readonly string[], scopeTeamIds: readonly number[]): boolean {
  return categories.length > 0 || scopeTeamIds.length > 0
}

/**
 * Narrow a `post_feed_view` / `posts` query to a leader's scope.
 *
 * `scopedPostIds` are the PENDING post ids tagged to the leader's teams; they
 * are only read when `scopeTeamIds` is non-empty. A team scope that currently
 * holds no pending post contributes nothing: with categories it falls back to
 * the category filter, without them the queue is correctly empty.
 */
export function applyPostScope<Q>(
  query: Q & ScopableQuery<Q>,
  categories: readonly string[],
  scopeTeamIds: readonly number[],
  scopedPostIds: readonly number[],
): Q {
  const hasCats = categories.length > 0
  const hasTeams = scopeTeamIds.length > 0
  if (!hasCats && !hasTeams) return query
  if (hasCats && (!hasTeams || scopedPostIds.length === 0)) return query.in('category', categories)
  if (!hasCats) return query.in('post_id', scopedPostIds)
  return query.or(`category.in.(${categories.join(',')}),post_id.in.(${scopedPostIds.join(',')})`)
}
