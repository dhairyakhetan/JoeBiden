# Redesign artifact queue — reference-driven, one section at a time

Process: user sends a screenshot + names the target section. Each gets a real
redesign via `/design` (canvas mockup) + `tastemaker` (grounded in the
reference's actual pixels/vibe), built for **mobile and desktop**, published
as an Artifact, iterated until approved. This file tracks status so nothing
drops across a long session.

Status legend: 🟡 queued · 🔵 in progress · 🟢 approved · ⚪ shipped to code

## Queue

| # | Section | Reference | Status |
|---|---|---|---|
| 1 | Auth / login page, full redesign "from 0" | Painterly pointillist split-screen login (illustrated garden + clean white card) + stamp-card feature tiles + ukiyo-e garden hero. Brief: use AquaTerra's own mascots, real brand color, rotating text (already exists in `authCopy.ts`/`authHero.ts`), keep the real 1-2-3 steps, but disregard the current login page's layout entirely | ⚪ Shipped to code — commit `3532e58` (section 51). Artifact: https://claude.ai/code/artifact/386aecd8-2e35-409d-9761-03d402a6dd2d |
| 2 | Home page — personalized greeting card | "Hello 👋 Daniel, your overall score is above average" stat card, re-attached 2026-09-09 — soft mint card, small waving-hand emoji + name in a script/serif accent, "above average" as bold inline text, small growth/best-result stat chips below | 🟢 Artifact published, awaiting approval — https://claude.ai/code/artifact/1e94ed5c-4a3c-4602-a644-e32bb25d1a21 (finding: block already implements most of the reference from a 2026-09-07 pass predating this session; only the mono tag row was actually missing — see the artifact's own annotations) |
| 3 | Home feed — card variety / "smart grid" | Food-delivery bento app (Restaurants/menu UI), re-attached 2026-09-09 — rounded soft-color cards at varied sizes: wide balance/bonus tile, square dish photo tiles, list-row category tiles, small pill tags ("HIT"/"NEW"), nutrition-table card. The pattern to take is the tile-size/shape variety + soft pastel card backgrounds, not literal restaurant content | 🟢 Artifact published, awaiting approval — https://claude.ai/code/artifact/999bbe64-9c5d-469f-ad6b-057f39cce487 (built from the real 30-shape catalogue in `lib/feedShape.ts`; only 4 of 30 shapes are actually wired to live feed data today — see the artifact's annotation) |
| 4 | Search page — discover rows | Pinterest "Discover ideas", re-attached 2026-09-09 — big rounded search bar with camera icon, "Ideas for you" small label + bold headline per section, overlapping-photo hero carousel, labeled horizontal image-tile rows below | ⚪ Shipped to code — commit `5007cef` (section 53). Artifact: https://claude.ai/code/artifact/dac98ef2-9dd5-4302-bda2-5bd6aee86456 |
| 5 | Profile — "your posts and activity" | Scattered/tilted photo collection ("Your collection", 45 images) | 🟡 queued — first pass (a real tilted photo strip) shipped; flag for re-review once the design-skill workflow is established, in case it needs the same treatment |
| 6 | Site footer — full redesign | Sand Studio & Co bento footer + "For Purpose Co" dark stacked-sticker footer + "welcome friend" letter note (re-signed as AquaTerra's own team) + "neutral face font in footer links" | 🟢 Artifact published, awaiting approval — https://claude.ai/code/artifact/cee8012b-852d-4550-b838-9aec6030587e (finding: hi-bubbles/bento/manifesto/close-bar structure + strict motion constraints already existed from an earlier "make it more colorful and lively" note; this pass amplifies color, retypes links, and adds a new closing-letter section) |
| 7 | First-login welcome popup modal | Pen-pal app envelope/letter reference | ⚪ Shipped to code — commit `85df35e` (section 52). Artifact: https://claude.ai/code/artifact/56129c79-5059-430d-bd5b-e674a6d118c2 |

## Status: 3 of 7 shipped to code (auth, search discover rows, welcome modal). Remaining 4 (greeting, feed smart-grid, profile, footer) have published Artifacts awaiting approval before their own code pass.

## Notes

- Items 2-5 already got a first pass earlier in this session via direct code
  edits, not the design-canvas process — all were called out as inadequate
  (patched an existing system instead of building to the reference). They
  stay in the queue for a real redesign pass rather than assumed done.
- New screenshots the user sends get appended here with their section
  mapping before any design work starts on them.
