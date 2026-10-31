import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import useDialog from '../../hooks/useDialog'
import { BOOK_LABEL, LIVE, DISCO } from '../config'
import { ticketHref } from './ContactLine'

/** Every public page, in the order the menu lists them. The first six also show as chips in the bar on a wide screen. */
export const NAV_LINKS: { to: string; label: string; end?: boolean; chip?: boolean }[] = [
  { to: LIVE.base, label: 'Home', end: true },
  { to: DISCO.base, label: 'Disco Diwali', chip: true },
  { to: `${LIVE.base}/events`, label: 'Events', chip: true },
  { to: `${LIVE.base}/vault`, label: 'The Vault', chip: true },
  { to: `${LIVE.base}/why`, label: 'Why we host', chip: true },
  { to: `${LIVE.base}/company`, label: 'Good company' },
  { to: `${LIVE.base}/crew`, label: 'Crew' },
  { to: `${LIVE.base}/faq`, label: 'FAQ', chip: true },
  { to: `${LIVE.base}/contact`, label: 'Contact', chip: true },
]

function Overlay({ onClose }: { onClose: () => void }) {
  const ref = useDialog(true, onClose)
  return (
    <div className="lv-overlay" role="presentation">
      <div ref={ref} className="lv-overlay-panel" role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1}>
        <button type="button" className="lv-menu-btn lv-overlay-close" onClick={onClose}>Close</button>
        <nav aria-label="Main">
          <ul className="lv-overlay-list">
            {NAV_LINKS.map(l => (
              <li key={l.to}>
                <NavLink to={l.to} end={l.end} className="lv-overlay-link" onClick={onClose}>{l.label}</NavLink>
              </li>
            ))}
            <li><a className="lv-overlay-link is-quiet" href={LIVE.mainSite}>Back to AquaTerra</a></li>
          </ul>
        </nav>
      </div>
    </div>
  )
}

/** Logo on the left, one primary button on the right, and a menu that opens a full-screen overlay. */
export function Nav() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false) }, [pathname])
  const cta = ticketHref()
  return (
    <header className="lv-nav">
      <Link to={LIVE.base} className="lv-logo" aria-label="AquaTerra live, home">AquaTerra<b>LIVE</b></Link>
      <ul className="lv-nav-links">
        {NAV_LINKS.filter(l => l.chip).map(l => (
          <li key={l.to}><NavLink to={l.to} end={l.end} className="lv-chip">{l.label}</NavLink></li>
        ))}
      </ul>
      <div className="lv-nav-right">
        {cta && <a className="lv-btn lv-btn-gold lv-btn-sm lv-nav-cta" href={cta} target="_blank" rel="noopener noreferrer">{BOOK_LABEL}</a>}
        <button type="button" className="lv-menu-btn" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Menu</button>
      </div>
      {open && <Overlay onClose={() => setOpen(false)} />}
    </header>
  )
}
