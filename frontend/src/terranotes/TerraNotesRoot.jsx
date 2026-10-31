import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import App, { loadLabs } from './App.jsx';
import IntroNotebook from './shared/IntroNotebook.jsx';
import { LATEST } from './data/editions.js';
import { editionData } from './editions/index.js';
import { applyLook } from './lib/edition.js';
import { introWanted } from './lib/introNotebook.js';
import { LITE } from './lib/motion.js';
import { setRoot, clearRoot } from './lib/dom.js';
import { forgetWebHeader } from './web/WebHeader.jsx';
import { forgetPhoneHeader } from './phone/PhoneHeader.jsx';
import './styles/document.css';
import base from './styles/base.css?inline';
import loops from './styles/loops.css?inline';
import motion from './styles/motion.css?inline';
import phone from './styles/phone.css?inline';
import web from './styles/web.css?inline';
import intro from './styles/intro.css?inline';
import buddy from './styles/buddy.css?inline';

// The magazine inside AQ's website (only there: its App.tsx lazy-loads this at /terranotes/*; the magazine's own site
// starts at main.jsx instead). AQ's stylesheet is global and opinionated (`body{font-family … !important}`, heading
// sizes, `p{line-height}`, focus rings, `html{scroll-behavior:smooth}`), and this design leans on browser defaults plus
// inline styles, so sharing one document would bend it. So the whole magazine draws inside a shadow root: nothing in
// AQ's CSS reaches in, nothing in the magazine's leaks out. What a shadow root can't hold (@font-face, <html> rules, the
// ::view-transition tree) is in styles/document.css, keyed on html.tn-on so it does nothing while another page shows.
// The host is `all: initial`, so nothing inherits across the boundary (AQ's body font, size, colour, line-height); the
// edition's look (its colours and fonts as CSS variables, lib/edition.js) goes on the host, never on <html>, where
// AQ has variables of the same names.
const SHEETS = [base, loops, motion, phone, web, intro, buddy]; // AQ Labs brings its own (articles/labs/LabsPage.jsx)
// text-size-adjust is reset by `all: initial` too: phones mustn't enlarge the text on their own
const HOST_STYLE = { all: 'initial', display: 'block', position: 'relative', minHeight: '100vh', background: 'var(--page)', WebkitTextSizeAdjust: '100%', textSizeAdjust: '100%' };

// Phones (and upright tablets) are pinned to the 390px layout by the viewport tag; the magazine's own index.html does
// this for its whole site, here it is on only while the magazine shows, and AQ's own tag comes back after.
function pinViewport() {
  const meta = document.querySelector('meta[name="viewport"]'); // the page's own tag: embed-ok
  if (!meta) return () => {};
  const was = meta.content;
  const tablet = Math.min(screen.width, screen.height) >= 700;
  const land = matchMedia('(orientation: landscape)');
  const fit = () => { meta.content = tablet && land.matches ? 'width=device-width, initial-scale=1' : 'width=390'; };
  fit();
  if (tablet) land.addEventListener('change', fit);
  return () => { land.removeEventListener('change', fit); meta.content = was; };
}

export default function TerraNotesRoot() {
  const [parts, setParts] = useState(null); // { app, portals }: the two containers inside the shadow root
  const [showIntro] = useState(() => introWanted()); // decided once, before the first paint
  const shadowRef = useRef(null);

  const hostRef = useCallback((el) => {
    if (!el) return;
    const shadow = el.shadowRoot || el.attachShadow({ mode: 'open' });
    let app = shadow.querySelector('.tn-app'), portals = shadow.querySelector('.tn-portals');
    if (!app) {
      for (const css of SHEETS) shadow.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
      app = Object.assign(document.createElement('div'), { className: 'tn-body tn-app' });
      portals = Object.assign(document.createElement('div'), { className: 'tn-body tn-portals' });
      shadow.append(app, portals);
    }
    shadowRef.current = shadow;
    setRoot(shadow, el, portals);
    el.dataset.tnAq = ''; // AQ's look (src/host.js AQ_LOOK): the CSS keys on :host([data-tn-aq])
    applyLook(editionData(LATEST), el); // at once, so nothing draws before the look is there (the app then sets the page's own)
    setParts({ app, portals });
  }, []);

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.classList.add('tn-on');
    if (LITE) html.classList.add('tn-lite');
    const unpin = pinViewport();
    const warm = setTimeout(() => loadLabs().catch(() => {}), 2500); // so opening AQ Labs from a card doesn't wait on its chunk
    return () => {
      clearTimeout(warm);
      unpin();
      html.classList.remove('tn-on', 'tn-lite');
      html.dataset.tnLeft = ''; // AQ's page fades in (styles/document.css); cleared once it has
      setTimeout(() => { delete html.dataset.tnLeft; }, 320);
      html.style.removeProperty('--web-zoom');
      html.style.removeProperty('--phone-zoom');
      html.style.removeProperty('--tn-page');
      delete html.dataset.layout;
      delete html.dataset.tnNav;
      delete html.dataset.tnLabs;
      forgetWebHeader();
      forgetPhoneHeader();
      if (html.style.overflow === 'hidden') html.style.overflow = ''; // a pop-up or the opening animation may have been holding the scroll lock (anything else set there is AQ's)
    };
  }, []);

  useLayoutEffect(() => () => clearRoot(shadowRef.current), []);

  return (
    <>
      <div ref={hostRef} data-terranotes="" data-tn-host="" className={LITE ? 'tn-lite' : undefined} style={HOST_STYLE} />
      {parts && createPortal(<App />, parts.app)}
      {parts && showIntro && createPortal(<IntroNotebook />, parts.portals)}
    </>
  );
}
