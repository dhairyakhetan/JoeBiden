import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from '../router.jsx';
import PhoneHeader from '../phone/PhoneHeader.jsx';
import WebHeader from '../web/WebHeader.jsx';
import { calm } from '../lib/motion.js';
import { FONT } from '../styles/fonts.js';

// 404, both layouts (web draws the phone content ×1.35), marked noindex for search engines. An empty peg on a wire
// with a snapped string; the "404" card starts on the peg, falls to the ground ("uh oh."), and tapping it hangs it
// back up (and drops it again). Under reduced motion it starts on the ground.
const NOTES = ["this peg's empty.", 'the wind got this one.', 'nothing hanging here.', 'someone borrowed this page.'];
const BTN = { minHeight: "44px", padding: "0 18px", display: "flex", alignItems: "center", border: "2px solid var(--ink)", fontFamily: FONT.mono, fontWeight: "700", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", textDecoration: "none" };

function Lost() {
  const { pathname } = useLocation();
  const [hung, setHung] = useState(() => !calm());
  const [intro, setIntro] = useState(hung); // true until the first fall has happened
  const fall = useRef(0);
  useEffect(() => {
    if (!intro) return undefined;
    fall.current = setTimeout(() => { setHung(false); setIntro(false); }, 650);
    return () => clearTimeout(fall.current);
  }, []);
  const toggle = () => { clearTimeout(fall.current); setIntro(false); setHung(!hung); };
  const [note] = useState(() => NOTES[Math.floor(Math.random() * NOTES.length)]);
  return (
    <div className="cascade-in" style={{ width: "350px", margin: "0 auto" }}>
      <div style={{ position: "relative", height: "420px" }}>
        <div style={{ position: "absolute", left: "-20px", top: "24px", width: "390px", height: "2px", background: "var(--string)" }} />
        <div style={{ position: "absolute", left: "161px", top: "19px", width: "28px", height: "10px", background: "var(--red)", border: "1.5px solid var(--ink)", boxSizing: "border-box", zIndex: "2" }} />
        <div className="sway" style={{ position: "absolute", left: "174px", top: "28px", width: "2px", height: "34px", "--a": "9deg", "--d": "2.6s", opacity: hung ? 0 : 1, transition: "opacity .2s .25s" }}>
          <svg width="2" height="34" viewBox="0 0 2 34" aria-hidden="true" style={{ display: "block" }}><path d="M1 0 V26 L0 30 M1 26 L2 33" strokeWidth="1.4" fill="none" style={{ stroke: "var(--string)" }} /></svg>
        </div>
        <div style={{ position: "absolute", left: "198px", top: "40px", width: "150px", fontFamily: FONT.hand, fontSize: "23px", lineHeight: "1.05", color: "var(--hand)", transform: "rotate(-5deg)", opacity: hung ? 0 : 1, transition: "opacity .3s .35s" }}>{note}</div>
        <button onClick={toggle} aria-label={hung ? 'Drop the card' : 'Hang the card back up'} aria-pressed={hung ? 'true' : 'false'} style={{ position: "absolute", left: "95px", top: "29px", width: "160px", height: "210px", padding: "0", border: "0", background: "transparent", transformOrigin: "50% 0", transform: hung ? "none" : "translate(-46px, 146px) rotate(-14deg)", transition: hung ? "transform 700ms cubic-bezier(0.34, 1.56, 0.64, 1)" : "transform 480ms cubic-bezier(0.55, 0, 0.9, 0.45)", zIndex: "1" }}>
          <div className={hung ? 'sway' : undefined} style={{ width: "100%", height: "100%", "--a": "1.6deg", "--d": "3.4s" }}>
            <div style={{ width: "100%", height: "100%", boxSizing: "border-box", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: "7px 7px 0 var(--ink)", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "space-between", textAlign: "left" }}>
              <span style={{ fontFamily: FONT.mono, fontSize: "10px", letterSpacing: "1.4px", color: "var(--ink)" }}>NOT ON THE LINE</span>
              <span style={{ fontFamily: FONT.head, fontSize: "62px", lineHeight: "0.9", letterSpacing: "-2px", color: "var(--ink)" }}>404</span>
              <span style={{ fontFamily: FONT.hand, fontSize: "20px", lineHeight: "1.05", color: "var(--hand)" }}>{intro ? 'uh oh.' : hung ? 'there. much better.' : '(tap to hang it back up)'}</span>
            </div>
          </div>
        </button>
        <div style={{ position: "absolute", left: "10px", top: "400px", width: "330px", height: "2px", background: "var(--ink)", opacity: ".15" }} />
      </div>
      <h1 style={{ margin: "14px 0 0", fontFamily: FONT.head, fontWeight: "400", fontSize: "27px", lineHeight: "0.95", textTransform: "uppercase", color: "var(--ink)" }}>Blown off the line.</h1>
      <p style={{ margin: "12px 0 0", fontSize: "15px", lineHeight: "1.5", color: "var(--text)" }}>
        Nothing hangs at <code style={{ fontFamily: FONT.mono, fontSize: "13px", background: "var(--outside)", padding: "1px 5px", wordBreak: "break-all" }}>{pathname}</code>. The wind might have taken it, or it was never pinned up in the first place.
      </p>
      <div style={{ marginTop: "20px", display: "flex", gap: "12px" }}>
        <Link className="press btn" to="/" style={{ "--c": "var(--yellow)", ...BTN, background: "var(--ink)", color: "var(--card)", boxShadow: "4px 4px 0 var(--yellow)" }}>Take me home</Link>
        <Link className="press btn" to="/articles" style={{ "--c": "var(--ink)", ...BTN, background: "var(--card)", color: "var(--ink)", boxShadow: "4px 4px 0 var(--ink)" }}>See the write-ups</Link>
      </div>
    </div>
  );
}

export default function NotFoundPage({ web }) {
  useEffect(() => {
    document.title = 'Aquaterra — not found';
    const robots = Object.assign(document.createElement('meta'), { name: 'robots', content: 'noindex' });
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);
  if (web) {
    return (
      <div className="web">
        <div style={{ position: "relative", width: "1440px", margin: "0 auto", overflow: "clip", background: "var(--page)", color: "var(--ink)", paddingBottom: "90px" }}>
          <WebHeader />
          <div style={{ zoom: "1.35", paddingTop: "40px" }}><Lost /></div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "relative", width: "390px", margin: "0 auto", overflow: "clip", background: "var(--page)", color: "var(--ink)", paddingBottom: "60px" }}>
      <PhoneHeader current="lost" />
      <div style={{ paddingTop: "36px" }}><Lost /></div>
    </div>
  );
}
