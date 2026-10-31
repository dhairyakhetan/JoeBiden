import { useState, useEffect } from 'react'
import type { Post } from '../services/api'
import savedPostsService from '../services/savedPostsService'
import savedStore from '../lib/savedStore'
import { jobOpenings } from '../lib/jobOpenings'

/**
 * Batch-resolve the two pieces of per-card data that FeedPostCard would
 * otherwise self-fetch on mount - the viewer's saved/bookmark set and any
 * job opening linked to each post. Without this, a list of N cards fires
 * 2×N queries (one getSavedSet + one getByPostId each); this collapses
 * that to exactly two queries per list.
 *
 * Pass the resolved values into each FeedPostCard as
 *   savedInitial={savedSet.has(post.postId)}
 *   linkedOpening={openings.get(post.uuid) ?? null}
 * The card uses them and skips its own fetch; if a card is rendered
 * standalone (no props), it still self-fetches - fully backward compatible.
 *
 * Re-runs only when the set of post ids changes (keyed on a joined id
 * string), so appending a page issues just two more queries, not 2×N.
 */
export function useFeedCardBatch(posts: Post[]) {
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set())
  const [openings, setOpenings] = useState<Map<string, any>>(new Map())

  const idKey = posts.map(p => p.postId).join(',')

  useEffect(() => {
    const postIds = posts
      .map(p => p.postId)
      .filter((n): n is number => typeof n === 'number')
    const uuids = posts
      .map(p => p.uuid)
      .filter((u): u is string => !!u)

    if (postIds.length === 0 && uuids.length === 0) {
      setSavedSet(new Set())
      setOpenings(new Map())
      return
    }

    let cancelled = false
    Promise.all([
      savedPostsService.getSavedSet(postIds),
      jobOpenings.getByPostIds(uuids),
    ])
      .then(([s, o]) => {
        if (cancelled) return
        // Item 8.2. Seed the session-wide store from this batch, so every card
        // for these posts agrees - including ones mounted later on another
        // route. `seed` takes the ids we ASKED about, not just the saved ones,
        // so "asked and not saved" is recorded as a known false rather than
        // left unknown and re-fetched per card.
        savedStore.seed(postIds, s)
        setSavedSet(s)
        setOpenings(o)
      })
      .catch(() => { /* non-critical - cards fall back to self-fetch */ })

    return () => { cancelled = true }
    // idKey captures the meaningful change (which posts are in the list).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idKey])

  return { savedSet, openings }
}
