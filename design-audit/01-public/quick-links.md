# Quick Links — `/links`

**File:** `public/QuickLinksPage.tsx` (408 lines), `QuickLinksPage.css`.

## What this page is

**Intent:** a visitor (or member) who wants the full site map at a glance — either because they arrived from a bio link, or because the nav's own "explore" menu didn't have what they needed (see the Shared Shell audit).

## Current design

A zine-style masthead, four large "ways in" ledger cards (Projects/Paradox/Crftd/ShikshAQ), an expandable 8-department accordion, then a fully grouped link index (Explore / Get involved / Find your way around / Connect), with a soft, auth-aware recruitment nudge only shown to logged-out visitors.

**Working well:**
- The link index is genuinely grouped by user intent ("discover the org, get involved, use the tools, then connect" per the comment) rather than one flat alphabetical pile — exactly the organizing principle this audit keeps asking for elsewhere (see FAQ's flat list, by contrast).
- Suppressing the recruitment nudge for authenticated users (`{!isAuthenticated && ...}`) is a small, correct piece of intent-awareness: a current member doesn't need to be sold on joining.
- Consistent →/↗ internal/external link convention, matching Support and other pages.

## Intent-driven affordance audit

### P0 — The "Crftd" ways-in card doesn't link to Crftd
`BIG_CTAS`'s third card is named "Crftd," tagged "D2C / B2B Merch," described as "Student-designed merch. Every purchase funds our welfare work" — everything about it promises the merch/shop experience — but its `href` is `/support`, not `/crftd`. A visitor clicking the card most associated with buying merchandise lands on the general "support the work" page (join/buy/collab/follow) instead of the actual product page with drops, pricing, and lookbook. This is the most prominent link-mismatch on the site found in this audit: a large, clearly-labeled, high-intent card whose destination doesn't match its own name. Fix the `href` to `/crftd`.

### P2 — The "Paradox" card is a silent handoff into a completely different product
Clicking "PARADOX" leaves the whole neubrutalist AquaTerra shell (nav, footer, tokens) for `/paradox/*`, a self-contained sub-app with its own design language, navigation, and auth (out of this audit's scope, per the framework note, but worth flagging here at the jump-off point). Not a bug, but nothing on the card signals "you're about to leave this site's chrome," the way an external-link card does with its ↗ marker. Consider the same visual cue (or at least consistent copy: "AQ's annual fest, its own site ↗") so the context switch isn't a surprise.
