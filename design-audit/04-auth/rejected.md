# Rejected / Suspended — `/rejected`

**File:** `auth/RejectedPage.tsx` (81 lines, no dedicated CSS).

## What this page is

**Intent:** someone who was not approved (or was suspended) — the hardest tone to get right in the whole app, since it has to close a door honestly without slamming it.

## Current design

Two distinct copy sets for "rejected" vs. "suspended," an optional real rejection note quoted from the director who declined them, a "what now" list (re-apply after 30 days / reach out on Instagram / volunteer informally without being a member), and exit actions (talk to us / back home / log out).

## Findings

No faults found. The tone is notably well-calibrated for a hard message to a young audience: "not this round" (rather than a blunt "rejected") softens without being dishonest, and surfacing the director's actual `rejection_note` when one exists treats the applicant as owed a real reason rather than a form-letter brush-off. Offering "volunteer at community drives without being a formal member" as a real, concrete alternative — not just "reapply later" — is a genuinely good design instinct: it gives a rejected applicant something to *do* right now instead of only something to wait for.
