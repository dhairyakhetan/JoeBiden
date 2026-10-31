import { useEffect, useRef, useState } from 'react';
import { useEdition } from '../../lib/edition.js';
import { drawCrown, drawGhost, drawTrophy } from './Ghost.jsx';
import { giveReward, hasReward, useRewards } from '../../lib/buddyState.js';
import { FONT } from '../../styles/fonts.js';
import { LEVELS, ORDER, WAS } from './flingLevels.js';
import { CloseIcon } from '../Icons.jsx';
import { GAME_SKIN } from '../../editions/pages.js';

// Fling, the slingshot game in Buddy's games (BuddyGames.jsx), played like Angry Birds: drag Buddy back in the
// slingshot (the further, the harder), let go, and knock down towers of planks to pop the grumpy gremlins hiding in
// them. Three Buddies a level; a level is cleared when every gremlin is gone (each unused Buddy is a bonus), else it's
// a retry. Real physics (matter-js, fetched only when this tab opens): planks topple, slide and break when hit hard
// enough; a gremlin pops on a hard enough knock, from Buddy, a plank or a fall. Points: gremlin 5000, stone 800, wood
// 500, glass 300, unused Buddy 10000. No sleeping bodies: a plank left unheld falls. The world is 1200 × 540, drawn scaled into the canvas; the canvas only draws while
// the popup is open. Each level's best score in localStorage ('aq-fling-scores': the highest, not the latest), the furthest level reached too ('aq-fling-level'; 'aq-fling-order' marks saves already moved to the levels' new order):
// the game starts there, and the level picker under the canvas lists every level up to it. The 50 levels: flingLevels.js.
// What tells you what to do: a banner at each level's start (how many gremlins to pop), a pulsing ring and "drag me"
// on Buddy while he waits (the pull starts anywhere on the canvas: the finger's travel pulls him back, so a thumb
// needn't reach the left edge), and, while you pull, the reach of the band, a dotted line of where he'll fly and a power
// meter; Buddies and gremlins left in the corner; a line after each turn ("missed: pull further", "2 gremlins left");
// buttons drawn on the cleared / out-of-Buddies cards; the cursor changes over Buddy; Restart level under the canvas.
// Once the crown is won (level 50 beaten), a "Reset progress" button (asks first) on the winner's screen and in the level
// picker wipes the levels, stars and best scores to play it all again; Buddy keeps his crown and trophy.
// An edition can dress it its own way (src/editions/pages.js GAME_SKIN fling: target, shot, bow and its words): October
// draws a bow, an arrow for Buddy and demon faces for the gremlins; the physics and levels are the same.
const WORDS = { foe: 'gremlin', foes: 'gremlins', shot: 'Buddy', shots: 'Buddies', Shots: 'BUDDIES', pop: 'pop' };
const WW = 1200, WH = 540, GROUND = 490, BASE = GROUND - 30, SLING = { x: 160, y: BASE - 92 }, PULL = 100, POWER = 0.25, BR = 17;
// the slingshot stands on a mound at the left (BASE is its top), the gremlins' forts far out at the right, like Angry Birds
const HP = { gremlin: 1, glass: 3, wood: 8, stone: 16 }, PTS = { gremlin: 5000, glass: 300, wood: 500, stone: 800 };
// each level's best score (its points: pops, breaks and Buddy bonus), kept as the highest, never the latest
const scoresOf = () => { try { const a = JSON.parse(localStorage.getItem('aq-fling-scores') || '[]'); return LEVELS.map((_, i) => Number(a[i]) || 0); } catch { return LEVELS.map(() => 0); } };
const keepScores = (a) => { try { localStorage.setItem('aq-fling-scores', JSON.stringify(a)); } catch { /* private mode */ } };
const short = (n) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n)); // 12400 → "12.4k"
// how far you've got: the furthest level open to play (the picker lists them)
const reached = () => { try { return Math.min(LEVELS.length - 1, Number(localStorage.getItem('aq-fling-level')) || 0); } catch { return 0; } };
// stars per level (1 for clearing it, +1 for each Buddy left, up to 3), one digit a level
const starsOf = () => { try { return (localStorage.getItem('aq-fling-stars') || '').padEnd(LEVELS.length, '0').split('').map(Number); } catch { return LEVELS.map(() => 0); } };
const keepStars = (a) => { try { localStorage.setItem('aq-fling-stars', a.join('')); } catch { /* private mode */ } };
// the how-to card: shown the first time Fling opens (then on the ? button)
const howtoSeen = () => { try { return !!localStorage.getItem('aq-fling-howto'); } catch { return false; } };
const howtoDone = () => { try { localStorage.setItem('aq-fling-howto', '1'); } catch { /* private mode */ } };
// the levels were put in a new order (easy to hard): once, move a player's stars and best scores with their levels, and
// keep every level they'd reached or starred open
if (typeof window !== 'undefined') try {
  if (Number(localStorage.getItem('aq-fling-order') || 1) < ORDER) {
    const st = starsOf(), sc = scoresOf(), was = reached();
    const ns = WAS.map((o) => st[o] || 0), nc = WAS.map((o) => sc[o] || 0);
    const lastStar = ns.reduce((m, v, i) => (v ? i : m), -1);
    if (localStorage.getItem('aq-fling-stars') != null) keepStars(ns);
    if (localStorage.getItem('aq-fling-scores') != null) keepScores(nc);
    if (localStorage.getItem('aq-fling-level') != null || lastStar >= 0) localStorage.setItem('aq-fling-level', String(Math.min(LEVELS.length - 1, Math.max(was, lastStar + 1))));
    localStorage.setItem('aq-fling-order', String(ORDER));
  }
} catch { /* private mode */ }
const reach = (v) => { try { localStorage.setItem('aq-fling-level', String(v)); } catch { /* private mode */ } };
const wipe = () => { try { ['aq-fling-level', 'aq-fling-stars', 'aq-fling-scores'].forEach((k) => localStorage.removeItem(k)); } catch { /* private mode */ } };

