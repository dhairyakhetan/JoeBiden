import { useEffect, useMemo, useRef, type CSSProperties } from 'react'
import {
  CAST,
  blinkDelay,
  characterForSeed,
  type CastEntry,
  type MascotCharacter,
  type MascotPose,
  type MascotSize,
} from '../lib/mascotCast'
import '../styles/components/mascot.css'

/* ─────────────────────────────────────────────────────────────────────────
   The mascot — redesign section 09, from AQ Mascots.dc.html (K1 to K5).

   RENAME NOTE (18-mascots-and-motion.md). This file used to ship as
   `AQMascot.tsx` because the short name `Mascot.tsx` was still held by the
   legacy cursor-following "parked companion" mounted once in `App.tsx`.
   That component has now been retired in favour of `components/Companion.tsx`
   (18.1 — roaming + the drag-to-follow bone, rendering THIS cast instead of
   the old abstract eyes-blob), which freed the name. This is that two-line
   rename `AQMascot.tsx`'s own header once promised: same file, same export,
   no API change — every caller still does `import { Mascot } from
   '.../Mascot'`.

   One component, props only. Callers pick a character (or a seed) and a pose;
   they never pass body, eye, mouth or limb configuration — that lives in
   `lib/mascotCast.ts` so a character always looks like itself.
   ───────────────────────────────────────────────────────────────────────── */

export type { MascotCharacter, MascotPose, MascotSize } from '../lib/mascotCast'

export interface MascotProps {
  /** Picks hue, body, eyes, mouth and limbs together. Ignored when `seed` is set. */
  character?: MascotCharacter
  /** A member id. Picks the character by `hash(seed) % 6`, so a member always gets the same one. */
  seed?: string
  /** One of eight. There is no ninth. */
  pose?: MascotPose
  /** Four steps only: 26 footer, 44 inline, 64 empty state, 110 hero. */
  size?: MascotSize
  /** Which screen edge `peek` enters from. Ignored by every other pose. */
  peekFrom?: 'left' | 'right'
  /**
   * Only when the mascot is the ONLY thing carrying a message. The message is
   * rendered as real text beside it (visually hidden) and the mascot itself
   * stays `aria-hidden`. When a visible caption already says it, leave this
   * unset — a duplicated announcement is worse than none.
   */
  label?: string
  className?: string
  style?: CSSProperties
}

/** Confetti bits for `cheer`: palette tokens only, decorative, motion-gated. */
const CONFETTI: { hue: string; cx: string; cy: string; delay: string }[] = [
  { hue: 'var(--lemon)',   cx: '-150%', cy: '-160%', delay: '0s' },
  { hue: 'var(--sky)',     cx: '-70%',  cy: '-210%', delay: '.04s' },
  { hue: 'var(--pink)',    cx: '10%',   cy: '-230%', delay: '.08s' },
  { hue: 'var(--welfare)', cx: '95%',   cy: '-200%', delay: '.02s' },
  { hue: 'var(--grape)',   cx: '165%',  cy: '-150%', delay: '.1s' },
  { hue: 'var(--teal)',    cx: '-190%', cy: '-90%',  delay: '.06s' },
  { hue: 'var(--tomato)',  cx: '200%',  cy: '-80%',  delay: '.12s' },
  { hue: 'var(--lemon)',   cx: '40%',   cy: '-120%', delay: '.14s' },
]

function Eyes({ c, closed }: { c: CastEntry; closed: boolean }) {
  if (closed) {
    return (
      <>
        <span className="aq-mc-lid aq-mc-lid--l" />
        <span className="aq-mc-lid aq-mc-lid--r" />
      </>
    )
  }
  const eye = (mod: string) => (
    <span key={mod} className={`aq-mc-eye aq-mc-eye--${mod}`}>
      <span className="aq-mc-pupil" />
    </span>
  )
  switch (c.eyes) {
    case 'three':
      return <>{['three-l', 'three-c', 'three-r'].map(eye)}</>
    case 'one':
      return <>{eye('one')}</>
    case 'wide':
      return <>{['wide-l', 'wide-r'].map(eye)}</>
    case 'worried':
      return <>{['worried-l', 'worried-r'].map(eye)}</>
    default:
      return <>{['two-l', 'two-r'].map(eye)}</>
  }
}

