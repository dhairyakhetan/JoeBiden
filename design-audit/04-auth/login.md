# Login — `/login`

**File:** `auth/LoginPage.tsx` (296 lines), `LoginPage.css`.

## What this page is

**Intent:** the single entry point for both first-time sign-up and returning sign-in — the highest-stakes page in the funnel, since every account starts here.

## What's genuinely working — this page is a case study in fixing exactly the faults this audit looks for

The comments on this file read like a finished version of this very audit, written by whoever built it: *"People weren't bouncing because the button was hard to find — they bounced because they couldn't tell what pressing it would commit them to."* The fixes that follow are precise, not decorative:
- The button reads **"Sign up / sign in with Google"** and is followed immediately by **"This is the sign-up. No separate form."** — because visitors were reading "Sign in," concluding an account had to already exist, hunting for a nonexistent "create account" button, and leaving.
- A three-step "how joining works" list (Google → name & class → a director approves you) sits directly under the CTA, because the real blocker wasn't findability, it was not knowing what they'd be committing to.
- The footer link changed from "new here? see open roles →" (which pointed a first-time visitor *away* from the one button that signs them up) to "just looking? browse open roles →" — worded so it can't be mistaken for the primary path.
- `PLACE_AND_YEAR` is centralized specifically because the founding year previously said "est. 2023" here against eleven other surfaces saying 2021 — "on the one page where someone is deciding whether this org is real," per the comment.
- Email/password is deliberately de-emphasized behind a toggle, correctly reflecting that it's a legacy fallback, not a co-equal path.

## Findings

No P0/P1s — this page already does the work the rest of this audit keeps asking for elsewhere. One P2: the decorative background blobs (`lg-blob`) are marked `aria-hidden` correctly, but worth confirming in `LoginPage.css` that any animation on them is covered by the site's global reduced-motion catch-all (not verified in this pass, flagged only for completeness since every other decorative motion instance in this audit has been individually checked).
