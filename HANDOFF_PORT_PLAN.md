# AquaTerra UX/feature port — running plan

Tracks the 2026-09-01 spec: port UX/IA/features/flows from
`Mobile-first redesign changelog-handoff/mobile-first-redesign-changelog/project/`
(handoff files `handoff/00-...` through `handoff/24-...`, `HANDOVER.md`, the
`Flow · *.dc.html` files, the `AquaTerra *.dc.html` files) onto branch
`feature/hr-ops-automation` — **current vercelaq visual system stays, only
UX/behavior/copy structure ports.** Never copy `.dc.html` markup/CSS into a
`.tsx` file.

Non-goals restated per the spec's §8 (holding these for the rest of this
port): no seam-shell/white-card/tan-note/stage/pill depth system anywhere
including the HoD desk; no Instrument Serif italic accents or swapping
display type off NeutralFace; no re-deriving the palette from the handoff
(already shared — verify, don't reapply); no touching `frontend/src/paradox/**`;
no fabricated content where the source has a gap (state the gap instead);
no treating a `.dc.html` file's markup as buildable.

## Build order (per spec §7)

1. **Token softening** — ✅ done. `tokens.css`: `--sh-sm` 2→1.5px, `--sh` 4→3px,
   `--sh-lg` 6→4px, `--sh-xl` 8→5.5px, `--sh-pressed` unchanged, `--bd`/`--bd-hero`
   unchanged. `v6.css`: `.sticker` default tilt -3deg→-1.5deg, nav-link hover icon
   rotation -8deg→-4deg. `body[data-sticker="heavy"]` (-3deg) left as-is — already
   under the new ±4deg ceiling. Radii/palette/type untouched. `tsc -b` clean.
   **Not yet done**: the broader "rotation is scattered, consolidate" instruction
   — this pass only fixed the specifically-named values; a full audit of inline
   `rotate()` in `.tsx` files (feed card tilt, sticker instances, chip hovers)
   is still open, flagged here rather than guessed at.
   **Not yet done**: build + visual spot-check of 4-5 representative screens
   (feed card, modal, desk, button) to confirm "softened" not "flat/broken."
2. Feed + notifications + settings — ⚠️ blocked on one conflict, see below.
3. Search + profile, team detail — not started.
4. Compose sheet + validation — not started.
5. HoD desk behavior — not started.
6. Public pages (simple, then rich) — not started.
7. Classes — not started.
8. Four unfinished areas (flows → auth spine → PM desk → studios) — not started.
9. Content corrections (§5) + global polish leftovers (§7 #9) — not started.

## Resolved

- Feed card scope: user chose to **keep the simplified card** (no draggable
  stat sticker, no comment-bubble cloud, no rotated NEW/HOT stickers, no
  tilt) over the written spec's "port the draggable sticker + comment cloud"
  line. Step 2's Feed portion is therefore done — 3-column layout, poster
  studio entry point, and sentence-boundary title truncation were already
  present and untouched. Moving to notifications + settings.

## Open conflict — needs a call before step 2 proceeds (RESOLVED — see above)

The spec's §3 "Feed" row lists **draggable stat sticker** and **comment
bubbles lazy behind a 300px IntersectionObserver** as things to *port into*
`feed/FeedPostCard.tsx`. Both already existed there, verbatim — and were
just removed in this same session, minutes before this spec arrived, in
response to live screenshot feedback ("remove" pointing directly at the
draggable stat/drag-handle row) and to match the handoff's own `.fcard` mini
spec in `design-reference/AquaTerra - Design Audit & Handoff.dc.html`
(no drag affordance, no comment cloud, no tilt, no rotated stickers).

So: real-time screenshot feedback says remove; this written spec says port
(≈ keep). Asked the user which stands — not resolving this by guessing since
it decides real, already-written code, not a style nit. Also removed in the
same pass, worth confirming while asking: the rotated "NEW/HOT" corner
stickers and the per-card tilt (`ftilt-a`/`ftilt-b`).

## Notes for whoever (Claude or human) picks this up next

- Branch `feature/hr-ops-automation` already carries a prior port pass (5
  commits, see `HR_OPS_AUTOMATION_PLAN.md`) done under the same "functionality
  from the handoff, current visual language" rule this spec restates more
  precisely — this is a continuation, not a fresh start.
- `UI_POLISH_BATCH_2026_09.md` (repo root) tracks a separate, smaller batch of
  live rapid-fire visual feedback (mascot, FAB, post-card spacing) from the
  same session — some items overlap with this plan's Feed row; reconcile
  there once the conflict above is settled.
- Given the size of this spec (9 build-order rows + 4 "unfinished areas," each
  requiring a full read of a long handoff doc before building), expect this
  file to span many sessions/turns. Update the table above after every row,
  not just at the end — that's the whole point of tracking it here.
