// October's alpana border round the photo wall (the design brief: "a very light alta-red decorative pattern along the
// borders ... muted and low-opacity; the photographs and Polaroids must remain the primary focus"): a vine of curls,
// round "lotus" dots and leaf drops running all the way round the panel's edge, drawn once as an SVG the size of the
// panel (shared/PhotoWallSection.jsx draws it behind the lights and prints: src/editions/pages.js WALL_DECOR).
// Colour: the look's alta red (var(--red)) at low opacity, with cream (var(--page)) dots. Decoration only.
const vine = (w, h, m, step, r) => { // points evenly round the rectangle inset by m, each with its outward normal
  const pts = [], per = 2 * (w + h - 4 * m);
  for (let d = 0; d < per; d += step) {
    let x, y, nx, ny, t = d;
    if (t < w - 2 * m) { x = m + t; y = m; nx = 0; ny = -1; } else if ((t -= w - 2 * m) < h - 2 * m) { x = w - m; y = m + t; nx = 1; ny = 0; }
    else if ((t -= h - 2 * m) < w - 2 * m) { x = w - m - t; y = h - m; nx = 0; ny = 1; } else { t -= w - 2 * m; x = m; y = h - m - t; nx = -1; ny = 0; }
    pts.push({ x, y, nx, ny, k: pts.length });
  }
  return pts.map((p) => ({ ...p, r }));
};

export default function AlpanaBorder({ web, w, h }) {
  const m = web ? 26 : 16, step = web ? 46 : 34, r = web ? 9 : 6.5, pts = vine(w, h, m, step, r);
  let wave = '';
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], s = i % 2 ? 1 : -1, cx = (p.x + q.x) / 2 + p.nx * s * r * 1.4, cy = (p.y + q.y) / 2 + p.ny * s * r * 1.4; wave += `${i ? '' : `M${p.x} ${p.y}`} Q${cx} ${cy} ${q.x} ${q.y}`; });
  return (
    <svg aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: "absolute", left: "0", top: "0", pointerEvents: "none", opacity: ".55" }}>
      <path d={wave} style={{ fill: "none", stroke: "var(--red)", strokeWidth: web ? "3" : "2.2", strokeLinecap: "round" }} />
      {pts.map((p) => (p.k % 2 === 0
        ? <g key={p.k}><circle cx={p.x} cy={p.y} r={r} style={{ fill: "var(--red)" }} /><circle cx={p.x} cy={p.y} r={r * 0.36} style={{ fill: "var(--page)" }} /></g>
        : <path key={p.k} d={`M${p.x} ${p.y} q${p.nx * r * 1.4 - p.ny * r * 0.6} ${p.ny * r * 1.4 - p.nx * r * 0.6} ${p.nx * r * 2.4} ${p.ny * r * 2.4} q${-p.nx * r * 0.2 + p.ny * r * 1.1} ${-p.ny * r * 0.2 + p.nx * r * 1.1} ${-p.nx * r * 2.4} ${-p.ny * r * 2.4} Z`} style={{ fill: "var(--red)" }} />))}
      {pts.filter((p) => p.k % 4 === 1).map((p) => <circle key={`d${p.k}`} cx={p.x - p.nx * r * 1.8} cy={p.y - p.ny * r * 1.8} r={r * 0.3} style={{ fill: "var(--page)" }} />)}
    </svg>
  );
}
