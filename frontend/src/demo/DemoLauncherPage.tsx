import { useState } from 'react'
import { Link } from 'react-router-dom'
import useMeta from '../hooks/useMeta'
import { FLOW_LISTINGS } from './flows/registry'
import './demo.css'

const VISIBLE_COUNT = 3

function FlowRow({ id, name, steps, durationLabel, status, hue }: (typeof FLOW_LISTINGS)[number]) {
  const meta = `${steps} steps · ${durationLabel}`
  const inner = (
    <>
      <span className="demo-flow-hue" style={{ background: hue }} aria-hidden="true">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b className="demo-flow-name">{name}</b>
        <span className="demo-flow-meta">{status === 'ready' ? meta : `${meta} · coming soon`}</span>
      </span>
      {status === 'ready' && (
        <svg className="demo-flow-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </>
  )
  if (status !== 'ready') {
    return <div className="demo-flow-row is-soon" aria-disabled="true">{inner}</div>
  }
  return <Link to={`/demo/${id}`} className="demo-flow-row">{inner}</Link>
}

/**
 * The launcher, `/demo` (19.3). An ink card, three flows shown, the rest
 * behind "all 11 walkthroughs" - eleven rows on a phone is a list, three is
 * an invitation. A real logged-in member landing here is let through
 * unchanged (19's own States list) - the flow they pick still runs under a
 * fully shadowed session regardless of who they actually are.
 */
export default function DemoLauncherPage() {
  // Unresolved item 5: "a search result landing on a fabricated feed is
  // worse than no result." Same noIndex mechanism BrandPage.tsx already
  // uses for its own unlisted route - metaConfig.ts's pageMetadata feeds
  // prerender-meta.mjs's STATIC prerendering of real indexable pages, which
  // is the opposite of what a sandbox route wants, so this follows the
  // existing noindex-utility-route precedent instead of that file.
  useMeta({ title: 'Try the walkthrough | AquaTerra', noIndex: true })
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? FLOW_LISTINGS : FLOW_LISTINGS.slice(0, VISIBLE_COUNT)

  return (
    <div className="demo-launcher">
      <div className="demo-launcher-card">
        <div className="demo-kicker">★ a walkthrough · nothing is saved</div>
        <h1 className="demo-launcher-headline">
          see what<br />it's like<br /><em>from inside.</em>
        </h1>
        <p className="demo-launcher-lede">
          You'll use the real thing, with made-up people. Click where we point. Nothing you do here is saved, and you can leave at any point.
        </p>
        <div className="demo-flow-list">
          {visible.map(f => <FlowRow key={f.id} {...f} />)}
          {!showAll && (
            <button type="button" className="demo-flow-more" onClick={() => setShowAll(true)}>
              all 11 walkthroughs
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
