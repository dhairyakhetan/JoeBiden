import { Link } from 'react-router-dom'
import type { DemoEndCard as DemoEndCardData } from './flows/types'
import { setAuthIntent } from '../lib/authIntent'

/**
 * The welfare end card (19's States section). `Join AquaTerra` matches the
 * exact CTA + destination HomePage.tsx's own sample-preview banner already
 * uses for a logged-out visitor (`<Link to="/login">Join AquaTerra`) - the
 * real signup funnel is Google-OAuth-only through /login (CLAUDE.md), so
 * this sends a convinced visitor to the actual front door, not a dead end.
 *
 * The two secondary pills are `var(--paper)` text on `rgba(10,10,10,.34)`,
 * not ink on `rgba(10,10,10,.1)` - 19's own invariant-7 call-out: a
 * translucent dark overlay on the --welfare fill composites to ~#197d52,
 * and ink on that measures 3.87:1.
 */
export default function DemoEndCard({ data, flowName, onTryAnother }: { data: DemoEndCardData; flowName: string; onTryAnother: () => void }) {
  return (
    <div className="demo-end">
      <div className="demo-end-card">
        <span className="demo-end-badge">{data.kicker}</span>
        <h2 className="demo-end-headline">{data.headline}</h2>
        <p className="demo-end-body">{data.body}</p>
        <div className="demo-end-actions">
          <Link to="/login" className="demo-end-primary" onClick={() => setAuthIntent({ kind: 'demo', flowName })}>Join AquaTerra</Link>
          <div className="demo-end-secondary-row">
            <button type="button" className="demo-end-secondary" onClick={onTryAnother}>Try another</button>
            <Link to="/" className="demo-end-secondary">Just browse</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
