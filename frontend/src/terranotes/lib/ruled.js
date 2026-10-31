import { useEffect, useState } from 'react';
import { RULED } from '../editions/pages.js';
import { pageZoom } from './layoutMode.js';

// Writing on ruled paper (September 2026's notebook pages: src/editions/sep26/look.css draws the ruling, and
// sep26/ruled.js holds its numbers). `rule` = { start, gap }: the first ruling tile starts `start` px down the
// .page-sheet and there is a line every `gap` px (the last pixel of each tile). This is the fit the diary uses
// (sep26/Diary.jsx): the shift that puts a baseline 2px above its nearest ruled line.
export const ruledShift = (y, { start, gap }) => {
  const line = start - 1 + Math.round((y + 2 - (start - 1)) / gap) * gap;
  return Math.round(line - 2 - y);
};

// The shifts (px, by name) that put the first baseline of each block on a ruled line. `probes` is a ref to
// { name: element }: a 0-high inline box at the start of the block, which sits on its baseline; the block is the
// probe's positioned parent. A baseline is measured against its own block, and the block's top on the sheet is
// `base + tops[name]` (base: where the section starts on the sheet; tops: each block's own `top`, unshifted). So the
// shift a block already has, and the section's rise-in (lib/reveal.js), can't throw the measure off, and measuring
// again changes nothing. Measured again when the fonts arrive and when `key` changes (the layout). No `rule` (any
// other edition): nothing to do.
export function useRuleSnap(rule, base, tops, probes, key) {
  const [shifts, setShifts] = useState({});
  useEffect(() => {
    if (!rule) return undefined;
    let gone = false;
    const fit = () => {
      if (gone) return;
      const z = pageZoom(), next = {};
      for (const [name, el] of Object.entries(probes.current)) {
        const block = el?.offsetParent;
        if (block) next[name] = ruledShift(base + tops[name] + (el.getBoundingClientRect().top - block.getBoundingClientRect().top) / z, rule);
      }
      setShifts(next);
    };
    fit(); document.fonts?.ready.then(fit);
    return () => { gone = true; };
  }, [key]);
  return shifts;
}

// Where a node's layout box sits inside `root` (offsetTop / offsetLeft up the chain: transforms don't count, so a
// shift already applied, or a section's rise-in, can't throw it off), or null if `root` isn't one of its offsetParents.
const offsetIn = (node, root) => {
  let top = 0, left = 0, n = node;
  while (n && n !== root) { top += n.offsetTop; left += n.offsetLeft; n = n.offsetParent; }
  return n === root ? { top, left } : null;
};

// A whole home page written on the edition's ruled paper (src/editions/pages.js RULED; nothing for an edition without
// one). Every element inside `sheet` (the .page-sheet) marked `data-ruled` is shifted so its first baseline sits on a
// ruled line, and, when it would start on or left of the red margin, to just clear of it. The baseline is measured
// with a 0-high box put at the start of the element (or of its `[data-ruled-base]` child, for a row whose text isn't
// its first thing) and taken out again at once. The value of `data-ruled` is how many rules one line of its text
// takes ("1", "2"; empty: leave its line height alone): the edition's look.css sets that line height, so the lines
// after the first follow. Measured again when the fonts arrive and when `key` changes.
export function useRuledPage(sheet, edition, web, key) {
  const rule = RULED[edition.id]?.[web ? 'web' : 'phone'];
  useEffect(() => {
    if (!rule) return undefined;
    let gone = false;
    const fit = () => {
      const root = sheet.current;
      if (gone || !root) return;
      for (const el of root.querySelectorAll('[data-ruled]')) {
        const at = el.querySelector('[data-ruled-base]') || el, probe = document.createElement('span');
        probe.style.cssText = 'display:inline-block;width:0;height:0';
        at.prepend(probe);
        const base = offsetIn(probe, root), box = offsetIn(el, root);
        probe.remove();
        if (!base || !box) continue;
        const dx = box.left < rule.margin + 8 ? rule.margin + 24 - box.left : 0;
        el.style.translate = `${dx}px ${ruledShift(base.top, rule)}px`;
      }
    };
    fit(); document.fonts?.ready.then(fit);
    const late = setTimeout(fit, 1200); // after late layout (titles fitted, images sized)
    return () => { gone = true; clearTimeout(late); };
  }, [edition.id, web, key]);
}
