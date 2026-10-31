import './OpeningsStrip.css'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { jobOpenings, JobOpening } from '../lib/jobOpenings'
import teamService from '../services/teamService'

// Home job-openings priority strip (Phase 10). Full-width, left-to-right
// auto-scrolling chip strip at the top of home - visual language borrowed
// from the Paradox footer marquee pattern (auto-scroll CSS track, ★
// separators), but rebuilt here rather than reusing Paradox's own component,
// since that's out of scope to touch. Each chip deep-links straight into the
// opening's apply flow via the ?opening=<id> param TeamDetailPage already
// understands (Phase 8); now the role page with the form open (?apply=1).
//
// Visible only to a member within their first 2 days post-approval -
// evaluated fresh on every render (not cached at login time), so a member
// who logs in on day 1 and returns on day 3 stops seeing it.
const WINDOW_MS = 2 * 24 * 60 * 60 * 1000

function withinApprovalWindow(approvedAt: string | null | undefined): boolean {
  if (!approvedAt) return false
  const approvedMs = new Date(approvedAt).getTime()
  if (Number.isNaN(approvedMs)) return false
  return Date.now() - approvedMs <= WINDOW_MS
}

export default function OpeningsStrip() {
  const { member } = useAuth()
  const [openings, setOpenings] = useState<JobOpening[]>([])
  const [teamUuidByName, setTeamUuidByName] = useState<Record<string, string>>({})
  const eligible = withinApprovalWindow(member?.approved_at)

  useEffect(() => {
    if (!eligible) return
    let cancelled = false
    Promise.all([jobOpenings.getOpen(), teamService.getTeams({ limit: 100 })])
      .then(([ops, teamsRes]) => {
        if (cancelled) return
        setOpenings(ops)
        if (teamsRes.success) {
          const map: Record<string, string> = {}
          for (const t of teamsRes.data) map[t.name] = t.uuid
          setTeamUuidByName(map)
        }
      })
      .catch(err => console.warn('[OpeningsStrip] failed to load', err))
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible])

  if (!eligible || openings.length === 0) return null

  const chips = openings
    .filter(op => teamUuidByName[op.teamName || ''])
    .map(op => ({ op, teamUuid: teamUuidByName[op.teamName || ''] }))
  if (chips.length === 0) return null

  return (
    <div className="aq-openings-strip">
      <div className="aq-openings-strip-track">
        {/* The duplicate set exists only to make the loop seamless, so it is
            hidden from AT and taken out of the tab order - otherwise every
            opening is announced twice and tabbed through twice. Same shape as
            components/RelatedTicker.tsx, which already does this. */}
        {[...chips.map(c => ({ ...c, dupe: false })), ...chips.map(c => ({ ...c, dupe: true }))].map(({ op, dupe }, i) => (
          <Link key={`${op.id}-${i}`} to={`/opportunities/${op.id}?apply=1`} data-dupe={dupe ? 'true' : undefined} aria-hidden={dupe || undefined} tabIndex={dupe ? -1 : 0}>
            <span className="aq-openings-strip-dot" aria-hidden />
            {op.teamName ? `${op.teamName} is hiring: ` : ''}{op.title}
          </Link>
        ))}
      </div>
    </div>
  )
}
