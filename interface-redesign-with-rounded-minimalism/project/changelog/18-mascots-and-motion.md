# 18 · Mascots and motion

**Files touched:** `frontend/src/components/AQMascot.tsx`, a new `components/Companion.tsx`,
`frontend/src/feed/` (the load animation), `frontend/src/styles/v6.css`.
**Design source:** turn 12 (the footer wall), and the motion floors in `MASTER-PLAN.md` Part 8.
**Prerequisites:** `00`, `13`, `14`.

## Global invariants

1–9, **plus the four motion floors**, which are invariant on every animated thing in this file:

1. **`prefers-reduced-motion: reduce` kills everything ambient.** Not reduces — removes.
2. **Nothing above the fold animates before its content is readable.**
3. **Ambient motion pauses when the tab is hidden** (`visibilitychange`) and when scrolled out of
   view (`IntersectionObserver`).
4. **Nothing blocks a tap for longer than 300ms.** Every animation is interruptible.

## 18.0 · The mascots are existing assets

`AQMascot.tsx` already defines **nolen, tuk and bhoot**. **Do not draw a new character and do not
commission art.** Read the component first and report what poses each one actually has — this file
assumes at minimum an idle and one reaction per character.

**Decided:** all three roam, each on different surfaces.

| surface | mascot | why |
|---|---|---|
| home / feed | **nolen** | the one a member sees daily; the most familiar |
| About | **tuk** | a page about the org gets the org's second face |
| onboarding slides | **nolen** | continuity into the feed |
| auth pages | **bhoot** | pairs with the randomised art panel (`07`) |
| empty states | whichever suits the surface | one mascot per empty state, never two |
| 404 / error | **bhoot** | the odd one out belongs on the odd page |
| footer wall | all three, as die-cuts | they are draggable objects there, not a companion |
| profile wall | **tuk**, on the empty state only | |

**One mascot on screen at a time**, except the footer wall where they are stickers rather than
characters.

## 18.1 · The companion — roaming and the bone

**Decided: keep the full mechanic.** Swipe the bone off the kernel and the mascot follows your
cursor for the rest of the session.

### Roaming

- **The companion is `position: fixed` bottom-right** — the slot vacated by `.aq-contact-nudge`,
  which `14` retires. **That deletion is a prerequisite**, not a nicety: two fixed objects in one
  corner is the defect the audit already recorded.
- **Idle by default.** It moves **at most once every 45 seconds**, travels a short distance along
  the bottom edge, and returns to idle. **It never crosses the viewport** and never enters the
  centre.
- **It is `pointer-events: none` except on the mascot itself**, so it can never block a tap on
  content behind it. **This is floor 4 in physical form.**
- **`aria-hidden="true"`.** It is decoration and it must be invisible to assistive tech.
- **z-index: below every dialog, sheet, toast and the nav.** Check `Z-INDEX-MAP.md` and take the
  layer the nudge freed rather than inventing one.

### The bone

- **A bone-shaped die-cut sits beside the companion** with the arc-set `· DRAG ME · DRAG ME ·`
  seal from `13.6` on first sight only.
- **Swipe or drag it off** → the companion enters **follow mode** for the session.
- **Follow mode:** the mascot eases toward the cursor with a long delay (~600ms) and a large
  dead-zone, so it trails rather than tracks. **On touch it follows the last tap position, not the
  finger** — tracking a finger during a scroll is the interaction conflict that makes this feel
  broken on mobile.
- **Session-scoped**, in `sessionStorage` under `aq_companion_follow`. **Never `localStorage`** —
  a permanently following mascot is a permanent distraction, and the charm is that you chose it
  today.
- **An always-available dismiss.** A small × on the companion, and **once dismissed it stays
  dismissed for the session.** Store that too.
- **Follow mode is desktop-and-touch, but the DRAG is desktop-only** below 760px the bone becomes
  a **tap** target. A drag inside a scrolling page fights the scroll (same finding as `14`).
- **`prefers-reduced-motion`: no roaming, no following, no bone.** The mascot renders idle and
  static. **The feature is entirely absent, not slowed down.**

## 18.2 · The burst-and-settle load animation

