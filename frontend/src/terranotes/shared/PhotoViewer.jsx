import { useEffect, useRef } from 'react';
import { ChevronIcon, CloseIcon } from './Icons.jsx';
import { pad2 } from '../lib/format.js';
import { calm } from '../lib/motion.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';
import { useGallery } from '../lib/useGallery.js';
import { usePhotoShapes } from '../lib/photoShapes.js';
import { useEdition } from '../lib/edition.js';
import { useDialogA11y } from '../lib/useDialogA11y.js';
import { FONT } from '../styles/fonts.js';

// The full-screen photo viewer opened from the photo wall (and AQ Labs' Karyaarth stills), both layouts: one polaroid
// at a time on a sliding track, swipe / drag (lib/useGallery.js), the arrows, the thumbnails or ← → keys; Esc or ✕
// closes (onClose). The page behind can't scroll. Each photo shows whole at its own shape, --ph tall (styles/phone.css /
// web.css: shrinks on short screens). closing = playing its exit (the home page keeps it mounted meanwhile,
// lib/usePresence.js).
// photos: [{ photo, caption, place, tint }] (default the edition's photo wall; keep the array stable), title on
// top, label = what one photo is called ("Highlight 01"), count = the counter's word ("HIGHLIGHTS · 01 / 05").
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const PHONE = {
  cls: 'photo-viewer', W: 390, press: 'press', tilts: ['-1.5deg', '1.2deg', '-0.8deg', '1.6deg', '-1.2deg'], drag: { far: 70, flick: { v: 0.45, min: 12 } },
  title: { left: "20px", top: "24px", fontSize: "32px" }, count: { left: "22px", top: "64px", fontSize: "10px", letterSpacing: "1.6px" },
  close: { right: "20px", top: "18px", width: "48px", height: "48px", boxShadow: "4px 4px 0 var(--amber)" }, closeIcon: 18,
  stage: { top: "104px", height: "calc(var(--ph) + 150px)" }, slide: { padding: "18px 30px 0" }, dim: [0.9, 0.45],
  peg: { top: "-12px", marginLeft: "-8px", width: "16px", height: "26px" }, print: { boxShadow: "7px 7px 0 var(--amber)", padding: "10px 10px 0" }, maxW: 310, emptyFont: "12px",
  caption: { fontSize: "22px" }, place: { fontSize: "9.5px", letterSpacing: "1.2px" },
  dots: { h: 7, on: 22, off: 7, gap: "7px" }, thumb: { size: "52px", pad: "3px", gap: "10px", top: "calc(var(--ph) + 360px)" },
};
const WEB = {
  cls: 'web-viewer', W: 1440, press: 'btn', tilts: ['-1.2deg', '1deg', '-0.6deg', '1.3deg', '-1deg'], drag: { far: 110, flick: { v: 0.5, min: 16 } },
  title: { left: "60px", top: "34px", fontSize: "44px" }, count: { left: "62px", top: "86px", fontSize: "11px", letterSpacing: "1.8px" },
  close: { right: "60px", top: "30px", width: "56px", height: "56px", boxShadow: "5px 5px 0 var(--amber)" }, closeIcon: 20,
  stage: { top: "120px", height: "calc(var(--ph) + 170px)" }, slide: { paddingTop: "24px", display: "flex", justifyContent: "center" }, dim: [0.88, 0.35],
  peg: { top: "-14px", marginLeft: "-10px", width: "20px", height: "30px" }, print: { boxShadow: "10px 10px 0 var(--amber)", padding: "14px 14px 0" }, maxW: 1000, emptyFont: "14px",
  caption: { fontSize: "28px" }, place: { fontSize: "11px", letterSpacing: "1.4px", whiteSpace: "nowrap" },
  dots: { h: 8, on: 26, off: 9, gap: "9px", top: "calc(var(--ph) + 314px)" }, thumb: { size: "64px", pad: "4px", gap: "14px", top: "calc(var(--ph) + 346px)" },
};

