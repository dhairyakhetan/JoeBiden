import { useSearchParams } from '../router.jsx';
import { homeLink } from '../data/editions.js';
import { firstName } from './format.js';
import { useEdition } from './edition.js';

// "Their articles": /articles?by=<first name> (e.g. ?by=diti; a full name works too; an older edition's:
// /sep26/articles?by=…) lists that writer's pieces in that edition first, each with a yellow "by …" tape
// (shared/Tapes.jsx), on both layouts' article lines.
const key = (name) => firstName(name).toLowerCase();
export const byLink = (name, n) => `${homeLink(n, 'articles')}?by=${key(name)}`;
export const articlesBy = (name, articles) => articles.filter((a) => a.author === name);

// The page's edition's articles → { by: the writer's full name or '', mine: their articles, isMine(a), list: every
// article, theirs first }
export function useByWriter() {
  const [q] = useSearchParams();
  const { articles, members } = useEdition();
  const want = (q.get('by') || '').trim().toLowerCase();
  const by = (want && [...members.map((m) => m.name), ...articles.map((a) => a.author)].find((n) => n && (key(n) === want || n.toLowerCase() === want))) || '';
  const isMine = (a) => !!by && a.author === by;
  const mine = articles.filter(isMine);
  return { by, mine, isMine, list: by ? [...mine, ...articles.filter((a) => !isMine(a))] : articles };
}
