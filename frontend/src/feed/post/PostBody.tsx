import { Post } from '../../services/api'
import { safeExternalHref } from '../../lib/safeUrl'
import { PostMeta } from './postParsing'

interface PostBodyProps {
  post: Post
  highlightMeta: PostMeta[]
  displayBody: string
  projectWriteup: string | null
}

// Content pane body (03.3.1): stat wells, body text (unclamped - this is the
// one place the whole post is readable), link preview, document attachments.
// Images now live in PostMedia.tsx / the sticky media pane, not here.
export default function PostBody({ post, highlightMeta, displayBody, projectWriteup }: PostBodyProps) {
  return (
    <article className="pp-body">
      {/* Stat wells - renders exactly what the post carries, never padded to
          a fixed count: an invented "0" would be a claim with no source. */}
      {!!post.stats?.length && (
        <div className="pp-statrow">
          {post.stats.map((s, i) => (
            <div key={i} className="pp-stat">
              <div className="pp-stat-num">{s.value}</div>
              <div className="pp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* "Impact" / long facts - not named by 03.3.1, so it keeps the nearest
          documented visual (the cream --r-inner well family) instead of
          either inventing a new pattern or losing the content outright. */}
      {highlightMeta.length > 0 && (
        <div className="pp-highlights">
          {highlightMeta.map((m, i) => (
            <div key={i} className="pp-highlight">
              <span className="pp-highlight-label">{m.label}</span>
              <p className="pp-highlight-text">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      {displayBody && <p className="pp-body-text">{displayBody}</p>}

      {/* Full welfare-project writeup, auto-pulled for welfare posts. */}
      {projectWriteup && projectWriteup.trim() && projectWriteup.trim() !== displayBody?.trim() && (
        <div className="pp-writeup">
          <div className="mono xs upper pp-writeup-label">the full story</div>
          {projectWriteup.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="pp-body-text" style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{para.trim()}</p>
          ))}
        </div>
      )}

      {post.linkUrl && (
        <a href={safeExternalHref(post.linkUrl)} target="_blank" rel="noopener noreferrer" className="pp-link-cta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          {(post as any).linkTitle || post.linkUrl.replace(/^https?:\/\//, '').slice(0, 60)}
        </a>
      )}

      {/* Attachments - PDFs / slide decks etc. (post_documents). */}
      {post.documents && post.documents.length > 0 && (
        <div className="pp-docs">
          {post.documents.map((doc, i) => (
            <a key={i} href={safeExternalHref(doc.url)} target="_blank" rel="noopener noreferrer" className="pp-doc-chip">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              {doc.fileName}
            </a>
          ))}
        </div>
      )}
    </article>
  )
}
