import { ReactNode } from 'react'
import GlyphIcon, { glyphForEmoji } from './GlyphIcon'

interface EmptyStateProps {
  /** Big emoji or node shown above the title. */
  icon?: ReactNode
  title: string
  /** One line of warm, lowercase guidance - "an empty screen is an invitation to act." */
  hint?: ReactNode
  /** Optional CTA (usually a Link styled as .btn). */
  action?: ReactNode
  /**
   * Optional second, lower-emphasis control shown beside `action` (e.g. a
   * "clear filters" next to a primary "post something"). Purely additive -
   * existing callers that only pass `action` render exactly as before.
   */
  secondary?: ReactNode
  className?: string
}

/**
 * Shared empty state - one voice for every "nothing here yet" screen (saved,
 * my-posts, search, members…). Scrapbook display type + warm lowercase hint.
 *
 * Per changelog/11-system-states.md §11.3: icon/title/hint/actions sit inside
 * a `var(--r-inner)` cream well (the same "cream inset inside a white card"
 * layer used by inputs, 00.10) so the state reads as a designed moment
 * rather than bare text on whatever background the caller used, and
 * `action`/`secondary` render as real controls rather than leaving an
 * action implied only by the hint copy (UX-GAPS.md #20/#22).
 *
 * `action` and `secondary` were already ReactNode slots here (not the
 * `{label, onClick}` object shape §11.3's example JSX shows) before this
 * pass touched the file - kept that way rather than narrowing the type,
 * since existing callers (e.g. feed/SavedPostsPage.tsx) already pass a
 * styled `<Link>`/`<button>` and a stricter shape would break them for no
 * behavioural gain. Wiring an actual action into each empty state is that
 * page's own work: several, e.g. the feed's "try another filter - or post
 * the first one" in public/HomePage.tsx, still pass neither `action` nor
 * `secondary` and remain the exact gap UX-GAPS #22 describes - out of scope
 * here since HomePage.tsx belongs to 01-home-feed.md, a page file.
 *
 * §11.3 also asks for "a 52px hue disc with a geometric glyph (13.7)" in
 * place of an illustrative icon. The live `Sticker` component (a
 * `shape="circle"` with a `mark`) can render that shape, but which hue and
 * which of the six glyphs fits a given empty state is a per-page content
 * call this shared primitive has no basis to guess (§13.7's own component
 * sketch doesn't match Sticker's real, shipped prop API either - it's
 * shape/hue/rotate/mark, not variant="stamped"/size="md"/ground). `icon`
 * therefore stays a plain ReactNode so the existing emoji call sites (✍️,
 * 🔖, …) keep rendering unchanged; swapping any of them to a sticker disc is
 * left to each page file.
 */
function iconNode(icon: ReactNode): ReactNode {
  return typeof icon === 'string' ? <GlyphIcon name={glyphForEmoji(icon)} /> : icon
}

export default function EmptyState({ icon, title, hint, action, secondary, className = '' }: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{ textAlign: 'center', padding: 'clamp(44px,8vw,80px) var(--page-px, 24px)' }}
    >
      <div
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--r-inner)',
          padding: 'clamp(28px,6vw,44px) 24px',
          maxWidth: 480,
          margin: '0 auto',
        }}
      >
        {icon != null && <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }} aria-hidden="true">{iconNode(icon)}</div>}
        <div className="h-display" style={{ fontSize: 'clamp(26px,5vw,40px)', marginBottom: 10, color: 'var(--ink)' }}>
          {title}
        </div>
        {hint && (
          <p style={{ color: 'var(--ink-3)', fontSize: 15, margin: '0 auto', maxWidth: 250, fontFamily: 'var(--eina)', lineHeight: 1.55 }}>
            {hint}
          </p>
        )}
        {(action || secondary) && (
          <div style={{ marginTop: 26, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 10 }}>
            {action}
            {secondary}
          </div>
        )}
      </div>
    </div>
  )
}
