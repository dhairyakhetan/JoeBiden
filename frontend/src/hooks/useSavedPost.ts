import { useSyncExternalStore } from 'react'
import savedStore from '../lib/savedStore'

/**
 * "Is this post bookmarked?", answered from the one session-wide store rather
 * than from a private `useState` per card — walkthrough item 8.2.
 *
 * `fallback` is the caller's own best guess (the `savedInitial` a parent
 * batched, or its own fetch). It is used ONLY while the store has never been
 * told about this post: once the store knows, the store wins, which is exactly
 * what makes two cards for the same post agree.
 *
 * `useSyncExternalStore` rather than a `useEffect` + `useState` pair, because
 * it is tear-free under concurrent rendering and needs no mount-time sync
 * effect — the first render already reads the current value.
 */
export function useSavedPost(postId: number, fallback?: boolean): boolean {
  useSyncExternalStore(savedStore.subscribe, savedStore.getVersion, savedStore.getVersion)
  const known = savedStore.get(postId)
  return known ?? fallback ?? false
}

export default useSavedPost
