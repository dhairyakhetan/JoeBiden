/**
 * The explorers' data rules (/impact/explore/*): page copy, the quiz, and small pure helpers. Kept out of the page
 * so they are tested on their own (exploreKit.test.ts).
 */

/** One drive in facts/_all.json: s slug, t title, d date, p place, v volunteers, i photo, k first drive series. */
export interface DriveLite { s: string; t: string; d: string; p: string | null; v: number; i?: string; k?: string }

export interface Explorer { slug: string; label: string; icon: string; blurb: string; title: string; description: string; h1Lead: string; h1Accent: string; lede: string }

export const EXPLORERS: Explorer[] = [
  {
    slug: 'timeline', label: 'the timeline', icon: '🕰️',
    blurb: 'scrub through every month since June 2021 and watch the drives add up.',
    title: 'AquaTerra Drive Timeline, 2021 to Now | Explore · AquaTerra',
    description: 'scrub month by month through every drive AquaTerra students have run and written up since 2021, with the photos from each month and a running total.',
    h1Lead: 'every month since', h1Accent: '2021',
    lede: 'drag the slider, or press play, to move through every month AquaTerra has been running drives. the photos and drives for that month appear below, and the totals add up as you go.',
  },
  {
    slug: 'calculator', label: 'the impact calculator', icon: '🧮',
    blurb: 'pick any series and any stretch of years and add it up.',
    title: 'AquaTerra Impact Calculator | Add Up Any Drive Series · AquaTerra',
    description: 'add up AquaTerra\'s real numbers for any drive series and any years: drives, volunteer turnouts, places and photos, counted live from every drive written up.',
    h1Lead: 'add up the', h1Accent: 'work',
    lede: 'choose a drive series and a stretch of years, and the numbers below are counted on the spot from every drive our members have written up. no estimates, no rounding up.',
  },
  {
    slug: 'quiz', label: 'find your drive', icon: '🧭',
    blurb: 'four quick questions, and we suggest where you would fit.',
    title: 'Find Your Drive: Which AquaTerra Volunteering Fits You? · AquaTerra',
    description: 'four quick questions for students in Kolkata: whether you like animals, kids, planting or cooking, and how much time you have. we suggest the AquaTerra drives that fit.',
    h1Lead: 'find your', h1Accent: 'drive',
    lede: 'four questions, no sign-in, nothing saved. answer honestly and we will point you at the drive series you would probably enjoy most, with every drive in it one tap away.',
  },
  {
    slug: 'places', label: 'the places', icon: '📍',
    blurb: 'every place we have been back to, sized by how often.',
    title: 'Where AquaTerra Volunteers Go in Kolkata | Places · AquaTerra',
    description: 'every place across Kolkata and West Bengal where AquaTerra students have run more than one drive, sized by how often, with the photos and drives from each.',
    h1Lead: 'the places we keep', h1Accent: 'going back to',
    lede: 'each bubble is a place where our members have run more than one drive. the bigger the bubble, the more often we have been. tap one to see the drives and photos from there.',
  },
  {
    slug: 'map', label: 'the Kolkata map', icon: '🗺️',
    blurb: 'an illustrated map of the neighbourhoods we keep working in.',
    title: 'Map of AquaTerra Drives Across Kolkata | Explore · AquaTerra',
    description: 'an illustrated map of the Kolkata neighbourhoods where AquaTerra students run drives, from Salt Lake to Howrah, with the photos and drives from each.',
    h1Lead: 'our kolkata, on a', h1Accent: 'map',
    lede: 'each pin is a neighbourhood where our members have run four or more drives. the map is drawn by hand and not to scale. tap a pin to see that neighbourhood\'s photos and drives.',
  },
  {
    slug: 'compare', label: 'compare two years', icon: '⚖️',
    blurb: 'put any two years side by side.',
    title: 'Compare Two Years of AquaTerra Drives | Explore · AquaTerra',
    description: 'put any two years of AquaTerra side by side: drives, volunteer turnouts, places, the series that ran most, and photos from each, counted from every drive written up.',
    h1Lead: 'this year or', h1Accent: 'that one',
    lede: 'pick two years and see them side by side. every number is counted from the drives our members wrote up that year.',
  },
  {
    slug: 'surprise', label: 'surprise me', icon: '🎲',
    blurb: 'one button, one random drive, again and again.',
    title: 'Surprise Me: A Random AquaTerra Drive · AquaTerra',
    description: 'press the button and see a random AquaTerra drive from the last five years, with its photo, date and place, then read the whole thing.',
    h1Lead: 'surprise', h1Accent: 'me',
    lede: 'every press shows one drive our members ran, picked at random from all of them. press again for another, or open the one you like.',
  },
  {
    slug: 'memory', label: 'the photo memory game', icon: '🃏',
    blurb: 'match the pairs of drive photos.',
    title: 'Photo Memory Game with AquaTerra Drive Photos · AquaTerra',
    description: 'a small memory game made from real AquaTerra drive photos: turn two cards at a time and find the pairs, then see the drives behind them.',
    h1Lead: 'find the', h1Accent: 'pairs',
    lede: 'six pairs of photos from real drives, face down. turn two at a time. when you have found them all, each one links to the drive it came from.',
  },
]

