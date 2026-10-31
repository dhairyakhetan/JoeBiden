# HoD Desk — Approvals, Post Moderation, Achievement Reviews

**Files:** `director/AccountApprovals.tsx` (465 lines), `director/PostModeration.tsx` (453 lines), `director/AchievementReviews.tsx` (294 lines) — the desk's three moderation queues, all built on the shared `adminKit` primitives (`AdminRow`, `useRowSelection`, `useUndoableAction`, `BulkActionBar`, `useModalA11y`).

## What these desks are

**Intent:** a director/HoD clearing a queue — approving or rejecting member sign-ups, posts, or achievement claims — as fast as is safe, without losing track of how many are actually left.

## What's genuinely working — this is the strongest engineering cluster in the audit

All three desks independently fixed the *same* defect class and say so in near-identical comments: the queue header used to count one fetched page (20 rows) and present it as the size of the whole queue, disagreeing with the sidebar badge next to it — so a director could clear a visible page believing they were done while more sat on page two. All three now carry a real `totalPending`/`totalItems` count reconciled against the sidebar.

Approve is optimistic with a 5-second undo window everywhere (network call only fires once the window closes, so undo is a pure cancel, never a server-side unwind) — a genuinely good pattern for a low-risk, reversible-feeling action repeated dozens of times a session.

Two details rise above "solid" into "exemplary anti-slop engineering," worth naming directly:
- **PostModeration's stats-verification line.** When a pending post carries member-entered numbers (the same value/label pairs the feed card renders as pills), the expanded row says outright: *"these numbers enter the org's totals."* When there are none, it says *"no numbers given — ask before approving."* This is the single best-targeted defense against fabricated statistics anywhere in this codebase — it puts the exact consequence of the approve click in front of the human who's about to make a number real.
- **PostModeration's "ask…" verdict.** A director reviewing a post isn't limited to a binary approve/reject — "ask" sends the author a real in-app notification requesting more detail while the post stays in the queue, untouched. Most moderation UIs force a premature decision; this one correctly recognizes "I need more information" as its own real outcome.

## Findings

### P1 — The three sibling "reject" flows apply three different amounts of friction and requirement to a structurally identical action
All three desks' reject action does the same thing — remove from queue, notify the person, optionally with a written reason — but each implements the safety rail differently:
- **AccountApprovals** requires the note (`disabled` until typed) *and* gates the final action behind a `HoldToConfirmButton` (a 1200ms hold, not a click) — the most protected of the three.
- **PostModeration** requires the note but confirms with a normal click.
- **AchievementReviews** doesn't require a note at all — the confirm button is only disabled while the request is in flight, so an achievement can be rejected with zero explanation, the one queue where a misclick costs the least to correct but also the one most likely to leave the person genuinely confused about why.

There's no stated reason rejecting a membership application should be harder to do by accident than rejecting a post, and no reason achievement rejections alone should be allowed with no explanation when the other two both correctly insist on one ("be specific — the applicant/author will see this"). Pick one bar for "destructive, notifies someone, wants a reason" and apply it to all three — most likely: require the note everywhere (cheap, and the UI copy already assumes it will be read), and either extend hold-to-confirm to all three or drop it from Approvals if a typed note is judged sufficient friction on its own.
