import SearchPage from '../../search/SearchPage'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler, HandlerCtx } from '../runtime/queryBuilder'
import { clickElement } from '../coach/domActions'
import { ORG_FACTS, displayCount } from '../../lib/orgFacts'
import type { DemoFlow, FixtureStore } from './types'

// ── 19.4: "Search and discovery" (3 steps, spec's own audience note says
// "shows scale - 2,031 write-ups"). That exact figure is NOT used anywhere
// below - checked against lib/orgFacts.ts (19.5's own instruction: "check
// lib/orgFacts.ts for what counts as blocked before putting a number in a
// fixture") and it does not match the live public figure. orgFacts.ts's
// `drivesWrittenUp` (548 as of its last regen) is the honest, current
// "drives written up" count, exposed everywhere else on the real site only
// via `displayCount()` ("500+", never an exact number). "2,031" turns out to
// be a DIFFERENT, internal design-system figure - feed/cards/family03Records.tsx
// and lib/feedShape.ts use it to describe the total row count backing one
// feed-card family, not a number the app ever shows a visitor. Stating it
// here would be exactly the "four different values for the same fact"
// failure orgFacts.ts's own header story exists to prevent, so this flow's
// copy instead cites `displayCount(ORG_FACTS.drivesWrittenUp)` - identical
// to what the real site would render for the same fact - and the fixture
// itself never asserts a specific total in copy at all, only the live
// (fixture) result counts the search page computes for itself per category.
//
// ARCHITECTURE: search/SearchPage.tsx's own text-query + filter-popover path
// was tried and rejected for these steps. Two real, load-bearing reasons,
// both found by reading the component rather than assumed:
//   1. The category discs (`.aqs-disc`, always visible pre-query) hide the
//      moment `hasQuery` becomes true (`{!hasQuery && (<div className=
//      "aqs-discs">...)}`) - a flow mixing "type a query" with "tap a disc"
//      would strand its own spotlight on Back.
//   2. The kind/category/when CHIPS only exist inside the desktop popover or
//      the mobile Sheet - and Sheet.tsx's own doc comment says the body is
//      "clipped by the 108px peek height," i.e. present in the DOM but
//      visually clipped at the `peek` detent. Spotlighting a chip in there
//      would violate this pass's own verification item 7 (the dim must
//      reach all four viewport edges - a clipped ancestor breaks that).
// Three disc taps sidesteps both: discs stay visible and stable across all
// three steps in both directions (never gated on `hasQuery`), each is a
// real, single, always-clickable control, and each produces a REAL (fixture)
// count via the search page's own live query - not a number this file states.
function fixturePost(id: number, category: string, body: string, minutesAgo: number, likeCount: number) {
  return {
    post_id: id,
    uuid: `00000000-0000-4000-d000-${String(id).padStart(12, '0')}`,
    category,
    body,
    link_url: null, link_title: null, link_image: null,
    status: 'published',
    created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    author_id: 600000 + id,
    author_uuid: `00000000-0000-4000-e000-${String(id).padStart(12, '0')}`,
    author_name: AUTHORS[id % AUTHORS.length],
    author_avatar: null,
    author_role: 'member',
    team_uuid: null,
    like_count: likeCount,
    comment_count: Math.max(0, Math.floor(likeCount / 6)),
    images: [],
    tagged_members: [],
    source_type: null, source_slug: null, source_title: null, source_author: null, source_location: null,
    stats: [], source_summary: null, source_stat: null, source_date: null,
    pinned: false, pinned_title: null, featured: false, scheduled_for: null,
  }
}

const AUTHORS = ['Priya Nair', 'Arjun Sengupta', 'Meher Kapoor', 'Dev Chowdhury', 'Rehan Ahmed', 'Ipsita Roy']

const WELFARE_LINES = [
  'Sixty notebooks handed out at Khidirpur this morning - gone in twenty minutes.',
  'Topsia food distribution: two hundred meals, packed and out before 7am.',
  'Blanket count for tonight: one hundred, all claimed before we finished unloading the van.',
  'Sundarban school library shelf is finally up - eight schools done this term.',
  'Diwali stall raised enough for a full month of the Khidirpur tutoring program.',
  'First aid kits dropped off at three schools in Topsia - restocking again next month.',
  'Uniform drive closed out with eleven full sets stitched and delivered.',
  'Winter drive planning meeting - Saturday, usual spot, bring ideas not just hands.',
  'Grocery packets for four families this week - quietly, like always.',
  'Sundarban ferry crossing was rough but every box made it across dry.',
  'Khidirpur toy drive: forty kids, one very loud game of passing-the-parcel.',
  'Stationery kits assembled tonight - two hundred and counting.',
  'Medical camp follow-up: everyone who was flagged last month has been seen.',
  'Topsia shelter roof patch held through the storm - inspection tomorrow.',
  'Rice and dal for the Khidirpur families, same as every second Sunday.',
  'New volunteer orientation for the welfare team this weekend - eleven signed up already.',
  'Sundarban school benches finally repaired - carpentry team came through.',
  'Diwali sweets packed and labelled for the early run tomorrow.',
]
const EVENTS_LINES = [
  'Paradox venue walkthrough done - stage, sound, seating all confirmed.',
  'Ticket sales crossed the first milestone - thank you to whoever shared the link forty times.',
  'Volunteer briefing for fest day is Thursday - attendance matters this year.',
  'Sponsor banners arrived, slightly the wrong size, fixing it tonight.',
  'Green room schedule finalised - no more double-bookings, promise.',
  'Fest day parking plan is up - read it before you drive in.',
  'Anchor script draft is ready for a read-through tomorrow evening.',
  'Merch table layout decided after entirely too long an argument.',
  'Rehearsal ran two hours over and it was worth every minute.',
  'Guest list finalised - badges printing this week.',
  'Sound check slot confirmed for Friday - bring your own cables just in case.',
  'Fest day medical desk staffed and briefed, hoping for a quiet one.',
]
const LABS_LINES = [
  'ShikshAQ pilot session #4 ran long because nobody wanted to stop asking questions.',
  'New whiteboard finally installed in the labs room - overdue by a year.',
  'Coding club first project demo is Friday - come see what they built.',
  'ShikshAQ attendance doubled this month, we need two more volunteer tutors.',
  'Robotics kit donation arrived - unboxing session this weekend.',
  'Science fair prep is underway, ideas board is open for suggestions.',
  'ShikshAQ Saturday batch moved to the bigger room - too popular for the old one.',
  'First laptop lab session went smoothly, minor Wi-Fi drama aside.',
  'Guest lecture on basic electronics scheduled for next Tuesday.',
]

