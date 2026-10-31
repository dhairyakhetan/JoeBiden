# Projects Directory — `/projects`

**File:** `public/PublicProjectsPage.tsx` (587 lines), `styles/routes/projects.css`.

## What this page is

**Intent:** a visitor exploring what AquaTerra actually does — browsing by department/category, or landing here from a specific department link elsewhere on the site.

## Current design

A dark hero with live totals, an 8-department chip ticker ("everything we do," merged in from a retired standalone page), a desk-curated "featured drives" bento, a sticky collapsing filter bar (search + category chips), and an infinite-scroll post stream.

**Working well:** the engineering rigor here is some of the best in the codebase — the featured-bento query resolves a real column mismatch (`post_feed_view.featured` mirrors an unrelated flag; the real curation lives on `welfare_projects.featured`) rather than silently showing nothing; a documented tiebreaker (`.order('id')`) makes the featured set deterministic against React 19 StrictMode's double-invoked mount effect; and the infinite-scroll sentinel uses a callback ref specifically because a plain `useRef` doesn't re-attach once the sentinel div first mounts — a real, previously-shipped bug the comment describes precisely ("infinite scroll silently stopped after the first page everywhere, worse on mobile").

## Intent-driven affordance audit

### P1 — The department chip ticker mixes three different kinds of destination behind one identical control
`DEPT_LINKS` sends department chips to three genuinely different places with zero visual distinction: an in-page category filter (Events → `/projects?category=events`), a different page entirely (Collabs → `/collaborations`, Crftd → `/crftd`), or straight into the login/apply flow (Human Resources → `/login`). A visitor tapping "Human Resources" expecting to learn what that department does instead lands on the sign-in page with no explanation — a real intent mismatch. The ShikshAQ chip does correctly open externally in a new tab, but — unlike Support's and Quick Links' own established →/↗ convention — nothing on the chip itself signals it's about to leave the site. Recommend: visually distinguish "filters this page" from "goes elsewhere" from "starts an application," at minimum with the site's existing arrow convention.

### P1 — The featured-bento "see all drives" button changes a filter the user can't see change
Clicking "see all drives →" calls `setCategory('welfare')` but does not scroll to the stream section below, which is well off-screen from the bento at that scroll position. The user's action (asking to see more) produces an invisible state change — the results they asked for are now filtered and waiting further down the page, but nothing tells them to scroll, and nothing moved to meet them.

### Worth a second look — a documented category-color override may still exist elsewhere
A comment in the neighboring Project Detail page describes a past `v6.css` bug where `.cat-events`/`.cat-labs`/`.cat-ops` collapsed to sky and `.cat-welfare`/`.cat-content` collapsed to mint via an unscoped `!important` rule — exactly the "category colour collapse" the design tokens' own comments call out as a P0 to prevent. This page correctly uses `CAT_COLORS[...]` inline rather than relying on the `.cat-*` classes for its own chips, which sidesteps the issue here specifically. A direct search of the current `styles/` tree did not turn up that exact override, so it may already be fixed — but the inline-style workaround still being in place elsewhere suggests it wasn't confirmed safe to remove. Worth a dedicated check before trusting bare `.cat-*` classes (without an inline-style override) anywhere else in the app.
