import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { ASK, BOOK_LABEL, DISCO, LIVE, NEXT_EVENT } from '../config'
import { useLiveContent } from '../lib/useContent'
import { Photo } from '../components/Photo'
import { Headline, Kicker } from '../components/Headline'
import { Countdown } from '../components/Countdown'
import { PinnedStrip } from '../components/PinnedStrip'
import { Marquee } from '../components/Marquee'
import { PhotoArc } from '../components/PhotoArc'
import { StarField } from '../components/StarField'
import { Sticker } from '../components/Sticker'
import { PosterRail } from '../components/PosterRail'
import { ContactLine, ticketHref } from '../components/ContactLine'
import { useScrollReveal } from '../lib/hooks'
import '../disco.css'

const TBA = 'To be announced'

const STEPS: { n: string; h: string; p: string; photo: string }[] = [
  { n: '01', h: `Message ${ASK.name.split(' ')[0]}`, p: 'Say you want a Disco Diwali ticket. The button below opens the chat for you.', photo: 'drapes' },
  { n: '02', h: 'Pay by UPI', p: 'The current phase and price are confirmed in the chat, so you see them before you pay.', photo: 'pinkphone' },
  { n: '03', h: 'Get your ID', p: 'Once the payment is confirmed you receive a booking ID that looks like DD26-XXXX.', photo: 'balloon' },
  { n: '04', h: 'Show it at the door', p: 'Bring the ID and a mask. That is all you need to get in.', photo: 'friends' },
]

