# The weekly self-healing review

**Status: living document.** This describes a recurring, mostly-autonomous
Claude Code routine that keeps the live AquaTerra product honest against
`docs/PRODUCT_PRD.md`, closes gaps it can safely close on its own, and
surfaces the rest — so a human only has to look at what genuinely needs a
human. It exists because this codebase needs real weekly attention (copy
drift, data discrepancies, silent Supabase failures, unreached applicants)
and the org's one maintainer does not have the bandwidth to do that sweep by
hand every week.

## The complete observability picture (three systems, not one)

Before diving into checks, know all three places this app already records
what's happening, so nothing gets rediscovered or duplicated:

1. **`public.client_error_logs`** (Supabase) — every crash that reached
   `window` (React render errors, unhandled rejections) AND, as of
   2026-09-22, every Supabase call that failed (`error_type='supabase_error'`,
   via `lib/errorTracking.ts`'s `logSupabaseError()`). Answers "what broke."
2. **`public.client_function_logs`** (Supabase) — every service-layer
   function call, success or failure, with timing, via
   `lib/functionLog.ts`'s `withFunctionLogging()`, added 2026-09-23. Answers
   "what's actually being called, how often, how slow." See §2b below.
3. **Vercel Analytics** (`lib/funnel.ts`, `@vercel/analytics`) — four
   deliberately-few named events (`signin_started`, reaching `/register`,
   completing it, reaching `/pending`) tracking the join funnel specifically.
   Predates both tables above and is intentionally minimal — "an event you
   never look at is worse than no event." Answers "where do people drop off
   on the way to becoming a member." Reachable via the Vercel MCP connector
   if the session firing this routine has it; if not, this is one more thing
   worth flagging as missing access, same as the Supabase connector check
   below.

All three are non-PII by design (low-cardinality context only — never names,
emails, phones, or free-text bodies). Keep it that way in anything added
here; this app's members are students, many of them minors, and CLAUDE.md's
`members` PII history is the standing lesson for why this discipline exists.

## What runs, and when

A scheduled trigger fires a **fresh Claude Code session** into this
repository's environment on a weekly cadence (see the trigger's own
`cron_expression` for the exact time — check `list_triggers` rather than
trusting a stale copy of this doc). Each firing is a standalone session with
no memory of prior runs; its prompt is self-contained and points back to
this file and to `docs/PRODUCT_PRD.md` as its instructions.

## What it checks, each run

1. **PRD conformance.** Walks `docs/PRODUCT_PRD.md` section by section,
   spot-checking the live app/database against every "Must hold" statement
   and the feature descriptions themselves — e.g. does a plain member's post
   actually stay out of the public feed until approved; does a rejected
   applicant's account actually block reapplication before 30 days; does the
   Roles matrix actually lock cells rather than leaving them a dead
   checkbox.
2. **Silent Supabase failures.** Queries `public.client_error_logs` (see
   `frontend/scripts/client_error_logs_2026_09_08.sql` and
   `..._add_supabase_type_2026_09_22.sql`) for recent `error_type =
   'supabase_error'` rows — these are logged by `lib/errorTracking.ts`'s
   `logSupabaseError()`, wired into the service layer, at the exact point a
   Supabase call failed and the failure was otherwise going to be invisible
   (caught, toasted, never recorded). Recurring `operation` values here are
   the strongest, most direct signal this routine has — they mean something
   is *breaking*, not just drifting from spec. Also worth a skim:
   `error_type = 'unhandled_error'` / `'unhandled_rejection'` rows, for
   crashes the boundary-catching didn't anticipate.
