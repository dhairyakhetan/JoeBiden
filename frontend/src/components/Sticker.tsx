/**
 * ONE OF TWO STICKER SYSTEMS. Read this before adding a call site.
 *
 * Ruled 2026-09-06: both systems stay, with a boundary.
 *  - DEFAULT is the CSS system (`v6.css` `.sticker*` + `uiHelpers.stickerRotation`),
 *    which is the faithful build of changelog/13 - hashed rotation, and it
 *    honours `--sticker-ground`. ~45 files use it. Prefer it.
 *  - THIS file exists for its own shape vocabulary (star4, quatrefoil, gear12,
 *    gear16) which the CSS system has no equivalent for. 8 files use it.
 *
 * Known, accepted limitation: rotation here is a MANUAL prop clamped to
 * -11..+9 rather than hashed from the text, and the keyline is the fixed
 * module constant KEYLINE_COLOR ('#FFFFFF') with no `ground` prop - so
 * changelog/13.1's "the ground must match whatever the sticker lies on" rule
 * cannot be expressed here. On a non-white ground this reads as a hole rather
 * than a die-cut. If any of these call sites ever move onto a dark surface,
 * the fix is to add a `ground` prop rather than to hard-code another colour.
 *
 * Do not port shapes between the two systems, and do not add a third.
 */
import { useEffect, useId, type CSSProperties, type ReactNode } from 'react'
import {
  HUE_VAR,
  KEYLINE_COLOR,
  KEYLINE_WIDTH,
  MARKS,
  SAFE,
  SHAPES,
  isDeepNotch,
  isValidRotation,
  isValidSize,
  stickerTextHex,
  type StickerHue,
  type StickerMark,
  type StickerShape,
} from '../lib/stickerShapes'
import '../styles/components/stickers.css'

/* ─────────────────────────────────────────────────────────────────────────
   The sticker — redesign section 11, from AQ Stickers.dc.html.

   A die-cut object: the same path drawn twice, once as a white
   `stroke-width: 11` keyline and once filled with the hue, under a
   drop-shadow. Built only from generated geometry and the AQ palette. No
   illustration, no image files.

   Stickers are a RATIONED device. The rules that keep the pack from becoming
   clip art are enforced here rather than left to review wherever that is
   possible in code:

     - `rotate` is REQUIRED, must be between -11 and +9, and must not be 0.
       Out of range is a dev-time error and renders at the nearest legal angle.
     - Deep-notch shapes (star4, quatrefoil, gear) accept `mark` only. Passing
       a word to one is a dev-time error and the word is DROPPED, not squeezed
       in: its corners would overhang a valley.
     - Every shape reads its OWN measured inset from `SAFE`. There is no way
       to pass a shared one.
     - Marks render at 40% inside a container with zero padding, because
       nesting a percentage width in an already-inset box compounds the inset.
     - Text colour is computed from the fill, in the component, never patched
       per instance. Ink on the palette's darkest reds measures 3.4:1; paper
       on them measures 5.0:1.
     - More than three mounted at once is a dev-time warning.
   ───────────────────────────────────────────────────────────────────────── */

export type { StickerHue, StickerMark, StickerShape } from '../lib/stickerShapes'

/** Which of the five project fonts the word is set in. */
export type StickerType = 'shout' | 'spoken' | 'status' | 'quote' | 'signature'

export type StickerVariant = 'solid' | 'patterned' | 'double' | 'outline'

export type StickerPattern = 'stripe' | 'check' | 'halftone' | 'rings'

export interface StickerProps {
  shape: StickerShape
  /** A palette hue name. Arbitrary colours are deliberately not accepted. */
  hue: StickerHue
  /** Degrees. Required, never 0, between -11 and +9, set per placement. */
  rotate: number
  /** Px on the long edge. 88 to 160 desktop, capped to 132 on phone by CSS. */
  size?: number
  variant?: StickerVariant
  /** Only meaningful for `variant="patterned"`. */
  pattern?: StickerPattern
  /**
   * A centred, axis-aligned mark at 40%. The ONLY content a deep-notch shape
   * accepts. Takes precedence over `children` on every shape.
   */
  mark?: StickerMark
  /**
   * A count sticker: one number, one unit, nothing else. Takes the same safe
   * area as a word, so it is refused on deep-notch shapes for the same reason.
   */
  numeral?: { value: string; unit?: string }
  /** The word. Ignored, with a dev error, on deep-notch shapes. */
  children?: ReactNode
  /** Type role for `children`. Defaults to `shout` (NeutralFace, caps only). */
  type?: StickerType
  /**
   * Set ONLY when the sticker carries information a screen reader needs.
   * Renders as real text in the DOM; the artwork stays `aria-hidden`.
   * Leave unset for decoration, which is the default and the common case.
   */
  label?: string
  /** Pin the sticker to a corner of a `position: relative` parent, breaking its edge. */
  pin?: 'tl' | 'tr' | 'bl' | 'br'
  /** Play the 340ms entrance. Honours reduced motion. */
  animate?: boolean
  className?: string
  style?: CSSProperties
}

const DEV = import.meta.env?.DEV ?? false

/** Dev-only census, so "at most three per viewport" fails loudly in review. */
let mounted = 0

function clampRotation(deg: number): number {
  if (!Number.isFinite(deg) || deg === 0) return -8
  return Math.max(-11, Math.min(9, deg))
}

