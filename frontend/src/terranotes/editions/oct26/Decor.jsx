// October 2026's decorations on the home pages (src/editions/pages.js DECOR; the page draws them first, so its cards
// sit on top), for the Pujo issue: a toran of marigolds and mango leaves across the top, a marigold tag saying
// "Subho Sharodiya!" (happy autumn festival), sparkles and falling petals, and on phones two hanging diyas in the gaps
// between the cards (on web the diyas hang from the article wire: pages.js HANGERS). The rest of the festive touches
// live in the sections they dress (src/editions/oct26/festive/, registered in pages.js). Positions are on the home
// artboard (web 1440, phone 390), clear of Buddy's corner (shared/buddy/Buddy.jsx). Decoration only: hidden from
// screen readers. Colours: the look's. They move a little (class "dz" + their own, loops in look.css): the toran's
// leaves sway, the tag swings on its hole, petals fall, sparkles twinkle (class oct-twinkle).
import { FONT } from '../../styles/fonts.js';
import HangingDiya from './festive/Diya.jsx';

// a garland in swags: marigold beads along the string, a mango leaf hanging every few beads
function Toran({ width, top, swags, sag }) {
  const seg = width / swags, beads = [], leaves = [];
  const y = (x) => { const t = (x % seg) / seg; return 6 + sag * Math.sin(Math.PI * t); };
  for (let x = 6; x < width; x += 13) beads.push(x);
  for (let k = 0; k < swags; k++) for (const f of [0.25, 0.5, 0.75]) leaves.push(k * seg + f * seg);
  return (
    <svg width={width} height={sag + 60} viewBox={`0 0 ${width} ${sag + 60}`} style={{ position: "absolute", left: "0", top: `${top}px` }}>
      {leaves.map((x, i) => <path key={x} className="dz oct-leaf" d={`M${x} ${y(x) + 4} q-9 18 0 34 q9 -16 0 -34 Z`} style={{ fill: "var(--green)", stroke: "var(--ink)", strokeWidth: "1.2", animationDelay: `${-(i * 0.7) % 3.4}s` }} />)}
      {beads.map((x, i) => <circle key={x} cx={x} cy={y(x)} r="6.5" style={{ fill: i % 3 === 2 ? "var(--red)" : "var(--yellow)", stroke: "var(--ink)", strokeWidth: "1" }} />)}
    </svg>
  );
}
function Tag({ left, top, w, size, deg }) {
  return (
    <div className="dz oct-tag" style={{ position: "absolute", left: `${left}px`, top: `${top}px`, width: `${w}px`, boxSizing: "border-box", padding: `${Math.round(w * 0.1)}px`, background: "var(--yellow)", border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--red)", transform: `rotate(${deg}deg)`, fontFamily: FONT.hand, fontSize: `${size}px`, lineHeight: "1", color: "var(--ink)", textAlign: "center" }}>
      <div style={{ width: "10px", height: "10px", margin: "0 auto 6px", borderRadius: "50%", border: "2px solid var(--ink)", background: "var(--card)" }} />
      Subho Sharodiya!
    </div>
  );
}
// a marigold petal falling from the toran, turning as it goes (each one starts `delay` seconds into the loop)
const Petal = ({ left, top, delay, red }) => (
  <svg className="dz oct-petal" width="14" height="10" viewBox="0 0 14 10" style={{ position: "absolute", left: `${left}px`, top: `${top}px`, opacity: "0", animationDelay: `${delay}s` }}>
    <ellipse cx="7" cy="5" rx="6" ry="3.6" style={{ fill: red ? "var(--red)" : "var(--yellow)", stroke: "var(--ink)", strokeWidth: "1" }} />
  </svg>
);

// a four-point sparkle that twinkles (scale / rotate / opacity only), in one of the look's bright colours
const Sparkle = ({ left, top, s, c, delay }) => (
  <svg className="dz oct-twinkle" width={s} height={s} viewBox="0 0 100 100" style={{ position: "absolute", left: `${left}px`, top: `${top}px`, animationDelay: `${delay}s` }}>
    <path d="M50 4 C55 36 64 45 96 50 C64 55 55 64 50 96 C45 64 36 55 4 50 C36 45 45 36 50 4 Z" style={{ fill: `var(--${c})`, stroke: "var(--ink)", strokeWidth: "4", strokeLinejoin: "round" }} />
  </svg>
);

export default function Oct26Decor({ web }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "0", height: "0", pointerEvents: "none" }}>
      {web ? (
        <>
          <Toran width={1440} top={80} swags={4} sag={26} />
          <Tag left={1262} top={452} w={128} size={20} deg={5} />
          {[[1215, 205, 24, "mint", 0], [880, 470, 20, "pink", 0.9], [1300, 770, 22, "mint", 0.4], [1010, 880, 18, "pink", 1.3]].map(([x, y, s, c, dl]) => <Sparkle key={x} left={x} top={y} s={s} c={c} delay={dl} />)}
          {[[640, 0], [690, 4.8, 1], [1160, 1.6, 1], [1250, 6.4], [1350, 3.2], [1120, 8]].map(([x, d, r]) => <Petal key={x} left={x} top={120} delay={d} red={r} />)}
        </>
      ) : (
        <>
          <Toran width={390} top={64} swags={2} sag={14} />
          {/* hanging diyas in the gaps between the cards (on web they hang from the article wire itself) */}
          <HangingDiya v={3} string={30} s={30} style={{ left: "92px", top: "1078px" }} />
          <HangingDiya v={4} string={110} s={28} delay={-1.6} style={{ left: "352px", top: "78px" }} />
          <Tag left={292} top={266} w={86} size={15} deg={6} />
          {[[300, 620, 22, "mint", 0], [262, 705, 16, "pink", 0.9], [338, 745, 20, "yellow", 1.7]].map(([x, y, s, c, dl]) => <Sparkle key={x} left={x} top={y} s={s} c={c} delay={dl} />)}
          {[[40, 0], [200, 3.6, 1], [356, 7.2]].map(([x, d, r]) => <Petal key={x} left={x} top={96} delay={d} red={r} />)}
        </>
      )}
    </div>
  );
}
