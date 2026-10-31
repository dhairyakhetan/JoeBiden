import { useEffect, useMemo, useRef, useState } from 'react'
import { celebrate } from '../../lib/delight'
import { PALETTE } from '../../lib/particles'
import { isNewBest, readBest, writeBest } from '../gameKit'
import { buildDeck, isMatch, isWon, starsFor, type Card } from './matchLogic'

const SLUG = 'sticker-match'

const SHAPES: string[] = [
  'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  'M5 5h14v14H5z',
  'M12 4l8.5 15h-17z',
  'M12 3l2.7 5.7 6.2.8-4.6 4.3 1.2 6.1L12 16.9 6.5 19.9l1.2-6.1L3.1 9.5l6.2-.8z',
  'M12 21s-7.5-4.7-10-9.2A5.7 5.7 0 0 1 12 6.2a5.7 5.7 0 0 1 10 5.6C19.5 16.3 12 21 12 21z',
  'M12 3s6.5 7 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 10 12 3 12 3z',
  'M5 19C5 10 10.5 5 20 5c0 9.5-4.5 15-13.5 15L5 19z',
  'M13.5 2L5 14h6l-1.5 8L19 10h-6.5z',
]

/** Sixteen stickers, eight pairs. Flip two; matches stay. Fewer moves, more stars. */
export default function StickerMatch() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9))
  const [cards, setCards] = useState<Card[]>(() => buildDeck(seed))
  const [open, setOpen] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [lock, setLock] = useState(false)
  const [best, setBest] = useState<number | null>(() => readBest(SLUG))
  const [fresh, setFresh] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const won = useMemo(() => isWon(cards), [cards])

  useEffect(() => () => clearTimeout(timer.current), [])

  const flip = (c: Card, el: HTMLElement) => {
    if (lock || c.matched || open.includes(c.id)) return
    const next = [...open, c.id]
    setOpen(next)
    if (next.length < 2) return
    setMoves(m => m + 1)
    const [a, b] = next.map(id => cards.find(x => x.id === id)!)
    if (isMatch(a, b)) {
      const nextCards = cards.map(x => (x.id === a.id || x.id === b.id ? { ...x, matched: true } : x))
      setCards(nextCards)
      setOpen([])
      celebrate('stars', el)
      // The last pair ends the game: record the best once, here, and celebrate big.
      if (isWon(nextCards)) {
        const finalMoves = moves + 1
        if (isNewBest(best, finalMoves, false)) { writeBest(SLUG, finalMoves); setBest(finalMoves); setFresh(true) }
        celebrate('confetti')
      }
    } else {
      setLock(true)
      timer.current = setTimeout(() => { setOpen([]); setLock(false) }, 750)
    }
  }

  const again = () => { const s = Math.floor(Math.random() * 1e9); setSeed(s); setCards(buildDeck(s)); setOpen([]); setMoves(0); setLock(false); setFresh(false) }
  const stars = starsFor(moves)

  return (
    <div className="gx-panel gx-match" data-seed={seed}>
      <div className="gx-stats">
        <span className="gx-stat"><b>{moves}</b> moves</span>
        <span className="gx-stat"><b>{cards.filter(c => c.matched).length / 2}</b> of 8 pairs</span>
        {best != null && <span className="gx-stat"><b>{best}</b> best</span>}
      </div>
      <div className="gx-grid" role="group" aria-label="sticker cards">
        {cards.map(c => {
          const shown = c.matched || open.includes(c.id)
          return (
            <button
              key={c.id} type="button" className={'gx-flip' + (shown ? ' is-up' : '') + (c.matched ? ' is-done' : '')}
              onClick={e => flip(c, e.currentTarget)} aria-label={shown ? `sticker ${c.symbol + 1}${c.matched ? ', matched' : ''}` : 'face down card'} aria-pressed={shown}
            >
              <span className="gx-flip-in">
                <span className="gx-face gx-back" aria-hidden />
                <span className="gx-face gx-front">
                  <svg viewBox="0 0 24 24" aria-hidden><path d={SHAPES[c.symbol]} fill={PALETTE[c.symbol % PALETTE.length]} stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" /></svg>
                </span>
              </span>
            </button>
          )
        })}
      </div>
      {won && (
        <div className="gx-result">
          <h2 className="h-display">{'★'.repeat(stars)}<span className="gx-dim">{'★'.repeat(3 - stars)}</span></h2>
          <p className="gx-grade">all eight pairs in {moves} moves{fresh ? ', your best yet' : ''}.</p>
          <button type="button" className="btn btn-primary" onClick={again}>new deck</button>
        </div>
      )}
      <p className="gx-small">Your best stays in this browser. Nobody else sees it.</p>
    </div>
  )
}
