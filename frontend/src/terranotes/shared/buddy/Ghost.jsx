// Buddy himself: a round green ghost with three bumps along his hem, as SVG (Ghost) or drawn on a canvas for the
// games (drawGhost). face: 'happy' | 'boo' (mouth wide open). Colours: the edition's look (green, card, ink).
const fill = (c) => ({ fill: `var(--${c})` });
export default function Ghost({ size = 60, face = 'happy', style, className }) {
  return (
    <svg className={className} width={size} height={size * 70 / 60} viewBox="0 0 60 70" style={style} aria-hidden="true">
      <path d="M6 30 C6 14 17 4 30 4 C43 4 54 14 54 30 V60 a8 8 0 0 1 -16 0 a8 8 0 0 1 -16 0 a8 8 0 0 1 -16 0 Z" style={fill('green')} />
      <circle cx="21" cy="27" r="6.5" style={fill('card')} /><circle cx="39" cy="27" r="6.5" style={fill('card')} />
      <circle cx="21.5" cy="27" r="3.4" style={fill('ink')} /><circle cx="39.5" cy="27" r="3.4" style={fill('ink')} />
      {face === 'boo'
        ? <ellipse cx="30" cy="44" rx="5.5" ry="7" style={fill('ink')} />
        : <path d="M22 39 h16 a8 8 0 0 1 -16 0 Z" style={fill('ink')} />}
    </svg>
  );
}

// Buddy's trophy (won in Fling: lib/buddyState.js), drawn over his head: a gold cup with a star, handles, stem and base.
export function Trophy({ size = 30, style, className }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" style={style} aria-hidden="true">
      <path d="M10 6 h20 v6 a10 10 0 0 1 -20 0 Z" style={{ fill: "var(--yellow)", stroke: "var(--ink)", strokeWidth: 2, strokeLinejoin: "round" }} />
      <path d="M10 9 h-5 a5 5 0 0 0 6 7 M30 9 h5 a5 5 0 0 1 -6 7" style={{ fill: "none", stroke: "var(--ink)", strokeWidth: 2, strokeLinecap: "round" }} />
      <path d="M17 21 h6 v6 h-6 Z" style={{ fill: "var(--yellow)", stroke: "var(--ink)", strokeWidth: 2 }} />
      <path d="M11 27 h18 v6 h-18 Z" style={{ fill: "var(--peg)", stroke: "var(--ink)", strokeWidth: 2 }} />
      <path d="M20 8.5 l1.4 2.8 3.1.4-2.3 2.1.6 3-2.8-1.5-2.8 1.5.6-3-2.3-2.1 3.1-.4z" style={{ fill: "var(--card)" }} />
    </svg>
  );
}

