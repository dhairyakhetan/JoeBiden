// Buddy's mini games (shared/buddy/BuddyGames.jsx), the same in every edition: what the games card (shared/GameCard.jsx)
// says about each, and what its own address shows in a link preview. Each game has an address in every edition that
// opens it on that edition's home page: /games/<id> (the latest's), /sep26/games/<id> (an older one's); /games opens the
// first. build/siteFiles.js writes their pages and tools/make-link-previews.mjs their pictures, on each edition's paper
// (public/og/<edition id>-game-<id>.jpg, <edition id>-games.jpg).
//   id     the game's key (the popup's tabs, the address)          name   its tab label
//   title  the games card's heading                                line   its one-line how-to
//   about  a sentence for link previews and search results          hint   the popup's line beside the tabs
// An edition can rename and re-describe them (OWN, with the same fields): October plays Snake as Durga Maa chasing
// demons and Fling as a bow and arrow (their drawings: src/editions/pages.js GAME_SKIN). gamesFor(id) gives an
// edition's list.
import { LATEST, editionId } from './editions.js';

export const GAMES = [
  { id: 'snake', name: 'Snake', title: 'Snake, but spooky', line: 'eat the stars. don’t eat yourself.', hint: 'eat the stars', about: 'Snake with a ghost: eat the stars, don’t eat yourself. A mini game in TerraNotes, Aquaterra’s monthly magazine.' },
  { id: 'float', name: 'Float', title: 'Float, little ghost', line: 'tap to rise. mind the posts.', hint: 'mind the posts', about: 'Tap to float Buddy the ghost between the posts. A mini game in TerraNotes, Aquaterra’s monthly magazine.' },
  { id: 'fling', name: 'Fling', title: 'Fling, little ghost', line: 'pull back. let go. knock ’em down.', hint: 'knock ’em down', about: 'Fling Buddy at the gremlins’ forts, Angry Birds style: 50 levels. A mini game in TerraNotes, Aquaterra’s monthly magazine.' },
];
const OWN = {
  oct26: {
    snake: { name: 'Chase', title: 'Durga Maa, on the chase', line: 'catch the demons. don’t bite the garland.', hint: 'catch the demons', about: 'Snake with Durga Maa: chase the demons, don’t run into her marigold garland. A mini game in TerraNotes, Aquaterra’s monthly magazine.' },
    fling: { name: 'Bow', title: 'Bow and arrow', line: 'pull back. aim. knock the demons down.', hint: 'hit the demons', about: 'Draw the bow and knock down the demons’ forts, Angry Birds style: 50 levels. A mini game in TerraNotes, Aquaterra’s monthly magazine.' },
  },
};
export const gamesFor = (editionId) => GAMES.map((g) => ({ ...g, ...OWN[editionId]?.[g.id] }));
export const gameOf = (id, edId) => gamesFor(edId).find((g) => g.id === id);
// a game's address in an edition (n: its number; the latest's has no prefix)
export const gameLink = (id, n = LATEST) => `${n === LATEST ? '' : `/${editionId(n)}`}/games${id ? `/${id}` : ''}`;
