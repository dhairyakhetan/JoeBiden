# SEO in this repo

**This file used to describe an Express/Node SEO layer that no longer exists.**
It documented "4 new SEO endpoints, 555 lines of production code" running on a
`backend/` server, and linked six companion documents. The backend was deleted,
all six documents were deleted, and the 349 lines describing them stayed behind
and kept being found. Replaced 2026-09-17 during the five-dimension audit
(`AUDIT_2026_09_17.md`, SEO P3).

There is no API server. SEO here is entirely a build-time and client-side
concern in `frontend/`.

## Where it actually lives

| Concern | File |
|---|---|
| Per-route title, description, canonical, OG and Twitter tags at runtime | `frontend/src/hooks/useMeta.ts` |
| The copy for every route, as one source of truth | `frontend/src/lib/metaConfig.ts` |
| JSON-LD helpers (BreadcrumbList, Organization, ItemList, Person) | `frontend/src/hooks/useJsonLd.ts` |
| The static shell: Organization, WebSite and Dataset JSON-LD, favicons, fonts | `frontend/index.html` |
| Build-time prerender of 20 static routes plus ~585 dynamic ones, each with its own head and a crawlable body | `frontend/scripts/prerender-meta.mjs` |
| Sitemap generation from live Supabase rows | `frontend/scripts/generate-sitemap.mjs` |
| The gate that fails the build on a missing, empty or stale sitemap | `frontend/scripts/verify-sitemap.mjs` |
| Crawler rules, including the per-bot fences for 14 AI crawlers | `frontend/public/robots.txt` |
| Plain-language site summary for LLMs | `frontend/public/llms.txt` |

## Two things that are easy to get wrong

**`index.html` deliberately carries no `<link rel="canonical">.** It is also the
SPA fallback that `vercel.json` serves for every unmatched path, so any canonical
placed there is inherited by `/post/:uuid`, `/member/:uuid`, `/opportunities/:id`
and all of `/paradox/*`, telling crawlers those pages are the homepage.
Prerendered routes get a self-referencing canonical injected by
`prerender-meta.mjs`; everything else self-canonicalises, which is correct.

**A route's copy belongs in `metaConfig.ts`, not inline in the component.**
`prerender-meta.mjs` reads `metaConfig`, so a component that passes `useMeta` its
own inline object serves one title to a crawler that does not run JS and a
different one to everything else. That was live on `/directory`, `/labs` and
`/join` until 2026-09-17.

## Current state and open items

`AUDIT_2026_09_17.md` section 4.1 has the full SEO picture at commit `8bc843d`:
what holds, what does not, and what is still open. `AUDIT_QUEUE_2026_09_17.md`
tracks which of those have been fixed.
