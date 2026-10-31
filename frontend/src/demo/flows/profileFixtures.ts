import type { Member } from '../runtime/fakeIdentity'
import type { TableHandler, HandlerCtx } from '../runtime/queryBuilder'
import type { FixtureStore } from './types'

// ── Shared substrate for the three flows that all mount the SAME real
// Backdrop - profile/ProfilePage.tsx with `isOwn` (request-certificate,
// generate-cv, take-a-break). Deliberately NOT one shared file per 19.5's
// "one fixture file per flow" - each of those three still owns its OWN
// table handlers for what makes it distinct (certificate_requests/
// drive_attendance, member_education, the break fields) - but ProfilePage
// itself unconditionally fires ~8 other reads on every mount regardless of
// which of the three flows is running (profileService.getOwnProfile,
// getMemberPosts, getTaggedPosts, getLifetimeLikes, achievementService.
// getMemberAchievements, teamService.getTeamsForMember, wallService.getWall,
// MemberOfMonthProfileBadge/ClaimCard's own reads, claimStoredReferral -
// suppressed entirely at the DemoProvider level, see that file). Tripling
// that boilerplate across three files - each free to drift from the others -
// is worse than one small shared substrate the three explicitly build on.
//
// `ProfilePage isOwn` never reads a route `:uuid` (App.tsx: `<Route path="me"
// element={<ProfilePage isOwn />} />`) - `profileUuid` comes straight from
// `useAuth().member.uuid`, so none of this needs the <Routes location>
// override wallNote.tsx/the HoD flows need. A plain Backdrop is enough.

/** members.eq('uuid'|'member_id'|'auth_uid', X) - every real caller on
 *  ProfilePage looks itself up by exactly one of these three. Also answers
 *  UPDATEs (breakService.setBreak/endBreakEarly) by mutating the matched
 *  fixture row in place and reporting success - the same object reference
 *  DemoProvider's refreshMember() re-reads (see that file's own comment on
 *  why that fix exists). */
export function membersHandler(store: FixtureStore): TableHandler {
  return (ctx: HandlerCtx) => {
    const rows = store.rows('members') as any[]
    const eqOn = (col: string) => ctx.filters.find(f => f.method === 'eq' && f.args[0] === col)
    const filter = eqOn('uuid') || eqOn('member_id') || eqOn('auth_uid')
    const matches = filter ? rows.filter(r => r[filter.args[0] as string] === filter.args[1]) : []

    if (ctx.op === 'update') {
      const payload = ctx.payload as Record<string, unknown>
      for (const row of matches) Object.assign(row, payload)
      return { data: matches, error: null }
    }
    return { data: matches, error: null }
  }
}

/** The handlers every ProfilePage-backed flow needs regardless of which
 *  card its own steps are about. Seeds `member` into the store's `members`
 *  table (so membersHandler's uuid/member_id/auth_uid lookups resolve, and
 *  so a later UPDATE - the break flow - mutates the SAME object `member`
 *  points at). Each caller may seed additional tables/rows on top via
 *  `store` before or after calling this. */
export function buildOwnProfileHandlers({ member, store }: { member: Member; store: FixtureStore }): Record<string, TableHandler> {
  store.seed('members', [member])

  return {
    'rpc:get_own_member': () => ({ data: [member], error: null }),
    members: membersHandler(store),

    // Achievements/teams/tagged-posts/own-wall/likes - all real, all empty
    // for this fixture member. Honest for a demo persona with no history to
    // fabricate rather than inventing achievements or teammates no step
    // actually needs (19.5: fictional but not silly - an empty, believable
    // record beats a padded one nobody asked to see).
    external_achievements: () => ({ data: [], error: null, count: 0 }),
    team_members: () => ({ data: [], error: null }),
    post_tags: () => ({ data: [], error: null }),
    profile_notes: () => ({ data: [], error: null }),
    post_feed_view: () => ({ data: [], error: null, count: 0 }),

    // member_breaks - breakService.setBreak's history insert. No flow this
    // pass ships reads it back, so accepting the write is enough.
    member_breaks: (ctx) => {
      if (ctx.op === 'insert') { store.insert('member_breaks', ctx.payload); return { data: [ctx.payload], error: null } }
      return { data: store.rows('member_breaks'), error: null }
    },
  }
}
