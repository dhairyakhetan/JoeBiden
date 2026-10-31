import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CloseIcon, ChevronIcon } from '../Icons.jsx';
import { usePresence } from '../../lib/usePresence.js';
import { track } from '../../lib/analytics.js';
import { useEdition } from '../../lib/edition.js';
import { FONT } from '../../styles/fonts.js';
import { lockScroll, unlockScroll } from '../../lib/scrollLock.js';
import { drawGhost } from './Ghost.jsx';
import { lastTap } from '../../lib/buddyState.js';
import { calm } from '../../lib/motion.js';
import { useLocation, useNavigate } from '../../router.jsx';
import { gamesOf, homeOf } from '../../lib/routes.js';
import { LATEST, editionById } from '../../data/editions.js';
import { gameLink, gameOf, gamesFor } from '../../data/games.js';
import Fling from './Fling.jsx';
import { GAME_SKIN } from '../../editions/pages.js';

// Buddy's games popup (mounted once in App.jsx; opened by openGames() in lib/buddyState.js, event 'aq-games').
// Two tabs, each a <canvas> game drawn every frame with requestAnimationFrame (only while the popup is open):
//   Snake: Buddy's head + a tail of wisps eating stars; arrows / WASD / swipe / the on-screen pad (keys light up while
//          held, big screens). Made to feel quick: he glides between cells, turns queue (two), a turn past halfway to the
//          next cell happens at once, swipes act mid-drag, the pad acts on press, a step's grace at walls; it speeds up a
//          little per star; only the Play again button restarts.
//   Float: flappy style; tap / click / space floats him up between the posts.
//   Fling: Angry Birds style; drag Buddy back in a slingshot and knock down towers of planks onto gremlins (Fling.jsx,
//          real physics, fetched the first time the tab opens).
// An edition can dress the games its own way (src/editions/pages.js GAME_SKIN: October's Durga Maa chase and bow and
// arrow); the rules stay the same. Best scores in localStorage. Esc, ✕ or a click outside closes it.
const MONO = { fontFamily: FONT.mono, fontWeight: "700", letterSpacing: "1.2px", textTransform: "uppercase" };
const best = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const keep = (k, v) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

// a canvas at the screen's pixel density; returns its 2d context drawing in CSS px
function setup(c, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return g;
}
// the dimmed "ready" / "game over" card over a game; K = the look's colours
const card = (g, K, w, h, lines, shift = 0) => {
  g.fillStyle = 'rgba(17,17,17,.62)'; g.fillRect(0, 0, w, h);
  g.textAlign = 'center'; g.fillStyle = K.page;
  lines.forEach(([text, font, y]) => { g.font = font; g.fillText(text, w / 2, h / 2 + y + shift); });
};

