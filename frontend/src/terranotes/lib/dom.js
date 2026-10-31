// Finding what TerraNotes drew. On its own site everything is in the document; inside AQ's website it draws inside a
// shadow root (src/TerraNotesRoot.jsx), where document.getElementById and querySelector find nothing. So code here
// never asks `document` for an element it drew: it uses byId / $ (and pop-ups go into portalRoot(), not document.body).
// The embed registers its shadow root here (setRoot); on the standalone site nothing does and the document is used.
let root = null, host = null, portals = null;
export const setRoot = (shadow, hostEl, portalsEl) => { root = shadow; host = hostEl; portals = portalsEl; };
export const clearRoot = (shadow) => { if (root === shadow) { root = null; host = null; portals = null; } };
export const tnRoot = () => root || document; // a ShadowRoot has getElementById / querySelector(All) too
export const tnHost = () => host; // the shadow root's host element (null on the standalone site)
export const portalRoot = () => portals || document.body; // where pop-ups that sit outside the page go
export const byId = (id) => tnRoot().getElementById(id);
export const $ = (sel) => tnRoot().querySelector(sel);
// A flag on <html> (and, inside AQ, on the shadow host too, where the stylesheets can see it as :host(...)):
// flag('tnNav', 'back') → <html data-tn-nav="back">; flag('tnNav', null) removes it.
export function flag(name, value) {
  for (const el of [document.documentElement, host]) {
    if (!el) continue;
    if (value == null) delete el.dataset[name]; else el.dataset[name] = value;
  }
}
