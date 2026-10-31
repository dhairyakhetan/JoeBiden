import { Routes, Route } from 'react-router-dom'
import PublicProfilePage from '../../profile/PublicProfilePage'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler } from '../runtime/queryBuilder'
import { clickElement, setReactFieldValue } from '../coach/domActions'
import type { DemoFlow, FixtureStore } from './types'

// ── 19.4: "Leave a note on someone's wall" (3 steps, "shows the social
// side"). 19.5's OWN rule, called out twice in this pass's brief: "No fixture
// may depict a real member's profile. The wall flow in particular writes a
// note to someone - that someone is fictional." The recipient below
// (Meghna Basu) and the note ALREADY on her wall (from a third fictional
// person, Farhan Ali) are both invented for this fixture - neither name
// belongs to a real AquaTerra member.
//
// ARCHITECTURE NOTE: the real screen for this is public/PublicProfilePage.tsx
// at `/member/:uuid` - it reads its subject entirely from the route param
// (`useParams<{uuid}>()`), which a bare `Backdrop: () => <PublicProfilePage/>`
// cannot supply (App.tsx's real `/demo/*` branch carries no `:uuid` segment).
//
// The first fix tried here was a nested <MemoryRouter> - self-contained and,
// as a bonus, would have contained any stray real <Link> click inside its
// own isolated history instead of the real address bar. It does not work:
// react-router throws "You cannot render a <Router> inside another <Router>"
// at runtime the instant this mounts (found by actually loading this flow,
// not by reading react-router's docs first) - there is exactly one Router
// for the whole app (App.tsx's <BrowserRouter>) and nothing may nest a
// second one, full stop, regardless of what path it would render.
//
// The real, supported mechanism for "render a route element with different
// params without a second Router" is `<Routes location={...}>` - it matches
// against an OVERRIDDEN location while still using the app's one ambient
// Router for useParams/useSearchParams/navigation. Its own restriction,
// also found by loading this flow rather than by reading the docs first:
// "the location pathname must begin with the portion of the URL pathname
// that was matched by all parent routes" - i.e. the override can only
// re-route WITHIN the branch already matched (here, `/demo/wall-note`), not
// teleport to an unrelated top-level path like `/member/:uuid`. The fix is
// to give the override path that same `/demo/wall-note` prefix and match a
// RELATIVE pattern against the remainder, which is exactly what nested
// <Route>s already do anywhere else in this app - `path="member/:uuid"`
// below matches the `/member/<uuid>` suffix of `wallLocation.pathname`, and
// PublicProfilePage reads `uuid` from that match exactly as it would from
// the real `/member/:uuid` route in App.tsx.
//
// Safety trade-off versus the (impossible) isolated-history version: a
// stray real <Link> inside PublicProfilePage's subtree (a team chip, "share
// profile"...) DOES navigate the real address bar here, same as it would
// from the un-routed Backdrops postToFeed.tsx/applyForRole.tsx already use
// (HomePage, OpportunitiesPage are full of real internal links too) - not a
// new gap this flow introduces. Nothing in the coach-mark mechanic ever
// blocks clicks outside the spotlit element (19.2: it's a box-shadow, not
// an overlay), so this has always been true of every flow.
//
// Landing directly on `?tab=wall` (rather than spending a step clicking the
// Wall tab) is not a shortcut invented for this demo - PublicProfilePage.tsx
// already deep-links here for real, for the exact same reason (a real
// "someone left a note on your wall" notification's own link, per
// wallService.ts). Starting there is how a real visitor already reaches this
// exact feature, and it is what makes 3 steps (open the composer, write,
// send) an honest fit for a screen that otherwise needs 4 real clicks (tab,
// composer, write, send).
const RECIPIENT_UUID = '00000000-0000-4000-c000-000000000001'
const EXISTING_NOTE_AUTHOR_UUID = '00000000-0000-4000-c000-000000000002'
// The override location `<Routes location>` matches against - see the
// architecture note above. MUST start with `/demo/wall-note` (the branch
// already matched to reach this Backdrop) - the `<Route path="member/:uuid">`
// below matches the remainder.
const wallLocation = { pathname: `/demo/wall-note/member/${RECIPIENT_UUID}`, search: '?tab=wall', hash: '', state: null, key: 'demo-wall-note' }
let noteSeq = 1
function fixtureNoteId(): string {
  return `00000000-0000-4000-c000-${String(900000 + noteSeq++).padStart(12, '0')}`
}

function buildRecipientFixture() {
  const now = new Date().toISOString()
  return {
    member_id: 500001,
    uuid: RECIPIENT_UUID,
    full_name: 'Meghna Basu',
    avatar_url: null,
    class_grade: '11',
    bio: 'shikshAQ volunteer. bad at frisbee, great at flyers.',
    role: 'member',
    status: 'active',
    created_at: new Date(Date.now() - 200 * 86_400_000).toISOString(),
    school_id: null,
    wall_enabled: true,
    updated_at: now,
  }
}

