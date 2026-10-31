# TerraThon 2026: what is done, and what is left

Updated Sun 21 Sep 2026. Branch `terrathon-2026`, last commit `206a565`.
Gate as of 20 Sep: lint PASS, **801 tests in 36 files**, nine-step build
clean, 650.9KB of a 683.6KB budget, 31 static + 610 dynamic prerendered routes.

**To review it before it goes anywhere live:**

```bash
git fetch origin && git switch terrathon-2026 && cd frontend && npm install && npm run dev
```

Then `/terrathon`. `/dev/terrathon` mounts every surface, including the admin
desk, against fixtures with the network off, so it needs no credentials.

This file tracks the 20 Sep desktop and phone feedback through to done. It is
the to-do list; `TERRATHON_PRD_V1.1_DELTAS.md` is the spec record.

---

## The 21 Sep audit

Seven readers went through the section in parallel, one per dimension: empty
and error states, the data layer, accessibility, content truth, the register
form, runtime lifecycle, and the integration surface outside `src/terrathon/`.
All read-only, so nothing raced on a shared working tree.

Everything below was re-checked before it was written down. Two claims did not
survive that check and are recorded at the bottom rather than deleted, because
a plausible finding that turns out to be wrong is worth remembering.

### Fixed on 21 Sep

**Database.**

* `terrathon_register` had a ceiling on date of birth and no floor, while
  `terrathon_registrations` carries `CHECK (age between 5 and 99)`. A date of
  birth inside the last five years passed every check the function made,
  reached the INSERT and raised an uncaught `23514` out of a SECURITY DEFINER
  function. Measured, in a rolled-back transaction, with dob `2023-06-01`.
  The browser cannot tell that from the network dying, so the form said
  "Couldn't reach the server. Your details are saved, so just try again." and
  retrying resubmitted the same date forever, on a date the form had already
  painted **green**. Now returns `TOO_YOUNG`. The floor is 5, matching the
  constraint exactly, so nothing that used to be accepted now is not.
  Verified after: `2005-01-01` still eligible, `2004-12-31` still `TOO_OLD`.
* `hold_hours` was NULL on all three events, which made the whole unpaid-hold
  expiry mechanism inert: an unpaid registration held a slot permanently. Set
  to 24. **Only affects registrations made from now on**, because
  `hold_expires_at` is stamped at insert time.
* The entire backend was undocumented. 5 tables, 1 view, 7 functions, 2
  triggers, 15 indexes, 5 RLS policies, and not one of the repo's 155 `.sql`
  files mentioned TerraThon. Transcribed from live into
  `frontend/scripts/terrathon_schema_2026_09_21.sql` (commit `7634aaa`).
* RLS proven rather than assumed: dropping to the `authenticated` role inside
  a rolled-back transaction returns **0** registrations, **0** roster, **0**
  check-ins and the 3 public events. Reading the policy text is not the same
  as trying the door, and every other database read this session came through
  a connection that bypasses RLS.

**Integration surface** (commit `8a7f898`).

* Cricket's share card said a **9,000 pot** against a real 7,500; pickleball
  said **6,000** against a real 5,000. On the four prerendered registration
  routes, which are the links that go in an Instagram bio.
* `/terrathon/rules` was indexable, carried the eligibility cut-off and the
  refund rule, was linked from the consent line, and was missing from the
  sitemap.
* `robots.txt` blocked `/director` and `/paradox/admin` in all 15 blocks and
  said nothing about TerraThon.
* `verify-routing` had no TerraThon sample path, so narrowing the rewrite
  lookahead would hard-404 the whole section while the gate still printed a
  pass.

### All thirty are now closed

Fixed across six commits (`b110eec`, `822b817`, `07664a1`, `21d15a7`,
`8a2a348`, `206a565`), by six agents working on disjoint file sets plus the
items no agent owned. Gate after: lint 0 errors, accent linter 0 violations,
**806 tests in 36 files**, nine-step build clean, eager bundle unchanged at
650.9KB of 683.6KB.

Verified in a browser, not just asserted:

* The homepage countdown was checked against a REAL network failure, by
  pointing the Supabase URL at an unreachable host and restarting the dev
  server. Result: no "That's a wrap", no countdown at all, no invented price,
  and the sports section resolves to "Couldn't load the sports" with a working
  Try again. The dev harness could not test this: its hero surface renders
  populated fixtures whatever scenario button is selected.
