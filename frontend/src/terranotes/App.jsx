import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react';
import { freshLoad } from './lib/freshCode.js';
import { Navigate, Route, Routes, useLocation, useParams } from './router.jsx';
import PhoneHome from './phone/PhoneHome.jsx';
import PhoneArticle from './phone/PhoneArticle.jsx';
import WebHome from './web/WebHome.jsx';
import WebArticle from './web/WebArticle.jsx';
import { EditionsPage } from './pages/EditionsPage.jsx';
import DemoPage from './pages/DemoPage.jsx';
// the AQ Labs gallery is about a third of the code: its own chunk (the embed warms it once the home page has settled)
export const loadLabs = () => import('./articles/labs/LabsPage.jsx');
const LabsPage = lazy(freshLoad(loadLabs)); // freshLoad: a page from before a deploy reloads instead of crashing
// Buddy's games (canvas games) load the first time someone opens them ('aq-games', lib/buddyState.js)
const loadGames = () => import('./shared/buddy/BuddyGames.jsx');
const BuddyGames = lazy(freshLoad(loadGames));
function Games() {
  const [first, setFirst] = useState(null);
  useEffect(() => {
    const on = (e) => setFirst((f) => f || e.detail || 'snake');
    addEventListener('aq-games', on);
    const warm = setTimeout(() => loadGames().catch(() => {}), 4000); // fetched ahead, so the first open isn't kept waiting
    return () => { clearTimeout(warm); removeEventListener('aq-games', on); };
  }, []);
  return first && <Suspense fallback={null}><BuddyGames first={first} /></Suspense>;
}
// while an article's own page loads (its code comes separately): a page-sized dark space, so nothing jumps or flashes
const Loading = () => <div aria-busy="true" style={{ minHeight: "100vh", background: "var(--ink)" }} />;
import NotFoundPage from './pages/NotFoundPage.jsx';
import ErrorBoundary from './shared/ErrorBoundary.jsx';
import { DraftTape } from './shared/Tapes.jsx';
import { HOST, AQ_LOOK } from './host.js';
import { gameLink, gameOf } from './data/games.js';
import { openGames } from './lib/buddyState.js';
import AqNavSlot from './shared/AqNavSlot.jsx';
import { setPageSwap } from './lib/animatedHistory.js';
import { pageSwap } from './lib/pageSwap.js';
import { ALL_ARTICLES } from './data/articles.js';
import { LATEST, articleFolder, articleLink, editionById, editionLink, editionOf, homeLink, isDraft } from './data/editions.js';
import { editionData } from './editions/index.js';
import { OWN_PAGES, EDITION_CSS } from './editions/pages.js';
import { EditionContext, applyLook } from './lib/edition.js';
import { useIsWeb } from './lib/layoutMode.js';
import { SECTIONS, editionAt, isDemoPath } from './lib/routes.js';
import { ScrollMemory } from './lib/scrollMemory.js';
import { track } from './lib/analytics.js';

// The routes, per layout (lib/layoutMode.js: 900px+ wide = web, else phone):
//   /                         home (PhoneHome / WebHome): the latest edition's
//   /articles /photos /words /members   the home page, opened at that section (lib/scrollMemory.js scrolls)
//   /games, /games/<id>       the latest home page with Buddy's games open at that game (data/games.js); an older
//                             edition's at /sep26/games/<id>
//   /<id>, /<id>/photos…      an older edition's home page (or a draft's), e.g. /sep26: its own look and content
//   /articles/<slug>          an article in the latest edition (PhoneArticle / WebArticle, or its own page: PAGES);
//                             `next` = the following one in its edition
//   /<id>/articles/<slug>     an article in an older edition, e.g. /sep26/articles/labs (data/editions.js). Either
//                             address of an article redirects to its current one, so links survive a new edition.
//   <article>/<chapter>       an own-page article opened at a chapter (its `chapters`), e.g. /articles/labs/photon
//   <article>/<chapter>/demo  a demo web app kept in the article's folder (its `demos`), full-window with nothing
//                             else of the site around it (pages/DemoPage.jsx), e.g. /articles/labs/wisdom-woods/demo
//   /editions                 every edition (pages/EditionsPage.jsx); old /editions/<n> redirects
//   anything else             404 (pages/NotFoundPage.jsx)
// Any address with ?by=<writer> goes to its edition's /articles?by=<writer> (that writer's articles first,
// lib/byWriter.js).
// Every page belongs to an edition (lib/routes.js editionAt: /sep26… is September's, the rest the latest's): its look
// goes on the page and its content reaches the components through useEdition() (lib/edition.js).
// Around them: the skip link, the crash card and Buddy's games popup (it outlives navigation). There is no footer.
// Inside AQ's website (src/host.js embedded; src/TerraNotesRoot.jsx mounts this) AQ draws the skip link, so this
// doesn't; on the own site, AQ's look puts a placeholder where AQ's nav will be (shared/AqNavSlot.jsx).

