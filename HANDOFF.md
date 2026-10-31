# AquaTerra redesign — handoff

Session of 2026-09-03 → 2026-09-05. Everything below is on `main`.

---

## 1. READ THIS FIRST — a live privacy issue I did not change

**`/equity-policy` publishes five named students' personal mobile numbers as
`tel:` links, on a public page that is prerendered and in the sitemap.**

```
frontend/src/public/EquityPolicyPage.tsx  →  const HR_TEAM
  Anisha Sengupta, Janvi Baid, Aarushi Gupta, Diya Poddar, Hrishika Khemka
```

- **This is pre-existing**, not introduced by this session. It is identical at
  `HEAD` before any of my commits, so it is already live and already crawlable.
- I deliberately did **not** change it. It is governance content, those five
  people may well have consented to being the published HR contact, and
  swapping an org's stated escalation path is your decision, not mine.
- **The fix, if you want it:** replace the five direct numbers with the org's
  single official channel (`official@ngoaquaterra.com`, already on the page) or
  a form, and keep the names without the numbers. One-line change to `HR_TEAM`.
- Worth weighing against the Equity Policy's own **Direct Messaging** principle,
  which says not to contact a member privately without prior permission. The
  page currently hands five members' numbers to anyone who finds it.

**Also:** the design bundle is now gitignored. `new aq website/…/uploads/`
contains `members_rows.csv` — a 1,370-row export of the live members table with
`email`, `phone`, `google_id` and `auth_uid`. This repo has already had member
PII pushed into its history once. Do not add it back.

---

## 2. What shipped

**31 of 34 redesign sections**, plus the appendices.

| Done | |
|---|---|
| 01 chrome · 02 auth · 03 post+composer · 04 content manager | 05/05b About+Projects · 06 profile · 08 desk index |
| 09 mascots · 10 feed cards · 11 stickers · 12 receipt | 13 member records · 14 home · 15 referrals · 16 desktop |
| 17 home cleanup · 18-25 the 17 HoD desks · 26 About story | 27 promo · 28 onboarding · 29/31/32 poster · 30 AQ map |
| 33 AQ Labs · 34 grid host | A1 migrations · A2 em-dash · A4 equity page |
| FR6/FR13 poster+story for all · FR9 CV | FR10 HR-only certificates · FR11 member of the month |

**Not sections, also done:** the 22 accessibility P0s and 41 P1s, the `hr` role,
auto-approve achievements, points removed app-wide, and the A6 inline-token auth
layout from the tastemaker studies.

**Gates at handoff:** `tsc -b` clean · **268 tests / 13 files** (up from 27/3) ·
`npm run build` green · 20 static + 576 dynamic prerendered routes.

**33 of 34 sections.** The only section still open is the outline rule, which is
open by instruction — see §5.1.

---

## 3. Database — what I applied live

Four migrations against `hzowuwffjqtgszecngpe`, all additive:

1. `redesign_a1_role_hr_and_member_columns` — the `hr` role in the CHECK
   constraint, `is_director()` and `is_super_admin()` both updated to accept it,
   plus `members.member_no` (sequence-backed, backfilled in join order) and
   `members.referred_by`.
2. `redesign_a1_new_tables` — `member_teams`, `contact_access_log`,
   `member_activity`, `referrals`, `referral_clicks`, `desk_todos`, `desk_sops`,
   `wishes`. **RLS enabled in the same migration that creates each one.**
3. `redesign_a1_rls_policies` — the policies. `contact_access_log` and
   `member_activity` are append-only from the client. `wishes` is readable only
   where `birthday_public IS TRUE`, which is an opt-**in**; getting that
   backwards would publish birthdays for 1,300 students.
4. `redesign_a1_grants_and_claim_referral` — **the grants the columns never
   got.** `member_no` and `referred_by` landed with `REFERENCES` only and no
   `SELECT`, because this table's PII lockdown re-granted SELECT column by
   column, so anything added afterwards inherits nothing. **Every future column
   on `members` has this same trap.** Plus `claim_member_referral(uuid)`,
   SECURITY DEFINER, which owns the claim-once / not-expired / not-self rules
   because `referred_by` deliberately has no column UPDATE grant.

**A1 item 14, the `sops` urgency relabel, was NOT run — it is a no-op.**
`public.sops` has zero rows, so the "blocking data issue" gating section 21 does
not exist. Running a migration that is unsafe to run twice, to change nothing,
would only create a false record that it had happened.

---

## 4. The documents, and which is authoritative

| File | What it is |
|---|---|
| `REDESIGN_GUARDRAILS.md` | **The rules.** Read before writing any redesign code |
| `REDESIGN_CHANGELOG.md` | ~10,000 lines. Exact before → after for every change, blind-executable |
| `REDESIGN_EXECUTION_PLAN.md` | Section-by-section state |
| `REDESIGN_FEATURE_REQUESTS.md` | The 13 rapid-fire items and their decisions |
| `AQ_EXPERIENCE_BRIEF.md` | The 65-section adaptive-experience brief. **Audit done, engine not built** |
| `TASTEMAKER_TODO.md` | The three design studies, decisions taken, what is left |
| `design-audit/redesign-2026-09/` | 5 audits: accessibility (247 findings), better-ui, interface-feel, architecture, visual review |

`HANDOFF_PORT_PLAN.md` is **SUPERSEDED** — it describes an older bundle with the
opposite rule ("visual system stays, only UX ports").

---

## 5. Open decisions — these need you, not more code

