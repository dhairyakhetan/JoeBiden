import { HOST } from '../host.js';

// The path the magazine lives under (src/host.js: '' on its own site, '/terranotes' inside AQ's). Code here always
// writes its own paths ("/articles/x", "/editions/sep26/…"); these helpers put them under BASE where a real address
// or file URL is needed, and take it off again. Pure string helpers, no React: the build scripts use them too.
export const BASE = HOST.base;

export const isTnPath = (p) => !BASE || p === BASE || p.startsWith(`${BASE}/`);
// "/articles/x" → "/terranotes/articles/x"; "/" → "/terranotes"; keeps ?query and #hash; leaves relative, external
// and already-prefixed strings alone (so applying it twice is harmless)
export function withBase(to) {
  if (!BASE || typeof to !== 'string' || !to.startsWith('/') || to.startsWith('//')) return to;
  if (isTnPath(to)) return to;
  return to === '/' ? BASE : BASE + to;
}
// "/terranotes/articles/x" → "/articles/x"; "/terranotes" → "/"
export const stripBase = (p) => (BASE && isTnPath(p) ? p.slice(BASE.length) || '/' : p);