// page changes within the magazine animate (lib/pageSwap.js) once the magazine has loaded (lib/animatedHistory.js)
setPageSwap(pageSwap);

// Articles with their own page instead of the usual layout (an article's `page` in data/articles.js)
const PAGES = { labs: LabsPage };
// editions already counted on this page load ("Edition opened", lib/analytics.js)
const counted = new Set();
// The home page and article page to draw for an edition: its own (src/editions/pages.js), else the shared one
const SHARED = { home: { web: WebHome, phone: PhoneHome }, article: { web: WebArticle, phone: PhoneArticle } };
const pageFor = (n, kind, web) => { const k = web ? 'web' : 'phone'; return OWN_PAGES[editionData(n).id]?.[kind]?.[k] || SHARED[kind][k]; };

// A home page: / and /articles, /photos… (the latest edition's), or /sep26 and /sep26/photos… (an older edition's or a
// draft's; the latest's id goes to /). One route, so the address can change in place without a remount.
// /games and /games/<id> (data/games.js) are the home page with that game open (an older edition's: /sep26/games/<id>):
// a link to a game. The popup keeps the address in step while it's open over a home page (shared/buddy/BuddyGames.jsx).
function OpenGame({ id }) {
  useEffect(() => { const t = setTimeout(() => openGames(id || 'snake')); return () => clearTimeout(t); }, [id]); // after the games popup's listener is up
  return null;
}
function HomeRoute({ web }) {
  const { first, second, third } = useParams();
  const e = first && editionById(first), [section, game, extra] = e ? [second, third] : [first, second, third];
  if (section === 'games') { // same element as the home page below, so opening or closing a game never redraws the page
    if (extra || (game && !gameOf(game))) return <NotFoundPage web={web} />;
    if (e && e.number === LATEST) return <Navigate to={gameLink(game)} replace />;
    const n = e ? e.number : LATEST, Home = pageFor(n, 'home', web);
    return <><Home key={n} /><OpenGame id={game} /></>;
  }
  if (game || extra || (section && !SECTIONS.includes(section))) return <NotFoundPage web={web} />;
  if (e && e.number === LATEST) return <Navigate to={homeLink(LATEST, section)} replace />;
  const n = e ? e.number : LATEST, Home = pageFor(n, 'home', web);
  return <><Home key={n} /></>; // another edition's home page is a new page (fresh words game, entrance)
}

function OldEditionRoute({ web }) {
  const e = editionOf(Number(useParams().n));
  return e ? <Navigate to={editionLink(e.number)} replace /> : <NotFoundPage web={web} />;
}

