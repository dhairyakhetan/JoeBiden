# TERRATHON 2026 PRD v1.1 — deltas against v1.0

| Field | Value |
|---|---|
| Supersedes | PRD v1.0, Fri 18 Sep 2026, in the sections named below only |
| Date | Sat 19 Sep 2026 |
| Basis | v1.0 reviewed against the live `frontend/` tree and the live Supabase project `hzowuwffjqtgszecngpe`, plus decisions taken 19 Sep |
| Status | R0 applied and verified live. R1 not started. |

**How to read this.** v1.0 stays the spec. Everything below either replaces a
numbered section of it or records a decision it left open. Where a v1.0 section
is not mentioned here, it still stands. Sections marked **AS-BUILT** describe
code that exists in the live database today, not a proposal.

---

## A. Five architecture overrides

v1.0 assumed a greenfield repo and a new Supabase project. Neither is what
TerraThon is being built on.

| # | v1.0 said | v1.1 | Kills |
|---|---|---|---|
| A1 | Standalone `terrathon-2026/` repo, own Vercel project, `terrathon.ngoaquaterra.com` | A new route group at `/terrathon/*` inside `frontend/`, built fresh, lazy-loaded like `/paradox/*`, same Vercel project | §11.2, §11.6, blocker B7 |
| A2 | A new Supabase project | `terrathon_*` tables in the existing `community-platform-aq` (`hzowuwffjqtgszecngpe`) | §11.1 backend line |
| A3 | A `staff` table, invite-only, roles `admin` and `desk` | Reuse the existing role model. Admin is `is_director() or is_super_admin()`. No desk role at all, see D3 | §7.1, §12.1 `staff`, blocker B6 |
| A4 | Caps, waitlist, and a public "11 of 16 team slots taken" bar | Caps bind server-side; the public sees a `filling_fast` boolean and never a count | PUB-06 |
| A5 | Four-tab Google Sheet live mirror, 20s at p95 | Cut entirely. Excel export only | SYS-01, goal G5, §8, Appendix C |

**Why A2 is now forced.** The Paradox project `drvucogrjphctwfealxd`, which
`frontend/src/paradox/lib/supabase.ts` still points at, is retired and
unreachable. The reachable org holds exactly one project and zero `paradox_*`
tables.

**Why A5 is not a preference.** `pg_net` is **not installed** on this project.
`pg_cron` 1.6.4 and `pgcrypto` 1.3 are. §8.1's Database Webhook, which is the
mechanism the "live" claim rests on, has no extension behind it, so G5's 20s at
p95 was unachievable as written. If the Sheet is ever revived, enabling
`pg_net` is a prerequisite step that v1.0 does not list.

**Restated goal G5.** Replaces "Sheet reflects a change within 20 seconds at
p95": *the Excel export reflects the live database at the moment it is clicked,
and completes in under 5 seconds at TerraThon's row counts.*

---

## B. Blocker resolutions

| ID | Resolution |
|---|---|
| B1 | Wordmark is **"TERRATHON 2026"**, year in the mark. |
| B2 | All three venues are booked; details pending. `venue`, `venue_map_url`, `report_time`, `match_window` are seeded **NULL on purpose**. Nothing was invented. Fill the `terrathon_events` rows directly, no redeploy. |
| B3 | **Paradox 4.0 figures**, seeded. See F3. |
| B4 | VPA `kanishk.ag2468-2@okhdfcbank`, confirmed to be **the NGO's own bank account surfaced through Google Pay**. AQ Non-negotiable 4 holds. See D5 for the one thing this adds to the launch test. |
| B5 | Contact page renders **only cards that have a phone number**. |
| B6 | Closed by A3. |
| B7 | Closed by A1. |
| B8 | **Split by format**, see D2. |

---

## C. Corrections to v1.0's stated facts

