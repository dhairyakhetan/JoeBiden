/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION 10 step 2 · the six shared card devices
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Extracted once and imported by every shape. Do NOT duplicate them per card:
   the previous generation of this feed had four different meta rows and three
   different author pills, which is exactly the drift the redesign consolidates.

     badge-dot pill        over the image, category hue, 7px ink dot, white
                           keyline so it survives a busy photo
     photo + colour block   photo inset 10 at radius 22, then a sibling block
                           in the category hue carrying the type
     cream inner CTA        50px, radius 22 (--r-inner, SET from the old --r-photo
                           18 per 15.2), #FFFDF2, Instrument Serif 17px, text
                           arrow. Inside the coloured block, never on paper
     detached author pill   white pill with a soft shadow, avatar + name + role,
                           BELOW the card body rather than inside it
     meta row               heart / chat / bookmark / share, heroicons 24
                           outline at 16px, counts in mono 10.5px, every button
                           44px via negative margin
     stacked collection     three photos at -9deg / 8deg / 0deg, the front one
                           offset, each radius 22 (--r-inner) with its own shadow
     arc-set seal (2b)      bespoke SVG textPath, not the Sticker component -
                           see the device's own doc comment below

   RULES THIS FILE ENFORCES SO NO CARD HAS TO REMEMBER THEM:
   - every image goes through <Img>, which runs sized(url, ctx). Never a bare
     <img src={url}> (lib/imageUrl.ts: the single biggest real perf bug found
     in this codebase).
   - a photo belongs to the row it sits in. Passing a null/empty url renders NO
     photo, not a placeholder and not somebody else's picture.
   - the hue comes from lib/uiHelpers.CAT_COLORS, never from
     lib/jobOpenings.CAT_COLORS and never as a literal hex.
   - a figure with no source renders as the dashed live marker. A zero is a
     claim.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  BookmarkIcon,
  ChatBubbleOvalLeftIcon,
  HeartIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import Img from '../../components/Img'
import { CAT_COLORS, getInitials, hashColor } from '../../lib/uiHelpers'
import { isOfficialAccount, VerifiedTick } from '../../components/v6Shared'
import { likeBurst, tapScale } from '../../lib/motion'
import { celebrate } from '../../lib/delight'
import type { CardFigure } from '../../lib/feedShape'
import type { CardBusy } from './types'
import type { StickerHue } from '../../components/Sticker'
import './cards.css'

/** The five mapped post categories. Anything else has no hue and gets none. */
export function hueFor(category: string | null | undefined): string | null {
  if (!category) return null
  return CAT_COLORS[category] ?? null
}

/**
 * A hue this card may sit type on. Falls back to the ink so a card never
 * renders transparent text when a category is unmapped.
 */
export function hueOrInk(category: string | null | undefined): string {
  return hueFor(category) ?? 'var(--ink)'
}

/**
 * `hueOrInk` is for fills (a card's border, an icon glyph) - it is NOT safe
 * for text. tokens.css's own contrast comment measures the raw category
 * hues as text on a light card, and two of five fail even the >=24px/3:1
 * large-type floor (events/--sky 2.54:1, labs/--lemon 1.61:1). Any large
 * figure/headline colour-by-category must go through this instead, which
 * swaps in the same category's already-existing `*-ink` partner - no new
 * colour, every value is already in tokens.css.
 */
export function inkHueFor(category: string | null | undefined): string {
  switch (category) {
    case 'events': return 'var(--sky-ink)'
    case 'welfare': return 'var(--welfare-ink)'
    case 'labs': return 'var(--lemon-ink)'
    case 'content': return 'var(--grape-ink)'
    default: return 'var(--ink)'
  }
}

/**
 * The same five categories, mapped onto a <Sticker> hue key instead of a CSS
 * colour. lib/uiHelpers.CAT_COLORS calls the operations vertical "operations";
 * components/Sticker.tsx (a separate, arbitrary-colour-refusing enum) calls
 * the same hue "ops". Everything else already lines up. Unmapped categories
 * fall back to "ink" rather than guessing a hue for them.
 */
