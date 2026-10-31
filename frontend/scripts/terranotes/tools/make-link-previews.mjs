// Link-preview pictures (1200×630, the shape WhatsApp, Instagram, iMessage… show big), all kept together in public/og/
// (src/data/editions.js ogImage):
//   home-<id>.jpg       the main page while that edition is the latest (home-oct26.jpg): it and the editions before it as
//                       notebooks from the opening animation ("Top secret", its issue in a foil box), fanned beside the
//                       TerraNotes name. One per live or scheduled edition; pages use the latest's
//   <edition id>.jpg    each edition (sep26.jpg): its paper (September ruled notebook, October's Pujo ribbon and toran),
//                       the name, its month and a "No. 01" stamp, and up to three of its covers (topped up from its
//                       photo wall) hanging on a string
//   <id>-<slug>.jpg     each article (sep26-labs.jpg): on its edition's paper, the cover hanging in a frame its own shape
//                       (never cropped), a "TerraNotes · No. 01 · September 2026" tape, the tag, title, dek and byline
//   <id>-game-<g>.jpg   each of Buddy's games in each edition (data/games.js; /games/<g>, /sep26/games/<g>): on the
//                       edition's paper, its title and how-to, and its little arcade screen (shared/GameCard.jsx) big
//   <id>-games.jpg      an edition's /games: the three screens together
// The build (build/siteFiles.js; inside AQ, its prerender) points each page at its picture under a content-hashed name.
// Run after adding an article, changing a cover or adding an edition:  node scripts/terranotes/tools/make-link-previews.mjs
// (needs Playwright: npm install; env CHROMIUM = a browser to use). The fonts are the site's own (public/fonts,
// src/styles/fontfaces.css), put in each picture's page, so nothing is fetched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { ALL_ARTICLES, tagOf } from '../../../src/terranotes/data/articles.js';
import { EDITIONS, editionId, ogImage } from '../../../src/terranotes/data/editions.js';
import { GAMES, gamesFor } from '../../../src/terranotes/data/games.js';
import { editionData } from '../../../src/terranotes/editions/index.js';
import { withBase } from '../../../src/terranotes/lib/base.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'); // the project (inside AQ: its frontend/)
const pub = (url) => path.join(root, 'public', url.replace(/^\//, '')); // a site URL (with AQ's base) → its file
const TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const data = (url) => `data:${TYPES[url.split('.').pop().toLowerCase()]};base64,${fs.readFileSync(pub(url)).toString('base64')}`;
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pad = (n) => String(n).padStart(2, '0');
// every font face the site has, with its file inlined (so the screenshots never wait on, or miss, a font)
const FACES = fs.readFileSync(path.join(root, 'src/styles/fontfaces.css'), 'utf8').replace(/url\((\/fonts\/[^)]+\.woff2)\)/g, (m, f) => `url(data:font/woff2;base64,${fs.readFileSync(pub(f)).toString('base64')})`);
const globe = data(withBase('/brand/aquaterra-globe.webp')), word = data(withBase('/brand/aquaterra-wordmark.webp'));
// a cover: its small card copy when there is one (tools/make-card-covers.mjs), else the original
const cover = (a) => { const card = a.cover.replace(/cover\.jpg$/, 'cover-card.webp'); return data(fs.existsSync(pub(card)) ? card : a.cover); };
const SIZE = new Map(); // picture → [w, h], so every frame takes its picture's own shape (nothing cropped)
const fit = (src, maxW, maxH) => { const [w, h] = SIZE.get(src); const k = Math.min(maxW / w, maxH / h); return [Math.round(w * k), Math.round(h * k)]; };

// the edition's paper: September a ruled notebook page, October bright Pujo cream with its ribbon, dots and a toran;
// an edition not listed here gets its plain page colour until it's given its own (and its own line in TAGLINE)
function paper(id, C) {
  if (id !== 'sep26' && id !== 'oct26') return `body{background:${C.page}}`;
  if (id === 'sep26') return `
    body{background:${C.page};background-image:linear-gradient(to right,transparent 0 108px,rgba(229,72,77,.55) 108px 110px,transparent 110px),repeating-linear-gradient(to bottom,transparent 0 31px,rgba(61,123,253,.18) 31px 32px);background-position:0 0,0 14px}
    .holes i{position:absolute;left:34px;width:30px;height:30px;border-radius:50%;background:${C.outside};box-shadow:inset 0 2px 3px rgba(0,0,0,.18)}`;
  return `
    body{background:${C.page};background-image:linear-gradient(to right,#F0214A 0 22px,#FFC914 22px 28px,#18C7B8 28px 33px,transparent 33px calc(100% - 33px),#18C7B8 calc(100% - 33px) calc(100% - 28px),#FFC914 calc(100% - 28px) calc(100% - 22px),#F0214A calc(100% - 22px)),radial-gradient(circle,rgba(232,17,95,.16) 0 2.5px,transparent 3px),radial-gradient(circle,rgba(24,199,184,.16) 0 2.5px,transparent 3px);background-size:auto,36px 36px,36px 36px;background-position:0 0,0 0,18px 18px}`;
}
function toran(C) { // marigolds across the top, a mango leaf every few
  let s = '<svg class="toran" width="1200" height="70" viewBox="0 0 1200 70">', y = (x) => 8 + 22 * Math.sin(Math.PI * ((x % 300) / 300));
  for (let k = 0; k < 4; k++) for (const f of [0.25, 0.5, 0.75]) { const x = k * 300 + f * 300; s += `<path d="M${x} ${y(x) + 4} q-9 18 0 34 q9 -16 0 -34 Z" fill="${C.green}" stroke="${C.ink}" stroke-width="1.4"/>`; }
  for (let x = 6, i = 0; x < 1200; x += 14, i++) s += `<circle cx="${x}" cy="${y(x)}" r="7" fill="${i % 3 === 2 ? C.red : C.yellow}" stroke="${C.ink}" stroke-width="1.2"/>`;
  return s + '</svg>';
}
const TAGLINE = { sep26: 'exam season: write-ups, photos & words', oct26: 'the Pujo issue: pandals, dhak & bhog' };
function shell(e, inner, extraCss = '') {
  const { look: { colors: C, fonts: F, fontsCss } } = editionData(e.number);
  const sep = e.id === 'sep26';
  return `<!doctype html><html><head><style>${FACES}</style>${fontsCss ? `<link rel="stylesheet" href="${fontsCss}">` : ''}<style>
  *{box-sizing:border-box} body{margin:0;width:1200px;height:630px;overflow:hidden;position:relative;font-family:${F.body};color:${C.ink}}
  ${paper(e.id, C)}
  .toran{position:absolute;left:0;top:0}
  .badge{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;width:150px;height:150px;border-radius:50%;background:${sep ? C.yellow : C.hand};color:${sep ? C.ink : C.card};border:3px solid ${C.ink};box-shadow:6px 6px 0 ${C.ink};transform:rotate(-10deg);font:700 15px/1.1 ${F.mono};letter-spacing:2px;text-transform:uppercase;text-align:center}
  .badge b{display:block;font:400 64px/1 ${F.head};letter-spacing:-1px;margin:2px 0}
  .logo{display:flex;align-items:center;gap:12px} .logo .g{width:58px;height:58px} .logo .w{height:32px;display:block}
  ${extraCss}
  </style></head><body>${sep ? '<div class="holes"><i style="top:120px"></i><i style="top:300px"></i><i style="top:480px"></i></div>' : e.id === 'oct26' ? toran(C) : ''}${inner}</body></html>`;
}

function editionCard(e) {
  const d = editionData(e.number), { colors: C, fonts: F } = d.look, sep = e.id === 'sep26';
  // up to three prints on the wire: the edition's covers, topped up from its photo wall (October: Maa Durga)
  const picks = [...d.articles.filter((a) => a.cover).map((a) => ({ src: cover(a), color: tagOf(a).color })),
    ...d.photos.filter((x) => x.photo).map((x) => ({ src: data(x.photo), color: C.yellow }))].slice(0, 3);
  const spots = [[650, 150, -6], [835, 120, 3], [1000, 165, -2]];
  const cards = picks.map((k, i) => { const [x, y, r] = spots[i + (3 - picks.length)];
    const [w, h] = fit(k.src, 175, 210);
    return `<div class="hang" style="left:${x}px;top:${y}px;transform:rotate(${r}deg)"><div class="rope"></div><div class="peg" style="background:${k.color}"></div><img src="${k.src}" style="width:${w}px;height:${h}px"></div>`; }).join('');
  const css = `
  .left{position:absolute;left:${sep ? 150 : 80}px;top:${sep ? 96 : 120}px;width:520px}
  .kicker{font:700 17px/1 ${F.mono};letter-spacing:3px;text-transform:uppercase;color:${C.text}}
  h1{margin:18px 0 0;font:italic 400 128px/0.9 ${F.serif};letter-spacing:-2px;color:${C.ink}}
  .hand{margin-top:22px;font:700 40px/1.05 ${F.hand};color:${C.hand}}
  .month{margin-top:26px;display:inline-block;background:${C.card};border:3px solid ${C.ink};box-shadow:6px 6px 0 ${sep ? C.yellow : C.string};padding:10px 18px;font:400 26px/1 ${F.head};text-transform:uppercase}
  .wire{position:absolute;left:600px;right:-10px;top:${sep ? 120 : 104}px;height:2.5px;background:${C.string};transform:rotate(1.5deg)}
  .hang{position:absolute;background:${C.card};border:3px solid ${C.ink};box-shadow:10px 10px 0 ${C.ink};padding:9px}
  .hang img{display:block}
  .rope{position:absolute;left:50%;bottom:100%;width:2px;height:60px;background:${C.string}}
  .peg{position:absolute;left:50%;top:-12px;width:36px;height:15px;margin-left:-18px;border:2.5px solid ${C.ink}}
  .foot{position:absolute;left:${sep ? 150 : 80}px;bottom:42px}`;
  return shell(e, `
    <div class="left"><div class="kicker">Aquaterra's monthly magazine</div><h1>TerraNotes</h1>
      <div class="hand">${esc(TAGLINE[e.id] || `${e.month}: write-ups, photos & words`)}</div>
      <div class="month">${esc(e.month)}</div></div>
    <div class="wire"></div>${cards}
    <div class="badge" style="right:60px;bottom:40px">No.<b>${pad(e.number)}</b>edition</div>
    <div class="foot logo"><img class="g" src="${globe}"><img class="w" src="${word}"></div>`, css);
}

function articleCard(e, a) {
  const d = editionData(e.number), { colors: C, fonts: F } = d.look, sep = e.id === 'sep26', t = tagOf(a);
  const src = cover(a), [w, h] = fit(src, 400, 440), x0 = sep ? 150 : 76, top = Math.round((630 - h - 24) / 2) + 14;
  const css = `
  .hang{position:absolute;left:${x0}px;top:${top}px;background:${C.card};border:3px solid ${C.ink};box-shadow:12px 12px 0 ${t.color};padding:12px;transform:rotate(-2deg)}
  .hang img{display:block;width:${w}px;height:${h}px}
  .rope{position:absolute;left:50%;bottom:100%;width:2.5px;height:${top + 20}px;background:${C.string}}
  .peg{position:absolute;left:50%;top:-14px;width:46px;height:18px;margin-left:-23px;background:${t.color};border:2.5px solid ${C.ink}}
  .right{position:absolute;left:${x0 + w + 24 + 60}px;right:${sep ? 60 : 70}px;top:${sep ? 70 : 96}px;bottom:46px;display:flex;flex-direction:column}
  .ed{align-self:flex-start;background:${sep ? C.yellow : C.hand};color:${sep ? C.ink : C.card};border:2.5px solid ${C.ink};box-shadow:4px 4px 0 ${C.ink};padding:8px 14px;font:700 16px/1 ${F.mono};letter-spacing:2px;text-transform:uppercase;transform:rotate(-2deg)}
  .tag{align-self:flex-start;margin-top:22px;background:${t.color};color:${t.ink};border:2.5px solid ${C.ink};border-radius:999px;padding:6px 16px;font:700 16px/1 ${F.mono};letter-spacing:2px;text-transform:uppercase}
  h1{margin:16px 0 0;font:400 60px/0.98 ${F.head};text-transform:uppercase;letter-spacing:-1px;color:${C.ink}}
  .dek{margin-top:14px;font:700 32px/1.05 ${F.hand};color:${C.hand}}
  .by{margin-top:auto;display:flex;align-items:center;justify-content:space-between;font:700 16px/1 ${F.mono};letter-spacing:2px;text-transform:uppercase;color:${C.text}}`;
  return shell(e, `
    <div class="hang"><div class="rope"></div><div class="peg"></div><img src="${src}"></div>
    <div class="right"><div class="ed">TerraNotes · No. ${pad(e.number)} · ${esc(e.month)}</div><div class="tag">${esc(a.tag)}</div>
      <h1 id="t">${esc(a.title)}</h1><div class="dek">${esc(a.dek)}</div>
      <div class="by"><span>${a.author ? `By ${esc(a.author)}` : 'TerraNotes'}</span><span class="logo"><img class="g" src="${globe}" style="width:44px;height:44px"><img class="w" src="${word}" style="height:24px"></span></div></div>`, css);
}


// the main page: the magazine itself. Every edition as its notebook from the opening animation (its cover colour, the
// "Top secret" foil and its number in a foil box), fanned on a desk, newest on top, beside the name.
// One per edition (home-<id>.jpg), drawn as the main page is while that edition is the latest: it and the ones before
// it, in its look. So a scheduled edition (data/editions.js `live`) has its own ready, unused until it goes live.
const SHOWN = EDITIONS.filter((e) => !e.draft || e.until); // live and scheduled ones (not plain drafts)
function mainCard(top) {
  // a few editions fan wide; more fan tighter (spacing and tilt shrink) so the fan stays clear of the name
  const eds = SHOWN.filter((e) => e.number <= top), L = editionData(top).look, F = L.fonts;
  const n = eds.length, gap = n <= 2 ? 235 : 440 / (n - 1), tilt = n <= 2 ? 10 : 18 / Math.max(1, (n - 1) / 2) / 2, mid = n <= 2 ? 790 : 860;
  const books = eds.map((e, i) => { const { colors: c, fonts: f } = editionData(e.number).look, k = i - (n - 1) / 2;
    return `<div class="book" style="left:${mid + k * gap}px;top:${118 + Math.abs(k) * (n <= 2 ? 24 : 12)}px;transform:rotate(${k * tilt}deg);z-index:${i};background:${c.text};box-shadow:10px 10px 0 ${c.ink}">
      <div class="imp"><div class="s">Aquaterra · field notes</div><div class="sec" style="color:${c.yellow};font-family:${f.head}">Top<br>secret</div>
      <div class="rule"></div><div class="nm" style="font-family:${f.serif}">TerraNotes</div>
      <div class="iss" style="color:${c.yellow};border-color:${c.yellow};font-family:${f.head}">Issue ${pad(e.number)}</div><div class="mo" style="color:${c.page}">${esc(e.month)}</div></div></div>`; }).join('');
  return `<!doctype html><html><head><style>${FACES}</style>${[...new Set(eds.map((e) => editionData(e.number).look.fontsCss).filter(Boolean))].map((h) => `<link rel="stylesheet" href="${h}">`).join('')}<style>
  *{box-sizing:border-box} body{margin:0;width:1200px;height:630px;overflow:hidden;position:relative;background:#EFEBE1;background-image:radial-gradient(rgba(24,33,58,.09) 1.2px,transparent 1.6px);background-size:22px 22px;font-family:${F.body};color:#18213A}
  .left{position:absolute;left:84px;top:118px;width:520px}
  .kicker{font:700 17px/1 ${F.mono};letter-spacing:3px;text-transform:uppercase;color:#253048}
  h1{margin:16px 0 0;font:italic 400 136px/0.88 'Instrument Serif',serif;letter-spacing:-2px}
  .hand{margin-top:20px;font:700 42px/1.05 'Caveat',cursive;color:#2349B8}
  .line{margin-top:24px;font:500 21px/1.45 'Figtree',sans-serif;color:#253048;max-width:470px}
  .logo{position:absolute;left:84px;bottom:46px;display:flex;align-items:center;gap:12px} .logo .g{width:58px;height:58px} .logo .w{height:32px;display:block}
  .book{position:absolute;width:268px;height:372px;border-radius:4px 12px 12px 4px;border:2.5px solid #18213A;display:flex;align-items:center;justify-content:center}
  .book::before{content:"";position:absolute;left:16px;top:6%;bottom:6%;border-left:1.5px dashed rgba(255,255,255,.3)}
  .imp{display:flex;flex-direction:column;align-items:center;gap:9px;padding:20px 22px;border:2px solid rgba(0,0,0,.32);box-shadow:0 1px 0 rgba(255,255,255,.14),inset 0 1px 0 rgba(255,255,255,.1);text-align:center}
  .s,.nm{color:rgba(0,0,0,.42);text-shadow:0 1px 0 rgba(255,255,255,.16),0 -1px 0 rgba(0,0,0,.35)}
  .s{font:400 11px/1.2 'Space Mono',monospace;letter-spacing:.18em;text-transform:uppercase}
  .nm{font-style:italic;font-size:32px;line-height:1}
  .rule{width:60%;border-top:2px solid rgba(0,0,0,.32);box-shadow:0 1px 0 rgba(255,255,255,.14)}
  .sec{font-size:46px;line-height:.9;text-transform:uppercase;opacity:.85;transform:rotate(-4deg);text-shadow:0 -1px 0 rgba(0,0,0,.45),0 1px 0 rgba(255,255,255,.2)}
  .iss{font-size:24px;line-height:1;text-transform:uppercase;letter-spacing:.04em;padding:5px 11px;border:2px solid;opacity:.9;text-shadow:0 -1px 0 rgba(0,0,0,.45)}
  .mo{font:700 12px/1.2 'Space Mono',monospace;letter-spacing:.14em;text-transform:uppercase}
  .tape{position:absolute;right:60px;bottom:44px;background:#FFD43B;border:2.5px solid #18213A;box-shadow:4px 4px 0 #18213A;padding:9px 16px;font:700 15px/1 'Space Mono',monospace;letter-spacing:2px;text-transform:uppercase;transform:rotate(-3deg)}
  </style></head><body>
  <div class="left"><div class="kicker">Aquaterra's monthly magazine</div><h1>TerraNotes</h1>
    <div class="hand">notes from where the land meets the water</div>
    <div class="line">Stories, research, fashion, photos and art by Aquaterra's students. A new edition every month, each with its own look.</div></div>
  ${books}
  <div class="tape">${eds.length === 1 ? "the first edition · read it" : `${eds.length} editions so far · read them all`}</div>
  <div class="logo"><img class="g" src="${globe}"><img class="w" src="${word}"></div></body></html>`;
}


// Buddy's games: the games card's little arcade screens (shared/GameCard.jsx, drawn the same way), in the look's colours
const GHOST = '<path d="M6 30 C6 14 17 4 30 4 C43 4 54 14 54 30 V60 a8 8 0 0 1 -16 0 a8 8 0 0 1 -16 0 a8 8 0 0 1 -16 0 Z" fill="var(--green)"/><circle cx="21" cy="27" r="6.5" fill="var(--card)"/><circle cx="39" cy="27" r="6.5" fill="var(--card)"/><circle cx="23" cy="25" r="3.4" fill="var(--ink)"/><circle cx="41" cy="25" r="3.4" fill="var(--ink)"/>';
const ART = {
  snake: () => { const c = 14, body = [[1, 4], [2, 4], [3, 4], [3, 3], [3, 2], [4, 2], [5, 2]];
    return body.map(([x, y], i) => `<rect x="${x * c + 12}" y="${y * c + 3}" width="${c - 2}" height="${c - 2}" rx="3" fill="var(--${i === body.length - 1 ? 'mint' : 'snake'})"/>`).join('')
      + `<circle cx="${5 * c + 21}" cy="${2 * c + 7}" r="1.6" fill="var(--ink)"/><path d="M118 24l3.2 8 8.4.8-6.4 5.6 2 8.4-7.2-4.4-7.2 4.4 2-8.4-6.4-5.6 8.4-.8z" transform="translate(2 -4)" fill="var(--yellow)"/>`
      + [[40, 18], [96, 70], [128, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="var(--card)" opacity=".45"/>`).join(''); },
  float: () => { const post = (x, top, h, k) => `<rect x="${x}" y="${top}" width="18" height="${h}" fill="var(--${k})"/><rect x="${x - 3}" y="${top || h - 7}" width="24" height="7" fill="var(--${k})"/>`;
    return post(88, 0, 26, 'red') + post(88, 64, 29, 'red') + post(128, 0, 44, 'blue')
      + [[22, 60, 3], [30, 66, 2.2], [36, 58, 1.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="var(--card)" opacity=".5"/>`).join('')
      + `<g transform="translate(40 26) scale(0.5)">${GHOST}<ellipse cx="30" cy="44" rx="5" ry="6" fill="var(--ink)"/></g>`; },
  fling: () => '<rect x="0" y="80" width="150" height="13" fill="var(--text)"/><path d="M22 80 L24 58 L18 50 M24 58 L30 50" fill="none" stroke="var(--peg)" stroke-width="4" stroke-linecap="round"/>'
    + [[96, 52, 6, 28], [124, 52, 6, 28], [92, 46, 40, 6]].map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--peg)" stroke="var(--ink)" stroke-width="1.2"/>`).join('')
    + '<circle cx="112" cy="72" r="7" fill="var(--green)" stroke="var(--ink)" stroke-width="1.2"/><circle cx="112" cy="39" r="6" fill="var(--green)" stroke="var(--ink)" stroke-width="1.2"/>'
    + [[40, 44], [52, 34], [64, 28], [76, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="var(--card)" opacity=".6"/>`).join('')
    + `<g transform="translate(78 12) scale(0.36)">${GHOST}</g>`,
};
const screen = (id, w, extra = '') => `<svg class="screen" ${extra} width="${w}" height="${Math.round(w * 0.62)}" viewBox="0 0 150 93"><rect width="150" height="93" fill="var(--text)"/>${ART[id]()}</svg>`;
const SHADE = { snake: 'purple', float: 'blue', fling: 'green' };
function gameCard(e, g) { // one game (or all three, g = null) on an edition's paper
  const { colors: C, fonts: F } = editionData(e.number).look, sep = e.id === 'sep26';
  const vars = Object.entries(C).map(([k, v]) => `--${k}:${v}`).join(';');
  const css = `
  :root{${vars}}
  .left{position:absolute;left:${sep ? 150 : 80}px;top:${sep ? 70 : 120}px;width:${g ? (sep ? 420 : 470) : 520}px}
  .kicker{font:700 17px/1 ${F.mono};letter-spacing:3px;text-transform:uppercase;color:${C.text}}
  h1{margin:18px 0 0;font:400 ${g ? 76 : 84}px/0.95 ${F.head};text-transform:uppercase;letter-spacing:-1px;color:${C.ink}}
  .hand{margin-top:18px;font:700 40px/1.05 ${F.hand};color:${C.hand}}
  .play{margin-top:28px;display:inline-block;background:${C.ink};color:${C.card};border:3px solid ${C.ink};box-shadow:6px 6px 0 ${C.yellow};padding:14px 22px;font:700 20px/1 ${F.mono};letter-spacing:2px;text-transform:uppercase}
  .screen{position:absolute;border:3px solid ${C.ink};border-radius:16px;display:block}
  .foot{position:absolute;left:${sep ? 150 : 80}px;bottom:40px}`;
  const big = g ? screen(g.id, 560, `style="left:${sep ? 600 : 590}px;top:${sep ? 150 : 160}px;box-shadow:14px 14px 0 ${C[SHADE[g.id]]};transform:rotate(2deg)"`)
    : GAMES.map((x, i) => screen(x.id, 300, `style="left:${640 + (i % 2) * 230}px;top:${[110, 190, 330][i]}px;box-shadow:10px 10px 0 ${C[SHADE[x.id]]};transform:rotate(${[-4, 3, -2][i]}deg);z-index:${i}"`)).join('');
  return shell(e, `
    <div class="left"><div class="kicker">TerraNotes · ${g ? 'a mini game' : 'mini games'}</div><h1>${esc(g ? g.title : 'Buddy’s games')}</h1>
      <div class="hand">${esc(g ? g.line : 'snake, float & fling, with a ghost')}</div>
      <div class="play">${g ? 'Play it in your browser →' : 'Three games · play free →'}</div></div>
    ${big}
    <div class="foot logo"><img class="g" src="${globe}"><img class="w" src="${word}"></div>`, css);
}

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const measure = async (srcs) => { for (const s of srcs) if (!SIZE.has(s)) SIZE.set(s, await p.evaluate((u) => new Promise((ok) => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.src = u; }), s)); };
const shot = async (html, url) => {
  await p.setContent(html, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  // an article's title shrinks until it fits in four lines
  await p.evaluate(() => { const t = document.getElementById('t'); if (!t) return; let s = 60; while (t.getBoundingClientRect().height > s * 0.98 * 4 + 4 && s > 34) { s -= 2; t.style.fontSize = `${s}px`; } });
  const file = pub(url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await p.screenshot({ path: file, type: 'jpeg', quality: 84 });
  console.log(url, Math.round(fs.statSync(file).size / 1024), 'KB');
};
for (const e of SHOWN) await shot(mainCard(e.number), ogImage.home(e.number));

for (const ed of EDITIONS) {
  const e = { ...ed, id: editionId(ed.number) }, d = editionData(e.number), mine = ALL_ARTICLES.filter((a) => a.edition === e.number && a.cover);
  await measure([...mine.map(cover), ...d.photos.filter((x) => x.photo).map((x) => data(x.photo))]);
  await shot(editionCard(e), ogImage.edition(e.number));
  for (const a of mine) await shot(articleCard(e, a), ogImage.article(a));
  await shot(gameCard(e, null), ogImage.games(e.number));
  for (const g of gamesFor(editionId(e.number))) await shot(gameCard(e, g), ogImage.game(g.id, e.number));
}
await browser.close();
