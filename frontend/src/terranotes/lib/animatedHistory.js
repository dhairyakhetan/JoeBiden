import { UNSAFE_createBrowserHistory as createBrowserHistory } from 'react-router-dom';

// A drop-in replacement for React Router's browser history (main.jsx; inside AQ's website, its App.tsx) through which
// every page change within the magazine is animated: links, navigate(), and the browser's Back/Forward. The animating
// itself is lib/pageSwap.js, plugged in by App.jsx (setPageSwap) when the magazine loads: this file stays small because
// AQ's router loads it with AQ's first page. Until then (an AQ page, before the magazine has loaded) changes just happen.
let swap = (from, to, update) => update();
export const setPageSwap = (fn) => { swap = fn; };

const pathOf = (to) => (typeof to === 'string' ? new URL(to, location.href).pathname : to.pathname || location.pathname);

export function createAnimatedHistory() {
  const h = createBrowserHistory({ v5Compat: true });
  let shown = h.location.pathname; // the page on screen
  const idx = () => window.history.state?.idx ?? 0; // position in the tab's history (tells Back from Forward)
  let shownIdx = idx();
  let direct = false; // inside our own push/replace, whose listener call must run synchronously
  const shownListeners = new Set(); // a history takes ONE listener (the router's): anything else that wants to know goes here
  const go = (method) => (to, state) => {
    const update = () => { direct = true; try { h[method](to, state); } finally { direct = false; } };
    // { quiet: true }: the same page under a new address (a section dropping off, AQ Labs' tabs, a game's address while
    // its popup is open): nothing to animate. A crossfade there flashes the whole screen.
    if (state?.quiet) update(); else swap(shown, pathOf(to), update);
  };
  return {
    get action() { return h.action; },
    get location() { return h.location; },
    createHref: (to) => h.createHref(to),
    createURL: (to) => h.createURL(to),
    encodeLocation: (to) => h.encodeLocation(to),
    go: (n) => h.go(n),
    push: go('push'),
    replace: go('replace'),
    // runs each time a new page has been put on screen (after the router has taken it), with its real pathname
    onShown: (fn) => { shownListeners.add(fn); return () => shownListeners.delete(fn); },
    listen: (fn) => h.listen((update) => {
      const from = shown, backwards = idx() < shownIdx;
      const apply = () => { shown = update.location.pathname; shownIdx = idx(); fn(update); shownListeners.forEach((l) => l(shown)); };
      if (direct) apply();
      else swap(from, update.location.pathname, apply, backwards);
    }),
  };
}
