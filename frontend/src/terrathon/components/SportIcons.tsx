/**
 * Flat-vector sport marks, drawn inline.
 *
 * Custom SVG rather than a licensed photo set or an icon font: they scale to
 * the 250px hero collage and down to a 16px chip without a second asset, they
 * take the palette rather than fighting it, and there is no usage right to
 * clear for a student fundraiser. Decorative by default (aria-hidden); pass a
 * `title` where the mark is the only label.
 */
import type { SportSlug } from '../lib/types'

export type IconName =
  | 'bat' | 'ball' | 'stumps' | 'paddle' | 'pickleball'
  | 'football' | 'gamepad' | 'basketball' | 'trophy' | 'whistle'

interface Props {
  name: IconName
  size?: number
  color?: string
  title?: string
  className?: string
  style?: React.CSSProperties
  /**
   * Stroke weight on the 24px grid, matched to the weight of the text the mark
   * sits beside. 1.5 belongs beside regular 400 text; 2.5 belongs beside bold
   * 700. Every UI use of this set in TerraThon is the second case, because the
   * label voice here is NeutralFace 700 in chips, section heads and the sport
   * picker. So 2.5 is the default, and the one decorative use passes its own.
   */
  strokeWidth?: number
}

const PATHS: Record<IconName, React.ReactNode> = {
  bat: (
    <>
      <path d="M15.5 3.5 20.5 8.5" />
      <path d="M17.2 1.8a2.4 2.4 0 0 1 3.4 0l1.6 1.6a2.4 2.4 0 0 1 0 3.4l-1.4 1.4-5-5Z" />
      <path d="M16.6 7.4 6.2 17.8a3 3 0 0 0-.8 1.5L4.5 23l3.7-.9a3 3 0 0 0 1.5-.8L20.1 10.9Z" />
    </>
  ),
  ball: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6.5 6.2A11 11 0 0 1 6.5 17.8" />
      <path d="M8.6 5.1a11 11 0 0 1 0 13.8" />
    </>
  ),
  stumps: (
    <>
      <path d="M7 8v13M12 8v13M17 8v13" />
      <path d="M5.5 6.5h13" />
      <path d="M6.5 4.6h4M13.5 4.6h4" />
    </>
  ),
  paddle: (
    <>
      <ellipse cx="11" cy="9.5" rx="7" ry="8" />
      <path d="M11 17.5v2.3a2.2 2.2 0 0 0 2.2 2.2h1.4" />
      <path d="M6.5 9.5h9M11 4v11" />
    </>
  ),
  pickleball: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="9" cy="9.5" r="1.1" />
      <circle cx="15" cy="9.5" r="1.1" />
      <circle cx="12" cy="13" r="1.1" />
      <circle cx="9" cy="16" r="1.1" />
      <circle cx="15" cy="16" r="1.1" />
    </>
  ),
  football: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.2 15.4 9.7 14.1 13.8H9.9L8.6 9.7Z" />
      <path d="M12 3.5v3.7M19.6 9.3l-4.2.4M17 19l-2.9-5.2M7 19l2.9-5.2M4.4 9.3l4.2.4" />
    </>
  ),
  gamepad: (
    <>
      <path d="M7.5 8h9a5.5 5.5 0 0 1 5.4 6.5l-.5 2.7A2.7 2.7 0 0 1 16.6 18l-1.4-1.6H8.8L7.4 18a2.7 2.7 0 0 1-4.8-.8l-.5-2.7A5.5 5.5 0 0 1 7.5 8Z" />
      <path d="M7.6 11v3M6.1 12.5h3" />
      <circle cx="16.2" cy="11.9" r="0.9" />
      <circle cx="18.3" cy="13.9" r="0.9" />
    </>
  ),
  basketball: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5v17" />
      <path d="M6 5.6A11 11 0 0 1 6 18.4M18 5.6a11 11 0 0 0 0 12.8" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5.5a5 5 0 0 1-10 0Z" />
      <path d="M7 5.5H4.6a2.6 2.6 0 0 0 2.6 4.3M17 5.5h2.4a2.6 2.6 0 0 1-2.6 4.3" />
      <path d="M12 14.5V18M8.5 21h7M9.5 18h5" />
    </>
  ),
  whistle: (
    <>
      <path d="M13.5 8.5h6.4a1.6 1.6 0 0 1 1.6 1.6v2.2a5.8 5.8 0 1 1-8-5.4Z" />
      <circle cx="8.2" cy="13.2" r="2.1" />
      <path d="M13.5 8.5 11 4.2" />
    </>
  ),
}

export function SportIcon({ name, size = 24, color = 'currentColor', title, className, style, strokeWidth = 2.5 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name]}
    </svg>
  )
}

/** The mark that stands for each sport across cards, chips and tickets. */
export const SPORT_ICON: Record<SportSlug, IconName> = {
  cricket: 'bat',
  pickleball: 'paddle',
  fifa: 'gamepad',
}

/**
 * One hue per sport, from the AQ palette. These are FILLS with ink on top:
 * they are display hues and several fail as small text on paper, so glyphs use
 * SPORT_INK below. Same rule the token layer documents for --lemon and friends.
 */
/**
 * Repointed to the campaign palette on 2026-09-21.
 *
 * These were three of AquaTerra's house hues, one per sport. The poster this
 * section was rebuilt to is built from exactly three colours, and red is not
 * one of them: a tomato fee chip on the cricket page was the one element on
 * the screen that belonged to a different brand.
 *
 * All three stay FILLS with ink glyphs on top, which is the rule these are
 * used under everywhere. Contrast on #0A0A0A: green 9.6, orchid 8.9, lemon
 * 12.4, so any of them can also carry ink text.
 */
export const SPORT_ACCENT: Record<SportSlug, string> = {
  pickleball: 'var(--tt-go, #24CB7E)',
  cricket: 'var(--tt-lemon, #FFD166)',
  fifa: 'var(--tt-hot, #DD6CEE)',
}

/** Text-safe partner of each sport's hue, cleared against paper and white. */
export const SPORT_INK: Record<SportSlug, string> = {
  pickleball: 'var(--lemon-ink, #7E6000)',
  cricket: 'var(--tomato-ink, #C6300F)',
  fifa: 'var(--sky-ink, #0B6BB8)',
}

/** The chip class that matches each sport's hue. */
export const SPORT_CHIP: Record<SportSlug, string> = {
  pickleball: 'tt-chip--lemon',
  cricket: 'tt-chip--hot',
  fifa: 'tt-chip--sky',
}
