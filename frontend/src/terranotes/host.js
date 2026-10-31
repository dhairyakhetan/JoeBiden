// Where this copy of TerraNotes runs. The magazine has two homes with the same code:
//   - its own site (this repo's build: index.html + main.jsx), at the root of its own address;
//   - AQ's main website, drawn inside a shadow root under /terranotes (embed/aq/, CLAUDE.md "Inside AQ's website").
// This file is what differs between them: `node tools/export-aq.mjs` writes AQ's version (and names the router package
// as AQ has it, react-router-dom, in router.jsx and lib/animatedHistory.js).
//   base:     the path the magazine lives under ('' = the site's root; AQ: '/terranotes'): lib/base.js
//   embedded: drawn inside another site's page (AQ, with its own nav, footer and skip link): no skip link or
//             console hello of its own, and the AQ-only touches (styles with :host, the phone call button)
export const HOST = { base: '/terranotes', embedded: true };

// AQ_LOOK: the magazine drawn as it is inside AQ's website: its header hidden (AQ's nav takes that place), the other
// editions on a card at the end of the home pages, a "← Back to home" pill, the phone's "call Buddy" button, AQ Labs
// full width (shared/InsideAQ.jsx, html / host [data-tn-aq] in the CSS). Always inside AQ. The magazine's own site is
// AQ's testing ground, so it shows the same by default, with a plain placeholder box where AQ's nav goes (shared/AqNavSlot.jsx);
// ?aq=0 in the address shows the plain own-site version instead (?aq=1 back), remembered for the tab.
function aqPreview() {
  try {
    const q = new URLSearchParams(location.search).get('aq');
    if (q != null) sessionStorage.setItem('tn-aq', q === '0' ? '0' : '1');
    return sessionStorage.getItem('tn-aq') !== '0';
  } catch { return true; }
}
export const AQ_LOOK = HOST.embedded || aqPreview();
