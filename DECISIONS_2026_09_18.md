# Closeout decisions, 2026-09-18

Ten open items were put to the owner and answered. This file is the record of
what was decided and what state each item is in. It supersedes the "Your call"
track in `AUDIT_2026_09_17.md` and the two judgment calls left open in
`GUARDRAILS_2026_09_18.md`.

Status vocabulary: **done** (shipped and verified), **ready** (written, waiting
on the owner to run or trigger), **queued** (decided, not yet built).

---

## 1. Microsoft Clarity: public pages only

**Decided:** keep Clarity on anonymous routes, disable it the moment a session
exists.

Clarity records full session replays. Signed-in users are students and a large
share are minors, so replays of them reading their own profile, the feed and
the desk were being sent to a third party. Anonymous funnel data is what
actually informs the marketing surfaces, and that is kept.

Implemented in `index.html`: the tag checks localStorage for a Supabase session
before inserting itself, matched by pattern rather than a hardcoded project ref.
`AuthContext` calls `clarity('stop')` for a sign-in inside an already-open tab,
which the page-load check cannot catch. Unreadable localStorage counts as
signed-in, so the failure mode stays privacy-first.

Verified both ways in the browser: anonymous loads two Clarity scripts; with a
session key present there is no script, no network request and no global. The
privacy policy said this was "under review" in three places and now states what
actually happens.

**Status:** done, shipped in `d8aa703`.

## 2. Account deletion: soft delete plus a scheduled purge

**Decided:** keep `deleteMember`'s reversible window, then hard-delete after a
fixed grace period.

The privacy policy promises deletion; the code sets `deleted_at` / `deleted_by`
and keeps the row forever. Rather than weaken the promise, the promise is made
true. The reversible window stays because HoDs rely on it to undo an accidental
or malicious removal.

**The design changed once the schema was measured.** The purge cannot delete
the row:

- **A delete would fail.** Ten foreign keys reference `members` with
  `ON DELETE NO ACTION`, including `community_audit_logs.member_id`,
  `members.approved_by` and `posts.reviewed_by`. Any one aborts it.
- **If it succeeded it would destroy the org's record.** Twenty-nine cascade,
  including `posts.author_id` and `comments.author_id`. Deleting one member
  would erase every post they wrote, their comments, certificates, yearbook
  entry and drive attendance: work that belongs to more people than them.

So the personal data goes and the row stays, as a tombstone keeping the same
`member_id` and `uuid` so nothing dangles. That is what a deletion promise
requires when personal data is interleaved with records that are not personal.

Written as `frontend/scripts/CLOSEOUT_2026_09_19.sql` §2: a 30-day grace period,
a `members_pending_purge` dry-run view, and a daily pg_cron job at 04:23, clear
of the existing `purge-old-wall-notes` at 03:17. pg_cron 1.6.4 is already
installed. Measured 2026-09-19: one member is soft-deleted and none is older
than 30 days, so running it purges nothing and only arms the job.

**One gap, stated rather than hidden:** it does not reach `auth.users`, which
holds the same person's email and Google identity. Deleting an auth user needs
the service_role key or the dashboard, and giving a timer the power to delete
accounts is worse than leaving it deliberate. §2.4 carries the query and the
runbook. Until that step is taken the promise is only half kept.

**Status:** ready, owner runs the SQL.

## 3. PII in git history: purge and force-push

**Decided:** strip the HR workbook from every commit with `git filter-repo`,
then force-push.

About 2,360 member emails and phone numbers sit in pushed history at commit
`72c28f5`. The repo is private, but "private" is a setting someone can change,
and a collaborator added tomorrow inherits the whole history.

Rewrites every SHA. Any existing clone must be re-cloned and open PRs must be
recreated. **The force-push is a separate, confirmed step**, so the runbook is
prepared and is not run automatically.

Runbook: `frontend/scripts/PURGE_GIT_HISTORY.md`. Re-verified against the live
repo rather than copied from the older audit: one commit (`72c28f5`, 2026-08-31)
added four `.xlsx` workbooks, and `migrate.js` carrying the service key sits in
`c8778ae`, `f44bd57`, `1f77cfd` and `3bacd92`. Nothing is tracked at HEAD, so
this is purely a history problem. `.git` is 72 MB. `git filter-repo` is not
installed here; the runbook says so.

**Order matters:** rotate the key first. A purge makes the leaked value harder
to find, a rotation makes it worthless. The emails are the reverse: they cannot
be rotated, so the purge is their only remedy.

**Status:** runbook ready, owner triggers.

## 4. Typography voice: keep the caps