| §  | v1.0 | Actually |
|---|---|---|
| 11.1 | "React 18 with Vite" | React 19.2, Tailwind 4, React Router 7. Follow the repo; drop the version pin. |
| 12.1 | `staff.id uuid`, and `paid_by uuid references staff(id)` | `members` has no `id`. Its PK is **`member_id integer`**. Every actor column is `int references members(member_id)`. |
| 12.3 | `paid_by := auth.uid()` in a plain trigger | Correct in intent and load-bearing, but `members.auth_uid` is one of the 8 columns revoked from `authenticated`, so the trigger **must be SECURITY DEFINER** to resolve a member from `auth.uid()`. |
| 12.5 | "no public read or write for anonymous visitors" as the starting state | The opposite. This project's default ACL grants `anon` and `authenticated` the full `arwdDxtm` on every new relation. RLS plus an explicit `revoke` is the gate. See D1. |
| 5.1 | Paths at the site root | Every path gains a `/terrathon` prefix. |
| 7.7 / 12.1 | One scan per registration per day | Correct, kept exactly, and the one genuinely new idea in v1.0. A boolean `attended` cannot serve cricket's two days. |

---

## D. New requirements v1.0 does not contain

### D1. The revoke is part of every DDL statement (P0, done)

On this project a plain `create table` is world-readable and world-writable
with the public anon key. Every `terrathon_*` relation is created and revoked
inside one transaction.

**This applies to VIEWS as well as tables, and the view case is worse.** A view
with no `security_invoker` option runs as its owner (`postgres`), so a write
through it bypasses RLS *and* column grants on the base table. This was hit for
real on 19 Sep: `terrathon_public_events` came up `is_updatable YES`,
`anon_can_update true`, `anon_can_delete true`, and was fixed in migration
`terrathon_r0_04`.

Verification is a **count, not a spot check**. Confirming one column is
unreadable proves nothing.

### D2. Registration close time is per format (P0)

| Sport | Closes | Why |
|---|---|---|
| Pickleball | Thu 1 Oct, 23:59 IST | Bracket drawn overnight |
| Cricket | Fri 2 Oct, 23:59 IST | Knockout bracket drawn overnight |
| FIFA | Sat 3 Oct, **09:30 IST** | A solo league absorbs a late entry without redrawing anything |

FIFA's 09:30 **assumes** a 9:30 reporting time. Re-point `closes_at` when the
real one arrives with the venue.

### D3. There is no desk role (P0-E)

v1.0 §7.1 specifies a `desk` role for gate volunteers. Gate scanning is
**core-team only**, so `terrathon_check_in()` is gated on
`is_director() or is_super_admin()` and no desk capability exists. If this is
reversed later, the capability must be added to both the RPC and the route
guard in the same change.

### D4. Saturday runs two gates (P0-E)

Cricket and FIFA both fall on Sat 3 Oct at two venues, with **two separate gate
teams and one scanner phone each**. This is what the offline cache (§7.7)
already assumes: two phones scanning the same ticket while both offline would
each admit it. v1.0 flags the participant clash (PUB-09b) and misses this.

### D5. Verify the payee name, not just that payment works (P0)

UPI apps override the `pn` parameter with the bank's own registered account
name, so `pn=Team%20AquaTerra` is not enforceable from the link. Add to the ₹1
launch test: **confirm the payee name shown on the confirmation screen reads as
the NGO and not as an individual.** A charity event whose payment sheet shows a
personal name loses parents even when the account is correct.

### D6. Sound defaults OFF (P1)

Replaces §6.1's "Sound defaults ON". The toggle stays in the header and the
choice still persists in `localStorage`. A fourteen-year-old opening this in
class from an Instagram link should not get a crowd cheer.

---

## E. Revised release plan

Replaces §18. **Day 1 does not move.** R1 slips two days; the slack comes out
of R2, which is the celebration layer, exactly as §0.1 says it should.

| Release | Date | v1.0 date | Ships | Gate |
|---|---|---|---|---|
| **R0** | Sat 20 Sep | n/a | Schema, lockdown, RPCs, seed | `relacl` shows no `r`/`a`/`w` for `anon` on all five tables. **DONE, see F** |
| **R1** | Tue 23 Sep | Mon 21 Sep | All P0: public shell, 3 sport pages, the 3-step form, confetti success, pay-now card, schedule, contact, static ticket page, admin feed, Messaged/Paid/Notes, ticket PNG, manual add, Excel export | ₹1 paid through the live link on GPay, PhonePe and Paytm, **plus D5** |
| **R2** | Fri 26 Sep | Thu 24 Sep | All P1 | `prefers-reduced-motion` kills all of it and the countdown still ticks |
| **R3** | Mon 28 Sep | Mon 28 Sep | All P0-E | Scan in airplane mode, restore network, watch the queue flush |
| Go/no-go | Tue 29 Sep, 20:00 | same | | |
| Event | Fri 2 to Sun 4 Oct | same | | |

