# Post — `/post/:uuid`

**File:** `feed/PostPage.tsx` (543 lines, orchestrates `feed/post/{PostHeader,PostBody,PostActionBar,PostComments,PostRelated}.tsx` — not individually read in this pass).

## What this page is

**Intent:** almost always arrived at via a shared link, search result, or direct URL rather than in-feed browsing (in-feed clicks open `PostFocusModal` instead — see Home audit). For the 555 of 556 posts that mirror a blog/project/opening, the visitor's real intent is usually better served by the source page this one canonicalizes to.

## What's genuinely working

This page's SEO handling is the most careful in the whole codebase. The canonicalization logic is explicit about *why*: since virtually every post is a mirror, `/post/:uuid` isn't an SEO surface in its own right — it's hundreds of duplicate URLs competing with pages already in the sitemap, so each mirrored post's canonical points at its real source (`/projects/:slug`, `/blog/:slug`, `/opportunities/:id`), consolidating the ranking signal instead of splitting it. Genuinely member-authored posts get `noIndex` instead, with the reasoning stated plainly: many authors are minors, and a personal community update isn't something to publish into a search index by default. The `<meta>` fallback while a post is still loading correctly avoids ever emitting a wrong or empty title a crawler could latch onto. Optimistic like/comment/delete flows all roll back on failure with a real toast explaining what happened, not a silent revert.

## Findings

No P0/P1 intent-affordance faults surfaced at the orchestration level audited here (the presentational sub-components — `PostHeader`, `PostBody`, `PostActionBar`, `PostComments`, `PostRelated` — would need their own pass for a complete picture; flagged for follow-up if a deeper pass on this page is wanted). One structural note worth tracking alongside the other "two copies of one feature" findings in this audit (the duplicate `FeedPostCard` implementations on Home, the duplicate FAQ content on Volunteer Handbook): the inline comment sheet inside `FeedPostCard`/Home's feed cards and this page's dedicated `PostComments` component are two independent comment UIs for the same underlying feature, one lighter-weight (sheet) and one full (page). That's a defensible product split (quick-glance vs. full-page), but worth keeping in mind as a place logic could drift if comments behavior changes in one place and not the other.
