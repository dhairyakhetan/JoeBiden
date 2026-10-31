import { useEffect, useRef } from 'react';
import { Link } from '../router.jsx';
import ArticleCard from '../shared/ArticleCard.jsx';
import { ChevronIcon } from '../shared/Icons.jsx';
import { Clip } from '../shared/Tapes.jsx';
import { homeLink } from '../data/editions.js';
import { useByWriter } from '../lib/byWriter.js';
import { useEdition } from '../lib/edition.js';
import { HANGERS } from '../editions/pages.js';
import { pad2 } from '../lib/format.js';
import { pageZoom } from '../lib/layoutMode.js';
import { calm } from '../lib/motion.js';
import { FONT } from '../styles/fonts.js';

// The web home page's articles (id="articles"): every card of the latest edition pegged on one long wire that scrolls
// sideways (trackpad, shift+wheel, scrollbar, keyboard, the arrows, or drag with the mouse; no snapping). A black
// "Articles" label card hangs from the intro card's knot, and a lead string runs from its knot to the card nearest
// the "spot" (where the first card rests). Everything that moves is in runLine() below.
// Peg i hangs at x = 164 + 208·i; the per-card tables repeat every 12 pegs.
const PITCH = 208;
const CARD_TOP = [106, 158, 118, 180, 112, 150, 162, 118, 136, 184, 122, 160]; // y of each card's clip
const TILT = [-2.2, 1.6, -1.2, 2.4, -1.8, 1.4, -2.6, 1.9, -1.1, 2.2, -1.6, 1.2];
const SWING = [1.75, 1.39, 1.63, 1.26, 1.69, 1.45, 1.3, 1.73, 1.48, 1.23, 1.59, 1.38];
const DURATION = [4.8, 5.5, 6.2];
// pitch: the space from one card's peg to the next (wider for an edition that hangs things between them: HANGERS)
const peg = (i, pitch = PITCH) => {
  const x = 164 + pitch * i, y = i % 2 ? 88 : 78;
  return { x, y, drop: CARD_TOP[i % 12] - y, tilt: TILT[i % 12], swing: SWING[i % 12], dur: DURATION[i % 3] };
};
// the wire from peg `from` (where the lead string ties on) to the far end
const wireFrom = (pegs, width, from) => {
  let d = `M${pegs[from].x} ${pegs[from].y}`;
  for (let i = from + 1; i < pegs.length; i++) d += ` Q${(pegs[i - 1].x + pegs[i].x) / 2} 110 ${pegs[i].x} ${pegs[i].y}`;
  const last = pegs[pegs.length - 1];
  return `${d} Q${(last.x + width) / 2} 110 ${width} 78`;
};
const KICK = [1, 0.8, 1.15, 0.9, 1.05]; // how strongly each card answers the swing
const RETIE_MS = 220;                    // the lead string sliding over to the next card
const PULL_WAIT = 160;                   // after the last scroll/drag, the wait before the string pulls
const PULL_K = 0.07, PULL_DAMP = 0.8;    // the pull's spring: a little overshoot, then settled

