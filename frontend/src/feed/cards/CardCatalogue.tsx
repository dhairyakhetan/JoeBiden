/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SECTION 10 · the rendered chooser
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   All 30 shapes rendered with sample display data, each labelled with its
   selection rule, its reason, and WHETHER THE LIVE DATABASE CAN CURRENTLY
   PRODUCE A ROW THAT REACHES IT. That last column is the point: the catalogue
   is the place where "this shape has nothing to render" stays visible instead
   of turning into a silent dead branch.

   Below the shapes, the chooser itself: the eight families in evaluation order
   and the family-05 tie-break, both driven by the real
   `lib/feedShape.chooseCardShape` rather than by a retyped table. Every row you
   see is an actual call, so the page cannot drift from the code.

   DEV SURFACE. Not routed. See the mounting guide in CHANGELOG_SEC10_34.md.
   The sample copy here is illustrative and is deliberately NOT written into any
   shipping surface: canonical figures only, everything else a live marker.
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

import { useEffect, useMemo } from 'react'
import {
  FAMILY_ORDER,
  chooseCardShape,
  newShapeSession,
  type CardShape,
  type FeedItem,
} from '../../lib/feedShape'
import FeedCard from './FeedCard'
import { MEASURED_AT, RESOLVED_CATALOGUE } from './dataAvailability'
import { composeFeed } from './feedCompose'
import { ORG_FACTS, displayCount } from '../../lib/orgFacts'
import './cards.css'

const FAMILY_LABEL: Record<string, string> = {
  '00-chrome': 'chrome',
  '01-moments': 'moments',
  '02-asks': 'asks',
  '03-records': 'records',
  '04-editorial': 'editorial',
  '05-posts': 'posts',
  '06-digest': 'digest',
  '07-fallback': 'fallback',
}

const FAMILY_WHY: Record<string, string> = {
  '00-chrome': 'not posts at all. States of the surface, so they resolve before any content rule and never enter scoring.',
  '01-moments': 'time-boxed and self-expiring. One per day at most, and they outrank content because tomorrow they are gone.',
  '02-asks': 'the member can change the outcome by acting. Deadline-driven, so they must be seen while they still matter.',
  '03-records': 'durable facts with their own tables. Shape comes from the record type, never from body length.',
  '04-editorial': 'the only family that suppresses engagement counts above the fold.',
  '05-posts': 'free-form member posts. The only family where shape follows content shape, so it needs the tie-break.',
  '06-digest': 'injected at fixed slots, not sorted. Never two in one session.',
  '07-fallback': 'what renders when nothing above qualifies. C29 is terminal and replaces the list rather than appending to it.',
}

/** Post ids that make layoutVariant (and its second draw) land on each C03 layout, in order 0 to 5. */
const C03_LAYOUT_IDS: [string, string][] = [
  ['0 plain', 'sample-22'], ['1 split', 'sample-3'], ['2 lede', 'sample-1'],
  ['3 thumb row', 'sample-14'], ['4 wide', 'sample-6'], ['5 rail', 'sample-5'],
]
/** A flat two-tone photo stand-in, inline so the page needs no network. */
const SAMPLE_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="#cfe3d4"/><circle cx="560" cy="210" r="120" fill="#f3c969"/><path d="M0 600V420q200-120 400-40t400-60v280z" fill="#1B8A5A"/></svg>')

const base = (over: Partial<FeedItem['display']> = {}): FeedItem['display'] => ({
  authorName: 'Ananya Roy',
  authorRole: 'Welfare lead',
  timeLabel: '2h',
  category: 'welfare',
  likeCount: 34,
  commentCount: 6,
  ...over,
})

/** One sample item per shape. Photos are intentionally absent everywhere: the
    posts table has no image columns, and a card with no photo is the honest
    rendering of that. */
