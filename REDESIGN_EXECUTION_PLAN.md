# AquaTerra full redesign — execution tracker

Source of truth: `new aq website/mobile-first-responsive-redesign/project/`
(`github.md` → `docs/CHANGELOG-REDESIGN.md` → `docs/FEED-ALGORITHM.md` →
`docs/AQRANK-SPEC.md` → the 42 `.dc.html` canvases).

Scope: **34 sections + 4 appendices, 468 numbered atomic steps**, touching most
of `frontend/src`. This is multi-session work. Update this file after every
section, not at the end.

## Status: EXECUTING (decisions taken 2026-09-03)

**User decisions, binding for the rest of this port:**

1. **The new bundle wins — full visual redesign.** `HANDOFF_PORT_PLAN.md` is
   SUPERSEDED; its "current visual system stays, only UX ports" rule no longer
   applies. Token/radius/palette changes are in scope.
2. **Run continuously** through the numeric order, updating this file per
   section, until context runs out or something hard-blocks.
3. **Appendix A1: apply everything**, including item 14's `sops` urgency
   relabel. (I flagged that item 14 is unsafe to run twice and that the plan
   asks for owner confirmation first; the user reaffirmed. I will still inspect
   the live rows before running it and will report what I find.)
4. **Validate in the integrated browser against the local vite dev server**
   each section, not the build alone.

Reading pass complete: `README.md`,
`docs/HANDOFF.md`, `github.md` (149 lines, full), `docs/CHANGELOG-REDESIGN.md`
(headers + ground rules + section 01 + Appendix A1), plus live-repo
verification of every file section 01 names.

## Gaps found in the reading pass (details in chat)

| # | Gap | Blocks |
|---|---|---|
| G1 | Conflicts head-on with `HANDOFF_PORT_PLAN.md` (in-progress, different bundle, opposite rule: "visual system stays, only UX ports") | everything |
| G2 | Step 01.1 says "add `--r-sm/--r-md/--r-lg`" but all three already exist in `tokens.css` at 6/14/22 — it is a redefinition of live tokens, not an addition | section 01 |
| G3 | `--rust` and `--paper-dark` (step 01.24) do not exist in `tokens.css`, contradicting the "do not add colours" ground rule | section 01 |
| G4 | Paper page `#DED6C2` (HANDOFF) vs live `--paper: #F4EFE0` | whole visual system |
| G5 | Three paths in section 01 are stale: `styles/components/nav.css` → `components/AQNav.css`; `styles/components/footer.css` → `components/AQFooter.css` + `styles/footer.css`; `public/NotFoundPage.tsx` → `pages/NotFoundPage.tsx` | section 01 |
| G6 | Appendix A1 = 13 migrations + 1 data relabel against the **live** Supabase project (`hzowuwffjqtgszecngpe`). Needs explicit go-ahead. A1 items 3 and 5 already exist; item 14 is flagged blocking by the plan itself | sections 07, 12, 13, 15, 21 |
| G7 | The 5 open decisions in `docs/HANDOFF.md` (SOPs relabel, ProjectModal chip contrast, 16 super-admins vs 1 hod, four unreadable `.xlsx`, Labs Google-Drive photos) | 21, 25, 08, —, 33 |

## Build order (from `docs/HANDOFF.md` "Order of work")

