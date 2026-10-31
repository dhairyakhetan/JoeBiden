import './Breadcrumbs.css'
import { Link } from 'react-router-dom'
import { useJsonLd, breadcrumbLd } from '../hooks/useJsonLd'

/**
 * Visible breadcrumb trail AND its BreadcrumbList JSON-LD, from one list.
 *
 * The site already emitted BreadcrumbList schema on several routes, but there
 * was no breadcrumb anyone could actually see or click — search engines were
 * told a hierarchy that the page itself never showed. Worse, each page
 * hand-wrote its own `breadcrumbLd([...])` call, so the structured data and any
 * future visible trail could drift apart silently.
 *
 * Passing the same array to both closes that: if the trail is wrong on screen,
 * it's wrong in the schema too, and you'll see it.
 *
 * The last crumb is the current page — rendered as text, not a link, and marked
 * aria-current="page". Linking a crumb to the page you're already on is a dead
 * control, and screen readers announce it as a navigation option that goes
 * nowhere.
 *
 * `id` must be unique per route when a page emits more than one JSON-LD block,
 * since useJsonLd keys its managed <script> by id.
 */

export interface BreadcrumbsProps {
  /** Ordered [label, path] pairs, INCLUDING Home and the current page. */
  items: Array<[string, string]>
  /** Unique key for the injected JSON-LD block. */
  id?: string
  className?: string
}

const Breadcrumbs = ({ items, id = 'breadcrumb', className }: BreadcrumbsProps) => {
  // Schema wants the full trail including the current page; so does the trail.
  useJsonLd(id, items.length > 1 ? breadcrumbLd(items) : null)

  if (items.length < 2) return null

  return (
    <nav className={`crumbs${className ? ' ' + className : ''}`} aria-label="Breadcrumb">
      <ol>
        {items.map(([label, path], i) => {
          const isLast = i === items.length - 1
          return (
            <li key={path + label}>
              {isLast
                ? <span className="crumbs-here" aria-current="page">{label}</span>
                : <Link to={path}>{label}</Link>}
              {/* Separator is decorative — the <ol> already conveys sequence,
                  so announcing a slash between every crumb is just noise. */}
              {!isLast && <span className="crumbs-sep" aria-hidden>/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumbs
