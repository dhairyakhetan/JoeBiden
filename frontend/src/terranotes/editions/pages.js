import sep26Css from './sep26/look.css?inline';
import Sep26Decor from './sep26/Decor.jsx';
import Sep26Diary from './sep26/Diary.jsx';
import { RULE as Sep26Rule, TEAM_FIT as Sep26TeamFit } from './sep26/ruled.js';
import oct26Css from './oct26/look.css?inline';
import Oct26Decor from './oct26/Decor.jsx';
import Oct26Dhakis from './oct26/festive/DhakPlayers.jsx';
import Oct26Diya from './oct26/festive/Diya.jsx';
import Oct26Alpana from './oct26/festive/Alpana.jsx';
import { Smoke as Oct26Smoke, WORD_MARKS as Oct26Marks } from './oct26/festive/Dhunuchi.jsx';
import { OCT_GAMES } from './oct26/festive/games.js';

// Pages an edition draws its own way, for a month that wants more than a new look.js: its own home page and/or article
// page, per layout. Start from a copy of the shared one (src/web/WebHome.jsx, src/phone/PhoneHome.jsx,
// src/web/WebArticle.jsx, src/phone/PhoneArticle.jsx) kept in the edition's folder, e.g. src/editions/oct26/WebHome.jsx,
// and list it here. Anything not listed uses the shared page. They read the edition with useEdition() like the shared
// ones. Kept apart from index.js: the build reads the editions' data in Node, which can't load components.
//   import Oct26WebHome from './oct26/WebHome.jsx';
//   export const OWN_PAGES = { oct26: { home: { web: Oct26WebHome } } };
// keys: edition id → { home: { web, phone }, article: { web, phone } }
export const OWN_PAGES = {};

// An edition's own decorations, beyond its look.js colours and fonts:
// - EDITION_CSS: its look.css (scoped to [data-edition="<id>"]), put on the page while one of its pages shows (App.jsx)
// - DECOR: a component drawn on its home pages' artboard ({ web }: which layout), for doodles and the like
export const EDITION_CSS = { sep26: sep26Css, oct26: oct26Css };
export const DECOR = { sep26: Sep26Decor, oct26: Oct26Decor };
// - TEAM_NOTE: a component drawn in its "Meet the team" section, web under the legend, phone beside it ({ style, size,
//   web }: where and how big, from shared/TeamSection.jsx), e.g. September's diary, October's dhak players
export const TEAM_NOTE = { sep26: Sep26Diary, oct26: Oct26Dhakis };
// - HANGERS: a little thing hung from the web article wire between the cards (web/WebArticleLine.jsx; { delay, string }),
//   e.g. October's diyas
export const HANGERS = { oct26: Oct26Diya };
// - WALL_DECOR: drawn on the photo wall's panel, behind its lights and prints ({ web, w, h }: shared/PhotoWallSection.jsx),
//   e.g. October's alpana border
export const WALL_DECOR = { oct26: Oct26Alpana };
// - WORDS_ART: the words game's dressing (shared/WordsGameSection.jsx): Cloud ({ w, h }) in place of the cloud, and
//   marks, three icons in place of the A / B / C letters (October: dhunuchi smoke; a dhunuchi, a lantern, a firework)
export const WORDS_ART = { oct26: { Cloud: Oct26Smoke, marks: Oct26Marks } };
// - GAME_SKIN: Buddy's games drawn the edition's way, same rules (shared/buddy/BuddyGames.jsx, Fling.jsx; its names in
//   data/games.js): October's Durga Maa chase (snake) and bow and arrow (fling), oct26/festive/games.js
export const GAME_SKIN = { oct26: OCT_GAMES };
// - RULED / TEAM_FIT: for an edition whose pages are ruled paper: its ruling ({ web, phone }: { start, gap, margin }),
//   which the home pages write on (lib/ruled.js useRuledPage: every [data-ruled] element), and its "Meet the team"
//   text laid out on it (overrides for shared/TeamSection.jsx's tables; the section sets its own blocks' baselines)
export const RULED = { sep26: Sep26Rule };
// - LAYOUT: newer layouts of the shared home sections, switched on per edition so an older edition keeps the one it
//   came out with. A new edition copies the newest one's entry.
//     wordsRow: the web words game puts the cloud and its answers side by side, centred on each other
//               (shared/WordsGameSection.jsx)
//     introMast: the intro card leads with "TerraNotes" in big letters, the tagline smaller under it
//               (shared/HomeIntroCard.jsx)
export const LAYOUT = { oct26: { wordsRow: true, introMast: true } };
export const TEAM_FIT = { sep26: Sep26TeamFit };
