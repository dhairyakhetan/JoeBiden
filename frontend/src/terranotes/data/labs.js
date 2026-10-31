// The AQ Labs gallery's teams (the "labs" article's own page, src/articles/labs/), in chapter order.
//   id:    the chapter's address, /articles/labs/<id> (photos: public/editions/<edition>/articles/labs/<id>/).
//          data/articles.js lists them as the article's chapters.
//   name:  the project's name (the "all projects" list); label: on its tab and book (a long one folds onto two lines
//          on the book's spine, at the |)
//   c / tc: its colour and the text colour that sits on it (the AQ Labs team's own palette)
//   glyph, cat: the book's symbol and the project's category
export const LABS_TEAMS = [
  { id: 'karyaarth', name: 'Karyaarth', label: 'karyaarth', c: '#FF4D2E', tc: '#111111', glyph: '★', cat: 'documentary' },
  { id: 'career-compass', name: 'Career Compass', label: 'career|compass', c: '#3DA9FC', tc: '#111111', glyph: '◆', cat: 'career data' },
  { id: 'quirk', name: 'Quirk', label: 'quirk', c: '#FF4D8C', tc: '#111111', glyph: '✦', cat: 'hardware' },
  { id: 'wisdom-woods', name: 'Wisdom Woods', label: 'wisdom|woods', c: '#1B8A5A', tc: '#F3EEE4', glyph: '♥', cat: 'ed-game' },
  { id: 'cirqle', name: 'Cirqle Rentals', label: 'cirqle|rentals', c: '#FFC700', tc: '#111111', glyph: '◆', cat: 'rentals' },
  { id: 'hunar', name: 'Hunar', label: 'hunar', c: '#7E5BFF', tc: '#F3EEE4', glyph: '★', cat: 'placement' },
  { id: 'photon', name: 'Photon', label: 'photon', c: '#3DA9FC', tc: '#111111', glyph: '✦', cat: 'wearable' },
  { id: 'human-manual', name: 'Human Manual', label: 'human|manual', c: '#FF4D8C', tc: '#111111', glyph: '♠', cat: 'card game' },
];
