# Blog List — `/blog`

**File:** `public/BlogListPage.tsx` (240 lines), `BlogListPage.css`.

## What this page is

**Intent:** a visitor or member browsing written stories, distinct from the main feed's short posts.

## Current design

A large lead-story cover card for the newest post, then a magazine-style grid (image-led or color-block cards depending on whether a featured image exists), popular-tags strip, and an Instagram follow CTA in place of a fake newsletter signup.

**Working well:** the loading/error/empty states are genuinely distinguished (`loadError` vs. a real empty array), not collapsed into one generic message — the code comment notes this explicitly: an error shouldn't "masquerade as nothing here yet." Stale-while-revalidate caching means repeat visits paint instantly. The decision to link the "stay in the loop" CTA to a real Instagram account instead of building a fake email-capture form (there's no such backend) is the same honest-restraint pattern seen on Schools and elsewhere.

## Intent-driven affordance audit

### P2 — Every blog card is one giant link with no accessible name of its own
Both `LeadStoryCard` and `BlogCard` render their "read the story →" / "read →" control as a `<span>` styled like a button with `pointerEvents: 'none'` — the actual click target is the entire wrapping `<Link>`/`<a>`, which has no `aria-label`. That's a defensible pattern (the whole card should be clickable, and it is), but it means a screen-reader or keyboard user tabbing through the list hears each link's full concatenated text content — category eyebrow, headline, byline, date, and "read the story" — as one run-on accessible name, once per card, for every card on the page. Consider a concise `aria-label` on the wrapping link (e.g., just the headline) so the announced name is as clean as the visual one.
