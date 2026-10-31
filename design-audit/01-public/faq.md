# FAQ — `/faq`

**Files:** `public/FAQPage.tsx`, `FAQPage.css` (4 lines).

## What this page is

**Intent:** two different visitors share this URL — (1) someone evaluating whether to join at all ("is this free," "who can join") and (2) someone already fairly committed, digging into mechanics ("how does leadership work," "what are Welfare Points"). Both currently get the identical flat list.

## Current design

Ten `<details>` accordion items, first one open by default, real `FAQPage` JSON-LD for search snippets, a closing "still have questions? → contact" card.

**Working well:**
- The `+` indicator genuinely rotates 45° to an `×` on open (`details[open] .accq { transform: rotate(45deg) }`) — a small but correctly-implemented affordance; it doesn't just sit there decoratively.
- Answer text is capped at `78ch` even though the card itself is full-width — a specific, documented fix (the comment notes a full-width line would otherwise be unreadable). Good instinct: width and measure are different problems and this treats them as such.
- Uses the same shared `APPROVAL_TIME`/`CONTACT_REPLY_TIME`/`POINTS_SENTENCE` constants as About/Home/Contact — no copy drift.
- Copy tone matches its own promise ("real questions. actual answers. no corporate vagueness.") — the answers are genuinely specific (named departments, named consequences) rather than deflecting.

## Intent-driven affordance audit

### P1 — Ten questions serving two different intents sit in one unsectioned list
A first-time visitor scanning for "is this legit / is this free" has to read past "How does the leadership structure work?" and "What are Welfare Points?" — questions that only matter to someone already inside. There's no grouping to let either audience jump to their half. The page already has a proven pattern for exactly this problem one page over — `About`'s `DynamicIslandTOC` — that FAQ doesn't use despite being an equally good (arguably better) candidate: it's a flat content list with natural section breaks. Splitting into two labeled clusters ("thinking about joining" / "once you're in") would let each visitor's actual question anchor them faster, with or without a TOC component.

### P2 — No visual distinction between "evaluation" and "operational" questions even within the flat list
Related to the above at a smaller scale: nothing (icon, color, order) currently signals which questions are for newcomers vs. members. Even without full sectioning, reordering to front-load the four evaluation questions (join, fee, Community vs Team AQ, what will I do) ahead of the six operational ones would help the first-time-visitor case specifically.