// One requestAnimationFrame loop that runs only while something is moving (the line scrolls, the cards swing, the
// lead string re-ties or pulls) and the line is on screen; idle, it costs nothing.
// - cards on screen (or one away) get .live: only they sway (CSS); moving the line swings them (a damped spring)
// - the lead string runs from the label's knot to the card nearest the spot; once you let go of the line it pulls
//   that card into the spot (or to the very end, so the last cards are reachable)
// - progress bar and arrow states are written directly, so scrolling never re-renders React
function runLine(r, pegs, width) {
  const { el, svg, knot, lead, wire, bar, prev, next } = r;
  const hangs = [...r.hangs], kicks = [...r.kicks]; // copies: React clears the originals on unmount
  const still = calm();

  const live = new Set();
  const near = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const i = hangs.indexOf(e.target);
      e.target.classList.toggle('live', e.isIntersecting);
      if (e.isIntersecting) live.add(i); else live.delete(i);
    }
  }, { root: el, rootMargin: `0px ${PITCH}px` });
  hangs.forEach((h) => near.observe(h));

  const SPOT = pegs[0].x;
  const nearest = (s) => pegs.reduce((b, p, i) => (Math.abs(p.x - s - SPOT) < Math.abs(pegs[b].x - s - SPOT) ? i : b), 0);
  let shown = false, raf = 0;
  let pulling = false, want = 0, pos = 0, vel = 0, idle = 0, held = false;
  const stopPull = () => { pulling = false; clearTimeout(idle); };
  const pullSoon = () => { clearTimeout(idle); if (!still && !held) idle = setTimeout(startPull, PULL_WAIT); };
  const startPull = () => {
    if (held || !shown) return;
    const s = el.scrollLeft, max = el.scrollWidth - el.clientWidth;
    want = [...pegs.map((p) => Math.max(0, Math.min(max, p.x - SPOT))), max].reduce((b, x) => (Math.abs(x - s) < Math.abs(b - s) ? x : b));
    if (Math.abs(want - s) < 0.5) return;
    pulling = true; pos = s; vel = 0; tick();
  };
  let last = el.scrollLeft, lean = 0, speed = 0, swinging = false;
  let tie = -1, from = null, end = null, tiedAt = 0;
  const g = {}; // positions in the lead svg's coordinates, measured on show and resize (never per frame)
  const measure = () => {
    if (!el.isConnected) return;
    const sr = svg.getBoundingClientRect(), z = sr.width / svg.width.baseVal.value || 1, er = el.getBoundingClientRect(), kr = knot.getBoundingClientRect();
    g.ox = (er.left - sr.left) / z; g.oy = (er.top - sr.top) / z;
    g.kx = (kr.left + kr.width / 2 - sr.left) / z; g.ky = (kr.top + kr.height / 2 - sr.top) / z;
    tie = -1; // redraw the string
  };
  const progress = () => {
    const max = el.scrollWidth - el.clientWidth, p = max > 0 ? el.scrollLeft / max : 0;
    bar.style.width = `${Math.round(Math.max(0.06, p) * 100)}%`;
    prev.style.opacity = p <= 0.01 ? '0.35' : '1';
    next.style.opacity = p >= 0.99 ? '0.35' : '1';
  };

  const frame = (now) => {
    raf = 0;
    if (!el.isConnected) return;
    if (pulling) {
      vel = (vel + (want - pos) * PULL_K) * PULL_DAMP;
      pos += vel;
      if (Math.abs(want - pos) < 0.3 && Math.abs(vel) < 0.3) { pos = want; pulling = false; }
      el.scrollLeft = pos;
    }
    const s = el.scrollLeft, moved = s - last; // + = the line moving left
    last = s;
    if (moved) progress();
    if (!still && (moved || swinging)) {
      speed = (speed + (Math.max(-10, Math.min(10, moved * 0.35)) - lean) * 0.06) * 0.9; // lean back against the motion
      lean += speed;
      swinging = Math.abs(lean) > 0.02 || Math.abs(speed) > 0.02;
      if (swinging) live.forEach((i) => { kicks[i].style.transform = `rotate(${(lean * KICK[i % KICK.length]).toFixed(2)}deg)`; });
      else { lean = speed = 0; kicks.forEach((k) => { k.style.transform = ''; }); }
    }
    const k = nearest(s), target = { x: g.ox + pegs[k].x - s, y: g.oy + pegs[k].y };
    const retie = k !== tie;
    if (retie) {
      if (tie >= 0 && !still && end) { from = end; tiedAt = now; }
      tie = k;
      wire.setAttribute('d', wireFrom(pegs, width, k));
    }
    const t = from ? Math.min(1, (now - tiedAt) / RETIE_MS) : 1, e = 1 - (1 - t) ** 3;
    end = t < 1 ? { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e } : target;
    if (t >= 1) from = null;
    if (moved || retie || t < 1 || !lead.getAttribute('d')) {
      const sag = Math.min(8, Math.hypot(end.x - g.kx, end.y - g.ky) * 0.025); // pulled tight: barely sags
      lead.setAttribute('d', `M${g.kx.toFixed(1)} ${g.ky.toFixed(1)} Q${((g.kx + end.x) / 2).toFixed(1)} ${((g.ky + end.y) / 2 + sag).toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}`);
    }
    if (shown && (moved || swinging || from || pulling)) raf = requestAnimationFrame(frame);
  };
  const tick = () => { if (shown && !raf) raf = requestAnimationFrame(frame); };

  const seen = new IntersectionObserver(([e]) => {
    shown = e.isIntersecting;
    el.classList.toggle('away', !shown);
    if (shown) { measure(); tick(); }
  });
  seen.observe(el);
  const onScroll = () => { tick(); if (!pulling) pullSoon(); }; // the pull's own scrolling doesn't restart it
  const grab = () => { held = true; stopPull(); };
  const letGo = () => { if (held) { held = false; pullSoon(); } };
  const gust = () => { if (!still) { speed -= 3.2; swinging = true; tick(); } }; // aquaterra.wind() (lib/consoleHello.js)
  const onResize = () => { measure(); tick(); };
  el.addEventListener('scroll', onScroll, { passive: true });
  el.addEventListener('pointerdown', grab);
  el.addEventListener('touchstart', grab, { passive: true });
  el.addEventListener('wheel', stopPull, { passive: true });
  el.addEventListener('keydown', stopPull);
  addEventListener('pointerup', letGo);
  addEventListener('pointercancel', letGo);
  addEventListener('touchend', letGo);
  addEventListener('aq-wind', gust);
  addEventListener('resize', onResize);
  r.stopPull = stopPull; // the arrow buttons take over from a pull in progress
  progress();

  return () => {
    near.disconnect(); seen.disconnect(); cancelAnimationFrame(raf); clearTimeout(idle);
    el.removeEventListener('scroll', onScroll); el.removeEventListener('pointerdown', grab); el.removeEventListener('touchstart', grab);
    el.removeEventListener('wheel', stopPull); el.removeEventListener('keydown', stopPull);
    removeEventListener('pointerup', letGo); removeEventListener('pointercancel', letGo); removeEventListener('touchend', letGo);
    removeEventListener('aq-wind', gust); removeEventListener('resize', onResize);
  };
}

