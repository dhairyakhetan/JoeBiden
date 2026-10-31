import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType } from '../router.jsx';
import { calm } from './motion.js';
import { $, byId } from './dom.js';
import { HOST } from '../host.js';
import { keepFrom, noteFrom, sameHome, sectionOf } from './routes.js';

// Scroll handling for every navigation. <ScrollMemory /> renders nothing; App.jsx places it BEFORE the routes so its
// layout effect runs before the new page's (the article page measures its cover for the card flight after this scroll).
// - Back/Forward and reload land where you were (positions saved per history entry, for the tab's session);
// - a new page starts at the top, or at the section its address names (lib/routes.js sectionOf: /photos → the element
//   with id="photos", /articles/labs/photon → id="photon"; also old-style #hash);
// - a section link while already on that home page glides there instead of jumping;
// - ?by=<writer> also rewinds the web's sideways article line, since that writer's pieces now come first.
// - Once you've scrolled a screen or more away from that section, the address drops it (/photos → /, /sep26/words →
//   /sep26, /articles/labs/photon → /articles/labs): replaced in place, marked { quiet: true } so nothing scrolls or
//   remounts. Not with ?by= (that address means the writer's order). Pages that change the address themselves (the AQ Labs tabs)
//   navigate with replace + state { quiet: true } too.
const KEY = 'aq-scroll';
const saved = (() => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } })();
const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify(saved)); } catch { /* private mode */ } };
let current = null; // the history entry whose scroll position is being recorded
let lastPath = null, lastKey = null;
let anchor = null; // the section the address names: { top: where it's shown, base, armed: false while still gliding there }
// Inside AQ's website the visitor can leave the magazine and come back: "the previous page" mustn't survive that (a fresh
// arrival would glide instead of starting at the top). Called when the magazine goes away.
export const forgetScroll = () => { lastPath = null; lastKey = null; anchor = null; current = null; };
// on its own site, from the very start (inside AQ, only while the magazine shows: the effect below)
if (!HOST.embedded && 'scrollRestoration' in history) history.scrollRestoration = 'manual';

export function ScrollMemory() {
  const { pathname, hash, key, search, state } = useLocation();
  const type = useNavigationType();
  const navigate = useNavigate(), nav = useRef(navigate);
  nav.current = navigate;
  useLayoutEffect(() => {
    current = null; // stop recording the page being left before anything scrolls
    persist();
    const spot = `${key}:${pathname}`; // a fresh load's key is always "default", so the path is part of it
    const sec = sectionOf(pathname) || (hash && { id: decodeURIComponent(hash.slice(1)), base: pathname });
    const target = sec && byId(sec.id);
    const quiet = type === 'REPLACE' && state?.quiet;
    let glide = quiet && !calm(); // a page's own section link (AQ Labs' tabs) glides there itself
    if (quiet) { keepFrom(lastKey, key); saved[spot] = Math.round(scrollY); } // same page, new address: still "opened from home", same spot
    else {
      const behavior = type === 'PUSH' && sameHome(lastPath || '', pathname) && !calm() ? 'smooth' : 'auto';
      glide = behavior === 'smooth';
      if (type === 'PUSH') noteFrom(key, lastPath);
      if (type === 'POP' && saved[spot] != null) window.scrollTo(0, saved[spot]);
      else if (target) target.scrollIntoView({ behavior });
      else window.scrollTo({ top: 0, behavior });
      if (type === 'PUSH' && new URLSearchParams(search).get('by')) {
        requestAnimationFrame(() => $('.art-scroller')?.scrollTo({ left: 0, behavior }));
      }
    }
    lastPath = pathname;
    lastKey = key;
    const top = target && scrollY + target.getBoundingClientRect().top; // where it is, even mid-glide
    const at = glide ? Math.min(top, document.documentElement.scrollHeight - innerHeight) : scrollY; // where it lands
    anchor = target && !new URLSearchParams(search).has('by') ? { top: at, base: sec.base, armed: !glide, t: performance.now() } : null;
    current = spot;
  }, [pathname, hash, key]);
  useEffect(() => { // the browser's own scroll restoration is off while the magazine shows (this file keeps the positions)
    const was = 'scrollRestoration' in history ? history.scrollRestoration : null;
    if (was) history.scrollRestoration = 'manual';
    return () => { if (was) history.scrollRestoration = was; forgetScroll(); };
  }, []);
  useEffect(() => {
    const remember = () => {
      if (current != null) saved[current] = Math.round(scrollY);
      if (!anchor) return;
      const away = Math.abs(scrollY - anchor.top);
      // wait until the glide there has arrived (it starts far away), or has clearly been abandoned. Not 'scrollend': an
      // interrupted scroll (web's snap) fires it as the glide begins
      if (!anchor.armed) { anchor.armed = away < innerHeight / 2 || performance.now() - anchor.t > 3000; return; }
      if (away < innerHeight) return;
      const { base } = anchor;
      anchor = null;
      nav.current({ pathname: base, search: location.search }, { replace: true, state: { quiet: true } });
    };
    addEventListener('scroll', remember, { passive: true });
    addEventListener('pagehide', persist);
    return () => { removeEventListener('scroll', remember); removeEventListener('pagehide', persist); };
  }, []);
  return null;
}
