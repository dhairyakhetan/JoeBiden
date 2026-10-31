import { Link } from 'react-router-dom'
import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { LIVE } from '../config'
import { Headline, Kicker } from '../components/Headline'

/**
 * Sponsors, stalls and partners. None has been supplied with permission yet, so the page is one honest empty state and the way
 * in. When the owner sends logos, they become a typed list in data/content.ts and this page renders them above the invitation.
 */
export function LiveCompany() {
  useMeta(pageMetadata.liveCompany)
  return (
    <main id="lv-main" className="lv-main lv-page">
      <div className="lv-page-head">
        <Kicker>Good company</Kicker>
        <Headline as="h1" text="Who we party with." />
        <p className="lv-lede">The sponsors, stalls and partners who make a night happen. They appear here, with their permission, after each one.</p>
      </div>
      <div className="lv-empty">
        <strong>No logos yet.</strong>
        <p>We only show a name or a logo once the people behind it have said yes. The next night is open.</p>
      </div>
      <h2 className="lv-sub">Be part of the next one</h2>
      <ul className="lv-cards">
        <li className="lv-card"><h3 className="lv-card-h">Sponsor a night</h3><p className="lv-card-p">Put your name beside a night that pays for the work.</p><Link className="lv-btn lv-btn-ink" to={`${LIVE.base}/contact?topic=sponsor`}>Talk to us</Link></li>
        <li className="lv-card"><h3 className="lv-card-h">Run a stall</h3><p className="lv-card-p">Food, craft or a game. Tell us what you would bring.</p><Link className="lv-btn lv-btn-ink" to={`${LIVE.base}/contact?topic=stall`}>Talk to us</Link></li>
        <li className="lv-card"><h3 className="lv-card-h">Perform</h3><p className="lv-card-p">A set, a DJ night, a surprise. We would like to hear it.</p><Link className="lv-btn lv-btn-ink" to={`${LIVE.base}/contact?topic=performer`}>Talk to us</Link></li>
      </ul>
    </main>
  )
}
