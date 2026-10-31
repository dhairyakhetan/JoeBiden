# Feature/behaviour requests — 2026-09-03 rapid-fire batch

Captured verbatim from the user mid-session. **Not yet actioned.** These are
behaviour and permission changes, not UI, so several of them collide head-on
with the "UX stays the same, UI completely changes" rule and with sections of
`docs/CHANGELOG-REDESIGN.md` that are already locked. Conflicts are marked.

Numbering is mine, for reference in replies.

| # | Verbatim | My reading | Status |
|---|---|---|---|
| 1 | "Hod can only see his own posts to approve in the same category" | Scope PostModeration to the acting HoD's assigned categories | needs confirm — may already exist |
| 2 | "remove ahievement reviews auto / approved all achievements" | Delete the AchievementReviews desk; achievements auto-approve on submit | **CONFLICT** with changelog 18 |
| 3 | "duplicate hr role + role clarity, hr is same as super admin" | Add an `hr` role equal in power to `super_admin` | **CONFLICT** with `lib/roles.ts` 5-role model |
| 4 | "post demo + approve post + every single person logged in and make it accessible" | A demo/walkthrough of composing and approving a post, shown to every signed-in user | ambiguous |
| 5 | "HoD's individual demo post" | A per-HoD demo post, seeded or scripted | ambiguous |
| 6 | "poster generate sabko dedo poster/story into share sheet modal" | Poster/story generation available to everyone, surfaced in a share-sheet modal | needs scope |
| 7 | "hirings demo flow" | A demo walkthrough of the hiring flow | ambiguous |
| 8 | "achievement home page check + demo" | Verify achievements surface on the home page, plus a demo | ambiguous |
| 9 | "geneate CV button, certiifcate generate" | A "generate CV" action and a certificate generator | **DONE 2026-09-05** — CV half built (`profile/CvCard.tsx`, `services/cvService.ts`, `lib/cv.ts`). The certificate half already existed (`certificateService` + `HoursAndCertificateCard` + `director/CertificateRequests`) and was not rebuilt |
| 10 | "certiicate only for HR" | Certificate issuing gated to the `hr` role (see #3) | **DONE 2026-09-05 (app), migration NOT RUN** — `superOnly: true` on the certificates nav item + `requireSuperAdmin` on the route, both resolving through `isSuperAdmin()` = `hr`/`super_admin`. The RLS half is written and unapplied: `frontend/scripts/certificate_requests_hr_only_2026_09_05.sql` |
| 11 | "member of the month flow" | New recognition flow | **DONE 2026-09-05, migration APPLIED** — new table `public.member_of_the_month` (RLS on, `anon` holds no grant, writes gated on `is_director()`), `services/memberOfMonthService.ts`, desk tab `director/MemberOfMonth.tsx` at `/director/member-of-month`, and a members-only card on the home rail. Migration file `frontend/scripts/member_of_the_month_2026_09_05.sql`, already run against `hzowuwffjqtgszecngpe` and verified live |
| 12 | "no points remove points" | Remove the welfare-points system entirely | **CONFLICT** with changelog 06 + `orgFacts.POINTS_PER_ACTIVITY` |
| 13 | "share their own stories etc etc" | Members share their own stories, presumably via #6's share sheet | ambiguous |

## DECISIONS (user, 2026-09-03) — these override the changelog where they collide

| # | Decision | Consequences to execute |
|---|---|---|
| 1 | **Already built.** `PostModeration` scopes to `myCategories` server-side for every non-super-admin (`director_categories`). No work unless "his own posts" meant author-scoped, which would be odd (you do not moderate your own post). Treating as done | none |
| 2 | **Auto-approve achievements, delete the desk.** Achievements go live on submit | remove `director/AchievementReviews.tsx`, its lazy import + `Tab` union member in `DirectorDashboard.tsx`, its route in `App.tsx`, its desk-index entry (section 08), its notification path. Section 18 drops from four queues to three. Achievement insert writes an approved status directly. Changelog section 18 marked SUPERSEDED for this desk |
| 3 | **`hr` is a real sixth role, equal to `super_admin`** | add `'hr'` to `LEADER_ROLES` in `lib/roles.ts`; `isSuperAdmin()` must return true for it (or a new `hasAdminAccess()` both roles pass, applied at every `isSuperAdmin` call site); add `'hr'` to the `members.role` DB CHECK constraint; add a `getRoleLabel` case; add a `role-director` class mapping. Certificate issuing gates on `hr` alone (item 10) |
| 4, 5, 7, 8 | **Guided product tour** — interactive coach-marks over the real UI, dismissible, remembered per user in localStorage | one shared `Tour` primitive, not four. Follows the existing `aq_hi_strip_v1` / `aq_hod_visited` localStorage pattern. Tours: compose a post, approve a post (HoD only), the hiring flow, achievements on the home page |
| 12 | **Remove points everywhere** | delete `PointsLedgerCard`, the "welfare points" mono label, `POINTS_PER_ACTIVITY` from `lib/orgFacts.ts`, and rewrite the frozen BreakModal string, which currently reads "your leads will see this. nothing is removed, and you keep your points." Changelog section 06 marked SUPERSEDED for the points card |

Still open, to spec before building: **6** (poster/story generation into a share
sheet, and who gets it), **9** (generate CV, certificate generator),
**10** (certificate gated to `hr`),
**13** (members share their own stories). **11** (member of the month) came off
this list on 2026-09-05: specced and built, see its row above.

## STATUS as of 2026-09-04

| # | State |
|---|---|
| 1 | **Done** (already was) |
| 2 | **DONE** - achievements auto-approve on submit; `AchievementReviews` desk deleted with its route, tab, lazy import, landing tile and three service functions. Queue group is now Approvals / Post Queue / Blog Drafts. Verified live: `external_achievements` holds 3 rows, all already `approved`, so there are NO orphaned pending rows and no SQL was needed |
| 3 | **DONE** - DB migrated (role CHECK + both gate functions) and the frontend wired. Also fixed FOUR hardcoded `['director','hod','super_admin']` lists in `services/` that would have silently treated an HR member as a plain member - the worst being `teamService`, which decided their posts needed review. All now read `lib/roles.ts` |
| 12 | in progress (agent) |
| 4, 5, 7, 8 | not started - guided product tour, one shared `Tour` primitive |
| 11 | **DONE 2026-09-05, migration APPLIED.** `public.member_of_the_month` (created with RLS on in the same migration; `anon` holds no grant; writes gated on `is_director()`, the DB twin of `hasLeaderAccess`), `services/memberOfMonthService.ts`, the desk tab at `/director/member-of-month`, and a signed-in-members-only card on the home rail. The pick names a real student, so the display surface is gated twice - `isActive` in the component and the missing `anon` grant in the database - and appears on no public page |
| 6, 9, 10, 13 | not started, and **still need specs** before they can be built |

## Why these were held rather than built

Three of them delete or invert things the redesign changelog specs in detail:

- **#2** removes a desk that section 18 specifies as one of the four queues,
  with frozen strings already read from source ("✓ Approve" / "✕ Reject",
  "be specific. the member will see this.").
- **#3** adds a sixth role to a five-role model (`lib/roles.ts`) that every
  gate in the app reads through `hasLeaderAccess()` / `isSuperAdmin()`. Note
  the live database already has **16 super_admins against 1 hod**, which the
  changelog flags as a sign super_admin is already being used for staff
  generally. If `hr` is "the same as super_admin", it may be a *label* problem
  rather than a new role.
- **#12** removes welfare points, which section 06 specs as `PointsLedgerCard`
  on the own-profile view with the mono label "welfare points", and which
  `lib/orgFacts.ts` encodes as `POINTS_PER_ACTIVITY = 1`. The changelog also
  freezes the BreakModal string "your leads will see this. nothing is removed,
  and you keep your points."  — that copy dies with the feature.

None of these are hard to do. They are held because doing them silently would
contradict a spec the user spent the whole design phase writing, and because
"UX stays the same" was stated as binding in the same session.
