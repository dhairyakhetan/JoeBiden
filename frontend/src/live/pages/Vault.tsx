import { useRef, useState } from 'react'
import { useMeta } from '../../hooks/useMeta'
import { pageMetadata } from '../../lib/metaConfig'
import { PHOTOS } from '../data/photos'
import { takedownHref } from '../lib/links'
import { Headline, Kicker } from '../components/Headline'
import { Lightbox } from '../components/Lightbox'
import { Photo } from '../components/Photo'
import { PosterRail } from '../components/PosterRail'
import { Sticker } from '../components/Sticker'
import { useScrollReveal } from '../lib/hooks'

const FILTERS: { key: 'all' | 'disco-diwali' | 'disco-diwali-2025' | 'summer-aq-turns-five'; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'summer-aq-turns-five', label: 'The Summer AQ turns five' },
  { key: 'disco-diwali-2025', label: 'Disco Diwali 2025' },
  { key: 'disco-diwali', label: 'Disco Diwali, past editions' },
]

/** The photo wall. Every picture is described, opens large, and can be asked to come down in one tap. */
export function LiveVault() {
  useMeta(pageMetadata.liveVault)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all')
  const [open, setOpen] = useState<number | null>(null)
  const root = useRef<HTMLElement>(null)
  useScrollReveal(root)
  const list = PHOTOS.filter(p => filter === 'all' || p.event === filter)
  const at = open === null ? null : list[open]
  return (
    <main id="lv-main" ref={root} className="lv-main lv-page">
      <div className="lv-page-head">
        <Kicker>Every night, kept</Kicker>
        <Headline as="h1" text="The Vault." />
        <p className="lv-lede">Photos from past nights. Tap one to see it large.</p>
      </div>
      <h2 className="lv-sub">The posters <Sticker name="star" size={54} rot={14} className="lv-st-inline" /></h2>
      <PosterRail />
      <h2 className="lv-sub">The photos</h2>
      <div className="lv-notice" role="note">
        <b>Spot yourself and want a photo gone?</b> Open it and tap &ldquo;Ask to remove this photo&rdquo;, or message the team. It comes down, no questions asked.
        Guests are not named here.
      </div>
      <div role="group" aria-label="Filter photos" className="lv-actions lv-filters">
        {FILTERS.map(f => (
          <button key={f.key} type="button" className={'lv-chip' + (filter === f.key ? ' is-on' : '')} aria-pressed={filter === f.key} onClick={() => { setFilter(f.key); setOpen(null) }}>{f.label}</button>
        ))}
      </div>
      {list.length === 0
        ? <div className="lv-empty"><strong>Nothing here yet.</strong><p>Photos from this night are on their way.</p></div>
        : (
          <ul className="lv-gallery">
            {list.map((p, i) => (
              <li key={p.id}>
                <button type="button" onClick={() => setOpen(i)} aria-label={`Open photo: ${p.alt}`}>
                  <Photo id={p.id} size="s" alt="" />
                </button>
              </li>
            ))}
          </ul>
        )}
      <p className="lv-fine">{list.length} photo{list.length === 1 ? '' : 's'}.</p>
      {at && open !== null && (
        <Lightbox
          id={at.id}
          onClose={() => setOpen(null)}
          onPrev={open > 0 ? () => setOpen(open - 1) : undefined}
          onNext={open < list.length - 1 ? () => setOpen(open + 1) : undefined}
          takedown={takedownHref(at.id) ?? undefined}
        />
      )}
    </main>
  )
}
