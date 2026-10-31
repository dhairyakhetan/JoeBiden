import { useRef, useState } from 'react';
import { pageZoom } from './layoutMode.js';

// Swipe/drag logic for the full-screen photo viewers (shared/PhotoViewer.jsx), mouse and touch alike (pointer events).
// n photos, opened at `start`; width = one slide's width (px); far = drag distance that always changes photo;
// flick = { v: px per ms, min: px } for a quick short swipe. No wrap-around: dragging past either end rubber-bands.
// Returns cur (shown index), go(i), dx (live drag offset), dragging, prog (-1…1 towards the neighbour), nb (that
// neighbour's index) and the pointer handlers to spread on the draggable element.
export function useGallery(n, start, { width, far, flick }) {
  const [cur, setCur] = useState(start);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef(null);
  const go = (k) => { setCur(Math.max(0, Math.min(n - 1, k))); setDx(0); setDragging(false); };
  const end = () => {
    if (!drag.current) return;
    const v = dx / Math.max(1, Date.now() - drag.current.t);
    drag.current = null;
    if (dx < -far || (v < -flick.v && dx < -flick.min)) go(cur + 1);
    else if (dx > far || (v > flick.v && dx > flick.min)) go(cur - 1);
    else { setDx(0); setDragging(false); }
  };
  const handlers = {
    onPointerDown: (e) => {
      if (e.button !== 0) return;
      drag.current = { x: e.clientX, t: Date.now() };
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true); setDx(0);
    },
    onPointerMove: (e) => {
      if (!drag.current) return;
      const d = (e.clientX - drag.current.x) / pageZoom();
      setDx((cur === 0 && d > 0) || (cur === n - 1 && d < 0) ? d * 0.3 : d);
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
  const prog = Math.max(-1, Math.min(1, -dx / width));
  return { cur, go, dx, dragging, prog, nb: prog > 0 ? cur + 1 : cur - 1, handlers };
}
