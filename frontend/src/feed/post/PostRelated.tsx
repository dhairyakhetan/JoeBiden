import { useMemo } from 'react'
import { Post } from '../../services/api'
import FeedPostCard from '../FeedPostCard'
import { feedItemFromPost } from '../feedItemFromPost'
import { shapeFeed } from '../../lib/feedShape'

interface PostRelatedProps {
  post: Post
  relLoading: boolean
  relByAuthor: Post[]
  relByCategory: Post[]
  relSavedSet: Set<number>
  relOpenings: Map<string, any>
}

// "More from {author}" / "more in {category}" rails. Not named by 03.3, so
// only the container/heading move onto the new tokens - the cards themselves
// are FeedPostCard, out of this file's scope (01-home-feed.md / 15-post-cards.md).
export default function PostRelated({ post, relLoading, relByAuthor, relByCategory, relSavedSet, relOpenings }: PostRelatedProps) {
  // Section 10 mount, this page: two genuinely different lists ("more from
  // this author" / "more in this category"), each needs its OWN shapeFeed()
  // pass - one array indexed by `i` across both would pair a category-rail
  // card with a shape chosen for an unrelated author-rail post at the same
  // index (the exact bug caught on ProfilePage's own tagged-posts tab).
  const byAuthorDecisions = useMemo(
    () => shapeFeed(relByAuthor.map(p => feedItemFromPost(p, ''))),
    [relByAuthor],
  )
  const byCategoryDecisions = useMemo(
    () => shapeFeed(relByCategory.map(p => feedItemFromPost(p, ''))),
    [relByCategory],
  )

  if (relLoading) {
    return (
      <section className="pp-related">
        <div className="v6-skeleton" style={{ width: 220, height: 20, marginBottom: 18, borderRadius: 6 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2].map(i => <div key={i} className="v6-skeleton" style={{ height: 120, borderRadius: 'var(--r-inner)', animationDelay: `${i * 0.08}s` }} />)}
        </div>
      </section>
    )
  }

  return (
    <>
      {relByAuthor.length > 0 && (
        <section className="pp-related">
          <h2 className="pp-related-h">more from {post.authorName}</h2>
          <div className="pp-related-list">
            {relByAuthor.map((p, i) => (
              <FeedPostCard
                key={p.postId} post={p} seed={i}
                savedInitial={relSavedSet.has(p.postId)}
                linkedOpening={relOpenings.get(p.uuid) ?? null}
                decision={byAuthorDecisions[i]}
              />
            ))}
          </div>
        </section>
      )}
      {relByCategory.length > 0 && (
        <section className="pp-related">
          <h2 className="pp-related-h">more in {post.category}</h2>
          <div className="pp-related-list">
            {relByCategory.map((p, i) => (
              <FeedPostCard
                key={p.postId} post={p} seed={i}
                savedInitial={relSavedSet.has(p.postId)}
                linkedOpening={relOpenings.get(p.uuid) ?? null}
                decision={byCategoryDecisions[i]}
              />
            ))}
          </div>
        </section>
      )}
    </>
  )
}