* The date-of-birth verdict, all four boundaries: age 3 now refuses with "You
  need to be at least 5 years old", 1 Jan 2005 is still eligible, 31 Dec 2004
  is still too old, an ordinary date still passes. The role/aria-live conflict
  is gone: refusals carry `role="alert"` only, the eligible state
  `aria-live="polite"` only.
* The rules dialog names the destination: "screenshot is sent to Kanishk on
  WhatsApp at 90734 55396", modal, focus trapped, no raw URL printed.
* The focus ring measured 2.21:1 before and **4.80:1** after; the invalid
  state 2.88:1 before and **4.77:1** after, against a 3:1 floor. Read from the
  authored rule, because `:focus` does not match while the automated window
  lacks OS focus.
* One "Ask about Cricket" block, not two. `maxLength=80` present.

Three things were found during verification that the audit had missed:

* `terrathon_events.rules_md` carried an em dash in each of the three events'
  prize-pool lines. That is desk-edited content, not code, so the source grep
  could never have found it. Fixed in the database; the figures in it were
  already correct.
* `ics.ts` folded lines by UTF-16 code units against a limit RFC 5545
  measures in UTF-8 octets, so an emoji at the boundary would have been cut in
  half. Fixed, with tests that sweep one across it.
* The nav header hardcoded the wordmark and year, bypassing both `EVENT` and
  the shared `Wordmark` component.

### Still open, and none of it is code

The refund the FAQ promises still has no mechanism behind it. `lib/types.ts`
has no `refunded` status and there is no field recording an amount or a date.
The copy is now consistent across both documents, which is the half that could
be fixed from here; the process is yours.

The dev harness fixtures in `frontend/src/dev/TerraThonSurfaces.tsx` still show
a 6,000 pickleball pot and a 9,000 cricket one, the same stale numbers that
were wrong on the share cards. Dev-only, never shipped, but it will mislead
anyone previewing a surface.

The questions a parent or a 15-year-old would ask and the site still does not
answer are listed under section 6 of the audit above. The sharpest: there is no
stated minimum age, no equipment list for cricket, and nothing says which FIFA
title or console, or whether AquaTerra supplies the controller.

### Closed, in the order they were fixed

**Gate reliability. These bite on 2 October, not before.**

1. `admin/offlineQueue.ts:30-57` + `admin/Checkin.tsx:109-115`. `open()`
   resolves `null` instead of rejecting when IndexedDB is blocked or throws,
   `enqueue()` returns `void` regardless, and Checkin then shows the green
   full-screen **ADMIT / OFFLINE** card unconditionally. On a device where
   IndexedDB fails, a volunteer admits someone and the scan was never stored
   anywhere: it never appears in `pending`, never syncs, and nothing ever says
   so.
2. `lib/api.ts:171-174` + `admin/Checkin.tsx:47`. Both filter on `paid`
   without excluding `cancelled`. The online path is safe because
   `terrathon_check_in` checks `status = 'cancelled'` itself, so this is
   specifically the **offline** cache: a team cancelled after paying gets
   admitted at the gate whenever the phone has no signal.
3. `admin/Checkin.tsx:149-177, 270`. `startCamera` has no re-entrancy guard
   and the button has no disabled state while it is pending. Two taps during
   the permission prompt orphans a `MediaStream` that nothing in the component
   can ever stop, including the unmount cleanup.
4. `admin/Checkin.tsx:135-137`. A scan that fails on the network gets only a
   toast, while every other outcome gets a full-screen card and a buzz.
5. `admin/Checkin.tsx:143` + `lib/sound.ts`. `navigator.vibrate` has never
   existed in WebKit, so on any iPhone the only scan feedback is the screen
   changing colour. `playSuccess` exists and is not imported here.
6. `admin/offlineQueue.ts:73-89`. A permanently rejected scan (cancelled,
   wrong day) is indistinguishable from a network failure, so it retries
   forever under the message "Still offline? It will retry."
7. `admin/Print.tsx:78-84`. The paper fallback, the thing you open when the
   venue wifi has died, has no retry button on its own failure.

**Lying empty states. The repo's most repeated bug, again.**

