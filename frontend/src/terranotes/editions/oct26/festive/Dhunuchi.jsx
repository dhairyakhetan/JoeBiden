// October's words game dressing (the design brief: the clouds become dhunuchi smoke; the A / B / C marks become a
// dhunuchi, a paper lantern and a firework; src/editions/pages.js WORDS_ART, used by shared/WordsGameSection.jsx).
// Smoke, as in the brief's sketch: a clay dhunuchi stands at the bottom left and its smoke rises out of it and rolls
// off to the right in one long, soft plume that the word sits on. Drawn in the cloud's own 200 × 110 box (stretched to
// the game's cloud size, strokes kept even); the plume reaches the box's bottom so the "what do you think it means?"
// line stays inside it. Two thin wisps drift up off the top (look.css .oct-wisp, a loop stopped by reduced motion and
// LITE). The marks: small line icons in currentColor, so they turn white with the option when it's picked.
// Decoration only (the options' text is their accessible name).
// the plume: a narrow stream rising out of the cup's mouth, then out along the top in long flowing waves to a curled
// tip at the right, and back along a deep, gently wavy underside to the stream
const PLUME = 'M10 82 C4 72 16 66 13 58 C10 48 22 38 38 40 C56 26 88 32 108 24 C128 16 160 20 176 30 C196 34 200 56 184 58 C174 58 172 48 180 47 C198 62 198 90 176 96 C168 109 140 111 124 107 C108 112 84 112 70 107 C56 111 38 109 34 99 C28 96 26 90 28 84 C24 80 25 74 22 70 C21 77 24 81 22 84 Z';
// the smoke's swirls: low-key, at the plume's edges, clear of the word
const SWIRLS = 'M18 70 q-4 -8 2 -14 M44 52 q6 -8 16 -6 M150 34 q12 -6 20 2 M186 80 q4 6 -4 10 M46 102 q10 3 16 -1';

export function Smoke({ w, h }) {
  return (
    <svg width={w} height={h} viewBox="0 0 200 110" preserveAspectRatio="none" style={{ position: "absolute", left: "0", top: "0", overflow: "visible" }} aria-hidden="true">
      <path d={PLUME} transform="translate(2.5 3)" style={{ fill: "var(--ink)" }} />
      <path d={PLUME} strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ fill: "var(--card)", stroke: "var(--ink)" }} />
      <path d={SWIRLS} strokeWidth="1.6" vectorEffect="non-scaling-stroke" style={{ fill: "none", stroke: "var(--muted)", strokeLinecap: "round", opacity: ".4" }} />
      {[[96, 0], [140, 2.1]].map(([x, d]) => (
        <path key={x} className="dz oct-wisp" d={`M${x} 18 q-6 -6 0 -11 q6 -5 0 -11`} strokeWidth="1.6" vectorEffect="non-scaling-stroke" style={{ fill: "none", stroke: "var(--muted)", strokeLinecap: "round", opacity: ".6", animationDelay: `${-d}s` }} />
      ))}
      {/* the dhunuchi, as in the sketch: a wide clay bowl on a short stem and foot, embers glowing in it; the plume's
          left end rises out of its mouth */}
      <g>
        <path d="M2 84 Q18 80 34 84 Q32 96 18 98 Q4 96 2 84 Z" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ fill: "var(--red)", stroke: "var(--ink)", strokeLinejoin: "round" }} />
        <path d="M5 87 Q18 90 31 87" strokeWidth="1.6" vectorEffect="non-scaling-stroke" style={{ fill: "none", stroke: "var(--yellow)", strokeDasharray: "2 3" }} />
        <ellipse cx="18" cy="84" rx="14" ry="2.4" strokeWidth="1.6" vectorEffect="non-scaling-stroke" style={{ fill: "var(--yellow)", stroke: "var(--ink)" }} />
        <path d="M15 98 L14 104 L22 104 L21 98" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ fill: "var(--red)", stroke: "var(--ink)", strokeLinejoin: "round" }} />
        <path d="M8 108 Q18 102 28 108 Z" strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ fill: "var(--red)", stroke: "var(--ink)", strokeLinejoin: "round" }} />
      </g>
    </svg>
  );
}

const icon = (children) => ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" }}>{children}</svg>
);
export const DhunuchiMark = icon(<><path d="M4 11 Q12 16 20 11 L18 16 Q12 18 6 16 Z" /><path d="M10 17 L10 21 L14 21 L14 17" /><path d="M9 8 q-2 -2 0 -4 M13 8 q-2 -2 0 -4 q2 -2 0 -3 M17 8 q-2 -2 0 -4" /></>);
export const LanternMark = icon(<><path d="M12 2 L12 4" /><path d="M8 5 L16 5 L18 9 L18 16 L16 19 L8 19 L6 16 L6 9 Z" /><path d="M6 9 L18 9 M6 16 L18 16 M12 5 L12 19" /><path d="M12 19 L12 22" /></>);
export const FireworkMark = icon(<><path d="M12 12 L12 3 M12 12 L19 6 M12 12 L21 13 M12 12 L17 20 M12 12 L7 20 M12 12 L3 13 M12 12 L5 6" /><circle cx="12" cy="12" r="1.6" style={{ fill: "currentColor" }} /></>);
export const WORD_MARKS = [DhunuchiMark, LanternMark, FireworkMark];