export function stickerHueFor(category: string | null | undefined): StickerHue {
  if (category === 'operations') return 'ops'
  if (category && category in CAT_COLORS) return category as StickerHue
  return 'ink'
}

// ── device 1 · the badge-dot pill ────────────────────────────────────────────

export function BadgeDot({ category, label }: { category?: string | null; label?: string }) {
  const hue = hueFor(category)
  if (!hue) return null
  // `.aqc-badge-over` (cards.css) is the float-over-the-photo positioning
  // rule - every real call site (family05Posts.tsx's CardHero/
  // CardColourBlock/CardStandard) renders this directly after <CardPhoto>
  // inside a `position: relative` wrapper, expecting the badge to sit on
  // top of the image like FeedPostCard's `.feed-card-cat-float` does. That
  // class existed in cards.css but nothing ever applied it - BadgeDot only
  // ever emitted the bare `.aqc-badge` (no `position`), so the badge
  // actually rendered in normal flow directly under the photo with no gap,
  // reading as glued to the image's bottom edge instead of floating over
  // it. Found via owner report ("the welfare category chip is sticking to
  // the images").
  return (
    <span className="aqc-badge aqc-badge-over" style={{ background: hue }}>
      <span className="aqc-badge-dot" aria-hidden="true" />
      {label ?? category}
    </span>
  )
}

// ── device 2 · the photo, inset and concentric ───────────────────────────────

/**
 * Photos are concentric: the 10px shell padding (--pad-card) inside a
 * radius-32 card (--r-outer) gives radius 22 (--r-inner) here, per 15.2's own
 * arithmetic ("32 - 10 = 22"). `ctx` is the sized() bucket, so a 40px avatar
 * never ships a multi-MB original.
 *
 * Renders NOTHING when there is no url. That is the rule, not a fallback: a
 * photo belongs to the row it sits in, and truthful alt text does not fix wrong
 * placement.
 */
export function CardPhoto({
  url,
  alt,
  ctx = 'card',
  ratio = '4 / 3',
  overlay,
  eager,
  onActivate,
}: {
  url: string | null | undefined
  alt: string
  ctx?: 'thumb' | 'card' | 'cover' | 'full'
  ratio?: string
  overlay?: ReactNode
  eager?: boolean
  /** The host opens the ALWAYS-MOUNTED `ImageLightbox` with this url. The card
      never mounts a lightbox of its own (ACCEPTANCE §C / types.ts note 2), and
      it never sanitises or resizes the url it hands back - `sized()` is already
      applied on the way in by <Img>, and the host applies `sized(_, 'full')` on
      the way out. */
  onActivate?: (src: string) => void
}) {
  if (!url) return null
  const img = (
    <Img
      src={url}
      alt={alt}
      ctx={ctx}
      eager={eager}
      className="aqc-photo-img no-long-press"
      onClick={onActivate ? (e => { e.stopPropagation(); onActivate(url) }) : undefined}
      style={onActivate ? { cursor: 'zoom-in' } : undefined}
    />
  )
  return (
    <div className="aqc-photo" style={{ aspectRatio: ratio }}>
      {img}
      {overlay}
    </div>
  )
}

// ── device 2b · the arc-set seal (13.6) ──────────────────────────────────────

/**
 * The one part of the sticker pack that needs bespoke SVG, per 13.6: CSS
 * cannot set type on a curved path. This is deliberately NOT built on the
 * shared `components/Sticker.tsx` — that component's type layer is a plain
 * centred box (no `<textPath>` support at all), so the "arc-set seal" 13.6
 * describes is its own small device, matching 13.6's markup line for line.
 * `<textPath>` is not a new technique in this codebase: AboutPage.tsx's
 * spinning "EST. JUNE 2021" badge already renders text on a circular path.
 *
 * `label` must come from the fixed, small set 13.6 names (never invented per
 * card) - the caller is responsible for choosing one of the three.
 */
