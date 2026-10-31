// September 2026's look, "exam season": a school notebook (ruled paper with a red margin, ballpoint blue, pencil
// grey, highlighter yellow / pink / green; the ruling, punch holes and doodles are in look.css and Decor.jsx).
// Every colour and font the site's shared pieces are drawn with, by role. The pages use them as CSS variables
// (var(--ink), var(--font-head): lib/edition.js puts them on the page), so changing a value here restyles that role
// everywhere in this edition, and only in this edition. A new edition starts from a copy of this file.
// Every edition's look must have the same keys (src/editions/index.js stops the build otherwise).
export const LOOK = {
  colors: {
    // the palette (CLAUDE.md)
    page: '#F5F2E9', // the page: notebook paper; light text on dark panels
    outside: '#E4E0D5', // around the page (the desk); quiet fills
    card: '#FFFFFF', // cards; text on ink
    cream: '#FBF9F2', // soft paper cards
    ink: '#18213A', // borders, text, hard shadows, dark fills: navy-black ballpoint
    text: '#253048', // body text
    hand: '#2349B8', // handwriting: blue ballpoint
    string: '#6E747D', // the strings things hang from: pencil grey
    dek: '#344262', // deks (the line under a title)
    wire: '#9AA0A9', // the menu's wire; quiet handwritten notes
    yellow: '#FFD43B', // highlighter yellow: featured, primary buttons' shadow
    red: '#E5484D', // red pen
    blue: '#3D7BFD',
    green: '#2E9E5B',
    purple: '#7B5CE6',
    pink: '#FF6FAE', // highlighter pink
    mint: '#7FE0A6', // highlighter green
    // the photo wall
    wall: '#1C2740', // its panel: the blue-black of a blackboard
    amber: '#FFD43B', // its prints' shadows and tagline: highlighter
    wallInk: '#EDE9DD', // "[photo]" on an empty print
    mutedDark: '#8E8A7A', // its strings; small print on dark panels (photo viewer, phone menu)
    peg: '#C9A57A', // wooden pegs
    bulb: '#FFE6AE', // fairy-light bulbs
    spark: '#FFF4D6', // sparkles
    // dark panels (photo viewer, phone menu)
    labelDark: '#BDB6A6', // labels on dark
    ruleDark: '#3A3A36', // lines on dark
    // quieter details
    muted: '#6B665C', // quiet grey text
    grey: '#4A4A45', // secondary text (the words game's "/ say it /")
    bioText: '#333333', // a member's bio on their profile card
    introLabel: '#4B6647', // "Introduction" on the home intro card
    introText: '#4A524D', // the home intro card's lines
    done: '#8A8478', // a ticked checklist item
    rule: '#C8D5EE', // thin rules: the notebook's blue lines
    faint: '#CFC8B8', // faint marks
    edge: '#C9D3E6', // the home page's edge against the outside
    blank: '#F2F1ED', // an empty photo or face
    slotLine: '#B9B5AA', // an empty picture's dashed edge
    slotInk: '#444', // an empty picture's label and icon
    slotDark: '#262626', // the same on dark cards
    slotDarkLine: '#5A5A5A',
    slotDarkInk: '#CFCFCF',
    snake: '#4E9C74', // the games card's pixel snake (shared/GameCard.jsx)
  },
  // font stacks (index.html loads these from Google Fonts)
  fonts: {
    head: "'Archivo Black', Impact, sans-serif", // headings, titles, big numbers (always uppercase)
    mono: "'Space Mono', monospace", // labels, meta lines, buttons (uppercase, letter-spaced)
    hand: "'Caveat', cursive", // handwritten notes, deks, captions
    serif: "'Instrument Serif', Georgia, serif", // "Photo wall", "TerraNotes", the intro headline
    body: "'Figtree', system-ui, sans-serif", // UI body text
    read: "'Newsreader', Georgia, serif", // article paragraphs
    script: "'Pinyon Script', 'Snell Roundhand', cursive", // the diary under "Meet the team" (Diary.jsx)
  },
  // a stylesheet for fonts the site doesn't serve itself, or '' (its fonts are self-hosted: src/styles/fontfaces.css)
  fontsCss: '',
};
