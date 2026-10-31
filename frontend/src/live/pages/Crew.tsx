import { Link } from 'react-router-dom'
import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { LIVE } from '../config'
import { Headline, Kicker } from '../components/Headline'

/** The crew behind the nights. Names and faces appear only with consent on file, and none is on file yet, so this says so. */
export function LiveCrew() {
  useMeta(pageMetadata.liveCrew)
  return (
    <main id="lv-main" className="lv-main lv-page">
      <div className="lv-page-head">
        <Kicker>The crew</Kicker>
        <Headline as="h1" text="Who makes the night." />
        <p className="lv-lede">Every AquaTerra night is built by students who volunteer for it.</p>
      </div>
      <div className="lv-empty">
        <strong>Faces after consent.</strong>
        <p>Many of the crew are school students, so a name or a photo goes up only once the person, and a guardian where needed, has said yes. Nobody is listed until then.</p>
        <a className="lv-btn lv-btn-ink" href={`${LIVE.mainSite}teams`}>Meet the AquaTerra teams</a>
      </div>
      <p className="lv-fine">Want to be on the crew? <Link className="lv-link" to={`${LIVE.base}/contact`}>Tell us</Link>.</p>
    </main>
  )
}