**Cut order under pressure:** everything P2, then sound, then choreography,
then the hero sequence, then the action queue and KPI tiles. Never the money
path (register, pay, verify, ticket) and never the R3 scanner.

### E1. Repo plumbing R1 must touch

- `vercel.json` — **no change needed.** The catch-all rewrite already covers
  `/terrathon/*`, and the CSP already permits Supabase, `blob:` images for the
  ticket PNG, and a `upi:` link, which is a navigation and not a fetch.
- `src/App.tsx` — one lazy route, guarded exactly like `/paradox/*`.
- `scripts/prerender-meta.mjs` — four static routes for WhatsApp and Instagram
  link previews. **It throws on an unmatched head replacement**, so a sloppy
  edit fails the build.
- `scripts/generate-sitemap.mjs` — public routes only. Never a registration or
  ticket URL.
- Bundle budget: eager path 700 KB, any single lazy chunk 200 KB.
  `framer-motion` is on the eager denylist, so TerraThon must stay lazy.
- **No new client env var.** TerraThon reads the same `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`.

---

## F. AS-BUILT: what exists in the live database now

Applied 19 Sep 2026 as migrations `terrathon_r0_01_tables_and_lockdown`,
`_02_functions_triggers_public_view`, `_03_checkin_and_seed`,
`_04_fix_public_view_grant`.

### F1. Tables (five, not v1.0's seven)

`terrathon_events`, `terrathon_registrations`, `terrathon_roster`,
`terrathon_checkins`, `terrathon_audit_log`.

Dropped from v1.0: **`staff`** (A3) and **`sync_state`** with both dirty-flag
triggers (A5).

Changed from v1.0 §12.1:

- `messaged` / `messaged_at` / `messaged_by` collapse into one nullable
  **`wa_texted_by int references members(member_id)`** plus `wa_texted_at`.
  Null means not messaged, set means messaged, and the value records who. This
  is the pattern `paradox_registrations.wa_texted_by` already proved here.
- `events.days daterange` becomes **`day_first date`** and **`day_last date`**,
  which are far easier to query per gate day.
- `events` gains **`ref_prefix text`** (`CRK`, `PKL`, `FIF`).

### F2. Public API surface

| Callable | Grant | Returns |
|---|---|---|
| `terrathon_public_events` (view) | SELECT to `anon`, `authenticated` | Sport config plus `filling_fast` and `accepting` booleans. **Never a slot count.** Deliberately SECURITY DEFINER: `anon` holds no privilege on `terrathon_events`, so flipping this to `security_invoker` would blank every public sport page. |
| `terrathon_register(jsonb)` | EXECUTE to `anon`, `authenticated` | See F2a |
| `terrathon_check_in(uuid, date)` | EXECUTE to `authenticated` | See F2b |
| `terrathon_server_now()` | EXECUTE to `anon`, `authenticated` | `timestamptz`, for countdown calibration |

Every table is `revoke all from anon`. The only public write path is
`terrathon_register()`.

#### F2a. `terrathon_register(payload jsonb)`

Payload keys: `sport` (slug), `client_request_id` (uuid, required),
`captain_name`, `class_label`, `school`, `phone`, `email`, `team_name`,
`guardian_consent`, `rules_consent`, `updates_opt_in`, `roster` (array of
strings), `source`, `utm`, `website` (honeypot).

Returns `{ok: true, ref_code, status, fee_inr, display_name}` or
`{ok: true, ..., replayed: true}` on an idempotent retry, or
`{ok: false, code}` where code is one of:

`BAD_REQUEST`, `NO_SUCH_EVENT`, `EVENT_CLOSED`, `INVALID_PHONE`,
`CONSENT_REQUIRED`, `DUPLICATE`, `TEAM_NAME_TAKEN`.

