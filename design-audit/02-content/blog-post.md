# Blog Post — `/blog/:slug`

**File:** `public/BlogPostPage.tsx` (386 lines), reuses `feed/PostPage.css`.

## What this page is

**Intent:** a reader who clicked through from the blog list (or a shared link) wanting to actually read the story.

## Current design

Shares layout classes with the main `PostPage` (a deliberate choice, explained in a comment: "a blog IS a post here... sharing the stylesheet is what keeps the two in step; a visual copy would drift the first time either is touched" — the right instinct, and one this audit wishes more of the codebase followed, given the two independent `FeedPostCard` copies flagged on Home). Body content renders through a genuinely careful paragraph-classification pass — heading/blockquote detection, and a heuristic that tells hard-wrapped prose (collapse the line breaks) apart from deliberate verse (keep them), based on median line length. A leadership-only "generate a graphic" action sits in the side rail; a real "more from AquaTerra" rail follows.

**Working well:** the verse-vs-prose heuristic and its documented edge case (an opening dash mis-rendering as a giant floating drop-cap hyphen, since fixed by checking the first character is actually a letter) is some of the most thoughtful text-handling logic in the codebase. The meta-description trimmer breaks on a whole word, not mid-word, matching the same care seen in the feed card's headline split.

## Intent-driven affordance audit

### P1 — The one thing every entry point promises ("read the story") is not actually deliverable on-site for any post today
The comment directly above the empty-body fallback states it plainly: *"Every blog post today has an empty `body`."* That means every single post currently routes every reader to the fallback card — "this story lives on AquaTerra's Instagram, the full write-up hasn't made it to the blog yet" — regardless of how the reader arrived (the blog list's prominent "read the story →" button, a shared link, search). The fallback itself is honestly worded and well-designed (a real bordered card, not a lonely floating sentence, per its own comment), so this isn't a broken *page* — but it does mean the on-site reading experience this page and `/blog`'s whole presentation promise doesn't exist yet in practice; the actual delivered intent is "here's an Instagram link." Worth flagging to whoever owns blog content: the reader-facing gap is between "blog exists and looks complete" and "blog posts currently have no body text," not between two pieces of code.

### P2 — The careful paragraph-rendering logic is currently exercised by zero live posts
A direct consequence of the above: the heading/blockquote/verse-detection/drop-cap system only runs once real body text exists. That's not wrong to have built ahead of content, but it means any regression in it (the codebase has already found and fixed one such edge case) would currently ship silently and go unnoticed until the first real post with a body is published and someone happens to check it closely.
