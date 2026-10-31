import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { calm, LITE } from './motion.js';
import { flag, $, tnRoot } from './dom.js';

// Which layout draws the page, and how big. Both layouts are fixed artboards (phone 390px, src/phone/; web 1440px,
// src/web/) drawn with CSS zoom, so they fill the window at any size:
//   narrower than 900px  → phone layout, scaled to the window's width (--phone-zoom, up to ×1.5; phones themselves are
//                          pinned to 390px by the viewport tag in index.html, so they always get ×1)
//   900px and wider      → web layout, scaled to the window's width (--web-zoom, from ×0.625 up to ×1.34 at 1930px)
// The switch has a 24px buffer (web from 900px, back to phone below 876px), so a window resized across the line
// doesn't flicker, and it waits for the resize to settle. Crossing it crossfades (a view transition) and keeps the
// reader at the same part of the page; reduced motion / LITE switch straight away.
// Sets <html data-layout="web|phone"> plus the zoom variables (styles/web.css, styles/phone.css).
export const WEB_FROM = 900, PHONE_BELOW = 876;
const PHONE_MAX = 1.5, WEB_MAX = 1.34;
const html = () => document.documentElement;
// body, not <html>: with scrollbar-gutter the root's clientWidth still counts the scrollbar's strip
const width = () => document.body.clientWidth;
const fit = (web) => {
  const w = width();
  if (web) html().style.setProperty('--web-zoom', String(Math.min(WEB_MAX, w / 1440)));
  else html().style.setProperty('--phone-zoom', String(Math.min(PHONE_MAX, Math.max(0.8, w / 390))));
};
const apply = (web) => {
  html().dataset.layout = web ? 'web' : 'phone';
  html().style.removeProperty(web ? '--phone-zoom' : '--web-zoom');
  fit(web);
};

// The part of the page the reader is at: the last section / chapter whose top has passed a third of the screen, and
// how far into it they are (0–1), so the other layout can open at the same place.
const SPOTS = '#articles, #photos, #words, #members, section[data-ch], main, article';
function readingSpot() {
  const line = innerHeight / 3;
  let best = null;
  for (const el of tnRoot().querySelectorAll(SPOTS)) {
    const r = el.getBoundingClientRect();
    if (r.height && r.top <= line && (!best || r.top >= best.r.top)) best = { el, r };
  }
  if (!best || scrollY < 40) return { top: true };
  const key = best.el.id ? `#${best.el.id}` : best.el.dataset.ch ? `section[data-ch="${best.el.dataset.ch}"]` : best.el.tagName.toLowerCase();
  return { key, into: Math.min(1, (line - best.r.top) / best.r.height) };
}
function goTo(spot) {
  if (spot.top) { scrollTo(0, 0); return; }
  const el = $(spot.key);
  if (!el) return;
  const r = el.getBoundingClientRect();
  scrollTo(0, Math.max(0, scrollY + r.top + r.height * spot.into - innerHeight / 3));
}

export function useIsWeb() {
  // applied during the first render, so the first jump to a section already has the right header offset
  const [web, setWeb] = useState(() => { const w = innerWidth >= WEB_FROM; apply(w); return w; });
  useEffect(() => {
    let now = web, wait = 0, spot = null; // spot: where the reader was when this resize began
    const settle = () => {
      const next = now ? innerWidth >= PHONE_BELOW : innerWidth >= WEB_FROM, at = spot;
      spot = null;
      if (next === now) return;
      now = next;
      const swap = () => { flushSync(() => { apply(next); setWeb(next); }); goTo(at); };
      if (calm() || LITE || !document.startViewTransition) { swap(); return; }
      flag('tnLayout', next ? 'web' : 'phone');
      const t = document.startViewTransition(swap);
      t.finished.finally(() => flag('tnLayout', null));
    };
    const on = () => {
      spot ??= readingSpot();
      fit(now); // the scale follows the window at once, keeping the reader's place
      goTo(spot);
      clearTimeout(wait);
      wait = setTimeout(settle, 140); // the layout waits for the resize to stop
    };
    addEventListener('resize', on);
    return () => { clearTimeout(wait); removeEventListener('resize', on); };
  }, []);
  return web;
}

// The scale the current layout is drawn at (for maths with getBoundingClientRect / pointer positions)
export const pageZoom = () => parseFloat(getComputedStyle(html()).getPropertyValue(html().dataset.layout === 'web' ? '--web-zoom' : '--phone-zoom')) || 1;