export default function Fling({ W, H }) {
  const ed = useEdition(), { colors: K, fonts: F, art: A } = ed.look; // a canvas can't read CSS variables: the values themselves
  const SKF = GAME_SKIN[ed.id]?.fling, V = { ...WORDS, ...SKF?.words }; // the edition's look for the game, and its words
  const cv = useRef(null);
  const [score, setScore] = useState(0), [scores, setScores] = useState(scoresOf), [failed, setFailed] = useState(false); // score: this level's points
  const restart = useRef(null), jump = useRef(null);
  const [howto, setHowto] = useState(() => !howtoSeen());
  const closeHowto = () => { howtoDone(); setHowto(false); };
  const [lv, setLv] = useState(reached), [open, setOpen] = useState(reached), [stars, setStars] = useState(starsOf), [pick, setPick] = useState(false), [won, setWon] = useState(false);
  const { crown } = useRewards();
  const inline = W < 400 || H < 380; // the how-to card takes the game's place (a short game can't hold it over itself)
  const reset = () => { wipe(); setStars(starsOf()); setScores(scoresOf()); setOpen(0); setPick(false); setWon(false); jump.current?.(0); };
  useEffect(() => {
    let raf = 0, gone = false, cleanup = () => {};
    import('matter-js').then(({ default: M }) => {
      if (gone) return;
      const c = cv.current, dpr = Math.min(window.devicePixelRatio || 1, 3);
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      const g = c.getContext('2d'), k = W / WW; // world → canvas
      const T = WH - H / k; // the top of what the canvas shows (a tall canvas shows sky above the world's top)
      const u = (px) => Math.round(px * Math.min(2.4, Math.max(1, 0.62 / k))); // the drawn text and guides: bigger on a small canvas, so they stay readable
      g.setTransform(dpr * k, 0, 0, dpr * k, 0, (H / k - WH) * dpr * k); // the world's floor sits at the canvas's bottom
      const engine = M.Engine.create({ positionIterations: 10, velocityIterations: 8 });
      engine.gravity.y = 2; // twice matter's default: Buddy arcs and drops, not flies flat
      let s; // the game's state
      const s0 = {}; // what stays across levels (the mound's outline)
      const total = { pts: 0 };
      const add = (n, x, y) => { total.pts += n; setScore(total.pts - s.start); s.pops.push({ x, y, text: String(n), life: 1 }); };

      const build = (lv) => {
        M.Composite.clear(engine.world, false);
        M.Composite.add(engine.world, M.Bodies.rectangle(WW / 2, GROUND + 40, WW * 3, 80, { isStatic: true, label: 'ground', friction: 0.9 }));
        const mound = M.Bodies.trapezoid(SLING.x, GROUND - 15, 320, GROUND - BASE, 0.4, { isStatic: true, label: 'ground', friction: 0.9 });
        M.Body.setPosition(mound, { x: SLING.x, y: mound.position.y + GROUND - mound.bounds.max.y });
        M.Composite.add(engine.world, mound); s0.mound = mound.vertices;
        const things = LEVELS[lv].map(([kind, x, y, w, h]) => {
          const b = kind === 'gremlin'
            ? M.Bodies.circle(x, y, w, { density: 0.0012, friction: 0.6, restitution: 0.2, label: 'gremlin' })
            : M.Bodies.rectangle(x, y, w, h, { density: kind === 'glass' ? 0.0011 : kind === 'stone' ? 0.003 : 0.0016, friction: 0.8, restitution: 0.05, label: kind });
          b.hp = HP[kind]; b.kind = kind; b.r = kind === 'gremlin' ? w : 0;
          return b;
        });
        M.Composite.add(engine.world, things);
        s = { lv, birds: 3, total: things.filter((b) => b.kind === 'gremlin').length, broke: 0, state: 'aim', ghost: null, pull: null, trail: [], since: 0, calm: 0.8, pops: [], bits: [], t: 0, banner: 2.2, note: null, hit: 0, grabbed: s?.grabbed || false, start: total.pts };
        setFailed(false); setWon(false); setLv(lv); setScore(0);
      };
      build(reached());

      // knocks: a hard enough hit breaks a plank or pops a gremlin (not while a fresh level settles)
      M.Events.on(engine, 'collisionStart', (ev) => {
        if (s.calm > 0) return;
        for (const { bodyA: a, bodyB: b } of ev.pairs) {
          const hit = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
          for (const [x, o] of [[a, b], [b, a]]) {
            if (!x.kind || x.dead) continue;
            const blow = hit * (o.label === 'buddy' ? 1.6 : o.isStatic ? 0.8 : 1) * Math.sqrt(Math.max(o.mass, 1) / 2);
            if (blow < (x.kind === 'gremlin' ? 2.6 : 3.2)) continue;
            x.hp -= blow / (x.kind === 'gremlin' ? 2.6 : 3);
            if (x.hp <= 0) breakUp(x);
          }
        }
      });
      const breakUp = (b) => {
        b.dead = true;
        M.Composite.remove(engine.world, b);
        const { x, y } = b.position;
        add(PTS[b.kind], x, y - 20);
        if (b.kind === 'gremlin') s.hit++; else s.broke++;
        for (let i = 0; i < 8; i++) s.bits.push({ x, y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 260, life: 1, kind: b.kind });
      };
      const gremlins = () => M.Composite.allBodies(engine.world).filter((b) => b.kind === 'gremlin' && !b.dead);

      const launch = () => {
        const p = s.pull; s.pull = null;
        if (!p || Math.hypot(p.x - SLING.x, p.y - SLING.y) < 12) return; // a tap, not a pull
        const ghost = M.Bodies.circle(p.x, p.y, BR, { density: 0.004, friction: 0.5, restitution: 0.35, frictionAir: 0.004, label: 'buddy' });
        M.Composite.add(engine.world, ghost);
        M.Body.setVelocity(ghost, { x: (SLING.x - p.x) * POWER, y: (SLING.y - p.y) * POWER });
        s.ghost = ghost; s.birds--; s.state = 'flying'; s.since = 0; s.trail = []; s.hit = 0; s.broke = 0; s.grabbed = true; s.note = null;
      };
      // the level is cleared (every gremlin gone): unused Buddies count, stars and best score are kept, rewards given
      const cleared = () => {
        for (let i = 0; i < s.birds; i++) add(10000, SLING.x + i * 30, SLING.y - 60);
        s.state = 'clear'; s.stars = 1 + Math.min(2, s.birds);
        { const a = starsOf(); if (s.stars > a[s.lv]) { a[s.lv] = s.stars; keepStars(a); setStars(a); } }
        s.pts = total.pts - s.start; s.wasBest = scoresOf()[s.lv];
        { const a = scoresOf(); if (s.pts > a[s.lv]) { a[s.lv] = s.pts; keepScores(a); setScores(a); } }
        s.allStars = starsOf().reduce((a, b) => a + b, 0);
        if (s.allStars === LEVELS.length * 3 && !hasReward('trophy')) { giveReward('trophy'); s.newTrophy = true; s.state = 'stars'; } // every star: Buddy's trophy
        if (s.lv === LEVELS.length - 1) { // the last level: the winner's screen, and Buddy's crown for good
          s.state = 'won'; giveReward('crown'); setWon(true);
          const hues = [K.yellow, K.red, K.blue, K.green, K.purple, K.pink];
          s.confetti = Array.from({ length: 140 }, (_, i) => ({ x: Math.random() * WW, y: T - Math.random() * 500, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 160, r: Math.random() * 6, vr: (Math.random() - 0.5) * 8, w: 8 + Math.random() * 8, c: hues[i % hues.length] }));
        }
        if (s.lv + 1 < LEVELS.length && s.lv + 1 > reached()) { reach(s.lv + 1); setOpen(s.lv + 1); }
      };
      // a turn ends when everything has (nearly) stopped, Buddy has left the world, or 9 s have passed
      const settle = (dt) => {
        s.since += dt;
        const moving = M.Composite.allBodies(engine.world).some((b) => !b.isStatic && b.speed > 0.3);
        const out = s.ghost && (s.ghost.position.x > WW + 60 || s.ghost.position.x < -60);
        if ((s.since > 1.2 && !moving) || out || s.since > 9) {
          if (s.ghost) { M.Composite.remove(engine.world, s.ghost); s.ghost = null; }
          if (!gremlins().length) cleared(); // every gremlin gone
          else if (s.birds > 0) {
            const n = gremlins().length;
            s.state = 'aim';
            s.note = { text: s.hit ? `nice! ${n} ${n === 1 ? V.foe : V.foes} left` : s.broke ? `close! ${n} ${n === 1 ? V.foe : V.foes} left` : 'missed: aim with the dots, pull further', life: 2.6 };
          }
          else { s.state = 'failed'; setFailed(true); }
        }
      };

      // drawing (world units)
      const ink = (w = 2.5) => { g.strokeStyle = K.ink; g.lineWidth = w; g.lineJoin = 'round'; };
      const drawBody = (b) => {
        if (b.kind === 'gremlin') {
          const { x, y } = b.position, r = b.r;
          g.save(); g.translate(x, y); g.rotate(b.angle);
          if (SKF) { SKF.target(g, r * 1.12, K, A); g.restore(); return; }
          g.fillStyle = K.green; ink(); g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill(); g.stroke();
          g.fillStyle = K.card; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * r * 0.36, -r * 0.18, r * 0.26, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = K.ink; for (const sx of [-1, 1]) { g.beginPath(); g.arc(sx * r * 0.32, -r * 0.14, r * 0.12, 0, Math.PI * 2); g.fill(); }
          ink(2); g.beginPath(); g.moveTo(-r * 0.6, -r * 0.55); g.lineTo(-r * 0.12, -r * 0.4); g.moveTo(r * 0.6, -r * 0.55); g.lineTo(r * 0.12, -r * 0.4); g.stroke(); // grumpy brows
          g.beginPath(); g.arc(0, r * 0.5, r * 0.25, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); // frown
          g.restore();
          return;
        }
        const v = b.vertices;
        g.beginPath(); g.moveTo(v[0].x, v[0].y); for (let i = 1; i < v.length; i++) g.lineTo(v[i].x, v[i].y); g.closePath();
        if (b.kind === 'glass') { g.fillStyle = K.cream; g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1; g.strokeStyle = K.blue; g.lineWidth = 2.5; g.stroke(); }
        else if (b.kind === 'stone') { g.fillStyle = K.muted; g.fill(); ink(); g.stroke(); }
        else { g.fillStyle = K.peg; g.fill(); ink(); g.stroke(); }
        if (b.hp < HP[b.kind]) { // cracked
          const { x, y } = b.position; g.save(); g.translate(x, y); g.rotate(b.angle); ink(1.4); g.beginPath(); g.moveTo(-6, -8); g.lineTo(2, 0); g.lineTo(-3, 8); g.stroke(); g.restore();
        }
      };
      const drawSling = (front) => {
        const bx = SLING.x, by = SLING.y;
        if (SKF) { // the edition's bow on a little stand, its string drawn back to the shot
          if (!front) { g.fillStyle = A.wood; ink(); g.beginPath(); g.rect(bx + 4, by + 50, 10, BASE - by - 50); g.fill(); g.stroke(); SKF.bow(g, bx - 6, by, s.pull, K, A); }
          return;
        }
        if (!front) { // back post and band
          g.fillStyle = K.peg; ink(); g.beginPath(); g.moveTo(bx - 6, BASE); g.lineTo(bx - 4, by + 40); g.lineTo(bx + 14, by - 4); g.lineTo(bx + 20, by); g.lineTo(bx + 6, by + 44); g.lineTo(bx + 8, BASE); g.closePath(); g.fill(); g.stroke();
        }
        const hold = s.pull || (s.state === 'aim' ? SLING : null);
        if (hold) { g.strokeStyle = K.ink; g.lineWidth = 5; g.beginPath(); g.moveTo(front ? bx - 10 : bx + 16, by); g.lineTo(hold.x, hold.y); g.stroke(); }
        if (front) { g.fillStyle = K.peg; ink(); g.beginPath(); g.moveTo(bx - 2, by + 44); g.lineTo(bx - 16, by); g.lineTo(bx - 8, by - 4); g.lineTo(bx + 4, by + 38); g.closePath(); g.fill(); g.stroke(); }
      };
      // where Buddy will fly from a pull: the same steps as the physics (gravity 2 × 0.001 a ms², 60 steps a second,
      // air friction 0.004), dotted until it lands or leaves the world
      const flight = (p) => {
        let x = p.x, y = p.y, vx = (SLING.x - p.x) * POWER, vy = (SLING.y - p.y) * POWER;
        const dots = [];
        for (let i = 1; i < 150; i++) {
          vx *= 0.996; vy = vy * 0.996 + 0.5556; x += vx; y += vy;
          if (i % 4 === 0) dots.push([x, y]);
          if (y > GROUND - 4 || x > WW + 20) break;
        }
        return dots;
      };
      const button = (text, y, fill = K.yellow, f = 1) => { // a drawn button (the whole card takes the tap); f: smaller
        g.font = `700 ${u(22) * f}px ${F.mono}`; const w = g.measureText(text).width + 56 * f, x = WW / 2 - w / 2;
        const bh = u(52) * f;
        g.fillStyle = K.ink; g.fillRect(x + 5, y + 5, w, bh);
        g.fillStyle = fill; g.fillRect(x, y, w, bh); g.strokeStyle = K.ink; g.lineWidth = 3; g.strokeRect(x, y, w, bh);
        g.fillStyle = K.ink; g.textAlign = 'center'; g.fillText(text, WW / 2, y + bh * 0.65);
      };
      const label = (lines, cta) => {
        g.fillStyle = 'rgba(17,17,17,.6)'; g.fillRect(-400, -400, WW + 800, WH + 800);
        g.textAlign = 'center'; g.fillStyle = K.page;
        lines.forEach(([text, font, y]) => { g.font = font; g.fillText(text, WW / 2, WH / 2 + u(y)); });
        button(cta, WH / 2 + u(56));
      };
      const starRow = (y, n) => { // 3 stars, n of them filled
        for (let i = 0; i < 3; i++) {
          const cx = WW / 2 + (i - 1) * u(58), cy = y + (i === 1 ? -u(8) : 0), R = u(24);
          g.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? R * 0.45 : R; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath();
          g.fillStyle = i < n ? K.yellow : 'rgba(255,255,255,.15)'; g.fill(); g.strokeStyle = K.ink; g.lineWidth = 3; g.stroke();
        }
      };
      const hud = () => { // the mission, top right: the goal, a pip per gremlin (ticked once popped), Buddies left, the 3★ goal
        const n = s.total, left = gremlins().length, w = u(254), h = u(124), x = WW - 16 - w, y = T + u(12);
        g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(0.012); g.translate(-x - w / 2, -y - h / 2); // a little crooked, like the cards
        g.fillStyle = K.ink; g.fillRect(x + u(5), y + u(5), w, h); g.fillStyle = K.card; g.fillRect(x, y, w, h); ink(2); g.strokeRect(x, y, w, h);
        g.font = `700 ${u(12)}px ${F.mono}`; const tag = 'MISSION', tw = g.measureText(tag).width + u(16); // a tape with the word on it
        g.fillStyle = K.yellow; g.fillRect(x + u(12), y - u(9), tw, u(20)); ink(1.5); g.strokeRect(x + u(12), y - u(9), tw, u(20));
        g.fillStyle = K.ink; g.textAlign = 'left'; g.fillText(tag, x + u(20), y + u(6));
        g.fillStyle = K.hand; g.font = `700 ${u(23)}px ${F.hand}`;
        g.fillText(left ? `${V.pop} all ${n} ${n === 1 ? V.foe : V.foes}` : V.pop === 'pop' ? 'all popped!' : 'all down!', x + u(14), y + u(38));
        const pr = u(8), gap = Math.min(u(22), (w - u(28)) / Math.max(n, 1));
        for (let i = 0; i < n; i++) { // popped first: ticked
          const cx = x + u(14) + pr + i * gap, cy = y + u(56), done = i < n - left;
          g.fillStyle = done ? K.card : K.green; ink(1.5); g.beginPath(); g.arc(cx, cy, pr, 0, Math.PI * 2); g.fill(); g.stroke();
          if (done) { g.strokeStyle = K.hand; g.lineWidth = u(2.5); g.beginPath(); g.moveTo(cx - pr * 0.5, cy); g.lineTo(cx - pr * 0.1, cy + pr * 0.45); g.lineTo(cx + pr * 0.6, cy - pr * 0.5); g.stroke(); }
        }
        g.fillStyle = K.ink; g.font = `700 ${u(12)}px ${F.mono}`; g.fillText(V.Shots, x + u(14), y + u(86));
        const bx0 = x + u(14) + g.measureText(V.Shots).width + u(18);
        for (let i = 0; i < 3; i++) {
          g.globalAlpha = i < s.birds ? 1 : 0.2;
          if (SKF) { g.save(); g.translate(bx0 + i * u(26) + u(6), y + u(68)); g.rotate(Math.PI / 2); SKF.shot(g, u(26), K, A); g.restore(); } else drawGhost(g, bx0 + i * u(26), y + u(80), u(9), K, { t: s.t + i, look: [1, 0] });
        }
        g.globalAlpha = 1; g.fillStyle = K.muted; g.font = `700 ${u(11)}px ${F.mono}`;
        g.fillText(`3★: CLEAR IT WITH ONE ${V.shot.toUpperCase()}`, x + u(14), y + u(110));
        g.restore();
      };
      const power = (p) => { // in the ground band: how hard
        const f = Math.min(1, Math.hypot(p.x - SLING.x, p.y - SLING.y) / PULL);
        const x0 = u(110) + 40, y0 = GROUND + 12, w = 300, bar = Math.min(26, u(16));
        g.fillStyle = K.page; g.font = `700 ${u(15)}px ${F.mono}`; g.textAlign = 'right'; g.fillText('POWER', x0 - 12, y0 + bar * 0.8);
        g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x0, y0, w, bar);
        g.fillStyle = f > 0.85 ? K.red : f > 0.5 ? K.yellow : K.green; g.fillRect(x0, y0, w * f, bar);
        g.strokeStyle = K.page; g.lineWidth = 2; g.strokeRect(x0, y0, w, bar);
        g.fillStyle = K.page; g.textAlign = 'left'; g.fillText(`${Math.round(f * 100)}%`, x0 + w + 12, y0 + bar * 0.8);
      };
      const draw = () => {
        const sky = g.createLinearGradient(0, -200, 0, WH); sky.addColorStop(0, K.page); sky.addColorStop(1, K.outside);
        g.fillStyle = sky; g.fillRect(-400, -400, WW + 800, WH + 800);
        g.fillStyle = K.green; g.globalAlpha = 0.35; g.fillRect(-400, GROUND, WW + 800, 8); g.globalAlpha = 1;
        g.fillStyle = K.text; g.fillRect(-400, GROUND + 8, WW + 800, 400);
        if (s0.mound) { const v = s0.mound; g.fillStyle = K.green; g.globalAlpha = 0.35; g.beginPath(); g.moveTo(v[0].x, v[0].y); for (const q of v) g.lineTo(q.x, q.y); g.closePath(); g.fill(); g.globalAlpha = 1; }
        // the last shot's path, in dots
        g.fillStyle = K.ink; s.trail.forEach((p, i) => { if (i % 2) return; g.globalAlpha = 0.35; g.beginPath(); g.arc(p.x, p.y, 3, 0, Math.PI * 2); g.fill(); }); g.globalAlpha = 1;
        if (s.state === 'aim') { // the band's reach, and while pulling, where he'll fly
          g.strokeStyle = K.ink; g.globalAlpha = s.pull ? 0.35 : 0.15; g.lineWidth = 1.5; g.setLineDash([5, 7]);
          g.beginPath(); g.arc(SLING.x, SLING.y, PULL, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
          if (s.pull && Math.hypot(s.pull.x - SLING.x, s.pull.y - SLING.y) > 12) {
            flight(s.pull).forEach(([x, y], i, all) => { g.globalAlpha = 0.85 - (i / all.length) * 0.6; g.fillStyle = K.hand; g.beginPath(); g.arc(x, y, 4.5 - (i / all.length) * 2, 0, Math.PI * 2); g.fill(); });
            g.globalAlpha = 1;
          }
        }
        drawSling(false);
        for (const b of M.Composite.allBodies(engine.world)) if (b.kind) drawBody(b);
        // Buddy: in the pouch, pulled back, or flying
        const at = s.ghost ? s.ghost.position : s.pull || (s.state === 'aim' ? SLING : null);
        if (at && SKF) { // the edition's shot (an arrow), its point leading the way it flies
          const v = s.ghost ? s.ghost.velocity : s.pull ? { x: SLING.x - s.pull.x, y: SLING.y - s.pull.y } : { x: 1, y: 0 }, a = Math.hypot(v.x, v.y) > 0.3 ? Math.atan2(v.y, v.x) : 0;
          g.save(); g.translate(at.x + Math.cos(a) * BR * 1.6, at.y + Math.sin(a) * BR * 1.6); g.rotate(a); SKF.shot(g, BR * 3.6, K, A); g.restore();
        } else if (at) drawGhost(g, at.x, at.y - BR * 0.2, BR, K, { t: s.t, tilt: s.ghost ? s.ghost.angle * 0.3 : 0, look: [1, 0], face: s.ghost && s.ghost.speed > 6 ? 'boo' : 'happy' });
        drawSling(true);
        if (s.state === 'aim' && !s.pull && s.calm <= 0) { // "grab me": a pulsing ring, and the first time a word too
          const pulse = (Math.sin(s.t * 4) + 1) / 2;
          g.strokeStyle = K.hand; g.lineWidth = 3; g.globalAlpha = 0.45 + pulse * 0.5;
          g.beginPath(); g.arc(SLING.x, SLING.y - 4, BR + 10 + pulse * 6, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
          if (!s.grabbed) {
            const text = '← drag back from anywhere, then let go', x = SLING.x + 44;
            g.font = `700 ${u(28)}px ${F.hand}`; const fit = Math.min(1, (WW - 20 - x) / g.measureText(text).width); // shrunk to fit a small canvas
            g.fillStyle = K.hand; g.font = `700 ${Math.round(u(28) * fit)}px ${F.hand}`; g.textAlign = 'left';
            g.fillText(text, x, SLING.y - 52 - pulse * 4);
          }
        }
        if (s.finger && Math.hypot(s.finger.p.x - SLING.x, s.finger.p.y - SLING.y) > PULL * 1.3) { // dragging away from Buddy: show the finger's pull
          const { a, p: q } = s.finger; g.globalAlpha = 0.45; g.strokeStyle = K.ink; g.lineWidth = 2; g.setLineDash([6, 6]);
          g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(q.x, q.y); g.stroke(); g.setLineDash([]);
          g.beginPath(); g.arc(a.x, a.y, u(10), 0, Math.PI * 2); g.stroke(); g.fillStyle = K.ink; g.beginPath(); g.arc(q.x, q.y, u(7), 0, Math.PI * 2); g.fill(); g.globalAlpha = 1;
        }
        if (s.pull) power(s.pull);
        // Buddies still waiting
        for (let i = 0; i < Math.max(0, s.birds - (s.state === 'aim' ? 1 : 0)); i++) {
          if (SKF) { g.save(); g.translate(SLING.x - 50 - i * 22, BASE - 46); g.rotate(-Math.PI / 2 + 0.12); SKF.shot(g, 40, K, A); g.restore(); } // arrows standing by
          else drawGhost(g, SLING.x - 50 - i * 34, BASE - 13, 12, K, { t: s.t + i, look: [1, 0] });
        }
        // bits and points
        s.bits.forEach((p) => { g.globalAlpha = Math.max(0, p.life); g.fillStyle = p.kind === 'gremlin' ? (SKF ? A.flame : K.green) : p.kind === 'glass' ? K.blue : p.kind === 'stone' ? K.muted : K.peg; g.fillRect(p.x - 3, p.y - 3, 6, 6); });
        g.globalAlpha = 1;
        g.textAlign = 'center';
        s.pops.forEach((p) => { g.globalAlpha = Math.max(0, p.life); g.fillStyle = K.ink; g.font = `700 ${u(22)}px ${F.mono}`; g.fillText(p.text, p.x, p.y - (1 - p.life) * 40); });
        g.globalAlpha = 1;
        g.textAlign = 'left'; g.fillStyle = K.ink; g.font = `700 ${u(18)}px ${F.mono}`; g.fillText(`LEVEL ${s.lv + 1}/${LEVELS.length}`, 18, T + u(30));
        hud();
        if (s.banner > 0 && s.state === 'aim') { // the level's goal
          const n = gremlins().length, a = Math.min(1, s.banner / 0.5);
          g.globalAlpha = a; g.fillStyle = K.ink; const by = T + u(56); g.fillRect(WW / 2 - u(230), by, u(460), u(92));
          g.textAlign = 'center'; g.fillStyle = K.yellow; g.font = `700 ${u(30)}px ${F.mono}`; g.fillText(`LEVEL ${s.lv + 1}`, WW / 2, by + u(40));
          g.fillStyle = K.page; g.font = `700 ${u(26)}px ${F.hand}`; g.fillText(`${V.pop} all ${n} ${n === 1 ? V.foe : V.foes} with ${s.birds} ${s.birds === 1 ? V.shot : V.shots}`, WW / 2, by + u(74));
          g.globalAlpha = 1;
        }
        if (s.note && s.state === 'aim') { // how the last turn went
          g.globalAlpha = Math.min(1, s.note.life); g.textAlign = 'center'; g.fillStyle = K.hand; g.font = `700 ${u(30)}px ${F.hand}`;
          g.fillText(s.note.text, WW / 2, T + u(190)); g.globalAlpha = 1;
        }
        if (s.state === 'won' || s.state === 'stars') { // the winner's screen (crown) / every star (trophy): confetti, the prize
          g.fillStyle = 'rgba(17,17,17,.7)'; g.fillRect(-400, -400, WW + 800, WH + 800);
          for (const c of s.confetti) { g.save(); g.translate(c.x, c.y); g.rotate(c.r); g.fillStyle = c.c; g.fillRect(-c.w / 2, -c.w / 4, c.w, c.w / 2); g.restore(); }
          const f = Math.min(1, (WH - T) / u(360)), v = (px) => u(px) * f; // a short game (a phone's) gets it smaller, so it all fits
          const top = Math.max(T + v(20), WH / 2 - v(230)), bob = Math.sin(s.t * 2.4) * v(4);
          const won = s.state === 'won';
          if (won && s.newTrophy) { drawCrown(g, WW / 2 - v(70), top + v(66) + bob, v(84), K); drawTrophy(g, WW / 2 + v(70), top + v(62) - bob, v(110), K); }
          else if (won) drawCrown(g, WW / 2, top + v(66) + bob, v(96), K);
          else drawTrophy(g, WW / 2, top + v(62) + bob, v(116), K);
          g.textAlign = 'center'; g.fillStyle = K.yellow; g.font = `400 ${v(64)}px ${F.head}`; g.fillText(won ? 'WINNER!' : 'EVERY STAR!', WW / 2, top + v(178));
          g.fillStyle = K.page; g.font = `700 ${v(20)}px ${F.mono}`; g.fillText(won ? `ALL ${LEVELS.length} LEVELS · ★ ${s.allStars} / ${LEVELS.length * 3}` : `★ ${s.allStars} / ${LEVELS.length * 3} · EVERY LEVEL, 3 STARS`, WW / 2, top + v(214));
          g.font = `700 ${v(30)}px ${F.hand}`;
          g.fillText(won ? (s.newTrophy ? 'the crown AND the trophy: Buddy wears both now.' : 'Buddy wears the winner’s crown now. call him!') : 'Buddy gets the trophy. call him to see it.', WW / 2, top + v(254));
          button(won || s.lv + 1 >= LEVELS.length ? 'PLAY AGAIN ↺' : 'NEXT LEVEL →', top + v(278), K.yellow, f);
        }
        if (s.state === 'clear') { label([[s.lv + 1 < LEVELS.length ? 'LEVEL CLEARED!' : `EVERY ${V.foe.toUpperCase()} GONE!`, `700 ${u(40)}px ${F.mono}`, -40], [`+${s.pts} this level${s.birds ? ` · ${s.birds} ${V.shot} bonus` : ''}${s.pts > s.wasBest ? ' · new best!' : ` · best ${s.wasBest}`}`, `600 ${u(30)}px ${F.hand}`, 4]], s.lv + 1 < LEVELS.length ? 'NEXT LEVEL →' : 'PLAY AGAIN ↺'); starRow(WH / 2 - u(118), s.stars); }
        if (s.state === 'failed') { const n = gremlins().length; label([[`OUT OF ${V.Shots}`, `700 ${u(40)}px ${F.mono}`, -40], [`${n} ${n === 1 ? V.foe : V.foes} still standing`, `600 ${u(30)}px ${F.hand}`, 4]], 'TRY AGAIN ↺'); }
      };

      let last = performance.now(), acc = 0;
      const loop = (now) => {
        raf = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - last) / 1000); last = now; s.t += dt; s.calm = Math.max(0, s.calm - dt); s.banner -= s.grabbed || s.lv ? dt : dt * 0.5;
        if (s.note) { s.note.life -= dt; if (s.note.life <= 0) s.note = null; }
        acc += dt;
        while (acc >= 1 / 60) { M.Engine.update(engine, 1000 / 60); acc -= 1 / 60; }
        for (const b of M.Composite.allBodies(engine.world)) if (b.kind && !b.dead && b.position.y > WH + 200) breakUp(b); // fell off the world
        if (s.ghost) { s.trail.push({ x: s.ghost.position.x, y: s.ghost.position.y }); if (s.trail.length > 400) s.trail.shift(); }
        if (s.state === 'flying') settle(dt);
        // a gremlin can still fall after a turn has ended (a plank toppling late, a slow roll off the edge): the moment the
        // last one goes, the level is cleared, even while aiming
        else if ((s.state === 'aim' && !s.pull) || s.state === 'failed') { if (!gremlins().length) { setFailed(false); cleared(); } }
        s.bits.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; p.life -= dt * 1.6; });
        if (s.confetti) for (const c of s.confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; if (c.y > WH + 40) { c.y = T - 20; c.x = Math.random() * WW; } } // it keeps falling
        s.bits = s.bits.filter((p) => p.life > 0);
        s.pops.forEach((p) => { p.life -= dt * 0.9; });
        s.pops = s.pops.filter((p) => p.life > 0);
        draw();
      };
      raf = requestAnimationFrame(loop);

      // pointer → world (the canvas may be zoomed with the page: measure it)
      const world = (e) => { const r = c.getBoundingClientRect(); const wx = ((e.clientX - r.left) / r.width) * W / k, wy = ((e.clientY - r.top) / r.height) * H / k - (H / k - WH); return { x: wx, y: wy }; };
      const aimAt = (p) => { const dx = p.x - SLING.x, dy = p.y - SLING.y, d = Math.hypot(dx, dy), m = Math.min(1, PULL / (d || 1)); return { x: SLING.x + dx * m, y: SLING.y + dy * m }; };
      let dragging = false;
      const span = Math.max(PULL, 90 / k); // a full pull: at least 90 screen px of finger travel
      let anchor = null;
      const down = (e) => {
        e.preventDefault();
        if (s.state === 'won') { total.pts = 0; setScore(0); build(0); return; }
        if (s.state === 'clear' || s.state === 'stars') { const next = s.lv + 1 < LEVELS.length ? s.lv + 1 : 0; if (!next) { total.pts = 0; setScore(0); } build(next); return; }
        if (s.state === 'failed') { build(s.lv); return; }
        if (s.state !== 'aim' || s.calm > 0) return;
        const p = world(e);
        // anywhere on the canvas: the finger's travel from here pulls Buddy back
        dragging = true; anchor = p; c.setPointerCapture?.(e.pointerId); s.pull = { ...SLING }; s.finger = { a: p, p }; c.style.cursor = 'grabbing';
      };
      const move = (e) => {
        if (dragging) {
          const q = world(e), f = PULL / span;
          s.pull = aimAt({ x: SLING.x + (q.x - anchor.x) * f, y: SLING.y + (q.y - anchor.y) * f }); s.finger = { a: anchor, p: q };
          s.banner = Math.min(s.banner, 0.3); return;
        }
        c.style.cursor = s.state === 'clear' || s.state === 'failed' || s.state === 'won' || s.state === 'stars' ? 'pointer' : s.state === 'aim' ? 'grab' : 'default';
      };
      const up = () => { if (!dragging) return; dragging = false; s.finger = null; launch(); };
      jump.current = (n) => { total.pts = 0; setScore(0); s.finger = null; dragging = false; build(n); };
      restart.current = () => { total.pts = s.start; setScore(total.pts); build(s.lv); };
      c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      cleanup = () => { c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); M.Engine.clear(engine); };
    }).catch(() => { /* the physics didn't arrive: the canvas stays empty */ });
    return () => { gone = true; cancelAnimationFrame(raf); cleanup(); };
  }, [W, H]);
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.mono, fontWeight: "700", letterSpacing: "1.2px", textTransform: "uppercase", fontSize: "10.5px", margin: "0 0 8px" }}>
        <span>{`${score} points`}</span><span style={{ color: "var(--muted)" }}>{`level ${lv + 1} best ${scores[lv]}`}</span>
      </div>
      <div style={{ position: "relative", display: pick || (howto && inline) ? "none" : "block" }}>
        <canvas ref={cv} role="img" aria-label={failed ? `Out of ${V.shots}, tap to retry` : `Drag back anywhere on the game and let go to send ${V.shot === 'Buddy' ? 'Buddy' : `the ${V.shot}`} at the towers`} style={{ display: "block", width: `${W}px`, height: `${H}px`, border: "2px solid var(--ink)", touchAction: "none", cursor: "default", background: "var(--page)" }} />
        {howto && !inline && <HowTo v={V} onClose={closeHowto} />}
      </div>
      {howto && inline && !pick && <HowTo v={V} W={W} small={W < 400} inline onClose={closeHowto} />}
      {pick && <LevelGrid W={W} H={Math.max(H, innerHeight - 250)} lv={lv} open={open} stars={stars} scores={scores} onReset={crown ? reset : null} onPick={(n) => { setPick(false); jump.current?.(n); }} onClose={() => setPick(false)} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: W < 400 ? "8px" : "12px", marginTop: "12px" }}>
        <button type="button" className="press btn" aria-label="Previous level" disabled={lv <= 0} onClick={() => jump.current?.(lv - 1)} style={{ ...BTN, width: "44px", padding: "0", opacity: lv <= 0 ? 0.35 : 1 }}>‹</button>
        <button type="button" className="press btn" aria-label="Pick a level" aria-expanded={pick ? 'true' : 'false'} onClick={() => setPick((v) => !v)} style={{ ...BTN, "--c": "var(--yellow)", background: pick ? "var(--ink)" : "var(--card)", color: pick ? "var(--card)" : "var(--ink)", boxShadow: "3px 3px 0 var(--yellow)", padding: "0 14px", minWidth: W < 400 ? "116px" : "150px" }}>{`Level ${lv + 1}/${LEVELS.length}`} <span aria-hidden="true">{pick ? '▴' : '▾'}</span></button>
        <button type="button" className="press btn" aria-label="Next level" disabled={lv >= open} onClick={() => jump.current?.(lv + 1)} style={{ ...BTN, width: "44px", padding: "0", opacity: lv >= open ? 0.35 : 1 }}>›</button>
        <button type="button" className="press btn" aria-label="How to play" aria-expanded={howto ? 'true' : 'false'} onClick={() => { setPick(false); setHowto((v) => !v); }} style={{ ...BTN, width: "44px", padding: "0", fontSize: "16px" }}>?</button>
        <button type="button" className="press btn" aria-label="Restart level" onClick={() => { setPick(false); restart.current?.(); }} style={{ ...BTN, padding: W < 400 ? "0" : "0 14px", width: W < 400 ? "44px" : "auto" }}>{W < 400 ? '↺' : '↺ Restart'}</button>
      </div>
      {won && !pick && <div style={{ display: "flex", justifyContent: "center", marginTop: "14px" }}><ResetProgress W={W} onReset={reset} /></div>}
      <p style={{ margin: "10px 0 0", textAlign: "center", fontFamily: FONT.hand, fontSize: W < 400 ? "18px" : "20px", lineHeight: "1.1", color: "var(--hand)" }}>{W < 400 ? 'drag back anywhere · follow the dots · let go' : `drag back from anywhere on the game · the dots show where ${V.shot === 'Buddy' ? 'he' : 'it'}’ll fly · let go`}</p>
    </>
  );
}

