import { useEffect, useMemo, useState } from 'react'
import GlyphIcon from '../components/GlyphIcon'
import { celebrate } from '../lib/delight'
import { BADGES, badgeStates, levelFor, nextUp, unseenEarned, type BadgeInputs } from './badges'
import './BadgeShelf.css'

const SEEN_KEY = 'aq_badges_seen'

function readSeen(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(SEEN_KEY) || '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch { return [] }
}
function writeSeen(ids: string[]): void {
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(ids)) } catch { /* private window: the flip just plays again next visit */ }
}

function Shelf({ inputs }: { inputs: BadgeInputs }) {
  const states = useMemo(() => badgeStates(inputs), [inputs])
  const earned = states.filter(s => s.earned)
  const level = levelFor(earned.length)
  const next = nextUp(states)
  // Badges earned but never shown on this device: they get the unlock flip. Read once at mount; the effect records them.
  const [fresh] = useState(() => unseenEarned(earned.map(s => s.def.id), readSeen()))

  useEffect(() => {
    if (!fresh.length) return
    writeSeen([...new Set([...readSeen(), ...fresh])])
    const t = setTimeout(() => celebrate('stars', document.querySelector('.bs-badge.is-fresh .bs-icon')), 500)
    return () => clearTimeout(t)
  }, [fresh])

  return (
    <section className="bs" aria-labelledby="bs-h">
      <header className="bs-head">
        <div>
          <h2 id="bs-h" className="bs-title">badges</h2>
          <p className="bs-level">level {level.step + 1}: {level.name}</p>
        </div>
        <span className="bs-count"><b>{earned.length}</b> of {BADGES.length}</span>
      </header>
      <ul className="bs-grid">
        {states.map((s, n) => (
          <li
            key={s.def.id}
            className={'bs-badge' + (s.earned ? ' is-earned' : ' is-locked') + (fresh.includes(s.def.id) ? ' is-fresh' : '')}
            style={{ ['--i' as string]: n }}
          >
            <span className="bs-icon"><GlyphIcon name={s.earned ? s.def.glyph : 'lock'} size={52} /></span>
            <b className="bs-name">{s.def.name}</b>
            <small className="bs-sub">{s.earned ? s.def.blurb : `${Math.floor(s.value)} of ${s.def.target} ${s.def.unit}`}</small>
            {!s.earned && <span className="bs-bar" aria-hidden><span style={{ width: `${s.progress * 100}%` }} /></span>}
            <span className="bs-sr">{s.earned ? 'earned' : 'not earned yet'}</span>
          </li>
        ))}
      </ul>
      {next && <p className="bs-next">next up: {next.def.name}, {Math.max(1, Math.ceil(next.def.target - next.value))} more {next.def.unit}.</p>}
    </section>
  )
}

/** Your own badges, derived from counts this page already loaded. Remounts when a badge is earned so the new one flips in. */
export default function BadgeShelf({ inputs }: { inputs: BadgeInputs }) {
  const key = badgeStates(inputs).filter(s => s.earned).map(s => s.def.id).join(',')
  return <Shelf key={key} inputs={inputs} />
}
