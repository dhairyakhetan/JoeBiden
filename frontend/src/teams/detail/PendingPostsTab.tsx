// Split out of TeamDetailPage.tsx's 'pending' tab body. Leader-only queue of
// team posts awaiting approval before they go live on the feed
// (teamService.approvePost / rejectPost).
import Img from '../../components/Img'
import { Link } from 'react-router-dom'
import { PendingTeamPost } from '../../services/teamService'
import { sized } from '../../lib/imageUrl'
import Field from '../../components/Field'
import { initials } from './shared'
import GatedButton from '../../components/GatedButton'

export default function PendingPostsTab({
  pendingPosts, pendingPostsLoading, pendingPostsError, setPendingPostsError,
  rejectingPost, setRejectingPost, rejectionNote, setRejectionNote,
  approvingPost, catColor,
  handleApprovePost, handleRejectPost,
}: {
  pendingPosts: PendingTeamPost[]
  pendingPostsLoading: boolean
  pendingPostsError: string | null
  setPendingPostsError: (v: string | null) => void
  rejectingPost: number | null
  setRejectingPost: (v: number | null) => void
  rejectionNote: string
  setRejectionNote: (v: string) => void
  approvingPost: number | null
  catColor: string
  handleApprovePost: (postId: number) => void
  handleRejectPost: (postId: number) => void
}) {
  return (
    <>
      {pendingPostsError && (
        <div role="alert" className="card" style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(224,92,92,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>{pendingPostsError}</span>
          {/* Was an unlabelled ~16x19 target announced as "multiplication x". */}
          <button onClick={() => setPendingPostsError(null)} aria-label="Dismiss error" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', minWidth: 44, minHeight: 44, margin: '-13px -14px -13px 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
      {pendingPostsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-hidden="true">
          {[1, 2].map(i => (
            <div key={i} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div className="v6-skeleton sk-circle" style={{ width: 36, height: 36, animationDelay: `${i * 0.08}s` }} />
                <div>
                  <div className="v6-skeleton" style={{ width: 120, height: 13, marginBottom: 6 }} />
                  <div className="v6-skeleton" style={{ width: 70, height: 10 }} />
                </div>
              </div>
              <div className="v6-skeleton" style={{ width: '90%', height: 13, marginBottom: 8 }} />
              <div className="v6-skeleton" style={{ width: '65%', height: 13, marginBottom: 14 }} />
              <div className="row gap-2">
                <div className="v6-skeleton sk-pill" style={{ width: 90, height: 30 }} />
                <div className="v6-skeleton sk-pill" style={{ width: 70, height: 30 }} />
              </div>
            </div>
          ))}
        </div>
      ) : pendingPosts.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {pendingPosts.length > 0 && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', marginBottom: 12, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 'var(--r-tight)', border: '1px solid var(--line)' }}>
              These posts are awaiting review by a Director or HoD before they can be published.
            </div>
          )}
          {pendingPosts.map(post => (
            <div key={post.postId} className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Link to={`/profile/${post.authorUuid}`} style={{ textDecoration: 'none' }}>
                  <div className="avatar" style={{ background: catColor, overflow: 'hidden', width: 36, height: 36, fontSize: 12 }}>
                    {post.authorAvatar ? <Img ctx="avatar" src={post.authorAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : initials(post.authorName)}
                  </div>
                </Link>
                <div>
                  <Link to={`/profile/${post.authorUuid}`} style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', textDecoration: 'none' }}>{post.authorName}</Link>
                  <div className="mono xs muted">{new Date(post.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', marginBottom: 12 }}>{post.body}</p>
              {post.images && post.images.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12, borderRadius: 'var(--r-tight)', overflow: 'hidden' }}>
                  {post.images.map((img, i) => <Img key={img.blobUrl} src={sized(img.blobUrl, 'thumb')} alt={`Photo ${i + 1} of ${post.images!.length} from ${post.authorName}'s post`} loading="lazy" decoding="async" style={{ width: '100%', height: 100, objectFit: 'cover' }} />)}
                </div>
              )}
              {rejectingPost === post.postId ? (
                <div style={{ marginBottom: 12, padding: 12, background: 'rgba(224,92,92,0.06)', borderRadius: 'var(--r-tight)' }}>
                  <Field
                    label="rejection note"
                    required
                    labelClassName="mono xs upper muted"
                    labelStyle={{ fontWeight: 700, color: 'var(--danger)', display: 'block', marginBottom: 8 }}
                  >
                    {id => <textarea id={id} className="textarea" value={rejectionNote} onChange={e => setRejectionNote(e.target.value)} rows={2} placeholder="explain why…" style={{ marginBottom: 8 }} />}
                  </Field>
                  <div className="row gap-2">
                    {/* Bare '…' dropped ~90px of button width mid-press and the
                        row reflowed under the finger. Verb + ellipsis instead. */}
                    {/* §11.9 state 11: a rejection needs a note, and the
                        button said so only by being grey. */}
                    <GatedButton onClick={() => handleRejectPost(post.postId)} disabled={approvingPost === post.postId} reason={rejectionNote.trim() ? null : 'write a reason first - the author sees it.'} aria-busy={approvingPost === post.postId} className="btn btn-tomato btn-sm">
                      {approvingPost === post.postId ? 'rejecting…' : 'confirm reject'}
                    </GatedButton>
                    <button onClick={() => { setRejectingPost(null); setRejectionNote('') }} className="btn btn-sm">cancel</button>
                  </div>
                </div>
              ) : (
                <div className="row gap-2" style={{ paddingTop: 10, borderTop: '1px dashed var(--line)' }}>
                  <button onClick={() => handleApprovePost(post.postId)} disabled={approvingPost === post.postId} aria-busy={approvingPost === post.postId} className="btn btn-sm btn-primary">
                    {approvingPost === post.postId ? 'approving…' : '✓ approve'}
                  </button>
                  <button onClick={() => setRejectingPost(post.postId)} className="btn btn-sm" style={{ color: 'var(--danger)' }}>✕ reject</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 28 }}>all caught up.</div>
          <p className="muted" style={{ marginTop: 8 }}>no posts waiting for review.</p>
        </div>
      )}
    </>
  )
}
