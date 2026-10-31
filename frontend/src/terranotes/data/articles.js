import { LATEST } from './editions.js';
import { ALL_ARTICLES, editionData } from '../editions/index.js';

// Articles live in their edition's own folder: src/editions/<edition id>/articles.js (ARTICLES, in order: the order
// sets the numbers, 01, 02…, and the "next on the line" chain; and TAGS, the tags that edition uses). Their fields:
//   slug:     the address: /articles/<slug> while its edition is the latest, then /<edition id>/articles/<slug>
//             (e.g. /sep26/articles/labs; articleLink in data/editions.js). Unique within its edition.
//   tag:      one of the keys in its edition's TAGS (sets the colours)
//   cover:    put the picture in public/editions/<edition id>/articles/<slug>/cover.jpg and write that path, e.g.
//             '/editions/sep26/articles/wetlands/cover.jpg' (the article's own folder: its photos go there too)
//   alt:      a few words describing the cover (also the placeholder label until there is one)
//   author:   the writer's name (a member in the edition's team.js also gets their photo in the "words by" box);
//             null = no writer (no byline, no "words by" box), for pieces from Aquaterra itself
//   featured: true = highlighted: a yellow "★ featured" tape on its cards and a yellow shadow
//   date:     the edition's month, e.g. 'Sep 2026'
//   readTime: minutes, e.g. '6'
//   body:     the article, top to bottom. Each item is one block:
//     'Some text.'                                         paragraph (the first one gets the drop cap; a \n inside
//                                                          breaks the line there, for a poem's stanza)
//     { h2: 'Heading' }                                    section heading
//     { quote: 'The line.', by: 'who said it' }            pull quote
//     { photo: '/editions/…/x.jpg', caption: '' }          pinned photo
//     { photos: [{ photo, caption }, { photo, caption }] } two small photos
//     { log: [['PLACE', 'Kolkata'], ['VISITS', '3']] }     yellow field log box (web: in the margin)
//     { numbers: [['label', 'value'], …], title }         yellow tally card
//     { checklist: [['item', done], …], title }           to-do note, ticked or not
//     { loop: ['step', …], title }                         steps that go round and round
//     { then: [['then', 'now'], …], title, labels }        two-column then / now card
//     { projects: [{ name, what, meta, color, ink }, …] }  numbered coloured project bars (AQ Labs)
//   page:     optional: the article has its own page instead of the usual layout (App.jsx PAGES), e.g. 'labs' →
//             src/articles/labs/. Its body is still what crawlers and AIs read (build/).
//   chapters: optional (own-page articles): section ids that get their own address, <article>/<id> (opens the page
//             scrolled to the element with that id; the address drops the <id> once you scroll away, lib/scrollMemory.js)
//   demos:    optional: { <chapter>: '<folder>' }: a web app kept in the article's folder, opened full-window at
//             <article>/<chapter>/demo (pages/DemoPage.jsx), e.g. { 'wisdom-woods': 'wisdom-woods/demo' }
// Blocks render in shared/ArticleBody.jsx. Leave a field '' and the design's placeholder shows instead.
// After adding or changing an article's cover, run tools/make-link-previews.mjs for its link-preview image (public/og/).
// Each article also gets `edition` (its edition's number, data/editions.js) from the folder it's in.

export { ALL_ARTICLES };
// The latest edition's articles (the home page at / shows them).
export const ARTICLES = editionData(LATEST).articles;
// An article's place in its own edition: { i: 0-based position, n: how many, list: that edition's articles }.
export const placeOf = (a) => { const list = editionData(a.edition).articles; return { i: list.indexOf(a), n: list.length, list }; };
// An article's tag colours ({ color, ink }, from its edition's TAGS).
export const tagOf = (a) => editionData(a.edition).tags[a.tag];
