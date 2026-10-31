import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from '../../router.jsx';
import PhoneHeader from '../../phone/PhoneHeader.jsx';
import { BackToMagazine } from '../../shared/InsideAQ.jsx';
import WebHeader from '../../web/WebHeader.jsx';
import PhotoViewer from '../../shared/PhotoViewer.jsx';
import { tagOf } from '../../data/articles.js';
import { articleFolder, articleLink } from '../../data/editions.js';
import { LABS_TEAMS as TEAMS } from '../../data/labs.js';
import { pad2 } from '../../lib/format.js';
import { calm } from '../../lib/motion.js';
import { FONT } from '../../styles/fonts.js';
import { usePresence } from '../../lib/usePresence.js';
import { withBase } from '../../lib/base.js';
import { byId, flag } from '../../lib/dom.js';
import { HOST, AQ_LOOK } from '../../host.js';
import labsCss from './labs.css?inline'; // with this page's chunk; a <style> beside the page (the return), so it lands in AQ's shadow root too

// The "labs" article's own page (data/articles.js: page: 'labs'): the AQ Labs gallery, built from the AQ Labs design
// (styles: ./labs.css; teams: data/labs.js; photos: this article's folder, public/editions/<id>/articles/labs/<team>/).
// Text is the teams' own, word for word. Under the site header, a strip of chapter tabs, then:
// - web (one long scroll): the intro (scattered prints, "AQ Labs", a bookshelf of the eight projects in 3D: hover a
//   book to pull it out, click to glide to its chapter), then every chapter in turn. The tab strip sticks and lights up
//   the chapter on screen; a chapter's pieces rise in the first time it's seen. Search (⌕): a find bar under the tabs
//   highlights every match on the page, Enter for the next, tabs with matches get a red dot.
// - phone (one chapter at a time): the shelf is the start; a book or a tab opens its chapter (its colour wipes up, the
//   pieces rise in), tapping the open tab goes back to the shelf. Each chapter ends in "view all projects": a sheet
//   listing all eight, with the search (it counts each chapter's matches; picking one opens it with them highlighted).
//   Every chapter stays in the page (hidden) so the search can read them all.
// Addresses: /articles/labs/<id> is a chapter (web: scrolled to it, and the address drops back to /articles/labs once
// you scroll away, lib/scrollMemory.js; phone: that chapter open, a page of its own, so Back returns to the shelf).
// Karyaarth's stills open in the site's photo viewer; Wisdom Woods' demo opens in a new tab (pages/DemoPage.jsx).

// each book on the shelf: [width, height, title size] on phone and on web
const BOOKS = {
  phone: [[72, 240, 17], [88, 248, 19], [66, 212, 22], [86, 240, 19], [86, 232, 19], [68, 218, 22], [72, 244, 22], [86, 228, 19]],
  web: [[84, 316, 22], [110, 344, 26], [80, 298, 30], [106, 336, 26], [104, 312, 26], [82, 304, 30], [88, 330, 28], [108, 322, 26]],
};
// the intro's prints: [photo, label, box, photo height] on phone (a 350×200 cluster) and on web (scattered over the intro)
const PRINTS = {
  phone: [
    ['karyaarth/still-03.webp', 'karyaarth', { left: '0', top: '40px', width: '132px', rotate: '-11deg' }, 84],
    ['quirk/breadboard.webp', 'quirk', { left: '60px', top: '6px', width: '118px', rotate: '-4deg' }, 92],
    ['photon/band.webp', 'photon', { left: '212px', top: '2px', width: '98px', rotate: '8deg' }, 118],
    ['cirqle/poster.webp', 'cirqle', { left: '252px', top: '70px', width: '98px', rotate: '15deg' }, 90],
    ['wisdom-woods/poster.webp', 'wisdom woods', { left: '108px', top: '44px', width: '150px', rotate: '3deg' }, 90],
  ],
  web: [
    ['karyaarth/still-03.webp', 'karyaarth', { left: '64px', top: '70px', width: '210px', rotate: '-8deg' }, 136],
    ['quirk/breadboard.webp', 'quirk', { left: '110px', top: '330px', width: '180px', rotate: '5deg' }, 130],
    ['karyaarth/still-06.webp', 'on the street', { left: '40px', top: '590px', width: '170px', rotate: '-5deg' }, 190],
    ['wisdom-woods/poster.webp', 'wisdom woods', { right: '70px', top: '80px', width: '220px', rotate: '7deg' }, 128],
    ['photon/band.webp', 'photon', { right: '120px', top: '350px', width: '170px', rotate: '-6deg' }, 170],
    ['cirqle/poster.webp', 'cirqle', { right: '46px', top: '620px', width: '180px', rotate: '9deg' }, 160],
  ],
};
// Karyaarth's ten stills, for the photo viewer (KA 01…10)
const STILLS = ['filming at a market stall', 'a young woman with a rose at a vegetable market', 'a vegetable seller handing over produce',
  'a woman with a rose beside her steel pots', 'a girl at a vegetable stall', 'a corn seller at his cart on a Kolkata street',
  'an ice cream seller at his cart', 'buying from the ice cream cart', 'a street food vendor smiling beside her steel pots', 'a vendor on his cycle cart'];
const TRUST = [['institute', 'highest', '100%'], ['employer', 'high', '78%'], ['portfolio', 'moderate', '52%'], ['peer', 'low', '28%'], ['self-declared', 'none', '6%']];
const SUITS = [
  ['⧖', '#FF4D8C', 'suit 01', 'Procrast­ination', 'the mechanics of later', 'procrastination'],
  ['◈', '#C99A00', 'suit 02', 'Money', 'why it felt like a personality', 'money'],
  ['◲', '#1F8FD1', 'suit 03', 'Stress & Freeze', 'the body acting without asking', 'stress and freeze'],
  ['☾', '#7E5BFF', 'suit 04', 'Impulse & Regret', 'the 2am pipeline', 'impulse and regret'],
  ['☰', '#FF7A1A', 'suit 05', 'Stories You Tell', 'the lies with good PR', 'stories you tell'],
];
const OUT = { target: '_blank', rel: 'noreferrer' };
const behavior = () => (calm() ? 'auto' : 'smooth');
const folded = (label) => label.split('|').map((part, i) => <Fragment key={i}>{i > 0 && <br />}{part}</Fragment>);

// ---- search: every text match inside `root`, as Ranges. Text nodes in one block are read as one string, so a match
// can run across inline pieces; blocks are kept apart.
const BLOCK = 'p,h1,h2,li,figcaption,a,button,span.m,span.nm,span.sb,span.k,span.l,span.n,div';
function findAll(root, query) {
  const q = query.trim().toLowerCase();
  if (!q || !root) return [];
  const nodes = [], starts = [];
  let text = '', block = null;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement.closest('[aria-hidden="true"]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const b = n.parentElement.closest(BLOCK);
    if (b !== block) { text += '\u0000'; block = b; }
    nodes.push(n); starts.push(text.length); text += n.data.toLowerCase();
  }
  const at = (i) => { let k = starts.length - 1; while (starts[k] > i) k--; return k; }; // the node holding character i
  const out = [];
  for (let i = text.indexOf(q); i !== -1; i = text.indexOf(q, i + q.length)) {
    const a = at(i), b = at(i + q.length - 1), r = new Range();
    r.setStart(nodes[a], i - starts[a]);
    r.setEnd(nodes[b], i + q.length - starts[b]);
    out.push(r);
  }
  return out;
}
const HL = typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight === 'function';
const unmark = () => { if (HL) { CSS.highlights.delete('labs-find'); CSS.highlights.delete('labs-find-now'); } };
const mark = (ranges) => { if (HL) CSS.highlights.set('labs-find', new Highlight(...ranges)); };
// bring one match into view: brighter mark, scrolled to the middle of the window
function showMatch(r) {
  if (!r || !r.startContainer.isConnected) { if (HL) CSS.highlights.delete('labs-find-now'); return; }
  if (HL) CSS.highlights.set('labs-find-now', new Highlight(r));
  const el = r.startContainer.parentElement;
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: behavior() });
  if (!HL) { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); }
}