export function LiveDiscoDiwali() {
  useMeta(pageMetadata.liveDisco)
  const { programmes } = useLiveContent()
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
  const claim = cta && <a className="lv-btn lv-btn-gold lv-btn-lg" href={cta} target="_blank" rel="noopener noreferrer">{BOOK_LABEL}</a>

  return (
    <main id="lv-main" ref={rootRef} className="lv-main dd">
      <PinnedStrip show={pin} />

      {/* ── hero: red-to-paper gradient, blackletter title, the photo arc ─────────── */}
      <section ref={heroRef} className="dd-hero lv-hero-grad" aria-labelledby="dd-h1">
        <p className="lv-kicker dd-kick">AquaTerra.live presents</p>
        <h1 id="dd-h1" className="dd-title" aria-label="Disco Diwali">
          {['Disco', 'Diwali'].map((word, w) => (
            <span key={word} className="dd-word" aria-hidden>
              {word.split('').map((c, i) => <span key={i} className="dd-ch" style={{ ['--i' as string]: i + w * 6 }}>{c}</span>)}
            </span>
          ))}
        </h1>
        <p className="dd-sub">The Masquerade <em>Sangeet</em> Edition</p>
        <p className="dd-hero-lede">
          A masquerade night under the Diwali sky, with a mirror ball hung over it. Every ticket is for charity.
        </p>
        <Countdown date={NEXT_EVENT.date} />
        <div className="lv-actions dd-hero-actions">
          {claim}
          <a className="lv-btn lv-btn-ink lv-btn-lg" href="#dd-night">The night</a>
        </div>
        <div className="dd-arc">
          <PhotoArc />
          <aside className="lv-paper-card is-night dd-prog" aria-label="Date and place">
            <img src="/live/disco/title.webp" width={1200} height={639} alt="" loading="eager" />
            <p>{NEXT_EVENT.dateLabel}{DISCO.time ? ` · ${DISCO.time}` : ''}</p>
            <p>{DISCO.venueName ?? TBA}, Kolkata</p>
          </aside>
          <img className="dd-mask" src="/live/disco/mask.webp" width={760} height={500} alt="" aria-hidden loading="lazy" />
        </div>
      </section>

      <Marquee ticker items={['Masks on', '10 November 2026', 'Disco Diwali', 'All for charity', 'The Masquerade Sangeet Edition', 'Kolkata', 'Party with a purpose']} />

      {/* the three things a buyer needs, large */}
      <section className="dd-facts lv-reveal" aria-label="Date, time and place">
        <dl>
          <div><dt>Date</dt><dd>{NEXT_EVENT.dateShort}</dd></div>
          <div><dt>Time</dt><dd>{DISCO.time ?? TBA}</dd></div>
          <div><dt>Place</dt><dd>{DISCO.venueName ?? TBA}</dd></div>
        </dl>
      </section>

      {/* ── 01 the night: an editorial page ───────────────────────────────────────── */}
      <section id="dd-night" className="lv-section dd-intro lv-reveal" aria-labelledby="dd-night-h">
        <Kicker>01 / The night</Kicker>
        <h2 id="dd-night-h" className="lv-lede-xl">
          Diwali lights the city. We hang a mirror ball over it<i className="dot" aria-hidden />ask you to wear a mask<i className="dot" aria-hidden />and make the whole night for charity.
        </h2>
        <div className="lv-cols-s">
          <p>
            <b>Date</b> {NEXT_EVENT.dateLabel}, a Tuesday. <b>Time</b> {DISCO.time ?? TBA}. <b>Place</b> {DISCO.venueName ?? TBA}, Kolkata.
            {!DISCO.time || !DISCO.venueName ? ' Ticket holders are messaged the moment the rest is confirmed.' : ''}
          </p>
          <p>
            <b>Tickets</b> on WhatsApp, paid by UPI and confirmed by the team with a DD26 booking ID. The current phase and price
            are shared in the chat. <b>Dress code</b> a mask.
          </p>
        </div>
        <div className="dd-collage">
          <h3 className="dd-giant" aria-label="November, Kolkata">
            <span aria-hidden>Nov</span>
            <span aria-hidden>Kolkata</span>
          </h3>
          <small className="dd-giant-l">10 · 2026</small>
          <small className="dd-giant-r">{DISCO.venueName ?? 'Venue soon'}</small>
          <Sticker name="calendar" size="calc(var(--g) * 0.78)" rot={-9} className="dd-st-cal" />
          <Sticker name="pin" size="calc(var(--g) * 0.62)" rot={8} className="dd-st-pin" />
          <Photo id="chandelier" size="s" className="dd-ph dd-ph-a" />
          <Photo id="friends" size="s" className="dd-ph dd-ph-b" />
          <Photo id="booth" size="m" wipe className="dd-full" alt="Guests in masks posing at a past Disco Diwali photo booth, under a black and silver balloon arch." />
        </div>
      </section>
      <div className="lv-edge-grad dd-edge"><Marquee ticker items={['It is more than a party', 'It is a night that pays for the work', 'Every ticket is for charity', 'Bring a mask']} /></div>

      {/* ── 02 boarding: numbered steps with thumbnails ───────────────────────────── */}
      <section className="lv-band lv-tone-night dd-band lv-reveal" aria-labelledby="dd-go-h">
        <StarField lights />
        <div className="lv-section dd-above">
          <Kicker>02 / Boarding</Kicker>
          <Headline id="dd-go-h" text="Four steps to your seat." />
          <ol className="dd-steps">
            {STEPS.map(s => (
              <li key={s.n}>
                <span className="dd-step-n" aria-hidden>{s.n}</span>
                <h3>{s.h}</h3>
                <p>{s.p}</p>
                <Photo id={s.photo} size="s" className="dd-step-ph" />
              </li>
            ))}
          </ol>
          <div className="lv-actions">{claim}</div>
        </div>
      </section>

      {/* ── 03 mask code ──────────────────────────────────────────────────────────── */}
      <section className="lv-band lv-tone-red dd-mask-band lv-reveal" aria-labelledby="dd-mask-h">
        <div className="lv-section dd-split">
          <div>
            <Kicker>03 / Mask code</Kicker>
            <Headline id="dd-mask-h" text="Masks on." />
            <p className="lv-lede">It is a masquerade, so wear a mask. That is the one rule.</p>
            <div className="lv-paper-card dd-code">
              <h3>Dress code</h3>
              <p>A mask. That is the whole code.</p>
            </div>
          </div>
          <div className="dd-split-art" aria-hidden>
            <img className="dd-mask-big" src="/live/disco/mask.webp" width={760} height={500} alt="" loading="lazy" />
          </div>
        </div>
      </section>

      {/* ── 04 the constellation (lineup) ─────────────────────────────────────────── */}
      <section className="lv-section lv-reveal" aria-labelledby="dd-line-h">
        <Kicker>04 / The constellation</Kicker>
        <Headline id="dd-line-h" text="Who lights the sky." />
        <div className="lv-empty dd-lineup">
          <svg className="dd-lineup-art" viewBox="0 0 600 200" aria-hidden focusable="false">
            <g className="dd-lineup-lines">
              <polyline points="50,140 160,60 280,110 390,40 540,100" />
              <polyline points="160,60 215,170 280,110" />
              <polyline points="390,40 450,160 540,100" />
            </g>
            {[[50, 140], [160, 60], [280, 110], [390, 40], [540, 100], [215, 170], [450, 160]].map(([x, y], i) => (
              <circle key={i} className="dd-lineup-node" cx={x} cy={y} r={i % 3 === 0 ? 11 : 8} style={{ animationDelay: `${i * 0.4}s` }} />
            ))}
          </svg>
          <strong>Not announced yet.</strong>
          <p>When the lineup is confirmed, every name lands on this sky.</p>
          <Sticker name="star" size={92} rot={12} className="dd-st-star" />
        </div>
      </section>

      {/* ── 05 the editions ───────────────────────────────────────────────────────── */}
      <section className="lv-section lv-reveal" aria-labelledby="dd-ed-h">
        <Kicker>05 / The editions</Kicker>
        <Headline id="dd-ed-h" text="Three Diwalis. One cause." />
        <ol className="dd-editions">
          {DISCO.editions.map(ed => (
            <li key={ed.year} className={'dd-edition-node' + (ed.now ? ' is-now' : '')}>
              <span className="dd-edition-star" aria-hidden />
              <span className="dd-edition-year">{ed.year}</span>
              <span className="dd-edition-name">{ed.name}</span>
              {ed.now && <span className="lv-sticker dd-edition-tag">This year</span>}
              {ed.now && <Sticker name="diya" size={86} rot={-6} className="dd-st-diya" />}
            </li>
          ))}
        </ol>
      </section>

      {/* ── 06 the posters ────────────────────────────────────────────────────────── */}
      <section className="lv-section lv-reveal dd-posters" aria-labelledby="dd-post-h">
        <Kicker>06 / From the feed</Kicker>
        <Headline id="dd-post-h" text="The posters so far." />
        {claim && <div className="lv-actions dd-poster-actions">{claim}</div>}
        <PosterRail />
      </section>

      {/* ── 07 the cause ──────────────────────────────────────────────────────────── */}
      <section className="lv-section lv-reveal dd-cause-sec" aria-labelledby="dd-cause-h">
        <Kicker>07 / Where the light goes</Kicker>
        <Sticker name="heart" size={110} rot={10} className="dd-st-heart" />
        <h2 id="dd-cause-h" className="lv-h">No grants. No parent company. <em>Just your night out.</em></h2>
        <p className="lv-lede">
          AquaTerra is a youth-led NGO in Kolkata with no funder behind it. You come for the music; the money goes to the programmes.
          A plain breakdown will be published here.
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
          <Link className="lv-btn lv-btn-ink" to={`${LIVE.base}/why`}>Why we host</Link>
          <Link className="lv-btn lv-btn-line" to={`${LIVE.base}/faq`}>Read the FAQ</Link>
        </div>
      </section>

      {/* ── the final call ────────────────────────────────────────────────────────── */}
      <section className="lv-band lv-tone-night dd-band dd-final lv-reveal" aria-labelledby="dd-final-h">
        <StarField lights />
        <div className="lv-section dd-above dd-final-in">
          <Headline as="h2" id="dd-final-h" text="See you under the lights." className="dd-final-h" />
          <p className="dd-when">{NEXT_EVENT.dateLabel} · {DISCO.venueName ?? 'Kolkata'}</p>
          {claim}
          <ContactLine message="Hi, I have a question about Disco Diwali." />
        </div>
      </section>
      <div className="lv-edge-grad dd-edge dd-edge-end"><Marquee ticker items={['Disco Diwali', 'The Masquerade Sangeet Edition', '10 November 2026', 'All for charity', 'See you under the lights']} /></div>
    </main>
  )
}