const BTN = { "--c": "var(--ink)", flexShrink: "0", fontFamily: FONT.mono, fontWeight: "700", letterSpacing: "1px", textTransform: "uppercase", fontSize: "12px", minHeight: "44px", background: "var(--card)", color: "var(--ink)", border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)", cursor: "pointer" };

// the level picker: every level as a tile, in the canvas’s place while open (as tall as the window allows; it scrolls). Played ones show their stars, the
// current one is inked, the next one to beat has a yellow shadow, the rest are locked (dashed).
function LevelGrid({ W, H, lv, open, stars, scores, onPick, onClose, onReset }) {
  const cols = W < 400 ? 6 : 10, total = stars.reduce((a, b) => a + b, 0);
  return (
    <div className="card-drop" role="dialog" aria-label="Pick a level" style={{ boxSizing: "border-box", width: `${W}px`, height: `${H}px`, overflowY: "auto", border: "2px solid var(--ink)", background: "var(--card)", padding: W < 400 ? "12px" : "18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <span style={{ fontFamily: FONT.head, fontSize: W < 400 ? "18px" : "22px", textTransform: "uppercase", color: "var(--ink)" }}>Pick a level</span>
        <span style={{ flexGrow: "1", display: "flex", alignItems: "center", gap: "6px", fontFamily: FONT.mono, fontWeight: "700", fontSize: "11px", letterSpacing: "1px", color: "var(--muted)" }}><Stars n={1} of={1} size={13} />{`${total}/${LEVELS.length * 3}`}</span>
        <button type="button" className="press btn" aria-label="Back to the game" onClick={onClose} style={{ ...BTN, width: "44px", padding: "0" }}><CloseIcon size={14} weight={2.8} /></button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: W < 400 ? "6px" : "10px" }}>
        {LEVELS.map((_, i) => {
          const locked = i > open, here = i === lv, next = i === open && !stars[i];
          return (
            <button key={i} type="button" className={locked ? undefined : 'press btn'} disabled={locked} onClick={() => onPick(i)} aria-label={locked ? `Level ${i + 1}, locked` : `Level ${i + 1}${stars[i] ? `, ${stars[i]} of 3 stars` : ''}`} aria-current={here ? 'true' : undefined}
              style={{ "--c": next ? "var(--yellow)" : "var(--ink)", minHeight: W < 400 ? "48px" : "60px", padding: "4px 0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2px", fontFamily: FONT.mono, fontWeight: "700", fontSize: W < 400 ? "14px" : "16px", cursor: locked ? "default" : "pointer",
                background: here ? "var(--ink)" : locked ? "transparent" : "var(--card)", color: here ? "var(--yellow)" : locked ? "var(--muted)" : "var(--ink)",
                border: locked ? "1.5px dashed var(--muted)" : "2px solid var(--ink)", boxShadow: locked ? "none" : `3px 3px 0 ${next ? "var(--yellow)" : "var(--ink)"}`, opacity: locked ? 0.6 : 1 }}>
              <span>{i + 1}</span>
              {!locked && <Stars n={stars[i]} size={W < 400 ? 9 : 12} on={here} />}
              {!locked && scores[i] > 0 && <span style={{ fontSize: W < 400 ? "8px" : "9.5px", letterSpacing: "0.5px", fontWeight: "700", opacity: ".8" }}>{short(scores[i])}</span>}
            </button>
          );
        })}
      </div>
      {onReset && <div style={{ display: "flex", justifyContent: "center", marginTop: W < 400 ? "14px" : "18px" }}><ResetProgress W={W} onReset={onReset} /></div>}
    </div>
  );
}

