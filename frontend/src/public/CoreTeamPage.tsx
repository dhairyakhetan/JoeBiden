import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Img from '../components/Img'
import Skeleton from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'
import CoreBadge from '../components/CoreBadge'
import { useAuth } from '../auth/AuthContext'
import { useMeta } from '../hooks/useMeta'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'
import { pageMetadata } from '../lib/metaConfig'
import { getInitials, hashColor } from '../lib/uiHelpers'
import coreMemberService, { type CoreMember } from '../services/coreMemberService'
import './MembersPage.css'

/**
 * /core-team: everyone with the AQ Core badge (bug tracker 081395e9).
 * Public. Same card and the same photo masking as /members: a member who hid
 * their profile shows only their name to a signed-out visitor. HR and super
 * admin keep the list on the HoD desk's Members desk.
 */
export default function CoreTeamPage() {
  useMeta(pageMetadata.coreTeam)
  useJsonLd('core-team-breadcrumb', breadcrumbLd([['Home', '/'], ['Members', '/members'], ['AQ Core', '/core-team']]))
  const { member: currentMember } = useAuth()
  const [list, setList] = useState<CoreMember[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let live = true
    coreMemberService.getCoreTeam()
      .then(rows => { if (live) { setError(null); setList(rows) } })
      .catch(e => {
        console.error('[CoreTeamPage] load failed:', e)
        if (live) { setError("we couldn't load the core team."); setList([]) }
      })
    return () => { live = false }
  }, [reload])

  const profilePath = (uuid: string) => currentMember?.uuid === uuid ? `/profile/${uuid}` : `/member/${uuid}`

  return (
    <div className="route-enter">
      <section className="mem-hero">
        <div className="container">
          <CoreBadge size="md" />
          <h1 className="h-display mem-h1">
            the <span className="underline-doodle mem-h1-serif">core</span> team.
          </h1>
          <p className="muted mem-total">
            {list && list.length > 0
              ? `${list.length} core member${list.length !== 1 ? 's' : ''}, the people who carry AquaTerra week to week.`
              : 'the people who carry AquaTerra week to week.'}
          </p>
        </div>
      </section>

      <div className="container mem-body">
        {error && <ErrorState message={error} onRetry={() => { setError(null); setList(null); setReload(n => n + 1) }} className="mb-4" />}

        {list === null ? (
          <div className="stag mem-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="block" height="var(--mem-skel-h)" radius={32} />
            ))}
          </div>
        ) : list.length === 0 && !error ? (
          <EmptyState
            title="the core list is being put together."
            hint="check back soon, or meet everyone in the meantime."
            action={<Link to="/members" className="btn btn-primary">all members</Link>}
          />
        ) : (
          <div className="stag mem-grid">
            {list.map(m => (
              <Link key={m.uuid} to={profilePath(m.uuid)} className="card card-hover mem-card">
                <div className="avatar avatar-lg mem-avatar" style={{ background: hashColor(m.fullName) }}>
                  {m.avatarUrl
                    ? <Img ctx="avatar" src={m.avatarUrl} alt="" referrerPolicy="no-referrer" />
                    : getInitials(m.fullName)}
                </div>
                <div className="mem-name">{m.fullName}</div>
                <CoreBadge className="mem-core" />
              </Link>
            ))}
          </div>
        )}

        <Link to="/members" className="mem-exit">
          <span className="mem-exit-h">everyone else</span>
          <span className="mem-exit-p">Every active AquaTerra member, searchable by name.</span>
        </Link>
      </div>
    </div>
  )
}
