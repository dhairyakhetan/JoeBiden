// ─────────────────────────────────────────────────────────────────────────────
// recentlyViewed - ephemeral "recently viewed" list for re-entry.
// Legitimate localStorage use: this is transient per-device UI state, not user
// data that needs to sync (unlike bookmarks, which live in saved_posts). Records
// the posts / profiles / teams / projects a user opened, most-recent-first,
// deduped by kind+id, capped at CAP.
// ─────────────────────────────────────────────────────────────────────────────

export type RecentKind = 'post' | 'profile' | 'team' | 'project'

export interface RecentItem {
  kind: RecentKind
  id: string          // uuid or slug - stable per entity
  title: string
  subtitle?: string
  image?: string
  href: string
  ts: number          // epoch ms of the last view
}

const KEY = 'aq_recently_viewed'
const CAP = 12

export function getRecent(): RecentItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw)
    if (!Array.isArray(list)) return []
    return list.filter((x: any) => x && x.kind && x.id && x.href && x.title)
  } catch {
    return []
  }
}

// Record a view. Dedupes by kind+id (a re-view moves the item to the front and
// refreshes its metadata), keeps most-recent-first, and caps the list.
export function pushRecent(item: Omit<RecentItem, 'ts'>): void {
  try {
    if (!item?.id || !item?.href || !item?.title) return
    const now = Date.now()
    const existing = getRecent().filter(x => !(x.kind === item.kind && x.id === item.id))
    const next: RecentItem[] = [{ ...item, ts: now }, ...existing].slice(0, CAP)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage unavailable / quota - recently-viewed is best-effort */
  }
}

export function clearRecent(): void {
  try { localStorage.removeItem(KEY) } catch { /* ignore */ }
}