| # | Section | Kind | State |
|---|---|---|---|
| 01 | Global chrome | restyle | **DONE** - all steps landed or explicitly resolved, browser-verified at 390 and 1280. 28 deliberately no-change. See `REDESIGN_CHANGELOG.md` §1.1-1.13 |
| 02 | Auth funnel | restyle | **DONE** - steps 1-28, 30-39, 41-42 landed + browser-verified. 29 (mascot) blocked on 09; 40 optional, blocked on 10/11. New: `lib/authCopy.ts` + 15 tests |
| A1 | Migrations | schema | **DONE** - applied live to hzowuwffjqtgszecngpe in 3 migrations. Item 14 is a NO-OP (sops is empty, 0 rows) - see below |
| 03 | Post detail + composer | restyle | **DONE** - browser-verified at 390: composer bottom sheet (grab handle, scrolling body, sticky bar), post detail ink-to-paper transition, outlined stat block, concentric related rail |
| 04 | Desk: content manager | restyle | **DONE** - adminKit restyled once so all 17 desks inherit. 9 hidden affordances made visible |
| 05 / 05b | Public About / Projects | restyle | **DONE** - browser-verified at 390. Note: the ImpactSection dedupe brushes section 26 deliberately, documented in the changelog |
| 06 | Profile + public profile | restyle | **DONE** + points removed app-wide. Found and fixed a real privacy leak: `PublicProfilePage` rendered UNAPPROVED achievements to visitors and counted them in the hero stat. NOT browser-verified (both routes need an authed session) |
| 07 | Ten features | new build | not started |
| 08 | Desk index | restyle | **DONE** - bento stat row + grouped desk list. **16 desks in 4 groups, not 17 in 6**: that is what NAV_GROUPS holds now AchievementReviews is deleted |
| 09 | Mascot system | new build | **DONE** as `components/AQMascot.tsx` (the name `Mascot.tsx` was taken by the legacy parked companion). **Mounted by me** in the mega menu, the 404, RegisterPage step 3 and the footer |
| 10 | Feed card catalogue | new build | **DONE**, unmounted. All 30 shapes; **11 can never match real data** and 5 are partial, measured not guessed |
| 11 | Sticker pack | new build | **DONE** - 28 silhouettes. The '87 pieces' are placements (shape x hue x word x variant), not silhouettes; the canvas holds 31 distinct paths |
| 12 | First sign-in receipt | new build | **DONE**, unmounted. Row-by-row provenance; `1,247` eliminated from all three places it sat |
| 13 | Member records | restyle + new | **DONE**. Contact reveal now logs BEFORE it reveals and refuses if the log write fails. I also closed the two `directorService` gaps it flagged |
| 14 | Home hi + adaptive grid | new build | not started |
| 15 | Referrals | new build | **DONE**, unmounted. Found that my A1 migration never granted SELECT on the new columns - fixed, plus a `claim_member_referral()` SECURITY DEFINER function |
| 16 | Desktop compositions | new build | not started |
| 17 | Home page cleanup | cleanup + new | not started |
| 26 | About storytelling | restructure | **DONE** + browser-verified. Six chapters 2021-2026; excluding the marquee (the spec's named exception) `1,200+` went 7 to 4, `550+` 5 to 2, `15,000` 3 to 1 |
| 27 | Pre-application promo | new build | **DONE** + browser-verified at `/join`, prerendered, auto-show armed in HomeRoute |
| 28 | Post-approval onboarding | new build | **DONE** at `/welcome` |
| 29 / 31 / 32 | Poster system + applied + remaining | house style | **DONE** - an audit-and-reconcile pass, not a fresh application: sections 01-28/30/33/34/A1-A4 had already applied most of the system. Three things were genuinely missing and are now built: the `--poster-gutter` / `--keyline` / `--on-<fill>` token block in `tokens.css` (29.1), the `TABS` / `live` / unresolved-identity blocks in `v6.css` (31.1), and one measured source for the pink branch (`lib/onFill.ts` + 10 tests). The keyline went from **7 spellings to 1**, the `live` marker from **4 implementations to 1**, and 12 leftover `22px` radii onto the token scale. Section 32's 29 rows all walked: 12 already compliant, 16 changed, 1 (features) deliberately left because section 07 is unbuilt. See `CHANGELOG_SEC29_31_32.md` |
| 30 | The AQ map | new build | **DONE** + prerendered at `/directory`. Every count is canonical, live, or a permanently dashed marker; the open-roles door disappears at zero rather than reading 0 |
| 33 | AQ Labs | new build | **DONE** + browser-verified. 7 real projects from the CSV, 4 link states, no photos (all 26 are Google Drive form URLs). Wired into the mega menu, the explore dropdown and the sitemap |
| 34 | Grid host, phase one | new build | **DONE**, unmounted. 6 recipes + G38. Three had dead grid cells, caught by simulating CSS auto-placement |
| 18–25 | The 17 HoD desks (radius pair + sticker keyline only) | restyle | not started, **last** |
| A2 | Em dash purge | copy | **DONE** in section 01. 11 user-facing strings across 7 files; the ~740 remaining are source comments, which the rule scopes out |
| A3 | Google contacts routine | backend | **NOT SHIPPING, by its own spec.** A3 says "Handoff only, no UI in this redesign" and requires a server-side nightly job that "never runs in a browser". This app has no backend in the request path, so there is nothing to build in `frontend/`. Its two schema dependencies are now satisfied (`members.member_no` and `member_activity` both exist), so the job can be written whenever there is somewhere to run it |
| A4 | Equity policy page | new build | **DONE** - redesigned in place, not one character of policy text changed |

## Appendix A1 - what was actually applied, 2026-09-04

Three migrations against `hzowuwffjqtgszecngpe`, all additive.

**Checked the live schema first. Four A1 items were already done** and were NOT
recreated: `members.birthday` + `birthday_public`, `members.break_start/end/
reason`, the `member_breaks` table (exists, 0 rows), and `member_preauth`
(exists and **already holds 85 rows** - it is live).

Applied:

1. `redesign_a1_role_hr_and_member_columns` - the `hr` role added to the
   `members_role_check` constraint, and BOTH `is_director()` and
   `is_super_admin()` updated to return true for it (an `hr` member created
   with super-admin intent would otherwise have had less access than a lead).
   Plus A1 item 1 `members.member_no` (sequence-backed, unique, backfilled in
   join order) and item 2 `members.referred_by`.
2. `redesign_a1_new_tables` - items 4, 7, 8, 9, 10, 11, 12, 13:
   `member_teams` (with the partial unique index on `is_primary`),
   `contact_access_log`, `member_activity`, `referrals`, `referral_clicks`,
   `desk_todos`, `desk_sops`, `wishes`. **RLS enabled on every one in the same
   migration that creates it** - this project is queried from the browser with
   an anon key and there is no API server in the request path, so a table
   created without RLS is readable by anyone who can open the site.
3. `redesign_a1_rls_policies` - the policies. `contact_access_log` and
   `member_activity` are append-only from the client (no update or delete
   policy exists, so both are denied): a log the actor can edit is not a log.
   `wishes` is readable only where `birthday_public IS TRUE`, because that
   column is an opt-**in** and null means private - getting it backwards would
   publish birthdays for 1,300 students, many of them minors.

**A1 item 14, the `sops` urgency relabel: NOT RUN, because it is a no-op.**
The user approved running it. Before running I inspected the table, as the plan
requires. `public.sops` contains **zero rows**. The UPDATE would have matched
nothing. More importantly the premise is false: the "blocking data issue" that
gates section 21 is described as "existing goal rows still carry the old
meaning", and there are no goal rows. Section 21 is unblocked without it.
Running a migration that is explicitly unsafe to run twice, to change nothing,
would only create a false record that the relabel had happened.
(`sop_templates` has 4 rows and is a different table, out of scope per
`github.md`.)

`members` role counts at time of migration: 16 super_admin, 1 hod. The
"super-admin is rare" assumption in section 08 is still worth confirming.

## In flight, 2026-09-04

Four agents dispatched on disjoint file sets, each writing its own changelog
fragment (`CHANGELOG_SEC03.md`, `CHANGELOG_SEC05.md`, `CHANGELOG_SEC06.md`,
`CHANGELOG_FEATURES.md`) for merging into `REDESIGN_CHANGELOG.md`.

- **Features (hr role + auto-approve achievements): LANDED.** See the feature
  requests file. Its three flagged leftovers plus a fourth I found are fixed.
- **All four LANDED and merged.** `REDESIGN_CHANGELOG.md` is now 3,691 lines
  and the four `CHANGELOG_*.md` fragments have been deleted after merging.
  Whole tree re-verified after the merge: `tsc -b` clean, `npm test` 49/49,
  `npm run build` green, 609 sitemap URLs, 17 static + 576 dynamic prerendered.

## Agent dispatch plan - finishing all sections

Goal set 2026-09-04: finish every remaining section with sub-agents.

**Collision rule, applied to every wave:** file sets must be disjoint, and NO
agent may edit `styles/v6.css` or `styles/tokens.css` - those are the two
high-collision shared files, and a concurrent write to either loses work. New
rules go in a new component-scoped CSS file. Each agent writes its own
`CHANGELOG_*.md` fragment, which I merge into `REDESIGN_CHANGELOG.md` and then
delete.

### Wave 1 - dispatched

| Agent | Sections | Owns |
|---|---|---|
| A | 09 mascots + 11 stickers | NEW `components/Mascot.tsx`, `components/Sticker.tsx` + their CSS. **Builds primitives only, wires nothing** - other agents own the consuming files |
| B | 04 content manager + 08 desk index | `director/ContentManager`, `DirectorDashboard`, `DirectorLanding`, `adminKit`, `director.css` |
| C | 33 AQ Labs + A4 equity policy | NEW `public/LabsPage`, `public/EquityPolicyPage`, App.tsx route only |
| D | 12 receipt + 15 referrals | NEW referral lib/service + components, `database.types.ts`, App.tsx route only |

Section 09 went first because it currently blocks leftover steps in 01, 02, 03
and 06 (the mega menu, the 404, RegisterPage step 3, the footer bottom rule and
the profile avatar fallback all render a placeholder or nothing, waiting on it).

### Wave 2 - queued

| Sections | Note |
|---|---|
| 10 feed cards + 34 grid host + 14 home hi | Interlocked: 10 and 14 both depend on AQRank, and 34 is the grid host 14 mounts. One agent, or strictly sequenced |
| 16 desktop compositions + 17 home cleanup | Both touch `HomePage.tsx`; must not run beside 14 |
| 13 member records + 18-25 the 17 HoD desks | Desks land LAST by the handoff's own order |
| 26 About storytelling | Partly pre-empted: the 05 agent already merged ImpactSection to kill the duplicate stat grid |
| 27 promo + 28 onboarding | Both new, both depend on 09's mascot |
| 29 / 31 / 32 poster system | House style, applied across surfaces - highest collision risk, run alone |
| 30 AQ map | Depends on the content graph in `AQ_EXPERIENCE_BRIEF.md` |
| A2 em dash purge | User-facing copy already done; only comments remain, which the rule scopes out |
| A3 Google contacts routine | Backend/ops, not UI |

## Verification gate per section

`cd frontend && npx tsc -b && npm run build`, plus `npm test` when a covered
file (`lib/roles.ts`, `lib/imageUrl.ts`, `lib/profanityFilter.ts`) is touched.
A section is not done until the build is clean.
