# Contact — `/contact`

**Files:** `public/ContactPage.tsx`, `ContactPage.css`.

## What this page is

**Intent:** a visitor with a specific reason to reach the org (partnership, press, general question) who wants confidence the message actually arrived.

## Current design

A postcard-styled form (name/email/subject dropdown/message) that tries a Supabase insert first, and on failure opens a pre-filled `mailto:` draft as a fallback — with an honest in-page state explaining exactly that happened. A successful submit navigates to `/thank-you?from=contact`.

**Working well, and worth citing specifically:** the comments in this file describe a real prior bug — a failed database insert used to still show "Message sent!" — and the fix is genuinely good product thinking, not just a status-code check: it *tells the user their message did not send*, opens the drafted email for them, and gives them a real button to reopen that draft if the popup didn't register. That's the honest-by-default posture the rest of the org's copy claims (see `orgFacts.ts`'s comment about "an org whose whole pitch is being straight with people") actually implemented in error-handling code, not just in marketing copy.

## Intent-driven affordance audit

### P1 — The `mailto:` fallback's `window.open()` call happens after two `await`s, which many browsers will silently block as a popup
`handleSubmit` does `await checkText(...)` then `await supabase.from(...).insert(...)` before reaching `window.open(mailtoFor())` in the failure branch. Popup blockers (Safari and Firefox in particular) key off whether a `window.open` is the *synchronous, direct* result of a user gesture — two awaited network calls in between is enough for some browsers to treat it as programmatic and block it. If that happens, the toast still says "check your email app," but no tab or window ever opened — the one fallback this form has for a failed submission can fail invisibly. The `submitted` state's "reopen the draft" `<a href={mailtoFor()}>` button is a safe, synchronous-click fallback for exactly this case, but a user who never saw a popup in the first place has no reason to know that link exists or to trust it'll do anything different. Worth a real-browser check (Safari especially); if it does get blocked, lead with the visible "reopen the draft" link/button rather than relying on the popup succeeding.

### P2 — The subject dropdown offers org-partnership options that duplicate a better-built dedicated form one click away
"partnership or collaboration," "school or college collab," and "NGO partnership" are all options in Contact's generic subject `<select>` — but `/collaborations` already has a purpose-built proposal form for exactly this intent (org name, contact name, collab-type chips, phone, richer validation). A visitor with a school/NGO partnership in mind who lands on Contact first (a very plausible path — Contact is in the primary nav's mobile sheet; Collaborations is one level deeper) has no nudge toward the form actually designed for their case. Consider a lightweight redirect/suggestion when one of those three subjects is selected ("this looks like a partnership — want the dedicated form instead?").
