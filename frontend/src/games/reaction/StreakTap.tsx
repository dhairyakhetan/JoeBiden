import { useEffect, useRef, useState } from 'react'
import { celebrate } from '../../lib/delight'
import { isNewBest, readBest, writeBest } from '../gameKit'
import { ROUNDS, TONE_LINE, average, toneFor, waitMs } from './reactionLogic'

const SLUG = 'streak-tap'
type Phase = 'idle' | 'wait' | 'go' | 'early' | 'between' | 'done'

/** Tap when the pad turns green. Five rounds, your average. Faster than 220ms is lightning. */
export default function StreakTap() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [times, setTimes] = useState<number[]>([])
  const [last, setLast] = useState<number | null>(null)
  const [best, setBest] = useState<number | null>(() => readBest(SLUG))
  const [fresh, setFresh] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const t0 = useRef(0)

  useEffect(() => () => clearTimeout(timer.current), [])

  const arm = () => {
    setPhase('wait')
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { t0.current = performance.now(); setPhase('go') }, waitMs(Math.random()))
  }

  const act = () => {
    if (phase === 'idle' || phase === 'between' || phase === 'early') { arm(); return }
    if (phase === 'wait') { clearTimeout(timer.current); setPhase('early'); return }
    if (phase === 'go') {
      const ms = Math.round(performance.now() - t0.current)
      const all = [...times, ms]
      setTimes(all); setLast(ms)
      if (all.length >= ROUNDS) {
        const avg = average(all)
        const isBest = isNewBest(best, avg, false)
        if (isBest) { writeBest(SLUG, avg); setBest(avg); setFresh(true) }
        if (toneFor(avg) === 'lightning') celebrate('confetti')
        else if (isBest) celebrate('stars')
        setPhase('done')
      } else setPhase('between')
      return
    }
    // done: play again
    setTimes([]); setLast(null); setFresh(false); setPhase('idle')
  }

  const avg = average(times)
  const label: Record<Phase, string> = {
    idle: 'tap to start', wait: 'wait for green…', go: 'tap now',
    early: 'too soon. tap to go again', between: last != null ? `${last} ms. tap for the next` : 'tap for the next', done: `${avg} ms average`,
  }

  return (
    <div className="gx-panel gx-tap">
      <div className="gx-stats">
        <span className="gx-stat"><b>{times.length}</b> of {ROUNDS}</span>
        {last != null && <span className="gx-stat"><b>{last}</b> ms last</span>}
        {best != null && <span className="gx-stat"><b>{best}</b> ms best average</span>}
      </div>
      {/* Mouse and touch act on pointer-down (a click arrives 80ms later and would cost the player that time); keyboard and
          assistive-tech activation arrive as a click with no pointer, detail 0. */}
      <button
        type="button" className={'gx-pad is-' + phase}
        onPointerDown={e => { if (e.pointerType) act() }}
        onClick={e => { if (e.detail === 0) act() }}
        aria-label={label[phase]}
      >
        <span className="gx-pad-big">{label[phase]}</span>
        {phase === 'done' && <span className="gx-pad-small">{TONE_LINE[toneFor(avg)]}{fresh ? ' a new best.' : ''}</span>}
        {phase === 'done' && <span className="gx-pad-small">tap to play again</span>}
      </button>
      <ol className="gx-times" aria-label="your times">{times.map((t, n) => <li key={n}>{t} ms</li>)}</ol>
      <p className="gx-small">Your best stays in this browser. Nobody else sees it.</p>
      <p className="gx-live" role="status" aria-live="polite">{phase === 'go' ? 'now' : ''}</p>
    </div>
  )
}