function Pattern({ id, kind, ink }: { id: string; kind: StickerPattern; ink: string }) {
  switch (kind) {
    case 'check':
      return (
        <pattern id={id} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="5" height="5" fill={ink} opacity=".22" />
          <rect x="5" y="5" width="5" height="5" fill={ink} opacity=".22" />
        </pattern>
      )
    case 'halftone':
      return (
        <pattern id={id} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="2.1" fill={ink} opacity=".24" />
        </pattern>
      )
    case 'rings':
      return (
        <pattern id={id} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="7" r="5" fill="none" stroke={ink} strokeWidth="2" opacity=".22" />
        </pattern>
      )
    default:
      return (
        <pattern id={id} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="4" height="8" fill={ink} opacity=".22" />
        </pattern>
      )
  }
}

export function Sticker({
  shape,
  hue,
  rotate,
  size = 118,
  variant = 'solid',
  pattern = 'stripe',
  mark,
  numeral,
  children,
  type = 'shout',
  label,
  pin,
  animate = false,
  className,
  style,
}: StickerProps) {
  const uid = useId().replace(/:/g, '')
  const def = SHAPES[shape]
  const [inset, yShift] = SAFE[shape]
  const deep = isDeepNotch(shape)

  if (DEV) {
    if (!isValidRotation(rotate)) {
      console.error(
        `[Sticker] rotate must be between -11 and +9 and never 0; got ${rotate} on shape "${shape}". Rendering at the nearest legal angle.`
      )
    }
    if (!isValidSize(size)) {
      console.error(
        `[Sticker] size must be between 72 and 160; got ${size} on shape "${shape}". A sticker is never larger than the headline beside it.`
      )
    }
    if (deep && (children || numeral)) {
      console.error(
        `[Sticker] "${shape}" is a deep-notch shape: its arms point up, right, down and left, so a word overhangs a valley. Pass a "mark" instead. The children were dropped.`
      )
    }
  }

  useEffect(() => {
    if (!DEV) return
    mounted += 1
    if (mounted > 3) {
      console.warn(
        `[Sticker] ${mounted} stickers are mounted at once. The pack allows at most three per viewport and one per card; a cluster of five belongs to a hero and nowhere else.`
      )
    }
    return () => {
      mounted -= 1
    }
  }, [])

  const fill = HUE_VAR[hue]
  const textHex = stickerTextHex(hue)
  // `outline` is the on-colour variant: white body, hue keyline, no hue fill,
  // so its type sits on white and always takes ink.
  const outline = variant === 'outline'
  const bodyFill = outline ? '#FFFFFF' : fill
  const edgeColor = outline ? fill : KEYLINE_COLOR
  const inkOn = outline ? '#0A0A0A' : textHex

  const patternId = `stk-pat-${uid}`
  const showMark = Boolean(mark)
  // Deep-notch shapes never host a word. This is the drop, not a squeeze.
  const showNumeral = !showMark && !deep && Boolean(numeral)
  const showWord = !showMark && !showNumeral && !deep && Boolean(children)

  const cls = [
    'aq-sticker',
    def.w === def.h ? 'aq-sticker--square' : 'aq-sticker--wide',
    pin ? `aq-sticker--pin aq-sticker--${pin}` : '',
    animate ? 'aq-sticker--enter' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const vars = {
    '--stk-size-req': `${size}px`,
    '--stk-rotate': `${clampRotation(rotate)}deg`,
    ...style,
  } as CSSProperties

  const markDef = mark ? MARKS[mark] : null

  return (
    <>
      {label ? <span className="sr-only">{label}</span> : null}
      <span className={cls} style={vars} aria-hidden="true" data-sticker={shape}>
        <span className="aq-sticker-stage">
          <svg className="aq-sticker-svg" viewBox={`0 0 ${def.w} ${def.h}`} focusable="false">
            {variant === 'patterned' ? (
              <defs>
                <Pattern id={patternId} kind={pattern} ink={inkOn} />
              </defs>
            ) : null}
            {/* the die-cut edge */}
            <path
              d={def.d}
              fill="none"
              stroke={edgeColor}
              strokeWidth={KEYLINE_WIDTH}
              strokeLinejoin="round"
            />
            {/* the misregistered second impression, same hue, never a second one */}
            {variant === 'double' ? (
              <path d={def.d} fill={bodyFill} opacity=".42" transform="translate(3.5,3.5)" />
            ) : null}
            <path d={def.d} fill={bodyFill} />
            {variant === 'patterned' ? <path d={def.d} fill={`url(#${patternId})`} /> : null}
          </svg>

          {showMark && markDef ? (
            /* zero padding, mark at 40%: see stickers.css */
            <span className="aq-sticker-type aq-sticker-type--mark">
              <svg
                className="aq-sticker-mark"
                viewBox="0 0 100 100"
                style={{ transform: yShift ? `translateY(${yShift}%)` : undefined }}
                focusable="false"
              >
                <path
                  d={markDef.d}
                  fill={markDef.filled ? inkOn : 'none'}
                  stroke={markDef.filled ? 'none' : inkOn}
                  strokeWidth={markDef.strokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          ) : null}

          {showNumeral && numeral ? (
            <span
              className="aq-sticker-type"
              style={{
                padding: `${inset}%`,
                color: inkOn,
                transform: yShift ? `translateY(${yShift}%)` : undefined,
              }}
            >
              <span className="aq-sticker-num">{numeral.value}</span>
              {numeral.unit ? <span className="aq-sticker-unit">{numeral.unit}</span> : null}
            </span>
          ) : null}

          {showWord ? (
            <span
              className="aq-sticker-type"
              style={{
                padding: `${inset}%`,
                color: inkOn,
                transform: yShift ? `translateY(${yShift}%)` : undefined,
              }}
            >
              <span className={`aq-sticker-word aq-sticker-word--${type}`}>{children}</span>
            </span>
          ) : null}
        </span>
      </span>
    </>
  )
}

export default Sticker