export function Seal({
  label,
  size = 80,
  rotate = 9,
  hue = 'var(--lemon)',
}: {
  label: string
  size?: number
  rotate?: number
  hue?: string
}) {
  const uid = useId().replace(/:/g, '')
  const pathId = `seal-arc-${uid}`
  return (
    <svg
      className="aqc-seal"
      width={size}
      height={size}
      viewBox="0 0 104 104"
      aria-hidden="true"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <circle cx="52" cy="52" r="50" fill={hue} stroke="var(--card)" strokeWidth="3" />
      <path id={pathId} d="M52 92a40 40 0 010-80a40 40 0 010 80" fill="none" />
      <text fontFamily="var(--mono)" fontSize="9.5" fontWeight="800" letterSpacing="2.2" fill="var(--ink)">
        <textPath href={`#${pathId}`} startOffset="4%">{label}</textPath>
      </text>
    </svg>
  )
}

// ── device 3 · the cream inner CTA ───────────────────────────────────────────

/**
 * 50px, radius 18, #FFFDF2, Instrument Serif 17px, a text arrow. It sits INSIDE
 * a coloured block and never on paper. heroicons has an arrow, but the project
 * rule is a text arrow (v6Shared exports none), so that is what this uses.
 */
export function CreamCTA({ label, href, onClick }: { label: string; href?: string; onClick?: () => void }) {
  const reduce = useReducedMotion()
  const inner = (
    <>
      <span>{label}</span>
      <span aria-hidden="true" className="aqc-cta-arrow">&#8594;</span>
    </>
  )
  if (href) {
    return (
      <motion.a className="aqc-cta" href={href} whileTap={reduce ? undefined : tapScale}>
        {inner}
      </motion.a>
    )
  }
  return (
    <motion.button type="button" className="aqc-cta" onClick={onClick} whileTap={reduce ? undefined : tapScale}>
      {inner}
    </motion.button>
  )
}

// ── device 4 · the detached author pill ──────────────────────────────────────

export function AuthorPill({
  name,
  role,
  avatar,
  href,
  time,
  className,
  onActivate,
}: {
  name?: string
  role?: string
  avatar?: string | null
  href?: string
  time?: string
  /** C05 only, so far: overhangs the quote card's bottom edge (15.9). */
  className?: string
  /**
   * The host owns the `member?.uuid === authorUuid` self-vs-public profile
   * branch, so it routes rather than the pill (types.ts, `onOpenAuthor`). A
   * plain click is handed up and `preventDefault`ed so react-router navigates
   * instead of the browser doing a full document load; a MODIFIED click falls
   * through untouched so middle-click / cmd-click still opens a new tab, which
   * is the same bargain `FeedPostCard`'s title <Link> already strikes.
   */
  onActivate?: () => void
}) {
  if (!name) return null
  const official = isOfficialAccount(name)
  const body = (
    <>
      <span className="aqc-author-avatar" aria-hidden="true" style={!avatar && !official ? { background: hashColor(name) } : undefined}>
        {official
          /* stamp-ink.png, not logo.png: logo.png is a 1332x225 horizontal
             wordmark and paints ~5px tall inside a 34px circle (01.15.4). */
          ? <Img src="/stamp-ink-96.png" alt="" ctx="avatar" className="aqc-author-img" style={{ objectFit: 'contain', padding: 4, background: '#fff' }} />
          : avatar
            ? <Img src={avatar} alt="" ctx="avatar" className="aqc-author-img" />
            /* KEEP getInitials from lib/uiHelpers rather than hand-rolling a
               single-character slice (15.2 / 03.5.3). */
            : <span>{getInitials(name)}</span>}
      </span>
      <span className="aqc-author-text">
        <span className="aqc-author-name">
          {name}
          {official ? <VerifiedTick size={12} /> : null}
        </span>
        {role ? <span className="aqc-author-role">{role}</span> : null}
      </span>
      {time ? <span className="aqc-author-time">{time}</span> : null}
    </>
  )
  const cls = ['aqc-author', className].filter(Boolean).join(' ')
  if (href) {
    return (
      <a
        className={cls}
        href={href}
        onClick={onActivate ? (e => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          e.stopPropagation()
          onActivate()
        }) : (e => e.stopPropagation())}
      >
        {body}
      </a>
    )
  }
  return <span className={cls}>{body}</span>
}

