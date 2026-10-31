import { useEdition } from '../lib/edition.js';
import { FONT } from '../styles/fonts.js';
import { LAYOUT } from '../editions/pages.js';

// The home page's intro card ("Notes from where the land meets the water." + the edition's INTRO), tilted, with a hard
// black shadow and a red knot at its bottom edge: the "Articles" string is tied there (phone: PhoneHangingArticles;
// web: WebArticleLine). With the edition's LAYOUT introMast (src/editions/pages.js) it leads with "TerraNotes" in big
// heading letters, the tagline smaller under it (October's design brief).
const L = {
  phone: { box: { left: "20px", top: "118px", width: "250px" }, w: 250, h: 200, shadow: 7, pad: "18px 20px", gap: "10px", label: "24px", h1: { fontSize: "27px", lineHeight: "1.08" }, p: { fontSize: "13px", lineHeight: "1.5" }, knot: { left: "68px", top: "194px", size: "14px" } },
  web: { box: { left: "80px", top: "124px", width: "520px" }, w: 520, h: 300, shadow: 10, pad: "30px 34px", gap: "14px", label: "30px", h1: { fontSize: "50px", lineHeight: "1.02" }, p: { fontSize: "16px", lineHeight: "1.55" }, knot: { left: "112px", top: "292px", size: "16px" } },
};

export default function HomeIntroCard({ web }) {
  const S = L[web ? 'web' : 'phone'], { intro, id } = useEdition(), mast = LAYOUT[id]?.introMast;
  return (
    <section style={{ position: "absolute", transform: "rotate(-1deg)", zIndex: "3", ...S.box }}>
      <div style={{ position: "absolute", left: `${S.shadow}px`, top: `${S.shadow}px`, width: `${S.w}px`, height: `${S.h}px`, background: "var(--ink)" }} />
      <div style={{ position: "relative", width: `${S.w}px`, height: `${S.h}px`, boxSizing: "border-box", padding: S.pad, background: "var(--card)", border: "2px solid var(--ink)", display: "flex", flexDirection: "column", gap: S.gap }}>
        <div style={{ fontFamily: FONT.hand, fontSize: S.label, lineHeight: "1", color: "var(--introLabel)" }}>Introduction</div>
        {mast ? (
          <>
            <h1 style={{ margin: web ? "-4px 0 0" : "-2px 0 0", fontFamily: FONT.head, fontWeight: "400", fontSize: web ? "74px" : "37px", lineHeight: "0.92", letterSpacing: web ? "-1px" : "-0.5px", color: "var(--ink)" }}>TerraNotes</h1>
            <div style={{ marginTop: web ? "-4px" : "-3px", fontFamily: FONT.serif, fontStyle: "italic", fontSize: web ? "25px" : "16px", lineHeight: "1.1", color: "var(--text)" }}>Notes from where the land meets the water.</div>
          </>
        ) : <h1 style={{ margin: "0", fontFamily: FONT.serif, fontWeight: "400", ...S.h1 }}>Notes from where the land meets the water.</h1>}
        <p style={{ margin: "0", color: "var(--introText)", ...S.p }}>{intro || '[Two or three lines introducing Aquaterra and what Terranotes is for.]'}</p>
      </div>
      <div style={{ position: "absolute", left: S.knot.left, top: S.knot.top, width: S.knot.size, height: S.knot.size, boxSizing: "border-box", borderRadius: "50%", background: "var(--red)", border: "2px solid var(--ink)" }} />
    </section>
  );
}