8. `pages/Home.tsx:126` + `lib/countdown.ts:63`. `usePublicEvents` starts
   `events` at `[]` and `resolveCountdown([])` returns
   *"That's a wrap. See you next year."* The hero is ungated on
   `loading`/`error`, so the homepage tells every visitor the fundraiser is
   over on every page load, and permanently if the fetch fails.
   `lib/hooks.ts:71` carries a comment warning about exactly this.
9. `admin/Dashboard.tsx:266-344`. KPI tiles, the action queue and the filter
   counts all render confident zeros on a load failure. Only the list below
   them, which nobody scrolls to on a page that already looks empty, says
   "Couldn't load registrations".
10. `lib/hooks.ts:77-93`. `usePublicEvents.load()` has no staleness guard, so
    a slow failing request can land after a fast successful one and throw the
    page back to an error state over good data.

**Register form.**

11. `pages/Register.tsx`. Add `TOO_YOUNG` to `ERROR_COPY` and mirror the age
    floor in `dobVerdict`, so the server fix has a client half.
12. `pages/Register.tsx:394-398`. No `maxLength` on the name field against an
    80-character server cap, and the resulting `INVALID_NAME` renders as
    "Enter your full name." under a field that visibly has one.
13. `pages/Register.tsx:100-104`. `sport` comes from the URL and is never
    checked against `event.accepting`, so an old link to a closed sport gives
    a fully live-looking form that only refuses after submission.

**Accessibility.**

14. `pages/Register.tsx:243-247`. On success the whole form unmounts and focus
    falls to `body`. A screen-reader user gets no confirmation, no heading and
    no reference code. This is the most important moment on the public site
    and it is silent.
15. `admin/TicketModal.tsx` and `admin/Dashboard.tsx:590-696`. Both are plain
    divs with `role="dialog"`, no focus trap and no focus restore, while
    `RulesDialog` next door uses a native `<dialog>` and gets all of it free.
16. `terrathon.css:1196-1200`. `outline: none` on every input, replaced by a
    sky shadow measuring about **2.2:1** against paper, under the 3:1 floor
    for a focus indicator. The invalid state is about 2.9:1.
17. `admin/Checkin.tsx:296`. White on `--welfare` is **4.35:1**, under 4.5,
    and the detail line under ADMIT sits at `opacity: 0.85`, about 3.6:1. The
    token file already documents this pair as failing.
18. `pages/Register.tsx:183-192`. The focus-the-first-error mechanism looks
    for `[aria-invalid="true"]`, which the sport picker and the consent
    checkbox never set, so those two errors move focus nowhere.
19. `admin/Checkin.tsx:205-239`. Inline `minHeight: 40` overrides the
    section's own 44-52px minimums, on the one tool described as being run
    one-handed at a gate.

**Content.**

20. `lib/generalRules.ts:26` and three other places tell a payer to "send the
    screenshot back to us" and **no page ever says to whom**. `config.ts:29`
    defines `UPI.proofPhone`/`proofName` for exactly this and a repo-wide grep
    finds them referenced nowhere outside `config.ts`. Same shape as the
    sponsor `Partner.url` bug: a field defined and wired to nothing.
21. `pages/Sport.tsx:232-248` and `:250-266` are **byte-for-byte identical**.
    Every sport page renders the same "Ask about X" block twice in a row.
22. The mandatory rules dialog says the fee is non-refundable full stop;
    `components/Faq.tsx:28` adds "unless AquaTerra cancels a sport". The
    document gated behind the consent tick is the stricter, wronger one. And
    there is no `refunded` status anywhere in `lib/types.ts:55`, so the refund
    that is promised has no mechanism behind it.
23. `pages/Home.tsx:26` promises contact "within 24 hours"; the screen shown
    after an actual signup says "shortly"; the FAQ gives no time at all.
24. `pages/Home.tsx:100` and `:375` hardcode a fallback entry fee twice.
25. **121 em dashes**, 13 of them in user-visible copy, against a standing
    rule of zero. `lib/format.ts:4,36,41` also returns a literal em dash as
    the placeholder for every null value on the admin desk.
26. `pages/Register.tsx:456` says a date of birth has been **"verified"**,
    which overclaims a client-side range check.

**Lower.**

27. `components/SportCard.tsx:62-77` defines `Tile` inside the render body, so
    every parent render remounts two `StadiumScene` instances per card.
