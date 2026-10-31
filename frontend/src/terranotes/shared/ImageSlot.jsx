import { PhotoIcon } from './Icons.jsx';

// A picture filling its slot (cropped to fit, top kept in view: covers put their titles there), or, with no src yet,
// the design's dashed placeholder showing `label`. box = the slot's size styles; dark = placeholder colours for dark
// cards; icon / font = placeholder icon and label sizes. fallback = a picture to show instead if src fails to load (once).
// While a picture is on its way the slot shows the placeholder's quiet fill, not white. first = it's on screen as the
// page opens (fetched first, ahead of everything else); otherwise it's fetched as it nears the screen. srcSet / sizes:
// other sizes of the picture, for the browser to pick from (the article covers: ArticleCard.jsx coverSet).
const fallBack = (to) => (e) => { const img = e.currentTarget; if (!img.dataset.fell) { img.dataset.fell = '1'; img.removeAttribute('srcset'); img.src = to; } };
export default function ImageSlot({ src, srcSet, sizes, fallback, alt, label = alt, box, dark, icon = 18, font = '11px', first }) {
  if (src) return <img src={src} srcSet={srcSet} sizes={srcSet ? sizes : undefined} alt={alt} decoding="async" loading={first ? 'eager' : 'lazy'} fetchPriority={first ? 'high' : undefined} onError={fallback ? fallBack(fallback) : undefined} style={{ background: dark ? "var(--slotDark)" : "var(--blank)", objectPosition: "50% 12%", ...box, display: "block", width: box.width || "100%", boxSizing: "border-box", objectFit: "cover" }} />;
  const ink = dark ? "var(--slotDarkInk)" : "var(--slotInk)";
  return (
    <div style={{ ...box, background: dark ? "var(--slotDark)" : "var(--blank)", border: `1.5px dashed ${dark ? "var(--slotDarkLine)" : "var(--slotLine)"}`, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: font, color: ink }}>
      <PhotoIcon size={icon} color={ink} />
      <span>{label}</span>
    </div>
  );
}
