# Register — `/register`

**File:** `auth/RegisterPage.tsx` (266 lines), `RegisterPage.css`, `components/AuthFeaturePanel.tsx` (not read in this pass).

## What this page is

**Intent:** an authenticated-but-incomplete member finishing the minimum info a director needs to review them — the shortest possible distance between "I signed in" and "I've applied."

## Current design

One question per screen (name → class/year → phone) with a progress bar, instead of a single dense form — a deliberate choice per its own comment, referencing a design source that specified this exact pattern.

**Working well:** the completion screen's copy is sourced from the same `APPROVAL_TIME` constant as every other SLA claim in the app, with a comment explaining precisely why: this exact screen used to say "usually 24 hours, sometimes 48" while the very next screen (`/pending`) said "within a week" — a promise contradicted one click later, which the comment calls "the most expensive line in the app" for an org whose pitch is honesty. Locking the email field's helper text ("that part's locked to your google account") pre-answers a question before it becomes a support request.

## Findings

No P0/P1 findings. The one-question-per-screen flow, the auto-redirect guards for every member status (active/pending/rejected/suspended) landing on `/register` by mistake, and the consistent SLA copy all hold up under the same lens this audit applies everywhere else. This page and Login are the strongest pair in the audit — worth treating as the reference standard when tightening copy elsewhere (e.g. the "usually replies within a week" framing flagged as worth double-checking on Home turns out, here, to be exactly the deliberate and correctly-centralized choice it should be).
