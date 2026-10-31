import { goToPart } from '../lib/readProgress.js';
import { FONT } from '../styles/fonts.js';

// The article pages' reading aids (progress from lib/readProgress.js):
// - ReadingBar: a thin bar in the article's tag colour along the bottom of the sticky header, filling as you read.
//   Zero height in the page's flow (nothing moves), sticky just under the header (64px phone / 80px web).
// - ReadingRail (web): the sticky "In this piece" panel in the reading column's right margin: the sections (the lit
//   one is where you are; click to jump there), how much is read and the minutes left.
const MONO = { fontFamily: FONT.mono, letterSpacing: "1.2px", textTransform: "uppercase" };

export function ReadingBar({ web, p, color }) {
  return (
    <div aria-hidden="true" style={{ position: "sticky", top: web ? "80px" : "64px", zIndex: "45", height: "0" }}>
      <div style={{ position: "absolute", left: "0", right: "0", top: "0", height: web ? "5px" : "4px", background: color, transformOrigin: "0 50%", transform: `scaleX(${p})`, borderBottom: p > 0 ? "1.5px solid var(--ink)" : "0" }} />
    </div>
  );
}

export function ReadingRail({ a, tag, p, at }) {
  const parts = a.body.filter((b) => b?.h2 != null).map((b) => b.h2);
  const left = Math.max(0, Math.ceil((a.readTime || 0) * (1 - p)));
  return (
    <aside aria-label="In this piece" style={{ position: "sticky", top: "120px", width: "250px", boxSizing: "border-box", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: `6px 6px 0 ${tag.color}`, padding: "18px 18px 14px", transform: "rotate(0.6deg)" }}>
      <div style={{ ...MONO, fontSize: "11px", fontWeight: "700" }}>In this piece</div>
      {parts.length > 0 && (
        <ol style={{ listStyle: "none", margin: "12px 0 0", padding: "0", display: "flex", flexDirection: "column", gap: "2px" }}>
          {parts.map((h, i) => (
            <li key={i}>
              <button type="button" onClick={() => goToPart(i)} aria-current={i === at ? 'location' : undefined}
                style={{ display: "flex", gap: "10px", alignItems: "flex-start", width: "100%", minHeight: "40px", padding: "8px 8px", border: "0", textAlign: "left", cursor: "pointer", background: i === at ? "var(--ink)" : "transparent", color: i === at ? "var(--card)" : "var(--ink)", transition: "background-color .2s ease, color .2s ease" }}>
                <span style={{ ...MONO, fontSize: "11px", fontWeight: "700", paddingTop: "2px", color: i === at ? tag.color : "var(--muted)" }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: FONT.body, fontWeight: "700", fontSize: "14px", lineHeight: "1.25" }}>{h}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div style={{ marginTop: "14px", height: "8px", border: "1.5px solid var(--ink)", background: "var(--page)" }}>
        <div style={{ height: "100%", background: tag.color, transformOrigin: "0 50%", transform: `scaleX(${p})` }} />
      </div>
      <div style={{ ...MONO, display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "10.5px" }}>
        <span>{Math.round(p * 100)}% read</span>
        <span style={{ color: "var(--muted)" }}>{p >= 0.99 ? 'the end' : a.readTime ? `${left} min left` : ''}</span>
      </div>
    </aside>
  );
}