// ── device 5 · the meta row ──────────────────────────────────────────────────

/**
 * Four controls, each 44x44 of hit area achieved with padding plus a negative
 * margin so the visual row stays 16px tall. Counts are mono 10.5px with
 * tabular numerals so a like landing does not shift the row.
 *
 * These are presentational: the catalogue does not own liking or saving.
 * `FeedPostCard.tsx` keeps that behaviour. Handlers are optional so a shape can
 * be rendered in the catalogue with no wiring at all.
 */
export function MetaRow({
  likeCount,
  commentCount,
  liked,
  saved,
  onLike,
  onComment,
  onSave,
  onShare,
  busy,
  savePop,
}: {
  likeCount?: number
  commentCount?: number
  liked?: boolean
  saved?: boolean
  onLike?: () => void
  onComment?: () => void
  onSave?: () => void
  onShare?: () => void
  /** Per-control, so one in-flight write never disables its siblings
      (ACCEPTANCE §B). */
  busy?: CardBusy
  /** The bookmark pop, driven by the host so the animation and the toast stay
      on the same clock (`FeedPostCard.handleBookmark`). */
  savePop?: boolean
}) {
  // Every control stops the click from reaching the card shell, which in the
  // live feed is what opens the focus modal. Liking a post must not also open
  // it - that was the first thing to break when the row was mounted for real.
  const stop = (fn?: () => void) => (e: { stopPropagation: () => void }) => { e.stopPropagation(); fn?.() }

  // lib/motion's likeBurst, wired here the same way v6Shared.tsx's LikeButton
  // already wires it on the classic (unshaped) card footer - this row was the
  // gap: a plain colour/weight swap on the heart with no motion at all, on
  // the exact same action one scroll away that gets a little celebration.
  // Unlike stays quiet (no burst) - the asymmetry is the point, not an
  // oversight (see lib/motion.ts's own comment on likeBurst).
  const reduceMotion = useReducedMotion()
  const [justLiked, setJustLiked] = useState(false)
  const wasLiked = useRef(!!liked)
  const likeBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (liked && !wasLiked.current && !reduceMotion) {
      setJustLiked(true)
      celebrate('hearts', likeBtn.current)
      const t = setTimeout(() => setJustLiked(false), 500)
      return () => clearTimeout(t)
    }
    wasLiked.current = !!liked
  }, [liked, reduceMotion])

  return (
    <div className="aqc-meta">
      <button ref={likeBtn} type="button" className={'aqc-meta-btn' + (liked ? ' is-liked' : '')} onClick={stop(onLike)} disabled={!!busy?.like} aria-pressed={!!liked} aria-label="Like this post" title="Like this post">
        <motion.span
          style={{ display: 'inline-flex' }}
          animate={justLiked ? likeBurst : { scale: 1 }}
        >
          {/* liked = filled + coloured, same tomato-ink the classic
              LikeButton (v6Shared.tsx) already uses - this row used to only
              bump the outline's stroke-width on like, which read as no
              feedback at all ("could we add a colour when we like it"). */}
          <HeartIcon width={16} height={16} strokeWidth={liked ? 0 : 1.8} fill={liked ? 'currentColor' : 'none'} />
        </motion.span>
        {/* ADD aria-live (gap 28): the optimistic count flip was silent to a
            screen reader. polite, not assertive - a like is not an alert. */}
        {typeof likeCount === 'number' ? <span className="aqc-meta-n" aria-live="polite">{likeCount}</span> : null}
      </button>
      <button type="button" className="aqc-meta-btn" onClick={stop(onComment)} disabled={!!busy?.comment} aria-label="Comments" title="Comments">
        <ChatBubbleOvalLeftIcon width={16} height={16} strokeWidth={1.8} />
        {typeof commentCount === 'number' ? <span className="aqc-meta-n">{commentCount}</span> : null}
      </button>
      <span className="aqc-meta-spacer" />
      <button
        type="button"
        className={'aqc-meta-btn' + (savePop ? ' bookmark-pop' : '')}
        onClick={stop(onSave)}
        disabled={!!busy?.save}
        aria-pressed={!!saved}
        aria-label="Save this post"
        title="Save this post"
        style={{
          /* Raw --lemon on white is 1.61:1; --lemon-ink is 5.92:1 (01.15.8).
             Same pair, same transition, as the legacy card's footer. */
          color: saved ? 'var(--lemon-ink)' : undefined,
          transition: 'color 0.18s, transform 0.22s var(--ease-out)',
          transform: saved ? 'scale(1.08)' : 'scale(1)',
        }}
      >
        <BookmarkIcon width={16} height={16} strokeWidth={saved ? 2.5 : 1.8} />
        <span className="sr-only" aria-live="polite">{saved ? 'Saved' : ''}</span>
      </button>
      <button type="button" className="aqc-meta-btn" onClick={stop(onShare)} aria-label="Share this post" title="Share this post">
        <ShareIcon width={16} height={16} strokeWidth={1.8} />
      </button>
    </div>
  )
}

