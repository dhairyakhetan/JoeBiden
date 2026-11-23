import { fillTokens, stripLinks, topicPath } from './topicKit'

/** Photo stories (/impact/stories/<slug>): shared types and structured data, used by StoryPage and the prerender. */

export interface StoryPhoto { slug: string; title: string; date: string; place: string | null; img: string; alt: string; caption: string }
export interface StoryFacts {
  slug: string; topic: string; count: number; volunteers: number; firstDate: string | null; lastDate: string | null
  byYear: Record<string, number>; placesCount: number; topPlaces: { name: string; count: number }[]
  chapters: { year: number; count: number; volunteers: number; photos: StoryPhoto[] }[]
}
export interface StoryCopy {
  slug: string; title: string; description: string; h1Lead: string; h1Accent: string; lede: string
  chapters: Record<string, { heading: string; text: string }>; closing: string; faqs: { q: string; a: string }[]
}
export interface StoryDef { slug: string; topic: string; label: string }

const ORIGIN = 'https://www.ngoaquaterra.com'
const absImg = (u: string) => (/^https?:/.test(u) ? u : `${ORIGIN}${u}`)

/** An Article with an ImageGallery of the story's photos (each linking to its drive), the FAQ, and a breadcrumb. */
export function buildStoryJsonLd(def: StoryDef, copy: StoryCopy, facts: StoryFacts, title: string, description: string): object[] {
  const url = `${ORIGIN}/impact/stories/${def.slug}`
  const photos = facts.chapters.flatMap(c => c.photos)
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': `${url}#story`,
      headline: stripLinks(fillTokens(`${copy.h1Lead} ${copy.h1Accent}`, facts)),
      name: title,
      description,
      url,
      inLanguage: 'en-IN',
      ...(facts.lastDate ? { dateModified: facts.lastDate } : {}),
      author: { '@type': 'Organization', name: 'NGO AquaTerra', url: `${ORIGIN}/` },
      publisher: { '@type': 'Organization', name: 'NGO AquaTerra', url: `${ORIGIN}/` },
      isPartOf: { '@type': 'CollectionPage', name: 'AquaTerra photo stories', url: `${ORIGIN}/impact/stories` },
      about: { '@type': 'Thing', name: def.label.replace(/, in pictures$/, '') },
      relatedLink: [`${ORIGIN}${topicPath(def.topic)}`],
      image: photos.slice(0, 6).map(p => absImg(p.img)),
      hasPart: {
        '@type': 'ImageGallery',
        name: def.label,
        associatedMedia: photos.map(p => ({
          '@type': 'ImageObject',
          contentUrl: absImg(p.img),
          name: p.title,
          caption: p.caption || p.title,
          ...(p.date ? { dateCreated: p.date } : {}),
          ...(p.place ? { contentLocation: { '@type': 'Place', name: p.place } } : {}),
          isPartOf: `${ORIGIN}/projects/${p.slug}`,
        })),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: copy.faqs.map(f => ({ '@type': 'Question', name: fillTokens(f.q, facts), acceptedAnswer: { '@type': 'Answer', text: stripLinks(fillTokens(f.a, facts)) } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${ORIGIN}/` },
        { '@type': 'ListItem', position: 2, name: 'How we give back', item: `${ORIGIN}/impact` },
        { '@type': 'ListItem', position: 3, name: 'Photo stories', item: `${ORIGIN}/impact/stories` },
        { '@type': 'ListItem', position: 4, name: def.label, item: url },
      ],
    },
  ]
}

export function storyToText(def: StoryDef, copy: StoryCopy, facts: StoryFacts): string {
  const f = (s: string) => stripLinks(fillTokens(s, facts))
  const out = [`## ${def.label}`, '', `URL: ${ORIGIN}/impact/stories/${def.slug}`, '', f(copy.lede), '']
  for (const c of facts.chapters) {
    const ch = copy.chapters[String(c.year)]
    if (!ch) continue
    out.push(`### ${c.year}: ${f(ch.heading)}`, '', f(ch.text), '')
    for (const p of c.photos) out.push(`- Photo: ${p.title}${p.place ? `, ${p.place}` : ''} (${p.date}). ${p.caption} ${ORIGIN}/projects/${p.slug}`)
    out.push('')
  }
  out.push(f(copy.closing), '')
  for (const q of copy.faqs) out.push(`Q: ${f(q.q)}`, `A: ${f(q.a)}`, '')
  return out.join('\n')
}
