import { Link } from 'react-router-dom'
import { LIVE, DISCO } from '../config'
import { ContactLine } from './ContactLine'

export function Footer() {
  return (
    <footer className="lv-footer">
      <div className="lv-footer-top">
        <p className="lv-footer-line">Party with a <em>purpose.</em></p>
        <button type="button" className="lv-link lv-top-btn" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to the start</button>
      </div>
      <ContactLine />
      <ul className="lv-footer-links">
        <li><a className="lv-link" href={LIVE.instagram} target="_blank" rel="noopener noreferrer">Instagram</a></li>
        <li><Link className="lv-link" to={DISCO.base}>Disco Diwali</Link></li>
        <li><Link className="lv-link" to={`${LIVE.base}/events`}>Events</Link></li>
        <li><Link className="lv-link" to={`${LIVE.base}/vault`}>The Vault</Link></li>
        <li><Link className="lv-link" to={`${LIVE.base}/why`}>Why we host</Link></li>
        <li><Link className="lv-link" to={`${LIVE.base}/company`}>Good company</Link></li>
        <li><Link className="lv-link" to={`${LIVE.base}/crew`}>Crew</Link></li>
        <li><Link className="lv-link" to={`${LIVE.base}/faq`}>FAQ</Link></li>
        <li><Link className="lv-link" to={`${LIVE.base}/contact`}>Contact</Link></li>
        <li><a className="lv-link" href="/privacy-policy">Privacy policy</a></li>
        <li><a className="lv-link" href={LIVE.mainSite}>Back to AquaTerra</a></li>
      </ul>
    </footer>
  )
}
