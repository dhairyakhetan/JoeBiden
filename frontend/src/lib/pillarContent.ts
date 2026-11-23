import { ORG_FACTS, displayCount } from './orgFacts'

/**
 * The "giving back" pillar pages: /impact (the hub), /shikshaq, /sports and /ai.
 *
 * ONE SOURCE, FOUR READERS. This file is read by:
 *   1. public/PillarPage.tsx, which renders it for people;
 *   2. scripts/prerender-meta.mjs, which writes the same words into the served
 *      HTML so a crawler or AI bot that never runs JavaScript reads the full page;
 *   3. the same script's llms-full.txt writer, the long plain-text version for
 *      AI assistants;
 *   4. buildPillarJsonLd() below, the structured data both of the above emit.
 *
 * Because all four read the same strings, the crawler copy can never say more
 * than the page does. That is the rule that keeps this on the right side of
 * Google's hidden-text policy: everything here is visible on the page.
 *
 * WHY THESE PAGES EXIST (owner, 15 Nov 2026): searching for AquaTerra surfaced
 * the event sites (/live, /terrathon, /paradox), each of which has its own rich
 * pages, while the welfare work, the free education platform, sport and the
 * way teams are trained had no page of their own to rank.
 *
 * FACT RULES (docs/BRAND_VOICE.md §3 and §7):
 *   - Every number comes from ORG_FACTS. Never retype one here.
 *   - Funding: say "self-funded through our own events and Crftd". Never the
 *     revenue split, ticket/sponsor mix or an event's profit (§7, internal).
 *   - ShikshAQ: the owner confirmed free exam papers, student-built, open to
 *     non-members. Do NOT claim the tuition itself is free, and do not name
 *     exam boards, until someone confirms them.
 *   - AI training: the owner confirmed member workshops, AI in daily work,
 *     members building with AI and sessions for kids. No counts were given, so
 *     there are none here. Add them to ORG_FACTS first if they become known.
 *
 * House voice: lowercase-leaning, plain, no em dashes, no "noble mission".
 */

const MEMBERS = displayCount(ORG_FACTS.membersTotal)
const DRIVES = displayCount(ORG_FACTS.drivesWrittenUp)
const CHILDREN = displayCount(ORG_FACTS.childrenReached)
const SAPLINGS = displayCount(ORG_FACTS.saplingsPlanted)
const BANANAS = displayCount(ORG_FACTS.bananasDistributed)
const CHECKUPS = displayCount(ORG_FACTS.medicalCheckups)
const DOG_MEALS = displayCount(ORG_FACTS.dogMealsServed)
const FOUNDED_YEAR = ORG_FACTS.foundedOn.slice(0, 4)

export type PillarKey = 'impact' | 'shikshaq' | 'sports' | 'ai'

export interface PillarLink {
  href: string
  label: string
  external?: boolean
}

export interface PillarStat {
  value: string
  label: string
}

export interface PillarSection {
  /** Anchor id, so /impact#welfare can be linked to and cited. */
  id: string
  kicker: string
  heading: string
  /** Paragraphs, plain text. */
  body: string[]
  /** Optional short bullet list under the paragraphs. */
  points?: string[]
  links?: PillarLink[]
  /** Fill colour token for the section's kicker chip (a FILL, never text). */
  fill: string
}

export interface PillarFaq {
  q: string
  a: string
}

export interface Pillar {
  key: PillarKey
  path: string
  /** Breadcrumb and nav label. */
  label: string
  sticker: string
  /** Hero heading, split so the second part renders as the serif accent. */
  h1Lead: string
  h1Accent: string
  lede: string
  heroFill: string
  stats?: PillarStat[]
  sections: PillarSection[]
  faqs: PillarFaq[]
  related: PillarLink[]
  /** schema.org topics this page is about (WebPage.about). */
  about: string[]
}

