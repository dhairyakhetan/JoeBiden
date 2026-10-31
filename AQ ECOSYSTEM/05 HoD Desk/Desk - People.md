---
tags: [hod-desk, people]
---

# Desk — People

`/director/members` · `/teams` · `/categories`. All `requireDirector`.

---

## `/director/members` — MemberDirectory (317 lines)

`directorService.getMemberDirectory({page, limit, search, sort, …})` over
`member_directory_view`.

- **Sort** defaults to `'role'`, using the view's precomputed `role_rank` int so
  leaders sort first in SQL rather than with a client comparator.
- **Search** passes through `sanitizeFilterTerm(params.search)` before hitting a
  PostgREST filter.

> [!important] Every user-supplied filter value must go through `sanitizeFilterTerm`
> PostgREST treats `,` `.` `(` `)` as operators, so a raw term can change what the
> query means. `lib/pgrestEscape.ts`. This is the PostgREST equivalent of
> parameterising SQL, and it is applied here and in `getEligibleMembers`.

The view deliberately omits `phone`. `members.email` / `phone` / `auth_uid` /
`google_id` are **revoked at the column level** for `authenticated`, so anywhere
this desk needs an email it fetches it in a separate privileged query and stitches
it in via an `emailById` Map. See [[members]].

Role changes are **not** here — a director cannot change a role at all
(`members_guard_privileged_cols` reverts it). That lives in
[[Desk - Admin Only]].

---

## `/director/teams` — TeamManagement (384 lines)

Full CRUD over `teams` and `team_members` via `teamService`.

| Action | Method | RLS actually permits |
|---|---|---|
| Create team | `createTeam` | director |
| Edit team | `updateTeam` | director **∨ team lead** |
| Delete team | `deleteTeam` | director |
| Add member | `addMember` | director ∨ lead |
| Add many | `addMembersBulk` | director ∨ lead |
| Change team role | `updateMemberRole` | director ∨ lead |
| Remove member | `removeMember` | director ∨ lead ∨ self |

> [!note] The desk is narrower than the permissions
> RLS grants **team leads** most of this, but there is no `/lead` surface — team
> admin sits behind `requireDirector` here, with some inline lead actions in
> `teams/TeamDetailPage.tsx`. A real team-lead desk is a clean product opportunity.
> See [[Improvement Backlog]].

And the lead check ignores `is_active` / `left_at`, so a departed lead keeps
powers until their row is deleted — see [[teams]].

`TeamManagement.tsx` is one of the files that had to be **reworked** to route
through `.card`/`.panel-h` instead of inline styles. Don't reintroduce inline
`style` here; it wins over the cascade and breaks the desk's visual system. See
[[Two Design Languages]].

`get_team_member_contacts(member_ids[], team_id)` is the only sanctioned way to
read a team member's email or phone.

---

## `/director/categories` — CategoryManagement (240 lines)

The moderation-scope map: which director or HoD may moderate which of `events` ·
`welfare` · `content` · `operations` · `labs`.

| Action | Method | Who |
|---|---|---|
| See the whole map | `getCategoryAssignments()` | any director |
| Assign | `assignCategory(memberId, category)` | **super admin only** (RLS) |
| Unassign | `unassignCategory(memberId, category)` | **super admin only** (RLS) |

`director_categories` SELECT is open to any director, but INSERT/DELETE is
`is_super_admin()`. So a director can *see* this desk and read the map while every
mutation fails.

> [!warning] The tab is not `superOnly`, but its actions are super-admin-only
> A plain director opens `/director/categories`, sees the assignment UI, and gets a
> permission error on every change. Either mark the tab `superOnly` (plus a route
> guard) or render it read-only for non-super-admins. This is a small, real UX bug.
> See [[Improvement Backlog]].

Two consequences of the scope map are worth restating:
`operations` is what grants the Approvals tab, and scoping is enforced in the
client rather than in RLS. See [[Category Scoping]].

Related: [[HoD Desk Overview]] · [[teams]] · [[members]] · [[Category Scoping]]
