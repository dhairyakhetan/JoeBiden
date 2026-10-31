# Open questions — 2026-09-10

Everything here is something I **cannot** determine from the code or the
database. Each one is followed by the evidence that raised it and what it
unblocks. Answer inline under each `>` and I'll work from it.

---

## A. What is actually real? (the biggest blocker)

22 tables are built, correctly wired, RLS-protected — and completely empty. I
can't tell "not launched yet" from "abandoned" from "silently broken", and the
answer changes whether I build on them or delete them.

**A1. Drives and attendance — is this live?**
`drive_attendance` = 0 rows. I proved the plumbing works end-to-end, but
`welfare_projects.drive_lead_member_id` is **NULL on all 558 rows**, and the
RLS INSERT policy requires it — so the drive lead the feature was designed for
physically cannot record attendance. Only your 16 super_admin/hr accounts can.
Also: **0 of 558 drives are future-dated.**
> Is the app the system of record for running a drive (sign-ups, check-in,
> hours) — or is it a write-up archive *after* the fact, with the real work
> happening on WhatsApp?

**A2. Is there anywhere in the UI to assign a drive lead?**
I could not find one. If it doesn't exist, that single missing control is what
blocks attendance → hours → certificates.
> Should I build it? (Director desk, on the project editor?)

**A3. Points — dead or coming back?**
`points_ledger` exists with 0 rows. The changelog says the welfare-points system
was retired 2026-09-04 and `pointsTile` was removed, but the table and service
survive.
> Delete the remains, or is this coming back?

**A4. Certificates / LoR / LoV.**
`certificate_requests` = 0. Hours can never be non-zero today (A1), and
`welfare_projects.scheduled_end` is NULL on all 558 rows, which is the fallback
the hours calculation uses.
> Is issuing certificates a real workflow you want working this term?

**A5. The rest.** `yearbook_entries`, `member_of_the_month`, `sops`,
`referrals`, `member_education`, `contact_submissions`, `member_breaks` — all 0.
> For each: not launched, or abandoned? I'd rather delete dead surfaces than
> leave them looking broken.

---

## B. What is the feed *for*?

**B1.** `post_feed_view` is 548 welfare-project mirrors + 36 blogs + **2**
organic member posts. Across 1,317 active members: 6 likes, 1 comment, 1 follow,
3 saved posts.
> Is the feed meant to become social (members posting to each other), or is it
> deliberately a CMS/noticeboard that mirrors project write-ups? I would build
> these two very differently.

**B2.** The card catalogue has 30 designed shapes; only 4 can ever render,
because the feed only queries `posts`. The other 26 (birthdays, drives,
certificates, achievements, job openings, digests) need new cross-table
fetching.
> Worth building that fan-in, or is 4 shapes honestly enough?

**B3.** `posts.status` is `'published'` on all 586 rows — no moderation queue
exists in practice, though the desk has one.
> Is post moderation actually used, or is everything posted by the org account
> anyway?

---

## C. Design direction

**C1. Heroes.** Six distinct hero patterns across ~22 public pages (ink slab,
photo scrim, stat strip, compact card, rule-and-eyebrow, none). After the
border/shadow split this is the loudest remaining "different app" signal.
> One hero system, or is per-page variety deliberate?

**C2. `/brand`.** It's the brand-spec showcase and it *demonstrates* the retired
motif on purpose (it even ships deliberately-failing contrast chips as a
labelled demo). It's also the most visually alien page in the app.
> Leave it as a historical spec, or restyle it to the current system?

**C3. Breakpoints.** Live phone thresholds: 600, 601, 640, 700, 760, 860, 979,
1080. Pages reflow at different widths as a member navigates.
> Want me to unify onto the documented 600 / 760 / 1024 tiers? It's a real
> regression risk across many files, so I won't start it uninvited.

**C4. The remaining approved mockups.** Home greeting, feed smart-grid, profile
photo collection, and the footer are approved as Artifacts but not yet in code.
> Which do you want built, and in what order?

---

## D. Privacy — you have 1,317 mostly-minor users

**D1.** You said keep the public member directory as-is, which I've respected.
But `anon` can currently read six columns with no public purpose:
`rejection_note`, `role`, `last_login`, `join_reason`, `approved_by`,
`approved_at`. The public `/members` page never reads them.
> Can I revoke just those six? Zero UI impact — I verified what the page
> selects. (Name/avatar/class/school/Instagram stay exactly as they are.)

**D2.** Self-escalation is currently blocked by **one trigger**
(`members_guard_privileged_cols`); `authenticated` does hold UPDATE on
`members.role`. If that trigger is ever dropped, any student becomes
super_admin.
> Want me to add a defence-in-depth guard, or is the trigger enough?

---

## E. Scope

**E1. Paradox.** `frontend/src/paradox/**` is a separate sub-app on a *different*
Supabase project I can't see, and I've excluded it from every audit.
> Permanently out of scope, or should it be brought in?

**E2. `.single()` vs `.maybeSingle()`.** 81 uses of `.single()` in the service
layer; each throws `PGRST116` on zero rows. Most sit after an insert (safe), but
the read-path ones against currently-empty tables throw instead of rendering an
empty state.
> Want a sweep converting the read-path ones?

**E3. What's the actual near-term goal?** Recruiting a new intake? Looking
credible to schools/sponsors? Getting existing members to return? I've been
optimising for internal consistency, which is a proxy — knowing the real goal
would let me prioritise properly.
> ______
