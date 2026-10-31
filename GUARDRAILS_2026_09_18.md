# Guardrails Review, whole environment

**Date:** 2026-09-18
**Scope:** everything that can stop a bad change reaching a user or a member's data. Design, speed, backend, security, codebase, responsiveness, data governance, and the analytics/sales surface.
**Method:** read against the working tree, plus `npm audit`, `npm ls`, and the live config. No database access this pass, so nothing below asserts what an RLS policy says.

---

## 0. The structural fact that shapes every guardrail

There is no API server. The browser talks to Supabase directly.

That has one consequence worth stating before anything else: **the only guardrail that runs on a machine you control is the database itself.** Everything else on this list runs either on a developer's laptop, in a build step, or in the user's browser, and all three can be bypassed by anyone who opens a terminal and calls PostgREST with the anon key.

So the register below splits into two classes, and the distinction matters more than severity:

- **Enforcing guardrails**: RLS policies, column grants, CHECK constraints, SECURITY DEFINER RPCs. These cannot be bypassed.
- **Advisory guardrails**: TypeScript, lint, tests, build gates, `robots.txt`, role checks in components. These catch honest mistakes. They stop nobody who is trying.

A healthy environment needs both. This one is strong on advisory and, as of today, measurably stronger than it was on enforcing. The gaps are concentrated in a third class that barely exists here: **detection**, meaning anything that tells you a guardrail failed after it failed.

---

## 1. The register

### 1.1 Build gates (run on every Vercel deploy)

`vercel.json` sets `buildCommand` to `npm run build`, so every one of these runs before a deploy can succeed. This is the strongest part of the setup.

| Gate | What it catches | What it cannot catch |
|---|---|---|
| `lint-accent-tokens.mjs` | hardcoded accent colours bypassing the token layer | any other design drift |
| `verify-routing.mjs` | the catch-all rewrite regression that once 404'd `/login` and the whole desk | route behaviour that depends on auth state |
| `compute-org-facts.mjs` | org numbers on the site drifting from the database | nothing; it is a generator, not a check |
| `generate-sitemap.mjs` | missing URLs, private paths leaking into the sitemap | a shrink it refuses to write is still re-stamped as fresh |
| `tsc -b` | every type error, across 382 source files | anything the types describe wrongly |
| `verify-sitemap.mjs` | stale sitemap, private paths, count collapse | correctness of individual `lastmod` values |
| `check-bundle-budget.mjs` | eager critical path over 700KB, denied vendor chunks going eager | runtime cost of what is inside the budget |
| `prerender-meta.mjs` | missing per-route meta and JSON-LD on 570 pages | whether the meta is *accurate* |

**Verdict: genuinely good.** Eight gates plus a full typecheck, all deploy-blocking. Most teams this size have none.

### 1.2 CI

One workflow, `.github/workflows/smoke.yml`. It runs `scripts/smoke.mjs` against production **after** the push lands, with retry and backoff, and it exists because a rewrite regression once 404'd every client-only route while the homepage stayed green.

**What is missing is the whole left half of the pipeline:**

- **No pull-request gate.** Nothing runs before a merge.
- **No test run, anywhere, ever.** There are 701 passing tests across 28 files and no automation executes them. They only run when a human types `npm test`.
- **No lint run.** `npm run lint` exists and nothing calls it. ESLint is not in `build`.
- **No secret scanning**, no gitleaks, no pre-commit hook, no `.husky`. This repository has leaked credentials into history twice: a `service_role` key in `migrate.js` across four commits, and roughly 2,360 member emails and phones in the HR workbook at `72c28f5`. The guardrail that would have caught both costs one workflow file and has never been added.
- **No dependency automation.** No Dependabot, no Renovate.

**This is the single largest structural gap in the environment.** The build gates are excellent and they all run at the last possible moment, on a machine that is already deploying.

### 1.3 Dependencies

`npm audit --omit=dev` reports **8 vulnerabilities, 5 of them high**: three in `vite`, two in `ws`, one in `launch-editor`.

They appear under `--omit=dev` because `@tailwindcss/vite` is a runtime dependency and pulls `vite` into the production tree. **None of them ship to a browser.** They are dev-server and build-toolchain issues: path traversal in optimized-deps `.map` handling, `server.fs.deny` bypasses, arbitrary file read over the dev-server WebSocket, and an NTLMv2 hash disclosure via UNC paths on Windows.

The honest read: **low exploitability, non-zero, and Windows-specific.** The dev server binds locally, but three of these are reachable by any page the developer has open in the same browser while `npm run dev` runs. `npm audit fix` resolves all eight. There is no reason to carry them.

Two packages sit in runtime `dependencies` that do not belong there: `express` (used only by `server.cjs`, which is not on the Vercel path) and `@types/qrcode`.

