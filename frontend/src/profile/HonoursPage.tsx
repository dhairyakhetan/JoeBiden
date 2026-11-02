import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Img from '../components/Img'
import { useMeta } from '../hooks/useMeta'
import { getInitials, hashColor } from '../lib/uiHelpers'
import { profilePath } from '../lib/profilePath'
import memberOfMonthService, { formatPeriod, type MemberOfMonthPick } from '../services/memberOfMonthService'

/**
 * /honours: every Member of the Month ever announced, newest month first. Until now recognition lived only on the current
 * month's rail card and on one team's About tab, so last month's winner vanished. Each pick links to the person, to
 * their team and to their wall (to congratulate them), so recognition leads into the rest of the network instead of ending.
 * Signed-in members only. Future-dated picks are hidden by the database (mom_select), so nothing unannounced can show.
 */
export default function HonoursPage() {
  useMeta({ title: 'Honours | AquaTerra', description: 'Everyone AquaTerra has recognised as Member of the Month.', path: '/honours', noIndex: true })
  const { member } = useAuth()
  const [picks, setPicks] = useState<MemberOfMonthPick[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    memberOfMonthService.list(120).then(r => { if (live) setPicks(r) }).catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [])

  const months = useMemo(() => {
    const by = new Map<string, MemberOfMonthPick[]>()
    for (const p of picks ?? []) by.set(p.period, [...(by.get(p.period) ?? []), p])
    return [...by.entries()] // list() is already newest month first
  }, [picks])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '8px 0 40px' }}>
      <div className="mono xs upper muted" style={{ fontWeight: 800, letterSpacing: '0.08em' }}>★ honours</div>
      <h1 className="h-display" style={{ fontSize: 36, margin: '6px 0 6px' }}>the people we’re proud of.</h1>
      <p className="muted" style={{ margin: '0 0 24px', maxWidth: 560 }}>
        Every Member of the Month, by team, month by month. Say congratulations on their wall.
      </p>

      {picks === null && !failed && <div className="mono xs muted">loading…</div>}
      {failed && <div className="mono xs muted">couldn’t load the honours. try again in a moment.</div>}
      {picks && picks.length === 0 && (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <div className="h-display" style={{ fontSize: 22 }}>no one has been honoured yet.</div>
          <p className="muted" style={{ margin: '8px 0 0' }}>The first picks will show up here the day their month begins.</p>
        </div>
      )}

      {months.map(([period, list]) => (
        <section key={period} style={{ marginBottom: 28 }} aria-label={formatPeriod(period)}>
          <h2 className="mono xs upper" style={{ fontWeight: 800, letterSpacing: '0.08em', color: 'var(--ink-2)', margin: '0 0 10px' }}>{formatPeriod(period)}</h2>
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 340px), 1fr))' }}>
            {list.map(p => {
              const isMe = member?.uuid === p.memberUuid
              const photo = p.photoUrl || p.memberAvatarUrl
              return (
                <article key={p.id} className="card" style={{ padding: 16, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <Link to={profilePath(member?.uuid, p.memberUuid)} aria-label={`${p.memberName}'s profile`} style={{ flex: 'none', textDecoration: 'none' }}>
                    <span className="avatar" style={{ width: 64, height: 64, fontSize: 20, background: hashColor(p.memberName), overflow: 'hidden', display: 'block' }}>
                      {photo
                        ? <Img ctx="card" src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
                        : getInitials(p.memberName)}
                    </span>
                  </Link>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Link to={profilePath(member?.uuid, p.memberUuid)} style={{ fontFamily: 'var(--display)', fontWeight: 900, fontSize: 19, letterSpacing: '-0.02em', color: 'inherit', textDecoration: 'none' }}>
                      {p.memberName}
                    </Link>
                    <div style={{ marginTop: 4 }}>
                      <Link to={`/teams/${p.teamUuid}`} className="pf-chip" style={{ textDecoration: 'none' }}>{p.teamName}</Link>
                    </div>
                    {p.citation && <p style={{ margin: '10px 0 0', fontFamily: 'var(--eina)', fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)' }}>{p.citation}</p>}
                    {!isMe && (
                      <Link to={`/member/${p.memberUuid}?tab=wall`} className="btn btn-sm btn-ghost" style={{ minHeight: 44, marginTop: 8, display: 'inline-flex', alignItems: 'center' }}>
                        say congratulations →
                      </Link>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