const SAMPLES: Record<CardShape, FeedItem> = {
  C01: { id: 'C01', kind: 'post', display: base({ title: '220 meals, one afternoon in Topsia.', body: 'Fourteen of us packed and handed out lunch near the canal.' }) },
  C02: { id: 'C02', kind: 'post', display: base({ category: 'events', title: 'Week two of the reading circle.', body: 'Twenty two kids, same room, better questions.', ctaLabel: 'Read the recap' }) },
  C03: { id: 'C03', kind: 'post', display: base({ title: 'Ninety gifts, one afternoon in Khidirpur.', body: 'The wrapping took longer than the handing out.' }) },
  C04: { id: 'C04', kind: 'post', display: base({ title: 'Khidirpur Christmas drive', meta: '14 Nov 2026 · 24 photos', ctaLabel: 'Open the album' }) },
  C05: { id: 'C05', kind: 'post', display: base({ title: 'We ran out of food in forty minutes. Next month we plan for three hundred.' }) },
  C06: { id: 'C06', kind: 'post', display: base({ category: 'content', kicker: 'blog', meta: '7 min read', title: 'What four years of drives taught us about logistics', body: 'Everyone wants to talk about impact. Almost nobody wants to talk about how the food gets there before it goes cold.' }) },
  C07: { id: 'C07', kind: 'post', display: base({ category: 'operations', title: 'Exam break window is open until the 20th.', body: 'Set it on your profile and your leads will see it. Nothing is removed, and you keep your points.' }) },
  C08: { id: 'C08', kind: 'post', display: base({ title: 'Sundarbans relief recap is up.', body: 'Read it before Saturday briefing.', ctaLabel: 'Open it', secondaryLabel: 'Later' }) },
  C09: { id: 'C09', kind: 'drive', display: base({ kicker: 'sat 14 nov · 10:00', title: 'Khidirpur books', meta: 'Khidirpur, ward 78', filled: 14, needed: 20 }) },
  C10: { id: 'C10', kind: 'drive', display: base({ kicker: 'project · active', title: 'Khidirpur books, phase two', body: 'Four hundred books, six classrooms, one Saturday a month until March.', ctaLabel: 'Join' }) },
  C11: { id: 'C11', kind: 'drive', display: base({ kicker: 'delivered', title: 'Paradox 3.0', figures: [{ value: '1L+', label: 'raised, 300 attendees' }], body: 'Cleared the target in one evening.' }) },
  C12: { id: 'C12', kind: 'person', display: base({ title: 'Best delegate, MUN inter-school', body: 'Verified by a director.', ctaLabel: 'Congratulate' }) },
  C13: { id: 'C13', kind: 'person', display: base({ title: 'RIYA AGARWAL', meta: 'no. live', figures: [{ value: null, label: 'hours' }, { value: null, label: 'drives' }, { value: 'welfare', label: 'desk' }, { value: null, label: 'issued' }], ctaLabel: 'Download PDF', secondaryLabel: 'Share' }) },
  C14: { id: 'C14', kind: 'person', moment: 'welcome', display: base({ title: 'Riya Agarwal just joined Welfare.', meta: 'class 11', ctaLabel: 'Say hi' }) },
  C15: { id: 'C15', kind: 'person', moment: 'birthday', display: base({ title: 'It is Maria birthday.', ctaLabel: 'Wish her', secondaryLabel: 'See wall' }) },
  // Fixed 15.9: the sample body named a reason ("board exams") and referenced
  // the retired points system ("keeps her points") - both wrong, the first
  // because 15.6 forbids rendering break_reason on this card at all (a
  // catalogue that demonstrates the violation is worse than one that omits
  // the field), the second because CLAUDE.md records the points system as
  // retired 2026-09-04. Swapped for BreakModal.tsx's real, live
  // BREAK_REASSURANCE string instead of inventing a replacement.
  C16: { id: 'C16', kind: 'person', moment: 'break', display: base({ title: 'Ananya is on a break until 14 Nov', body: 'your leads will see this. nothing is removed, and your place on the team is kept.' }) },
  C17: { id: 'C17', kind: 'system', digest: 'spotlight', display: base({ kicker: 'team', meta: '+7 this week', title: 'PROJECTS IS 106 DEEP', rows: [{ id: '1', name: 'Aviana', verb: '', time: '' }, { id: '2', name: 'Ishaan', verb: '', time: '' }], ctaLabel: 'See the team' }) },
  C18: { id: 'C18', kind: 'system', ask: 'referral', display: base({ kicker: 'your desk', meta: '4 applied', title: 'Welfare needs a coordinator. Know anyone?', body: 'Your link puts their application in front of a director first.', ctaLabel: 'Copy my link', secondaryLabel: 'WhatsApp' }) },
  C19: { id: 'C19', kind: 'system', ask: 'hiring', display: base({ category: 'content', kicker: 'hiring', meta: 'closes in 6 days', title: 'Design lead', body: 'You would own the look of everything we publish.', filled: 4, ctaLabel: 'Apply' }) },
  C20: { id: 'C20', kind: 'system', record: 'class', display: base({ kicker: 'shikshaq', title: 'Saturday maths, class 8', figures: [{ value: null, label: 'teacher' }, { value: 'beginners', label: 'level' }, { value: null, label: 'room' }], ctaLabel: 'I can teach this' }) },
  C21: { id: 'C21', kind: 'system', record: 'drop', display: base({ kicker: 'crftd', meta: 'sold out soon', title: 'Sundarbans tee, ecru', body: 'profits fund the next drive', figures: [{ value: null, label: 'price' }], ctaLabel: 'Add to bag' }) },
  C22: { id: 'C22', kind: 'system', digest: 'roundup', display: base({ kicker: 'this week', title: 'SEVEN DAYS IN NUMBERS', figures: [{ value: null, label: 'drives run' }, { value: null, label: 'meals out' }, { value: null, label: 'new members' }, { value: null, label: 'hours logged' }] }) },
  C23: { id: 'C23', kind: 'post', chrome: 'queued', display: base({ title: 'Waiting to send', body: 'Your post goes up as soon as you are back online.', ctaLabel: 'Edit' }) },
  C24: { id: 'C24', kind: 'post', chrome: 'skeleton', display: {} },
  // ACCEPTANCE §E: every C25 row needs an href and a >= 44px hit area. The
  // specimen has to demonstrate that, not just the type layout.
  C25: { id: 'C25', kind: 'post', display: base({ rows: [
    { id: '1', name: 'Aaryan Khemka', verb: 'signed up for Saturday', time: '12m', href: '/post/1' },
    { id: '2', name: 'Maria Fernandes', verb: 'posted in shikshaq', time: '40m', href: '/post/2' },
    { id: '3', name: 'Ishaan Basu', verb: 'added 3 photos', time: '1h', href: '/post/3' },
  ] }) },
  C26: { id: 'C26', kind: 'system', ask: 'poll', display: base({ kicker: 'poll', title: 'Which Saturday works for the Khidirpur run?', options: [{ label: '14 November', percent: 62 }, { label: '21 November', percent: 28 }, { label: 'either works', percent: 10 }], meta: '47 votes, closes Thursday' }) },
  C27: { id: 'C27', kind: 'system', ask: 'countdown', display: base({ kicker: 'paradox 3.0', meta: 'you are in', title: 'Paradox 3.0', deadline: null, body: 'Friday, 17:00 to 22:00', ctaLabel: 'See the run sheet' }) },
  C28: { id: 'C28', kind: 'system', digest: 'milestone', display: base({ figures: [{ value: displayCount(ORG_FACTS.drivesWrittenUp), label: 'projects completed' }], body: 'Since June 2021. The first one was a relief trip nobody was qualified to run.' }) },
  C29: { id: 'C29', kind: 'system', terminal: true, display: base({ title: 'You are all caught up.', body: 'Nothing new since this morning. The next drive is Saturday if you want something to do.', ctaLabel: 'See what is coming' }) },
  C30: { id: 'C30', kind: 'system', ask: 'volunteer_gap', display: base({ kicker: 'help needed', meta: 'in 2 days', title: 'Topsia meals is eight people short.', body: 'Two hours, Saturday morning, no experience needed.', filled: 12, needed: 20 }) },
}

