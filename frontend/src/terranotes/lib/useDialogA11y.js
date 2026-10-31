import { useEffect } from 'react';
import { tnRoot } from './dom.js';

// Keyboard behaviour for a pop-up dialog (the photo viewer, a team profile): while `active`, focus moves into it, Esc
// closes it, Tab stays inside it, and closing hands focus back to whatever opened it. `ref` is the dialog's element;
// `first` (optional) picks what to focus. Works inside AQ's shadow root too (lib/dom.js).
const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';

export function useDialogA11y(active, ref, onClose, first) {
  useEffect(() => {
    if (!active) return;
    const root = tnRoot();
    const opener = root.activeElement || document.activeElement;
    const el = ref.current;
    const items = () => [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === root.activeElement);
    const start = (first && el.querySelector(first)) || items()[0] || el;
    if (start === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    start.focus({ preventScroll: true });
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const list = items();
      if (!list.length) { e.preventDefault(); return; }
      const a = root.activeElement, i = list.indexOf(a);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); list[list.length - 1].focus(); }
      else if (!e.shiftKey && (i === list.length - 1 || i === -1)) { e.preventDefault(); list[0].focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
    };
  }, [active]);
}
