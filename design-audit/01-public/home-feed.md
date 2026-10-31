# Home / Feed — `/`

**Files:** `auth/HomeRoute.tsx` (gate) → `components/HomeIntro.tsx` (first-visit splash) → `public/HomePage.tsx` (1642 lines: notice board, left rail, feed, right rail) → `feed/FeedPostCard.tsx` (shared card, used for real posts) + a second, local `FeedPostCard` inside `HomePage.tsx` (used only for the sample-post fallback). Also renders `components/OpeningsStrip.tsx`.

## What this page is

The feed **is** the home page — there is no separate marketing landing page and no separate `/feed` route (it redirects here). Every visitor, authenticated or not, lands here.

**Distinct intents landing on the same URL:**
1. **First-time, unauthenticated visitor** — deciding in seconds whether this organisation is worth their time and how to join.
2. **Returning, unauthenticated visitor** — knows the org, wants back in (log in) or wants to check content without joining.
3. **Active member, browsing** — wants to catch up on what happened, filter to a category they care about.
4. **Active member, recently approved** — may be in the 2-day window where open roles are surfaced.
5. **Leader/HoD** — same as active member, plus moderation affordances (pin post, poster studio).

## Current design

Three-column shell: left rail (identity card or join-CTA card, then a category tile grid) · center feed (notice board carousel + post cards, infinite/paginated) · right rail (quick links to Projects/Teams/Blog/Members/Openings/About). A first-visit-only branded splash (`HomeIntro`) plays before any of it. An `OpeningsStrip` marquee can appear above the feed for members inside a 2-day post-approval window.

**Working well:**
- Category filter is a real visual tile grid (icon + label + live count when active) bound to the same `--c-*` tokens the feed card chips use — one hue per vertical, consistently applied. This is the intent-driven affordance done right: users browsing by interest get a large, directly-clickable target per category, not a cramped dropdown.
- The feed card's headline/snippet split fixed a real bug (cutting words in half) by breaking on sentence/word boundaries — a genuinely good text-handling detail.
- Optimistic like/bookmark with toast-only-after-resolution (not before) avoids the contradictory "saved!" immediately followed by "couldn't save" sequence a naive optimistic-UI would produce.
- Job-opening posts get a distinct "we're hiring" ticket treatment (`HiringCard`) instead of pretending to be a normal post — correct: the user's intent reading a hiring post ("is this for me, how do I apply") differs from reading a welfare update, and the layout signals that before they even read the text.

## Intent-driven affordance audit

### P0 — Two independent, hand-written feed-card implementations exist; the one most likely to go stale is the one shown to empty/new feeds
`HomePage.tsx` defines its own ~600-line local `FeedPostCard` function *and* imports the shared `feed/FeedPostCard.tsx` (694 lines) as `SharedFeedPostCard`. The comment on `MemoFeedPostCard` admits the local copy is now used "only for the rare sample-preview fallback" — i.e. it renders when the real feed is empty and the page falls back to `SAMPLE_POSTS`. That is exactly the state a brand-new visitor with nothing in their feed yet, or anyone hitting a fetch failure, is most likely to see, and it's backed by the *less-exercised, easier-to-drift* of the two card implementations (already visibly diverged — e.g. the local copy's comment-send button has no `aria-label` inconsistency check against the shared one, and any future card-level fix applied to the shared component silently won't reach this path). Delete the local duplicate and route the sample-post fallback through the shared card with an adapter, or make the fallback state visually distinct (an explicit "here's what a post looks like" empty-state treatnent) so it's not masquerading as live content through unmaintained code.

### P1 — A mandatory, full-screen branded intro delays every first-time visitor's actual look at the product
`HomeIntro` covers the entire viewport for ~2.6s (plus a 520ms close transition) on first visit, locks scroll, and requires noticing a small "skip intro" text link to bypass it. A first-time visitor's intent at this exact moment is "decide fast whether this is for me" — the highest-leverage few seconds of the whole funnel — and the design's answer is a brand animation they must actively opt out of. The engineering safeguards here are good (hard safety timeout so it can never trap someone, honours `prefers-reduced-motion`, clear visible skip label) but the default behavior still asks the coldest audience to wait through chrome before content. Consider: shrink to a non-blocking, non-scroll-locking reveal (e.g. content renders immediately, wordmark treatment overlays only the hero without `position:fixed; inset:0`), or drop the safety-timeout window from 2.6s+2.2s to something closer to 1s if it stays full-screen.

### P1 — The unauthenticated join CTA's copy sets an expectation ("replies within a week") that may not match the real flow
Left rail's join card: *"Usually replies within a week. free forever."* Signing up is described elsewhere in the codebase as Google-OAuth-first with an approval step — "replies within a week" reads like a manual-application-with-reply-time framing (job-application language), which can make a low-commitment audience hesitate expecting a week-long wait before anything happens. Verify this matches the real approval SLA (checked further in the Login/Register/Pending audits) and either confirm the copy or tighten it — the intent here is to lower the barrier to a first click, and "a week" is a barrier.

### P2 — The per-post "⋯" leader menu opens a dropdown with exactly one item ("Pin post")
For admins, the three-dot button opens a floating panel containing a single action. That's an extra click (open menu → click the one item) for a single affordance that could be a direct icon button (a pin icon) with the same visual weight as the existing like/comment/share/bookmark row. Fine as-is if more moderation actions are coming soon; otherwise collapse it.

### P2 — `CategoryFilter.tsx`'s selected state uses white text on `var(--accent)` (welfare green), which `tokens.css` documents as failing AA
This component (a full pill-style filter bar with emoji, a different category set/order than the live rail, and `bg-[var(--accent)] text-white` on the active pill) is **not actually rendered anywhere** — only its `getCategoryInfo`/`categories` data helpers are imported elsewhere (`director/PostModeration.tsx`, `teams/CreateTeamPostModal.tsx`). It's dead UI code sitting in the same file as still-used data exports, carrying a documented contrast violation and a stale category list (emoji, no "Ops" abbreviation, different set) that would visibly conflict with the live rail's tile grid if anyone ever re-wired it back in. Delete the dead component (keep the two exports), so nobody accidentally re-enables a contrast failure that already has a name in the design tokens' own comments.

## Supporting checks

- **Accessibility:** feed card headline correctly promoted to `<h2>` with a documented rationale (each `<article>` needs one under the page's single `<h1>`) — a real fix, not an accident. Comment-sheet close buttons meet the 40×40 floor per an inline comment noting the previous size failed it.
- **Motion:** `HomeIntro` and the feed card's `MotionConfig reducedMotion="user"` both respect reduced-motion; `OpeningsStrip`'s marquee should be spot-checked in `OpeningsStrip.css` for the same guard (not verified from the `.tsx` alone).
- **Responsive:** three-column shell implies the rails collapse somewhere ≤1080/≤760 per the breakpoint scheme; not verified visually in this pass — flag for a screenshot-based follow-up if visual QA is wanted.
