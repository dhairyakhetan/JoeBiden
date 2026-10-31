---
tags: [frontend, seo]
---

# SEO and Meta

A client-rendered SPA that still has to rank. Four moving parts.

## 1. One canonical origin

```ts
export const CANONICAL_ORIGIN = 'https://www.ngoaquaterra.com'
export const SITE_NAME = 'AquaTerra'
```

> [!important] Every surface must canonicalise to **this exact host**
> The apex `ngoaquaterra.com`, the `vercelaq.vercel.app` preview domain and any
> `http` variant all serve the same content. Without a single canonical, search
> engines see duplicates and **split the ranking signal**. `robots.txt`,
> `sitemap.xml` and the static `index.html` canonical already use
> `www.ngoaquaterra.com` — `hooks/useMeta.ts` must match, and so must anything new.

## 2. `useMeta` — per-route tags

`hooks/useMeta.ts` sets `<title>`, description, canonical and Open Graph /
Twitter tags per route, using `useLayoutEffect` so the tags are in place before
paint. It imports `sized` from `lib/imageUrl`, so **OG images are right-sized for
crawlers** rather than shipping a 3 MB original to a link unfurler. See
[[Image Pipeline]].

`hooks/useJsonLd.ts` handles structured data.

## 3. `lib/metaConfig.ts` — the copy lives in one file

```ts
export interface MetaConfig {
  title: string; description: string; image?: string
  path: string; type?: 'website' | 'article' | 'profile'
}
export const pageMetadata: Record<string, MetaConfig> = { home: {...}, about: {...}, ... }
```

Titles and descriptions are written as real marketing copy, not templates, and
they carry concrete org facts:

> "a student-run NGO in Kolkata where 1,200+ teenagers run real welfare, climate
> and education work — 550+ drives since 2021. self-funded, free to join."

Those numbers come from `lib/orgFacts.ts`, the canonical source shared with the
marketing pages.

> [!warning] `orgFacts.ts` and `metaConfig.ts` can drift
> The live counts are 1343 `members` and 558 `welfare_projects`, which is roughly
> what the copy claims — but nothing keeps them in sync. Update `orgFacts.ts` when
> the numbers move, and check `metaConfig` strings that hardcode them.

Note two routes are deliberately **absent** from `metaConfig`, the sitemap and all
nav: `/welcome` and `/brand`. That is intentional — direct-URL only.

## 4. The sitemap, and the guard it needed

`scripts/generate-sitemap.mjs` combines:
- **curated static routes**, verified 1:1 against `App.tsx`'s `<Routes>` tree
- **dynamic routes** pulled live, read-only, from Supabase (projects, blogs,
  posts, members, teams, openings)

Index pages inherit their children's newest real date as `lastmod`; static routes
carry **no** `lastmod`, because there is no honest value for them.

> [!danger] `verify-sitemap.mjs` exists because the generator once failed silently
> On a Supabase fetch failure it emitted **only** the static routes and exited 0 —
> collapsing the sitemap from ~594 URLs to 31, with a green build. The postbuild
> verifier is what turns that into a failure. Do not remove it.

Regenerate with `npm run sitemap`, or `npm run build:full` to do both.

## Prerendering — and the trap it hides

About **15 routes are prerendered** into real files in `dist/`. Vercel checks the
filesystem **before** rewrites, so those return genuine 200s.

> [!danger] This is exactly what masks a broken SPA rewrite
> If the rewrite destination is wrong, `about`, `faq`, `teams` etc. keep returning
> 200 and the site *looks* fine — while `/login`, `/director/*`, `/post/:uuid`,
> `/member/:uuid` and every other client-only route 404s. It presented as "the HoD
> desk is broken." See [[Deployment and Vercel]] for the check to run.

## Content that is invisible to search

- `blogs` and `job_openings` are not covered by in-app search (though they are in
  the sitemap) — see [[Flow - Search and Discovery]]
- A blog with no `featured_image` never enters the feed, so it loses all internal
  linking from `/` — see [[blogs]]
- Draft welfare projects and pending posts are correctly excluded by RLS

## Internal linking

`lib/categories.ts`'s `CAT_TO_DEPT` turns every category chip into a link to the
matching department anchor on `/projects`. Combined with `RelatedTicker`,
`OpeningsStrip` and `Breadcrumbs`, that is the passive internal-link graph — worth
preserving when redesigning cards.

Related: [[Deployment and Vercel]] · [[Flow - Public Visitor Journey]] · [[Image Pipeline]]
