import { useRef } from 'react';
import { DECOR } from '../editions/pages.js';
import { useEdition } from '../lib/edition.js';
import { usePauseOffscreen } from '../lib/pauseOffscreen.js';

// The page's edition's own decorations on the home page (src/editions/pages.js DECOR), if it has any, in a layer over
// the top of the artboard (its coordinates are the artboard's). Their loops (class .dz, in the edition's look.css)
// hold still once that layer is scrolled away, and follow the usual stops (styles/loops.css: reduced motion, LITE,
// page swaps).
export default function EditionDecor({ web }) {
  const Decor = DECOR[useEdition().id], layer = useRef(null);
  usePauseOffscreen(layer);
  return (
    <div ref={layer} aria-hidden="true" style={{ position: "absolute", left: "0", top: "0", width: "100%", height: web ? "1150px" : "900px", pointerEvents: "none" }}>
      {Decor && <Decor web={web} />}
    </div>
  );
}
