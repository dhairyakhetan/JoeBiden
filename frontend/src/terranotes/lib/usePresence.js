import { useEffect, useRef, useState } from 'react';
import { calm } from './motion.js';

// Keeps a popup mounted for `ms` after it closes so its exit animation can play.
// value: what's open (an index, an id…; null/undefined = closed). Returns [value to render, leaving?].
export function usePresence(value, ms = 180) {
  const kept = useRef(value);
  const [, rerender] = useState(0);
  if (value != null) kept.current = value;
  const leaving = value == null && kept.current != null;
  useEffect(() => {
    if (!leaving) return undefined;
    const t = setTimeout(() => { kept.current = null; rerender((n) => n + 1); }, calm() ? 0 : ms);
    return () => clearTimeout(t);
  }, [leaving, value, ms]);
  return [value != null ? value : kept.current, leaving];
}
