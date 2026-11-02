// Split out of TeamDetailPage.tsx's 'about' tab body. Pure presentational
// component - all data/loading state comes from the parent shell, which
// still owns every fetch (gated tabs fetch on activation, not on mount -
// this component just renders whatever the parent has already fetched).
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Img from '../../components/Img'
import teamService, { TeamDetails } from '../../services/teamService'
import RelatedTicker, { RelatedTickerItem } from '../../components/RelatedTicker'
import FeedPostCard from '../../feed/FeedPostCard'
import { feedItemFromPost } from '../../feed/feedItemFromPost'
import { shapeFeed } from '../../lib/feedShape'
import { Post } from '../../services/api'
import { initials, isAlwaysOpen, type TeamOpening } from './shared'
import { hasLeaderAccess, getRoleLabel } from '../../lib/roles'
import MomLemonCard from '../../components/MomLemonCard'
import type { MemberOfMonthPick } from '../../services/memberOfMonthService'

export default function AboutTab({
  team, catColor, isMobile,
  bannerOk,
  aboutTickerItems,
  teamPosts, teamPostsLoading, teamPostsError, teamPostsSavedSet, teamPostsOpenings,
  teamProjectsLoading,
  currentMoMs,
  openings, openingsLoading, canApply, onRequestJoin, onSeeOpenings,
  isTeamMember, onCompose,
}: {
  team: TeamDetails
  catColor: string
  isMobile: boolean
  bannerOk: boolean
  aboutTickerItems: RelatedTickerItem[]
  teamPosts: Post[]
  teamPostsLoading: boolean
  /** The fetch failed, as opposed to the team having no posts. */
  teamPostsError?: boolean
  teamPostsSavedSet: Set<number>
  teamPostsOpenings: Map<string, any>
  teamProjectsLoading: boolean
  /** This team's current (month-started) Member of the Month picks. A team
   *  can honour several members in a month (2026-10-03), so this is a list.
   *  2026-09-14, social-system IA audit: MoM is team-scoped in the data
   *  model but previously never surfaced on the team's own page. */
  currentMoMs?: MemberOfMonthPick[]
  /** For the permanent "open roles" section (2026-10-03). */
  openings: TeamOpening[]
  openingsLoading: boolean
  /** The viewer can ask to join this team right now. */
  canApply: boolean
  onRequestJoin: () => void
  onSeeOpenings: () => void
  /** 05.3 empty state: "no posts -> the composer if you are a member." */
  isTeamMember: boolean
  onCompose: () => void
}) {
  const { isAuthenticated } = useAuth()
  // Section 10 mount, this page: a team's recent-posts strip is a small,
  // curated, multi-author list, not a long chronological feed - plain
  // shapeFeed() only, no composeFeed author-collapse.
  const shapeDecisions = useMemo(
    () => shapeFeed(teamPosts.map(p => feedItemFromPost(p, ''))),
    [teamPosts],
  )

  // Departments that sit inside this one (Marketing holds Social Media) are listed with its own
  // sub-departments, as one list (report 07b32d75). They keep their own page, so they link to it.
  const insideItems = useMemo(() => [
    ...(team.childTeams || []).map(c => ({ key: c.uuid, to: `/teams/${c.uuid}`, name: c.name, description: undefined as string | undefined, memberCount: c.memberCount })),
    ...(team.subTeams || []).map(st => ({ key: st.uuid, to: `/teams/${team.uuid}/sub/${st.slug}`, name: st.name, description: st.description, memberCount: st.memberCount })),
  ], [team.childTeams, team.subTeams, team.uuid])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Activity ticker - a scrolling strip of this team's recent posts
          and the projects it ran, so the About tab opens on "here's what
          we're doing" before "here's what we say we do". Hidden while
          loading (no layout jump) and hidden entirely if there's simply
          nothing to show yet. */}
      {!teamPostsLoading && !teamProjectsLoading && aboutTickerItems.length > 0 && (
        <RelatedTicker items={aboutTickerItems} ariaLabel={`${team.name}'s recent posts and projects`} />
      )}

      {/* Team banner art (optional, per-team) — wide scrapbook-style
          header image. Goes through Img/sized so we never ship the
          full-resolution original for a banner slot. */}
      {team.bannerUrl && bannerOk && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <Img
            ctx="cover"
            src={team.bannerUrl}
            alt={`${team.name}, team banner`}
            eager
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      )}

      {/* Main description card */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Solid catColor fill removed 2026-09-08: this was the only section
            header on this tab with a color fill - "what you'll build here"
            and "team leads" both use a plain ground + a plain ink border, no
            fill. Matched that exact treatment so the three read as one
            family instead of one standing out. */}
        <div style={{ padding: '20px 24px', borderBottom: 'var(--hair-2)' }}>
          <div className="mono xs upper" style={{ fontWeight: 800, letterSpacing: '0.06em', color: 'var(--ink-2)' }}>what we do</div>
        </div>
        <div style={{ padding: '24px 24px 20px' }}>
          {team.description
            ? <p style={{ fontFamily: 'var(--eina)', fontSize: 16, lineHeight: 1.78, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', margin: 0 }}>{team.description}</p>
            : <p style={{ fontStyle: 'italic', color: 'var(--ink-3)', margin: 0 }}>No description provided yet.</p>
          }
        </div>
      </div>

      {/* SUB-DEPARTMENTS.
          Added 2026-09-18. The About-page org chart could already drill from a
          department into a sub-department, but once you were ON the department
          page there was no sign the sub-departments existed and no way to reach
          them without going back to /about. This closes that loop: the chart,
          this card and /teams/:uuid/sub/:slug now form one path in both
          directions.
          Real <Link>s, so they are crawlable and middle-clickable - the org
          chart's own nodes were <button onClick={navigate}> until the same
          audit, which left 25 live pages with no inbound link anywhere. */}
      {/* HIERARCHY. A department can sit inside another (Marketing holds Social
          Media and Digital Magazine). Real links both ways, like the sub-team card. */}
      {team.parent && (
        <p className="mono xs" style={{ margin: 0, color: 'var(--ink-3)' }}>
          part of <Link to={`/teams/${team.parent.uuid}`} style={{ color: 'var(--ink)', fontWeight: 700 }}>{team.parent.name}</Link>
        </p>
      )}
      {insideItems.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: 'var(--hair-2)' }}>
            <div className="mono xs upper" style={{ fontWeight: 800, letterSpacing: '0.06em', color: 'var(--ink-2)' }}>
              inside this department
            </div>
          </div>
          <div style={{ padding: '18px 24px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insideItems.map(st => (
              <Link
                key={st.key}
                to={st.to}
                className="tdt-subteam-link"
                style={{ borderLeft: `3px solid ${catColor}` }}
              >
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span style={{ fontFamily: 'var(--eina)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>
                    {st.name}
                  </span>
                  {st.description && (
                    <span className="truncate-2" style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                      {st.description}
                    </span>
                  )}
                </span>
                <span className="mono xs" style={{ color: 'var(--ink-3)', flex: 'none', whiteSpace: 'nowrap' }}>
                  {st.memberCount > 0 ? `${st.memberCount} ${st.memberCount === 1 ? 'member' : 'members'}` : 'open'} →
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* What you'll learn — the concrete skills a member builds on this
          team. Numbered sticker chips in the team's own hue. */}
      {team.skills && team.skills.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: 'var(--hair-2)' }}>
            <div className="mono xs upper" style={{ fontWeight: 800, letterSpacing: '0.06em', color: 'var(--ink-2)' }}>
              what you'll build here
            </div>
          </div>
          <div style={{ padding: '20px 24px 22px', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {team.skills.map((skill, i) => (
              <span
                key={skill}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 15px 9px 11px',
                  border: 'var(--hair-2)',
                  borderRadius: 999,
                  background: 'var(--card)',
                  boxShadow: 'var(--lift-1)',
                  fontFamily: 'var(--display)', fontWeight: 700, fontSize: 14,
                  color: 'var(--ink)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 20, height: 20, borderRadius: 999, flexShrink: 0,
                    background: catColor, color: '#0A0A0A',
                    display: 'grid', placeItems: 'center',
                    fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 800,
                  }}
                >{i + 1}</span>
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="team-detail-stats-grid" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: isMobile ? 10 : 14 }}>
        {[
          { label: 'Members', value: team.memberCount || 0 },
          { label: 'Category', value: teamService.getCategoryLabel(team.category) || 'Team' },
          { label: 'Status', value: 'Active' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: isMobile ? '14px 12px' : '18px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: isMobile ? 22 : 28, lineHeight: 1, color: catColor, fontVariantNumeric: 'tabular-nums' }}>{stat.value}</div>
            <div className="mono xs muted" style={{ marginTop: isMobile ? 4 : 6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Department leadership — org-wide role (hod/director/hr/super_admin),
          not team_members.role, which is forced to 'member' only since the
          2026-09-15 lead-role retirement (scripts/retire_lead_role_2026_09_15.sql)
          and so no longer carries any leadership signal of its own. */}
      {team.members && team.members.some((m: any) => hasLeaderAccess(m.orgRole)) && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="mono xs upper" style={{ fontWeight: 800, letterSpacing: '0.06em', color: 'var(--ink-2)' }}>leadership</div>
          </div>
          {team.members.filter((m: any) => hasLeaderAccess(m.orgRole)).map((lead: any, i: number, arr: any[]) => (
            <div key={lead.uuid} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: i < arr.length - 1 ? '1px dashed var(--line)' : 'none' }}>
              {/* The people who run a team are the first people a newcomer wants to reach: link them to their profiles. */}
              <Link to={`/member/${lead.uuid}`} style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                <div className="avatar" style={{ background: catColor, overflow: 'hidden', width: 42, height: 42, fontSize: 14, flexShrink: 0 }}>
                  {lead.avatarUrl ? <Img ctx="avatar" src={lead.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" /> : initials(lead.fullName)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{lead.fullName}</div>
                  <div className="mono xs muted">{getRoleLabel(lead.orgRole)}</div>
                </div>
              </Link>
              <span className="role role-director" style={{ fontSize: 10, background: catColor, color: '#0A0A0A', borderColor: catColor }}>
                {getRoleLabel(lead.orgRole).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* This team's current Member of the Month - the same card the home
          rail and the winner's own profile use, so it's one card, not a
          second fork of it (see MomLemonCard's own header comment). */}
      {currentMoMs && currentMoMs.length > 0 && (
        <div>
          <h2 className="h-display" style={{ fontSize: isMobile ? 20 : 24, marginBottom: 14 }}>
            {currentMoMs.length > 1 ? 'members of the month' : 'member of the month'}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {currentMoMs.map(m => <MomLemonCard key={m.id} mom={m} />)}
          </div>
        </div>
      )}

      {/* Open roles - always present (2026-10-03, HR ask: "a permanently open
          roles section"). Standing roles are open roles with no deadline, so
          they never expire; when a team has none listed the section still
          shows, saying so honestly and offering the way in. Hidden only
          while the openings load, so it never flashes the empty wording. */}
      {!openingsLoading && (() => {
        const standing = openings.filter(isAlwaysOpen)
        const deadlined = openings.filter(o => o.status === 'open' && !!o.deadline)
        return (
          <section aria-labelledby="about-open-roles">
            <h2 id="about-open-roles" className="h-display" style={{ fontSize: isMobile ? 20 : 24, marginBottom: 14 }}>open roles</h2>
            <div className="card" style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {standing.length > 0 ? (
                <>
                  <p className="muted" style={{ margin: 0 }}>always open: no deadline, apply any time.</p>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {standing.map(op => (
                      <li key={op.id}>
                        <Link to={`/opportunities/${op.id}?apply=1`} style={{ fontWeight: 700 }}>{op.title}</Link>
                        {op.commitment ? <span className="muted"> · {op.commitment}</span> : null}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted" style={{ margin: 0 }}>
                  {deadlined.length > 0
                    ? 'no always-open role is listed for this team. There are roles with a deadline.'
                    : `no specific role is listed for ${team.name} right now, but people who show up and help are always welcome.`}
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {deadlined.length > 0 && (
                  <button type="button" className="btn btn-sm" onClick={onSeeOpenings}>
                    see {deadlined.length} open {deadlined.length === 1 ? 'role' : 'roles'}
                  </button>
                )}
                {canApply && (
                  <button type="button" className="btn btn-sm btn-primary" onClick={onRequestJoin}>
                    ask to join {team.name}
                  </button>
                )}
                {/* A signed-out visitor read "people who show up and help are always welcome" and was offered nothing. */}
                {!isAuthenticated && (
                  <Link to="/login" state={{ from: { pathname: `/teams/${team.uuid}` } }} className="btn btn-sm btn-primary" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center' }}>
                    sign in to join {team.name}
                  </Link>
                )}
              </div>
            </div>
          </section>
        )
      })()}

      {/* Team posts */}
      <div>
        <h2 className="h-display" style={{ fontSize: isMobile ? 20 : 24, marginBottom: 14 }}>recent posts</h2>
        {teamPostsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-hidden="true">
            {[1, 2].map(i => (
              <div key={i} className="card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div className="v6-skeleton sk-circle" style={{ width: 36, height: 36, animationDelay: `${i * 0.08}s` }} />
                  <div style={{ flex: 1 }}>
                    <div className="v6-skeleton" style={{ width: 130, height: 13, marginBottom: 6 }} />
                    <div className="v6-skeleton" style={{ width: 80, height: 10 }} />
                  </div>
                </div>
                <div className="v6-skeleton" style={{ width: '92%', height: 13, marginBottom: 8 }} />
                <div className="v6-skeleton" style={{ width: '70%', height: 13 }} />
              </div>
            ))}
          </div>
        ) : teamPostsError && teamPosts.length === 0 ? (
          // A failed load is not an empty team. "no posts from this team yet"
          // is a claim about the team; this is a claim about the network.
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>couldn’t load this team’s posts.</div>
            <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>That’s a connection problem, not an empty team.</div>
          </div>
        ) : teamPosts.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontStyle: 'italic', color: 'var(--ink-3)', marginBottom: isTeamMember ? 12 : 0 }}>no posts from this team yet.</div>
            {isTeamMember && (
              // Reuses the hero's own "create post" label (same action,
              // same modal) rather than inventing a second string for it.
              <button className="btn btn-sm btn-primary" onClick={onCompose}>✎ create post</button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {teamPosts.map((post, i) => (
              // Unified on FeedPostCard (the token-migrated card every other
              // route uses). FeedPostCard has no inline-delete callback -
              // deletion happens on the post detail page, matching app-wide
              // behaviour - so the old onDelete prop is intentionally dropped.
              <FeedPostCard
                key={post.uuid}
                post={post}
                seed={i}
                savedInitial={teamPostsSavedSet.has(post.postId)}
                linkedOpening={teamPostsOpenings.get(post.uuid) ?? null}
                decision={shapeDecisions[i]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