function Mouth({ c }: { c: CastEntry }) {
  if (c.mouth === 'teeth') {
    return (
      <span className="aq-mc-mouth--teeth">
        <span className="aq-mc-tooth aq-mc-tooth--l" />
        <span className="aq-mc-tooth aq-mc-tooth--r" />
      </span>
    )
  }
  return <span className={`aq-mc-mouth--${c.mouth}`} />
}

export function Mascot({
  character,
  seed,
  pose = 'idle',
  size = 64,
  peekFrom = 'right',
  label,
  className,
  style,
}: MascotProps) {
  const key: MascotCharacter = seed ? characterForSeed(seed) : (character ?? 'nolen')
  const c = CAST[key]
  const stageRef = useRef<HTMLSpanElement>(null)

  const delay = useMemo(() => `${blinkDelay(seed ?? key)}s`, [seed, key])

  /* `follow`: tracks the pointer with the .42s spring declared in mascot.css,
     desktop pointers only, and docks back to rest after 1.6s of no movement.
     Guarded on `pointer: fine` (a touch screen has no hover to follow) and on
     `prefers-reduced-motion`, which disables the pose entirely rather than
     leaving a silent transition running. */
  useEffect(() => {
    if (pose !== 'follow') return
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const stage = stageRef.current
    if (!stage) return

    let dockTimer: number | undefined
    const MAX = 10 // px of travel; the mascot leans, it does not roam

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 260)) * MAX
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 260)) * MAX
      stage.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`
      if (dockTimer) window.clearTimeout(dockTimer)
      dockTimer = window.setTimeout(() => {
        stage.style.transform = 'translate(0, 0)'
      }, 1600)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (dockTimer) window.clearTimeout(dockTimer)
      stage.style.transform = ''
    }
  }, [pose])

  const cls = [
    'aq-mc',
    `aq-mc--${size}`,
    `aq-mc-p-${pose}`,
    pose === 'peek' && peekFrom === 'left' ? 'aq-mc--peek-left' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const vars = { '--mc-hue': c.hue, '--mc-blink': delay, ...style } as CSSProperties

  return (
    <>
      {label ? <span className="sr-only">{label}</span> : null}
      <span className={cls} style={vars} aria-hidden="true" data-mascot={key}>
        <span className="aq-mc-stage" ref={stageRef}>
          <span className="aq-mc-figure">
            {c.antenna ? (
              <>
                <span className="aq-mc-ant-stalk" />
                <span className="aq-mc-ant-ball" />
              </>
            ) : null}
            {c.arms ? (
              <>
                <span className="aq-mc-arm aq-mc-arm--l" />
                <span className="aq-mc-arm aq-mc-arm--r" />
              </>
            ) : null}
            {c.feet ? (
              <>
                <span className="aq-mc-foot aq-mc-foot--l" />
                <span className="aq-mc-foot aq-mc-foot--r" />
              </>
            ) : null}
            <span className={`aq-mc-body aq-mc-body--${c.body}`} />
            <Eyes c={c} closed={pose === 'sleep'} />
            <Mouth c={c} />
          </span>
        </span>
        {pose === 'load' ? (
          <span className="aq-mc-bar">
            <i />
          </span>
        ) : null}
        {pose === 'cheer' ? (
          <span className="aq-mc-confetti">
            {CONFETTI.map((b, i) => (
              <i
                key={i}
                style={
                  {
                    background: b.hue,
                    animationDelay: b.delay,
                    '--mc-cx': b.cx,
                    '--mc-cy': b.cy,
                  } as CSSProperties
                }
              />
            ))}
          </span>
        ) : null}
      </span>
    </>
  )
}

export default Mascot
