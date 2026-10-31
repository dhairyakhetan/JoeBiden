import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from '../router.jsx';
import Logo from '../shared/Logo.jsx';
import { CloseIcon } from '../shared/Icons.jsx';
import { MenuCall } from '../shared/buddy/Buddy.jsx';
import { homeLink } from '../data/editions.js';
import { useEdition } from '../lib/edition.js';
import { pad2 } from '../lib/format.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';
import { byId } from '../lib/dom.js';
import { FONT } from '../styles/fonts.js';

// The phone's full-screen menu (opened from PhoneHeader): slides in from the right, swipe right (or ✕) to close.
// Six cards hang from a wire, one per stop; the card for the page you're on says "you're here" (on the home page:
// the section in the upper part of the screen). Sized to fit any screen height by CSS variables (styles/phone.css).
// Bottom: Buddy's "click me".
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
// left = card x; string = x of its string on the card; rot = tilt. to: a section of the edition's home page ('' = its
// top), or a page of its own
const STOPS = [
  { label: 'Home', to: '', here: 'home', left: '20px', string: '170px', rot: '-1.5deg', color: 'var(--red)' },
  { label: 'Articles', to: 'articles', here: 'articles', left: '50px', string: '60px', rot: '1.2deg', color: 'var(--blue)' },
  { label: 'Photo wall', to: 'photos', here: 'photos', left: '24px', string: '246px', rot: '-0.8deg', color: 'var(--yellow)' },
  { label: 'Words', to: 'words', here: 'words', left: '46px', string: '84px', rot: '1.6deg', color: 'var(--mint)' },
  { label: 'Members', to: 'members', here: 'members', left: '22px', string: '228px', rot: '-1.2deg', color: 'var(--pink)' },
  { label: 'Editions', to: '/editions', here: 'editions', left: '44px', string: '96px', rot: '1deg', color: 'var(--purple)' },
];

// On the home page: the section in the upper 40% of the screen right now.
function homeSection() {
  const line = innerHeight * 0.4, top = (id) => byId(id)?.getBoundingClientRect().top ?? Infinity;
  if (top('members') <= line) return 'members';
  if (top('words') <= line) return 'words';
  if (top('photos') <= line) return 'photos';
  return scrollY < 220 ? 'home' : 'articles';
}

