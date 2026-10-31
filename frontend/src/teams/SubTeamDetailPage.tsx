// The "own little section" a sub-department gets when clicked from the
// About-page org chart or a team's Members tab: its own description, its own
// roster, and every published post tagged specifically to it (not just to
// its parent team). See sub_teams_hierarchy_2026_09_17.sql.
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Img from '../components/Img'
import teamService, { SubTeam, TeamDetails, TeamMember } from '../services/teamService'
import { deptColorForTeamName, isDarkDepartmentFill } from '../lib/departments'
import { Post } from '../services/api'
import FeedPostCard from '../feed/FeedPostCard'
import { feedItemFromPost } from '../feed/feedItemFromPost'
import { shapeFeed } from '../lib/feedShape'
import { useFeedCardBatch } from '../hooks/useFeedCardBatch'
import { initials } from './detail/shared'
import { getRoleLabel, getRoleClass } from '../lib/roles'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { useIsMobile } from '../hooks/useMobile'
import { useAuth } from '../auth/AuthContext'
import { useCan } from '../auth/CapabilityContext'
import { hasLeaderAccess, isSuperAdmin as isSuperAdminRole } from '../lib/roles'
import AddMemberModal from './AddMemberModal'

export default function SubTeamDetailPage() {
  const { uuid, slug } = useParams<{ uuid: string; slug: string }>()
  const isMobile = useIsMobile()
  const [team, setTeam] = useState<TeamDetails | null>(null)
  const [subTeam, setSubTeam] = useState<SubTeam | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  // Same gate as the Members tab on the parent team: HoDs, directors and super admins, narrowed by the
  // /director/roles capability. The database (`is_director()`) is still what decides what is accepted.
  const { member: currentMember } = useAuth()
  const canManageRoster = useCan('action.manage_team_roster')
  const canAddMembers = canManageRoster && (isSuperAdminRole(currentMember?.role) || hasLeaderAccess(currentMember?.role))

  useEffect(() => {
    if (!uuid || !slug) return
    let cancelled = false
    setIsLoading(true)
    setNotFound(false)

    ;(async () => {
      try {
        const [{ data: teamData }, sub] = await Promise.all([
          teamService.getTeam(uuid),
          teamService.getSubTeam(uuid, slug),
        ])
        if (cancelled) return
        if (!sub) { setNotFound(true); setIsLoading(false); return }
        setTeam(teamData.team)
        setSubTeam(sub)

        const [subMembers, subPosts] = await Promise.all([
          teamService.getSubTeamMembers(sub.uuid),
          teamService.getTeamPosts(uuid, 20, sub.uuid),
        ])
        if (cancelled) return
        setMembers(subMembers)
        setPosts(subPosts)
      } catch {
        if (!cancelled) setNotFound(true)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [uuid, slug])

  const reloadMembers = async () => {
    if (!subTeam) return
    try { setMembers(await teamService.getSubTeamMembers(subTeam.uuid)) } catch { /* the list keeps its last value */ }
  }

  const catColor = deptColorForTeamName(team?.name) || 'var(--teal)'
  const darkFill = isDarkDepartmentFill(catColor)

  const { savedSet, openings } = useFeedCardBatch(posts)
  const shapeDecisions = useMemo(
    () => shapeFeed(posts.map(p => feedItemFromPost(p, ''))),
    [posts],
  )

  // MUST MATCH scripts/prerender-meta.mjs's sub-team family exactly. The
  // prerenderer builds the same two strings from the same columns, and if the
  // shapes drift this route serves one title to a crawler that does not run JS
  // and a different one to everything else - the defect that was live on
  // /directory, /labs and /join until the 2026-09-17 audit.
  // The separator is a middot, not an em dash, matching the rest of the site's
  // titles (and the project's no-em-dash rule for copy we write).
  useMeta({
    title: subTeam && team ? `${subTeam.name} · ${team.name} | AquaTerra` : 'Sub-team | AquaTerra',
    description: subTeam?.description
      || (team && subTeam ? `${subTeam.name}, a sub-team within AquaTerra's ${team.name}, in Kolkata.` : undefined),
  })
  useJsonLd('subteam-breadcrumb', subTeam && team ? breadcrumbLd([
    ['Home', '/'], ['About', '/about'], [team.name, `/teams/${team.uuid}`], [subTeam.name, `/teams/${team.uuid}/sub/${subTeam.slug}`],
  ]) : null)

  if (isLoading) {
    return (
      <div className="page-container route-enter" style={{ maxWidth: 760, margin: '0 auto', padding: '32px 16px' }}>
        <div className="v6-skeleton" style={{ height: 32, width: 220, marginBottom: 20 }} />
        <div className="v6-skeleton" style={{ height: 120, marginBottom: 20 }} />
      </div>
    )
  }

  if (notFound || !team || !subTeam) {
    return (
      <div className="page-container route-enter" style={{ maxWidth: 760, margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}>
        <p style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>Couldn't find that sub-team.</p>
        <Link to="/about" className="btn btn-sm" style={{ marginTop: 12 }}>back to About AquaTerra</Link>
      </div>
    )
  }

  return (
    <div className="page-container route-enter" style={{ maxWidth: 760, margin: '0 auto', padding: isMobile ? '20px 16px 60px' : '32px 16px 80px' }}>
      <div className="mono xs upper" style={{ marginBottom: 10, color: 'var(--ink-3)' }}>
        <Link to="/about" style={{ color: 'inherit' }}>About</Link>
        {' / '}
        <Link to={`/teams/${team.uuid}`} style={{ color: 'inherit' }}>{team.name}</Link>
        {' / '}
        <span style={{ color: 'var(--ink)' }}>{subTeam.name}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <span
          className="mono xs upper"
          style={{
            padding: '3px 10px', borderRadius: 999, border: 'var(--hair-2)',
            background: catColor, color: darkFill ? 'var(--paper, #fff)' : 'var(--ink)',
            fontWeight: 800,
          }}
        >
          {team.name}
        </span>
      </div>

      <h1 className="h-display" style={{ fontSize: isMobile ? 30 : 40, marginBottom: 16 }}>{subTeam.name}</h1>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '20px 24px 22px' }}>
          {subTeam.description
            ? <p style={{ fontFamily: 'var(--eina)', fontSize: 16, lineHeight: 1.78, color: 'var(--ink-2)', margin: 0 }}>{subTeam.description}</p>
            : <p style={{ fontStyle: 'italic', color: 'var(--ink-3)', margin: 0 }}>No description yet.</p>
          }
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
        <div className="row" style={{ padding: isMobile ? '14px 16px' : 20, justifyContent: 'space-between', borderBottom: 'var(--hair-2)' }}>
          <h2 className="h-display" style={{ fontSize: isMobile ? 20 : 24 }}>members</h2>
          <div className="row" style={{ gap: 12 }}>
            <span className="mono xs muted">{members.length}</span>
            {canAddMembers && (
              <button onClick={() => setShowAddMember(true)} className="btn btn-sm btn-primary">
                {isMobile ? 'ADD' : 'ADD MEMBER'}
              </button>
            )}
          </div>
        </div>
        {members.length > 0 ? (
          members.map((member, i) => (
            <div
              key={member.uuid}
              style={{
                padding: isMobile ? '14px 16px' : 16, display: 'grid',
                gridTemplateColumns: 'auto 1fr auto', gap: isMobile ? 12 : 16, alignItems: 'center',
                borderBottom: i < members.length - 1 ? '1px dashed var(--line)' : 'none',
              }}
            >
              <Link to={`/profile/${member.uuid}`} style={{ textDecoration: 'none', display: 'flex' }}>
                <div className="avatar" style={{ background: catColor, overflow: 'hidden' }}>
                  {member.avatarUrl
                    ? <Img ctx="avatar" src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                    : initials(member.fullName)}
                </div>
              </Link>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{member.fullName}</div>
              </div>
              <span className={'role ' + getRoleClass(member.orgRole)}>{getRoleLabel(member.orgRole)}</span>
            </div>
          ))
        ) : (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>no members assigned to this sub-team yet.</div>
          </div>
        )}
      </div>

      <AddMemberModal
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        onSuccess={reloadMembers}
        teamUuid={team.uuid}
        existingMemberIds={members.map(m => m.memberId)}
        subTeam={{ uuid: subTeam.uuid, name: subTeam.name }}
      />

      <h2 className="h-display" style={{ fontSize: isMobile ? 20 : 24, marginBottom: 14 }}>posts tagged {subTeam.name}</h2>
      {posts.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>no posts tagged to this sub-team yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {posts.map((post, i) => (
            <FeedPostCard
              key={post.uuid}
              post={post}
              seed={i}
              savedInitial={savedSet.has(post.postId)}
              linkedOpening={openings.get(post.uuid) ?? null}
              decision={shapeDecisions[i]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