2b. **Function-call telemetry.** `public.client_function_logs` (see
   `frontend/scripts/client_function_logs_2026_09_23.sql`) is the companion
   table: one row per service-function call, success or failure, with
   timing — written by `lib/functionLog.ts`'s `withFunctionLogging()`,
   wrapped around every `services/*.ts` (and `lib/jobOpenings.ts`) export.
   Where `client_error_logs` answers "did this call fail," this answers
   "what's actually being called, how often, and how slow" — use it to
   catch things an error log alone can't: a function that's gone unusually
   slow (rising `duration_ms` for the same `service`/`function` pair week
   over week — a real, checkable regression signal), a function nobody
   calls anymore (dead code worth flagging, not deleting unasked), or a
   function whose failure *rate* (not raw count) is climbing even though no
   single failure looks alarming on its own. Both tables share the same
   non-PII column discipline — never arguments or return values, only
   service/function/outcome/timing/who/where — so reading either is always
   safe to summarize verbatim in the run's report.
3. **Data-layer discrepancies.** Read-only checks against the live schema —
   `mcp__Supabase__get_advisors` for security/performance lint, targeted
   `execute_sql` reads for things the PRD implies should hold (e.g. no
   published post without an approval timestamp, no stale `pending_approval`
   application sitting untouched for an unreasonable time, no job opening
   stuck `open` long past its deadline) — and cross-references the PRD's
   "Open product questions" and "Explicitly not built" sections so it never
   flags a deliberate gap as a bug.
4. **Codebase drift.** Greps/reads the frontend for places where behavior
   has clearly diverged from what the PRD says it should be — a missing
   `sized()` wrapper reintroduced, a mutation missing the toast/confirm
   pattern CLAUDE.md requires, a role check that doesn't match its route
   guard (the exact class of bug called out in CLAUDE.md's Role model
   section).
5. **CI/build health** on the default branch, and outreach hygiene where the
   PRD implies it (e.g. enquiries or job applications sitting untouched past
   a reasonable window) — reported, not auto-actioned, since "reach out to
   this person" is a judgment call about tone and timing, not a code fix.
6. **SEO health.** This app already has real, working automatic SEO
   generation for dynamic content — every public detail page (blog posts,
   welfare projects, job openings, teams) calls `useMeta()` with a
   `description` **derived from the content itself** when no explicit one is
   set, e.g. `BlogPostPage.tsx`/`PublicProjectDetailPage.tsx` strip markdown
   and truncate the post/project body to ~200 chars, `OpeningDetailPage.tsx`
   uses the opening's own description, `TeamDetailPage.tsx` falls back to the
   team's own description or name. **The routine's job here is verification,
   not reinvention** — this pattern already exists and works; don't build a
   second, parallel meta-generation system. Each run:
   - Confirm every public detail-page component still calls `useMeta()` with
     a non-empty, non-generic `description` — a new page type shipped
     without this (or with a hardcoded placeholder) is exactly the kind of
     codebase drift §4 above is for, and is a low-risk, auto-mergeable fix
     if the content-derivation pattern from a sibling page can be copied
     directly.
   - Run `npm run sitemap` (`scripts/generate-sitemap.mjs`) and diff the
     output against what's committed — if it doesn't match, something in
     live content changed without the sitemap being regenerated as part of
     that change; regenerating and committing the diff is itself a low-risk,
     content-only, auto-mergeable fix.
   - Run the routing quick-check CLAUDE.md documents (`curl` against `/`,
     `/login`, `/director`, `/post/abc`, all must be 200) against the live
     site — a regression here reproduces exactly as "prerendered pages look
     fine, client routes 404," which is genuinely easy to miss without
     checking.
   - Spot-check a sample of live blog/welfare-project rows for an empty or
     near-empty body (which would make the derived description empty or
     unhelpfully short) — flag, since fixing the underlying content is an
     editorial call, not something to auto-write.
