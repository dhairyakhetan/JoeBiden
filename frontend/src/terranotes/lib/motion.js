// Motion switches, read by CSS (via classes on <html>) and by JS that animates.
// calm(): the OS "reduce motion" setting is on → nothing animates (every animation has a reduced-motion rule).
// LITE: a low-end device (≤2 GB memory, ≤2 CPU cores, Data Saver on, or ?lite in the address) → main.jsx sets
//   <html class="tn-lite"> (inside AQ's website, the shadow host's class): the endless decorative loops hold still (styles/loops.css).
//   One-off motion (cards opening, page changes) still plays.
export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const LITE = (navigator.deviceMemory || 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 2 || !!navigator.connection?.saveData || /[?&]lite\b/.test(location.search);
