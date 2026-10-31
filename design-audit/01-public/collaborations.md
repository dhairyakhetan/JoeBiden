# Collaborations — `/collaborations`

**File:** `public/CollaborationsPage.tsx` (288 lines, no dedicated CSS file).

## What this page is

**Intent:** an organisation (school, NGO, brand) evaluating whether to partner, wanting proof of past partnerships and a low-friction way to propose one.

## Current design

Dark full-bleed hero, a marquee of partner names, a static "our partners" logo-wall grid, a "who we work with" category explainer, a live-fetched "collaborative projects" rail (real welfare projects that had a `collab_name`), a CTA band, and a fully validated proposal form (field-level errors, profanity filter, routes to `/thank-you?from=collab`).

**Working well:**
- The proposal form is genuinely well-built: inline field errors that clear on edit, `aria-invalid`, a `role="group"` + `aria-labelledby` on the collab-type chip set (correctly reasoned in a comment: a `<label>` there would associate with nothing), and real client + profanity-filter validation before the network call.
- The partner-card hover fix is a good, specific catch: appending an alpha suffix to a `var(--c-*)` custom property produces an invalid CSS string the browser silently drops — the comment identifies this precisely and replaces it with `color-mix()`. That's the kind of bug that would otherwise ship as "hover just doesn't do anything" with no console error to find it by.

## Intent-driven affordance audit

### P1 — Two sources of truth for "who we've worked with," one static, one live, one screen apart
The "our partners" logo wall (`COLLAB_PARTNERS`) is a hardcoded array of six named schools baked into the component. A few sections further down, "collaborative projects" fetches real, current partnerships live from `welfare_projects` where `collab_name` is set. Both sections answer the same visitor question — "have you actually done this before, with whom" — but one of them can silently drift out of date (a partner listed in the static wall may no longer be current; a new, real partner won't appear there until someone remembers to hand-edit the array) while the live rail directly below stays accurate by construction. For a page whose whole job is building credibility with a skeptical partner-evaluator, having the *first* proof-of-work section be the less trustworthy one is backwards. Either generate the logo wall from the same live query (grouped/deduped `collab_name` values) or drop it in favor of the rail, which already does the job with real data.
