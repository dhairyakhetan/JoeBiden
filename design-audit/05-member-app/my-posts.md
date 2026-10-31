# My Posts — `/my-posts`

**File:** `feed/MyPostsPage.tsx` (256 lines, no dedicated CSS).

## What this page is

**Intent:** checking on a post's moderation status, and understanding why one was rejected if it was.

## What's genuinely working

The clickability logic is intent-aware in a way this audit keeps asking for: only `published` posts link out (to their real `/post/:uuid` page), while `pending_review`/`scheduled`/`rejected` posts render as static, non-clickable cards instead of a link to a page that would 404 — the comment states this reasoning directly. A rejected post's `rejection_note` is shown inline, in the moderator's own words, with an ink-on-tomato badge fixed from an earlier white-on-tomato contrast failure (documented in-line).

## Findings

No faults found. Status filters, empty states (a true empty vs. "no posts match this filter"), and the loading skeleton all cover the real states a member actually hits here.
