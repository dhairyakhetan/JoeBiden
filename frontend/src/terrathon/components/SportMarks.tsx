import type { SportSlug } from '../lib/types'

/**
 * The three sport marks, drawn as solid colour rather than line.
 *
 * What was here before was a thin single-stroke set on a 24 grid, and it did
 * not survive contact with a real person: the cricket bat read as a pen, the
 * pickleball paddle as a hot-air balloon, and the controller as a scribble.
 * That is what a hairline outline does at 14px: every sport collapses into
 * the same rounded lozenge with a stick attached.
 *
 * A monochrome line pack off the shelf would not have fixed it, because it is
 * the same genre: Lucide, Tabler and Phosphor are all single-weight strokes,
 * and none of the three carries a cricket bat or a pickleball paddle at all.
 * So these are drawn, as filled shapes in the brand palette, with three
 * decisions behind them:
 *
 *   - MASS, not line. Each mark is a silhouette first. At 13px in a chip the
 *     shape has to read before any detail does, which is why the bat blade,
 *     the paddle face and the controller body are large solid areas.
 *   - Colour carries the sport. Cricket is tomato, pickleball lemon, FIFA sky
 *     the same hues the rest of the section already uses for each. That is
 *     the "coloured symbols" ask, and it is what makes three marks
 *     distinguishable at a glance rather than three outlines.
 *   - The OUTLINE is `currentColor`, the fills are explicit. So a mark inherits
 *     ink on paper and cream on a night slab and stays visible on both, while
 *     its colour identity does not change with the ground.
 *
 * Everything sits on a 32 grid with a 2.4 outline, which lands at the same
 * optical weight as the section's 2.5-stroke UI icons beside 700-weight type.
 */

interface Props {
  sport: SportSlug
  size?: number
  title?: string
  className?: string
  style?: React.CSSProperties
}

const LINE = { stroke: 'currentColor', strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }

function Cricket() {
  return (
    <>
      {/* Blade: a long tapered paddle, wider at the toe, angled across the
          grid so it never reads as a vertical stick. */}
      <path d="M19.5 4.2 27.4 12.1 15.2 24.3 7.3 16.4Z" fill="var(--tomato, #FF4D2E)" {...LINE} />
      {/* The spine down the middle of the blade, which is the single detail
          that separates a cricket bat from a plank. */}
      <path d="M17.6 9.3 22.3 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      {/* Handle and grip. */}
      <path d="M22.6 8.6 27.8 3.4" fill="none" {...LINE} strokeWidth="4.6" />
      <path d="M22.6 8.6 27.8 3.4" fill="none" stroke="var(--bg, #F4EFE0)" strokeWidth="2" strokeLinecap="round" />
      {/* Ball, in the corner the blade swings away from. */}
      <circle cx="8.2" cy="25.4" r="4.6" fill="var(--lemon, #FFC700)" {...LINE} />
      <path d="M5.4 22.2a4.6 4.6 0 0 0 0 6.4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
    </>
  )
}

function Pickleball() {
  return (
    <>
      {/* Paddle: a squared-off face with rounded corners, which is what makes
          it a pickleball paddle and not a table-tennis bat or a balloon. */}
      <rect x="4.4" y="3.4" width="17.6" height="19.4" rx="4.2" fill="var(--lemon, #FFC700)" {...LINE} />
      {/* Handle, offset to the corner so the whole mark reads on a diagonal. */}
      <path d="M17.4 22.2 22.6 28.4" fill="none" {...LINE} strokeWidth="5" />
      <path d="M17.4 22.2 22.6 28.4" fill="none" stroke="var(--bg, #F4EFE0)" strokeWidth="2.1" strokeLinecap="round" />
      {/* The perforated ball. Four holes is enough to read as a wiffle ball at
          13px; more of them turn into noise. */}
      <circle cx="25.2" cy="8.6" r="5.2" fill="var(--sky, #3DA9FC)" {...LINE} />
      <g fill="currentColor" opacity="0.75">
        <circle cx="23.5" cy="6.9" r="0.95" />
        <circle cx="27" cy="7.6" r="0.95" />
        <circle cx="23.9" cy="10.5" r="0.95" />
        <circle cx="27" cy="10.8" r="0.95" />
      </g>
    </>
  )
}

function Fifa() {
  return (
    <>
      {/* Controller body with real grips, rather than a rounded rectangle. */}
      <path
        d="M9.6 8.4h12.8a6.6 6.6 0 0 1 6.4 5l1.5 7.2c.6 3-1.7 5.6-4.5 5.6-1.5 0-2.9-.8-3.7-2.1l-1.5-2.4h-9.2l-1.5 2.4A4.4 4.4 0 0 1 6.2 25.6c-2.8 0-5.1-2.6-4.5-5.6l1.5-7.2a6.6 6.6 0 0 1 6.4-4.4Z"
        fill="var(--sky, #3DA9FC)"
        {...LINE}
      />
      {/* D-pad. */}
      <path d="M8.2 15.2h4.6M10.5 12.9v4.6" stroke="var(--bg, #F4EFE0)" strokeWidth="2.6" strokeLinecap="round" />
      {/* Face buttons, two of them, which is what a controller reads as at
          small sizes; four becomes a smudge. */}
      <circle cx="22.4" cy="13.6" r="1.9" fill="var(--tomato, #FF4D2E)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="25.8" cy="17" r="1.9" fill="var(--lemon, #FFC700)" stroke="currentColor" strokeWidth="1.6" />
    </>
  )
}

const MARKS: Record<SportSlug, () => React.ReactElement> = {
  cricket: Cricket,
  pickleball: Pickleball,
  fifa: Fifa,
}

export function SportMark({ sport, size = 24, title, className, style }: Props) {
  const Shape = MARKS[sport]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      style={{ flex: '0 0 auto', ...style }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <Shape />
    </svg>
  )
}