export default function PhotoViewer({ web, photos: own, title = 'Photo wall', label = 'Highlight', count = 'Highlights', start = 0, closing, onClose }) {
  const wall = useEdition().photos, photos = own || wall; // default: the edition's photo wall
  const L = web ? WEB : PHONE, n = photos.length;
  const shapes = usePhotoShapes(0.2, 5, photos);
  const { cur, go, dx, dragging, prog, nb, handlers } = useGallery(n, start, { width: L.W, ...L.drag });
  useEffect(() => { lockScroll(); return unlockScroll; }, []);
  const strip = useRef(null), first = useRef(true);
  const dialog = useRef(null);
  useDialogA11y(!closing, dialog, onClose, 'button[aria-label="Close photos"]'); // focus in, Esc, Tab kept inside, focus back on the photo that opened it
  useEffect(() => { // the thumbnails follow along, keeping the current one in the middle (when they don't all fit)
    const el = strip.current, t = el?.children[cur];
    if (!t) return;
    el.scrollTo({ left: t.offsetLeft + t.offsetWidth / 2 - el.clientWidth / 2, behavior: first.current || calm() ? 'auto' : 'smooth' });
    first.current = false;
  }, [cur]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowLeft') go(cur - 1); else if (e.key === 'ArrowRight') go(cur + 1); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [cur]);

  const tr = dragging ? 'none' : `transform 420ms ${EASE}, opacity 420ms ${EASE}`;
  const button = { padding: "0", background: "var(--card)", border: "2px solid var(--page)", display: "flex", alignItems: "center", justifyContent: "center" };
  const arrow = (dir, style) => {
    const off = dir === 'left' ? cur === 0 : cur === n - 1;
    return (
      <button className={L.press} onClick={() => go(dir === 'left' ? cur - 1 : cur + 1)} disabled={off} aria-label={dir === 'left' ? 'Previous photo' : 'Next photo'} style={{ "--c": "var(--amber)", ...button, ...style, opacity: off ? 0.3 : 1 }}>
        <ChevronIcon dir={dir} size={web ? 24 : 20} />
      </button>
    );
  };
  const dots = (
    <div aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: L.dots.gap }}>
      {photos.map((p, i) => {
        // the active dot is a pill that hands over to its neighbour while dragging
        const d = L.dots, w = i === cur ? d.on - (d.on - d.off) * Math.abs(prog) : i === nb ? d.off + (d.on - d.off) * Math.abs(prog) : d.off;
        const lit = (i === cur && Math.abs(prog) < 0.5) || (i === nb && Math.abs(prog) >= 0.5);
        return <span key={i} style={{ display: "block", height: `${d.h}px`, width: `${w}px`, borderRadius: "4px", background: lit ? 'var(--yellow)' : 'var(--muted)', transition: dragging ? 'none' : `width 420ms ${EASE}, background-color 200ms ease` }} />;
      })}
    </div>
  );
  const track = (
    <div className="gal-track" style={{ display: "flex", width: `${n * L.W}px`, height: "100%", transform: `translate3d(${-cur * L.W + dx}px, 0, 0)`, transition: tr, willChange: "transform" }}>
      {photos.map((p, i) => (
        <div key={i} className="gal-slide" aria-hidden={i === cur ? 'false' : 'true'} style={{ width: `${L.W}px`, flexShrink: "0", boxSizing: "border-box", ...L.slide, transform: `scale(${i === cur ? 1 : L.dim[0]})`, opacity: i === cur ? 1 : L.dim[1], transition: tr }}>
          <figure style={{ position: "relative", margin: web ? "0" : "0 auto", width: p.photo ? "fit-content" : web ? "760px" : "auto", maxWidth: web ? "1000px" : "100%", transform: `rotate(${L.tilts[i % L.tilts.length]})` }}>
            <div style={{ position: "absolute", left: "50%", background: "var(--peg)", border: "1.5px solid var(--ink)", boxSizing: "border-box", zIndex: "2", ...L.peg }} />
            <div style={{ background: "var(--card)", border: "2px solid var(--ink)", ...L.print }}>
              {p.photo
                ? <img src={p.photo} alt={p.caption} draggable="false" style={{ display: "block", ...(shapes[i] ? { width: `min(${L.maxW}px, calc(var(--ph) * ${shapes[i]}))`, height: "auto", aspectRatio: String(shapes[i]) } : { width: "auto", height: "var(--ph)", maxWidth: "100%" }), objectFit: "contain" }} />
                : <div style={{ height: "var(--ph)", background: p.tint, display: "flex", alignItems: "center", justifyContent: "center", fontSize: L.emptyFont, color: "var(--page)" }}>{`[photo ${i + 1}]`}</div>}
              <figcaption style={{ width: "0", minWidth: "100%", boxSizing: "border-box", padding: web ? "14px 4px 16px" : "10px 2px 12px", ...(web && { display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: "20px" }) }}>
                <div style={{ fontFamily: FONT.hand, lineHeight: "1.1", color: "var(--ink)", ...L.caption }}>{p.caption || "[caption — what's happening here]"}</div>
                <div style={{ marginTop: web ? undefined : "4px", fontFamily: FONT.mono, textTransform: "uppercase", color: "var(--muted)", ...L.place }}>{`${label} ${pad2(i + 1)}${p.place ? ` · ${p.place}` : ''}`}</div>
              </figcaption>
            </div>
          </figure>
        </div>
      ))}
    </div>
  );

  return (
    <div ref={dialog} className={`${L.cls} ${closing ? 'viewer-out' : 'viewer-in'}`} role="dialog" aria-modal="true" aria-label={`${title}: photos`} style={{ position: "fixed", left: "0", right: "0", top: "0", margin: "0 auto", width: `${L.W}px`, zIndex: "90", background: "var(--ink)", color: "var(--page)" }}>
      <div style={{ position: "absolute", fontFamily: FONT.serif, lineHeight: "1", ...L.title }}>{title}</div>
      <div style={{ position: "absolute", fontFamily: FONT.mono, color: "var(--labelDark)", textTransform: "uppercase", ...L.count }}>{count} ·{" "}<span style={{ color: "var(--yellow)" }}>{pad2(cur + 1)}</span>{" "}{`/ ${pad2(n)}`}</div>
      <button className={L.press} onClick={onClose} aria-label="Close photos" style={{ "--c": "var(--amber)", position: "absolute", ...button, ...L.close }}>
        <CloseIcon size={L.closeIcon} />
      </button>
      {web ? (
        <div className="viewer-stage" style={{ position: "absolute", left: "0", width: "1440px", ...L.stage }}>
          <div {...handlers} style={{ position: "absolute", inset: "0", overflow: "hidden", touchAction: "pan-y", cursor: dragging ? "grabbing" : "grab", userSelect: "none" }}>{track}</div>
          {arrow('left', { position: "absolute", left: "200px", top: "calc((var(--ph) + 170px) / 2 - 32px)", width: "64px", height: "64px", boxShadow: "5px 5px 0 var(--amber)", zIndex: "3" })}
          {arrow('right', { position: "absolute", right: "200px", top: "calc((var(--ph) + 170px) / 2 - 32px)", width: "64px", height: "64px", boxShadow: "5px 5px 0 var(--amber)", zIndex: "3" })}
        </div>
      ) : (
        <>
          <div className="viewer-stage" {...handlers} style={{ position: "absolute", left: "0", width: "390px", overflow: "hidden", touchAction: "pan-y", ...L.stage }}>{track}</div>
          <div className="viewer-bits" style={{ position: "absolute", left: "20px", top: "calc(var(--ph) + 274px)", width: "350px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {arrow('left', { width: "48px", height: "48px", flexShrink: "0", boxShadow: "4px 4px 0 var(--amber)", transition: "opacity 200ms ease" })}
            {dots}
            {arrow('right', { width: "48px", height: "48px", flexShrink: "0", boxShadow: "4px 4px 0 var(--amber)", transition: "opacity 200ms ease" })}
          </div>
        </>
      )}
      {web && <div className="viewer-bits" style={{ position: "absolute", left: "0", top: L.dots.top, width: "1440px" }}>{dots}</div>}
      {/* thumbnails: centred; more than fit scroll sideways, keeping the current one in the middle */}
      <div ref={strip} className="viewer-bits" style={{ position: "absolute", left: "0", top: L.thumb.top, width: `${L.W}px`, display: "flex", justifyContent: "safe center", gap: L.thumb.gap, overflowX: "auto", scrollbarWidth: "none", boxSizing: "border-box", padding: "8px 20px 6px", marginTop: "-8px" }}>
        {photos.map((p, i) => {
          const on = i === cur;
          return (
            <button key={i} onClick={() => go(i)} aria-label={`Show photo ${i + 1}`} aria-current={on ? 'true' : 'false'} style={{ flexShrink: "0", width: L.thumb.size, height: L.thumb.size, padding: L.thumb.pad, boxSizing: "border-box", background: "var(--card)", border: `2px solid ${on ? 'var(--yellow)' : 'var(--ruleDark)'}`, boxShadow: on ? '4px 4px 0 var(--amber)' : 'none', transform: `translateY(${on ? -6 : 0}px)`, opacity: on ? 1 : 0.55, transition: `transform 300ms ${EASE}, opacity 300ms ease, border-color 150ms ease` }}>
              {p.photo ? <img src={p.photo} alt="" style={{ display: "block", width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ display: "block", width: "100%", height: "100%", background: p.tint }} />}
            </button>
          );
        })}
      </div>
      {!web && <div style={{ position: "absolute", left: "0", top: "calc(var(--ph) + 442px)", width: "390px", textAlign: "center", fontFamily: FONT.hand, fontSize: "19px", color: "var(--mutedDark)" }}>swipe, or use the arrows</div>}
    </div>
  );
}
