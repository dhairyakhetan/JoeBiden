import { useEffect, useRef } from 'react';
import { inject, track as vaTrack } from '@vercel/analytics';
import { HOST } from '../host.js';

// What readers do, counted with Vercel Web Analytics (cookieless: no banner needed, no personal data). Turn it on in
// the Vercel project (Analytics tab); page views (every address, page changes included) are free. The named events
// below need a plan with custom events; without one they are simply dropped.
//   startAnalytics()           main.jsx, the own site only (inside AQ's website, AQ counts its own pages)
//   track(name, props)         one event; never throws
//   useReadDepth(slug, p)      an article page: "Read depth" at 25 / 50 / 75 / 100 % of the text, once each a visit
// Events: Edition opened { edition } (App.jsx, once per edition a page load) · Read depth { article, depth } · Game opened { game } · Shared { article, method } · Words game done { score, of }
export function startAnalytics() {
  if (HOST.embedded || /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return; // its script is only served on Vercel
  try { inject({ mode: import.meta.env.PROD ? 'production' : 'development', debug: false }); } catch { /* blocked: fine */ }
}

export function track(name, props) {
  try { vaTrack(name, props); } catch { /* never let counting break the page */ }
}

const STEPS = [25, 50, 75, 100];
export function useReadDepth(slug, p) {
  const seen = useRef({ slug, max: 0 });
  if (seen.current.slug !== slug) seen.current = { slug, max: 0 };
  useEffect(() => {
    const s = seen.current, pct = Math.round(p * 100);
    for (const d of STEPS) if (pct >= d && s.max < d) { s.max = d; track('Read depth', { article: slug, depth: d }); }
  }, [slug, p]);
}