const IMPACT: Pillar = {
  key: 'impact',
  path: '/impact',
  label: 'How we give back',
  sticker: '★ self-funded since ' + FOUNDED_YEAR,
  h1Lead: 'how we give',
  h1Accent: 'back',
  lede: `AquaTerra is a student-run NGO in Kolkata. ${MEMBERS} teenagers earn the money we spend, then spend it on the people around us: welfare and donation drives, free education, sport and time with kids. we take no donations ourselves and charge no fees.`,
  heroFill: 'var(--welfare)',
  stats: [
    { value: DRIVES, label: 'welfare drives written up since ' + FOUNDED_YEAR },
    { value: CHILDREN, label: 'children reached in workshops and sessions' },
    { value: SAPLINGS, label: 'saplings planted' },
    { value: CHECKUPS, label: 'medical checkups in the Sundarbans' },
    { value: BANANAS, label: 'bananas distributed' },
    { value: DOG_MEALS, label: 'meals for stray dogs' },
  ],
  sections: [
    {
      id: 'self-funded',
      kicker: '01 / we earn what we spend',
      heading: 'every rupee we give, we raised ourselves',
      body: [
        'AquaTerra does not accept monetary donations and charges nothing to join. the money for every drive comes from work our members do: student-run events like Paradox, Disco Diwali and TerraThon, and Crftd, the streetwear label our members design and sell.',
        'that keeps us independent and keeps us honest. when a drive happens, the students who run it are usually the same students who sold the tickets, built the stage or printed the shirts that paid for it.',
      ],
      links: [
        { href: '/crftd', label: 'Crftd' },
        { href: '/live', label: 'our events' },
      ],
      fill: 'var(--lemon)',
    },
    {
      id: 'welfare',
      kicker: '02 / welfare and donations',
      heading: 'welfare drives, run and written up by students',
      body: [
        `since ${FOUNDED_YEAR}, members have run and written up ${DRIVES} welfare drives across Kolkata and West Bengal: food and clothes distributions, plantation drives, medical camps, relief trips to the Sundarbans and feeding runs for stray dogs.`,
        `the numbers so far: ${SAPLINGS} saplings planted, ${BANANAS} bananas distributed, ${CHECKUPS} medical checkups across ${ORG_FACTS.sundarbansTrips} Sundarbans relief trips, ${DOG_MEALS} meals for stray dogs. every drive has its own write-up on the projects page, with photos, so you can check the work rather than take our word for it.`,
      ],
      links: [{ href: '/projects', label: 'every drive since ' + FOUNDED_YEAR }],
      fill: 'var(--welfare)',
    },
    {
      id: 'kids',
      kicker: '03 / time with kids',
      heading: 'interactive sessions with children',
      body: [
        `a lot of what we do is simply showing up for children. members run interactive sessions and workshops for children in schools and communities, from environment lessons to, more recently, sessions on using AI safely. so far that is ${CHILDREN} children reached.`,
        'the volunteers running them are often only a few years older than the kids in the room, which is most of why the sessions work.',
      ],
      links: [{ href: '/projects', label: 'see the sessions' }],
      fill: 'var(--pink)',
    },
    {
      id: 'education',
      kicker: '04 / free education',
      heading: 'ShikshAQ: free exam papers, built by students',
      body: [
        'ShikshAQ is the education platform our members built. it gives any student free access to exam papers and helps them find a teacher, without the student paying to be connected. you do not have to be an AquaTerra member to use it.',
      ],
      links: [
        { href: '/shikshaq', label: 'about ShikshAQ' },
        { href: 'https://shikshaq.in', label: 'shikshaq.in', external: true },
      ],
      fill: 'var(--sky)',
    },
    {
      id: 'culture',
      kicker: '05 / a platform for culture',
      heading: 'Terra Notes: a magazine students write',
      body: [
        "Terra Notes is our monthly digital magazine. it gives students a place to publish: articles, photography, culture and the projects they built, plus a photo wall and a words game. it is free to read, and it exists to put learning and culture in front of more people.",
      ],
      links: [{ href: '/terranotes', label: 'read Terra Notes' }],
      fill: 'var(--teal)',
    },
    {
      id: 'sport',
      kicker: '06 / sport for everyone',
      heading: 'come play',
      body: [
        'we run sport the way we run everything else: open to anyone, organised by students, and paying for welfare. TerraThon brings school and college teams across Kolkata together for cricket, pickleball and FIFA, and the entry fees fund our drives.',
      ],
      links: [{ href: '/sports', label: 'sport at AquaTerra' }],
      fill: 'var(--tomato)',
    },
    {
      id: 'learning',
      kicker: '07 / training our own teams',
      heading: 'teaching members to work with AI',
      body: [
        'we train our members to use AI tools well, in workshops and in the everyday work of running the organisation. members build real things with it, including this website, and take what they learn into sessions with kids.',
      ],
      links: [{ href: '/ai', label: 'how we train with AI' }],
      fill: 'var(--labs)',
    },
    {
      id: 'registered',
      kicker: '08 / legit, and student-run',
      heading: 'a registered trust, run entirely by teenagers',
      body: [
        `AquaTerra started with 16 students in June ${FOUNDED_YEAR}. it is run through TerraRoots, a registered charitable trust (trust reg. no. ${ORG_FACTS.trustRegNo}), listed on DARPAN, the NGO portal of NITI Aayog, Government of India (DARPAN ID ${ORG_FACTS.darpanId}). members are aged ${ORG_FACTS.ageRange}, and they own the work, from planning a drive to writing it up.`,
      ],
      links: [
        { href: '/about', label: 'our story' },
        { href: '/join', label: 'join the work' },
      ],
      fill: 'var(--welfare)',
    },
  ],
  faqs: [
    {
      q: 'Does AquaTerra accept donations?',
      a: 'No. AquaTerra does not accept monetary donations. It is self-funded through its own student-run events (such as Paradox, Disco Diwali and TerraThon) and Crftd, its student streetwear label. If you want to help, join, attend an event, buy from Crftd or partner with us.',
    },
    {
      q: 'What welfare work does AquaTerra do?',
      a: `Food and clothes distributions, plantation drives, medical camps, Sundarbans relief trips, stray dog feeding and sessions with children. Members have written up ${DRIVES} drives since ${FOUNDED_YEAR}, including ${SAPLINGS} saplings planted and ${CHECKUPS} medical checkups.`,
    },
    {
      q: 'Where does the money for the drives come from?',
      a: 'From the members themselves: ticketed student events and Crftd sales. The students who run a drive usually helped raise the money for it.',
    },
    {
      q: 'Is AquaTerra a registered NGO?',
      a: `Yes. AquaTerra runs through TerraRoots, a registered charitable trust (trust reg. no. ${ORG_FACTS.trustRegNo}) listed on DARPAN (ID ${ORG_FACTS.darpanId}).`,
    },
    {
      q: 'Who can volunteer, and does it cost anything?',
      a: `Students aged ${ORG_FACTS.ageRange} can join through the website with a Google sign-in. Joining is free, always.`,
    },
  ],
  related: [
    { href: '/projects', label: 'every drive' },
    { href: '/shikshaq', label: 'ShikshAQ' },
    { href: '/sports', label: 'sport' },
    { href: '/ai', label: 'AI at AquaTerra' },
    { href: '/terranotes', label: 'Terra Notes' },
    { href: '/join', label: 'join' },
  ],
  about: ['Community welfare', 'Donation drives', 'Youth volunteering', 'Free education', 'Youth sport', 'AI literacy'],
}

