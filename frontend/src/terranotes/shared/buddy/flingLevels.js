// Fling's levels (Fling.jsx), 50 of them, easy to hard: ranked by how many of ~870 shots (every angle and pull) clear
// a level in one go, then how many gremlins a shot pops on average (scratch measurement, not part of the build).
// Each is built from a few parts standing on the ground (y 490):
// huts (two posts and a roof, a gremlin inside), towers (huts stacked), stacks of boxes, pyramids, bridges, walls.
// A part takes its centre x and the y it stands on, and returns the y of its top, so parts stack on each other.
// Every level stands still until hit and can be cleared with 3 Buddies (checked by a script that plays them all).
// A level is a list of [kind, x, y (centre), w, h] for blocks ('wood' / 'glass' / 'stone') and ['gremlin', x, y, r].
const W = 'wood', G = 'glass', S = 'stone', F = 490;

function level(make) {
  const out = [];
  const rect = (m, x, yb, w, h) => { out.push([m, x, yb - h / 2, w, h]); return yb - h; };
  const p = {
    post: (m, x, yb, h, w = 20) => rect(m, x, yb, w, h),
    slab: (m, x, yb, w, h = 18) => rect(m, x, yb, w, h),
    box: (m, x, yb, s = 36) => rect(m, x, yb, s, s),
    g: (x, yb, r = 16) => { out.push(['gremlin', x, yb - r, r]); return yb - 2 * r; },
    // two posts and a roof, a gremlin inside (g: false for none)
    hut: (x, yb, { w = 100, h = 90, m = W, roof = m, g = true, r = 16 } = {}) => {
      p.post(m, x - w / 2 + 10, yb, h); p.post(m, x + w / 2 - 10, yb, h);
      if (g) p.g(x, yb, r);
      return p.slab(roof, x, yb - h, w + 16);
    },
    // huts stacked; gremlins on every floor unless g: false
    tower: (x, yb, n, o = {}) => { let y = yb; for (let i = 0; i < n; i++) y = p.hut(x, y, o); return y; },
    stack: (m, x, yb, n, s = 36) => { let y = yb; for (let i = 0; i < n; i++) y = p.box(m, x, y, s); return y; },
    // rows of boxes, each row one shorter, centred
    pyramid: (m, x, yb, rows, s = 34) => {
      let y = yb;
      for (let r = rows; r > 0; r--) { for (let i = 0; i < r; i++) p.box(m, x + (i - (r - 1) / 2) * s, y, s); y -= s; }
      return y;
    },
    // a long slab on two posts, gremlins on it (xs)
    bridge: (x, yb, { w = 240, h = 100, m = W, deck = m, gs = [] } = {}) => {
      p.post(m, x - w / 2 + 14, yb, h); p.post(m, x + w / 2 - 14, yb, h);
      const top = p.slab(deck, x, yb - h, w);
      gs.forEach((gx) => p.g(gx, top, 15));
      return top;
    },
  };
  make(p);
  return out;
}

