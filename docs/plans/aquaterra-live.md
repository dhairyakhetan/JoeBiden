# AquaTerra.live: the events hub and the Disco Diwali experience (plan)

Source: `AquaTerra_Live_PRD_v2.md` (owner: Krish Goenka, 22 Oct 2026, kept by the owner; this file records how it is built here).
Event: Disco Diwali, The Masquerade Sangeet Edition, **10 November 2026**. Phase 1 target: about 5 November.

## Owner decisions (2026-10-22, recorded, not to be re-asked)

| Question | Answer |
| --- | --- |
| Scope | The entire PRD. Disco Diwali ticketing already exists in the TerraThon admin and is reused, not rebuilt. |
| Where | A new section of this repo and this Supabase project: routes under `/live`, tables `live_*`. One deploy. The domain `aquaterra.live` can point at the same Vercel project later. |
| Design | Its own system, as the PRD says (like Paradox and Terra Notes). The AQ rounded-minimal guardrails do not apply; section "Design" below says what does. |
| Payments | None online. An admin issues the ticket after UPI or WhatsApp confirmation (this is what the desk already does). |
| Money figures | Percentages and programme names only, no rupee amounts. |
| Face search | Not in v1. Ship the standard gallery first; face search only after guardian consent and a retention policy exist. |
| Guest login | Keep the existing `DD26-XXXX` IDs. A guest enters the ID and the phone number the ticket was booked with. Rate limited. Date of birth is entered once by the guest on first login (optional) or by an admin in the desk. |
| Look | Approved as proposed: Anton (or Bebas Neue) uppercase headlines, Instrument Serif Italic for the last word, Inter body. Disco Diwali red, Starry Night deep blue and silver, TerraThon and Paradox keep their existing accents. |
| Songs | 2 per guest, edits close 9 Nov 6 pm IST, admin approves, profanity filter first. |
| Content | The owner has photos and video from past events, sponsor and stall logos with permission, and attendee counts. Anything not yet supplied is a clean empty state or a dashed marker, never an invented number. |

