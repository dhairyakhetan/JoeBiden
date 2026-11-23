import { ORG_FACTS } from './orgFacts'

/**
 * Structured data for every existing public page, keyed by path.
 *
 * Two readers: hooks/useMeta.ts injects it at runtime for any page whose useMeta call carries a matching `path`
 * (so pages get it with no per-page code), and scripts/prerender-meta.mjs bakes the same nodes into the served
 * HTML for crawlers that never run JavaScript. One source, so the two can never disagree.
 *
 * Rules: describe only what the page itself shows. Types are chosen per page (AboutPage, ContactPage,
 * CollectionPage, FAQPage lives on FAQPage.tsx already, SportsEvent/Event for past events with their real
 * dates). Pages that already emit their own richer JSON-LD (blog posts, projects, teams, openings, Terra Notes,
 * the pillar and library pages) are not listed here.
 */

const ORIGIN = 'https://www.ngoaquaterra.com'
const ORG_REF = { '@type': 'Organization', '@id': `${ORIGIN}/#org`, name: 'NGO AquaTerra', url: `${ORIGIN}/` }
const SITE = { '@type': 'WebSite', '@id': `${ORIGIN}/#site`, name: 'AquaTerra', url: `${ORIGIN}/` }
const KOLKATA = { '@type': 'Place', name: 'Kolkata', address: { '@type': 'PostalAddress', addressLocality: 'Kolkata', addressRegion: 'West Bengal', addressCountry: 'IN' } }
const IMPACT_LINKS = ['/impact', '/impact#library', '/projects', '/shikshaq', '/sports', '/ai'].map(p => `${ORIGIN}${p}`)

interface Ctx { title: string; description: string }
type Builder = (c: Ctx) => object[]

function page(type: string, path: string, c: Ctx, extra: Record<string, unknown> = {}): object {
  return {
    '@context': 'https://schema.org',
    '@type': type,
    '@id': `${ORIGIN}${path}#webpage`,
    url: `${ORIGIN}${path}`,
    name: c.title,
    description: c.description,
    inLanguage: 'en-IN',
    isPartOf: SITE,
    publisher: ORG_REF,
    relatedLink: IMPACT_LINKS,
    ...extra,
  }
}
const topics = (...names: string[]) => names.map(name => ({ '@type': 'Thing', name }))
const list = (name: string, items: [string, string][]) => ({
  '@type': 'ItemList',
  name,
  itemListElement: items.map(([label, path], i) => ({ '@type': 'ListItem', position: i + 1, name: label, url: `${ORIGIN}${path}` })),
})

