import type { ReactNode } from 'react'

/**
 * The drawn icons that stand in wherever an emoji used to be an icon (DESIGN.md: emoji are not icons). Stroke only, on the
 * current ink, in a soft hue disc, so one weight and one disc serve every empty state, card and popup.
 *
 * Add a glyph by adding a path to GLYPHS; `glyphForEmoji` maps the emoji old call sites still pass.
 */
export type GlyphName =
  | 'lock' | 'pen' | 'cap' | 'calendar' | 'bookmark' | 'search' | 'inbox' | 'collab' | 'certificate' | 'cake'
  | 'tee' | 'hoodie' | 'cap-hat' | 'camera' | 'sparkle' | 'thread' | 'shoe'

const GLYPHS: Record<GlyphName, ReactNode> = {
  lock: <><rect x="5" y="11" width="14" height="9" rx="3" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  pen: <><path d="M4 20l4-1 11-11a2.1 2.1 0 0 0-3-3L5 16l-1 4z" /><path d="M14 7l3 3" /></>,
  cap: <><path d="M2 9l10-5 10 5-10 5-10-5z" /><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" /><path d="M22 9v6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  bookmark: <path d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></>,
  inbox: <><path d="M3 13l2.5-7h13L21 13" /><path d="M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-5l-1.5 2.5h-3L8 13H3z" /></>,
  collab: <><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></>,
  certificate: <><rect x="4" y="3" width="16" height="13" rx="2" /><path d="M8 8h8M8 12h5" /><path d="M9 16l-1 5 4-2 4 2-1-5" /></>,
  tee: <path d="M8 4L3 7l2 4 3-1v10h8V10l3 1 2-4-5-3c-.6 1.3-2 2-4 2s-3.4-.7-4-2z" />,
  hoodie: <><path d="M9 4C9 6 10.3 7 12 7s3-1 3-3" /><path d="M9 4L3 7l1.5 5L7 11v9h10v-9l2.5 1L21 7l-6-3" /><path d="M10 14h4v3h-4z" /></>,
  'cap-hat': <><path d="M4 16a8 8 0 0 1 16 0" /><path d="M2 16h20c0 1.5-2 2.5-4 2.5H6c-2 0-4-1-4-2.5z" /></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></>,
  sparkle: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17v4M17 19h4" /></>,
  thread: <><circle cx="12" cy="12" r="8" /><path d="M7 9c3-2 7-2 10 0M6.5 13c3.5-2 7.5-2 11 0M8 17c2.5-1.5 5.5-1.5 8 0" /></>,
  shoe: <><path d="M3 16V9l5 2 3-3 3 3c3 0 7 1 7 5v1H3z" /><path d="M3 19h18" /></>,
  cake: <><path d="M4 20h16M5 20v-7h14v7" /><path d="M5 16c2 1.5 3 1.5 5 0s3-1.5 5 0 3 1.5 4 0" /><path d="M12 13V9" /><path d="M12 9c-1-1-1-2 0-3 1 1 1 2 0 3z" /></>,
}

const EMOJI: Record<string, GlyphName> = {
  '👕': 'tee', '🧥': 'hoodie', '🧢': 'cap-hat', '📸': 'camera', '✨': 'sparkle', '🧵': 'thread', '👟': 'shoe', '🔒': 'lock', '✍': 'pen', '🎓': 'cap', '🗓': 'calendar', '📅': 'calendar', '🔖': 'bookmark', '🔍': 'search',
  '📭': 'inbox', '🤝': 'collab', '📜': 'certificate', '🎂': 'cake',
}

/** The glyph for an emoji a caller still passes; anything unlisted becomes the inbox. */
export function glyphForEmoji(emoji: string): GlyphName {
  return EMOJI[emoji.replace(/️/g, '').trim()] || 'inbox'
}

export default function GlyphIcon({ name, size = 64, label }: { name: GlyphName; size?: number; label?: string }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{
        display: 'inline-grid', placeItems: 'center', width: size, height: size, borderRadius: '50%', flex: 'none',
        background: 'color-mix(in srgb, var(--welfare) 22%, transparent)',
      }}
    >
      <svg width={Math.round(size * 0.47)} height={Math.round(size * 0.47)} viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {GLYPHS[name]}
      </svg>
    </span>
  )
}
