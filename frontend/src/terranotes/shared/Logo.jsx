import { withBase } from '../lib/base.js';
import { FONT } from '../styles/fonts.js';

// The Aquaterra logo: globe + the AQUATERRA wordmark image, with "TerraNotes" under the wordmark.
// Sizes in px: globe, word (wordmark height), sub (TerraNotes size). dark = on the black phone menu.
export default function Logo({ globe, word, sub, dark }) {
  return (
    <>
      <img src={withBase('/brand/aquaterra-globe.webp')} alt="" width={globe} height={globe} style={{ display: "block", width: `${globe}px`, height: `${globe}px` }} />
      <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
        <img className={dark ? 'wordmark-img on-dark' : 'wordmark-img'} src={withBase('/brand/aquaterra-wordmark.webp')} alt="Aquaterra" width={Math.round(word * 6.65)} height={word} style={{ display: "block", height: `${word}px`, width: "auto" }} />
        <span style={{ fontFamily: FONT.serif, fontStyle: "italic", fontSize: `${sub}px`, lineHeight: "1", color: dark ? "var(--page)" : "var(--text)" }}>TerraNotes</span>
      </span>
    </>
  );
}