// ---- small shared pieces
const Meta = ({ web, k, t, color, dim }) => (
  <div className="rule-row">
    <span className="m" style={{ fontSize: web ? "12px" : "11px", color, display: "flex", alignItems: "center", gap: web ? "9px" : "8px" }}>{k}</span>
    <span className="m" style={{ fontSize: web ? "11px" : "10px", color: dim }}>{t}</span>
  </div>
);
const Ext = ({ href, children, style }) => <a className="lbtn" href={href} {...OUT} style={style}>{children} ↗</a>;
const Browser = ({ href, url, img, pos, h, blank, style, bb }) => (
  <a className="browser" href={href} {...(blank ? OUT : {})} style={style}>
    <span className="bb" style={bb}><i /><i /><i /><span className="url">{url}</span></span>
    <img src={img.src} alt={img.alt} loading="lazy" decoding="async" style={{ width: "100%", height: `${h}px`, objectFit: "cover", objectPosition: pos }} />
  </a>
);
const Play = ({ size, fill }) => <svg width={size} height={size * 1.1} viewBox="0 0 22 24" aria-hidden="true"><path d="M3 2 L20 12 L3 22 Z" fill={fill} /></svg>;

// A book on the shelf (labs.css "the bookshelf"): the slot is the link; the book inside it is what moves (pressed: it
// sinks into the shelf for a moment before its chapter opens)
function Book({ t, i, size: [w, h, fs], web, href, onClick, pressed, ox }) {
  const rib = web ? [18, 56, 20, 56] : [14, 42, 16, 42];
  return (
    <a className={pressed ? 'bslot pressed' : 'bslot'} href={href} onClick={onClick} style={{ '--ox': `${ox}px` }} aria-label={`${pad2(i + 1)} ${t.name}`}>
      <span className="book" style={{ '--c': t.c, '--tc': t.tc, width: `${w}px`, height: `${h}px` }}>
        <i className="ft" /><i className="fl" /><i className="fr" /><i className="fb" />
        <span className="sp">
          <i className="rib" style={{ top: `${rib[0]}px` }} /><i className="rule" style={{ top: `${rib[1]}px` }} />
          <i className="rib" style={{ bottom: `${rib[2]}px` }} /><i className="rule" style={{ bottom: `${rib[3]}px` }} />
          <span className="gl" aria-hidden="true">{t.glyph}</span>
          <span className="lab"><span className="ti" style={{ fontSize: `${fs}px` }}>{folded(t.label)}</span></span>
        </span>
      </span>
    </a>
  );
}

// The chapter tabs, a floating pill (as on AQ's website). active = the chapter lit
function Tabs({ web, active, base, onTab }) {
  return (
    <nav className="lb-tabs" aria-label="Chapters">
      {TEAMS.map((t, i) => (
        <a key={t.id} className={`tab${active === t.id ? ' on' : ''}`} data-spy={t.id} href={withBase(`${base}/${t.id}`)} onClick={(e) => onTab(e, t.id)}
          aria-label={web ? undefined : `${pad2(i + 1)} ${t.name}`} aria-current={active === t.id ? (web ? 'true' : 'page') : undefined} style={{ '--c': t.c, '--tc': t.tc }}>
          <span className="n">{pad2(i + 1)}</span><span className="t">{t.label.replace('|', ' ')}</span>
        </a>
      ))}
    </nav>
  );
}

// phone: "view all projects", at the foot of every chapter
const MoreButton = ({ onOpen }) => (
  <div className="lb-more">
    <button className="more" type="button" onClick={onOpen} aria-haspopup="dialog">
      <span className="stack" aria-hidden="true">{[['18px', '#FF4D2E'], ['24px', '#3DA9FC'], ['15px', '#FFC700'], ['21px', '#7E5BFF']].map(([h, c]) => <i key={c} style={{ height: h, background: c }} />)}</span>
      <span className="lbl">view all projects</span>
      <span className="up" aria-hidden="true"><svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 6 L6 2 L10 6" /></svg></span>
    </button>
  </div>
);