### 1.4 Security guardrails

**Enforcing, and verified live today:**

- `members` has no table-level grant. Privileges are column by column, and ten columns were revoked from `anon` this morning and confirmed returning 401. The PII lockdown holds.
- `posts_anon_hide_soft_deleted`, a RESTRICTIVE policy, so it can only narrow.
- `role_capabilities_hr_never_locked_out`, a CHECK constraint that makes the lockout state unrepresentable rather than merely discouraged.
- `log_action()` is SECURITY DEFINER and stamps `member_id` from the caller's own session. **An audit log row cannot be forged to name someone else.** This is the best-designed guardrail in the codebase.
- `class_cohort_counts()` returns aggregates only, so the public `/classes` page needs no column grant on `class_grade`.

**Advisory:**

- CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, COOP, all present in `vercel.json` and served. `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` are all set. This is a well-built CSP.
- `script-src` still carries `'unsafe-inline'`, required by the inline Clarity bootstrap in `index.html`. A nonce would remove it.
- `Permissions-Policy` is absent.
- Role checks in TypeScript. Decoration, by the architecture. Every one needs an RLS twin.

**Open:** the `service_role` key is still unrotated. It is the last P0 and it is a dashboard action.

### 1.5 Observability and detection

This is the thinnest layer in the environment.

- `lib/errorTracking.ts` writes client crashes to `client_error_logs`, deduped, capped at 20 per session, fire-and-forget and non-throwing. Well built.
- `lib/auditLog.ts` records privileged actions, unforgeably.
- `ErrorBoundary.tsx` catches render crashes.
- Vercel Speed Insights and Microsoft Clarity are wired.

**And nothing alerts on any of it.** A crash loop hitting every member writes 20 rows per session into a table a director has to remember to open. There is no threshold, no notification, no digest, no dashboard anyone looks at daily. The data is captured and unread.

**Detection gap in one line:** if a guardrail fails in production tonight, the mechanism by which you find out is a member telling you.

### 1.6 Codebase and testing

- 28 test files against 382 source files, roughly **7 percent coverage by file**. All of it on pure functions: roles, capabilities, image URLs, profanity, cohorts, desk access.
- Zero tests on services, components, or anything that touches Supabase.
- ESLint's React-Compiler rules (`purity`, `immutability`, `set-state-in-effect`, `preserve-manual-memoization`) are all `'warn'`, deliberately and with a comment explaining why. `exhaustive-deps` is `'warn'` and suppressed at 33 sites. Defensible, but it means React-hostile patterns never fail anything.
- `@typescript-eslint/no-explicit-any` and `no-unused-vars` are `off`.
- 152 SQL migration files. **Six contain a rollback section.** There is no runner and no applied-status table, so the only record of what ran is a comment in a file, which this repo has been burned by twice and which I corrupted once today by accident.

### 1.7 Design and responsiveness

- The token layer plus `lint-accent-tokens.mjs` is a real, enforced guardrail on colour.
- `design-probe.js` exists and measures overflow, contrast, tap targets, heading order and CDN image sizing. **It is not in the build.** It runs when someone remembers to paste it into a browser console.
- Breakpoints are declared in a CSS comment, not in code, and four different values (600, 640, 760, 1025) are hand-synced between CSS and five separate JavaScript constants. 1024px matches neither side of the desk's own rule.
- 3,809 inline `style={{` blocks, 416 of which hardcode a width. Inline style outranks every media query, so each one is a responsiveness guardrail bypass by construction.
- Accessibility: 353 `aria-label`, 164 `aria-hidden`, 22 `aria-live`, `rules-of-hooks` at error. The basics are there and clearly deliberate. But **zero `prefers-contrast`, zero `forced-colors`**, no axe, no a11y lint plugin, and no audit has ever been run.

### 1.8 Data governance

This is where the environment is weakest relative to what it holds: personal data on roughly 1,324 people, **most of them minors**.

| Question | Answer in the repo |
|---|---|
| How long is data kept? | Not stated anywhere. No retention period on any table. |
| What happens on a deletion request? | `deleteMember` is a **soft delete**. It stamps `deleted_at`/`deleted_by`, nothing is removed, and `restore_member()` can undo it at any time. |
| What does the site promise? | `/privacy-policy`: "Deleting your account removes your profile, phone number and email." |
| How does a member request it? | By emailing an address. There is no in-app mechanism. `SettingsPage.tsx:51` says 30 days; the privacy policy says `APPROVAL_TIME`. |
| Is there a backup policy? | No document anywhere in the repo. |
| Is there a restore test? | None recorded. |