**Decided:** feed timestamps stay `3D AGO` and empty states stay
`NOTHING POSTED YET.`

Both are short enough to read as labels rather than shouting, and both sit next
to other caps meta. No work.

**Status:** done (shipped in #11).

## 5. Home feed: chronological, newest first

**Decided:** drop the re-sort on page 1.

**Already true. No code change needed, and the question rested on a false
premise of my own making.** I described the bucketing as live. It is not.

`feedService.getFeed` takes a `tab` of `'foryou' | 'latest' | 'myteams'` and
defaults to `'latest'`. The bucketing (teams → followed → liked → rest) lives
inside `if (tab === 'foryou' && page === 1)`. But `HomePage.tsx:876` reads:

```ts
const sort: FeedTab = 'latest'
```

a `const`, never reassigned, and it is the only place any caller passes `tab` at
all. The other four `getFeed` call sites pass none and take the default. So
**`tab` is always `'latest'`** and the feed has been plain chronological,
newest first, since the feed tabs were removed in `fee5313`.

Both the `'foryou'` and `'myteams'` branches are unreachable.

**Status:** done, by already being the case.

### Follow-up, NOT actioned: ~90 lines of dead ranking code

Flagged rather than deleted, because removing it is a bigger change than the
ordering decision implies and it should be a deliberate yes.

What is dead: the whole `tab === 'foryou'` block including the thin-page
backfill, the `tab === 'myteams'` block, and three query helpers used nowhere
else (`getMyTeamUuids`, `getFollowedAuthorIds`, `getLikedAuthorIds`). The
`isBackfill` divider in `HomePage.tsx:1674` renders a flag nothing sets.

Why it is worth removing: it is dead code that implements the option this
closeout explicitly rejected, and reviving it is one `const` away. That is the
riskiest shape dead code takes. It also makes the file read as though a ranking
model is running when none is.

Why it might stay: if the "for you" tab is meant to come back, this is the
implementation, and it is well commented.

**Status:** awaiting a yes/no.

## 6. Photobooth objects: script written, owner runs it

**Decided:** produce a reviewed cleanup script that lists what it will remove
before removing anything.

Measured live 2026-09-19, and the 2,357 figure is exactly right:

| bucket | objects | size |
|---|---|---|
| `photobooth-raw-photos` | 1,831 | 217 MB |
| `photobooth-print-sheets` | 522 | 40 MB |
| `photobooth-assets` | 4 | 70 kB |

All three private, nothing newer than 2026-08-22, and no file under
`frontend/src` mentions photobooth at all.

Script: `frontend/scripts/delete-photobooth-objects.mjs`. Dry run by default;
deleting needs `--confirm`. It uses the **Storage API, not SQL**, because
`delete from storage.objects` removes the row and leaves the actual file behind,
freeing nothing and creating orphans that are harder to find than what you
started with. It re-lists afterwards to verify rather than trusting the delete
calls, and prints counts only, never object paths, which embed session ids.

`photobooth-assets` is excluded unless you pass `--include-assets`: four files
across three folders are frame and overlay templates, not student photographs.

**Status:** script ready and syntax-checked, owner runs it.

## 7. Edge Middleware: not now

**Decided:** leave the soft 404 in place and add no edge layer.

A nonexistent URL returns 200 with the homepage because of the SPA catch-all
rewrite. That costs some crawl budget and nothing else; there are 630 real URLs
and no ranking problem. Middleware would add a runtime layer to every request,
and the rate-limit argument does not hold: the browser calls Supabase directly,
so a scraper never touches the Vercel edge.

**Status:** closed, no work.

## 8. design-probe.js in CI: yes, report only

**Decided:** run it on a few key routes against a preview build and print
findings without failing the build.

Catches layout regressions early. Non-blocking on purpose: a hard gate on
rendered measurements is the thing that gets disabled after its first false
positive, and this repo has already recorded four confident false positives
from its own detectors (see `ui-detectors-lie-look-instead`).

Added as a `design` job in `.github/workflows/ci.yml`, pull requests only, with
`continue-on-error: true` AND `process.exit(0)` in the runner. Separate from
`verify` so the browser download runs in parallel and never slows the gate that
can actually block a merge.

`frontend/scripts/run-design-probe.mjs` serves `dist` with `vite preview`, drives
Chromium over 5 routes at 390px and 1280px, and prints findings with the probe's
own blind spots restated underneath. Playwright is installed with `--no-save`
inside that job only: its postinstall downloads browser binaries, so a
devDependency would add that download to every `npm ci` to serve one advisory
step. The runner imports it optionally and skips cleanly when absent, verified
locally (exit 0, one line of explanation).

**Status:** done.

## 9. service_role key: prepare now, rotate later

**Decided:** move the four scripts onto a rotated env var name and write the
runbook now; the owner rotates when they choose.

`frontend/.env` holds a `service_role` JWT that is byte-identical to the one
committed to root `migrate.js` in four commits, so it was never rotated. It
bypasses every RLS policy. Open in the repo's own docs since 2026-07-31.

Rotation breaks `seed-teams.mjs`, `compute-org-facts.mjs`,
`hr-import/import-hr-workbooks.mjs` and `compress-storage-buckets.mjs`. Prepping
them first makes the rotation a dashboard click plus one paste.

Done: all four now read `frontend/scripts/serviceKey.mjs`, which prefers
`SUPABASE_SERVICE_ROLE_KEY` and still accepts the old `SUPABASE_SERVICE_KEY`
with a deprecation warning, so nothing breaks before the rotation and there is
exactly one name to set after it. The two names had genuinely diverged: `.env`
defines the old one while two scripts looked for the new one, and
`loadEnv.mjs` documented the mismatch while explicitly leaving it "entangled
with the pending key rotation". Runbook: `frontend/scripts/ROTATE_SERVICE_KEY.md`.

One correction to the note in `loadEnv.mjs`: it says the name mismatch is why
`compute-org-facts` never finds the key locally. Checked, and that is not the
mechanism. That script does not load `.env` at all, so it only ever sees what
the shell exports. Behaviour is unchanged by this prep, confirmed by running it:
it still skips and still keeps the committed `orgFacts.ts`.

**The key stays valid and RLS-bypassing until the owner rotates it.** That is
the accepted state, not an oversight.

**Status:** queued (prep), owner rotates.

## 10. Public roster: trim what anon sees

**Corrected after checking properly, because my first framing was wrong.** I
told the owner these columns were "not needed to browse" the roster. They put
the question back with the real consequences attached.

`bio` **stays readable by anon.** It is displayed twice on `/member/:uuid` and
feeds that page's meta description. It is written to be read, profanity-filtered
on save, and carries no contact detail. There is no aggregate substitute.

`class_grade` **is revoked**, and that only became possible because `/classes`
had already stopped reading it. It calls `class_cohort_counts()`, a SECURITY
DEFINER function returning `(cohort, member_count)` and no identifying row.
Verified live: `prosecdef` true, anon may EXECUTE.

Two front-end changes were required first, both shipped and both verified in the
browser as an anonymous visitor:

- `/members` selected `class_grade` for every member and **never rendered it**.
  Removed. The live request is now
  `member_id,uuid,full_name,avatar_url,role,created_at,schools(name)`.
- `getPublicProfile` names `class_grade` only when a session exists. This is the
  subtle one: PostgREST rejects the **whole query** when the caller cannot read
  one named column, so leaving it in would have 403'd the entire public profile
  rather than blanking a field. One call backs two routes, and only the signed-in
  one renders the class line.

A **column-level** revoke, not a table-level one. `revoke select on
public.members` with no column list is a reset that drops the matching column
privileges too, which is exactly how signed-in reads broke on 2026-09-18.
Verified with a count (expect anon 9, authenticated 32, of 40), never a spot
check: confirming the column closed proves the revoke ran, but only the count
shows it did not do more than intended.

Paging is left deterministic: `count: 'exact'` and the `member_id` tiebreaker
stay, because they fixed a real bug and removing them costs the visible
"1,327 active members" figure for very little gain.

**Status:** front-end done; SQL ready in
`frontend/scripts/CLOSEOUT_2026_09_19.sql` §1, owner runs it.

---

## Also being done, not asked about

Unambiguous fixes with no judgment in them:

- **`/assets/` rewrite exclusion.** The SPA catch-all sends every unmatched path
  to `/`, including a stale hashed asset after a deploy. So a missing chunk
  returns `200 text/html` instead of 404, and `lazyWithRetry`'s retry can never
  succeed: it re-requests, gets HTML again, and the route stays broken until a
  hard reload.
- **`engines.node` pin.** CI runs Node 22 (`navigator` only exists from 21);
  nothing in `package.json` says so.

## Closed while reviewing, no action needed

- **`hr` vs `super_admin` in the capability engine.** Carried since the 17 Sept
  audit as a suspected divergence. It is deliberate: `super_admin` is never
  restrictable, `hr` is restrictable except on the matrix desk itself, and a
  database constraint mirrors it. Both `lib/capabilities.ts:251` and
  `services/roleCapabilityMatrixService.ts:104` explain why in comments. Not a
  bug. Do not "fix" it with `isSuperAdmin()`; that collapses the two tiers.