// <article>, <article>/<chapter> (one route, so the address can change in place) and <article>/<chapter>/demo
function ArticleRoute({ web }) {
  const { edition, slug, '*': rest } = useParams();
  const { pathname, search, hash } = useLocation();
  const n = edition ? editionById(edition)?.number : LATEST;
  // an older edition's article at the clean address it had while it was the latest is still found (then redirected)
  const a = ALL_ARTICLES.find((x) => x.slug === slug && x.edition === n) || (!edition && ALL_ARTICLES.findLast((x) => x.slug === slug && !isDraft(x.edition)));
  const [chapter, demo, more] = (rest || '').split('/').filter(Boolean);
  const ok = a && !more && (!chapter || (a.chapters?.includes(chapter) && (!demo || (demo === 'demo' && a.demos?.[chapter]))));
  if (!ok) return <NotFoundPage web={web} />;
  const here = [articleLink(a), chapter, demo].filter(Boolean).join('/');
  if (pathname !== here) return <Navigate to={here + search + hash} replace />;
  if (demo) return <DemoPage src={`${articleFolder(a)}/${a.demos[chapter]}/`} name={chapter.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} />;
  const key = articleLink(a); // remount per article so its entrance replays
  if (a.page) { const Own = PAGES[a.page]; return <Suspense fallback={<Loading />}><Own key={key} article={a} web={web} chapter={chapter || null} /></Suspense>; }
  const Page = pageFor(a.edition, 'article', web);
  const same = ALL_ARTICLES.filter((x) => x.edition === a.edition);
  return <Page key={key} article={a} next={same[(same.indexOf(a) + 1) % same.length]} />;
}

// Puts the page's edition's look on <html> (lib/edition.js). Placed before the routes, so it runs before the page's own
// layout effects (they measure text drawn in the look's fonts).
function Look({ edition }) {
  useLayoutEffect(() => applyLook(edition), [edition]);
  const css = EDITION_CSS[edition.id]; // its look.css (src/editions/pages.js)
  return css ? <style>{css}</style> : null;
}

// "Skip to main content": hidden until focused with the keyboard; moves focus past the page's header.
function SkipLink() {
  const skip = (e) => {
    e.preventDefault();
    const main = document.querySelector('#root main') || document.querySelector('#root header')?.nextElementSibling; // <main>: pages with a bar under the header (AQ Labs). Own site only: embed-ok
    if (!main) return;
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    main.style.outline = 'none';
    main.focus();
  };
  return <a className="skip-link" href="#main" onClick={skip}>Skip to main content</a>;
}

// The phone pages are drawn inside .phone, which scales them to the window (styles/phone.css); the web pages wrap
// themselves in .web
const Zoom = ({ web, children }) => (web ? children : <div className="phone">{children}</div>);

export default function App() {
  const { pathname, search } = useLocation();
  const web = useIsWeb();
  const edition = editionData(editionAt(pathname));
  useEffect(() => { // one "Edition opened" per edition per page load: how many read each edition (drafts aren't counted)
    if (edition.draft || counted.has(edition.id)) return;
    counted.add(edition.id);
    track('Edition opened', { edition: edition.id });
  }, [edition.id, edition.draft]);
  const writers = homeLink(edition.number, 'articles'); // where ?by= lists a writer's articles first
  const toWriter = pathname !== writers && new URLSearchParams(search).get('by');
  const bare = isDemoPath(pathname); // a demo tab: the demo alone
  return (
    <EditionContext.Provider value={edition}>
      <Look edition={edition} />
      {!bare && !HOST.embedded && <SkipLink />}
      {!bare && AQ_LOOK && !HOST.embedded && <AqNavSlot />}
      <ScrollMemory />
      <ErrorBoundary resetKey={pathname}>
        {toWriter ? <Navigate to={{ pathname: writers, search }} replace /> : (
          <Zoom web={web}><Routes>
            <Route path="/editions" element={<EditionsPage web={web} />} />
            <Route path="/editions/:n" element={<OldEditionRoute web={web} />} /> {/* a route, not a file: embed-ok */}
            <Route path="/:first?/:second?/:third?" element={<HomeRoute web={web} />} />
            <Route path="/articles/:slug/*" element={<ArticleRoute web={web} />} />
            <Route path="/:edition/articles/:slug/*" element={<ArticleRoute web={web} />} />
            <Route path="*" element={<NotFoundPage web={web} />} />
          </Routes></Zoom>
        )}
      </ErrorBoundary>
      {!bare && <Games />}
      {edition.draft && !bare && <DraftTape until={edition.until} />}
    </EditionContext.Provider>
  );
}
