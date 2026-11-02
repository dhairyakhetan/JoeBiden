/**
 * Where a person's profile lives, for a given viewer. Your own is /profile/<uuid> (editable, with your CV and hours);
 * everyone else's is /member/<uuid> (follow button, wall, shared teams). /profile/<other> exists too but is the
 * login-gated own-profile page, which has no follow button or wall composer, so rosters and notes must not point there.
 */
export function profilePath(viewerUuid: string | null | undefined, targetUuid: string): string {
  return viewerUuid && viewerUuid === targetUuid ? `/profile/${targetUuid}` : `/member/${targetUuid}`
}
