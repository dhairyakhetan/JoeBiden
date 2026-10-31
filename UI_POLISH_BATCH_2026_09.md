# UI polish batch — Sept 2026

Tracking doc for the rambling multi-ask voice message received 2026-09-01. Per
standing feedback ([[feedback_todo_on_essay_prompts]] in auto-memory): any long
multi-ask message gets a tracked to-do file, updated as items land, not just
chat. User said more items/references are still incoming — keep this file open
and append rather than starting a new one for the next batch.

## Status

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Mascot parks at the bottom-right "Talk to us" chat FAB (`ContactNudge.tsx`), not the compose/join buttons | ✅ done | Also: click/move-to-follow was already the existing idle mechanic (any pointer activity resets the 2.2s idle timer) — no separate build needed there. |
| 2 | Mascot gets a random color (per session) + contextual accessory (book emoji on /projects) | ✅ done (partial) | Color: random from brand palette on mount. Accessory: only `/projects` → 📖 implemented, since that's the only concrete example given. Broader "random accessory" pool elsewhere is a placeholder pending reference. |
| 3 | Simplify the post card design "as for the handoff" | ✅ done | Matched to `design-reference/AquaTerra - Design Audit & Handoff.dc.html`'s `.fcard` mini spec: dropped tilt rotation, rotated NEW/HOT stickers, draggable stat sticker, floating comment-bubble cloud. Added category-colored left accent bar. Kept core actions (like/comment/share/bookmark/poster) in a calmer footer. |
| 4 | "Weird order of the NGO [Aquaterra] logo in the dashboard" | ⏳ blocked on reference | Garbled voice transcription — no "logo" element found in DashboardLayout/AQNav that matches an "order" bug from code inspection alone. Needs a screenshot. |
| 5 | Search under the Projects page is "weird" | ⏳ blocked on reference | Read `PublicProjectsPage.tsx` — search is debounced (250ms) → `searchService.search()`, sits inside a sticky filter bar that auto-collapses on scroll unless focused. Functionally fine; "weird" likely refers to a UX feel (the collapse/expand jump?) that needs a screen recording or more specific description to fix correctly rather than guess. |
| 6 | "The new post thing needs to be synthesized" | ⏳ blocked on reference | `CreatePostModal.tsx` is a large single modal (post/blog/job-opening variants, image pipeline, team tagging). Unclear if "synthesized" means simplify its UI, merge duplicate entry points, or something else — needs the promised reference material. |
| 7 | General "you're not visually doing the design properly" | ongoing | No single fix — addressed via items 1-3 now, will keep iterating as references land. |

## Reference-imitation set (2026-09-01, second wave)