7. **Org/HR data completeness.** Added 2026-09-23 from a real HR launch
   checklist (`HR_TO-DO_FOR_AQ_WEBSITE_LAUNCH.pdf`) — the org's own plan for
   getting the site's team/member data into shape, cross-checked against live
   data at the time and found to already be a serious gap, not a hypothetical
   one. **Every item here is report-only, never auto-fixed** — a missing bio,
   an unassigned member, an empty hiring pipeline, or which HoD owns what are
   all human/organizational decisions, not code. The routine's job is to
   produce the current real numbers so a person doesn't have to click through
   the desk manually to find them. Queries verified against the live schema
   on 2026-09-23 (re-check column names if a later migration renames
   anything):
   ```sql
   -- active members with no team at all
   select count(*) from public.members m
    where m.status = 'active'
      and not exists (select 1 from public.team_members tm where tm.member_id = m.member_id);

   -- profile completeness, org-wide
   select count(*) filter (where avatar_url is null) as missing_avatar,
          count(*) filter (where bio is null or bio = '') as missing_bio,
          count(*) as total_active
     from public.members where status = 'active';

   -- team cover images and descriptions
   select name, banner_url is null as no_cover, description is null or description = '' as no_description
     from public.teams order by name;

   -- teams with zero currently-open hiring pipelines
   select t.name, count(jo.id) filter (where jo.status = 'open') as open_openings
     from public.teams t left join public.job_openings jo on jo.team_id = t.team_id
    group by t.name order by t.name;
   ```
   Also worth a standing check: **the department/team NAME LIST itself drifts** —
   a 2026-09-23 HR planning doc still referenced a retired department name
   ("Roots," a route that now just redirects) and a misspelling ("Shikshak"
   for ShikshAQ) alongside a screenshot showing the real, current 8. Whenever
   this routine touches anything hierarchy-related, treat `public.teams` as
   the one canonical name list and flag any planning doc, prompt, or comment
   found to disagree with it — that class of drift is exactly what caused the
   confusion in the first place.
   Report each run as plain numbers with the prior run's numbers alongside
   when available (via `client_error_logs`/audit-log style history is
   overkill here — a simple "was X, now Y" in the run's own summary is
   enough), so progress or regression on the HR checklist is visible without
   anyone having to re-run the queries by hand.

## Guardrail: verify the Supabase connection before trusting it

