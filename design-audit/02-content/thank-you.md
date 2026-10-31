# Thank You — `/thank-you`

**File:** `public/ThankYouPage.tsx` (106 lines).

## What this page is

**Intent:** someone who just submitted Contact or Collaborations wanting confirmation their message actually went somewhere, and something to do next besides closing the tab.

## Current design

A `?from=` param tailors eyebrow/heading/subhead/"what happens next" steps to which form sent the visitor here, with a shared fallback wording that stays true regardless of source. Three closing CTAs (Projects / Opportunities / home) instead of a dead end.

## Assessment

This page has no real faults worth raising. Its own comments explain the reasoning precisely: an inline "sent!" state (which Contact and Collaborations also correctly keep, for staying-in-place convenience) has no URL, so completed submissions were previously uncountable and had nowhere to explain what happens next. Giving the confirmation moment a real, distinct route solves both, and the closing CTAs correctly prevent the page from being a dead end ("closing is the end of the visit," per the comment) — a real, specific design rationale, not a generic best practice applied by rote. The `?from=`-driven copy branching degrades safely (an unrecognized or missing `from` falls back to universally-true wording rather than guessing). No changes recommended.
