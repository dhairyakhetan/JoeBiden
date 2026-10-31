import { Link } from 'react-router-dom'
import { CAT_COLORS } from '../lib/jobOpenings'
import './HiringCard.css'

interface HiringCardProps {
  /** Role title (from the opening / source_title, falling back to the post body). */
  title: string
  category?: string
  /** Short one-liner, e.g. "2–3 hrs/week · closes Aug 12". */
  meta?: string
  /** Where "apply →" goes. Defaults to the openings board. */
  href?: string
  /** Kept so existing callers still type-check; the card no longer tilts. */
  seed?: number
}

const CAT_LABEL: Record<string, string> = {
  events: 'events', welfare: 'welfare', labs: 'labs', operations: 'ops', ops: 'ops', content: 'content',
}

/**
 * Compact "we're hiring" card for job_opening posts, used in the feed and the directory. It takes the category's
 * fill, the same one the home rail's open-roles card and the roles board use, so one role looks like one thing
 * wherever it shows up. Ink text on the fill (contrast law §1.2). Styles are in HiringCard.css.
 */
export default function HiringCard({ title, category, meta, href = '/opportunities' }: HiringCardProps) {
  return (
    <Link to={href} className="hiring-card" style={{ ['--rc' as string]: (category && CAT_COLORS[category === 'ops' ? 'operations' : category]) || 'var(--welfare)' }}>
      <div className="hiring-card-top">
        <span className="mono hiring-card-kicker">★ we're hiring</span>
        {category && <span className="mono hiring-card-cat">{CAT_LABEL[category] || category}</span>}
      </div>
      <h2 className="h-display hiring-card-title">{title}</h2>
      <div className="hiring-card-foot">
        <span className="mono hiring-card-meta">{meta || 'open role · 2 min to apply'}</span>
        <span className="h-display hiring-card-go">apply →</span>
      </div>
    </Link>
  )
}