/** Hand-placed pins for the illustrated map (x, y in a 100 by 100 box, north at the top, not to scale). */
export const MAP_PINS: { slug: string; name: string; x: number; y: number }[] = [
  { slug: 'lake-town', name: 'Lake Town', x: 58, y: 28 },
  { slug: 'bangur', name: 'Bangur', x: 76, y: 13 },
  { slug: 'salt-lake', name: 'Salt Lake', x: 82, y: 42 },
  { slug: 'howrah', name: 'Howrah', x: 22, y: 40 },
  { slug: 'ballygunge-and-topsia', name: 'Ballygunge and Topsia', x: 76, y: 66 },
  { slug: 'sarat-bose-road', name: 'Sarat Bose Road', x: 57, y: 55 },
  { slug: 'bhawanipore', name: 'Bhawanipore', x: 45, y: 69 },
  { slug: 'alipore', name: 'Alipore', x: 33, y: 84 },
]

/** Fisher-Yates over a copy, with an injectable random for tests. */
export function shuffle<T>(xs: T[], rnd: () => number = Math.random): T[] {
  const a = xs.slice()
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/** One year's numbers from the all-drives list. */
export function yearStats(drives: DriveLite[], year: number) {
  const ds = drives.filter(d => d.d.startsWith(String(year)))
  const places = new Set(ds.map(d => normalisePlace(d.p)).filter(Boolean))
  const series = new Map<string, number>()
  for (const d of ds) if (d.k) series.set(d.k, (series.get(d.k) || 0) + 1)
  return {
    year, drives: ds, count: ds.length, turnouts: ds.reduce((s, d) => s + d.v, 0), places: places.size,
    topSeries: [...series.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
  }
}

export interface QuizQ { q: string; options: { label: string; scores: Record<string, number> }[] }

/** Editorial: which drive series suits which answer. Every slug here must be a real topic (tested). */
export const QUIZ: QuizQ[] = [
  {
    q: 'what sounds most like your kind of sunday?',
    options: [
      { label: 'feeding the dogs on my street', scores: { 'tails-and-treats': 3, 'animal-welfare': 2 } },
      { label: 'running an art or games session for kids', scores: { 'arts-and-crafts': 3, 'sport-and-play': 1, 'drama-music-and-dance': 1 } },
      { label: 'planting trees somewhere green', scores: { 'grow-green': 3, 'environment-education': 2 } },
      { label: 'handing out food or cold drinks', scores: { 'food-for-all': 2, 'sharbat-seva': 3 } },
    ],
  },
  {
    q: 'how do you like to help?',
    options: [
      { label: 'out on the street, meeting people', scores: { 'sharbat-seva': 2, 'food-for-all': 2, 'smile-notes': 2 } },
      { label: 'collecting and sorting things people donate', scores: { 'wear-and-share': 3, 'book-basket': 2, 'wear-and-write': 2 } },
      { label: 'teaching or explaining something', scores: { 'reading-speaking-and-english': 3, 'science-and-stem': 2 } },
      { label: 'spending time with older people', scores: { 'respect-and-reach': 3 } },
    ],
  },
  {
    q: 'pick a skill you would like to use.',
    options: [
      { label: 'drawing, craft or design', scores: { 'arts-and-crafts': 3, 'festival-drives': 1 } },
      { label: 'acting, music or dance', scores: { 'drama-music-and-dance': 3 } },
      { label: 'science, maths or computers', scores: { 'science-and-stem': 3, 'ai-and-digital-skills': 2 } },
      { label: 'sport', scores: { 'sport-and-play': 3 } },
    ],
  },
  {
    q: 'how much time do you have?',
    options: [
      { label: 'an hour now and then', scores: { 'tails-and-treats': 2, 'smile-notes': 2, 'sharbat-seva': 1 } },
      { label: 'a morning most weekends', scores: { 'arts-and-crafts': 1, 'reading-speaking-and-english': 1, 'wear-and-share': 1 } },
      { label: 'a full day for something bigger', scores: { sundarbans: 3, 'grow-green': 1, 'festival-drives': 1 } },
      { label: 'not sure yet', scores: { 'tails-and-treats': 1, 'food-for-all': 1, 'arts-and-crafts': 1 } },
    ],
  },
]

/** Slugs ordered by total score, highest first; ties keep the order they first appeared. */
export function scoreQuiz(answers: Record<number, number>): string[] {
  const total = new Map<string, number>()
  QUIZ.forEach((q, qi) => {
    const o = q.options[answers[qi]]
    if (!o) return
    for (const [slug, n] of Object.entries(o.scores)) total.set(slug, (total.get(slug) || 0) + n)
  })
  return [...total.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s)
}

/** "Pather Sathi ", "Pather Saathi" and "pather sathi" are one place; blank is none. Title-cased for display. */
export function normalisePlace(p: string | null | undefined): string {
  const k = String(p || '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/saathi/g, 'sathi').replace(/^ektara/, 'ek tara').replace(/aim 2 foundation/, 'aim foundation')
  if (!k) return ''
  const fixed: Record<string, string> = { 'aim foundation': 'AIM Foundation', 'ek tara': 'Ek Tara' }
  return fixed[k] || k.replace(/\b[a-z]/g, c => c.toUpperCase())
}

export const monthKey = (iso: string) => iso.slice(0, 7)
export function monthLabel(key: string): string {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
