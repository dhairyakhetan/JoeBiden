import HomePage from '../../public/HomePage'
import { buildFakeMember } from '../runtime/fakeIdentity'
import type { TableHandler } from '../runtime/queryBuilder'
import { clickElement, setReactFieldValue, findByText } from '../coach/domActions'
import type { DemoFlow, FixtureStore } from './types'

// ── Fictional people for the backdrop feed. Fictional-but-plausible per
// 19.5, no real member's name or photo. The six bundled drive photos
// (frontend/public/demo/photos/, copied from the repo's own real drive
// photography at ./images/) are the org's own material and are reused
// across these posts' imagery, exactly as 19.5 allows. ──────────────────
interface FixtureAuthor {
  name: string
  avatar: string | null
  role: string
  classGrade: string
}

const AUTHORS: Record<'self' | 'priya' | 'arjun' | 'meher' | 'dev', FixtureAuthor> = {
  self:   { name: 'Ishaan Bhattacharya', avatar: null, role: 'member', classGrade: '11' },
  priya:  { name: 'Priya Nair', avatar: null, role: 'member', classGrade: '10' },
  arjun:  { name: 'Arjun Sengupta', avatar: null, role: 'hod', classGrade: '12' },
  meher:  { name: 'Meher Kapoor', avatar: null, role: 'member', classGrade: '9' },
  dev:    { name: 'Dev Chowdhury', avatar: null, role: 'member', classGrade: '11' },
}

let uuidSeq = 1
function fixtureUuid(): string {
  return `00000000-0000-4000-a000-${String(uuidSeq++).padStart(12, '0')}`
}

interface FixturePostInput {
  author: FixtureAuthor
  category: string
  body: string
  images?: string[]
  minutesAgo: number
  likeCount?: number
  commentCount?: number
}

function makeFixturePost(input: FixturePostInput, postId: number) {
  return {
    post_id: postId,
    uuid: fixtureUuid(),
    category: input.category,
    body: input.body,
    link_url: null,
    link_title: null,
    link_image: null,
    status: 'published',
    created_at: new Date(Date.now() - input.minutesAgo * 60_000).toISOString(),
    author_id: postId * 1000,
    author_uuid: fixtureUuid(),
    author_name: input.author.name,
    author_avatar: input.author.avatar,
    author_role: input.author.role,
    team_uuid: null,
    like_count: input.likeCount ?? 0,
    comment_count: input.commentCount ?? 0,
    images: (input.images ?? []).map((url, i) => ({ url, order: i })),
    tagged_members: [],
    source_type: null,
    source_slug: null,
    source_title: null,
    source_author: null,
    source_location: null,
    stats: [],
    source_summary: null,
    source_stat: null,
    source_date: null,
    pinned: false,
    pinned_title: null,
    featured: false,
    scheduled_for: null,
  }
}

const PHOTOS = {
  khidirpur: '/demo/photos/drive-khidirpur.jpg',
  topsia: '/demo/photos/drive-topsia.jpg',
  kanchrapara: '/demo/photos/drive-kanchrapara.jpg',
  sundarban: '/demo/photos/drive-sundarban.jpg',
  foodDistribution: '/demo/photos/drive-food-distribution.jpg',
  diwali: '/demo/photos/drive-diwali.jpg',
}

function buildFeedFixture() {
  return [
    makeFixturePost({ author: AUTHORS.priya, category: 'welfare', images: [PHOTOS.khidirpur, PHOTOS.topsia],
      body: 'Christmas morning at Khidirpur - sixty kids, one very loud Santa hat, and more notebooks than we could carry in one trip.',
      minutesAgo: 95, likeCount: 34, commentCount: 6 }, 1),
    makeFixturePost({ author: AUTHORS.dev, category: 'operations', images: [PHOTOS.diwali],
      body: 'Diwali fundraiser stall is up and running - come find us near the school gate before assembly tomorrow.',
      minutesAgo: 210, likeCount: 12, commentCount: 2 }, 2),
    makeFixturePost({ author: AUTHORS.arjun, category: 'welfare', images: [PHOTOS.sundarban],
      body: "Sundarban education drive wrapped for the term. Every one of the eight schools we visited this year now has a working library shelf.",
      minutesAgo: 340, likeCount: 61, commentCount: 14 }, 3),
    makeFixturePost({ author: AUTHORS.meher, category: 'content',
      body: "Editing the highlight reel from last week's shoot - if you were there and want a clip for your own page, ping me.",
      minutesAgo: 480, likeCount: 8, commentCount: 1 }, 4),
    makeFixturePost({ author: AUTHORS.dev, category: 'welfare', images: [PHOTOS.foodDistribution],
      body: 'Two hundred meals packed and out the door by 7am. Operations team, you are terrifyingly efficient before sunrise.',
      minutesAgo: 620, likeCount: 45, commentCount: 9 }, 5),
    makeFixturePost({ author: AUTHORS.priya, category: 'labs',
      body: 'ShikshAQ pilot session #3 went long because nobody wanted to stop asking questions. good problem to have.',
      minutesAgo: 900, likeCount: 19, commentCount: 3 }, 6),
  ]
}

