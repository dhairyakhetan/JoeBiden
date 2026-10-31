import { LATEST, editionById } from '../data/editions.js';

// Addresses. The home page also answers at /articles, /photos, /words and /members (opened scrolled to that section).
// Articles: /articles/<slug> (latest edition) or /<edition id>/articles/<slug> (older ones; data/editions.js). An older
// edition's home page: /<edition id>, also at /<edition id>/photos…
export const SECTIONS = ['articles', 'photos', 'words', 'members'];
// A home page address → { id: its edition's id ('' = the latest's, at /), section: '' or one of SECTIONS }, or null.
// "/sep26/photos" → { id: 'sep26', section: 'photos' }; "/" → { id: '', section: '' }
export function homeOf(p) {
  const m = p.match(/^(?:\/([a-z]{3}\d{2}))?(?:\/(articles|photos|words|members))?\/?$/);
  const e = m?.[1] && editionById(m[1]);
  return m && (!m[1] || e) ? { id: e && e.number !== LATEST ? m[1] : '', section: m[2] || '' } : null;
}
export const isHomePath = (p) => !!homeOf(p);
// two addresses of the same home page (/ and /photos; /sep26 and /sep26/words)
export const sameHome = (a, b) => isHomePath(a) && isHomePath(b) && homeOf(a).id === homeOf(b).id;
// the edition an address belongs to: its number (/sep26…: that edition; anything else: the latest)
export const editionAt = (p) => editionById((p.match(/^\/([a-z]{3}\d{2})(?:\/|$)/) || [])[1])?.number ?? LATEST;
export const slugOf = (p) => (p.match(/^(?:\/[a-z]{3}\d{2})?\/articles\/([^/]+)/) || [])[1]; // "/sep26/articles/labs" → "labs"
// An address that names a section of its page: { id: the element's id, base: the address without it }.
// /photos → { id: 'photos', base: '/' }; /sep26/words → { id: 'words', base: '/sep26' };
// /articles/labs/photon → { id: 'photon', base: '/articles/labs' }
export function sectionOf(p) {
  const home = homeOf(p);
  if (home) return home.section ? { id: home.section, base: home.id ? `/${home.id}` : '/' } : null;
  const m = p.match(/^((?:\/[a-z]{3}\d{2})?\/articles\/[^/]+)\/([^/]+)\/?$/);
  return m && { id: m[2], base: m[1] };
}
// a game's address (data/games.js): /games/<id> or /sep26/games/<id> (or without the id) → { id: the edition's id ('' =
// the latest's), game: the game's id or '' }, or null
export function gamesOf(p) {
  const m = p.match(/^(?:\/([a-z]{3}\d{2}))?\/games(?:\/([a-z]+))?\/?$/);
  const e = m?.[1] && editionById(m[1]);
  return m && (!m[1] || e) ? { id: e && e.number !== LATEST ? m[1] : '', game: m[2] || '' } : null;
}
// an article's demo, opened full-window in its own tab: <article>/<chapter>/demo
export const isDemoPath = (p) => /^(?:\/[a-z]{3}\d{2})?\/articles\/[^/]+\/[^/]+\/demo\/?$/.test(p);

// Where each page was opened from (history entry key → previous path), noted on every link click by scrollMemory.js.
// shared/BackHome.jsx uses it: opened from its edition's home page (`home`, e.g. / or /sep26) → "back to home" is a
// real Back (lands on the same scroll spot).
const cameFrom = {};
export const noteFrom = (key, path) => { cameFrom[key] = path; };
export const keepFrom = (oldKey, key) => { if (oldKey in cameFrom) cameFrom[key] = cameFrom[oldKey]; }; // the address changed in place
export const openedFromHome = (key, home = '/') => !!cameFrom[key] && sameHome(cameFrom[key], home);