function buildFeedFixture() {
  const rows: ReturnType<typeof fixturePost>[] = []
  let id = 1
  WELFARE_LINES.forEach((body, i) => rows.push(fixturePost(id++, 'welfare', body, 30 + i * 55, 6 + (i * 7) % 40)))
  EVENTS_LINES.forEach((body, i) => rows.push(fixturePost(id++, 'events', body, 20 + i * 70, 4 + (i * 5) % 30)))
  LABS_LINES.forEach((body, i) => rows.push(fixturePost(id++, 'labs', body, 45 + i * 60, 3 + (i * 9) % 25)))
  return rows
}

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  store.seed('post_feed_view', buildFeedFixture())

  return {
    'rpc:get_own_member': () => ({ data: [member], error: null }),
    members: (ctx) => {
      const targetsThisMember = ctx.filters.some(f => f.method === 'eq' && (f.args[0] === 'member_id' ? f.args[1] === member.member_id : f.args[0] === 'auth_uid' ? f.args[1] === member.auth_uid : false))
      return { data: targetsThisMember ? [member] : [], error: null }
    },
    saved_posts: () => ({ data: [], error: null }),
    job_openings: () => ({ data: [], error: null }),

    post_feed_view: (ctx: HandlerCtx) => {
      const rows = store.rows('post_feed_view') as any[]
      const categoryFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'category')
      if (categoryFilter) return { data: rows.filter(r => r.category === categoryFilter.args[1]), error: null, count: rows.length }
      // No category filter - getTrending()'s own date-window query (no
      // category, no q). Real trending-this-week shape, just against the
      // fixture: order by likes, top 4, exactly like the live query does.
      const sorted = [...rows].sort((a, b) => b.like_count - a.like_count)
      return { data: sorted.slice(0, 4), error: null, count: rows.length }
    },
  }
}

// Same rounding rule the real site uses everywhere else - never the raw count.
const DRIVES_FIGURE = displayCount(ORG_FACTS.drivesWrittenUp)

const flow: DemoFlow = {
  id: 'search-discovery',
  name: 'Search and discovery',
  durationLabel: 'under a minute',
  role: 'member',
  roleBorrowed: false,
  buildMember: () => buildFakeMember({ fullName: 'Tanvi Chatterjee', role: 'member', classGrade: '9' }),
  buildHandlers,
  Backdrop: () => <SearchPage />,
  steps: [
    {
      id: 'welfare-disc',
      title: 'Tap a category.',
      body: `There are ${DRIVES_FIGURE} real write-ups like this on the site - start with welfare.`,
      findTarget: () => Array.from(document.querySelectorAll<HTMLElement>('.aqs-disc-wrap')).find(w => /welfare/i.test(w.textContent || ''))?.querySelector<HTMLElement>('.aqs-disc') ?? null,
      doItForMe: ({ target }) => clickElement(target),
      isComplete: (target) => target?.getAttribute('aria-pressed') === 'true',
    },
    {
      id: 'events-disc',
      title: 'Try another.',
      body: 'Every category has its own real feed underneath - not a preview, the actual thing.',
      findTarget: () => Array.from(document.querySelectorAll<HTMLElement>('.aqs-disc-wrap')).find(w => /events/i.test(w.textContent || ''))?.querySelector<HTMLElement>('.aqs-disc') ?? null,
      doItForMe: ({ target }) => clickElement(target),
      isComplete: (target) => target?.getAttribute('aria-pressed') === 'true',
    },
    {
      id: 'labs-disc',
      title: 'And one more.',
      body: 'Same search, same speed, every time - this is what runs when a member looks something up.',
      manualHint: 'or tap the arrow yourself',
      findTarget: () => Array.from(document.querySelectorAll<HTMLElement>('.aqs-disc-wrap')).find(w => /labs/i.test(w.textContent || ''))?.querySelector<HTMLElement>('.aqs-disc') ?? null,
      doItForMe: ({ target }) => clickElement(target),
      isComplete: (target) => target?.getAttribute('aria-pressed') === 'true',
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />searched the<br />whole org.</>,
    body: `Same search bar finds posts, drives, teams and open roles - real results, ${DRIVES_FIGURE} write-ups deep.`,
  },
}

export default flow
