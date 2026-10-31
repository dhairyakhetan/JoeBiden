import Img from '../components/Img'
import { useState } from 'react'
import { Achievement } from '../services/api'
import AddAchievementModal from './AddAchievementModal'
import EditAchievementModal from './EditAchievementModal'
import achievementService from '../services/achievementService'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { sized } from '../lib/imageUrl'

// Legacy pending/rejected banner - only ever reachable today for a handful of
// historical rows created before the review desk was retired (2026-09:
// achievementService.createAchievement now sets status:'approved'
// unconditionally). Restyled off its old off-palette hex (#A07700, #0A7548,
// #A93030 - none of them tokens, exactly the "hand-added colours outside the
// palette" bug class UX-GAPS.md documents elsewhere) onto the same 22/30%-tint
// + *-ink formula the rest of 04-profile.md uses.
const STATUS_INFO: Record<Achievement['status'], { label: string; bg: string; fg: string }> = {
  pending:  { label: 'Pending review', bg: 'color-mix(in srgb, var(--lemon) 30%, transparent)', fg: 'var(--lemon-ink)' },
  approved: { label: 'Approved',       bg: 'color-mix(in srgb, var(--welfare) 22%, transparent)', fg: 'var(--welfare-ink)' },
  rejected: { label: 'Rejected',       bg: 'var(--danger-tint)', fg: 'var(--tomato-ink)' },
}

interface AchievementsListProps {
  achievements: Achievement[]
  isLoading: boolean
  isOwn: boolean
  profileName: string
  onRefresh: () => void
}

const ACHIEVEMENT_TYPE_INFO: Record<string, { emoji: string; label: string; color: string }> = {
  // audit-ok: Pop Orange as a badge fill; the row is Pop mixed with tokens.
  leadership:       { emoji: '👑', label: 'Leadership',      color: '#FF7A1A' },
  academic:         { emoji: '📚', label: 'Academic',        color: '#3DA9FC' },
  competition:      { emoji: '🏆', label: 'Competition',     color: '#FFC700' },
  personal_project: { emoji: '💡', label: 'Project',         color: '#7E5BFF' },
  other:            { emoji: '🌟', label: 'Other',           color: 'var(--welfare)' },
}

const formatDateRange = (startDate: string, endDate?: string | null): string => {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
  return `${fmt(startDate)} – ${endDate ? fmt(endDate) : 'Present'}`
}

