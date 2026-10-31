import { SITE } from '../data/site.js';

// A hello printed in the browser console (after the page loads, so it's the newest thing there), plus an easter egg:
// aquaterra.wind() fires 'aq-wind', which swings every card on the web article line (web/WebArticleLine.jsx).
// It must never name anyone (the site's rule).
const LINE = [
  '  ──●──────────●──────────●──────────●──',
  '    │          │          │          │',
  '  ┌─┴──┐     ┌─┴──┐     ┌─┴──┐     ┌─┴──┐',
  '  │ ▤▤ │     │ ▤▤ │     │ ▤▤ │     │    │ ← still drying',
  '  └────┘     └────┘     └────┘     └────┘',
].join('\n');

const WHOOSH = ['🌬️ whoooosh', '🌬️ fwoomp', '🌬️ the cards felt that', '🌬️ hold onto your pegs'];

export function sayHello() {
  window.aquaterra = {
    wind() {
      dispatchEvent(new CustomEvent('aq-wind'));
      return WHOOSH[Math.floor(Math.random() * WHOOSH.length)];
    },
  };
  const print = () => {
    const big = 'font-size: 28px; font-weight: 900; color: #2464D2; text-shadow: 2px 2px 0 #0B1330; letter-spacing: -1px;';
    const soft = 'font-size: 13px; color: #8E7A5E; font-style: italic;';
    const body = 'font-size: 12px; line-height: 1.6;';
    const code = 'font-size: 12px; background: #F7C21A; color: #111; padding: 1px 5px; border-radius: 3px;';
    console.log('%cAQUATERRA', big);
    console.log('%cnotes from where the land meets the water.', soft);
    console.log(`%c${LINE}`, 'font-family: monospace; font-size: 12px; color: #5B3A1E; line-height: 1.3;');
    console.log(
      '%c👀 poking around behind the pegs?\n\n' +
      "this whole site is held up by string. literally. go look at the article line.\n" +
      "every card up there swings on its own little clock, so no two ever move in sync.\n" +
      "and yes, the words game answers are in here somewhere. no, don't. play it properly.\n\n" +
      '%caquaterra.wind()%c  ← type that with the article line on screen, then look up\n\n' +
      `%cfound a bug? tell us → instagram.com/${SITE.instagram}`,
      body, code, body, soft,
    );
  };
  if (document.readyState === 'complete') setTimeout(print, 300);
  else addEventListener('load', () => setTimeout(print, 300), { once: true });
}
