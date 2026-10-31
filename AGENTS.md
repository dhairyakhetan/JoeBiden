# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

AquaTerra is a community platform for a student-run volunteer organization (Kolkata). It has two independent halves that read as one app, plus a legacy piece that is no longer deployed:

- **`frontend/`** — the entire live product. React 19 + TypeScript + Vite, talking **directly to Supabase** from the browser (no API server in the request path). This is the only thing Vercel builds and deploys.
- **`backend/`** — a legacy Express + PostgreSQL API from an earlier architecture (JWT auth, Azure Blob Storage). Not deployed, not in the request path of the live app. `frontend/src/services/api.ts` is explicitly type-only now ("no Axios, no HTTP client — community services use `supabaseCommunity` directly"). Treat `backend/` as historical reference only; don't wire new frontend features to it.
- **Root-level `*.md` files** (`ARCHITECTURE.md`, `CODING_CONTEXT.md`, `IMPLEMENTATION_STATUS.md`, `PARADOX_OS_BUILD_LOG.md`, etc.) are point-in-time planning/audit notes from earlier phases of the project. Some describe architecture that was later abandoned (e.g. `ARCHITECTURE.md` proposes Azure AD B2C + JWT; the live app uses Supabase Auth + Google OAuth instead). Don't treat them as current truth — verify against the actual code in `frontend/src`.

All day-to-day work happens inside `frontend/`.

## Commands

Run from `frontend/`:

```bash
npm install
npm run dev          # vite dev server
npm run build        # tsc -b && vite build — the real CI/deploy build
npm run build:full   # generates sitemap first, then the same build
npm run lint         # eslint .
npm run preview      # preview a production build locally
npm run sitemap      # regenerate sitemap only (scripts/generate-sitemap.mjs)
```

There is no test suite in this repo (no Jest/Vitest config, no test script) — verification is `tsc -b` (typecheck) + `npm run build` (build must succeed) + manual/browser verification for anything with real runtime behavior. Always run both after a change; a change isn't done until the build is clean.

Deployment is Vercel-only, and only builds `frontend/`:
```json
"buildCommand": "cd frontend && npm install --prefer-offline --no-audit && npm run build",
"outputDirectory": "frontend/dist"
```
`frontend/server.cjs` (Express static-file server with a COOP header for Google OAuth popups) is an alternative non-Vercel way to serve the built `dist/`, not part of the Vercel path.

## Architecture

### Three separate Supabase projects, one codebase

This is the single most important thing to get right before touching data code — mixing these up silently breaks reads/writes.

