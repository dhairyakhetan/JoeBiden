// The font stacks, for inline styles: CSS variables set from the edition's look (src/editions/<id>/look.js fonts,
// lib/edition.js), so each edition can have its own type. What each is for: CLAUDE.md.
export const FONT = {
  head: 'var(--font-head)', // headings, titles, big numbers (always uppercase)
  mono: 'var(--font-mono)', // labels, meta lines, buttons (uppercase, letter-spaced)
  hand: 'var(--font-hand)', // handwritten notes, deks, captions
  serif: 'var(--font-serif)', // "Photo wall", "TerraNotes", the intro headline
  body: 'var(--font-body)', // UI body text
  read: 'var(--font-read)', // article paragraphs
  script: 'var(--font-script)', // a neat copperplate script (September's diary under "Meet the team")
};