**Decided: first visit of a session only, then instant.**

That is the right call and worth writing down why: the animation is a first-impression device, and
a member checking a comment for the fortieth time this week is not having a first impression. A
`sessionStorage` flag makes it delightful once and free thereafter.

### The mechanic

- Chips, cards and avatar pills **start scattered above the fold at varied rotations and
  translations**, then **settle into the feed's real layout** with a staggered ease.
- **They settle into their real positions — the animation does not lay the page out.** The DOM is
  final from the first frame; only `transform` and `opacity` animate. **Nothing reflows**, so
  there is no layout thrash and no CLS.
- **Stagger by ~40ms, cap the total at ~900ms.** Longer and it stops being an entrance.
- **One hue per pill**, from the palette, ink text (`13.5`).

### The floors, applied

- **Floor 2 is the hard one here.** The feed's text must be readable before anything moves. So:
  **the animation runs on `transform` from a settled DOM**, and the first card's text is at full
  opacity from frame one. **Do not fade text in.** A member who lands and reads immediately gets a
  page that is already legible while decoration settles around it.
- **Floor 4:** a tap during the animation **completes it instantly** and performs the tap.
  Implement as a `pointerdown` listener that jumps every element to its end state.
- **`prefers-reduced-motion`: skip straight to settled.** No burst, no stagger, no fade.
- **`sessionStorage` key `aq_burst_seen`.** Set it *before* the animation starts, not after — a
  member who navigates away mid-animation should not see it again.

### What not to animate

- **Not the nav, not the bottom nav, not the composer row.** Chrome should be there instantly.
- **Not anything below the fold.** It has not been seen; there is nothing to reveal.
- **Not the skeletons.** If content is still loading, the skeleton is the state — do not burst a
  skeleton and then swap it.

## 18.3 · The performance budget

`docs/PERFORMANCE_AUDIT.md` earmarks `v6.css` 530–766 for a lazy `footer.css`. **The companion and
the burst belong to the same discipline:**

- **The companion is a small component and may live in the main bundle**, but its motion loop must
  not start until first idle (`requestIdleCallback`, fallback `setTimeout`).
- **The burst is feed-route-only** and must not ship to any other route.
- **One shared `requestAnimationFrame` loop** for the companion, the footer wall and the burst.
  **Three independent rAF loops on a cheap Android is exactly the cost the user accepted "going
  big" for — spending it on redundant loops rather than on the effects is waste.**
- **No animation library.** `14` already forbids importing framer-motion for the footer because it
  would re-pin the 44.4 KB the audit is trying to unpin. **Same rule here.**

## States

- **Companion, first sight:** bone visible with the seal.
- **Companion, bone taken:** follow mode, no bone, × available.
- **Companion, dismissed:** absent for the session.
- **Companion, reduced motion:** idle, static, no bone.
- **Burst, first visit:** runs.
- **Burst, subsequent:** absent — page renders settled.
- **Burst, reduced motion:** absent.
- **Burst interrupted:** completes instantly, tap lands.

## Verification

1. `prefers-reduced-motion`: **no roaming, no bone, no burst.** Verify all three separately.
2. The companion is `aria-hidden` and `pointer-events: none` except its own body.
3. **A tap during the burst lands on the intended element.** Test on the first card's like button.
4. `aq_burst_seen` is set before the animation, and a reload within the session skips it.
5. **Zero layout shift during the burst** — measure CLS, it must be 0.
6. The companion never overlaps a dialog, sheet, toast or the nav.
7. `.aq-contact-nudge` is deleted (`14`) before the companion ships.
8. One rAF loop, paused on `visibilitychange` and when out of view.
9. No new dependency.

## Unresolved

1. ~~What poses exist?~~ **RESOLVED: assume one idle each.** See 18.0 for the transform vocabulary.
   **Confirm the sprite is a single element that can take a transform** — if it is a sprite sheet
   with hard-coded frame offsets, `scaleX(-1)` may flip the wrong thing.
2. **Is there an existing rAF loop** anywhere to share, or does 18.3 create the first one?
3. **Does the feed route already have a session flag** for anything? If so, the burst should reuse
   that mechanism rather than adding a second.
