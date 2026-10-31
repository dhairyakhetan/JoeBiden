import { EVENT } from '../config'

/**
 * The TERRATHON 2026 wordmark.
 *
 * Built from layered text rather than a traced SVG so the copy stays
 * selectable, the year can take its own treatment, and it reflows at any width
 * without a second asset.
 *
 * NeutralFace is caps-only, so the uppercase here is stated rather than
 * implied: pointing lowercase at this face would render it shouted anyway, and
 * being explicit stops the next person "fixing" it.
 */
interface Props {
  /** Cap height in px. The offset shadow scales with it. */
  size?: number
  as?: 'h1' | 'div'
  /** No drop shadow and no year. The hero lockup on the approved board is a
   *  flat solid mark inside its cream card, and the year lives on the nav. */
  flat?: boolean
  /** 'ink' = paper letters on a dark slab. 'paper' = ink letters on cream. */
  tone?: 'ink' | 'paper'
  className?: string
  style?: React.CSSProperties
}

export function Wordmark({ size = 96, as: Tag = 'div', tone = 'ink', flat = false, className, style }: Props) {
  const onInk = tone === 'ink'
  const face = onInk ? 'var(--tt-ink, #F2EFE3)' : '#0A0A0A'
  // Orchid, not tomato. The drop shadow is the one piece of the mark that
  // carries a campaign colour, and the poster this section was rebuilt to on
  // 2026-09-21 has no red in it at all. The ternary was also the same value on
  // both branches, so it was never a branch.
  const shadow = 'var(--tt-hot, #DD6CEE)'
  const drop = Math.max(2, Math.round(size * 0.042))

  return (
    <Tag
      className={className}
      style={{
        fontFamily: 'var(--tt-display)',
        fontWeight: 700,
        fontSize: size,
        lineHeight: 0.82,
        letterSpacing: '-0.012em',
        textTransform: 'uppercase',
        color: face,
        textShadow: flat ? 'none' : `${drop}px ${drop}px 0 ${shadow}`,
        margin: 0,
        ...style,
      }}
    >
      {EVENT.wordmark}
      {!flat && <span
        style={{
          display: 'block',
          marginTop: size * 0.06,
          fontFamily: 'var(--tt-code)',
          // Floored at 11px. This is derived from the mark's own size, so the
          // 46px footer wordmark was setting its year at 9.2px, the smallest
          // type anywhere on the section and well under the floor the rest of
          // it now holds to.
          fontSize: Math.max(11, size * 0.2),
          fontWeight: 400,
          letterSpacing: '0.42em',
          textIndent: '0.42em',
          textShadow: 'none',
          // Orchid on cream, lemon on night. It used to be --tomato-ink on
          // cream, which put a small dark red "2026" under the mark and read
          // as an error state rather than part of the lockup. The poster has
          // no red in it; the orchid is the same hue as the plate's ring, so
          // the year ties to the box it sits in.
          color: onInk ? 'var(--tt-lemon, #FFD166)' : 'var(--tt-hot-ink, #7A2B8A)',
        }}
      >
        {EVENT.wordmarkYear}
      </span>}
    </Tag>
  )
}
