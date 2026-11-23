import { useEffect, useRef } from 'react';

// What readers do, sent to Microsoft Clarity when it's on the page: inside AQ's website, AQ's index.html loads it for
// visitors who aren't signed in (and stops it on sign-in). The magazine never loads Clarity itself, so on the own site
// (and for signed-in AQ visitors) nothing is sent. Each event goes by name, its props as session tags (edition,
// article, depth…), so recordings can be filtered by them. No personal data, ever.
//   track(name, props)         one event; never throws
//   useReadDepth(slug, p)      an article page: "Read depth" at 25 / 50 / 75 / 100 % of the text, once each a visit
// Events: Edition opened { edition } (App.jsx, once per edition a page load) · Read depth { article, depth } · Game opened { game } · Shared { article, method } · Words game done { score, of }
export function track(name, props) {
  try {
    const clarity = window.clarity;
    if (typeof clarity !== 'function') return;
    clarity('event', name);
    for (const [key, value] of Object.entries(props || {})) if (value != null) clarity('set', key, String(value));
  } catch { /* never let counting break the page */ }
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
