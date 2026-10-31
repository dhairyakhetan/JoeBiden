import { useEffect } from 'react';

// Pauses every CSS animation inside `ref` while it's scrolled well out of view (class .off-screen, styles/loops.css).
export function usePauseOffscreen(ref) {
  useEffect(() => {
    const el = ref.current;
    const io = new IntersectionObserver(([e]) => el.classList.toggle('off-screen', !e.isIntersecting), { rootMargin: '200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
}

// The same, one observer per animated element under `ref` (for a tall page whose looping bits sit among still ones):
// every match of `selector` that is well out of view holds still. Elements added later (a section mounting) count too.
export function usePauseEach(ref, selector) {
  useEffect(() => {
    const root = ref.current;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('off-screen', !e.isIntersecting)), { rootMargin: '200px 0px' });
    const seen = new WeakSet();
    const scan = () => root.querySelectorAll(selector).forEach((n) => { if (!seen.has(n)) { seen.add(n); io.observe(n); } });
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(root, { childList: true, subtree: true });
    return () => { mo.disconnect(); io.disconnect(); };
  }, []);
}
