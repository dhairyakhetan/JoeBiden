import { useState } from 'react'
import Img from '../../components/Img'
import ImageLightbox from '../../components/ImageLightbox'
import { sized } from '../../lib/imageUrl'
import { Post } from '../../services/api'

interface PostMediaProps {
  post: Post
}

// The media pane's content - desktop's sticky left column (03.3) and phone's
// media block (03.4) share this one component; which chrome shows (filmstrip
// vs. progress track) is a pure CSS toggle in PostPage.css so there is no
// layout-detection flicker and no duplicated image/lightbox state.
//
// Note (03.3): `posts` carries no `sticker` column (confirmed live) - the
// sticker overlay this section also specs does not ship. See the PR notes.
export default function PostMedia({ post }: PostMediaProps) {
  const images = (post.images || []).map((img: any) => img.blobUrl || img.url).filter(Boolean) as string[]
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const hasImages = images.length > 0
  const hasMultiple = images.length > 1
  const active = images[Math.min(activeIndex, images.length - 1)]

  if (!hasImages) return null

  return (
    <>
      <button
        type="button"
        className="post-media-photo"
        onClick={() => setLightboxSrc(active)}
        aria-label={hasMultiple ? `View photo ${activeIndex + 1} of ${images.length}, full size` : 'View photo full size'}
        title={hasMultiple ? `View photo ${activeIndex + 1} of ${images.length}, full size` : 'View photo full size'}
      >
        <Img
          src={sized(active, 'full')}
          alt={`Photo from ${post.authorName}'s post${hasMultiple ? `, ${activeIndex + 1} of ${images.length}` : ''}`}
          className="no-outline"
          eager
        />
        {/* Phone only - overlaid counter pill (03.4). Desktop's own {i} of {n}
            sits beside the filmstrip instead - see .post-media-filmstrip-meta. */}
        {hasMultiple && <span className="post-media-count post-media-count--phone">{activeIndex + 1} of {images.length}</span>}
      </button>

      {hasMultiple && (
        <>
          {/* Desktop - a filmstrip of real thumbnails. */}
          <div className="post-media-filmstrip">
            <div className="post-media-filmstrip-row">
              {images.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className={`post-media-thumb${i === activeIndex ? ' is-active' : ''}`}
                  onClick={() => setActiveIndex(i)}
                  aria-label={`Show photo ${i + 1} of ${images.length}`}
                  aria-current={i === activeIndex}
                  title={`Show photo ${i + 1} of ${images.length}`}
                >
                  <Img src={sized(src, 'thumb')} alt="" className="no-outline" />
                </button>
              ))}
            </div>
            <span className="post-media-count">{activeIndex + 1} of {images.length}</span>
          </div>

          {/* Phone - a segmented progress track, not a thumbnail strip. */}
          <div className="post-media-progress" role="tablist" aria-label="Photo progress">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === activeIndex}
                aria-label={`Show photo ${i + 1} of ${images.length}`}
                className={`post-media-seg${i === activeIndex ? ' is-active' : ''}`}
                onClick={() => setActiveIndex(i)}
                title={`Show photo ${i + 1} of ${images.length}`}
              />
            ))}
          </div>
        </>
      )}

      <ImageLightbox
        src={lightboxSrc}
        alt={`Photo from ${post.authorName}'s post`}
        caption={hasMultiple ? `${activeIndex + 1} of ${images.length}` : undefined}
        onClose={() => setLightboxSrc(null)}
      />
    </>
  )
}