export default function PhoneMenu({ open, onClose, current = 'home', edge = 'var(--red)' }) {
  const [spot, setSpot] = useState('home');
  useLayoutEffect(() => { if (open && current === 'home') setSpot(homeSection()); }, [open]); // measured before the page locks
  useEffect(() => { if (!open) return undefined; lockScroll(); return unlockScroll; }, [open]);
  const here = current === 'home' ? spot : current;
  const { number } = useEdition();

  // swipe right to close: follows the finger; far or fast enough closes, otherwise springs back
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const t = useRef(null);
  const close = () => { setDx(0); setDragging(false); onClose(); };
  const touchStart = (e) => { const p = e.touches[0]; if (open && p) t.current = { x: p.clientX, y: p.clientY, time: Date.now(), axis: null }; };
  const touchMove = (e) => {
    const p = e.touches[0], s = t.current;
    if (!s || !p) return;
    const mx = p.clientX - s.x, my = p.clientY - s.y;
    if (!s.axis) { if (Math.abs(mx) < 6 && Math.abs(my) < 6) return; s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y'; }
    if (s.axis !== 'x') return;
    setDragging(true); setDx(mx > 0 ? mx : mx * 0.15);
  };
  const touchEnd = () => {
    const s = t.current;
    if (!s) return;
    t.current = null;
    if (dx > 110 || (dx / Math.max(1, Date.now() - s.time) > 0.5 && dx > 20)) close();
    else if (dragging) { setDx(0); setDragging(false); }
  };

  return (
    <div className={open ? 'menu-sheet is-open' : 'menu-sheet'} aria-hidden={open ? 'false' : 'true'} onTouchStart={touchStart} onTouchMove={touchMove} onTouchEnd={touchEnd} onTouchCancel={touchEnd}
      style={{ position: 'fixed', left: '0', right: '0', top: '0', margin: '0 auto', width: '390px', zIndex: '100', background: 'var(--ink)', boxShadow: `-12px 0 0 ${edge}`, transform: `translate3d(${open ? `${dx}px` : 'calc(100% + 16px)'}, 0, 0)`, visibility: open ? 'visible' : 'hidden', transition: dragging ? 'none' : open ? `transform 360ms ${EASE}, visibility 0s` : `transform 300ms ${EASE}, visibility 0s linear 300ms`, willChange: 'transform' }}>
      <nav aria-label="Main menu" className="main-menu" style={{ position: "relative", width: "390px", overflow: "hidden", background: "var(--ink)", color: "var(--page)", fontFamily: FONT.body, display: "flex", flexDirection: "column" }}>
        <div style={{ position: "absolute", left: "18px", top: "16px" }}>
          <Link to="/" onClick={close} aria-label="Aquaterra — home" style={{ display: "flex", alignItems: "center", gap: "6px", minHeight: "44px", textDecoration: "none" }}>
            <Logo globe={36} word={21} sub={13} dark />
          </Link>
        </div>
        <button className="press" onClick={close} aria-label="Close menu" style={{ "--c": "var(--red)", position: "absolute", right: "20px", top: "18px", width: "48px", height: "48px", background: "var(--card)", border: "2px solid var(--page)", boxShadow: "4px 4px 0 var(--red)", padding: "0", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CloseIcon size={20} />
        </button>
        <div style={{ position: "absolute", left: "20px", top: "calc(94px + var(--lift))", fontFamily: FONT.mono, fontSize: "11px", letterSpacing: "1.6px", color: "var(--labelDark)" }}>{`MENU · ${pad2(STOPS.length)} STOPS`}</div>
        {/* the wire; each card hangs from the one above on its own string */}
        <div style={{ position: "absolute", left: "0", top: "calc(124px + var(--lift))", width: "390px", height: "2px", background: "var(--wire)" }} />
        <ol style={{ listStyle: "none", margin: "0", padding: "calc(150px + var(--lift)) 0 24px", display: "flex", flexDirection: "column", gap: "var(--gap)" }}>
          {STOPS.map((s, i) => (
            <li key={s.label} style={{ position: "relative", marginLeft: s.left, width: "318px", height: "var(--cardH)" }}>
              <div aria-hidden="true" style={{ position: "absolute", left: s.string, bottom: "calc(100% - 4px)", width: "1.4px", height: i === 0 ? "28px" : "calc(var(--gap) + 8px)", background: "var(--wire)" }} />
              <Link to={s.to.startsWith('/') ? s.to : homeLink(number, s.to)} onClick={close} className="menu-card" aria-current={here === s.here ? 'page' : undefined} style={{ "--c": s.color, position: "relative", zIndex: "1", height: "100%", boxSizing: "border-box", transform: `rotate(${s.rot})`, background: "var(--card)", border: "2px solid var(--page)", boxShadow: `6px 6px 0 ${s.color}`, padding: "0 16px", display: "flex", alignItems: "center", gap: "14px", textDecoration: "none", color: "var(--ink)" }}>
                <span style={{ fontFamily: FONT.mono, fontSize: "11px" }}>{pad2(i + 1)}</span>
                <span style={{ flexGrow: "1", fontFamily: FONT.head, fontSize: "var(--title)", lineHeight: "1", textTransform: "uppercase", letterSpacing: "-0.5px" }}>{s.label}</span>
                {here === s.here
                  ? <span className="here-note" style={{ fontFamily: FONT.hand, fontSize: "20px", lineHeight: "1", color: s.color, transform: "rotate(-6deg)", whiteSpace: "nowrap" }}>you're here</span>
                  : <svg width="22" height="16" viewBox="0 0 22 16" fill="none" strokeWidth="2.4" aria-hidden="true" style={{ stroke: "var(--ink)" }}><path d="M1 8 H19" /><path d="M13 2 L19 8 L13 14" /></svg>}
              </Link>
            </li>
          ))}
        </ol>
        <div style={{ position: "relative", marginTop: "auto", height: "var(--foot)", flexShrink: "0" }}>
          <div style={{ position: "absolute", left: "20px", top: "0", width: "350px", height: "1.5px", background: "var(--ruleDark)" }} />
          <div style={{ position: "absolute", left: "20px", top: "16px", width: "200px", fontFamily: FONT.hand, fontSize: "22px", lineHeight: "1.05", color: "var(--yellow)", transform: "rotate(-2deg)" }}>notes from where the land meets the water.</div>
          <div style={{ position: "absolute", left: "20px", bottom: "36px", fontFamily: FONT.mono, fontSize: "10px", letterSpacing: "1.4px", color: "var(--mutedDark)" }}>TERRANOTES · © {new Date().getFullYear()}</div>
          <MenuCall onClose={close} />
        </div>
      </nav>
    </div>
  );
}
