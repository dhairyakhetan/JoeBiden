import { Link } from 'react-router-dom'
import { EVENT, PARTNERS } from '../config'
import { Wordmark } from './Wordmark'
import { sized } from '../../lib/imageUrl'

/**
 * An ink slab to close the page, so the site ends on the same note it opened.
 *
 * The credentials line is plain text, not a badge image: a parent checking
 * whether this is a real organisation scans for "12A" and "80G", and a graphic
 * of a certificate is both heavier and less searchable than the words.
 *
 * No percentage claim anywhere. AQ's own review flagged a 100%-to-charity style
 * statement as unsupportable, so the copy says what the money funds without
 * quantifying the share.
 *
 * Every colour here reads a real `--tt-*` token. The previous version leaned on
 * `var(--bg, #F4EFE0)` and `var(--lemon, #FFC700)`, neither of which is a token
 * this stylesheet ever defines, so those rules always rendered their cream-era
 * fallback literal and never actually picked up the night palette. Same story
 * for the inline `borderTop` this footer used to set on `.tt-slab` itself: an
 * inline style always wins over the class, so it was silently overriding the
 * slab's own orchid `border-block` with a flat ink line. Removed, so the slab's
 * orchid edge (top and bottom) shows again.
 */
export function Footer() {
  return (
    <footer className="tt-slab">
      <div className="tt-wrap" style={{ paddingBlock: 'var(--tt-section)' }}>
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {/* minWidth: 0 matters here. The wordmark is one word, so its
              min-content width is whatever that word measures, and a flex item
              will not shrink below that on its own. At 320px the 46px mark was
              303px wide and pushed this column past the screen edge. */}
          <div style={{ maxWidth: 380, minWidth: 0 }}>
            <Wordmark size={46} tone="ink" className="tt-foot__mark" />
            <p style={{ margin: '20px 0 0', fontSize: 'var(--tt-fs-body)', lineHeight: 1.7, color: 'var(--tt-ink-2)' }}>
              {/* One line, not two. The second sentence repeated the welfare
                  point already made in the proof section a screen earlier. */}
              A three-sport fundraiser run by Team AquaTerra, a student-led volunteer
              organisation in Kolkata.
            </p>
            <p style={{ margin: '14px 0 0', fontFamily: 'var(--tt-code)', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-lemon)' }}>
              Registered NGO · 12A and 80G certified
            </p>
          </div>

          <div className="tt-linklist" style={{ fontSize: 'var(--tt-fs-body)' }}>
            <div className="tt-kicker" style={{ color: 'var(--tt-lemon)', marginBottom: 2 }}>TerraThon</div>
            <Link to={`${EVENT.base}/register`} style={{ color: 'var(--tt-ink)' }}>Register Now</Link>
            <Link to={`${EVENT.base}/schedule`} style={{ color: 'var(--tt-ink)' }}>Schedule</Link>
            <Link to={`${EVENT.base}/contact`} style={{ color: 'var(--tt-ink)' }}>Contact</Link>
          </div>

          <div className="tt-linklist" style={{ fontSize: 'var(--tt-fs-body)' }}>
            <div className="tt-kicker" style={{ color: 'var(--tt-lemon)', marginBottom: 2 }}>AquaTerra</div>
            <a href={EVENT.mainSite} style={{ color: 'var(--tt-ink)' }}>ngoaquaterra.com</a>
            <a href={EVENT.instagram} rel="noreferrer noopener" target="_blank" style={{ color: 'var(--tt-ink)' }}>@aquaterra.live</a>
            <a href={EVENT.instagramNgo} rel="noreferrer noopener" target="_blank" style={{ color: 'var(--tt-ink)' }}>@ngo.aquaterra</a>
            <a href={`mailto:${EVENT.email}`} style={{ color: 'var(--tt-ink)' }}>{EVENT.email}</a>
          </div>
        </div>

        {/* Renders nothing at all until a real partner exists. */}
        {PARTNERS.length > 0 && (
          <div style={{ marginTop: 40, paddingTop: 26, borderTop: '1px solid var(--tt-hairline)' }}>
            <div className="tt-kicker" style={{ color: 'var(--tt-ink-3)', marginBottom: 14 }}>With support from</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center' }}>
              {PARTNERS.map((p) => {
                const mark = p.logo
                  ? <img src={sized(p.logo, 'thumb')} alt={p.name} height={28} loading="lazy" decoding="async" style={{ display: 'block', height: 28, width: 'auto' }} />
                  : <span style={{ fontFamily: 'var(--tt-display)', fontWeight: 700, fontSize: 'var(--tt-fs-body)', textTransform: 'uppercase' }}>{p.name}</span>
                // Partner.url existed on the type and was rendered by neither
                // site, so a sponsor given a link would have got a logo that
                // goes nowhere. Nobody would have noticed until the first real
                // sponsor was added, which is the worst time to find out.
                return p.url
                  ? <a key={p.name} href={p.url} target="_blank" rel="noreferrer noopener sponsored" aria-label={`${p.name} (opens in a new tab)`}>{mark}</a>
                  : <span key={p.name}>{mark}</span>
              })}
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, paddingTop: 22, borderTop: '1px solid var(--tt-hairline)', fontSize: 'var(--tt-fs-meta)', color: 'var(--tt-ink-3)', display: 'flex', gap: 16, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ flexGrow: 1, minWidth: 220 }}>
            © {new Date().getFullYear()} Team AquaTerra. Entry fees are collected by UPI into
            AquaTerra's collection account.
          </span>
          {/* The way in to the desk.
              Quiet on purpose, since it is for the four people running the event and
              not for the person reading the footer, but it is still a real link
              with a real label and a 44px target, not a secret. Hiding a
              control from everyone including the people who need it is not
              security; the database is what refuses a stranger. */}
          <Link
            to={`${EVENT.base}/admin`}
            className="tt-adminlink"
          >
            Admin
          </Link>
        </div>
      </div>
    </footer>
  )
}