const SHIKSHAQ: Pillar = {
  key: 'shikshaq',
  path: '/shikshaq',
  label: 'ShikshAQ',
  sticker: '★ free papers · built by students',
  h1Lead: 'ShikshAQ, free',
  h1Accent: 'for every student',
  lede: 'ShikshAQ is the education platform built by AquaTerra members. any student can get exam papers free, and find a teacher without paying to be connected. you do not need to be a member to use it.',
  heroFill: 'var(--sky)',
  sections: [
    {
      id: 'what',
      kicker: '01 / what it is',
      heading: 'free papers and a way to find a teacher',
      body: [
        'ShikshAQ lives at shikshaq.in. it does two things: it gives students free access to exam papers, and it connects them with teachers. getting connected costs the student nothing.',
        'it is open to everyone. a student does not have to join AquaTerra, sign up for anything paid or know anyone to use it.',
      ],
      links: [{ href: 'https://shikshaq.in', label: 'open shikshaq.in', external: true }],
      fill: 'var(--sky)',
    },
    {
      id: 'why',
      kicker: '02 / why we built it',
      heading: 'good material should not depend on who can pay',
      body: [
        'every student needs practice papers and, sometimes, a good teacher. in Kolkata both are easier to find if your family already knows where to look or can afford to pay for it. ShikshAQ is our attempt to close that gap with the one thing we have a lot of: a student community.',
      ],
      fill: 'var(--lemon)',
    },
    {
      id: 'who-built-it',
      kicker: '03 / who runs it',
      heading: 'built and run by AquaTerra students',
      body: [
        `ShikshAQ is one of AquaTerra's student-run ventures, alongside Crftd and AQ.Ventures. it went live in 2026, built on the community of ${MEMBERS} students who make up AquaTerra. the people who maintain it are students who were preparing for the same exams not long ago.`,
      ],
      links: [
        { href: '/teams', label: 'our teams' },
        { href: '/impact', label: 'how we give back' },
      ],
      fill: 'var(--welfare)',
    },
    {
      id: 'help',
      kicker: '04 / get involved',
      heading: 'teachers and students can both help',
      body: [
        'if you teach, or you are a student who wants to help build ShikshAQ, get in touch through Instagram at @shikshaq.in or through our contact page.',
      ],
      links: [
        { href: 'https://instagram.com/shikshaq.in', label: '@shikshaq.in', external: true },
        { href: '/contact', label: 'contact us' },
      ],
      fill: 'var(--pink)',
    },
  ],
  faqs: [
    {
      q: 'Is ShikshAQ free?',
      a: 'Exam papers on ShikshAQ are free for every student, and being connected with a teacher through ShikshAQ costs the student nothing.',
    },
    {
      q: 'Do I need to be an AquaTerra member to use ShikshAQ?',
      a: 'No. ShikshAQ is open to any student.',
    },
    {
      q: 'Who built ShikshAQ?',
      a: 'AquaTerra student members built it and run it. It is one of AquaTerra\'s student-run ventures, launched in 2026.',
    },
    {
      q: 'Where is ShikshAQ?',
      a: 'At https://shikshaq.in, and on Instagram as @shikshaq.in.',
    },
  ],
  related: [
    { href: 'https://shikshaq.in', label: 'shikshaq.in', external: true },
    { href: '/impact', label: 'how we give back' },
    { href: '/terranotes', label: 'Terra Notes' },
    { href: '/classes', label: 'students teaching students' },
  ],
  about: ['Free education', 'Exam papers', 'Finding a tutor', 'Student-built platform'],
}

