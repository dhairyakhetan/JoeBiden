// Shared cache key for the public projects list (see PublicProjectsPage.tsx).
// That page serves a localStorage snapshot instantly and only silently
// revalidates in the background every 30 minutes - great for visitor
// performance, but it means a director who just added/edited/published a
// project from the HoD Desk would keep seeing their own stale list for up to
// half an hour. ProjectManager calls bustProjectsCache() after every write so
// the very next visit to /projects (same browser) fetches fresh instead.
export const PROJECTS_CACHE_KEY = 'aq_projects_cache_v3'

export function bustProjectsCache(): void {
  try { localStorage.removeItem(PROJECTS_CACHE_KEY) } catch { /* private mode - nothing to bust */ }
}
