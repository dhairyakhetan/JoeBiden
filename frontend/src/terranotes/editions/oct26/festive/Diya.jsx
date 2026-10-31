// October's hanging diya (the design brief: "small hanging diyas alongside the writeups"): a clay lamp hung like a
// real hanging diya, in a wide cradle of three cords that meet at a ring well above it, so the flame burns in the open
// and never near the thread. Each one is a little different (v: its number): six clay colours, three painted
// patterns (dots, zigzag, stripes) and two shapes (round, or a leaf-shaped lamp with a spout), on threads of different
// lengths (string), so a row of them doesn't look the same. Used on the web article wire, in the gaps between the
// cards (web/WebArticleLine.jsx: src/editions/pages.js HANGERS), and on the phone home (Decor.jsx). s: the lamp's
// width (the same for all). Colours: the look's roles. Motion: look.css .oct-diya-sway / .oct-flame (class dz: stopped
// by reduced motion and LITE, paused off screen and while pages swap, styles/loops.css). Decoration only.
const CLAY = ['var(--red)', 'var(--yellow)', 'var(--green)', 'var(--blue)', 'var(--pink)', 'var(--purple)'];
const PAINT = ['var(--yellow)', 'var(--red)', 'var(--yellow)', 'var(--yellow)', 'var(--card)', 'var(--yellow)'];
const ROUND = 'M6 56 Q30 52 54 56 Q50 76 30 78 Q10 76 6 56 Z';
const LEAF = 'M2 56 Q24 50 50 54 L58 50 Q56 58 52 60 Q46 76 28 78 Q10 76 2 56 Z';

function Pattern({ kind, c }) {
  const st = { fill: "none", stroke: c, strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round" };
  if (kind === 0) return <>{[14, 22, 30, 38, 46].map((x) => <circle key={x} cx={x} cy="65" r="1.9" style={{ fill: c }} />)}</>;
  if (kind === 1) return <path d="M11 63 L16 68 L21 63 L26 68 L31 63 L36 68 L41 63 L46 68 L50 64" style={st} />;
  return <><path d="M10 62 Q30 66 50 62" style={st} /><path d="M14 69 Q30 73 46 69" style={st} /></>;
}

export default function HangingDiya({ string = 40, s = 30, v = 0, delay = 0, style }) {
  const h = (s * 82) / 60, clay = CLAY[v % 6], paint = PAINT[v % 6], leaf = v % 2 === 1;
  return (
    <div aria-hidden="true" className="dz oct-diya-sway" style={{ position: "absolute", width: `${s}px`, height: `${string + h}px`, transformOrigin: "50% 0", animationDelay: `${delay}s`, pointerEvents: "none", ...style }}>
      <div style={{ position: "absolute", left: `${s / 2 - 0.7}px`, top: "0", width: "1.4px", height: `${string}px`, background: "var(--string)" }} />
      <svg width={s} height={h} viewBox="0 0 60 82" style={{ position: "absolute", left: "0", top: `${string}px`, overflow: "visible" }}>
        {/* the cradle: three cords from a ring down to the rim, spread wide round the flame */}
        <circle cx="30" cy="4" r="3" style={{ fill: "none", stroke: "var(--ink)", strokeWidth: "1.6" }} />
        <path d={leaf ? 'M30 7 L4 55 M30 7 L54 53 M30 7 L30 52' : 'M30 7 L8 55 M30 7 L52 55 M30 7 L30 52'} style={{ fill: "none", stroke: "var(--ink)", strokeWidth: "1.1", opacity: ".55" }} />
        {/* the flame, low in the bowl, well clear of the cords' ring */}
        <g className="dz oct-flame" style={{ animationDelay: `${delay * 0.7}s` }}>
          <ellipse cx={leaf ? 26 : 30} cy="44" rx="13" ry="13" style={{ fill: "var(--yellow)", opacity: ".3" }} />
          <path d={leaf ? 'M26 34 Q32 45 26 54 Q20 45 26 34 Z' : 'M30 34 Q36 45 30 54 Q24 45 30 34 Z'} style={{ fill: "var(--yellow)", stroke: "var(--ink)", strokeWidth: "1.4" }} />
          <path d={leaf ? 'M26 42 Q28 47 26 52 Q24 47 26 42 Z' : 'M30 42 Q32 47 30 52 Q28 47 30 42 Z'} style={{ fill: "var(--card)" }} />
        </g>
        <path d={leaf ? LEAF : ROUND} style={{ fill: clay, stroke: "var(--ink)", strokeWidth: "2", strokeLinejoin: "round" }} />
        <Pattern kind={v % 3} c={paint} />
      </svg>
    </div>
  );
}
