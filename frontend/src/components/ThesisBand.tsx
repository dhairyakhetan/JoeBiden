import './ThesisBand.css'

/**
 * The one line the whole organisation rests on, as a card. Exact wording, owner-loved (2026-10-18): it
 * lives in the footer so every public page carries it, and on About where it first appeared.
 * A <figure>, not a heading: it is a statement, and the page's own h1/h2 keep the outline.
 */
export default function ThesisBand({ variant = 'page' }: { variant?: 'page' | 'footer' }) {
  return (
    <figure className={'thesis' + (variant === 'footer' ? ' thesis--footer' : '')}>
      <span className="thesis-dot" aria-hidden />
      <span className="thesis-dot-2" aria-hidden />
      <blockquote className="thesis-t" style={{ margin: 0 }}>
        students learn best when <span className="thesis-mark">trusted with real work.</span>
      </blockquote>
      <figcaption className="thesis-k">★ the whole argument, in one line</figcaption>
    </figure>
  )
}
