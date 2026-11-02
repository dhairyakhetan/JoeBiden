// Split out of TeamDetailPage.tsx's 'members' tab body. The member-actions
// dropdown menu itself stays a portal rendered by the parent shell
// (TeamDetailPage.tsx) since it needs to escape this tab's DOM position -
// this component only owns the row list and opens the menu via the
// setters/refs passed down from the parent.
import Img from '../../components/Img'
import { Link } from 'react-router-dom'
import { TeamDetails } from '../../services/teamService'
import { I } from '../../components/v6Shared'
import { initials } from './shared'
import { profilePath } from '../../lib/profilePath'
import { leadersFirst, isTeamLeader } from './leadership'
import { getRoleLabel, getRoleClass } from '../../lib/roles'

export default function MembersTab({
  team, currentMember, canManageMembers, catColor, isMobile,
  onAddMember, onViewOpenings,
  memberMenuOpen, setMemberMenuOpen, setMenuPosition, menuButtonRefs,
}: {
  team: TeamDetails
  currentMember: { uuid?: string } | null | undefined
  canManageMembers: boolean
  catColor: string
  isMobile: boolean
  onAddMember: () => void
  /** 05.3 empty state: "no members -> link to the openings" - switches the
      parent shell to the Openings tab rather than a route change. */
  onViewOpenings: () => void
  memberMenuOpen: number | null
  setMemberMenuOpen: (v: number | null) => void
  setMenuPosition: (v: { top: number; left: number } | null) => void
  menuButtonRefs: React.MutableRefObject<Map<number, HTMLButtonElement>>
}) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div className="row" style={{ padding: isMobile ? '14px 16px' : 20, justifyContent: 'space-between', borderBottom: 'var(--hair-2)' }}>
        <h2 className="h-display" style={{ fontSize: isMobile ? 22 : 28 }}>members</h2>
        {canManageMembers && (
          <button onClick={onAddMember} className="btn btn-sm btn-primary">
            <I.plus /> {isMobile ? 'ADD' : 'ADD MEMBER'}
          </button>
        )}
      </div>
      {team.members && team.members.length > 0 ? (
        leadersFirst(team.members).map((member, i) => (
          <div
            key={member.uuid}
            // HoDs and Directors are highlighted (HR ask 2026-10-03): listed first
            // and set on a tint of the team's own colour, with a thick leading edge.
            data-leader={isTeamLeader(member) ? 'true' : undefined}
            style={{
              padding: isMobile ? '14px 16px' : 16, display: 'grid',
              gridTemplateColumns: isMobile ? 'auto 1fr auto' : 'auto 1fr auto auto',
              gap: isMobile ? 12 : 16, alignItems: 'center', minHeight: isMobile ? 64 : 52,
              borderBottom: i < team.members!.length - 1 ? '1px dashed var(--line)' : 'none',
              ...(isTeamLeader(member)
                ? { background: `color-mix(in srgb, ${catColor} 14%, var(--card))`, boxShadow: `inset 4px 0 0 ${catColor}` }
                : null),
            }}
          >
            <Link to={profilePath(currentMember?.uuid, member.uuid)} aria-label={`${member.fullName}'s profile`} style={{ textDecoration: 'none', display: 'flex' }}>
              <div className="avatar" style={{ background: catColor, overflow: 'hidden' }}>
                {member.avatarUrl ? <Img ctx="avatar" src={member.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : initials(member.fullName)}
              </div>
            </Link>
            <div>
              <Link to={profilePath(currentMember?.uuid, member.uuid)} style={{ fontWeight: 700, fontSize: 16, color: 'inherit', textDecoration: 'none' }}>{member.fullName}</Link>
              {/* Item 5.6. This line used to repeat the role label that the
                  chip immediately to its right already shows - the same fact
                  twice, in one row. The sub-team goes here instead when there
                  is one, which since the 2026-09-10 roster backfill is 88 of
                  123 memberships across 11 sub-teams (Welfare's 62 people
                  span 8 of them). Falls back to the org-wide role label when
                  a team has no sub-teams, so nothing goes blank. No height
                  change. */}
              <div className="mono small muted">
                {member.subTeam || getRoleLabel(member.orgRole)}
              </div>
            </div>
            {/* Org-wide role (member/hod/director/hr/super_admin) — team_members.role
                itself is forced to 'member' since the 2026-09-15 lead-role
                retirement, so it no longer carries any leadership signal. */}
            <span className={'role ' + getRoleClass(member.orgRole)}>
              {getRoleLabel(member.orgRole)}
            </span>
            {canManageMembers && member.uuid !== currentMember?.uuid && (
              <div style={{ position: 'relative' }}>
                <button
                  ref={el => { if (el) menuButtonRefs.current.set(member.memberId, el) }}
                  className="btn btn-icon btn-sm"
                  onClick={() => {
                    if (memberMenuOpen === member.memberId) { setMemberMenuOpen(null); setMenuPosition(null); return }
                    const button = menuButtonRefs.current.get(member.memberId)
                    if (button) {
                      const rect = button.getBoundingClientRect()
                      const mw = 180, mh = 160
                      let left = rect.right - mw, top = rect.bottom + 4
                      if (top + mh > window.innerHeight) top = rect.top - mh - 4
                      if (left < 8) left = 8
                      setMenuPosition({ top, left })
                    }
                    setMemberMenuOpen(member.memberId)
                  }}
                  aria-label="Member options"
                >
                  <I.more />
                </button>
              </div>
            )}
          </div>
        ))
      ) : (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ fontStyle: 'italic', color: 'var(--ink-3)', marginBottom: 10 }}>no members yet.</div>
          <button className="btn btn-sm" onClick={onViewOpenings}>see openings →</button>
        </div>
      )}
    </div>
  )
}
