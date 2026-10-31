# Auth Callback — `/auth/callback`

**File:** `auth/AuthCallbackPage.tsx` (42 lines).

## What this page is

**Intent:** none of the visitor's own — this is a pure post-OAuth routing decision, rendered only as a centered spinner so a returning member never sees the full login form flash before being routed onward.

## Findings

Nothing to flag. There's no UI here to misalign with intent — the only thing to get right is the routing logic itself, and it correctly covers all four member states (new/active/pending/rejected-or-suspended) plus the no-session case, with the intended post-login destination preserved across the full-page OAuth redirect via a sessionStorage stash (since React Router state doesn't survive it). A one-purpose page doing its one purpose correctly.
