import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'framer-motion'
import './AuthFeaturePanel.css'
import { Sticker } from './Sticker'
import type { StickerHue, StickerMark, StickerShape } from '../lib/stickerShapes'
import { Mascot } from './Mascot'
import type { MascotCharacter } from '../lib/mascotCast'

/* ─────────────────────────────────────────────────────────────────────────
   The seeded auth art panel — changelog/07-auth-and-contact.md §07.2.

   "Unique every visit" must not mean unpredictable. The panel is NEVER
   assembled from independent random choices (a hue picked here, a mascot
   picked there) — that produces the occasional ugly or illegible combination
   and makes a bug impossible to reproduce. Instead there are TWELVE fixed
   compositions, each a complete tuple of
   hue × mascot × sticker pair × ghost-letter placement, and exactly ONE index
   is chosen. The index is displayed in the corner (`composition 3 of 12`) so
   a screenshot is reproducible.

   Everything here is decoration. `AuthShell` renders this inside a wrapper
   that is already `aria-hidden="true"`, and the root below re-asserts it:
   a screen reader gets the form, never the art. (§07.2 verification #6.)

   §07.3: every gradient on this surface is deleted. There is none here.
   ───────────────────────────────────────────────────────────────────────── */

/* ── the twelve ──────────────────────────────────────────────────────────
   Contrast rules baked into the table, not left to the caller:

   - Ink text on all seven panel hues passes (README invariant 7), and every
     sticker below carries its own computed text colour via `Sticker`.
   - PAPER stickers are only legal on welfare, tomato, grape, teal and ink —
     never on lemon or sky (§07.2, verification #8). Grep the table: every
     `paper` sticker sits on a `welfare` / `tomato` / `grape` / `teal` panel.
   - Deep-notch shapes (star4, quatrefoil, gear*) host a MARK only, never a
     word. Every word below is on a wide shape; every mark on a square one.
   ────────────────────────────────────────────────────────────────────── */

/** The word sticker. Wide shapes only — a word needs a long safe area. */
interface WordSticker { shape: StickerShape; hue: StickerHue; rotate: number; word: string }
/** The mark sticker. A centred axis-aligned glyph, no text at all. */
interface MarkSticker { shape: StickerShape; hue: StickerHue; rotate: number; mark: StickerMark }

export interface Composition {
  /** The panel ground. One of the seven; ink text on all seven passes. */
  hue: Extract<StickerHue, 'welfare' | 'lemon' | 'sky' | 'tomato' | 'pink' | 'teal' | 'grape'>
  /** From the existing cast. §07.2: do not draw a new character. */
  mascot: MascotCharacter
  word: WordSticker
  mark: MarkSticker
  /** Which corner the `AQ` ghost letters sit in. */
  ghost: 'tl' | 'tr' | 'bl' | 'br'
}

