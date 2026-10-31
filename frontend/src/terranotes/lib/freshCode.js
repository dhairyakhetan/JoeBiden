// Code fetched later (React.lazy: AQ Labs, Buddy's games) after a new version of the site went live. A page opened
// before the deploy asks for the old version's files, which are gone (a 404, or the site's HTML in their place), and
// that part of the page fails while the rest works: "half the site loads". The cure is to reload once, which fetches
// the new version. Never twice within a minute, so a real outage shows the error card instead of looping.
const KEY = 'tn-fresh-reload';

export function reloadOnce() {
  try {
    if (Date.now() - (Number(sessionStorage.getItem(KEY)) || 0) < 60000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false; // no storage: can't guard against a loop, so don't reload
  }
  location.reload();
  return true;
}

// A loader for React.lazy that reloads the page (once) when its file can't be fetched; while it reloads, it waits.
export const freshLoad = (load) => () => load().catch((err) => (reloadOnce() ? new Promise(() => {}) : Promise.reject(err)));

// Vite's own preload of a lazy file's helpers fails the same way: same cure.
export function watchStaleCode() {
  addEventListener('vite:preloadError', (e) => { if (reloadOnce()) e.preventDefault(); });
}
