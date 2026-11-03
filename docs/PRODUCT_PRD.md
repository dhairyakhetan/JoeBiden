# AquaTerra Platform — Product PRD

**Status: living document, actively maintained.** Unlike the dated audit/planning
files at the repo root (`AUDIT_*.md`, `AUTOPILOT_PLAN.md`, `HANDOFF*.md`, etc.,
and everything under `docs/archive/`), which are point-in-time snapshots from
past work and are not kept current, this file is the current source of truth
for what the AquaTerra platform is supposed to do, for whom, and why. It is
re-verified against the live product on a recurring basis by an automated
review routine (see "How this document is maintained" below) and edited in
place — sections are updated, not superseded by a new dated file.

This is a **product PRD**, not a technical one. It describes user-facing
behavior, roles, workflows, and business rules — not database schemas,
component names, or implementation details. For the technical architecture,
see `CLAUDE.md` at the repo root.

Last full rewrite: 2026-09-22, from a complete audit of the live `frontend/src`
codebase.

---

## What AquaTerra is

AquaTerra is a student-run volunteer organization based in Kolkata. This
platform is its internal community hub and public front door in one product:
members apply, get approved, post updates, join teams, run welfare drives,
apply to internal openings, and get recognized for their work — while the
public can discover the org, read about its work, and apply to join, all
without a separate marketing site or a separate admin tool. It also hosts two
self-contained annual events — **Paradox** (a cultural/fundraising fest) and
**TerraThon** (an inter-school sports tournament) — as their own registration
and event-operations products under the same domain.

### Who uses it

- **Public visitor** — nobody signed in. Can read everything public-facing:
  about, projects, blog, team pages, FAQs, the org's public stats, and can
  start the join flow or apply to job openings.
- **Applicant** — has started Google sign-in but isn't an active member yet
  (`pending_approval`, `rejected`, or `suspended`).
- **Member** — an approved, active volunteer. Can post, comment, join teams,
  track their own hours/achievements, request certificates, and more.
- **Lead** — a member additionally responsible for one team (department).
  Team-scoped moderation powers only.
- **HoD / Director** — org-wide leadership. Equivalent power, different title.
  Can be scoped to specific content categories for moderation.
- **HR / Super Admin** — the top tier. Everything a director can do, plus
  account approvals, HoD promotion/demotion, org-wide settings, and the
  permissions engine itself.
- **Paradox attendee / TerraThon participant** — public users of the two
  event sub-apps, who never need an AquaTerra membership account to
  register, pay, or attend.

### Product principles that hold across the whole platform

These aren't features — they're standing rules the whole product is expected
to honor, and they're exactly the kind of thing a weekly review should keep
verifying, because a single new feature that quietly breaks one of them is
easy to miss in review otherwise.

1. **Never invent a number.** Every public-facing statistic (member counts,
   hours, drive counts, referral tallies) is either a real, sourced figure, a
   live query result, or an explicit "not yet tracked" marker. Nothing is
   ever a plausible-looking guess. This is a hard-learned rule after a
   fabricated membership figure once spread across seven pages.
2. **Client-side role checks are UX, never the real gate.** Every "can this
   person see/do this" check in the UI is a convenience layered on top of a
   database-level permission rule, which is the actual boundary. A UI gate
   and a data gate falling out of sync (one loosened without the other) is a
   real, recurring class of bug in this product's history — a lower-privilege
   leader has been able to reach a super-admin-only screen this way before.
3. **The points/gamification system is retired, fully.** No feature should
   reference, imply, or resurrect a scoring/ranking mechanic. Recognition
   (Member of the Month, achievements, certificates) is always a human
   decision, never an auto-computed rank.
4. **Every mutation gives feedback.** Any action a user takes that changes
   data shows a pending state while in flight, a clear success confirmation,
   and an explicit, specific error on failure — never a silent failure and
   never just a console log the user can't see.
5. **Moderation and content rules apply uniformly.** Free-text submissions
   (posts, comments, blog drafts, contact/collab forms, profile bios) are all
   subject to the same profanity/obscenity screening, and a leader's own
   content is not exempt from a hard "block" match.
6. **Field tools work without connectivity.** Anything used standing at a
   physical event (drive check-in, TerraThon gate check-in) must queue writes
   locally and sync automatically when connectivity returns, because venue
   Wi-Fi has failed at real events before and lost real data.
