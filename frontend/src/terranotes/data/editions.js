import { withBase } from '../lib/base.js';

// TerraNotes comes out once a month; each edition is its own folder, src/editions/<id>/ (its look, articles, photo
// wall, words and team), so every edition keeps its own look and content for good (see CLAUDE.md "New edition").
// Newest last. The newest one that isn't a draft is the "latest" (or the one marked home: true): the home page (/)
// shows it and its articles have clean links (/articles/<slug>). Every other edition lives under its id, made from its month ('September 2026' →
// 'sep26'): its home page is /sep26 (also /sep26/photos…) and its articles /sep26/articles/<slug>. That happens by
// itself the moment a newer edition goes live (old clean links redirect). Its files live in public/editions/<id>/.
//   theme: the issue's name, shown on /editions (pages/EditionsPage.jsx)
//   home:  true = this one is the home page even though newer ones are live (they live under their ids, like older
//          ones). Delete it to let the newest take the home page again.
//   draft: true = still being made: not the latest, not listed anywhere (edition picker, /editions, sitemap), but
//          viewable at its own address (/oct26) with a "draft" tape. Delete the flag to put it live.
//   live:  when it goes live by itself. Left out: LAUNCH below, 8 pm India time on the last day of its month (October
//          2026: 31 Oct, 8 pm), so a new edition can be pushed whenever it's ready and comes out on time with nothing
//          to set. Or 'YYYY-MM-DD HH:MM' (India time; 'YYYY-MM-DD' alone = midnight) for another moment, or 'now'.
//          Until then it's a draft, as above (the edition before it stays the home page), its tape saying when it
//          goes live. Each reader's page checks the time when it loads; .github/workflows/go-live.yml rebuilds the
//          site within the hour (link previews, sitemap, page titles; on AQ's website its own copy does).

const EDITION_LIST = [
  { number: 1, month: 'September 2026', theme: 'Exam season' },
  { number: 2, month: 'October 2026', theme: 'Pujo & Diwali', live: '2026-10-31 17:45' },
];

// an edition's launch, unless its `live` says otherwise: at this time (India time) on the last day of its month
export const LAUNCH_TIME = '20:00';
const lastDay = (month) => { const d = new Date(month.replace(' ', ' 1, ')); return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)).toISOString().slice(0, 10); };
// its launch as 'YYYY-MM-DD HH:MM' (India time), or null for live: 'now'
export const launchOf = (e) => (e.live === 'now' ? null : e.live || `${lastDay(e.month)} ${LAUNCH_TIME}`);
// its launch as a time (UTC+5:30 is India time); 0 for live: 'now'
export const liveAt = (e) => {
  const when = launchOf(e);
  if (!when) return 0;
  const [day, time = '00:00'] = when.trim().split(/[ T]+/);
  const t = Date.parse(`${day}T${time}:00+05:30`);
  if (Number.isNaN(t)) throw new Error(`data/editions.js: ${e.month} has live: '${e.live}', which isn't 'YYYY-MM-DD HH:MM' or 'now'`);
  return t;
};
// an edition whose launch hasn't come is a draft until it does (`until`: its launch, for its tape)
export const EDITIONS = EDITION_LIST.map((e) => (liveAt(e) > Date.now() ? { ...e, draft: true, until: launchOf(e) } : e));

export const PUBLISHED = EDITIONS.filter((e) => !e.draft);
export const LATEST = (PUBLISHED.find((e) => e.home) || PUBLISHED[PUBLISHED.length - 1]).number;
export const editionOf = (n) => EDITIONS.find((e) => e.number === n);
export const isDraft = (n) => !!editionOf(n)?.draft;
export const editionName = (n) => `Edition ${String(n).padStart(2, '0')}`;
// the main page's title (tab, search results, link previews): it names the issue that's on it
export const homeHeadline = () => `TerraNotes · ${PUBLISHED.find((e) => e.number === LATEST).month} issue · Aquaterra`;
export const editionId = (n) => { const [m, y] = editionOf(n).month.split(' '); return m.slice(0, 3).toLowerCase() + y.slice(2); };
export const editionById = (id) => EDITIONS.find((e) => editionId(e.number) === id);
export const editionLink = (n) => (n === LATEST ? '/' : `/${editionId(n)}`);
// an edition's home page opened at a section ('articles', 'photos', 'words', 'members'): /photos, /sep26/photos
export const homeLink = (n, section) => (n === LATEST ? `/${section || ''}` : `/${editionId(n)}${section ? `/${section}` : ''}`);
export const articleLink = (a) => `${a.edition === LATEST ? '' : `/${editionId(a.edition)}`}/articles/${a.slug}`;
// an article's folder of files (cover.jpg, cover-card.webp, its photos): public/editions/<id>/articles/<slug>/, as a URL
// (inside AQ's website under its /terranotes: lib/base.js)
export const articleFolder = (a) => withBase(`/editions/${editionId(a.edition)}/articles/${a.slug}`);
// the link-preview pictures (1200×630, made by tools/make-link-previews.mjs), all kept together in public/og/: the main
// page's (home-oct26.jpg: one per edition, as the main page looked while it was the latest, so a scheduled edition's
// stays unseen until it's live), each edition's (sep26.jpg) and each article's (sep26-labs.jpg), as URLs (inside AQ: under /terranotes)
export const ogImage = {
  home: (n = LATEST) => withBase(`/og/home-${editionId(n)}.jpg`),
  edition: (n) => withBase(`/og/${editionId(n)}.jpg`),
  article: (a) => withBase(`/og/${editionId(a.edition)}-${a.slug}.jpg`),
  games: (n) => withBase(`/og/${editionId(n)}-games.jpg`), // an edition's /games: Buddy's three games on its paper
  game: (id, n) => withBase(`/og/${editionId(n)}-game-${id}.jpg`), // its /games/snake, /games/float, /games/fling
};