// Reset progress (only once level 50 is beaten): asks first, then wipes the levels, stars and best scores
function ResetProgress({ W, onReset }) {
  const [sure, setSure] = useState(false);
  const small = W < 400;
  if (!sure) return <button type="button" className="press btn" onClick={() => setSure(true)} style={{ ...BTN, "--c": "var(--red)", boxShadow: "3px 3px 0 var(--red)", padding: "0 16px" }}>↺ Reset progress</button>;
  return (
    <div role="group" aria-label="Reset progress?" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: small ? "8px" : "12px", maxWidth: "100%" }}>
      <span style={{ fontFamily: FONT.hand, fontSize: small ? "18px" : "20px", lineHeight: "1.1", color: "var(--hand)", textAlign: "center" }}>wipe every level, star and score? (Buddy keeps his crown)</span>
      <button type="button" className="press btn" onClick={() => { setSure(false); onReset(); }} style={{ ...BTN, "--c": "var(--red)", background: "var(--ink)", color: "var(--card)", boxShadow: "3px 3px 0 var(--red)", padding: "0 16px" }}>Yes, reset</button>
      <button type="button" className="press btn" onClick={() => setSure(false)} style={{ ...BTN, padding: "0 16px" }}>Keep it</button>
    </div>
  );
}

// n of 3 (or `of`) little drawn stars, filled yellow; empty ones are outlines
const STAR = 'M6 0.6 L7.6 4.1 L11.4 4.4 L8.5 6.9 L9.4 10.6 L6 8.6 L2.6 10.6 L3.5 6.9 L0.6 4.4 L4.4 4.1 Z';
function Stars({ n, of = 3, size = 11, on = false }) {
  return (
    <span aria-hidden="true" style={{ display: "inline-flex", gap: "1px" }}>
      {Array.from({ length: of }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 12 12"><path d={STAR} style={{ fill: i < n ? "var(--yellow)" : "none", stroke: on ? "var(--yellow)" : "var(--ink)", strokeWidth: 1.1, strokeLinejoin: "round" }} /></svg>
      ))}
    </span>
  );
}