Behaviour worth knowing:
- Takes `select ... for update` on the sport's events row, so 50 concurrent
  submissions after a broadcast serialise through one gate.
- `ref_code` comes from a **monotonic `next_seq` counter, never a row count**,
  so a cancellation cannot free a number that gets reissued.
- Phone is normalised to `+91XXXXXXXXXX`, accepting `9876543210`,
  `+919876543210` or `919876543210`.
- A rejected attempt does **not** burn a sequence number.
- The honeypot returns a plausible success rather than an error.

#### F2b. `terrathon_check_in(token uuid, day date)`

Returns `{result: ...}` where result is `OK`, `ALREADY_IN`, `NOT_CONFIRMED`,
`WRONG_DAY`, `INVALID` or `FORBIDDEN`. One scan per registration per day,
enforced by a unique index, so a forwarded screenshot fails the second scan
while a real cricket ticket still admits on both Sat and Sun.

### F3. Seeded event rows

| | Pickleball | Cricket | FIFA |
|---|---|---|---|
| Fee | ₹750 / pair | ₹2,400 / team | ₹350 / player |
| Team size | 2 | 7 to 8 | 1 |
| Roster at signup | 1 (partner) | 0 | 0 |
| Cap | 24 | 16 | 32 |
| Breakeven | 19 | 10 | 24 |
| Prize pool | ₹6,000 (4,000 / 2,000) | ₹9,000 (5,500 / 3,500) | ₹2,500 (1,500 / 1,000) |
| Days | Fri 2 Oct | Sat 3 + Sun 4 Oct | Sat 3 Oct |
| Closes | Thu 1 Oct 23:59 | Fri 2 Oct 23:59 | Sat 3 Oct 09:30 |
| `hold_hours` | null | null | null |

`hold_hours` is null because **slot holds are off for R1** and turn on in R2
together with the UTR self-report, so nobody who has paid loses a slot while
waiting for an admin to tick Paid. This matches v1.0 §9.3.

### F4. Verification actually run

- Privilege probe, 5 tables × 2 roles × 4 privileges: **`anon` 0 of 20
  granted**, `authenticated` 17 of 20, all behind RLS.
- `terrathon_public_events`: `anon` holds `r` only, after the `_04` fix.
- `register()`: 5 calls produced **1 row**. Idempotent replay returned the
  existing row, a `+91`-prefixed resubmit of the same number hit `DUPLICATE`,
  a bad phone and a missing consent were both rejected, and `next_seq` finished
  at 1, so no rejected attempt burned a number.
- Paid trigger: tick minted a token and set `status='confirmed'`; untick
  preserved the token; retick restored the same one.
- Check-in: 2 rows for Sat and Sun, with the same-day rescan blocked by
  `unique_violation`.
- Test rows deleted; `next_seq` reset to 0 on all three sports.

---

## G. Still open

1. **B2 detail.** Venue, map link, reporting time and match window for all
   three. Blocks nothing technically, costs registrations daily.
2. **FIFA's close time** is a placeholder derived from an assumed 9:30 report.
3. **Retention.** Asked and deliberately deferred on 19 Sep. These tables hold
   phone numbers of people who are mostly minors, under the DPDP Act, with no
   expiry date and no purge job. Recorded in the `terrathon_r0_01` migration
   comment as an unclosed decision. Recommended when reopened: drop `phone` and
   `email` 90 days post-event, keep the roster for records and e-certificates.
4. **Privacy notice.** One database now holds members and participants. Does
   the 12A/80G entity's existing notice cover a non-member minor who only ever
   registered for a sport? This is a question for whoever holds the
   registration, not a build task.
5. **Sport rules.** `rules_md` is empty for all three. v1.0 §6.3 item 4 needs
   the Paradox rule text ported, including the exact FIFA game title and
   platform, which the brief calls "FIFA" but which now sells as EA Sports FC.
6. **Contact numbers (B5).** Six of seven people have none.

---

*Ends. v1.0 remains authoritative for everything not listed above.*

---

# Addendum — v1.2, built 19 Sep 2026

