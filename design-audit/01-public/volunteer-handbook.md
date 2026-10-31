# Volunteer Handbook — `/volunteer`

**File:** `public/VolunteerHandbookPage.tsx` (308 lines).

## What this page is

**Intent:** a prospective or brand-new volunteer wanting the operational detail a marketing page won't give them — how drives actually work, what the WhatsApp-community structure is, and whether the time commitment fits their life.

## Current design

Hero → impact stats → "how volunteering works" (4 steps) → "three communities" (WhatsApp structure) → "grow with us" (team inductions + adjacent startups) → an 8-question FAQ accordion (own rotating-icon implementation, not shared with `/faq`) → closing CTA → a quiet link to `/members`.

**Working well:** this is the most operationally specific page in the public site — real detail (drive-poll-vote-brief mechanics, three named WhatsApp tiers, an honest time-commitment range with a caveat about school/exams) instead of the vaguer marketing register About/Home use. That specificity is exactly what a "handbook" should deliver and most of the sibling pages don't attempt.

## Intent-driven affordance audit

### P1 — This page's FAQ and `/faq`'s FAQ are two independently hand-written answers to several of the same questions
Both pages ask "is there a fee" and "how does approval work" (among others), but as two separate hardcoded arrays (`FAQS` here, `QS` on `FAQPage.tsx`) with different wording each time. They don't currently contradict each other (both correctly say free, both correctly cite the same `APPROVAL_TIME`), but that's partly luck of using the shared constant for the one figure that already caused a real, documented drift bug (`orgFacts.ts`'s own comment describes founding-year and approval-time claims disagreeing across pages before being centralized). The fee wording, the time-commitment wording, and the "what do I get out of it" wording here are NOT centralized the same way — if either page's copy changes independently, the two FAQ sets can drift exactly the way the facts already did once. This is the same failure shape as the two independent `FeedPostCard` implementations flagged on Home: two hand-maintained copies of the same thing, one less likely to be remembered when the other gets edited. Consolidate to one FAQ dataset (perhaps with a `context: 'faq' | 'handbook'` filter if the two pages genuinely want different subsets) or explicitly cross-link ("full FAQ →") instead of duplicating.

### P2 — "Team inductions" names an intent it doesn't link to
The card says "Recruitment for select teams stays open 24/7" but never says which teams, and doesn't link to `/opportunities` — the page that answers exactly that question with real, current listings. A reader who just formed the intent "which roles are open right now" has to independently remember or find that page; a direct link here would close the loop at the moment the intent is created.