// How to play: a small card over the game (it takes the taps while it shows; on a phone, whose game is short, it takes
// the game's place instead): drag anywhere, follow the dots, let go, pop every gremlin; stars for Buddies left. The
// first time Fling opens, and on the ? button.
// (v: the edition's words for the shot and the targets, WORDS above)
const the = (v) => (v.shot === 'Buddy' ? 'Buddy' : `the ${v.shot}`);
const STEPS = (v) => [
  ['drag back from anywhere', `put a finger (or the mouse) down anywhere on the game and pull back. no need to grab ${the(v)}.`],
  ['follow the dots', `they show where ${v.shot === 'Buddy' ? 'he' : 'it'}\u2019ll fly. pull further for more power, aim higher to lob.`],
  ['let go', `${the(v).replace(/^t/, 'T')} flies. knock the forts over: every ${v.foe} ${v.pop === 'pop' ? 'popped' : 'hit'} clears the level.`],
];
function HowTo({ v, W, small, inline, onClose }) {
  return (
    <div className="fade-in" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} style={inline ? { boxSizing: "border-box", width: `${W}px`, display: "flex", justifyContent: "center", padding: "4px 6px 6px 0" } : { position: "absolute", inset: "2px", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(17,17,17,.45)", padding: "16px" }}>
      <div className="card-drop" role="dialog" aria-label="How to play" style={{ position: "relative", boxSizing: "border-box", width: small ? "100%" : "440px", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: "6px 6px 0 var(--green)", padding: small ? "12px 14px" : "18px 22px", transform: "rotate(-0.8deg)" }}>
        <div style={{ fontFamily: FONT.head, fontSize: small ? "18px" : "24px", textTransform: "uppercase", color: "var(--ink)" }}>{`How to ${v.shot === 'Buddy' ? 'fling' : 'shoot'}`}</div>
        <ol style={{ listStyle: "none", margin: small ? "8px 0 0" : "12px 0 0", padding: "0", display: "flex", flexDirection: "column", gap: small ? "6px" : "10px" }}>
          {STEPS(v).map(([head, text], i) => (
            <li key={head} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
              <span style={{ flexShrink: "0", width: small ? "22px" : "26px", height: small ? "22px" : "26px", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--ink)", color: "var(--yellow)", fontFamily: FONT.mono, fontWeight: "700", fontSize: small ? "11px" : "13px" }}>{i + 1}</span>
              <span style={{ fontFamily: FONT.body, fontSize: small ? "12.5px" : "14.5px", lineHeight: "1.35", color: "var(--text)" }}><strong style={{ fontWeight: "700", color: "var(--ink)" }}>{head}.</strong> {text}</span>
            </li>
          ))}
        </ol>
        <div style={{ marginTop: small ? "8px" : "12px", fontFamily: FONT.hand, fontSize: small ? "17px" : "20px", lineHeight: "1.1", color: "var(--hand)" }}>{`the mission card (top right) says what to ${v.pop}. fewer ${v.shots} used = more ★`}</div>
        <button type="button" className="press btn" onClick={onClose} style={{ ...BTN, "--c": "var(--yellow)", marginTop: small ? "10px" : "14px", padding: "0 18px", background: "var(--ink)", color: "var(--card)", boxShadow: "4px 4px 0 var(--yellow)" }}>{`Got it, let’s ${v.shot === 'Buddy' ? 'fling' : 'shoot'} →`}</button>
      </div>
    </div>
  );
}