Still open (the PRD's own list), to ask when the slice needs it: payment phases and dates beyond what the desk holds (live: TerraThon Special 550 closed, Early Bird 450 open from 22 Oct), venue and schedule for 10 Nov (venue is TBD in the desk), whether the cosmic card is printed or digital, who holds admin accounts (today: the dedicated TerraThon desk account), the hero video footage.

## What exists already (read before building)

- `frontend/src/terrathon/`: the TerraThon sub-app with its own look (`terrathon.css`, `tt-*`), a dedicated admin sign-in (`admin/AdminGate.tsx`: a real Supabase session on a leader account, RLS `is_director() or is_super_admin()`), and the **Disco Diwali desk** at `/terrathon/admin/disco-diwali`: manual ticket logging, phases and prices (`disco_diwali_settings.dd_phases`), thank-you message templates, CSV export, fast entry, attended tick. Tables `disco_diwali_registrations` (94 tickets, all paid) and `disco_diwali_settings`. IDs look like `DD26-K3X7` (`lib/discoDiwali.ts`, `generateDdId`).
- The TerraThon QR check-in (`admin/Checkin.tsx`, zxing) for TerraThon tickets.
- Paradox (`frontend/src/paradox/`) for the other event look and the After Party desk it was ported from.
- The `/dev/*` harnesses, the Playwright fixtures, and `design_tally.sh` (not applicable to `/live` styling, but the accessibility, state and motion rules in `DESIGN_GUARDRAILS.md` G8, G10, G11, G16, G17 still apply).

## Architecture

- **Routes (lazy, code split, its own CSS file):** `/live` home, `/live/events`, `/live/events/:slug`, `/live/vault`, `/live/why`, `/live/company`, `/live/crew`, `/live/faq`, `/live/contact`; the microsite `/live/disco-diwali` (public), `/live/disco-diwali/enter` (login), `/live/disco-diwali/me` (cosmic area, songs, QR ticket), later `/live/disco-diwali/feedback` and `/live/disco-diwali/photos`; the admin under `/live/admin/*` behind the existing TerraThon `AdminGate`.
- **Hub content tables (public read of published rows, leader write):** `live_events`, `live_highlights`, `live_media`, `live_sponsors`, `live_event_sponsors`, `live_stalls`, `live_event_stalls`, `live_performers`, `live_crew` (only `consent_on_file`), `live_impact`, `live_faq`, `live_settings` (banner, loader text, contact), `live_enquiries` (insert by anyone, read by leaders), `live_reminders`. A public storage bucket `live-media` for published images.
- **Guests never reach the client.** The `disco_diwali_registrations` table stays closed to anon. One edge function, `live-guest`, does everything a guest can do (`login`, `me`, `songs`, `feedback`), using the service role and a session token whose hash is stored in `live_guest_sessions` (no signing secret to manage). Failed logins are counted in `live_login_attempts` per IP hash and per ID: 5 failures in 10 minutes means a cooldown.
- **Disco ticketing reuse:** extra columns on `disco_diwali_registrations` (additive): `dob`, `class_grade`, `email`, `guardian_name`, `guardian_phone`, `consent_flags`, `checked_in_at`. The desk's add and edit forms gain those fields and the WhatsApp message gains the guest link. QR check-in is added to the Disco desk by reusing the zxing scanner.
- **Public phase and price:** a small read-only function returns only the live phase label and amount (never the guest list) for the ticket drawer.
- **Sun sign:** a pure, tested function over the PRD's table (section 13), the single source of truth.
- **Admin content editor:** one generic table editor driven by field configs, so each content table costs a config, not a screen.

## Design (the events system, not AQ's)

Dark near-black base with film grain; uppercase display headlines with the last word in italic serif; numbered chapter kickers (`01 / Who are we?`); one primary action per screen; a sticky CTA; marquee tickers; sticker tags (LIVE, SOLD OUT, PAST); per-event accent through CSS variables; Disco Diwali is black, deep red, gold hairlines and bone white, red only for large display type (contrast), the cosmic area is navy to violet with a star field. Motion honours reduced motion and data saver; the video hero loads after the poster paints and mobile on a slow connection shows the poster only. Mobile first at 360 px. Its guardrails that DO carry over: tap targets, states (loading, empty, error), toasts and confirms on every mutation, no em dashes, no invented numbers, no photos of minors beside names, image sizes, accessibility. Fonts are loaded the way TerraThon loads its own (Google Fonts, display swap, scoped to this section), within the bundle budget (eager 683.6 KB; this section is all lazy).

## Slices (each one: migration if any, code, tests, browser check at 360 and 1440, one PR, merged on green)

1. **Foundation.** `LiveRoot`, shell (loader, nav overlay, footer, grain, sticky CTA), tokens and fonts, route wiring, sitemap and routing checks, plan and guardrails file.
2. **Hub data and public pages.** Migration for the content tables, policies and storage bucket; home sequence (loader, hero with poster fallback, upcoming banner with countdown from settings, marquee, chapters 01 to 07), events timeline and the event detail template with hidden empty sections, Why we host, Good company, Crew, FAQ, Contact form to the enquiries inbox. Seed two events (TerraThon 2026 past or upcoming per the owner, Disco Diwali 2026 upcoming) with no invented figures.
3. **Disco Diwali public microsite.** Loader "Masks on.", hero with countdown and "Claim your mask", invitation, lineup, company, mask code, FAQ, final CTA, the ticket drawer with the live phase and price, tap-to-call and WhatsApp for the event contact.
4. **Guest login, cosmic reveal, songs, QR ticket.** The `live-guest` function and its tables, the sun sign function and its tests, the curtain transition, the sealed-card teaser, song requests (2, cutoff, moderation), the QR ticket, calendar and map links. Simulated sessions for every refusal path before it ships.
5. **Admin.** The content editor, the Disco desk additions (DOB, guardian, class, email, consent, WhatsApp message with link, QR check-in, duplicate detection), songs moderation, enquiries inbox, dashboard counts, audit entries.
6. **Phase 2.** The Vault, the feedback form (toggle, one per ticket, CSV), the standard personal gallery (no face search), impact counters, Instagram feed, Spotify playlist embed, sponsor-facing event report.
7. **Phase 3.** Reminder opt-in automation, sponsor and stall enquiry flows, SEO and Open Graph cards, then face search only after the consent and retention policy exist.

## Risks and how this plan meets them

- **Minors' data (DPDP Act).** The guests table never reaches the client; guardian fields are optional in the desk and required for under-18s once the owner confirms the consent wording; no names beside photos of minors on the public hub; face search deferred. A lawyer should confirm the consent text (the PRD says so too).
- **Guessable IDs.** The existing four-character IDs are weak alone, hence ID plus phone, rate limits, a cooldown, and no data on the login response beyond name and status.
- **Speed.** Hero video and effects cost budget phones: poster first, no video on data saver, lazy sections, bundle budget checked in CI.
- **Content gaps.** Empty states are designed, not apologetic; nothing shows a number without a source.
- **Time.** The event is on 10 November. Slices 1 to 5 are the critical path; 6 and 7 follow the event.

## Build status and design change (2026-10-24)

**Design change, owner-directed 2026-10-24.** The hub moved from a dark near-black system to an editorial festival look, from two
references the owner supplied: cream paper, **black ink, red and gold** (no navy), blackletter display type (UnifrakturMaguntia for
display sizes, Pirata One for every heading under that, because the display face's `k` and `s` read as `f` when small), a red-to-paper
hero gradient, a curved photo arc, boxed red nav chips, white paper cards that overlap big photographs, a red ticker, and **film
grain** (an animated overlay on the page, static grain baked into gradients and photographs). Sections flip tone locally
(`lv-tone-night`, `lv-tone-red`) by re-pointing the `--lv-*` variables. Tokens and the shell are `live/live.css`; the Disco page is
`live/disco.css`. `styles/v6.css` pins every `h1` to `h6` to NeutralFace with `!important`, so `.lv-root` overrides it (see the
comment in `live.css`). Motion is off under `prefers-reduced-motion`; the grain stays, still.

**Built and in the app** (all lazy, all under `/live`): home, `disco-diwali` (the flagship), `events`, `events/:slug`, `vault`, `why`,
`company`, `crew`, `faq`, `contact` (a real form), and the admin at
`admin`, `admin/disco-diwali`, `admin/enquiries`, `admin/content`, all behind the existing TerraThon `AdminGate` (now `brand="live"`).
The Disco desk and its fast-entry sheet are restyled by token re-point only (`live/admin/deskTokens.css`, class `lv-desk`), so the
old `/terrathon/admin/disco-diwali` route looks the same and no saved link broke. Every empty state is designed: nothing prints a
number or a name without a source (the sponsors, stalls, performers, lineup and dress code are dashed markers or "after consent").

**Per-participant fields added to the Disco desk (owner, 2026-10-24):** an Instagram handle (normalised from `@name`, a bare name or a
pasted profile link; validated against Instagram's rules), an "added to Close Friends" tick that drives a checklist filter ("To add to
close friends (N)"), and a date of birth. All three are in fast entry, the desk's add form and edit modal, the ticket details, search
(handle), the CSV and the WhatsApp paste parser. DOB is personal data and some guests are minors: leaders only, and shown to the
guest themselves only through the `live-guest` function.

**Catch-up sheet (owner, 2026-10-25):** for tickets booked before those fields existed, the desk's "Catch up (N)" button (and `?catchup=1`, linked from the admin home) opens one row per ticket with the handle, date of birth and Close Friends tick as inline fields. Each saves when you leave it, bad values are refused with a reason, and the list is a snapshot so rows do not jump while you type. No migration for the sheet itself.

**The date of birth is a free-text note (owner, 2026-10-25: "it is like a note so keep it to that").** The desk never parses, formats or refuses it: whatever is typed is stored as typed (trimmed, blank becomes nothing, 80 characters at most). That needed the column changed from `date` to `text` (`frontend/scripts/disco_diwali_dob_free_text_2026_10_25.sql`, **applied** as `disco_diwali_dob_free_text`; the 5 dates already entered were kept as `dd/mm/yyyy` text). Verified live as a leader in a rolled-back transaction: free text and an impossible date save, 80 characters is fine, 81 and an empty string are refused.

### Database and function status (checked against the live project on 2026-10-24)

| What | File | State |
| --- | --- | --- |
| Instagram, Close Friends, DOB columns | `frontend/scripts/disco_diwali_instagram_2026_10_24.sql` | **Applied** (`disco_diwali_instagram_close_friends_dob`). The 115 existing tickets took the safe default. A real active leader, impersonated inside a rolled-back transaction, can read, insert (handle, DOB, close-friends tick) and update; a signed-in non-leader sees 0 rows and cannot insert. |
| Contact form inbox | `frontend/scripts/live_enquiries_2026_10_24.sql` | **Applied** (`live_enquiries_inbox`). anon can insert, cannot read, cannot forge `handled`. |
| Editable nights and programmes | `frontend/scripts/live_content_2026_10_24.sql` | **Applied** (`live_content_events_programmes`, then `live_events_when_key_strict`) and **seeded** with the 5 nights and 4 programmes that were in `data/content.ts`. Edited at `/live/admin/content`. anon reads published rows only; leaders read and write all; nothing is removed, a leader unticks Published. |
| Guest sessions, login throttling, songs, blocked words | `frontend/scripts/live_guest_2026_10_24.sql` | **NOT applied, by the owner's decision (2026-10-24: leave the guest area off).** The first attempt paused on a confirmation prompt; nothing was half-applied. |
| The guest function | `supabase/functions/live-guest/index.ts` | **Not deployed.** |

**Guest sign-in is REMOVED from the app (owner, 2026-10-24: "no guest login as of now", to be built separately).** There are no guest routes, pages, songs desk or config flag. `live_guest_2026_10_24.sql` and `supabase/functions/live-guest/index.ts` remain as unwired drafts and are not applied or deployed.

**Admin hardening (owner: "only the admin portion needs to be bulletproof").** A trigger scrubs `updated_by` on the content tables (migration `live_content_never_store_editor_identity`); public reads use explicit column lists plus `published = true`; content is hidden, never deleted; every mutation is optimistic with rollback and a plain-words error; form labels are associated with their controls. Verified by an end-to-end browser run of 59 checks against the dev harness (`/dev/admin`, failure injection for write, read and silent failures) and by role impersonation in rolled-back transactions against the live database. A real password sign-in could not be exercised from the sandbox.

**Editable content.** The public pages start from the typed `data/content.ts` (instant paint, and the fallback if the tables are empty or unreachable) and swap to the tables when they answer (`live/lib/useContent.ts`, cached 5 minutes). The countdown date and the ticket link stay in `live/config.ts`; photos are files, so a new photo needs a deploy.

### Decisions recorded 2026-10-24
- **Consent:** the owner confirmed consent is verified for every photo; all are marked `confirmed`. The Vault keeps a one-tap takedown on each photo.
- **The "Block your calendar" poster** is on the site: the owner confirmed its Bhai Dooj line is correct.
- **Summer AQ turns five** stays dated "Summer 2026".
- **Ticket price** stays in the WhatsApp chat, not on the page. **Editions** (2024 Edition 1.0, 2025 Edition 2.0, 2026 Masquerade Sangeet) confirmed.

### Still open
- **The sun sign** (draft only) uses standard tropical date ranges, not the owner's PRD table. Matters when guest sign-in is built.
- **Not built:** reminder opt-in, the feedback form, face search (all deferred by the plan), and a read-only function that returns the live ticket phase for a price drawer (the owner chose to keep price off the page).
