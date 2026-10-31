import { useEffect } from 'react';
import { calm } from './motion.js';

// A one-shot entrance for a block that starts below the fold: it waits a little lower and transparent, and rises into
// place the first time it scrolls into view (styles/motion.css .reveal / .shown). Blocks already on screen when the
// page draws, and reduced motion, skip it. Animates opacity + the translate property (the element keeps its own
// transform / tilt); the translate is gone once it's shown, so nothing positioned inside is affected.
// delay: ms after it comes into view (for staggering blocks side by side).
export function useReveal(ref, delay = 0) {
  useEffect(() => {
    const el = ref.current;
    if (!el || calm() || typeof IntersectionObserver === 'undefined') return undefined;
    const r = el.getBoundingClientRect();
    if (r.top < innerHeight * 0.9) return undefined; // already in view: no entrance
    el.classList.add('reveal');
    if (delay) el.style.transitionDelay = `${delay}ms`;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      el.classList.add('shown');
      io.disconnect();
      setTimeout(() => { el.classList.remove('reveal', 'shown'); el.style.transitionDelay = ''; }, 1200 + delay); // done: back to plain
    }, { rootMargin: '0px 0px -12% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
}