const SCHEMAS: Record<string, Builder> = {
  '/about': c => [page('AboutPage', '/about', c, {
    mainEntity: { ...ORG_REF, foundingDate: ORG_FACTS.foundedOn, foundingLocation: KOLKATA},
    about: topics('Student-run NGO', 'Youth volunteering', 'Community welfare', 'Self-funded nonprofit'),
  })],
  '/projects': c => [page('CollectionPage', '/projects', c, {
    about: topics('Welfare drives', 'Stray dog feeding', 'Food distribution', 'Clothes donation', 'Tree plantation', 'Sundarbans relief', "Children's workshops"),
    mainEntity: list('Drive series', [
      ['Tails and Treats: feeding stray dogs', '/impact/tails-and-treats'], ['Sharbat Seva', '/impact/sharbat-seva'],
      ['Grow Green: plantation drives', '/impact/grow-green'], ['Wear and Share: clothes collection', '/impact/wear-and-share'],
      ['Food for All', '/impact/food-for-all'], ['Book Basket', '/impact/book-basket'], ['Sundarbans relief', '/impact/sundarbans'],
    ]),
  })],
  '/blog': c => [page('CollectionPage', '/blog', c, {
    mainEntity: { '@type': 'Blog', name: 'Groundwork Diaries', url: `${ORIGIN}/blog`, publisher: ORG_REF, inLanguage: 'en-IN' },
    about: topics('Student volunteering stories', 'Welfare drives', 'Youth leadership'),
  })],
  '/teams': c => [page('CollectionPage', '/teams', c, { about: topics('Student-run departments', 'Volunteer teams', 'Youth leadership') })],
  '/members': c => [page('CollectionPage', '/members', c, { about: topics('Student volunteers', 'Youth leadership') })],
  '/opportunities': c => [page('CollectionPage', '/opportunities', c, {
    about: topics('Volunteer opportunities for students', 'Student leadership roles', 'Volunteering in Kolkata'),
    potentialAction: { '@type': 'JoinAction', target: `${ORIGIN}/join`, name: 'Join AquaTerra' },
  })],
  '/contact': c => [page('ContactPage', '/contact', c, {
    mainEntity: { ...ORG_REF, email: 'ngo.aquaterra@gmail.com', contactPoint: { '@type': 'ContactPoint', contactType: 'general enquiries', email: 'ngo.aquaterra@gmail.com', areaServed: 'IN', availableLanguage: ['en', 'hi', 'bn'] } },
  })],
  '/support': c => [page('WebPage', '/support', c, {
    about: topics('Supporting a nonprofit without donating', 'Self-funded NGO', 'Volunteering'),
    mainEntity: { '@type': 'Question', name: 'Does AquaTerra accept donations?', acceptedAnswer: { '@type': 'Answer', text: 'No. AquaTerra does not accept monetary donations. It is self-funded through its own student-run events and Crftd, its student streetwear label. You can help by joining, attending an event, buying from Crftd or partnering with it.' } },
  })],
  '/collaborations': c => [page('WebPage', '/collaborations', c, {
    about: topics('NGO partnerships', 'School partnerships', 'Corporate social responsibility', 'Event co-hosting'),
    potentialAction: { '@type': 'CommunicateAction', target: `${ORIGIN}/contact`, name: 'Propose a collaboration' },
  })],
  '/volunteer': c => [page('WebPage', '/volunteer', c, {
    about: topics('Volunteer handbook', 'How to volunteer as a student', 'Volunteering in Kolkata'),
    potentialAction: { '@type': 'JoinAction', target: `${ORIGIN}/join`, name: 'Join AquaTerra' },
  })],
  '/join': c => [page('WebPage', '/join', c, {
    about: topics('Join a student NGO', 'Free volunteering for teenagers', 'Volunteering in Kolkata'),
    audience: { '@type': 'PeopleAudience', suggestedMinAge: 14, suggestedMaxAge: 19, geographicArea: KOLKATA },
    potentialAction: { '@type': 'JoinAction', target: `${ORIGIN}/login`, name: 'Apply with Google' },
  })],
  '/schools': c => [page('WebPage', '/schools', c, { about: topics('School chapters', 'Student clubs Kolkata', 'Youth volunteering in schools') })],
  '/classes': c => [page('CollectionPage', '/classes', c, { about: topics('Peer tutoring', 'Students teaching students', 'Free classes') })],
  '/crftd': c => [page('WebPage', '/crftd', c, {
    mainEntity: { '@type': 'Brand', name: 'Crftd', alternateName: 'ROOTS', url: `${ORIGIN}/crftd`, description: "AquaTerra's student-run streetwear label. Its profits fund welfare drives." },
    about: topics('Student streetwear', 'Social enterprise', 'Fundraising merchandise'),
  })],
  '/directory': c => [page('CollectionPage', '/directory', c, {
    mainEntity: list('Everything at AquaTerra', [
      ['How we give back', '/impact'], ['Projects', '/projects'], ['Teams', '/teams'], ['ShikshAQ', '/shikshaq'],
      ['Terra Notes', '/terranotes'], ['Sport', '/sports'], ['AI at AquaTerra', '/ai'], ['Open roles', '/opportunities'], ['Join', '/join'],
    ]),
  })],
  '/links': c => [page('CollectionPage', '/links', c, { about: topics('AquaTerra links') })],
  '/games': c => [page('CollectionPage', '/games', c, { about: topics('Browser mini games') })],
  '/privacy-policy': c => [page('WebPage', '/privacy-policy', c, { about: topics('Privacy policy') })],
  '/live': c => [page('WebPage', '/live', c, {
    about: topics('Charity events Kolkata', 'Fundraising nights', 'Student-run events'),
    mainEntity: { '@type': 'EventSeries', name: 'AquaTerra fundraising nights', organizer: ORG_REF, location: KOLKATA, description: "Student-run events whose ticket money funds AquaTerra's welfare drives." },
  })],
  '/live/events': c => [page('CollectionPage', '/live/events', c, { about: topics('Charity events Kolkata', 'Fundraising nights') })],
  '/live/why': c => [page('WebPage', '/live/why', c, { about: topics('How a self-funded NGO pays for its work', 'Fundraising events') })],
  '/live/disco-diwali': c => [page('WebPage', '/live/disco-diwali', c, {
    mainEntity: {
      '@type': 'Event', name: 'Disco Diwali 2026: The Masquerade Sangeet Edition', startDate: '2026-11-10', eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: KOLKATA, organizer: ORG_REF,
      description: "A masquerade sangeet night for charity. Ticket money funds AquaTerra's welfare drives.",
    },
  })],
  '/terrathon': c => [page('WebPage', '/terrathon', c, {
    mainEntity: {
      '@type': 'SportsEvent', name: 'TerraThon 2026', startDate: '2026-10-02', endDate: '2026-10-04', eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode', location: KOLKATA, organizer: ORG_REF, sport: ['Cricket', 'Pickleball', 'FIFA'],
      description: "AquaTerra's three-sport charity tournament for school and college teams. Entry fees fund welfare drives.",
    },
  })],
  '/terrathon/cricket': c => [page('WebPage', '/terrathon/cricket', c, { mainEntity: { '@type': 'SportsEvent', name: 'TerraThon Cricket 2026', startDate: '2026-10-03', endDate: '2026-10-04', sport: 'Cricket', location: KOLKATA, organizer: ORG_REF, superEvent: { '@type': 'SportsEvent', name: 'TerraThon 2026', url: `${ORIGIN}/terrathon` } } })],
  '/terrathon/pickleball': c => [page('WebPage', '/terrathon/pickleball', c, { mainEntity: { '@type': 'SportsEvent', name: 'TerraThon Pickleball 2026', startDate: '2026-10-02', sport: 'Pickleball', location: KOLKATA, organizer: ORG_REF, superEvent: { '@type': 'SportsEvent', name: 'TerraThon 2026', url: `${ORIGIN}/terrathon` } } })],
  '/terrathon/fifa': c => [page('WebPage', '/terrathon/fifa', c, { mainEntity: { '@type': 'SportsEvent', name: 'TerraThon FIFA 2026', startDate: '2026-10-03', sport: 'FIFA (esports)', location: KOLKATA, organizer: ORG_REF, superEvent: { '@type': 'SportsEvent', name: 'TerraThon 2026', url: `${ORIGIN}/terrathon` } } })],
  '/paradox': c => [page('WebPage', '/paradox', c, {
    mainEntity: {
      '@type': 'Festival', name: 'Paradox 2026', startDate: '2026-06-01', endDate: '2026-06-06', location: KOLKATA, organizer: ORG_REF,
      description: "AquaTerra's student-run fest of sport, business, creative and cultural events. Proceeds fund welfare.",
    },
  })],
}

/** Structured data for a path, or [] if the page carries its own (or none is defined). Never throws. */
export function schemaForPath(path: string | undefined, c: Ctx): object[] {
  if (!path) return []
  const b = SCHEMAS[path.replace(/\/+$/, '') || '/']
  try { return b ? JSON.parse(JSON.stringify(b(c))) : [] } catch { return [] }
}

export const SCHEMA_PATHS = Object.keys(SCHEMAS)
