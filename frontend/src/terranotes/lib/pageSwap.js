import { flushSync } from 'react-dom';
import { isTnPath, stripBase } from './base.js';
import { flyBack, rememberBox } from './cardFlight.js';
import { $, flag } from './dom.js';
import { calm } from './motion.js';
import { isHomePath, sameHome, slugOf } from './routes.js';

// How a page change within the magazine is animated (lib/animatedHistory.js calls it; App.jsx plugs it in, so it loads
// with the magazine and not with AQ's own first page: inside AQ's website the history is created up front by AQ's router).
// - A card is involved (opening an article from its card, or returning home from an article): that card's flight IS
//   the transition (cardFlight.js); the pages swap instantly. Adding a crossfade too played it twice (Safari
//   snapshots the new page before the flight starts).
// - Anything else: a short view-transition crossfade (styles/motion.css, html[data-tn-nav]), header held still.
// - No animation between one home page's sections (/ and /photos), with reduced motion, in a hidden tab, or without
//   view-transition support. Inside AQ, changes that don't stay within /terranotes pass straight through.
// Paths below are the magazine's own (lib/base.js strips AQ's /terranotes); the real ones are used to find links.
let seq = 0;
export function pageSwap(realFrom, realTo, update, backwards = false) {
  if (!isTnPath(realFrom) || !isTnPath(realTo)) { update(); return; }
  const from = stripBase(realFrom), to = stripBase(realTo);
  // (also none when an article's other address redirects to it, e.g. /sep26/articles/labs → /articles/labs)
  if (!document.startViewTransition || calm() || from === to || sameHome(from, to) || (slugOf(from) && slugOf(from) === slugOf(to)) || document.visibilityState !== 'visible') {
    update();
    return;
  }
  const kind = isHomePath(to) ? 'back' : slugOf(to) ? (slugOf(from) ? (backwards ? 'prev' : 'next') : 'into') : 'page';
  const cover = kind === 'back' && slugOf(from) && $('.hero-drop img')?.getBoundingClientRect();
  // a card whose article has its own page (data-flight="off", e.g. AQ Labs: no cover to land) crossfades instead
  const link = (kind === 'into' || kind === 'next') && $(`a[href="${realTo}"]:not([data-flight="off"])`);
  const box = link && link.getBoundingClientRect();
  const flies = !!(box && box.width && box.bottom > 0 && box.top < innerHeight);
  if (flies) rememberBox(box);
  if (flies || cover) {
    flushSync(update); // rendered now, so the card on the new page can be found and measured
    const card = cover && $(`a[href="${realFrom}"]`);
    if (card) flyBack(card, cover);
    return;
  }
  const id = ++seq;
  flag('tnNav', kind);
  document.startViewTransition(() => { flushSync(update); }).finished.finally(() => { if (id === seq) flag('tnNav', null); });
}