const SPORTS: Pillar = {
  key: 'sports',
  path: '/sports',
  label: 'Sport',
  sticker: '★ open to every team',
  h1Lead: 'sport, for anyone who wants to',
  h1Accent: 'play',
  lede: 'AquaTerra runs sport for students across Kolkata: open tournaments, organised by teenagers, where the entry fees pay for welfare drives. come play.',
  heroFill: 'var(--tomato)',
  sections: [
    {
      id: 'why',
      kicker: '01 / why sport',
      heading: 'playing is part of the work',
      body: [
        'we want more students on a field, a court or a controller, playing with people they did not know before. sport brings schools together that would not otherwise meet, and it gives our volunteers real things to organise: fixtures, umpires, venues, safety, scores.',
        'and because the tournaments are ticketed by entry fee, every match helps fund a welfare drive.',
      ],
      fill: 'var(--tomato)',
    },
    {
      id: 'terrathon',
      kicker: '02 / TerraThon',
      heading: 'TerraThon: cricket, pickleball and FIFA',
      body: [
        "TerraThon is AquaTerra's three-sport fundraiser. school and college teams from across Kolkata enter cricket, pickleball and FIFA. TerraThon 2026 ran from 2 to 4 October. entry fees go to our welfare projects.",
      ],
      links: [
        { href: '/terrathon', label: 'TerraThon' },
        { href: '/terrathon/rules', label: 'the rules' },
        { href: '/terrathon/schedule', label: 'the schedule' },
      ],
      fill: 'var(--sky)',
    },
    {
      id: 'paradox',
      kicker: '03 / Paradox',
      heading: 'sport inside the fest',
      body: [
        "Paradox, AquaTerra's annual student fest, mixes sport with business, creative and cultural events. the 2026 edition, 1 to 6 June, included a cricket tournament, a pickleball league and an EA FC knockout alongside a model UN, a pitch competition, dance and photography.",
      ],
      links: [{ href: '/paradox', label: 'Paradox' }],
      fill: 'var(--lemon)',
    },
    {
      id: 'next',
      kicker: '04 / the next one',
      heading: 'how to hear about the next tournament',
      body: [
        'tournaments are announced on Instagram at @ngo.aquaterra and on our events hub. schools that want to host or enter a team can write to us.',
      ],
      links: [
        { href: '/live', label: 'events hub' },
        { href: 'https://www.instagram.com/ngo.aquaterra/', label: '@ngo.aquaterra', external: true },
        { href: '/collaborations', label: 'partner with us' },
      ],
      fill: 'var(--welfare)',
    },
  ],
  faqs: [
    {
      q: 'What sports does AquaTerra run?',
      a: 'TerraThon covers cricket, pickleball and FIFA. Paradox has included cricket, pickleball and an EA FC knockout.',
    },
    {
      q: 'Who can play?',
      a: 'School and college teams across Kolkata. Each tournament publishes its own rules.',
    },
    {
      q: 'Where does the entry fee go?',
      a: 'Entry fees fund AquaTerra\'s welfare projects. AquaTerra does not take donations, so its events are how it pays for its drives.',
    },
  ],
  related: [
    { href: '/terrathon', label: 'TerraThon' },
    { href: '/paradox', label: 'Paradox' },
    { href: '/live', label: 'events hub' },
    { href: '/impact', label: 'how we give back' },
  ],
  about: ['Youth sport', 'Cricket', 'Pickleball', 'FIFA', 'Charity tournament'],
}