export const LEVELS = [
  // 1–10: the easiest
  level((p) => { p.g(960, p.tower(960, F, 3, { w: 90, h: 80, m: G })); }),
  level((p) => { const t = p.tower(950, F, 2, { w: 220, h: 90, m: W, roof: S }); p.g(950, p.hut(950, t, { w: 100, h: 70, m: G }), 15); }),
  level((p) => { p.g(950, p.tower(950, F, 2)); }),
  level((p) => { const t = p.hut(950, F, { w: 220, h: 90 }); p.g(950, p.hut(950, t, { w: 110, h: 70, m: G })); }),
  level((p) => { p.bridge(950, F, { gs: [890, 1010] }); p.g(950, F, 18); }),
  level((p) => { const t = p.slab(W, 920, p.post(G, 850, F, 90) && p.post(G, 990, F, 90), 190); p.g(895, F); p.g(945, F); p.g(920, p.hut(920, t, { w: 80, h: 60, m: G, r: 14 }), 14); }),
  level((p) => { p.bridge(950, F, { w: 300, h: 120, m: S, deck: W, gs: [870, 950, 1030] }); }),
  level((p) => { p.g(1000, p.tower(1000, F, 4, { w: 80, h: 70, g: false }), 16); p.g(1000, F, 14); }),
  level((p) => { p.bridge(900, F, { w: 200, h: 140, m: G, gs: [900] }); p.g(900, p.hut(900, F, { w: 100, h: 70, m: G, roof: W }), 16); }),
  level((p) => { p.g(950, p.slab(G, 950, p.stack(W, 1020, F, 3) && p.stack(W, 880, F, 3), 200), 18); p.g(950, F, 18); }),
  // 11–20
  level((p) => { p.g(950, p.hut(950, F)); }),
  level((p) => { p.bridge(950, p.hut(950, F, { w: 300, h: 80, m: S, roof: W, g: false }), { w: 240, h: 80, m: G, gs: [890, 1010] }); p.g(900, F); p.g(1000, F); }),
  level((p) => { p.g(1000, p.tower(1000, F, 4, { w: 90, h: 60, g: false, m: G, roof: W }), 15); p.g(1080, F); p.g(920, F); }),
  level((p) => { p.g(950, p.tower(950, F, 2, { w: 150, h: 90, m: G, r: 18 })); p.stack(S, 820, F, 3); p.stack(S, 1080, F, 3); }),
  level((p) => { p.g(950, p.tower(950, p.tower(950, F, 1, { w: 260, h: 90, m: S }), 2, { w: 120, h: 70, m: W }), 15); }),
  level((p) => { const t = p.slab(W, 950, p.post(S, 830, F, 90, 24) && p.post(S, 950, F, 90, 24) && p.post(S, 1070, F, 90, 24), 280); p.g(890, F); p.g(1010, F); p.g(950, p.tower(950, t, 2, { w: 120, h: 70, m: G }), 15); }),
  level((p) => { const t = p.tower(950, F, 2, { w: 280, h: 90, m: S, roof: W, g: false }); p.g(890, F); p.g(1010, F); p.g(950, p.tower(950, t, 2, { w: 120, h: 70, m: G, roof: W }), 15); p.g(780, p.stack(W, 780, F, 2), 14); p.g(1130, p.stack(W, 1130, F, 2), 14); }),
  level((p) => { p.g(880, p.stack(G, 880, F, 3)); p.hut(1040, F, { m: G }); }),
  level((p) => { const t = p.tower(1000, F, 2, { w: 180, h: 80, m: S, roof: W }); p.g(1000, p.stack(G, 1000, t, 2), 15); p.stack(W, 840, F, 3); }),
  level((p) => { p.g(900, p.pyramid(G, 900, p.slab(W, 900, F, 200, 18), 4), 14); p.g(1100, p.stack(W, 1100, F, 2)); }),
  // 21–30
  level((p) => { p.g(890, p.tower(890, F, 3, { w: 80, h: 70, m: G }), 14); p.g(1000, p.tower(1000, F, 3, { w: 80, h: 70, m: W }), 14); }),
  level((p) => { const a = p.tower(860, F, 2, { w: 90, h: 80, m: S, roof: W }); p.g(860, a, 15); p.g(1040, p.tower(1040, F, 2, { w: 90, h: 80, m: G }), 15); }),
  level((p) => { p.g(950, p.pyramid(W, 950, p.hut(950, F, { w: 200, h: 80, m: S }), 3), 15); }),
  level((p) => { const t = p.hut(950, F, { w: 240, h: 100, m: S, roof: W, g: false }); p.g(890, F); p.g(1010, F); p.g(950, p.stack(G, 950, t, 3), 15); }),
  level((p) => { const t = p.slab(S, 960, p.post(S, 840, F, 110, 24) && p.post(S, 1080, F, 110, 24), 280, 20); p.g(900, F); p.g(1020, F); p.g(960, p.hut(960, t, { w: 120, h: 70, m: G })); }),
  level((p) => { p.g(800, p.stack(S, 800, F, 3), 15); p.g(1100, p.stack(W, 1100, F, 2), 15); p.g(960, p.tower(960, F, 2, { w: 130, h: 80, m: W, roof: G }), 15); }),
  level((p) => { p.tower(890, F, 2, { w: 90, h: 80 }); const t = p.tower(1010, F, 2, { w: 90, h: 80 }); p.g(950, p.slab(W, 950, t, 230), 16); }),
  level((p) => { p.g(980, p.stack(G, 980, p.hut(980, F, { w: 130, m: S }), 2), 15); p.post(W, 840, F, 120); }),
  level((p) => { p.hut(870, F, { w: 80, h: 70, m: G }); p.hut(955, F, { w: 80, h: 110, m: G }); p.hut(1040, F, { w: 80, h: 150, m: G, roof: W }); }),
  level((p) => { p.g(910, p.hut(910, F, { w: 120, h: 100 })); p.g(1070, p.slab(W, 1070, p.post(G, 1090, F, 80, 20) && p.post(G, 1050, F, 80, 20), 70, 16), 15); }),
  // 31–40
  level((p) => { const t = p.slab(S, 940, p.post(S, 880, F, 50) && p.post(S, 1000, F, 50), 170); p.g(910, F, 13); p.g(970, F, 13); p.g(940, p.box(G, 940, t, 40), 15); }),
  level((p) => { p.g(870, p.stack(W, 870, F, 2)); p.g(935, p.stack(G, 935, F, 3)); p.g(1000, p.stack(W, 1000, F, 4)); }),
  level((p) => { p.g(930, p.pyramid(G, 930, F, 4), 15); p.g(1100, F); }),
  level((p) => { p.g(860, p.pyramid(S, 860, F, 3), 15); p.g(1060, p.hut(1060, F, { m: G, roof: W })); }),
  level((p) => { p.g(870, p.pyramid(G, 870, F, 4), 14); p.g(1060, p.pyramid(W, 1060, F, 3), 14); }),
  level((p) => { [850, 905, 960, 1015].forEach((x, i) => p.g(x, p.stack(i % 2 ? G : W, x, F, [2, 3, 3, 2][i]), 14)); }),
  level((p) => { p.g(900, p.pyramid(S, 900, F, 4), 14); p.g(1060, p.tower(1060, F, 4, { w: 80, h: 60, m: G, roof: W }), 14); }),
  level((p) => { p.hut(860, F, { roof: G }); p.hut(1010, F, { roof: G }); }),
  level((p) => { [870, 960, 1050].forEach((x, i) => p.g(x, p.tower(x, F, i + 1, { w: 80, h: 70, m: [G, W, W][i], roof: W, g: i === 2 }), 14)); }),
  level((p) => { p.g(1100, p.hut(1100, F, { w: 90, m: G }), 14); p.stack(S, 980, F, 4); p.stack(S, 940, F, 2); p.g(860, p.stack(W, 860, F, 1)); }),
  // 41–50: the hardest
  level((p) => { p.g(800, p.slab(S, 800, p.post(S, 800, F, 110, 24), 60, 16), 15); p.g(1100, p.slab(S, 1100, p.post(S, 1100, F, 110, 24), 60, 16), 15); p.g(950, p.tower(950, F, 2, { w: 120 }), 14); }),
  level((p) => { p.hut(900, F, { w: 100, h: 60, r: 14 }); p.g(1020, p.stack(G, 1020, p.hut(1015, F, { w: 100, h: 60, r: 14, m: S }), 3), 14); }),
  level((p) => { p.g(800, p.slab(S, 800, p.post(S, 800, F, 130, 24), 60, 16), 14); p.g(950, p.tower(950, F, 3, { w: 110, h: 70, m: W, roof: G }), 14); p.g(1100, p.slab(S, 1100, p.post(S, 1100, F, 130, 24), 60, 16), 14); }),
  level((p) => { p.hut(840, F, { m: S, w: 90 }); p.hut(960, F, { m: G, w: 90 }); p.hut(1080, F, { m: W, w: 90 }); }),
  level((p) => { p.hut(880, F, { m: S, roof: G }); p.tower(1060, F, 2, { w: 90, h: 80 }); }),
  level((p) => { p.g(900, p.pyramid(W, 900, F, 5), 15); p.hut(1100, F, { w: 90, h: 80, m: S }); }),
  level((p) => { p.g(1080, p.tower(1080, F, 3, { w: 80, h: 70, m: W, roof: G }), 14); p.post(S, 920, F, 160, 26); }),
  level((p) => { p.hut(1120, F, { w: 90 }); p.g(1000, p.stack(S, 1000, F, 3), 15); p.stack(W, 900, F, 2); }),
  level((p) => { p.g(950, p.pyramid(W, 950, F, 6, 32), 15); p.g(1070, p.stack(G, 1070, F, 2), 14); p.g(1120, F); }),
  level((p) => { p.post(W, 910, F, 170, 24); p.g(965, F, 18); p.hut(1045, F, { w: 90 }); }),
];

// the levels used to be in another order: WAS[i] is where level i used to be, so a player's saved stars and
// best scores move with their levels (Fling.jsx moves them once, keyed by ORDER)
export const ORDER = 2;
export const WAS = [12, 40, 4, 20, 7, 8, 21, 17, 31, 26, 0, 42, 36, 18, 32, 47, 49, 1, 45, 24, 41, 25, 29, 38, 34, 30, 14, 23, 22, 2, 16, 11, 5, 19, 35, 33, 48, 3, 46, 39, 9, 27, 44, 37, 10, 13, 28, 15, 43, 6];
