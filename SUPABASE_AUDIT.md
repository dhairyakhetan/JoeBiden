# Supabase plumbing audit — 2026-09-10

Read-only conformance sweep of the whole data layer against the **live**
production database (`hzowuwffjqtgszecngpe`, 1,317 active members), plus two
fixes applied with the owner's explicit approval.

`frontend/src/paradox/**` targets a second, separate Supabase project that this
connection cannot reach. It was excluded throughout and is **not** reported as
broken.

---

## Headline

The data layer is **structurally sound**. All 42 referenced tables/views exist,
every scalar column in every `.select()/.eq()/.insert()/.update()` resolves, all
10 named-FK embed hints correspond to real constraints, and 12 of 13 `.rpc()`
calls matched a live function by name *and* exact argument names. RLS is enabled
on all 51 public tables and all 45 SECURITY DEFINER functions pin `search_path`.

The problems were not in the shape of the schema. They were **one missing
migration, one real PII hole, and a large amount of built-but-never-fed
feature surface**.

---

## FIXED (applied 2026-09-10, with approval)

### 1. Any team lead could dump every member's email and phone — CLOSED

`get_team_member_contacts(p_member_ids, p_team_id)` used `p_team_id` only to
check whether **the caller** was a lead. It never constrained **which** members
came back, so a lead could pass their own team id plus an arbitrary id array and
receive email + phone for the entire member table — defeating the whole
`members` column-level PII lockdown. Reachable by any of the active student team
leads. Call site: `services/teamService.ts:942`.

**Fix**: the caller check is unchanged; a row constraint was added. A lead now
only sees contacts for people who actually belong to that team — either as an
active `team_members` row **or as a pending join requester**.

> The requester branch is load-bearing, not defensive. The sole call site is
> `getJoinRequests`, which passes exactly the people who have *applied* and are
> therefore **not yet in `team_members`**. Constraining to `team_members` alone —
> as first proposed — would have silently emptied that screen's email column.
> Caught by reading the call site before writing the migration.

**Verified by simulation** against a real active lead (team 7):

