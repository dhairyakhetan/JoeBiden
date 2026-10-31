import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { celebrate } from '../../lib/delight'
import { isNewBest, readBest, writeBest } from '../gameKit'
import { BINS, GRADE_LINE, ROUND_SIZE, dealRound, gradeFor, judge, nextStreak, pointsFor, type Bin } from './sorterLogic'

const SLUG = 'drive-sorter'

/** Twelve things, three bins. Tap a bin (or press 1, 2, 3) before the next card arrives. Score is yours alone. */
export default function DriveSorter() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const deck = useMemo(() => dealRound(seed), [seed])
  const [i, setI] = useState(0)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [right, setRight] = useState(0)
  const [say, setSay] = useState('')
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null)
  const [best, setBest] = useState<number | null>(() => readBest(SLUG))
  const [fresh, setFresh] = useState(false)
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const done = i >= deck.length
  const item = deck[i]

  const answer = useCallback((bin: Bin) => {
    if (done) return
    const ok = judge(item, bin)
    const before = streak
    setScore(s => s + pointsFor(ok, before))
    setStreak(nextStreak(before, ok))
    if (ok) setRight(r => r + 1)
    setSay(ok ? `right. ${item.name} goes in ${BINS.find(b => b.id === bin)!.label}.` : `not quite. ${item.name} goes in ${BINS.find(b => b.id === item.bin)!.label}.`)
    setFlash(ok ? 'ok' : 'no')
    clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 450)
    if (ok && (before + 1) % 5 === 0) celebrate('stars')
    setI(n => n + 1)
    // The last card ends the round: record the best once, here, and a full tree earns confetti.
    if (i + 1 >= deck.length) {
      const finalScore = score + pointsFor(ok, before)
      const finalRight = right + (ok ? 1 : 0)
      if (isNewBest(best, finalScore, true)) { writeBest(SLUG, finalScore); setBest(finalScore); setFresh(true) }
      if (gradeFor(finalRight, deck.length) === 'tree') celebrate('confetti')
    }
  }, [done, item, streak, i, deck.length, score, right, best])

  useEffect(() => () => clearTimeout(flashTimer.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = Number(e.key)
      if (k >= 1 && k <= BINS.length && !e.metaKey && !e.ctrlKey && !e.altKey) answer(BINS[k - 1].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer])

  const again = () => { setSeed(Math.floor(Math.random() * 1e9)); setI(0); setScore(0); setStreak(0); setRight(0); setSay(''); setFresh(false); }
  const grade = gradeFor(right, deck.length)

  return (
    <div className={'gx-panel gx-sorter' + (flash ? ' is-' + flash : '')}>
      <div className="gx-stats" aria-hidden={done}>
        <span className="gx-stat"><b>{score}</b> points</span>
        <span className={'gx-stat' + (streak >= 3 ? ' is-hot' : '')}><b>{streak}</b> in a row</span>
        <span className="gx-stat"><b>{Math.min(i + 1, ROUND_SIZE)}</b> of {deck.length}</span>
      </div>
      <div className="gx-bar" role="progressbar" aria-label="round progress" aria-valuemin={0} aria-valuemax={deck.length} aria-valuenow={i}><span style={{ width: `${(i / deck.length) * 100}%` }} /></div>

      {!done ? (
        <>
          <div className="gx-stage"><div key={item.id} className="gx-item">{item.name}</div></div>
          <div className="gx-bins">
            {BINS.map((b, n) => (
              <button key={b.id} type="button" className={'gx-bin gx-bin-' + b.id} onClick={() => answer(b.id)}>
                <span className="gx-key">{n + 1}</span>
                <b>{b.label}</b>
                <small>{b.hint}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="gx-result">
          <h2 className="h-display">{right} of {deck.length}.</h2>
          <p className="gx-grade">{GRADE_LINE[grade]}</p>
          <p className="gx-small">{score} points{fresh ? ', your best yet' : best != null ? `, your best is ${best}` : ''}. Scores stay in this browser.</p>
          <button type="button" className="btn btn-primary" onClick={again}>sort another twelve</button>
        </div>
      )}
      <p className="gx-live" role="status" aria-live="polite">{say}</p>
    </div>
  )
}