const AchievementsList = ({ achievements, isLoading, isOwn, profileName, onRefresh }: AchievementsListProps) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)
  const toast = useToast()
  const confirm = useConfirm()

  // Public-facing profile filters down to approved only - pending/rejected
  // are private to the owner. Own profile sees everything with badges.
  const visibleAchievements = isOwn
    ? achievements
    : achievements.filter(a => a.status === 'approved')

  const handleDelete = async (uuid: string) => {
    const ok = await confirm({
      title: 'Delete this achievement?',
      body: 'This removes it from your profile permanently.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    setDeletingId(uuid)
    try {
      await achievementService.deleteAchievement(uuid)
      toast.success('achievement deleted.')
      onRefresh()
    } catch {
      toast.error('couldn’t delete that.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleShare = async (achievement: Achievement) => {
    if (achievement.status !== 'approved') {
      toast.info('Wait for approval first', 'Only approved achievements can be shared to the feed.')
      return
    }
    const ok = await confirm({
      title: 'Share to the feed?',
      body: `"${achievement.title}" will appear as a post on the public feed.`,
      confirmLabel: 'Share',
    })
    if (!ok) return
    setSharingId(achievement.uuid)
    try {
      const result = await achievementService.shareAsPost(achievement.uuid)
      if (result?.success) {
        toast.success('Shared!', 'Your achievement is now on the feed.')
      } else {
        toast.error('Couldn\'t share', 'Try again in a moment.')
      }
    } catch (err: any) {
      toast.error('Couldn\'t share', err?.message ?? 'Try again in a moment.')
    } finally {
      setSharingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="sk-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="v6-skeleton" style={{ height: 180, borderRadius: 'var(--r-inner)' }} />
        ))}
      </div>
    )
  }

  if (visibleAchievements.length === 0) {
    return (
      <>
        <div className="card">
          <div className="pf-empty-well">
            <div style={{ fontSize: 52, marginBottom: 12 }}>🏅</div>
            <div className="h-display" style={{ fontSize: 22, marginBottom: 8 }}>no achievements yet.</div>
            <p style={{ fontFamily: 'var(--eina)', fontSize: 14, color: 'var(--ink-3)', marginBottom: isOwn ? 20 : 0 }}>
              {isOwn
                ? "Showcase your accomplishments: competitions, projects, roles."
                : `${profileName} hasn't added any achievements yet.`}
            </p>
            {isOwn && (
              <button className="btn btn-sm btn-primary" onClick={() => setIsAddModalOpen(true)}>
                + Add achievement
              </button>
            )}
          </div>
        </div>
        {isOwn && (
          <AddAchievementModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onAchievementCreated={onRefresh}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {visibleAchievements.map((achievement) => {
          const info = ACHIEVEMENT_TYPE_INFO[achievement.achievementType] ?? ACHIEVEMENT_TYPE_INFO.other
          const statusInfo = STATUS_INFO[achievement.status] ?? STATUS_INFO.approved
          // Legacy pending/rejected notice - isOwn-only, and only ever
          // reachable for a historical row today (see STATUS_INFO comment).
          const showStatusFlag = isOwn && achievement.status !== 'approved'
          const canShare = isOwn && achievement.status === 'approved'
          const isSharing = sharingId === achievement.uuid

          return (
            <div key={achievement.achievementId} className="card pf-ach-card">
              {/* Cover image - 04.4: r-inner, 16/9, no border/outline. An
                  achievement without a proof image simply skips the cover
                  rather than rendering an empty frame. */}
              {achievement.proofUrl && (
                <div className="pf-ach-cover">
                  <Img
                    src={sized(achievement.proofUrl, 'thumb')}
                    alt={achievement.title}
                    loading="lazy"
                    decoding="async"
                    className="no-long-press"
                  />
                </div>
              )}

              <div className="pf-ach-body">
                <div className="pf-ach-meta">
                  {/* The verification pill - never a stamp, never rotated
                      (04.0 bug 2 / 04.4): an achievement is a claim with a
                      verification state attached, i.e. data. */}
                  {achievement.status === 'approved'
                    ? <span className="pf-verified">verified</span>
                    : <span className="pf-awaiting"><span className="pf-awaiting-dot" aria-hidden="true" />awaiting verification</span>}
                  <span className="pf-ach-date">
                    {info.emoji} {info.label} · {formatDateRange(achievement.achievementDate, achievement.achievementEndDate)}
                  </span>
                </div>

                {/* Legacy pending/rejected flag - see STATUS_INFO comment.
                    Distinct from the verification pill above because
                    "rejected" is a final negative outcome, not "awaiting". */}
                {showStatusFlag && (
                  <div
                    className="pf-ach-flag"
                    style={{ background: statusInfo.bg, color: statusInfo.fg, borderRadius: 'var(--r-inner)', marginBottom: 8 }}
                    title={achievement.status === 'rejected' && achievement.reviewNote ? `Reason: ${achievement.reviewNote}` : undefined}
                  >
                    <span>{achievement.status === 'pending' ? '⏳' : '✕'}</span>
                    <span>{statusInfo.label}</span>
                    {achievement.status === 'rejected' && achievement.reviewNote && (
                      <span style={{ marginLeft: 'auto', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                        - {achievement.reviewNote.slice(0, 40)}{achievement.reviewNote.length > 40 ? '…' : ''}
                      </span>
                    )}
                  </div>
                )}

                <h4 className="pf-ach-title">{achievement.title}</h4>
                {achievement.description && <p className="pf-ach-desc">{achievement.description}</p>}

                {isOwn && (
                  <div className="pf-ach-foot">
                    {/* On an unverified achievement the left slot stays empty
                        (04.4) - the pill above already states the condition,
                        and sharing an unapproved achievement isn't offered. */}
                    {canShare && (
                      <button
                        className="pf-ach-share"
                        onClick={() => handleShare(achievement)}
                        disabled={isSharing}
                        title="Share to feed"
                        aria-label="Share achievement to feed"
                      >
                        {isSharing ? '…' : 'Share to feed'}
                      </button>
                    )}
                    <span style={{ flex: 1 }} />
                    <button
                      className="pf-ach-iconbtn"
                      onClick={() => setEditingAchievement(achievement)}
                      title="Edit"
                      aria-label="Edit achievement"
                    >
                      ✎
                    </button>
                    <button
                      className="pf-ach-iconbtn is-danger"
                      onClick={() => handleDelete(achievement.uuid)}
                      disabled={deletingId === achievement.uuid}
                      title="Delete"
                      aria-label="Delete achievement"
                    >
                      {deletingId === achievement.uuid ? '…' : '✕'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {isOwn && (
        <button className="pf-add-ach" style={{ marginTop: 14 }} onClick={() => setIsAddModalOpen(true)} aria-label="Add achievement">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add an achievement
        </button>
      )}

      {isOwn && (
        <>
          <AddAchievementModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onAchievementCreated={onRefresh}
          />
          {editingAchievement && (
            <EditAchievementModal
              isOpen={!!editingAchievement}
              onClose={() => setEditingAchievement(null)}
              achievement={editingAchievement}
              onAchievementUpdated={onRefresh}
            />
          )}
        </>
      )}
    </>
  )
}

export default AchievementsList
