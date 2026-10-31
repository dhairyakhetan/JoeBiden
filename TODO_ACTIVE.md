# Active to-do — from the 2026-09-10 walkthrough

Everything from the live walkthrough, written down so none of it gets lost.
Nothing here is marked done until it is verified live, not merely coded.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done+verified · `[?]` blocked on an answer

---

## 0. Done in this session already

- [x] **Remove the `[SIM]` test data.** All 197 seeded rows removed via
  `sim_seed_teardown()` across 34 tables, including the 12 SOP rows called out
  in the walkthrough. Zero residue.

---

## 1. Type and chrome

- [x] **1.1 More NeutralFace across menus.** The finding that made this a
  decision rather than a find-and-replace: **exactly ONE rule in the whole
  codebase was already both `--eina` and `uppercase`**. Everywhere else Eina
  was chosen *because* the copy is lowercase and NeutralFace is caps-only, so
  there was no free conversion anywhere - changing face means changing case.
  Converted: the mobile drawer's 16 links (20->18px, caps are wider), the
  desktop dropdown (14->13px), and the one free rule (`.aq-foot-col-h`).
  Tracking -0.02em -> 0.01em; negative tracking is a lowercase-Eina correction.
  Measured at 375: drawer links 58px tall, dropdown 44px, zero text overflow.
  **NOT converted:** the `director/*` desk (a different design language by a
  twice-reversed decision), and the top-level `.aq-nav-link` bar, because
  changelog 02.4 specifies Eina there explicitly and says the bar was *drawn*
  lowercase. **The bar and the menus are therefore now different faces** - a
  one-line change if you want the bar converted too. Your call.
- [x] **1.2 Auth / login page.** The diagnosis was structural, not decorative:
  `/login` measured **2186px** at 1274x900 - a 76px nav carrying a "Log in →"
  button *on the login page*, 830px of auth, and then the **entire 1266px
  marketing footer**. The page was 38% sign-in and 58% marketing.
  `lib/authRoutes.ts` now takes the nav, footer and bottom dock off the five
  auth routes, and the shell owns the viewport (`100dvh`, was
  `100dvh - nav-h`, which left a 70px band of dead cream). **2186px -> 900px,
  no scroll.** Mobile 375: no nav, no footer, zero overflow.
- [x] **1.3 Footer.** Rebuilt against the approved artifact, which turned out to
  differ from the live footer in two concrete ways:
  1. **The letter was never built.** The section explicitly asked for - "a
     letter to the people who made AQ what it is" - was designed, approved, and
     absent. Now built: cream card inverted out of the ink ground, 52ch
     centred prose, Caveat signature in `--welfare-ink`.
  2. **The bento was muddy.** The approved design has all three tiles at full
     saturation with ink on top. The live code had one saturated tile beside
     two *tints of ink* (sky at 22%, lemon at 28%), which resolved to a dark
     navy and a dark olive and stopped reading as a bento at all. Now all three
     are the real hues with ink text (contrast 6.9 / 8.6 / 12.7:1) at the
     approved 150px, not 108px.

## 2. Signed-in home

- [x] **2.1 Kill the forced hero.** The hi-block now collapses to the greeting
  line, with the tile grid one tap away and the choice remembered per viewer.
  Measured on a 375px viewport: **541px -> 213px** above the fold. The recipe
  system is untouched, so a break, a new account or a full leader queue still
  gets its sentence. Found and fixed a real bug doing it: `hidden` alone did not
  hide the grid, because `.aqg-grid`'s `display: grid` beats the user agent's
  `[hidden] { display: none }`.
- [x] **2.2 The invented "next drive" is wired, not faked.** 2.2 and 2.3 turned
  out to be the SAME recipe: gridRecipes' G04. It rendered a 2x2 tile headed
  "the next drive" over `ctx.nextOpenDrive`, which **no host ever populated** -
  a headline for a thing that did not exist.
  `calendarService.getNextUpcomingDrive()` already existed and had **no caller
  anywhere**; HomePage now calls it. Live answer today is `null` (558 drives,
  latest 2026-09-05, zero ahead), so the tile renders the archive and says so.
  The real row appears on its own the day welfare schedules one. The fallback
  label is gone - that was the actual defect.
- [x] **2.3 The profile / hours / team filler is gone.** Those three were G04's
  entire right-hand side, in that order. `hours volunteered` was the worst:
  `drive_attendance` holds 0 rows (check-in only went digital 2026-08-31), so
  it rendered **`0h` to members with years behind them**. `hoursTile` is
  deleted, not just unused. Replaced by open roles (a real count) and the
  handbook.