export const COMPOSITIONS: readonly Composition[] = [
  { hue: 'welfare', mascot: 'nolen', ghost: 'tl',
    word: { shape: 'ticket',  hue: 'paper', rotate: -8,  word: 'zero fees' },
    mark: { shape: 'star4',   hue: 'ink',   rotate: 6,   mark: 'heart' } },

  { hue: 'lemon',   mascot: 'tuk',   ghost: 'br',
    word: { shape: 'ribbon',  hue: 'ink',   rotate: -6,  word: 'student run' },
    mark: { shape: 'burst12', hue: 'ink',   rotate: 7,   mark: 'smile' } },

  { hue: 'sky',     mascot: 'bhoot', ghost: 'tr',
    word: { shape: 'flag',    hue: 'ink',   rotate: -9,  word: '15,000+ bananas' },
    mark: { shape: 'rosette10', hue: 'ink', rotate: 5,   mark: 'globe' } },

  { hue: 'tomato',  mascot: 'nolen', ghost: 'bl',
    word: { shape: 'chevron', hue: 'paper', rotate: -7,  word: 'student run' },
    mark: { shape: 'quatrefoil', hue: 'ink', rotate: 8,  mark: 'ring' } },

  { hue: 'grape',   mascot: 'tuk',   ghost: 'tl',
    word: { shape: 'ticket',  hue: 'paper', rotate: -10, word: 'zero fees' },
    mark: { shape: 'burst16', hue: 'ink',   rotate: 4,   mark: 'arch' } },

  { hue: 'teal',    mascot: 'bhoot', ghost: 'br',
    word: { shape: 'ribbon',  hue: 'paper', rotate: -5,  word: '15,000+ bananas' },
    mark: { shape: 'star4',   hue: 'ink',   rotate: 9,   mark: 'plus' } },

  { hue: 'pink',    mascot: 'nolen', ghost: 'tr',
    word: { shape: 'flag',    hue: 'ink',   rotate: -8,  word: 'zero fees' },
    mark: { shape: 'burst14', hue: 'lemon', rotate: 6,   mark: 'smile' } },

  { hue: 'lemon',   mascot: 'bhoot', ghost: 'bl',
    word: { shape: 'chevron', hue: 'ink',   rotate: -11, word: '15,000+ bananas' },
    mark: { shape: 'rosette14', hue: 'ink', rotate: 3,   mark: 'cross' } },

  { hue: 'welfare', mascot: 'tuk',   ghost: 'tr',
    word: { shape: 'ticket',  hue: 'ink',   rotate: -6,  word: 'student run' },
    mark: { shape: 'burst18', hue: 'lemon', rotate: 8,   mark: 'ring' } },

  { hue: 'sky',     mascot: 'nolen', ghost: 'bl',
    word: { shape: 'ribbon',  hue: 'ink',   rotate: -9,  word: 'zero fees' },
    mark: { shape: 'quatrefoil', hue: 'ink', rotate: 5,  mark: 'heart' } },

  { hue: 'grape',   mascot: 'bhoot', ghost: 'br',
    word: { shape: 'flag',    hue: 'paper', rotate: -7,  word: 'student run' },
    mark: { shape: 'burst10', hue: 'lemon', rotate: 9,   mark: 'globe' } },

  { hue: 'teal',    mascot: 'nolen', ghost: 'tl',
    word: { shape: 'chevron', hue: 'paper', rotate: -4,  word: 'zero fees' },
    mark: { shape: 'rosette12', hue: 'ink', rotate: 7,   mark: 'arch' } },
] as const

/** §07.2: `Math.floor(Date.now() / 864e5) % 12` — one composition per day. */
export function compositionForToday(now: number = Date.now()): number {
  return Math.floor(now / 864e5) % COMPOSITIONS.length
}

/* ── the eyes ────────────────────────────────────────────────────────────
   §07.2: two `translate()` values (dx, dy) on ONE shared rAF loop, one
   `pointermove` listener on the panel, `passive: true`, clamped to ~7px.

     dx = clamp((pointerX - eyeCx) / 40, -7, 7)
     dy = clamp((pointerY - eyeCy) / 40, -7, 7)

   Desktop only — on touch there is no cursor, the mascot simply looks ahead,
   and `14`'s motion permission is NOT asked for again here. Under
   `prefers-reduced-motion` the loop is never started at all.
   ────────────────────────────────────────────────────────────────────── */
const EYE_TRAVEL = 7 // px, the §07.2 clamp
const EYE_DIVISOR = 40

export const clampEye = (delta: number, limit: number): number =>
  Math.max(-limit, Math.min(limit, delta / EYE_DIVISOR))

interface PupilTarget {
  el: HTMLElement
  cx: number
  cy: number
  /** How far this pupil may travel before it leaves its own white. */
  limit: number
}

export interface AuthFeaturePanelProps {
  /** Kept for the existing call sites; the art panel is the same on both. */
  mode?: 'login' | 'register'
  /** Kept for API compatibility with the previous panel. Unused by the art. */
  firstVisit?: boolean
  /** Compact variant for the mobile top-strip — smaller mascot, no ghost. */
  compact?: boolean
  /**
   * Force a composition. Omitted in the product (the day seed picks one);
   * present so the twelve can be enumerated in a test or a review pass
   * without waiting twelve days.
   */
  composition?: number
}

