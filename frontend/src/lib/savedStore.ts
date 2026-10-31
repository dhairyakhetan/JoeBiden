/**
 * One saved/bookmarked truth for the whole session — walkthrough item 8.2,
 * "live updates everywhere outside the desk: saves ... should update
 * dynamically".
 * ────────────────────────────────────────────────────────────────────────────
 * WHAT WAS WRONG
 *
 * Every `FeedPostCard` owned a private `bookmarked` useState, seeded either
 * from the `savedInitial` prop its parent batched or from its own per-card
 * fetch. `SavedPostsPage` fetched once on mount and never heard about anything
 * after that. So the same post rendered in two places held two independent
 * booleans, and the first one you changed was the only one that moved:
 *
 *   · bookmark a post on the home feed, open the same post on a profile, and
 *     it still shows unsaved
 *   · unsave from /saved, go back to the feed, the card still shows saved
 *   · /saved never reflects a save made anywhere else without a remount
 *
 * WHAT THIS IS, AND IS NOT
 *
 * It is a session-local cache of "which post ids are bookmarked", plus a
 * subscription so every component showing post X agrees about X the instant it
 * changes anywhere. The network write still belongs to `savedPostsService` and
 * still happens exactly once, at the call site that initiated it - this store
 * is told the outcome, it does not perform it.
 *
 * It is NOT Supabase realtime. Bookmarks are per-member and there is no second
 * writer: the only thing that can change your bookmarks is you, in this tab.
 * A realtime channel per member for a fact only that member can change would
 * be cost with no information. Cross-DEVICE sync is out of scope for the same
 * reason - the next mount refetches.
 *
 * `known` matters as much as `saved`. A post id absent from `known` means "we
 * have not been told", which is different from "not saved", and a component
 * must be able to fall back to its own prop rather than render an unsaved
 * bookmark over a post that is in fact saved.
 */

const saved = new Set<number>()
const known = new Set<number>()
type Listener = () => void
const listeners = new Set<Listener>()

/**
 * Bumped on every change. `useSyncExternalStore` compares this, so a component
 * re-renders when ANY post's state changes rather than only its own - which is
 * correct and cheap: the alternative is one subscriber set per post id, and a
 * feed holds tens of cards, not thousands.
 */
let version = 0

function emit(): void {
  version++
  for (const l of listeners) l()
}

export const savedStore = {
  subscribe(l: Listener): () => void {
    listeners.add(l)
    return () => { listeners.delete(l) }
  },

  getVersion(): number {
    return version
  },

  /** `undefined` = never been told about this post. Not the same as `false`. */
  get(postId: number): boolean | undefined {
    return known.has(postId) ? saved.has(postId) : undefined
  },

  /** Record the outcome of a save/unsave. Emits only on a real change. */
  set(postId: number, isSaved: boolean): void {
    const had = known.has(postId)
    const was = saved.has(postId)
    if (had && was === isSaved) return
    known.add(postId)
    if (isSaved) saved.add(postId); else saved.delete(postId)
    emit()
  },

  /**
   * Seed from a batched fetch. `ids` is everything the fetch ASKED about, so
   * ids absent from `savedIds` are recorded as a known `false` rather than
   * left unknown — that is what makes a batched feed load authoritative.
   */
  seed(ids: Iterable<number>, savedIds: Iterable<number>): void {
    const s = new Set(savedIds)
    let changed = false
    for (const id of ids) {
      const had = known.has(id)
      const was = saved.has(id)
      const next = s.has(id)
      if (!had || was !== next) changed = true
      known.add(id)
      if (next) saved.add(id); else saved.delete(id)
    }
    if (changed) emit()
  },

  /** Everything currently known to be saved. Used by /saved to stay in step. */
  savedIds(): number[] {
    return [...saved]
  },

  /** Sign-out, or an account switch. Leaving one member's bookmarks in memory
   *  for the next member is the one genuinely harmful failure mode here. */
  clear(): void {
    if (known.size === 0 && saved.size === 0) return
    saved.clear()
    known.clear()
    emit()
  },
}

export default savedStore