1. **Community project** (`lib/supabaseCommunity.ts`, client `supabaseCommunity`) — auth, `members`, `posts`, `teams`, `job_openings`/`job_applications`, `notifications`, `saved_posts`, `follows`, `external_achievements`, and (since the projects were consolidated) `welfare_projects` and `blogs` too. Reads env `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. **CMS client** (`lib/supabase.ts`, client `supabase`) — historically a *separate* Supabase project for `welfare_projects`/`blogs`; it has since been repointed at the **same** project as `supabaseCommunity` (see `.env.example`'s note: "CMS reads now live in the same Supabase project as community data"). It still exists as a distinct client because it's configured differently — `persistSession: false, autoRefreshToken: false` (it never logs in; every write goes out as the anon key with no auth session). Several `welfare_projects` RLS policies are therefore deliberately `USING (true)` for UPDATE/DELETE — the "only directors can reach this" guarantee is enforced by app routing (`ProtectedRoute`/`hasLeaderAccess`), **not** by the database, for that one table. This is a documented, intentional trade-off (see `frontend/scripts/welfare_projects_allow_admin_write_2026_07.sql`) — don't "fix" it by tightening RLS without understanding this client never authenticates.
3. **Paradox project** (`paradox/lib/supabase.ts`) — a third, fully separate Supabase project for the annual Paradox event sub-app (`paradox_*` tables). Reads `VITE_PARADOX_SUPABASE_URL`/`VITE_PARADOX_SUPABASE_ANON_KEY`, falling back to the community project's env vars if unset.

When adding a query, check which client the surrounding file already imports before assuming — `director/*` and most of `services/*.ts` use `supabaseCommunity`; `public/PublicProjectsPage.tsx`, `public/BlogListPage.tsx`, `director/ProjectManager.tsx` use `supabase` (CMS); anything under `paradox/` uses its own client.

### Service layer contract

`services/*.ts` (feedService, teamService, directorService, profileService, followService, savedPostsService, achievementService, notificationService, jobOpenings in `lib/`) **throw on error** — they don't catch-and-toast internally. Every calling component wraps the call in try/catch and is responsible for its own user-facing feedback (see Feedback pattern below). Don't add toast calls inside `services/*.ts` or `lib/jobOpenings.ts` — that responsibility belongs to the component.

`notificationService.create()` is the one deliberate exception — it's fire-and-forget/non-throwing by design (a failed notification shouldn't block the action that triggered it).

### Role model

Five roles, checked via `lib/roles.ts`, not hand-rolled per-file: `member` < `lead` (team-scoped) < `hod`/`director` (equivalent power, different title) < `super_admin`. Use `hasLeaderAccess(role)` for "can moderate/approve" checks and `isSuperAdmin(role)` for the top tier — never add ad-hoc `role === 'hod' || role === 'director'` checks inline. Route-level gating is `ProtectedRoute`'s `requireDirector`/`requireSuperAdmin` props; this must match the equivalent tab-visibility gate in `DirectorDashboard.tsx`, or a lower-privileged leader can reach a super-admin-only screen by typing the URL directly (this has been a real, fixed bug before — always add both when adding a new super-admin-only surface).

Category-scoped moderation also exists: a `director`/`hod` can be assigned to specific categories (`events`/`welfare`/`content`/`operations`/`labs`) via `director_categories`, restricting which posts they can moderate. `directorService.getMyCategories()` / `assignCategory()` / `unassignCategory()`.

### The HoD desk (`director/*`) vs. the public front-end — two design languages, intentionally

The public/member-facing surfaces (`public/*`, `feed/*`, `profile/*`, `teams/*`, `tasks/*`) are **migrating to the same rounded-minimal language as the desk** (owner, 2026-10-19: shown the old ticket-style card beside the new rail card, "the one on the right is better, the left is the old design language", and asked for one cohesive design across the whole site). Hairline edges (`--hair`/`--hair-2`/`--hair-3`), soft lifts (`--lift-*`), the 32/22/14 radii and category fills with ink text are the rule. The hard 2px ink border and hard offset shadow now belong only to `.btn-primary` and `.sticker`; treat any other use as a leftover to convert, not a pattern to copy. The plan, the rules table and the open worklist are in `docs/plans/design-system-pass.md`.

`director/*` (all 14 tabs, routed through `DirectorDashboard.tsx`) is still routed through the same `.admin`-scoped CSS layer in `styles/v6.css`, but as of the 2026-07 Codex-design handoff pass its visual target was **reversed**: the desk now matches the handoff's *brutalist* HoD desk (`design-reference/AquaTerra - Playground.dc.html`), not the earlier "flat, calm, boring on purpose" work-tool look. Inside `.admin`, `.card`/`.hod-card` re-tokens to the prototype `.panel` (white surface, **3px** ink border, 20px radius, `overflow:visible`); list rows use the shared `.panel-h` / `.qrow` / `.qname` / `.qsub` / `.qtag` (colored category pill via `--cc`) / `.iconbtn` (`.ok`/`.no`) / `.role-badge` vocabulary, and `DirectorDashboard`'s landing has a dark "command desk." header + solid colored stat cards. The old `--hod-surface/border/shadow/radius` tokens still exist (dark-theme fallbacks, a few calmer surfaces) but the default light-mode desk is brutalist. **If you add a new HoD-desk surface, route its containers through `.card`/`.hod-card` and its rows through the `.panel-h`/`.qrow`/`.qtag`/`.iconbtn` classes** rather than hand-rolling a new style — inline `style` always wins over the cascade, which is exactly what forced several older files (`ProjectManager.tsx`, `TeamManagement.tsx`) to be reworked before. Note the handoff HoD desk is a simplified static mockup; the live tabs deliberately keep richer content (post previews, pagination, role controls, modals) inside the brutalist panel rather than stripping down to the mockup's fake rows.

The `paradox/*` sub-app is its own visual system entirely (heavy `framer-motion` use, own Nav/Footer/AuthProvider/ToastProvider) — don't try to unify it with either of the above.

### Feedback pattern (Toast + Confirm)

Every mutation across the app is expected to: show a pending/disabled state while in flight, a success confirmation on success, and an explicit error (never a silent console log) on failure. The primitives are `useToast()` (`components/Toast.tsx` — `toast.success/error/info`) and `useConfirm()` (`components/Confirm.tsx`, promise-based, used before any destructive action). This is a strict convention, not a suggestion — a PR/change that adds a mutation without wiring both is incomplete by this codebase's own standard.

### Image sizing

Any `<img>` rendering a Supabase/Framer-hosted image must go through `sized(url, context)` from `lib/imageUrl.ts` (`context` ∈ `avatar | thumb | card | cover | full`), which downscales via the CDN's resize param instead of shipping a multi-MB original for a 40px avatar. This has been the single biggest real performance bug found in this codebase historically (the entire `director/*` desk was found and fixed for this once already) — never add a new `<img src={someUrl}>` without wrapping it.

### Front-end motion toolkit

`lib/motion.ts` (shared framer-motion variants: `tapScale` — always `{ scale: 0.96 }`, never lower — `fadeInUp`, `staggerContainer`, `popIn`, `likeBurst`) plus `components/Reveal.tsx` (scroll-reveal, `whileInView`), `components/CountUp.tsx`/`StatCountUp.tsx` (rolling numbers), `components/SuccessCheck.tsx` (self-drawing checkmark for submit-success states) — reuse these instead of re-deriving animation config per file. Front-end only; the HoD desk stays motion-light by the same classification as above. Everything here must honor `prefers-reduced-motion` (via framer-motion's `useReducedMotion()`), matching the existing global CSS `@media (prefers-reduced-motion: reduce)` rules.

### Lazy-loaded director tabs

`DirectorDashboard.tsx` lazy-imports each of the 14 `director/*` tab components individually so opening the desk doesn't download every tab up front — only the active one. Follow this pattern for any new tab (`const NewTab = lazy(() => import('./NewTab'))`), and add both the `Tab` union member and the route in `App.tsx`'s `/director` route group with matching gating.

### Database migrations are manual, not a runner

There is no migration-runner tooling. Schema changes are checked-in ad-hoc `.sql` files (`frontend/scripts/*.sql`, plus a few at repo root and in `backend/migrations/` from the legacy backend) with a comment block explaining what they do and why, meant to be pasted into the Supabase SQL editor by a human (or applied via the Supabase MCP connector when available in a session). **A `.sql` file existing in the repo does not mean it has been applied** — cross-check against the live schema before assuming a column/table exists (this has caused a real bug: `job_applications` was referenced throughout `lib/jobOpenings.ts` for a long time before anyone noticed the table didn't actually exist in the live database). When you add a schema-dependent frontend change, write the migration file *and* say explicitly whether it still needs to be run.

### Out of scope / known-severed area

The recruitment → account-creation funnel (`public/RecruitmentPage.tsx`, `director/AccountApprovals.tsx`, `directorService.approveMember`, and the `volunteer_applications` ↔ `members` relationship) is known to be severed — there's no `auth.signUp` in that path currently. This is being handled separately; don't "fix" it incidentally while working on something else in that area.