export default function WebArticleLine() {
  const refs = useRef({ hangs: [], kicks: [] }).current;
  const { by, mine, isMine, list } = useByWriter(); // ?by=<name>: that writer's pieces first, taped
  const { number, id } = useEdition();
  const Hanger = HANGERS[id]; // the edition's little hangers between the cards (October's diyas), if any
  const pitch = Hanger ? 250 : PITCH; // room for them: clear of the cards on both sides
  const pegs = list.map((_, i) => peg(i, pitch));
  const width = pegs[pegs.length - 1].x + 224;
  useEffect(() => runLine(refs, pegs, width), []);
  const scrollBy = (dx) => { refs.stopPull?.(); refs.el.scrollBy({ left: dx, behavior: 'smooth' }); };

  // mouse: drag the line sideways (touch and trackpads scroll it natively); a drag doesn't count as a click on a card
  const dragged = useRef(false);
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = refs.el, x0 = e.clientX, left0 = el.scrollLeft, z = pageZoom(), id = e.pointerId;
    dragged.current = false;
    const move = (ev) => {
      const dx = (ev.clientX - x0) / z;
      if (!dragged.current && Math.abs(dx) > 5) {
        dragged.current = true;
        el.classList.add('dragging');
        try { el.setPointerCapture(id); } catch { /* pointer already gone */ }
      }
      if (dragged.current) el.scrollLeft = left0 - dx;
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      setTimeout(() => { dragged.current = false; }); // after the click that ends the drag has been swallowed
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  const onClickCapture = (e) => { if (dragged.current) { e.preventDefault(); e.stopPropagation(); dragged.current = false; } };
  const arrow = { width: "48px", height: "48px", padding: "0", border: "2px solid var(--ink)", boxShadow: "4px 4px 0 var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" };

  return (
    <>
      <section id="articles" aria-label="Articles" style={{ position: "absolute", left: "0", top: "420px", width: "1440px", height: "700px" }} />
      <svg ref={(n) => { refs.svg = n; }} width="1440" height="200" viewBox="0 0 1440 200" style={{ position: "absolute", left: "0", top: "420px", pointerEvents: "none" }} aria-hidden="true">
        <path ref={(n) => { refs.lead = n; }} fill="none" strokeWidth="1.8" strokeLinecap="round" style={{ stroke: "var(--string)" }} />
      </svg>
      {/* the "Articles" label card, tied to the intro card's knot; the lead string starts at its own knot */}
      <div style={{ position: "absolute", left: "110px", top: "430px", width: "170px", height: "234px", pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "84.3px", top: "0", width: "1.4px", height: "82px", background: "var(--string)" }} />
        <div style={{ position: "absolute", left: "0", top: "80px", width: "170px", height: "154px", transformOrigin: "50% 0", transform: "rotate(-2.5deg)" }}>
          <Clip color="var(--red)" w={28} h={10} top="-7px" />
          <div style={{ width: "100%", height: "100%", boxSizing: "border-box", background: "var(--ink)", color: "var(--page)", padding: "18px", border: "2px solid var(--ink)", boxShadow: "7px 7px 0 var(--red)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <h2 style={{ margin: "0", fontFamily: FONT.hand, fontWeight: "700", fontSize: "52px", lineHeight: "0.9" }}>Articles</h2>
            <div style={{ fontFamily: FONT.mono, fontSize: "11px", letterSpacing: "1.4px", color: "var(--faint)" }}>{`${pad2(list.length)} PIECES`}</div>
          </div>
          <div ref={(n) => { refs.knot = n; }} style={{ position: "absolute", left: "166px", top: "32px", width: "12px", height: "12px", boxSizing: "border-box", borderRadius: "50%", background: "var(--ink)", border: "2px solid var(--page)", zIndex: "2" }} />
        </div>
      </div>
      <div ref={(n) => { refs.el = n; }} role="region" className="art-scroller" onPointerDown={onPointerDown} onClickCapture={onClickCapture} onDragStart={(e) => e.preventDefault()} tabIndex={0} aria-label="All write-ups, scroll sideways" style={{ position: "absolute", left: "300px", top: "470px", width: "1140px", height: "530px", overflowX: "auto", overflowY: "hidden", userSelect: "none", WebkitUserSelect: "none" }}>
        <div style={{ position: "relative", width: `${width}px`, height: "520px" }}>
          <svg width={width} height="200" viewBox={`0 0 ${width} 200`} style={{ position: "absolute", left: "0", top: "0" }} aria-hidden="true">
            <path ref={(n) => { refs.wire = n; }} d={wireFrom(pegs, width, 0)} fill="none" strokeWidth="1.8" style={{ stroke: "var(--string)" }} />
          </svg>

          {list.map((a, i) => {
            const p = pegs[i];
            return (
              // a gentle idle sway (CSS); the inner box takes the swing from scrolling (runLine)
              <div key={a.slug} ref={(n) => { refs.hangs[i] = n; }} className="hang sway" style={{ position: "absolute", left: `${p.x - 86}px`, top: `${p.y}px`, width: "172px", height: `${p.drop + 272}px`, "--a": `${(p.swing * 0.45).toFixed(2)}deg`, "--d": `${(p.dur * 1.5).toFixed(1)}s`, animationDelay: `${(-1.3 * i).toFixed(1)}s` }}>
                <div ref={(n) => { refs.kicks[i] = n; }} style={{ position: "absolute", inset: "0", transformOrigin: "50% 0" }}>
                  <div style={{ position: "absolute", left: "85.3px", top: "0", width: "1.4px", height: `${p.drop + 2}px`, background: "var(--string)" }} />
                  <div style={{ position: "absolute", left: "0", top: `${p.drop}px`, width: "172px", height: "272px", transform: `rotate(${p.tilt}deg)`, transformOrigin: "50% 0" }}>
                    <ArticleCard article={a} look="web" mark={isMine(a) ? by : undefined} />
                  </div>
                </div>
              </div>
            );
          })}
          {Hanger && pegs.slice(1).map((q, k) => { // in the gap between two cards, tied on where the wire dips, in front of them
            const p = pegs[k];
            return <Hanger key={k} v={k} string={[30, 78, 48, 96, 38, 64][k % 6]} s={34} delay={-k * 0.9} style={{ left: `${(p.x + q.x) / 2 - 17}px`, top: `${(p.y + q.y) / 4 + 55 - 2}px` }} />;
          })}
        </div>
      </div>
      <div data-ruled="" style={{ position: "absolute", left: "300px", top: "1024px", width: "1060px", display: "flex", alignItems: "center", gap: "20px" }}>
        {by && (
          <div className="slide-in" role="status" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ background: "var(--yellow)", border: "1.5px solid var(--ink)", padding: "5px 10px", fontFamily: FONT.mono, fontWeight: "700", fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{mine.length ? `By ${by} · ${pad2(mine.length)} first` : `Nothing by ${by} yet`}</span>
            <Link className="btn" to={homeLink(number, 'articles')} replace aria-label="Show all articles in order" style={{ minWidth: "32px", minHeight: "30px", display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid var(--ink)", background: "var(--card)", fontFamily: FONT.mono, fontWeight: "700", fontSize: "12px", textDecoration: "none", color: "var(--ink)" }}>✕</Link>
          </div>
        )}
        <div data-ruled-base="" style={{ fontFamily: FONT.mono, fontSize: "11px", letterSpacing: "1.6px", whiteSpace: "nowrap" }}>{`${pad2(list.length)} WRITE-UPS · SCROLL SIDEWAYS`}</div>
        <div style={{ flexGrow: "1", height: "4px", background: "var(--rule)", position: "relative" }}>
          <div ref={(n) => { refs.bar = n; }} style={{ position: "absolute", left: "0", top: "0", height: "4px", width: "6%", background: "var(--ink)", transition: "width 120ms linear" }} />
        </div>
        <button ref={(n) => { refs.prev = n; }} className="btn" onClick={() => scrollBy(-624)} aria-label="Scroll write-ups left" style={{ ...arrow, background: "var(--card)", opacity: "0.35" }}><ChevronIcon dir="left" /></button>
        <button ref={(n) => { refs.next = n; }} className="btn" onClick={() => scrollBy(624)} aria-label="Scroll write-ups right" style={{ ...arrow, background: "var(--yellow)" }}><ChevronIcon dir="right" /></button>
      </div>
    </>
  );
}
