# 19 · Guided demos

**Status:** a NEW system. **No table, no Supabase change** — that is the point of it.
**Files touched:** new `frontend/src/demo/` (provider, coach-mark overlay, fixtures, flow scripts),
`frontend/src/App.tsx` (one route branch), `frontend/src/context/` (the auth context it shadows).
**Design source:** `AquaTerra Feed.dc.html` — `21a` (phone: launcher, mid-flow, end), `21b` (desktop).
**Prerequisites:** every other file. **This is the last thing built** — it demos the redesigned UI,
so it cannot be built against the old one.

## Global invariants

1–9 as in `changelog/README.md`. **Invariant 5 is honoured absolutely here: a demo performs zero
writes.**

## 19.0 · The decisions

| question | answer |
|---|---|
| **who is it for** | **prospective members** — "show them what being in AquaTerra feels like" |
| **how does it work** | **coach marks on the real UI** — spotlight the next control, the user clicks it |
| **does it write** | **no. Fake data in a sandbox. Nothing touches Supabase, nothing persists** |
| **which flows** | eleven (19.4) |

## 19.1 · THE ARCHITECTURAL CRUX — read this first

**A prospective member is not logged in.**

Every screen worth demoing is behind a route guard and reads `member` from an auth context. The
feed, the composer, a profile, the desk — none of them render for an anonymous visitor. So a
sandbox that only fakes *data* is not enough: **it has to fabricate a session** before a single
real screen will mount.

```
/demo/:flowId
  └── <DemoProvider>                 ← active ONLY on a /demo/* route
        ├── shadows the auth context  → a fake approved member, fake role, fake uuid
        ├── shadows the service layer → every read resolves from fixtures
        ├── every WRITE resolves optimistically and is DISCARDED
        └── renders the real app tree, unmodified
```

### This is also the entire safety story

**A demo session has no Supabase token.** So even if a service call escaped the shadow, it would
fail auth rather than write junk. **The absence of credentials is a stronger guarantee than any
interception layer**, and it is why "fake data in a sandbox" was the right call over "real writes
into a demo account".

**Three rules that make this safe rather than merely intended:**

1. **`DemoProvider` mounts only on `/demo/*`.** Never conditionally inside the real app, never
   behind a feature flag that could be flipped in production. **One route branch, one provider.**
2. **The provider never calls `supabase.auth`.** It supplies a plain object shaped like a member.
   **If any code path requires a real token to render, that screen is not demoable** — report it
   rather than working around it.
3. **Writes resolve, they do not queue.** A write returns a success shape immediately and mutates
   only in-memory fixture state. **There is no retry, no offline queue, no persistence.** On exit
   the state is garbage-collected.

### What this means for the service layer

Every service the demoed flows touch needs **one injection point**. If services import the
Supabase client directly at module scope, **they cannot be shadowed** and this system cannot be
built without refactoring them.

**Read `services/` before starting and report which services are directly coupled.** This is the
single biggest unknown in this file, and it may turn a two-week job into a four-week one.

## 19.2 · The coach-mark mechanic

### The spotlight is one box-shadow

```css
.demo-spotlit {
  position: relative;
  z-index: 2;
  box-shadow:
    0 0 0 4px rgba(255,199,0,.55),        /* the lemon ring */
    0 0 0 9999px rgba(10,10,10,.42);      /* the dim, as the same property */
}
```

**The dim and the cutout are the same property on the same node.** No canvas, no `clip-path`, no
second overlay element to keep in position.

**Three consequences that make this the right technique:**
- **The highlighted control stays fully interactive** — nothing sits on top of it.
- **It follows the element automatically.** Reflow, scroll, keyboard appearing — the ring moves
  with its own node. An absolutely-positioned overlay would need constant re-measurement, which is
  the defect class this redesign has hit four times.
- **It respects `border-radius`**, unlike an `outline` (`00.15`).

**The spotlit element must not be `overflow: hidden`'s child** at a level that clips a 9999px
shadow. **If the dim does not reach the viewport edges, an ancestor is clipping it** — spotlight
a higher node instead.

### The coach card

