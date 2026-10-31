import { EDITIONS, editionId, editionName } from '../data/editions.js';
import { withBase } from '../lib/base.js';
import { pickPhotos } from '../lib/photoPick.js';
import * as sep26 from './sep26/index.js';
import * as oct26 from './oct26/index.js';

// Every edition's own folder, src/editions/<id>/ (look.js, articles.js, photos.js, words.js, team.js, gathered by its
// index.js). A new edition: copy the latest folder, add it here and to EDITIONS (data/editions.js). CLAUDE.md, "New
// edition".
const FOLDERS = { sep26, oct26 };

const folderOf = (e) => {
  const f = FOLDERS[editionId(e.number)];
  if (!f) throw new Error(`${editionName(e.number)} has no folder: add src/editions/${editionId(e.number)}/ to src/editions/index.js`);
  return f;
};

// The data writes file paths from the site's root ('/editions/sep26/…', '/team/aarav.webp'); here they become real URLs
// (inside AQ's website, under its /terranotes: lib/base.js), so every page, build script and tool gets them right.
const block = (b) => (b && typeof b === 'object' && (b.photo || b.photos)
  ? { ...b, ...(b.photo && { photo: withBase(b.photo) }), ...(b.photos && { photos: b.photos.map((p) => ({ ...p, photo: withBase(p.photo) })) }) }
  : b);
const member = (m) => ({ ...m, photo: withBase(m.photo), ...(m.flip && { flip: withBase(m.flip) }), ...(m.badge && { badge: { ...m.badge, img: withBase(m.badge.img) } }) });

// Every article in every edition, edition by edition, each marked with its edition's number (`edition`).
export const ALL_ARTICLES = EDITIONS.flatMap((e) => folderOf(e).ARTICLES.map((a) => ({ ...a, edition: e.number, cover: withBase(a.cover), body: a.body.map(block) })));

// Mistakes that would only show as a broken page stop the build instead.
// TAKEN: the names the code gives its own CSS variables (style keys and CSS rules starting with --); a colour can't use
// one, it would clash (as --card once did with the phone menu's card height). Add any new one here.
const TAKEN = ['c', 'd', 'a', 'r', 's', 't', 'k', 'vh', 'ph', 'tc', 'sh', 'lift', 'wind', 'title', 'spring', 'settle', 'pop', 'ox', 'gap', 'foot', 'flap', 'core', 'cardH', 'web-zoom'];
const [first] = EDITIONS;
for (const e of EDITIONS) {
  const f = folderOf(e), name = `${editionName(e.number)} (src/editions/${editionId(e.number)}/)`;
  for (const part of ['colors', 'fonts']) {
    const missing = Object.keys(folderOf(first).LOOK[part]).filter((k) => !(k in f.LOOK[part]));
    if (missing.length) throw new Error(`${name}: look.js has no ${part} ${missing.join(', ')}`);
  }
  const taken = Object.keys(f.LOOK.colors).filter((k) => TAKEN.includes(k));
  if (taken.length) throw new Error(`${name}: look.js colour names already used for other CSS variables: ${taken.join(', ')}`);
  for (const a of f.ARTICLES) if (!f.TAGS[a.tag]) throw new Error(`${name}: article "${a.slug}" has tag "${a.tag}", which isn't in its TAGS`);
}

// Everything one edition's pages show: { number, month, draft, id, look, tags, articles, photos, words, teams, members,
// intro }. The pages get the one they belong to from useEdition() (lib/edition.js).
const DATA = new Map(EDITIONS.map((e) => {
  const f = folderOf(e);
  return [e.number, { ...e, id: editionId(e.number), look: f.LOOK, tags: f.TAGS, articles: ALL_ARTICLES.filter((a) => a.edition === e.number), photos: pickPhotos(editionId(e.number), f.PHOTOS.map((p) => ({ ...p, photo: withBase(p.photo) })), f.SHOW), words: f.WORDS, teams: f.TEAMS, members: f.MEMBERS.map(member), intro: f.INTRO }];
}));
export const editionData = (n) => DATA.get(n);