28. `admin/TicketModal.tsx:196-211` marks a ticket sent on download or on
    opening WhatsApp, neither of which can confirm anything was sent. The
    Dashboard made the opposite call deliberately for its Messaged checkbox,
    with a comment explaining why.
29. `lib/format.ts:52-58`. `relativeTime` shows "just now" for any future
    timestamp, however far future, and the admin desk feeds it an uncorrected
    device clock while `useServerOffset` exists and is used on the public side.
30. `config.ts:29,69` duplicate the two `CONTACTS` phone numbers as literals.
    Change a number in the obvious place and the payment-proof instruction
    keeps pointing at the old one.

### Downgraded after checking

* **"`normalisePhone`'s result is discarded, defeating the duplicate check."**
  The first half is true: `Register.tsx:215` submits the raw typed string. The
  conclusion is wrong. `terrathon_register` normalises the phone itself with
  the same algorithm before comparing, and the stored column is always
  canonical, so the duplicate check is safe. A dead computation, not a bug.
* **"React 19 StrictMode double-invocation."** My own briefing asserted it.
  There is no `<StrictMode>` anywhere in this app, so several findings that
  would have followed from it do not exist. The `fired` ref guard in
  `SuccessMoment.tsx:158` is inert rather than masking anything.

### Needs a decision from you, not from me

* **The two test registrations** (`TT26-PKL-001`, `TT26-CRK-001`, both
  unpaid). Setting `hold_hours` does not free them, because their
  `hold_expires_at` was stamped NULL at insert. They each hold a slot and will
  appear on the desk and in the Excel export on the day. Your rows, untouched.
* **`venue_map_url` is NULL on all three events.** The feature is built end to
  end. A parent looking for "11:11" or "Turf XL" in Kolkata gets nothing.
* **FIFA closes at 09:30 IST on the morning of the event**, 1h45m before its
  own report time. Pickleball and Cricket close at 23:59 the night before.
* **Leaked-password protection is off** in Supabase Auth. One toggle, and it
  guards the admin account that reads every registrant's phone number. I will
  not flip a security setting on your project.
* **Is there a minimum age?** Nothing states one. The rules give only a
  ceiling. `CLASS_OPTIONS` starts at Class 6, implying roughly 11, and nothing
  enforces it. The server floor is now 5, which only matches the constraint.
* **`PayNowCard.tsx` is fully built and imported by nothing** except the dev
  harness, because payment moved to WhatsApp. Keep it or delete it.

---

## Done and verified in the browser

| # | Asked for | Where it lives |
|---|---|---|
| 1 | Sporty display face | Bebas Neue, `--tt-display`, loaded scoped to `/terrathon/*` only |
| 2 | Vibrant palette | tomato / lemon / sky over the night ground `#0C1020` |
| 3 | Big split-flap scoreboard countdown as the centrepiece | `components/Countdown.tsx`, 2x2 under 560px |
| 4 | Hero spread out | poster reflowed, content-anchored scrim |
| 5 | Simpler how-it-works | four steps, no cards |
| 6 | Vibrant schedule | `pages/Schedule.tsx`, a real `<table>` with per-row accent, cards under 760px |
| 7 | Fundraiser box filled out | facts band on Home |
| 8 | Proper coloured sport icons | `components/SportMarks.tsx`, filled silhouettes on a 32 grid |
| 9 | DOB instead of age, green/red at 1 Jan 2005 | verified on both sides of the boundary; database gate `v_dob < c_min_dob` agrees exactly |
| 10 | Two checkboxes only, rules linking out | rules tick + optional updates; `/terrathon/rules` |
| 11 | Stripped success screen | reference code, and "the team will reach out with the QR" |
| 12 | Two contacts only | Kanishk 9073455396, Pratyaksh 9830554654 |
| 13 | FAQs on the main page | `components/Faq.tsx`, 9 entries, findable with Ctrl+F while collapsed |
| 14 | Separate TerraThon admin, not the HoD desk | `admin/AdminGate.tsx`, own sign-in panel, translucent entry in the footer and hamburger |
| 15 | Messaged / paid ticks, notes, ticket QR, Excel | all present on the desk, re-verified 20 Sep |
| 16 | Phone dark mode looked wrong | `color-scheme: light` pinned; verified under emulated dark: cream ground, no UA-darkened controls |
| 17 | Sign-up button stuck on a phone | root cause was mine, see below. Fixed live. |
| 18 | Eligibility message clipped to one word per line | it sat in the 110px date cell; spans the row now. Two more bugs were in the same screenshot: the date column was too narrow to show the year (`01-02-` with no year), and the tick/cross were a mangled CSS escape rendering as a literal `¹3` / `¹5`. |
| 19 | "Event rules" opens a popup | `components/RulesDialog.tsx`, a real `<dialog>`. General rules plus the sport's own, from the database. |
| 20 | Rules agreed by default, still compulsory | the tick starts on; clearing it refuses the submit with no network call. Both verified. |

