import { useEffect, useState } from 'react';
import { tnRoot } from './dom.js';

// How far into an article the reader is, for the article pages' progress bar and (web) the "in this piece" rail.
// ref = the article's text block. → { p: 0–1 (the reading line, a third down the screen, through the text), at: the
// index of the section heading (h2[data-part]) the reader is in, or -1 before the first }. Updated once per frame
// while scrolling, never otherwise.
export function useReadProgress(ref) {
  const [state, setState] = useState({ p: 0, at: -1 });
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const line = innerHeight / 3, r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (line - r.top) / Math.max(1, r.height - line)));
      let at = -1;
      el.querySelectorAll('h2[data-part]').forEach((h, i) => { if (h.getBoundingClientRect().top <= line) at = i; });
      setState((s) => (Math.abs(s.p - p) < 0.002 && s.at === at ? s : { p, at }));
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    addEventListener('scroll', on, { passive: true });
    addEventListener('resize', on);
    return () => { cancelAnimationFrame(raf); removeEventListener('scroll', on); removeEventListener('resize', on); };
  }, [ref]);
  return state;
}

export const partId = (i) => `part-${i + 1}`; // a section heading's element id (scrolls there: the rail's links)
export const goToPart = (i) => tnRoot().getElementById(partId(i))?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
