import { Routes, Route } from 'react-router-dom'
import DirectorDashboard from '../../director/DirectorDashboard'
import PostModeration from '../../director/PostModeration'
import { buildFakeMember, type Member } from '../runtime/fakeIdentity'
import type { TableHandler, HandlerCtx } from '../runtime/queryBuilder'
import { clickElement, setReactFieldValue, findByText } from '../coach/domActions'
import type { DemoFlow, FixtureStore } from './types'

// ── 19.4: "A HoD moderates a post" (spec says 4 steps). Built and verified
// as 3 (find it, read it, approve), same real-screen-only-has-three-moments
// finding as hodApproveAccount.tsx and requestCertificate.tsx - this is the
// same AdminRow-based list+disclose+verdict shape recurring a third time,
// which is a real pattern in this codebase's admin desks, not a fluke.
//
// Same architecture as hodApproveAccount.tsx (read that file's own header
// for the two things this needed that no earlier flow did): PostModeration
// only exists as an <Outlet> child of DirectorDashboard, mounted here via
// the same `<Routes location>` override that starts DIRECTLY on
// `director/posts` rather than at the desk's own landing - clicking any of
// DirectorDashboard's own rail links would fire the app's one real
// navigate() with nowhere safe for it to land. DemoFlowPage.tsx's
// `demo-hod-flow` body class (added for this pass) hides the public
// AQNav/footer/mobile-bar PublicLayout would otherwise still wrap this in.
//
// Two fixture posts, not one: PostModeration's own category filter pills
// and search box are both real, client-side-only interactions worth
// demoing (finding the RIGHT post in a queue is part of what a HoD
// actually does), which only means something with more than one row to
// filter down from.
const TARGET_UUID = '00000000-0000-4000-a800-000000000001'
const OTHER_UUID = '00000000-0000-4000-a800-000000000002'

function pendingPost(id: number, uuid: string, authorName: string, category: string, body: string, stats: { value: string; label: string }[]) {
  return {
    post_id: id,
    uuid,
    category,
    body,
    link_url: null, link_title: null, link_image: null,
    status: 'pending_review',
    created_at: new Date(Date.now() - 5 * 3_600_000).toISOString(),
    author_id: 900000 + id,
    author_uuid: `00000000-0000-4000-a900-${String(id).padStart(12, '0')}`,
    author_name: authorName,
    author_avatar: null,
    author_role: 'member',
    like_count: 0,
    comment_count: 0,
    images: [],
    tagged_members: [],
    stats,
  }
}

function buildHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  store.seed('post_feed_view', [
    pendingPost(1, TARGET_UUID, 'Kajal Mondal', 'welfare',
      'Sundarban winter drive wrapped today - blankets, notebooks and a very long boat ride home.',
      [{ value: '140', label: 'blankets distributed' }, { value: '60', label: 'families reached' }]),
    pendingPost(2, OTHER_UUID, 'Sourav Dutta', 'events',
      'Paradox ticket counter is up and running at the gate - come find us before assembly.',
      []),
  ])

  return {
    'rpc:get_own_member': () => ({ data: [member], error: null }),
    members: (ctx: HandlerCtx) => {
      if (ctx.wantsCount) return { data: [], error: null, count: 0 }
      const targetsThisMember = ctx.filters.some(f => f.method === 'eq' && (f.args[0] === 'member_id' ? f.args[1] === member.member_id : f.args[0] === 'auth_uid' ? f.args[1] === member.auth_uid : false))
      return { data: targetsThisMember ? [member] : [], error: null }
    },
    director_categories: () => ({ data: [], error: null }),

    post_feed_view: (ctx: HandlerCtx) => {
      const rows = store.rows('post_feed_view') as any[]
      const statusFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'status')
      const filtered = statusFilter ? rows.filter(r => r.status === statusFilter.args[1]) : rows
      return { data: filtered, error: null, count: filtered.length }
    },

    // approvePost()'s own UPDATE - `.eq('post_id', X).select('post_id, uuid,
    // author_id').single()`, and it DOES check the error (unlike
    // approveMember's own post-update re-fetch), so this must succeed with
    // the right shape or the demo's own approve click would show a real
    // error toast instead of completing.
    posts: (ctx: HandlerCtx) => {
      if (ctx.op === 'update') {
        const idFilter = ctx.filters.find(f => f.method === 'eq' && f.args[0] === 'post_id')
        const rows = store.rows('post_feed_view') as any[]
        const row = idFilter ? rows.find(r => r.post_id === idFilter.args[1]) : undefined
        if (row) Object.assign(row, ctx.payload)
        return { data: row ? [{ post_id: row.post_id, uuid: row.uuid, author_id: row.author_id }] : [], error: null }
      }
      return { data: [], error: null }
    },
    notifications: () => ({ data: [], error: null }),
  }
}

const postsLocation = { pathname: '/demo/hod-moderate-post/director/posts', search: '', hash: '', state: null, key: 'demo-hod-moderate' }

const flow: DemoFlow = {
  id: 'hod-moderate-post',
  name: 'A HoD moderates a post',
  durationLabel: 'about a minute',
  role: 'hod',
  roleBorrowed: true,
  // Backdrop IS the HoD desk, so the public nav/footer must not show through.
  hidesPublicChrome: true,
  buildMember: () => buildFakeMember({ fullName: 'Trina Basak', role: 'hod', classGrade: '12' }),
  buildHandlers,
  Backdrop: () => (
    <Routes location={postsLocation}>
      <Route element={<DirectorDashboard />}>
        <Route path="director/posts" element={<PostModeration />} />
      </Route>
    </Routes>
  ),
  steps: [
    {
      id: 'find-it',
      title: 'Find it in the queue.',
      body: 'Every post from every member lands here before the feed - search finds it the same way it would for real.',
      findTarget: () => document.querySelector<HTMLInputElement>('input[placeholder*="Search post text or author" i]'),
      doItForMe: ({ target }) => setReactFieldValue(target as HTMLInputElement, 'Kajal'),
      isComplete: (target) => ((target as HTMLInputElement | null)?.value.trim().length ?? 0) >= 3,
    },
    {
      id: 'read-it',
      title: 'Read it before you decide.',
      body: "The numbers a member reports here enter the org's real totals - this is the moment someone actually checks them.",
      findTarget: () => findByText(document, '.adm-disclose', 'read full post'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => !!document.querySelector('.adm-row-expand'),
    },
    {
      id: 'approve',
      title: 'Approve it.',
      body: "It goes live on the real feed the moment you do - this is the actual check, not a rubber stamp.",
      manualHint: 'or tap the arrow yourself',
      // Optimistic + a 5s undo toast, same shape as hodApproveAccount.tsx's
      // own 'approve' step - the row (and this button) is removed from the
      // list before the network call even fires, so watch the toast the
      // undo window replaces it with, not the vanished button.
      findTarget: () => findByText(document, '.adm-verdicts button', 'approve'),
      doItForMe: ({ target }) => clickElement(target),
      isComplete: () => (document.querySelector('.aq-toasts')?.textContent || '').includes('approved'),
    },
  ],
  endCard: {
    kicker: '★ that\'s the whole loop',
    headline: <>you just<br />moderated<br />a post.</>,
    body: "One real check, and it's live - the same responsibility every HoD carries for every post, every day.",
  },
}

export default flow
