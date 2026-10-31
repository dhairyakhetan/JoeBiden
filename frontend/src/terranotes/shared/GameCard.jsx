import { useEffect, useRef, useState } from 'react';
import { openGames } from '../lib/buddyState.js';
import { calm, LITE } from '../lib/motion.js';
import { FONT } from '../styles/fonts.js';
import { gamesFor } from '../data/games.js';
import { useEdition } from '../lib/edition.js';
import { useReveal } from '../lib/reveal.js';

// The mini games card at the end of the home pages (shared/EndCards.jsx places it): Buddy's two games, one tap away
// without calling him first. It turns between Snake, Float and Fling every few seconds (not with reduced motion or LITE, while
// it's off screen, or while the pointer or focus is on it), and its button opens the one showing, in the same popup
// Buddy uses (shared/buddy/BuddyGames.jsx, event 'aq-games'). The pills underneath pick one by hand.
// web = the 1440 artboard (600 × 300), else the 390 one (342 wide).
const SHADOW = { snake: 'var(--purple)', float: 'var(--blue)', fling: 'var(--green)' };
const EVERY = 4200; // ms each game shows for
const MONO = { fontFamily: FONT.mono, fontWeight: "700", letterSpacing: "1.4px", textTransform: "uppercase" };

// the two little arcade screens (decoration: the card's text carries the meaning)
function SnakeArt() {
  const cell = 14, body = [[1, 4], [2, 4], [3, 4], [3, 3], [3, 2], [4, 2], [5, 2]];
  return (
    <>
      {body.map(([cx, cy], i) => <rect key={i} x={cx * cell + 12} y={cy * cell + 3} width={cell - 2} height={cell - 2} rx="3" style={{ fill: i === body.length - 1 ? 'var(--mint)' : 'var(--snake)' }} />)}
      <circle cx={5 * cell + 12 + 9} cy={2 * cell + 3 + 4} r="1.6" style={{ fill: "var(--ink)" }} />
      <path d="M118 24l3.2 8 8.4.8-6.4 5.6 2 8.4-7.2-4.4-7.2 4.4 2-8.4-6.4-5.6 8.4-.8z" transform="translate(2 -4)" style={{ fill: "var(--yellow)" }} />
      {[[40, 18], [96, 70], [128, 64]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.4" style={{ fill: "var(--card)", opacity: ".45" }} />)}
    </>
  );
}
function FloatArt() {
  const post = (x, top, h, c) => <g key={x + top}><rect x={x} y={top} width="18" height={h} style={{ fill: `var(--${c})` }} /><rect x={x - 3} y={top ? top : h - 7} width="24" height="7" style={{ fill: `var(--${c})` }} /></g>;
  return (
    <>
      {post(88, 0, 26, 'red')}{post(88, 64, 29, 'red')}{post(128, 0, 44, 'blue')}
      {[[22, 60, 3], [30, 66, 2.2], [36, 58, 1.6]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} style={{ fill: "var(--card)", opacity: ".5" }} />)}
      <g transform="translate(40 26) scale(0.5)">
        <path d="M6 30 C6 14 17 4 30 4 C43 4 54 14 54 30 V60 a8 8 0 0 1 -16 0 a8 8 0 0 1 -16 0 a8 8 0 0 1 -16 0 Z" style={{ fill: "var(--green)" }} />
        <circle cx="21" cy="27" r="6.5" style={{ fill: "var(--card)" }} /><circle cx="39" cy="27" r="6.5" style={{ fill: "var(--card)" }} />
        <circle cx="23" cy="25" r="3.4" style={{ fill: "var(--ink)" }} /><circle cx="41" cy="25" r="3.4" style={{ fill: "var(--ink)" }} />
        <ellipse cx="30" cy="44" rx="5" ry="6" style={{ fill: "var(--ink)" }} />
      </g>
    </>
  );
}
function FlingArt() {
  return (
    <>
      <rect x="0" y="80" width="150" height="13" style={{ fill: "var(--text)" }} />
      <path d="M22 80 L24 58 L18 50 M24 58 L30 50" style={{ fill: "none", stroke: "var(--peg)", strokeWidth: "4", strokeLinecap: "round" }} />
      {[[96, 52, 6, 28], [124, 52, 6, 28], [92, 46, 40, 6]].map(([x, y, w, h]) => <rect key={x + y} x={x} y={y} width={w} height={h} style={{ fill: "var(--peg)", stroke: "var(--ink)", strokeWidth: "1.2" }} />)}
      <circle cx="112" cy="72" r="7" style={{ fill: "var(--green)", stroke: "var(--ink)", strokeWidth: "1.2" }} />
      <circle cx="112" cy="39" r="6" style={{ fill: "var(--green)", stroke: "var(--ink)", strokeWidth: "1.2" }} />
      {[[40, 44], [52, 34], [64, 28], [76, 26]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.6" style={{ fill: "var(--card)", opacity: ".6" }} />)}
      <g transform="translate(78 12) scale(0.36)">
        <path d="M6 30 C6 14 17 4 30 4 C43 4 54 14 54 30 V60 a8 8 0 0 1 -16 0 a8 8 0 0 1 -16 0 a8 8 0 0 1 -16 0 Z" style={{ fill: "var(--green)" }} />
        <circle cx="21" cy="27" r="6.5" style={{ fill: "var(--card)" }} /><circle cx="39" cy="27" r="6.5" style={{ fill: "var(--card)" }} />
        <circle cx="23" cy="25" r="3.4" style={{ fill: "var(--ink)" }} /><circle cx="41" cy="25" r="3.4" style={{ fill: "var(--ink)" }} />
      </g>
    </>
  );
}
const Screen = ({ id, width }) => (
  <svg width={width} height={width * 0.62} viewBox="0 0 150 93" aria-hidden="true" style={{ display: "block", flexShrink: "0", borderRadius: "8px", border: "2px solid var(--ink)", boxShadow: "4px 4px 0 var(--ink)", background: "var(--text)" }}>
    {id === 'snake' ? <SnakeArt /> : id === 'float' ? <FloatArt /> : <FlingArt />}
  </svg>
);

export default function GameCard({ web, style }) {
  const GAMES = gamesFor(useEdition().id).map((g) => ({ ...g, shadow: SHADOW[g.id] })); // titles and lines: data/games.js (the edition's)
  const [at, setAt] = useState(0), [moved, setMoved] = useState(false); // moved: the game has changed once (so it animates)
  const box = useRef(null), held = useRef(false), seen = useRef(false);
  useReveal(box);
  useEffect(() => {
    if (calm() || LITE) return undefined;
    const io = new IntersectionObserver(([e]) => { seen.current = e.isIntersecting; });
    io.observe(box.current);
    const t = setInterval(() => { if (seen.current && !held.current) { setMoved(true); setAt((i) => (i + 1) % GAMES.length); } }, EVERY);
    return () => { clearInterval(t); io.disconnect(); };
  }, []);
  const g = GAMES[at];
  const hold = (v) => () => { held.current = v; };
  const pick = (i) => { setMoved(true); setAt(i); };
  return (
    <section ref={box} aria-label="Mini games" onPointerEnter={hold(true)} onPointerLeave={hold(false)} onFocus={hold(true)} onBlur={hold(false)}
      style={{ position: "relative", boxSizing: "border-box", width: web ? "600px" : "342px",  padding: web ? "26px 28px" : "16px", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: `${web ? 8 : 5}px ${web ? 8 : 5}px 0 ${g.shadow}`, transform: "rotate(-1deg)", transition: "box-shadow .4s ease", color: "var(--ink)", ...style }}>
      <div key={g.id} className={moved ? 'game-in' : undefined} style={{ display: "flex", alignItems: "center", gap: web ? "26px" : "14px" }}>
        <Screen id={g.id} width={web ? 230 : 118} />
        <div style={{ display: "flex", flexDirection: "column", gap: web ? "8px" : "5px", minWidth: "0" }}>
          <span style={{ ...MONO, fontSize: web ? "11px" : "9.5px", color: "var(--dek)" }}>mini game · {at + 1} of {GAMES.length}</span>
          <span style={{ fontFamily: FONT.head, fontSize: web ? "32px" : "20px", lineHeight: "calc(0.95 * var(--head-lead, 1))", textTransform: "uppercase" }}>{g.title}</span>
          <span style={{ fontFamily: FONT.hand, fontSize: web ? "23px" : "18px", lineHeight: "1.05", color: "var(--hand)" }}>{g.line}</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: web ? "8px" : "5px", marginTop: web ? "22px" : "14px" }}>
        <button type="button" className="press btn" onClick={() => openGames(g.id)} aria-label={`Play ${g.name}`}
          style={{ ...MONO, fontSize: web ? "12px" : "11px", "--c": "var(--yellow)", minHeight: "44px", padding: web ? "0 18px" : "0 14px", whiteSpace: "nowrap", background: "var(--ink)", color: "var(--card)", border: "2px solid var(--ink)", boxShadow: "4px 4px 0 var(--yellow)", cursor: "pointer" }}>
          {web ? `Play ${g.name} →` : 'Play →'}
        </button>
        <span style={{ flexGrow: "1" }} />
        {GAMES.map((x, i) => (
          <button key={x.id} type="button" onClick={() => pick(i)} aria-pressed={i === at ? 'true' : 'false'} aria-label={`Show ${x.name}`}
            style={{ ...MONO, fontSize: "10px", minHeight: "44px", padding: web ? "0 12px" : "0 10px", borderRadius: "999px", border: "2px solid var(--ink)", background: i === at ? "var(--ink)" : "var(--card)", color: i === at ? "var(--card)" : "var(--ink)", cursor: "pointer", backgroundClip: "padding-box", boxShadow: "none" }}>
            {x.name}
          </button>
        ))}
      </div>
    </section>
  );
}