// The winner's crown (Fling's last level won), worn on his head: three gold points with gems, a band.
export function Crown({ size = 30, style, className }) {
  return (
    <svg className={className} width={size} height={size * 0.75} viewBox="0 0 40 30" style={style} aria-hidden="true">
      <path d="M4 24 L6 8 L13 16 L20 4 L27 16 L34 8 L36 24 Z" style={{ fill: "var(--yellow)", stroke: "var(--ink)", strokeWidth: 2, strokeLinejoin: "round" }} />
      <rect x="4" y="22" width="32" height="5" style={{ fill: "var(--yellow)", stroke: "var(--ink)", strokeWidth: 2 }} />
      <circle cx="20" cy="4" r="2.4" style={{ fill: "var(--red)", stroke: "var(--ink)", strokeWidth: 1.2 }} />
      <circle cx="6" cy="8" r="2" style={{ fill: "var(--blue)", stroke: "var(--ink)", strokeWidth: 1.2 }} />
      <circle cx="34" cy="8" r="2" style={{ fill: "var(--blue)", stroke: "var(--ink)", strokeWidth: 1.2 }} />
      <circle cx="20" cy="24.5" r="1.8" style={{ fill: "var(--red)" }} />
    </svg>
  );
}
export function drawCrown(g, x, y, h, C) { // centre (x, y), height h
  const k = h / 30;
  g.save(); g.translate(x - 20 * k, y - 15 * k); g.scale(k, k); g.lineJoin = 'round'; g.strokeStyle = C.ink; g.lineWidth = 2;
  g.fillStyle = C.yellow; g.beginPath(); [[4, 24], [6, 8], [13, 16], [20, 4], [27, 16], [34, 8], [36, 24]].forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath(); g.fill(); g.stroke();
  g.fillRect(4, 22, 32, 5); g.strokeRect(4, 22, 32, 5);
  g.lineWidth = 1.2; for (const [a, b, r, c] of [[20, 4, 2.4, C.red], [6, 8, 2, C.blue], [34, 8, 2, C.blue]]) { g.fillStyle = c; g.beginPath(); g.arc(a, b, r, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.fillStyle = C.red; g.beginPath(); g.arc(20, 24.5, 1.8, 0, Math.PI * 2); g.fill();
  g.restore();
}

// The same trophy on a canvas: centre (x, y), height h.
export function drawTrophy(g, x, y, h, C) {
  const k = h / 40;
  g.save(); g.translate(x - 20 * k, y - 20 * k); g.scale(k, k);
  g.lineWidth = 2; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = C.ink;
  g.beginPath(); g.moveTo(10, 9); g.lineTo(5, 9); g.arc(8, 12.5, 4.2, -Math.PI * 0.75, Math.PI * 0.6, true); g.stroke();
  g.beginPath(); g.moveTo(30, 9); g.lineTo(35, 9); g.arc(32, 12.5, 4.2, -Math.PI * 0.25, Math.PI * 0.4); g.stroke();
  g.fillStyle = C.yellow; g.beginPath(); g.moveTo(10, 6); g.lineTo(30, 6); g.lineTo(30, 12); g.arc(20, 12, 10, 0, Math.PI); g.closePath(); g.fill(); g.stroke();
  g.fillRect(17, 21, 6, 6); g.strokeRect(17, 21, 6, 6);
  g.fillStyle = C.peg; g.fillRect(11, 27, 18, 6); g.strokeRect(11, 27, 18, 6);
  g.fillStyle = C.card; g.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 1.6 : 4; g.lineTo(20 + Math.cos(a) * r, 12.5 + Math.sin(a) * r); }
  g.closePath(); g.fill();
  g.restore();
}

// The same ghost on a canvas (for the games). (x, y) = centre of his head; r = head radius; C = the look's colours;
// look = where his pupils point (-1…1 each way); t = seconds, for the wiggling hem; face as above.
export function drawGhost(g, x, y, r, C, { look = [0, 0], t = 0, face = 'happy', tilt = 0, sx = 1, sy = 1 } = {}) {
  g.save();
  g.translate(x, y); g.rotate(tilt); g.scale(sx, sy);
  const w = r, base = r * 1.25, bump = (2 * w) / 3;
  g.beginPath();
  g.moveTo(-w, 0);
  g.arc(0, 0, w, Math.PI, 0);
  g.lineTo(w, base);
  for (let i = 0; i < 3; i++) {
    const cx = w - bump * (i + 0.5), dip = bump / 2 + Math.sin(t * 7 + i * 1.7) * r * 0.06;
    g.ellipse(cx, base, bump / 2, dip, 0, 0, Math.PI);
  }
  g.closePath();
  g.fillStyle = C.green; g.fill();
  const px = look[0] * r * 0.1, py = look[1] * r * 0.1;
  for (const s of [-1, 1]) {
    g.fillStyle = C.card; g.beginPath(); g.arc(s * r * 0.37, -r * 0.1, r * 0.27, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.ink; g.beginPath(); g.arc(s * r * 0.37 + px, -r * 0.1 + py, r * 0.14, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = C.ink; g.beginPath();
  if (face === 'boo') g.ellipse(0, r * 0.55, r * 0.22, r * 0.3, 0, 0, Math.PI * 2);
  else { g.moveTo(-r * 0.33, r * 0.4); g.lineTo(r * 0.33, r * 0.4); g.arc(0, r * 0.4, r * 0.33, 0, Math.PI); }
  g.fill();
  g.restore();
}