const BODY_TEXT = "Sixty notebooks made it to the Sundarbans school this morning - thank you to everyone who helped load the boat before sunrise."

function buildHandlers({ member, store }: { member: ReturnType<typeof buildFakeMember>; store: FixtureStore }): Record<string, TableHandler> {
  store.seed('post_feed_view', buildFeedFixture())

  return {
    'rpc:get_own_member': () => ({ data: [member], error: null }),

    members: (ctx) => {
      // feedService.createPost's role lookup: .eq('member_id', memberId).
      // Answer ONLY that exact shape with the fixture's one member - a bare
      // scan (no filter naming this member, e.g. profileService's "new this
      // week" query) falls through to empty, exactly like an unregistered
      // table would. Registering this table at all was almost a footgun:
      // an earlier, unconditional version answered EVERY members query with
      // [member], which meant the real "new this week" rail on the backdrop
      // feed showed the fixture's own fake self as a "new member" suggestion
      // - harmless (it's the demo's own fabricated person, not anyone
      // real), but a rough, uncanny edge worth closing rather than shipping.
      const targetsThisMember = ctx.filters.some(f =>
        f.method === 'eq' && (f.args[0] === 'member_id' ? f.args[1] === member.member_id : f.args[0] === 'auth_uid' ? f.args[1] === member.auth_uid : false)
      )
      return { data: targetsThisMember ? [member] : [], error: null }
    },

    posts: (ctx) => {
      if (ctx.op !== 'insert') return { data: [], error: null }
      const payload = ctx.payload as Record<string, unknown>
      const postId = 1000 + store.rows('posts').length
      const row = {
        post_id: postId,
        uuid: fixtureUuid(),
        author_id: member.member_id,
        category: payload.category,
        body: payload.body,
        link_url: payload.link_url ?? null,
        link_title: payload.link_title ?? null,
        link_image: payload.link_image ?? null,
        status: payload.status,
        scheduled_for: payload.scheduled_for ?? null,
        stats: payload.stats ?? [],
        created_at: new Date().toISOString(),
      }
      store.insert('posts', row)
      // Also seed the feed-view projection of this exact post, so the
      // getPost() re-fetch createPost() makes right after inserting finds
      // it - see post_feed_view's handler below.
      store.insert('post_feed_view', {
        ...makeFixturePost({
          author: { name: member.full_name, avatar: member.avatar_url, role: member.role ?? 'member', classGrade: member.class_grade ?? '' },
          category: String(payload.category ?? ''),
          body: String(payload.body ?? ''),
          minutesAgo: 0,
        }, postId),
        uuid: row.uuid,
        status: row.status,
      })
      return { data: [row], error: null }
    },

    post_categories: () => ({ data: [{}], error: null }),

    post_feed_view: (ctx) => {
      const uuidFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'uuid')
      const rows = store.rows('post_feed_view')
      if (uuidFilter) {
        return { data: rows.filter((r: any) => r.uuid === uuidFilter.args[1]), error: null, count: 1 }
      }
      return { data: rows, error: null, count: rows.length }
    },

    likes: () => ({ data: [], error: null, count: 0 }),
    post_documents: () => ({ data: [], error: null }),
    team_members: () => ({ data: [], error: null }),
  }
}

const flow: DemoFlow = {
  id: 'post-to-feed',
  name: 'Post something to the feed',
  durationLabel: 'about a minute',
  role: 'member',
  roleBorrowed: false,
  buildMember: () => buildFakeMember({ fullName: AUTHORS.self.name, role: 'member', classGrade: AUTHORS.self.classGrade }),
  buildHandlers,
  Backdrop: () => <HomePage />,
  steps: [
    {
      id: 'open-composer',
      title: 'Start a post.',
      body: "This is the real composer - tap here and it opens, exactly like it would for any member.",
      findTarget: () => document.querySelector<HTMLElement>('.home-compose-input'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('.cp-sheet'),
    },
    {
      id: 'pick-category',
      title: 'Pick a category.',
      body: "Every post gets filed under one of the five - we'll use Operations.",
      findTarget: () => findByText(document, '.cp-sheet .cp-chiprow button', 'Operations'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: (target) => target?.getAttribute('aria-checked') === 'true',
    },
    {
      id: 'write-body',
      title: 'Write something.',
      body: "Anything real - a line about a drive, a shout-out, an update. We'll drop in an example.",
      findTarget: () => document.querySelector<HTMLTextAreaElement>('.cp-sheet #post-body'),
      doItForMe: ({ target }) => setReactFieldValue(target as HTMLTextAreaElement, BODY_TEXT),
      isComplete: (target) => ((target as HTMLTextAreaElement | null)?.value.trim().length ?? 0) >= 10,
    },
    {
      id: 'send',
      title: 'Now send it.',
      body: 'A HoD from your team sees it in their queue before it reaches the feed - usually within a day.',
      manualHint: 'or tap the arrow yourself',
      findTarget: () => document.querySelector<HTMLElement>('.cp-sheet .aq-dock-send'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: (target) => (target?.textContent || '').includes('posted!'),
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />posted a drive<br />recap.</>,
    body: "That's it - write it, a HoD checks it, it goes up, your hours get logged against your name. Free, always.",
  },
}

export default flow