The section is built. `frontend/src/terrathon/`, routed at `/terrathon/*`.

## H. Signup was simplified again, and this supersedes §6.4

v1.0's form collected a full roster up front: team name, partner, six player
slots and a substitute, across three steps. That is a wall to a captain on a
phone who does not yet know who is playing, and it was never how the team
actually works.

**The form now asks four things: name, age, WhatsApp number, sport.** One
screen. Everything else moves to the conversation that already happens:

1. Sign up (four fields).
2. Pay by UPI. The reference code rides in the link's `tn` parameter and in the
   QR, so the note is already filled in.
3. Send the screenshot to one number, via a prefilled WhatsApp button.
4. AQ messages back within 24 hours. **The team list arrives in that chat.**
   Nobody else fills in a form.
5. QR entry pass on WhatsApp.

Schema changes: `age int` added, `class_label` and `school` made **nullable**,
`terrathon_register()` rewritten (migration `terrathon_r1_01_simplify_signup`).
Two new error codes, `INVALID_NAME` and `INVALID_AGE`. The admin manual-add
drawer still captures class and school for walk-ins.

### Links for Instagram

- `ngoaquaterra.com/terrathon/register` — the general one, sport unselected.
- `/terrathon/register/cricket`, `/register/pickleball`, `/register/fifa` —
  land with that sport already chosen. `?sport=` works too.

Picking a different sport rewrites the URL, so a refresh or a reshare keeps it.

## I. Design: AQ's own system, replacing §10 entirely

§10's Obsidian Charcoal / Electric Volt / Teko / Inter palette **does not
ship**. The section runs on AquaTerra's brand: cream `#F4EFE0` ground, ink
`#0A0A0A`, 2px rules, hard offset shadows, tomato `#FF4D2E` as the one hot CTA,
rotated sticker badges, ticket stubs with real perforations, and full-bleed ink
slabs for the hero and footer. Fonts are NeutralFace / Eina01 / Instrument
Serif / JetBrains Mono / Caveat, already declared in `styles/v6.css`, so the
section makes **no third-party font request at all**.

The full contract is `.tastemaker/style-lock.md`, including which colour
pairings are legal. The short version: display hues are fills with ink on top;
as text on cream they measure 1.6 to 3.3:1 and must use their `*-ink` partner.

## J. Promotion

A tomato promo bar on every public AQ route
(`src/components/TerraThonBanner.tsx`), full width on mobile and desktop,
auto-removing after 4 Oct. Plus four prerendered link-preview routes and six
sitemap entries, so a link shared into a WhatsApp group shows the sport rather
than the AquaTerra homepage.

## K. Preview harness

**`/dev/terrathon`**, DEV-only, never shipped. Mounts every surface against
fixtures with the network switched off, across four scenarios
(populated / empty / loading / error): hero, sport cards, stadium scenes, pay
card, success moment, the waitlist variant, the admin desk, the scanner and the
printed day sheet. Several of those states are otherwise very hard to reach on
purpose.

## L. Security fixes found while building

Three, all the same root cause: this project's default ACL hands `anon` rights
to new objects, and it applies to more than tables.

1. **The public view** came up `anon=arwdDxtm` and auto-updatable, running as
   its owner, so a write through it would have bypassed RLS on
   `terrathon_events`. Fixed in `terrathon_r0_04`.
2. **`pending_member_approvals`** (pre-existing, unrelated to TerraThon) let an
   unauthenticated caller INSERT rows into `members`: definer view,
   `check_option NONE`, and INSERT inherits no WHERE. Fixed.
3. **Function EXECUTE** grants: `revoke ... from public` does not remove the
   explicit `anon` grant, so every helper was anon-callable.
   Fixed in `terrathon_r1_02`.

Fixing (3) broke the public pages, which is worth knowing: **a definer view
applies owner rights to tables, but EXECUTE on a function it calls is still
checked against the caller.** The capacity subquery is now inlined into the
view (`terrathon_r1_03`) so the function stays revoked.

Verified with the real anon key against the REST endpoint, not only in SQL:
all five tables 401, the public view returns booleans, the count function and
`check_in` are denied, and the view is no longer auto-updatable.