7. **RLS access rules for accepted/registered participants generally do not
   change without a human decision**, and destructive or bulk actions
   (deleting a member's content, mass-rejecting applications, issuing
   refunds) always require an explicit, named person to trigger them — never
   an automated threshold.

---

## How this document is maintained

A scheduled review process reads this PRD, checks the live product and
database against it, and reports (and where safe, fixes) discrepancies —
described fully in `docs/SELF_HEALING_ROUTINE.md`. Two things make this
document usable for that purpose:

- Every feature section below states what "working correctly" means in
  plain, checkable terms — not just what the feature is.
- The **Explicitly not built / retired** section exists specifically so the
  review process (and any contributor) can tell the difference between "this
  is missing and should be flagged" and "this was deliberately removed or
  never promised."

If you change what a feature is supposed to do, update the relevant section
here in the same change — an out-of-date PRD produces false positives (or
worse, false negatives) in every review cycle after it.

---

## 1. Onboarding & the approval funnel

**What it's for:** getting a real, verified teenager from "found the org on
Instagram" to "posting in the feed" with the least possible friction, while
keeping a human in the loop on every new account.

**How it works today:** there is no separate signup form. A first-time
Google sign-in *is* the application. The flow is: `/login` (Google button,
with copy that adapts to how the visitor arrived) → OAuth → `/auth/callback`
(silent routing decision, never flashes a wrong screen) → `/register`
(three questions: name, class/grade, WhatsApp number — own or a guardian's)
→ `pending_approval` status → `/pending` (polls for approval, shows a sample
feed, lets the applicant apply to job openings even before their own account
is cleared) → approved → `/choose-team` (optional department browse, not a
gate) → the live app. A rejected or suspended account lands on `/rejected`,
where a suspended/deleted account can self-serve an appeal that re-enters the
same queue; a rejected account must wait 30 days and reapply from scratch.

**Must hold:**
- An application is not "complete," and the funnel keeps re-checking this on
  every visit, until both class/grade and a real phone number are on file.
- One phone number = one account (owner, 2026-11-01). Setting or changing a
  phone to one another live account already has is blocked, and the member sees
  the registered email masked. Rejected, deleted and soft-deleted accounts free
  their number. The 13 groups that already shared a number before the rule are
  left alone; HR sees them, unmasked, in Approvals under "shared phones"
  (HR/super-admin only, owner 2026-11-02).
- A member whose own sign-up is still pending CANNOT apply to a role or ask to
  join a team (owner, 2 Nov 2026; reverses the 1 Nov rule that let them apply).
  They get a pop-up saying they are not part of AquaTerra yet and can choose
  "remind me". When HR approves them, one notification goes out and a card at
  the top of their feed asks "you wanted to join this, still want to?" (Yes opens
  the real apply flow, Not now retires it). The database enforces it: the apply
  and join-request tables accept new rows only from active members. The 31
  applications and 1 join request pending members had already filed were turned
  into reminders on 2 Nov 2026 (the original rows are kept inside the reminder).
  A rejected or suspended account also cannot apply and gets no reminder.
  The hiring desks still tag an application "account awaiting approval" and
  block "accepted" for it: that now only covers an applicant who was un-approved
  after applying, and one application a rejected member filed before the change.
- A rejected account cannot bypass the 30-day wait through any in-app path.
- Legacy recruitment URLs (`/recruitment`, `/volunteer/apply`) always
  redirect to `/login` rather than 404ing, because the org's Instagram bio
  links them.

## 2. The feed, posts & moderation

**What it's for:** the single place members see what's happening across the
org — native updates, welfare drive recaps, blog articles, and job openings,
all in one scroll. The home page *is* the feed.

**How it works today:** any active member can compose a post: pick a
category (events/welfare/content/operations/labs, auto-suggested from the
text), write a body, attach up to 4 images and 3 documents, add a link, tag
people, post through a team, tag any number of teams (the post then also
appears on each tagged team's page; added 2026-10-03, not available when
editing a rejected post), and optionally add up to 2 highlighted stat
blocks. Welfare/event posts additionally require a location, at least 2
photos, a drive link, at least one tagged person, and a volunteer count.
Blog posts are the same underlying object with a headline and cover photo
requirement. Job openings can be created inline and register with the hiring
system at the same time. A leader can post as "AquaTerra" (not personally),
schedule a future auto-publish, write up to 5x the body length, and give
their post a headline. A plain member's post goes to a moderation queue; a
leader's own post is live immediately. An author can edit and resubmit a
rejected post without creating a duplicate.

A post detail page supports like, threaded comments, share (link, story
card, or poster), save, edit-in-place, leader delete, and super-admin pin to
the notice board.

**Must hold:**
- A plain member's post never appears in the public feed before a leader
  approves it, regardless of who is viewing.
- A "block"-severity profanity match always stops submission outright, even
  for a leader; a "flag"-severity match forces even a leader's post into
  review.
- An author's edit-and-resubmit changes text/category on the same row — it
  never silently creates a second post.
- A failed image/document upload aborts the whole post rather than
  publishing text-only.

## 3. Profiles

**What it's for:** a member's own record of their AquaTerra involvement, and
a public-facing summary of anyone else's.

**Covers:** posts/tagged/achievements/about/wall tabs; self-reported
external achievements (auto-approved on creation) with an optional proof
image; a real, derived hours-and-drive-count summary sourced from actual
attendance records (never estimated); a certificate/LoR/LoV request button
feeding the Certificates desk; a CV generator that composes strictly from
real AquaTerra data (tenure, teams, verified hours, approved achievements)
and never fabricates content for a thin record; a self-service Member of the
Month claim flow (photo → auto-poster → auto-post → share) when a member is
the pick; a "my tasks" list of SOP/goal items a director assigned, hidden
entirely when empty; self-declared break mode (date range, reason, visible
to the member's team as a banner, with zero effect on any ranking); an
opt-in public "wall" where visitors leave short notes, removable by either
party with a 5-second undo.

Settings (`/settings`) covers account info, WhatsApp contact number
(explicitly offering "own or guardian's" given the teen userbase), a
birthday-sharing privacy toggle defaulted **off**, and an honestly-labeled
"coming soon" state for notification/appearance preferences rather than a
fake toggle. There is no in-app hard delete — deactivation goes through a
director request, deletion through an email request.

**Must hold:**
- A CV or hours figure is never shown as a number that isn't backed by a
  real record — a thin profile produces a short CV, not a padded one.
- Break mode never removes a member from anything or affects any ranking
  (there is no ranking to affect).
- The profile wall is opt-out-able by the profile owner and off entirely
  removes the tab, not just the input.

## 4. Teams

**What it's for:** the org's organizational structure — 8 departments
(Events, Welfare Projects, Social Media, Collabs, Crftd, AQ.Ventures,
ShikshAQ, Human Resources), each with a public listing and a detail page,
some with sub-teams.

**Covers:** About/Members/Openings tabs for everyone; Pending Posts/
Applications/Responses tabs for that team's leads and directors only. A
member can browse, follow a team, ask to join (creates a join request, never
adds to the roster automatically), and apply to any of the team's openings.
A lead or director can add members directly, approve/reject join requests,
and review opening applicants.

**The team page (as of 2026-10-03):** team name and cover picture (HoDs and
directors set it from the Teams desk), the description written by the HoD,
linked sub-departments, a feed of every post that tags the team, a members
list with HoDs and Directors listed first and highlighted, and an "open
roles" section that is always present. A standing role is an open role with
no deadline and never expires; with none listed the section says so and
offers the way in. `/opportunities` carries the same "always open" band. The
About page's hero is the organisation as one interactive picture (owner,
2026-10-13): AquaTerra, then a card per department (name, member count, a few
avatars), joined by connector curves. Tap a department to open its panel: what
is inside it, then its people; tap a sub-department to go deeper; a breadcrumb
goes back up, Escape closes, and every node ends in a link to its own page. A
search box finds a person, a department or a sub-department and opens straight
to it. A department can sit inside another (Marketing holds Social Media and
Digital Magazine, set in `teams.parent_team_id`): `/teams` is this same chart (since
2026-10-18 it replaces the old card grid) and lists only top-level
departments, each card naming every team inside it with its member count, the parent's card counts the people inside it, and the parent's
panel and page show the departments inside it with their own sub-departments.
People are shown to everyone, with the same fields the team pages already show
(name and photo, each linking to the member's profile). The page's lower
"departments" list is kept as a plain directory.

**Must hold:** asking to join a team never adds someone to the roster by
itself — it always waits on a lead/director approval.

## 5. Search & discovery

`/search` (member-only, Cmd/Ctrl+K from anywhere) unifies drives, posts,
members, teams, openings, schools, and classes in one query, with time
filters and a trending-posts rail. No public/anonymous search surface exists
today.

## 6. Calendar

`/calendar` (member-only) is a read-only aggregation of four layers — welfare
drives, the viewer's own breaks, hiring/SOP deadlines, and opted-in member
birthdays — over a month grid or mobile agenda. It never writes data; it
only reflects what other features own.

## 7. Drives / welfare projects (field tools)

**What it's for:** running an actual in-person welfare drive, and later
publishing its story.

**Covers:** `/drive/:id/check-in` (a drive lead or leader checks in the
expected roster, allows walk-ups, tracks consent — **offline-first**,
queuing in local storage and syncing on reconnect, because a past drive lost
real check-in data to venue Wi-Fi failure); `/drive/:id/wrap` (post-drive
summary from real attendance-derived hours, auto-suggested headline stat
blocks pushed to the drive's linked post, idempotent drive-completion).
Publishing the *public* write-up (photos, narrative) for a completed drive
is a separate, later, super-admin-only step on the "Drive Write-ups" desk —
running the drive and writing it up are intentionally two different actions
by possibly different people.

**Must hold:** check-in data entered with no connectivity is never lost —
it must sync automatically once connectivity returns, and never silently
drop a queued entry.

## 8. Referrals

`/invite` lets a member mint a shareable invite link and see what happened
to invites they've sent, with a badge tier based on people actually brought
in. The referrer's identity is never disclosed to the invitee on the invite
landing page. A referral only becomes "accepted" through a director action —
never automatically and never through any user-facing control — and only
once the invitee is genuinely an active member. There is no fabricated
urgency copy ("N people waiting") anywhere in this flow, by design.

## 9. Job openings & hiring

A lightweight ATS: leaders create openings (title, description, category,
team, skills, commitment, deadline, optional custom application form with
text/file/video/url/select question types). The public can apply without an
approved AquaTerra account — the application shows to HoDs tagged "account
awaiting approval" and cannot be accepted until the applicant's own account clears. An opening's lifecycle is
strictly `open → paused → closed → deleted`; a closed or deleted opening can
never be reopened. Applicant review happens per-team or org-wide (the
Hiring desk), always with a reject-with-reason gate.

## 10. Yearbook

A leader invites specific members (search + multi-select) into the current
year's edition. An invited member submits a short quote and a photo, or
explicitly (and reversibly) skips the year. An uninvited member sees an
honest "not on this year's list" state rather than a broken form. Submitted
entries feed the org's Instagram poster export.

## 11. Notifications

In-app only today — push and email are explicitly "coming in a future
update," not silently missing. Types: like, comment, tag, follow, new post
from someone followed, post approved/rejected, team invite, team join
request/accepted, system, wall note, break set. Repeated like/comment
notifications on the same target roll up into one digest line rather than
flooding the list.

Added 2-3 Nov 2026 (overnight "everything connects" pass):
- **Who answers for a team.** The `lead` role no longer exists (team roles are
  only `member`), so a join request or application notifies the HoDs and
  directors scoped to that team or any parent team, and HR when none is
  scoped (`team_leader_ids()`). The notice opens the team's Applications tab.
- **Every handoff tells the person.** Accepted applicant: notice links to their
  team. Declined join request: its own type, links to the team. Approved
  member: told to pick a team (or say hello), and whoever invited them is
  thanked. Taken off a team: told. Written but waiting on one database
  migration: a task you are added to, an answer to your bug or feature report,
  being made lead of a drive, and a drive completed (to everyone who checked in).
- **One prompt at the top of the feed at a time.** The "you wanted to join X"
  card beats the "waiting on you" card (overdue or due-soon tasks, a drive you
  lead, a fix to confirm), which beats the profile nudge.
- The Notifications page filters by Teams and Work, and has Load older.

## 11a. Honours (`/honours`)

Every Member of the Month ever announced, month by month, signed-in members
only. Each card links to the person, their team and their wall ("say
congratulations"). Reached from the Member of the Month card on a team page and
on the winner's profile. The home-page rail card stays removed (owner,
2026-09-14); a future-dated pick stays hidden by the database until its month.

## 12. Saved posts & follows

`/saved` bookmarks any post/drive/opening, filterable by kind. A real
follow graph exists for both members and teams (self-follow blocked, no
duplicate follows) and drives notifications — there is currently no
dedicated "following feed" view; follows only affect notifications and
profile context.

Since 3 Nov 2026 the followers and following figures on a public profile open
a list of people (each a link), a signed-in visitor sees the Wall tab even when
it is empty so the first note can be written, and a profile says which teams
you share with the person ("you're both on Events"). Rosters, wall notes and
the leadership list on a team page all link to the person's profile (your own
editable one, or everyone else's public one).

## 13. External achievements

Covered under Profiles (§3) — self-reported non-AquaTerra accomplishments
(leadership, academic, competition, personal project, other) with optional
proof and date range, auto-approved on creation.

---

## 14. Leadership — the HoD/Director desks

All 18 desks live under `/director`, gated first by "is this person a
leader at all," then by whether the specific desk requires ordinary leader
access or HR/super-admin access, and further narrowable per-leader by the
Roles & Permissions desk (§15). **Route-level gating and dashboard tab
visibility must always match** — a gap between them has been a real,
previously-fixed bug (a lower-privileged leader reaching a super-admin-only
screen by typing the URL directly).

| # | Desk | Access | What it's for |
|---|---|---|---|
| 1 | Approvals | HR/super-admin | Approve or reject new account applications, with an optional rejection note shown to the applicant. A "shared phones" tab lists live accounts that share a phone number (full names, emails and numbers, HR/super-admin only). |
| 2 | Post Queue | Leader (category-scoped) | Review every member-authored post awaiting moderation; approve/reject individually or in bulk. |
| 3 | Blog Drafts | Leader | Publish or schedule long-form articles submitted via the composer. |
| 4 | Members | Leader | Full member directory — role, teams, contact, break status; manage team membership. |
| 5 | Member of the Month | Any HoD or director, HR and super admin, for any team | Pick one or more honorees per team per month (changed from exactly one on 2026-10-03; the same member can't be picked twice in a team-month); generates a shareable poster automatically. A pick saved for a future month is announced (member notice and a feed post under the AquaTerra account) by a daily job at 00:10 IST once the month begins; the nominee must still be an active member of that team. |
| 6 | Teams | Leader | Create/edit department records (name, category, description, logo, and the team picture shown on the Teams page and each team's page). |
| 7 | Moderation (was Categories) | Leader | Assign which teams a director/HoD moderates. A HoD's Post Queue is the posts tagged to their teams (a parent department covers the teams inside it) plus any post nobody has tagged; with no team assigned they see the whole queue. Super admin and HR assign; a plain HoD sees only their own. The five fixed categories are retired from moderation. |
| 8 | Hiring | Leader | Org-wide view of every job application across every team, with outreach templates. |
| 9 | Enquiries | Leader | Contact-form and collaboration-form submissions with a status pipeline. |
| 10 | Certificates | HR/super-admin | Issue or decline certificate/LoR/LoV requests, showing the requester's real derived hours. A decision cannot be reopened. The requester is notified, and HR sends an issued document to the member by hand (owner decision, 2026-11-02). |
| 11 | Yearbook | Leader | Invite/search members into the current edition; review submissions. |
| 12 | All posts (was Content) | Leader | Every post on the feed, for review and tidying: approve or reject (reject needs a reason and tells the author), edit, pin, feature, delete. Each needs the approve-posts or delete-posts capability and is audited. It is not an editor for public page copy; no such tool is built. |
| 13 | Drive Write-ups | HR/super-admin | Publish the public-facing story for a completed welfare drive. |
| 14 | Manage HoDs | HR/super-admin | Promote a member to HoD/director or demote back — with a guard against an admin locking themselves out. |
| 15 | Vol. Applications | HR/super-admin | The volunteer outreach list: labels, a reviewed mark, a live counter and a spreadsheet export of emails and phones that asks first and is audited. Kept live by owner decision (2026-11-02); not a sign-up path. |
| 16 | Roles & Permissions | HR/super-admin | Wired capability matrix — see §15. |
| 17 | Activity Log | HR/super-admin | Audit trail of approvals/rejections/role changes/team-membership changes. |
| 18 | Product guide | Leader | Every page and desk in plain language, filterable by role, with a map of what connects to what. Generated from the code and rebuilt every session; the same page is not public because it lists staff desks. Added 2026-11-02. |

**Must hold:** every desk's route guard and its nav-tab visibility gate the
exact same set of roles. Adding a new desk without updating both is a
regression, not a style choice.

## 15. Roles & Permissions engine

Rather than being documentation, `/director/roles` is a real, wired
capability matrix: each checkbox controls an actual gate in both navigation
and routing. A cell representing access a role could never have at the
database level is shown **locked**, with a reason — the UI never implies a
control would work if only it were ticked. A super admin's own row can
never be locked off, so the org can't accidentally remove its own access to
this very screen.

## 16. Public marketing & informational pages

`/join` (pre-application pitch, not an interstitial in front of login),
`/opportunities`, `/schools`, `/classes` (auto-generated real cohorts from
member data), `/directory` ("the AQ map," every figure explicitly tagged
canonical/live/unsourced per the "never invent a number" rule), `/volunteer`
(handbook + FAQ), `/faq`, `/about`, `/collaborations`, `/contact`,
`/thank-you`. All public, all anonymous-accessible.

## 17. Demo / guided walkthroughs

`/demo` is **not** an internal training tool — it's a pre-signup product
tour for a prospective member, requiring no account and writing nothing to
the real database. It shadows the real auth context and Supabase calls
behind fabricated-but-plausible fixture data, so a visitor sees the actual
product screens (the real composer, the real HoD approval desk, etc.)
walking through 11 scripted flows (posting, applying, joining a drive,
searching, leaving a wall note, requesting a certificate, generating a CV,
setting a break, a HoD approving an account, moderating a post, posting an
opening) without ever creating a real Supabase session.

**Must hold:** no demo session may ever write to the real database or
acquire a real Supabase auth token, regardless of what the visitor is
actually signed in as elsewhere.

---

## 18. Paradox — the annual fest sub-app

A fully separate product living at `/paradox/*` for the org's annual
cultural/fundraising festival, with its own auth, nav, and visual system.

**Public side:** event listing/detail across Sports/Business/Creative/
Cultural categories (solo/duo/team formats, fees, rules, capacity); inline
registration; a QR ticket page; a hand-maintained schedule (deliberately not
database-driven, since real-world day splits don't map cleanly to a simple
events table); a live scores/announcements feed; sponsor, volunteer, and
organizer-contact pages; a separately-ticketed after-party with a
date-based pricing ladder.

**Admin ("Paradox OS"):** its own login, entirely separate from the main
AquaTerra HoD desk. A Control Room replacing roughly 11 spreadsheets
(per-event status, runbook tracking, a formal "greenlight" gate that
commits an event to run); a finance ledger with expense reconciliation and
a refund queue; a WhatsApp comms module with send-logging so nothing
double-fires; a fixtures generator that refuses to publish a schedule
violating its own constraints (no back-to-back matches, no lunch-window
matches, finals on one court); a judging module with weighted rubrics,
tie-handling, a blind mode, and on-the-fly certificate generation; a
generic records grid for sponsor/school/vendor CRM; offline-first door
check-in; and a post-mortem analytics module reconciling registration,
payment, and attendance against the ledger.

**Must hold:** every admin module degrades gracefully — checks whether its
backing data exists and shows a "needs setup" state rather than crashing —
because this sub-app's tables are provisioned per-year and may not all
exist yet at any given moment.

## 19. TerraThon — the inter-school tournament sub-app

A standalone registration and check-in product at `/terrathon/*` for a
multi-sport inter-school tournament (cricket, pickleball, console gaming),
sharing this app's member auth for its admin desk but otherwise a fully
separate visual system.

**Public side:** home/countdown, per-sport registration with phone
normalization and draft auto-save, sport detail pages, schedule, rules (a
required, actually-linked consent step), WhatsApp-first contact with two
named real people. The ticket page deliberately does **no** database lookup
and shows no PII — check-in resolution only happens server-side under an
authenticated admin session, specifically so a forwarded ticket screenshot
can't be used to derive anything.

**Admin:** its own branded login (separate from both `/login` and the main
HoD desk); a dashboard for payment/messaging status, manual entry, and
Excel export; an offline-first gate scanner with distinct outcomes for
admit/already-checked-in/invalid/queued/failed states and feedback tuned
for a loud gate line; a plain black-and-white printable roster as the
last-resort fallback if both Wi-Fi and the offline cache fail on event day.

**Must hold:** the public ticket page never reveals participant PII from a
token alone, under any circumstance — that's a deliberate anti-fraud
property, not an oversight to "fix."

---

## 20. Terra Notes — the monthly digital magazine (`/terranotes`)

AquaTerra's monthly digital magazine, written, photographed and designed by
members. Public, anonymous-accessible, no database: every article, photo,
word and team card is checked-in data (`frontend/src/terranotes/data/`), so
"working correctly" means the page matches that data, not a query.

- **Where it lives.** `/terranotes` (home), `/terranotes/articles` (all
  articles), `/photos`, `/words`, `/members`, `/editions` under that prefix,
  and `/terranotes/articles/<slug>` for each piece. The top nav's fourth tab
  ("terra notes"), the explore dropdown, the full menu, the mobile bottom dock
  ("notes") and the mobile drawer all link to it.
- **What it is.** "Notes pegged on a line": a home page of hanging article
  cards, a photo wall with a viewer, a words mini-game, and a "meet the team"
  section, plus a page per article. It keeps its own design language (paper
  cards, ink borders, handwriting) and is deliberately NOT restyled into
  AquaTerra's. It is drawn at fixed widths (a 390px phone layout under 900px
  windows, a 1440px layout scaled to fit from 900px up). AquaTerra's top nav,
  mobile dock and footer wrap it; the magazine's own header is hidden. The AquaTerra companion mascot and the
  first-run welcome dialog stay off it.
- **AQ Labs '26 is an issue of it.** `/terranotes/articles/labs` is the AQ
  Labs team's own gallery site (eight projects, a 3D bookshelf on web, one
  chapter at a time on phone), in the teams' own words, with the Wisdom Woods
  demo opening in a new tab at `.../labs/wisdom-woods/demo`. `/labs` and
  `/labs/<slug>` redirect there permanently, so old links keep working.
- **Behaviours worth checking.** The opening notebook animation plays on a
  first visit, again after 2.5 hours, on a hard refresh, and always with
  `?intro`; automated browsers never get it. Motion honours reduced motion
  and `?lite` (low-end devices). Writers' article text is verbatim, typos
  included.
- **Nothing to moderate.** No user input, no accounts, no tables. Content
  changes are code changes.

## Explicitly not built / retired

Listed here so a review pass treats these as known state, not bugs:

- **The welfare-points/gamification system.** Fully retired app-wide.
  Nothing should reintroduce scoring or ranking.
- **Push and email notifications.** In-app only today; explicitly labeled
  "coming soon" in Settings, not a broken promise.
- **A dedicated "following feed."** The follow graph exists and drives
  notifications, but there is no separate feed filtered to just who you
  follow.
- **A public school directory for the campus-chapter model.** `/schools`
  honestly states this doesn't exist yet.
- **Auto-ranking for achievements or Member of the Month.** Always a human
  pick.
- **In-app hard account deletion.** Always routed through a director
  request (deactivate) or an email request (delete).
- **The standalone `/labs` page** (the seven-project AQ Labs '26 cohort page
  built in the September 2026 redesign). Replaced by the eight-project
  gallery inside Terra Notes; `/labs` redirects to it. Not a bug that it
  is gone.
- **The pre-2026 WhatsApp volunteer-outreach process as an intake path.** The
  Vol. Applications desk stays a live working list (owner, 2026-11-02), but
  people sign up through Google, not through it.


## 21. Mini games (`/games`)

A hub at `/games` and one page per game at `/games/:slug`. Public, no sign-in, nothing stored: a game is a short
diversion from the AquaTerra crew, not a feature that keeps state. The full menu has a "mini games" column (a link to the hub
plus one pill per game); on phones the menu sheet carries a "Mini games" row. Until the first game ships the hub shows a
"the first games land here soon" state and an unknown `/games/<slug>` shows a way back to the hub. Games are registered in
`frontend/src/games/games.ts`, one entry each.

## 22. Bugs and requests (`/bugs`)

Any member files a bug or an idea (a feature request) and sees every other report. The page is written for a member, not
for the routine: a card per report with one plain status (waiting its turn, being fixed, we have a question, fixed, fixed
and checked, nothing to change, not going ahead), three tabs (open, fixed, closed), a search box, "mine" and "most wanted"
toggles, and a "more" panel for kind and area. A big **me too** tile on each card adds the member's voice instead of a
duplicate report; the count on it is everyone who wants the same thing, including reports the routine folded under it.
The reporter (and anyone who said me too) answers "did this fix it?" on the card itself once a report is fixed; "no, still
broken" sends it back with their reason. Leaders see a folded **leader tools** panel inside the opened card: the next step,
importance, roadmap lane, type, area and decline. Members never see a control they cannot use.

Every report is worked by the daily routine, most wanted first (owner decision 2026-10-22; a leader's approval no longer
gates work). Every fix passes **two checks**: the routine marks a report **solved**, then a leader checks the live site and
ticks **verified**. If the fix did not hold, the leader presses "not fixed, send back" (with a reason) or the reporter
answers "no, still broken": the report returns to the routine's queue first in line, carrying the reason and a "sent back N
times" count, and the routine reproduces the failure before changing anything. After the third send-back it stops and asks
a person. Reports the routine audits and finds nothing to change are closed as "nothing to change" (a leader can reopen
one). A small strip at the top says when the morning check last ran and how many things it fixed. Only the routine can take
a report up (the database refuses a signed-in session).

## 23. Tasks (`/tasks`)

Slice 1 of the task tracker (plan: `docs/plans/task-tracker.md`). Any active member can create a task. A task is either a
**team task** (everyone in the team can see it) or a **general task** (private to the people on it, even from HR and
super admin). Everyone on a task has one of three roles: **performer** (does it), **supervisor** (receives the result,
usually whoever assigned it, and the creator is added as supervisor unless they pick another role) and **spectator**
(follows and can add input; a **silent** spectator sees everything and changes nothing). Only performers, supervisors
and non-silent spectators can edit a task, change its people, set its status (open, in progress, blocked, done) or
comment; a team member who is not on a team task can read it and nothing more. A moved due date is logged, and the first
due date is kept so a delay still counts against it. The page has tabs for what you do, supervise and follow, your
teams' tasks and what is done. The top of the page shows three tiles (on your plate, due in two days, running late), each
task has a circle to mark it done or reopen it without opening it, and the people on it show as an avatar stack. Slice 2:
when making or editing a task, "add a whole team" puts everyone currently on a team on it with one role (spectators is
the usual choice); anyone already listed keeps their role, the creator is skipped so they stay supervisor, and a team of
more than 25 asks first. A team page has a **tasks** tab for members of the team and leaders, listing that team's tasks
with the same rows and detail as `/tasks`. Slice 3: a profile has a **tasks** tab listing what that person performs or
supervises (never what they only follow); on someone else's profile it shows only the part the viewer may already see,
so a private task stays private. Slice 4, the part that needs no new data access: on the done tab a member sees their
own record on tasks they perform (finished on time, tasks finished, days late on average, dates moved), and a team's
tasks tab opens with a table of who is on what (open, overdue, done, on time). Not built: an organisation-wide view for
HR and super admin that counts private tasks without showing them (it needs a database function and a decision on who
sees which counts; see `docs/plans/task-tracker.md`). The older HoD "SOPs and goals" desk is a separate feature and is
untouched.

---

## Open product questions worth a human decision

These are genuine gaps or tensions this audit surfaced, not asserted bugs —
flagging them here so they're picked up as product decisions rather than
silently "fixed" one way by an automated pass:

1. Should a "following feed" ship, now that the follow graph and
   notifications already exist for it?
2. Should the campus-chapter/school directory model get a real public
   directory, or should `/schools` keep stating it doesn't exist?
3. Push/email notifications — worth prioritizing, or staying in-app only?