const AI: Pillar = {
  key: 'ai',
  path: '/ai',
  label: 'AI at AquaTerra',
  sticker: '★ learning by building',
  h1Lead: 'how we train our teams to use',
  h1Accent: 'AI',
  lede: 'AquaTerra trains its student members to use AI tools well: in workshops, in the daily work of running an NGO, in the projects they build, and in sessions where they teach younger kids what they learned.',
  heroFill: 'var(--labs)',
  sections: [
    {
      id: 'workshops',
      kicker: '01 / workshops',
      heading: 'workshops for members',
      body: [
        'we run internal sessions that teach members how to use AI tools for real work, from first drafts and research to design and planning. the point is judgement, not shortcuts: knowing what to ask, and knowing when the answer is wrong.',
      ],
      fill: 'var(--labs)',
    },
    {
      id: 'daily-work',
      kicker: '02 / in the daily work',
      heading: 'AI in how we run the organisation',
      body: [
        'teams use AI in their everyday work: content and design drafts, planning, and the tools our leaders use to run the organisation. this website, including the desks our heads of department use to approve members and posts, is built and maintained by members working with AI coding assistants.',
      ],
      links: [{ href: '/teams', label: 'the teams' }],
      fill: 'var(--sky)',
    },
    {
      id: 'building',
      kicker: '03 / building things',
      heading: 'members ship real projects with it',
      body: [
        'members build real things with AI help: websites, apps and the projects in AQ Labs, written up in the teams\' own words in Terra Notes. building something people actually use is the fastest way we know to learn a tool properly.',
      ],
      links: [{ href: '/terranotes/articles/labs', label: "AQ Labs '26" }],
      fill: 'var(--lemon)',
    },
    {
      id: 'kids',
      kicker: '04 / passing it on',
      heading: 'teaching kids about AI',
      body: [
        'what members learn goes back into the community. volunteers run sessions with children on what AI is, what it is good at, where it gets things wrong, and how to use it safely.',
      ],
      links: [{ href: '/impact#kids', label: 'our sessions with kids' }],
      fill: 'var(--pink)',
    },
    {
      id: 'rules',
      kicker: '05 / the rules we keep',
      heading: 'people stay in charge',
      body: [
        'many of our members are minors, so the technology serves the people, not the other way round. a person approves every post before it goes public. the figures on this site are counted from our own records when the site is built, never typed in by hand. we do not record the sessions of signed-in members for analytics.',
      ],
      fill: 'var(--welfare)',
    },
  ],
  faqs: [
    {
      q: 'Does AquaTerra teach its members to use AI?',
      a: 'Yes. AquaTerra runs internal workshops on using AI tools for real work, and members use AI in their daily work running the organisation and building projects.',
    },
    {
      q: 'Was the AquaTerra website built with AI?',
      a: 'The website and its leadership tools are built and maintained by AquaTerra members working with AI coding assistants.',
    },
    {
      q: 'Does AquaTerra teach children about AI?',
      a: 'Yes. Volunteers run sessions with children on what AI is, where it gets things wrong and how to use it safely.',
    },
    {
      q: 'Does the AI training cost anything?',
      a: 'No. It is part of being an AquaTerra member, and joining is free.',
    },
  ],
  related: [
    { href: '/terranotes/articles/labs', label: "AQ Labs '26" },
    { href: '/impact', label: 'how we give back' },
    { href: '/teams', label: 'teams' },
    { href: '/join', label: 'join' },
  ],
  about: ['Artificial intelligence', 'AI literacy', 'Youth digital skills', 'Learning by doing'],
}

