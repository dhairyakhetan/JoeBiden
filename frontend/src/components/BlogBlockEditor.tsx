import { useRef } from 'react'

// Formatting toolbar for the blog composer.
//
// Storage format is MARKDOWN, not a block JSON tree, and that is deliberate:
// BlogPostPage already parses '## ' as a heading and '> ' as a pullquote, and
// the 36 imported blogs are plain text in that same shape. A JSON block model
// would mean a second renderer plus a migration for every existing post, for
// no reader-visible gain.
//
// Every action is line-oriented and idempotent-ish: applying a prefix that is
// already present removes it, so the buttons toggle rather than stacking
// ('## ## Heading').

type Action = {
  key: string
  label: string
  title: string
  /** Line prefix toggled on each selected line. */
  prefix?: string
  /** Inline wrapper placed around the selection. */
  wrap?: string
}

/**
 * ONLY what the reader actually renders.
 *
 * public/BlogPostPage.tsx's paragraph renderer handles exactly two markers:
 * a `## ` prefix becomes an <h2> and a `> ` prefix becomes a <blockquote>.
 * There is no list, bold or italic pass, so the three buttons that used to
 * sit here - `- `, `**`, `_` - put literal asterisks, underscores and hyphens
 * into published prose. An author pressed B and shipped `**their emphasis**`.
 *
 * Checked before removing rather than adding renderers for them: of the 33
 * published essays, ZERO contain an asterisk or an underscore at all, and the
 * single one with `- ` lines opens "- What if..." as rhetoric, not as a list
 * (BlogPostPage's drop-cap code already carries a note about that post). So
 * nothing published gains from a markdown pass, and treating that essay's
 * dashes as bullets would change how it reads.
 *
 * If inline emphasis is wanted later, the renderer is the place to start, and
 * this array follows it - not the other way round.
 */
const ACTIONS: Action[] = [
  { key: 'h2',        label: 'H',  title: 'Heading',    prefix: '## ' },
  { key: 'quote',     label: '❝',  title: 'Pull quote', prefix: '> ' },
]

export default function BlogBlockEditor({
  value,
  onChange,
  placeholder,
  maxLength = 5000,
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  maxLength?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const apply = (a: Action) => {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd

    if (a.wrap) {
      const sel = value.slice(start, end)
      // Nothing selected: drop in the markers and park the caret between them
      // rather than silently doing nothing.
      const next =
        value.slice(0, start) + a.wrap + sel + a.wrap + value.slice(end)
      onChange(next)
      requestAnimationFrame(() => {
        el.focus()
        const caret = start + a.wrap!.length + sel.length
        el.setSelectionRange(sel ? caret + a.wrap!.length : caret, sel ? caret + a.wrap!.length : caret)
      })
      return
    }

    const prefix = a.prefix!
    // Expand the selection to whole lines - a prefix only means anything at the
    // start of a line, so a partial selection must not split one.
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const lineEndIdx = value.indexOf('\n', end)
    const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx

    const block = value.slice(lineStart, lineEnd)
    const lines = block.split('\n')
    const allPrefixed = lines.every(l => l.startsWith(prefix))
    const nextBlock = lines
      .map(l => (allPrefixed ? l.slice(prefix.length) : prefix + l))
      .join('\n')

    const next = value.slice(0, lineStart) + nextBlock + value.slice(lineEnd)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(lineStart, lineStart + nextBlock.length)
    })
  }

  const over = value.length > maxLength

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div
        role="toolbar"
        aria-label="Article formatting"
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        {/* 44px touch-target floor (mobile) - raised from the old height: 30.
            This row wraps (flexWrap: 'wrap') instead of sharing a fixed-height
            row with anything else, so there's no collision risk here like the
            one that capped OpeningQuestionBuilder's stacked reorder buttons
            below 44px. */}
        {ACTIONS.map(a => (
          <button
            key={a.key}
            type="button"
            title={a.title}
            aria-label={a.title}
            onClick={() => apply(a)}
            style={{
              minWidth: 34, height: 44, padding: '0 10px',
              // toolbar chips are a control surface, not a CTA or a sticker:
              // 2px ink + 2px hard offset -> hairline + --lift-1, 8 -> --r-tight
              border: 'var(--hair-2)', borderRadius: 'var(--r-tight)',
              background: 'var(--bg-2)', color: 'var(--ink)',
              fontFamily: a.key === 'italic' ? 'var(--serif)' : 'var(--display)',
              fontStyle: a.key === 'italic' ? 'italic' : 'normal',
              fontWeight: 800, fontSize: 13, cursor: 'pointer',
              boxShadow: 'var(--lift-1)',
            }}
          >
            {a.label}
          </button>
        ))}
        <span
          className="mono"
          style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 10, color: 'var(--ink-3)' }}
        >
          markdown
        </span>
      </div>

      <textarea
        ref={ref}
        className="input"
        rows={10}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          resize: 'vertical', minHeight: 220,
          // No fontSize here: an inline one beats `.input`'s 16px, which
          // v6.css sets specifically to suppress iOS Safari's focus zoom. This
          // is the longest-typing field in the app, inside a full-screen sheet.
          fontFamily: 'var(--eina)', lineHeight: 1.7,
        }}
      />

      <div
        className="mono"
        style={{
          fontSize: 10, textAlign: 'right',
          color: over ? 'var(--tomato)' : 'var(--ink-3)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value.length}/{maxLength}
      </div>
    </div>
  )
}
