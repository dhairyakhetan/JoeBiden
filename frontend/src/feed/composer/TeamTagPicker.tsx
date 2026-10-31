import { useEffect, useState } from 'react'
import teamService from '../../services/teamService'

/**
 * "Tag teams" for the post composer (2026-10-03). A post can tag several teams;
 * tagged posts then show up on each tagged team's page automatically
 * (teamService.getTeamPosts reads post_teams). Purely a chip multi-select: the
 * parent owns the selected ids and does the write after the post exists
 * (feedService.tagPostTeams), so this works for every post type.
 */
export default function TeamTagPicker({
  value,
  onChange,
  disabled,
}: {
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}) {
  const [teams, setTeams] = useState<{ teamId: number; name: string }[]>([])
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    teamService.getTeamOptions()
      .then(rows => {
        if (cancelled) return
        setTeams(rows.map(t => ({ teamId: t.teamId, name: t.name })).sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  // No teams to show (or the list failed to load): render nothing rather than a
  // dead control. Posting never depends on this.
  if (failed || teams.length === 0) return null

  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id])

  return (
    <div className="cp-field" role="group" aria-labelledby="post-team-tags-label">
      <span id="post-team-tags-label" className="cp-label">
        Tag teams <span className="cp-label-opt">(optional, appears on each team’s page)</span>
      </span>
      <div className="cp-chiprow cp-chiprow--wrap">
        {teams.map(t => (
          <button
            key={t.teamId}
            type="button"
            className="cp-chip cp-chip--ink"
            aria-pressed={value.includes(t.teamId)}
            disabled={disabled}
            onClick={() => toggle(t.teamId)}
          >
            {t.name}
          </button>
        ))}
      </div>
    </div>
  )
}