### The stuck button, honestly

I changed `terrathon_register()` to require `dob` while the deployed bundle
still sent `age`. Every submit came back `INVALID_DOB`, the old bundle had no
copy for that code, so it fell to a generic banner at the top of a long form,
off-screen on a phone. It looked like nothing happened.

Two fixes, both live: migration `terrathon_r3_03` accepts a legacy `age`-only
payload, and `revealFailure()` scrolls a submit failure into view.

**The caveat that stays true:** a legacy payload cannot be age-gated, because
someone born 31 Dec 2004 and someone born 1 Jan 2005 are both 21 today. Only
clients on the new bundle are gated at the exact cut-off.

---

## Left, and who owns it

| # | Item | Owner | Why it is not mine |
|---|---|---|---|
| L1 | Create the dedicated TerraThon admin account | **you** | I am not permitted to create accounts or enter passwords. Full steps below; no SQL needed. |
| L2 | Sponsor logos | **you** | `PARTNERS` in `config.ts` is `[]` on purpose. Both call sites guard on `length > 0`, so nothing renders and nothing is invented. Fill it when sponsors are real; the render path is complete and was fixed 20 Sep (`Partner.url` was declared and rendered by neither site, so a sponsor's link went nowhere). |
| L3 | Google Sheets live sync | deferred by you | Excel export ships now. **Corrected 20 Sep:** `pg_net` 0.20.0 *is* available on this project, just not installed, so the PRD's "no extension behind it" is wrong. It is one `create extension pg_net;` away, not a dead end. |
| L4 | Merge `terrathon-2026` into `main` | **you** | **Decided 20 Sep: hold.** You want to review it yourself before anything reaches the live site. Not merged, so `/terrathon` is not live. Ask when you want the merge. |

---

## L1 in full: standing the admin account up

Six steps, no SQL. Each refusal screen on the way now names the desk that
unblocks it, so the path is walkable without this file.

1. **Create the auth user.** Supabase dashboard, Authentication, Add user.
   It needs a real email address, not a bare username, and Supabase rejects
   passwords under 6 characters by default. Tick auto-confirm.
2. **Sign in once** at `/terrathon/admin`. That first sign-in is what calls
   `ensure_member()` and creates the `members` row. Nothing exists before it.
3. The gate says **"Finish your profile first"**. Follow its link, add a
   class and a phone number.
4. The gate now says **"Waiting on approval"**. Approve the account on the
   **Account Approvals** desk, signed in as yourself.
5. The gate now says **"You don't run the gate"**. Promote the account on the
   **Director Management** desk: promote mode, search the name, promote.
6. Sign in again at `/terrathon/admin`. The desk opens.

**Why the role is not optional.** There is no API server. The RLS policy on
every `terrathon_*` table is `is_director() or is_super_admin()`, so a member
row without a leader role gets zero rows back from the database no matter what
the browser does. The sign-in panel is convenience; that policy is the gate.

**On the password.** This one account can read the name and phone number of
every student who signs up. Treat it like the roster it is.

---

## Standing traps for whoever touches this next

- `scripts/accent-lint-baseline.json` is keyed by **line number**. Insert a line
  above a tracked rule and `npm run lint` fails for reasons unrelated to the change.
- `--mono` is not monospace. `--code` is. NeutralFace is caps-only, has no
  tabular figures, and is wider than JetBrains at the same size.
- `/dev/terrathon` is the only way to see the desk without credentials, and is
  `import.meta.env.DEV ? lazy(...) : Placeholder` so it never ships.
- A `.sql` file in the repo is not evidence the migration ran. Check live.