export default function AuthFeaturePanel({ compact = false, composition }: AuthFeaturePanelProps) {
  const reduced = useReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)

  const index = ((composition ?? compositionForToday()) % COMPOSITIONS.length + COMPOSITIONS.length) % COMPOSITIONS.length
  const c = COMPOSITIONS[index]

  useEffect(() => {
    // README invariant 8 / §07.2: reduced motion means the eyes rest at
    // centre and NO loop is started. Not a paused loop — no loop.
    if (reduced) return
    const panel = panelRef.current
    if (!panel) return
    // Desktop pointers only. A touch screen has no cursor to follow.
    if (typeof window === 'undefined' || !window.matchMedia) return
    if (!window.matchMedia('(pointer: fine)').matches) return

    const pupils = Array.from(panel.querySelectorAll<HTMLElement>('.aq-mc-pupil'))
    if (pupils.length === 0) return

    let targets: PupilTarget[] = []
    /* Geometry is measured here and on resize/scroll ONLY. The rAF callback
       reads the cached pointer position and writes transforms — it never
       reads layout, so there is no per-frame thrash. */
    const measure = () => {
      targets = pupils.map((el) => {
        const eye = el.parentElement as HTMLElement
        const er = eye.getBoundingClientRect()
        const pr = el.getBoundingClientRect()
        return {
          el,
          cx: er.left + er.width / 2,
          cy: er.top + er.height / 2,
          // Never past the edge of its own white; ~7px is the spec ceiling,
          // the eye's free radius is the physical one, whichever is smaller.
          limit: Math.min(EYE_TRAVEL, Math.max(0, (er.width - pr.width) / 2)),
        }
      })
    }
    measure()

    let px = 0
    let py = 0
    let raf = 0

    /* THE one loop. Scheduled on demand by the single pointermove listener
       and cleared at the top of each frame, so it costs nothing while the
       cursor is still — and nothing at all while the tab is hidden, since a
       hidden tab receives no pointer events and the guard below bails. */
    const frame = () => {
      raf = 0
      if (document.hidden) return
      for (const t of targets) {
        const dx = clampEye(px - t.cx, t.limit)
        const dy = clampEye(py - t.cy, t.limit)
        t.el.style.transform = `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`
      }
    }

    const onMove = (e: PointerEvent) => {
      px = e.clientX
      py = e.clientY
      if (!raf && !document.hidden) raf = requestAnimationFrame(frame)
    }

    const onGeometry = () => { measure() }
    const onVisibility = () => {
      if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0 }
    }

    panel.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('resize', onGeometry, { passive: true })
    window.addEventListener('scroll', onGeometry, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      panel.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', onGeometry)
      window.removeEventListener('scroll', onGeometry)
      document.removeEventListener('visibilitychange', onVisibility)
      if (raf) cancelAnimationFrame(raf)
      for (const t of targets) t.el.style.transform = ''
    }
  }, [reduced, index])

  // Both strings are on the approved list in §07.2's "A note on strings".
  const kicker = c.mascot === 'nolen' && !reduced
    ? '★ nolen is watching your cursor'
    : '★ student run'

  return (
    <div className="aq-authart-frame" aria-hidden="true">
      <div
        ref={panelRef}
        className={`aq-authart${compact ? ' aq-authart--compact' : ''}`}
        data-composition={index + 1}
        style={{ ['--aq-authart-hue' as string]: `var(--${c.hue})` }}
      >
        {/* Ghost letters — decoration, never over type, pointer-events none. */}
        {!compact && <span className={`aq-authart-ghost aq-authart-ghost--${c.ghost}`}>AQ</span>}

        {/* The sticker pair gets its own row, so nothing absolutely
            positioned can enter the box of the mascot or the kicker
            (changelog/README.md — the overlap rule). */}
        <div className="aq-authart-stickers">
          <Sticker
            shape={c.word.shape}
            hue={c.word.hue}
            rotate={c.word.rotate}
            size={compact ? 130 : 152}
          >
            {c.word.word}
          </Sticker>
          <Sticker
            shape={c.mark.shape}
            hue={c.mark.hue}
            rotate={c.mark.rotate}
            mark={c.mark.mark}
            size={compact ? 76 : 88}
          />
        </div>

        <div className="aq-authart-stage">
          <Mascot character={c.mascot} pose="idle" size={compact ? 64 : 110} />
        </div>

        <div className="aq-authart-foot">
          <span className="aq-authart-kicker">{kicker}</span>
          <span className="aq-authart-index">composition {index + 1} of 12</span>
        </div>
      </div>
    </div>
  )
}