- **Phone: a bottom sheet.** `32px 32px 0 0`, pinned to the bottom, reusing `03.2.1`'s shell.
  **Not a floating tooltip near the control** — on a phone that space is taken by the thumb, and
  by the keyboard whenever the step involves typing.
- **Desktop: a floating ink card** in the right column, below the spotlit element.
- **Contents:** a segmented progress bar (one segment per step), `{n} / {total}` in mono,
  a `900 20-21px` instruction, one sentence of explanation, then `Back` and `Do it for me`.
- **The card is `z-index: 3`** — above the spotlight's dim, which is `2`.

### "Do it for me" is the accessibility route, not a convenience

**A step that requires typing into a spotlit field cannot be completed by someone using a screen
reader or switch control without a way to advance.** So every step has a programmatic completion.

It also means **the demo can never trap you on a step** — if you cannot find the control, cannot
perform the gesture, or the spotlight has drifted, there is always a way forward.

- **It performs the real interaction**, not a skip: it fills the field, clicks the button, and lets
  the app respond. The user sees the same result either way.
- **The sub-line `or tap the arrow yourself`** tells you the manual route exists. **Keep both
  routes on every step.**

### The persistent ribbon

A lemon band, always visible, never dismissible while a demo is active:
`demo · you are looking at made-up people · nothing is saved` plus the flow name, the step
count, and `Leave the demo`.

**This is non-negotiable and it is an honesty requirement, not a design flourish.** The demo shows
the real interface with fabricated people. A visitor must never be able to mistake a fixture for a
real member — and a screenshot of a demo must be self-evidently a demo.

- **Lemon at 15.1:1 with ink text.**
- **`role="status"`** so it is announced on entry.
- **`Leave the demo` returns to the marketing home**, not to a dead end and not to a login wall.

## 19.3 · The launcher — `/demo`

- **An ink card** with a mono kicker (`★ a walkthrough · nothing is saved`), a display headline
  with the serif close, and one paragraph setting the contract.
- **Then the flow list**: each row a `var(--nav-well)` radius-22 link, 44px minimum, with a hue
  disc, the flow name, and `{n} steps · about {duration}`.
- **Three shown, the rest behind `all 11 walkthroughs`.** Eleven rows on a phone is a list; three
  is an invitation.
- **The duration estimate must be honest.** Overstating it loses people at the door; understating
  it loses them mid-flow.

## 19.4 · The eleven flows

| flow | steps | audience note |
|---|---|---|
| **Post something to the feed** | 4 | the core loop, and the best opener |
| **Apply for a role** | 5 | the flow that converts |
| **Sign up for a drive** | 3 | the shortest, good for impatience |
| **Search and discovery** | 3 | shows scale — 2,031 write-ups |
| **Leave a note on someone's wall** | 3 | shows the social side |
| **Request a certificate** | 4 | the parent-facing outcome |
| **Generate a CV** | 3 | the outcome a 17-year-old actually wants |
| **Take a break and come back** | 3 | shows the org is not extractive |
| **A HoD approves an account** | 4 | shows there is real responsibility on offer |
| **A HoD moderates a post** | 4 | same |
| **A HoD posts an opening** | 4 | same |

**The three HoD flows demo a role the visitor does not have.** The ribbon must say so — something
like `you are a HoD in this walkthrough` — because otherwise a prospective member concludes they
can approve accounts on day one. **The provider swaps the fake member's role for those flows and
the ribbon states it.**

## 19.5 · Fixtures

- **One fixture file per flow**, containing only what that flow needs.
- **The people are obviously fictional but not silly.** Fictional names, no real member's photo.
  **Use the repo's 6 photos for drive imagery** — those are real AquaTerra work and it is the org's
  own material.
- **The numbers in fixtures must not contradict the real site.** If a fixture shows a drive with
  60 children, that is fine. **But no fixture may state a blocked stat** (`09.0`) — a demo is a
  public surface and the accuracy rule applies.
- **No fixture may depict a real member's profile.** The wall flow in particular writes a note to
  someone — that someone is fictional.

## States