// ---------------------------------------------------------------- Snake
const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
function Snake({ W, small }) {
  const ed = useEdition(), { colors: K, fonts: F, art: A } = ed.look; // a canvas can't read CSS variables: the values themselves
  const SK = GAME_SKIN[ed.id]?.snake; // the edition's own snake (head, food, tail, words), else Buddy eating stars
  const [held, setHeld] = useState(null); // big screens: the on-screen key lights up while its key is held
  const cv = useRef(null);
  const turn = useRef(null);
  const again = useRef(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [top, setTop] = useState(() => best('aq-snake-best'));
  useEffect(() => {
    const N = 15, C = W / N, g = setup(cv.current, W, W);
    let snake, was, dir, queue, food, state = 'ready', acc = 0, last = performance.now(), raf = 0, pts = 0, grace = false, pops = [], bump = 0, shake = 0;
    const free = () => { let f; do f = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; while (snake.some(([x, y]) => x === f[0] && y === f[1])); return f; };
    const reset = () => { snake = [[7, 7], [6, 7], [5, 7]]; was = snake.map((c) => [...c]); dir = [1, 0]; queue = []; food = free(); pts = 0; grace = false; pops = []; setScore(0); };
    reset();
    const step = () => Math.max(85, 160 - pts * 3); // ms per move: brisk from the start, a little quicker with every star
    const steer = (d) => {
      if (state === 'over') return; // only the Play again button restarts, so the score stays up
      // turns queue up (two at most), each checked against the one before it, so a quick up-then-left lands both
      const ref = queue.length ? queue[queue.length - 1] : dir;
      if ((d[0] === -ref[0] && d[1] === -ref[1]) || (d[0] === ref[0] && d[1] === ref[1])) { if (state === 'ready') { state = 'playing'; acc = step(); } return; }
      if (queue.length < 2) queue.push(d);
      if (state === 'ready') { state = 'playing'; acc = step(); return; } // the first press moves him at once
      if (queue.length === 1 && acc >= step() * 0.45) acc = step(); // past halfway to the next cell: turn now, not a step later
    };
    turn.current = steer;
    again.current = () => { reset(); state = 'ready'; setOver(false); };
    const tick = () => {
      const d = queue.length ? queue[0] : dir;
      const head = [snake[0][0] + d[0], snake[0][1] + d[1]];
      const hit = head[0] < 0 || head[1] < 0 || head[0] >= N || head[1] >= N || snake.some(([x, y], i) => i < snake.length - 1 && x === head[0] && y === head[1]);
      if (hit) {
        // a moment's grace at a wall or his tail: one step to turn away before it counts
        if (!grace) { grace = true; was = snake.map((c) => [...c]); return; }
        state = 'over'; setOver(true); shake = calm() ? 0 : 1; navigator.vibrate?.(60);
        if (pts > best('aq-snake-best')) { keep('aq-snake-best', pts); setTop(pts); }
        return;
      }
      grace = false; if (queue.length) dir = queue.shift();
      was = snake.map((c) => [...c]);
      snake.unshift(head);
      if (head[0] === food[0] && head[1] === food[1]) {
        pts++; setScore(pts); pops.push({ x: (food[0] + 0.5) * C, y: (food[1] + 0.5) * C, life: 1 }); bump = 1; navigator.vibrate?.(12);
        food = free();
      } else snake.pop();
    };
    const draw = (t, dt) => {
      const a = state === 'playing' && !grace ? Math.min(1, acc / step()) : 1; // how far between the last cell and this one
      const at = (i) => { const c = snake[i], p = was[i] || was[was.length - 1] || c; return [(p[0] + (c[0] - p[0]) * a + 0.5) * C, (p[1] + (c[1] - p[1]) * a + 0.5) * C]; };
      g.save();
      if (shake > 0) { g.translate((Math.random() - 0.5) * 8 * shake, (Math.random() - 0.5) * 8 * shake); shake = Math.max(0, shake - dt * 3); }
      g.fillStyle = K.page; g.fillRect(-10, -10, W + 20, W + 20);
      g.fillStyle = K.outside;
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) { g.beginPath(); g.arc((x + 0.5) * C, (y + 0.5) * C, 1.3, 0, Math.PI * 2); g.fill(); }
      // food: a little yellow star, twinkling (or the edition's: a bobbing demon face)
      const [fx, fy] = food, s = C * (0.34 + Math.sin(t / 180) * 0.04);
      g.save(); g.translate((fx + 0.5) * C, (fy + 0.5) * C);
      if (SK) { g.translate(0, Math.sin(t / 220) * C * 0.04); SK.food(g, C * 0.4, K, A); } else {
        g.rotate(t / 900); g.beginPath();
        for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.45 : s; g.lineTo(Math.cos((i * Math.PI) / 5) * r, Math.sin((i * Math.PI) / 5) * r); }
        g.closePath(); g.fillStyle = K.yellow; g.fill(); g.strokeStyle = K.ink; g.lineWidth = 1.5; g.stroke();
      }
      g.restore();
      // tail: wisps that glide cell to cell, smaller and fainter towards the end (or the edition's beads)
      for (let i = snake.length - 1; i > 0; i--) {
        const [x, y] = at(i), k = 1 - i / (snake.length + 2);
        if (SK) { g.save(); g.translate(x, y); g.rotate(t / 1400 + i); SK.tail(g, C * (0.26 + 0.12 * k), K, A, i); g.restore(); continue; }
        g.globalAlpha = 0.3 + 0.6 * k; g.fillStyle = K.green;
        g.beginPath(); g.arc(x, y, C * (0.24 + 0.16 * k), 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      // eaten stars: a ring and a +1 that float off
      for (const p of pops) {
        p.life -= dt * 2.2; if (p.life <= 0) continue;
        g.globalAlpha = p.life; g.strokeStyle = K.yellow; g.lineWidth = 3;
        g.beginPath(); g.arc(p.x, p.y, C * (0.4 + (1 - p.life) * 0.9), 0, Math.PI * 2); g.stroke();
        g.fillStyle = K.ink; g.font = `700 ${Math.round(C * 0.55)}px ${F.mono}`; g.textAlign = 'center'; g.fillText('+1', p.x, p.y - C * (0.5 + (1 - p.life) * 0.8));
      }
      pops = pops.filter((p) => p.life > 0); g.globalAlpha = 1;
      const [hx, hy] = at(0), face = queue[0] || dir;
      bump = Math.max(0, bump - dt * 5);
      if (SK) { g.save(); g.translate(hx, hy - C * 0.04); SK.head(g, C * (0.46 + bump * 0.08), K, A, { look: face, over: state === 'over' }); g.restore(); }
      else drawGhost(g, hx, hy - C * 0.08, C * (0.38 + bump * 0.08), K, { look: face, t: t / 1000, face: state === 'over' ? 'boo' : 'happy' });
      g.restore();
      const [ready, how] = SK ? SK.ready : ['SNAKE, BUT SPOOKY', 'arrows, WASD or swipe to start'];
      if (state === 'ready') card(g, K, W, W, [[ready, `700 ${Math.round(W / (ready.length > 18 ? 20 : 16))}px ${F.mono}`, -8], [how, `${Math.round(W / 14)}px ${F.hand}`, 24]]);
      if (state === 'over') card(g, K, W, W, [[SK ? SK.over(pts) : `BOO. ${pts} ${pts === 1 ? 'STAR' : 'STARS'}`, `700 ${Math.round(W / 14)}px ${F.mono}`, -8], [`best ${Math.max(pts, best('aq-snake-best'))}`, `${Math.round(W / 14)}px ${F.hand}`, 22]], -30);
    };
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - last) / 1000);
      if (state === 'playing') { acc += t - last; while (acc >= step() && state === 'playing') { acc -= step(); tick(); } } else acc = 0;
      last = t; draw(t, dt);
    };
    raf = requestAnimationFrame(loop);
    const key = (e) => { const d = DIRS[e.key] || DIRS[e.key.toLowerCase?.()]; if (d) { e.preventDefault(); setHeld(d.join()); if (!e.repeat) steer(d); } };
    const lift = (e) => { const d = DIRS[e.key] || DIRS[e.key.toLowerCase?.()]; if (d) setHeld((h) => (h === d.join() ? null : h)); };
    addEventListener('keyup', lift);
    addEventListener('keydown', key);
    // swipes: they turn him as soon as the finger has moved a little (not when it lifts), and one drag can turn
    // him again and again; a tap starts a new game
    let sx = null, sy = null, moved = false;
    const c = cv.current;
    const down = (e) => { sx = e.clientX; sy = e.clientY; moved = false; c.setPointerCapture?.(e.pointerId); };
    const move = (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      steer(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
      sx = e.clientX; sy = e.clientY; moved = true;
    };
    const up = () => { if (sx != null && !moved && state === 'ready') steer(dir); sx = null; };
    c.addEventListener('pointerdown', down); c.addEventListener('pointermove', move); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    return () => { cancelAnimationFrame(raf); removeEventListener('keydown', key); removeEventListener('keyup', lift); c.removeEventListener('pointerdown', down); c.removeEventListener('pointermove', move); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); };
  }, [W]);
  const pad = (label, d, dir) => {
    const on = !small && held === d.join();
    return (
      <button className="press" aria-label={label} onPointerDown={(e) => { e.preventDefault(); turn.current?.(d); }} onClick={(e) => { if (e.detail === 0) turn.current?.(d); }} style={{ "--c": "var(--ink)", width: "52px", height: "44px", padding: "0", background: on ? "var(--yellow)" : "var(--card)", border: "2px solid var(--ink)", boxShadow: on ? "1px 1px 0 var(--ink)" : "3px 3px 0 var(--ink)", transform: on ? "translate(2px, 2px)" : "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ChevronIcon dir={dir} size={18} />
      </button>
    );
  };
  return (
    <>
      <Scores score={score} top={top} unit={SK?.unit || 'stars'} />
      <div style={{ position: "relative" }}>
        <canvas ref={cv} style={{ display: "block", width: `${W}px`, height: `${W}px`, border: "2px solid var(--ink)", touchAction: "none" }} />
        {over && (
          <button className="press card-drop" onClick={() => again.current?.()} style={{ "--c": "var(--ink)", ...MONO, position: "absolute", left: "50%", top: "58%", marginLeft: "-70px", width: "140px", minHeight: "44px", fontSize: "12px", background: "var(--yellow)", color: "var(--ink)", border: "2px solid var(--ink)", boxShadow: "4px 4px 0 var(--ink)" }}>Play again</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 52px)", gap: "6px", justifyContent: "center", marginTop: "12px" }}>
        <span />{pad('Up', [0, -1], 'up')}<span />
        {pad('Left', [-1, 0], 'left')}{pad('Down', [0, 1], 'down')}{pad('Right', [1, 0], 'right')}
      </div>
    </>
  );
}

// ---------------------------------------------------------------- Float
const POSTS = ['red', 'blue', 'yellow', 'mint', 'purple', 'pink']; // the look's colours
function Float({ W, H }) {
  const { colors: K, fonts: F } = useEdition().look;
  const cv = useRef(null);
  const tap = useRef(null);
  const [score, setScore] = useState(0);
  const [top, setTop] = useState(() => best('aq-float-best'));
  useEffect(() => {
    const g = setup(cv.current, W, H);
    const R = W / 24, X = W * 0.3, GAP = H * 0.33, PW = W * 0.13, SPEED = W * 0.36, EVERY = 1.55;
    let s, raf = 0, last = performance.now(), t = 0;
    const reset = () => { s = { y: H * 0.45, vy: 0, lift: 0, posts: [], until: 0.6, pts: 0, state: 'ready', puffs: [], squash: 0 }; setScore(0); };
    reset();
    const flap = () => {
      if (s.state === 'over') { if (s.wait > 0) return; reset(); }
      if (s.state === 'ready') s.state = 'playing';
      s.lift = 1; s.squash = 1;
      for (let i = 0; i < 6; i++) s.puffs.push({ x: X - R * 0.4 + Math.random() * R * 0.8, y: s.y + R * 1.6, vx: (Math.random() - 0.5) * 40 - 30, vy: 20 + Math.random() * 40, life: 1, r: R * (0.18 + Math.random() * 0.2) });
    };
    tap.current = flap;
    const end = () => { s.state = 'over'; s.wait = 0.6; if (s.pts > best('aq-float-best')) { keep('aq-float-best', s.pts); setTop(s.pts); } };
    const update = (dt) => {
      s.squash = Math.max(0, s.squash - dt * 5);
      s.puffs.forEach((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.8; });
      s.puffs = s.puffs.filter((p) => p.life > 0);
      if (s.state === 'ready') { s.y = H * 0.45 + Math.sin(t * 2.4) * R * 0.6; return; }
      if (s.state === 'over') { s.wait -= dt; if (s.y < H - R * 1.2) { s.vy = Math.min(s.vy + 900 * dt, 420); s.y += s.vy * dt; } return; }
      // floaty: gentle gravity; a tap eases him up rather than kicking him
      if (s.lift > 0) { s.vy += (-H * 0.62 - s.vy) * Math.min(1, dt * 16); s.lift -= dt * 5.5; } else s.vy = Math.min(s.vy + H * 1.5 * dt, H * 0.75);
      s.y += s.vy * dt;
      s.until -= dt;
      if (s.until <= 0) { s.until = EVERY; const gy = H * 0.2 + Math.random() * (H * 0.6 - GAP * 0.5); s.posts.push({ x: W + PW, gy, c: POSTS[Math.floor(Math.random() * POSTS.length)], passed: false }); }
      s.posts.forEach((p) => { p.x -= SPEED * dt; if (!p.passed && p.x + PW < X - R) { p.passed = true; s.pts++; setScore(s.pts); } });
      s.posts = s.posts.filter((p) => p.x > -PW * 2);
      if (s.y - R < 0 || s.y + R * 1.5 > H) end();
      for (const p of s.posts) {
        const inX = X + R * 0.85 > p.x && X - R * 0.85 < p.x + PW;
        if (inX && (s.y - R * 0.9 < p.gy - GAP / 2 || s.y + R * 1.4 > p.gy + GAP / 2)) end();
      }
    };
    const draw = () => {
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, K.page); sky.addColorStop(1, K.outside);
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      // a far-off wire, for home
      g.strokeStyle = 'rgba(91,58,30,.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, H * 0.14); g.quadraticCurveTo(W / 2, H * 0.2, W, H * 0.13); g.stroke();
      for (const p of s.posts) {
        for (const [y0, y1, cap] of [[-4, p.gy - GAP / 2, p.gy - GAP / 2 - 14], [p.gy + GAP / 2, H + 4, p.gy + GAP / 2]]) {
          g.fillStyle = K.text; g.fillRect(p.x, y0, PW, y1 - y0);
          g.fillStyle = K[p.c]; g.strokeStyle = K.ink; g.lineWidth = 2; g.fillRect(p.x - 5, cap, PW + 10, 14); g.strokeRect(p.x - 5, cap, PW + 10, 14);
        }
      }
      s.puffs.forEach((p) => { g.globalAlpha = Math.max(0, p.life) * 0.8; g.fillStyle = K.cream; g.strokeStyle = 'rgba(17,17,17,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill(); g.stroke(); });
      g.globalAlpha = 1;
      const tilt = Math.max(-0.35, Math.min(0.5, s.vy / (H * 1.6)));
      drawGhost(g, X, s.y, R, K, { t, tilt, look: [1, s.vy > 0 ? 0.6 : -0.4], face: s.state === 'over' ? 'boo' : 'happy', sx: 1 + s.squash * 0.14, sy: 1 - s.squash * 0.12 });
      g.textAlign = 'center'; g.fillStyle = K.ink; g.font = `700 ${Math.round(W / 9)}px ${F.head}`;
      if (s.state === 'playing') g.fillText(String(s.pts), W / 2, H * 0.12);
      if (s.state === 'ready') card(g, K, W, H, [['FLOAT', `700 ${Math.round(W / 11)}px ${F.mono}`, -10], ['tap, click or space to float up', `${Math.round(W / 15)}px ${F.hand}`, 26]]);
      if (s.state === 'over') card(g, K, W, H, [[`BOO. ${s.pts} ${s.pts === 1 ? 'POST' : 'POSTS'}`, `700 ${Math.round(W / 13)}px ${F.mono}`, -10], ['tap to float again', `${Math.round(W / 15)}px ${F.hand}`, 26]]);
    };
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.034, (now - last) / 1000); last = now; t += dt;
      update(dt); draw();
    };
    raf = requestAnimationFrame(loop);
    const c = cv.current;
    const down = (e) => { e.preventDefault(); flap(); };
    const key = (e) => { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); flap(); } };
    c.addEventListener('pointerdown', down); addEventListener('keydown', key);
    return () => { cancelAnimationFrame(raf); c.removeEventListener('pointerdown', down); removeEventListener('keydown', key); };
  }, [W, H]);
  return (
    <>
      <Scores score={score} top={top} unit="posts" />
      <canvas ref={cv} aria-label="Float: tap to float up" style={{ display: "block", width: `${W}px`, height: `${H}px`, border: "2px solid var(--ink)", touchAction: "none", cursor: "pointer" }} />
    </>
  );
}

