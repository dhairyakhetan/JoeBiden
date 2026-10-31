---
tags: [architecture, ops]
---

# Deployment and Vercel

Vercel-only. It builds **`frontend/` and nothing else**.

```json
"buildCommand": "cd frontend && npm install --prefer-offline --no-audit && npm run build",
"outputDirectory": "frontend/dist",
"installCommand": "echo 'install handled by buildCommand'",
"framework": null,
"cleanUrls": true
```

`frontend/server.cjs` (an Express static server that sets COOP for the Google
OAuth popup) is an **alternative non-Vercel way** to serve a built `dist/`. It is
not part of the Vercel path.

## The SPA rewrite trap — read this before touching routing

```json
{ "source": "/(.*)", "destination": "/" }
```

The destination **must be `/`, not `/index.html`.** `cleanUrls: true` makes
Vercel 308-redirect `/index.html` to `/`; so with that destination the rewrite
resolves to a *redirect* instead of a document, and the request falls through to
a hard Vercel 404.

The failure is deceptive: Vercel checks the filesystem **before** rewrites, so
the ~15 prerendered routes (`about`, `faq`, `teams`, …) keep returning 200 and
the site looks fine — while `/login`, `/director/*`, `/post/:uuid`,
`/member/:uuid` and every other client-only route 404. It presented to users as
"the HoD desk is broken".

Check after any routing change — all four must be 200:

```bash
for u in / /login /director /post/abc; do curl -s -o /dev/null -w "%{http_code} $u\n" https://www.ngoaquaterra.com$u; done
```

## Security headers (all set at the edge)

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` — **required**, a strict `same-origin` breaks the Google OAuth popup |
| `Content-Security-Policy` | see below |

CSP allow-list, in plain terms: scripts from self + Microsoft Clarity; styles
from self + Google Fonts; images from self, `data:`, `blob:`, any `https:`;
`connect-src` self + `*.supabase.co` (incl. `wss:`) + Clarity + Google accounts;
frames only `accounts.google.com`; `frame-ancestors 'none'`;
`object-src 'none'`; `form-action 'self'`.

> [!warning] CSP is the thing that breaks when you add a vendor
> Any new analytics, font host, CDN, embed or API endpoint must be added to the
> matching directive or it fails silently in production only.

## Cache-Control

| Path | Policy |
|---|---|
| `/assets/*`, `/fonts/*` | `max-age=31536000, immutable` (hashed) |
| `*.svg png jpg jpeg webp avif ico woff2` | `max-age=2592000` (30 d) |
| `*.mp4 webm mov m4v` | `max-age=2592000` |

## Build commands (run from `frontend/`)

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` — **the real CI/deploy build** |
| `npm run build:full` | sitemap first, then the same build |
| `npm run lint` | `eslint .` |
| `npm test` | Vitest — `lib/roles.ts`, `lib/imageUrl.ts`, `lib/profanityFilter.ts` |
| `npm run sitemap` | `scripts/generate-sitemap.mjs` |
| `npm run preview` | preview a production build |

## Verification standard

There is a **first** test layer, not full coverage. The real gates are:

1. `tsc -b` typechecks (part of `npm run build`)
2. `npm run build` succeeds
3. `npm test` if you touched a covered file
4. Manual/browser verification for anything with runtime behaviour

A change is not done until the build is clean. Note that **welfare-project and
blog queries are invisible to `tsc`** because `supabase` is typed `any` — see
[[Supabase Clients]].

## Sitemap

`scripts/generate-sitemap.mjs` combines curated static routes (verified 1:1
against `App.tsx`) with dynamic routes pulled live and read-only from Supabase.
`scripts/verify-sitemap.mjs` runs postbuild — it exists because the generator
once silently emitted only the static routes, collapsing the sitemap from ~594
URLs to 31. See [[SEO and Meta]].

## Analytics

`@vercel/analytics` (`lib/funnel.ts`) plus Microsoft Clarity. Funnel events
carry **no personal data** — members are students, many minors. See
[[Flow - Signup and Approval]].

## Migrations are manual

There is no migration runner. Schema changes are checked-in `.sql` files in
`frontend/scripts/` meant to be pasted into the Supabase SQL editor by a human
(or applied via the Supabase MCP connector).

> [!danger] A `.sql` file in the repo does **not** mean it has been applied
> This has caused a real bug: `job_applications` was referenced throughout
> `lib/jobOpenings.ts` for a long time before anyone noticed the table did not
> exist live. Always cross-check the live schema. See [[Schema Overview]].

Related: [[Routing Map]] · [[Caching Layers]] · [[How to Add a Feature]]
