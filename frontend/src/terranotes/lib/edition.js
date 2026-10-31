import { createContext, useContext } from 'react';
import { LATEST, editionName, homeHeadline } from '../data/editions.js';
import { editionData } from '../editions/index.js';
import { HOST } from '../host.js';
import { tnHost } from './dom.js';

// The edition the page on screen belongs to (App.jsx picks it from the address, lib/routes.js editionAt): its look,
// articles, photo wall, words and team (src/editions/index.js). Components read it with useEdition().
export const EditionContext = createContext(editionData(LATEST));
export const useEdition = () => useContext(EditionContext);

// Puts an edition's look (src/editions/<id>/look.js) on the page as CSS variables: --<colour> (var(--ink)) and
// --font-<name> (var(--font-head)), on <html> so popups placed in <body> get them too; also data-edition="sep26" for an
// edition's own CSS to hang off. Inside AQ's website they go on the shadow host instead (everything inside inherits
// them), never on <html>: AQ's own CSS has variables of the same name (--ink, --card…) that its nav and footer use.
// Loads the look's extra fonts stylesheet once, and (own site only) sets the browser bar colour to its page colour.
export function applyLook({ id, look }, el = tnHost() || document.documentElement) {
  el.dataset.edition = id;
  for (const [k, v] of Object.entries(look.colors)) el.style.setProperty(`--${k}`, v);
  for (const [k, v] of Object.entries(look.fonts)) el.style.setProperty(`--font-${k}`, v);
  if (look.fontsCss && !document.querySelector(`link[href="${look.fontsCss}"]`)) { // fonts are the document's: embed-ok
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: look.fontsCss }));
  }
  if (!HOST.embedded) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', look.colors.page); // embed-ok
  else document.documentElement.style.setProperty('--tn-page', look.colors.page); // AQ's page behind the magazine (styles/document.css)
}


// A home page's tab title: the latest edition's is plain "Aquaterra" (inside AQ's website: "Terra Notes | AquaTerra")
export const homeTitle = (e) => (e.number !== LATEST ? `Aquaterra — ${editionName(e.number)} · ${e.month}` : HOST.embedded ? 'Terra Notes | AquaTerra' : homeHeadline());
