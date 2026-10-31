import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { BOOK_LABEL, LIVE, DISCO, NEXT_EVENT, CHAPTERS } from '../config'
import { pastOf } from '../data/content'
import { useLiveContent } from '../lib/useContent'
import { Headline, Kicker } from '../components/Headline'
import { Countdown } from '../components/Countdown'
import { PinnedStrip } from '../components/PinnedStrip'
import { Marquee } from '../components/Marquee'
import { PhotoArc } from '../components/PhotoArc'
import { StarField } from '../components/StarField'
import { EventRow } from '../components/EventRow'
import { ContactLine, ticketHref } from '../components/ContactLine'
import { useScrollReveal } from '../lib/hooks'
import '../disco.css'

export function LiveHome() {
  useMeta(pageMetadata.live)
  const { events, programmes } = useLiveContent()
  const rootRef = useRef<HTMLElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const [pin, setPin] = useState(false)
  useScrollReveal(rootRef)
  useEffect(() => {
    const el = heroRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setPin(!e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const cta = ticketHref()

  return (
    <main id="lv-main" ref={rootRef} className="lv-main dd">
      <PinnedStrip show={pin} />

      <section ref={heroRef} className="dd-hero lv-hero-grad" aria-labelledby="lv-hero-h">
        <p className="lv-kicker dd-kick">AquaTerra.live · Kolkata</p>
        <h1 id="lv-hero-h" className="dd-title lv-home-title" aria-label="Party with a purpose.">
          {['Party with', 'a purpose.'].map((word, w) => (
            <span key={word} className="dd-word" aria-hidden>
              {word.split('').map((c, i) => <span key={i} className="dd-ch" style={{ ['--i' as string]: i + w * 8 }}>{c === ' ' ? '\u00a0' : c}</span>)}
            </span>
          ))}
        </h1>
        <p className="dd-hero-lede">Every fundraising night AquaTerra throws, in one place.</p>
        <p className="dd-hero-when"><span>{NEXT_EVENT.dateShort} · {NEXT_EVENT.venueShort}</span>{DISCO.time && <span className="dd-when-t">{DISCO.time}</span>}</p>
        <div className="lv-actions dd-hero-actions">
          {cta
            ? <a className="lv-btn lv-btn-gold lv-btn-lg" href={cta} target="_blank" rel="noopener noreferrer">{BOOK_LABEL}</a>
            : <Link className="lv-btn lv-btn-gold lv-btn-lg" to={DISCO.base}>See what&apos;s next</Link>}
          {cta && <Link className="lv-btn lv-btn-ink lv-btn-lg" to={DISCO.base}>See what&apos;s next</Link>}
          <Link className="lv-link" to={`${LIVE.base}/events`}>All the nights</Link>
        </div>
        <div className="dd-arc"><PhotoArc /></div>
      </section>

      <Marquee ticker items={['TerraThon', 'Starry Night', 'Disco Diwali', 'Paradox', 'Party with a purpose', 'Every night leaves a mark']} />

      {/* the next night, on black with the stars out */}
      <section id="lv-next" className="lv-band lv-tone-night dd-band lv-reveal" aria-labelledby="lv-next-h">
        <StarField lights />
        <div className="lv-section dd-above lv-next-in">
          <span className="lv-sticker">Upcoming</span>
          <h2 id="lv-next-h" className="lv-next-h">{NEXT_EVENT.name}<br /><em>{NEXT_EVENT.edition}</em></h2>
          <p className="dd-when">{NEXT_EVENT.dateLabel}{DISCO.time ? ` · ${DISCO.time}` : ''} · {NEXT_EVENT.venue}</p>
          <Countdown date={NEXT_EVENT.date} />
          <div className="lv-actions dd-hero-actions">
            <Link className="lv-btn lv-btn-line lv-btn-lg" to={DISCO.base}>See the night</Link>
            {cta && <a className="lv-btn lv-btn-gold lv-btn-lg" href={cta} target="_blank" rel="noopener noreferrer">{BOOK_LABEL}</a>}
          </div>
          <ContactLine message="Hi, I have a question about Disco Diwali." />
        </div>
      </section>

      <section className="lv-section lv-reveal" aria-labelledby="lv-who-h">
        <Kicker>{CHAPTERS.who}</Kicker>
        <h2 id="lv-who-h" className="lv-lede-xl">
          AquaTerra is a youth-led NGO in Kolkata<i className="dot" aria-hidden />and this is where we host every fundraising night we run: TerraThon, Starry Night, Disco Diwali, Paradox, and the ones still to come.
        </h2>
        <div className="lv-cols-s">
          <p>Each night is a proper night out, and each one pays for the work we do the rest of the year.</p>
          <p>The photos, the dates and the story of every night live here. Past nights are in the Vault.</p>
        </div>
      </section>

      <section className="lv-section lv-reveal" aria-labelledby="lv-nights-h">
        <Kicker>The nights</Kicker>
        <Headline id="lv-nights-h" text="Where the nights live." />
        <ul className="lv-event-list">
          {pastOf(events).slice(0, 3).map(ev => <EventRow key={ev.slug} ev={ev} />)}
        </ul>
        <div className="lv-actions dd-cause-actions">
          <Link className="lv-btn lv-btn-ink" to={`${LIVE.base}/events`}>Every night</Link>
          <Link className="lv-btn lv-btn-line" to={`${LIVE.base}/vault`}>Open the Vault</Link>
        </div>
      </section>

      <section className="lv-band lv-tone-red lv-reveal" aria-labelledby="lv-cause-h">
        <div className="lv-section">
          <Kicker>{CHAPTERS.cause}</Kicker>
          <h2 id="lv-cause-h" className="lv-h">No grants. No parent company. <em>Just your night out.</em></h2>
          <p className="lv-lede">
            AquaTerra has no funder behind it. Events like these are how our drives and welfare work get paid for.
            You come for the music; the money goes to the programmes.
          </p>
          <ul className="lv-cards">
            {programmes.map(p => (
              <li key={p.name} className="lv-card">
                {p.photo && <img className="lv-prog-img" src={`/live/programmes/${p.photo}.webp`} width={800} height={720} alt={p.photoAlt ?? ''} loading="lazy" decoding="async" />}
                <h3 className="lv-card-h">{p.name}</h3><p className="lv-card-p">{p.line}</p>
              </li>
            ))}
          </ul>
          <div className="lv-actions dd-cause-actions">
            <Link className="lv-btn lv-btn-gold" to={`${LIVE.base}/why`}>Why we host</Link>
            <a className="lv-btn lv-btn-line" href={LIVE.mainSite}>See what AquaTerra does</a>
          </div>
        </div>
      </section>

      <section className="lv-section lv-reveal" aria-labelledby="lv-ask-h">
        <Kicker>{CHAPTERS.ask}</Kicker>
        <Headline id="lv-ask-h" text="Ask us anything." />
        <p className="lv-lede">Tickets, timings, what to wear. The questions people ask most are answered, and a real person answers the rest.</p>
        <div className="lv-actions">
          <Link className="lv-btn lv-btn-ink" to={`${LIVE.base}/faq`}>Read the FAQ</Link>
          <Link className="lv-btn lv-btn-line" to={`${LIVE.base}/contact`}>Contact the team</Link>
        </div>
      </section>
      <div className="lv-edge-grad dd-edge dd-edge-end"><Marquee ticker items={['Party with a purpose', 'Every night leaves a mark', 'Disco Diwali · 10 November 2026', 'All for charity']} /></div>
    </main>
  )
}
