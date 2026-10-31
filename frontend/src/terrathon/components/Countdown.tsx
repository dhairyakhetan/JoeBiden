import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { Parts, CountdownTarget } from '../lib/countdown'
import { spokenRemaining } from '../lib/countdown'
import { useCountdown } from '../lib/hooks'
import type { PublicEvent } from '../lib/types'

/**
 * The countdown, as a split-flap board.
 *
 * It used to be four cream rectangles with a number in each, which is a
 * countdown in the sense that a receipt is a countdown. This is the thing on
 * the wall of a gym: a stack of hinged cards where the top half of the old
 * number falls forward to reveal the new one underneath.
 *
 * How the flip is built, because it is not obvious from the markup:
 *
 *   - Every digit is two halves split across the horizontal centre line. The
 *     STATIC top half already shows the new value and the STATIC bottom half
 *     still shows the old one, so at rest the card reads correctly either way.
 *   - Two more halves sit on top and animate. The upper one carries the OLD
 *     digit and rotates down from 0 to -90deg on its bottom edge. The lower one
 *     carries the NEW digit and rotates up from 90deg to 0 on its top edge,
 *     starting halfway through, so the card appears to fall and land.
 *   - `backface-visibility: hidden` keeps each from showing through the other,
 *     and the whole digit has `perspective`, which is what makes it read as a
 *     card rather than a squash.
 *
 * Digits are JetBrains Mono, NOT the display face. Measured, and re-measured on
 * 2026-09-21 when the display face changed from Bebas Neue to Archivo Black:
 * NeutralFace has no tabular figures at all, Bebas's were proportional, and
 * Archivo Black's are proportional too. At 100px it sets "111" at 143 and "000"
 * at 150, and `font-variant-numeric: tabular-nums` does not close the gap,
 * which makes the feature a no-op rather than a fix. JetBrains sets both at
 * 180. A counter in any of the three display faces visibly jitters every second
 * as the numbers change, and on a flip board a digit that changes width would
 * also break the card it sits in. This is exactly the case `--code` exists for.
 *
 * role="timer" with aria-live="off", because a live region that fires once a
 * second is unusable with a screen reader. A visually hidden sentence carries
 * the same information and refreshes once a minute instead.
 */
interface Props {
  target: CountdownTarget
  parts: Parts
  size?: 'lg' | 'sm'
  /** Sitting on a night slab flips the card colours. */
  tone?: 'ink' | 'paper'
}

/** One hinged card. `value` is a single character, '0' to '9'. */
function FlipDigit({ value, tone, big }: { value: string; tone: 'ink' | 'paper'; big: boolean }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(value)
  const [falling, setFalling] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (value === shown) return
    if (reduce) { setShown(value); return }
    // The OLD digit is what falls; the new one is already painted underneath.
    setFalling(shown)
    setShown(value)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setFalling(null), 420)
    return () => window.clearTimeout(timer.current)
  }, [value, shown, reduce])

  return (
    <span className={`tt-flip ${big ? 'tt-flip--lg' : ''} ${tone === 'paper' ? 'tt-flip--paper' : ''}`}>
      {/* At rest these two are the whole card. */}
      <span className="tt-flip__face tt-flip__face--top" aria-hidden="true">
        <span className="tt-flip__d">{shown}</span>
      </span>
      <span className="tt-flip__face tt-flip__face--bottom" aria-hidden="true">
        <span className="tt-flip__d">{falling ?? shown}</span>
      </span>

      {falling !== null && (
        <>
          <span className="tt-flip__leaf tt-flip__leaf--fall" aria-hidden="true">
            <span className="tt-flip__d">{falling}</span>
          </span>
          <span className="tt-flip__leaf tt-flip__leaf--land" aria-hidden="true">
            <span className="tt-flip__d">{shown}</span>
          </span>
        </>
      )}

      {/* The only copy a screen reader or a text-only client sees. */}
      <span className="tt-sr">{shown}</span>
    </span>
  )
}

function Cell({ value, label, size, tone }: {
  value: number; label: string; size: 'lg' | 'sm'; tone: 'ink' | 'paper'
}) {
  const big = size === 'lg'
  const digits = String(value).padStart(2, '0').split('')
  return (
    <div className="tt-flipcell">
      <div className="tt-flipcell__digits">
        {digits.map((d, i) => <FlipDigit key={i} value={d} tone={tone} big={big} />)}
      </div>
      <div className="tt-flipcell__label">{label}</div>
    </div>
  )
}

/**
 * The live countdown: this component, and only this component, re-renders once
 * a second.
 *
 * `useCountdown` used to be called at the top of the home page, which meant the
 * whole page reconciled 60 times a minute for the sake of four digits. Owning
 * the tick here confines it to the cards below.
 */
export function LiveCountdown(
  { events, offset, ...rest }: { events: PublicEvent[]; offset: number } & Omit<Props, 'target' | 'parts'>,
) {
  const { target, parts } = useCountdown(events, offset)
  return <Countdown target={target} parts={parts} {...rest} />
}

export function Countdown({ target, parts, size = 'lg', tone = 'ink' }: Props) {
  const [spoken, setSpoken] = useState('')

  useEffect(() => {
    const say = () => setSpoken(target.target ? spokenRemaining(parts, target.label) : target.label)
    say()
    const id = window.setInterval(say, 60_000)
    return () => clearInterval(id)
    // Intentionally not keyed on `parts`: this must fire once a minute, not
    // once a second, or a screen reader announces continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.label, target.target])

  if (!target.target) {
    return (
      <div>
        <div className="tt-kicker" style={{ marginBottom: 8, opacity: 0.75 }}>
          {target.mode === 'live' ? 'Happening now' : 'TerraThon 2026'}
        </div>
        <div style={{ fontFamily: 'var(--tt-display)', fontSize: size === 'lg' ? 46 : 30, textTransform: 'uppercase', lineHeight: 1 }}>
          {target.label}
        </div>
      </div>
    )
  }

  const totalMs = ((parts.days * 24 + parts.hours) * 60 + parts.minutes) * 60_000 + parts.seconds * 1000
  const urgent = totalMs < 24 * 3600_000

  return (
    <div className="tt-clock">
      <div className="tt-clock__head">
        <span className="tt-kicker">{target.label}</span>
        {urgent && <span className="tt-sticker tt-sticker--hot">Last day</span>}
      </div>

      <div role="timer" aria-live="off" className="tt-clock__board">
        <Cell value={parts.days} label="days" size={size} tone={tone} />
        <span className="tt-clock__sep" aria-hidden="true" />
        <Cell value={parts.hours} label="hrs" size={size} tone={tone} />
        <span className="tt-clock__sep" aria-hidden="true" />
        <Cell value={parts.minutes} label="min" size={size} tone={tone} />
        <span className="tt-clock__sep" aria-hidden="true" />
        <Cell value={parts.seconds} label="sec" size={size} tone={tone} />
      </div>

      <p className="tt-sr" aria-live="polite">{spoken}</p>
    </div>
  )
}
