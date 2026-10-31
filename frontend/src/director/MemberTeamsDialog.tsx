import { useEffect, useRef, useState } from 'react'
import { useModalA11y } from '../hooks/useDialog'
import { useToast } from '../components/Toast'
import teamService from '../services/teamService'

/**
 * Assign one member to teams, from the Members desk — walkthrough item 4.4.
 * ────────────────────────────────────────────────────────────────────────────
 * "Categories desk becomes redundant. Replace with: assign teams to people from
 * the Members desk, and assign members to teams in bulk from the Teams desk."
 *
 * The Teams half already existed (teams/AddMemberModal.tsx -> addMembersBulk).
 * This is the other direction, and it did not: `MemberDirectory.tsx` contained
 * no mention of a team at all, so the only way to put someone on a team was to
 * know which team you wanted first and go there.
 *
 * WHY A DIALOG AND NOT INLINE CHIPS ON THE CARD
 * The member card was measured at its density floor on 2026-09-11 (257px on a
 * 375px viewport, ~215px of which is content that cannot shrink under a 44px
 * tap floor). Eight teams' worth of chips on every card would undo that pass
 * outright. The trigger lives in the card's EXISTING admin row, so the card
 * does not grow by a pixel.
 *
 * WHY EACH TOGGLE WRITES IMMEDIATELY
 * No Save button. Every checkbox is one `setMembership` call, optimistic, and
 * rolled back on failure. A Save button implies a transaction this cannot
 * offer - eight independent RLS-gated writes, some of which may be refused
 * while others succeed - and "Saved" over a partial write is the same class of
 * lie as the role guard that silently reverted (see the 5.7 migration).
 */

type TeamOption = { teamId: number; name: string; category: string }

interface Props {
  memberId: number
  memberName: string
  onClose: () => void
  /** Told the new count so the desk's trigger label stays honest without a refetch. */
  onCountChange?: (count: number) => void
}

export default function MemberTeamsDialog({ memberId, memberName, onClose, onCountChange }: Props) {
  const { success: toastSuccess, error: toastError } = useToast()
  const panelRef = useRef<HTMLDivElement>(null)
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [onTeams, setOnTeams] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Per-row, so one slow or refused write never freezes the other seven. */
  const [busy, setBusy] = useState<Set<number>>(new Set())

  // The four modal behaviours (Escape, focus trap, focus in/out, scroll lock),
  // same hook every other dialog on this desk uses. `busy.size > 0` blocks the
  // close while a write is in flight.
  useModalA11y(true, panelRef, onClose, busy.size > 0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [opts, mine] = await Promise.all([
          teamService.getTeamOptions(),
          teamService.getTeamIdsForMemberId(memberId),
        ])
        if (cancelled) return
        setTeams(opts)
        setOnTeams(new Set(mine))
      } catch (e: any) {
        if (cancelled) return
        setLoadError(e?.message || 'Teams didn’t load.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [memberId])

  const toggle = async (team: TeamOption) => {
    const next = !onTeams.has(team.teamId)
    setBusy(p => new Set(p).add(team.teamId))
    // Optimistic, then rolled back below on failure - the checkbox must not
    // sit unresponsive for a round trip on a desk this is used in bulk from.
    setOnTeams(p => {
      const s = new Set(p)
      if (next) s.add(team.teamId); else s.delete(team.teamId)
      onCountChange?.(s.size)
      return s
    })
    try {
      await teamService.setMembership(team.teamId, memberId, next)
      toastSuccess(next ? `${memberName} added to ${team.name}` : `${memberName} taken off ${team.name}`)
    } catch (e: any) {
      setOnTeams(p => {
        const s = new Set(p)
        if (next) s.delete(team.teamId); else s.add(team.teamId)
        onCountChange?.(s.size)
        return s
      })
      toastError(next ? 'couldn’t add them.' : 'couldn’t remove them.', e?.message ?? 'try again.')
    } finally {
      setBusy(p => { const s = new Set(p); s.delete(team.teamId); return s })
    }
  }

  return (
    // `.modal-back` / `.modal` are the desk's established dialog pair (see the
    // reject dialogs in HiringResponses, OpeningsTab, ResponsesTab) - not a new
    // class of my own, which is exactly what CLAUDE.md warns produces a surface
    // the cascade does not reach.
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget && busy.size === 0) onClose() }}>
      <div
        ref={panelRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mtd-title"
        tabIndex={-1}
      >
        <div className="panel-h">
          <h2 id="mtd-title" style={{ margin: 0, font: 'inherit' }}>Teams for {memberName}</h2>
          <button
            type="button"
            className="iconbtn no"
            onClick={onClose}
            disabled={busy.size > 0}
            aria-label="Close"
            title={busy.size > 0 ? 'Finishing a change…' : 'Close'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* No Save button, and the copy says why rather than leaving someone
            hunting for one. */}
        <p className="adm-note is-quiet" style={{ marginBottom: 10 }}>
          Each change saves on its own, straight away. There is no Save button.
        </p>

        {loading ? (
          <p className="adm-note is-quiet">loading teams…</p>
        ) : loadError ? (
          <p className="adm-note" role="alert">{loadError}</p>
        ) : teams.length === 0 ? (
          <p className="adm-note is-quiet">no active teams to assign.</p>
        ) : (
          <div>
            {teams.map(t => {
              const checked = onTeams.has(t.teamId)
              const isBusy = busy.has(t.teamId)
              return (
                <label
                  key={t.teamId}
                  className="qrow"
                  style={{ ['--cc' as any]: 'var(--teal)', cursor: isBusy ? 'progress' : 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isBusy}
                    onChange={() => toggle(t)}
                    aria-busy={isBusy || undefined}
                  />
                  <div className="qmeta">
                    <div className="qname">{t.name}</div>
                    <div className="qsub">{t.category}</div>
                  </div>
                  {isBusy && <span className="qtag">saving…</span>}
                </label>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