User rejected the Claude Design canvas mockup ("your claude ai artefact was
bad") and switched to: send screenshots of *other* apps, name which real
component each maps to, imitate that screenshot exactly for that component
only — not a wholesale visual-system change. This directly overrides
`CLAUDE.md`'s "current brutalist system, hard ink borders/offset shadows"
rule for whichever specific components get an explicit label below; nothing
else in the app should drift from brutalist just because these exist.

| # | Image | Label given | Status |
|---|---|---|---|
| 1 | Black floating pill, bell icon left (white circle), center nav links (white text), right white pill w/ email | **"desktop nav bar"** — literal target | ✅ done, then refined per follow-up: "instead of black, frosted glass with color chips for active states" — `.aq-nav-inner` is now translucent ink + blur (not flat black), active link/icon-btn/CTA are brand-green chips (not white). Verified live at 1280px. |
| 2 | Black floating pill w/ white rounded active tab (icon+label "Home") + 2 icon-only tabs, separate black circular FAB (hexagon icon) to its right | **"mobile nav bar"** — literal target | ✅ done + same frosted-glass/color-chip refinement applied to both the bottom pill and the mobile top bar. Verified live at mobile width. |
| 1+2 follow-up | "light frosted like before" | reverted the dark-glass tint back to the original light paper-glass material on both bars, top and bottom (desktop + mobile), while keeping the green color-chip active states from the prior round. | ✅ done, verified live on both breakpoints |
| — | "glass effect glitching on below" | Re-checked `.aq-bottom-bar-pill`'s computed styles (backdrop-filter applied, border-radius 999px, no clipping) — nothing wrong found in the current (light-glass) code; likely was the transient dark-glass version mid-edit. **Real bug actually found during this verification pass, unrelated to the glass material**: the mascot's fallback park point (on `/`, where the chat FAB is hidden) was overlapping/obscuring the "Apply →" button text, because the offset math assumed every fallback target reserves left padding for it like `.aq-post-btn` does — the plain Apply pill doesn't. Fixed in `Mascot.tsx`: only `.aq-post-btn` gets the inside-padding offset now; everything else (chat FAB, Apply pill) gets the edge-peek offset. | ✅ fixed, verified live |
| 3 | 3 phone mockups: dark "Today" hero w/ handwritten task list + emoji, colorful photo-cover folder grid ("Saved"), colorful chat-bubble list ("Chats") | "i like the vibes" — **correction (2026-09-01): user says these were exact references, not mood-only.** Page mapping unclear — "Saved" likely `SavedPostsPage.tsx`; "Today"/"Chats" have no obvious 1:1 existing page yet. | ⏸ waiting on the picture that maps images → pages (user's follow-up got cut off mid-send) |
| 4 | IG-Stories-style feed: header w/ heart/send pill badges, circular avatar story row w/ "+" add, full-bleed rounded photo posts, minimal caption, bottom nav w/ center + FAB | "feed design vibes" — **same correction**, likely maps to `HomePage.tsx`/`FeedPostCard.tsx` | ⏸ waiting on the picture |
| 5 | Onboarding flow: progress bar, back arrow, big question ("What's your job?"), torn-paper-note input styled card w/ paperclip + stickers, Continue button, chat-bubble responses | **"signup and onboarding questions"** — literal target | ✅ done, verified live — `RegisterPage.tsx` split into one-question-per-screen (name → class → phone) w/ progress bar, paper-note styled input (CSS paperclip, not emoji, per the emoji-as-chrome rule), rotated sticker per question |
| 6 | Loading splash: sticky-note cards flying in from edges toward center, spinner, handwritten "what's going on?", arrow button | "feed load up animation on home page" — literal target (names the surface: home feed loading state) | ✅ done, verified live (temporarily slowed the sweep to screenshot it, then reverted) — `HomeIntro.tsx`/`HomeIntro.css`: 4 peek cards (avatar/post/stat previews) fly in and settle near the corners rather than over the wordmark; skip button restyled as a round arrow button. Hidden ≤640px to avoid clutter. |

| 7 | Pinterest link `in.pinterest.com/pin/874965033867864521` | "everythignw e do at aq page design" — literal target (`/projects`'s "everything we do" intro, or a standalone About-style section) | **could not fetch** — Pinterest pin pages need JS rendering my WebFetch can't do; came back empty. Need a screenshot instead of the link. |
| 8 | Scrapbook diary collage: cream grid paper, torn-paper edges, washi tape, handwritten annotations, taped Polaroid-style screenshots, starburst stamp logo, ripped-paper "POP UP Print Fair." ticket | **"about aq page"** — literal target | queued, not started — maps to the About page |

| 9 | 3 images: "Atlantis" dark social app (story-circle row, full-bleed photo posts, floating pill toolbar); farm-collective collage (rounded photo cards linked by pin/speech-bubble labels, script handwriting, joined circular avatar pair); "Umi" pastel wellness landing (bold headline w/ highlighter-yellow accent, hand-drawn doodles, soft rounded cards) | "social media qith aq at centre vibes" — mood only, no component named | not started, no action pending |

Working order given the volume: finish #1 and #2 (already underway, fully
specified) → #5 (also explicit, needs `RegisterPage.tsx` read) → #6 (loading
state, needs to find where the feed's initial-load skeleton lives) → #8
(About page). #3 and #4 stay as mood references only, applied loosely if/when
a relevant component comes up — not built standalone. #7 blocked until a
screenshot replaces the dead Pinterest link.

## How to resume

If this file exists at the start of a session, read it first — it's the live
queue for this batch. Items 4-6 are explicitly waiting on the user's promised
reference material ("I'm gonna throw references at you"), not on further
guessing from code alone.