// ── device 6 · the stacked collection ────────────────────────────────────────

/**
 * Three photos, rotations -9deg / 8deg / 0deg, the front one offset, each at
 * radius 18 with its own shadow. Under prefers-reduced-motion the stack keeps
 * its rotations (they are layout, not motion) but loses the hover lift, which
 * cards.css handles.
 */
/**
 * C04's photo stack — a shoot, shown as a fanned set.
 *
 * REBUILT 2026-09-11, twice in one day, and both rounds are worth recording
 * because the second was caused by the first.
 *
 * 1. It shipped with `width: 62%` (of the CONTAINER'S WIDTH) and
 *    `aspect-ratio: 4/5` inside a container fixed at `height: 190px`. Width
 *    and height were therefore set by two unrelated things: on a 626px card
 *    the photos computed to 388x485 inside a 190px box, with no `overflow`
 *    guard anywhere up the chain, and drew straight over the cards above and
 *    below. It had never been seen because C04 only became reachable that
 *    morning - and the dev catalogue at /dev/cards renders C04 with sample
 *    data carrying NO `imageUrls`, so the stack does not render there either.
 *    Neither surface could have caught it.
 *
 * 2. Constraining it by height alone fixed the spill and made it look silly:
 *    three ~147px photos centred in a 555px container, 204px of dead space
 *    either side. Reported immediately, and fairly.
 *
 * So the transforms are computed HERE rather than in CSS. The previous split -
 * rotation inline, one translate in a `!important` CSS rule fighting it - is
 * why the two could never be reasoned about together. One element, one
 * transform, and the fan spreads horizontally so the set fills the card it is
 * given instead of huddling in the middle of it.
 */
/*
 * The offsets are a fraction of EACH PHOTO'S OWN width, not the container's,
 * so the overlap is a constant share of a photo at every card width. Measured
 * in the browser on the live feed: at 58% the middle photo covered 47% of each
 * flanking one, which stops reading as three photos fanned and starts reading
 * as one photo with edges behind it. 68% leaves a ~32% overlap - enough to say
 * "there is more inside", little enough that all three are legible - and
 * spreads the set across 93% of the card instead of 78%.
 */
const STACK_FAN = [
  { x: '-68%', rotate: '-7deg', z: 1 },
  { x: '0%', rotate: '4deg', z: 3 },
  { x: '68%', rotate: '-3deg', z: 2 },
] as const