const DATA_LABEL = { live: 'ships now', partial: 'partly resolvable', none: 'no data can reach it' } as const

/** The family-05 tie-break, driven by real calls rather than a retyped table. */
function useTieBreak() {
  return useMemo(() => {
    const post = (over: Partial<FeedItem>): FeedItem =>
      ({ id: 't', kind: 'post', category: 'welfare', body: '', imageCount: 0, authorId: 1, display: {}, ...over })
    const cases: { n: number; label: string; item: FeedItem }[] = [
      { n: 1, label: 'featured, imageCount === 1, aspect >= 1.2, body < 240', item: post({ featured: true, imageCount: 1, aspect: 1.5, body: 'short' }) },
      { n: 2, label: 'imageCount >= 3', item: post({ featured: true, imageCount: 3, aspect: 1.5, body: 'x'.repeat(200) }) },
      { n: 3, label: 'imageCount >= 1, mapped hue, body 240 to 600', item: post({ imageCount: 1, body: 'x'.repeat(300) }) },
      { n: 4, label: 'imageCount >= 1', item: post({ imageCount: 1, category: 'hr', body: 'x'.repeat(300) }) },
      { n: 5, label: 'imageCount === 0, body < 180', item: post({ body: 'x'.repeat(100) }) },
      { n: 6, label: 'imageCount === 0', item: post({ body: 'x'.repeat(400) }) },
      { n: 7, label: 'ranker override, below the fold or 4th from one author', item: post({ featured: true, imageCount: 1, aspect: 2, body: 'short', belowFold: true }) },
    ]
    // A fresh session per case, so one case's cap does not decide the next.
    return cases.map(c => ({ ...c, decision: chooseCardShape(c.item, newShapeSession()) }))
  }, [])
}