export const PILLARS: Record<PillarKey, Pillar> = {
  impact: IMPACT,
  shikshaq: SHIKSHAQ,
  sports: SPORTS,
  ai: AI,
}

export const PILLAR_ORDER: PillarKey[] = ['impact', 'shikshaq', 'sports', 'ai']

const ORIGIN = 'https://www.ngoaquaterra.com'

/** Absolute URL for a pillar link (external links pass through). */
function abs(href: string): string {
  return /^https?:/.test(href) ? href : `${ORIGIN}${href}`
}

/**
 * The structured data for one pillar page: a WebPage that names its topics and
 * links back to the organisation, and a FAQPage carrying the same questions
 * and answers the page shows. ShikshAQ also gets its own Organization node so
 * it is recognised as a project of AquaTerra.
 */
export function buildPillarJsonLd(p: Pillar, title: string, description: string): object[] {
  const url = `${ORIGIN}${p.path}`
  const nodes: object[] = [
    {
      '@context': 'https://schema.org',
      '@type': p.key === 'impact' ? 'AboutPage' : 'WebPage',
      '@id': `${url}#webpage`,
      url,
      name: title,
      description,
      inLanguage: 'en-IN',
      isPartOf: { '@type': 'WebSite', name: 'AquaTerra', url: `${ORIGIN}/` },
      about: p.about.map(name => ({ '@type': 'Thing', name })),
      publisher: { '@type': 'Organization', name: 'NGO AquaTerra', url: `${ORIGIN}/` },
      hasPart: p.sections.map(s => ({
        '@type': 'WebPageElement',
        '@id': `${url}#${s.id}`,
        name: s.heading,
      })),
      relatedLink: p.related.map(l => abs(l.href)),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: p.faqs.map(f => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]
  if (p.key === 'shikshaq') {
    nodes.push({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://shikshaq.in/#org',
      name: 'ShikshAQ',
      url: 'https://shikshaq.in',
      description: p.lede,
      sameAs: ['https://instagram.com/shikshaq.in'],
      parentOrganization: { '@type': 'Organization', name: 'NGO AquaTerra', url: `${ORIGIN}/` },
      knowsAbout: p.about,
    })
  }
  return nodes
}

/** The page as plain text, for llms-full.txt. Same words as the page. */
export function pillarToText(p: Pillar, title: string): string {
  const out: string[] = [`## ${title}`, '', `URL: ${ORIGIN}${p.path}`, '', p.lede, '']
  if (p.stats?.length) {
    out.push(...p.stats.map(s => `- ${s.value} ${s.label}`), '')
  }
  for (const s of p.sections) {
    out.push(`### ${s.heading}`, '', ...s.body.flatMap(b => [b, '']))
    if (s.points?.length) out.push(...s.points.map(pt => `- ${pt}`), '')
    if (s.links?.length) out.push('Links: ' + s.links.map(l => `${l.label} (${abs(l.href)})`).join(', '), '')
  }
  out.push('### Questions', '')
  for (const f of p.faqs) out.push(`Q: ${f.q}`, `A: ${f.a}`, '')
  return out.join('\n')
}
