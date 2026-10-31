import { FONT } from '../../styles/fonts.js';

// September 2026's doodles on the home pages (src/editions/pages.js DECOR; the page draws them first, so its cards sit
// on top): the margins of an exam-season notebook. A highlighter-yellow sticky note ("exam in 3 days!!"), a coffee
// ring half under the intro card, a ballpoint star scribble and a paper plane. Positions are on the home artboard
// (web 1440, phone 390), in the empty spots between the sections. Decoration only: hidden from screen readers.
// They move a little, in the background (class "dz" + their own, loops in look.css): the plane bobs, the star
// twinkles, the sticky note flutters, and little ballpoint scribbles (+, ×, π…) float up and fade, one after another.
const pen = { stroke: "var(--hand)", strokeWidth: "2", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" };
const pencil = { stroke: "var(--string)", strokeWidth: "1.6", fill: "none", strokeLinecap: "round", strokeDasharray: "5 6" };

function Sticky({ left, top, w, size, deg }) {
  return (
    <div className="dz sep-sticky" style={{ position: "absolute", left: `${left}px`, top: `${top}px`, width: `${w}px`, boxSizing: "border-box", padding: `${Math.round(w * 0.1)}px`, background: "var(--yellow)", boxShadow: "3px 4px 0 rgba(24,33,58,.18)", transform: `rotate(${deg}deg)`, fontFamily: FONT.hand, fontSize: `${size}px`, lineHeight: "1", color: "var(--ink)" }}>
      <div style={{ position: "absolute", left: "50%", top: "-9px", width: "44%", height: "16px", marginLeft: "-22%", background: "rgba(255,255,255,.55)", transform: "rotate(-3deg)" }} />
      exam in 3 days!!
      <svg width="100%" height="10" viewBox="0 0 100 10" preserveAspectRatio="none" style={{ display: "block", marginTop: "4px" }}><path d="M2 6 C25 2 50 9 98 4" style={{ ...pen, stroke: "var(--red)" }} /></svg>
    </div>
  );
}
const Coffee = ({ left, top, d }) => (
  <svg width={d} height={d} viewBox="0 0 100 100" style={{ position: "absolute", left: `${left}px`, top: `${top}px` }}>
    <circle cx="50" cy="50" r="42" style={{ fill: "none", stroke: "rgba(150,105,55,.28)", strokeWidth: "5" }} />
    <path d="M14 38 A40 40 0 0 1 70 12" style={{ fill: "none", stroke: "rgba(150,105,55,.22)", strokeWidth: "9", strokeLinecap: "round" }} />
  </svg>
);
const Star = ({ left, top, s }) => (
  <svg className="dz sep-star" width={s} height={s} viewBox="0 0 60 60" style={{ position: "absolute", left: `${left}px`, top: `${top}px`, transform: "rotate(-8deg)" }}>
    <path d="M30 6 L36 23 L54 24 L40 35 L45 53 L30 43 L15 53 L20 35 L6 24 L24 23 Z" style={pen} />
    <path d="M29 12 L34 25 L47 27 L37 34 L41 47 L30 39" style={{ ...pen, strokeWidth: "1.2", opacity: ".7" }} />
  </svg>
);
const Plane = ({ left, top, w }) => (
  <svg className="dz sep-plane" width={w} height={w * 0.45} viewBox="0 0 200 90" style={{ position: "absolute", left: `${left}px`, top: `${top}px` }}>
    <path d="M6 78 C40 70 60 88 92 66 S140 40 150 46" style={pencil} />
    <path d="M150 46 L196 20 L164 62 Z" style={{ ...pen, fill: "var(--card)" }} />
    <path d="M150 46 L172 44 L164 62" style={pen} />
  </svg>
);
// a scribble that floats up and fades, then comes back (each one starts `delay` seconds into the loop)
const Scribble = ({ left, top, size, delay, children }) => (
  <span className="dz sep-float" style={{ position: "absolute", left: `${left}px`, top: `${top}px`, fontFamily: FONT.hand, fontSize: `${size}px`, lineHeight: "1", color: "var(--hand)", opacity: "0", animationDelay: `${delay}s` }}>{children}</span>
);

export default function Sep26Decor({ web }) {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "0", height: "0", pointerEvents: "none" }}>
      {web ? (
        <>
          <Coffee left={330} top={360} d={150} />
          <Sticky left={1244} top={446} w={136} size={22} deg={5} />
          <Star left={1000} top={400} s={46} />
          <Plane left={1150} top={950} w={190} />
          <Scribble left={1080} top={420} size={34} delay={0}>+</Scribble>
          <Scribble left={250} top={560} size={30} delay={2.5}>π</Scribble>
          <Scribble left={1330} top={1010} size={30} delay={5}>×</Scribble>
          <Scribble left={520} top={330} size={28} delay={7.5}>a²</Scribble>
        </>
      ) : (
        <>
          <Coffee left={-30} top={270} d={110} />
          <Sticky left={286} top={246} w={96} size={17} deg={6} />
          <Scribble left={20} top={410} size={26} delay={0}>+</Scribble>
          <Scribble left={2} top={525} size={24} delay={5}>π</Scribble>
        </>
      )}
    </div>
  );
}