| | rows returned |
|---|---|
| before | **1,379** (every member's email + phone) |
| after | **2** (that team's actual active members) |

`EXECUTE` also revoked from `anon`/`public`; retained for `authenticated`.

### 2. `create_birthday_notice()` did not exist — APPLIED

`services/profileService.ts:483` called this RPC on **every own-profile visit**;
`ProfilePage.tsx:216` swallowed the resulting `PGRST202` into `console.error`.
So the birthday notice board was 100% dead in production and nothing surfaced
it — the **fourth** instance of this repo's documented "code shipped, migration
never ran" failure mode.

Applied `frontend/scripts/birthday_notice_board_2026_08_31.sql` (which itself
still said `⏳ NOT YET APPLIED`) and flipped its header. Verified after: the
column exists (integer, nullable), the function is SECURITY DEFINER, `EXECUTE`
is granted to `authenticated` only.

> **Honest caveat**: the error is fixed, the *feature* is still dormant. Measured
> at apply time — 9 of 1,379 members have a birthday on file and **zero** have
> `birthday_public = true` (it defaults to `false`). That is the opt-in working
> as designed on a minors platform, not a remaining fault.

### 3. A recommended "fix" I rejected

One audit recommended `alter view member_directory_view set (security_invoker = true)`
on the grounds that it bypasses the `members` column lockdown. I checked the
view definition directly: it carries `security_barrier=true` **and**
`WHERE is_director() OR is_super_admin()` inside it, so a non-director gets zero
rows, not PII. Its `security_invoker = false` is load-bearing — it is precisely
how directors read `email`/`phone` without a column grant. **Applying that
change would have broken the member directory.** Not applied.

---

## OPEN — owner decided to leave as-is

**`anon` can read the active-member directory.** The `Anyone can view active
members` policy is `status = 'active'` for role `public`, and `anon` holds
column `SELECT` on 20 columns across **1,317 mostly-minor students** — including
`rejection_note`, `role`, `last_login`, `join_reason`, `approved_by`,
`approved_at`, none of which have a public purpose. (`role` and `class_grade`
*are* genuinely consumed by the public `/members` page, so they cannot simply be
revoked.)

Owner's call on 2026-09-10: treat the public directory as intended product
design. Recorded here so the decision is deliberate and revisitable.

---

## OPEN — not yet acted on

| # | Finding | Severity |
|---|---|---|
| S1 | `aq_contacts` write policy is `ALL` with `is_director()` — any HoD can rewrite or delete the contacts archive with no audit trail. Reads are correctly forced through the audited `get_aq_contacts()`. | Medium |
| S2 | `post_feed_view` and `pending_post_reviews` grant `INSERT/UPDATE/DELETE/TRUNCATE` to `anon` + `authenticated`. Inert today (non-auto-updatable joins), a landmine if either view is ever simplified. | Medium (latent) |
| S3 | `arcade_trivia_questions` policy `trivia_admin_write` tests `members.uuid = auth.uid()`, but `uuid` and `auth_uid` are different identifiers — `count(*) where uuid::text = auth_uid::text` is **0**, so the policy is unsatisfiable for everyone. No app code writes it yet. | Low (latent) |
| S4 | `member_of_the_month_periods` INSERT/UPDATE are `is_super_admin()`, but `deskAccess.ts` exposes the month open/close control at `'leader'`. A plain HoD sees a control that always fails. It degrades honestly (the service re-selects and throws a real message) — wants a disabled state, not a policy change. | Low |
| S5 | Self-escalation is blocked **only** by the `members_guard_privileged_cols` trigger — `authenticated` does hold UPDATE on `members.role`/`.status`. Correct today; if that trigger is ever dropped, any student becomes super_admin. Worth a loud comment in the migration. | Low (fragile) |
| S6 | `.single()` used 81× across `services/*.ts` vs `.maybeSingle()` 22×. Each throws `PGRST116` on zero rows; the read-path ones against currently-empty tables throw instead of rendering an empty state. | Low |
| S7 | Stale comments now contradict reality: `profileNudgeService.ts:47` and `ContactNumberFields.tsx:43` still say the `guardian_phone` migration is unapplied (**it is applied**); `points_ledger` and `aq_contacts` table comments contradict their actual grants. | Low (paper trail) |

---

## DEAD — built, wired correctly, never fed

Verified row counts. These are not bugs; they are features with no data, and
several UI paths quietly render nothing because of it.

`drive_attendance` **0** · `certificate_requests` **0** · `points_ledger` **0** ·
`yearbook_entries` **0** · `member_of_the_month` **0** · `sops` **0** ·
`referrals` / `referral_clicks` **0** · `member_education` **0** ·
`member_breaks` **0** · `wishes` **0** · `contact_submissions` **0** ·
`post_images` / `post_tags` / `post_categories` / `post_approvals` **0**

Knock-on effects worth knowing:

- **Volunteer hours can never be non-zero.** `drive_attendance` is empty *and*
  `welfare_projects.scheduled_end` is NULL on all 558 rows, which is
  `certificateService.ts:93`'s fallback. So every hours total is 0 and the
  `undercounted` flag is permanently true.
- **The jobs board renders empty** — both `job_openings` rows are `status='closed'`
  (though 3 `job_applications` exist against them).
- **The feed is a CMS mirror, not a social feed** — `post_feed_view.source_type`
  is `welfare_project` (548) or `blog` (36), with only **2** organic member
  posts. Across 1,317 active members: `likes` 6, `comments` 1, `follows` 1,
  `saved_posts` 3.
- **Category-scoped moderation gates nothing for 10 of 17 leaders** —
  `director_categories` has 20 rows across only 7 members.

---

## VERIFIED SOUND

- The `members` PII lockdown is genuinely applied: no table-level grant;
  `email`/`google_id`/`auth_uid` are `REFERENCES` only; `phone` and
  `guardian_phone` are UPDATE-only. `team_nudge_seen_at` — the column from the
  incident recorded in `CLAUDE.md` — now correctly holds `SELECT, UPDATE`.
- `ensure_member()` reads the email from `auth.users`, never from user input, and
  only ever inserts `pending_approval`.
- `claim_member_preauth()` matches on the **JWT** email and explicitly refuses to
  fall back to the writable column. Well built.
- `claim_member_referral()` is claim-once and self-referral-guarded.
- `create_notification()` correctly replaces a revoked direct INSERT
  (`notifications` INSERT is `service_role` only) and gates privileged types.
- Feed writes (`posts`, `likes`, `comments`, `saved_posts`, `follows`, …) all
  have author-scoped `WITH CHECK`s matching the payloads in `feedService.ts`.
- App-level desk gates mirror or are **tighter** than RLS in every case checked —
  never looser.
- Auth funnel intact: 1,317 active / 58 pending / 4 rejected, `member_preauth`
  holds 85 rows.

---

## WRITE-PATH SIMULATION — run 2026-09-10, zero persistence

Run against production inside transactions that were **rolled back**, so nothing
was ever committed. Real member sessions were simulated the way PostgREST does
it: `set local role authenticated` plus `request.jwt.claims`, so `auth.uid()`
and every policy resolved exactly as they would for that person in the browser.

Target: `drive_attendance` — the highest-value unknown, because `points_ledger`,
`certificate_requests` and the CV hours total all hang off it.

Safety checked first: the table has **one** trigger (`update_updated_at_column`,
a timestamp setter) — no notification and no points side effects — and
`member_id` is nullable with a `walkup_name` alternative, so tests attached to
no real student.

| # | Scenario | Result |
|---|---|---|
| 1 | plain active member → INSERT | **BLOCKED** by RLS — correct |
| 2 | the person who *would* be the drive lead, with `drive_lead_member_id` NULL as it is in production | **BLOCKED** — the bug |
| 3 | `super_admin` → INSERT | **ALLOWED** — correct |
| 4 | same member, after `drive_lead_member_id` is assigned | **INSERT ok → UPDATE (checkout) ok → reads back 1 row, status=`left`** |

**Conclusion: the plumbing is entirely correct.** RLS, the CHECK constraints and
the service-layer status vocabulary (`expected`/`here`/`left`/`no_show`/`walk_up`
— `attendanceService.ts:25` matches `drive_attendance_status_check` exactly) all
behave as designed. The full lead lifecycle works the moment the precondition
exists.

### The actual root cause of the empty table

`welfare_projects.drive_lead_member_id` is **NULL on all 558 rows** (so is
`team_id`; and **0** projects are future-dated). The INSERT policy's lead branch
is `wp.drive_lead_member_id = get_current_member_id()`, which can never be true
against a NULL column — so **the drive lead the feature was built for can never
record attendance.** Only the 16 `super_admin`/`hr` accounts can.

This is a *data/configuration* gap, not a code or policy defect, and it cascades:
no attendance → no points → certificate hours permanently 0 and `undercounted`
permanently true.

**Recommended next step (not code):** populate `drive_lead_member_id`, and check
whether any desk UI even exposes a way to assign a drive lead. If it does not,
that missing control is the real fix.

### Cleanup verified

After every simulation: `drive_attendance` **0 rows**, `ZZZ%` test rows **0**,
`welfare_projects` with a lead **0**, test posts **0**. Nothing leaked.

### Still not proven

The other 21 empty tables were not individually write-tested. The same harness
above (transaction + `set local role` + JWT claims + rollback) is the pattern to
reuse for each.
