import { Link } from 'react-router-dom'
import type { JobOpening } from '../lib/jobOpenings'
import { openingHue, openingLook, openingLookStyle, openingTilt } from '../lib/openingLook'
import QuickApply from './QuickApply'
import './RoleTile.css'

/** "closes fri" when a deadline is still ahead; "always open" otherwise. */
function closesLabel(op: JobOpening): string {
  if (!op.deadline) return 'always open'
  const days = Math.ceil((new Date(op.deadline).getTime() - Date.now()) / 86400000)
  return days > 0 ? `closes ${new Date(op.deadline).toLocaleDateString('en-IN', { weekday: 'short' }).toLowerCase()}` : 'always open'
}

/**
 * One open role as a bold colour tile: the team on a chip, the role set large, when it closes, and Apply on the tile.
 * Pressing anywhere on the tile opens the apply form (the Apply button stretches over it); "more info" opens the role page.
 * Used on Opportunities and on the Teams page, so a role looks the same wherever it appears.
 */
export default function RoleTile({ op, featured = false }: { op: JobOpening; featured?: boolean }) {
  const look = openingLook(op.id, op.category)
  return (
    <div
      className={'rt-tile' + (featured ? ' rt-featured' : '')}
      data-look={look.pattern}
      style={{ ['--rt-bg' as string]: openingHue(op.teamName, op.category), ['--tilt' as string]: `${openingTilt(op.id)}deg`, ...openingLookStyle(look) }}
    >
      <div className="rt-top">
        <span className="rt-team">{op.teamName || op.category}</span>
        {op.commitment && <span className="rt-commit">{op.commitment}</span>}
      </div>
      <h3 className="rt-title">{op.title}</h3>
      <div className="rt-foot">
        <div className="rt-meta">
          <span className="rt-when">{closesLabel(op)}</span>
          <Link to={`/opportunities/${op.id}`} className="rt-more">more info <span aria-hidden>→</span></Link>
        </div>
        <QuickApply op={op} className="rt-apply" />
      </div>
    </div>
  )
}
