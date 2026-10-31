import { useEffect, useRef, useState } from 'react';
import { useReveal } from '../lib/reveal.js';
import { Link } from '../router.jsx';
import BackHome from './BackHome.jsx';
import { cardCover } from './ArticleCard.jsx';
import { EDITIONS, LATEST, editionLink, editionName } from '../data/editions.js';
import { editionData } from '../editions/index.js';
import { useEdition } from '../lib/edition.js';
import { AQ_LOOK } from '../host.js';
import { FONT } from '../styles/fonts.js';

// What the magazine's header gives, drawn in the page instead while it shows AQ's look (AQ_LOOK, src/host.js: inside
// AQ's website, whose own nav takes the header's place, and on the own site by default):
// - EditionsCard: every edition as a little cover to open (the header's edition picker), at the end of the home pages
//   beside the games card (shared/EndCards.jsx). The page's own edition says "you're here"; one still being made
//   (draft: true in data/editions.js) shows as "coming", with no link and nothing of its content.
// - BackToMagazine: a small "← Back to home" pill under AQ's nav on the other pages (the header's back link).
// - EditionPills: "Latest edition →" and "All editions" (/editions), on an older edition's home page only (the latest's
//   has the editions card at its end), top right on the page; WebHome / PhoneHome draw them.
const MONO = { fontFamily: FONT.mono, fontWeight: "700", letterSpacing: "1.4px", textTransform: "uppercase" };
const short = (month) => month.replace(/^(\w{3})\w*/, '$1');

function Tile({ e, i, here, web }) {
  const W = web ? 168 : 132, H = web ? 120 : 94;
  const d = editionData(e.number), cover = (d.articles.find((a) => a.featured) || d.articles[0])?.cover;
  const coming = e.draft && e.number !== here, current = e.number === here;
  const inner = (
    <>
      <span style={{ position: "relative", display: "block", width: `${W}px`, height: `${H}px`, boxSizing: "border-box", border: coming ? "2px dashed var(--slotLine)" : "2px solid var(--ink)", background: coming ? "var(--cream)" : "var(--blank)", overflow: "hidden" }}>
        {coming
          ? <span style={{ position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", fontFamily: FONT.hand, fontSize: web ? "22px" : "19px", lineHeight: "1", color: "var(--wire)", padding: "8px" }}>out end of {e.month.split(' ')[0]}</span>
          : cover && <img src={cardCover(cover)} onError={(ev) => { if (ev.currentTarget.src !== cover) ev.currentTarget.src = cover; }} alt="" loading="lazy" decoding="async" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} />}
        {current && <span style={{ position: "absolute", left: "6px", top: "6px", ...MONO, fontSize: "9px", padding: "3px 6px", background: "var(--yellow)", border: "1.5px solid var(--ink)", color: "var(--ink)" }}>you’re here</span>}
      </span>
      <span style={{ display: "flex", alignItems: "baseline", gap: "6px", marginTop: "8px" }}>
        <span style={{ fontFamily: FONT.head, fontSize: web ? "16px" : "14px", textTransform: "uppercase" }}>{editionName(e.number).replace('Edition ', 'No. ')}</span>
        <span style={{ fontFamily: FONT.hand, fontSize: web ? "21px" : "18px", color: "var(--hand)" }}>{short(e.month)}</span>
      </span>
      <span style={{ ...MONO, fontSize: web ? "10.5px" : "9.5px", marginTop: "2px", color: coming ? "var(--muted)" : "var(--ink)" }}>{coming ? 'coming soon' : current ? 'reading now' : 'open →'}</span>
    </>
  );
  const box = { display: "flex", flexDirection: "column", flexShrink: "0", width: `${W}px`, textDecoration: "none", color: "var(--ink)", minHeight: "44px", '--i': i };
  return coming ? <div style={box}>{inner}</div> : <Link to={editionLink(e.number)} className="lift-link" aria-current={current ? 'page' : undefined} aria-label={`${editionName(e.number)}, ${e.month}${e.number === LATEST ? ', latest' : ''}`} style={box}>{inner}</Link>;
}

export function EditionsCard({ web }) {
  const { number } = useEdition();
  const box = useRef(null);
  useReveal(box, 140); // rises in just after the games card beside it, its covers one by one
  if (!AQ_LOOK) return null;
  return (
    <nav ref={box} aria-label="Editions" style={{ position: "relative", boxSizing: "border-box", width: web ? "600px" : "342px", padding: web ? "22px 26px" : "16px", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: `${web ? 8 : 5}px ${web ? 8 : 5}px 0 var(--yellow)`, transform: "rotate(0.8deg)", color: "var(--ink)", display: "flex", flexDirection: "column" }}>
      {/* each stays on one line; the tagline drops under the heading when both don't fit (a wide heading font) */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: "10px", rowGap: "2px" }}>
        <span style={{ fontFamily: FONT.head, fontSize: web ? "26px" : "20px", textTransform: "uppercase", whiteSpace: "nowrap" }}>The editions</span>
        <span style={{ fontFamily: FONT.hand, fontSize: web ? "22px" : "18px", color: "var(--hand)", whiteSpace: "nowrap" }}>a new one every month</span>
      </div>
      <div className="stagger" style={{ display: "flex", gap: web ? "20px" : "14px", marginTop: web ? "16px" : "12px", paddingBottom: "8px", overflowX: "auto", overscrollBehaviorX: "contain" }}>
        {[...EDITIONS].reverse().map((e, i) => <Tile key={e.number} e={e} i={i} here={number} web={web} />)}
      </div>
      <span style={{ flexGrow: "1" }} />
      <Link to="/editions" style={{ ...MONO, fontSize: web ? "11px" : "10.5px", alignSelf: "flex-end", display: "flex", alignItems: "center", minHeight: "44px", textDecoration: "none", color: "var(--ink)" }}>all editions →</Link>
    </nav>
  );
}