1. ~~**The outline rule.**~~ **DECIDED 2026-09-09 — B, outline by layer depth.**
   Owner picked it after reviewing the mechanical difference between all
   three (`/dev/variations`, DEV-only route, kept for reference — not
   deleted). `REDESIGN_GUARDRAILS.md`'s token table is rewritten with the
   real rule. **Not yet applied to the live site** — every real card/table/
   chip-group still carries the old border-on-everything treatment;
   re-skinning them to match is open as its own, larger pass, not started.
2. ~~The four drive photos need a chapter mapping.~~ **RESOLVED — do not place
   them.** `design-reference/HANDOFF-SPEC.md:108` names them
   (`food-distribution`, `education-sundarban`, `christmas-khidirpur`,
   `fundraising-diwali`) and says in the same line: *"These are content
   placeholders; swap for real CMS/Supabase-hosted media."* They also do not
   exist anywhere in the repo — `find` returns nothing for all four.

   So this was never a mapping decision. Chapter 2021's own frozen string says
   "a Sundarbans relief trip" and 2024's says "Disco Diwali", so the *slots* are
   unambiguous — but filling them with stock placeholders would put a
   photograph on the org's most-read page implying it documents a real relief
   trip that those pixels have nothing to do with. That is the same failure as
   an invented statistic, in a medium people trust more.

   **What is actually needed:** real photographs from AquaTerra's own archive,
   uploaded to Supabase storage. Then the mapping is already known.
3. ~~Feature requests 6, 9, 10, 11, 13 need specs.~~ **DONE — shipped in
   `f33a2f7`.** They did not need specs; the 13-item list was the spec.
   Poster/story now reach every member through `ShareModal`, the CV button is
   on own-profile, certificates are HR-only at BOTH the route and the RLS
   policy, and member of the month is a desk tab plus a signed-in-only card.

   **Two things to know.** `hod`/`director` accounts have **lost the ability to
   issue certificates**, in the desk and through the API — that is what FR10
   asked for, but it is a capability removed from live accounts; reversal is in
   `frontend/scripts/certificate_requests_hr_only_2026_09_05.sql`. And **none of
   this was seen in a browser** — every surface needs an authenticated session.
   Someone should open a post's share sheet, the CV card and the
   member-of-the-month desk while signed in.
4. **`paradox/pages/Home.tsx`** still says "volunteers get certificates +
   welfare points". Paradox is out of scope by the guardrails; that string is
   now false.
5. ~~**The legacy `.sticker` vocabulary**~~ **DONE 2026-09-09.** The CSS
   groundwork (base `.sticker` keyline restored, `.sticker--stamped`/
   `.sticker--diecut` modifiers, all six off-palette hexes remapped to tokens)
   was already built per `interface-redesign-with-rounded-minimalism/project/
   changelog/13-sticker-system.md` before this pass — what was still open was
   classifying each of the ~42 real call sites per 13.1's rule (tappable =
   stamped, the base default; decorative = die-cut with `--sticker-ground`
   matched to its real parent). Fixed across 30 files; see
   `REDESIGN_CHANGELOG.md` Section 42. The six hexes themselves turned out to
   be a separate, deliberately-named "Pop" decorative palette (documented on
   `/brand`, used for confetti/achievement badges/category legends) — not a
   bug, left untouched.

---

## 6. Known gaps

- **The feed card catalogue (section 10) is built, tested and UNMOUNTED.** 30
  shapes, 8 families, a chooser, 82 tests. Mounting it needs `onLike/onSave/
  onShare` lifted out of `FeedPostCard` first. **11 of the 30 shapes can never
  match real data** — `posts` has no image columns, no body over 900 chars, no
  `class`/`drop` tables, no `poll_options` — and C07/C25 will carry nearly the
  whole feed, because 576 of 586 posts come from one author.
- **`/register`, `/pending`, `/rejected` and both profile pages were never seen
  rendering.** All are status-gated and the dev preview creates no Supabase
  session. They typecheck and build; they need a real account in each state.
- **Dark mode was not checked anywhere.**
- **The accessibility work needs a real keyboard walk.** ~185 P2 findings remain.
- **The global `h1..h6 { font-family: var(--display) !important }`** in `v6.css`
  silently overrides every component that wants mono or Eina for a heading. I
  fixed one symptom narrowly; the rule itself is untouched and its blast radius
  is every heading in the app.
- **~250 hard-shadow call sites across 25 depths** against a system that
  specifies one.

---

## 7. Things that were true and surprising

Recorded because each cost real time to find and would cost it again:

- **`--paper` is `#F4EFE0`, not `#DED6C2`.** `docs/HANDOFF.md` says the latter;
  that is the design tool's canvas backdrop. Counted across the 42 canvases:
  1,089 vs 78. **Do not "fix" the page ground.**
- **The design canvas contained two invented figures** — "12,480 lives reached"
  and "41 projects delivered" — which `github.md` records as existing nowhere in
  the codebase. It also named three real members in auth copy. Neither shipped;
  `lib/authTokens.test.ts` and `lib/authCopy.test.ts` now fail if either returns.
- **A `!important` block pinned every card to the legacy 20px radius**, so all
  radius work would have been invisible until it was repointed.
- **`components/Modal.tsx` was styled entirely in Tailwind the app no longer
  loads** — no fixed positioning, no scrim, no centring, no width cap — on two
  live member-facing modals.
- **`member_preauth` already existed with 85 live rows** while A1 listed it as a
  table to create.
- **The volunteer desk's row number was a `wa.me` link when a phone existed and
  an expand button when not, with no visual difference** — so on a
  WhatsApp-outreach desk, the majority case had no keyboard-reachable expand.