- **Launcher:** the flow list.
- **Mid-flow:** ribbon + spotlight + coach card.
- **Step completed manually:** advance immediately, no confirmation.
- **Step completed via "Do it for me":** same, and the app's own success state fires.
- **Flow completed:** the welfare end card — `★ that's the whole loop`, what you just did in
  display type, one paragraph, then **`Join AquaTerra`** primary plus `Try another` and
  `Just browse`.
  **The two secondary pills take `var(--paper)` text on `rgba(10,10,10,.34)`, not ink on
  `rgba(10,10,10,.1)`.** A translucent dark overlay on an already-dark accent composites to
  `#197d52`, and ink on that measures **3.87:1**. This is the "overlay counts as lightening the
  fill" case in `README.md` invariant 7.
- **Left mid-flow:** back to the marketing home. **No "are you sure"** — nothing is lost.
- **A spotlit element disappears** (a re-render, a data change): **advance or abort with a clear
  message.** Never leave a spotlight on nothing. **This is the most likely runtime failure.**
- **Reduced motion:** no spotlight pulse, no sheet slide. The ring and dim appear instantly.
- **A real logged-in member visits `/demo`:** **let them.** It is useful for a HoD learning the
  desk. But **the provider still shadows their session** — a demo must never write with a real
  member's credentials.

## Verification

1. **Zero network writes during every flow.** Watch the network tab across all eleven.
2. **`DemoProvider` cannot mount outside `/demo/*`.** Verify by grep, not by testing.
3. **No Supabase token exists in a demo session.**
4. The ribbon is visible on every step of every flow and is not dismissible.
5. Every step is completable **both** manually and via "Do it for me".
6. **Keyboard-only completion of all eleven flows.**
7. The dim reaches all four viewport edges on every step (no clipping ancestor).
8. `Leave the demo` reaches the marketing home from every step.
9. The three HoD flows state the borrowed role in the ribbon.
10. No fixture contains a blocked stat or a real member's identity.
11. Reduced motion: instant ring, no pulse, no slide.
12. Zero horizontal overflow at 375px and 360px, ribbon included.

## A note on strings

**All approved (bulk).** `★ a walkthrough · nothing is saved` · `see what it's like from inside.` ·
`You'll use the real thing, with made-up people. Click where we point. Nothing you do here is
saved, and you can leave at any point.` · `all 11 walkthroughs` ·
`demo · nothing is saved` · `demo · you are looking at made-up people · nothing is saved` ·
`Leave` / `Leave the demo` · `Now send it.` ·
`A HoD from your team sees it in their queue before it reaches the feed — usually within a day.` ·
`Back` · `Do it for me` · `or tap the arrow yourself` · `★ that's the whole loop` ·
`you just posted a drive recap.` ·
`That's it — write it, a HoD checks it, it goes up, your hours get logged against your name. Free,
always.` · `Join AquaTerra` · `Try another` · `Just browse` · every flow name and duration.

**`Join AquaTerra` is from `BRAND_VOICE.md` §6's approved CTA set.** Do not escalate it.
**The end card's claim that hours get logged is true** (`04.1`) — but **do not add a number**;
the drives figure is blocked.

## Unresolved

1. **Are the services shadowable?** `19.1` — if they import the Supabase client at module scope,
   **this system needs a service-injection refactor first.** Read `services/` and report. **This is
   the one unknown that could change the size of this job by 2×.**
2. **Does any demoable screen require a real token to render** (a storage signed URL, an RLS-backed
   read that cannot be faked)? Those screens are not demoable.
3. **Route guards.** Do they read the auth context, or call `supabase.auth.getSession()` directly?
   The latter cannot be shadowed.
4. **Image URLs in fixtures** — the repo's 6 photos are bundled assets, so fine. But if a fixture
   needs a Supabase storage URL, that is a real fetch. Keep fixtures to bundled assets.
5. **Is `/demo` indexed?** It should be **`noindex`** — a search result landing on a fabricated
   feed is worse than no result. Add it to `metaConfig`.
6. **Analytics.** Worth knowing which flows get finished and where people drop. **Nothing exists
   today**, so this is a new dependency — flag it rather than adding one.
