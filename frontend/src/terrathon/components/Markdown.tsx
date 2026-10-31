/**
 * A deliberately tiny Markdown renderer for `terrathon_events.rules_md`.
 *
 * No library and no `dangerouslySetInnerHTML`. Rules text is admin-authored, so
 * it is not hostile input, but it IS database content rendered on a public page
 * and there is no reason to hand it an HTML injection surface. Everything below
 * builds React elements, so anything unrecognised renders as literal text.
 *
 * Supports what rules text actually uses: `## heading`, `- item`, `1. item`,
 * blank-line-separated paragraphs, and inline `**bold**`.
 */
import { Fragment } from 'react'

function inline(text: string, keyBase: string): React.ReactNode[] {
  // Split on **bold** and keep the delimiters out of the output.
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={`${keyBase}-b${i}`}>{part.slice(2, -2)}</strong>
    }
    return <Fragment key={`${keyBase}-t${i}`}>{part}</Fragment>
  })
}

export function Markdown({ source }: { source: string }) {
  const blocks = source.replace(/\r\n/g, '\n').split(/\n{2,}/)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').filter((l) => l.trim().length > 0)
        if (lines.length === 0) return null

        const heading = lines[0].match(/^(#{1,4})\s+(.*)$/)
        if (heading && lines.length === 1) {
          const level = Math.min(4, heading[1].length)
          const size = [26, 22, 18, 16][level - 1]
          return (
            <h3 key={bi} style={{ fontSize: size, textTransform: 'uppercase', marginTop: bi === 0 ? 0 : 6 }}>
              {inline(heading[2], `h${bi}`)}
            </h3>
          )
        }

        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            <ul key={bi} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 7 }}>
              {lines.map((l, li) => (
                <li key={li} style={{ fontSize: 'var(--tt-fs-body)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>
                  {inline(l.replace(/^\s*[-*]\s+/, ''), `u${bi}-${li}`)}
                </li>
              ))}
            </ul>
          )
        }

        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
          return (
            <ol key={bi} style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 7 }}>
              {lines.map((l, li) => (
                <li key={li} style={{ fontSize: 'var(--tt-fs-body)', lineHeight: 1.6, color: 'var(--tt-muted)' }}>
                  {inline(l.replace(/^\s*\d+[.)]\s+/, ''), `o${bi}-${li}`)}
                </li>
              ))}
            </ol>
          )
        }

        return (
          <p key={bi} style={{ margin: 0, fontSize: 'var(--tt-fs-body)', lineHeight: 1.7, color: 'var(--tt-muted)' }}>
            {inline(lines.join(' '), `p${bi}`)}
          </p>
        )
      })}
    </div>
  )
}