**Before running any live-database check, confirm the connected Supabase
project is actually AquaTerra's** — call `mcp__Supabase__list_projects` /
`list_tables` and check for `members`, `posts`, `teams`, `welfare_projects`.
On 2026-09-22 this connector was found pointed at an entirely unrelated
project (a tutoring/exam-paper platform — `Shikshaqmine`, `teachers_list`,
`bank_questions`, none of AquaTerra's tables), then reconnected the same day
to the real project (`community-platform-aq`, id `hzowuwffjqtgszecngpe` as of
2026-09-22 — confirm live with `list_projects` rather than trusting this ID
forever). If the connected project does not have AquaTerra's tables, **do
not run any query or migration against it** — skip every Supabase-dependent
check for this run, note it plainly in the run's report, and stop there for
that section. This has already happened once; treat it as a real, recurring
possibility, not a one-off. Separately: the scheduled trigger itself may have
**no** Supabase connector access at all regardless of what a manually-run
session can see (this org's `create_trigger` doesn't support attaching
connectors programmatically) — a fired run should check for `mcp__Supabase__*`
tools existing at all before even getting to the project-identity check, and
say so plainly if they're missing, per the trigger's own prompt.

## Fallback when Supabase access is unavailable

Confirmed on 2026-09-28: a fired session can lack Supabase access on *two
independent axes at once* — no `mcp__Supabase__*` tools (the known
account-connector gap above) **and** no network route to the project's REST
host from the session's own sandbox (`generate-sitemap.mjs`'s direct
`fetch()` calls, which don't go through MCP at all, failed with "host not in
allowlist" against `hzowuwffjqtgszecngpe.supabase.co`). Either gap alone
already blocks every Supabase-dependent check; work through these tiers in
order and be explicit in the run's report about which tier you landed on:

1. **`mcp__Supabase__*` tools** — full read access (and the narrow
   content-write access this doc allows), the normal path. Use the
   guardrail above to confirm project identity before trusting it.
2. **Direct PostgREST reads via the public anon key** (`VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` from `frontend/.env` — the same credential
   already shipped in the production browser bundle, so using it here adds
   no new exposure) when MCP tools are absent but the sandbox's network
   egress allows the host. This tier is **structurally limited, not just
   inconvenient**: `client_error_logs` and `client_function_logs` (the
   routine's single most direct signal) grant SELECT only to
   `authenticated` rows passing `is_director() or is_super_admin()` — an
   anon key can never read them, full stop, regardless of network access.
   This tier can only cover the PRD data-quality checks against
   anon-readable tables/columns (`job_openings`, `teams`,
   `welfare_projects`, `posts` via `post_feed_view`, the 10 anon-readable
   `members` columns) — treat anything about silent failures or function
   telemetry as still unavailable at this tier and say so.
3. **Manual fallback report** — when neither of the above works (as on
   2026-09-28), a checked-in, read-only SQL file covering every check this
   doc describes:
   `frontend/scripts/self_healing_manual_report_2026_09_28.sql`. Tell the
   maintainer plainly that this file exists and needs a human to paste it
   into the Supabase SQL editor and paste the output back — that's the
   actual "how do I still get value from this week's run" answer when tier
   1 and 2 both fail. Keep this file current: if a check in this doc
   changes or a new one is added, update the query in that file in the same
   change (or add a newer dated file and say so in the run's report) rather
   than letting it silently drift from what this doc actually checks.

## Known baseline — don't re-report these as new findings

A first live run (2026-09-22) surfaced what `get_advisors` returns on a
totally normal day, so future runs can tell "new" from "always been like
this": **~60 SECURITY DEFINER lint findings** (`security_definer_view` on
`post_feed_view`, `member_directory_view`, `pending_member_approvals`,
`rejected_member_approvals`, `terrathon_public_events`; `anon`/`authenticated`
execute warnings on ~40 RPCs like `is_director()`, `ensure_member()`,
`get_own_member()`) are this codebase's normal, deliberate architecture —
CLAUDE.md's "Views can bypass all of this" section explains why. Do not flag
any of these individually; only flag a SECURITY DEFINER finding on a
function/view that ISN'T already in this list, since that's a genuinely new
surface someone should look at. One standing, real, low-urgency finding:
**leaked password protection is disabled in Supabase Auth** — this is a
dashboard-only toggle (Authentication → Policies in the Supabase UI), not
reachable via any MCP tool, so report it once as a "needs a human with
dashboard access" item rather than repeating it every week or attempting a
workaround.

## Worked example: the kind of bug this routine exists to catch

The same first live run found a real, reproducing bug this way, which is
worth keeping as a template for what "codebase drift" (§4 above) actually
looks like in practice: `client_error_logs` showed `error_type='render'`
messages reading *"Attempt to use history.replaceState() more than 100 times
per 10 seconds"*, repeated 71 times on `/choose-team` and 24 times on
`/register` — the browser's own throttle firing, meaning something was
calling `navigate(..., { replace: true })` in a tight loop. The root cause in
both cases was the same shape: a `useEffect` keyed on the whole `member`
object from `useAuth()` instead of the primitive fields it actually reads
(`member?.status`, derived booleans) — `member` gets a new object reference
on every `AuthContext` update even when nothing meaningful changed (e.g. a
burst of `onAuthStateChange` events right after the OAuth callback, which is
exactly when a freshly-registered member lands on these two pages), so the
effect re-fires and re-navigates on every one of those instead of only on a
real status change.

Two things worth carrying forward: first, **`/choose-team`'s instance was
already fixed on 2026-09-14** (see `components/FirstRunController.tsx`'s own
comment — the auto-redirect that caused it was removed entirely) with zero
recurrences since, while `/register`'s instance was still live in the code
and got fixed in this same run (see `auth/RegisterPage.tsx`). **Always check
current code and recent git history before treating a `client_error_logs`
pattern as still-live** — a stale `last_seen` timestamp with no recent
recurrence, especially alongside a comment or commit explaining a fix, means
it's already resolved and shouldn't be re-reported or re-fixed. Second, this
exact bug shape — an effect or memo keyed on a non-primitive object from
`useAuth()`/`useContext` instead of the primitive fields it reads — is worth
a standing grep (`useEffect\(.*\[.*\bmember\b.*\]` and similar) each run,
since it's the kind of thing that's easy to reintroduce in a new component
without anyone noticing until it ships.

## What it's allowed to do on its own, and what it must ask for

These limits came from an explicit decision, not a default — don't loosen
them without the org's maintainer saying so again.

**Code fixes — "auto-merge low-risk, PR everything else":**
- A fix counts as **low-risk** only if it is copy/content-only (fixing a
  typo, an inconsistent label, a stale figure caught by the "never invent a
  number" rule), or a small, mechanical, well-precedented correction that
  matches an existing documented pattern in this codebase exactly (e.g. a
  missing `sized()` image wrapper, a missing toast/confirm on a mutation, a
  route guard that doesn't match its own nav-visibility gate). It must not
  touch: authentication, RLS-adjacent code, the finance/payment modules in
  Paradox OS or TerraThon, anything under `members` PII handling, or any
  `.sql` migration file.
- A low-risk fix still goes through the full validated flow: branch, fix,
  `npm run lint` + `npm test` + `npm run build` clean, a PR opened, CI green
  on the PR — only then does it get merged, with a clear commit/PR
  description naming which PRD section and which check it closes.
- Anything else — a larger refactor, anything touching auth/RLS/finance/PII,
  anything the routine isn't fully confident about, any schema change —
  always opens a PR and stops there for a human to decide. This includes
  every case where "low-risk" is genuinely ambiguous: treat ambiguous as
  not-low-risk.
- The existing GitHub PR-driving rules this session already operates under
  (in its system prompt) still apply in full — never skip/disable a test to
  get green, never force-push, never bypass the repo's own CI gate.

**Supabase writes — "safe data fixes yes, schema/RLS always human-reviewed":**
- May directly `UPDATE`/fix plain **content** rows it is confident about
  (e.g. a typo in a post body, closing a job opening long past its
  deadline, marking a clearly-stale draft) via `execute_sql`, logged in the
  run's report with the exact statement run.
- Never modifies members' PII columns directly, never widens a grant,
  never runs an ALTER on RLS policies, never runs a migration file it
  wrote itself — those are always written as a new, clearly-commented
  `.sql` file under `frontend/scripts/` (matching this repo's existing
  migration convention) for a human to review and run, exactly like every
  other migration in this codebase, and called out explicitly in the run's
  report as "needs to be run."
- Any data fix that touches more than a handful of rows, or that it can't
  fully justify from the PRD's stated rules, is reported instead of
  executed.

## What gets reported vs. done silently

The point of this routine is to keep the maintainer's involvement to
reading a short weekly summary, not reviewing every diff by hand. Each run
should:
- Merge what it safely can (see above) without waiting on anything.
- Leave open PRs for anything larger, with enough context in the PR
  description that reviewing it doesn't require re-deriving what the
  routine already figured out.
- Send one summary (the run's final message, plus push notification via
  the routine's configured `notifications`) covering: what shipped
  automatically, what's waiting in a PR and why, what data issues were
  found and whether they were fixed or just flagged, any outreach gaps
  found (e.g. "N enquiries/applications older than a week with no
  response"), and whether the Supabase connection was even usable this run.
- Never re-report the same already-flagged, still-unresolved item as if it
  were new — check for an existing open PR/issue covering it first.

## Changing the schedule or prompt

Use `update_trigger` (or `list_triggers` to find it) rather than deleting
and recreating — that preserves run history. The trigger's `name` is
"AquaTerra weekly self-healing review."
