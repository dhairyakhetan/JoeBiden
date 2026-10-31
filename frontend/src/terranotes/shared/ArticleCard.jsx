import { Link } from '../router.jsx';
import ImageSlot from './ImageSlot.jsx';
import { ByTape, Clip, FeaturedTape } from './Tapes.jsx';
import { placeOf, tagOf } from '../data/articles.js';
import { articleLink } from '../data/editions.js';
import { pad2 } from '../lib/format.js';
import { flight } from '../lib/cardFlight.js';
import { coverFloor, useFitTitle } from '../lib/fitTitle.js';
import { FONT } from '../styles/fonts.js';

// Cards load the 480px cover-card.webp beside cover.jpg (tools/make-card-covers.mjs), not the 900px+ original; the
// original if that copy is missing.
export const cardCover = (src) => (typeof src === 'string' && src.endsWith('/cover.jpg') ? src.replace(/cover\.jpg$/, 'cover-card.webp') : src);
// the article page's cover: the WebP copies (tools/make-card-covers.mjs) as a srcset, the browser picking by screen
export const coverSet = (src) => (typeof src === 'string' && src.endsWith('/cover.jpg') ? `${cardCover(src)} 480w, ${src.replace(/cover\.jpg$/, 'cover-page.webp')} 900w` : undefined);

// The article card: clip on top, cover, tag pill + "01 / 08", title, dek. White, 2px ink border, hard shadow
// (yellow + "★ featured" tape when featured). Links to the article; the click is remembered so the cover can fly
// out of the card (lib/cardFlight.js). A long title shortens the cover (to 60%) then shrinks (to 70%) to fit.
// look: 'phone' (size from the caller: style width/height + imgH/titleSize/dekSize), 'web' (the 172×272 card on the
// web article line), 'webNext' (the 340×460 "next on the line" card, with an author / read-time footer).
// mark = a writer's name → their "by …" tape.
const LOOKS = {
  phone: { clip: [24, 9, '-6px'], pad: 8, gap: 7, shadow: 6, pill: '8.5px', pillPad: '3px 8px', lh: '1.2', shrink: 1, num: '9px', sep: ' / ', icon: 18, iconFont: '11px' },
  web: { w: 172, h: 272, img: 108, title: 16, dek: 16, clip: [28, 10, '-7px'], pad: 10, gap: 9, shadow: 6, pill: '10px', pillPad: '3px 9px', lh: '1.3', shrink: 0.85, num: '10px', sep: '/', icon: 22, iconFont: '12px' },
  webNext: { w: 340, h: 460, img: 200, title: 28, dek: 21, clip: [32, 10, '-7px'], pad: 12, gap: 12, shadow: 8, pill: '11px', pillPad: '3px 9px', lh: '1.3', shrink: 0.85, num: '11px', sep: ' / ', icon: 22, iconFont: '12px', footer: true },
};

// The tag's coloured pill. fit: a long tag tightens (and, web cards, shrinks by `shrink`) before it can reach the
// number beside it; ellipsis as a last resort.
export function TagPill({ a, size, pad, lh, fit, shrink = 1 }) {
  const t = tagOf(a), long = fit && a.tag.length > 11;
  return <span style={{ background: t.color, color: t.ink, fontFamily: FONT.mono, fontWeight: "700", fontSize: long ? `${parseFloat(size) * shrink}px` : size, letterSpacing: long ? "0.2px" : "1px", textTransform: "uppercase", padding: pad, borderRadius: "999px", lineHeight: lh, ...(fit && { minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }) }}>{a.tag}</span>;
}

// Tag pill and "01 / 08" (the article's place in its edition), one row.
export function TagRow({ a, look = 'phone' }) {
  const L = LOOKS[look], { i, n } = placeOf(a);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", flexShrink: "0" }}>
      <TagPill a={a} size={L.pill} pad={L.pillPad} lh={L.lh} fit shrink={L.shrink} />
      <span style={{ fontFamily: FONT.mono, fontSize: L.num, letterSpacing: "1px", color: "var(--ink)", whiteSpace: "nowrap", flexShrink: "0" }}>{`${pad2(i + 1)}${L.sep}${pad2(n)}`}</span>
    </div>
  );
}

export default function ArticleCard({ article: a, look = 'phone', mark, className, style, imgH, titleSize, dekSize }) {
  const L = LOOKS[look];
  const img = parseFloat(imgH ?? L.img), titlePx = parseFloat(titleSize ?? L.title), dekPx = parseFloat(dekSize ?? L.dek);
  const title = useFitTitle(a.title, titlePx, titlePx * 0.7);
  const [cw, ch, ctop] = L.clip;
  return (
    <Link to={articleLink(a)} className={className ?? (L.w ? 'card-link' : undefined)} {...flight(a)}
      style={{ ...(L.w && { position: "absolute", left: "0", top: "0", width: `${L.w}px`, height: `${L.h}px` }), ...style, display: "block", textDecoration: "none", color: "var(--ink)" }}>
      {mark && <ByTape name={mark} />}
      {a.featured && <FeaturedTape />}
      <Clip color={tagOf(a).color} w={cw} h={ch} top={ctop} />
      <article style={{ width: "100%", height: "100%", boxSizing: "border-box", background: "var(--card)", border: "2px solid var(--ink)", boxShadow: `${L.shadow}px ${L.shadow}px 0 ${a.featured ? "var(--yellow)" : "var(--ink)"}`, padding: `${L.pad}px`, display: "flex", flexDirection: "column", gap: `${L.gap}px`, overflow: "hidden" }}>
        <ImageSlot src={cardCover(a.cover)} fallback={a.cover} alt={a.alt} first={placeOf(a).i < 6} box={{ height: `${img}px`, minHeight: coverFloor(img) }} icon={L.icon} font={L.iconFont} />
        <TagRow a={a} look={look} />
        <h3 ref={title} style={{ flexShrink: "0", margin: "0", fontFamily: FONT.head, fontWeight: "400", fontSize: `${titlePx}px`, lineHeight: "calc(0.95 * var(--head-lead, 1))", letterSpacing: "-0.3px", textTransform: "uppercase", color: "var(--ink)" }}>{a.title}</h3>
        <p style={{ flexShrink: "0", margin: "0", fontFamily: FONT.hand, fontSize: `${dekPx}px`, lineHeight: "1.1", color: "var(--dek)" }}>{a.dek}</p>
        {L.footer && (
          <div style={{ flexShrink: "0", marginTop: "auto", display: "flex", justifyContent: "space-between", fontFamily: FONT.mono, fontSize: "11px", letterSpacing: "1px", textTransform: "uppercase" }}>
            <span>{a.author === null ? 'Aquaterra' : a.author || '[Author]'}</span>
            <span>{`${a.readTime || '[x]'} min read →`}</span>
          </div>
        )}
      </article>
    </Link>
  );
}