// phone: the "all projects" sheet: search, the eight projects (the open one marked "you're here", handwritten like the phone menu's), back to the shelf
function ProjectSheet({ ch, leaving, main, onPick, onClose }) {
  const [query, setQuery] = useState('');
  const counts = useMemo(() => {
    if (!query.trim()) return null;
    const out = {};
    TEAMS.forEach((t) => { out[t.id] = findAll(main.current?.querySelector(`[data-ch="${t.id}"]`), query).length; });
    return out;
  }, [query]);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [onClose]);
  const total = counts && Object.values(counts).reduce((x, y) => x + y, 0);
  return (
    <>
      <button className={`sheet-bg${leaving ? ' out' : ''}`} type="button" aria-label="Close" onClick={onClose} />
      <div className={`psheet${leaving ? ' out' : ''}`} role="dialog" aria-modal="true" aria-label="All projects">
        <div style={{ height: "5px", width: "44px", margin: "2px auto 12px", borderRadius: "3px", background: "#C9C0A8" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 10px 8px" }}>
          <span className="m" style={{ fontSize: "11px", color: "#5A5A55" }}>{counts ? (total ? `${total} match${total > 1 ? 'es' : ''}` : 'no matches') : 'all projects · 08'}</span>
          <button className="iconbtn" type="button" aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M2 2 L12 12" /><path d="M12 2 L2 12" /></svg>
          </button>
        </div>
        <div style={{ display: "flex", padding: "0 4px 12px" }} role="search">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="search the gallery…" aria-label="Search the gallery" enterKeyHint="search" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {TEAMS.map((t, i) => {
            const here = ch === t.id, found = counts?.[t.id];
            return (
              <button key={t.id} type="button" className={`pick${here ? ' here' : ''}`} style={{ '--k': i }} disabled={counts ? !found : false} onClick={() => onPick(t.id, counts ? query : null)}>
                <span className="sw" style={{ background: t.c, color: t.tc }}>{pad2(i + 1)}</span>
                <span className="nm">{t.name}</span>
                {here && !counts
                  ? <span className="here-note" style={{ fontFamily: FONT.hand, fontSize: "20px", lineHeight: "1", color: t.c, transform: "rotate(-6deg)", whiteSpace: "nowrap" }}>you're here</span>
                  : <span className={`ct${found ? ' found' : ''}`}>{counts ? (found ? `${found} found` : 'none') : t.cat}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" className="pick" onClick={() => onPick(null)} style={{ marginTop: "8px", borderTop: "1px dashed #A8A18E", borderRadius: "0", minHeight: "52px" }}>
          <span className="ct" style={{ flexGrow: "1", color: "#111111" }}>← back to the shelf</span>
        </button>
      </div>
    </>
  );
}

// phone: Photon's design sheets, swiped sideways, the dots following
function PhotonSheets({ items }) {
  const [on, setOn] = useState(0);
  return (
    <>
      <div className="sheets" onScroll={(e) => setOn(Math.min(items.length - 1, Math.round(e.currentTarget.scrollLeft / 302)))} style={{ marginTop: "16px" }}>{items}</div>
      <div className="sdots" aria-hidden="true" style={{ marginTop: "14px" }}>{items.map((_, i) => <i key={i} className={i === on ? 'on' : undefined} />)}</div>
    </>
  );
}

const Main = HOST.embedded ? 'div' : 'main';

export default function LabsPage({ article: a, web, chapter }) {
  const main = useRef(null), base = articleLink(a), dir = articleFolder(a);
  const navigate = useNavigate(), nav = useRef(navigate);
  nav.current = navigate;
  const [active, setActive] = useState(null); // web: the chapter across the middle of the window
  const [card, setCard] = useState(0); // The Human Manual: the suit pulled up (tap)
  const [sheet, setSheet] = useState(false); // phone: "all projects" open
  const [shownSheet, sheetLeaving] = usePresence(sheet || null, 180);
  const [find, setFind] = useState(null); // phone: a search to mark in the chapter opened from the sheet
  const [pressed, setPressed] = useState(null); // phone: the book just tapped, pushed in
  const [still, setStill] = useState(null); // Karyaarth's stills: the one open in the photo viewer
  const [shownStill, stillLeaving] = usePresence(still, 180);
  const ch = web ? null : chapter; // phone: the chapter open (null = the shelf)
  useEffect(() => { document.title = `Aquaterra — ${a.title}`; }, [a.title]);
  useEffect(() => { flag('tnLabs', ''); return () => flag('tnLabs', null); }, []); // inside AQ: its footer meets the gallery (src/styles/document.css)
  const img = (f, alt = '') => ({ src: `${dir}/${f}`, alt });
  const stills = useMemo(() => STILLS.map((caption, i) => ({ photo: `${dir}/karyaarth/still-${pad2(i + 1)}.webp`, caption, place: `KA ${pad2(i + 1)}` })), [dir]);

  // web: glide to a chapter and show its address (quiet: in place, lib/scrollMemory.js doesn't scroll again)
  const go = useCallback((e, id) => {
    e?.preventDefault();
    byId(id)?.scrollIntoView({ behavior: behavior() });
    nav.current(`${base}/${id}`, { replace: true, state: { quiet: true } });
  }, [base]);
  // phone: open a chapter (null: the shelf), as a page of its own, from the top
  const open = useCallback((id, query = null) => {
    setSheet(false); setCard(0); setFind(query);
    nav.current(id ? `${base}/${id}` : base);
  }, [base]);
  const closeSheet = useCallback(() => setSheet(false), []);
  const onTab = web ? go : (e, id) => { e.preventDefault(); open(ch === id ? null : id); };
  const onBook = (id) => (e) => {
    if (web) return go(e, id);
    e.preventDefault();
    if (calm()) return open(id);
    setPressed(id); // let the press show, then open
    setTimeout(() => { setPressed(null); open(id); }, 170);
  };

  useEffect(() => { // web: scroll spy (intro: none), chapters rise in once seen
    if (!web) return undefined;
    const root = main.current;
    const spy = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setActive(e.target.dataset.ch || null); }), { rootMargin: '-45% 0px -54% 0px' });
    root.querySelectorAll('.lb-intro, section[data-ch]').forEach((s) => spy.observe(s));
    const seen = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } }), { rootMargin: '0px 0px -18% 0px' });
    root.querySelectorAll('.rv').forEach((s) => (calm() ? s.classList.add('in') : seen.observe(s)));
    return () => { spy.disconnect(); seen.disconnect(); };
  }, [web]);
  useEffect(() => { // the Cirqle orbit turns and the intro's prints drift only while they're near the screen
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('off-screen', !e.isIntersecting)), { rootMargin: '200px 0px' });
    main.current.querySelectorAll('.cq, .lb-intro').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ch, web]);
  useEffect(() => { // phone: a chapter opened from a search shows its matches
    if (web) return undefined;
    if (!find || !ch) { unmark(); return undefined; }
    const ranges = findAll(main.current.querySelector(`[data-ch="${ch}"]`), find);
    mark(ranges);
    const t = setTimeout(() => showMatch(ranges[0]), calm() ? 0 : 420); // after the chapter's entrance
    return () => clearTimeout(t);
  }, [ch, find, web]);
  useEffect(() => unmark, []);

  // ---- the pieces, per layout
  const W = (phone, webV) => (web ? webV : phone);
  // a row of books. Each book is drawn in its own 3D scene (so no face of one book can be drawn through another), with
  // the shelf's viewpoint: ox = the shelf's middle, seen from the book's slot (the row is centred, 6px apart)
  const books = (from, to) => {
    const sizes = BOOKS[web ? 'web' : 'phone'].slice(from, to), row = web ? 872 : 330;
    let left = (row - sizes.reduce((sum, [w]) => sum + w, 0) - 6 * (sizes.length - 1)) / 2;
    return TEAMS.slice(from, to).map((t, k) => {
      const ox = row / 2 - left;
      left += sizes[k][0] + 6;
      return <Book key={t.id} t={t} i={from + k} size={sizes[k]} web={web} href={withBase(`${base}/${t.id}`)} onClick={onBook(t.id)} pressed={pressed === t.id} ox={ox} />;
    });
  };
  const prints = PRINTS[web ? 'web' : 'phone'].map(([f, label, { rotate, ...box }, h]) => (
    <figure key={f + label} className="print" style={{ ...box, transform: `rotate(${rotate})` }}><img src={`${dir}/${f}`} alt="" style={{ height: `${h}px` }} /><span>{label}</span></figure>
  ));
  const intro = (
    <section className="lb-intro">
      {web
        ? <div aria-hidden="true" style={{ position: "absolute", inset: "0" }}>{prints}</div>
        : <div aria-hidden="true" style={{ position: "relative", width: "350px", height: "200px" }}>{prints}</div>}
      <div className="m showpill" style={{ marginTop: W("26px", "0"), padding: W("8px 14px", "9px 18px"), fontSize: W("9.5px", "11px"), letterSpacing: W(".18em", ".2em") }}>★ AQ Labs '26 · an Aquaterra showcase</div>
      <h1 className="lb-title" style={{ margin: W("14px 0 0", "18px 0 0"), gap: W("8px", "18px") }}>
        <span className="d" style={{ fontSize: W("104px", "196px"), color: "#F3EEE4" }}>AQ</span><span className="s" style={{ fontSize: W("106px", "206px"), letterSpacing: "-.02em", color: "#22A26A" }}>Labs</span>
      </h1>
      <p style={{ position: "relative", marginTop: W("16px", "20px"), maxWidth: W("320px", "560px"), textAlign: "center", fontSize: W("18px", "22px"), lineHeight: "1.45", color: "#D8D2C4", textWrap: "balance" }}>eight teams. eight things that didn't exist six weeks ago, and now do.</p>
      <a className="lbtn" href={withBase(`${base}/karyaarth`)} onClick={onBook('karyaarth')} style={{ position: "relative", marginTop: W("24px", "28px"), width: W("100%", undefined), background: "#1B8A5A", color: "#F3EEE4" }}>walk the gallery <span aria-hidden="true" style={{ fontSize: "16px" }}>↓</span></a>
      <div className="lb-or" style={{ marginTop: W("36px", "50px"), width: W("100%", "900px"), gap: W("12px", "16px") }}><i /><span className="m" style={{ fontSize: W("10px", "11px"), color: "#9D978A" }}>or pull a book</span><i /></div>
      <div className="shelf">
        {web ? (
          <><div className="stage"><div className="brow"><i className="floor" />{books(0, 8)}</div></div><div className="plank" /></>
        ) : (
          <>
            <div className="stage"><div className="brow"><i className="floor" />{books(0, 4)}</div></div><div className="plank" />
            <div className="stage"><div className="brow"><i className="floor" />{books(4, 8)}</div></div><div className="plank" />
          </>
        )}
      </div>
      <p className="m" style={{ position: "relative", marginTop: W("16px", "20px"), fontSize: W("9.5px", "10.5px"), color: "#8E887C", letterSpacing: ".16em" }}>{web ? 'hover a spine to pull it · click to open its chapter' : 'tap a spine to open its chapter'}</p>
    </section>
  );

  // a chapter: web, a section of the long page; phone, one view (shown while open), ending in "view all projects"
  const wrap = ({ id, bg, dark, color, bleed }, children) => {
    const t = TEAMS.find((x) => x.id === id), style = { '--c': t.c, '--sh': dark ? '#F3EEE4' : undefined, background: bg, color };
    return web
      ? <section key={id} id={id} data-ch={id} className="chap rv" style={style}>{children}</section>
      : (
        <div key={id} className="chap" data-ch={id} hidden={ch !== id} style={style}>
          <section className={bleed ? 'bleed' : undefined}>{children}</section>
          <MoreButton onOpen={() => setSheet(true)} />
        </div>
      );
  };
  const lead = (text, color, style) => <p className={web ? 'lead' : undefined} style={{ fontSize: W("16.5px", undefined), lineHeight: W("1.6", undefined), color, ...style }}>{text}</p>;
  const label = (k, t, color, dim, style) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", ...style }}>
      <span className="m" style={{ fontSize: W("11px", "12px"), color }}>{k}</span><span className="m" style={{ fontSize: W("10px", "11px"), color: dim }}>{t}</span>
    </div>
  );
  const stillFig = (n, h, style) => (
    <figure className="still zoom" style={{ height: h, ...style }}><img src={`${dir}/karyaarth/still-${pad2(n)}.webp`} alt={STILLS[n - 1]} loading="lazy" decoding="async" /><span className="still-no">KA {pad2(n)}</span></figure>
  );
  const moreStills = (count) => <button type="button" className="lbtn" onClick={() => setStill(0)}>view the rest · {count} more →</button>;

  // 01 Karyaarth
  const karyaarthHero = (
    <a className="zoom" href="https://youtube.com/@karyaarth" {...OUT} aria-label="Watch Karyaarth on YouTube" style={{ position: "relative", display: "block", height: W("232px", "400px"), overflow: "hidden", borderRadius: W("0", "6px"), marginTop: W("26px", undefined) }}>
      <img src={`${dir}/karyaarth/still-09.webp`} alt={STILLS[8]} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 40%" }} />
      <span style={{ position: "absolute", inset: "0", background: `linear-gradient(180deg, rgba(17,17,17,0) ${W(45, 55)}%, rgba(17,17,17,${W(0.85, 0.8)}) 100%)` }} />
      <span style={{ position: "absolute", left: "50%", top: "50%", width: W("68px", "88px"), height: W("68px", "88px"), margin: W("-46px 0 0 -34px", "-44px 0 0 -44px"), borderRadius: "50%", background: "#FF4D2E", border: "2px solid #111111", display: "flex", alignItems: "center", justifyContent: "center" }}><Play size={W(22, 28)} fill="#111111" /></span>
      <span className="s" style={{ position: "absolute", left: W("20px", "26px"), bottom: W("16px", "20px"), fontSize: W("26px", "32px"), lineHeight: "1", color: "#F3EEE4" }}>the hustle</span>
    </a>
  );
  const karyaarthButtons = web
    ? <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", gap: "12px" }}><Ext href="https://youtube.com/@karyaarth">watch on youtube</Ext><Ext href="https://www.instagram.com/karyaarth">view on instagram</Ext></div>
    : <div className="row2" style={{ marginTop: "24px" }}><Ext href="https://youtube.com/@karyaarth">youtube</Ext><Ext href="https://www.instagram.com/karyaarth">instagram</Ext></div>;
  const karyaarthText = 'the ice cream cart. the tea stall. the man who has fixed shoes on the same corner for thirty years. karyaarth points a camera at the people we walk past every day and never actually see, and lets them talk.';
  const karyaarth = web ? wrap({ id: 'karyaarth', bg: '#111111', dark: true, color: '#F3EEE4' }, <>
    <Meta web k="01 · documentary" t="team karyaarth" color="#FF6A4F" dim="#9D978A" />
    <h2 className="d" style={{ marginTop: "22px", fontSize: "176px" }}>Karyaarth</h2>
    <div className="grid2" style={{ marginTop: "40px", gridTemplateColumns: "460px minmax(0, 1fr)", gap: "60px", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <p className="s" style={{ fontSize: "40px", lineHeight: "1.05", color: "#FF6A4F" }}>local log. legendary hustle.</p>
        {lead(karyaarthText, "#D2CCBE", { marginTop: "20px" })}
        {karyaarthButtons}
      </div>
      {karyaarthHero}
    </div>
    {label('from the street', '10 stills', '#FF6A4F', '#9D978A', { marginTop: "70px" })}
    <div style={{ marginTop: "18px", display: "flex", gap: "6px", height: "250px" }}>
      {stillFig(6, '100%', { flex: "0.534 1 0" })}{stillFig(2, '100%', { flex: "1.880 1 0" })}{stillFig(3, '100%', { flex: "1.852 1 0" })}{stillFig(10, '100%', { flex: "0.550 1 0" })}
    </div>
    <div style={{ marginTop: "18px", display: "flex", justifyContent: "center" }}>{moreStills(5)}</div>
  </>) : wrap({ id: 'karyaarth', bg: '#111111', dark: true, color: '#F3EEE4', bleed: true }, <>
    <div className="pad">
      <Meta k="01 · documentary" t="team karyaarth" color="#FF6A4F" dim="#9D978A" />
      <h2 className="d" style={{ marginTop: "18px", fontSize: "54px" }}>Karyaarth</h2>
      <p className="s" style={{ marginTop: "12px", fontSize: "30px", lineHeight: "1.1", color: "#FF6A4F" }}>local log. legendary hustle.</p>
    </div>
    {karyaarthHero}
    <div className="pad" style={{ paddingTop: "24px" }}>{lead(karyaarthText, "#D2CCBE")}{karyaarthButtons}</div>
    {label('from the street', '10 stills', '#FF6A4F', '#9D978A', { marginTop: "40px", padding: "0 20px" })}
    <div style={{ marginTop: "14px", display: "flex", flexDirection: "column", gap: "4px" }}>
      <div style={{ display: "flex", gap: "4px" }}>{stillFig(6, '352px', { flex: "1 1 0" })}{stillFig(10, '352px', { flex: "1 1 0" })}</div>
      {stillFig(3, '212px')}
    </div>
    <div style={{ padding: "16px 20px 0", display: "flex" }}>{moreStills(6)}</div>
  </>);

  // 02 Career Compass
  const gapCard = (
    <div style={{ border: "2px solid #111111", borderRadius: W("18px", "20px"), background: "#FFFFFF", boxShadow: `${W(6, 8)}px ${W(6, 8)}px 0 #111111`, overflow: "hidden", marginTop: W("28px", undefined) }}>
      <div style={{ height: W("44px", "50px"), padding: W("0 16px", "0 20px"), display: "flex", alignItems: "center", justifyContent: "space-between", background: "#EDE6D0", borderBottom: "2px solid #111111" }}>
        <span className="m" style={{ fontSize: W("10.5px", "11.5px") }}>the gap</span>
        <svg width={W(22, 24)} height={W(22, 24)} viewBox="0 0 22 22" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="9" stroke="#111111" strokeWidth="2" /><path d="M11 11 L15.5 5.5" stroke="#1A64A3" strokeWidth="2.4" strokeLinecap="round" /></svg>
      </div>
      <div style={{ padding: W("14px", "18px"), display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: W("10px", "12px") }}>
        <div className="stat"><div className="n">1.5 Cr</div><div className="l">grads / year</div></div>
        <div className="stat" style={{ background: "#3DA9FC" }}><div className="n">42.6%</div><div className="l">employability</div></div>
        <div className="stat"><div className="n">25%</div><div className="l">digital gap</div></div>
        <div className="stat" style={{ background: "#7E5BFF", color: "#FFFFFF" }}><div className="n">25 L</div><div className="l">emigrate / year</div></div>
      </div>
    </div>
  );
  const ccUrl = 'https://careerrcompassindia.netlify.app';
  const ccHead = <>
    <Meta web={web} k="02 · career data" t="team merge conflicts" color="#1A64A3" dim="#5A5A55" />
    <h2 className="d" style={{ marginTop: W("18px", "22px"), fontSize: W("56px", "104px") }}>Career<br />Compass</h2>
    <p className="s" style={{ marginTop: W("14px", "20px"), fontSize: W("26px", "34px"), lineHeight: W("1.12", "1.1"), color: "#1A64A3" }}>it won't pick your path. it just won't let you walk confidently the wrong way.</p>
    {lead("india trains millions and still can't fill the jobs that matter. careercompass reads what industries actually need against what students actually study, and hands you a direction instead of a shrug.", "#2A2A28", { marginTop: W("16px", "18px") })}
  </>;
  const ccHome = img('career-compass/site-home.webp', "careercompass overview: navigate India's skill economy wisely");
  const ccPath = img('career-compass/site-find-your-path.webp', 'careercompass find your path: a short questionnaire');
  const careerCompass = web ? wrap({ id: 'career-compass', bg: '#F3EEE4' }, <>
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0, 1fr) 560px", gap: "70px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>{ccHead}<div style={{ marginTop: "28px" }}><Ext href={ccUrl}>visit website</Ext></div></div>
      {gapCard}
    </div>
    {label('inside the site', '2 screens', '#1A64A3', '#5A5A55', { marginTop: "80px" })}
    <div className="grid2" style={{ marginTop: "18px", gridTemplateColumns: "1.45fr 1fr", gap: "28px" }}>
      <figure style={{ display: "flex", flexDirection: "column", gap: "12px" }}><Browser blank href={ccUrl} url="careerrcompassindia.netlify.app" img={ccHome} h={330} pos="50% 30%" /><figcaption className="m" style={{ fontSize: "10.5px", color: "#5A5A55" }}>the overview</figcaption></figure>
      <figure style={{ display: "flex", flexDirection: "column", gap: "12px" }}><Browser blank href={ccUrl} url="careerrcompassindia.netlify.app" img={ccPath} h={330} pos="50% 0" /><figcaption className="m" style={{ fontSize: "10.5px", color: "#5A5A55" }}>find your path</figcaption></figure>
    </div>
  </>) : wrap({ id: 'career-compass', bg: '#F3EEE4' }, <>
    {ccHead}
    {gapCard}
    {label('inside the site', '2 screens', '#1A64A3', '#5A5A55', { marginTop: "40px" })}
    <div style={{ position: "relative", marginTop: "14px", height: "470px" }}>
      <Browser blank href={ccUrl} url="careerrcompassindia.netlify.app" img={ccHome} h={190} pos="50% 30%" style={{ position: "absolute", left: "0", top: "0", width: "318px", boxShadow: "0 10px 24px rgba(17,17,17,.12)" }} />
      <span className="m" style={{ position: "absolute", left: "4px", top: "236px", fontSize: "10px", color: "#5A5A55" }}>the overview</span>
      <Browser blank href={ccUrl} url="find your path" img={ccPath} h={222} pos="50% 0" style={{ position: "absolute", right: "0", top: "196px", width: "262px", boxShadow: "-8px 12px 28px rgba(17,17,17,.2)" }} />
    </div>
    <div style={{ display: "flex" }}><Ext href={ccUrl}>visit website</Ext></div>
  </>);

  // 03 Quirk
  const quirkUrl = 'https://quirkbyaq.vercel.app';
  const arcade = (
    <figure style={{ marginTop: W("26px", undefined), border: "2px solid #FF4D8C", borderRadius: W("22px", "24px"), background: "#050506", boxShadow: `${W(8, 10)}px ${W(8, 10)}px 0 #FF4D8C`, overflow: "hidden" }}>
      <div style={{ height: W("40px", "46px"), padding: W("0 16px", "0 18px"), display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #2B2B31" }}>
        <span className="m" style={{ fontSize: W("11px", "12px"), color: "#FF6FA3" }}>score 1280</span>
        <span style={{ display: "flex", gap: "6px" }} aria-hidden="true">{['#FF4D8C', '#3A3A40', '#3A3A40'].map((c, i) => <i key={i} style={{ width: W("8px", "9px"), height: W("8px", "9px"), borderRadius: "50%", background: c }} />)}</span>
      </div>
      <div className="zoom" style={{ position: "relative", height: W("340px", "440px"), overflow: "hidden" }}>
        <img src={`${dir}/quirk/oled-test.webp`} alt="a hand pressing the quirk pressure pad while the OLED screen lights up" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 58%" }} />
        <span style={{ position: "absolute", inset: "0", background: "repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 1px, transparent 1px 3px)" }} />
      </div>
      <figcaption className="m" style={{ padding: W("12px 16px", "14px 18px"), borderTop: "1px solid #2B2B31", fontSize: W("9.5px", "10.5px"), lineHeight: "1.6", color: "#B7B1A4" }}>200×200mm board · fsr pad + oled + esp32</figcaption>
    </figure>
  );
  const quirkText = 'a pressure pad, a score, an OLED screen small enough to lose. a desktop console for the restless and the ADHD-wired, more rewarding than a fidget toy and less greedy than a phone. five games run today. the enclosure is still a breadboard on a table.';
  const quirkHead = <>
    <Meta web={web} k="03 · hardware" t="team execution pending" color="#FF6FA3" dim="#9D978A" />
    <h2 className="d" style={{ marginTop: W("18px", "22px"), fontSize: W("84px", "170px"), color: "#FF4D8C", textShadow: `${W(3, 4)}px 0 0 rgba(61,169,252,.55), -${W(3, 4)}px 0 0 rgba(255,199,0,.35)` }}>Quirk</h2>
    <p className="s" style={{ marginTop: W("12px", "18px"), fontSize: W("28px", "38px"), lineHeight: "1.1", color: "#F3EEE4" }}>built by teenagers who got bored.</p>
  </>;
  const webShot = web ? { style: { borderColor: "#3A3A40" }, bb: { height: "28px" } } : {};
  const steps = [
    ['01', 'hardware', <img className="lift" src={`${dir}/quirk/breadboard.webp`} alt="the quirk breadboard with ESP32, OLED and wiring" loading="lazy" decoding="async" style={{ width: "100%", height: W("200px", "190px"), objectFit: "cover", borderRadius: "12px" }} />, 'the real board, still bare on the bench.'],
    ['02', 'on the oled', <div style={{ height: W(undefined, "190px"), padding: "14px", borderRadius: "12px", background: "#1C2A4A", border: "2px solid #2E4A7A" }}><img src={`${dir}/quirk/player-one.webp`} alt="the OLED screen: player 1, 60 second 3pt contest" loading="lazy" decoding="async" style={{ width: "100%", height: W("150px", "100%"), objectFit: "cover", borderRadius: "4px" }} /></div>, 'player 1, a 60 second 3pt contest.'],
    ['03', 'live site', <Browser blank href={quirkUrl} url="quirkbyaq.vercel.app" img={img('quirk/site-meet-quirk.webp', 'meet quirk')} h={W(170, 158)} pos="60% 30%" {...webShot} />, 'meet quirk, the pressure-sensing console.'],
    ['04', 'play now', <Browser blank href={quirkUrl} url="quirkbyaq.vercel.app" img={img('quirk/site-play-now.webp', 'quirk games: play now, hardware optional')} h={W(170, 158)} pos="30% 20%" {...webShot} />, 'five games, downloadable today.'],
  ].map(([n, k, pic, cap]) => (
    <div key={n} className="step"><span className="node">{n}</span><span className="m" style={{ fontSize: "10.5px", color: "#FF6FA3" }}>{k}</span>{pic}<p className="cap">{cap}</p></div>
  ));
  const quirk = web ? wrap({ id: 'quirk', bg: '#0E0E10', dark: true, color: '#F3EEE4' }, <>
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0, 1fr) 540px", gap: "70px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>{quirkHead}{lead(quirkText, "#D2CCBE", { marginTop: "18px" })}<div style={{ marginTop: "28px" }}><Ext href={quirkUrl}>visit website</Ext></div></div>
      {arcade}
    </div>
    {label("the build log · it's live", 'breadboard → browser', '#FF6FA3', '#9D978A', { marginTop: "90px" })}
    <div style={{ position: "relative", marginTop: "26px", display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "24px" }}>
      <span style={{ position: "absolute", left: "15px", right: "40px", top: "15px", borderTop: "2px dashed #4A2A38" }} />
      {steps}
    </div>
  </>) : wrap({ id: 'quirk', bg: '#0E0E10', dark: true, color: '#F3EEE4' }, <>
    {quirkHead}
    {arcade}
    {lead(quirkText, "#D2CCBE", { marginTop: "26px" })}
    <div style={{ display: "flex", marginTop: "18px" }}><Ext href={quirkUrl}>visit website</Ext></div>
    <div style={{ marginTop: "44px", display: "flex", flexDirection: "column", gap: "6px" }}>
      <span className="m" style={{ fontSize: "11px", color: "#FF6FA3" }}>the build log · it's live</span><span className="m" style={{ fontSize: "10px", color: "#9D978A" }}>breadboard → browser</span>
    </div>
    <div style={{ position: "relative", marginTop: "24px", display: "flex", flexDirection: "column", gap: "30px" }}>
      <span style={{ position: "absolute", left: "12px", top: "10px", bottom: "60px", borderLeft: "2px dashed #4A2A38" }} />
      {steps}
    </div>
  </>);

  // 04 Wisdom Woods
  const demo = withBase(`${base}/wisdom-woods/demo`);
  const playCard = (
    <a className="lift" href={demo} {...OUT} aria-label="Play the Wisdom Woods demo (opens in a new tab)" style={{ position: "relative", display: "block", marginTop: W("26px", undefined), border: "2px solid #111111", borderRadius: W("18px", "22px"), overflow: "hidden", background: "#111111", boxShadow: `${W(6, 10)}px ${W(6, 10)}px 0 #1B8A5A`, '--sh': '#1B8A5A' }}>
      <img src={`${dir}/wisdom-woods/poster.webp`} alt="the Wisdom Woods title screen: a tree emblem in a jungle" loading="lazy" decoding="async" style={{ width: "100%", height: W("200px", "316px"), objectFit: "cover", objectPosition: "50% 45%" }} />
      <span style={{ height: W("56px", "66px"), padding: W("0 8px 0 18px", "0 12px 0 24px"), display: "flex", alignItems: "center", justifyContent: "space-between", background: "#1B8A5A", color: "#F3EEE4", borderTop: "2px solid #111111" }}>
        <span className="m" style={{ fontSize: W("11px", "12px") }}>play the demo</span>
        <span style={{ width: W("40px", "46px"), height: W("40px", "46px"), borderRadius: "50%", background: "#F3EEE4", display: "flex", alignItems: "center", justifyContent: "center" }}><svg width={W(14, 16)} height={W(16, 18)} viewBox="0 0 14 16" aria-hidden="true"><path d="M2 1 L13 8 L2 15 Z" fill="#146B45" /></svg></span>
      </span>
    </a>
  );
  const levels = (
    <div style={{ position: "relative", marginTop: W("16px", undefined), display: "flex", justifyContent: W("space-between", undefined), gap: W(undefined, "20px") }}>
      <span style={{ position: "absolute", left: W("46px", "55px"), right: W("46px", "55px"), top: W("27px", "30px"), borderTop: "3px dotted #1B8A5A" }} />
      {[['LVL 1', 'Vocab', '#1B8A5A', '#F3EEE4'], ['LVL 2', 'Logic', '#FFFFFF'], ['LVL 3', 'World', '#FFFFFF']].map(([l, w, bg, c]) => (
        <div key={l} className="lvl"><span className="dot" style={{ background: bg, color: c }}>{l}</span><span className="w">{w}</span></div>
      ))}
    </div>
  );
  const wwHead = <>
    <Meta web={web} k="04 · ed-game · classes 3–7" t="team alter ego" color="#146B45" dim="#5A5A55" />
    <h2 className="d" style={{ marginTop: W("18px", "22px"), fontSize: W("60px", "104px") }}>Wisdom<br />Woods</h2>
    <p className="s" style={{ marginTop: W("14px", "18px"), fontSize: W("28px", "36px"), lineHeight: "1.1", color: "#146B45" }}>learning that forgets it's learning.</p>
  </>;
  const wwText = 'a worksheet is a wall; a game is an open door. so the worksheet hides inside the game: vocabulary, logic and general knowledge, dressed as an expedition.';
  const inApp = [['wisdom-woods/app-enter.webp', 'wisdom woods: enter the woods', 'enter the woods', 'make an explorer, pick a guide.'], ['wisdom-woods/app-question.webp', 'wisdom woods: a world explorer question', 'world explorer', 'one question, four answers, a score.']].map(([f, alt, k, cap]) => (
    <figure key={f} style={{ display: "flex", flexDirection: "column", gap: W("10px", "12px") }}>
      <Browser blank href={demo} url="…/labs/wisdom-woods/demo" img={img(f, alt)} h={W(170, 290)} bb={web ? { background: "#F3EEE4" } : undefined} />
      <figcaption style={{ display: "flex", flexDirection: W("column", "row"), alignItems: W(undefined, "baseline"), gap: W("4px", "14px") }}><span className="m" style={{ fontSize: W("10px", "10.5px"), color: "#146B45" }}>{k}</span><span style={{ fontSize: W("15px", "15.5px"), lineHeight: W("1.4", undefined), color: "#2A2A28" }}>{cap}</span></figcaption>
    </figure>
  ));
  const wwInsta = <Ext href="https://www.instagram.com/wisdomwoods26">view on instagram</Ext>;
  const wisdomWoods = web ? wrap({ id: 'wisdom-woods', bg: '#EDE6D0' }, <>
    <div className="grid2" style={{ gridTemplateColumns: "560px minmax(0, 1fr)", gap: "70px", alignItems: "center" }}>
      {playCard}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {wwHead}{lead(wwText, "#2A2A28", { marginTop: "16px" })}
        <div style={{ marginTop: "26px", display: "flex" }}>{levels}</div>
        <div style={{ marginTop: "30px", display: "flex" }}>{wwInsta}</div>
      </div>
    </div>
    {label('inside the app', 'from the demo', '#146B45', '#5A5A55', { marginTop: "80px" })}
    <div className="grid2" style={{ marginTop: "18px", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "28px" }}>{inApp}</div>
  </>) : wrap({ id: 'wisdom-woods', bg: '#EDE6D0' }, <>
    {wwHead}
    {playCard}
    {lead(wwText, "#2A2A28", { marginTop: "26px" })}
    <div style={{ marginTop: "28px", padding: "18px 12px 20px", border: "2px dashed #9E977F", borderRadius: "16px" }}><p className="m" style={{ textAlign: "center", fontSize: "10px", color: "#5A5A55" }}>the expedition</p>{levels}</div>
    <div style={{ marginTop: "24px", display: "flex" }}>{wwInsta}</div>
    {label('inside the app', 'from the demo', '#146B45', '#5A5A55', { marginTop: "44px" })}
    <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "22px" }}>{inApp}</div>
  </>);

  // 05 Cirqle: the orbit is drawn on a square (R = ring radius); nodes and arrows sit on the ring, 120° apart
  const S = W(330, 500), R = W(132, 198), HUB = W(190, 290), c0 = S / 2;
  const onRing = (deg) => [c0 + R * Math.sin((deg * Math.PI) / 180), c0 - R * Math.cos((deg * Math.PI) / 180)].map((v) => `${v.toFixed(1)}px`);
  const orbit = (
    <div aria-hidden="true" className="cq" style={{ margin: W("30px auto 0", undefined), width: `${S}px`, height: `${S}px`, flex: "none" }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} fill="none" style={{ position: "absolute", inset: "0" }}><circle cx={c0} cy={c0} r={R} stroke="#111111" strokeWidth="2" strokeDasharray="7 8" /></svg>
      <div style={{ position: "absolute", left: `${(S - HUB) / 2}px`, top: `${(S - HUB) / 2}px`, width: `${HUB}px`, height: `${HUB}px`, borderRadius: "50%", border: "2px solid #111111", overflow: "hidden", background: "#FDF8EC", boxShadow: `${W(8, 10)}px ${W(8, 10)}px 0 #FFC700` }}>
        <img src={`${dir}/cirqle/poster.webp`} alt="" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.12)" }} />
      </div>
      <div className="spin">
        {[60, 180, 300].map((deg) => { const [left, top] = onRing(deg); return <span key={deg} className="oarrow" style={{ left, top, transform: `rotate(${deg}deg)` }}><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M6 3 L12 9 L6 15" stroke="#111111" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>; })}
        {[[0, 'rent', '#FFFFFF'], [120, 'lend', '#FF4D8C'], [240, 'repeat', '#7E5BFF', '#FFFFFF']].map(([deg, w, bg, color]) => { const [left, top] = onRing(deg); return <span key={w} className="onode" style={{ left, top, background: bg, color }}>{w}</span>; })}
      </div>
    </div>
  );
  const cqHead = <>
    <Meta web={web} k={<><i style={{ width: W("10px", "11px"), height: W("10px", "11px"), borderRadius: "50%", background: "#FFC700", border: "1.5px solid #111111" }} />05 · rentals</>} t="team idea architects" color="#111111" dim="#5A5A55" />
    <h2 className="d" style={{ marginTop: W("18px", "22px"), fontSize: W("82px", "170px") }}>Cirqle</h2>
    <p className="s" style={{ marginTop: W("12px", "18px"), fontSize: W("30px", "42px"), lineHeight: W("1.1", "1.05"), color: "#C23417" }}>borrow the drill. keep the money.</p>
  </>;
  const cqText = "you bought the drill, used it twice, and it's sat in a drawer for a decade. so has your neighbour's. cirqle turns that quiet waste into a loop: location-based whatsapp groups where people rent what they need and lend what they own.";
  const cqInsta = <Ext href="https://www.instagram.com/p/DZLEszYk031/">view on instagram</Ext>;
  const cirqle = web ? wrap({ id: 'cirqle', bg: '#F3EEE4' }, <>
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0, 1fr) 500px", gap: "80px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>{cqHead}{lead(cqText, "#2A2A28", { marginTop: "18px" })}<div style={{ marginTop: "28px" }}>{cqInsta}</div></div>
      {orbit}
    </div>
  </>) : wrap({ id: 'cirqle', bg: '#F3EEE4' }, <>
    {cqHead}{orbit}{lead(cqText, "#2A2A28", { marginTop: "30px" })}<div style={{ display: "flex", marginTop: "18px" }}>{cqInsta}</div>
  </>);

  // 06 Hunar
  const hunarUrl = 'https://hunar-one.vercel.app';
  const trust = (
    <div style={{ marginTop: W("34px", undefined), padding: W("20px 18px 22px", "24px 24px 26px"), border: "1px solid #34332F", borderRadius: W("16px", "18px"), background: "#171716" }}>
      <p className="m" style={{ fontSize: W("10.5px", "11px"), color: "#9D978A" }}>where trust comes from, weighted</p>
      <div style={{ marginTop: W("18px", "20px"), display: "flex", flexDirection: "column", gap: "16px" }}>
        {TRUST.map(([l, v, w]) => <div key={l} className="bar"><div className="bar-h"><span>{l}</span><span style={{ color: "#A58BFF" }}>{v}</span></div><div className="btrack"><div className="bfill" style={{ width: w }} /></div></div>)}
      </div>
    </div>
  );
  const hunarSite = <Browser blank href={hunarUrl} url="hunar-one.vercel.app" img={img('hunar/site.webp', "hunar: the placement network for India's skilled workforce")} h={W(200, 236)} pos={W('12% 20%', '20% 20%')} style={web ? undefined : { marginTop: "26px" }} />;
  const hunarHead = <>
    <Meta web={web} k="06 · placement" t="team zero to deploy" color="#A58BFF" dim="#9D978A" />
    <p className="d" style={{ marginTop: W("18px", "22px"), fontSize: W("40px", "58px"), color: "#F3EEE4" }}>Hunar</p>
    <h2 className="d" style={{ marginTop: W("16px", "22px"), fontSize: W("50px", "92px"), lineHeight: ".9" }}>not a training problem. <span style={{ color: "#9B7DFF" }}>a placement problem.</span></h2>
    {lead("a qualified graduate finishes the course, holds the certificate, and still can't get seen. the break happens after the certificate, in a market that can't find them and can't verify they're real. hunar rebuilt the part everyone skips.", "#D2CCBE", { marginTop: W("20px", "26px") })}
  </>;
  const hunar = web ? wrap({ id: 'hunar', bg: '#111111', dark: true, color: '#F3EEE4' }, <>
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "80px", alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>{hunarHead}<div style={{ marginTop: "28px" }}><Ext href={hunarUrl}>visit website</Ext></div></div>
      <div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>{trust}{hunarSite}</div>
    </div>
  </>) : wrap({ id: 'hunar', bg: '#111111', dark: true, color: '#F3EEE4' }, <>
    {hunarHead}{trust}{hunarSite}<div style={{ display: "flex", marginTop: "18px" }}><Ext href={hunarUrl}>visit website</Ext></div>
  </>);

  // 07 Photon
  const band = (
    <figure style={{ marginTop: W("28px", undefined), display: "flex", flexDirection: "column", gap: W("12px", "14px") }}>
      <div className="zoom" style={{ position: "relative", height: W("380px", "560px"), borderRadius: W("24px", "28px"), overflow: "hidden", background: "#FFFFFF", boxShadow: `0 0 0 1px #2A3040, 0 ${W(30, 40)}px ${W(80, 100)}px rgba(111,215,255,.18)` }}>
        <img src={`${dir}/photon/band.webp`} alt="the photon band on a wrist" loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 45%" }} />
      </div>
      <figcaption style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}><span className="m" style={{ fontSize: W("10px", "10.5px"), color: "#6FD7FF" }}>the band</span><span style={{ fontSize: W("14.5px", "15.5px"), color: "#C9CBD2" }}>slim, screen-free, all-day.</span></figcaption>
    </figure>
  );
  const photonHead = <>
    <Meta web={web} k="07 · wearable" t="team 404 not found" color="#6FD7FF" dim="#9D978A" />
    <h2 className="d" style={{ marginTop: W("18px", "22px"), fontSize: W("76px", "124px") }}>Photon</h2>
    <p className="s" style={{ marginTop: W("12px", "18px"), fontSize: W("36px", "54px"), lineHeight: W("1.05", "1"), color: "#6FD7FF" }}>no screen. no noise.</p>
  </>;
  const photonBody = <>
    {lead('every wearable screams for your attention. photon refuses to. a screen-free bracelet that reads your body through light and motion, then gets out of the way. technology you wear, not technology you serve.', "#C9CBD2", { marginTop: W("24px", "20px") })}
    <div style={{ marginTop: W("18px", "20px"), display: "flex", flexWrap: "wrap", gap: W("10px 20px", "10px 24px"), color: "#E6E8EE" }}><span className="chip">light-based sensing</span><span className="chip">motion tracking</span><span className="chip">screen-free</span></div>
    <div style={{ marginTop: W("22px", "26px"), alignSelf: W(undefined, "flex-start"), padding: W("14px 16px", "14px 18px"), border: "1px dashed #3A4256", borderRadius: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
      <span style={{ flex: "none", width: "10px", height: "10px", borderRadius: "50%", background: "#FFC700", boxShadow: "0 0 0 4px rgba(255,199,0,.18)" }} />
      <span className="m" style={{ fontSize: W("10.5px", "11px"), lineHeight: "1.5", color: "#E6E8EE" }}>prototype stage · no live link yet</span>
    </div>
  </>;
  const sheetItems = [['sheet-design', 'photon design sheet: modus band, modular design', 'sheet 01', 'modus band: the modular design.'], ['sheet-lock', 'photon design sheet: the slide-and-lock mechanism', 'sheet 02', 'the slide-and-lock mechanism.'], ['sheet-parts', 'photon design sheet: the parts of the modular fitness band', 'sheet 03', 'every part, laid out.']].map(([f, alt, k, cap]) => (
    <figure key={f} className="sheet"><img src={`${dir}/photon/${f}.webp`} alt={alt} loading="lazy" decoding="async" /><figcaption><span className="m" style={{ fontSize: W("9.5px", "10px"), color: "#6FD7FF" }}>{k}</span><span style={{ fontSize: W("14.5px", "15.5px"), color: "#E6E8EE" }}>{cap}</span></figcaption></figure>
  ));
  const photon = web ? wrap({ id: 'photon', bg: '#0B0D12', dark: true, color: '#F3EEE4' }, <>
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0, 1fr) 520px", gap: "80px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>{photonHead}{photonBody}</div>
      {band}
    </div>
    {label('the object · design sheets', '3 sheets', '#6FD7FF', '#8A8F9C', { marginTop: "80px" })}
    <div className="grid2" style={{ marginTop: "18px", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "24px" }}>{sheetItems}</div>
  </>) : wrap({ id: 'photon', bg: '#0B0D12', dark: true, color: '#F3EEE4', bleed: true }, <>
    <div className="pad">{photonHead}{band}{photonBody}</div>
    {label('the object · design sheets', 'swipe →', '#6FD7FF', '#8A8F9C', { marginTop: "42px", padding: "0 20px" })}
    <PhotonSheets items={sheetItems} />
  </>);

  // 08 The Human Manual: five suits fanned out; a zone over each (hover on web, tap on either) pulls it up
  const HAND = web ? { w: 590, h: 420, z0: 60, zw: 94, lift: [14, 2, -34, 2, 14] } : { w: 350, h: 310, z0: 22, zw: 61, lift: [12, 2, -26, 2, 12] };
  const hand = (
    <div className="hand" style={{ marginTop: W("26px", undefined), width: `${HAND.w}px`, height: `${HAND.h}px` }}>
      {SUITS.map((s, i) => <button key={s[2]} className={`hz hz${i + 1}`} type="button" aria-label={`Pull ${s[2]}: ${s[5]}`} aria-pressed={card === i + 1 ? 'true' : 'false'} onClick={() => setCard(card === i + 1 ? 0 : i + 1)} style={{ left: `${HAND.z0 + i * HAND.zw}px`, width: `${HAND.zw}px` }} />)}
      {SUITS.map(([g, color, k, nm, sb], i) => (
        <div key={k} className={`hcard hc${i + 1}${card === i + 1 ? ' up' : ''}`} style={{ '--t': `rotate(${(i - 2) * 12}deg) translateY(${HAND.lift[i]}px)`, ...(i === 2 && { boxShadow: `0 ${W(22, 26)}px ${W(40, 50)}px rgba(0,0,0,.6)` }) }}>
          <span className="g" style={{ color }} aria-hidden="true">{g}</span><span className="k">{k}</span><span className="nm">{nm}</span><span className="sb">{sb}</span>
        </div>
      ))}
    </div>
  );
  const hmHead = <>
    <Meta web={web} k="08 · teen psychology" t="team unfiltered minds" color="#FF7FB0" dim="#9D978A" />
    <h2 className="d" style={{ marginTop: W("18px", "22px"), fontSize: W("52px", "92px") }}>{web ? <>The Human<br />Manual</> : 'The Human Manual'}</h2>
    <p className="s" style={{ marginTop: W("14px", "18px"), fontSize: W("27px", "36px"), lineHeight: W("1.12", "1.1"), color: "#FF7FD9" }}>a thousand questions about you. no filters, no advice, no adults.</p>
  </>;
  const hmText = 'unfiltered minds wrote it as a deck instead of a lecture: the questions you already ask yourself at 2am, sorted into suits you can actually name. pick your poison, draw a prompt, fill the blank honestly.';
  const suitsNote = <p className="m" style={{ marginTop: W("4px", "6px"), textAlign: "center", fontSize: W("9.5px", "10.5px"), color: "#9D978A" }}>5 suits · 1000+ prompts</p>;
  const hmUrl = 'https://human-manual.vercel.app/';
  const humanManual = web ? wrap({ id: 'human-manual', bg: '#111111', dark: true, color: '#F3EEE4' }, <>
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0, 1fr) 590px", gap: "60px", alignItems: "center" }}>
      <div style={{ display: "flex", flexDirection: "column" }}>{hmHead}{lead(hmText, "#D2CCBE", { marginTop: "18px" })}<div style={{ marginTop: "28px" }}><Ext href={hmUrl}>visit website</Ext></div></div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>{hand}{suitsNote}</div>
    </div>
  </>) : wrap({ id: 'human-manual', bg: '#111111', dark: true, color: '#F3EEE4' }, <>
    {hmHead}{hand}{suitsNote}{lead(hmText, "#D2CCBE", { marginTop: "26px" })}<div style={{ display: "flex", marginTop: "18px" }}><Ext href={hmUrl}>visit website</Ext></div>
  </>);

  const page = (
    <div className={`labs ${web ? 'labs-web' : 'labs-phone'}`} style={AQ_LOOK ? undefined : { width: web ? "1440px" : "390px" }}>
      {web ? <WebHeader /> : <PhoneHeader current="article" edge={tagOf(a).color} />}
      {web && <BackToMagazine web />} {/* inside AQ (phone: AQ Labs' own tabs sit there) */}
      <Tabs web={web} active={web ? active : ch} base={base} onTab={onTab} />
      {/* inside AQ, whose page has its own <main>: a region, so there is one main landmark */}
      <Main ref={main} {...(HOST.embedded && { role: 'region', 'aria-label': 'AQ Labs' })} style={{ display: "flex", flexDirection: "column" }}>
        {(web || !ch) && intro}
        {karyaarth}{careerCompass}{quirk}{wisdomWoods}{cirqle}{hunar}{photon}{humanManual}
      </Main>
      {!web && shownSheet && <ProjectSheet ch={ch} leaving={sheetLeaving} main={main} onPick={open} onClose={closeSheet} />}
      {shownStill != null && <PhotoViewer web={web} photos={stills} title="Karyaarth" label="Still" count="Stills" start={shownStill} closing={stillLeaving} onClose={() => setStill(null)} />}
    </div>
  );
  return <><style>{labsCss}</style>{web ? <div className="web">{page}</div> : page}</>;
}
