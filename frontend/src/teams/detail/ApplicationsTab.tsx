// Split out of TeamDetailPage.tsx's 'applications' tab body - leader-only
// queue of `team_join_requests` (people asking to join this team, separate
// from job_openings applicants - see ResponsesTab for those).
import Img from '../../components/Img'
import { Link } from 'react-router-dom'
import { JoinRequest } from '../../services/teamService'
import { initials } from './shared'

export default function ApplicationsTab({
  joinRequests, joinRequestsLoading, joinRequestsError, setJoinRequestsError,
  processingRequest, catColor, isMobile,
  handleApproveJoinRequest, handleRejectJoinRequest,
}: {
  joinRequests: JoinRequest[]
  joinRequestsLoading: boolean
  joinRequestsError: string | null
  setJoinRequestsError: (v: string | null) => void
  processingRequest: string | null
  catColor: string
  isMobile: boolean
  handleApproveJoinRequest: (uuid: string) => void
  handleRejectJoinRequest: (uuid: string) => void
}) {
  return (
    <>
      {joinRequestsError && (
        <div role="alert" className="card" style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(224,92,92,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--danger)', fontSize: 13 }}>{joinRequestsError}</span>
          {/* Was an unlabelled ~16x19 target announced as "multiplication x". */}
          <button onClick={() => setJoinRequestsError(null)} aria-label="Dismiss error" style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', minWidth: 44, minHeight: 44, margin: '-13px -14px -13px 0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}
      {joinRequestsLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-hidden="true">
          {[1, 2].map(i => (
            <div key={i} className="card" style={{ padding: isMobile ? 14 : 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 10 : 14 }}>
                <div className="v6-skeleton sk-circle" style={{ width: 40, height: 40, flexShrink: 0, animationDelay: `${i * 0.08}s` }} />
                <div style={{ flex: 1 }}>
                  <div className="v6-skeleton" style={{ width: 150, height: 14, marginBottom: 8 }} />
                  <div className="v6-skeleton" style={{ width: 200, height: 11, marginBottom: 14 }} />
                  <div className="row gap-2">
                    <div className="v6-skeleton sk-pill" style={{ width: 90, height: 30 }} />
                    <div className="v6-skeleton sk-pill" style={{ width: 80, height: 30 }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : joinRequestsError ? null : joinRequests.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {joinRequests.map(req => (
            <div key={req.uuid} className="card" style={{ padding: isMobile ? 14 : 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: isMobile ? 10 : 14 }}>
                <div className="avatar" style={{ background: catColor, overflow: 'hidden', flexShrink: 0 }}>
                  {req.avatarUrl ? <Img ctx="avatar" src={req.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : initials(req.fullName || '?')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row gap-2" style={{ marginBottom: 4, flexWrap: 'wrap' }}>
                    {req.memberUuid
                      ? <Link to={`/profile/${req.memberUuid}`} style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', textDecoration: 'none' }}>{req.fullName}</Link>
                      : <span style={{ fontWeight: 700, fontSize: 15 }}>{req.fullName}</span>
                    }
                    <span className="mono xs muted">{new Date(req.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="mono xs muted" style={{ marginBottom: 10 }}>{req.email}</div>
                  {req.message && (
                    <div className="card" style={{ padding: '8px 12px', marginBottom: 12, fontStyle: 'italic', fontSize: 13, color: 'var(--ink-2)' }}>
                      "{req.message}"
                    </div>
                  )}
                  <div className="row gap-2">
                    <button onClick={() => handleApproveJoinRequest(req.uuid)} disabled={processingRequest === req.uuid} className="btn btn-sm btn-primary">
                      {processingRequest === req.uuid ? '…' : '✓ approve'}
                    </button>
                    <button onClick={() => handleRejectJoinRequest(req.uuid)} disabled={processingRequest === req.uuid} className="btn btn-sm" style={{ color: 'var(--danger)' }}>
                      ✕ decline
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: 60, textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 28 }}>no applications.</div>
          <p className="muted" style={{ marginTop: 8 }}>no pending join requests.</p>
        </div>
      )}
    </>
  )
}
