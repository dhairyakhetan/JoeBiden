import { hardRefresh, INTRO_TTL } from './introNotebook.js';

// An edition whose photos.js sets SHOW (October: 5 of its PHOTOS) hangs that many on its photo wall, picked at random.
// The pick holds like the opening animation (lib/introNotebook.js): for 2½ hours, and is drawn again on a hard refresh.
// The build (no window) gets every photo; automated browsers (tests) the first SHOW, so screenshots stay the same.
export function pickPhotos(id, photos, show) {
  if (!show || photos.length <= show || typeof window === 'undefined') return photos;
  if (navigator.webdriver) return photos.slice(0, show);
  const draw = () => [...photos].map((p) => [Math.random(), p]).sort((a, b) => a[0] - b[0]).slice(0, show).map(([, p]) => p);
  try {
    const key = `tn-photos-${id}`, saved = JSON.parse(localStorage.getItem(key) || 'null');
    const kept = saved && Date.now() - saved.at < INTRO_TTL && !hardRefresh() && saved.pick.map((src) => photos.find((p) => p.photo === src));
    if (kept && kept.length === show && kept.every(Boolean)) return kept;
    const pick = draw();
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), pick: pick.map((p) => p.photo) }));
    return pick;
  } catch {
    return draw(); // no storage (some private modes): a new pick each visit
  }
}
