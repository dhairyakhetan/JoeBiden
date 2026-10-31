import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation } from '../router.jsx';
import BackHome from '../shared/BackHome.jsx';
import Logo from '../shared/Logo.jsx';
import WebEditionPicker from './WebEditionPicker.jsx';
import { calm } from '../lib/motion.js';
import { isHomePath } from '../lib/routes.js';
import { FONT } from '../styles/fonts.js';

// The sticky 80px web header on every web page, kept slim: the logo (the magazine's home) and the edition picker, the
// only way to older editions besides /editions. Home: both on the left. Every other
// page: "← back to home" on the left, the logo + picker in the middle. When that changes from one page to the next, it
// moves: the logo and picker glide over (FLIP, transform only) while the back link slides in, or fades out on the way
// home. Between two pages with the same header nothing moves, and on web the page transition doesn't crossfade the
// header (styles/motion.css).
// wire: the page's wire runs right along the header's bottom edge (article pages). At the top of the page the wire is
// that edge, so the header's own border stays hidden; it shows once the page is scrolled and the wire has gone.
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const PAD = 48; // the header's side padding: where the back link (home: the logo) starts
const BACK = { minHeight: "44px", display: "flex", alignItems: "center", fontFamily: FONT.hand, fontSize: "24px", color: "var(--ink)", textDecoration: "none", whiteSpace: "nowrap" };
let hadBack = null; // did the previous page's header show the back link? (null: first page of the visit)
export const forgetWebHeader = () => { hadBack = null; }; // leaving the magazine (inside AQ): the next visit's first page doesn't glide

export default function WebHeader({ wire }) {
  const back = !isHomePath(useLocation().pathname);
  const [before] = useState(() => hadBack);
  const moving = before !== null && before !== back && !calm();
  const [ghost, setGhost] = useState(moving && !back); // on the way home: the old back link, fading out
  const group = useRef(null), link = useRef(null), gone = useRef(null);
  const [scrolled, setScrolled] = useState(!wire);
  useEffect(() => {
    if (!wire) return undefined;
    const on = () => setScrolled(scrollY > 0);
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, [wire]);
  useLayoutEffect(() => {
    hadBack = back;
    if (!moving) return;
    const middle = (1440 - group.current.offsetWidth) / 2; // the group's left edge when centred
    // on the way home the logo waits a beat, so the back link is gone before it slides into that spot
    group.current.animate([{ transform: `translateX(${back ? PAD - middle : middle - PAD}px)` }, { transform: 'none' }], { duration: 560, delay: back ? 0 : 90, easing: EASE, fill: 'backwards' });
    if (back) link.current.animate([{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 140, easing: EASE, fill: 'backwards' });
    else gone.current.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(-40px)' }], { duration: 180, easing: 'ease-in', fill: 'forwards' }).onfinish = () => setGhost(false);
  }, []);

  return (
    <header className="site-header" style={{ position: "sticky", top: "0", zIndex: "50", width: "1440px", height: "80px", boxSizing: "border-box", padding: `0 ${PAD}px`, background: "var(--page)", backgroundClip: "padding-box", borderBottom: `2px solid ${scrolled ? "var(--ink)" : "transparent"}`, display: "flex", alignItems: "center", gap: "24px" }}>
      {back && <span ref={link} style={{ display: "flex" }}><BackHome className="lift-link" style={BACK}>← back to home</BackHome></span>}
      {ghost && <span ref={gone} aria-hidden="true" style={{ ...BACK, position: "absolute", left: `${PAD}px`, top: "0", bottom: "0", pointerEvents: "none" }}>← back to home</span>}
      <div ref={group} style={{ display: "flex", alignItems: "center", gap: "24px", ...(back && { position: "absolute", left: "50%", top: "0", bottom: "0", translate: "-50% 0" }) }}>
        <Link to="/" aria-label="Aquaterra — home" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <Logo globe={46} word={27} sub={15} />
        </Link>
        <WebEditionPicker />
      </div>
    </header>
  );
}