export function PhotoStack({ images, alt }: { images: { url: string; alt: string }[]; alt?: string }) {
  const three = images.filter(i => !!i.url).slice(0, 3)
  if (three.length === 0) return null
  // One photo is not a fan and two is not a stack - centre what there is
  // rather than leaving a lopsided gap where the third would have been.
  const fan = three.length === 3
    ? STACK_FAN
    : three.length === 2
      ? [{ x: '-36%', rotate: '-5deg', z: 1 }, { x: '36%', rotate: '4deg', z: 2 }] as const
      : [{ x: '0%', rotate: '0deg', z: 1 }] as const
  return (
    <div className="aqc-stack" role="group" aria-label={alt ?? 'Photo collection'} data-count={three.length}>
      {three.map((img, i) => (
        <div
          key={img.url}
          className="aqc-stack-item"
          style={{ transform: `translateX(${fan[i].x}) rotate(${fan[i].rotate})`, zIndex: fan[i].z }}
        >
          <Img src={img.url} alt={img.alt} ctx="card" className="aqc-stack-img" />
        </div>
      ))}
    </div>
  )
}

// ── the live marker ──────────────────────────────────────────────────────────

/**
 * A figure with no source. Guardrail rule 4: never render a figure with no
 * source, and never a zero standing in for one. `1,247` started life as an
 * invented member number and spread to seven places.
 */
export function LiveMarker({ label }: { label?: string }) {
  return (
    <span className="aq-live" title="not fetched yet">
      <span aria-hidden="true">live</span>
      <span className="sr-only">{label ? `${label} is not available yet` : 'not available yet'}</span>
    </span>
  )
}

/** A figure that prints its value, or the dashed marker when it has none. */
export function Figure({ figure, hue }: { figure: CardFigure; hue?: string }) {
  return (
    <span className="aqc-figure">
      {figure.value === null
        ? <LiveMarker label={figure.label} />
        : <span className="aqc-figure-n" style={hue ? { color: hue } : undefined}>{figure.value}</span>}
      <span className="aqc-figure-label">{figure.label}</span>
    </span>
  )
}

// ── the shell every content card sits in ─────────────────────────────────────

/**
 * White card on the paper page, a hairline edge (--hair-2), radius 32
 * (--r-outer). Flat by default, lifted with --lift-1 - the hard offset shadow
 * is now reserved for --btn-primary and a stamped sticker (15.2), not for a
 * card shell at all, so `hero` only swaps in the same soft lift rather than
 * the old hard offset (see cards.css's .aqc-hero-shadow).
 */
export function CardShell({
  children,
  tone = 'paper',
  hero,
  className,
  label,
  style,
  onActivate,
}: {
  children: ReactNode
  tone?: 'paper' | 'ink' | 'plain'
  hero?: boolean
  className?: string
  label?: string
  /** C05 only, so far: the outer shell becomes the category hue fill (15.9). */
  style?: CSSProperties
  /**
   * The card body was activated; the host opens the always-mounted
   * `PostFocusModal`. Same contract the live `FeedPostCard`'s <article
   * onClick={goPost}> has always had, including the part where every
   * interactive child (`MetaRow`, `AuthorPill`, `CardPhoto`, the host's
   * `extras`) stops the click before it gets here. Deliberately NOT given
   * role="button"/tabIndex: that would nest the pill, the photo and four
   * footer controls inside a widget. Keyboard access to the post is the title
   * link the host renders, exactly as before.
   */
  onActivate?: () => void
}) {
  const classes = ['aqc', `aqc-tone-${tone}`, hero ? 'aqc-hero-shadow' : '', className || '']
    .filter(Boolean)
    .join(' ')
  return (
    <article
      className={classes}
      style={onActivate ? { ...style, cursor: 'pointer' } : style}
      aria-label={label}
      onClick={onActivate}
    >
      {children}
    </article>
  )
}