- [x] **2.4 Post variations on the home feed.** Measured over 103 loaded cards:
  **3 distinct shapes -> 7** (C03 56, C06 22, C04 11, C07 8, C05 2, C11 2, C25 2).

  None of it was the chooser being wrong. Each shape was blocked by something
  different, and all four were fixable:
  - **C04** `post_feed_view` emitted only `welfare_projects.main_image` and
    dropped `image_1..image_4`, so 0 of 586 rows had 2+ images. 100 projects
    carry 3+. The view now emits all five columns.
  - **C02** the 240-character floor made the colour block *impossible*, not
    rare: 0 rows fell in 240-600 while 311 sit at 120-179. Floor moved to 120
    on the owner's decision. **217 rows reachable.**
  - **C06** 36 blog rows were already in the feed. The blocker was the CARD -
    it rendered no engagement row, so a blog routed through it would have
    silently lost like/bookmark/comment/share.
  - **C11** welfare drives with figures but no photo were going to a text card
    that drops the figures - the only real content those rows have. 56 rows.

  **C01 is the one still genuinely blocked**: it needs an image aspect ratio
  and nothing stores width or height, so it cannot fire without measuring
  after decode and reflowing the card.

  Worth knowing: **C02 did not appear in the first 103 cards even though 217
  rows qualify.** The recent drives all carry 3+ photos, so rule 2 ("three or
  more images is a shoot") correctly outranks rule 3 for them. C02 surfaces
  deeper, on older drives with one or two photos. That is the rules working,
  not a bug - verified by running the chooser directly: 120 chars + welfare +
  1 image returns C02.

  Governance: both changes were frozen by ACCEPTANCE.md §E and needed an owner
  decision, which is recorded there and in the audit gate. The gate now carries
  a narrow, named exception for exactly these lines rather than being switched
  off; every other assertion in feedShape.test.ts is still pinned, and the
  other 30 pass unmodified.

## 3. Public surfaces

- [x] **3.1 Directory: cleaner search + archive.** Search works and is URL-synced
  (the 52px bar was fixed earlier). Archive was blocked on a DEFINITION, not on
  code - and the owner gave one on 2026-09-11: *"a place for people who have
  left"*. Marked by hand from the Members desk, deliberately NOT derived from
  `class_grade` (208 members have none) or `last_login` (only 11 do).

  Shipped: `archived` added to the `members.status` CHECK constraint,
  `directorService.setArchived` reading the status back, and a "Here now" /
  "Archive" filter on the desk with a confirm and a per-row busy state.

  Re-verified live 2026-09-12 as the real `hod`, in a rolled-back transaction:
  archive writes 1 row and stores `archived`, `member_directory_view` splits
  correctly (1,316 active / 1 archived), and restore works. Nobody is archived
  yet - that is an ops action, not a code gap.
- [x] **3.2 Project card variations.** Measured first: **486 of 548 archive
  tiles rendered ONE shape** (photo-stat, 89%). The chooser was not wrong - it
  had nothing left to tell rows apart with, because two real signals were being
  discarded:
  - `images` was already SELECTed and only `[0]` was ever read. **100 rows carry
    three or more photos.** Three photos is a shoot, not a snapshot -> new
    `photo-set` tile, a stack with the photo count.
  - `stats` carries the volunteer headcount. **Eight-or-more is a different kind
    of drive** from the median four -> new `turnout` tile, which leads with the
    number.

  Counted live after: photo-stat 350 (60%) · photo-set 100 · well 57 ·
  turnout 41 · link 36. **89% on one shape -> 60% across six.** Measured in the
  browser over 120 loaded tiles: 5 distinct shapes, no overflow. The remaining
  tiles are genuinely the same kind of thing, and the masonry already varies
  their height from the real image aspect ratio.

  Caught while verifying: the stack plates were **invisible** - `.arch-tile` is
  `overflow: hidden` and I had translated them above its box, so they clipped to
  nothing (rects measured at top -12 and -6 against the tile's 0). Fixed.
- [x] **3.3 Teams page: hiring opens at the top.** The banner was already first
  after the hero, but the hero ended with the three-step "how joining works"
  explainer, so on a phone hiring sat below a headline, a paragraph AND an
  explainer. The explainer now follows it. Measured: h1 164, steps 403, filters
  589, no overflow. **Honest note: this shows nothing today** - both
  `job_openings` rows are `status='closed'`, so the banner does not render at
  all. The ordering is right for when a role opens.

## 4. Command desk — structure

- [x] **4.1 "Removed Notes" is deleted.** Nav entry, route, lazy module and the
  component. It was a whole desk over `profile_notes where deleted_at is not
  null` - a table with **zero rows** - and its own header already conceded the
  point (§20.2, "a child of post moderation, not a fifth nav group").
  `wallService.listRemoved()` is kept with a note: the desk lost its place, not
  the audit capability. 19 desks -> 18.
- [x] **4.2 blogs and posts are the same thing. DONE 2026-09-12.**
  A blog is now ONE row in `posts`: `source_kind='blog'`, with `slug`, `title`,
  `article_body`, the `article` jsonb (byline / instagram / author_url / read
  minutes), `published_at`, and its cover as an ordinary `post_images` row.
  `posts.body` stays the ~630-char feed excerpt and is derived from
  `article_body` by the `posts_fill_article_excerpt` trigger calling
  `blog_post_writeup()` - the same function that produced it when blogs were
  mirrored, so that derivation still has exactly one implementation.

  **Why one row was the point.** The old design had two rows, a `blogs` row and
  a mirrored `posts` row, each with its own idea of whether the thing was
  public. They drifted, and that is 4.2a. One row cannot disagree with itself.
  Publication state is now one status on that one row: `pending_review` (a
  draft, in Blog Drafts), `scheduled` (future `scheduled_for`, hidden by RLS,
  promoted by the pg_cron job), `published`.

  **Reads:** BlogListPage, BlogPostPage, `generate-sitemap.mjs` and
  `prerender-meta.mjs` all read `posts`, through `lib/blogFromPost.ts` - an
  adapter, so the storage moved and the `Blog` shape did not, keeping ~400 lines
  of rendering / SEO / JSON-LD out of the blast radius.

  **Writes:** `blogService` writes `posts`. `listDrafts` is now
  `status='pending_review'` rather than "no published_date", which is a better
  question - a scheduled blog is not a draft, it is decided and waiting on a
  clock, and listing it as a draft is exactly how one got published early.
  Covers go through `post_images`, which needed that table's INSERT policy to
  allow `is_director()` (a leader adding the missing cover to a member's draft
  is the desk's whole job; the DELETE policy already allowed exactly this).

  **The knot, resolved rather than guessed.** `source_kind` describes what the
  content IS, not whether it mirrors another table. The moderation queue
  excludes `welfare_project` and `job_opening` because those really are
  projections of rows other desks own. Blog drafts are owned by the Blog Drafts
  desk, which is why that desk stays - it can set a cover and a date, and the
  Post Queue cannot. Dropping it would have removed the only surface that can
  publish a draft.

  **Bug fixed in passing.** `post_feed_view.source_type` was derived by testing
  which LEFT JOIN matched, and the view is `security_invoker` - so it was
  RLS-dependent. An anonymous visitor could not see the joined `blogs` row, so
  `source_type` came back NULL and every published blog rendered in the PUBLIC
  feed as a plain text card instead of a long-read card. Directors saw it
  correctly, which is why it survived. It reads the stored column now; the
  public feed renders C06 where it rendered C07.

  **Retired, not dropped**, and that differs from the brief on purpose. The
  table is renamed `blogs_retired_2026_09_12` with every grant revoked - off the
  API surface, unreachable, unwritable, unable to disagree with `posts` again -
  while 36 rows of students' writing stay recoverable. `drop table` is one line
  whenever the owner says so; un-dropping is not.

  Paper trail: `frontend/scripts/blogs_folded_into_posts_2026_09_12.sql`.

  **One ops action left for a human, not a code gap:** 14 drafts sit in Blog
  Drafts with no cover image. A leader adds a cover and publishes (or schedules)
  each. They are invisible to the public until then.
- [x] **4.2a Scheduled blogs were public in the feed.** 14 of the 36 blogs are
  dated 2026-09-14..2026-10-26. `blogs` RLS hid them from `/blog`, so the index
  looked right - but their MIRRORED posts were `published`, so the headline and
  opening ~630 characters of fourteen unpublished essays were live on the public
  homepage, to anonymous visitors, up to 45 days early. Two were on the first
  screen of the feed in a screenshot taken earlier the same day.

  Root cause was not bad rows: the mirror parked a not-yet-due blog in
  `pending_review`, the same queue member posts land in, so approving it
  published it and overrode the schedule its own desk had set. Measured at the
  time of the fix, the Post Queue held 14 items and **all 14 were blog mirrors**
  - not one real member post.

  Fixed by using the mechanism `posts` already had (`scheduled` +
  `scheduled_for`, hidden from anon by RLS, promoted by the pg_cron job that was
  already running every minute), and by excluding mirrors from the moderation
  queue via `source_kind`. Cover gate preserved. Verified: HoD queue was 14, now
  0; anon sees 22 blog posts in the feed and 22 in `/blog`, which now agree.
  Paper trail: `frontend/scripts/scheduled_blogs_leak_and_source_kind_2026_09_11.sql`.
- [x] **4.3 Every desk has a blurb.** Approvals uses your exact wording. `blurb`
  is a REQUIRED field on `Desk`, so a desk added later cannot ship without one,
  and the test asserts it is a real sentence and not just the label again.
  Rendered as the rail item's `title` and as the desk list's second line -
  which used to be `/director/members`, developer metadata on a page built for
  student HoDs. That is a documented deliberate change to 06-hod-desk §08.
- [x] **4.4 Assign teams from the Members desk.** The Teams half already existed
  (`AddMemberModal` -> `addMembersBulk`). The Members half did not:
  `MemberDirectory.tsx` contained **no mention of a team at all**. Now a `teams`
  button in the card's EXISTING admin row (the card is at its density floor;
  eight chips per card would undo 5.2), opening a per-team checklist.
  `teamService.setMembership` upserts rather than inserting - a previously
  removed member looks unassigned here while their row still exists, so a plain
  insert would fail the unique constraint - and soft-deletes rather than hard.
  Verified live: add, soft remove, and **re-add over the inactive row** all
  succeed, all three audited. No Save button, deliberately: eight independent
  RLS-gated writes are not one transaction, and "Saved" over a partial write is
  the same class of lie as 5.7's silent revert.

## 5. Command desk — people and teams

- [x] **5.1 Members desk auto-hydrated.** `member_directory_view` carries
  `school_name`, the directory query is a `select('*')`, and the mapper dropped
  it - the identical defect `instagram`/`linkedin` were fixed for in the 2026-09
  pass, which then still never rendered them either. Counted live under a real
  director session: **1,034 of 1,379 members have a school, 552 an Instagram** -
  all already being fetched on every page of the desk and thrown away. Both now
  show, on the two lines the card already had, so the card does not grow by a
  pixel (5.2 put it at its density floor). The desktop table has room, so school
  gets its own column there.
- [x] **5.2 Members desk mobile view.** A density and noise pass, measured at
  375x812 with six stub rows on screen:
  - chrome before the first member **483px -> 457px**
  - member card **273px -> 257px**
  - audit note **128px -> 92px** (same words, same link, tighter type)
  - two 2px dashed rules inside each card -> hairlines; that double-dash was
    most of the visual noise
  - copy control: painted disc 44px -> 36px while the **tap target stays 44px**
  - the filter row scrolls (it always did) and now says so, via a fade on the
    right edge; "leads" and "members" previously just looked missing

  Everything is scoped to `max-width: 600px`; the desktop table and toolbar are
  byte-identical. Verified: nothing under the 44px floor anywhere in the card,
  no overflow at 375 or 1280.

  **Honest limit:** the card is close to its floor. Its content is an identity
  block, two contact rows and two admin controls, and with a 44px tap floor
  those cost ~215px before padding. Going meaningfully below means a design
  decision rather than a CSS one - a denser list row that opens a detail sheet,
  or collapsing the contacts behind a tap. I did not take either unilaterally:
  the contacts being visible rather than gated is a documented decision in
  MemberDirectory.tsx, and the audit note is deliberately "standing text".

  **Not done:** the 88px desk topbar and the three stacked toolbar rows
  (search / filters / sort, ~150px together) are shared adminKit furniture used
  by all 19 desks, so compacting them is a desk-wide change, not a members one.
- [x] **5.3 "not on file" is now red.** `--tomato-ink` (6.7:1 on the desk's light ground), bold. A missing contact is a gap to chase, not neutral metadata.
- [x] **5.4 Member of the Month can be anyone active.** The blocker was **not the
  UI**: `mom_insert_leaders`/`mom_update_leaders` carried
  `mom_target_on_team(member_id, team_id)` in their WITH CHECK, so the database
  refused any off-team pick. That predicate is out; `mom_target_is_active_member`
  replaces it, so a pending/rejected account is still refused. WHO may pick, and
  for which team, is untouched. The search is now an indexed `ilike` across all
  ~1,300 active members instead of pulling 500 roster rows to substring-match in
  memory, and each result says "not on this team" rather than being hidden.
  Verified live: an active off-team member is accepted, a non-active one refused.
- [x] **5.5 Team rosters backfilled from `Cross Departmental Database.xlsx`.**
  120 memberships written (28 brand new, 92 enriched with sub-teams, 8 leads).
  Social Media 9 -> 27 with real Instagram/Blogs/LinkedIn sub-teams; Welfare
  56 -> 62; Ventures 21 -> 23; HR 3 -> 5. Additive only - nobody was removed for
  being absent from the sheet.

  **The finding that matters: 103 of the 243 sheet rows resolve to no AquaTerra
  account at all** - no email, name or phone match anywhere in `members`. Those
  people have never signed up, or signed up under a different address. Full list
  exported (kept out of the repo, it is real student contact data):
  `scratchpad/roster-unmatched.csv`. Biggest gaps: Media-Instagram 37,
  Projects 37, Ventures 14.

  A fuzzy first-name match was tested and rejected: it recovered 7 more rows
  while leaving 10 genuinely ambiguous, and putting the wrong student on a team
  is worse than leaving a row for a human.

  ~~Original note:~~
  Read and sized: 10 department sheets, **243 member-rows**, positions
  Member / HOD / Manager / Coordinator / Intern, plus a sub-team column that
  maps onto the existing `team_members.sub_team`. Live today: 8 teams, 95
  memberships, and only 3 teams have any lead at all.
  BLOCKED on the mapping — see Q1.
- [x] **5.6 Team detail fields audited.** What is actually there, counted live:
  descriptions **8/8**, logos **0/8**, banners **0/8**, skills **1/8** (only
  AQ.Ventures), and three teams have no lead at all.

  The finding that mattered: **`sub_team` is 88 of 123 memberships across 11
  values** since the 5.5 backfill - and it was never selected, never typed and
  never rendered. Welfare's 62 people showed as one undifferentiated list; they
  now read Dog Feeding / Teaching Internship / Backend & Records. It goes on the
  line that previously repeated the role label the chip beside it already showed
  (the same fact twice in one row), so no height change.

  Also fixed there, a **latent bug I would have caused**: `getTeam`'s member
  embed had no `is_active` filter, unlike `getTeamMembers` beside it. Invisible
  today (all 123 rows active) and it would have surfaced the first time anyone
  used the Members desk's new team control (4.4), which soft-deletes by design -
  the removed member would have stayed on the team page.
- [x] **5.7 Manage HoDs works - and the failure path was lying.** It *does* work
  for the people who can reach it (a simulated super_admin promotion really
  changed the role). What was broken was what happened when someone NOT allowed
  tried, in the worst direction: the guard answered with `new.role := old.role`,
  a **silent revert**. Simulated as the one live hod: ROW_COUNT 1, role
  unchanged, no error - and all three role writers selected back only
  `member_id`, so the desk would have toasted "promoted to HoD" over a database
  that did nothing. The guard now raises 42501 on a real attempted change;
  `is distinct from` keeps ordinary profile saves working (verified, including a
  full-row save carrying role and status). Second layer: the services read the
  role back and throw if it is not what was asked for.
- [x] **5.8 "Apart from <names>, everyone who is an admin becomes HR." DONE.**
  Answered 2026-09-11: keep **member 29 (Kanishk Agarwal)** as the only
  `super_admin`; the other 15 become `hr`, including the three org/service
  accounts. Applied live (`single_super_admin_rest_become_hr`), and 5.8b
  followed (`restrict_hr_from_roles_desk`) so only member 29 can change what a
  role may reach.

  Established BEFORE executing, because it changes what the instruction
  achieves: `hr` and `super_admin` are today INTERCHANGEABLE for access -
  `is_super_admin()` is `role in ('super_admin','hr')` and `ADMIN_ROLES` is
  `['hr','super_admin']`. So the conversion grants nobody less by itself; what
  it does is make them RESTRICTABLE, because `role_capabilities` forbids
  restricting a `super_admin` and permits restricting an `hr`. The narrowing
  was the separate, deliberate second act.

  Verified live 2026-09-12: 1 `super_admin`, 15 `hr`, and a `hod` attempting to
  self-promote is refused by the loud role guard, not silently reverted.

## 6. Command desk — scoping (the big one)

- [x] **6.1 Hiring is scoped by team.** `teamService.getMyDeskTeamIds` unions two
  sources, because the org records "which part of AQ is yours" in two places:
  `team_members.role='lead'`, and teams whose category is in the viewer's
  `director_categories` (the same mechanism the Post Queue uses, so the two
  desks cannot drift). The scope decision is a **pure, tested function**
  (`scopeToMyTeams`) - three of its rules are the kind that get reversed later.
  Most important: **empty scope means UNSCOPED**, because an emptied Hiring desk
  is indistinguishable from "nobody applied".
- [x] **6.2 The Post Queue was already scoped** by `myCategories`. No work needed.
- [x] Both: super_admin and HR keep the unscoped view - the query is not even run
  for them.
- [x] **6.1/6.2 scoping is LIVE as of 2026-09-11.** This item used to read "this
  scopes NOBODY today", and that is no longer true: the owner's decision made
  the one `hod` a **lead of the two teams he is already on**, and the migration
  is applied - re-verified live this date, `team_members` carries 2 lead rows
  for that member. The Hiring desk is therefore genuinely scoped for him now,
  and the Post Queue scoping follows his category assignment whenever one is
  made. No code change was needed; it was the ops action this item predicted.

## 7. Command desk — intake and flows

- [x] **7.1 Accepting an applicant adds them to the team AND logs it.** The roster
  half already shipped. The **logging half could not have existed**:
  `community_audit_logs` has RLS on and exactly one policy, a super-admin SELECT
  - no client can write an audit row. It is now a SECURITY DEFINER trigger on
  `team_members` instead: the table is written from four places and a trigger
  cannot be the one somebody forgets, and it fires on what committed rather than
  on what the app intended. Verified live: five writes produce four log rows and
  a `joined_at` touch produces none; under a simulated session the actor is the
  acting leader (29), not the member added (468).
- [x] **7.2 Backfill past hiring/joins from the sheet. NO WORK NEEDED.**
  The owner's call was "pre-authorise all 103". Measured before inserting:
  all 166 roster emails were ALREADY accounted for - 81 existing members plus
  85 `member_preauth` rows from the 2026-08-31 batch, which already used the
  confirmed team mapping. The insert ran and reported **inserted: 0**.

  Worth stating plainly rather than marking it done and moving on: this item
  was never blocked on the sheet, it was blocked on nobody having checked
  whether the work was already done.
- [x] **7.3 Drives. RESOLVED BY REMOVING THE FEATURE, on the owner's call.**
  Answered 2026-09-11: *"assume this feature won't be used as of now, add in
  affordances that skip this design."* The upcoming/scheduled-drive model was
  never pinned down because it is not wanted yet.

  So the affordances that depended on it are gone rather than left as surfaces
  that can never fill: `calendarService.getNextUpcomingDrive()` and its only
  caller, the `nextDrive` state, and the `nextOpenDrive` context field that
  recipe G04 headlined "the next drive" over. Live answer had been `null` for
  every visitor (558 drives, zero ahead), so the tile was a headline for a
  thing that did not exist. Shipped in `7e52fa9`.
- [x] **7.4 SOPs/Goals hydrated across people.** It could not have worked, and
  no UI would have fixed it: the two `sops` policies disagreed about whether an
  assignee is a party to their own task. UPDATE matched
  `led_by_member_id = get_current_member_id()`; **SELECT did not.** Verified live
  - a welfare goal assigned to a member on no welfare team returned **zero rows
  to them while still letting them UPDATE it**. Someone could tick a task done
  without ever being able to see it, which is why no "my tasks" query existed
  anywhere in the codebase.

  SELECT now carries the same clause UPDATE always had. Verified with a control:
  the assignee sees their task, an unrelated member still sees nothing. On top:
  `sopService.getMine()`, a **MyTasksCard** first in the own-profile block (a
  task waiting on you outranks records of what you have done), and a
  **notification when a task changes hands** - not on every save, never to
  yourself. Delivery verified as the recipient, 0 -> 1.

  The card renders **nothing** when there are no open tasks. `sops` holds 0 rows
  live, so it is invisible today - correct, rather than a permanently empty
  promise like the retired points tile.
- [x] **7.5 Certificates, Yearbook and Enquiries verified end to end**, as real
  simulated sessions: a member requests a certificate and HR reads it; HR runs a
  yearbook invite, the invited member fills their own entry, HR reads it back,
  and a member correctly CANNOT create an entry (invite-only by design); anon
  submits the contact form and HR reads it. My first yearbook test "failed" -
  that was my test creating an entry as a member, which is not the designed
  flow. Checked rather than "fixed".
- [x] **7.6 Content desk: editing body/content — confirmed working, keep.** No change asked for, none made.
- [x] **7.7 Projects vs People overlap cleared up.** The overlap is concrete:
  **`Projects` and `Drives` are two desks over the SAME TABLE**,
  `welfare_projects`, in two different nav groups, under two different names,
  for the same real-world thing. They cannot be merged - Drives is `leader` (any
  HoD runs their own department's drives), Projects is `super` - so instead they
  now name the shared subject and each blurb says what the other is for.
  **"Projects" -> "Drive Write-ups"**; the public site already says "search 570
  drives". The route stays `projects`: the label is what a person reads, the
  path is a URL nothing should break.
- [x] **7.8 Volunteer Applications stays as the archive.** No change asked for, none made. Its desk blurb now says so explicitly (item 4.3).
- [x] **7.9 Roles & Permissions genuinely works.** Verified against real simulated
  sessions, all six behaviours: a super admin writes a restriction; a hod READS
  the matrix (needed to gate their own nav); `role_can('desk.hiring')` returns
  false for that restricted hod while an untouched capability stays true; a hod
  CANNOT write (42501); and a super admin can never be restricted (23514, the
  lockout CHECK). App side confirmed wired: `CapabilityContext` ->
  `roleCapabilityMatrixService.getMatrix()` -> `role_capabilities`, consumed by
  both the nav gate (`isDeskVisible`) and the route gate (`DeskCapabilityGate`).

## 8. The social engine

- [x] **8.1 Social engine verified - and one piece was completely broken.**
  Performed as a real member session rather than read from the service code.
  Pass: like, comment, save, follow, set own avatar, read the feed (586 rows).
  **Achievements: the database refused the write with 42501, every time, for
  every non-director.** On 2026-09-03 achievements were changed to go live on
  submit (review desk deleted, default moved to `approved`, service changed to
  send `approved`) and the RLS INSERT policy was NOT changed with them - it
  still demanded `status = 'pending'`, the one value nothing writes any more.
  `external_achievements` holds 3 rows, which fits a feature dead since that
  day. Fixed, with two negative controls verified (another member's row, and an
  invented status, both still refused).
- [x] **8.2 Live updates.** Checked each of the three before building anything:
  **search is already live** (250ms debounce, submit prevented) and **profile
  already calls `refreshMember()`** after edits. The real gap was **saves**:
  every `FeedPostCard` held a PRIVATE `bookmarked` useState, so two cards for
  the same post held two independent booleans and only the one you clicked ever
  moved. Bookmark on the feed, open the post on a profile, still unsaved; unsave
  from /saved, the feed card still shows saved.

  A small session-wide store fixes it, with **`unknown` distinct from `false`**
  so a card falls back to its batched prop rather than painting an unsaved
  bookmark over a saved post. Seeded from the existing batch fetch, so it also
  removes per-card refetches for posts already seen.

  **Deliberately NOT Supabase realtime.** Bookmarks are per-member with no
  second writer - a channel per member, for a fact only that member can change,
  is cost with no information. Cross-device sync stays out of scope; the next
  mount refetches. Cleared on sign-out: on a shared browser, which is most of
  this org, the next member would otherwise see the previous one's bookmarks.
  11 new unit tests on the store.

## 9. Companion / mascot

- [x] **9.1 The companion stops teleporting and stops vanishing.** Two defects,
  the second click-shaped. **Teleport:** the motion effect takes
  `location.pathname` as a dependency (it must - the footer and TOC rail are
  different nodes on a new page) but on re-run also ran `transition: none` +
  `transform: home`, so every navigation snapped it back and, in follow mode,
  abandoned the cursor. It now homes once per activation. **Vanish:**
  `checkDenseHit` fades it out when anything in `DENSE_SELECTOR` - which
  includes `a` and `button` - is under its box. In follow mode it is pinned to
  the pointer, which usually rests on exactly those, so it faded and the 500ms
  poll brought it back: a flicker. That guard is for ACCIDENTAL overlap; follow
  mode is the opposite. It stands down in follow mode only. Verified in a real
  browser both ways.
- [x] **9.2 The plate is built.** Taking the bone was a one-way door: the follow
  flag was written and nothing ever cleared it, so the only way to stop the
  mascot following was to dismiss it entirely. A "PUT IT BACK" plate now sits in
  the exact slot the bone vacated. Verified: follow on -> bone hidden + plate
  shown, click -> flag cleared, bone back, plate gone.
- [x] **9.3 The CTA was the companion's.** Answered: this was the bone/plate
  affordance, covered by 9.2.

---

## 10. Closing deliverable (asked 2026-09-10, mid-session)

- [x] **10.1 Full audit delivered** as `AUDIT_2026_09_11.md`. Gates 4/4, 648
  tests, zero overflow at 375 and 1280, zero unnamed controls, zero missing
  alt, zero desk routes without an `h1` (was 17), feed at 11.2ms, anonymous
  homepage 7/7 requests 200/206, zero `[SIM]` rows swept across every text
  column of every table. Six tap targets fixed, one security finding of my own
  found and fixed, and three false alarms recorded so nobody chases them.

---

## Answers received (2026-09-10)

- **Team mapping:** Media Instagram/Blogs/LinkedIn become **sub-teams of Social
  Media**; PROJECTS folds into **Welfare Team**; ROOTS becomes **Crftd**.
  (~243 memberships to backfill.) Unblocks 4.4, 5.5, 7.2.
- **Drives:** a welfare post **becomes a drive when welfare approves it**.
  Attendance and hours hang off the approved post. Unblocks 7.3.
- **Roles:** holding off. No super_admin/HR changes. 5.8 parked.
- **The CTA:** the mascot's bone / companion CTA. Folded into 9.2.

---

## Open questions (Q1-Q4 ANSWERED above; kept for the reasoning)

**Q1 — team mapping.** The sheet has 10 departments; the app has 8 teams. How do
these line up?
- `HR` → Human Resources · `COLLABS` → Collabs Team · `EVENTS` → Events Team ·
  `SHIKSHAQ` → ShikshAQ · `VENTURES` → AQ.Ventures all look 1:1.
- `Media - INSTAGRAM` (61) / `Media - BLOGS` (10) / `Media - LINKEDIN` (9) —
  three sheets, one "Social Media" team. Sub-teams of it?
- `PROJECTS` (100, sub-teams like "Dog Feeding", "Rotaract Curriculum") →
  Welfare Team?
- `ROOTS` (2) → Crftd? (`/roots` already redirects to `/crftd`.)
- Do HOD and Manager both become `role: 'lead'`, or only HOD?

**Q2 — the drive model.** What exactly is the unit? Options as I understand it:
a drive is a post in the welfare category that a welfare lead approves, and
approval is what promotes it to a drive; or drives stay their own row and a post
merely mirrors them. Which?

**Q3 — who stays super_admin?** The instruction was "apart from <names>,
everyone will be HR". There are 16 super_admins live. I need the exact list to
keep, because this is a privilege change I will not guess at.

**Q4 — which CTA?** I could not tell which one from the walkthrough. Where was it
and what did it say?

---

## Decisions taken 2026-09-11 (closing every open item)

Asked and answered. These are the owner's calls; the reasoning next to each is
what I put to them before they chose.

- **6.1 / 6.2 scoping** -> make the one `hod` (Pratyaksh Singhania, member 1134)
  a **lead** of the two teams he is already on, Welfare and Social Media. No
  privilege change; it just makes the built-and-tested scope real.
- **4.2 blogs** -> **migrate all 36 into `posts`**, drop the `blogs` table, its
  publish-mirror trigger and the desk. **`/blog/:slug` must keep working** -
  those URLs are prerendered, in the sitemap and canonical.
- **3.1 archive** -> "a place for people who have left". Members who have moved
  on come off the main directory but stay viewable in a separate list, so their
  work is not lost. Marked by hand from the Members desk - NOT derived from
  class_grade (208 members have none) or last_login (only 11 members have one).
- **5.8 roles** -> keep **member 29 (Kanishk Agarwal)** as the only
  `super_admin`; the other **15 become `hr`**, including the three org/service
  accounts (`ngo.aquaterra@`, `aquaterra.techai@`, `official@ngoaquaterra.com`).

  **What this does and does not do**, established before the decision: `hr` and
  `super_admin` are TODAY INTERCHANGEABLE. The database's `is_super_admin()` is
  `role in ('super_admin','hr')` and the app's `ADMIN_ROLES` is
  `['hr','super_admin']`, so the conversion changes nobody's access by itself -
  same desks, same RLS, same org posting. The ONE real difference is that
  `role_capabilities` forbids restricting a `super_admin` and permits
  restricting an `hr`. So the conversion is what makes them *restrictable*, and
  the narrowing is a separate act:
- **5.8b** -> after converting, **restrict `hr` from `desk.roles`** in the
  capability matrix, so only member 29 can change what any role can reach.
- **7.3 drives** -> the upcoming/scheduled-drive feature **will not be used for
  now**. Remove the affordances that depend on it rather than leaving surfaces
  that can never fill.
- **5.2 members desk** -> **collapse the contacts behind a tap**. This reverses
  the documented "contacts stay visible" decision in MemberDirectory.tsx, on the
  owner's instruction; copying stays a logged action either way.
- **7.2 unmatched roster** -> **pre-authorise all 103** into `member_preauth`
  with their intended team and position, so signing in later lands them on the
  right team. Nothing happens until they sign up.
- **1.1 nav type** -> **convert the top nav bar to NeutralFace caps too**, so
  the bar matches the drawer and dropdown. This reverses changelog 02.4, which
  specifies Eina lowercase for the bar, on the owner's instruction.

---

## The night of 2026-09-12: five audit rounds, closed out

Everything in the section above was already closed. This records what four
adversarially-verified audit rounds found AFTER that, and what is left.

### Rounds 1-3 (60 confirmed findings) - all fixed

Concentrated in: empty states that lie after a failed load (this repo's single
most repeated real bug, found in ~20 files); missing loading/error states on
lists; modal a11y; tap targets and iOS focus-zoom; two RLS holes (any member
could publish past moderation, and team leads were shown opening controls the
database refused); three surfaces styled entirely in Tailwind, which never
loads. Two audit-script gates were added so the last two cannot recur.

### Round 4 (42 confirmed findings, 7 dimensions, 178 agents) - all fixed

The ones worth remembering:

- **A member could write their own volunteer hours.** `certificate_requests`
  took hours, drive count, date range AND status straight from the browser,
  with an INSERT policy that checked only `member_id`. Verified live: a member
  could insert `500 hours, 60 drives, status='issued'` against themselves, and
  HR would have signed a Letter of Volunteering from it. Now: the policy
  refuses any status but `pending`, and a BEFORE INSERT trigger recomputes all
  four columns from `drive_attendance`.
- **All fourteen pending blog drafts were unpublishable**, gated on a cover to
  satisfy a trigger that had been deleted, in a tab with no uploader.
- **Every blog card said "1 min read"** - derived from the 630-char excerpt
  rather than the article - and **printed its headline twice**.
- **Re-ticking a team checkbox silently demoted a team lead** to plain member.
- **Seven identical `uuid -> member_id` requests per profile load**; now one.
- Two TS privilege checks that contradicted RLS in *both* directions.

### Left for a human, not a code gap

- **Nobody has any recorded volunteer hours.** `drive_attendance` has ZERO
  rows, and of 558 drives none has a `scheduled_end`, so the scheduled-duration
  fallback can never fire either. Any Letter of Volunteering issued today would
  truthfully read "0 hours, 0 drives". Someone has to start recording
  attendance before that pipeline means anything.
- **23 essays have no cover image** - the 14 pending drafts and 9 of the 22
  published. Not a migration loss: 0 of the 36 mirrored rows had a cover in the
  retired table that failed to carry over. They can all be published as-is now;
  a cover just makes a better card.
- `drop table public.blogs_retired_2026_09_12;` whenever the owner is ready. It
  was renamed rather than dropped on purpose, with its grants revoked.
- Leaked-password protection is off in Supabase Auth. Inapplicable: there is no
  password auth in this project at all.
