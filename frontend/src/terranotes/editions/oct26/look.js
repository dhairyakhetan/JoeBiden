// October 2026's look, "Pujo", in bright festival colours: a sunny cream page, royal-indigo ink (borders, text, hard
// shadows), hibiscus-pink handwriting, marigold strings and lights, a black photo wall, and a festive poster serif for
// headings (Rozha One). Everything is bright on purpose: no browns, no near-black (the photo wall is black at the
// owner's ask). The ribbon borders, alpana dots and the toran of marigolds are in look.css and Decor.jsx. Every colour
// and font the site's shared pieces are drawn with, by role: the pages use them as CSS variables (var(--ink),
// var(--font-head): lib/edition.js puts them on the page), so a value here restyles that role everywhere in this
// edition, and only in this edition. Every edition's look must have the same keys (src/editions/index.js).
export const LOOK = {
  colors: {
    // the palette (CLAUDE.md)
    page: '#FFFBEE', // the page: sunny cream; light text on the bright panels
    outside: '#FFEFC2', // around the page: butter yellow; quiet fills
    card: '#FFFFFF', // cards; text on ink
    cream: '#FFF4CF', // soft cream cards
    ink: '#26268F', // borders, text, hard shadows, dark fills: royal indigo
    text: '#33368F', // body text
    hand: '#D10F55', // handwriting: hibiscus pink (a notch deep enough for small text on the cream: 5:1)
    string: '#FF9F1C', // the strings things hang from: saffron
    dek: '#5256D6', // deks (the line under a title)
    wire: '#FFB84D', // the menu's wire; quiet handwritten notes
    yellow: '#FFC914', // marigold: featured, primary buttons' shadow
    red: '#F0214A', // hibiscus red, the ribbon border
    blue: '#2F6BFF', // royal blue
    green: '#12B76A', // leaf green
    purple: '#9B5CFF',
    pink: '#FF5FA2', // lotus pink
    mint: '#3DDCC4', // aqua mint
    // the photo wall
    wall: '#111111', // its panel: black
    amber: '#FFC914', // its prints' shadows and tagline: marigold lights
    wallInk: '#FFFFFF', // "[photo]" on an empty print
    mutedDark: '#D9D6FF', // its strings; small print on dark panels (photo viewer, phone menu)
    peg: '#FFD27A', // wooden pegs
    bulb: '#FFE066', // fairy-light bulbs
    spark: '#FFFBE0', // sparkles
    // dark panels (photo viewer, phone menu)
    labelDark: '#E4E2FF', // labels on dark
    ruleDark: '#7C73F5', // lines on dark
    // quieter details
    muted: '#5A62A8', // quiet grey text (5:1 on the page)
    grey: '#4E55A0', // secondary text (the words game's "/ say it /")
    bioText: '#33368F', // a member's bio on their profile card
    introLabel: '#E8115F', // "Introduction" on the home intro card
    introText: '#41469A', // the home intro card's lines
    done: '#A9AEDD', // a ticked checklist item
    rule: '#FFD95C', // thin rules: gold thread
    faint: '#EDE6C8', // faint marks
    edge: '#FFD966', // the home page's edge against the outside
    blank: '#FFF3C4', // an empty photo or face
    slotLine: '#F0CB6B', // an empty picture's dashed edge
    slotInk: '#4E55A0', // an empty picture's label and icon
    slotDark: '#3F3FD0', // the same on dark cards
    slotDarkLine: '#8C85FF',
    slotDarkInk: '#FFFFFF',
    snake: '#12B76A', // the games card's pixel snake (shared/GameCard.jsx)
  },
  // font stacks (index.html loads these from Google Fonts)
  fonts: {
    head: "'Rozha One', 'Archivo Black', Georgia, serif", // headings, titles, big numbers (always uppercase): a festive poster serif
    mono: "'Space Mono', monospace", // labels, meta lines, buttons (uppercase, letter-spaced)
    hand: "'Caveat', cursive", // handwritten notes, deks, captions
    serif: "'Instrument Serif', Georgia, serif", // "Photo wall", "TerraNotes", the intro headline
    body: "'Figtree', system-ui, sans-serif", // UI body text
    read: "'Newsreader', Georgia, serif", // article paragraphs
    script: "'Pinyon Script', 'Snell Roundhand', cursive", // a neat copperplate script (not used this month)
  },
  // a stylesheet for fonts the site doesn't serve itself, or '' (its fonts are self-hosted: src/styles/fontfaces.css)
  fontsCss: '',
  // the festive illustrations' own colours (drawn in a canvas or SVG, so they read these values, not CSS variables):
  // the games' Durga Maa and demon faces (games.js), the dhak players (DhakPlayers.jsx), the alpana and dhunuchi.
  art: {
    alta: '#C8202E', // alta red: the alpana border, the bow's grip, sindoor
    skin: '#F2BE86', // Durga Maa's face
    hair: '#1B1420',
    gold: '#F2B705', // crowns, earrings
    flame: '#FF8A1F', // diya flames, the demon's crown
    demon: '#F6D9B8', // the demon's face
    brown: '#5B3418', // his hair, brows and moustache
    wood: '#A8642C', // the bow, the dhak's shell
    clay: '#B5562C', // diyas, the dhunuchi
    smoke: '#EEEAF6', // dhunuchi smoke
    drummer: '#E9A86A', // the dhakis' skin
  },
};
