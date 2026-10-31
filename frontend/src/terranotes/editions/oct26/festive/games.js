// October 2026's skin for Buddy's games (src/editions/pages.js GAME_SKIN; shared/buddy/BuddyGames.jsx and Fling.jsx
// use it while an October page is open; every other edition keeps Buddy): from the design team's brief,
//   Snake → Durga Maa on the chase: her face leads a garland of marigolds, catching demon faces
//   Fling → bow and arrow: the slingshot is a bow, Buddy an arrow, the gremlins demon faces
// Flat, bold-outlined, folk-art faces in the spirit of Kalighat paintings: almond eyes, a third eye, a gold crown; the
// demon is playful (curly moustache, a grin), never scary. Canvas drawings, so the colours come from the look's values
// (K = LOOK.colors, A = LOOK.art), not CSS variables. Every function draws centred on (0, 0) after a translate.

const almond = (g, x, y, w, h) => { g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x, y - h * 2, x + w, y); g.quadraticCurveTo(x, y + h * 1.2, x - w, y); g.closePath(); };
const ellipse = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); };
const lobes = (g, r, y0, h, n, w) => { // a crown of pointed lobes across the forehead
  g.beginPath(); g.moveTo(-w, y0);
  for (let i = 0; i < n; i++) { const x0 = -w + (2 * w * i) / n, x1 = -w + (2 * w * (i + 1)) / n, mid = (x0 + x1) / 2, top = i === (n - 1) / 2 ? h * 1.25 : h; g.quadraticCurveTo(x0, y0 - top * 0.7, mid, y0 - top); g.quadraticCurveTo(x1, y0 - top * 0.7, x1, y0); }
  g.closePath();
};

// Durga Maa's face, radius r. look: [dx, dy] where she's heading (her eyes follow it); over: eyes wide
export function durga(g, r, K, A, { look = [1, 0], over = false } = {}) {
  const lw = Math.max(1.4, r * 0.07);
  g.lineJoin = 'round'; g.strokeStyle = K.ink; g.lineWidth = lw;
  ellipse(g, 0, r * 0.12, r * 0.98, r * 1.02); g.fillStyle = A.hair; g.fill(); // her hair, falling round the face
  lobes(g, r, -r * 0.58, r * 0.62, 3, r * 0.66); g.fillStyle = A.gold; g.fill(); g.stroke(); // the crown
  ellipse(g, 0, -r * 0.92, r * 0.1, r * 0.13); g.fillStyle = A.alta; g.fill();
  ellipse(g, 0, r * 0.08, r * 0.68, r * 0.78); g.fillStyle = A.skin; g.fill(); g.stroke(); // the face
  g.beginPath(); g.moveTo(-r * 0.62, -r * 0.2); g.quadraticCurveTo(0, -r * 0.82, r * 0.62, -r * 0.2); g.quadraticCurveTo(0, -r * 0.5, -r * 0.62, -r * 0.2); g.fillStyle = A.hair; g.fill(); // the hairline
  almond(g, 0, -r * 0.3, r * 0.07, r * 0.1); g.fillStyle = A.alta; g.fill(); // the third eye
  g.lineWidth = lw * 0.9;
  for (const sx of [-1, 1]) { // the big almond eyes, lined, looking where she's going
    almond(g, sx * r * 0.28, r * 0.02, r * 0.22, r * (over ? 0.13 : 0.1)); g.fillStyle = K.card; g.fill(); g.stroke();
    ellipse(g, sx * r * 0.28 + look[0] * r * 0.07, r * 0.0 + look[1] * r * 0.04, r * 0.07, r * 0.08); g.fillStyle = A.hair; g.fill();
    g.beginPath(); g.moveTo(sx * r * 0.06, -r * 0.13); g.quadraticCurveTo(sx * r * 0.28, -r * 0.24, sx * r * 0.5, -r * 0.1); g.stroke(); // brows
  }
  ellipse(g, 0, -r * 0.16, r * 0.05, r * 0.05); g.fillStyle = A.alta; g.fill(); // bindi
  g.beginPath(); g.moveTo(0, r * 0.04); g.lineTo(-r * 0.05, r * 0.28); g.lineTo(r * 0.04, r * 0.3); g.stroke(); // nose
  g.beginPath(); g.arc(r * 0.09, r * 0.3, r * 0.07, 0, Math.PI * 2); g.strokeStyle = A.gold; g.stroke(); g.strokeStyle = K.ink; // nose ring
  ellipse(g, 0, r * 0.5, r * 0.12, r * 0.05); g.fillStyle = A.alta; g.fill(); // lips
  for (const sx of [-1, 1]) { ellipse(g, sx * r * 0.7, r * 0.3, r * 0.08, r * 0.08); g.fillStyle = A.gold; g.fill(); g.stroke(); } // earrings
}

