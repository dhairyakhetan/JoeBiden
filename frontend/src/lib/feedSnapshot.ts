import { readSnapshot, writeSnapshot } from './homeSnapshot'

/**
 * The home feed's first page, persisted across closing the app (see homeSnapshot.ts for why and for the safety rules).
 *
 * This file adds the one thing homeSnapshot deliberately does not know: what a feed page looks like. A snapshot written by an older
 * build can have a different post shape than the code that is reading it now; rendering that would crash the page that was supposed
 * to load faster. So a snapshot is only returned when every post has the fields the card list is keyed and sorted on, and anything
 * else is treated as "no snapshot" and the page fetches as it always did.
 *
 * Bump FEED_SCHEMA whenever the `Post` shape the feed stores changes.
 */
export const FEED_SCHEMA = 'feed_v2'

export interface FeedSnapshot { data: any[]; total: number; hasMore?: boolean }

/** A scope is a member uuid, or `anon` for the signed-out feed. */
const scopeOf = (memberUuid: string | null | undefined): string => memberUuid || 'anon'
const nameOf = (category: string, tab: string): string => `${FEED_SCHEMA}:${category || 'all'}:${tab}`

export function looksLikeFeedPage(v: unknown): v is FeedSnapshot {
  if (!v || typeof v !== 'object') return false
  const f = v as { data?: unknown; total?: unknown }
  if (!Array.isArray(f.data) || f.data.length === 0 || typeof f.total !== 'number') return false
  return f.data.every(p => !!p && typeof p === 'object' && typeof (p as any).postId === 'number' && typeof (p as any).uuid === 'string')
}

export function readFeedSnapshot<T extends FeedSnapshot = FeedSnapshot>(memberUuid: string | null | undefined, category: string, tab: string): T | null {
  const v = readSnapshot<unknown>(scopeOf(memberUuid), nameOf(category, tab))
  return looksLikeFeedPage(v) ? (v as T) : null
}

export function writeFeedSnapshot(memberUuid: string | null | undefined, category: string, tab: string, page: FeedSnapshot): void {
  if (!looksLikeFeedPage(page)) return // never persist something we would refuse to read back
  writeSnapshot(scopeOf(memberUuid), nameOf(category, tab), page)
}