function buildExistingNote() {
  return {
    id: fixtureNoteId(),
    recipient_uuid: RECIPIENT_UUID,
    author_uuid: EXISTING_NOTE_AUTHOR_UUID,
    body: "you organized the whole Topsia handout list solo and never once complained. that's the job, honestly.",
    image_url: null,
    label: 'welfare',
    created_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
    author: { full_name: 'Farhan Ali', avatar_url: null },
  }
}

const NOTE_TEXT = "saw the blanket drive photos - you made a hundred strangers' Saturday better. proud of you."

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  const recipient = buildRecipientFixture()
  store.seed('members', [member, recipient])
  store.seed('profile_notes', [buildExistingNote()])

  return {
    'rpc:get_own_member': () => ({ data: [member], error: null }),

    // Every real caller on this page looks a member up by exactly one of
    // uuid / member_id / auth_uid - answer whichever one matches either the
    // visitor (self) or the fixture recipient, empty otherwise. Covers
    // profileService.getPublicProfile/getMemberPosts/getTaggedPosts,
    // achievementService.getMemberAchievements, wallService.getWall's own
    // wall_enabled read, and followService's resolveMemberIdFromUuid.
    members: (ctx) => {
      const rows = store.rows('members') as any[]
      const match = ctx.filters.reduce<any[] | null>((acc, f) => {
        if (acc) return acc
        if (f.method !== 'eq') return acc
        const [col, val] = f.args as [string, unknown]
        if (col === 'uuid' || col === 'member_id' || col === 'auth_uid') {
          const found = rows.filter(r => (r as any)[col] === val)
          return found.length ? found : null
        }
        return acc
      }, null)
      return { data: match ?? [], error: null }
    },

    post_tags: () => ({ data: [], error: null }),
    external_achievements: () => ({ data: [], error: null, count: 0 }),
    follows: () => ({ data: [], error: null, count: 0 }),
    post_feed_view: () => ({ data: [], error: null, count: 0 }),

    profile_notes: (ctx) => {
      if (ctx.op === 'insert') {
        const payload = ctx.payload as Record<string, unknown>
        const row = {
          id: fixtureNoteId(),
          recipient_uuid: payload.recipient_uuid,
          author_uuid: payload.author_uuid,
          body: payload.body,
          image_url: payload.image_url ?? null,
          label: payload.label ?? null,
          created_at: new Date().toISOString(),
        }
        store.insert('profile_notes', row)
        return { data: [row], error: null }
      }
      const recipientFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'recipient_uuid')
      const rows = store.rows('profile_notes') as any[]
      if (recipientFilter) return { data: rows.filter(r => r.recipient_uuid === recipientFilter.args[1]), error: null }
      return { data: rows, error: null }
    },

    notifications: () => ({ data: [], error: null }),
  }
}

const flow: DemoFlow = {
  id: 'wall-note',
  name: "Leave a note on someone's wall",
  durationLabel: 'under a minute',
  role: 'member',
  roleBorrowed: false,
  buildMember: () => buildFakeMember({ fullName: 'Sohini Dutta', role: 'member', classGrade: '10' }),
  buildHandlers,
  Backdrop: () => (
    <Routes location={wallLocation}>
      <Route path="member/:uuid" element={<PublicProfilePage />} />
    </Routes>
  ),
  steps: [
    {
      id: 'open-composer',
      title: "Leave Meghna a note.",
      body: "Every profile has a wall - anyone at AquaTerra can pin something real to it.",
      findTarget: () => document.querySelector<HTMLElement>('.wall-sticky-bar'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('.wall-field'),
    },
    {
      id: 'write',
      title: 'Write something real.',
      body: "Not a compliment for the sake of it - something you'd actually want them to see.",
      findTarget: () => document.querySelector<HTMLTextAreaElement>('.wall-field'),
      doItForMe: ({ target }) => setReactFieldValue(target as HTMLTextAreaElement, NOTE_TEXT),
      isComplete: (target) => ((target as HTMLTextAreaElement | null)?.value.trim().length ?? 0) >= 10,
    },
    {
      id: 'send',
      title: 'Pin it.',
      body: 'It goes straight to their wall - everyone can see it, including them.',
      manualHint: 'or tap the arrow yourself',
      // Same shape as every other "send" step in this file's siblings:
      // WallTab.tsx's handlePosted() calls setComposerOpen(false) in the same
      // synchronous handler that fires onPosted, so the composer is gone
      // before any in-dialog confirmation could paint. Watch the toast
      // (Toast.tsx's .aq-toasts) instead - WallTab's own success copy,
      // verbatim, never a timer standing in for it.
      findTarget: () => document.querySelector<HTMLElement>('.wall-sheet'),
      doItForMe: ({ target }) => {
        if (!target) return
        const button = target.querySelector<HTMLElement>('.wall-dock-send')
        if (button) clickElement(button)
      },
      isComplete: () => (document.querySelector('.aq-toasts')?.textContent || '').includes('pinned to the wall'),
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />pinned a note<br />to a wall.</>,
    body: "That's it - it's public, it's kind, and it took less than a minute. People keep these.",
  },
}

export default flow