// the demon's face, radius r: a flame crown with a red jewel, hair at the sides, thick brows, a huge curly moustache, a
// toothy grin. wince: eyes squeezed shut
export function demon(g, r, K, A, { wince = false } = {}) {
  const lw = Math.max(1.4, r * 0.07);
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = K.ink; g.lineWidth = lw;
  lobes(g, r, -r * 0.55, r * 0.6, 3, r * 0.6); g.fillStyle = A.flame; g.fill(); g.stroke(); // the crown
  lobes(g, r, -r * 0.6, r * 0.38, 3, r * 0.42); g.fillStyle = K.yellow; g.fill();
  ellipse(g, 0, -r * 0.9, r * 0.09, r * 0.18); g.fillStyle = A.alta; g.fill();
  ellipse(g, 0, r * 0.1, r * 0.86, r * 0.78); g.fillStyle = A.brown; g.fill(); // hair, puffed at the sides
  ellipse(g, 0, r * 0.12, r * 0.64, r * 0.72); g.fillStyle = A.demon; g.fill(); g.stroke(); // the face
  ellipse(g, 0, -r * 0.34, r * 0.07, r * 0.07); g.fillStyle = A.alta; g.fill(); // tilak
  g.lineWidth = lw * 1.8; g.strokeStyle = A.brown;
  for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(sx * r * 0.08, -r * 0.12); g.quadraticCurveTo(sx * r * 0.3, wince ? -r * 0.08 : -r * 0.32, sx * r * 0.52, -r * 0.18); g.stroke(); } // brows
  g.lineWidth = lw * 0.9; g.strokeStyle = K.ink;
  for (const sx of [-1, 1]) {
    almond(g, sx * r * 0.27, r * 0.02, r * 0.17, r * (wince ? 0.03 : 0.08)); g.fillStyle = K.card; g.fill(); g.stroke();
    if (!wince) { ellipse(g, sx * r * 0.25, r * 0.0, r * 0.06, r * 0.07); g.fillStyle = A.brown; g.fill(); }
  }
  g.beginPath(); g.moveTo(0, r * 0.02); g.quadraticCurveTo(-r * 0.1, r * 0.3, 0, r * 0.32); g.stroke(); // nose
  ellipse(g, 0, r * 0.56, r * 0.26, r * 0.12); g.fillStyle = K.card; g.fill(); g.stroke(); // the grin
  g.beginPath(); for (let i = -2; i <= 2; i++) { g.moveTo(i * r * 0.09, r * 0.46); g.lineTo(i * r * 0.09, r * 0.66); } g.lineWidth = lw * 0.6; g.stroke();
  g.strokeStyle = A.brown; g.lineWidth = r * 0.17; // the moustache: two thick curls, rolled up at the ends
  for (const sx of [-1, 1]) {
    g.beginPath(); g.moveTo(0, r * 0.38);
    g.bezierCurveTo(sx * r * 0.3, r * 0.5, sx * r * 0.7, r * 0.52, sx * r * 0.9, r * 0.3);
    g.bezierCurveTo(sx * r * 1.02, r * 0.12, sx * r * 0.86, -r * 0.02, sx * r * 0.74, r * 0.1);
    g.quadraticCurveTo(sx * r * 0.7, r * 0.2, sx * r * 0.8, r * 0.22); g.stroke();
  }
}

// a marigold bead of Durga Maa's garland (the snake's tail), radius r
export function marigold(g, r, K, A, i) {
  g.fillStyle = i % 3 === 2 ? A.flame : K.yellow; g.strokeStyle = K.ink; g.lineWidth = Math.max(1, r * 0.12);
  g.beginPath(); for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, rr = k % 2 ? r * 0.82 : r; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, 0, r * 0.32, 0, Math.PI * 2); g.fillStyle = A.flame; g.fill();
}

// an arrow, its point at (0, 0) facing +x, length L
export function arrow(g, L, K, A) {
  g.lineCap = 'round'; g.strokeStyle = K.ink; g.lineWidth = L * 0.06;
  g.beginPath(); g.moveTo(-L, 0); g.lineTo(-L * 0.12, 0); g.stroke(); // the shaft
  g.fillStyle = A.alta; for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(-L * 0.96, 0); g.lineTo(-L * 1.08, sy * L * 0.13); g.lineTo(-L * 0.78, sy * L * 0.13); g.lineTo(-L * 0.68, 0); g.closePath(); g.fill(); } // feathers
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-L * 0.24, -L * 0.1); g.lineTo(-L * 0.18, 0); g.lineTo(-L * 0.24, L * 0.1); g.closePath(); g.fillStyle = K.ink; g.fill(); // the head
}

// the bow at (bx, by), standing upright, the string pulled to `hold` (or straight); h: half its height
export function bow(g, bx, by, hold, K, A, h = 58) {
  const top = [bx + 6, by - h], bot = [bx + 6, by + h];
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = K.ink; g.lineWidth = 11; g.beginPath(); g.moveTo(...top); g.quadraticCurveTo(bx + 44, by, ...bot); g.stroke(); // the limb, outlined
  g.strokeStyle = A.wood; g.lineWidth = 7; g.beginPath(); g.moveTo(...top); g.quadraticCurveTo(bx + 44, by, ...bot); g.stroke();
  g.strokeStyle = A.alta; g.lineWidth = 9; g.beginPath(); g.moveTo(bx + 24, by - 12); g.quadraticCurveTo(bx + 27, by, bx + 24, by + 12); g.stroke(); // the grip
  g.strokeStyle = K.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(...top); if (hold) g.lineTo(hold.x, hold.y); g.lineTo(...bot); g.stroke(); // the string
}

export const OCT_GAMES = {
  snake: {
    head: durga, food: demon, tail: marigold,
    ready: ['DURGA MAA, ON THE CHASE', 'arrows, WASD or swipe to start'],
    over: (n) => `${n} ${n === 1 ? 'DEMON' : 'DEMONS'} CAUGHT`,
    unit: 'demons',
  },
  fling: {
    target: demon, shot: arrow, bow,
    words: { foe: 'demon', foes: 'demons', shot: 'arrow', shots: 'arrows', Shots: 'ARROWS', pop: 'hit' },
  },
};