/**
 * The composition demo. Nine posts from one author, which is the live feed's
 * actual shape (2 distinct authors across 584 rows). Rendered twice: once as a
 * naive host would (one post, one card) and once through `composeFeed`.
 */
function useComposition() {
  return useMemo(() => {
    const rows = ['Ninety gifts, one afternoon in Khidirpur.', 'Week two of the reading circle.',
      'Topsia meals, forty minutes.', 'Sundarbans relief recap is up.', 'Books, six classrooms.',
      'Saturday maths, class 8.', 'Exam break window is open.', 'Paradox 3.0 run sheet.',
      'Khidirpur books, phase two.']
    const items: FeedItem[] = rows.map((body, i) => ({
      id: `x${i}`, kind: 'post', authorId: 1, category: 'welfare', body, imageCount: 0,
      display: { authorName: 'AquaTerra', timeLabel: `${i + 1}h`, category: 'welfare', href: `/post/x${i}` },
    }))
    // Naive: shape each row on its own session-threaded pass, one card per row.
    const session = newShapeSession()
    const naive = items.map(item => ({ item, decision: chooseCardShape(item, session) }))
    return { naive, composed: composeFeed(items) }
  }, [])
}

export default function CardCatalogue() {
  const tieBreak = useTieBreak()
  const { naive, composed } = useComposition()

  // Dev surface, same as dev/ComponentGallery.tsx: title it, and keep it out
  // of any index. It is not in the sitemap, the prerender list or any nav.
  useEffect(() => {
    document.title = 'feed cards - AquaTerra (dev)'
    const m = document.createElement('meta')
    m.name = 'robots'; m.content = 'noindex'
    document.head.appendChild(m)
    return () => { document.head.removeChild(m) }
  }, [])

  return (
    <div style={{ padding: '32px 18px 96px', background: 'var(--bg)', minHeight: '100vh' }}>
      <header style={{ maxWidth: 900, marginBottom: 28 }}>
        <span className="aqc-kicker">section 10 · feed card catalogue · 30 shapes and the chooser</span>
        <h1 className="aqc-title" style={{ fontSize: 40, marginTop: 10 }}>THIRTY SHAPES, ONE <span className="aqc-serif" style={{ fontSize: 40, color: 'var(--welfare-ink)' }}>feed</span>.</h1>
        <p className="aqc-body" style={{ marginTop: 10 }}>
          Eight families in evaluation order. The first family that matches wins, and within a family the first
          matching rule wins. Family 07 always matches, so nothing falls through. This page decides shape only.
          Order comes from AQRank, and a card never computes its own score.
        </p>
      </header>

      {/* The six layouts of C03. The ids are chosen so layoutVariant lands on each one in turn (found by running the same
          hash), which is the only way to see a variant: it is derived from the post's id, not picked. */}
      <section style={{ marginBottom: 40 }} aria-label="C03 layouts">
        <div style={{ maxWidth: 900, marginBottom: 14 }}>
          <span className="aqc-kicker">C03 · six layouts, one shape</span>
          <p className="aqc-body" style={{ marginTop: 6 }}>0 plain, 1 split, 2 lede, 3 thumb row, 4 wide, 5 rail. A post keeps its layout for everyone.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
          {C03_LAYOUT_IDS.map(([label, id]) => (
            <div key={id} style={{ width: 372, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
              <span className="aqc-pill aqc-pill-solid" style={{ background: 'var(--ink)', color: 'var(--paper)', alignSelf: 'flex-start' }}>{label}</span>
              <FeedCard
                item={{ ...SAMPLES.C03, id, display: { ...SAMPLES.C03.display, imageUrl: SAMPLE_PHOTO, imageAlt: 'sample' } }}
                shape="C03"
              />
            </div>
          ))}
        </div>
      </section>

      {FAMILY_ORDER.map(family => (
        <section key={family} style={{ marginBottom: 40 }}>
          <div style={{ maxWidth: 900, marginBottom: 14 }}>
            <span className="aqc-kicker">{family.slice(0, 2)} · {FAMILY_LABEL[family]}</span>
            <p className="aqc-body" style={{ marginTop: 6 }}>{FAMILY_WHY[family]}</p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-start' }}>
            {RESOLVED_CATALOGUE.filter(s => s.family === family).map(entry => (
              <div key={entry.id} style={{ width: 372, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 9 }}>
                <div className="aqc-row">
                  <span className="aqc-pill aqc-pill-solid" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>{entry.id}</span>
                  <span className="aqc-grow" style={{ fontWeight: 800, fontSize: 13 }}>{entry.name}</span>
                  <span
                    className="aqc-pill"
                    style={{ borderStyle: entry.data === 'none' ? 'dashed' : 'solid', color: entry.data === 'none' ? 'var(--ink-3)' : 'var(--ink)' }}
                  >
                    {DATA_LABEL[entry.data]}
                  </span>
                </div>
                <FeedCard item={SAMPLES[entry.id]} shape={entry.id} />
                <p className="aqc-body" style={{ fontSize: 11.5 }}>
                  <b>when</b> {entry.when}<br />
                  <b>why</b> {entry.why}<br />
                  <b>data</b> {entry.dataNote}
                  {entry.corrected ? <><br /><b>note</b> corrected {MEASURED_AT} against the live view; the entry in SHAPE_CATALOGUE is stale and frozen by ACCEPTANCE §E</> : null}
                  {entry.blockedBy ? <><br /><b>needs</b> {entry.blockedBy}</> : null}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      <section style={{ marginBottom: 40 }}>
        <div style={{ maxWidth: 900, marginBottom: 14 }}>
          <span className="aqc-kicker">composition · one card is not always one row</span>
          <p className="aqc-body" style={{ marginTop: 6 }}>
            The chooser is 1:1 by design. On this feed, with two distinct authors across 584 rows, the
            author cap fires on almost everything, so a host that maps one post to one card renders C25
            once per post — each headed with a count of 1. <code>feed/cards/feedCompose.ts</code> groups
            adjacent rows from one author into a single card and re-shapes a group of one back to its
            content shape. Nine posts, one author, both ways:
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          <div style={{ width: 372, maxWidth: '100%' }}>
            <div className="aqc-row" style={{ marginBottom: 9 }}>
              <span className="aqc-pill" style={{ borderStyle: 'dashed', color: 'var(--ink-3)' }}>one row, one card</span>
              <span className="aqc-figure-label">{naive.length} cards</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {naive.map(({ item, decision }) => (
                <FeedCard key={item.id} item={item} shape={decision.shape} />
              ))}
            </div>
          </div>
          <div style={{ width: 372, maxWidth: '100%' }}>
            <div className="aqc-row" style={{ marginBottom: 9 }}>
              <span className="aqc-pill aqc-pill-solid" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>composed</span>
              <span className="aqc-figure-label">{composed.length} cards</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {composed.map(c => (
                <FeedCard key={c.key} item={c.item} shape={c.decision.shape} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section style={{ maxWidth: 900 }}>
        <span className="aqc-kicker">family 05 tie-break · the only family whose conditions overlap</span>
        <p className="aqc-body" style={{ margin: '6px 0 14px' }}>
          Evaluated top to bottom, stopping at the first true. Each row below is a real call into
          <code> chooseCardShape</code>, so this table cannot drift from the code it documents.
        </p>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tieBreak.map(row => (
            <li key={row.n} className="aqc-body">
              <code>{row.label}</code>{' '}
              <span className="aqc-pill aqc-pill-solid" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>{row.decision.shape}</span>{' '}
              <span className="aqc-figure-label">{row.decision.rule}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
