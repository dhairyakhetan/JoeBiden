/**
 * TerraNotes' prerendered pages, sitemap entries and llms.txt.
 * ────────────────────────────────────────────────────────────────────────────
 * Written by the TerraNotes repo (embed/aq/scripts/prerender.mjs, copied here by its tools/export-aq.mjs): edit it
 * there, not here. The magazine's own site does this as a Vite plugin (build/siteFiles.js) against its own index.html.
 * Inside AQ the same job is a pass of scripts/prerender-meta.mjs, which owns dist/index.html and the head/body
 * helpers, so this file only DECIDES what to write; prerender-meta.mjs writes it. Everything comes from
 * src/terranotes/ (data/, editions/; never retyped here), so a new article or edition shows up in the prerender and
 * the sitemap by itself. Drafts (data/editions.js draft: true) are left out. Each edition has a home page (the
 * latest's at /terranotes, an older one's at /terranotes/<id>) with its sections.
 *
 *   terraNotesPages()  → [{ path, file, title, description, type, image, imageAlt, body, copy }]
 *   terraNotesLlms()   → { 'llms.txt': …, 'llms-full.txt': … } (written to dist/terranotes/)
 *
 * `path` is the real address (/terranotes/articles/exam-stress); `file` is where it goes in dist/ (…/exam-stress.html;
 * Vercel's cleanUrls serves it without .html, and a path with no file behind it falls through to the SPA).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ALL_ARTICLES } from '../../src/terranotes/data/articles.js';
import { LATEST, PUBLISHED, articleFolder, articleLink, editionId, editionName, homeLink, isDraft, ogImage } from '../../src/terranotes/data/editions.js';
import { SITE } from '../../src/terranotes/data/site.js';
import { editionData } from '../../src/terranotes/editions/index.js';
import { BASE } from '../../src/terranotes/lib/base.js';
import { articleHtml, editionsHtml, homeHtml, at } from './staticCopy.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(HERE, '../../public');
export const TN_BASE = BASE; // '/terranotes' (src/terranotes/host.js)

const cap = (c) => c.replace(/-/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
// a home page's sections ('' = the page itself) and their titles
const SECTIONS = { '': '', articles: 'All articles', photos: 'Photo wall', words: 'Words we should bring back', members: 'Meet the team' };
const ARTICLES = ALL_ARTICLES.filter((a) => !isDraft(a.edition));
const HOME_DESC = 'Terra Notes by AquaTerra: notes from where the land meets the water. Stories, research, fashion, photos and art, written by students in Kolkata.';

// a link-preview picture (1200×630, made by scripts/terranotes/tools/make-link-previews.mjs, all in
// public/terranotes/og/: data/editions.js ogImage) under a content-hashed name, so chat apps, which cache previews for a
// long time, fetch a new picture whenever it changes; `fallback` when it hasn't been made
function preview(url, fallback = '') {
  const made = path.join(PUBLIC, url);
  if (!fs.existsSync(made)) return { image: fallback, copy: null, wide: false };
  const buf = fs.readFileSync(made);
  const name = url.replace(/\.jpg$/, `-${crypto.createHash('md5').update(buf).digest('hex').slice(0, 8)}.jpg`);
  return { image: name, copy: { to: name.slice(1), buf }, wide: true };
}
const previewFor = (a) => preview(ogImage.article(a), a.cover || '');

export function terraNotesPages(origin = SITE.website) {
  const pages = [];
  // a page with its edition's link preview (n), or the all-editions one (/editions)
  const site = (path, title, body, n) => { const pv = n ? preview(ogImage.edition(n)) : preview(ogImage.home()); pages.push({
    path, file: `${path.slice(1)}.html`,
    title: title ? `Aquaterra — ${title}` : `Terra Notes · ${PUBLISHED.find((e) => e.number === LATEST).month} issue | AquaTerra’s Monthly Digital Magazine`, // names the current issue, like the own site's
    description: title ? `${title} · Terra Notes by AquaTerra.` : HOME_DESC,
    type: 'website', image: pv.image ? `${origin}${pv.image}` : '', imageAlt: n ? `Terra Notes ${editionName(n)}` : 'Terra Notes by AquaTerra', wide: pv.wide,
    label: title || 'Terra Notes', body, copy: pv.copy,
  }); };
  // each edition's home page and its sections, newest first (an older edition's: under its id, its edition in the title),
  // each with its edition's link preview: /terranotes the latest's, /terranotes/sep26 September's. The latest is also
  // written under its id (/terranotes/oct26…; the page sends you on to /terranotes), so an edition's own link shows its month.
  for (const e of [...PUBLISHED].reverse()) {
    for (const alias of e.number === LATEST ? [false, true] : [false]) {
      const old = (e.number !== LATEST || alias) && `${editionName(e.number)} · ${e.month}`;
      for (const [section, name] of Object.entries(SECTIONS)) {
        const p = alias ? `/${editionId(e.number)}${section ? `/${section}` : ''}` : homeLink(e.number, section);
        site(at(p), [name, old].filter(Boolean).join(' · '), homeHtml[section](editionData(e.number)), e.number);
      }
    }
  }
  site(at('/editions'), 'Editions', editionsHtml());
  // each article at its address; one from an older edition also at the address it had while its edition was the latest
  // (/terranotes/articles/<slug>, if no newer article has it), so a link shared then still shows its own preview
  const taken = new Set(ARTICLES.filter((a) => a.edition === LATEST).map((a) => a.slug));
  const earlier = [...ARTICLES].reverse().filter((a) => a.edition !== LATEST && !taken.has(a.slug) && taken.add(a.slug));
  for (const [a, addr] of [...ARTICLES.map((a) => [a, articleLink(a)]), ...earlier.map((a) => [a, `/articles/${a.slug}`])]) {
    const desc = `${a.dek}${a.author ? ` — by ${a.author}` : ''}`;
    const pv = previewFor(a);
    const base = at(addr);
    const one = (p, file, extra = {}) => pages.push({
      path: p, file, title: `Aquaterra — ${a.title}`, description: desc, type: 'article',
      image: pv.image.startsWith('http') ? pv.image : `${origin}${pv.image}`, imageAlt: a.alt || a.title, wide: pv.wide, label: a.title,
      body: articleHtml(a), copy: pv.copy, ...extra,
    });
    one(base, `${base.slice(1)}.html`);
    for (const c of a.chapters || []) one(`${base}/${c}`, `${base.slice(1)}/${c}.html`);
    // A demo opens in its own tab, so its page is a STANDALONE file: just the frame around the team's app. No AQ app boots
    // (no second Supabase client in a second tab, and AQ's one-tab hold screen can't get in the way). `html` is written as is.
    for (const c of Object.keys(a.demos || {})) {
      const name = `${cap(c)} · demo`;
      const src = `${articleFolder(a)}/${a.demos[c]}/`;
      pages.push({ path: `${base}/${c}/demo`, file: `${base.slice(1)}/${c}/demo.html`, standalone: true, html: `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${name}</title>\n<meta name="robots" content="noindex">\n<style>html,body{margin:0;height:100%;background:#111111}iframe{position:fixed;inset:0;width:100%;height:100%;border:0;background:#111111}</style>\n</head>\n<body>\n<iframe src="${src}" title="${cap(c)}, the demo" allow="autoplay; fullscreen"></iframe>\n</body>\n</html>\n` });
    }
  }
  return pages;
}

// sitemap: the pages a person would link to (chapters and demos are sections of an article; the article carries them)
export const terraNotesSitemapPaths = () => [
  ...Object.keys(SECTIONS).map((s) => at(homeLink(LATEST, s))),
  ...PUBLISHED.filter((e) => e.number !== LATEST).map((e) => at(homeLink(e.number))), // an older edition's home page
  at('/editions'),
  ...ARTICLES.map((a) => at(articleLink(a))),
  ...ARTICLES.flatMap((a) => (a.chapters || []).map((c) => `${at(articleLink(a))}/${c}`)),
];

export function terraNotesLlms(origin) {
  const url = (p) => `${origin}${p}`;
  const line = (a) => `${a.dek}${a.author ? ` (by ${a.author}` : ' ('}${a.date ? `${a.author ? ', ' : ''}${a.date}` : ''}, ${a.readTime} min read)`;
  const intro = ['# Terra Notes by AquaTerra', '', `> ${editionData(LATEST).intro} Notes from where the land meets the water.`, '',
    `Terra Notes is the monthly digital magazine of AquaTerra (Kolkata; main site: ${SITE.website}). It is written, photographed and designed by its members. Each article has its own page; the home page also holds the photo wall, a words mini game and the team.`, ''];
  const text = (b) => (typeof b === 'string' ? [b, ''] : b.h2 ? [`### ${b.h2}`, ''] : b.projects ? [...b.projects.map((x) => `- ${x.name}: ${x.what} (${x.meta})`), ''] : []);
  const A = (a) => url(at(articleLink(a)));
  return {
    'llms.txt': [...intro, '## Articles', '', ...ARTICLES.map((a) => `- [${a.title}](${A(a)}): ${line(a)}`), '', '## Pages', '',
      `- [Home](${url(TN_BASE)}): the latest articles, photo wall, words game and team`,
      `- [All articles](${url(TN_BASE + '/articles')}): every article; add ?by=<first name> for one writer's pieces first (e.g. ?by=diti)`,
      `- [Photo wall](${url(TN_BASE + '/photos')}): photos from the community, with captions`,
      `- [Words we should bring back](${url(TN_BASE + '/words')}): a mini game about forgotten words`,
      `- [Meet the team](${url(TN_BASE + '/members')}): the heads, design, writing and tech teams`,
      `- [Editions](${url(TN_BASE + '/editions')}): every monthly edition; the latest is on the home page`,
      '', '## Optional', '', `- [Full text of every article](${url(TN_BASE + '/llms-full.txt')})`, ''].join('\n'),
    'llms-full.txt': [...intro, ...ARTICLES.map((a) => [`## ${a.title}`, '', `${A(a)} · ${a.tag} · ${line(a)}`, '', ...a.body.flatMap(text)].join('\n'))].join('\n'),
  };
}

export { at };
