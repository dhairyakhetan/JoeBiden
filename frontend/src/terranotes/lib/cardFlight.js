import { pageZoom } from './layoutMode.js';
import { calm } from './motion.js';

// The card ↔ article "flight" (FLIP, Web Animations API, transform only so it stays on the GPU):
// - opening: the tapped card's box is remembered (rememberCard / rememberBox), then the article page calls
//   flyInFromCard(cover) and the cover starts where the card was and flies into place;
// - closing: animatedHistory.js calls flyBack(card, coverBox) and the card starts where the cover was and settles.
let last = null;
export const rememberBox = (r) => { last = { x: r.left, y: r.top, w: r.width, t: Date.now() }; };
export const rememberCard = (e) => rememberBox(e.currentTarget.getBoundingClientRect());
// Props for a card's link: remember the tap, or, for an article with its own page (no cover to land on, e.g. AQ Labs),
// data-flight="off" so animatedHistory.js crossfades instead.
export const flight = (a) => (a.page ? { 'data-flight': 'off' } : { onClick: rememberCard });

// direct (phone): straight into place with one small settle. Otherwise (web): lifts, then drops onto its wire.
function flyFrom(el, f, direct) {
  el.getAnimations().forEach((an) => an.cancel()); // replaces the usual drop-in (.hero-drop)
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  const z = pageZoom(), start = `translate(${(f.x - r.left) / z}px, ${(f.y - r.top) / z}px) scale(${f.w / r.width}) rotate(-2deg)`;
  el.style.transformOrigin = '0 0';
  el.animate(direct ? [
    { transform: start, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' },
    { transform: 'translate(0px, 4px) rotate(0.6deg)', offset: 0.8, easing: 'ease-in-out' },
    { transform: 'translate(0px, 0px) rotate(0deg)' },
  ] : [
    { transform: start, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' },
    { transform: 'translate(0px, -46px) scale(1) rotate(-3deg)', easing: 'cubic-bezier(0.55, 0, 0.9, 0.45)', offset: 0.5 },
    { transform: 'translate(0px, 8px) rotate(1.6deg)', easing: 'ease-out', offset: 0.72 },
    { transform: 'translate(0px, -3px) rotate(-0.8deg)', easing: 'ease-in-out', offset: 0.87 },
    { transform: 'translate(0px, 0px) rotate(0deg)' },
  ], { duration: direct ? 620 : 900 });
}

// Article page, on mount: fly the cover in if a card was tapped in the last 4 s (else its CSS drop-in plays).
export function flyInFromCard(el, direct = false) {
  const f = last;
  last = null;
  if (f && Date.now() - f.t < 4000 && el?.animate && !calm()) flyFrom(el, f, direct);
}

// Back on home: the card starts cover-sized where the cover was (box = the cover's rect) and settles into its slot.
export function flyBack(card, box) {
  const r = card.getBoundingClientRect();
  if (!r.width || r.bottom < 0 || r.top > innerHeight) return;
  const z = pageZoom(), base = getComputedStyle(card).transform, rest = base === 'none' ? '' : ` ${base}`;
  const was = { origin: card.style.transformOrigin, z: card.style.zIndex };
  card.style.transformOrigin = '0 0';
  card.style.zIndex = '30';
  const an = card.animate([
    { transform: `translate(${(box.left - r.left) / z}px, ${(box.top - r.top) / z}px) scale(${box.width / r.width})${rest}`, easing: 'cubic-bezier(0.25, 0.8, 0.3, 1)' },
    { transform: `translate(0px, 3px) rotate(0.8deg)${rest}`, offset: 0.8, easing: 'ease-in-out' },
    { transform: `translate(0px, 0px)${rest}` },
  ], { duration: 620 });
  an.onfinish = an.oncancel = () => { card.style.transformOrigin = was.origin; card.style.zIndex = was.z; };
}
