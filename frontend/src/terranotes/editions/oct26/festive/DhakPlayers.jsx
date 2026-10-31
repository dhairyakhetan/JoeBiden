import { calm, LITE } from '../../../lib/motion.js';

// October's dhakis in "Meet the team" (the design brief: "a flat illustration of people playing dhak" in the empty
// space on the left; "the movement of the arms and the gentle bounce of the drums", the players otherwise still):
// two drummers side by side, each with a dhak slung at the hip (its kash-flower plume on top), beating it with two
// thin sticks (src/editions/pages.js TEAM_NOTE; shared/TeamSection.jsx places it: web under the team legend, phones
// beside it). Flat shapes, ink outlines, the look's colours. Motion: each forearm (with its stick) swings from the
// elbow, the two out of step, and the drum bounces a little with every beat; SVG animations turning about the right
// points, left out entirely with reduced motion or on a low-end device (lib/motion.js), where they stand still.
// Decoration only: hidden from screen readers.
const ln = { stroke: "var(--ink)", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" };
const BEAT = 0.64; // seconds a stroke

// a forearm and its stick, swinging about the elbow (ex, ey) between `from` and `to` degrees
function Forearm({ ex, ey, hx, hy, sx, sy, from, to, delay, still }) {
  return (
    <g>
      {!still && <animateTransform attributeName="transform" type="rotate" values={`${from} ${ex} ${ey};${to} ${ex} ${ey};${from} ${ex} ${ey}`} dur={`${BEAT}s`} begin={`${delay}s`} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />}
      <path d={`M${hx} ${hy} L${sx} ${sy}`} style={{ ...ln, strokeWidth: "2.6" }} />
      <path d={`M${ex} ${ey} L${hx} ${hy}`} style={{ ...ln, stroke: "var(--ink)", strokeWidth: "9" }} />
      <path d={`M${ex} ${ey} L${hx} ${hy}`} style={{ ...ln, stroke: "var(--peg)", strokeWidth: "5.5" }} />
      <circle cx={hx} cy={hy} r="4" style={{ ...ln, strokeWidth: "1.6", fill: "var(--peg)" }} />
    </g>
  );
}

function Dhaki({ x, kurta, delay, still }) {
  return (
    <g transform={`translate(${x} 0)`}>
      {/* legs, dhoti, kurta and a red gamchha across the chest */}
      <path d="M40 172 L38 196 M58 172 L60 196" style={{ ...ln, strokeWidth: "6" }} />
      <path d="M30 146 Q49 154 68 146 L66 174 Q49 179 32 174 Z" style={{ ...ln, fill: "var(--card)" }} />
      <path d="M32 78 Q49 70 66 78 L70 148 Q49 156 28 148 Z" style={{ ...ln, fill: kurta }} />
      <path d="M36 78 L60 146" style={{ stroke: "var(--red)", strokeWidth: "6", strokeLinecap: "round" }} />
      {/* head */}
      <circle cx="49" cy="52" r="16" style={{ ...ln, fill: "var(--peg)" }} />
      <path d="M33 50 Q35 34 49 34 Q63 34 65 50 Q57 42 49 43 Q41 42 33 50 Z" style={{ fill: "var(--ink)" }} />
      <path d="M43 54 L44 54 M54 54 L55 54" style={{ ...ln, strokeWidth: "3" }} />
      <path d="M44 61 Q49 64 54 61" style={{ ...ln, strokeWidth: "1.5", fill: "none" }} />
      {/* upper arms, to the elbows (they stay put) */}
      <path d="M36 82 L33 108 M62 82 L72 104" style={{ ...ln, stroke: "var(--ink)", strokeWidth: "9" }} />
      <path d="M36 82 L33 108 M62 82 L72 104" style={{ ...ln, stroke: "var(--peg)", strokeWidth: "5.5" }} />
      {/* the dhak on its strap, bouncing a little with the beat */}
      <g>
        {!still && <animateTransform attributeName="transform" type="translate" values="0 0;0 2;0 0" dur={`${BEAT / 2}s`} begin={`${delay}s`} repeatCount="indefinite" />}
        <path d="M38 80 L76 112" style={{ ...ln, strokeWidth: "2" }} />
        {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M100 110 Q${104 + i * 4} ${92 - i * 3} ${108 + i * 5} ${84 - (i % 2) * 5}`} style={{ ...ln, strokeWidth: "1.3", stroke: "var(--wire)", fill: "none" }} />)}
        <rect x="46" y="110" width="58" height="32" rx="13" style={{ ...ln, fill: "var(--card)" }} />
        <path d="M54 113 L96 139 M54 139 L96 113" style={{ stroke: "var(--red)", strokeWidth: "1.7" }} />
        <ellipse cx="48" cy="126" rx="5.5" ry="16" style={{ ...ln, fill: "var(--yellow)" }} />
        <ellipse cx="102" cy="126" rx="5.5" ry="16" style={{ ...ln, fill: "var(--yellow)" }} />
      </g>
      {/* forearms with their sticks, beating the drum's top, out of step */}
      <Forearm ex={33} ey={108} hx={52} hy={104} sx={74} sy={108} from={-14} to={10} delay={delay} still={still} />
      <Forearm ex={72} ey={104} hx={86} hy={94} sx={96} sy={110} from={10} to={-12} delay={delay + BEAT / 2} still={still} />
    </g>
  );
}

export default function DhakPlayers({ web, style }) {
  const still = calm() || LITE;
  return (
    <svg aria-hidden="true" viewBox="0 0 250 200" style={{ position: "absolute", height: "auto", overflow: "visible", ...style, width: web ? "300px" : "160px" }}>
      <ellipse cx="125" cy="197" rx="116" ry="4.5" style={{ fill: "var(--ink)", opacity: ".12" }} />
      <Dhaki x={8} kurta="var(--blue)" delay={0} still={still} />
      <Dhaki x={128} kurta="var(--green)" delay={-0.22} still={still} />
    </svg>
  );
}