**The contradiction is the finding.** The privacy policy makes a removal promise to students and their guardians, and the implemented mechanism is a reversible flag. Both are defensible on their own. Together they are a statement that is not true, on a page whose audience is mostly under 18.

The policy also flags, in its own words, that Microsoft Clarity session recording currently runs for signed-in members and is "under review". That review is the open item. Recording minors' interaction sessions is the decision in this document that deserves the most thought.

---

## 2. Ranked gaps

Ranked by what reaches production unchallenged, not by theoretical severity.

| # | Gap | Cost to close | Why it ranks here |
|---|---|---|---|
| 1 | **No PR gate. Tests and lint never run automatically.** | about 30 minutes, one workflow file | 701 tests exist and guard nothing. This is free value already paid for. |
| 2 | **No secret or PII scanning.** | about 20 minutes, a gitleaks action | The repo has leaked credentials twice. The third time is the one you do not catch. |
| 3 | **Nothing alerts on `client_error_logs`.** | about 2 hours, a scheduled function or a digest | You are collecting the evidence of failures nobody reads. |
| 4 | **Deletion promise does not match deletion behaviour.** | a decision, then either wording or a hard-delete path | The population is mostly minors and the promise is written down. |
| 5 | **No retention or backup policy.** | a decision, then a document | Supabase takes backups; nobody has confirmed the window or tested a restore. |
| 6 | **8 npm advisories, 5 high, all build-chain.** | `npm audit fix` | Cheap, and three are reachable from a browser tab while `npm run dev` runs. |
| 7 | **`design-probe.js` is not in CI.** | about 1 hour | The design guardrail that exists is the one nobody runs. |
| 8 | **Migration status lives in a comment.** | about 1 hour, an `applied_migrations` table | Twice burned, and once more today. |
| 9 | **Breakpoints hand-synced across CSS and 5 JS constants.** | about 2 hours | A documented past bug: 900px rendered nothing at all. |
| 10 | **`'unsafe-inline'` in `script-src`; no `Permissions-Policy`.** | about 1 hour | The CSP is otherwise strong enough that this stands out. |

---

## 3. The company, analyst and sales view

Worth separating from the engineering view, because the questions are different.

**What the organisation can currently answer about itself:** headcount by status, cohort distribution (as of today, correctly), team rosters, post volume, approval throughput, job applications. `compute-org-facts.mjs` keeps the public numbers honest by generating them from the database rather than letting someone type them into a page.

**What it cannot answer:**

- **Retention and churn.** There is no notion of an active member over time, only a status flag. "How many of last year's volunteers are still here?" has no query.
- **Funnel conversion.** Sign-in, registration and approval are all recorded, but nothing measures drop-off between them. `/register` abandonment is invisible.
- **Engagement depth.** Clarity records sessions; nothing aggregates them into anything a director reads.
- **Attribution.** Where members come from is not captured at all.

For an organisation this size that is a reasonable place to be. The point is that the data to answer these questions is mostly already in the database, and the gap is analysis rather than instrumentation. That is a much cheaper gap than the reverse.

**One caution for any analysis built on this data:** `[SIM]` rows exist in production, tracked in `sim_seed_registry`. Every count anyone quotes should say whether it excludes them.

---

## 4. What is genuinely well built

Recording this deliberately, because a review that lists only gaps misrepresents the environment.

1. **Eight deploy-blocking build gates plus a full typecheck.** Rare at this scale.
2. **`log_action()`.** Server-stamped identity, unforgeable, non-blocking. A model for how the rest of the trust boundaries should be drawn.
3. **The CSP.** Specific, restrictive, and covering the directives most people forget.
4. **Column-level grants on `members`.** Painful to work with, and exactly right for the data it holds.
5. **The error-tracking design.** Capped, deduped, non-throwing, write-only. Only the alerting is missing.
6. **The feedback convention.** Every mutation wires a toast and a confirm, enforced by code review rather than tooling, and it holds across the codebase.
7. **The privacy policy itself.** It is written in plain language, it flags its own open question about Clarity rather than hiding it, and it says what other members can see. Most organisations this size have a template. The one problem is that one sentence in it is not true yet.

---

## 5. Recommended order

Two hours of work closes gaps 1, 2 and 6, and those three are the ones that change what can reach production. Do them together.

```
1. .github/workflows/ci.yml   npm ci && npm run lint && npm test && npm run build, on pull_request
2. a gitleaks action in the same workflow
3. npm audit fix
```

Then the two decisions only you can make, in this order:

1. **Clarity and minors.** Keep it, scope it to logged-out visitors, or drop it. The policy already says a review is open.
2. **Deletion.** Either add a hard-delete path behind the existing soft delete, or change the policy wording to describe what actually happens. Either is fine. The current pair is not.

Everything else on the ranked list is real, and none of it is urgent next to those.
