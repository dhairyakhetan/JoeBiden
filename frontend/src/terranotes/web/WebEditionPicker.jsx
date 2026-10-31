import { useEffect, useRef, useState } from 'react';
import { Link } from '../router.jsx';
import { LatestTag } from '../shared/Tapes.jsx';
import { LATEST, PUBLISHED, editionLink, editionName } from '../data/editions.js';
import { useEdition } from '../lib/edition.js';
import { FONT } from '../styles/fonts.js';

// The web header's "Edition 01 · Sep 2026 [LATEST] ▾" button: opens a list of every edition (newest first; drafts
// aren't listed) and a link to /editions. Shows the edition of the page you're on. Esc / outside click closes.
const MONO = { fontFamily: FONT.mono, fontWeight: "700", letterSpacing: "1.2px", textTransform: "uppercase" };

export default function WebEditionPicker() {
  const [open, setOpen] = useState(false);
  const cur = useEdition(), here = cur.number;
  const box = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const out = (e) => { if (!e.composedPath().includes(box.current)) setOpen(false); }; // composedPath: inside AQ's shadow root, e.target is the host
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('pointerdown', out); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', out); removeEventListener('keydown', esc); };
  }, [open]);
  return (
    <div ref={box} style={{ position: "relative" }}>
      <button className="edition-btn" onClick={() => setOpen(!open)} aria-expanded={open ? 'true' : 'false'} aria-haspopup="true" aria-label={`${editionName(cur.number)}, ${cur.month}${cur.number === LATEST ? ', latest' : ''}. Choose an edition`}
        style={{ ...MONO, fontSize: "11px", minHeight: "40px", display: "flex", alignItems: "center", gap: "8px", padding: "0 12px", background: "var(--card)", color: "var(--ink)", border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)", cursor: "pointer" }}>
        <span>{`${editionName(cur.number)} · ${cur.month.replace(/^(\w{3})\w*/, '$1')}`}</span>
        {cur.number === LATEST && <LatestTag />}
        <svg width="10" height="7" viewBox="0 0 10 7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}><path d="M1 1 L5 5 L9 1" /></svg>
      </button>
      {open && (
        <div className="card-drop" role="menu" style={{ position: "absolute", left: "0", top: "calc(100% + 10px)", zIndex: "60", width: "280px", boxSizing: "border-box", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: "6px 6px 0 var(--ink)", padding: "8px" }}>
          <div style={{ ...MONO, fontSize: "9.5px", color: "var(--muted)", padding: "6px 8px" }}>Editions</div>
          {[...PUBLISHED].reverse().map((e) => (
            <Link key={e.number} role="menuitem" to={editionLink(e.number)} onClick={() => setOpen(false)} aria-current={e.number === here ? 'true' : undefined}
              style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "44px", padding: "0 8px", textDecoration: "none", color: "var(--ink)", background: e.number === here ? "var(--page)" : "transparent" }}>
              <span style={{ fontFamily: FONT.head, fontSize: "15px", textTransform: "uppercase" }}>{editionName(e.number)}</span>
              <span style={{ fontFamily: FONT.hand, fontSize: "19px", color: "var(--hand)", flexGrow: "1" }}>{e.month}</span>
              {e.number === LATEST && <LatestTag />}
            </Link>
          ))}
          {PUBLISHED.length === 1 && <div style={{ padding: "6px 8px 8px", fontFamily: FONT.hand, fontSize: "18px", color: "var(--wire)" }}>no previous editions yet: this is the first one.</div>}
          <Link role="menuitem" to="/editions" onClick={() => setOpen(false)} style={{ ...MONO, fontSize: "10px", display: "flex", alignItems: "center", minHeight: "40px", padding: "0 8px", borderTop: "1.5px solid var(--ink)", marginTop: "4px", textDecoration: "none", color: "var(--ink)" }}>All editions →</Link>
        </div>
      )}
    </div>
  );
}
