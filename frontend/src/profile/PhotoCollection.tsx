import { useMemo } from 'react'
import Img from '../components/Img'
import type { Post } from '../services/api'

/**
 * "Your posts and activity" - a real photo collection strip, sourced entirely
 * from the same `posts` the page already fetched for the post-card list below
 * (no new query). Real images only: a post with no photo contributes nothing,
 * and a member with zero photo posts gets no section at all rather than an
 * empty well - matching this codebase's own "never render an empty claim"
 * rule (guardrail 4).
 *
 * Fixed rotations, not random: a random tilt re-rolls on every re-render,
 * which is exactly the Math.random()-in-render bug lib/feedShape.ts's own
 * rotation rule (13.4) already documents as a bug, not a style choice.
 */
const ROTATIONS = [-4, 3, -2, 5, -3, 2, -5, 4]
const MAX_SHOWN = 8

export default function PhotoCollection({ posts }: { posts: Post[] }) {
  const photos = useMemo(() => {
    const urls: string[] = []
    for (const post of posts) {
      for (const img of post.images || []) {
        const url = img.blobUrl || img.url
        if (url) urls.push(url)
      }
    }
    return urls
  }, [posts])

  if (photos.length === 0) return null
  const shown = photos.slice(0, MAX_SHOWN)

  return (
    <div className="pf-photos">
      <div className="pf-photos-head">
        <span className="pf-photos-label">photos</span>
        <span className="pf-photos-count">{photos.length}</span>
      </div>
      <div className="pf-photos-strip">
        {shown.map((url, i) => (
          <div
            key={url + i}
            className="pf-photo-card"
            style={{ ['--rot' as string]: `${ROTATIONS[i % ROTATIONS.length]}deg` }}
          >
            <Img ctx="thumb" src={url} alt="" loading="lazy" />
          </div>
        ))}
      </div>
    </div>
  )
}
