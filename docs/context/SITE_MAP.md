# Site map

Every route, who can see it, and what it is for. Built 2026-10-08 by five read-only passes over
`frontend/src` (routes from `App.tsx`, then each area), then spot-checked by the author. Treat a row
as a lead to confirm in code, not as proof: where a pass did not read a page it says so below.
The code (`App.tsx`) wins over this file. Re-verify before acting on anything marked `(unread)`.

## Public, signed-out

| route | file | purpose |
| --- | --- | --- |
| `/` | `auth/HomeRoute.tsx` then `public/HomePage.tsx` | feed, notice board, open roles; pending and rejected accounts are redirected |
| `/projects`, `/projects/:slug` | `public/PublicProjectsPage.tsx`, `PublicProjectDetailPage.tsx` | the archive of drives and one drive; the detail page's call to action leads to `/login` |
| `/blog`, `/blog/:slug` | `public/BlogListPage.tsx`, `BlogPostPage.tsx` | essays ("Groundwork Diaries") |
| `/opportunities`, `/opportunities/:id` | `public/OpportunitiesPage.tsx`, `OpeningDetailPage.tsx` | open volunteer roles; applying needs a login |
| `/about` | `public/AboutPage.tsx` | story, manifesto, departments; no database reads |
| `/contact`, `/collaborations` | `public/ContactPage.tsx`, `CollaborationsPage.tsx` | forms that write `contact_submissions` and `collaboration_submissions`, then `/thank-you` |
| `/faq`, `/support`, `/volunteer` | `public/FAQPage.tsx`, `SupportPage.tsx`, `VolunteerHandbookPage.tsx` | help and the volunteer handbook |
| `/members`, `/member/:uuid` | `public/MembersPage.tsx`, `profile/PublicProfilePage.tsx` | the active member directory and a public profile |
| `/teams`, `/teams/:uuid`, `/teams/:uuid/sub/:slug` | `teams/*` | departments, sub-teams, their rosters, open roles and tagged posts (unread by the mapper) |
| `/post/:uuid` | `feed/PostPage.tsx` | one post; liking and saving need a login (unread) |
| `/directory` | `public/DirectoryPage.tsx` | the AquaTerra map by intent, department, kind and year |
| `/schools`, `/classes`, `/crftd`, `/links`, `/accounts` | `public/*` | campus programme, student-taught classes, the clothing label, all links, the open books ledger |
| `/equity-policy`, `/privacy-policy`, `/thank-you`, `/brand` | `public/*` | policies, form confirmation, an unlisted design reference |
| `/games`, `/games/:slug` | `games/*` | a mini-games hub (see OBSERVATIONS.md: the list is empty) |
| `/terranotes/*` | `terranotes/TerraNotesRoot.jsx` | monthly magazine and AQ Labs, a separate shadow-root sub-app |
| `/paradox/*`, `/terrathon/*`, `/demo/*` | `paradox/`, `terrathon/`, `demo/` | event sub-apps with their own look (unread) |
| `/login`, `/auth/callback` | `auth/LoginPage.tsx`, `AuthCallbackPage.tsx` | Google sign-in; the first sign-in is the signup |
| `/join` | `public/JoinPromoPage.tsx` | a pre-application promo with no in-app link found |
| legacy redirects | `App.tsx` | `/roots`, `/feed`, `/labs`, `/labs/:slug`, `/recruitment`, `/volunteer/apply`, `/volunteer-handbook`, `/everything-we-do`, `/arcade/*` |
| `*` | `pages/NotFoundPage.tsx` | not found (the server returns 200: accepted soft 404) |

## Signed in (members)

| route | file | purpose |
| --- | --- | --- |
| `/register`, `/pending`, `/rejected` | `auth/RegisterPage.tsx`, `PendingApprovalPage.tsx`, `RejectedPage.tsx` | finish the profile, wait for approval (re-checks every 30 seconds), appeal if suspended or removed |
| `/choose-team` | `onboarding/ChooseTeamPage.tsx` | an optional nudge after approval |
| `/notifications`, `/saved`, `/my-posts` | `feed/*` | alerts, bookmarks (cleared on sign-out by design), own posts and their status |
| `/profile/me`, `/profile/:uuid`, `/profile/edit` | `profile/ProfilePage.tsx`, `EditProfilePage.tsx` | profile, CV, hours, breaks, wall notes |
| `/search`, `/calendar`, `/yearbook`, `/invite`, `/settings` | `search/`, `calendar/`, `yearbook/`, `referrals/`, `auth/SettingsPage.tsx` | member tools |
| `/drive/:id/check-in`, `/wrap` | `drives/*` | offline-first attendance for a drive, and the wrap-up |
| `/bugs` | `bugs/BugReportsPage.tsx` | file a bug or a feature request, follow it; leaders triage. Shortcut: Alt+Shift+B or a two-finger hold on any page |

## Leaders and super admins: `/director/*`

One route group, `director/DirectorDashboard.tsx`; the desk list and who sees each desk is the
`DESKS` array in `director/deskAccess.ts` (derive the count there). Leader = HoD, director, HR or
super admin. Super = HR or super admin.

| desk | who | what a user does |
| --- | --- | --- |
| approvals | super | approve, reject or mark contacted pending sign-ups |
| posts | leader | approve or reject pending posts within their categories |
| blogs | leader | publish drafts, set a cover |
| members | leader | search accounts, change role, archive, restore, restart as applicant, set breaks |
| member of the month | leader | pick honorees per team and month, write the citation |
| teams, categories | leader (categories: edits by super) | create teams, manage rosters, assign category scope |
| hiring | leader | review applications, set status singly or in bulk |
| enquiries | leader | read contact and collaboration messages |
| yearbook | leader | invite members, read entries |
| certificates | super | issue or decline certificate, LoR and LoV requests |
| content, projects | super | edit public-page words and pictures, publish drive write-ups |
| hods | super | promote to HoD or director, change title, demote |
| volunteer applications | super | read the pre-2026 archive |
| roles, activity log | super | tick which desks and capabilities each role gets, read the audit trail |

Gating mirrors the database, not taste: change `ProtectedRoute` props and the desk's `superOnly`
flag together or neither.
