import { useLayoutEffect, useRef } from 'react';

// Long titles on fixed-size cards. Returns a ref for the heading; it shrinks the heading's font size (px, from `max`
// down to `min`) until either
//   - the card's content fits (the heading's parent: a fixed-height flex column), or
//   - with `lines`: the heading wraps to at most that many lines.
// Still too long at `min`: the dek (the <p> right after the heading) loses lines instead. Measured on the device, again
// when web fonts finish loading and whenever the title changes.
export const coverFloor = (height) => `${Math.round(parseFloat(height) * 0.6)}px`; // how short a card's cover may get for a long title

export function useFitTitle(title, max, min, lines) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return undefined;
    const fits = () => {
      if (lines) return t.offsetHeight <= lines * parseFloat(getComputedStyle(t).lineHeight) + 1;
      const box = t.parentElement, cs = getComputedStyle(box);
      const kids = [...box.children].filter((k) => getComputedStyle(k).position !== 'absolute');
      const first = kids[0], last = kids[kids.length - 1];
      return last.offsetTop + last.offsetHeight - first.offsetTop <= box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    };
    const size = (px) => { if (t.style.fontSize !== `${px}px`) t.style.fontSize = `${px}px`; }; // unchanged = no relayout
    const dek = !lines && t.nextElementSibling?.tagName === 'P' ? t.nextElementSibling : null;
    const clamp = (n) => {
      for (const [k, v] of [['display', '-webkit-box'], ['-webkit-box-orient', 'vertical'], ['-webkit-line-clamp', String(n)], ['overflow', 'hidden']]) {
        if (n) dek.style.setProperty(k, v); else dek.style.removeProperty(k);
      }
    };
    const fit = () => {
      if (!t.isConnected) return;
      if (dek && dek.style.display) clamp(0);
      size(max);
      if (fits()) return;
      size(min);
      if (!fits()) {
        if (dek) for (let n = Math.round(dek.offsetHeight / parseFloat(getComputedStyle(dek).lineHeight)) - 1; n >= 1 && !fits(); n--) clamp(n);
        return;
      }
      let lo = min, hi = max; // binary search: fits at lo, not at hi
      while (hi - lo > 0.5) {
        const mid = (lo + hi) / 2;
        size(mid);
        if (fits()) lo = mid; else hi = mid;
      }
      size(Math.floor(lo * 2) / 2);
    };
    fit();
    let queued = 0;
    const again = () => { if (!queued) queued = requestAnimationFrame(() => { queued = 0; fit(); }); };
    const fonts = document.fonts;
    if (fonts) {
      if (fonts.status === 'loading') fonts.ready.then(again);
      fonts.addEventListener?.('loadingdone', again);
    }
    return () => { cancelAnimationFrame(queued); queued = -1; fonts?.removeEventListener?.('loadingdone', again); };
  }, [title, max, min, lines]);
  return ref;
}
