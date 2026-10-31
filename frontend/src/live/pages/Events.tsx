import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { pastOf, upcomingOf } from '../data/content'
import { useLiveContent } from '../lib/useContent'
import { Headline, Kicker } from '../components/Headline'
import { EventRow } from '../components/EventRow'
import { Marquee } from '../components/Marquee'

export function LiveEvents() {
  useMeta(pageMetadata.liveEvents)
  const { events } = useLiveContent()
  const next = upcomingOf(events)
  return (
    <main id="lv-main" className="lv-main">
      <section className="lv-page">
        <div className="lv-page-head">
          <Kicker>Every night we have thrown</Kicker>
          <Headline as="h1" text="The nights." />
          <p className="lv-lede">The next one first, then the ones that came before. Each night has its own page.</p>
        </div>
        <h2 className="lv-sub">Up next</h2>
        {next.length > 0
          ? <ul className="lv-event-list">{next.map(ev => <EventRow key={ev.slug} ev={ev} />)}</ul>
          : <div className="lv-empty"><strong>Nothing booked yet.</strong><p>The next night is announced here first.</p></div>}
        <h2 className="lv-sub">Past nights</h2>
        <ul className="lv-event-list">{pastOf(events).map(ev => <EventRow key={ev.slug} ev={ev} />)}</ul>
      </section>
      <Marquee ticker items={['Every night leaves a mark', 'Party with a purpose', 'TerraThon', 'Disco Diwali', 'The Summer AQ turns five']} />
    </main>
  )
}
