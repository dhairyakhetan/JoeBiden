import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { LIVE } from '../config'
import { useLiveContent } from '../lib/useContent'
import { Photo } from '../components/Photo'
import { Headline, Kicker } from '../components/Headline'
import { Marquee } from '../components/Marquee'
import { useScrollReveal } from '../lib/hooks'

export function LiveWhy() {
  useMeta(pageMetadata.liveWhy)
  const { programmes } = useLiveContent()
  const root = useRef<HTMLElement>(null)
  useScrollReveal(root)
  return (
    <main id="lv-main" ref={root} className="lv-main">
      <section className="lv-page lv-reveal">
        <div className="lv-page-head">
          <Kicker>Why we host</Kicker>
          <Headline as="h1" text="A party that pays." />
        </div>
        <h2 className="lv-lede-xl">
          AquaTerra was founded on 11 June 2021 in Kolkata, by a school student, during COVID<i className="dot" aria-hidden />and it has never had a funder. The nights are how the work gets paid for.
        </h2>
        <div className="lv-cols-s">
          <p>There are no grants and no parent company behind AquaTerra. It is run by students, and the money has to come from somewhere.</p>
          <p>So we throw proper nights out. You come for the music, and every ticket goes to the programmes below. A plain breakdown by programme will be published here.</p>
        </div>
      </section>

      <section className="lv-band lv-tone-red lv-reveal" aria-labelledby="why-prog-h">
        <div className="lv-section">
          <Kicker>What the nights pay for</Kicker>
          <Headline id="why-prog-h" text="The programmes." />
          <ul className="lv-cards">
            {programmes.map(p => (
              <li key={p.name} className="lv-card">
                {p.photo && <img className="lv-prog-img" src={`/live/programmes/${p.photo}.webp`} width={800} height={720} alt={p.photoAlt ?? ''} loading="lazy" decoding="async" />}
                <h3 className="lv-card-h">{p.name}</h3><p className="lv-card-p">{p.line}</p>
              </li>
            ))}
          </ul>
          <p className="lv-fine">We name programmes here and do not print rupee figures until a verified breakdown exists.</p>
        </div>
      </section>

      <section className="lv-section lv-reveal">
        <Photo id="drapes" size="m" wipe className="lv-wide-photo" alt="A red drape canopy strung with fairy lights over a courtyard at a past night." />
        <div className="lv-actions dd-cause-actions">
          <a className="lv-btn lv-btn-ink" href={LIVE.mainSite}>See what AquaTerra does</a>
          <Link className="lv-btn lv-btn-line" to={`${LIVE.base}/events`}>The nights</Link>
        </div>
      </section>
      <Marquee ticker items={['No grants', 'No parent company', 'Just your night out', 'Party with a purpose']} />
    </main>
  )
}