function Scores({ score, top, unit }) {
  return (
    <div style={{ ...MONO, display: "flex", justifyContent: "space-between", fontSize: "10.5px", margin: "0 0 8px" }}>
      <span>{`${score} ${unit}`}</span><span style={{ color: "var(--muted)" }}>{`best ${top}`}</span>
    </div>
  );
}

// The popup. It grows out of the button that opened it (lib/buddyState.js lastTap) while the page dims, and shrinks
// back there when Esc, the ✕ or a click outside closes it. Reduced motion: it just appears.
// first: the game asked for when this was loaded (App.jsx loads it on the first 'aq-games')
const ORDER = ['snake', 'float', 'fling']; // the tabs, left to right
export default function BuddyGames({ first = null }) {
  const [game, setGame] = useState(first);
  const [shown, leaving] = usePresence(game, 220);
  const eid = useEdition().id, NAMES = Object.fromEntries(gamesFor(eid).map((x) => [x.id, x])); // the edition's names for them
  useEffect(() => { if (game) track('Game opened', { game }); }, [game]);
  // the address follows the popup over a home page: its edition's /games/<id> while a game is open (a link straight to
  // it, with its own link preview: data/games.js), back to the address it had once it closes. Over an article it stays.
  const { pathname, search } = useLocation(), navigate = useNavigate(), back = useRef(null), at = useRef(pathname), title = useRef(null);
  at.current = pathname;
  useEffect(() => {
    const p = at.current, g = gamesOf(p), home = g || homeOf(p), onGames = !!g, onHome = !!home;
    const n = home?.id ? editionById(home.id).number : LATEST;
    if (game && onHome) {
      if (!onGames) back.current = p + search;
      title.current ??= document.title; // the tab names the game too (as its page's title does: build/siteFiles.js)
      document.title = `${gameOf(game, eid).title} · TerraNotes games`;
      if (p !== gameLink(game, n)) navigate(gameLink(game, n), { replace: true, state: { quiet: true } });
    } else if (!game && onGames) {
      if (title.current) { document.title = title.current; title.current = null; }
      navigate(back.current || (n === LATEST ? '/' : `/${home.id}`), { replace: true, state: { quiet: true } });
    }
  }, [game]);
  const card = useRef(null), from = useRef(null); // from: the tap it grows out of, as an offset from the card's centre
  useLayoutEffect(() => { // opening
    if (!game || from.current || !card.current) return;
    const r = card.current.getBoundingClientRect();
    const dx = lastTap.x == null ? 0 : lastTap.x - (r.left + r.width / 2), dy = lastTap.y == null ? 40 : lastTap.y - (r.top + r.height / 2);
    from.current = { dx, dy };
    if (calm()) return;
    card.current.animate([{ translate: `${dx}px ${dy}px`, scale: '0.15', opacity: 0 }, { opacity: 1, offset: 0.35 }, { translate: '0 0', scale: '1', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.2,.9,.25,1.08)' });
  }, [game]);
  // switching games: the card eases from the old game's size to the new one's (Fling's is far wider than Snake's) while
  // the new game slides in from the side of its tab (right of the old one: from the right). Reduced motion: it just swaps.
  const size = useRef(null), was = useRef(null), stage = useRef(null);
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || !shown) { size.current = was.current = null; return; }
    const before = size.current, old = was.current, now = { w: el.offsetWidth, h: el.offsetHeight };
    size.current = now; was.current = shown;
    if (!before || !old || old === shown || calm()) return;
    const dir = ORDER.indexOf(shown) > ORDER.indexOf(old) ? 1 : -1, ease = 'cubic-bezier(0.32, 0.72, 0, 1)';
    if (before.w !== now.w || before.h !== now.h) {
      el.animate([{ width: `${before.w}px`, height: `${before.h}px`, overflow: 'hidden' }, { width: `${now.w}px`, height: `${now.h}px`, overflow: 'hidden' }], { duration: 380, easing: ease });
    }
    stage.current?.animate([{ translate: `${dir * 56}px 0`, opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 360, delay: 60, easing: ease, fill: 'backwards' });
  }, [shown]);
  useLayoutEffect(() => { // closing: back to where it came from
    if (!leaving || !card.current) return;
    const { dx = 0, dy = 40 } = from.current || {};
    from.current = null;
    if (!calm()) card.current.animate([{ translate: '0 0', scale: '1', opacity: 1 }, { translate: `${dx * 0.8}px ${dy * 0.8}px`, scale: '0.2', opacity: 0 }], { duration: 220, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
  }, [leaving]);
  useEffect(() => {
    const on = (e) => setGame(e.detail || 'snake');
    addEventListener('aq-games', on);
    return () => removeEventListener('aq-games', on);
  }, []);
  useEffect(() => {
    if (!game) return undefined;
    lockScroll();
    const esc = (e) => { if (e.key === 'Escape') setGame(null); };
    addEventListener('keydown', esc);
    return () => { unlockScroll(); removeEventListener('keydown', esc); };
  }, [game]);
  if (!shown) return null;
  const small = window.innerWidth < 600 || document.documentElement.dataset.layout === 'phone';
  const room = innerHeight - 24 - 129; // the window's height less the popup's frame, tabs and score line: the games fit it
  const W = small ? 290 : Math.max(220, Math.min(400, room - 120)), H = small ? Math.min(360, Math.max(240, room - 10)) : Math.max(260, Math.min(460, room - 10)); // Snake's pad sits under its board
  const fw = small ? Math.min(360, innerWidth - 56) : Math.min(1040, innerWidth - 120); // Fling: as big as the window allows
  const tab = (id, label) => (
    <button onClick={() => setGame(id)} aria-pressed={shown === id ? 'true' : 'false'} style={{ ...MONO, fontSize: "11px", minHeight: "44px", padding: "0 14px", border: "2px solid var(--ink)", background: shown === id ? 'var(--ink)' : 'var(--card)', color: shown === id ? 'var(--page)' : 'var(--ink)', cursor: "pointer" }}>{label}</button>
  );
  return (
    <div className={leaving ? 'fade-out' : 'fade-in'} onClick={(e) => { if (e.target === e.currentTarget) setGame(null); }} style={{ position: "fixed", inset: "0", zIndex: "900", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(17,17,17,.55)", padding: "12px" }}>
      <div ref={card} role="dialog" aria-label="Buddy's games" style={{ position: "relative", boxSizing: "border-box", background: "var(--cream)", border: "2px solid var(--ink)", boxShadow: "8px 8px 0 var(--purple)", padding: small ? "14px" : "20px", transform: "rotate(-0.6deg)", maxHeight: "calc(100dvh - 24px)", overflowY: "auto" }}>
        <div className="no-cascade" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          {tab('snake', NAMES.snake.name)}{tab('float', NAMES.float.name)}{tab('fling', NAMES.fling.name)}
          <span style={{ flexGrow: "1", fontFamily: FONT.hand, fontSize: "20px", color: "var(--hand)", textAlign: "right", paddingRight: "8px" }}>{small ? '' : NAMES[shown].hint}</span>
          <button className="press" onClick={() => setGame(null)} aria-label="Close the games" style={{ "--c": "var(--ink)", width: "44px", height: "44px", flexShrink: "0", padding: "0", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: "3px 3px 0 var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CloseIcon size={14} weight={2.8} />
          </button>
        </div>
        <div ref={stage} className="no-cascade" key={shown}>{shown === 'snake' ? <Snake W={W} small={small} /> : shown === 'float' ? <Float W={W} H={H} /> : <Fling W={fw} H={small ? Math.round(fw * 0.62) : Math.round(Math.min(fw * 0.5, innerHeight - 280))} />}</div>
      </div>
    </div>
  );
}