// "← Back to home" slips away while you scroll down (it would sit on the text) and comes back when you scroll up.
function useScrollAway() {
  const [away, setAway] = useState(false);
  useEffect(() => {
    let last = scrollY;
    const on = () => { const y = scrollY; if (Math.abs(y - last) > 6) { setAway(y > last && y > 160); last = y; } };
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  return away;
}

// floats just under AQ's fixed nav (AQ sets --nav-h on its page; the custom property reaches into the shadow root),
// left, so it never moves the page's own layout. The page is zoomed, so the offset is divided back.
export function BackToMagazine({ web }) {
  const away = useScrollAway();
  if (!AQ_LOOK) return null;
  const z = web ? 'var(--web-zoom, 1)' : 'var(--phone-zoom, 1)';
  return (
    <BackHome className={web ? 'btn' : 'press'} aria-hidden={away ? 'true' : undefined} tabIndex={away ? -1 : undefined} style={{ transition: "transform .25s ease, opacity .25s ease, translate 160ms ease", transform: away ? "translateY(-24px)" : "none", opacity: away ? "0" : "1", pointerEvents: away ? "none" : "auto", position: "fixed", zIndex: "40", top: `calc(var(--nav-h, 70px) / ${z} + 30px)`, left: web ? "24px" : "12px", display: "inline-flex", alignItems: "center", minHeight: "44px", padding: "0 16px", boxSizing: "border-box", borderRadius: "999px", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)", "--c": "var(--ink)", ...MONO, fontSize: web ? "12px" : "11px", color: "var(--ink)", textDecoration: "none" }}>← Back to home</BackHome>
  );
}

// On an older edition's home page (WebHome / PhoneHome draw them), top right on the page itself, so they scale and
// scroll with it: on web just right of the "TerraNotes · write-ups" line and under Buddy's hidden call button (its
// corner, 1240-1390 × 88-124), on phones above Buddy. Not on the latest edition's (it has the editions card at its end).
export function EditionPills({ web }) {
  const { number } = useEdition();
  if (!AQ_LOOK || number === LATEST) return null;
  const pill = { display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "44px", padding: web ? "0 16px" : "0 12px", boxSizing: "border-box", borderRadius: "999px", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)", "--c": "var(--ink)", ...MONO, fontSize: web ? "12px" : "11px", color: "var(--ink)", textDecoration: "none", whiteSpace: "nowrap" };
  return (
    <div style={{ position: "absolute", zIndex: "7", top: web ? "134px" : "74px", right: web ? "24px" : "12px", display: "flex", gap: web ? "10px" : "8px" }}>
      <Link to={editionLink(LATEST)} className={web ? 'btn' : 'press'} style={{ ...pill, background: "var(--yellow)" }}>Latest edition →</Link>
      <Link to="/editions" className={web ? 'btn' : 'press'} style={pill}>All editions</Link>
    </div>
  );
}
